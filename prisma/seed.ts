import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  PrismaClient,
  UserRole,
  OpportunityType,
  LineOfBusiness,
  OpportunityStatus,
  OpportunityStage,
  Location,
  JobRole,
  ApprovalStatus,
} from '@prisma/client'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool, { schema: 'procdna_database' })
const prisma = new PrismaClient({ adapter })

// ── helpers ──────────────────────────────────────────────────────
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

function addMonths(date: Date, n: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}

// ── main ─────────────────────────────────────────────────────────
async function main() {
  console.log('🌱  Seeding …')

  // ── 1. USERS ─────────────────────────────────────────────────
  // Create top-level senior users first (no manager), then reports

  const admin = await prisma.user.upsert({
    where: { email: 'admin@firm.com' },
    update: {},
    create: {
      email: 'admin@firm.com',
      name: 'Admin User',
      role: UserRole.ADMIN,
      isActive: true,
    },
  })

  const partner = await prisma.user.upsert({
    where: { email: 'partner@firm.com' },
    update: {},
    create: {
      email: 'partner@firm.com',
      name: 'Priya Sharma',
      role: UserRole.PARTNER,
      isActive: true,
    },
  })

  const ed = await prisma.user.upsert({
    where: { email: 'ed@firm.com' },
    update: {},
    create: {
      email: 'ed@firm.com',
      name: 'Edward Collins',
      role: UserRole.ED,
      managerId: partner.id,
      isActive: true,
    },
  })

  const director1 = await prisma.user.upsert({
    where: { email: 'director1@firm.com' },
    update: {},
    create: {
      email: 'director1@firm.com',
      name: 'Diana Patel',
      role: UserRole.DIRECTOR,
      managerId: ed.id,
      isActive: true,
    },
  })

  const director2 = await prisma.user.upsert({
    where: { email: 'director2@firm.com' },
    update: {},
    create: {
      email: 'director2@firm.com',
      name: 'Daniel Kim',
      role: UserRole.DIRECTOR,
      managerId: ed.id,
      isActive: true,
    },
  })

  const sel1 = await prisma.user.upsert({
    where: { email: 'sel1@firm.com' },
    update: {},
    create: {
      email: 'sel1@firm.com',
      name: 'Sara Lopez',
      role: UserRole.SEL,
      managerId: director1.id,
      isActive: true,
    },
  })

  const sel2 = await prisma.user.upsert({
    where: { email: 'sel2@firm.com' },
    update: {},
    create: {
      email: 'sel2@firm.com',
      name: 'Sam Nguyen',
      role: UserRole.SEL,
      managerId: director2.id,
      isActive: true,
    },
  })

  console.log('  ✓ users')

  // ── 2. RATE CARDS ─────────────────────────────────────────────
  // One active row per (jobRole, location) combo
  const effectiveFrom = new Date('2026-01-01')

  type RateRow = {
    jobRole: JobRole
    location: Location
    costRatePerHour: number
    billRatePerHour: number
  }

  const rateRows: RateRow[] = [
    // INDIA
    { jobRole: JobRole.ANALYST,            location: Location.INDIA, costRatePerHour: 18,  billRatePerHour: 35  },
    { jobRole: JobRole.SENIOR_ANALYST,     location: Location.INDIA, costRatePerHour: 24,  billRatePerHour: 48  },
    { jobRole: JobRole.CONSULTANT,         location: Location.INDIA, costRatePerHour: 32,  billRatePerHour: 65  },
    { jobRole: JobRole.SENIOR_CONSULTANT,  location: Location.INDIA, costRatePerHour: 40,  billRatePerHour: 82  },
    { jobRole: JobRole.MANAGER,            location: Location.INDIA, costRatePerHour: 52,  billRatePerHour: 105 },
    { jobRole: JobRole.SENIOR_MANAGER,     location: Location.INDIA, costRatePerHour: 65,  billRatePerHour: 130 },
    { jobRole: JobRole.DIRECTOR,           location: Location.INDIA, costRatePerHour: 85,  billRatePerHour: 170 },
    { jobRole: JobRole.ASSOCIATE_DIRECTOR, location: Location.INDIA, costRatePerHour: 100, billRatePerHour: 200 },
    { jobRole: JobRole.VICE_PRESIDENT,     location: Location.INDIA, costRatePerHour: 120, billRatePerHour: 240 },
    { jobRole: JobRole.PRINCIPAL,          location: Location.INDIA, costRatePerHour: 145, billRatePerHour: 290 },
    { jobRole: JobRole.PARTNER,            location: Location.INDIA, costRatePerHour: 175, billRatePerHour: 350 },
    // US
    { jobRole: JobRole.ANALYST,            location: Location.US, costRatePerHour: 55,  billRatePerHour: 110 },
    { jobRole: JobRole.SENIOR_ANALYST,     location: Location.US, costRatePerHour: 70,  billRatePerHour: 140 },
    { jobRole: JobRole.CONSULTANT,         location: Location.US, costRatePerHour: 90,  billRatePerHour: 180 },
    { jobRole: JobRole.SENIOR_CONSULTANT,  location: Location.US, costRatePerHour: 110, billRatePerHour: 220 },
    { jobRole: JobRole.MANAGER,            location: Location.US, costRatePerHour: 135, billRatePerHour: 270 },
    { jobRole: JobRole.SENIOR_MANAGER,     location: Location.US, costRatePerHour: 160, billRatePerHour: 320 },
    { jobRole: JobRole.DIRECTOR,           location: Location.US, costRatePerHour: 200, billRatePerHour: 400 },
    { jobRole: JobRole.ASSOCIATE_DIRECTOR, location: Location.US, costRatePerHour: 230, billRatePerHour: 460 },
    { jobRole: JobRole.VICE_PRESIDENT,     location: Location.US, costRatePerHour: 265, billRatePerHour: 530 },
    { jobRole: JobRole.PRINCIPAL,          location: Location.US, costRatePerHour: 310, billRatePerHour: 620 },
    { jobRole: JobRole.PARTNER,            location: Location.US, costRatePerHour: 375, billRatePerHour: 750 },
  ]

  const rateCardMap: Record<string, string> = {} // "ANALYST_INDIA" → id

  for (const row of rateRows) {
    const rc = await prisma.rateCard.upsert({
      where: { jobRole_location_effectiveFrom: { jobRole: row.jobRole, location: row.location, effectiveFrom } },
      update: {},
      create: {
        jobRole: row.jobRole,
        location: row.location,
        costRatePerHour: row.costRatePerHour,
        billRatePerHour: row.billRatePerHour,
        effectiveFrom,
        isActive: true,
        ingestedById: admin.id,
      },
    })
    rateCardMap[`${row.jobRole}_${row.location}`] = rc.id
  }

  console.log('  ✓ rate cards')

  // ── 3. CLIENTS ────────────────────────────────────────────────
  const clientNovartis = await prisma.client.upsert({
    where: { clientId: 'CL-001' },
    update: {},
    create: {
      clientId: 'CL-001',
      name: 'Novartis AG',
      businessUnit: 'Commercial Analytics',
      industry: 'Pharmaceuticals',
      region: 'EMEA',
      isActive: true,
      createdById: admin.id,
    },
  })

  const clientJPM = await prisma.client.upsert({
    where: { clientId: 'CL-002' },
    update: {},
    create: {
      clientId: 'CL-002',
      name: 'JPMorgan Chase',
      businessUnit: 'Risk & Data',
      industry: 'Financial Services',
      region: 'NA',
      isActive: true,
      createdById: admin.id,
    },
  })

  const clientBioGen = await prisma.client.upsert({
    where: { clientId: 'CL-003' },
    update: {},
    create: {
      clientId: 'CL-003',
      name: 'BioGen Inc.',
      businessUnit: 'R&D Operations',
      industry: 'Biotechnology',
      region: 'NA',
      isActive: true,
      createdById: admin.id,
    },
  })

  // POCs
  await prisma.clientPOC.createMany({
    skipDuplicates: true,
    data: [
      { clientId: clientNovartis.id, name: 'Marco Rossi',   email: 'mrossi@novartis.com',  phone: '+41-79-111-2222', jobTitle: 'VP Analytics' },
      { clientId: clientNovartis.id, name: 'Lena Fischer',  email: 'lfischer@novartis.com', jobTitle: 'Procurement Lead' },
      { clientId: clientJPM.id,      name: 'James Howard',  email: 'jhoward@jpmc.com',      phone: '+1-212-555-0101', jobTitle: 'MD Risk Tech' },
      { clientId: clientBioGen.id,   name: 'Rachel Greene', email: 'rgreene@biogen.com',    jobTitle: 'Director, Ops' },
    ],
  })

  console.log('  ✓ clients + POCs')

  // ── 4. OPPORTUNITIES ─────────────────────────────────────────
  const opp1 = await prisma.opportunity.upsert({
    where: { opportunityId: 'BD-001' },
    update: {},
    create: {
      opportunityId: 'BD-001',
      clientId: clientNovartis.id,
      opportunityName: 'Commercial Analytics Transformation',
      opportunityType: OpportunityType.NEW,
      primaryLob: LineOfBusiness.ANALYTICS,
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-10-31'),
      status: OpportunityStatus.OPEN,
      stage: OpportunityStage.PROPOSAL,
      starConnect: true,
      ownerId: sel1.id,
      coOwnerId: director1.id,
      nextSteps: 'Send revised SOW by Friday',
      notes: 'Client is keen on offshore delivery. Margin target ≥ 35%.',
    },
  })

  const opp2 = await prisma.opportunity.upsert({
    where: { opportunityId: 'BD-002' },
    update: {},
    create: {
      opportunityId: 'BD-002',
      clientId: clientJPM.id,
      opportunityName: 'Risk Data Platform — Phase 2',
      opportunityType: OpportunityType.EXISTING,
      primaryLob: LineOfBusiness.TECH,
      startDate: new Date('2026-06-01'),
      endDate: new Date('2027-03-31'),
      status: OpportunityStatus.OPEN,
      stage: OpportunityStage.SOW_SUBMITTED,
      starConnect: false,
      ownerId: sel2.id,
      coOwnerId: director2.id,
      nextSteps: 'Awaiting legal sign-off from JPM',
      notes: 'Extension of Phase 1 engagement. Mixed US/India team.',
    },
  })

  const opp3 = await prisma.opportunity.upsert({
    where: { opportunityId: 'BD-003' },
    update: {},
    create: {
      opportunityId: 'BD-003',
      clientId: clientBioGen.id,
      opportunityName: 'R&D Data Science Support',
      opportunityType: OpportunityType.NEW,
      primaryLob: LineOfBusiness.DS,
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-12-31'),
      status: OpportunityStatus.OPEN,
      stage: OpportunityStage.QUALIFICATION,
      starConnect: false,
      ownerId: sel1.id,
      nextSteps: 'Discovery call scheduled for next week',
    },
  })

  console.log('  ✓ opportunities')

  // ── 5. PRICING VERSIONS ───────────────────────────────────────
  const pv1 = await prisma.pricingVersion.upsert({
    where: { opportunityId_versionNumber: { opportunityId: opp1.id, versionNumber: 1 } },
    update: {},
    create: {
      opportunityId: opp1.id,
      versionNumber: 1,
      isFinal: false,
      label: 'Initial estimate',
      revenueSharePct: 0,
      proposedBillings: 480000,
      totalCost: 290000,
      grossMarginPct: 39.58,
      discountPremiumPct: 0,
      effectiveRatePerHour: 96,
      totalHours: 5000,
      offshorePct: 80,
      businessJustification: 'Strategic new logo — offshore-heavy model to hit margin target.',
    },
  })

  const pv1v2 = await prisma.pricingVersion.upsert({
    where: { opportunityId_versionNumber: { opportunityId: opp1.id, versionNumber: 2 } },
    update: {},
    create: {
      opportunityId: opp1.id,
      versionNumber: 2,
      isFinal: true,
      label: 'Revised after client review',
      revenueSharePct: 0,
      proposedBillings: 510000,
      totalCost: 300000,
      grossMarginPct: 41.18,
      discountPremiumPct: 2,
      effectiveRatePerHour: 102,
      totalHours: 5000,
      offshorePct: 75,
      businessJustification: 'Premium added for accelerated delivery. Margin improves to 41%.',
    },
  })

  const pv2 = await prisma.pricingVersion.upsert({
    where: { opportunityId_versionNumber: { opportunityId: opp2.id, versionNumber: 1 } },
    update: {},
    create: {
      opportunityId: opp2.id,
      versionNumber: 1,
      isFinal: true,
      label: 'SOW submission version',
      proposedBillings: 1200000,
      totalCost: 700000,
      grossMarginPct: 41.67,
      discountPremiumPct: 0,
      effectiveRatePerHour: 150,
      totalHours: 8000,
      offshorePct: 60,
    },
  })

  console.log('  ✓ pricing versions')

  // ── 6. STAFFING RESOURCES + WEEKLY HOURS ─────────────────────
  // opp1 v2: 2 India consultants + 1 US manager
  const sr1 = await prisma.staffingResource.create({
    data: {
      pricingVersionId: pv1v2.id,
      rateCardId: rateCardMap['CONSULTANT_INDIA'],
      resourceDesignation: JobRole.CONSULTANT,
      location: Location.INDIA,
      isBillable: true,
      systemBillRatePerHour: 65,
      effectiveBillRate: 65,
      costRatePerHour: 32,
    },
  })

  const sr2 = await prisma.staffingResource.create({
    data: {
      pricingVersionId: pv1v2.id,
      rateCardId: rateCardMap['SENIOR_CONSULTANT_INDIA'],
      resourceDesignation: JobRole.SENIOR_CONSULTANT,
      location: Location.INDIA,
      isBillable: true,
      systemBillRatePerHour: 82,
      effectiveBillRate: 82,
      costRatePerHour: 40,
    },
  })

  const sr3 = await prisma.staffingResource.create({
    data: {
      pricingVersionId: pv1v2.id,
      rateCardId: rateCardMap['MANAGER_US'],
      resourceDesignation: JobRole.MANAGER,
      location: Location.US,
      isBillable: true,
      systemBillRatePerHour: 270,
      effectiveBillRate: 270,
      costRatePerHour: 135,
    },
  })

  // Seed 4 weeks of hours starting from the opportunity start date
  const weekStart = monday(new Date('2026-05-01'))
  for (let w = 0; w < 4; w++) {
    const ws = addWeeks(weekStart, w)
    await prisma.staffingWeekEntry.createMany({
      skipDuplicates: true,
      data: [
        { staffingResourceId: sr1.id, weekStartDate: ws, hours: 40 },
        { staffingResourceId: sr2.id, weekStartDate: ws, hours: 40 },
        { staffingResourceId: sr3.id, weekStartDate: ws, hours: 20 },
      ],
    })
  }

  // opp2 v1: senior India team + US director
  const sr4 = await prisma.staffingResource.create({
    data: {
      pricingVersionId: pv2.id,
      rateCardId: rateCardMap['SENIOR_MANAGER_INDIA'],
      resourceDesignation: JobRole.SENIOR_MANAGER,
      location: Location.INDIA,
      isBillable: true,
      systemBillRatePerHour: 130,
      effectiveBillRate: 130,
      costRatePerHour: 65,
    },
  })

  const sr5 = await prisma.staffingResource.create({
    data: {
      pricingVersionId: pv2.id,
      rateCardId: rateCardMap['DIRECTOR_US'],
      resourceDesignation: JobRole.DIRECTOR,
      location: Location.US,
      isBillable: true,
      systemBillRatePerHour: 400,
      effectiveBillRate: 400,
      costRatePerHour: 200,
    },
  })

  const weekStart2 = monday(new Date('2026-06-01'))
  for (let w = 0; w < 4; w++) {
    const ws = addWeeks(weekStart2, w)
    await prisma.staffingWeekEntry.createMany({
      skipDuplicates: true,
      data: [
        { staffingResourceId: sr4.id, weekStartDate: ws, hours: 40 },
        { staffingResourceId: sr5.id, weekStartDate: ws, hours: 16 },
      ],
    })
  }

  console.log('  ✓ staffing resources + weekly hours')

  // ── 7. OTHER COSTS ────────────────────────────────────────────
  await prisma.otherCost.createMany({
    data: [
      {
        opportunityId: opp1.id,
        description: 'Travel — client site visits (EMEA)',
        amount: 12000,
        isBillable: true,
        month: new Date('2026-06-01'),
      },
      {
        opportunityId: opp1.id,
        description: 'Software licences — Tableau',
        amount: 3500,
        isBillable: false,
        month: new Date('2026-05-01'),
      },
      {
        opportunityId: opp2.id,
        description: 'Travel — New York kick-off',
        amount: 8000,
        isBillable: true,
        month: new Date('2026-06-01'),
      },
    ],
  })

  console.log('  ✓ other costs')

  // ── 8. SCHEDULE OF PAYMENTS ───────────────────────────────────
  // opp1 v2: 6-month project → 6 monthly rows
  const sopStart = new Date('2026-05-01')
  for (let m = 0; m < 6; m++) {
    const month = addMonths(sopStart, m)
    await prisma.scheduleOfPayment.upsert({
      where: { pricingVersionId_month: { pricingVersionId: pv1v2.id, month } },
      update: {},
      create: {
        pricingVersionId: pv1v2.id,
        month,
        recommendedBillings: 85000,
        recommendedOtherCost: m === 1 ? 2000 : 0,   // licence in month 2
        proposedBillings: 85000,
        proposedOtherCost: m === 1 ? 2000 : 0,
        discountPct: 0,
        premiumPct: m === 0 ? 2 : 0,                 // kick-off premium
      },
    })
  }

  // opp2 v1: 10-month project
  const sopStart2 = new Date('2026-06-01')
  for (let m = 0; m < 10; m++) {
    const month = addMonths(sopStart2, m)
    await prisma.scheduleOfPayment.upsert({
      where: { pricingVersionId_month: { pricingVersionId: pv2.id, month } },
      update: {},
      create: {
        pricingVersionId: pv2.id,
        month,
        recommendedBillings: 120000,
        proposedBillings: 120000,
        discountPct: 0,
        premiumPct: 0,
      },
    })
  }

  console.log('  ✓ schedule of payments')

  // ── 9. FINANCIAL SNAPSHOTS ────────────────────────────────────
  // opp1 v2 total row (month = null)
  await prisma.financialSnapshot.upsert({
    where: { pricingVersionId_month: { pricingVersionId: pv1v2.id, month: new Date('2026-05-01') } },
    update: {},
    create: {
      pricingVersionId: pv1v2.id,
      month: new Date('2026-05-01'),
      revenueFromBilling: 85000,
      revenueFromOtherCost: 0,
      totalRevenue: 85000,
      employeeCost: 49800,
      otherCost: 0,
      grossMargin: 35200,
      grossMarginPct: 41.41,
      discountPremiumPct: 2,
      totalHours: 833,
      offshoreRatio: 75,
      billedRatePerHour: 102,
      effectiveRatePerHour: 102,
      indiaRate: 73.5,
      usRate: 270,
    },
  })

  console.log('  ✓ financial snapshots')

  // ── 10. APPROVAL REQUESTS ─────────────────────────────────────
  await prisma.approvalRequest.create({
    data: {
      opportunityId: opp1.id,
      requestedById: sel1.id,
      approverId: ed.id,
      status: ApprovalStatus.PENDING,
      requestedAt: new Date(),
    },
  })

  await prisma.approvalRequest.create({
    data: {
      opportunityId: opp2.id,
      requestedById: sel2.id,
      approverId: partner.id,
      status: ApprovalStatus.APPROVED,
      requestedAt: new Date('2026-04-20'),
      decidedAt: new Date('2026-04-22'),
    },
  })

  console.log('  ✓ approval requests')

  // ── 11. COMMENTS ─────────────────────────────────────────────
  const comment1 = await prisma.comment.create({
    data: {
      opportunityId: opp1.id,
      authorId: director1.id,
      content: 'We need to tighten the offshore ratio — client may push back on US headcount.',
    },
  })

  await prisma.comment.create({
    data: {
      opportunityId: opp1.id,
      authorId: sel1.id,
      content: 'Agreed. Updated staffing plan in v2 — 75% offshore now.',
      parentId: comment1.id,
    },
  })

  await prisma.comment.create({
    data: {
      opportunityId: opp2.id,
      authorId: partner.id,
      content: 'Good progress — make sure legal has the amended MSA before SOW countersign.',
    },
  })

  console.log('  ✓ comments')

  // ── 12. ACTIVITY LOGS ─────────────────────────────────────────
  await prisma.activityLog.createMany({
    data: [
      {
        opportunityId: opp1.id,
        userId: sel1.id,
        action: 'opportunity.created',
        newValue: { opportunityId: 'BD-001', stage: 'LEAD' },
      },
      {
        opportunityId: opp1.id,
        userId: sel1.id,
        action: 'stage.changed',
        oldValue: { stage: 'LEAD' },
        newValue: { stage: 'PROPOSAL' },
      },
      {
        opportunityId: opp1.id,
        userId: sel1.id,
        action: 'pricing.version.created',
        newValue: { versionNumber: 2, isFinal: true },
      },
      {
        opportunityId: opp1.id,
        userId: sel1.id,
        action: 'approval.requested',
        newValue: { approverId: ed.id, status: 'PENDING' },
      },
      {
        opportunityId: opp2.id,
        userId: sel2.id,
        action: 'opportunity.created',
        newValue: { opportunityId: 'BD-002', stage: 'LEAD' },
      },
      {
        opportunityId: opp2.id,
        userId: partner.id,
        action: 'approval.approved',
        newValue: { status: 'APPROVED' },
      },
      {
        userId: admin.id,
        action: 'ratecard.ingested',
        metadata: { count: rateRows.length, effectiveFrom: effectiveFrom.toISOString() },
      },
    ],
  })

  console.log('  ✓ activity logs')
  console.log('\n✅  Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
