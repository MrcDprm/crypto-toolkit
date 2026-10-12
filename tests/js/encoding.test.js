import { test } from "node:test";
import assert from "node:assert/strict";
import { concat, fromBase64, fromPem, fromUtf8, toBase64, toHex, toPem, utf8 } from "../../src/CryptoToolkit.Web/wwwroot/js/crypto/encoding.js";

const rejectsWith = (code) => (err) => err.code === code;

test("Base64 round-trips every byte value", () => {
  const all = new Uint8Array(256).map((_, i) => i);
  assert.deepEqual(fromBase64(toBase64(all)), all);
});

test("Base64 handles inputs larger than one chunk", () => {
  const big = new Uint8Array(100_000).map((_, i) => i * 7);
  assert.deepEqual(fromBase64(toBase64(big)), big);
});

test("Base64 accepts pasted line breaks and spaces", () => {
  assert.equal(fromUtf8(fromBase64(" aGVs\nbG8g\r\nd29y bGQ= ")), "hello world");
});

test("Base64 rejects invalid or empty input", () => {
  for (const bad of ["", "   ", "abc", "a$cd", "ab==cd==", "aGVsbG8-"]) {
    assert.throws(() => fromBase64(bad), rejectsWith("base64"), JSON.stringify(bad));
  }
});

test("UTF-8 keeps Turkish characters and emoji", () => {
  const text = "Şifre: ğüşiöçİı 🔐";
  assert.equal(fromUtf8(utf8(text)), text);
});

test("invalid UTF-8 is reported instead of turning into replacement characters", () => {
  assert.throws(() => fromUtf8(new Uint8Array([0xff, 0xfe])), rejectsWith("notText"));
});

test("hex and concat", () => {
  assert.equal(toHex(new Uint8Array([0, 15, 255])), "000fff");
  assert.deepEqual(concat(new Uint8Array([1]), [2, 3], new Uint8Array()), new Uint8Array([1, 2, 3]));
});

test("PEM wraps at 64 characters and reads back", () => {
  const der = new Uint8Array(200).map((_, i) => i);
  const pem = toPem(der, "PUBLIC KEY");
  const lines = pem.trim().split("\n");
  assert.equal(lines[0], "-----BEGIN PUBLIC KEY-----");
  assert.equal(lines.at(-1), "-----END PUBLIC KEY-----");
  assert.ok(lines.slice(1, -1).every((l) => l.length <= 64));
  assert.deepEqual(fromPem(pem, "PUBLIC KEY"), der);
});

test("PEM with the wrong label or a broken body is rejected", () => {
  const pem = toPem(new Uint8Array([1, 2, 3]), "PUBLIC KEY");
  assert.throws(() => fromPem(pem, "PRIVATE KEY"), rejectsWith("pem"));
  assert.throws(() => fromPem("-----BEGIN PUBLIC KEY-----\n$$$\n-----END PUBLIC KEY-----", "PUBLIC KEY"), rejectsWith("pem"));
  assert.throws(() => fromPem("not a key", "PUBLIC KEY"), rejectsWith("pem"));
});
