# beacreativeco-clientes

Sistema de aprovação de conteúdos da BeaCreative (`clientes.beacreativeco.com.br`). Detalhes no `CLAUDE.md`.

## Estrutura

Só a pasta `public/` vai para o ar. O resto (migrações, docs, segredos locais) fica fora do site.

```
public/                     tudo que o navegador acessa
  index.html                login (admin e clientes)
  definir-senha/            criar senha a partir do convite / recuperação
  admin/                    área da Bea (clientes)
  cliente/                  área do cliente
  assets/css/base.css       cores e estilos base
  assets/js/                config, cliente Supabase, login, painel
  _headers                  cabeçalhos de segurança do Cloudflare Pages
functions/api/              Pages Functions (usam chave secreta)
supabase/migrations/        migrações do banco
```

## Cloudflare Pages

Em **Settings → Builds & deployments**: Build command vazio e **Build output directory `public`**.
Em **Settings → Environment variables** (Production): `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (marcar como secret).

## Configurar o Supabase (uma vez)

1. Rodar `supabase/migrations/20261005000000_schema_inicial.sql` no SQL Editor (ou `supabase db push` com a CLI).
2. **Authentication → Sign In / Providers**: desligar "Allow new users to sign up". Clientes entram só por convite.
3. **Authentication → URL Configuration**:
   - Site URL: `https://clientes.beacreativeco.com.br`
   - Redirect URLs: `https://clientes.beacreativeco.com.br/definir-senha/` e `http://localhost:8788/definir-senha/`
4. Criar a conta da Bea em **Authentication → Users → Add user** e depois, no SQL Editor:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'EMAIL-DA-BEA';
   ```
5. Copiar a URL do projeto e a chave **anon/publishable** para `public/assets/js/config.js`.

## Rodar local

```
npx wrangler pages dev public --port 8788
```

Abre em `http://localhost:8788`. Segredos locais em `.dev.vars` (copiar de `.dev.vars.example`).
