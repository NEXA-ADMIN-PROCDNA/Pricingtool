<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Project: NEXA — Business Development & Pricing Tool

ProcDNA internal app for tracking opportunities through pricing, approval, SOW, and project-code stages. Stack: Next.js 16 (App Router) + React 19 + Prisma 7 + PostgreSQL on Supabase + NextAuth v4 (Azure AD JWT) + Microsoft Graph API for mail/OneDrive.

Deployed to two Vercel projects from the same `main` branch: `pricingtoolprimero` (legacy) and `procdnanexa` (current). Region: `fra1`.

---

# Critical conventions (read first)

1. **Auth in API routes — always use `getAuthToken(req)` from `@/lib/getAuthToken`**, never `getToken({ req })` from `next-auth/jwt` directly. The helper passes `secret`, `secureCookie: true`, and `cookieName: '__Secure-next-auth.session-token'` explicitly. Direct `getToken` calls broke on Vercel Edge runtime because NextAuth's env-var auto-detection isn't reliably inlined into the bundle.

2. **Auth middleware file is `proxy.ts`, not `middleware.ts`.** Next.js 16 renamed the convention. Exported as `export async function proxy(req)`. Uses the same explicit `getToken` params as the helper. Matcher excludes `login`, `login2`, `api/auth`, `api/approvals/email-action`, `api/emergency`, static assets.

3. **Prisma 7 model accessor casing**: `prisma.sOWDocument`, `prisma.pODocument` (not `prisma.SOWDocument`). DB connection config lives in `prisma.config.ts`, not `schema.prisma`.

4. **Supabase**: use `getSupabase()` from `lib/supabase.ts` (lazy factory — never instantiate at module level). Buckets: `SoW_bucket`, `PO_bucket`. Service role key bypasses RLS because NextAuth (not Supabase Auth) is the auth source.

5. **No `prisma migrate` on Vercel.** Vercel runs `prisma generate` (postinstall) only. All schema changes must be applied via SQL in Supabase manually.

6. **Decimal serialization**: Prisma `Decimal` fields come through as `Decimal` objects, not numbers. Always `Number(value)` when assigning to client-side state or computing.

---

# Database schema (prisma/schema.prisma)

Schema: `procdna_database`. Multi-schema is enabled.

## Enums
- `UserRole` — `SEL | DIRECTOR | ED | PARTNER | ADMIN`
- `LineOfBusiness` — `TECH | ANALYTICS | MS | DS | DESIGN | AUXO`
- `OpportunityStatus` — `OPEN | WON | LOST | ABANDONED | ARCHIVED`
- `OpportunityStage` — `LEAD | PRICE_LINKING_PENDING | PRICE_LINKED | APPROVAL_PENDING | SOW_PENDING | SOW_SUBMITTED | SOW_REVIEW_PENDING | TO_BE_ARCHIVED`
- `Location` — `INDIA | US`
- `ApprovalStatus` — `PENDING | APPROVED | REJECTED | WITHDRAWN`
- `ApprovalType` — `PRICING | SOW_VERIFICATION`
- `RequestStatus` — `PENDING | APPROVED | REJECTED`

## Models — key fields (full list in schema.prisma)

