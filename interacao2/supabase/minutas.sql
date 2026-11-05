-- ══════════════════════════════════════════════════════════════
-- INTERAÇÃO - Módulo CONTROLE DE MINUTA
-- Supabase > SQL Editor > New query > cole tudo > Run
-- (pode rodar mais de uma vez sem problema)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS minutas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking TEXT NOT NULL,
  data_vencimento DATE NOT NULL,
  exportador TEXT,
  observacao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'resolvida')),
  created_by TEXT,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_minutas_venc ON minutas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_minutas_status ON minutas(status);

ALTER TABLE minutas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_minutas" ON minutas;
CREATE POLICY "allow_all_minutas" ON minutas FOR ALL USING (true) WITH CHECK (true);

-- Realtime (atualiza a tela de todo mundo na hora)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE minutas;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
