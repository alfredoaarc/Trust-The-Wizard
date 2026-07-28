# ✦ Conjure

**Websites for small businesses. Built by hand, fast.**

Conjure designs and builds fast, mobile-ready websites for small businesses —
and the only thing this landing page asks a visitor to do is book a call.

This repo is the **landing page**.

## What's inside

```
.
├── server.js          # Tiny Express server that serves the static site
├── public/
│   ├── index.html     # The landing page
│   ├── styles.css     # Dark "arcane" visual theme
│   ├── script.js      # Sets the booking link + footer year
│   └── favicon.svg
```

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
at the top of `public/script.js`. Replace its placeholder value with your real
scheduling link and every button updates at once.

## Deploying

The app is a standard Node web server and runs anywhere Node does
(Render, Railway, Fly.io, a VPS, etc.):

- **Start command:** `npm start`
- **Port:** reads `PORT` from the environment (defaults to `3000`)

---

Built with intent. Trust the wizard.
