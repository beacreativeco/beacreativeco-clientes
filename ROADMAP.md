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
   - Fica para depois: anexar referências (imagens ou links) no pedido de ajuste
3. [ ] **Identidade:** logo original da BeaCreative e acabamento visual
4. [ ] **Exclusão automática das mídias e espaço usado no painel**
   - Pastas no bucket (`trabalho/`, `aprovados/`, `vitrine/`), regra de 30 dias depois da aprovação, tela "Arquivo expirado, veja no Drive"
5. [ ] **Avisos por e-mail**
6. [ ] **Publicação:** R2, Cloudflare Pages, variáveis, subdomínio e URLs no Supabase

## Já pronto antes deste roadmap

- Login da Bea e dos clientes, com suspensão
- Cadastro de clientes com convite por e-mail
- Conteúdos no painel: agenda do cliente e editor (formato, legenda, data, Drive, observação interna, enviar e retirar da aprovação)
- Upload de imagens e vídeos em partes para o R2 (bucket local)
- Compressão no navegador antes de subir (imagem JPEG até 1080 × 1920, vídeo H.264 até 1080p)
