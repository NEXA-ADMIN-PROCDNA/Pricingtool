import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, JobRole, Location } from '@prisma/client'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool, { schema: 'procdna_database' })
const prisma = new PrismaClient({ adapter })

function monday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addWeeks(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n * 7)
  return d
}

async function getTargetPV(opportunityId: string) {
  const opp = await prisma.opportunity.findUnique({ where: { opportunityId } })
  if (!opp) throw new Error(`Opportunity ${opportunityId} not found`)

  let pv = await prisma.pricingVersion.findFirst({
    where: { opportunityId: opp.id, isFinal: true },
    orderBy: { versionNumber: 'desc' },
  })
  if (!pv) {
    pv = await prisma.pricingVersion.findFirst({
      where: { opportunityId: opp.id },
      orderBy: { versionNumber: 'desc' },
    })
  }
  if (!pv) throw new Error(`No pricing version found for ${opportunityId}`)
  return { pv, opp }
}

type ResourceSpec = {
  jobRole: JobRole
  location: Location
  hoursPerWeek: number
}

async function seedStaffing(
  pvId: string,
  weekStart: Date,
  resources: ResourceSpec[],
  rcMap: Record<string, { id: string; bill: number; cost: number }>,
) {
  const existingCount = await prisma.staffingResource.count({ where: { pricingVersionId: pvId } })
  if (existingCount > 0) {
    console.log(`    already has staffing — skipping`)
    return
  }

  const ws = monday(weekStart)

  for (const r of resources) {
    const key = `${r.jobRole}_${r.location}`
    const rc = rcMap[key]

    const sr = await prisma.staffingResource.create({
      data: {
        pricingVersionId: pvId,
        rateCardId: rc?.id ?? null,
        resourceDesignation: r.jobRole,
        location: r.location,
        isBillable: true,
        systemBillRatePerHour: rc?.bill ?? 0,
        effectiveBillRate: rc?.bill ?? 0,
        costRatePerHour: rc?.cost ?? 0,
      },
    })

    const weekEntries = Array.from({ length: 8 }, (_, w) => ({
      staffingResourceId: sr.id,
      weekStartDate: addWeeks(ws, w),
      hours: r.hoursPerWeek,
    }))

    await prisma.staffingWeekEntry.createMany({ data: weekEntries, skipDuplicates: true })
  }
}

