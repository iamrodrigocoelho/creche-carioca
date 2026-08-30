-- CreateEnum
CREATE TYPE "DataStatus" AS ENUM ('DEMONSTRACAO', 'OFICIAL');

-- CreateEnum
CREATE TYPE "RuleKind" AS ENUM ('AGE_GROUP', 'SCORING', 'TIEBREAK');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('FEMININO', 'MASCULINO', 'NAO_INFORMADO');

-- CreateEnum
CREATE TYPE "Shift" AS ENUM ('INTEGRAL', 'PARCIAL', 'AMBOS');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('RASCUNHO', 'SUBMETIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "AuditOrigin" AS ENUM ('INTERFACE', 'API', 'WORKER', 'IMPORTACAO');

-- CreateTable
CREATE TABLE "Process" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "referenceDate" VARCHAR(10) NOT NULL,
    "status" "DataStatus" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Process_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleVersion" (
    "id" UUID NOT NULL,
    "processId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "kind" "RuleKind" NOT NULL,
    "status" "DataStatus" NOT NULL,
    "payload" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Child" (
    "id" UUID NOT NULL,
    "anonymousRef" UUID NOT NULL,
    "birthYear" INTEGER NOT NULL,
    "birthMonth" INTEGER NOT NULL,
    "sex" "Sex",
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guardian" (
    "id" UUID NOT NULL,
    "anonymousRef" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" UUID NOT NULL,
    "processId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "guardianId" UUID,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'RASCUNHO',
    "desiredShift" "Shift" NOT NULL,
    "referenceDateOverride" VARCHAR(10),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusEvent" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "fromStatus" "ApplicationStatus",
    "toStatus" "ApplicationStatus" NOT NULL,
    "reason" TEXT,
    "correlationId" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "actor" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "origin" "AuditOrigin" NOT NULL,
    "correlationId" TEXT NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Process_code_key" ON "Process"("code");

-- CreateIndex
CREATE INDEX "Process_status_idx" ON "Process"("status");

-- CreateIndex
CREATE INDEX "RuleVersion_processId_kind_effectiveFrom_idx" ON "RuleVersion"("processId", "kind", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "RuleVersion_processId_kind_version_key" ON "RuleVersion"("processId", "kind", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Child_anonymousRef_key" ON "Child"("anonymousRef");

-- CreateIndex
CREATE INDEX "Child_birthYear_birthMonth_idx" ON "Child"("birthYear", "birthMonth");

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_anonymousRef_key" ON "Guardian"("anonymousRef");

-- CreateIndex
CREATE INDEX "Application_processId_status_idx" ON "Application"("processId", "status");

-- CreateIndex
CREATE INDEX "Application_childId_idx" ON "Application"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_processId_childId_key" ON "Application"("processId", "childId");

-- CreateIndex
CREATE INDEX "StatusEvent_applicationId_occurredAt_idx" ON "StatusEvent"("applicationId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entity_entityId_idx" ON "AuditEvent"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_occurredAt_idx" ON "AuditEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_correlationId_idx" ON "AuditEvent"("correlationId");

-- AddForeignKey
ALTER TABLE "RuleVersion" ADD CONSTRAINT "RuleVersion_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusEvent" ADD CONSTRAINT "StatusEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
