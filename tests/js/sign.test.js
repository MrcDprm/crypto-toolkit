import { test } from "node:test";
import assert from "node:assert/strict";
import { fromBase64, utf8 } from "../../src/CryptoToolkit.Web/wwwroot/js/crypto/encoding.js";
import {
  exportPrivatePem, exportPublicPem, fingerprint, generateKeyPair, importPrivatePem, importPublicPem, sign, verify,
} from "../../src/CryptoToolkit.Web/wwwroot/js/crypto/sign.js";
import * as rsa from "../../src/CryptoToolkit.Web/wwwroot/js/crypto/rsa.js";

const rejectsWith = (code) => (err) => err.code === code;
const keys = await generateKeyPair();
const data = utf8("Bu sözleşmeyi onaylıyorum.");

test("a signature verifies with the matching public key", async () => {
  const signature = await sign(data, keys.privateKey);
  assert.equal(fromBase64(signature).length, 64);
  assert.equal(await verify(data, signature, keys.publicKey), true);
});

test("a changed message or another key fails verification", async () => {
  const signature = await sign(data, keys.privateKey);
  assert.equal(await verify(utf8("Bu sözleşmeyi onaylamıyorum."), signature, keys.publicKey), false);
  const other = await generateKeyPair();
  assert.equal(await verify(data, signature, other.publicKey), false);
});

test("keys survive a PEM export and import", async () => {
  const pub = await importPublicPem(await exportPublicPem(keys.publicKey));
  const priv = await importPrivatePem(await exportPrivatePem(keys.privateKey));
  assert.equal(priv.extractable, false);
  assert.equal(await verify(data, await sign(data, priv), pub), true);
  assert.equal(await fingerprint(pub), await fingerprint(keys.publicKey));
});

test("malformed signatures and wrong key types are rejected", async () => {
  await assert.rejects(verify(data, "AAAA", keys.publicKey), rejectsWith("signature"));
  await assert.rejects(verify(data, "imza değil", keys.publicKey), rejectsWith("base64"));
  const rsaKeys = await rsa.generateKeyPair(2048);
  await assert.rejects(importPublicPem(await rsa.exportPublicPem(rsaKeys.publicKey)), rejectsWith("keyType"));
});
