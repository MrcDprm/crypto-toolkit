// "RSA and hybrid" page: generate a key pair, then encrypt with a public key
// or decrypt with a private key (text or file).
import { CryptoError, fromBase64, fromUtf8, toBase64, toHex, utf8 } from "../crypto/encoding.js";
import * as rsa from "../crypto/rsa.js";
import {
  $, bindSegments, busy, downloadLink, errorText, formatBytes, formatFingerprint, initCopyButtons,
  initDropZone, readFile, setStatus, t,
} from "./common.js";

initCopyButtons();

// ---- 1. Key pair -------------------------------------------------------

const keygenForm = $("#keygen-form");
const keygenStatus = $("#keygen-status");
const publicInput = $("#public-input");
const privateInput = $("#private-input");

keygenForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const bits = Number($("#key-size").value);
  setStatus(keygenStatus, "busy", t("busy.generate", bits));
  try {
    await busy($("#generate"), t("busy.short"), async () => {
      const pair = await rsa.generateKeyPair(bits);
      const publicPem = await rsa.exportPublicPem(pair.publicKey);
      const privatePem = await rsa.exportPrivatePem(pair.privateKey);
      $("#public-pem").value = publicPem;
      $("#private-pem").value = privatePem;
      $("#key-fingerprint").textContent = formatFingerprint(await rsa.fingerprint(pair.publicKey));
      downloadLink($("#download-public"), utf8(publicPem), "public.pem", "application/x-pem-file");
      downloadLink($("#download-private"), utf8(privatePem), "private.pem", "application/x-pem-file");
      // Ready to try at once: the new keys fill the fields below.
      publicInput.value = publicPem;
      privateInput.value = privatePem;
      $("#keys").hidden = false;
    });
    setStatus(keygenStatus, "ok", t("done.generate", bits));
  } catch (err) {
    setStatus(keygenStatus, "error", errorText(err));
  }
});

// ---- 2. Encrypt / decrypt ----------------------------------------------

const form = $("#rsa-form");
const textInput = $("#text-input");
const runButton = $("#run");
const status = $("#status");
const output = $("#output");
const outputEmpty = $("#output-empty");
const textOutput = $("#text-output");
const download = $("#download");
const drop = initDropZone($("#dropzone"), () => clearOutput());

const mode = () => form.dataset.mode;
const source = () => form.dataset.source;

function clearOutput() {
  output.hidden = true;
  outputEmpty.hidden = false;
  textOutput.value = "";
  setStatus(status, "ok", "");
}

bindSegments(form, ["mode", "source"], () => {
  runButton.textContent = t(mode() === "encrypt" ? "btn.encrypt" : "btn.decrypt");
  clearOutput();
});

async function readInput() {
  if (source() === "file") {
    if (!drop.file) throw new CryptoError("noFile");
    return readFile(drop.file);
  }
  const value = textInput.value;
  if (mode() === "encrypt") {
    if (value === "") throw new CryptoError("emptyText");
    return utf8(value);
  }
  if (value.trim() === "") throw new CryptoError("emptyPackage");
  return fromBase64(value);
}

async function readKey() {
  if (mode() === "encrypt") {
    if (publicInput.value.trim() === "") throw new CryptoError("noPublicKey");
    return rsa.importPublicPem(publicInput.value);
  }
  if (privateInput.value.trim() === "") throw new CryptoError("noPrivateKey");
  return rsa.importPrivatePem(privateInput.value);
}

function outputName(name) {
  if (mode() === "encrypt") return name + ".enc";
  return /\.enc$/i.test(name) && name.length > 4 ? name.slice(0, -4) : name + ".decrypted";
}

function showDownload(bytes) {
  const name = outputName(drop.file.name);
  downloadLink(download, bytes, name);
  $("#download-name").textContent = `${name} · ${formatBytes(bytes.length)}`;
}

async function showPackage(pkg, plainSize, key) {
  const info = rsa.inspect(pkg);
  $("#info-format").textContent = `CTH v${info.version}`;
  $("#info-key-size").textContent = `RSA ${key.algorithm.modulusLength} bit`;
  $("#info-fingerprint").textContent = mode() === "encrypt" ? formatFingerprint(await rsa.fingerprint(key)) : "";
  $("#info-wrapped").textContent = `${info.wrappedKey.length} B · ${toHex(info.wrappedKey.subarray(0, 8))}…`;
  $("#info-iv").textContent = toHex(info.iv);
  $("#info-size").textContent = t("info.sizeValue", formatBytes(plainSize), formatBytes(pkg.length));
  outputEmpty.hidden = true;
  output.hidden = false;
}

async function run() {
  const input = await readInput();
  const key = await readKey();

  if (mode() === "encrypt") {
    const pkg = await rsa.encryptBytes(input, key);
    if (source() === "text") textOutput.value = toBase64(pkg);
    else showDownload(pkg);
    await showPackage(pkg, input.length, key);
    return t("done.rsaEncrypt");
  }

  rsa.inspect(input); // fail fast on input that is not a package
  const plain = await rsa.decryptBytes(input, key);
  if (source() === "text") textOutput.value = fromUtf8(plain);
  else showDownload(plain);
  await showPackage(input, plain.length, key);
  return t("done.decrypt");
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

$("#try-decrypt").addEventListener("click", () => {
  const pkg = textOutput.value;
  const decrypt = form.elements.mode[1];
  decrypt.checked = true;
  decrypt.dispatchEvent(new Event("change", { bubbles: true }));
  textInput.value = pkg;
  runButton.focus();
});
