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