- **User** — `id`, `email`, `name`, `role`, `location`, `azureId`, `managerId`, `isActive`
- **Client** — `id`, `clientId` (e.g. `CL-001`), `name`, `businessUnit`, `industry`, `region`
- **ClientPOC** — POC contact rows linked to Client
- **ClientRequest** — request for new client; admin approves → creates Client
- **Opportunity** — `id`, `opportunityId` (`BD-NNN`), `clientId`, `opportunityName`, `primaryLob`, `stage`, `status`, `starConnect`, `preContractAgreed`, `projectCodeProceed`, `estimatedRevenue`, `probability`, `ownerId`, `startDate`, `endDate`
- **RateCard** — `jobRole`, `location`, `domain`, `costRatePerHour`, `billRatePerHour`, `effectiveFrom`, `effectiveTo`
- **PricingVersion** — `versionNumber`, `isFinal`, summary fields (proposedBillings, totalCost, grossMarginPct, …), `businessJustification`
- **StaffingResource** — `pricingVersionId`, `rateCardId`, `resourceDesignation`, `location`, `domain`, `effectiveBillRate` (manual or system), `systemBillRatePerHour`, `manualBillRatePerHour`, `utilization`, `costRatePerHour`, `isBillable`, `isActive`
- **StaffingWeekEntry** — `staffingResourceId`, `weekStartDate` (Monday), `hours`
- **OtherCost** — `description`, `amount`, `markupPct`, `isBillable`, **`lineOfBusiness`** (string, optional, tracks the LoB the cost belongs to)
- **ScheduleOfPayment** — monthly payment plan per pricing version
- **FinancialSnapshot** — rows A–K per month per pricing version
- **ApprovalRequest** — `opportunityId`, `requestedById`, `approverId`, `approvalType`, `status`, `rejectionReason`, **`withdrawalReason`**, `businessJustification`, `pricingVersionNumber`, **`emailMessageId`** (for email threading, currently unused)
- **SOWDocument** / **PODocument** — `fileName`, `storagePath`, `fileUrl`, `fileSizeBytes`, `mimeType`, `version`, `isActive` (soft-delete)
- **Comment** — threaded via `parentId`
- **ActivityLog**, **NotificationLog** — audit trails

---

# API Routes

All routes live under `app/api/`. Auth uses `getAuthToken(req)` from `@/lib/getAuthToken`. Routes that require auth return `401` if token is missing. Some older routes (marked ⚠️) have no auth guard — do not add new routes without auth.

## Opportunities

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| GET | `/api/opportunities` | ✅ | List opportunities filtered by RBAC role (`token.role`). ADMIN/PARTNER see all; DIRECTOR sees own + SELs; SEL sees own only. |
| POST | `/api/opportunities` | ✅ | Create opportunity (auto-generates `BD-NNN` ID), optionally creates POCs. End date is required. |
| PATCH | `/api/opportunities/[id]` | ✅ | Update `preContractAgreed`, `status` (OPEN/WON), `projectCodeProceed`. Triggers stage transitions on `preContractAgreed`. |
| POST | `/api/opportunities/[id]/approvals` | ✅ | Create approval request linking approverId + requestedById. Sends approval email. |
| POST | `/api/opportunities/[id]/comments` | ✅ | Add comment (threaded via `parentId`). |
| POST | `/api/opportunities/[id]/other-costs` | ✅ | Add other-cost line item (description, amount, markupPct, **lineOfBusiness**). |
| PATCH | `/api/opportunities/[id]/other-costs/[costId]` | ✅ | Update isBillable / markupPct / **lineOfBusiness**. |
| DELETE | `/api/opportunities/[id]/other-costs/[costId]` | ✅ | Delete cost line. |
| POST | `/api/opportunities/[id]/pricing-versions` | ✅ | Create pricing version (auto-increments versionNumber). |
| GET | `/api/opportunities/[id]/sow` | ✅ | List SoW docs with fresh 1-hr Supabase signed URLs. |
| POST | `/api/opportunities/[id]/sow` | ✅ | Upload SoW to `SoW_bucket` (multipart, max 20 MB, PDF/Word/Excel/PNG/JPEG). |
| DELETE | `/api/opportunities/[id]/sow` | ✅ | Soft-delete SoW doc (`isActive: false`). Body: `{ docId }`. |
| GET | `/api/opportunities/[id]/po` | ✅ | List PO docs with fresh 1-hr signed URLs. |
| POST | `/api/opportunities/[id]/po` | ✅ | Upload PO to `PO_bucket` (same rules as SoW). |
| DELETE | `/api/opportunities/[id]/po` | ✅ | Soft-delete PO doc. Body: `{ docId }`. |

