# Sistema de Aprovação BeaCreative

Portal onde a BeaCreative (agência de social media da Beatriz) envia conteúdos para os clientes aprovarem, com pré-visualização igual ao Instagram, prazos, calendário e conversa por conteúdo.

- Endereço: `clientes.beacreativeco.com.br` (projeto próprio no Cloudflare Pages, deploy automático da branch `main`). No ar desde 06/10/2026 (versão 1.0.0). Teste: `https://dev.beacreativeco-clientes.pages.dev` (branch `dev`, ver "Branches e ambientes"). Local: `npx wrangler pages dev public --port 8788 --r2 MIDIAS`.
- Ordem das entregas em `ROADMAP.md`: ao fim de cada uma, atualizar o arquivo e dizer qual é a próxima. Push: ver "Branches e ambientes".
- Site institucional (outro repositório, não mexer daqui): `beacreativeco/beacreativeco` em `beacreativeco.com.br`
- Documento de escopo completo: https://claude.ai/code/artifact/7e520d1f-902d-4adc-ac15-e2529fa60c38

## Branches e ambientes (igual ao LAEG-BIO)

- **Todo trabalho novo vai na branch `dev`. Nada direto na `main`.** Commits na `dev`; **sempre que uma entrega ficar pronta, push na `dev` sem perguntar** (o push publica no Preview). Na `main`, nunca, a não ser com "pode subir pra produção".
- A Cloudflare publica a `dev` (Preview) em `https://dev.beacreativeco-clientes.pages.dev`, onde o Victor testa.
- **Não criar outras branches além da `dev` sem avisar o Victor antes:** a Cloudflare está em "All non-Production branches", então qualquer branch nova vira um Preview publicado.
- **Só juntar a `dev` na `main` quando o Victor disser "pode subir pra produção".** Aí, na `main`: subir a versão, entrada no `public/CHANGELOG.md`, commit `Versão X.Y.Z`, tag e Release (ver "Versão"). Depois, trazer a `main` de volta para a `dev`.
- Na `dev`, o `ROADMAP.md` é atualizado a cada entrega, mas a versão e o CHANGELOG só mudam na subida para produção.
- O Preview usa o **mesmo Supabase e o mesmo R2 da produção** (dados reais): testar com o cliente de teste (victordev, "quadro - teste" no Trello), nunca mexendo em conteúdo de cliente de verdade.
- **Webhooks do Trello e e-mails para clientes reais só pela produção.** No Preview (e no localhost), nada registra webhook nem manda e-mail para cliente de verdade: `ehProducao(request)` em `functions/_lib/ambiente.js` (só o host `clientes.beacreativeco.com.br`) protege `/api/trello/webhooks`, e todo envio de e-mail novo (avisos, item 6) tem que passar pela mesma checagem. O convite (`/api/convidar`) é disparado à mão pela Bea: no Preview, só para e-mails de teste.
- Cloudflare (Settings → Builds & deployments): branch de produção `main`; Preview com a `dev` liberada. As variáveis e o binding `MIDIAS` precisam existir também no ambiente Preview. No Supabase, as Redirect URLs incluem `https://dev.beacreativeco-clientes.pages.dev/` e `…/definir-senha/`.

## Stack

- Front: HTML, CSS e JavaScript puro (sem framework, sem build obrigatório). Mobile-first.
- Backend: Supabase (Postgres, Auth, Realtime). Cliente JS do Supabase via CDN ou ES module.
- Arquivos (imagens, vídeos, áudios): Cloudflare R2, acessado só pelo binding `MIDIAS` das Pages Functions (sem chaves de acesso do R2).
  - Upload sempre em partes (multipart, 10 MiB por parte) pelas funções em `functions/api/midias/`, para passar do limite de corpo de requisição das Functions e aguentar vídeos grandes.
  - Entrega por `functions/api/midia/[[caminho]].js`, com suporte a Range (o player do vídeo consegue pular) e `?download=1` para baixar a versão do sistema com o nome do arquivo.
  - Os links de arquivo não exigem login: a proteção é a chave impossível de adivinhar (`<conteudo_id>/<uuid>.<ext>`). Decisão consciente para prévias de agência.
  - Local: `wrangler pages dev public --r2 MIDIAS` usa um bucket simulado em `.wrangler/` (sem Lifecycle Rules: para testar a expiração, mudar `expira_em` no banco). Em produção: R2 ativado na conta da BeaCreative, bucket `beacreativeco-midias` criado (Standard, acesso público desativado), alerta de orçamento de US$ 1 e de uso em 9 GB. Binding `MIDIAS` e variáveis configurados no Pages (Production).
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
- **Pastas (prefixos) no bucket**, cada uma com a sua Lifecycle Rule no R2 (`functions/_lib/midias.js`):
  - `trabalho/<conteudo_id>/…` (rascunho, com o cliente, em ajuste, versões antigas, conversa): **sem regra**.
  - `aprovados/<conteudo_id>/…`: regra **"apagar 30 dias depois"** (`DIAS_APROVADOS`).
  - `vitrine/<conteudo_id>/…` (`na_vitrine`): **nunca** apagados (nenhuma regra com esse prefixo).
  - `perfil/<uuid>.jpg` (fotos de perfil, 400 × 400, até 1 MB, por `/api/perfil/foto`): sem regra; a anterior é apagada quando a foto é trocada.
  - Bucket inteiro: regra **"cancelar uploads em partes incompletos depois de 1 dia"**.
  - Nunca criar regra de exclusão sem prefixo (pegaria a vitrine).
  - `conversa/<cliente_id>/…` (imagem e áudio mandados na conversa sem conteúdo): regra **"apagar 30 dias depois"** (`DIAS_CONVERSA`). Com conteúdo, o arquivo da conversa fica na pasta do conteúdo (`<pasta>/<conteudo_id>/conversa/`) e muda com ele.
  - Chaves antigas, sem pasta (`<conteudo_id>/…`), continuam válidas e contam como trabalho.
