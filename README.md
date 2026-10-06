# beacreativeco-clientes

Sistema de aprovação de conteúdos da BeaCreative (`clientes.beacreativeco.com.br`). Detalhes no `CLAUDE.md`.

## Estrutura

```
index.html              login (admin e clientes)
definir-senha/          criar senha a partir do convite / recuperação
admin/                  área da Bea
cliente/                área do cliente
assets/css/base.css     cores e estilos base
assets/js/config.js     URL e chave anon do Supabase (públicas)
assets/js/supabase.js   cliente do Supabase
assets/js/auth.js       login, perfil e proteção das páginas
functions/api/          Pages Functions (coisas com chave secreta)
supabase/migrations/    migrações do banco
_headers                cabeçalhos de segurança do Cloudflare Pages
```

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
5. Copiar a URL do projeto e a chave **anon/publishable** para `assets/js/config.js`.

## Rodar local

```
npx wrangler pages dev .
```

Abre em `http://localhost:8788`. Segredos locais em `.dev.vars` (copiar de `.dev.vars.example`).
