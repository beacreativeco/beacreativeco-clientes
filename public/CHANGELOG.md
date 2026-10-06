# Histórico de versões

Tudo o que mudou no sistema de aprovação da BeaCreative, da versão mais nova para a
mais antiga. Escrito para a Bea e para os clientes, que leem isto em
"Sobre o sistema" > "O que há de novo".

**Como ler o número da versão** (MAJOR.MINOR.PATCH, ex.: 1.2.3):

- o **último número** (PATCH) sobe quando só houve correções;
- o **do meio** (MINOR) sobe quando chegou algo novo ou alguma mudança que dá pra ver na tela;
- o **primeiro** (MAJOR) sobe quando muda o jeito de usar o sistema ou foi preciso migrar os dados.

Até a publicação o sistema fica em 0.x; na publicação vira 1.0.0 (regras no
`CLAUDE.md`, seção "Versão"). As versões 0.1.0 a 0.5.0 foram reconstruídas
depois, a partir do histórico do Git, e não têm tag.

<!-- Formato lido pela janela "Sobre o sistema" (public/assets/js/sobre.js):
     cada entrada começa com "## [X.Y.Z] — dd/mm/aaaa", tem seções "### ..."
     e itens "- ...". A primeira entrada é a versão atual do sistema.
     Mantenha cada item em uma linha só e sem formatação markdown. -->

## [0.7.0] — 06/10/2026

### Novidades

- Calendário no painel da Bea: as entregas de todos os clientes no mês, cada cliente com a sua cor, e quantas entregas e aprovações cada um tem no mês.
- Tocar num cliente no calendário mostra só as entregas dele; tocar numa entrega abre o conteúdo.
- No celular, o calendário vira uma lista com os dias que têm entrega.

### Melhorias

- O painel da Bea ganhou uma barra de navegação: Clientes, Calendário e Mensagens (com o número de mensagens não lidas).

## [0.6.0] — 06/10/2026

### Novidades

- Janela "Sobre o sistema", no rodapé de todas as páginas: versão, o que há de novo em cada versão e quem desenvolve e cuida do sistema.
- Crédito de quem desenvolveu o sistema no rodapé da tela de entrada.

## [0.5.0] — 06/10/2026

### Novidades

- Logo original da BeaCreative no topo de todas as páginas e na tela de entrada.
- Ícone da BeaCreative na aba do navegador e na tela inicial do celular.
- O monograma da BeaCreative aparece enquanto a página carrega e nas telas sem nada para mostrar.

### Melhorias

- No celular, os botões ("Novo conteúdo", "Pedir ajuste" e outros) não quebram mais o texto em duas linhas.

## [0.4.0] — 06/10/2026

### Novidades

- Conversa em cada conteúdo, no estilo do WhatsApp, entre a Bea e o cliente, com mensagens chegando na hora.
- Mensagens não lidas aparecem nas listas e no topo do painel da Bea, que também tem a Caixa de mensagens.
- Dá para editar uma mensagem até 15 minutos depois e apagar até 48 horas depois.
- Imagens de referência na conversa, que abrem em tela cheia.
- Áudios de até 3 minutos, com as ondas do som enquanto grava e no player.
- "Pedir ajuste" abre a conversa: a próxima mensagem (texto, imagem ou áudio) vira o pedido.

## [0.3.0] — 06/10/2026

### Novidades

- Página do cliente: a lista dos seus conteúdos, separada em "Esperando você", "Em ajuste com a Bea" e "Aprovados".
- Em cada conteúdo, a prévia igual ao Instagram, o prazo, o link do Drive e os botões "✦ Aprovado" e "Pedir ajuste".

## [0.2.0] — 06/10/2026

### Novidades

- Conteúdos no painel da Bea: agenda de cada cliente e editor com formato, legenda, data, Drive e observação interna.
- Envio de imagens e vídeos, inclusive vídeos grandes, já comprimidos no computador antes de subir.
- Prévia igual ao Instagram (post, carrossel, story e reels), com a legenda aparecendo enquanto é escrita.

## [0.1.0] — 05/10/2026

### Novidades

- Entrada com e-mail e senha para a Bea e para os clientes.
- Cadastro de clientes com convite por e-mail, e a Bea pode suspender e reativar o acesso.
