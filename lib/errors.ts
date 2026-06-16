// ─────────────────────────────────────────────────────────────────────────────
// errors.ts — the single source of truth for API error responses.
//
// Big picture: instead of scattering ad-hoc status codes + messages across 30+
// routes, every route returns apiError('SOME_CODE'). This central map keeps HTTP
// status codes consistent and gives the UI human-readable, user-safe copy. Codes
// are grouped by domain (Auth / Opportunities / Pricing / Approvals / … ).
//
// NOTE: the optional `detail` arg is for debugging — avoid leaking internal
// exception text to clients in production. (See audit S14.)
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'

export const APP_ERRORS = {
  // Auth
  UNAUTHORIZED:           { status: 401, message: 'You need to be signed in to do this.' },
  FORBIDDEN:              { status: 403, message: "Your role doesn't have access to this action." },
  ADMIN_ONLY:             { status: 403, message: 'Only admins can perform this action.' },
  SESSION_EXPIRED:        { status: 401, message: 'Your session has expired — please sign in again.' },

  // Opportunities
  OPP_NOT_FOUND:          { status: 404, message: 'This opportunity no longer exists or was removed.' },
  OPP_CREATE_FAILED:      { status: 500, message: 'Could not create the opportunity. Try again.' },
  OPP_UPDATE_FAILED:      { status: 500, message: 'Failed to save changes. Try again.' },
  OPP_ID_CONFLICT:        { status: 409, message: 'An opportunity with this ID already exists.' },
  OPP_EDIT_FORBIDDEN:     { status: 403, message: 'Only the owner or an admin can edit this opportunity.' },
  OPP_DATE_INVALID:       { status: 400, message: 'End date must be on or after the start date.' },
  OPP_DATE_LOCKED:        { status: 409, message: 'Dates can’t be changed while an approval is in progress — withdraw the pending request first.' },

  // Pricing
  PV_NOT_FOUND:           { status: 404, message: 'Pricing version not found.' },
  PV_CREATE_FAILED:       { status: 500, message: 'Could not create a new pricing version.' },
  PV_DUPLICATE_FAILED:    { status: 500, message: 'Failed to duplicate the pricing version.' },
  PV_DELETE_FAILED:       { status: 500, message: 'Could not delete this version.' },
  PV_FINAL_CONFLICT:      { status: 409, message: 'Another version is already marked as final.' },
  PRICING_LOCKED:         { status: 409, message: 'Pricing is locked — an approval is in progress or the pricing and SOW have both been approved. The final version can no longer be changed.' },

  // Staffing
  RATE_CARD_NOT_FOUND:    { status: 404, message: 'Rate card entry not found — it may have been removed.' },
  STAFFING_SAVE_FAILED:   { status: 500, message: 'Could not save staffing changes.' },
  HOURS_SAVE_FAILED:      { status: 500, message: 'Failed to update hours for this week.' },

  // Approvals
  APPROVAL_PENDING:       { status: 409, message: 'An approval request is already pending for this opportunity.' },
  APPROVAL_NOT_FOUND:     { status: 404, message: 'Approval request not found.' },
  APPROVAL_SEND_FAILED:   { status: 500, message: 'Could not send the approval request.' },
  APPROVAL_TOKEN_EXPIRED: { status: 410, message: 'This approval link has expired. Ask the requester to resend.' },
  APPROVAL_TOKEN_USED:    { status: 409, message: 'This link has already been used.' },
  APPROVAL_WRONG_USER:    { status: 403, message: 'This approval request is not assigned to you.' },
  BJ_REQUIRED:            { status: 400, message: 'A business justification is required for pricing approvals.' },

  // SOW / PO
  DOC_TOO_LARGE:          { status: 413, message: 'File exceeds the 49 MB limit.' },
  DOC_WRONG_TYPE:         { status: 415, message: 'Only PDF, Word, Excel, PNG, and JPEG files are allowed.' },
  DOC_UPLOAD_FAILED:      { status: 500, message: 'Failed to upload the document. Try again.' },
  DOC_NOT_FOUND:          { status: 404, message: 'Document not found — it may have already been deleted.' },

  // Clients
  CLIENT_EXISTS:          { status: 409, message: 'A client with this name already exists.' },
  CLIENT_REQUEST_FAILED:  { status: 500, message: 'Could not submit the client request.' },
  CLIENT_NOT_FOUND:       { status: 404, message: 'Client not found — it may have been removed.' },
  CLIENT_UPDATE_FAILED:   { status: 500, message: 'Could not save changes to this client.' },
  CLIENT_DELETE_FAILED:   { status: 500, message: 'Could not delete this client.' },
  CLIENT_HAS_OPPS:        { status: 409, message: 'This client has opportunities — reassign or remove them before deleting.' },
  CLIENT_ID_TAKEN:        { status: 409, message: 'That Client ID is already assigned to another client.' },
  POC_DELETE_FAILED:      { status: 500, message: 'Failed to remove this contact.' },
  POC_CREATE_FAILED:      { status: 500, message: 'Could not add this contact. Try again.' },
  POC_NAME_REQUIRED:      { status: 400, message: 'Contact name is required.' },

  // Export
  EXPORT_LOCKED:          { status: 423, message: 'The Excel file is open in OneDrive — close it and retry, or download a local copy.' },
  EXPORT_PERMISSION:      { status: 403, message: 'Permission denied — Files.ReadWrite.All may not be consented for this app.' },
  EXPORT_FAILED:          { status: 500, message: 'Failed to generate the export file.' },
  ONEDRIVE_UPLOAD_FAILED: { status: 500, message: 'File generated but upload to OneDrive failed.' },

  // Email
  MAIL_FAILED:            { status: 500, message: 'Action saved, but the notification email could not be sent.' },
} as const

export type ErrorCode = keyof typeof APP_ERRORS

export function apiError(code: ErrorCode, detail?: string) {
  const e = APP_ERRORS[code]
  return NextResponse.json(
    { code, error: e.message, ...(detail ? { detail } : {}) },
    { status: e.status }
  )
}
