// Year in footer
document.getElementById("year").textContent = new Date().getFullYear();

// Live waitlist counter
const countEl = document.getElementById("count");
const counterLine = document.getElementById("counter-line");
fetch("/api/stats")
  .then((r) => r.json())
  .then((d) => {
    const n = 40 + (d.count || 0); // seed baseline so it never reads empty
    if (countEl) countEl.textContent = n.toLocaleString();
  })
  .catch(() => {
    if (counterLine) counterLine.textContent = "Be one of the first teams on the list";
  });

// Waitlist form
const form = document.getElementById("waitlist-form");
const msg = document.getElementById("form-msg");
const success = document.getElementById("success");
const successDetail = document.getElementById("success-detail");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.textContent = "";
  msg.classList.remove("ok");

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const useCase = document.getElementById("useCase").value.trim();

  if (!EMAIL_RE.test(email)) {
    msg.textContent = "Please enter a valid email address.";
    return;
  }

  const btn = form.querySelector("button[type=submit]");
  const label = btn.querySelector(".btn-label");
  const original = label.textContent;
  btn.disabled = true;
  label.textContent = "Conjuring…";

  try {
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, useCase }),
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Something went wrong. Please try again.");
    }

    // Reveal success state
    form.hidden = true;
    success.hidden = false;
    if (data.already) {
      successDetail.textContent = "You're already on the list — we've got you. Sit tight.";
    } else {
      successDetail.textContent = `You're #${data.position} in line. We'll reach out with your early-access slot soon.`;
    }
  } catch (err) {
    msg.textContent = err.message || "Something went wrong. Please try again.";
    btn.disabled = false;
    label.textContent = original;
  }
});
