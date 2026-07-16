/**
 * Idempotent sample data for the Purchase module demos.
 * Usage: npx tsx scripts/seed-purchase-sample.ts
 */
import { PrismaClient } from "@prisma/client";
import { SEED_ADMIN_LOGIN_ID } from "../lib/auth/constants";

const prisma = new PrismaClient();

async function main() {
  const employee = await prisma.employee.findFirst({
    where: { employeeCode: SEED_ADMIN_LOGIN_ID, deletedAt: null },
  });
  if (!employee) {
    throw new Error(`Employee ${SEED_ADMIN_LOGIN_ID} not found — run npm run db:seed first.`);
  }

  let vessel = await prisma.vessel.findFirst({
    where: { deletedAt: null, status: "active" },
    orderBy: { name: "asc" },
  });

  if (!vessel) {
    const company =
      (await prisma.company.findFirst({ where: { code: "ACT", deletedAt: null } })) ??
      (await prisma.company.create({
        data: {
          code: "ACT",
          name: "Actinium Platform",
          type: "MASTER",
          category: "other",
          status: "active",
          isShipowner: true,
        },
      }));

    vessel = await prisma.vessel.create({
      data: {
        companyId: company.id,
        code: "DEMO01",
        name: "MV Demo Voyager",
        status: "active",
      },
    });
    console.log(`  ✓ Created demo vessel ${vessel.code}`);
  } else {
    console.log(`  ✓ Using vessel ${vessel.code} (${vessel.name})`);
  }

  const vendors = [
    {
      vendorCode: "VND-MARINE-01",
      name: "Harbour Marine Supplies",
      primaryEmail: "quotes@harbour-marine.example",
      country: "Singapore",
      city: "Singapore",
      serviceTypes: ["SPR", "STR"],
      verificationStatus: "VERIFIED",
    },
    {
      vendorCode: "VND-TECH-02",
      name: "Atlantic Tech Spares",
      primaryEmail: "sales@atlantic-tech.example",
      country: "Netherlands",
      city: "Rotterdam",
      serviceTypes: ["SPR", "SER"],
      verificationStatus: "VERIFIED",
    },
    {
      vendorCode: "VND-FUEL-03",
      name: "Pacific Bunker Partners",
      primaryEmail: "ops@pacific-bunker.example",
      country: "UAE",
      city: "Dubai",
      serviceTypes: ["BNK", "LUB"],
      verificationStatus: "PENDING",
    },
  ] as const;

  const vendorIds: string[] = [];
  for (const v of vendors) {
    const row = await prisma.purchaseVendor.upsert({
      where: { vendorCode: v.vendorCode },
      create: {
        vendorCode: v.vendorCode,
        name: v.name,
        primaryEmail: v.primaryEmail,
        country: v.country,
        city: v.city,
        serviceTypes: [...v.serviceTypes],
        verificationStatus: v.verificationStatus,
        isActive: true,
        preferredCurrency: "USD",
      },
      update: {
        name: v.name,
        primaryEmail: v.primaryEmail,
        country: v.country,
        city: v.city,
        serviceTypes: [...v.serviceTypes],
        verificationStatus: v.verificationStatus,
        deletedAt: null,
        isActive: true,
      },
    });
    vendorIds.push(row.id);
  }
  console.log(`  ✓ ${vendorIds.length} vendors`);

  const reqNumber = `PR-${vessel.code}-DEMO-0001`;
  let requisition = await prisma.purchaseRequisition.findUnique({
    where: { requisitionNumber: reqNumber },
  });

  if (!requisition) {
    requisition = await prisma.purchaseRequisition.create({
      data: {
        requisitionNumber: reqNumber,
        heading: "Main engine spare kit — demo",
        description: "Sample requisition seeded for Purchase module walkthrough.",
        portOfSupply: "Singapore",
        requisitionType: "SPR",
        generationStatus: "CREATED",
        status: "REQ_APPROVED",
        vesselId: vessel.id,
        createdById: employee.id,
        approvedById: employee.id,
        approvedAt: new Date(),
        items: {
          create: [
            {
              itemName: "Cylinder liner O-ring set",
              quantity: 4,
              unit: "set",
              sortOrder: 0,
            },
            {
              itemName: "Fuel injector nozzle",
              quantity: 2,
              unit: "pcs",
              partNumber: "FI-220A",
              sortOrder: 1,
            },
          ],
        },
      },
    });
    console.log(`  ✓ Created requisition ${requisition.requisitionNumber}`);
  } else {
    console.log(`  ✓ Requisition ${reqNumber} already exists`);
  }

  const draftNumber = `PR-${vessel.code}-DEMO-DRAFT`;
  const existingDraft = await prisma.purchaseRequisition.findUnique({
    where: { requisitionNumber: draftNumber },
  });
  if (!existingDraft) {
    await prisma.purchaseRequisition.create({
      data: {
        requisitionNumber: draftNumber,
        heading: "Stores top-up (draft)",
        requisitionType: "STR",
        generationStatus: "SAVED_AS_DRAFT",
        status: "NOT_READY",
        vesselId: vessel.id,
        createdById: employee.id,
        items: {
          create: [{ itemName: "Cleaning chemicals drum", quantity: 6, unit: "drums", sortOrder: 0 }],
        },
      },
    });
    console.log(`  ✓ Created draft ${draftNumber}`);
  }

  const vendorId = vendorIds[0]!;
  const quote = await prisma.purchaseQuote.upsert({
    where: {
      requisitionId_vendorId: {
        requisitionId: requisition.id,
        vendorId,
      },
    },
    create: {
      requisitionId: requisition.id,
      vendorId,
      quoteNumber: "Q-DEMO-001",
      totalAmount: 4850,
      currency: "USD",
      status: "APPROVED",
      receivedAt: new Date(),
      items: {
        create: [
          {
            itemName: "Cylinder liner O-ring set",
            quantity: 4,
            unit: "set",
            unitPrice: 320,
            totalPrice: 1280,
            sortOrder: 0,
          },
          {
            itemName: "Fuel injector nozzle",
            quantity: 2,
            unit: "pcs",
            unitPrice: 1785,
            totalPrice: 3570,
            sortOrder: 1,
          },
        ],
      },
    },
    update: {
      totalAmount: 4850,
      status: "APPROVED",
      deletedAt: null,
    },
  });
  console.log(`  ✓ Quote ${quote.quoteNumber ?? quote.id}`);

  const poNumber = "PO-DEMO-0001";
  const po = await prisma.purchaseOrder.upsert({
    where: { poNumber },
    create: {
      poNumber,
      requisitionId: requisition.id,
      quoteId: quote.id,
      vesselId: vessel.id,
      vesselName: vessel.name,
      status: "PO_SENT",
      completionStatus: "OPEN",
      totalAmount: 4850,
      currency: "USD",
      sentAt: new Date(),
    },
    update: {
      totalAmount: 4850,
      status: "PO_SENT",
      deletedAt: null,
    },
  });
  console.log(`  ✓ PO ${po.poNumber}`);

  const invNumber = "INV-DEMO-0001";
  await prisma.purchaseInvoice.upsert({
    where: { invoiceNumber: invNumber },
    create: {
      invoiceNumber: invNumber,
      requisitionId: requisition.id,
      purchaseOrderId: po.id,
      quoteId: quote.id,
      vendorId,
      invoiceDate: new Date(),
      invoiceAmount: 4850,
      quoteAmount: 4850,
      differenceAmount: 0,
      currency: "USD",
      status: "READY_FOR_APPROVAL",
    },
    update: {
      invoiceAmount: 4850,
      status: "READY_FOR_APPROVAL",
      deletedAt: null,
    },
  });
  console.log(`  ✓ Invoice ${invNumber}`);

  console.log("Purchase sample seed complete.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