- **Mudança de pasta:** o arquivo nasce na pasta da situação do conteúdo e, quando a situação muda, `/api/conteudo/organizar` (chamado pela página depois de enviar, retirar, aprovar ou pedir ajuste) copia para a pasta nova, atualiza o banco e só então apaga a chave antiga (`functions/_lib/armazenamento.js`). Como a cópia é um objeto novo, a regra do R2 conta a partir da aprovação. O mesmo endpoint acerta o cartão do Trello.
- **Expiração na tela:** `midias.expira_em` e `mensagens.arquivo_expira_em` (data em que o R2 apaga). Passou da data, ou o arquivo deu 404: a tela mostra "Arquivo expirado, veja no Drive" com o link, nunca imagem quebrada (prévia, editor e conversa).
- **Espaço usado:** página Clientes, pela função `espaco_usado()` (soma de `midias.tamanho_mb` e `mensagens.arquivo_mb` não expirados, aproximada; só admin); aviso a partir de 8 GB.

## Regras de segurança (inegociáveis)

- `service_role` do Supabase, chaves do R2, Trello, e-mail e a chave privada VAPID (`VAPID_PRIVATE_KEY`) NUNCA vão para o front nem para o Git. Ficam em variáveis de ambiente do Cloudflare Pages e em `.dev.vars` local (no `.gitignore`).
- No front só entra a URL do projeto e a chave `anon`/publishable do Supabase.
- Todo acesso a dados é protegido por RLS (Row Level Security) no Postgres:
  - Cliente só lê os próprios conteúdos com status diferente de `rascunho`, nunca `observacao_interna`.
  - Cliente com `login_ativo = false` não lê nada.
  - Só a admin (Beatriz) cria e edita clientes e conteúdos.
- Migrações do banco versionadas em `supabase/migrations/`.

## Perfis

- App instalável (PWA): `site.webmanifest` (standalone, ícones comuns e maskable) e `sw.js`, que não guarda cache (sem build não há como versionar o cache; tudo vem da rede, só a navegação sem internet ganha uma página). Convite e item "Instalar o sistema" do menu do avatar em `instalar.js` (ligado por `ui.js`), no padrão do LAEG-BIO: "Agora não" pausa 30 dias, "Não mostrar de novo" desliga o convite automático.
- Entrar com o Google (`entrarComGoogle` em `auth.js`): o cadastro de novos usuários fica desligado no Supabase, então só entra o Google cujo e-mail já tem acesso (o Supabase junta as duas formas de entrar na mesma conta). Conta sem acesso volta ao login com o aviso (`erroDoGoogle`).

| Perfil | Acesso |
| --- | --- |
| Admin (Beatriz, única por enquanto) | Login e-mail/senha ou Google; tudo. Menu do avatar no topo (`perfil-menu.js`, montado por `ui.js`) e Meu perfil em `/admin/perfil/` (foto, nome, troca de e-mail com confirmação, troca de senha pedindo a atual, dados da agência) |
| Cliente | Login e-mail/senha ou Google (mesmo e-mail do cadastro) a partir de convite da Bea; Bea suspende/reativa a qualquer momento; exclui de vez só depois de suspenso (ou sem convite), digitando o nome (`/api/clientes/excluir`: apaga R2, conteúdos, login e cadastro; com vitrine mantida, o cadastro fica com `arquivado_em` e some das listas) |
| Visitante | Só a vitrine pública (no site institucional, lendo dados liberados) |

## Situações de um conteúdo

`rascunho` → `em_aprovacao` → `aprovado` (pelo cliente ou por prazo)
`em_aprovacao` → `ajuste_solicitado` → nova versão → `em_aprovacao`

