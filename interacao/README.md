# 📦 Interação — Controle de Liberação de Contêineres

Sistema de controle de liberação de contêineres vazios da **Inter Shipping**.

## Funcionalidades

- **Pipeline visual**: Sem Container → Contato Terminal → Aguard. Estratégia → Liberado → Concluído
- **Login com autenticação**: 4 usuários (1 admin + 3 operacionais)
- **Tempo real**: Supabase Realtime — todos veem mudanças instantaneamente
- **Exclusão automática**: Processos liberados são removidos após 2 horas
- **Exclusão manual**: Qualquer processo pode ser excluído a qualquer momento
- **Destaque urgente**: Processos com retirada para hoje ficam em destaque laranja
- **Ordem cronológica**: Sempre ordenado por data de retirada
- **Log de atividade**: Histórico completo de quem fez o quê
- **Exportar CSV**: Download de todos os dados
- **PWA**: Funciona como app no celular (instalar via "Adicionar à tela inicial")
- **Responsivo**: Desktop e mobile

---

## Stack

| Tecnologia | Função |
|---|---|
| **Next.js 14** | Framework React com App Router |
| **Supabase** | Banco de dados PostgreSQL + Auth + Realtime |
| **Vercel** | Deploy automático + domínio |
| **GitHub** | Versionamento + CI/CD |

---

## Setup Passo a Passo

### 1. Supabase (Banco de Dados)

1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita
2. Clique em **New Project** e escolha um nome (ex: `interacao`)
3. Escolha uma senha para o banco e a região **South America (São Paulo)**
4. Após criar, vá em **SQL Editor** (menu lateral)
5. Cole todo o conteúdo do arquivo `supabase/schema.sql` e clique **Run**
6. Vá em **Settings > API** e copie:
   - `Project URL` → será o `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → será o `NEXT_PUBLIC_SUPABASE_ANON_KEY`

> **Realtime**: O SQL já habilita automaticamente. Todos os usuários verão mudanças em tempo real.

> **Auto-exclusão**: O SQL cria um cron job que roda a cada 30 min. Para habilitá-lo, vá em **Database > Extensions** e ative `pg_cron`.

### 2. GitHub (Repositório)

1. Acesse [github.com](https://github.com) e crie um novo repositório: `intershipping/interacao`
2. No seu computador, clone e copie os arquivos:

```bash
git clone https://github.com/intershipping/interacao.git
cd interacao
# Copie todos os arquivos deste projeto para cá
git add .
git commit -m "feat: sistema interação v1"
git push origin main
```

### 3. Vercel (Deploy)

1. Acesse [vercel.com](https://vercel.com) e faça login com GitHub
2. Clique em **Add New > Project**
3. Selecione o repositório `intershipping/interacao`
4. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL` = (cole a URL do passo 1)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (cole a key do passo 1)
5. Clique em **Deploy**
6. (Opcional) Configure domínio customizado: `interacao.intershipping.com.br`

### 4. Instalar como App no Celular

1. Acesse o sistema pelo navegador no celular
2. **iPhone**: Toque no ícone de compartilhar → "Adicionar à Tela Início"
3. **Android**: Toque nos 3 pontinhos → "Adicionar à tela inicial"
4. O sistema abre como app nativo!

---

## Usuários

| E-mail | Senha | Papel |
|---|---|---|
| alessandra.xavier@intershipping.com.br | alessandra26@ | Admin |
| export@intershipping.com.br | export10 | Operacional |
| nathalia.reis@intershipping.com.br | nathalia26@ | Operacional |
| vitoria.leticia@intershipping.com.br | vitoria26@ | Operacional |

---

## Estrutura de Arquivos

```
interacao/
├── app/
│   ├── globals.css          # Estilos globais + animações
│   ├── layout.tsx           # Layout raiz + PWA meta tags
│   └── page.tsx             # Aplicação principal
├── lib/
│   └── supabase.ts          # Cliente Supabase + funções CRUD + Realtime
├── public/
│   └── manifest.json        # PWA manifest
├── supabase/
│   └── schema.sql           # SQL completo (tabelas + RLS + cron)
├── .env.local.example       # Template de variáveis de ambiente
├── .gitignore
├── next.config.js
├── package.json
├── tsconfig.json
└── README.md
```

---

## Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.local.example .env.local
# Edite .env.local com as credenciais do Supabase

# Rodar em desenvolvimento
npm run dev

# Acesse http://localhost:3000
```

---

## Ícone do App (PWA)

Para o ícone funcionar no celular, adicione na pasta `public/`:
- `icon-192.png` (192×192 pixels) — ícone padrão
- `icon-512.png` (512×512 pixels) — ícone de alta resolução

Use o logo da Inter Shipping redimensionado.

---

© Inter Shipping — Interação v1.0
