# 飞龙打字 · Typing Dragon

A keybr-style typing tutor for one kid: keys unlock one at a time as they get fast and accurate,
lessons are built from real words, and progress syncs between devices through a private GitHub repo.

- `npm run dev` – local dev server
- `npm test` – unit tests
- Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

Sync: in 设置, enter the data repo (`typing-data`) and a fine-grained token with
Contents read/write on that repo only. Data layout: `sessions/YYYY-MM.json` (append-only
practice log) and `state.json` (settings and the unfinished lesson).
