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

## [1.6.0] — 07/10/2026

### Novidades

- A conversa agora é uma só por cliente, na aba Mensagens, e não mais dentro de cada conteúdo.
- Clientes: nova aba Mensagens na barra, com a conversa com a Bea e o número de mensagens novas.
- Bea: a aba Mensagens mostra a lista de clientes, com foto, última mensagem, data e mensagens novas, e a conversa ao lado (no celular, abre em tela cheia).
- Dá para anexar um conteúdo a uma mensagem pelo clipe; ele aparece como um cartão no balão e abre ao tocar.
- "Pedir ajuste" abre a conversa com o conteúdo já anexado: a próxima mensagem vira o pedido.
- Aprovações e pedidos de ajuste aparecem como avisos no meio da conversa.

### Melhorias

- A tela do conteúdo mostra o último pedido de ajuste e o botão "Conversar sobre este conteúdo", que abre só as mensagens daquele conteúdo.
- No celular, a conversa ocupa a tela toda e a caixa de texto fica logo acima do teclado.
- Mensagens apagadas seguidas viram uma linha só, como "3 mensagens apagadas".
- Imagens e áudios mandados na conversa sem um conteúdo anexado ficam guardados por 30 dias.

### Correções

- Os balões da conversa não passam mais da largura da tela, e textos e links longos quebram de linha.
- A onda do áudio ocupa a largura do balão.

## [1.5.1] — 07/10/2026

### Correções

- Na aba Mensagens pelo celular, a página não rola mais para o lado e a barra de navegação de baixo volta a aparecer.
- As prévias das mensagens ficam em até duas linhas, com "…" no fim.
- Cada conversa da aba Mensagens aparece como um cartão, com o cliente, a data, o conteúdo e a marca de não lida.
- No celular, o botão "Avisar no navegador" virou um sino e não aperta mais o título.

## [1.5.0] — 07/10/2026

### Novidades

- Visual novo do sistema, com o topo em marrom espresso e o periwinkle nos botões e destaques.
- Modo escuro: em "Aparência", no menu do perfil, dá para escolher Claro, Escuro ou Do aparelho (o padrão segue o celular ou o computador).
- No celular, a navegação fica numa barra embaixo, como num aplicativo.
- Os clientes ganharam navegação própria: Para aprovar, Aprovados e Perfil.
- Trilha no alto das páginas (por exemplo, Clientes › Casa Coelho › Dia do Médico); no celular, um botão "Voltar".
- As situações (Rascunho, Aguardando cliente, Aprovado…) aparecem como etiquetas coloridas, iguais em todo o sistema.
- No editor, botões para abrir o cartão no Trello e a pasta no Google Drive, com os ícones oficiais.
- Botões de enviar pro Trello e pro Google Drive mostram o andamento, o "✓ enviado" com o atalho para abrir, e "Tentar de novo" se der erro.

### Melhorias

- Janela de editar cliente organizada em seções, com os botões de salvar sempre à vista.
- Enquanto a página carrega, aparece o desenho da própria tela, sem a tela vazia.
- Telas vazias com uma ação para começar, e mensagens de erro mais claras.
- Ações de cada arquivo (mudar a ordem, baixar, remover) em botões do mesmo tamanho, com dica ao passar o mouse; remover pede confirmação.
- Prévia sem arquivos com um atalho para enviar.
- O formato escolhido no editor fica em destaque, com um ✓.
- Transições suaves entre as telas.
- Textos, bordas e botões com contraste melhor, fáceis de ler nos dois modos.
- Quem ainda não pôs o nome vê "Adicionar seu nome" no menu do perfil.

## [1.4.0] — 07/10/2026

### Novidades

- Os arquivos de cada conteúdo aparecem do jeito que são, sem a moldura do Instagram. O botão "Ver prévia" mostra como vai ficar no Instagram.
- Na prévia dá para escolher quais arquivos entram e comparar os formatos possíveis (Post, Carrossel, Story ou Reels), sem mudar o que a Bea cadastrou.
- Dá para instalar o sistema na tela inicial do celular ou do computador, como um aplicativo. O convite aparece depois de entrar, e a opção "Instalar o sistema" fica no menu do perfil.
- No editor, a Bea envia cada arquivo para o cartão do Trello do conteúdo e para a pasta do cliente no Google Drive, e vê quais já foram enviados.
- Botão "Avisar no WhatsApp" para mandar ao cliente uma mensagem pronta com o link do conteúdo.

## [1.3.0] — 07/10/2026

### Novidades

