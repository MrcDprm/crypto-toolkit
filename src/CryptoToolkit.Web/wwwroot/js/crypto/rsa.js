// RSA-OAEP key pairs and hybrid encryption.
//
// RSA can only encrypt a few hundred bytes, so data is encrypted with a fresh
// AES-256-GCM key and RSA encrypts ("wraps") only that key. Only the holder
// of the private key can unwrap it and read the data.
//
// Package layout (all integers big-endian):
//   "CTH" | version (1) | wrapped key length (2) | wrapped key | iv (12) | ciphertext + GCM tag (16)
// Everything before the ciphertext is passed to AES-GCM as additional data.
import { CryptoError, concat, fromBase64, fromPem, fromUtf8, randomBytes, toBase64, toHex, toPem, utf8 } from "./encoding.js";

const MAGIC = utf8("CTH");
const VERSION = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const RSA = { name: "RSA-OAEP", hash: "SHA-256" };

export const KEY_SIZES = [2048, 3072, 4096];
// Below 2048 bits RSA is considered breakable; such keys are refused.
const MIN_KEY_BITS = 2048;

export async function generateKeyPair(bits = 3072) {
  if (!KEY_SIZES.includes(bits)) throw new CryptoError("keySize");
  return crypto.subtle.generateKey(
    { ...RSA, modulusLength: bits, publicExponent: new Uint8Array([1, 0, 1]) }, // e = 65537
    true, ["encrypt", "decrypt", "wrapKey", "unwrapKey"]);
}

export const exportPublicPem = async (key) =>
  toPem(await crypto.subtle.exportKey("spki", key), "PUBLIC KEY");

export const exportPrivatePem = async (key) =>
  toPem(await crypto.subtle.exportKey("pkcs8", key), "PRIVATE KEY");

async function importKey(format, der, usages) {
  let key;
  try {
    key = await crypto.subtle.importKey(format, der, RSA, format === "spki", usages);
  } catch {
    // Valid PEM but not an RSA key of this kind (e.g. an ECDSA key).
    throw new CryptoError("keyType");
  }
  if (key.algorithm.modulusLength < MIN_KEY_BITS) throw new CryptoError("keyWeak");
  return key;
}

export const importPublicPem = async (pem) =>
  importKey("spki", fromPem(pem, "PUBLIC KEY"), ["encrypt", "wrapKey"]);

// Imported private keys stay non-extractable: the page cannot leak them back out.
export const importPrivatePem = async (pem) =>
  importKey("pkcs8", fromPem(pem, "PRIVATE KEY"), ["decrypt", "unwrapKey"]);

// SHA-256 of the public key, so two people can compare keys by reading a
// short string aloud instead of the whole PEM.
export async function fingerprint(publicKey) {
  const spki = await crypto.subtle.exportKey("spki", publicKey);
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", spki)));
}

export async function encryptBytes(plain, publicKey) {
  const aesKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const wrapped = new Uint8Array(await crypto.subtle.wrapKey("raw", aesKey, publicKey, RSA));
  const iv = randomBytes(IV_BYTES);
  const header = concat(MAGIC, [VERSION], [wrapped.length >> 8, wrapped.length & 0xff], wrapped, iv);
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: header, tagLength: TAG_BYTES * 8 }, aesKey, plain);
  return concat(header, new Uint8Array(sealed));
}

// Splits a package into its parts without a key; the page shows these
// details, and input that is not a package is rejected early.
export function inspect(pkg) {
  if (pkg.length < MAGIC.length + 3 || !MAGIC.every((b, i) => pkg[i] === b)) {
    throw new CryptoError("format");
  }
  if (pkg[3] !== VERSION) throw new CryptoError("version");
  const wrappedLength = (pkg[4] << 8) | pkg[5];
  const ivStart = 6 + wrappedLength;
  const headerEnd = ivStart + IV_BYTES;
  if (pkg.length < headerEnd + TAG_BYTES) throw new CryptoError("format");
  return {
    version: pkg[3],
    wrappedKey: pkg.subarray(6, ivStart),
    iv: pkg.subarray(ivStart, headerEnd),
    headerEnd,
    size: pkg.length - headerEnd - TAG_BYTES,
  };
}

export async function decryptBytes(pkg, privateKey) {
  const { wrappedKey, iv, headerEnd } = inspect(pkg);

  let aesKey;
  try {
    aesKey = await crypto.subtle.unwrapKey(
      "raw", wrappedKey, privateKey, RSA, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  } catch {
    // The package was made for another public key (or the key part was changed).
    throw new CryptoError("wrongKey");
  }
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: pkg.subarray(0, headerEnd), tagLength: TAG_BYTES * 8 },
      aesKey, pkg.subarray(headerEnd));
    return new Uint8Array(plain);
  } catch {
    throw new CryptoError("tampered");
  }
}

export const encryptText = async (text, publicKey) =>
  toBase64(await encryptBytes(utf8(text), publicKey));

export const decryptText = async (base64, privateKey) =>
  fromUtf8(await decryptBytes(fromBase64(base64), privateKey));
