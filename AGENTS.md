<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# API Routes

All routes live under `app/api/`. Auth uses NextAuth JWT: `getToken({ req })` in route handlers. Routes that require auth return `401` if token is missing. Some older routes (marked ⚠️) have no auth guard — do not add new routes without auth.

Prisma model accessor naming (Prisma 7 breaking change): `SOWDocument` → `prisma.sOWDocument`, `PODocument` → `prisma.pODocument`. Connection config is in `prisma.config.ts`, not `schema.prisma`.

Supabase Storage: use `getSupabase()` from `lib/supabase.ts` (lazy factory — never instantiate at module level). Buckets: `SoW_bucket`, `PO_busket`. Always use service role key server-side; RLS is bypassed because NextAuth (not Supabase Auth) is used.

## Opportunities

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| GET | `/api/opportunities` | ✅ | List opportunities filtered by RBAC role (`token.role`). ADMIN/PARTNER see all; DIRECTOR sees own + SELs; SEL sees own only. |
| POST | `/api/opportunities` | ✅ | Create opportunity (auto-generates `BD-NNN` ID), optionally creates POCs. |
| POST | `/api/opportunities/[id]/approvals` | ⚠️ | Create approval request linking approverId + requestedById. |
| POST | `/api/opportunities/[id]/comments` | ✅ | Add comment (threaded via `parentId`). |
| POST | `/api/opportunities/[id]/other-costs` | ⚠️ | Add other-cost line item (description, amount, markupPct). |
| PATCH | `/api/opportunities/[id]/other-costs/[costId]` | ⚠️ | Update isBillable / markupPct. |
| DELETE | `/api/opportunities/[id]/other-costs/[costId]` | ⚠️ | Delete cost line. |
| POST | `/api/opportunities/[id]/pricing-versions` | ⚠️ | Create pricing version (auto-increments versionNumber). |
| GET | `/api/opportunities/[id]/sow` | ✅ | List SoW docs with fresh 1-hr Supabase signed URLs. |
| POST | `/api/opportunities/[id]/sow` | ✅ | Upload SoW to `SoW_bucket` (multipart, max 20 MB, PDF/Word/Excel/PNG/JPEG). |
| DELETE | `/api/opportunities/[id]/sow` | ✅ | Soft-delete SoW doc (`isActive: false`). Body: `{ docId }`. |
| GET | `/api/opportunities/[id]/po` | ✅ | List PO docs with fresh 1-hr signed URLs. |
| POST | `/api/opportunities/[id]/po` | ✅ | Upload PO to `PO_busket` (same rules as SoW). |
| DELETE | `/api/opportunities/[id]/po` | ✅ | Soft-delete PO doc. Body: `{ docId }`. |

## Pricing Versions

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| GET | `/api/pricing-versions/[pvId]` | ⚠️ | Fetch version with staffing, schedule, financials. |
| PATCH | `/api/pricing-versions/[pvId]` | ⚠️ | Update financial metrics; setting `isFinal: true` unsets siblings. |
| DELETE | `/api/pricing-versions/[pvId]` | ⚠️ | Delete version. |
| POST | `/api/pricing-versions/[pvId]/duplicate` | ⚠️ | Deep-copy version (staffing + weekly hours + schedule + financials). |
| POST | `/api/pricing-versions/[pvId]/staffing` | ⚠️ | Add staffing resource from rate card (`{ rateCardId }`). |
| PATCH | `/api/pricing-versions/[pvId]/staffing/[srId]` | ⚠️ | Update utilization/billRate/active/billable; upsert weekEntries `[{ weekStartDate, hours }]`. |
| DELETE | `/api/pricing-versions/[pvId]/staffing/[srId]` | ⚠️ | Delete staffing resource. |
| PUT | `/api/pricing-versions/[pvId]/staffing/[srId]/hours` | ⚠️ | Upsert single week entry `{ weekStartDate, hours }`. |

## Approvals

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| GET | `/api/approvals` | ✅ | List approval requests for the signed-in user as approver. `?pending=true` filters to PENDING only. |
| POST | `/api/approvals/[id]/approve` | ✅ | Approve request (must be approver). Sets APPROVED + decidedAt. |
| POST | `/api/approvals/[id]/reject` | ✅ | Reject request (must be approver). Body: `{ reason? }`. |

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
| GET | `/api/users` | ⚠️ | List all users. |
| POST | `/api/users` | ⚠️ | Create user (`name`, `email`, `role` — defaults to `'BD'`). |

## RBAC

Role hierarchy (highest to lowest): `ADMIN` → `PARTNER` → `ED` → `DIRECTOR` → `SEL`.  
Enforced in `lib/db/opportunities.ts` via `resolveOwnerFilter(auth)` — a synchronous function that returns a Prisma `where` fragment based on `token.role`. No managerId traversal. JWT tokens are HMAC-SHA256 signed with `NEXTAUTH_SECRET` — users cannot forge or modify them.