- Os clientes também têm um perfil: a foto (ou as iniciais) fica no topo e abre um menu com "Meu perfil", "Sobre o sistema" e "Sair".
- Em "Meu perfil" o cliente coloca a foto e o nome de quem aprova os conteúdos e troca a senha. O e-mail de acesso aparece só para consulta.
- Nas mensagens, a Bea vê o nome e a foto de quem aprova do lado do cliente.
- "Esqueci a senha atual" nos perfis, para quem entrou pelo Google ou pelo convite e nunca criou uma senha.

### Correções

- Vídeos enviados no editor eram registrados como imagem: a miniatura aparecia quebrada e o Reels pedia um vídeo. Agora imagem e vídeo entram com o tipo certo.
- Imagens e vídeos que não apareciam (miniatura quebrada) voltam a ser mostrados.
- Quando o problema é na configuração do sistema, o aviso agora diz isso, em vez de "Sua sessão expirou", que fazia sair e entrar de novo sem resolver nada.
- Ao excluir um cliente, a foto de perfil dele também é apagada.

## [1.2.0] — 07/10/2026

### Novidades

- A Bea tem um perfil: a foto (ou as iniciais) fica no topo do painel e abre um menu com "Meu perfil", "Sobre o sistema" e "Sair".
- Em "Meu perfil" a Bea troca a foto, o nome, o e-mail de acesso (com confirmação no e-mail novo) e a senha.
- Novo espaço para os dados da agência (nome, WhatsApp, Instagram e e-mail de contato), que vão ser usados no envio do link e nos e-mails aos clientes.
- Nas mensagens, os clientes veem o nome e a foto da Bea.
- Dá para entrar com a conta do Google, além do e-mail e senha. Vale para o Google do mesmo e-mail que a Bea cadastrou.

## [1.1.1] — 07/10/2026

### Correções

- Quando falta alguma configuração do Trello no servidor, o aviso agora diz qual é, o que facilita a manutenção.

## [1.1.0] — 07/10/2026

### Novidades

- O que a Bea muda no Trello aparece sozinho no sistema, na hora: cartão novo, título, data, formato e etapa, sem precisar abrir o calendário.

## [1.0.0] — 06/10/2026

### Novidades

- O sistema está no ar em clientes.beacreativeco.com.br: a Bea e os clientes já podem usar de qualquer lugar, no celular ou no computador.
- Tudo das versões anteriores passa a funcionar no endereço novo: envio de conteúdos, prévia igual ao Instagram, aprovação, pedido de ajuste, conversa com imagens e áudios, calendário e Trello.

## [0.10.0] — 06/10/2026

### Novidades

- A Bea pode excluir um cliente de vez, na página dele, depois de suspender o acesso (ou se ele nunca recebeu convite). Para confirmar, digita o nome do cliente.
- A exclusão apaga o login, os conteúdos, as conversas e os arquivos do cliente, e mostra quanto espaço foi liberado. Se houver conteúdos na vitrine, a Bea escolhe se ficam ou se vão junto.

### Correções

- Imagens e áudios voltaram a funcionar na conversa (desde a versão 0.9.0 eles eram recusados ao enviar).

## [0.9.0] — 06/10/2026

### Novidades

- Os arquivos dos conteúdos aprovados são apagados sozinhos do sistema 30 dias depois da aprovação; o original continua no Drive. Conteúdos em andamento e os da vitrine não são apagados.
- Quando um arquivo já foi apagado, aparece "Arquivo expirado, veja no Drive" com o link, no lugar da imagem.
- Na página Clientes, a Bea vê quanto do espaço de armazenamento já foi usado, com aviso quando passar de 8 GB.

## [0.8.0] — 06/10/2026

### Novidades

- O sistema agora conversa com o Trello: as entregas dos quadros das clientes (listas "[FEED]") aparecem sozinhas no calendário, como rascunho, com a data e o formato do título do cartão (ex.: "13/10 · Reels · Título").
- O calendário mostra a etapa de cada entrega no Trello (gravado, editar, postado...), e o conteúdo tem o link "Abrir no Trello".
- Botão "Sincronizar com o Trello" no calendário, que também atualiza sozinho ao abrir, e avisos dos cartões que não viraram entrega.
- No cadastro do cliente, dá para escolher o quadro do Trello dele.
- O Trello também fica sabendo do sistema: enviado ao cliente, o cartão ganha a etiqueta "AGUARDANDO APROVAÇÃO"; aprovado, ganha "APROVADO" e um comentário; pedido de ajuste vira comentário no cartão.
- Entregas que já estavam como postadas no Trello aparecem no calendário só como registro, sem envio ao cliente.

### Melhorias

- Apagar a observação interna de um conteúdo não apaga mais as outras informações internas dele.

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
