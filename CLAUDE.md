# Sistema de Aprovação BeaCreative

Portal onde a BeaCreative (agência de social media da Beatriz) envia conteúdos para os clientes aprovarem, com pré-visualização igual ao Instagram, prazos, calendário e conversa por conteúdo.

- Endereço: `clientes.beacreativeco.com.br` (projeto próprio no Cloudflare Pages, deploy automático da branch `main`)
- Site institucional (outro repositório, não mexer daqui): `beacreativeco/beacreativeco` em `beacreativeco.com.br`
- Documento de escopo completo: https://claude.ai/code/artifact/7e520d1f-902d-4adc-ac15-e2529fa60c38

## Stack

- Front: HTML, CSS e JavaScript puro (sem framework, sem build obrigatório). Mobile-first.
- Backend: Supabase (Postgres, Auth, Realtime). Cliente JS do Supabase via CDN ou ES module.
- Arquivos (imagens, vídeos, áudios): Cloudflare R2.
- Funções no servidor: Cloudflare Pages Functions (`/functions`), para tudo que usa chave secreta (R2, Trello, Drive, e-mail).
- E-mail transacional: Resend (ou similar), a definir na implementação.

## Regras de segurança (inegociáveis)

- `service_role` do Supabase, chaves do R2, Trello e e-mail NUNCA vão para o front nem para o Git. Ficam em variáveis de ambiente do Cloudflare Pages e em `.dev.vars` local (no `.gitignore`).
- No front só entra a URL do projeto e a chave `anon`/publishable do Supabase.
- Todo acesso a dados é protegido por RLS (Row Level Security) no Postgres:
  - Cliente só lê os próprios conteúdos com status diferente de `rascunho`, nunca `observacao_interna`.
  - Cliente com `login_ativo = false` não lê nada.
  - Só a admin (Beatriz) cria e edita clientes e conteúdos.
- Migrações do banco versionadas em `supabase/migrations/`.

## Perfis

| Perfil | Acesso |
| --- | --- |
| Admin (Beatriz, única por enquanto) | Login e-mail/senha; tudo |
| Cliente | Login e-mail/senha a partir de convite da Bea; Bea suspende/reativa a qualquer momento |
| Visitante | Só a vitrine pública (no site institucional, lendo dados liberados) |

## Situações de um conteúdo

`rascunho` → `em_aprovacao` → `aprovado` (pelo cliente ou por prazo)
`em_aprovacao` → `ajuste_solicitado` → nova versão → `em_aprovacao`

- Aprovação registra `aprovado_em` (data e hora), `aprovado_versao` e `aprovado_por` (`cliente` ou `prazo`).
- Vitrine não é situação: é a coluna booleana `na_vitrine`. O conteúdo continua `aprovado` e a vitrine é um extra.
- Nova versão preserva as anteriores no histórico.
- Bea pode retirar um conteúdo de `em_aprovacao` (volta a `rascunho`).

## Modelo de dados (base)

- `clientes`: id, nome, slug, logo, foto_perfil, instagram, whatsapp, email, drive_pasta_url, trello_board_id, contrato_ativo, contrato_inicio, login_ativo, prazo_padrao_dias, aprovacao_automatica_dias, user_id (auth)
- `conteudos`: id, cliente_id, titulo, formato (post, carrossel, story, reels), legenda, data_prevista, prazo_aprovacao, aprovacao_automatica, aprovado_por, aprovado_em, aprovado_versao, drive_url, status, versao_atual, na_vitrine (boolean), trello_card_id
- `conteudos_internos`: conteudo_id, observacao_interna (só admin; fica fora de `conteudos` porque RLS filtra linhas, não colunas)
- `midias`: id, conteudo_id, versao, tipo (imagem, video), arquivo_url, otimizado_url, tamanho_mb, ordem
- `mensagens`: id, conteudo_id, versao, autor (bea, cliente), tipo (texto, audio, referencia, aprovacao), texto, arquivo_url, criado_em
- `notificacoes`: id, destinatario, conteudo_id, canal, lida, criado_em
- `depoimentos`: id, cliente_id, texto, nome_autor, cargo, liberado_vitrine

## Identidade visual

- Cores: creme `#FFF5E9` (fundo), espresso `#4D3B31` (texto, contornos), periwinkle `#7B85CE` (ações, botão Aprovado, destaques)
- Fontes: The Seasons (Adobe Fonts, títulos; o subdomínio precisa estar no kit) e Poppins (Google Fonts, texto)
- Símbolo: ✦ (botão "✦ Aprovado", selo "novo")
- Exceção: a pré-visualização do Instagram usa o visual do próprio app, fiel ao que vai ao ar.
- Definir as cores como variáveis CSS em `:root` num arquivo de estilos base.

## Fases

1. **MVP:** login (Bea e clientes) com suspensão; cadastro de clientes; conteúdos (post, carrossel, story); página do cliente com preview estilo Instagram e link do Drive; aprovar/pedir ajuste com texto e referências; prazo; envio do link (WhatsApp com mensagem pronta via `wa.me`, e-mail, Instagram, copiar); notificação por e-mail.
2. Áudio e versões; reels e vídeos (versão otimizada, download, aviso de vídeo grande para ver no Drive); aprovação automática por prazo e lembretes; calendário de publicações; caixa de respostas; Trello; aviso no celular (PWA).
3. Vitrine no site com logos e depoimentos; Drive via API; WhatsApp automático (ainda em pesquisa, não implementar sem decisão).

## Como trabalhar neste repositório

- Comunicação em português, informal.
- Antes de adicionar algo fora do pedido, propor e esperar aprovação.
- Entregas pequenas e testáveis; mostrar o que mudou em cada etapa.
- Não traduzir nomes de arquivos especiais (ex.: `_headers` tem que manter esse nome exato).
- Testar sempre no celular (largura ~375px) e no desktop.