async function main() {
  console.log('🌱 Seeding staffing + comments for BD-003 through BD-009...')

  // Build rate card lookup: "ROLE_LOCATION" → { id, bill, cost }
  const ratecards = await prisma.rateCard.findMany({ where: { isActive: true } })
  const rcMap: Record<string, { id: string; bill: number; cost: number }> = {}
  for (const rc of ratecards) {
    rcMap[`${rc.jobRole}_${rc.location}`] = {
      id: rc.id,
      bill: rc.billRatePerHour,
      cost: rc.costRatePerHour,
    }
  }

  // Build user lookup: email → id
  const allUsers = await prisma.user.findMany({ select: { id: true, email: true } })
  const uid: Record<string, string> = {}
  for (const u of allUsers) uid[u.email] = u.id

  const adminId = uid['admin@firm.com']
  const partnerId = uid['partner@firm.com']
  const edId = uid['ed@firm.com']
  const d1Id = uid['director1@firm.com']
  const d2Id = uid['director2@firm.com']
  const sel1Id = uid['sel1@firm.com']
  const sel2Id = uid['sel2@firm.com']

  // ── BD-003 (BioGen R&D — DS, 6000h, 88% offshore) ─────────────
  {
    console.log('  BD-003...')
    const { pv, opp } = await getTargetPV('BD-003')
    await seedStaffing(pv.id, opp.startDate ?? new Date(), [
      { jobRole: JobRole.SENIOR_BUSINESS_ANALYST, location: Location.INDIA, hoursPerWeek: 30 },
      { jobRole: JobRole.BUSINESS_ANALYST,        location: Location.INDIA, hoursPerWeek: 40 },
      { jobRole: JobRole.TECHNOLOGY_ANALYST,      location: Location.INDIA, hoursPerWeek: 40 },
      { jobRole: JobRole.CONSULTANT,              location: Location.INDIA, hoursPerWeek: 20 },
      { jobRole: JobRole.CONSULTANT,              location: Location.US,    hoursPerWeek: 10 },
    ], rcMap)
    const commentCount = await prisma.comment.count({ where: { opportunityId: opp.id } })
    if (commentCount === 0) {
      const c1 = await prisma.comment.create({
        data: {
          opportunityId: opp.id,
          authorId: d1Id,
          content: 'Discovery call went well — BioGen want our MLOps accelerators included in scope. Let\'s reflect that in the hours.',
        },
      })
      await prisma.comment.create({
        data: {
          opportunityId: opp.id,
          authorId: sel1Id,
          content: 'Updated to 6000h total. India-heavy mix maintains margin at ~40%.',
          parentId: c1.id,
        },
      })
      await prisma.comment.create({
        data: {
          opportunityId: opp.id,
          authorId: edId,
          content: 'Good. Keep offshore above 85% — their budget is tight and we\'ve been asked to stay competitive.',
        },
      })
    }
    console.log('    ✓')
  }

  // ── BD-004 (Novo Nordisk — Analytics, 8000h, 85% offshore, WON) ─
  {
    console.log('  BD-004...')
    const { pv, opp } = await getTargetPV('BD-004')
    await seedStaffing(pv.id, opp.startDate ?? new Date(), [
      { jobRole: JobRole.ENGAGEMENT_LEAD,           location: Location.INDIA, hoursPerWeek: 20 },
      { jobRole: JobRole.SENIOR_BUSINESS_ANALYST,   location: Location.INDIA, hoursPerWeek: 40 },
      { jobRole: JobRole.BUSINESS_ANALYST,          location: Location.INDIA, hoursPerWeek: 40 },
      { jobRole: JobRole.TECHNOLOGY_ANALYST,        location: Location.INDIA, hoursPerWeek: 30 },
      { jobRole: JobRole.ASSOCIATE_ENGAGEMENT_LEAD, location: Location.US,    hoursPerWeek: 15 },
    ], rcMap)
    const commentCount = await prisma.comment.count({ where: { opportunityId: opp.id } })
    if (commentCount === 0) {
      await prisma.comment.create({
        data: {
          opportunityId: opp.id,
          authorId: partnerId,
          content: 'Strong win. Make sure the Bangalore EL is briefed on Novo\'s regulatory data policies before kick-off on 3 May.',
        },
      })
      await prisma.comment.create({
        data: {
          opportunityId: opp.id,
          authorId: d1Id,
          content: 'Staffing plan locked. EL sourced from Bangalore office — good domain fit for pharma analytics.',
        },
      })
    }
    console.log('    ✓')
  }

  // ── BD-005 (AstraZeneca — DS, 5636h, 70% offshore, LOST) ───────
  {
    console.log('  BD-005...')
    const { pv, opp } = await getTargetPV('BD-005')
    await seedStaffing(pv.id, opp.startDate ?? new Date(), [
      { jobRole: JobRole.CONSULTANT,                location: Location.INDIA, hoursPerWeek: 35 },
      { jobRole: JobRole.BUSINESS_ANALYST,          location: Location.INDIA, hoursPerWeek: 40 },
      { jobRole: JobRole.SENIOR_TECHNOLOGY_ANALYST, location: Location.INDIA, hoursPerWeek: 30 },
      { jobRole: JobRole.CONSULTANT,                location: Location.US,    hoursPerWeek: 20 },
    ], rcMap)
    const commentCount = await prisma.comment.count({ where: { opportunityId: opp.id } })
    if (commentCount === 0) {
      const c1 = await prisma.comment.create({
        data: {
          opportunityId: opp.id,
          authorId: sel2Id,
          content: 'AstraZeneca pushed back hard on price. Their in-house team quoted ~30% below our floor rate.',
        },
      })
      await prisma.comment.create({
        data: {
          opportunityId: opp.id,
          authorId: d2Id,
          content: 'We can\'t go below 32% margin on DS work. Marking as lost — good learnings for the next AZ bid.',
          parentId: c1.id,
        },
      })
    }
    console.log('    ✓')
  }

  // ── BD-006 (Goldman Sachs — TECH, 12000h, 55% offshore, LEAD) ──
  {
    console.log('  BD-006...')
    const { pv, opp } = await getTargetPV('BD-006')
    await seedStaffing(pv.id, opp.startDate ?? new Date(), [
      { jobRole: JobRole.ENGAGEMENT_LEAD,   location: Location.INDIA, hoursPerWeek: 20 },
      { jobRole: JobRole.SENIOR_CONSULTANT, location: Location.INDIA, hoursPerWeek: 40 },
      { jobRole: JobRole.CONSULTANT,        location: Location.INDIA, hoursPerWeek: 40 },
      { jobRole: JobRole.SENIOR_CONSULTANT, location: Location.US,    hoursPerWeek: 30 },
      { jobRole: JobRole.ENGAGEMENT_LEAD,   location: Location.US,    hoursPerWeek: 15 },
    ], rcMap)
    const commentCount = await prisma.comment.count({ where: { opportunityId: opp.id } })
    if (commentCount === 0) {
      await prisma.comment.create({
        data: {
          opportunityId: opp.id,
          authorId: d2Id,
          content: 'Goldman requires ≥45% onshore for regulatory audit trail. Working with Partner on the staffing model — margin will be tighter than usual.',
        },
      })
      await prisma.comment.create({
        data: {
          opportunityId: opp.id,
          authorId: partnerId,
          content: 'Agreed. This is a marquee FS logo worth the tighter margin. Price at the premium end — capability-based model gives us headroom.',
        },
      })
    }
    console.log('    ✓')
  }

  // ── BD-007 (Pfizer — Analytics, 4000h, 88% offshore, SOW_SUBMITTED)
  {
    console.log('  BD-007...')
    const { pv, opp } = await getTargetPV('BD-007')
    await seedStaffing(pv.id, opp.startDate ?? new Date(), [
      { jobRole: JobRole.SENIOR_BUSINESS_ANALYST,   location: Location.INDIA, hoursPerWeek: 40 },
      { jobRole: JobRole.BUSINESS_ANALYST,          location: Location.INDIA, hoursPerWeek: 40 },
      { jobRole: JobRole.CONSULTANT,                location: Location.INDIA, hoursPerWeek: 30 },
      { jobRole: JobRole.ASSOCIATE_ENGAGEMENT_LEAD, location: Location.US,    hoursPerWeek: 10 },
    ], rcMap)
    const commentCount = await prisma.comment.count({ where: { opportunityId: opp.id } })
    if (commentCount === 0) {
      const c1 = await prisma.comment.create({
        data: {
          opportunityId: opp.id,
          authorId: sel1Id,
          content: 'SOW submitted. Sandra Williams at Pfizer confirmed receipt. Expecting procurement sign-off by end of month.',
        },
      })
      await prisma.comment.create({
        data: {
          opportunityId: opp.id,
          authorId: edId,
          content: 'Hold the 1.5% premium in the final number — Pfizer has never negotiated on rates with us.',
          parentId: c1.id,
        },
      })
    }
    console.log('    ✓')
  }

  // ── BD-008 (Unilever — MS, 8000h, 80-85% offshore, QUALIFICATION)
  {
    console.log('  BD-008...')
    const { pv, opp } = await getTargetPV('BD-008')
    await seedStaffing(pv.id, opp.startDate ?? new Date(), [
      { jobRole: JobRole.ENGAGEMENT_LEAD,         location: Location.INDIA, hoursPerWeek: 20 },
      { jobRole: JobRole.SENIOR_BUSINESS_ANALYST, location: Location.INDIA, hoursPerWeek: 40 },
      { jobRole: JobRole.CONSULTANT,              location: Location.INDIA, hoursPerWeek: 40 },
      { jobRole: JobRole.BUSINESS_ANALYST,        location: Location.INDIA, hoursPerWeek: 30 },
      { jobRole: JobRole.CONSULTANT,              location: Location.US,    hoursPerWeek: 20 },
    ], rcMap)
    const commentCount = await prisma.comment.count({ where: { opportunityId: opp.id } })
    if (commentCount === 0) {
      await prisma.comment.create({
        data: {
          opportunityId: opp.id,
          authorId: d1Id,
          content: 'Unilever RFP is heavily focused on implementation methodology for demand forecasting. Need to strengthen the supply chain section.',
        },
      })
      await prisma.comment.create({
        data: {
          opportunityId: opp.id,
          authorId: adminId,
          content: 'RFP deadline confirmed as end of May. All sections need internal sign-off by 20th.',
        },
      })
    }
    console.log('    ✓')
  }

  // ── BD-009 (JPM APAC — TECH, 4000h, 65% offshore, WON/concluded)
  {
    console.log('  BD-009...')
    const { pv, opp } = await getTargetPV('BD-009')
    await seedStaffing(pv.id, opp.startDate ?? new Date(), [
      { jobRole: JobRole.SENIOR_TECHNOLOGY_ANALYST, location: Location.INDIA, hoursPerWeek: 40 },
      { jobRole: JobRole.CONSULTANT,                location: Location.INDIA, hoursPerWeek: 30 },
      { jobRole: JobRole.SENIOR_TECHNOLOGY_ANALYST, location: Location.US,    hoursPerWeek: 20 },
      { jobRole: JobRole.CONSULTANT,                location: Location.US,    hoursPerWeek: 15 },
    ], rcMap)
    const commentCount = await prisma.comment.count({ where: { opportunityId: opp.id } })
    if (commentCount === 0) {
      await prisma.comment.create({
        data: {
          opportunityId: opp.id,
          authorId: sel2Id,
          content: 'Engagement concluded. Final Credit Risk Dashboard v3 signed off by JPM APAC on 28 Mar. Great outcome.',
        },
      })
      await prisma.comment.create({
        data: {
          opportunityId: opp.id,
          authorId: d2Id,
          content: 'NPS score 9/10. Strong case study — let\'s brief the BD team and reference this for Phase 3 scoping.',
        },
      })
    }
    console.log('    ✓')
  }

  console.log('\n✅ Efforts seed complete.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