- Aprovação registra `aprovado_em` (data e hora), `aprovado_versao` e `aprovado_por` (`cliente` ou `prazo`).
- Vitrine não é situação: é a coluna booleana `na_vitrine`. O conteúdo continua `aprovado` e a vitrine é um extra.
- Nova versão preserva as anteriores no histórico.
- Bea pode retirar um conteúdo de `em_aprovacao` (volta a `rascunho`).
- O cliente aprova ou pede ajuste só pelas funções `aprovar_conteudo(p_conteudo_id)` e `pedir_ajuste(p_conteudo_id, p_texto)` (security definer; só conteúdo dele em `em_aprovacao`). Cada uma grava uma linha em `mensagens` (`aprovacao` ou `texto`), que vira o histórico no editor e na página do cliente. Erros pensados para o cliente usam `P0001`.
- Página do cliente: `/cliente/` (lista), `/cliente/conteudo/?id=` (prévia + decisão) e `/cliente/mensagens/` (conversa com a Bea). Aprovar pede confirmação (dois toques).
- Conversa por cliente (`public/assets/js/conversa.js`, igual nos dois lados; migração `20261019000000`): uma conversa só entre a Bea e cada cliente (`mensagens.cliente_id`), e cada mensagem pode ter um conteúdo (`conteudo_id`, opcional), mostrado como cartão no balão. Aba Mensagens: `/admin/mensagens/?cliente=` (lista + conversa) e `/cliente/mensagens/`. Com `conteudoId`, o componente mostra só a parte da conversa sobre aquele conteúdo (`?conteudo=`, faixa "Ver tudo"). A tela do conteúdo não tem mais conversa: mostra o último pedido de ajuste e "Conversar sobre este conteúdo (N)" (`resumo-conversa.js`). Na conversa inteira, o clipe anexa um conteúdo à próxima mensagem, e "Pedir ajuste" (tela do conteúdo do cliente) abre `/cliente/mensagens/?conteudo=…&ajuste=1` com o conteúdo anexado. Um gatilho preenche o cliente pelo conteúdo e marca `so_bea` quando a Bea escreve num rascunho (o cliente nunca vê essas). Balões, tempo real (Realtime em `mensagens`, respeita o RLS), lida via `marcar_conversa_do_cliente_lida` (inteira) ou `marcar_conversa_lida` (filtrada; uma mensagem conta como lida se foi vista em qualquer uma) (sem setTimeout: aba de fundo segura timers). "Pedir ajuste" põe a conversa em modo pedido: a próxima mensagem vai por `pedir_ajuste` com `pedido_ajuste = true`. Cliente só insere mensagem válida (`mensagem_valida`) na própria conversa (e só com conteúdos que ele vê); arquivos da conversa ficam em `<conteudo_id>/conversa/` ou, sem conteúdo, em `conversa/<cliente_id>/`.
- Editar/apagar mensagem só por `editar_mensagem` (só texto, até 15 min) e `apagar_mensagem` (até 48 h); só as próprias, nunca aprovação nem pedido de ajuste. Ninguém tem UPDATE/DELETE direto em `mensagens` (a Bea só lê tudo e insere como `bea`). Apagada vira "Mensagem apagada" no lugar. Com arquivo, apagar passa por `/api/conversa/apagar`, que chama a função com o login de quem pediu e tira o arquivo do R2.
- Arquivos da conversa sobem por `PUT /api/conversa/arquivo?conteudo_id=` (Bea ou cliente dono, fora de rascunho) ou `?cliente_id=` (sem conteúdo; JPEG até 8 MB, áudio M4A/WEBM até 5 MB) e a mensagem é criada depois pelo navegador (o RLS confere a pasta). `POST /api/conversa/limpar` (só admin) apaga a pasta `conversa/` do conteúdo antes de excluir um rascunho.
- Bea: "Mensagens" no topo de todo o painel (`avisos-admin.js`, ligado por `ui.js`), aba Mensagens em `/admin/mensagens/` (`conversas_por_cliente`; `caixa_de_mensagens` só fica para a versão antiga), aviso clicável levando à conversa do cliente e notificação do navegador (permissão pedida na Caixa). Listas recebem o evento `mensagens-mudaram`.

## Notificações push

