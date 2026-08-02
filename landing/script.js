/* ============================================================
   Rizzing — landing page behaviour
   Everything here is progressive enhancement: with JS disabled
   the page still renders and scroll-snaps correctly.
   ============================================================ */

const year = document.querySelector('#year');
year.textContent = new Date().getFullYear();

(function () {
  "use strict";

  var container = document.getElementById("snap");
  var nav = document.querySelector(".section-nav");
  var sections = Array.prototype.slice.call(
    document.querySelectorAll(".snap-container .section")
  );

  if (!container || !sections.length) return;

  /* ---------- Light / dark toggle ----------
     The theme is applied by the inline script in <head> before first paint;
     this only handles switching and remembering the choice. */

  var root = document.documentElement;
  // Two copies exist — the right rail on desktop, the footer on phones. CSS
  // shows one at a time, but both stay in sync.
  var themeToggles = document.querySelectorAll(".theme-toggle");

  if (themeToggles.length) {
    var themeButtons = document.querySelectorAll("[data-theme-set]");

    var syncTheme = function () {
      var current = root.getAttribute("data-theme") || "dark";
      Array.prototype.forEach.call(themeButtons, function (btn) {
        btn.setAttribute(
          "aria-pressed",
          btn.getAttribute("data-theme-set") === current ? "true" : "false"
        );
      });
    };

    var onThemeClick = function (e) {
      var btn = e.target.closest("[data-theme-set]");
      if (!btn) return;
      var choice = btn.getAttribute("data-theme-set");
      root.setAttribute("data-theme", choice);
      try {
        localStorage.setItem("rizzing-theme", choice);
      } catch (err) {
        /* private mode — the choice just won't persist */
      }
      syncTheme();
    };

    Array.prototype.forEach.call(themeToggles, function (toggle) {
      toggle.addEventListener("click", onThemeClick);
    });

    syncTheme();
  }

  /* ---------- App screenshot in the phone mockup ----------
     Tries each extension in turn so whichever file you drop into assets/
     just works. If none resolve, the placeholder screen stays visible. */

  var shot = document.querySelector(".phone-shot");
  if (shot) {
    var markLoaded = function () {
      shot.closest(".phone-screen").classList.add("has-shot");
    };
    shot.addEventListener("load", markLoaded);
    shot.addEventListener("error", function () {
      shot.remove();
    });
    if (shot.complete && shot.naturalWidth) markLoaded();
  }

  /* ---------- Staggered entrance animation ---------- */

  // Elements are tagged from JS so a failed script never hides content.
  sections.forEach(function (section) {
    var targets = section.querySelectorAll(
      ".hero-title, .hero-description, .feature, .tool-card, .phone, .cta-row .btn, " +
        ".proof-head, .wall, .site-footer"
    );
    Array.prototype.forEach.call(targets, function (el, i) {
      el.classList.add("reveal");
      el.style.setProperty("--delay", 90 + i * 70 + "ms");
    });
  });

  /* ---------- Track the active section ---------- */

  var activeIndex = -1;

  var setActive = function (index) {
    if (index === activeIndex) return;
    activeIndex = index;

    sections.forEach(function (s, i) {
      s.classList.toggle("is-active", i === index);
    });
    if (nav) {
      Array.prototype.forEach.call(nav.children, function (dot, i) {
        dot.setAttribute("aria-current", i === index ? "true" : "false");
      });
    }
  };

  // Every section fills the snap container, so the section on screen is simply
  // the one nearest the current scroll offset. Deriving it from scrollTop keeps
  // the state correct on first paint too, including deep links like #tools.
  var syncActive = function () {
    var page = container.clientHeight || 1;
    var index = Math.round(container.scrollTop / page);
    setActive(Math.min(sections.length - 1, Math.max(0, index)));
  };

  var ticking = false;
  var onScroll = function () {
    document.body.classList.toggle("is-scrolled", container.scrollTop > 40);
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      syncActive();
    });
  };

  container.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", syncActive);
  syncActive();
  // The browser applies a #hash scroll after this script runs, so re-check.
  window.addEventListener("load", syncActive);

  /* ---------- Dot navigation (only shown once 2+ sections exist) ---------- */

  if (nav && sections.length > 1) {
    sections.forEach(function (section, i) {
      var label = section.dataset.label || "Section " + (i + 1);
      var dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", "Go to " + label);
      dot.setAttribute("aria-current", i === 0 ? "true" : "false");
      dot.addEventListener("click", function () {
        section.scrollIntoView({
          behavior: prefersReducedMotion() ? "auto" : "smooth",
          block: "start"
        });
      });
      nav.appendChild(dot);
    });
    nav.classList.add("is-visible");
  }

  /* ---------- Keyboard paging ---------- */

  document.addEventListener("keydown", function (e) {
    var keys = {
      ArrowDown: 1,
      PageDown: 1,
      ArrowUp: -1,
      PageUp: -1
    };
    var step = keys[e.key];
    if (step === undefined) return;
    if (e.target.closest("input, textarea, select")) return;

    var target = Math.min(sections.length - 1, Math.max(0, activeIndex + step));
    if (target !== activeIndex) {
      e.preventDefault();
      sections[target].scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start"
      });
    }
  });

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
})();
