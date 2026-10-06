# Sistema de Aprovação BeaCreative

Portal onde a BeaCreative (agência de social media da Beatriz) envia conteúdos para os clientes aprovarem, com pré-visualização igual ao Instagram, prazos, calendário e conversa por conteúdo.

- Endereço: `clientes.beacreativeco.com.br` (projeto próprio no Cloudflare Pages, deploy automático da branch `main`). **Ainda não publicado:** por enquanto tudo roda só no localhost; a publicação é o último item do `ROADMAP.md`.
- Ordem das entregas em `ROADMAP.md`: ao fim de cada uma, atualizar o arquivo e dizer qual é a próxima. Não fazer push sem pedido.
- Site institucional (outro repositório, não mexer daqui): `beacreativeco/beacreativeco` em `beacreativeco.com.br`
- Documento de escopo completo: https://claude.ai/code/artifact/7e520d1f-902d-4adc-ac15-e2529fa60c38

## Stack

- Front: HTML, CSS e JavaScript puro (sem framework, sem build obrigatório). Mobile-first.
- Backend: Supabase (Postgres, Auth, Realtime). Cliente JS do Supabase via CDN ou ES module.
- Arquivos (imagens, vídeos, áudios): Cloudflare R2, acessado só pelo binding `MIDIAS` das Pages Functions (sem chaves de acesso do R2).
  - Upload sempre em partes (multipart, 10 MiB por parte) pelas funções em `functions/api/midias/`, para passar do limite de corpo de requisição das Functions e aguentar vídeos grandes.
  - Entrega por `functions/api/midia/[[caminho]].js`, com suporte a Range (o player do vídeo consegue pular) e `?download=1` para baixar a versão do sistema com o nome do arquivo.
  - Os links de arquivo não exigem login: a proteção é a chave impossível de adivinhar (`<conteudo_id>/<uuid>.<ext>`). Decisão consciente para prévias de agência.
  - Local: `wrangler pages dev public --r2 MIDIAS` usa um bucket simulado em `.wrangler/`. Em produção, o R2 ainda não está ativado na conta (a Bea vai decidir sobre o cartão); quando ativar, criar o bucket `beacreativeco-midias` e o binding `MIDIAS` no Pages.
  - Regras de armazenamento: ver a seção "Armazenamento (nunca passar dos 10 GB grátis do R2)".
- Funções no servidor: Cloudflare Pages Functions (`/functions`), para tudo que usa chave secreta (R2, Trello, Drive, e-mail).
- Só a pasta `public/` é publicada (Build output directory no Cloudflare Pages). Páginas e assets vão nela; `functions/`, `supabase/` e docs ficam na raiz, fora do site.
- E-mail transacional: Resend (ou similar), a definir na implementação.

## Armazenamento (nunca passar dos 10 GB grátis do R2)

- **Otimizar antes de subir, no navegador da Bea.** O sistema guarda só a versão leve; o original de alta qualidade fica no Google Drive.
  - Imagens: caber em 1080 × 1920 (nunca aumentar), JPEG qualidade 85% (`public/assets/js/otimizar.js`).
  - Vídeos: Mediabunny (WebCodecs, aceleração do computador) em H.264, lado menor até 1080, até 30 fps, ~4 Mbps, áudio AAC, com barra de progresso. Navegador sem suporte: o envio é recusado (nunca sobe o original).
  - O servidor só aceita o resultado otimizado: JPEG até 8 MB e MP4 até 300 MB.
  - Baixar: quando o original não está no sistema, o botão aponta pro Drive (`drive_url` do conteúdo).
- **Exclusão automática por tempo** com Lifecycle Rules do R2, separando os arquivos por pasta (prefixo):
  - Conteúdos em andamento: sem regra de exclusão.
  - Conteúdos aprovados: apagados 30 dias depois da aprovação.
  - Conteúdos na vitrine (`na_vitrine`): pasta separada, **nunca** apagados.
  - Arquivo já apagado: a tela mostra "Arquivo expirado, veja no Drive" com o link, nunca imagem quebrada.
