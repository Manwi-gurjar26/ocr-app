# OCR Document App — Design

## Goal
Upload invoices, receipts and ID cards (images or PDFs) → OCR → classify type → extract structured fields → store in PostgreSQL → browse, edit, and export PDF reports. Animated liquid-glass UI with iPhone-style icon buttons.

## Stack
- Next.js (App Router) + TypeScript + Tailwind CSS
- PostgreSQL 18 (local cluster, port 5433, DBs `ocr_app` / `ocr_app_test`), Drizzle ORM
- OCR: `tesseract.js` (images), `unpdf` (PDF text layer; image-only PDFs rendered to PNG then OCR'd)
- AI extraction (optional): Claude vision via `@anthropic-ai/sdk` when `ANTHROPIC_API_KEY` is set
- PDF reports: `pdf-lib`
- Animation: `motion` (Framer Motion); icons: `lucide-react`
- Tests: Vitest (unit + DB integration), Playwright (end-to-end smoke)

## Architecture (units)
| Unit | Path | Purpose |
|---|---|---|
| db | `src/db/` | Drizzle schema + client |
| ocr | `src/lib/ocr/` | `ocrFile(buffer, mime) → { text, confidence }` |
| classify | `src/lib/extract/classify.ts` | text → `invoice \| receipt \| id_card \| unknown` |
| rules | `src/lib/extract/rules/*.ts` | per-type regex field extractors (offline fallback) |
| ai | `src/lib/extract/ai.ts` | Claude vision extraction → same field shape |
| pipeline | `src/lib/pipeline.ts` | orchestrates OCR → classify → extract → save |
| repo | `src/lib/documents-repo.ts` | CRUD queries |
| reports | `src/lib/reports/` | single-document PDF + summary PDF |
| API | `src/app/api/...` | upload, list, get, update, delete, report routes |
| UI | `src/app/`, `src/components/` | dashboard, upload, document detail, reports |

## Data model
`documents`: id (uuid), file_name, mime_type, file_size, file_path, doc_type, status (`processing|done|failed`), raw_text, ocr_confidence, extraction_method (`ai|rules`), fields (jsonb), error, created_at, updated_at.

Field shapes:
- invoice: invoiceNumber, invoiceDate, dueDate, vendorName, vendorGstin, customerName, subtotal, tax, total, currency, lineItems[{description, quantity, unitPrice, amount}]
- receipt: merchantName, date, time, paymentMethod, subtotal, tax, total, currency, items[{description, amount}]
- id_card: idType (aadhaar|pan|passport|driving_license|voter_id|other), idNumber, fullName, dateOfBirth, gender, fatherName, address, expiryDate

Uploaded files stored on disk under `uploads/` (gitignored). Aadhaar numbers masked in UI and reports except the last 4 digits.

## Error handling
Pipeline failures set status `failed` with message; UI shows retry. Upload limits: 10 MB; jpg/png/webp/pdf only. AI failure falls back to rules automatically.

## Testing
Every step is verified before the next: unit tests for classify/rules/reports, integration tests against `ocr_app_test`, OCR test on a generated sample image, Playwright smoke for upload → detail → report.
