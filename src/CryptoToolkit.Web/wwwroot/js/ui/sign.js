// "Digital signature" page: generate an ECDSA key pair, sign text or a file
// with the private key, verify a signature with the public key.
import { CryptoError, fromUtf8, utf8 } from "../crypto/encoding.js";
import { digest } from "../crypto/hash.js";
import * as ecdsa from "../crypto/sign.js";
import {
  $, bindSegments, busy, downloadLink, errorText, formatBytes, formatFingerprint, initCopyButtons,
  initDropZone, readFile, setStatus, t,
} from "./common.js";

initCopyButtons();

// ---- 1. Key pair -------------------------------------------------------

const keygenStatus = $("#keygen-status");
const privateInput = $("#private-input");
const publicInput = $("#public-input");

$("#keygen-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await busy($("#generate"), t("busy.short"), async () => {
      const pair = await ecdsa.generateKeyPair();
      const publicPem = await ecdsa.exportPublicPem(pair.publicKey);
      const privatePem = await ecdsa.exportPrivatePem(pair.privateKey);
      $("#public-pem").value = publicPem;
      $("#private-pem").value = privatePem;
      $("#key-fingerprint").textContent = formatFingerprint(await ecdsa.fingerprint(pair.publicKey));
      downloadLink($("#download-public"), utf8(publicPem), "signing-public.pem", "application/x-pem-file");
      downloadLink($("#download-private"), utf8(privatePem), "signing-private.pem", "application/x-pem-file");
      privateInput.value = privatePem;
      publicInput.value = publicPem;
      $("#keys").hidden = false;
    });
    setStatus(keygenStatus, "ok", t("done.generateEc"));
  } catch (err) {
    setStatus(keygenStatus, "error", errorText(err));
  }
});

// ---- 2. Sign / verify --------------------------------------------------

const form = $("#sign-form");
const textInput = $("#text-input");
const signatureInput = $("#signature-input");
const signatureOutput = $("#signature-output");
const runButton = $("#run");
const status = $("#status");
const output = $("#output");
const outputEmpty = $("#output-empty");
const verdict = $("#verdict");
const drop = initDropZone($("#dropzone"), () => clearOutput());

const mode = () => form.dataset.mode;
const source = () => form.dataset.source;

function clearOutput() {
  output.hidden = true;
  outputEmpty.hidden = false;
  signatureOutput.value = "";
  setStatus(status, "ok", "");
}

bindSegments(form, ["mode", "source"], () => {
  runButton.textContent = t(mode() === "sign" ? "btn.sign" : "btn.verify");
  clearOutput();
});

// A .sig file holds the Base64 signature as text; read it into the field.
$("#signature-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  if (file.size > 4096) {
    setStatus(status, "error", t("err.signature"));
    return;
  }
  try {
    signatureInput.value = fromUtf8(new Uint8Array(await file.arrayBuffer())).trim();
  } catch (err) {
    setStatus(status, "error", errorText(err));
  }
});

async function readData() {
  if (source() === "file") {
    if (!drop.file) throw new CryptoError("noFile");
    return readFile(drop.file);
  }
  // Empty text is valid to sign, but almost always a mistake.
  if (textInput.value === "") throw new CryptoError("emptySignText");
  return utf8(textInput.value);
}

async function showDetails(data, publicKey) {
  $("#info-fingerprint").textContent = publicKey ? formatFingerprint(await ecdsa.fingerprint(publicKey)) : "";
  $("#info-digest").textContent = await digest(data);
  $("#info-size").textContent = formatBytes(data.length);
  outputEmpty.hidden = true;
  output.hidden = false;
}

async function run() {
  const data = await readData();

  if (mode() === "sign") {
    if (privateInput.value.trim() === "") throw new CryptoError("noPrivateKey");
    const key = await ecdsa.importPrivatePem(privateInput.value);
    const signature = await ecdsa.sign(data, key);
    signatureOutput.value = signature;
    const name = (source() === "file" ? drop.file.name : "message") + ".sig";
    downloadLink($("#download-sig"), utf8(signature + "\n"), name, "text/plain");
    $("#download-sig").textContent = name;
    await showDetails(data, null);
    return t("done.sign");
  }

  if (publicInput.value.trim() === "") throw new CryptoError("noPublicKey");
  if (signatureInput.value.trim() === "") throw new CryptoError("noSignature");
  const key = await ecdsa.importPublicPem(publicInput.value);
  const valid = await ecdsa.verify(data, signatureInput.value, key);
  verdict.dataset.valid = String(valid);
  $("#verdict-title").textContent = t(valid ? "verdict.valid" : "verdict.invalid");
  $("#verdict-text").textContent = t(valid ? "verdict.validText" : "verdict.invalidText");
  await showDetails(data, key);
  return "";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearOutput();
  try {
    const message = await busy(runButton, t("busy.short"), run);
    setStatus(status, "ok", message);
  } catch (err) {
    setStatus(status, "error", errorText(err));
  }
});

// Carries the new signature over to verification (same text or file).
$("#try-verify").addEventListener("click", () => {
  const signature = signatureOutput.value;
  const verify = form.elements.mode[1];
  verify.checked = true;
  verify.dispatchEvent(new Event("change", { bubbles: true }));
  signatureInput.value = signature;
  runButton.focus();
});
