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
import { ClientSecretCredential } from '@azure/identity'
import { Client as GraphClient } from '@microsoft/microsoft-graph-client'
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js'

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
    // ── INDIA ────────────────────────────────────────────────────
    { jobRole: JobRole.BUSINESS_ANALYST_TRAINEE,   location: Location.INDIA, costRatePerHour: 22,  billRatePerHour: 38  },
    { jobRole: JobRole.BUSINESS_ANALYST,           location: Location.INDIA, costRatePerHour: 36,  billRatePerHour: 53  },
    { jobRole: JobRole.SENIOR_BUSINESS_ANALYST,    location: Location.INDIA, costRatePerHour: 62,  billRatePerHour: 158 },
    { jobRole: JobRole.TECHNOLOGY_ANALYST_TRAINEE, location: Location.INDIA, costRatePerHour: 25,  billRatePerHour: 42  },
    { jobRole: JobRole.TECHNOLOGY_ANALYST,         location: Location.INDIA, costRatePerHour: 32,  billRatePerHour: 48  },
    { jobRole: JobRole.SENIOR_TECHNOLOGY_ANALYST,  location: Location.INDIA, costRatePerHour: 55,  billRatePerHour: 140 },
    { jobRole: JobRole.CONSULTANT,                 location: Location.INDIA, costRatePerHour: 75,  billRatePerHour: 165 },
    { jobRole: JobRole.SENIOR_CONSULTANT,          location: Location.INDIA, costRatePerHour: 95,  billRatePerHour: 200 },
    { jobRole: JobRole.ASSOCIATE_ENGAGEMENT_LEAD,  location: Location.INDIA, costRatePerHour: 120, billRatePerHour: 240 },
    { jobRole: JobRole.ENGAGEMENT_LEAD,            location: Location.INDIA, costRatePerHour: 145, billRatePerHour: 290 },
    { jobRole: JobRole.ENGAGEMENT_DIRECTOR,        location: Location.INDIA, costRatePerHour: 170, billRatePerHour: 340 },
    { jobRole: JobRole.PARTNER,                    location: Location.INDIA, costRatePerHour: 200, billRatePerHour: 400 },
    // ── US ───────────────────────────────────────────────────────
    { jobRole: JobRole.BUSINESS_ANALYST_TRAINEE,   location: Location.US, costRatePerHour: 65,  billRatePerHour: 110 },
    { jobRole: JobRole.BUSINESS_ANALYST,           location: Location.US, costRatePerHour: 85,  billRatePerHour: 140 },
    { jobRole: JobRole.SENIOR_BUSINESS_ANALYST,    location: Location.US, costRatePerHour: 110, billRatePerHour: 195 },
    { jobRole: JobRole.TECHNOLOGY_ANALYST_TRAINEE, location: Location.US, costRatePerHour: 60,  billRatePerHour: 100 },
    { jobRole: JobRole.TECHNOLOGY_ANALYST,         location: Location.US, costRatePerHour: 80,  billRatePerHour: 130 },
    { jobRole: JobRole.SENIOR_TECHNOLOGY_ANALYST,  location: Location.US, costRatePerHour: 105, billRatePerHour: 180 },
    { jobRole: JobRole.CONSULTANT,                 location: Location.US, costRatePerHour: 140, billRatePerHour: 240 },
    { jobRole: JobRole.SENIOR_CONSULTANT,          location: Location.US, costRatePerHour: 170, billRatePerHour: 290 },
    { jobRole: JobRole.ASSOCIATE_ENGAGEMENT_LEAD,  location: Location.US, costRatePerHour: 160, billRatePerHour: 253 },
    { jobRole: JobRole.ENGAGEMENT_LEAD,            location: Location.US, costRatePerHour: 195, billRatePerHour: 310 },
    { jobRole: JobRole.ENGAGEMENT_DIRECTOR,        location: Location.US, costRatePerHour: 230, billRatePerHour: 370 },
    { jobRole: JobRole.PARTNER,                    location: Location.US, costRatePerHour: 280, billRatePerHour: 450 },
  ]

  const rateCardMap: Record<string, string | null> = {} // "ANALYST_INDIA" → id

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

  const clientNovoNordisk = await prisma.client.upsert({
    where: { clientId: 'CL-004' },
    update: {},
    create: {
      clientId: 'CL-004',
      name: 'Novo Nordisk',
      businessUnit: 'Integrated Care',
      industry: 'Pharmaceuticals',
      region: 'EMEA',
      isActive: true,
      createdById: admin.id,
    },
  })

  const clientAstraZeneca = await prisma.client.upsert({
    where: { clientId: 'CL-005' },
    update: {},
    create: {
      clientId: 'CL-005',
      name: 'AstraZeneca',
      businessUnit: 'Global Oncology',
      industry: 'Pharmaceuticals',
      region: 'EMEA',
      isActive: true,
      createdById: admin.id,
    },
  })

  const clientGoldmanSachs = await prisma.client.upsert({
    where: { clientId: 'CL-006' },
    update: {},
    create: {
      clientId: 'CL-006',
      name: 'Goldman Sachs',
      businessUnit: 'Global Markets Technology',
      industry: 'Financial Services',
      region: 'NA',
      isActive: true,
      createdById: admin.id,
    },
  })

  const clientPfizer = await prisma.client.upsert({
    where: { clientId: 'CL-007' },
    update: {},
    create: {
      clientId: 'CL-007',
      name: 'Pfizer Inc.',
      businessUnit: 'Commercial Operations',
      industry: 'Pharmaceuticals',
      region: 'NA',
      isActive: true,
      createdById: admin.id,
    },
  })

  const clientUnilever = await prisma.client.upsert({
    where: { clientId: 'CL-008' },
    update: {},
    create: {
      clientId: 'CL-008',
      name: 'Unilever PLC',
      businessUnit: 'Supply Chain Analytics',
      industry: 'Consumer Goods',
      region: 'EMEA',
      isActive: true,
      createdById: admin.id,
    },
  })

  // POCs
  await prisma.clientPOC.createMany({
    skipDuplicates: true,
    data: [
      { clientId: clientNovartis.id,     name: 'Marco Rossi',      email: 'mrossi@novartis.com',      phone: '+41-79-111-2222', jobTitle: 'VP Analytics' },
      { clientId: clientNovartis.id,     name: 'Lena Fischer',     email: 'lfischer@novartis.com',     jobTitle: 'Procurement Lead' },
      { clientId: clientJPM.id,          name: 'James Howard',     email: 'jhoward@jpmc.com',          phone: '+1-212-555-0101', jobTitle: 'MD Risk Tech' },
      { clientId: clientBioGen.id,       name: 'Rachel Greene',    email: 'rgreene@biogen.com',        jobTitle: 'Director, Ops' },
      { clientId: clientNovoNordisk.id,  name: 'Anders Larsen',    email: 'alarsen@novonordisk.com',   phone: '+45-30-111-4444', jobTitle: 'Head of Data Science' },
      { clientId: clientAstraZeneca.id,  name: 'Claire Dubois',    email: 'cdubois@astrazeneca.com',   phone: '+44-20-555-7890', jobTitle: 'VP Digital Transformation' },
      { clientId: clientGoldmanSachs.id, name: 'Michael Chen',     email: 'mchen@gs.com',              phone: '+1-212-902-1000', jobTitle: 'Managing Director, Tech' },
      { clientId: clientPfizer.id,       name: 'Sandra Williams',  email: 'swilliams@pfizer.com',      jobTitle: 'Sr Director, Commercial Analytics' },
      { clientId: clientUnilever.id,     name: 'Raj Krishnamurthy',email: 'rkrishnamurthy@unilever.com',jobTitle: 'Global Supply Chain Director' },
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
      stage: OpportunityStage.APPROVAL_PENDING,
      starConnect: true,
      ownerId: sel1.id,
      coOwnerId: director1.id,
      estimatedRevenue: 520000,
      probability: 75,
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
      stage: OpportunityStage.STATUS_CHANGE_PENDING,
      starConnect: false,
      ownerId: sel2.id,
      coOwnerId: director2.id,
      estimatedRevenue: 1250000,
      probability: 85,
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
      stage: OpportunityStage.PRICE_LINKING_PENDING,
      starConnect: false,
      ownerId: sel1.id,
      estimatedRevenue: 300000,
      probability: 40,
      nextSteps: 'Discovery call scheduled for next week',
    },
  })

  const opp4 = await prisma.opportunity.upsert({
    where: { opportunityId: 'BD-004' },
    update: {},
    create: {
      opportunityId: 'BD-004',
      clientId: clientNovoNordisk.id,
      opportunityName: 'Patient Analytics Platform Build',
      opportunityType: OpportunityType.NEW,
      primaryLob: LineOfBusiness.ANALYTICS,
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-09-30'),
      status: OpportunityStatus.WON,
      stage: OpportunityStage.PO_PENDING,
      starConnect: true,
      ownerId: director1.id,
      coOwnerId: sel1.id,
      estimatedRevenue: 740000,
      probability: 100,
      nextSteps: 'Kick-off meeting confirmed for 3 May',
      notes: 'Signed SOW. Offshore team being onboarded.',
    },
  })

  const opp5 = await prisma.opportunity.upsert({
    where: { opportunityId: 'BD-005' },
    update: {},
    create: {
      opportunityId: 'BD-005',
      clientId: clientAstraZeneca.id,
      opportunityName: 'Oncology Trial Data Engineering',
      opportunityType: OpportunityType.NEW,
      primaryLob: LineOfBusiness.DS,
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-08-31'),
      status: OpportunityStatus.LOST,
      stage: OpportunityStage.STATUS_CHANGE_PENDING,
      starConnect: false,
      ownerId: sel2.id,
      coOwnerId: director2.id,
      estimatedRevenue: 620000,
      probability: 0,
      nextSteps: 'Conduct internal debrief on loss',
      notes: 'Lost to a competitor on price. Margin requirement was too high for client budget.',
    },
  })

  const opp6 = await prisma.opportunity.upsert({
    where: { opportunityId: 'BD-006' },
    update: {},
    create: {
      opportunityId: 'BD-006',
      clientId: clientGoldmanSachs.id,
      opportunityName: 'Trading Risk Model Automation',
      opportunityType: OpportunityType.NEW,
      primaryLob: LineOfBusiness.TECH,
      startDate: new Date('2026-08-01'),
      endDate: new Date('2027-07-31'),
      status: OpportunityStatus.OPEN,
      stage: OpportunityStage.LEAD,
      starConnect: false,
      ownerId: director2.id,
      estimatedRevenue: 2100000,
      probability: 20,
      nextSteps: 'Initial capability presentation to MD scheduled',
      notes: 'Warm intro via partner network. Large potential — $2M+.',
    },
  })

  const opp7 = await prisma.opportunity.upsert({
    where: { opportunityId: 'BD-007' },
    update: {},
    create: {
      opportunityId: 'BD-007',
      clientId: clientPfizer.id,
      opportunityName: 'HCP Segmentation & Targeting Analytics',
      opportunityType: OpportunityType.EXISTING,
      primaryLob: LineOfBusiness.ANALYTICS,
      startDate: new Date('2026-05-15'),
      endDate: new Date('2026-11-15'),
      status: OpportunityStatus.OPEN,
      stage: OpportunityStage.STATUS_CHANGE_PENDING,
      starConnect: true,
      ownerId: sel1.id,
      coOwnerId: ed.id,
      estimatedRevenue: 410000,
      probability: 80,
      nextSteps: 'Awaiting Pfizer procurement approval',
      notes: 'Extension of prior engagement. Strong relationship. Margin target 38%.',
    },
  })

  const opp8 = await prisma.opportunity.upsert({
    where: { opportunityId: 'BD-008' },
    update: {},
    create: {
      opportunityId: 'BD-008',
      clientId: clientUnilever.id,
      opportunityName: 'Supply Chain Demand Forecasting',
      opportunityType: OpportunityType.NEW,
      primaryLob: LineOfBusiness.MS,
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-02-28'),
      status: OpportunityStatus.OPEN,
      stage: OpportunityStage.PRICE_LINKING_PENDING,
      starConnect: false,
      ownerId: director1.id,
      estimatedRevenue: 870000,
      probability: 35,
      nextSteps: 'RFP response due end of May',
      notes: 'Competitive RFP. 4 vendors shortlisted. Emphasise offshore cost advantage.',
    },
  })

  const opp9 = await prisma.opportunity.upsert({
    where: { opportunityId: 'BD-009' },
    update: {},
    create: {
      opportunityId: 'BD-009',
      clientId: clientJPM.id,
      opportunityName: 'Credit Risk Dashboard — APAC',
      opportunityType: OpportunityType.EXISTING,
      primaryLob: LineOfBusiness.TECH,
      startDate: new Date('2025-10-01'),
      endDate: new Date('2026-03-31'),
      status: OpportunityStatus.WON,
      stage: OpportunityStage.TO_BE_ARCHIVED,
      starConnect: false,
      ownerId: sel2.id,
      coOwnerId: director2.id,
      estimatedRevenue: 560000,
      probability: 100,
      nextSteps: 'Final deliverables handover in progress',
      notes: 'Concluded successfully. Strong NPS. Good base for Phase 3.',
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

  // opp4 — Novo Nordisk (WON / SOW_SIGNED)
  await prisma.pricingVersion.upsert({
    where: { opportunityId_versionNumber: { opportunityId: opp4.id, versionNumber: 1 } },
    update: {},
    create: {
      opportunityId: opp4.id,
      versionNumber: 1,
      isFinal: true,
      label: 'Signed SOW version',
      proposedBillings: 740000,
      totalCost: 430000,
      grossMarginPct: 41.89,
      discountPremiumPct: 0,
      effectiveRatePerHour: 92,
      totalHours: 8000,
      offshorePct: 85,
      businessJustification: 'Offshore-heavy delivery; strong margin for pharma analytics build.',
    },
  })

  // opp5 — AstraZeneca (LOST)
  await prisma.pricingVersion.upsert({
    where: { opportunityId_versionNumber: { opportunityId: opp5.id, versionNumber: 1 } },
    update: {},
    create: {
      opportunityId: opp5.id,
      versionNumber: 1,
      isFinal: true,
      label: 'Final proposal (lost)',
      proposedBillings: 620000,
      totalCost: 390000,
      grossMarginPct: 37.1,
      discountPremiumPct: -3,
      effectiveRatePerHour: 110,
      totalHours: 5636,
      offshorePct: 70,
      businessJustification: 'Discounted 3% to stay competitive. Still lost on price.',
    },
  })

  // opp6 — Goldman Sachs (LEAD) — early draft, not final
  await prisma.pricingVersion.upsert({
    where: { opportunityId_versionNumber: { opportunityId: opp6.id, versionNumber: 1 } },
    update: {},
    create: {
      opportunityId: opp6.id,
      versionNumber: 1,
      isFinal: false,
      label: 'Preliminary estimate',
      proposedBillings: 2100000,
      totalCost: 1200000,
      grossMarginPct: 42.86,
      discountPremiumPct: 0,
      effectiveRatePerHour: 175,
      totalHours: 12000,
      offshorePct: 55,
      businessJustification: 'FS client — mixed US/India model. Premium US rates push margin up.',
    },
  })

  // opp7 — Pfizer (SOW_SUBMITTED)
  await prisma.pricingVersion.upsert({
    where: { opportunityId_versionNumber: { opportunityId: opp7.id, versionNumber: 1 } },
    update: {},
    create: {
      opportunityId: opp7.id,
      versionNumber: 1,
      isFinal: false,
      label: 'Draft v1',
      proposedBillings: 380000,
      totalCost: 240000,
      grossMarginPct: 36.84,
      discountPremiumPct: 0,
      effectiveRatePerHour: 95,
      totalHours: 4000,
      offshorePct: 90,
    },
  })

  await prisma.pricingVersion.upsert({
    where: { opportunityId_versionNumber: { opportunityId: opp7.id, versionNumber: 2 } },
    update: {},
    create: {
      opportunityId: opp7.id,
      versionNumber: 2,
      isFinal: true,
      label: 'SOW submission',
      proposedBillings: 410000,
      totalCost: 255000,
      grossMarginPct: 37.8,
      discountPremiumPct: 1.5,
      effectiveRatePerHour: 102,
      totalHours: 4000,
      offshorePct: 88,
      businessJustification: 'Existing relationship — small premium justified by faster ramp.',
    },
  })

  // opp8 — Unilever (QUALIFICATION)
  await prisma.pricingVersion.upsert({
    where: { opportunityId_versionNumber: { opportunityId: opp8.id, versionNumber: 1 } },
    update: {},
    create: {
      opportunityId: opp8.id,
      versionNumber: 1,
      isFinal: false,
      label: 'RFP response estimate',
      proposedBillings: 870000,
      totalCost: 520000,
      grossMarginPct: 40.23,
      discountPremiumPct: -2,
      effectiveRatePerHour: 108,
      totalHours: 8000,
      offshorePct: 80,
      businessJustification: 'Competitive RFP — small discount to improve win probability.',
    },
  })

  // opp9 — JPM APAC (WON, concluded)
  await prisma.pricingVersion.upsert({
    where: { opportunityId_versionNumber: { opportunityId: opp9.id, versionNumber: 1 } },
    update: {},
    create: {
      opportunityId: opp9.id,
      versionNumber: 1,
      isFinal: true,
      label: 'Signed engagement',
      proposedBillings: 560000,
      totalCost: 320000,
      grossMarginPct: 42.86,
      discountPremiumPct: 0,
      effectiveRatePerHour: 140,
      totalHours: 4000,
      offshorePct: 65,
    },
  })

  // ── Additional versions for richer demo data ─────────────────
  // opp2 (JPM Phase 2): v2 — revised with higher offshore
  await prisma.pricingVersion.upsert({
    where: { opportunityId_versionNumber: { opportunityId: opp2.id, versionNumber: 2 } },
    update: {},
    create: {
      opportunityId: opp2.id,
      versionNumber: 2,
      isFinal: false,
      label: 'Revised — higher offshore mix',
      proposedBillings: 1150000,
      totalCost: 640000,
      grossMarginPct: 44.35,
      discountPremiumPct: -2,
      effectiveRatePerHour: 143,
      totalHours: 8000,
      offshorePct: 75,
      businessJustification: 'Shifting 15% more work to India to improve margin by ~3pts.',
    },
  })

  // opp2 (JPM Phase 2): v3 — final negotiated
  await prisma.pricingVersion.upsert({
    where: { opportunityId_versionNumber: { opportunityId: opp2.id, versionNumber: 3 } },
    update: {},
    create: {
      opportunityId: opp2.id,
      versionNumber: 3,
      isFinal: false,
      label: 'Negotiated final — client pushed back on rates',
      proposedBillings: 1100000,
      totalCost: 660000,
      grossMarginPct: 40.0,
      discountPremiumPct: -5,
      effectiveRatePerHour: 137,
      totalHours: 8000,
      offshorePct: 72,
      businessJustification: 'Client pushed for 5% discount. Accepted to secure the extension.',
    },
  })

  // opp3 (BioGen R&D): v1 — discovery estimate (was missing entirely)
  await prisma.pricingVersion.upsert({
    where: { opportunityId_versionNumber: { opportunityId: opp3.id, versionNumber: 1 } },
    update: {},
    create: {
      opportunityId: opp3.id,
      versionNumber: 1,
      isFinal: false,
      label: 'Discovery phase estimate',
      proposedBillings: 290000,
      totalCost: 180000,
      grossMarginPct: 37.93,
      discountPremiumPct: 0,
      effectiveRatePerHour: 72,
      totalHours: 4000,
      offshorePct: 90,
      businessJustification: 'Initial light team to validate scope before full engagement.',
    },
  })

  // opp3 (BioGen R&D): v2 — scaled-up proposal
  await prisma.pricingVersion.upsert({
    where: { opportunityId_versionNumber: { opportunityId: opp3.id, versionNumber: 2 } },
    update: {},
    create: {
      opportunityId: opp3.id,
      versionNumber: 2,
      isFinal: true,
      label: 'Full engagement proposal',
      proposedBillings: 520000,
      totalCost: 310000,
      grossMarginPct: 40.38,
      discountPremiumPct: 1,
      effectiveRatePerHour: 86,
      totalHours: 6000,
      offshorePct: 88,
      businessJustification: 'Post-discovery scope expanded. Margin holds at 40% with India-heavy team.',
    },
  })

  // opp4 (Novo Nordisk WON): v2 — scope expansion after SOW signed
  await prisma.pricingVersion.upsert({
    where: { opportunityId_versionNumber: { opportunityId: opp4.id, versionNumber: 2 } },
    update: {},
    create: {
      opportunityId: opp4.id,
      versionNumber: 2,
      isFinal: false,
      label: 'Phase 2 scope expansion (in discussion)',
      proposedBillings: 920000,
      totalCost: 530000,
      grossMarginPct: 42.39,
      discountPremiumPct: 0,
      effectiveRatePerHour: 95,
      totalHours: 9600,
      offshorePct: 85,
      businessJustification: 'Client requested expanded scope post kick-off. Currently being scoped.',
    },
  })

  // opp5 (AstraZeneca LOST): v2 — second attempt (deeply discounted, still lost)
  await prisma.pricingVersion.upsert({
    where: { opportunityId_versionNumber: { opportunityId: opp5.id, versionNumber: 2 } },
    update: {},
    create: {
      opportunityId: opp5.id,
      versionNumber: 2,
      isFinal: false,
      label: 'Second attempt — aggressive pricing',
      proposedBillings: 560000,
      totalCost: 380000,
      grossMarginPct: 32.14,
      discountPremiumPct: -8,
      effectiveRatePerHour: 99,
      totalHours: 5636,
      offshorePct: 75,
      businessJustification: 'Cut rates further to try to win. Margin below target but strategic value.',
    },
  })

  // opp6 (Goldman Sachs LEAD): v2 — refined scope with US team reduction
  await prisma.pricingVersion.upsert({
    where: { opportunityId_versionNumber: { opportunityId: opp6.id, versionNumber: 2 } },
    update: {},
    create: {
      opportunityId: opp6.id,
      versionNumber: 2,
      isFinal: false,
      label: 'Refined — reduced US headcount',
      proposedBillings: 1850000,
      totalCost: 1050000,
      grossMarginPct: 43.24,
      discountPremiumPct: 0,
      effectiveRatePerHour: 154,
      totalHours: 12000,
      offshorePct: 65,
      businessJustification: 'Replaced 2 US SMs with India equivalents. Better margin, similar output.',
    },
  })

  // opp6 (Goldman Sachs LEAD): v3 — capability-based pricing
  await prisma.pricingVersion.upsert({
    where: { opportunityId_versionNumber: { opportunityId: opp6.id, versionNumber: 3 } },
    update: {},
    create: {
      opportunityId: opp6.id,
      versionNumber: 3,
      isFinal: false,
      label: 'Capability-based model (under review)',
      proposedBillings: 2300000,
      totalCost: 1280000,
      grossMarginPct: 44.35,
      discountPremiumPct: 5,
      effectiveRatePerHour: 191,
      totalHours: 12000,
      offshorePct: 55,
      businessJustification: 'Premium for IP/proprietary tooling we bring. Pending partner sign-off.',
    },
  })

  // opp8 (Unilever QUALIFICATION): v2 — leaner model for RFP competitiveness
  await prisma.pricingVersion.upsert({
    where: { opportunityId_versionNumber: { opportunityId: opp8.id, versionNumber: 2 } },
    update: {},
    create: {
      opportunityId: opp8.id,
      versionNumber: 2,
      isFinal: true,
      label: 'Lean model — RFP final submission',
      proposedBillings: 810000,
      totalCost: 470000,
      grossMarginPct: 41.98,
      discountPremiumPct: -4,
      effectiveRatePerHour: 101,
      totalHours: 8000,
      offshorePct: 85,
      businessJustification: 'Further offshore shift to beat competitors on price while maintaining 42% margin.',
    },
  })

  // opp9 (JPM APAC WON): v2 — milestone billing revision
  await prisma.pricingVersion.upsert({
    where: { opportunityId_versionNumber: { opportunityId: opp9.id, versionNumber: 2 } },
    update: {},
    create: {
      opportunityId: opp9.id,
      versionNumber: 2,
      isFinal: false,
      label: 'Milestone billing recut',
      proposedBillings: 580000,
      totalCost: 325000,
      grossMarginPct: 43.97,
      discountPremiumPct: 2,
      effectiveRatePerHour: 145,
      totalHours: 4000,
      offshorePct: 65,
      businessJustification: 'Rebased to milestone billing after client requested payment flexibility.',
    },
  })

  console.log('  ✓ pricing versions')

  // ── 6. STAFFING RESOURCES + WEEKLY HOURS ─────────────────────
  // opp1 v2 (Novartis): 3 India roles + 1 US Engagement Lead
  const sr1 = await prisma.staffingResource.create({
    data: {
      pricingVersionId: pv1v2.id,
      rateCardId: rateCardMap['SENIOR_BUSINESS_ANALYST_INDIA'] ?? null,
      resourceDesignation: JobRole.SENIOR_BUSINESS_ANALYST,
      location: Location.INDIA,
      isBillable: true,
      systemBillRatePerHour: 158,
      effectiveBillRate: 158,
      costRatePerHour: 62,
    },
  })

  const sr2 = await prisma.staffingResource.create({
    data: {
      pricingVersionId: pv1v2.id,
      rateCardId: rateCardMap['BUSINESS_ANALYST_INDIA'] ?? null,
      resourceDesignation: JobRole.BUSINESS_ANALYST,
      location: Location.INDIA,
      isBillable: true,
      systemBillRatePerHour: 53,
      effectiveBillRate: 53,
      costRatePerHour: 36,
    },
  })

  const sr3 = await prisma.staffingResource.create({
    data: {
      pricingVersionId: pv1v2.id,
      rateCardId: rateCardMap['TECHNOLOGY_ANALYST_INDIA'] ?? null,
      resourceDesignation: JobRole.TECHNOLOGY_ANALYST,
      location: Location.INDIA,
      isBillable: true,
      systemBillRatePerHour: 48,
      effectiveBillRate: 48,
      costRatePerHour: 32,
    },
  })

  const sr3b = await prisma.staffingResource.create({
    data: {
      pricingVersionId: pv1v2.id,
      rateCardId: rateCardMap['ASSOCIATE_ENGAGEMENT_LEAD_US'] ?? null,
      resourceDesignation: JobRole.ASSOCIATE_ENGAGEMENT_LEAD,
      location: Location.US,
      isBillable: true,
      systemBillRatePerHour: 253,
      effectiveBillRate: 253,
      costRatePerHour: 160,
    },
  })

  // Seed 4 weeks of hours starting from the opportunity start date
  const weekStart = monday(new Date('2026-05-01'))
  for (let w = 0; w < 4; w++) {
    const ws = addWeeks(weekStart, w)
    await prisma.staffingWeekEntry.createMany({
      skipDuplicates: true,
      data: [
        { staffingResourceId: sr1.id,  weekStartDate: ws, hours: 20 },
        { staffingResourceId: sr2.id,  weekStartDate: ws, hours: 30 },
        { staffingResourceId: sr3.id,  weekStartDate: ws, hours: 40 },
        { staffingResourceId: sr3b.id, weekStartDate: ws, hours: 10 },
      ],
    })
  }

  // opp2 v1 (JPM): Engagement Lead India + Senior BA India + AEL US
  const sr4 = await prisma.staffingResource.create({
    data: {
      pricingVersionId: pv2.id,
      rateCardId: rateCardMap['ENGAGEMENT_LEAD_INDIA'] ?? null,
      resourceDesignation: JobRole.ENGAGEMENT_LEAD,
      location: Location.INDIA,
      isBillable: true,
      systemBillRatePerHour: 290,
      effectiveBillRate: 290,
      costRatePerHour: 145,
    },
  })

  const sr5 = await prisma.staffingResource.create({
    data: {
      pricingVersionId: pv2.id,
      rateCardId: rateCardMap['SENIOR_TECHNOLOGY_ANALYST_INDIA'] ?? null,
      resourceDesignation: JobRole.SENIOR_TECHNOLOGY_ANALYST,
      location: Location.INDIA,
      isBillable: true,
      systemBillRatePerHour: 140,
      effectiveBillRate: 140,
      costRatePerHour: 55,
    },
  })

  const weekStart2 = monday(new Date('2026-06-01'))
  for (let w = 0; w < 4; w++) {
    const ws = addWeeks(weekStart2, w)
    await prisma.staffingWeekEntry.createMany({
      skipDuplicates: true,
      data: [
        { staffingResourceId: sr4.id, weekStartDate: ws, hours: 20 },
        { staffingResourceId: sr5.id, weekStartDate: ws, hours: 40 },
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
        newValue: { stage: 'APPROVAL_PENDING' },
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

  // ── 13. AZURE AD USERS (SEL / DIRECTOR / ED only) ─────────────
  await syncAzureBDUsers()

  console.log('\n✅  Seed complete.')
}

// ── Azure AD sync helper ──────────────────────────────────────────
const TITLE_TO_ROLE: Array<{ match: string; role: UserRole }> = [
  { match: 'engagement director', role: UserRole.ED       },
  { match: ' ed ',               role: UserRole.ED       },
  { match: 'executive director', role: UserRole.ED       },
  { match: 'director',           role: UserRole.DIRECTOR },
  { match: 'sel',                role: UserRole.SEL      },
  { match: 'senior engagement',  role: UserRole.SEL      },
]

function mapTitleToRole(jobTitle: string | null | undefined): UserRole | null {
  if (!jobTitle) return null
  const lower = jobTitle.toLowerCase()
  for (const { match, role } of TITLE_TO_ROLE) {
    if (lower.includes(match)) return role
  }
  return null
}

async function syncAzureBDUsers() {
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env

  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) {
    console.log('  ⚠️  Azure env vars missing — skipping Azure AD user sync.')
    console.log('     Set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET to enable it.')
    return
  }

  const credential = new ClientSecretCredential(AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET)
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default'],
  })
  const graphClient = GraphClient.initWithMiddleware({ authProvider })

  console.log('\n  Fetching BD users from Azure AD …')

  interface GraphUser {
    id: string
    displayName: string | null
    mail: string | null
    userPrincipalName: string | null
    jobTitle: string | null
  }

  const allUsers: GraphUser[] = []
  let url: string | undefined =
    '/users?$select=id,displayName,mail,userPrincipalName,jobTitle&$top=999'

  while (url) {
    const page: { value: GraphUser[]; '@odata.nextLink'?: string } =
      await graphClient.api(url).get()
    allUsers.push(...page.value)
    url = page['@odata.nextLink']
      ? page['@odata.nextLink'].replace('https://graph.microsoft.com/v1.0', '')
      : undefined
  }

  let synced = 0
  let skipped = 0

  for (const azUser of allUsers) {
    const email = azUser.mail ?? azUser.userPrincipalName
    const name  = azUser.displayName

    if (!email || !name?.trim()) { skipped++; continue }
    if (!email.toLowerCase().endsWith('@procdna.com')) { skipped++; continue }
    if (email.includes('#EXT#')) { skipped++; continue }

    const role = mapTitleToRole(azUser.jobTitle)
    if (!role || role === UserRole.PARTNER) { skipped++; continue }

    await prisma.user.upsert({
      where:  { email },
      update: { name, role, kindeId: azUser.id, isActive: true },
      create: { email, name, role, kindeId: azUser.id, isActive: true },
    })
    synced++
  }

  console.log(`  ✓ Azure AD users  (synced: ${synced}  skipped: ${skipped})`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
