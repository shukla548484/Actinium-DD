-- Reclassify shipyard execution roles from external → shipyard.
UPDATE "roles"
SET "user_type" = 'shipyard'
WHERE "code" IN (
  'SHIPYARD',
  'YARD_PM',
  'YARD_PLAN',
  'YARD_HULL',
  'YARD_PAINT',
  'YARD_MACH',
  'YARD_QA',
  'YARD_SAFETY',
  'YARD_COMM'
);
