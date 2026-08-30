-- CreateTable
CREATE TABLE "Criterion" (
    "id" UUID NOT NULL,
    "ruleVersionId" UUID NOT NULL,
    "code" INTEGER NOT NULL,
    "processQuestionId" INTEGER NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "order" SMALLINT NOT NULL,
    "points" SMALLINT NOT NULL,
    "isTiebreak" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Criterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriterionResponse" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "criterionId" UUID NOT NULL,
    "answer" BOOLEAN NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "CriterionResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreResult" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "ruleVersionId" UUID NOT NULL,
    "total" SMALLINT NOT NULL,
    "maxTotal" SMALLINT NOT NULL,
    "breakdown" JSONB NOT NULL,
    "computedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlationId" VARCHAR(64) NOT NULL,

    CONSTRAINT "ScoreResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Criterion_ruleVersionId_order_idx" ON "Criterion"("ruleVersionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Criterion_ruleVersionId_code_key" ON "Criterion"("ruleVersionId", "code");

-- CreateIndex
CREATE INDEX "CriterionResponse_applicationId_idx" ON "CriterionResponse"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "CriterionResponse_applicationId_criterionId_key" ON "CriterionResponse"("applicationId", "criterionId");

-- CreateIndex
CREATE INDEX "ScoreResult_applicationId_computedAt_idx" ON "ScoreResult"("applicationId", "computedAt");

-- CreateIndex
CREATE INDEX "ScoreResult_ruleVersionId_idx" ON "ScoreResult"("ruleVersionId");

-- AddForeignKey
ALTER TABLE "Criterion" ADD CONSTRAINT "Criterion_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "RuleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterionResponse" ADD CONSTRAINT "CriterionResponse_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterionResponse" ADD CONSTRAINT "CriterionResponse_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "Criterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreResult" ADD CONSTRAINT "ScoreResult_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreResult" ADD CONSTRAINT "ScoreResult_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "RuleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariantes de PRD 8.7 impostas pelo banco.
ALTER TABLE "Criterion"
  -- Peso nao negativo; criterio de desempate vale exatamente zero, que e o que
  -- a origem registra (`criterio = Sim` equivale a `pontuacao = 0`).
  ADD CONSTRAINT "Criterion_pontos_nao_negativos" CHECK ("points" >= 0),
  ADD CONSTRAINT "Criterion_desempate_nao_pontua"
    CHECK (NOT "isTiebreak" OR "points" = 0),
  ADD CONSTRAINT "Criterion_ordem_positiva" CHECK ("order" >= 1);

ALTER TABLE "ScoreResult"
  ADD CONSTRAINT "ScoreResult_total_nao_negativo" CHECK ("total" >= 0),
  -- O total nunca pode passar da soma dos pesos da regua que o produziu.
  ADD CONSTRAINT "ScoreResult_total_dentro_do_maximo" CHECK ("total" <= "maxTotal");

-- PRD 8.7: "nunca reescrever resultado historico". Recalcular cria uma linha
-- nova; a anterior permanece. Mesma escolha da Fase 2 para a auditoria
-- (ADR-0015): a garantia vive no banco, nao na convencao de aplicacao.
CREATE OR REPLACE FUNCTION "scoreresult_append_only"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'ScoreResult e append-only (PRD 8.7): recalcule criando um novo resultado em vez de % a linha existente.',
    lower(TG_OP);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "scoreresult_no_update"
  BEFORE UPDATE ON "ScoreResult"
  FOR EACH ROW EXECUTE FUNCTION "scoreresult_append_only"();

CREATE TRIGGER "scoreresult_no_delete"
  BEFORE DELETE ON "ScoreResult"
  FOR EACH ROW EXECUTE FUNCTION "scoreresult_append_only"();
