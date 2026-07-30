# ✦ Conjure

**Websites for your business. Built by hand, fast.**

Conjure designs and builds fast, mobile-ready websites for your business —
and the only thing this landing page asks a visitor to do is book a call.

This repo is the **landing page**.

## What's inside

```
.
├── server.js          # Tiny Express server for local preview
├── docs/              # The published static site (GitHub Pages serves this)
│   ├── index.html     # The landing page
│   ├── styles.css     # Dark "arcane" visual theme
│   ├── script.js      # Sets the booking link + footer year
│   ├── wizard.svg     # The Conjure wizard mark
│   ├── og.png         # Social share image
│   ├── favicon.svg
│   └── dental/        # Example site #2: a dental clinic (served at /dental/)
```

The showcase section of the landing links two full example sites: **Golden Days**
(a care home, its own repo, published at `example.trustthewizard.com`) and the
**dental clinic** example that lives in this repo under `docs/dental/`.

## Run it locally

Requires Node.js 18+.

```bash
npm install
npm start
```

Then open <http://localhost:3000>.

Use `npm run dev` for auto-reload while editing.

## The booking link

Every "Book a call" button points to a single constant, `CALENDAR_URL`, defined
at the top of `docs/script.js`. It currently opens a pre-filled Google
Calendar invite so a visitor can pick a time and book the meeting. Swap that
value for any scheduling link (Cal.com, Calendly, etc.) and every button
updates at once.

## Deploying

The site is fully static — the `docs/` folder is all that's served. It's
published with **GitHub Pages** (Settings → Pages → Deploy from a branch →
`/docs`), free and behind HTTPS. Any static host (Cloudflare Pages, Netlify)
works too: point the output directory at `docs/`.

The Express server (`npm start`) is only for local preview.

---

Built with intent. Trust the wizard.
