// Every "Book a call" button opens a pre-filled Google Calendar invite
// addressed to Conjure, so a visitor can pick a time and book the meeting.
const CALENDAR_URL =
  "https://calendar.google.com/calendar/render?action=TEMPLATE" +
  "&text=Website%20intro%20call%20with%20Conjure" +
  "&details=A%20quick%2015-minute%20call%20about%20your%20website." +
  "&add=alfredoaarc11%40gmail.com";

// Fallback for visitors who don't use Google Calendar: a plain email.
const MAILTO_URL =
  "mailto:alfredoaarc11@gmail.com" +
  "?subject=Website%20enquiry%20for%20Conjure" +
  "&body=Hi%2C%20I%27m%20interested%20in%20a%20new%20website.%20Here%27s%20a%20bit%20about%20my%20business%3A%20";

for (const el of document.querySelectorAll("a.cta")) {
  el.href = CALENDAR_URL;
  el.target = "_blank";
  el.rel = "noopener";
}

for (const el of document.querySelectorAll("a.mailto")) {
  el.href = MAILTO_URL;
}

// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// --- Motion: mark JS on (so reveals only hide when JS can run) ---
document.documentElement.classList.add("js");

// --- Reveal on scroll (transform/opacity only, no dependencies) ---
const revealEls = document.querySelectorAll(
  ".section-title, .section-sub, .card, .step, .panel, .compare, .showcase"
);
revealEls.forEach((el) => el.classList.add("reveal"));

if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          obs.unobserve(en.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.04 }
  );
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add("in"));
}

// --- Hero wizard: mouse parallax + wand sparkles (desktop, motion-friendly) ---
const wizWrap = document.querySelector(".hero-wizard-wrap");
const hero = document.querySelector(".hero");
const finePointer = window.matchMedia("(pointer: fine)").matches;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (wizWrap && hero && finePointer && !reduceMotion) {
  // Subtle tilt toward the cursor
  hero.addEventListener("mousemove", (e) => {
    const r = hero.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
    const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
    wizWrap.style.transform = `translate(${dx * 14}px, ${dy * 10}px) rotate(${dx * 4}deg)`;
  });
  hero.addEventListener("mouseleave", () => {
    wizWrap.style.transform = "";
  });

  // A little burst of sparkles from the wand tip on hover
  let lastBurst = 0;
  const castSparkles = () => {
    const now = Date.now();
    if (now - lastBurst < 500) return; // gentle cooldown
    lastBurst = now;
    const n = 5;
    for (let i = 0; i < n; i++) {
      const s = document.createElement("span");
      s.className = "sparkle";
      s.textContent = "✦";
      // wand tip sits toward the upper-right of the wizard
      s.style.left = 92 + (Math.random() - 0.5) * 26 + "px";
      s.style.top = 44 + (Math.random() - 0.5) * 22 + "px";
      s.style.setProperty("--dx", (Math.random() - 0.5) * 30 + "px");
      s.style.setProperty("--dy", -14 - Math.random() * 22 + "px");
      s.style.fontSize = 8 + Math.random() * 8 + "px";
      s.style.animationDelay = i * 60 + "ms";
      wizWrap.appendChild(s);
      setTimeout(() => s.remove(), 900 + i * 60);
    }
  };
  wizWrap.addEventListener("mouseenter", castSparkles);
}
