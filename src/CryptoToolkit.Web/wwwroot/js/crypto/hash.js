// Hashes (SHA-256 / SHA-512) and HMAC.
//
// A hash is a fixed-size fingerprint of the data: any change gives a
// completely different value, and the data cannot be recovered from it.
// HMAC mixes a secret key in, so only key holders can produce or check it.
import { CryptoError, toHex } from "./encoding.js";

export const ALGORITHMS = ["SHA-256", "SHA-512"];

function checkAlgorithm(algorithm) {
  if (!ALGORITHMS.includes(algorithm)) throw new CryptoError("algorithm");
}

export async function digest(data, algorithm = "SHA-256") {
  checkAlgorithm(algorithm);
  return toHex(new Uint8Array(await crypto.subtle.digest(algorithm, data)));
}

export async function hmac(data, keyBytes, algorithm = "SHA-256") {
  checkAlgorithm(algorithm);
  if (keyBytes.length === 0) throw new CryptoError("hmacKey");
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: algorithm }, false, ["sign"]);
  return toHex(new Uint8Array(await crypto.subtle.sign("HMAC", key, data)));
}

// Hashes published next to downloads come in many shapes ("AB 12 …",
// "sha256:ab12…"); compare only the hex digits, ignoring case.
export function normalizeHex(text) {
  return String(text).trim().toLowerCase().replace(/^sha(256|512)[:\s-]*/, "").replace(/[\s:]/g, "");
}

// Compares every character instead of stopping at the first difference, so
// the time taken does not reveal how much of an HMAC was right.
export function equalHex(a, b) {
  const x = normalizeHex(a);
  const y = normalizeHex(b);
  if (x.length !== y.length || !/^[0-9a-f]*$/.test(x + y)) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}
