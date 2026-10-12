import { test } from "node:test";
import assert from "node:assert/strict";
import { fromBase64, toBase64, utf8 } from "../../src/CryptoToolkit.Web/wwwroot/js/crypto/encoding.js";
import {
  decryptBytes, decryptText, encryptBytes, encryptText, exportPrivatePem, exportPublicPem,
  fingerprint, generateKeyPair, importPrivatePem, importPublicPem,
} from "../../src/CryptoToolkit.Web/wwwroot/js/crypto/rsa.js";
import * as sign from "../../src/CryptoToolkit.Web/wwwroot/js/crypto/sign.js";

const rejectsWith = (code) => (err) => err.code === code;
// Key generation is the slow part; share two pairs across the tests.
const alice = await generateKeyPair(2048);
const bob = await generateKeyPair(2048);

test("hybrid encryption round-trips text, including more than RSA alone could hold", async () => {
  const text = "Uzun mesaj ".repeat(2000) + "🔐";
  const pkg = await encryptText(text, alice.publicKey);
  assert.equal(await decryptText(pkg, alice.privateKey), text);
});

test("keys survive a PEM export and import", async () => {
  const publicPem = await exportPublicPem(alice.publicKey);
  const privatePem = await exportPrivatePem(alice.privateKey);
  assert.match(publicPem, /^-----BEGIN PUBLIC KEY-----\n/);
  assert.match(privatePem, /^-----BEGIN PRIVATE KEY-----\n/);

  const pub = await importPublicPem(publicPem);
  const priv = await importPrivatePem(privatePem);
  assert.equal(pub.algorithm.modulusLength, 2048);
  assert.equal(priv.extractable, false); // an imported private key cannot be read back out
  const pkg = await encryptText("pem ile", pub);
  assert.equal(await decryptText(pkg, priv), "pem ile");
  assert.equal(await fingerprint(pub), await fingerprint(alice.publicKey));
});

test("each package is different even for the same text", async () => {
  assert.notEqual(await encryptText("aynı", alice.publicKey), await encryptText("aynı", alice.publicKey));
});

test("someone else's private key cannot decrypt", async () => {
  const pkg = await encryptText("sadece alice", alice.publicKey);
  await assert.rejects(decryptText(pkg, bob.privateKey), rejectsWith("wrongKey"));
});

test("changes to the wrapped key or the data are detected", async () => {
  const pkg = await encryptBytes(utf8("bütünlük"), alice.publicKey);
  const wrapped = pkg.slice();
  wrapped[20] ^= 1;
  await assert.rejects(decryptBytes(wrapped, alice.privateKey), rejectsWith("wrongKey"));
  const data = pkg.slice();
  data[data.length - 1] ^= 1;
  await assert.rejects(decryptBytes(data, alice.privateKey), rejectsWith("tampered"));
});

test("other packages and truncated input are rejected", async () => {
  await assert.rejects(decryptText(toBase64(utf8("CTK\x01 not a hybrid package")), alice.privateKey), rejectsWith("format"));
  const pkg = fromBase64(await encryptText("x", alice.publicKey));
  await assert.rejects(decryptBytes(pkg.subarray(0, 100), alice.privateKey), rejectsWith("format"));
});

test("wrong key types and sizes are refused", async () => {
  const ec = await sign.generateKeyPair();
  await assert.rejects(importPublicPem(await sign.exportPublicPem(ec.publicKey)), rejectsWith("keyType"));
  await assert.rejects(importPublicPem(await exportPrivatePem(alice.privateKey)), rejectsWith("pem"));
  await assert.rejects(generateKeyPair(1024), rejectsWith("keySize"));
});

test("1024-bit keys made elsewhere are refused as too weak", async () => {
  const weak = await crypto.subtle.generateKey(
    { name: "RSA-OAEP", hash: "SHA-256", modulusLength: 1024, publicExponent: new Uint8Array([1, 0, 1]) },
    true, ["encrypt", "decrypt"]);
  await assert.rejects(importPublicPem(await exportPublicPem(weak.publicKey)), rejectsWith("keyWeak"));
});
