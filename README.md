# ✦ Conjure

**AI automations that feel like magic.**

Conjure is a boutique AI automation studio. Businesses hand over their
repetitive workflows — inbox triage, lead follow-up, reporting, data entry —
and we build custom AI agents that run them, so teams spend their hours on the
work only humans can do.

This repo is the **launch landing page + working waitlist**.

## What's inside

```
.
├── server.js          # Express server: serves the site + waitlist API
├── public/
│   ├── index.html     # Landing page
│   ├── styles.css     # Dark, "arcane" visual theme
│   ├── script.js      # Waitlist form + live counter
│   └── favicon.svg
└── data/
    └── waitlist.json  # Signups persist here (created at runtime, git-ignored)
```

## Run it locally

Requires Node.js 18+.

```bash
npm install
npm start
```

Then open <http://localhost:3000>.

Use `npm run dev` for auto-reload while editing.

## Waitlist API

| Method | Route            | Description                                  |
| ------ | ---------------- | -------------------------------------------- |
| `POST` | `/api/waitlist`  | Add a signup `{ name, email, useCase }`      |
| `GET`  | `/api/stats`     | Public signup count for the live counter     |
| `GET`  | `/healthz`       | Health check                                 |

Signups are stored as JSON in `data/waitlist.json`. Emails are validated and
de-duplicated. To export the list, just read that file (or wire the store to a
database / CRM / email tool of your choice).

## Deploying

The app is a standard Node web server and runs anywhere Node does
(Render, Railway, Fly.io, a VPS, etc.):

- **Start command:** `npm start`
- **Port:** reads `PORT` from the environment (defaults to `3000`)

For persistent signups in production, mount a volume for `data/` or swap the
JSON store in `server.js` for a database.

## Roadmap

- [ ] Email confirmation on signup
- [ ] Admin view for the waitlist
- [ ] Pipe signups into a CRM / email platform

---

Built with intent. Trust the wizard.
