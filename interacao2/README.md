# 📦 Interação — Inter Shipping

Controle de Liberação de Contêineres Vazios.

## Setup

### 1. Supabase
- Crie projeto em [supabase.com](https://supabase.com)
- SQL Editor → cole `supabase/schema.sql` → Run
- Settings > API → copie URL e anon key

### 2. GitHub
```bash
git add . && git commit -m "v1" && git push
```

### 3. Vercel
- Import repo em [vercel.com](https://vercel.com)
- Environment Variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Deploy

### 4. App no celular
- Acesse a URL → "Adicionar à tela inicial"

## Usuários

| E-mail | Senha | Papel |
|---|---|---|
| alessandra.xavier@intershipping.com.br | alessandra26@ | Admin |
| export@intershipping.com.br | export10 | User |
| nathalia.reis@intershipping.com.br | nathalia26@ | User |
| vitoria.leticia@intershipping.com.br | vitoria26@ | User |

## Dev local
```bash
npm install
cp .env.local.example .env.local  # preencha
npm run dev
```
