import { test } from "node:test";
import assert from "node:assert/strict";
import { utf8 } from "../../src/CryptoToolkit.Web/wwwroot/js/crypto/encoding.js";
import { digest, equalHex, hmac, normalizeHex } from "../../src/CryptoToolkit.Web/wwwroot/js/crypto/hash.js";

const rejectsWith = (code) => (err) => err.code === code;

// Known-answer tests: published vectors prove the output, not just a round trip.
test("SHA-256 and SHA-512 match the NIST 'abc' vectors", async () => {
  assert.equal(await digest(utf8("abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(await digest(utf8("abc"), "SHA-512"),
    "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f");
  assert.equal(await digest(new Uint8Array()), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});

test("HMAC matches RFC 4231 test case 2", async () => {
  const data = utf8("what do ya want for nothing?");
  const key = utf8("Jefe");
  assert.equal(await hmac(data, key), "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
  assert.equal(await hmac(data, key, "SHA-512"),
    "164b7a7bfcf819e2e395fbe73b56e0a387bd64222e831fd610270cd7ea2505549758bf75c05a994a6d034f65f8f0e6fdcaeab1a34d4a6b4b636e070a38bce737");
});

test("unknown algorithms and empty HMAC keys are refused", async () => {
  await assert.rejects(digest(utf8("x"), "MD5"), rejectsWith("algorithm"));
  await assert.rejects(hmac(utf8("x"), new Uint8Array()), rejectsWith("hmacKey"));
});

test("published hashes are compared in any common notation", () => {
  const hex = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
  assert.equal(normalizeHex(" SHA256: BA78 16BF "), "ba7816bf");
  assert.ok(equalHex(hex, hex.toUpperCase()));
  assert.ok(equalHex(hex, "sha256:" + hex.match(/.{2}/g).join(":")));
  assert.ok(!equalHex(hex, hex.slice(0, -1) + "e"));
  assert.ok(!equalHex(hex, hex.slice(0, -2)));
  assert.ok(!equalHex("zz", "zz"));
});
