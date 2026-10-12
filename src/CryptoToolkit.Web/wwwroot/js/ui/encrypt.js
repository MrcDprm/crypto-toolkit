// "Password encryption" page: text or file, encrypt or decrypt.
import { CryptoError, fromBase64, fromUtf8, toBase64, toHex, utf8 } from "../crypto/encoding.js";
import * as pbe from "../crypto/password.js";
import {
  $, bindSegments, busy, downloadLink, errorText, formatBytes, initCopyButtons, initDropZone,
  initRevealButtons, readFile, setStatus, t,
} from "./common.js";

const form = $("#encrypt-form");
const textInput = $("#text-input");
const password = $("#password");
const confirm = $("#confirm");
const runButton = $("#run");
const status = $("#status");
const output = $("#output");
const outputEmpty = $("#output-empty");
const textOutput = $("#text-output");
const download = $("#download");
const strength = $(".strength");
const strengthText = $("#strength-text");
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
  password.autocomplete = mode() === "encrypt" ? "new-password" : "current-password";
  clearOutput();
});
initCopyButtons();
initRevealButtons();

// A rough guide, not a guarantee: length matters most, then variety.
// It never blocks a password longer than the minimum.
function strengthLevel(value) {
  const length = [...value].length;
  if (length === 0) return 0;
  if (length < pbe.MIN_PASSWORD_LENGTH) return 1;
  const classes = [/[a-zğüşöçı]/, /[A-ZĞÜŞÖÇİ]/, /\d/, /[^\p{L}\d]/u].filter((r) => r.test(value)).length;
  if (length >= 16 || (length >= 12 && classes >= 3)) return 4;
  if (length >= 12 || classes >= 3) return 3;
  return 2;
}

password.addEventListener("input", () => {
  const level = strengthLevel(password.value);
  strength.dataset.level = String(level);
  strengthText.textContent = level ? t("strength." + level) : "";
});

function showPackage(pkg, plainSize) {
  const info = pbe.inspect(pkg);
  $("#info-format").textContent = `CTK v${info.version}`;
  $("#info-iterations").textContent = new Intl.NumberFormat(document.documentElement.lang).format(info.iterations);
  $("#info-salt").textContent = toHex(info.salt);
  $("#info-iv").textContent = toHex(info.iv);
  $("#info-size").textContent = t("info.sizeValue", formatBytes(plainSize), formatBytes(pkg.length));
  outputEmpty.hidden = true;
  output.hidden = false;
}

// Encrypted files get ".enc"; decrypting removes it again.
function outputName(name) {
  if (mode() === "encrypt") return name + ".enc";
  return /\.enc$/i.test(name) && name.length > 4 ? name.slice(0, -4) : name + ".decrypted";
}

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

async function run() {
  const input = await readInput();
  if (password.value === "") throw new CryptoError("noPassword");
  if (mode() === "encrypt" && password.value !== confirm.value) throw new CryptoError("mismatch");

  if (mode() === "encrypt") {
    const pkg = await pbe.encryptBytes(input, password.value);
    if (source() === "text") {
      textOutput.value = toBase64(pkg);
    } else {
      showDownload(pkg);
    }
    showPackage(pkg, input.length);
    return t("done.encrypt");
  }

  pbe.inspect(input); // fail fast on input that is not a package
  const plain = await pbe.decryptBytes(input, password.value);
  if (source() === "text") {
    textOutput.value = fromUtf8(plain);
  } else {
    showDownload(plain);
  }
  showPackage(input, plain.length);
  return t("done.decrypt");
}

function showDownload(bytes) {
  const name = outputName(drop.file.name);
  downloadLink(download, bytes, name);
  $("#download-name").textContent = `${name} · ${formatBytes(bytes.length)}`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearOutput();
  setStatus(status, "busy", t("busy.derive"));
  try {
    const message = await busy(runButton, t("busy.short"), run);
    setStatus(status, "ok", message);
  } catch (err) {
    setStatus(status, "error", errorText(err));
  }
});

// Moves the package to the input and switches to decryption, to show the
// round trip without copying by hand.
$("#try-decrypt").addEventListener("click", () => {
  const pkg = textOutput.value;
  const decrypt = form.elements.mode[1];
  decrypt.checked = true;
  decrypt.dispatchEvent(new Event("change", { bubbles: true }));
  textInput.value = pkg;
  confirm.value = "";
  password.focus();
});
