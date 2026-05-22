import type { OpportunityStage } from '@prisma/client'

export const STAGE_NEXT_STEPS: Record<OpportunityStage, string> = {
  LEAD:                   'Commercials Pending',
  PRICE_LINKING_PENDING:  'Price Linking Pending',
  APPROVAL_PENDING:       'Approval Pending — awaiting partner decision',
  STATUS_CHANGE_PENDING:  'Pricing Approved — upload SOW / PO to proceed',
  SOW_PENDING:            'SOW / PO uploaded — submit for verification',
  PO_PENDING:             'PO Pending',
  TO_BE_ARCHIVED:         'To Be Archived',
}
