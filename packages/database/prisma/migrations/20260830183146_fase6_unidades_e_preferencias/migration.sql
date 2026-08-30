-- CreateEnum
CREATE TYPE "DemandLevel" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'MUITO_ALTA');

-- CreateTable
CREATE TABLE "Unit" (
    "id" UUID NOT NULL,
    "code" VARCHAR(7) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "type" VARCHAR(40),
    "neighborhood" VARCHAR(80),
    "cep" VARCHAR(8),
    "cre" SMALLINT,
    "microarea" VARCHAR(16),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "historicalAgeGroups" TEXT[],
    "historicalShifts" TEXT[],
    "historicalApplications" INTEGER NOT NULL DEFAULT 0,
    "historicalChildren" INTEGER NOT NULL DEFAULT 0,
    "historicalYears" INTEGER NOT NULL DEFAULT 0,
    "demandLevel" "DemandLevel" NOT NULL DEFAULT 'BAIXA',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Preference" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "ageGroupCode" VARCHAR(20) NOT NULL,
    "shift" VARCHAR(10) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Preference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Unit_code_key" ON "Unit"("code");

-- CreateIndex
CREATE INDEX "Unit_neighborhood_idx" ON "Unit"("neighborhood");

-- CreateIndex
CREATE INDEX "Unit_cre_idx" ON "Unit"("cre");

-- CreateIndex
CREATE INDEX "Unit_demandLevel_idx" ON "Unit"("demandLevel");

-- CreateIndex
CREATE INDEX "Preference_applicationId_idx" ON "Preference"("applicationId");

-- CreateIndex
CREATE INDEX "Preference_unitId_idx" ON "Preference"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "Preference_applicationId_position_key" ON "Preference"("applicationId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Preference_applicationId_unitId_ageGroupCode_shift_key" ON "Preference"("applicationId", "unitId", "ageGroupCode", "shift");

-- AddForeignKey
ALTER TABLE "Preference" ADD CONSTRAINT "Preference_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preference" ADD CONSTRAINT "Preference_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariantes de PRD 8.5 e 8.6 impostas pelo banco.
ALTER TABLE "Preference"
  -- PRD 8.6: de uma a cinco unidades, em ordem.
  ADD CONSTRAINT "Preference_posicao_faixa" CHECK ("position" BETWEEN 1 AND 5);

ALTER TABLE "Unit"
  -- Coordenada e um par, como em LocationAnchor.
  ADD CONSTRAINT "Unit_coordenada_par" CHECK (("latitude" IS NULL) = ("longitude" IS NULL)),
  ADD CONSTRAINT "Unit_coordenada_no_rio"
    CHECK ("latitude" IS NULL OR ("latitude" BETWEEN -23.1 AND -22.7
       AND "longitude" BETWEEN -43.8 AND -43.1)),
  ADD CONSTRAINT "Unit_cep_formato" CHECK ("cep" IS NULL OR "cep" ~ '^\d{8}$'),
  ADD CONSTRAINT "Unit_cre_faixa" CHECK ("cre" IS NULL OR "cre" BETWEEN 1 AND 11);
