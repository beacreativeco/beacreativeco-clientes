# Roadmap

No ar em `https://clientes.beacreativeco.com.br` desde 06/10/2026 (versão 1.0.0). Local: `npx wrangler pages dev public --port 8788 --r2 MIDIAS`.

Ao fim de cada entrega, este arquivo é atualizado e a próxima é indicada. Desde 07/10/2026 o trabalho vai na branch `dev` (Preview em `https://dev.beacreativeco-clientes.pages.dev`) e só chega à `main` com "pode subir pra produção" (regras no `CLAUDE.md`).

## Ordem

1. [x] **Editor: legenda ao vivo e carrossel navegável na prévia**
   - Prévia estilo Instagram (Reels, Story, post e carrossel), com "Ocultar interface" e "Áreas cobertas"
   - Legenda ao vivo, cortada em 2 linhas com "… mais", com quebras de linha, emojis e #tags/@menções na cor de link
   - Carrossel: deslizar com encaixe, setinhas no computador, teclado, contador e bolinhas; mudar a ordem mantém a posição
2. [x] **Página do cliente:** lista de conteúdos liberados, prévia estilo Instagram, aprovar e pedir ajuste
   - Lista agrupada em "Esperando você" (prazo mais próximo em cima), "Em ajuste com a Bea" e "Aprovados"
   - Conteúdo: prévia (a mesma do editor, sem "Áreas cobertas"), prazo, Drive, "✦ Aprovado" com confirmação e "Pedir ajuste" com texto
   - Histórico nas duas pontas: no editor da Bea aparece logo abaixo do título
   - Banco: funções `aprovar_conteudo` e `pedir_ajuste` (migração `20261007000000`)
   - A conversa por conteúdo (2b) substitui o campo de texto do "Pedir ajuste"
2b. [x] **Conversa por conteúdo, estilo WhatsApp**
   - [x] Entrega 1: conversa de texto, tempo real, não lidas nas listas, "Pedir ajuste" vira a primeira mensagem, Caixa de mensagens e avisos da Bea (migração `20261008000000`)
   - [x] Entrega 2: editar e apagar as próprias mensagens (migração `20261009000000`; apagar até 48 h; "Copiar texto" no menu)
     - Editar só texto, até 15 min, com "editada"; apagar vira "Mensagem apagada" (arquivo sai do armazenamento)
     - Aprovação e pedido de ajuste não podem ser editados nem apagados
     - Menu nos três pontinhos (computador) ou segurando o balão (celular), em tempo real
     - Regras no Supabase, não só na tela
   - [x] Entrega 3: imagens de referência (comprimidas no navegador, miniatura e tela cheia, também como pedido de ajuste; "Excluir rascunho" tira os arquivos da conversa do armazenamento)
   - [x] Entrega 4: áudio (até 3 min, gravar com toques) — gravação, envio e player funcionando; M4A no Chrome/Edge/Safari, WEBM só no Firefox (sem conversão: lá não há codificador AAC); testado no Android
     - Ondas ao vivo gravando (volume do microfone) e onda no balão preenchendo conforme toca (guardada em `mensagens.onda`, migração `20261010000000`)
     - Conversa no celular: cabe na largura, minhas à direita na cor de destaque, balões compactos, sem caixa em volta
     - Pendente para quando houver um iPhone à mão: testar gravação e player no Safari
   - Uma conversa por conteúdo, embaixo da prévia, balões dos dois lados com horário
   - Texto, áudio, imagens de referência e links
   - Áudio gravado no navegador (inclusive iPhone/Safari), com tempo correndo, cancelar e player no balão
   - "Pedir ajuste" abre a conversa e o pedido vira a primeira mensagem
   - A Bea responde pelo painel, também com áudio
   - Tempo real (Supabase Realtime) e contador de não lidas nas listas, dos dois lados
   - Segurança: cliente só nas conversas dos próprios conteúdos; arquivos com as mesmas regras de armazenamento e exclusão
