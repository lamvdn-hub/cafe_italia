/* Café Italia Eriksberg: status, hours and GSAP choreography. */
(function () {
  "use strict";

  var root = document.documentElement;

  /* ---------- Opening status (Europe/Stockholm time) ---------- */
  // Mon-Fri 10-20, Sat-Sun 11-20. 0 = Sunday.
  var HOURS = { 0: [11, 20], 1: [10, 20], 2: [10, 20], 3: [10, 20], 4: [10, 20], 5: [10, 20], 6: [11, 20] };

  function stockholmNow() {
    var parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Stockholm", weekday: "short", hour: "numeric", minute: "numeric", hour12: false
    }).formatToParts(new Date());
    var get = function (t) { return (parts.find(function (p) { return p.type === t; }) || {}).value; };
    var day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
    return { day: day, minutes: (parseInt(get("hour"), 10) % 24) * 60 + parseInt(get("minute"), 10) };
  }

  function pad(h) { return (h < 10 ? "0" : "") + h + ":00"; }

  function renderStatus() {
    var now = stockholmNow();
    if (now.day < 0) return;
    var el = document.querySelector("[data-status]");
    var text = document.querySelector("[data-status-text]");
    var today = HOURS[now.day];
    var open = now.minutes >= today[0] * 60 && now.minutes < today[1] * 60;
    var label;
    if (open) label = "Open now, until " + pad(today[1]);
    else if (now.minutes < today[0] * 60) label = "Opens today " + pad(today[0]);
    else label = "Opens tomorrow " + pad(HOURS[(now.day + 1) % 7][0]);
    if (el && text) {
      text.textContent = label;
      el.classList.toggle("is-open", open);
      el.hidden = false;
    }
    document.querySelectorAll("[data-hours] tr[data-days]").forEach(function (row) {
      var days = row.getAttribute("data-days").split(",").map(Number);
      row.classList.toggle("is-today", days.indexOf(now.day) !== -1 && !row.classList.contains("hours__sub"));
    });
  }

  try { renderStatus(); } catch (e) { /* status is an enhancement */ }

  /* ---------- Photos that are not in place yet ---------- */
  document.querySelectorAll(".ph img").forEach(function (img) {
    if (img.complete && img.naturalWidth === 0) img.parentElement.classList.add("is-missing");
  });

  /* ---------- Motion ---------- */
  function showHero() { root.classList.add("hero-go"); }

  if (!window.gsap || !window.ScrollTrigger) { showHero(); return; }

  gsap.registerPlugin(ScrollTrigger);
  if (window.SplitText) gsap.registerPlugin(SplitText);

  function cssVar(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }

  var fontsReady = document.fonts && document.fonts.ready
    ? Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 1500); })])
    : Promise.resolve();

  fontsReady.then(init);

  function init() {
    // Mobile call bar stays out of the way while the hero's own CTA is on screen.
    var callbar = document.querySelector("[data-callbar]");
    if (callbar) {
      ScrollTrigger.create({
        trigger: ".hero__actions", start: "top bottom", end: "bottom top",
        onToggle: function (self) { callbar.classList.toggle("is-hidden", self.isActive); }
      });
    }

    // Nav hairline once the page moves.
    ScrollTrigger.create({
      start: 8, end: "max",
      toggleClass: { targets: "[data-nav]", className: "is-scrolled" }
    });

    var mm = gsap.matchMedia();

    mm.add({
      motion: "(prefers-reduced-motion: no-preference)",
      large: "(min-width: 1024px) and (min-height: 640px)"
    }, function (ctx) {
      var c = ctx.conditions;

      if (!c.motion) { showHero(); return; }

      heroIntro();
      var stopRipple = riverRipple();

      if (c.large) {
        storyParallax();
        dayOnTheQuay();
      }

      reveals();

      return function () {
        stopRipple();
        document.querySelector("[data-day]").classList.remove("is-pinned");
      };
    });

    window.addEventListener("load", function () { ScrollTrigger.refresh(); });
  }

  /* Hero: letters rise out of the river while their reflection sinks into it. */
  function heroIntro() {
    var mark = document.querySelector("[data-wordmark]");
    var reflection = document.querySelector("[data-reflection]");
    var photo = document.querySelector("[data-hero-photo]");
    var tl = gsap.timeline({ defaults: { ease: "expo.out" } });

    if (window.SplitText && mark && reflection) {
      var a = SplitText.create(mark, { type: "chars", mask: "chars" });
      var b = SplitText.create(reflection, { type: "chars", mask: "chars", aria: "none" });
      tl.from(a.chars, { yPercent: 110, duration: 1.3, stagger: 0.045 }, 0)
        .from(b.chars, { yPercent: 110, duration: 1.3, stagger: 0.045 }, 0);
    }

    tl.from("[data-hero-fade]", { y: 16, autoAlpha: 0, duration: 1, stagger: 0.1 }, 0.6);

    if (photo && !photo.classList.contains("is-missing")) {
      tl.fromTo(photo, { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.6 }, 0.15)
        .from(photo.querySelector("img"), { scale: 1.15, duration: 2 }, 0.15);
    }

    showHero();
    return tl;
  }

  /* Reflection ripple: slow idle drift, plus a wake that grows with scroll speed and settles. */
  function riverRipple() {
    var noise = document.getElementById("ripple-noise");
    var map = document.getElementById("ripple-map");
    if (!noise || !map) return function () {};

    var BASE = 6;
    var state = { fx: 0.004, fy: 0.07, wake: 30 }; // starts choppy, settles after the intro
    var drift = gsap.to(state, { fx: 0.006, fy: 0.095, duration: 5, ease: "sine.inOut", yoyo: true, repeat: -1 });

    function tick() {
      state.wake += (BASE - state.wake) * 0.035;
      noise.setAttribute("baseFrequency", state.fx.toFixed(4) + " " + state.fy.toFixed(4));
      map.setAttribute("scale", state.wake.toFixed(2));
    }

    var running = false;
    function run(on) {
      if (on === running) return;
      running = on;
      if (on) { gsap.ticker.add(tick); drift.play(); }
      else { gsap.ticker.remove(tick); drift.pause(); }
    }

    var st = ScrollTrigger.create({
      trigger: ".hero", start: "top bottom", end: "bottom top",
      onToggle: function (self) { run(self.isActive); },
      onUpdate: function (self) {
        var v = Math.abs(self.getVelocity());
        state.wake = Math.max(state.wake, gsap.utils.clamp(BASE, 64, BASE + v / 40));
      }
    });
    run(true);

    return function () { run(false); st.kill(); drift.kill(); };
  }

  function storyParallax() {
    gsap.utils.toArray("[data-parallax]").forEach(function (el) {
      if (el.classList.contains("is-missing")) return;
      var d = parseFloat(el.getAttribute("data-parallax")) || 0;
      gsap.fromTo(el, { yPercent: -d / 2 }, {
        yPercent: d / 2, ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true }
      });
    });
  }

  /* A day on the quay: pin, pan the four times of day sideways, move the sun across the sky
     and shift the light from morning fog to dusk. The sun sets below the waterline at closing. */
  function dayOnTheQuay() {
    var section = document.querySelector("[data-day]");
    var pin = section.querySelector("[data-day-pin]");
    var track = section.querySelector("[data-day-track]");
    var sun = section.querySelector("[data-sun]");
    var sky = section.querySelector(".day__sky");
    var title = section.querySelector(".day__title");

    section.classList.add("is-pinned");

    var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
    var skyW = function () { return sky.clientWidth; };
    var skyH = function () { return sky.clientHeight; };
    var sunS = function () { return sun.offsetWidth; };

    gsap.set(section, { "--day-bg": cssVar("--day-morning"), "--day-fg": cssVar("--day-fg-light") });

    var tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: pin,
        start: "top top",
        end: function () { return "+=" + Math.round(dist() * 1.15); },
        pin: true,
        scrub: 0.6,
        invalidateOnRefresh: true
      }
    });

    tl.to(track, { x: function () { return -dist(); }, duration: 1 }, 0)
      // sun: left to right, rising then setting through the waterline
      .fromTo(sun, { x: function () { return skyW() * 0.08; } }, { x: function () { return skyW() * 0.84; }, duration: 1 }, 0)
      .fromTo(sun, { y: function () { return sunS() * 0.55; } }, { y: function () { return -Math.max(0, skyH() - sunS() - (title.offsetTop + title.offsetHeight) - 32); }, duration: 0.45, ease: "sine.out" }, 0)
      .to(sun, { y: function () { return sunS() + 4; }, duration: 0.55, ease: "sine.in" }, 0.45)
      // light
      .to(section, { "--day-bg": cssVar("--day-noon"), duration: 0.3 }, 0)
      .to(section, { "--day-bg": cssVar("--day-afternoon"), duration: 0.3 }, 0.3)
      .to(section, { "--day-bg": cssVar("--day-evening"), duration: 0.25 }, 0.6)
      .to(section, { "--day-fg": cssVar("--day-fg-dark"), duration: 0.08 }, 0.66)
      .to(section, { "--day-bg": cssVar("--day-night"), duration: 0.15 }, 0.85);

    return tl;
  }

  function reveals() {
    var items = gsap.utils.toArray("[data-reveal]").filter(function (el) { return !el.classList.contains("is-missing"); });
    gsap.set(items, { autoAlpha: 0, y: 24 });
    ScrollTrigger.batch(items, {
      start: "top 90%",
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.9, ease: "expo.out", stagger: 0.08, overwrite: true });
      }
    });
  }
})();
