import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import * as XLSX from 'xlsx'
import { apiError } from '@/lib/errors'

const LOCATION_MAP: Record<string, string> = {
  india: 'INDIA',
  us: 'US',
  usa: 'US',
}

export interface ParsedRateCardRow {
  jobRole: string
  location: string
  domain: string | null
  billRatePerHour: number
  costRatePerHour: number
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req })
  if (!token) return apiError('UNAUTHORIZED')
  if ((token.role as string) !== 'ADMIN') return apiError('ADMIN_ONLY')

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const allowedTypes = new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ])
  if (!allowedTypes.has(file.type) && !file.name.match(/\.(xlsx|xls)$/i))
    return NextResponse.json({ error: 'Only .xlsx / .xls files accepted' }, { status: 415 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: 'buffer' })

  // Find the Rate Card sheet — prefer one whose name includes "rate" or "card"
  const sheetName =
    workbook.SheetNames.find(n => /rate.?card/i.test(n)) ??
    workbook.SheetNames.find(n => /rate/i.test(n)) ??
    workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  // Read everything
  const allRows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: '',
  })

  // Find the header row: col A = "Location", col B contains "position" / "job role"
  let headerRowIdx = -1
  for (let r = 0; r < allRows.length; r++) {
    const a = String(allRows[r][0] ?? '').trim().toLowerCase()
    const b = String(allRows[r][1] ?? '').trim().toLowerCase()
    if (a === 'location' && (b.includes('position') || b.includes('job') || b.includes('role') || b.includes('designation'))) {
      headerRowIdx = r
      break
    }
  }

  if (headerRowIdx < 0) {
    // Return first 20 rows so the problem can be diagnosed
    const preview = allRows.slice(0, 30).map((r, i) => ({
      rowIndex: i,
      excelRow: i + 1,
      A: String(r[0] ?? ''),
      B: String(r[1] ?? ''),
      C: String(r[2] ?? ''),
      D: String(r[3] ?? ''),
      E: String(r[4] ?? ''),
      F: String(r[5] ?? ''),
    }))
    return NextResponse.json(
      { error: 'Could not find header row. Expected col A = "Location", col B = "Position" (or Job Role).', debug: preview },
      { status: 422 }
    )
  }

  // Data rows start immediately after the header
  const dataRows = allRows.slice(headerRowIdx + 1)

  const rows: ParsedRateCardRow[] = []
  const errors: string[] = []
  let lastLocation = ''

  dataRows.forEach((raw, i) => {
    const excelRow = headerRowIdx + 2 + i  // 1-based for error messages

    const locationRaw = String(raw[0] ?? '').trim()
    const position    = String(raw[1] ?? '').trim()
    // Normalize the domain column to the LineOfBusiness enum value so the
    // majority-LoB autofill on opp.primaryLob works whether the uploader wrote
    // "Analytics", "ANALYTICS", "Technology", "Data Science", etc.
    const domainRaw   = String(raw[2] ?? '').trim()
    const domain      = (() => {
      const k = domainRaw.toUpperCase()
      switch (k) {
        case 'ANALYTICS':        return 'ANALYTICS'
        case 'TECH':
        case 'TECHNOLOGY':       return 'TECH'
        case 'MS':
        case 'MANAGED SERVICES': return 'MS'
        case 'DS':
        case 'DATA SCIENCE':     return 'DS'
        case 'DESIGN':           return 'DESIGN'
        case 'AUXO':             return 'AUXO'
        default:                 return domainRaw || null  // keep unknown values verbatim so they're visible
      }
    })()
    // col D (index 3) is unused — billing is col E (4), cost is col F (5)
    const billRate    = parseFloat(String(raw[4] ?? ''))
    const costRate    = parseFloat(String(raw[5] ?? ''))

    // Carry forward location across merged / blank cells
    if (locationRaw) lastLocation = locationRaw

    if (!position) return  // blank row — skip silently

    if (!lastLocation) { errors.push(`Row ${excelRow}: no location for "${position}"`); return }

    const mappedLocation = LOCATION_MAP[lastLocation.toLowerCase()]
    if (!mappedLocation) { errors.push(`Row ${excelRow}: unknown location "${lastLocation}" for "${position}"`); return }

    if (isNaN(billRate) || billRate <= 0) { errors.push(`Row ${excelRow}: invalid billing rate for "${position}"`); return }
    if (isNaN(costRate) || costRate <= 0) { errors.push(`Row ${excelRow}: invalid cost rate for "${position}"`); return }

    rows.push({
      jobRole: position,
      location: mappedLocation,
      domain: domain || null,
      billRatePerHour: billRate,
      costRatePerHour: costRate,
    })
  })

  return NextResponse.json({ rows, errors, total: rows.length })
}
