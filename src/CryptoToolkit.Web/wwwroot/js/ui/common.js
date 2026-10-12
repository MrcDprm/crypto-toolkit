// Helpers shared by the tool pages. Text is only ever set with textContent
// (the CSP enforces Trusted Types, so innerHTML would throw anyway).
import { CryptoError } from "../crypto/encoding.js";

const texts = JSON.parse(document.getElementById("texts")?.textContent || "{}");

// t("err.decrypt") or t("info.sizeValue", "1 KB", "2 KB"): "{0}" style placeholders.
export function t(key, ...args) {
  const text = texts[key] ?? key;
  return text.replace(/\{(\d)\}/g, (_, i) => args[i] ?? "");
}

// Web Crypto keeps everything in memory; beyond this size the tab may run out
// of memory on a phone, so larger files are refused with a clear message.
export const MAX_FILE_BYTES = 100 * 1024 * 1024;

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const number = unit === 0 ? value : value.toFixed(value < 10 ? 1 : 0);
  return `${new Intl.NumberFormat(document.documentElement.lang).format(number)} ${units[unit]}`;
}

// Turns any failure into a sentence for the user. Known CryptoError codes
// have their own text; anything else is logged for the developer and shown
// as a generic message, never as a raw exception.
export function errorText(err) {
  if (err?.name === "CryptoError" && texts["err." + err.code]) return t("err." + err.code);
  console.error(err);
  return t("err.unknown");
}

// Status line under a form: kind is "ok", "error" or "busy".
export function setStatus(el, kind, text) {
  el.dataset.kind = kind;
  el.textContent = text;
  el.hidden = !text;
}

// Disables the button and shows a working label while the task runs.
export async function busy(button, label, task) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = label;
  try {
    return await task();
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

export async function readFile(file) {
  if (file.size > MAX_FILE_BYTES) throw new CryptoError("fileTooLarge");
  return new Uint8Array(await file.arrayBuffer());
}

// Offers bytes as a download through a temporary blob: URL; nothing is
// uploaded. Each link keeps its own URL and frees the previous one.
const linkUrls = new WeakMap();
export function downloadLink(link, bytes, fileName, type = "application/octet-stream") {
  if (linkUrls.has(link)) URL.revokeObjectURL(linkUrls.get(link));
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  linkUrls.set(link, url);
  link.href = url;
  link.download = fileName;
}

// "ab12cd34…" → "AB12 CD34 …": the first 16 bytes of a SHA-256 key
// fingerprint, grouped so two people can read it to each other.
export const formatFingerprint = (hex) =>
  hex.slice(0, 32).toUpperCase().match(/.{4}/g).join(" ");

// Copy buttons: data-copy="#target" copies the target's value or text.
export function initCopyButtons(root = document) {
  for (const button of $$("[data-copy]", root)) {
    button.addEventListener("click", async () => {
      const target = $(button.dataset.copy);
      const value = "value" in target ? target.value : target.textContent;
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        flash(button, t("copied"));
      } catch {
        target.select?.();
        flash(button, t("copyFailed"));
      }
    });
  }
}

function flash(button, text) {
  const original = button.dataset.label ?? button.textContent;
  button.dataset.label = original;
  button.textContent = text;
  clearTimeout(button._timer);
  button._timer = setTimeout(() => { button.textContent = original; }, 1600);
}

// Show/hide toggles for password fields: data-reveal="#input".
export function initRevealButtons(root = document) {
  for (const button of $$("[data-reveal]", root)) {
    button.addEventListener("click", () => {
      const input = $(button.dataset.reveal);
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.setAttribute("aria-pressed", String(show));
    });
  }
}

// Segmented controls: radio groups whose value is mirrored to data-<name> on
// the given element, so CSS shows the matching parts of the form.
export function bindSegments(form, names, onChange) {
  const apply = () => {
    for (const name of names) form.dataset[name] = form.elements[name].value;
    onChange?.();
  };
  form.addEventListener("change", (e) => { if (names.includes(e.target.name)) apply(); });
  apply();
}

// File picker with drag and drop; shows the chosen file's name and size.
export function initDropZone(zone, onFile) {
  const input = $("input[type=file]", zone);
  const label = $("[data-file-name]", zone);
  const show = (file) => {
    label.textContent = file ? `${file.name} · ${formatBytes(file.size)}` : "";
    zone.classList.toggle("has-file", Boolean(file));
    onFile?.(file);
  };
  input.addEventListener("change", () => show(input.files[0]));
  zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("is-over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("is-over"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("is-over");
    if (e.dataTransfer.files.length) {
      input.files = e.dataTransfer.files;
      show(input.files[0]);
    }
  });
  return {
    get file() { return input.files[0]; },
    clear() { input.value = ""; show(null); },
  };
}
