-- CreateEnum
CREATE TYPE "AnchorKind" AS ENUM ('RESIDENCIA', 'TRABALHO', 'REDE_APOIO', 'OUTRO');

-- CreateEnum
CREATE TYPE "GeocodingStatus" AS ENUM ('PENDENTE', 'RESOLVIDO', 'FALHOU');

-- CreateTable
CREATE TABLE "LocationAnchor" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "kind" "AnchorKind" NOT NULL,
    "cep" VARCHAR(8) NOT NULL,
    "label" VARCHAR(60),
    "status" "GeocodingStatus" NOT NULL DEFAULT 'PENDENTE',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "precisionKm" DOUBLE PRECISION,
    "neighborhood" VARCHAR(80),
    "lastValidatedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "LocationAnchor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LocationAnchor_applicationId_idx" ON "LocationAnchor"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "LocationAnchor_applicationId_position_key" ON "LocationAnchor"("applicationId", "position");

-- AddForeignKey
ALTER TABLE "LocationAnchor" ADD CONSTRAINT "LocationAnchor_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariantes de PRD 8.2 impostas pelo banco, nao por convencao de aplicacao.
-- A mesma escolha da Fase 2 para o append-only (ADR-0015): uma regra que a
-- interface pode esquecer, mas o banco nao.
ALTER TABLE "LocationAnchor"
  -- Sao no maximo tres pontos, e a posicao os ordena.
  ADD CONSTRAINT "LocationAnchor_position_range" CHECK ("position" BETWEEN 1 AND 3),
  -- A posicao 1 e a residencia, que PRD 8.2 torna obrigatoria.
  ADD CONSTRAINT "LocationAnchor_position1_residencia"
    CHECK ("position" <> 1 OR "kind" = 'RESIDENCIA'),
  -- CEP e texto de oito digitos; zeros a esquerda nunca sao perdidos (PRD 10.3).
  ADD CONSTRAINT "LocationAnchor_cep_formato" CHECK ("cep" ~ '^\d{8}$'),
  -- Coordenada e um par: ou existe inteira, ou nao existe.
  ADD CONSTRAINT "LocationAnchor_coordenada_par"
    CHECK (("latitude" IS NULL) = ("longitude" IS NULL)),
  -- Dizer RESOLVIDO sem coordenada seria mentir para a recomendacao.
  ADD CONSTRAINT "LocationAnchor_resolvido_tem_coordenada"
    CHECK ("status" <> 'RESOLVIDO' OR ("latitude" IS NOT NULL AND "precisionKm" IS NOT NULL)),
  -- Dentro da caixa delimitadora do municipio, quando houver coordenada.
  ADD CONSTRAINT "LocationAnchor_coordenada_no_rio"
    CHECK ("latitude" IS NULL OR ("latitude" BETWEEN -23.1 AND -22.7
       AND "longitude" BETWEEN -43.8 AND -43.1));
