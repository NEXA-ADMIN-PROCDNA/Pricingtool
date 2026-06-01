import * as XLSX from 'xlsx'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const rows = [
  // ── DASHBOARD ──────────────────────────────────────────────────────────────
  ['Dashboard', 'Pipeline revenue total card', 'Not tested', 'Show breakdown by stage/LOB; clickable to filter'],
  ['Dashboard', 'Opportunities table — list all opps (RBAC filtered)', 'Not tested', 'Pagination for large datasets'],
  ['Dashboard', 'Search bar — filter opps by name/client', 'Not tested', 'Add filter by stage, LOB, date range'],
  ['Dashboard', 'Stage badge colours per row', 'Not tested', 'None'],
  ['Dashboard', 'Export to OneDrive (Admin only)', 'Not tested', 'Progress indicator during sync; last synced timestamp'],
  ['Dashboard', 'Download Excel locally (Admin only)', 'Not tested', 'None'],
  ['Dashboard', 'Navigate to opportunity detail on row click', 'Not tested', 'None'],

  // ── CLIENTS ────────────────────────────────────────────────────────────────
  ['Clients List', 'List all clients with metadata', 'Not tested', 'Search/filter by name, industry, region'],
  ['Clients List', 'Add new client — request flow (non-admin)', 'Not tested', 'Show pending request status after submission'],
  ['Clients List', 'Admin requests panel — approve client request', 'Not tested', 'Email notification to requester on approval'],
  ['Clients List', 'Admin requests panel — reject client request', 'Not tested', 'Email notification to requester on rejection'],
  ['Client Detail', 'View client metadata (BU, industry, region)', 'Not tested', 'Edit client details'],
  ['Client Detail', 'List client POCs', 'Not tested', 'Edit POC details inline'],
  ['Client Detail', 'Delete POC', 'Not tested', 'Soft delete instead of hard delete'],
  ['Client Detail', 'List opportunities linked to client', 'Not tested', 'None'],

  // ── NEW OPPORTUNITY ────────────────────────────────────────────────────────
  ['New Opportunity', 'Client selection — searchable dropdown', 'Not tested', 'Show client metadata on hover'],
  ['New Opportunity', 'Opportunity name, type (New/Existing), LOB', 'Not tested', 'None'],
  ['New Opportunity', 'Business unit, start/end dates', 'Not tested', 'Date picker instead of text input'],
  ['New Opportunity', 'Notes, star connect toggle', 'Not tested', 'None'],
  ['New Opportunity', 'Estimated revenue, probability', 'Not tested', 'None'],
  ['New Opportunity', 'Add existing POC from client', 'Not tested', 'None'],
  ['New Opportunity', 'Add new POC inline (name, email, phone)', 'Not tested', 'Phone validation feedback clearer'],
  ['New Opportunity', 'Form validation — required fields, date order', 'Not tested', 'None'],
  ['New Opportunity', 'Toast error on API failure', 'Not tested', 'None'],
  ['New Opportunity', 'Redirect to opportunity detail on success', 'Not tested', 'None'],

  // ── OPPORTUNITY DETAIL — OVERVIEW ─────────────────────────────────────────
  ['Opportunity Detail — Overview', 'Display all opportunity metadata', 'Not tested', 'Inline edit for key fields'],
  ['Opportunity Detail — Overview', 'Stage badge with colour', 'Not tested', 'Stage history timeline'],
  ['Opportunity Detail — Overview', 'Client name, owner, dates', 'Not tested', 'None'],

  // ── OPPORTUNITY DETAIL — PRICING TAB ──────────────────────────────────────
  ['Opportunity Detail — Pricing', 'Create new pricing version', 'Not tested', 'None'],
  ['Opportunity Detail — Pricing', 'Duplicate pricing version (deep copy)', 'Not tested', 'None'],
  ['Opportunity Detail — Pricing', 'Delete pricing version', 'Not tested', 'Confirm modal before delete'],
  ['Opportunity Detail — Pricing', 'Mark version as final (unsets siblings)', 'Not tested', 'None'],
  ['Opportunity Detail — Pricing', 'Add staffing resource from rate card', 'Not tested', 'Search/filter rate card dropdown'],
  ['Opportunity Detail — Pricing', 'Remove staffing resource', 'Not tested', 'None'],
  ['Opportunity Detail — Pricing', 'Toggle resource billable / active', 'Not tested', 'None'],
  ['Opportunity Detail — Pricing', 'Edit utilization, effective bill rate', 'Not tested', 'None'],
  ['Opportunity Detail — Pricing', 'Enter weekly hours per resource', 'Not tested', 'Bulk hour entry; copy week'],
  ['Opportunity Detail — Pricing', 'Add other cost (description, amount, markup)', 'Not tested', 'None'],
  ['Opportunity Detail — Pricing', 'Toggle other cost billable, edit markup', 'Not tested', 'None'],
  ['Opportunity Detail — Pricing', 'Remove other cost', 'Not tested', 'None'],
  ['Opportunity Detail — Pricing', 'Financial metrics — revenue, margin, hours, offshore %', 'Not tested', 'Chart/visual breakdown'],
  ['Opportunity Detail — Pricing', 'Schedule of payments tab', 'Not tested', 'Manual entry vs auto-distribute toggle'],
  ['Opportunity Detail — Pricing', 'Submit for pricing approval (BJ, approver, CC)', 'Not tested', 'None'],
  ['Opportunity Detail — Pricing', 'Approval pending lock — block re-submission', 'Not tested', 'None'],
  ['Opportunity Detail — Pricing', 'Version lock after approval pending', 'Not tested', 'None'],

  // ── OPPORTUNITY DETAIL — SOW/PO TAB ───────────────────────────────────────
  ['Opportunity Detail — SOW/PO', 'Upload SOW document (direct to Supabase, 49 MB limit)', 'Not tested', 'Upload progress bar'],
  ['Opportunity Detail — SOW/PO', 'Download SOW document (signed URL)', 'Not tested', 'None'],
  ['Opportunity Detail — SOW/PO', 'Delete (soft) SOW document', 'Not tested', 'None'],
  ['Opportunity Detail — SOW/PO', 'Upload PO document (direct to Supabase, 49 MB limit)', 'Not tested', 'Upload progress bar'],
  ['Opportunity Detail — SOW/PO', 'Download PO document (signed URL)', 'Not tested', 'None'],
  ['Opportunity Detail — SOW/PO', 'Delete (soft) PO document', 'Not tested', 'None'],
  ['Opportunity Detail — SOW/PO', 'Client-side file type + size validation (instant)', 'Not tested', 'None'],
  ['Opportunity Detail — SOW/PO', 'Pre-contract agreement checkbox', 'Not tested', 'None'],
  ['Opportunity Detail — SOW/PO', 'Submit for SOW verification (select approver)', 'Not tested', 'None'],
  ['Opportunity Detail — SOW/PO', 'Verification status badge (Pending / Approved / Rejected)', 'Not tested', 'None'],
  ['Opportunity Detail — SOW/PO', 'Re-submit after rejection', 'Not tested', 'None'],

  // ── OPPORTUNITY DETAIL — COMMENTS ─────────────────────────────────────────
  ['Opportunity Detail — Comments', 'View all comments (threaded)', 'Not tested', 'Rich text / markdown support'],
  ['Opportunity Detail — Comments', 'Add top-level comment', 'Not tested', 'None'],
  ['Opportunity Detail — Comments', 'Reply to comment (threaded)', 'Not tested', 'None'],

  // ── APPROVALS INBOX ────────────────────────────────────────────────────────
  ['Approvals Inbox', 'List all approvals (admin sees all, others see own)', 'Not tested', 'None'],
  ['Approvals Inbox', 'Filter to pending only', 'Not tested', 'Filter by type (Pricing / SOW)'],
  ['Approvals Inbox', 'View pricing metrics inline (revenue, margin, hours)', 'Not tested', 'None'],
  ['Approvals Inbox', 'View SOW/PO documents inline with signed URLs', 'Not tested', 'None'],
  ['Approvals Inbox', 'Approve request (in-app)', 'Not tested', 'None'],
  ['Approvals Inbox', 'Reject request with reason (in-app)', 'Not tested', 'None'],
  ['Approvals Inbox', 'Approve via email link (token-based)', 'Not tested', 'Token expiry handling UI'],
  ['Approvals Inbox', 'Reject via email link (token-based)', 'Not tested', 'Token expiry handling UI'],
  ['Approvals Inbox', 'Email notification — requester on decision', 'Not tested', 'None'],

  // ── EMAIL NOTIFICATIONS ────────────────────────────────────────────────────
  ['Email Notifications', 'Pricing approval request email to approver (with BJ, metrics)', 'Not tested', 'None'],
  ['Email Notifications', 'SOW verification request email to approver', 'Not tested', 'None'],
  ['Email Notifications', 'CC email on approval request', 'Not tested', 'None'],
  ['Email Notifications', 'Requester confirmation email on submission', 'Not tested', 'None'],
  ['Email Notifications', 'Approval approved email to requester', 'Not tested', 'None'],
  ['Email Notifications', 'Approval rejected email with reason', 'Not tested', 'None'],
  ['Email Notifications', 'Differentiated subject lines (Pricing Approval vs SOW Verification)', 'Not tested', 'None'],

  // ── ADMIN — RATE CARDS ─────────────────────────────────────────────────────
  ['Admin — Rate Cards', 'View current active rate cards table', 'Not tested', 'Edit rate inline'],
  ['Admin — Rate Cards', 'Upload rate card Excel (.xlsx / .xls)', 'Not tested', 'None'],
  ['Admin — Rate Cards', 'Preview parsed rows before import', 'Not tested', 'Highlight rows that will update vs create'],
  ['Admin — Rate Cards', 'Row-level error reporting on parse', 'Not tested', 'None'],
  ['Admin — Rate Cards', 'Confirm import — upsert (update existing, create new)', 'Not tested', 'None'],
  ['Admin — Rate Cards', 'Inactivate old rate cards not in upload', 'Not tested', 'Currently not implemented — manual cleanup needed'],

  // ── AUTH / RBAC ────────────────────────────────────────────────────────────
  ['Auth / RBAC', 'Azure AD SSO login', 'Not tested', 'None'],
  ['Auth / RBAC', 'ADMIN sees all opportunities', 'Not tested', 'None'],
  ['Auth / RBAC', 'PARTNER sees all opportunities', 'Not tested', 'None'],
  ['Auth / RBAC', 'DIRECTOR sees own + SEL opportunities', 'Not tested', 'None'],
  ['Auth / RBAC', 'SEL sees own opportunities only', 'Not tested', 'None'],
  ['Auth / RBAC', 'Admin-only routes blocked for non-admins', 'Not tested', 'None'],
  ['Auth / RBAC', 'Unauthenticated users redirected to login', 'Not tested', 'None'],

  // ── ERROR HANDLING ─────────────────────────────────────────────────────────
  ['Error Handling', 'Toast error popups on API failures (all screens)', 'Not tested', 'None'],
  ['Error Handling', 'Standardised APP_ERRORS codes across all 29 API routes', 'Not tested', 'None'],
  ['Error Handling', 'Inline form error banners', 'Not tested', 'None'],
]

// Build worksheet
const header = ['Screen', 'Feature', 'Testing Done?', 'Improvements Needed']
const data   = [header, ...rows]

const ws = XLSX.utils.aoa_to_sheet(data)

// Column widths
ws['!cols'] = [
  { wch: 34 },
  { wch: 62 },
  { wch: 16 },
  { wch: 52 },
]

// Freeze top row
ws['!freeze'] = { xSplit: 0, ySplit: 1 }

// Style header row bold (basic xlsx approach)
const range = XLSX.utils.decode_range(ws['!ref'])
for (let C = range.s.c; C <= range.e.c; C++) {
  const addr = XLSX.utils.encode_cell({ r: 0, c: C })
  if (!ws[addr]) continue
  ws[addr].s = { font: { bold: true }, fill: { fgColor: { rgb: '0A1F44' } }, font: { bold: true, color: { rgb: 'FFFFFF' } } }
}


const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'Feature Tracker')

const outPath = path.join(process.cwd(), 'feature-tracker.xlsx')
XLSX.writeFile(wb, outPath)
console.log(`Written to ${outPath}`)