## Pricing Versions

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| GET | `/api/pricing-versions/[pvId]` | ✅ | Fetch version with staffing, schedule, financials. |
| PATCH | `/api/pricing-versions/[pvId]` | ✅ | Update financial metrics; setting `isFinal: true` unsets siblings. |
| DELETE | `/api/pricing-versions/[pvId]` | ✅ | Delete version. |
| POST | `/api/pricing-versions/[pvId]/duplicate` | ✅ | Deep-copy version (staffing + weekly hours + schedule + financials). |
| POST | `/api/pricing-versions/[pvId]/staffing` | ✅ | Add staffing resource from rate card (`{ rateCardId }`). `effectiveBillRate` defaults to rate-card bill rate (D/P = 0). |
| PATCH | `/api/pricing-versions/[pvId]/staffing/[srId]` | ✅ | Update utilization/billRate/active/billable; upsert weekEntries `[{ weekStartDate, hours }]`. |
| DELETE | `/api/pricing-versions/[pvId]/staffing/[srId]` | ✅ | Delete staffing resource. |
| PUT | `/api/pricing-versions/[pvId]/staffing/[srId]/hours` | ✅ | Upsert single week entry `{ weekStartDate, hours }`. |

## Approvals

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| GET | `/api/approvals` | ✅ | List approval requests for the signed-in user as approver. `?pending=true` filters to PENDING only. |
| POST | `/api/approvals/[id]/approve` | ✅ | Approve request. Stage transition: PRICING → `SOW_PENDING`, SOW_VERIFICATION → `TO_BE_ARCHIVED`. Sends approval email. |
| POST | `/api/approvals/[id]/reject` | ✅ | Reject. Body: `{ reason? }`. Reverts stage. |
| POST | `/api/approvals/[id]/withdraw` | ✅ | Requester withdraws pending request. Body: `{ reason? }` (stored in `withdrawalReason`). Reverts to `PRICE_LINKED`. Sends withdrawal email. |
| GET | `/api/approvals/email-action` | None (token) | Shows branded HTML confirm/reject page. Token signed by `lib/approval-tokens.ts` (HMAC-SHA256, 7-day TTL). |
| POST | `/api/approvals/email-action` | None (token) | Action endpoint for the one-click links. Verifies token, updates approval, sends approve/reject email. Same logic as authed routes. |

## Client Requests

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| GET | `/api/client-requests` | ⚠️ | List PENDING client requests. |
| POST | `/api/client-requests` | ⚠️ | Create client request (`name`, `requestedById`, optional metadata). |
| POST | `/api/client-requests/[reqId]/approve` | ⚠️ | Approve: creates Client record (auto-generates `CL-NNN` ID). Body: `{ reviewerId }`. |
| POST | `/api/client-requests/[reqId]/reject` | ⚠️ | Reject. Body: `{ reviewerId }`. |

## Misc

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| DELETE | `/api/client-pocs/[id]` | ✅ | Delete a client POC. |
| GET | `/api/pipeline-revenue` | ⚠️ | Sum estimatedRevenue (or final pricingVersion billings) across active opps. Returns `{ total }`. |
| GET | `/api/rate-cards` | ⚠️ | List active rate cards (jobRole, location, cost/bill rates). |
| POST | `/api/rate-cards/upload` | ⚠️ | Upload Excel rate card file (ADMIN). |
| POST | `/api/rate-cards/upload/confirm` | ⚠️ | Confirm parsed rate cards into DB. |
| GET | `/api/users` | ⚠️ | List all users. |
| POST | `/api/users` | ⚠️ | Create user (`name`, `email`, `role` — defaults to `'BD'`). |
| GET | `/api/export/opportunities` | ✅ | Export opportunities to Excel on Shreeraj's OneDrive (Files.ReadWrite.All). |
| POST | `/api/test-mail` | ✅ | Debug: send a test approval email. |
| GET | `/api/test-mail-preview` | ✅ | Debug: HTML preview of an approval email. |
| GET | `/api/emergency` | None | Emergency endpoint — excluded from proxy auth. |

---

# Page routes

