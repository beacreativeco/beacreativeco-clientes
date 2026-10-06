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
3. [ ] **Identidade:** logo original da BeaCreative e acabamento visual
   - [x] Logo original em SVG no topo de todas as páginas, no login e no "definir senha"
   - [x] Ícones (favicon, iPhone e Android) com o monograma b✦, iguais aos do site
   - [x] Monograma b✦ no "Carregando…", na falha ao carregar e nas telas vazias
   - [x] Painel da Bea: botões dos cabeçalhos não quebram mais em duas linhas no celular
   - [ ] Revisar as páginas do cliente no celular (precisa de um login de cliente)
4. [ ] **Página da Bea: clientes, calendário e Trello**
   - Visão de todos os clientes e calendário com as entregas (quantas por cliente, datas)
   - Trello manda: cada cartão vira um conteúdo (cliente, data, formato); mexer no Trello atualiza o sistema
   - Webhook do Trello só chega com o site publicado; no localhost, sincronizar sob demanda
   - Antes de começar: ver como o quadro dela está organizado (listas, etiquetas, um quadro por cliente ou um só)
5. [ ] **Exclusão automática das mídias e espaço usado no painel**
   - Pastas no bucket (`trabalho/`, `aprovados/`, `vitrine/`), regra de 30 dias depois da aprovação, tela "Arquivo expirado, veja no Drive"
6. [ ] **Avisos por e-mail**
7. [ ] **Publicação:** R2, Cloudflare Pages, variáveis, subdomínio e URLs no Supabase

## Já pronto antes deste roadmap

- Login da Bea e dos clientes, com suspensão
- Cadastro de clientes com convite por e-mail
- Conteúdos no painel: agenda do cliente e editor (formato, legenda, data, Drive, observação interna, enviar e retirar da aprovação)
- Upload de imagens e vídeos em partes para o R2 (bucket local)
- Compressão no navegador antes de subir (imagem JPEG até 1080 × 1920, vídeo H.264 até 1080p)
