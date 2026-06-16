# NEXA — Migration Runbook (Vercel + Supabase → ProcDNA AWS)

Target architecture: **EC2** (Next.js via PM2 or Docker) + **RDS Postgres** + **S3** (file storage), in one region, behind Nginx/ALB for HTTPS. Lambda/DynamoDB are **not** used (see notes at the bottom).

---

## ⚠️ CRITICAL — preserve primary keys during the data move

> **Migrate the database with `pg_dump` → `pg_restore` (or logical replication). DO NOT re-run the seed script and DO NOT re-import data in a way that drops the `id` column.**

**Why this matters:** every table's primary key is `id String @id @default(cuid())`. The `cuid()` default only fires when a **new row is inserted** — it does **not** re-run on existing rows. A `pg_dump`/`pg_restore` copies the rows *with their existing `id` values*, so all primary keys (and the foreign keys that reference them) stay identical.

**What breaks if you instead re-seed / re-insert without ids:**
- All `id`s regenerate → the **client detail route (`/clients/<id>`) now keys on the internal `id`**, so any externally bookmarked client URLs would 404. (Internal navigation still works — links are generated live.)
- Foreign keys (e.g. `Opportunity.clientId → Client.id`) must be remapped consistently; a dump preserves this automatically, a naive re-insert does not.

**Rule: copy the data, never recreate it.**

---

## 1. Database (Supabase Postgres → RDS Postgres)
1. `pg_dump` the Supabase DB (schema + data).  → **preserves all ids (see warning above).**
2. `pg_restore` into the new RDS instance (same region/AZ as the EC2 app).
3. Update `DATABASE_URL` / `DIRECT_URL` and `prisma.config.ts` to the RDS connection.
4. **Drop the Supabase pooler** (`:6543` transaction mode) — a long-running server uses Prisma's native pool on `:5432`.
5. You can now run `prisma migrate deploy` normally (it was broken on Vercel).

## 2. File storage (Supabase Storage → S3)
- Recreate the two buckets (`SoW_bucket`, `PO_bucket` — keep the typo) in S3/MinIO and **copy existing files over** (the DB stores `storagePath` per doc, so paths port once files are copied).
- Replace the storage layer in `lib/supabase.ts` + the 5 SoW/PO routes with S3 presigned PUT (upload) / presigned GET (download).

## 3. Auth + public URLs ("links to change")
- **Azure AD App Registration** → update redirect URI to `https://<new-domain>/api/auth/callback/azure-ad` (SSO breaks otherwise).
- `NEXTAUTH_URL` → new domain.
- `MAIL_BASE_URL` → new domain (else approval-email links point at `procdnanexa.vercel.app` — that's the default in `lib/mail.ts`).
- **TLS is mandatory** — `getAuthToken` uses `secureCookie: true` + the `__Secure-…` cookie, which only sets over HTTPS. No cert → silent login failure.
- Microsoft Graph (mail + OneDrive export) uses client-credentials → no redirect change, just keep the `AZURE_*` secrets + outbound internet.

## 4. Secrets & ops
- Move all env vars off Vercel into **AWS SSM / Secrets Manager** (not a committed `.env`).
- EC2 in a VPC: only 443 open, SSH via bastion/VPN, **Postgres not publicly reachable**.
- Set up **your own DB backups** (RDS automated snapshots) — Supabase did this for you.
- Replace Vercel's git-push deploys with a deploy script / GitHub Action that runs `prisma migrate deploy` + restart.
- `vercel.json` (and the `fra1`/`iad1` region setting) is ignored on EC2.

---

## Pending manual SQL (apply in the DB — no `prisma migrate` shortcut)
These schema changes are applied by hand (run in Supabase now, or RDS post-migration), then `prisma generate` + redeploy:

```sql
-- Client IDs are admin-assigned (e.g. 1004VL3002), nullable until assigned.
ALTER TABLE procdna_database.clients ALTER COLUMN "clientId" DROP NOT NULL;

-- Utilization stores decimals (50.5%, not 50).
ALTER TABLE procdna_database.staffing_resources ALTER COLUMN "utilization" TYPE numeric(6,2);

-- Full Time Equivalent per pricing version = total hours ÷ (8 × working days).
ALTER TABLE procdna_database.pricing_versions ADD COLUMN "fte" numeric(10,2);
```

After any schema SQL: **run `prisma generate`** so the client types match the DB, then deploy.

### BU rename — physical DB + code identifiers (paired change)
The **user-facing labels** for "Line of Business / Domain" are already renamed to **"BU"** (and the client's field to **"Client BU"**). The internal code identifiers + DB columns/enum still use the old names. To finish the "in the DB too" rename, run this SQL **in the same deploy window** as the matching `schema.prisma` + code-identifier changes (it can't be half-applied — the moment a column is renamed, old-named queries break until redeploy):

```sql
ALTER TYPE  procdna_database."LineOfBusiness" RENAME TO "BU";
ALTER TABLE procdna_database.opportunities      RENAME COLUMN "primaryLob"     TO "primaryBu";
ALTER TABLE procdna_database.rate_cards         RENAME COLUMN "domain"         TO "bu";
ALTER TABLE procdna_database.staffing_resources RENAME COLUMN "domain"         TO "bu";
ALTER TABLE procdna_database.other_costs        RENAME COLUMN "lineOfBusiness" TO "bu";
```
Matching code changes (then `prisma generate` + redeploy, all together): enum `LineOfBusiness → BU`; fields `primaryLob → primaryBu`, `domain → bu` (RateCard & StaffingResource), `lineOfBusiness → bu` (OtherCost); helper/map renames (`normalizeLob`, `LOB_LABELS`/`DOMAIN_LABELS`, `computeMajorityLob`); and the API request/response JSON keys + the frontend send/read of those keys. ~34 files. The enum **values** (TECH, ANALYTICS, MS, DS, DESIGN, AUXO) do **not** change.

---

## Order of operations (minimize breakage)
1. Provision EC2 + RDS + S3 + TLS + domain.
2. Build the S3 storage adapter; copy files.
3. `pg_dump` → `pg_restore` (**ids preserved**); point Prisma at RDS.
4. Set env vars; **update Azure redirect URI + NEXTAUTH_URL + MAIL_BASE_URL**.
5. Deploy; smoke-test: SSO login, an upload, an approval-email link, the export.
6. Cut DNS over; decommission Vercel/Supabase last.

---

## Why not Lambda / DynamoDB
- **Lambda** = serverless functions (what Vercel already ran). Moving to EC2 is leaving that model on purpose; Lambda would reintroduce connection-pooling, cold starts, and timeout/response-size limits.
- **DynamoDB** = NoSQL key-value, no joins. NEXA is deeply relational (Opportunity → PricingVersion → Staffing → WeekEntry, multi-table includes, groupBy). Prisma doesn't support it. Stay on **RDS Postgres** — same engine, same Prisma, just a connection-string swap.
