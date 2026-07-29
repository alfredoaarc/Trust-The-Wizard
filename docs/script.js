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
