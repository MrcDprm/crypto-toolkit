// Digital signatures with ECDSA on the P-256 curve and SHA-256.
//
// The private key signs a SHA-256 digest of the data; anyone with the public
// key can check that the data is unchanged and was signed by that key.
// Web Crypto returns the signature as r || s (2 × 32 bytes, IEEE P1363),
// not the DER format OpenSSL prints.
import { CryptoError, fromBase64, fromPem, toBase64, toHex, toPem } from "./encoding.js";

const EC = { name: "ECDSA", namedCurve: "P-256" };
const SIGN = { name: "ECDSA", hash: "SHA-256" };
const SIGNATURE_BYTES = 64;

export const generateKeyPair = async () => crypto.subtle.generateKey(EC, true, ["sign", "verify"]);

export const exportPublicPem = async (key) =>
  toPem(await crypto.subtle.exportKey("spki", key), "PUBLIC KEY");

export const exportPrivatePem = async (key) =>
  toPem(await crypto.subtle.exportKey("pkcs8", key), "PRIVATE KEY");

async function importKey(format, der, usages) {
  try {
    return await crypto.subtle.importKey(format, der, EC, format === "spki", usages);
  } catch {
    // Valid PEM but not a P-256 key (e.g. an RSA key).
    throw new CryptoError("keyType");
  }
}

export const importPublicPem = async (pem) => importKey("spki", fromPem(pem, "PUBLIC KEY"), ["verify"]);
export const importPrivatePem = async (pem) => importKey("pkcs8", fromPem(pem, "PRIVATE KEY"), ["sign"]);

export async function fingerprint(publicKey) {
  const spki = await crypto.subtle.exportKey("spki", publicKey);
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", spki)));
}

export async function sign(data, privateKey) {
  return toBase64(new Uint8Array(await crypto.subtle.sign(SIGN, privateKey, data)));
}

export async function verify(data, signatureBase64, publicKey) {
  const signature = fromBase64(signatureBase64);
  if (signature.length !== SIGNATURE_BYTES) throw new CryptoError("signature");
  return crypto.subtle.verify(SIGN, publicKey, signature, data);
}
