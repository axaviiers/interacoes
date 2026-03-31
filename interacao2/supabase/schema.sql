-- ══════════════════════════════════════════════════════════════
-- INTERAÇÃO - Schema do Banco de Dados
-- Execute no SQL Editor do Supabase
-- ══════════════════════════════════════════════════════════════

-- 1. TABELA DE USUÁRIOS
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO users (email, password_hash, name, role) VALUES
  ('alessandra.xavier@intershipping.com.br', 'alessandra26@', 'Alessandra Xavier', 'admin'),
  ('export@intershipping.com.br', 'export10', 'Export Team', 'user'),
  ('nathalia.reis@intershipping.com.br', 'nathalia26@', 'Nathália Reis', 'user'),
  ('vitoria.leticia@intershipping.com.br', 'vitoria26@', 'Vitória Letícia', 'user')
ON CONFLICT (email) DO NOTHING;

-- 2. TABELA DE PROCESSOS
CREATE TABLE IF NOT EXISTS container_processes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stage TEXT NOT NULL DEFAULT 'sem_container'
    CHECK (stage IN ('sem_container', 'contato_terminal', 'aguardando', 'liberado', 'concluido')),
  exportador TEXT NOT NULL,
  reserva TEXT NOT NULL,
  data_retirada DATE,
  data_carregamento DATE,
  quantidade INTEGER DEFAULT 1 CHECK (quantidade > 0),
  tipo_container TEXT DEFAULT '40'' HC',
  transportadora TEXT,
  referencia TEXT,
  comentarios TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  liberated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_proc_stage ON container_processes(stage);
CREATE INDEX IF NOT EXISTS idx_proc_retirada ON container_processes(data_retirada);
CREATE INDEX IF NOT EXISTS idx_proc_liberated ON container_processes(liberated_at) WHERE stage = 'liberado';

-- 3. TABELA DE LOG
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT NOT NULL,
  user_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_act_created ON activity_log(created_at DESC);

-- 4. REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE container_processes;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;

-- 5. RLS (Row Level Security)
ALTER TABLE container_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_processes" ON container_processes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_activity" ON activity_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_read_users" ON users FOR SELECT USING (true);

-- 6. FUNÇÃO AUTO-EXCLUSÃO
CREATE OR REPLACE FUNCTION auto_delete_liberated() RETURNS void AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN DELETE FROM container_processes
    WHERE stage = 'liberado' AND liberated_at IS NOT NULL
    AND liberated_at < NOW() - INTERVAL '2 hours'
    RETURNING exportador, reserva
  LOOP
    INSERT INTO activity_log (text, user_name) VALUES
      ('🤖 Auto-exclusão: ' || r.exportador || ' — ' || r.reserva || ' (liberado há 2h)', 'Sistema');
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 7. CRON (opcional - requer pg_cron habilitado em Database > Extensions)
-- Se pg_cron estiver disponível, descomente e execute:
-- SELECT cron.schedule('auto-delete-liberated', '*/30 * * * *', $$SELECT auto_delete_liberated()$$);
