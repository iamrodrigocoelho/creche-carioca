-- Torna o erro de violacao append-only legivel.
--
-- A versao anterior usava ERRCODE 'restrict_violation' (SQLSTATE 23001). O Prisma
-- traduz toda a classe 23 para "Foreign key constraint violated" e descarta a
-- mensagem original, escondendo a causa real de quem opera o sistema.
--
-- Sem ERRCODE explicito o PostgreSQL usa P0001 (raise_exception), que o Prisma
-- repassa com a mensagem intacta. O texto cita apenas tabela e operacao, sem
-- vazar detalhe interno (PRD 13.5).

CREATE OR REPLACE FUNCTION match_append_only_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'A tabela % e append-only: % nao e permitido (PRD 13.8).',
    TG_TABLE_NAME, TG_OP;
END;
$$;
