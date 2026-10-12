// "Hash and HMAC" page: SHA-256 and SHA-512 of text or a file, keyed HMAC,
// and comparison with a published value ("is my download intact?").
import { CryptoError, utf8 } from "../crypto/encoding.js";
import { digest, equalHex, hmac, normalizeHex } from "../crypto/hash.js";
import {
  $, bindSegments, busy, errorText, formatBytes, initCopyButtons, initDropZone, initRevealButtons,
  readFile, setStatus, t,
} from "./common.js";

const form = $("#hash-form");
const textInput = $("#text-input");
const keyInput = $("#hmac-key");
const algorithm = $("#hmac-algorithm");
const expected = $("#expected");
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
  verdict.hidden = true;
  setStatus(status, "ok", "");
}

bindSegments(form, ["mode", "source"], () => {
  runButton.textContent = t(mode() === "hash" ? "btn.hash" : "btn.hmac");
  clearOutput();
});
initCopyButtons();
initRevealButtons();

async function readData() {
  if (source() === "file") {
    if (!drop.file) throw new CryptoError("noFile");
    return readFile(drop.file);
  }
  // The hash of empty text is well defined, so it is allowed on purpose.
  return utf8(textInput.value);
}

// A SHA-256 hex digest is 64 characters, SHA-512 is 128.
function expectedAlgorithm(value) {
  const length = normalizeHex(value).length;
  if (length === 64) return "SHA-256";
  if (length === 128) return "SHA-512";
  throw new CryptoError("expectedFormat");
}

function showVerdict(match, name) {
  verdict.hidden = false;
  verdict.dataset.valid = String(match);
  $("#verdict-title").textContent = t(match ? "verdict.match" : "verdict.noMatch", name);
  $("#verdict-text").textContent = t(match ? "verdict.matchText" : "verdict.noMatchText");
}

async function run() {
  const data = await readData();
  const started = performance.now();
  const compareWith = expected.value.trim();

  if (mode() === "hash") {
    // Check the expected value's shape before the (possibly slow) hashing.
    const compareAlgorithm = compareWith ? expectedAlgorithm(compareWith) : null;
    const [sha256, sha512] = await Promise.all([digest(data, "SHA-256"), digest(data, "SHA-512")]);
    $("#sha256-output").value = sha256;
    $("#sha512-output").value = sha512;
    if (compareAlgorithm) {
      const actual = compareAlgorithm === "SHA-256" ? sha256 : sha512;
      showVerdict(equalHex(actual, compareWith), compareAlgorithm);
    }
  } else {
    if (keyInput.value === "") throw new CryptoError("hmacKey");
    const value = await hmac(data, utf8(keyInput.value), algorithm.value);
    $("#hmac-output").value = value;
    $("#hmac-output-label").textContent = `HMAC-${algorithm.value}`;
    if (compareWith) showVerdict(equalHex(value, compareWith), `HMAC-${algorithm.value}`);
  }

  $("#info-size").textContent = formatBytes(data.length);
  $("#info-time").textContent = `${Math.max(1, Math.round(performance.now() - started))} ms`;
  outputEmpty.hidden = true;
  output.hidden = false;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearOutput();
  try {
    await busy(runButton, t("busy.short"), run);
  } catch (err) {
    setStatus(status, "error", errorText(err));
  }
});
