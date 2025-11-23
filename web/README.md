# RAF quizzer web app

Minimal mobile-friendly quiz tool that asks each question, lets you type your answer, and shows which bullets you missed using fuzzy matching. Works as a static site (great for GitHub Pages/Netlify/Vercel).

## 1) Convert your spreadsheet to JSON

The parser reads a single-column XLSX where a new question starts on rows matching `^TK` and the following rows are that question’s answer bullets.

```bash
# from repo root
python scripts/convert_xlsx_to_json.py quizzer.xlsx web/public/deck.json
```

Options:

- `--header-pattern` to change the regex that identifies question rows.
- `--sheet` to pick a different worksheet XML name (sheet1, sheet2, …).
- Output defaults to `public/deck.json` if you omit the second argument.

## 2) Run the app locally

```bash
cd web
npm install
npm run dev
```

Vite currently wants Node 20.19+ (or 22.12+). Build works on Node 18 with warnings, but upgrade if you can.

## 3) Build & deploy

```bash
npm run build
```

Static files land in `web/dist`. Deploy that folder anywhere that serves static assets (GitHub Pages/Netlify/Vercel/S3). The app loads `deck.json` from `public/`, so redeploy after regenerating it.

## 4) Uploading decks in the UI

On the app, tap “Upload JSON” and provide a file shaped like:

```json
[{"question": "Your question", "answers": ["answer bullet 1", "bullet 2"]}]
```

Custom decks are cached in `localStorage`; “Use sample” resets to the bundled deck.
