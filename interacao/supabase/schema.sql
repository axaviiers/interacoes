-- ══════════════════════════════════════════════════════════
-- INTERAÇÃO - Schema do Banco de Dados
-- ══════════════════════════════════════════════════════════
-- Execute este SQL no Supabase SQL Editor:
-- https://supabase.com → Seu Projeto → SQL Editor → New Query
-- ══════════════════════════════════════════════════════════

-- ─── 1. Tabela de Perfis de Usuário ───
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. Tabela Principal de Liberação de Contêineres ───
CREATE TABLE IF NOT EXISTS container_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage TEXT NOT NULL DEFAULT 'sem_container' CHECK (stage IN (
    'sem_container', 'contato_terminal', 'aguardando', 'liberado', 'concluido'
  )),
  exportador TEXT NOT NULL,
  reserva TEXT NOT NULL,
  data_retirada DATE,
  data_carregamento DATE,
  quantidade INTEGER NOT NULL DEFAULT 1,
  tipo_container TEXT NOT NULL DEFAULT '40'' HC',
  transportadora TEXT DEFAULT '',
  referencia TEXT DEFAULT '',
  comentarios TEXT DEFAULT '',
  created_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  liberated_at TIMESTAMPTZ  -- quando entrou no status "liberado" (para auto-exclusão)
);

-- ─── 3. Tabela de Log de Atividade ───
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT 'Sistema',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 4. Índices para Performance ───
CREATE INDEX IF NOT EXISTS idx_releases_stage ON container_releases(stage);
CREATE INDEX IF NOT EXISTS idx_releases_data_retirada ON container_releases(data_retirada);
CREATE INDEX IF NOT EXISTS idx_releases_liberated ON container_releases(liberated_at) WHERE stage = 'liberado';
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC);

-- ─── 5. Row Level Security (RLS) ───
ALTER TABLE container_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Todos usuários autenticados podem ver e editar releases
CREATE POLICY "Authenticated users can view releases"
  ON container_releases FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert releases"
  ON container_releases FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update releases"
  ON container_releases FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete releases"
  ON container_releases FOR DELETE
  TO authenticated
  USING (true);

-- Activity log: todos podem ver e inserir
CREATE POLICY "Authenticated users can view activity"
  ON activity_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert activity"
  ON activity_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Perfis: cada um vê o seu
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- ─── 6. Habilitar Realtime ───
ALTER PUBLICATION supabase_realtime ADD TABLE container_releases;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;

-- ─── 7. Função de Auto-Exclusão (roda a cada 30min via pg_cron) ───
CREATE OR REPLACE FUNCTION auto_delete_expired_liberados()
RETURNS void AS $$
DECLARE
  deleted_record RECORD;
BEGIN
  FOR deleted_record IN
    DELETE FROM container_releases
    WHERE stage = 'liberado'
      AND liberated_at IS NOT NULL
      AND liberated_at < NOW() - INTERVAL '2 hours'
    RETURNING *
  LOOP
    INSERT INTO activity_log (text, user_name)
    VALUES (
      '🤖 Auto-exclusão: ' || deleted_record.exportador || ' — ' || deleted_record.reserva || ' (liberado há 2h)',
      'Sistema'
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 8. Agendar auto-exclusão com pg_cron (executar no Supabase) ───
-- No Supabase: Dashboard → Database → Extensions → Habilitar pg_cron
-- Depois execute:
SELECT cron.schedule(
  'auto-delete-liberados',    -- nome do job
  '*/30 * * * *',             -- a cada 30 minutos
  'SELECT auto_delete_expired_liberados()'
);

-- ══════════════════════════════════════════════════════════
-- CRIAR USUÁRIOS NO SUPABASE AUTH
-- ══════════════════════════════════════════════════════════
-- Vá em: Authentication → Users → Add User (manual)
-- 
-- 1. alessandra.xavier@intershipping.com.br | alessandra26@
-- 2. export@intershipping.com.br            | export10
-- 3. nathalia.reis@intershipping.com.br     | nathalia26@
-- 4. vitoria.leticia@intershipping.com.br   | vitoria26@
--
-- Depois de criar cada usuário, copie o UUID e insira na tabela:
--
-- INSERT INTO user_profiles (id, email, name, role) VALUES
--   ('UUID-DA-ALESSANDRA', 'alessandra.xavier@intershipping.com.br', 'Alessandra Xavier', 'admin'),
--   ('UUID-DO-EXPORT', 'export@intershipping.com.br', 'Export Team', 'user'),
--   ('UUID-DA-NATHALIA', 'nathalia.reis@intershipping.com.br', 'Nathália Reis', 'user'),
--   ('UUID-DA-VITORIA', 'vitoria.leticia@intershipping.com.br', 'Vitória Letícia', 'user');
-- ══════════════════════════════════════════════════════════