- Web Push com VAPID, sem pacote npm: `functions/_lib/webpush.js` (criptografia `aes128gcm` da RFC 8291 e JWT ES256 com o WebCrypto). `avisarUsuario(env, userId, { titulo, corpo, url, tag })` manda para todos os aparelhos da pessoa e apaga os que respondem 404/410.
- Aparelhos em `push_aparelhos` (cada um vê e remove os seus; inclui só por `registrar_aparelho`). Front em `public/assets/js/notificacoes.js` (seção "Notificações" do Meu perfil, Bea e cliente); permissão pedida só no toque em "Ativar notificações". iPhone/iPad: só com o sistema instalado na tela de início.
- `public/sw.js` mostra o aviso (mesma `tag` substitui) e, ao tocar, abre `url` (só caminhos do próprio site). Com a tela do aviso aberta e em foco, não mostra, exceto no Safari (o WebKit cancela a inscrição de quem recebe push sem aviso).
- Chave pública em `config.js` (`VAPID_PUBLIC_KEY`); `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` e `PUSH_SEGREDO` como Secret no Cloudflare (Production e Preview) e no `.dev.vars`.

## Modelo de dados (base)

- `admins`: user_id, nome, foto_url (clientes leem só nome e foto, pela função `perfil_bea()`)
- `agencia` (uma linha, `id = true`): nome, whatsapp, instagram, email_contato (envio do link e e-mails)
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
  - Abre nos arquivos crus (foto inteira, vídeo com os controles do navegador); "Ver prévia" liga a simulação. Na prévia, quem vê escolhe os arquivos (miniaturas) e o formato, só entre os possíveis (`formatosPossiveis`: 1 vídeo → Reels/Story; 1 imagem → Post/Story; 2+ → Carrossel). Começa no formato cadastrado (`selecaoInicial`) e nada disso grava no banco.
  - Botão "Ocultar interface" para ver o vídeo limpo. "Áreas cobertas" (só no editor da Bea) destaca as faixas da interface, em pixels de 1080 × 1920: Reels 250 em cima, 420 embaixo e 230 à direita (a partir de 960); Story 250 em cima e 340 embaixo.
- Definir as cores como variáveis CSS em `:root` num arquivo de estilos base.

## Fases

1. **MVP:** login (Bea e clientes) com suspensão; cadastro de clientes; conteúdos (post, carrossel, story e reels) com imagens e vídeos (upload de arquivos grandes, story em vídeo, player na pré-visualização, botão de baixar o original); página do cliente com preview estilo Instagram e link do Drive; aprovar/pedir ajuste com texto e referências; prazo; envio do link (WhatsApp com mensagem pronta via `wa.me`, e-mail, Instagram, copiar); notificação por e-mail.
2. Áudio e versões; versão otimizada dos vídeos (mais leve para assistir) e aviso de vídeo grande para ver no Drive; aprovação automática por prazo e lembretes; calendário de publicações; caixa de respostas; Trello; aviso no celular (PWA).
3. Vitrine no site com logos e depoimentos; Drive via API; WhatsApp automático (ainda em pesquisa, não implementar sem decisão).

## Versão

Versionamento semântico (MAJOR.MINOR.PATCH), igual ao do sistema do LAEG-BIO. Histórico em `public/CHANGELOG.md` (fica em `public/` porque a janela "Sobre o sistema" lê o arquivo; a primeira entrada é a versão atual).

- **PATCH:** só correções. **MINOR:** algo novo ou mudança visível na tela. **MAJOR:** muda o jeito de usar ou exige migrar dados.
- **Na dúvida entre MAJOR, MINOR e PATCH, perguntar ao Victor antes.** MAJOR sempre pergunta.
- Até a publicação o sistema fica em **0.x** (cada entrega do `ROADMAP.md` sobe o MINOR, sem tag nem Release). **Na publicação vira 1.0.0.**
- A partir do 1.0.0, a cada subida para produção ("pode subir pra produção", ver "Branches e ambientes"):
  1. Adicionar a entrada no topo do `public/CHANGELOG.md`: `## [X.Y.Z] — dd/mm/aaaa`, seções `### Novidades` / `### Melhorias` / `### Correções` (só as que tiverem itens), um item por linha, sem formatação markdown, em português simples (quem lê é a Bea e os clientes, não quem programa).
  2. Commit `Versão X.Y.Z`.
  3. `git tag vX.Y.Z` e `git push origin main vX.Y.Z` (a subida já é a autorização).
  4. Release no GitHub com a tag e o mesmo texto da entrada do CHANGELOG (`gh release create vX.Y.Z --title "X.Y.Z" --notes "..."`).
- Créditos e manutenção da janela "Sobre": `public/assets/js/sobre.js` (`MANUTENCAO` muda se outra pessoa assumir; `DESENVOLVIMENTO` não muda). O crédito do login fica em `public/index.html` (`.credito-dev`).

## Como trabalhar neste repositório

- Comunicação em português, informal.
- Antes de adicionar algo fora do pedido, propor e esperar aprovação.
- Entregas pequenas e testáveis; mostrar o que mudou em cada etapa.
- Não traduzir nomes de arquivos especiais (ex.: `_headers` tem que manter esse nome exato).
- Testar sempre no celular (largura ~375px) e no desktop.
