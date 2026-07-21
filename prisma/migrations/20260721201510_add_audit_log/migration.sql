-- Admin action audit trail. Purely additive: new table only, no touch to Candidate,
-- Admin, the Decision enum, or any existing row. adminId is intentionally NOT a
-- foreign key to Admin so the audit trail survives even if an admin account is
-- later deleted.
CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "previousValue" JSONB,
  "newValue" JSONB,
  "ip" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_adminId_createdAt_idx" ON "AuditLog"("adminId", "createdAt");
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");
