import { test } from "node:test";
import assert from "node:assert/strict";
import { fromBase64, toBase64, utf8 } from "../../src/CryptoToolkit.Web/wwwroot/js/crypto/encoding.js";
import {
  DEFAULT_ITERATIONS, MIN_ITERATIONS, decryptBytes, decryptText, encryptBytes, encryptText, inspect,
} from "../../src/CryptoToolkit.Web/wwwroot/js/crypto/password.js";

// The lowest accepted count keeps the tests fast; one test checks the default.
const FAST = MIN_ITERATIONS;
const PASSWORD = "doğru-at-pil-zımba";
const rejectsWith = (code) => (err) => err.code === code;

test("text round-trips with the right password", async () => {
  const text = "Merhaba dünya! Şifreli mesaj 🔐";
  const pkg = await encryptText(text, PASSWORD, FAST);
  assert.equal(await decryptText(pkg, PASSWORD), text);
});

test("binary data and empty input round-trip", async () => {
  for (const data of [new Uint8Array(0), new Uint8Array(70_000).map((_, i) => i)]) {
    const pkg = await encryptBytes(data, PASSWORD, FAST);
    assert.deepEqual(await decryptBytes(pkg, PASSWORD), data);
  }
});

test("the same text gives a different package every time", async () => {
  const a = await encryptText("aynı metin", PASSWORD, FAST);
  const b = await encryptText("aynı metin", PASSWORD, FAST);
  assert.notEqual(a, b); // fresh salt and IV; the old version always gave the same output
});

test("the header records version, iterations and sizes", async () => {
  const pkg = await encryptBytes(utf8("12345"), PASSWORD);
  const info = inspect(pkg);
  assert.equal(info.version, 1);
  assert.equal(info.iterations, DEFAULT_ITERATIONS);
  assert.equal(info.salt.length, 16);
  assert.equal(info.iv.length, 12);
  assert.equal(info.size, 5);
  assert.equal(pkg.length, 36 + 5 + 16);
});

test("a wrong password is rejected", async () => {
  const pkg = await encryptText("gizli", PASSWORD, FAST);
  await assert.rejects(decryptText(pkg, PASSWORD + "x"), rejectsWith("decrypt"));
});

test("changing any byte of the package is detected", async () => {
  const pkg = await encryptBytes(utf8("değiştirilmemeli"), PASSWORD, FAST);
  // version | iterations | salt | iv | ciphertext | tag
  for (const index of [3, 7, 10, 30, 40, pkg.length - 1]) {
    const copy = pkg.slice();
    copy[index] ^= 0x01;
    await assert.rejects(decryptBytes(copy, PASSWORD), (err) => ["decrypt", "version", "format"].includes(err.code), `byte ${index}`);
  }
});

test("passwords in different Unicode forms give the same key", async () => {
  const composed = "şifre-parola".normalize("NFC");
  const decomposed = composed.normalize("NFD");
  assert.notEqual(composed, decomposed);
  const pkg = await encryptText("metin", composed, FAST);
  assert.equal(await decryptText(pkg, decomposed), "metin");
});

test("short passwords are refused when encrypting", async () => {
  await assert.rejects(encryptText("metin", "1234567", FAST), rejectsWith("passwordShort"));
  // Length is counted in characters, not UTF-16 units: 7 emoji are still too short.
  await assert.rejects(encryptText("metin", "🔐".repeat(7), FAST), rejectsWith("passwordShort"));
});

test("input that is not a package is rejected before key derivation", async () => {
  await assert.rejects(decryptText("aGVsbG8gd29ybGQgaGVsbG8gd29ybGQgaGVsbG8gd29ybGQgaGVsbG8gd29ybGQ=", PASSWORD), rejectsWith("format"));
  await assert.rejects(decryptText("bu base64 değil", PASSWORD), rejectsWith("base64"));
  const pkg = await encryptBytes(utf8("x"), PASSWORD, FAST);
  await assert.rejects(decryptBytes(pkg.subarray(0, 40), PASSWORD), rejectsWith("format"));
});

test("an unknown version is reported as such", async () => {
  const pkg = await encryptBytes(utf8("x"), PASSWORD, FAST);
  pkg[3] = 2;
  assert.throws(() => inspect(pkg), rejectsWith("version"));
});

test("a forged iteration count cannot freeze the page", async () => {
  const pkg = await encryptBytes(utf8("x"), PASSWORD, FAST);
  new DataView(pkg.buffer).setUint32(4, 4_000_000_000);
  const forged = toBase64(pkg);
  await assert.rejects(decryptText(forged, PASSWORD), rejectsWith("format"));
  assert.ok(fromBase64(forged).length === pkg.length);
});