| Route | File | Notes |
|---|---|---|
| `/` | `app/page.tsx` | Server redirect → `/dashboard`. |
| `/login` | `app/login/page.jsx` | Azure SSO only. Two-panel design with `/logo.png`. Credentials form removed. |
| `/login2` | `app/login2/page.tsx` | Credentials (email/password) login. Backup access. |
| `/dashboard` | `app/dashboard/page.tsx` | Opportunities table + KPI strip. Server component. **Do not put `'use server'` at the top of this file** — it breaks page rendering. |
| `/opportunities/new` | `app/opportunities/new/NewOpportunityForm.tsx` | Create form. End date required. Client dropdown shows name only (no CL-NNN). |
| `/opportunities/[id]` | `app/opportunities/[id]/page.tsx` + `OpportunityTabs.tsx` | Detail page with tabs: Details / Pricing / Pricing Approval / SOW & PO / Project Code / Comments. |
| `/clients` | `app/clients/page.tsx` | Client master with `ClientsBrowser`, `AddClientModal`, admin requests panel. |
| `/clients/[id]` | `app/clients/[id]/page.tsx` | Client detail. |
| `/approvals` | `app/approvals/page.tsx` + `ApprovalsInbox.tsx` | Approval inbox with SOW doc preview, pending vs decided sections. |

---

# RBAC

Role hierarchy (highest to lowest): `ADMIN` → `PARTNER` → `ED` → `DIRECTOR` → `SEL`.

Enforced in `lib/db/opportunities.ts` via `resolveOwnerFilter(auth)` — a synchronous function that returns a Prisma `where` fragment based on `token.role`. No managerId traversal. JWT tokens are HMAC-SHA256 signed with `NEXTAUTH_SECRET` — users cannot forge or modify them.

- **SEL**: own opportunities only
- **DIRECTOR**: own + SEL-owned (within team)
- **ED**: own + DIRECTOR + SEL (2-level subtree)
- **PARTNER**: all
- **ADMIN**: all

Tab visibility for **withdraw button** (in OpportunityTabs) requires `sessionUserId === opp.ownerId && pendingPricing` — owner-only, not role-based. Admins cannot withdraw on others' behalf in the current UI.

---

# Approval flow

```
LEAD
  ↓ create pricing version
PRICE_LINKING_PENDING
  ↓ mark version as final
PRICE_LINKED
  ↓ request PRICING approval
APPROVAL_PENDING
  ├─ approve → SOW_PENDING
  ├─ reject → PRICE_LINKED
  └─ withdraw → PRICE_LINKED  (requester only, reason stored in withdrawalReason)
SOW_PENDING
  ↓ upload SOW/PO and preContractAgreed = true
SOW_SUBMITTED
  ↓ request SOW_VERIFICATION approval
SOW_REVIEW_PENDING
  ├─ approve → TO_BE_ARCHIVED  (this also implicitly marks the opp WON via stage gating in UI, not status field)
  └─ reject → SOW_SUBMITTED
TO_BE_ARCHIVED
```

- **Locked stages for pricing**: pricing version becomes read-only when `isFinal === true` AND stage is in `{APPROVAL_PENDING, SOW_PENDING, SOW_SUBMITTED, SOW_REVIEW_PENDING, TO_BE_ARCHIVED}`. Lock check uses **live** `oppStage` state passed as `currentStage` prop to `PricingDrawer`, not the static `opp.stage` from server.
- **Tab gating** (in OpportunityTabs, visually dimmed but still clickable):
  - SOW / PO tab dimmed when stage NOT in `{SOW_PENDING, SOW_SUBMITTED, SOW_REVIEW_PENDING, TO_BE_ARCHIVED}`
  - Project Code tab dimmed when stage !== `TO_BE_ARCHIVED`
- Status field is now a **manual dropdown** (OPEN / WON) — auto-WON-on-approval was removed.

---

# Mail (lib/mail.ts)

- Sent via Microsoft Graph API (`/users/{MAIL_SENDER}/sendMail`), client-credentials flow via `@azure/identity`.
- Graph **blocks RFC-standard headers** (`Message-ID`, `In-Reply-To`, `References`) — threading relies on identical subject lines instead.
- Five exports:
  - `sendMail({ to, cc?, subject, html })`
  - `mailApprovalRequested(...)` — to approver (with action buttons), CC list (info-only), requester (confirmation)
  - `mailApprovalApproved(...)` — to requester + approver
  - `mailApprovalRejected(...)` — same recipients + optional reason
  - `mailApprovalWithdrawn(...)` — same recipients + optional reason
