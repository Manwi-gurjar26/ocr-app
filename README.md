# DocScan — KiloWattX document OCR & verification

Upload electricity bills, GST certificates, bank statements and KYC documents (invoices and receipts are
still supported). Each document goes through OCR, classification and field extraction, then business-rule
validation, and ends up **verified** or in **manual review**. Results are stored in PostgreSQL with a full
audit trail and can be exported as PDF reports.

**Main module spec: [docs/kilowattx/ocr-module.md](docs/kilowattx/ocr-module.md)** covers the pipeline,
status lifecycle, per-document rules, the Textract and Perfios adapters, the API and what is still open.
Next.js 16 · TypeScript · PostgreSQL 18 · Drizzle · Tesseract.js · Claude vision (optional) · pdf-lib · Motion.

## Run it

```powershell
npm run db:start      # start the project Postgres (port 5433)
npm run db:migrate    # create/update tables (app + test DBs)
npm run dev           # http://localhost:3000
```

Try it with the demo files in `samples/` (regenerate with `npm run samples`).

### Optional: AI extraction
Put an Anthropic key in `.env` → `ANTHROPIC_API_KEY=sk-ant-...` and restart. Each page is then read by
Claude (`claude-opus-5-5`) for much better accuracy on photos, messy layouts and line items. If the AI call
fails or no key is set, the offline rules engine is used automatically. Note: with a key set, document
images are sent to Anthropic's API.

## How it works

| Step | Code |
|---|---|
| Upload & validation (PNG/JPG/WEBP/PDF, ≤10 MB, ≤20 files) | `src/app/api/documents/route.ts`, `src/lib/pipeline.ts` |
| OCR: image cleanup (sharp) + Tesseract; PDF text layer or render-then-OCR | `src/lib/ocr/` |
| Classify invoice / receipt / ID card | `src/lib/extract/classify.ts` |
| Field rules (GSTIN, totals, CGST/SGST, Aadhaar, PAN, passport, DL, voter ID) | `src/lib/extract/rules/` |
| AI extraction with structured output | `src/lib/extract/ai.ts` |
| Database (table `documents`, fields as JSONB) | `src/db/schema.ts`, `src/lib/documents-repo.ts` |
| PDF reports (single document + summary) | `src/lib/reports/` |
| UI (liquid glass, iOS app icons) | `src/app/`, `src/components/` |

OCR runs in the background after upload (`after()`), and the UI polls until each document is done.
Aadhaar numbers are masked (`XXXX XXXX 1234`) in the UI and in reports unless revealed.

## API

| Method | Path | |
|---|---|---|
| POST | `/api/documents` | multipart `files` (one or more) |
| GET | `/api/documents?type=&q=&from=&to=&limit=&offset=` | list / search |
| GET · PATCH · DELETE | `/api/documents/:id` | PATCH body `{ docType?, fields? }` |
| POST | `/api/documents/:id/reprocess` | re-run OCR |
| GET | `/api/documents/:id/file` | original upload |
| GET | `/api/documents/:id/report[?download=1]` | PDF report |
| GET | `/api/reports/summary?type=&from=&to=[&download=1]` | summary PDF |
| GET | `/api/stats` | counts + AI status |

## Tests

```powershell
npm test            # 34 unit + integration tests (uses the ocr_app_test DB)
npm run typecheck
npm run smoke       # end-to-end API check against a running dev server
npm run e2e         # Playwright UI flow on desktop + mobile
```