- Painel da Bea mostra quanto do espaço já foi usado (soma de `tamanho_mb` no banco dos arquivos não expirados, aproximada; aviso a partir de 8 GB).

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
- O cliente aprova ou pede ajuste só pelas funções `aprovar_conteudo(p_conteudo_id)` e `pedir_ajuste(p_conteudo_id, p_texto)` (security definer; só conteúdo dele em `em_aprovacao`). Cada uma grava uma linha em `mensagens` (`aprovacao` ou `texto`), que vira o histórico no editor e na página do cliente. Erros pensados para o cliente usam `P0001`.
- Página do cliente: `/cliente/` (lista) e `/cliente/conteudo/?id=` (prévia + decisão). Aprovar pede confirmação (dois toques).
- Conversa por conteúdo (`public/assets/js/conversa.js`, igual nos dois lados): balões, tempo real (Realtime em `mensagens`, respeita o RLS), lida via `marcar_conversa_lida` (sem setTimeout: aba de fundo segura timers). "Pedir ajuste" põe a conversa em modo pedido: a próxima mensagem vai por `pedir_ajuste` com `pedido_ajuste = true`. Cliente só insere mensagem válida (`mensagem_valida`) nos próprios conteúdos; arquivos da conversa ficam em `<conteudo_id>/conversa/`.
- Editar/apagar mensagem só por `editar_mensagem` (só texto, até 15 min) e `apagar_mensagem` (até 48 h); só as próprias, nunca aprovação nem pedido de ajuste. Ninguém tem UPDATE/DELETE direto em `mensagens` (a Bea só lê tudo e insere como `bea`). Apagada vira "Mensagem apagada" no lugar. Com arquivo, apagar passa por `/api/conversa/apagar`, que chama a função com o login de quem pediu e tira o arquivo do R2.
- Arquivos da conversa sobem por `PUT /api/conversa/arquivo?conteudo_id=` (Bea ou cliente dono, fora de rascunho; JPEG até 8 MB, áudio M4A/WEBM até 5 MB) e a mensagem é criada depois pelo navegador (o RLS confere a pasta). `POST /api/conversa/limpar` (só admin) apaga a pasta `conversa/` do conteúdo antes de excluir um rascunho.
- Bea: "Mensagens" no topo de todo o painel (`avisos-admin.js`, ligado por `ui.js`), Caixa de mensagens em `/admin/mensagens/` (`caixa_de_mensagens`), aviso clicável e notificação do navegador (permissão pedida na Caixa). Listas recebem o evento `mensagens-mudaram`.

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
  - Componente `public/assets/js/previa-instagram.js` + `public/assets/css/previa.css` (usado no editor e, depois, na página do cliente). Estilo da "Prévia de mídia social" do CapCut.
  - Reels e Story em 9:16 com a interface nas posições reais; post e carrossel no feed em 4:5.
  - Carrossel: deslizar com encaixe (uma imagem por vez), setinhas nas laterais só em telas com mouse (somem na primeira/última) e setas do teclado com a prévia em foco; contador e bolinhas acompanham; mudar a ordem no editor mantém a posição. Ícones desenhados por nós, sem logo do Instagram.
  - Legenda em tempo real, como no app: no feed começa com o @ em negrito e fica acima de "Ver todos os comentários"; no Reels fica por cima do vídeo, embaixo. Corte medido de verdade em 2 linhas com "… mais" (clicar abre inteira), mantendo quebras de linha e emojis; #hashtags e @menções na cor de link. Story não tem legenda no Instagram: o texto aparece embaixo da tela, com esse aviso.
  - A página do cliente usa este mesmo componente (sem as "Áreas cobertas").
  - Botão "Ocultar interface" para ver o vídeo limpo. "Áreas cobertas" (só no editor da Bea) destaca as faixas da interface, em pixels de 1080 × 1920: Reels 250 em cima, 420 embaixo e 230 à direita (a partir de 960); Story 250 em cima e 340 embaixo.
- Definir as cores como variáveis CSS em `:root` num arquivo de estilos base.

## Fases

1. **MVP:** login (Bea e clientes) com suspensão; cadastro de clientes; conteúdos (post, carrossel, story e reels) com imagens e vídeos (upload de arquivos grandes, story em vídeo, player na pré-visualização, botão de baixar o original); página do cliente com preview estilo Instagram e link do Drive; aprovar/pedir ajuste com texto e referências; prazo; envio do link (WhatsApp com mensagem pronta via `wa.me`, e-mail, Instagram, copiar); notificação por e-mail.
2. Áudio e versões; versão otimizada dos vídeos (mais leve para assistir) e aviso de vídeo grande para ver no Drive; aprovação automática por prazo e lembretes; calendário de publicações; caixa de respostas; Trello; aviso no celular (PWA).
3. Vitrine no site com logos e depoimentos; Drive via API; WhatsApp automático (ainda em pesquisa, não implementar sem decisão).

## Como trabalhar neste repositório

- Comunicação em português, informal.
- Antes de adicionar algo fora do pedido, propor e esperar aprovação.
- Entregas pequenas e testáveis; mostrar o que mudou em cada etapa.
- Não traduzir nomes de arquivos especiais (ex.: `_headers` tem que manter esse nome exato).
- Testar sempre no celular (largura ~375px) e no desktop.
