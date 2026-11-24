# Imagens, categorias em cards, filtro instantâneo e reprodutor próprio — design

Data: 2026-11-20 · Status: aprovado · Segue `2026-11-20-categorias-playlists-historico-design.md`

## Objetivos

1. **Excluir playlist pelo card**: lixeira ao lado do lápis (não em "Assistir depois"), com confirmação.
2. **Filtro de canais instantâneo**: cada marcação navega na hora; o menu continua aberto.
3. **Categorias em cards**: botão "Criar" → "Nova categoria" (ou "… 2", "… 3") com o nome aberto para edição
   (`/categories?editar=<id>`); cards com imagem, nome e nº de canais; lápis e lixeira (com confirmação). Nomes únicos
   ignorando maiúsculas/minúsculas (índice em `lower(name)`; migração renomeia duplicatas para "Nome (#id)").
4. **Imagens em categorias e playlists**: no modo de edição do card, "Escolher imagem" e "Remover imagem".
   - Corte e redução automáticos no navegador: categoria 256×256 (quadrado), playlist 640×360 (16:9), WebP (fallback JPEG).
     Aceita JPG, PNG, WebP.
   - Guardadas no banco (base64 + content type + data de atualização), servidas por `/category-image/[id]` e
     `/playlist-image/[id]` com `?v=<timestamp>` e cache longo (igual aos avatares).
   - Categoria: imagem no card e miniatura redonda nos chips de filtro (feed e histórico). Playlist: capa do card; sem
     imagem, capa = miniatura do primeiro vídeo.
5. **Reprodutor próprio**: o iframe do YouTube só desenha o vídeo (`controls=0`, `disablekb=1`, `fs=0`); uma camada nossa
   cobre tudo.
   - Controles: play/pausa (clique no vídeo), barra de progresso com tempo no hover e buffer, ±10 s, volume e mudo,
     velocidade 0,5×–2×, tela cheia (do nosso contêiner).
   - Atalhos: espaço/K, J/L (±10 s), ←/→ (±5 s), F, M.
   - Celular: toque duplo nas laterais = ±10 s; toque simples mostra/oculta os controles.
   - Controles somem após 2,5 s tocando; voltam com movimento/toque. Na pausa e antes de começar: miniatura do vídeo com
     nosso botão de play (esconde a interface de pausa do YouTube).
   - Mantém: retomar posição, assistido aos 90%, salvar progresso, nossa tela final, fallback "Abrir no YouTube".
   - Fora: qualidade e legendas (não controláveis pela API). Risco aceito pelo usuário: políticas da API proíbem cobrir o player.
6. **Pontos menores das revisões**: anúncio de erros (`role="alert"`) e foco preservado; nome acessível do menu de canais
   com a seleção; chips com `aria-current`; fim do feed com filtros ("Nada mais com esses filtros" + link para tudo);
   título "Resultados para “…”" na busca; erro 23505 traduzido para nome repetido; mensagens corretas de renomear;
   Esc no editor do cabeçalho da playlist; sem passo extra no Voltar após "Criar"; relógio salvo visível no card do celular;
   Select e menus com as mesmas classes; `getWatchLaterId` sem recursão.

## Abordagens

- Player: controles próprios sobre o iframe (escolhido) vs. arquivo do vídeo (viola termos, quebra) vs. manter o player do
  YouTube (rejeitado pelo usuário).
- Imagens: banco + rota (escolhido; igual aos avatares, sem serviço novo) vs. storage externo (mais infraestrutura).
- Recorte: automático no cliente (escolhido) vs. tela de recorte (mais UI, não pedido).
