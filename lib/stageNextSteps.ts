import type { OpportunityStage } from '@prisma/client'

export const STAGE_NEXT_STEPS: Record<OpportunityStage, string> = {
  LEAD:                   'Commercials Pending',
  PRICE_LINKING_PENDING:  'Price Linking Pending',
  APPROVAL_PENDING:       'Approval Pending',
  STATUS_CHANGE_PENDING:  'Status Change Pending',
  SOW_PENDING:            'SOW Pending',
  PO_PENDING:             'PO Pending',
  TO_BE_ARCHIVED:         'To Be Archived',
}
