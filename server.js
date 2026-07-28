import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const WAITLIST_FILE = path.join(DATA_DIR, "waitlist.json");

// Ensure data store exists.
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(WAITLIST_FILE)) fs.writeFileSync(WAITLIST_FILE, "[]");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const readWaitlist = () => {
  try {
    return JSON.parse(fs.readFileSync(WAITLIST_FILE, "utf8"));
  } catch {
    return [];
  }
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Join the waitlist.
app.post("/api/waitlist", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const name = String(req.body?.name || "").trim().slice(0, 120);
  const useCase = String(req.body?.useCase || "").trim().slice(0, 500);

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, error: "Please enter a valid email address." });
  }

  const list = readWaitlist();
  if (list.some((e) => e.email === email)) {
    return res.status(200).json({ ok: true, already: true, position: list.findIndex((e) => e.email === email) + 1 });
  }

  const entry = {
    email,
    name,
    useCase,
    createdAt: new Date().toISOString(),
  };
  list.push(entry);
  fs.writeFileSync(WAITLIST_FILE, JSON.stringify(list, null, 2));

  return res.status(201).json({ ok: true, already: false, position: list.length });
});

// Lightweight public stats for the live counter on the page.
app.get("/api/stats", (_req, res) => {
  res.json({ count: readWaitlist().length });
});

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`✨ Conjure is running at http://localhost:${PORT}`);
});
