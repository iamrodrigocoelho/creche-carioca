-- Garantia append-only para as tabelas de evento.
--
-- PRD 13.8: "Logs de auditoria devem ser append-only" e "Acesso de administrador
-- nao deve eliminar rastreabilidade". Convencao de aplicacao nao basta: um bug,
-- um script ad hoc ou um usuario com privilegio elevado conseguiriam apagar a
-- trilha. A regra e imposta pelo proprio PostgreSQL.
--
-- StatusEvent recebe a mesma protecao por ser, por definicao, um historico
-- temporal de transicoes (PRD 11): reescrever o passado invalidaria o calculo de
-- tempo ate resposta previsto em PRD 18.3.

CREATE OR REPLACE FUNCTION match_append_only_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'A tabela % e append-only: % nao e permitido (PRD 13.8).',
    TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

COMMENT ON FUNCTION match_append_only_guard() IS
  'Bloqueia UPDATE e DELETE em tabelas de evento append-only (PRD 13.8).';

CREATE TRIGGER "AuditEvent_append_only"
  BEFORE UPDATE OR DELETE ON "AuditEvent"
  FOR EACH ROW EXECUTE FUNCTION match_append_only_guard();

CREATE TRIGGER "StatusEvent_append_only"
  BEFORE UPDATE OR DELETE ON "StatusEvent"
  FOR EACH ROW EXECUTE FUNCTION match_append_only_guard();

-- Mes e dia de nascimento sao validados no dominio (PRD 8.1), mas a restricao
-- tambem existe no banco: dado invalido nunca deve entrar por outra porta.
ALTER TABLE "Child"
  ADD CONSTRAINT "Child_birthMonth_range" CHECK ("birthMonth" BETWEEN 1 AND 12),
  ADD CONSTRAINT "Child_birthYear_range" CHECK ("birthYear" BETWEEN 1900 AND 2100);

-- Datas de referencia sao texto no formato YYYY-MM-DD, preservando o contrato da
-- API e evitando conversao implicita de fuso (PRD 10.3).
ALTER TABLE "Process"
  ADD CONSTRAINT "Process_referenceDate_format" CHECK ("referenceDate" ~ '^\d{4}-\d{2}-\d{2}$');

ALTER TABLE "Application"
  ADD CONSTRAINT "Application_referenceDateOverride_format"
  CHECK ("referenceDateOverride" IS NULL OR "referenceDateOverride" ~ '^\d{4}-\d{2}-\d{2}$');
