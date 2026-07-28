// Every "Book a call" button opens a pre-filled Google Calendar invite
// addressed to Conjure, so a visitor can pick a time and book the meeting.
const CALENDAR_URL =
  "https://calendar.google.com/calendar/render?action=TEMPLATE" +
  "&text=Website%20intro%20call%20with%20Conjure" +
  "&details=A%20quick%2015-minute%20call%20about%20your%20website." +
  "&add=alfredoaarc11%40gmail.com";

for (const el of document.querySelectorAll("a.cta")) {
  el.href = CALENDAR_URL;
  el.target = "_blank";
  el.rel = "noopener";
}

// Footer year
document.getElementById("year").textContent = new Date().getFullYear();