2c. [x] **Sobre o sistema e crédito** (igual ao do LAEG-BIO, versão 0.6.0)
   - Janela "Sobre o sistema" no rodapé do painel da Bea e da página do cliente: nome, versão, "O que há de novo" com todas as versões (lido do `public/CHANGELOG.md`), descrição, "Desenvolvido por" com a logo vict.<OR> e o portfólio, e o responsável pela manutenção
   - Crédito "Desenvolvido por Victor Carvalho" no rodapé do login
   - Versionamento semântico: regras no `CLAUDE.md`, seção "Versão"
3. [x] **Identidade:** logo original da BeaCreative e acabamento visual
   - [x] Logo original em SVG no topo de todas as páginas, no login e no "definir senha"
   - [x] Ícones (favicon, iPhone e Android) com o monograma b✦, iguais aos do site
   - [x] Monograma b✦ no "Carregando…", na falha ao carregar e nas telas vazias
   - [x] Painel da Bea: botões dos cabeçalhos não quebram mais em duas linhas no celular
   - [x] Páginas do cliente revisadas (360, 390 e computador): "Pedir ajuste" não quebra mais em duas linhas
4. [x] **Página da Bea: clientes, calendário e Trello** (o sistema complementa o Trello, não substitui: conversa nos dois sentidos)
   - [x] 4a. Calendário (versão 0.7.0): `/admin/calendario/`, entregas do mês de todos os clientes com cor por cliente, total e aprovadas por cliente (filtra ao tocar), grade no computador e lista por dia no celular, "Sem data"; navegação Clientes · Calendário · Mensagens no painel
   - [x] 4b. Trello ↔ sistema
     - [x] Trello → sistema (versão 0.8.0, migração `20261011000000`): cadastro do cliente escolhe o quadro; `/api/trello/sincronizar` cria rascunhos dos cartões das listas de entregas, atualiza título/data (formato só em rascunho), etapa e link do cartão em `conteudos_internos`; rascunho vazio some quando o cartão sai, o resto fica com aviso; sincroniza ao abrir o calendário e pelo botão
     - [x] Sistema → Trello (versão 0.8.0, migração `20261012000000`; testado no ar em 06/10/2026 no "quadro - teste", ligado ao cliente victordev: etiquetas AGUARDANDO APROVAÇÃO e APROVADO e comentário da aprovação funcionando; o anexo do link e o comentário do pedido de ajuste ficam para conferir no uso)
       - Enviar ao cliente: etiqueta AGUARDANDO APROVAÇÃO (sai quando o cliente decide ou a Bea retira)
       - Aprovado: etiqueta APROVADO e comentário "Sistema de aprovação: ✦ Aprovado por …"
       - Pedido de ajuste: comentário com o texto (áudio/imagem: aviso para ver no sistema)
       - Link "Abrir no sistema de aprovação" anexado ao cartão só com `SITE_URL` (site publicado)
       - Disparado pela página depois da ação (`/api/trello/refletir`), que lê o estado no banco; sem repetir comentário
     - [x] Cartões com POSTADO (de antes do sistema): só registro no calendário, sem envio ao cliente
     - Quadros das clientes (vistos em 06/10/2026): "comunicação - casa coelho", "comunicação | j.franco", "comunicação | le bel"; listas por mês e "[FEED] semana um…cinco"; cartão sem título com capa = separador de semana
     - Padrão combinado: data e formato no título do cartão ("13/10 · Reels · Título", como já faz o Casa Coelho); a "Data de entrega" do Trello fica livre para os prazos internos da Bea
     - Etiquetas de etapa (GRAVAR, GRAVADO, EDITAR, CRIAR ARTE, AGUARDANDO APROVAÇÃO, PROGRAMAR, PROGRAMADO, POSTADO) viram a etapa no sistema, só para a Bea (em `conteudos_internos`)
     - Trello → sistema: título, data, formato e etapa; nunca mexe em situação, mídias e legenda
     - Sistema → Trello: a definir (ex.: etiqueta/comentário quando o cliente aprova, link do conteúdo no cartão)
     - Precisa: chave e token da API do Trello da conta da Bea (no `.dev.vars`) e a Bea renomear os cartões do J.Franco e da Le Bel no padrão
   - [x] 4c. Tempo real com o webhook do Trello (versões 1.1.0 e 1.1.1; testado no ar em 06/10/2026: cartão renomeado no "quadro - teste" chegou ao sistema em segundos, com o sistema fechado)
     - O Trello avisa `/api/trello/webhook` a cada mudança num quadro ligado e o sistema sincroniza só aquele quadro (título, data, formato, lista, etapa, cartão saindo); comentários, anexos, descrição e arrastar na mesma lista não disparam
     - Assinatura de cada aviso conferida com `TRELLO_API_SECRET` (precisa estar nas variáveis do Pages); responde na hora e sincroniza em seguida
     - Webhooks criados/removidos por `/api/trello/webhooks`: depois de salvar um cliente com o quadro mudado e depois de cada sincronização do Calendário; quadro desligado responde 410 e o Trello apaga o webhook sozinho
     - Sincronização movida para `functions/_lib/trello-sincronizar.js` (a mesma no botão e no webhook)
5. [x] **Exclusão automática das mídias e espaço usado no painel** (versão 0.9.0, migração `20261013000000`)
   - [x] R2 ativado na conta da BeaCreative: bucket `beacreativeco-midias` (Standard, sem acesso público), alerta de orçamento de US$ 1 e de uso em 9 GB
   - [x] Pastas `trabalho/`, `aprovados/`, `vitrine/`; arquivos novos já nascem na pasta da situação; `/api/conteudo/organizar` move ao mudar de situação (chaves antigas, sem pasta, continuam funcionando)
   - [x] Prazos: `aprovados/` 30 dias depois da aprovação; `vitrine/` nunca; `trabalho/` sem regra; uploads incompletos cancelados depois de 1 dia
   - [x] "Arquivo expirado, veja no Drive" na prévia, no editor e na conversa (pela data ou quando o arquivo dá 404)
   - [x] Espaço usado na página Clientes, com aviso a partir de 8 GB
   - [x] Testado no bucket local: aprovar move para `aprovados/` com validade de 30 dias; voltar desfaz; arquivo de outro conteúdo não é tocado; "expirado" na prévia e na conversa
   - [x] Lifecycle Rules criadas no R2 (06/10/2026): `apagar-aprovados` (prefixo `aprovados/`, 30 dias depois do upload) e uploads incompletos cancelados depois de 1 dia (bucket inteiro)
   - [x] Binding `MIDIAS` do bucket com o projeto do Pages (na publicação); testado no ar: upload em `trabalho/` e aprovação movendo para `aprovados/`
5b. [x] **Excluir cliente** (versão 0.10.0, migrações `20261014000000` e `20261015000000`)
   - Também para quem nunca recebeu convite (sem login para suspender)
   - Botão "Excluir cliente" na página do cliente, só com o acesso suspenso
   - Confirmação forte: digitar o nome do cliente, aviso de que não dá para desfazer, e o que vai ser apagado (conteúdos, conversas, arquivos e o espaço liberado)
   - Apaga login, conteúdos, conversas e todos os arquivos dele no R2 (todas as pastas)
   - Vitrine: se houver conteúdos na vitrine, a Bea escolhe manter (o cadastro fica arquivado, sem login, só para a vitrine) ou apagar junto
   - No servidor (`/api/clientes/excluir`), com a chave de serviço, conferindo que é a admin; o Trello não é tocado
   - Testado no bucket local: apagar tudo (nada sobra no banco nem no R2), manter a vitrine (cadastro arquivado, conteúdo e arquivo da vitrine ficam), cliente ativo barrado na tela e no servidor
   - O teste achou uma falha da 0.9.0, corrigida na migração `20261015000000`: `mensagem_valida` recusava arquivos da conversa com a pasta na frente (imagem e áudio na conversa não enviavam)
5c. [x] **Perfil da Bea** (no padrão do menu do avatar do LAEG-BIO; versão 1.2.0, migração `20261016000000`, já rodada)
   - **Falta testar com login:** foto, nome, dados da agência, troca de senha e troca de e-mail (esta só no ar); nome e foto da Bea na conversa do cliente
   - Junto: "Entrar com o Google" no login (embaixo do Entrar), só para quem já tem acesso e com o mesmo e-mail; Google configurado no Supabase e testado em 07/10/2026
   - Foto ou iniciais no topo, abrindo o menu: nome e e-mail, "Meu perfil", "Sobre o sistema", "Sair"
   - Meu perfil: foto, nome, e-mail (dá para trocar, com confirmação no e-mail novo) e troca de senha
   - Dados da agência: nome, WhatsApp, Instagram e e-mail de contato (usados no envio do link e nos e-mails aos clientes, quando essas partes entrarem)
   - Foto e nome da Bea nos balões da conversa, do lado do cliente
5d. [x] **Perfil do cliente** (mesmo estilo; versão 1.3.0, migração `20261017000000`, já rodada)
   - **Falta:** rodar a migração no Supabase e testar no Preview (foto, nome, troca de senha, "Esqueci a senha atual"; nome e foto do cliente na conversa da Bea)
   - Menu do avatar nas páginas do cliente (foto ou iniciais): nome e e-mail, "Meu perfil", "Sobre o sistema", "Sair"
   - Meu perfil (`/cliente/perfil/`): foto (ou logo) e nome de quem aprova (`clientes.contato_nome` e `contato_foto_url`, nome pela função `salvar_meu_nome`); e-mail só leitura (quem troca é a Bea); troca de senha
   - Foto e nome nos balões da conversa, do lado da Bea (sem nome, o do cadastro), e "… aprovou" com o nome
   - A foto e o @ da prévia dos posts continuam os que a Bea cadastrou (o cliente não mexe)
   - `/api/perfil/foto` serve aos dois lados; excluir cliente apaga a foto dele do R2
   - Junto, nos dois perfis: "Esqueci a senha atual" (manda o link de criar senha), para quem só entrou com o Google ou pelo convite e nunca teve senha
5e. [x] **Prévia opcional** (versão 1.4.0; Bea e cliente; só front, sem migração; testada numa página local com arquivos de teste)
   - Testado no Preview, no editor da Bea (conteúdo com 1 imagem). **Falta:** conteúdo com vários arquivos e vídeo, e a página do cliente
   - Por padrão, os arquivos crus: imagens uma por vez (deslizar, sem moldura) e vídeo no player normal
   - Botão "Ver prévia" liga a simulação do Instagram (`previa-instagram.js`); "Ver arquivos" volta
   - Quem vê escolhe quais arquivos entram na prévia (não precisa ser todos juntos); os formatos seguem a escolha: 1 vídeo → Reels ou Story; 1 imagem → Post ou Story; 2 ou mais → Carrossel
   - A prévia abre no formato cadastrado pela Bea (se for possível com os arquivos), com seletor para comparar; nada disso grava no banco
   - "Ocultar interface" e "Áreas cobertas" (só Bea) continuam dentro da prévia
5f. [x] **Instalar o sistema como app** (versão 1.4.0; PWA, no padrão do LAEG-BIO; `instalar.js`, `sw.js`)
   - Testado no Preview (Chrome no computador: convite, "Agora não" pausando, item no menu) e o convite do iPhone simulado localmente. **Falta:** instalar de verdade no Android e no iPhone
   - `site.webmanifest` com `display: standalone`, nome "BeaCreative" e ícones da marca (comuns e maskable), mais um service worker mínimo (rede primeiro, nunca guarda `/api/`)
   - Convite depois do login: Chrome/Edge (Android e computador) usam o botão do navegador; iPhone no Safari mostra o passo a passo (Compartilhar → Adicionar à Tela de Início); Chrome no iPhone orienta abrir no Safari
   - "Fechar" (volta depois de 30 dias, como no LAEG) e "Não mostrar de novo"; nada aparece se já estiver instalado
   - "Instalar o sistema" no menu do avatar, para Bea e cliente, a qualquer momento (só quando dá para instalar)
5g. [x] **Enviar arquivos pro Trello e pro Drive** (versão 1.4.0; só a Bea, no editor; migração nova)
   - Botões ao lado de cada arquivo; depois de enviado mostra "✓ No Trello" / "✓ No Drive" (com link), e mandar de novo pede confirmação
   - Trello (plano grátis, anexo até 10 MB): pelo servidor, anexa no cartão do conteúdo (`trello_card_id`) a versão do sistema; acima de 10 MB anexa o link do arquivo no sistema
   - Drive: login do Google só com a permissão `drive.file` + Google Picker (a Bea escolhe a pasta de cada cliente uma vez); envio direto do navegador para o Google, na pasta do cliente (`drive_pasta_url`); manda o original se ele ainda estiver na página, senão pede para escolher o arquivo original (ou manda a versão do sistema, avisando)
   - Precisa: projeto no Google Cloud com Drive API e Picker API, OAuth client (origens da produção, do Preview e do localhost) e chave de API restrita aos domínios
   - Registro em `midias`: quando e o id do anexo/arquivo, e se foi o original (migração `20261018000000`, já rodada)
   - **Trello pronto e testado no Preview** (imagem como arquivo; vídeo de 15 MB como link; "de novo" com confirmação)
   - **Drive pronto** (`drive.js`, chave e ID do cliente em `config.js`): no Preview o botão aparece e o login do Google abre (app em modo de teste, com aviso "não verificado"). **Falta:** teste completo com a conta Google definitiva (autorizar, escolher a pasta no Picker, enviar, "✓ No Drive"); essa conta precisa estar em "Usuários de teste", ou o app publicado
5h. [x] **Avisar o cliente no WhatsApp** (versão 1.4.0; decisão de 07/10: só WhatsApp, mensagem simples)
   - Botão "Avisar no WhatsApp" no rodapé do editor enquanto o conteúdo está em aprovação: abre o `wa.me` no número do cadastro do cliente com "Oi, [nome]! Tem conteúdo novo pra você aprovar: “[título]”. Dá uma olhada aqui: [link]" (nova versão: "Tem uma nova versão de …")
   - Sem número no cadastro, o WhatsApp abre para escolher o contato. Link da página do conteúdo: logado, abre direto; sem login, entra e cai na lista
   - O `wa.me` abre o WhatsApp logado no aparelho de quem clica (o Business da Bea no celular, ou o WhatsApp Web com o número dela)
   - **Envio automático: pesquisado em 07/10/2026 e adiado** (decidir depois). Cloud API da Meta, modelo de mensagem aprovado (categoria utilidade, ~US$ 0,007–0,008 por mensagem no Brasil). Ou número novo só para o sistema (direto com a Meta, sem mensalidade) ou o mesmo número do Business da Bea (coexistência, em geral via parceiro BSP pago). Precisa de Portfólio empresarial na Meta; envio só pela produção
6. [ ] **Avisos por e-mail**
7. [x] **Publicação (versão 1.0.0, 06/10/2026):** R2, Cloudflare Pages, variáveis, subdomínio e URLs no Supabase; tag `v1.0.0` e Release no GitHub
   - Testado no ar: upload, pasta `trabalho/`, aprovação do cliente movendo os arquivos para `aprovados/`
   - Variáveis no Pages: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TRELLO_API_KEY`, `TRELLO_API_SECRET`, `TRELLO_TOKEN` e `SITE_URL` (`https://clientes.beacreativeco.com.br`, liga o link do sistema nos cartões do Trello)

8. [ ] **Fase visual (só front-end, sem mudar regras nem banco)**: direção "Estúdio" aprovada em 07/10/2026, com modo claro e escuro (padrão: o do aparelho; escolha salva no aparelho). Comparação das direções: https://claude.ai/artifact/SS61pAWhiqnBXjeWUgpGa3. Uma área por vez, na `dev`, aprovada antes da próxima:
   - 8.1 [x] Tokens (`tokens.css`), claro e escuro (`tema.js`), "Aparência" no menu do avatar, botões e escala tipográfica; todos os pares de cor passam no WCAG AA
   - 8.2 [x] Navegação: topo espresso com abas e indicador da ativa; barra embaixo no celular (Bea e cliente); transições entre telas (View Transitions, indicador desliza)
     - Cliente: Para aprovar, Aprovados (`/cliente/?ver=aprovados`) e Perfil. **Falta:** ver a barra num celular de verdade e as páginas do cliente logado
   - 8.3 [x] Estados: esqueleto da própria tela no carregamento (lista, agenda, editor, calendário, perfil), telas vazias com ação (`data-aciona`), falha ao abrir com "Tentar de novo" (diz quando é falta de internet), avisos com ícone
     - **Falta:** ver a tela de falha de verdade (só aparece com erro de conexão)
   - 8.4 [x] Formulários e janelas: moldura do Estúdio nas janelas (cabeçalho espresso com a inicial, ✦ no canto, fio periwinkle; corpo que rola; rodapé fixo; folha no celular); "Editar cliente" em seções (Marca e contato, Acesso, Drive e Trello, Combinado); "Excluir cliente" com a mesma moldura em vermelho; campos de 48px com anel no foco em todos os formulários
   - 8.4b [x] Revisão de contraste (WCAG AA) nas páginas do cliente, nos dois modos: menu do perfil, bordas de campos (3:1), 28 textos esmaecidos com opacidade passaram a `--cor-texto-2`, botões desativados com cor própria, placeholders; "Adicionar seu nome" no menu. **Falta:** rodar a auditoria nas telas da Bea
   - 8.4c [x] Ações dos arquivos no editor: ordem/baixar/remover em botões de ícone 44px com dica, Remover com confirmação; Trello e Drive com ícones oficiais (`assets/img/marcas/`) e estados normal/enviando/enviado/erro; Sincronizar com o Trello com ícone girando
   - 8.4d [x] Etiquetas de situação coloridas em todo o sistema; trilha de navegação (`montarTrilha`, "‹ Voltar para …" no celular); "Abrir no Trello / Drive" no editor; prévia vazia com "Enviar arquivos"; formato escolhido com ✓. **Proposta pendente:** nova ordem do editor
   - 8.5 [ ] Telas do cliente e microinteração do ✦ Aprovado
   - 8.6 [ ] Demais telas da Bea (editor, calendário, mensagens, perfil)

9. [ ] **Conversa por cliente** (pedido de 07/10/2026; plano e rascunhos: https://claude.ai/artifact/X67MYmy3D7DndaGdX91jaw). A conversa sai da tela do conteúdo e vira uma só por cliente, na aba Mensagens; cada mensagem pode carregar o conteúdo de que fala
   - [x] Entrega 1: conversa por cliente (migração `20261019000000`, já rodada; compatível com a 1.5.1 no ar)
     - Banco: `mensagens.cliente_id` (preenchido nas antigas pelo conteúdo), `conteudo_id` opcional (conteúdo excluído: a mensagem fica), `so_bea` (escrita num rascunho: o cliente nunca vê; conteúdo retirado da aprovação: a conversa continua visível), `leituras_cliente`, `marcar_conversa_do_cliente_lida`, `conversas_por_cliente`
     - Bea: `/admin/mensagens/` com lista de clientes (foto, nome, última mensagem com "…", data, não lidas, busca) e conversa ao lado; no celular, lista → conversa em tela cheia, sem topo nem barra de baixo
     - Cliente: aba Mensagens (`/cliente/mensagens/`) com a conversa direto e o número de não lidas na barra
     - Cartão do conteúdo no balão (miniatura, título, situação; abre o conteúdo); aprovação com o título; apagadas seguidas viram "N mensagens apagadas"; balões até 80%, sem rolagem lateral; onda do áudio na largura do balão; a conversa fica no fim quando a tela muda (teclado, página aparecendo)
     - Imagem e áudio sem conteúdo vão para `conversa/<cliente_id>/` (30 dias). **Falta:** criar no R2 a regra `apagar-conversa` (prefixo `conversa/`, 30 dias)
     - Testado com dados de exemplo (computador e 375px). **Falta:** testar no Preview com o victordev e num celular de verdade (teclado no Android e no iPhone)
     - A conversa continua também na tela do conteúdo (filtrada nele) até a Entrega 3
   - [ ] Entrega 2: anexar conteúdo pelo clipe, "Pedir ajuste" abrindo a conversa com o conteúdo anexado, conversa filtrada com "Ver tudo", avisos de aprovação e pedido de ajuste
   - [ ] Entrega 3: tela do conteúdo sem chat (último pedido de ajuste + "Conversar sobre este conteúdo (N)")

## Já pronto antes deste roadmap

- Login da Bea e dos clientes, com suspensão
- Cadastro de clientes com convite por e-mail
- Conteúdos no painel: agenda do cliente e editor (formato, legenda, data, Drive, observação interna, enviar e retirar da aprovação)
- Upload de imagens e vídeos em partes para o R2 (bucket local)
- Compressão no navegador antes de subir (imagem JPEG até 1080 × 1920, vídeo H.264 até 1080p)
