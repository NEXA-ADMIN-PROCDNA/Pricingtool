-- Stage enum refactor
-- Adds: PRICE_LINKED, SOW_SUBMITTED, SOW_REVIEW_PENDING
-- Removes: STATUS_CHANGE_PENDING, PO_PENDING
-- Repurposes: SOW_PENDING (was "verification submitted", now "pricing approved, upload docs")

-- Step 1: Add new enum values
ALTER TYPE "OpportunityStage" ADD VALUE IF NOT EXISTS 'PRICE_LINKED';
ALTER TYPE "OpportunityStage" ADD VALUE IF NOT EXISTS 'SOW_SUBMITTED';
ALTER TYPE "OpportunityStage" ADD VALUE IF NOT EXISTS 'SOW_REVIEW_PENDING';

-- Step 2: Migrate existing data (order matters — remap SOW_PENDING first before we repurpose it)
UPDATE opportunities SET stage = 'SOW_REVIEW_PENDING' WHERE stage = 'SOW_PENDING';
UPDATE opportunities SET stage = 'TO_BE_ARCHIVED'     WHERE stage = 'PO_PENDING';
UPDATE opportunities SET stage = 'SOW_PENDING'        WHERE stage = 'STATUS_CHANGE_PENDING';

-- Step 3: Recreate enum without the retired values
--   PostgreSQL does not support DROP VALUE, so we create a new type, migrate, drop old, rename.
ALTER TABLE opportunities ALTER COLUMN stage DROP DEFAULT;

CREATE TYPE "OpportunityStage_v2" AS ENUM (
  'LEAD',
  'PRICE_LINKING_PENDING',
  'PRICE_LINKED',
  'APPROVAL_PENDING',
  'SOW_PENDING',
  'SOW_SUBMITTED',
  'SOW_REVIEW_PENDING',
  'TO_BE_ARCHIVED'
);

ALTER TABLE opportunities
  ALTER COLUMN stage TYPE "OpportunityStage_v2"
  USING stage::text::"OpportunityStage_v2";

DROP TYPE "OpportunityStage";
ALTER TYPE "OpportunityStage_v2" RENAME TO "OpportunityStage";

ALTER TABLE opportunities
  ALTER COLUMN stage SET DEFAULT 'LEAD'::"OpportunityStage";
