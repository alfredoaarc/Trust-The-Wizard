// This page's language ("/" is Spanish, "/en/" is English).
const IS_ES = (document.documentElement.lang || "").toLowerCase().indexOf("es") === 0;

// "Book a call" / "Reserva 15 minutos" buttons open a pre-filled Google Calendar invite.
const CALENDAR_URL =
  "https://calendar.google.com/calendar/render?action=TEMPLATE" +
  "&text=" +
  encodeURIComponent(IS_ES ? "Llamada de 15 min sobre tu web" : "Website intro call with Conjure") +
  "&details=" +
  encodeURIComponent(
    IS_ES ? "Una llamada de 15 minutos para hablar de tu web." : "A quick 15-minute call about your website."
  ) +
  "&add=" +
  encodeURIComponent("hello@trustthewizard.com");

// Fallback for visitors who don't use Google Calendar: a plain email.
const MAILTO_URL =
  "mailto:hello@trustthewizard.com" +
  "?subject=" +
  encodeURIComponent(IS_ES ? "Quiero una web para mi negocio" : "Website enquiry for Conjure") +
  "&body=" +
  encodeURIComponent(
    IS_ES
      ? "Hola, me interesa una web nueva. Te cuento un poco de mi negocio: "
      : "Hi, I'm interested in a new website. Here's a bit about my business: "
  );

for (const el of document.querySelectorAll("a.cta")) {
  el.href = CALENDAR_URL;
  el.target = "_blank";
  el.rel = "noopener";
}

for (const el of document.querySelectorAll("a.mailto")) {
  el.href = MAILTO_URL;
}

// Language switch: remember the choice so the first-visit auto-redirect respects it.
for (const el of document.querySelectorAll("a.lang-link")) {
  el.addEventListener("click", function () {
    document.cookie = "ttw_lang=" + this.dataset.lang + ";path=/;max-age=31536000";
  });
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
