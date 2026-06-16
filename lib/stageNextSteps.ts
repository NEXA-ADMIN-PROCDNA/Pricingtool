// stageNextSteps.ts — UI hint text mapping each opportunity STAGE to the single
// next action the owner should take ("what now?" nudge). Keep these labels in sync
// with the OpportunityStage enum and the real transition rules in the approval
// routes — this map is display-only and does not enforce anything.
export const STAGE_NEXT_STEPS: Record<string, string> = {
  LEAD:                  'Create a pricing version',
  PRICE_LINKING_PENDING: 'Mark a version as final',
  PRICE_LINKED:          'Send for pricing approval',
  APPROVAL_PENDING:      'Waiting for approver decision',
  SOW_PENDING:           'Upload SOW, PO, or pre-contract agreement',
  SOW_SUBMITTED:         'Submit for SOW / PO / PCA verification',
  SOW_REVIEW_PENDING:    'Waiting for SOW / PO / PCA approval',
  TO_BE_ARCHIVED:        'SOW approved — to be archived in 12 hrs',
}
