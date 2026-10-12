// Byte helpers shared by every tool. They run unchanged in the browser and in
// Node (tests), which both provide TextEncoder, atob/btoa and crypto.subtle.

// Every failure the tools can explain to the user. The code doubles as the
// language key ("js.err.<code>"), so no raw exception text reaches the page.
export class CryptoError extends Error {
  constructor(code) {
    super(code);
    this.name = "CryptoError";
    this.code = code;
  }
}

const encoder = new TextEncoder();
// fatal: invalid UTF-8 throws instead of turning into "�".
const decoder = new TextDecoder("utf-8", { fatal: true });

export const utf8 = (text) => encoder.encode(text);

export function fromUtf8(bytes) {
  try {
    return decoder.decode(bytes);
  } catch {
    throw new CryptoError("notText");
  }
}

export function toBase64(bytes) {
  // btoa takes a "binary string"; build it in chunks so large inputs do not
  // overflow the call stack of String.fromCharCode(...bytes).
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function fromBase64(text) {
  // Pasted text often carries line breaks or spaces; anything else is an error.
  const clean = String(text).replace(/\s+/g, "");
  if (clean === "" || clean.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) {
    throw new CryptoError("base64");
  }
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export const toHex = (bytes) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

export function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export const randomBytes = (length) => crypto.getRandomValues(new Uint8Array(length));

// PEM is Base64 of the DER key between "-----BEGIN <label>-----" lines,
// wrapped at 64 characters (RFC 7468).
export function toPem(der, label) {
  const body = toBase64(new Uint8Array(der)).match(/.{1,64}/g).join("\n");
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----\n`;
}

export function fromPem(pem, label) {
  const match = String(pem).trim().match(
    new RegExp(`^-----BEGIN ${label}-----([\\s\\S]+?)-----END ${label}-----$`));
  if (!match) throw new CryptoError("pem");
  try {
    return fromBase64(match[1]);
  } catch {
    throw new CryptoError("pem");
  }
}
