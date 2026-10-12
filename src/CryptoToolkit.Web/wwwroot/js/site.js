// Shared page behaviour. Tool pages load their own module scripts.
document.addEventListener("DOMContentLoaded", function () {
  var toggle = document.querySelector("[data-theme-toggle]");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("ct-theme", next); } catch (e) { /* storage blocked */ }
    });
  }
});
