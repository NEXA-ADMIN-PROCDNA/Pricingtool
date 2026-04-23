import "dotenv/config";
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
  NotificationType
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});


async function main() {
  console.log("🌱 Seeding database...\n");

  // ─────────────────────────────────────────────
  // 1. USERS
  // ─────────────────────────────────────────────
  console.log("👤 Seeding users...");

  const cofounder = await prisma.user.create({
    data: {
      email: "cofounder@company.com",
      name: "Sarah Connor",
      role: UserRole.COFOUNDER,
      kindeId: "kinde_cofounder_001",
      isActive: true,
    },
  });

  const partner = await prisma.user.create({
    data: {
      email: "partner@company.com",
      name: "James Carter",
      role: UserRole.PARTNER,
      kindeId: "kinde_partner_001",
      managerId: cofounder.id,
      isActive: true,
    },
  });

  const ed = await prisma.user.create({
    data: {
      email: "ed@company.com",
      name: "Emily Davis",
      role: UserRole.ED,
      kindeId: "kinde_ed_001",
      managerId: partner.id,
      isActive: true,
    },
  });

  const director = await prisma.user.create({
    data: {
      email: "director@company.com",
      name: "Robert Miles",
      role: UserRole.DIRECTOR,
      kindeId: "kinde_director_001",
      managerId: ed.id,
      isActive: true,
    },
  });

  const sel1 = await prisma.user.create({
    data: {
      email: "sel1@company.com",
      name: "Nina Patel",
      role: UserRole.SEL,
      kindeId: "kinde_sel_001",
      managerId: director.id,
      isActive: true,
    },
  });

  const sel2 = await prisma.user.create({
    data: {
      email: "sel2@company.com",
      name: "Tom Hughes",
      role: UserRole.SEL,
      kindeId: "kinde_sel_002",
      managerId: director.id,
      isActive: true,
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: "admin@company.com",
      name: "Admin User",
      role: UserRole.ADMIN,
      kindeId: "kinde_admin_001",
      isActive: true,
    },
  });

  console.log("   ✅ 7 users created\n");

  // ─────────────────────────────────────────────
  // 2. CLIENTS
  // ─────────────────────────────────────────────
  console.log("🏢 Seeding clients...");

  const client1 = await prisma.client.create({
    data: {
      clientId: "CLT-001",
      name: "Acme Corp",
      businessUnit: "Enterprise",
      industry: "Technology",
      region: "North America",
      isActive: true,
      createdById: sel1.id,
    },
  });

  const client2 = await prisma.client.create({
    data: {
      clientId: "CLT-002",
      name: "GlobalTech Ltd",
      businessUnit: "Mid-Market",
      industry: "Finance",
      region: "Europe",
      isActive: true,
      createdById: sel2.id,
    },
  });

  console.log("   ✅ 2 clients created\n");

  // ─────────────────────────────────────────────
  // 3. CLIENT POCs
  // ─────────────────────────────────────────────
  console.log("📇 Seeding client POCs...");

  await prisma.clientPOC.createMany({
    data: [
      { clientId: client1.id, name: "John Doe",   email: "john.doe@acme.com",         phone: "+11234560001", jobTitle: "VP Procurement" },
      { clientId: client1.id, name: "Lisa Ray",   email: "lisa.ray@acme.com",          phone: "+11234560002", jobTitle: "CTO" },
      { clientId: client2.id, name: "Mark Evans", email: "mark.evans@globaltech.com",  phone: "+441234560001", jobTitle: "CFO" },
    ],
  });

  console.log("   ✅ 3 client POCs created\n");

  // ─────────────────────────────────────────────
  // 4. RATE CARDS
  // ─────────────────────────────────────────────
  console.log("💰 Seeding rate cards...");

  const rateCardData = [
    { jobRole: JobRole.ANALYST,           location: Location.INDIA, costRatePerHour: 15.00,  billRatePerHour: 30.00  },
    { jobRole: JobRole.SENIOR_ANALYST,    location: Location.INDIA, costRatePerHour: 20.00,  billRatePerHour: 40.00  },
    { jobRole: JobRole.CONSULTANT,        location: Location.INDIA, costRatePerHour: 25.00,  billRatePerHour: 55.00  },
    { jobRole: JobRole.SENIOR_CONSULTANT, location: Location.INDIA, costRatePerHour: 30.00,  billRatePerHour: 65.00  },
    { jobRole: JobRole.MANAGER,           location: Location.INDIA, costRatePerHour: 40.00,  billRatePerHour: 85.00  },
    { jobRole: JobRole.ANALYST,           location: Location.US,    costRatePerHour: 50.00,  billRatePerHour: 100.00 },
    { jobRole: JobRole.CONSULTANT,        location: Location.US,    costRatePerHour: 80.00,  billRatePerHour: 160.00 },
    { jobRole: JobRole.MANAGER,           location: Location.US,    costRatePerHour: 100.00, billRatePerHour: 200.00 },
    { jobRole: JobRole.DIRECTOR,          location: Location.US,    costRatePerHour: 130.00, billRatePerHour: 260.00 },
  ];

  const rateCards = await Promise.all(
    rateCardData.map((rc) =>
      prisma.rateCard.create({
        data: {
          ...rc,
          effectiveFrom: new Date("2024-01-01"),
          isActive: true,
          ingestedById: admin.id,
        },
      })
    )
  );

  console.log(`   ✅ ${rateCards.length} rate cards created\n`);

  // ─────────────────────────────────────────────
  // 5. OPPORTUNITIES
  // ─────────────────────────────────────────────
  console.log("🎯 Seeding opportunities...");

  const opp1 = await prisma.opportunity.create({
    data: {
      opportunityId: "OPP-001",
      clientId: client1.id,
      opportunityName: "Acme Data Analytics Platform",
      opportunityType: OpportunityType.NEW,
      primaryLob: LineOfBusiness.ANALYTICS,
      startDate: new Date("2024-04-01"),
      endDate: new Date("2024-12-31"),
      status: OpportunityStatus.OPEN,
      stage: OpportunityStage.PROPOSAL,
      starConnect: true,
      ownerId: sel1.id,
      coOwnerId: sel2.id,
      nextSteps: "Send revised proposal by EOW",
      notes: "Client is evaluating 3 vendors",
      isActive: true,
    },
  });

  const opp2 = await prisma.opportunity.create({
    data: {
      opportunityId: "OPP-002",
      clientId: client2.id,
      opportunityName: "GlobalTech Cloud Migration",
      opportunityType: OpportunityType.EXISTING,
      primaryLob: LineOfBusiness.TECH,
      startDate: new Date("2024-06-01"),
      endDate: new Date("2025-05-31"),
      status: OpportunityStatus.OPEN,
      stage: OpportunityStage.SOW_SUBMITTED,
      starConnect: false,
      ownerId: sel2.id,
      isActive: true,
    },
  });

  console.log("   ✅ 2 opportunities created\n");

  // ─────────────────────────────────────────────
  // 6. PRICING VERSIONS
  // ─────────────────────────────────────────────
  console.log("📊 Seeding pricing versions...");

  const pv1 = await prisma.pricingVersion.create({
    data: {
      opportunityId: opp1.id,
      versionNumber: 1,
      isFinal: false,
      label: "Initial Estimate",
      proposedBillings: 250000.00,
      totalCost: 180000.00,
      grossMarginPct: 0.28,
      discountPremiumPct: 0.05,
      effectiveRatePerHour: 75.00,
      totalHours: 3333.33,
      offshorePct: 0.70,
    },
  });

  const pv2 = await prisma.pricingVersion.create({
    data: {
      opportunityId: opp1.id,
      versionNumber: 2,
      isFinal: true,
      label: "Final Revised",
      proposedBillings: 280000.00,
      totalCost: 195000.00,
      grossMarginPct: 0.304,
      discountPremiumPct: 0.0,
      effectiveRatePerHour: 80.00,
      totalHours: 3500.00,
      offshorePct: 0.65,
    },
  });

  const pv3 = await prisma.pricingVersion.create({
    data: {
      opportunityId: opp2.id,
      versionNumber: 1,
      isFinal: true,
      label: "Cloud Migration v1",
      proposedBillings: 500000.00,
      totalCost: 340000.00,
      grossMarginPct: 0.32,
      totalHours: 6250.00,
      offshorePct: 0.80,
    },
  });

  console.log("   ✅ 3 pricing versions created\n");

  // ─────────────────────────────────────────────
  // 7. STAFFING RESOURCES
  // ─────────────────────────────────────────────
  console.log("👥 Seeding staffing resources...");

  const indiaAnalystRC = rateCards.find((r) => r.jobRole === JobRole.ANALYST     && r.location === Location.INDIA)!;
  const indiaConsultRC = rateCards.find((r) => r.jobRole === JobRole.CONSULTANT  && r.location === Location.INDIA)!;
  const indiaManagerRC = rateCards.find((r) => r.jobRole === JobRole.MANAGER     && r.location === Location.INDIA)!;
  const usConsultRC    = rateCards.find((r) => r.jobRole === JobRole.CONSULTANT  && r.location === Location.US)!;

  const sr1 = await prisma.staffingResource.create({
    data: {
      pricingVersionId: pv1.id,
      rateCardId: indiaAnalystRC.id,
      resourceDesignation: JobRole.ANALYST,
      location: Location.INDIA,
      isBillable: true,
      systemBillRatePerHour: indiaAnalystRC.billRatePerHour,
      costRatePerHour: indiaAnalystRC.costRatePerHour,
      effectiveBillRate: indiaAnalystRC.billRatePerHour,
    },
  });

  const sr2 = await prisma.staffingResource.create({
    data: {
      pricingVersionId: pv1.id,
      rateCardId: indiaConsultRC.id,
      resourceDesignation: JobRole.CONSULTANT,
      location: Location.INDIA,
      isBillable: true,
      systemBillRatePerHour: indiaConsultRC.billRatePerHour,
      costRatePerHour: indiaConsultRC.costRatePerHour,
      effectiveBillRate: indiaConsultRC.billRatePerHour,
    },
  });

  const sr3 = await prisma.staffingResource.create({
    data: {
      pricingVersionId: pv3.id,
      rateCardId: usConsultRC.id,
      resourceDesignation: JobRole.CONSULTANT,
      location: Location.US,
      isBillable: true,
      systemBillRatePerHour: usConsultRC.billRatePerHour,
      costRatePerHour: usConsultRC.costRatePerHour,
      effectiveBillRate: usConsultRC.billRatePerHour,
    },
  });

  const sr4 = await prisma.staffingResource.create({
    data: {
      pricingVersionId: pv3.id,
      rateCardId: indiaManagerRC.id,
      resourceDesignation: JobRole.MANAGER,
      location: Location.INDIA,
      isBillable: true,
      systemBillRatePerHour: indiaManagerRC.billRatePerHour,
      costRatePerHour: indiaManagerRC.costRatePerHour,
      effectiveBillRate: indiaManagerRC.billRatePerHour,
    },
  });

  console.log("   ✅ 4 staffing resources created\n");

  // ─────────────────────────────────────────────
  // 8. STAFFING WEEK ENTRIES
  // ─────────────────────────────────────────────
  console.log("📅 Seeding staffing week entries...");

  const weeks = ["2024-04-01", "2024-04-08", "2024-04-15", "2024-04-22"];

  await prisma.staffingWeekEntry.createMany({
    data: [
      ...weeks.map((w) => ({ staffingResourceId: sr1.id, weekStartDate: new Date(w), hours: 40 })),
      ...weeks.map((w) => ({ staffingResourceId: sr2.id, weekStartDate: new Date(w), hours: 32 })),
      ...weeks.map((w) => ({ staffingResourceId: sr3.id, weekStartDate: new Date(w), hours: 40 })),
      ...weeks.map((w) => ({ staffingResourceId: sr4.id, weekStartDate: new Date(w), hours: 20 })),
    ],
  });

  console.log("   ✅ 16 staffing week entries created\n");

  // ─────────────────────────────────────────────
  // 9. OTHER COSTS
  // ─────────────────────────────────────────────
  console.log("💸 Seeding other costs...");

  await prisma.otherCost.createMany({
    data: [
      { opportunityId: opp1.id, description: "Travel & Accommodation", amount: 5000.00,  isBillable: true,  month: new Date("2024-05-01") },
      { opportunityId: opp1.id, description: "Software Licenses",      amount: 3000.00,  isBillable: false, month: new Date("2024-06-01") },
      { opportunityId: opp2.id, description: "Cloud Infrastructure",   amount: 12000.00, isBillable: true,  month: new Date("2024-07-01") },
    ],
  });

  console.log("   ✅ 3 other costs created\n");

  // ─────────────────────────────────────────────
  // 10. SCHEDULE OF PAYMENTS
  // ─────────────────────────────────────────────
  console.log("🗓️  Seeding schedule of payments...");

  await prisma.scheduleOfPayment.createMany({
    data: [
      { pricingVersionId: pv2.id, month: new Date("2024-04-01"), recommendedBillings: 70000,  proposedBillings: 70000 },
      { pricingVersionId: pv2.id, month: new Date("2024-05-01"), recommendedBillings: 70000,  proposedBillings: 75000, proposedIsManual: true },
      { pricingVersionId: pv2.id, month: new Date("2024-06-01"), recommendedBillings: 70000,  proposedBillings: 70000 },
      { pricingVersionId: pv3.id, month: new Date("2024-06-01"), recommendedBillings: 100000, proposedBillings: 100000 },
      { pricingVersionId: pv3.id, month: new Date("2024-07-01"), recommendedBillings: 100000, proposedBillings: 110000, proposedIsManual: true },
    ],
  });

  console.log("   ✅ 5 schedule of payments created\n");

  // ─────────────────────────────────────────────
  // 11. FINANCIAL SNAPSHOTS
  // ─────────────────────────────────────────────
  console.log("📈 Seeding financial snapshots...");

  await prisma.financialSnapshot.createMany({
    data: [
      {
        pricingVersionId: pv2.id,
        month: new Date("2024-04-01"),
        revenueFromBilling: 70000,
        revenueFromOtherCost: 1000,
        totalRevenue: 71000,
        employeeCost: 48000,
        otherCost: 1000,
        grossMargin: 22000,
        grossMarginPct: 0.31,
        totalHours: 875,
        offshoreRatio: 0.65,
        billedRatePerHour: 80.0,
        effectiveRatePerHour: 78.5,
      },
      {
        pricingVersionId: pv3.id,
        month: new Date("2024-06-01"),
        revenueFromBilling: 100000,
        revenueFromOtherCost: 5000,
        totalRevenue: 105000,
        employeeCost: 68000,
        otherCost: 5000,
        grossMargin: 32000,
        grossMarginPct: 0.305,
        totalHours: 1250,
        offshoreRatio: 0.80,
        billedRatePerHour: 84.0,
        effectiveRatePerHour: 80.0,
      },
    ],
  });

  console.log("   ✅ 2 financial snapshots created\n");

  // ─────────────────────────────────────────────
  // 12. APPROVAL REQUESTS
  // ─────────────────────────────────────────────
  console.log("✅ Seeding approval requests...");

  await prisma.approvalRequest.createMany({
    data: [
      {
        opportunityId: opp1.id,
        requestedById: sel1.id,
        approverId: director.id,
        status: ApprovalStatus.PENDING,
        requestedAt: new Date("2024-03-20"),
      },
      {
        opportunityId: opp2.id,
        requestedById: sel2.id,
        approverId: ed.id,
        status: ApprovalStatus.APPROVED,
        requestedAt: new Date("2024-03-15"),
        decidedAt: new Date("2024-03-17"),
      },
    ],
  });

  console.log("   ✅ 2 approval requests created\n");

  // ─────────────────────────────────────────────
  // 13. SOW DOCUMENTS
  // ─────────────────────────────────────────────
  console.log("📄 Seeding SOW documents...");

  await prisma.sOWDocument.createMany({
    data: [
      {
        opportunityId: opp1.id,
        clientId: client1.id,
        fileName: "acme_sow_v1.pdf",
        storagePath: "/documents/opp-001/acme_sow_v1.pdf",
        fileSizeBytes: 204800,
        mimeType: "application/pdf",
        version: 1,
        isActive: true,
      },
      {
        opportunityId: opp2.id,
        clientId: client2.id,
        fileName: "globaltech_sow_v1.pdf",
        storagePath: "/documents/opp-002/globaltech_sow_v1.pdf",
        fileSizeBytes: 358400,
        mimeType: "application/pdf",
        version: 1,
        isActive: true,
      },
    ],
  });

  console.log("   ✅ 2 SOW documents created\n");

  // ─────────────────────────────────────────────
  // 14. COMMENTS
  // ─────────────────────────────────────────────
  console.log("💬 Seeding comments...");

  const comment1 = await prisma.comment.create({
    data: {
      opportunityId: opp1.id,
      authorId: sel1.id,
      content: "Client confirmed budget approval. Moving to proposal stage.",
    },
  });

  await prisma.comment.create({
    data: {
      opportunityId: opp1.id,
      authorId: director.id,
      content: "Great progress. Make sure margins are above 28%.",
      parentId: comment1.id,
    },
  });

  await prisma.comment.create({
    data: {
      opportunityId: opp2.id,
      authorId: sel2.id,
      content: "SOW submitted. Awaiting client sign-off.",
    },
  });

  console.log("   ✅ 3 comments created\n");

  // ─────────────────────────────────────────────
  // 15. ACTIVITY LOGS
  // ─────────────────────────────────────────────
  console.log("📝 Seeding activity logs...");

  await prisma.activityLog.createMany({
    data: [
      {
        opportunityId: opp1.id,
        userId: sel1.id,
        action: "OPPORTUNITY_CREATED",
        newValue: { opportunityId: "OPP-001", stage: "LEAD" },
      },
      {
        opportunityId: opp1.id,
        userId: sel1.id,
        action: "STAGE_UPDATED",
        oldValue: { stage: "LEAD" },
        newValue: { stage: "PROPOSAL" },
      },
      {
        opportunityId: opp2.id,
        userId: sel2.id,
        action: "OPPORTUNITY_CREATED",
        newValue: { opportunityId: "OPP-002", stage: "LEAD" },
      },
      {
        opportunityId: opp2.id,
        userId: sel2.id,
        action: "STAGE_UPDATED",
        oldValue: { stage: "PROPOSAL" },
        newValue: { stage: "SOW_SUBMITTED" },
      },
      {
        userId: admin.id,
        action: "RATE_CARD_INGESTED",
        metadata: { count: rateCards.length },
      },
    ],
  });

  console.log("   ✅ 5 activity logs created\n");

  // ─────────────────────────────────────────────
  // 16. NOTIFICATION LOGS
  // ─────────────────────────────────────────────
  console.log("🔔 Seeding notification logs...");

  await prisma.notificationLog.createMany({
    data: [
      {
        type: NotificationType.APPROVAL_REQUESTED,
        recipientEmail: director.email,
        ccEmails: [sel1.email],
        subject: "Approval Required: Acme Data Analytics Platform",
        opportunityId: opp1.id,
        status: "sent",
      },
      {
        type: NotificationType.APPROVAL_APPROVED,
        recipientEmail: sel2.email,
        ccEmails: [ed.email, director.email],
        subject: "Approved: GlobalTech Cloud Migration",
        opportunityId: opp2.id,
        status: "sent",
      },
      {
        type: NotificationType.STATUS_CHANGED,
        recipientEmail: sel1.email,
        ccEmails: [],
        subject: "Status Update: OPP-001 moved to Proposal",
        opportunityId: opp1.id,
        status: "sent",
      },
    ],
  });

  console.log("   ✅ 3 notification logs created\n");

  console.log("🎉 Seeding complete!\n");
  console.log("Summary:");
  console.log(`   Users:               7`);
  console.log(`   Clients:             2`);
  console.log(`   Client POCs:         3`);
  console.log(`   Rate Cards:          ${rateCards.length}`);
  console.log(`   Opportunities:       2`);
  console.log(`   Pricing Versions:    3`);
  console.log(`   Staffing Resources:  4`);
  console.log(`   Week Entries:        16`);
  console.log(`   Other Costs:         3`);
  console.log(`   Schedule of Pmts:    5`);
  console.log(`   Financial Snapshots: 2`);
  console.log(`   Approval Requests:   2`);
  console.log(`   SOW Documents:       2`);
  console.log(`   Comments:            3 (1 threaded reply)`);
  console.log(`   Activity Logs:       5`);
  console.log(`   Notification Logs:   3`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });