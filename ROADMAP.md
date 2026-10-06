# Roadmap

Tudo roda só no localhost por enquanto (`npx wrangler pages dev public --port 8788 --r2 MIDIAS`). A publicação é o último item.

Ao fim de cada entrega, este arquivo é atualizado e a próxima é indicada.

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
4. [ ] **Página da Bea: clientes, calendário e Trello** (o sistema complementa o Trello, não substitui: conversa nos dois sentidos)
   - [x] 4a. Calendário (versão 0.7.0): `/admin/calendario/`, entregas do mês de todos os clientes com cor por cliente, total e aprovadas por cliente (filtra ao tocar), grade no computador e lista por dia no celular, "Sem data"; navegação Clientes · Calendário · Mensagens no painel
   - [ ] 4b. Trello ↔ sistema
     - [x] Trello → sistema (versão 0.8.0, migração `20261011000000`): cadastro do cliente escolhe o quadro; `/api/trello/sincronizar` cria rascunhos dos cartões das listas de entregas, atualiza título/data (formato só em rascunho), etapa e link do cartão em `conteudos_internos`; rascunho vazio some quando o cartão sai, o resto fica com aviso; sincroniza ao abrir o calendário e pelo botão
     - [ ] Sistema → Trello (escrito na versão 0.8.0, migração `20261012000000`; **falta testar** num quadro de teste na conta da Bea, para não escrever nos quadros das clientes)
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
   - [ ] 4c. Tempo real com o webhook do Trello (só com o site publicado, junto do item 7)
5. [ ] **Exclusão automática das mídias e espaço usado no painel**
   - Pastas no bucket (`trabalho/`, `aprovados/`, `vitrine/`), regra de 30 dias depois da aprovação, tela "Arquivo expirado, veja no Drive"
6. [ ] **Avisos por e-mail**
7. [ ] **Publicação (versão 1.0.0):** R2, Cloudflare Pages, variáveis, subdomínio e URLs no Supabase; tag `v1.0.0` e Release no GitHub
   - Variáveis no Pages: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TRELLO_API_KEY`, `TRELLO_API_SECRET`, `TRELLO_TOKEN` e `SITE_URL` (`https://clientes.beacreativeco.com.br`, liga o link do sistema nos cartões do Trello)

## Já pronto antes deste roadmap

- Login da Bea e dos clientes, com suspensão
- Cadastro de clientes com convite por e-mail
- Conteúdos no painel: agenda do cliente e editor (formato, legenda, data, Drive, observação interna, enviar e retirar da aprovação)
- Upload de imagens e vídeos em partes para o R2 (bucket local)
- Compressão no navegador antes de subir (imagem JPEG até 1080 × 1920, vídeo H.264 até 1080p)
