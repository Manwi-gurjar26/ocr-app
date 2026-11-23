# KiloWattX — OCR & Document Verification Module

This is the core feature of the project. KiloWattX is a solar marketplace: customers, factories and
landowners upload documents for identity, business and bank checks. Here OCR is not just reading text.
It is one stage of a **document processing and verification workflow**.

Source: *KiloWattX — End-to-End Tech Stack & Build Blueprint (v3)*, §11 (p. 40).

| Blueprint integration | Documents | Status in this repo |
|---|---|---|
| Amazon Textract | Electricity bills, GST certificates | Adapter built (`src/lib/providers/textract.ts`), off until configured |
| Perfios OCR + Document Tamper / Behavioural Check | KYC documents, cheques, bank statements | Adapter built against a **placeholder contract** (`src/lib/providers/perfios.ts`) |
| Perfios Bank Statement Analyser + GST Analyser | Credit assessment before a PPA | **Not in scope.** Basic OCR does not replace BSA |

When neither provider is configured, every document goes through local OCR (Tesseract plus the PDF text
layer), so the whole workflow runs offline in development.

---

## 1. Pipeline

```
Upload (Customer App / Admin)            POST /api/documents  (alias: POST /api/v1/documents/upload)
  │  type/size/magic-byte checks, selected category, customer-entered details
  ▼
Private storage (local uploads/ → S3 in production)
  ▼
Integration layer — DocumentChecker      selectChecker(docType): Textract | Perfios | Tesseract
  │  falls back to local OCR if the provider errors
  ▼
Extraction                               provider fields → Claude vision (if key set) → rules
  ▼
Validation engine                        src/lib/validation — required fields, dates, formats,
  │                                      checksums, declared-vs-extracted consistency, tamper signals
  ▼
PostgreSQL + Admin review                documents / document_extractions / document_events
```

### Status lifecycle

```
UPLOADED → PROCESSING → EXTRACTED → VALIDATION_PENDING → VERIFIED | MANUAL_REVIEW | FAILED
```

- **VERIFIED** means every check passed.
- **MANUAL_REVIEW** means at least one check failed (rule violation, mismatch, low OCR confidence, tamper
  signal, type mismatch). A genuine customer is never rejected automatically.
- **FAILED** is used only when processing itself broke (corrupt file, provider outage with no fallback),
  or when a reviewer rejects the document or asks for a re-upload.

Every transition is written to `document_events`, which records the actor, the action and a note.

## 2. Document types and rules

| Type (`docType`) | Extracted fields | Checks |
|---|---|---|
| `electricity_bill` | DISCOM, consumer name/number, address, bill date, billing period, units (kWh), sanctioned load, amount payable, due date | Consumer no. + name present; units > 0; amount ≥ 0; **bill ≤ 60 days old** (blueprint Legal-stage rule; uses bill date, then period end, then due date); matches the customer's consumer no./name |
| `gst_certificate` | GSTIN, legal name, trade name, principal place, constitution, registration type, date of liability, date of issue | GSTIN present, format + **check digit** valid; legal name present; PAN embedded in the GSTIN matches the declared PAN; GSTIN and names match |
| `bank_statement` | Bank, holder, account no., IFSC, period, opening/closing balance, credits/debits, transactions | Account no. + holder present; opening + credits − debits = closing; last 4 digits and holder match; always notes that credit analysis belongs to Perfios BSA |
| `id_card` (KYC) | ID type, number, name, DOB, gender, father's name, address, expiry | Number + name present; **Aadhaar Verhoeff checksum**; PAN/passport/EPIC/DL format; not expired; name/number/DOB match; notes that liveness, face match and tamper checks belong to the KYC provider |
| `invoice`, `receipt` | (kept from the original app) | Total present |

Checks that apply to every document:
- The selected type must match the detected type. A mismatch fails; "could not detect" only warns.
- OCR confidence below 60 % fails, and 60–75 % warns.
- Each provider tamper signal becomes a check: high/medium severity fails, low severity warns.

Name matching ignores M/s, Pvt, Ltd, Private, Limited, LLP, Shri, Smt, punctuation and case.

When a reviewer edits fields (`PATCH /api/documents/:id`), the document is re-validated.

## 3. API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/documents` | multipart: `files[]`, optional `docType`, `customerId`, `declared` (JSON). Returns the new rows with status `uploaded`; processing runs in the background |
| POST | `/api/v1/documents/upload` | Blueprint path; same contract |
| GET | `/api/documents?type&status&customerId&q&from&to` | List and filter. `status=manual_review` is the review queue |
| GET | `/api/documents/:id` | Document with `fields`, `validation`, review info |
| PATCH | `/api/documents/:id` | Correct `docType`/`fields`, then re-validate |
| POST | `/api/documents/:id/review` | `{action: approve \| reject \| request_reupload, note}`; a note is required unless approving. The reviewer comes from the `x-reviewer` header for now |
| GET | `/api/documents/:id/history` | Extraction runs and audit events |
| POST | `/api/documents/:id/reprocess` | Run OCR and validation again |

`declared` keys by type:
- electricity bill: `consumerName`, `consumerNumber`
- GST: `legalName`, `gstin`, `pan`, `tradeName`
- bank: `accountHolder`, `accountNumber`
- KYC: `fullName`, `idNumber`, `dateOfBirth`
- any type: `businessName`

## 4. Data model

- `documents` holds the latest snapshot: owner, private file reference, selected and detected type,
  declared details, status, provider, fields, validation result, and review fields.
- `document_extractions` keeps one row per OCR run: provider, method, text, structured JSON, confidence,
  and validation result.
- `document_events` is the audit trail of status transitions and reviewer actions.

Aadhaar and account numbers are masked in the UI by default.

## 5. Configuration

```env
# Amazon Textract (bills + GST). Credentials come from the default AWS chain.
TEXTRACT_ENABLED=true
AWS_REGION=ap-south-1
# Perfios OCR + tamper (KYC + bank statements)
PERFIOS_OCR_URL=
PERFIOS_API_KEY=
# Optional: Claude vision for higher-accuracy field extraction
ANTHROPIC_API_KEY=
```

## 6. Still open before production

1. **Platform alignment.** The blueprint backend is NestJS + S3 + SQS/Lambda. This repo is Next.js with
   local storage and in-process background jobs. The modules are framework-free and can move into a
   NestJS service unchanged: `providers/`, `validation/`, `extract/` and `pipeline.ts`. Storage
   (`storage.ts`) needs an S3 implementation, and `after()` should become an SQS job.
2. **Perfios contract.** Map the request and response in `perfios.ts` to the API spec Perfios issues with
   your credentials. Add cheque support once that spec is available.
3. **Textract multi-page PDFs.** Synchronous AnalyzeDocument handles images and single-page PDFs only.
   Multi-page bank statements and bills need `StartDocumentAnalysis` reading from S3.
4. **Auth.** Replace the `x-reviewer` header with the platform JWT and an admin/reviewer role check.
5. **Retention.** Define retention and redaction for raw OCR text of identity and financial documents.
6. **Authenticity.** OCR does not prove that a document is genuine. Verifying a GSTIN against the GSTN or
   checking a consumer number with the DISCOM needs authoritative-source APIs.