- Email action links go through `/api/approvals/email-action?token=...`. Token signed by `lib/approval-tokens.ts` (HMAC-SHA256, 7-day TTL, encodes approvalId + approverId + action).
- All emails wrapped with branded NEXA HTML shell (`wrap()` helper). Footer link uses `BASE_URL` (env `MAIL_BASE_URL`, defaults to `https://procdnanexa.vercel.app`).

---

# Environment variables

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Prisma pooled connection (port 6543, transaction mode). |
| `DIRECT_URL` | Direct DB connection for migrations (port 5432). |
| `NEXTAUTH_URL` | Public app URL (e.g. `https://procdnanexa.vercel.app`). Must be https in prod. |
| `NEXTAUTH_SECRET` | JWT signing secret. Used by `getAuthToken` helper and proxy. |
| `AZURE_AD_CLIENT_ID` / `AZURE_AD_CLIENT_SECRET` / `AZURE_AD_TENANT_ID` | Azure App Registration for SSO + Graph API. |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase storage (server-side). |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client-side (rarely used; most flows go through server). |
| `MAIL_SENDER` | From address (e.g. `nexa_admin@procdna.com`). |
| `MAIL_BASE_URL` | URL prepended in email links. Same as `NEXTAUTH_URL` in prod. |
| `EMAIL_ACTION_SECRET` | HMAC secret for email-action tokens (lib/approval-tokens.ts). |
| `CREDENTIALS_SECRET` | Shared secret for `/login2` credentials provider. |
| `ONEDRIVE_USER` / `ONEDRIVE_FILE_PATH` | Target OneDrive for export feature. |

---

# Recent feature additions (since AGENTS.md v1)

- **Withdraw approval flow** + `withdrawalReason` field + email
- **`lineOfBusiness` on OtherCost** + LoB dropdown in TabOtherCost
- **Domain Revenue Mix** card in TabBasicDetails (replaced Revenue Share). Falls back to hours weight when effective bill rate is 0.
- **Project Code tab** + `projectCodeProceed` boolean. Permanent confirmation flow (red warning before commit).
- **Manual OPEN/WON status dropdown** — replaced auto-WON on SOW verification approval.
- **Tab gating** — SOW/PO and Project Code tabs visually dimmed before their respective gates pass.
- **Multi-year pricing** — staffing weekly hours cap raised from 52 to 520 weeks (~10 years).
- **`getAuthToken` helper** — added explicit `secret` + `secureCookie` + `cookieName` to every `getToken` call (proxy and all 31 API routes). Fixes silent login loop + 401 on new Vercel projects where env-var auto-detection fails in Edge runtime.
- **Login page redesign** — two-panel layout, credentials form removed from `/login` (still at `/login2`).
- **End date required** in NewOpportunityForm.
- **Star Connect badge removed** from opportunity header (field still in Details tab + form).
- **Logo size bumped** on dashboard from 34→51px.

---

# Things to avoid

- Do not write `'use server'` at the top of a `page.tsx` file. It marks the page's exports as Server Actions and breaks rendering — caused a silent redirect to `/login` on Next.js 16.
- Do not import `getToken` from `next-auth/jwt` directly in new API routes. Use `getAuthToken` from `@/lib/getAuthToken`.
- Do not rely on NextAuth's auto-detection of `useSecureCookies` in Edge runtime — be explicit.
- Do not pass an authenticated user's session token to mail templates — emails go through token-signed URLs (`/api/approvals/email-action`).
- Do not add API routes without auth. The 12 ⚠️-marked routes in this doc are legacy and being migrated.
- Do not run `prisma migrate` expecting Vercel to apply it. Apply SQL manually in Supabase.
- Do not modify `prisma.config.ts` connection settings without testing locally first — it's the source of truth, not `schema.prisma`.
