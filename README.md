# GVU Staff Attendance — How To Run (READ THIS FIRST)

> If you tried **"Open with Live Server"** on `index.html` and got a blank page,
> don't worry — that's normal for React + Vite projects. Read below.

## Why Live Server shows blank / "not opening"

Your project is **React + Vite + TypeScript**, NOT plain HTML.

- The `index.html` you see in the project root is just a **loader**.
  It contains this line:
  ```html
  <script type="module" src="/src/main.tsx"></script>
  ```
- Live Server does NOT understand `.tsx`, `import`, Tailwind, etc.
  Only Vite / Node.js can convert those to something the browser understands.
- So: **Never right-click the root `index.html` > Open with Live Server.**
  That will always be blank.

You have **2 correct ways** to run it:

---

## METHOD 1 — Developer mode (BEST for editing) — 2 minutes

You need **Node.js LTS** installed once. Download: https://nodejs.org (choose LTS).

1. Open the project folder in **VS Code**
2. Open terminal: `Ctrl + J` or menu `Terminal > New Terminal`
3. Run (first time only):
   ```bash
   npm install
   ```
   Wait until it finishes (1-2 mins).

4. Run:
   ```bash
   npm run dev
   ```
   You will see:
   ```
   ➜  Local:   http://localhost:5173/
   ```
5. **Ctrl + Click** that link, or paste it in Chrome/Edge.
6. Login:
   - **Administrator** (full access): `admin / admin123`
   - **Staff** (personal view only): `a.mensah / staff123`
     (other staff: `s.okafor`, `j.adeyemi`, `l.eze`, `r.banda`, `d.musa`,
      `f.bello`, `g.tetteh` — all with password `staff123`)

Leave the terminal open while you use the app. To stop: `Ctrl + C`.

> DO NOT use Live Server in this method. Use the `localhost:5173` link.

---

## METHOD 2 — Double-click file (NO terminal after build)

If you really want to "just open index.html":

1. In VS Code terminal run:
   ```bash
   npm install
   npm run build
   ```
2. A new folder `dist/` appears.
3. Inside `dist/` there is a **different** `index.html` — this one is
   self-contained (all JS/CSS inlined, ~500KB).
4. **That** file CAN be opened with Live Server or double-click:
   - In VS Code: expand `dist` > right-click `dist/index.html` > **Open with Live Server**
   - Or: open `dist` in Windows Explorer > double-click `index.html`

> Root `index.html` = source (needs Vite). `dist/index.html` = runnable (works anywhere).

---

## Common errors

| What you see | Cause | Fix |
|---|---|---|
| Blank white page on Live Server | Opened root `index.html` | Use `npm run dev` + localhost link, OR open `dist/index.html` |
| `npm is not recognized` | Node.js not installed | Install from nodejs.org, restart VS Code |
| `Failed to resolve /src/main.tsx` | Live Server serving root | Don't use Live Server on root. Use Vite dev server |
| Port 5173 in use | Old server still running | Close old terminal, or run `npm run dev -- --port 5174` |
| `dist/` folder missing | Never built | Run `npm run build` |
| Changes not showing | Editing but viewing old `dist` | If using Method 1, save file and browser auto-reloads. If using Method 2, re-run `npm run build` after every change |

---

## Folder structure

```
index.html                  -> loader (DO NOT open with Live Server)
src/main.tsx                -> React entry
src/App.tsx                 -> login / theme / page router + جلسه توضیحات TODO(API)
src/index.css               -> Tailwind + scanner animations
src/data/mockDatabase.ts    -> ALL mock tables: departments, shifts, staff,
                               biometric_templates, attendance, users, audit_logs
src/components/GvuLogo.tsx  -> GVU crest (on every page)
src/components/Common.tsx   -> Toasts, Modal, Confirm, badges, Empty/Loading
src/components/Layout.tsx   -> Sidebar + Topbar
src/pages/                  -> 10 screens (Login, Dashboard, Staff, Enrolment,
                               Terminal, Records, Reports, Departments, Audit, Users)
dist/index.html             -> BUILT file (created by npm run build, open THIS)
```

## Backend notes

Search the code for `TODO(API)` — every place a real API will plug in is marked.
Example: `POST /api/auth/login`, `GET /api/staff`, `POST /api/biometrics/enroll`,
`POST /api/attendance/clock-in`. Keep the same field names as in `mockDatabase.ts`.

© 2026 Glorious Vision University • ICT Directorate
