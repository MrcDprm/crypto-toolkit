// Password-based encryption: PBKDF2-SHA256 turns the password into an
// AES-256 key, AES-GCM encrypts and authenticates the data.
//
// Package layout (all integers big-endian):
//   "CTK" | version (1) | iterations (4) | salt (16) | iv (12) | ciphertext + GCM tag (16)
// The first 36 bytes (the header) are passed to AES-GCM as additional data,
// so changing the version, iteration count, salt or IV also fails the check.
import { CryptoError, concat, fromBase64, fromUtf8, randomBytes, toBase64, utf8 } from "./encoding.js";

const MAGIC = utf8("CTK");
const VERSION = 1;
const SALT_BYTES = 16;
const IV_BYTES = 12; // 96-bit IV: the size GCM is designed for
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC.length + 1 + 4 + SALT_BYTES + IV_BYTES;

// OWASP's 2023 recommendation for PBKDF2-HMAC-SHA256.
export const DEFAULT_ITERATIONS = 600_000;
// A package says how many iterations to run; a forged one with billions
// would freeze the tab, so decryption accepts only a sane range.
export const MIN_ITERATIONS = 100_000;
export const MAX_ITERATIONS = 10_000_000;
export const MIN_PASSWORD_LENGTH = 8;

async function deriveKey(password, salt, iterations) {
  // NFC: "ş" typed as one character or as "s" + combining cedilla must give
  // the same key, otherwise a password from another device would not work.
  const material = await crypto.subtle.importKey(
    "raw", utf8(password.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false, // the key can never be exported from the browser
    ["encrypt", "decrypt"]);
}

export async function encryptBytes(plain, password, iterations = DEFAULT_ITERATIONS) {
  if ([...password].length < MIN_PASSWORD_LENGTH) throw new CryptoError("passwordShort");
  const salt = randomBytes(SALT_BYTES); // a new salt gives a new key every time
  const iv = randomBytes(IV_BYTES);     // never reuse an IV with the same key
  const header = new Uint8Array(HEADER_BYTES);
  header.set(MAGIC, 0);
  header[3] = VERSION;
  new DataView(header.buffer).setUint32(4, iterations);
  header.set(salt, 8);
  header.set(iv, 8 + SALT_BYTES);

  const key = await deriveKey(password, salt, iterations);
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: header, tagLength: TAG_BYTES * 8 }, key, plain);
  return concat(header, new Uint8Array(sealed));
}

// Reads the header without the password: the page shows these details and
// rejects input that is not a package before running the slow key derivation.
export function inspect(pkg) {
  if (pkg.length < HEADER_BYTES + TAG_BYTES || !MAGIC.every((b, i) => pkg[i] === b)) {
    throw new CryptoError("format");
  }
  if (pkg[3] !== VERSION) throw new CryptoError("version");
  const iterations = new DataView(pkg.buffer, pkg.byteOffset).getUint32(4);
  if (iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) throw new CryptoError("format");
  return {
    version: pkg[3],
    iterations,
    salt: pkg.subarray(8, 8 + SALT_BYTES),
    iv: pkg.subarray(8 + SALT_BYTES, HEADER_BYTES),
    size: pkg.length - HEADER_BYTES - TAG_BYTES,
  };
}

export async function decryptBytes(pkg, password) {
  const { iterations, salt, iv } = inspect(pkg);
  const key = await deriveKey(password, salt, iterations);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: pkg.subarray(0, HEADER_BYTES), tagLength: TAG_BYTES * 8 },
      key, pkg.subarray(HEADER_BYTES));
    return new Uint8Array(plain);
  } catch {
    // GCM cannot tell a wrong password from a modified package: both make
    // the tag check fail, and the message says exactly that.
    throw new CryptoError("decrypt");
  }
}

export const encryptText = async (text, password, iterations) =>
  toBase64(await encryptBytes(utf8(text), password, iterations));

export const decryptText = async (base64, password) =>
  fromUtf8(await decryptBytes(fromBase64(base64), password));
