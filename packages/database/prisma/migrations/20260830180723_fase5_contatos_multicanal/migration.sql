-- CreateEnum
CREATE TYPE "ContactChannel" AS ENUM ('TELEFONE', 'EMAIL', 'SOCIAL');

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'X');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('INFORMED', 'PENDING_VERIFICATION', 'VERIFIED', 'INVALID', 'REVOKED');

-- CreateEnum
CREATE TYPE "ContactRelation" AS ENUM ('RESPONSAVEL', 'MAE', 'PAI', 'FAMILIAR', 'VIZINHO', 'OUTRO');

-- CreateTable
CREATE TABLE "ContactPoint" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "channel" "ContactChannel" NOT NULL,
    "e164" VARCHAR(16),
    "platform" "SocialPlatform",
    "handle" VARCHAR(30),
    "platformUserId" VARCHAR(64),
    "fingerprint" VARCHAR(64) NOT NULL,
    "label" VARCHAR(60),
    "relation" "ContactRelation" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "priority" SMALLINT NOT NULL DEFAULT 1,
    "allowsCall" BOOLEAN NOT NULL DEFAULT false,
    "allowsSms" BOOLEAN NOT NULL DEFAULT false,
    "allowsWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "allowsSocial" BOOLEAN NOT NULL DEFAULT false,
    "thirdPartyAuthorized" BOOLEAN NOT NULL DEFAULT false,
    "status" "ContactStatus" NOT NULL DEFAULT 'INFORMED',
    "otpHash" VARCHAR(64),
    "otpExpiresAt" TIMESTAMPTZ(6),
    "otpAttempts" SMALLINT NOT NULL DEFAULT 0,
    "consentedAt" TIMESTAMPTZ(6),
    "lastValidatedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ContactPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactPoint_applicationId_idx" ON "ContactPoint"("applicationId");

-- CreateIndex
CREATE INDEX "ContactPoint_applicationId_channel_idx" ON "ContactPoint"("applicationId", "channel");

-- CreateIndex
CREATE INDEX "ContactPoint_applicationId_fingerprint_idx" ON "ContactPoint"("applicationId", "fingerprint");

-- AddForeignKey
ALTER TABLE "ContactPoint" ADD CONSTRAINT "ContactPoint_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariantes de PRD 8.3 e 8.4 impostas pelo banco, como na Fase 4.
ALTER TABLE "ContactPoint"
  -- Telefone tem E.164 e nao tem plataforma; social e o inverso. A tabela e
  -- unificada, mas cada linha pertence a exatamente um canal.
  ADD CONSTRAINT "ContactPoint_telefone_tem_e164"
    CHECK ("channel" <> 'TELEFONE' OR ("e164" IS NOT NULL AND "platform" IS NULL AND "handle" IS NULL)),
  ADD CONSTRAINT "ContactPoint_social_tem_handle"
    CHECK ("channel" <> 'SOCIAL' OR ("platform" IS NOT NULL AND "handle" IS NOT NULL AND "e164" IS NULL)),
  -- E.164 brasileiro: +55, DDD e assinante.
  ADD CONSTRAINT "ContactPoint_e164_formato"
    CHECK ("e164" IS NULL OR "e164" ~ '^\+55\d{10,11}$'),
  -- Apenas telefone pode ser principal: e por ele que a convocacao acontece.
  ADD CONSTRAINT "ContactPoint_principal_e_telefone"
    CHECK (NOT "isPrimary" OR "channel" = 'TELEFONE'),
  -- PRD 8.3: telefone de terceiro exige confirmacao de autorizacao. A regra
  -- protege quem nao esta na conversa, entao nao fica so na aplicacao.
  ADD CONSTRAINT "ContactPoint_terceiro_autorizado"
    CHECK ("channel" <> 'TELEFONE'
        OR "relation" NOT IN ('FAMILIAR', 'VIZINHO', 'OUTRO')
        OR "thirdPartyAuthorized"),
  -- PRD 8.4: contato por rede social exige autorizacao explicita e data.
  ADD CONSTRAINT "ContactPoint_social_autorizado_tem_data"
    CHECK (NOT "allowsSocial" OR "consentedAt" IS NOT NULL),
  ADD CONSTRAINT "ContactPoint_prioridade_faixa" CHECK ("priority" BETWEEN 1 AND 99),
  ADD CONSTRAINT "ContactPoint_otp_tentativas_faixa" CHECK ("otpAttempts" BETWEEN 0 AND 10),
  -- PRD 13.4: token apenas como hash. 64 caracteres hexadecimais = SHA-256.
  ADD CONSTRAINT "ContactPoint_otp_e_hash"
    CHECK ("otpHash" IS NULL OR "otpHash" ~ '^[0-9a-f]{64}$');

-- PRD 8.3 exige EXATAMENTE um telefone principal. O banco garante "no maximo
-- um"; o "ao menos um" e reconciliado pela aplicacao a cada escrita, porque
-- depende de promover outro telefone quando o principal sai.
CREATE UNIQUE INDEX "ContactPoint_um_principal_por_inscricao"
  ON "ContactPoint" ("applicationId")
  WHERE "isPrimary";
