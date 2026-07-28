// Point every "Book a call" button at your scheduling link.
// Replace the placeholder below with your real booking URL (Cal.com, Calendly, etc.).
const CALENDAR_URL = "https://cal.com/REPLACE-WITH-YOUR-LINK";

for (const el of document.querySelectorAll("a.cta")) {
  el.href = CALENDAR_URL;
  el.target = "_blank";
  el.rel = "noopener";
}

// Footer year
document.getElementById("year").textContent = new Date().getFullYear();
