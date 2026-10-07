# Roadmap

No ar em `https://clientes.beacreativeco.com.br` desde 06/10/2026 (versão 1.0.0). Local: `npx wrangler pages dev public --port 8788 --r2 MIDIAS`.

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
   - [ ] 4c. Tempo real com o webhook do Trello (o site já está publicado: pode ser feito)
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
5c. [ ] **Perfil da Bea** (no padrão do menu do avatar do LAEG-BIO)
   - Foto ou iniciais no topo, abrindo o menu: nome e e-mail, "Meu perfil", "Sobre o sistema", "Sair"
   - Meu perfil: foto, nome, e-mail (dá para trocar, com confirmação no e-mail novo) e troca de senha
   - Dados da agência: nome, WhatsApp, Instagram e e-mail de contato (usados no envio do link e nos e-mails aos clientes, quando essas partes entrarem)
   - Foto e nome da Bea nos balões da conversa, do lado do cliente
5d. [ ] **Perfil do cliente** (mesmo estilo)
   - Foto (ou logo) e nome de quem aprova os conteúdos; e-mail só leitura (quem troca é a Bea); troca de senha
   - Foto e nome nos balões da conversa, do lado da Bea
   - A foto e o @ da prévia dos posts continuam os que a Bea cadastrou (o cliente não mexe)
   - Atalho para "Sobre o sistema" no menu do perfil
   - Pastas no bucket (`trabalho/`, `aprovados/`, `vitrine/`), regra de 30 dias depois da aprovação, tela "Arquivo expirado, veja no Drive"
5e. [ ] **Envio do link para o cliente** (fase 1 do `CLAUDE.md`)
   - WhatsApp com mensagem pronta (`wa.me`), e-mail, Instagram e copiar link
   - Usa os dados da agência do perfil da Bea (5c): nome, WhatsApp, Instagram e e-mail de contato
6. [ ] **Avisos por e-mail**
7. [x] **Publicação (versão 1.0.0, 06/10/2026):** R2, Cloudflare Pages, variáveis, subdomínio e URLs no Supabase; tag `v1.0.0` e Release no GitHub
   - Testado no ar: upload, pasta `trabalho/`, aprovação do cliente movendo os arquivos para `aprovados/`
   - Variáveis no Pages: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TRELLO_API_KEY`, `TRELLO_API_SECRET`, `TRELLO_TOKEN` e `SITE_URL` (`https://clientes.beacreativeco.com.br`, liga o link do sistema nos cartões do Trello)

## Já pronto antes deste roadmap

- Login da Bea e dos clientes, com suspensão
- Cadastro de clientes com convite por e-mail
- Conteúdos no painel: agenda do cliente e editor (formato, legenda, data, Drive, observação interna, enviar e retirar da aprovação)
- Upload de imagens e vídeos em partes para o R2 (bucket local)
- Compressão no navegador antes de subir (imagem JPEG até 1080 × 1920, vídeo H.264 até 1080p)
