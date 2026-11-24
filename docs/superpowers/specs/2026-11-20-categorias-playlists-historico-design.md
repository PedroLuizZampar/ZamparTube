# Categorias, playlists e histórico — design

Data: 2026-11-20 · Status: aprovado · Segue `2026-11-20-feed-filtros-historico-design.md`

## Objetivos

1. **Página de Categorias** (`/categories`, item "Categorias" no menu, ícone de etiquetas). Criar, renomear e apagar
   categorias saem de `/channels`. Menu: Início, Canais, Categorias, Playlists, Histórico.
2. **Select de categoria sempre visível** em "Adicionar canal" e em cada canal, mesmo sem categorias (só "Sem categoria").
3. **Remover do histórico**: ação em cada card do Histórico (ícone no hover, item no ⋮). Apaga só o registro de
   visualização (`watch_state`: posição e assistido). Se o vídeo tiver menos de 14 dias e não foi dispensado, volta ao feed.
4. **Playlists**:
   - A página tem só o botão "Criar". Ele cria "Nova playlist" (ou "Nova playlist 2", "3"…) e abre o nome dela
     para edição na própria grade (`/playlists?editar=<id>`).
   - Lápis para renomear em cada card, exceto "Assistir depois". Na página da playlist, "Assistir depois" não tem lápis.
   - Nomes únicos sem diferenciar maiúsculas/minúsculas, incluindo "Assistir depois". Aviso: "Já existe uma playlist com
     esse nome." Vale também para "Salvar na playlist" na página do vídeo.
   - Garantido no banco por índice único em `lower(name)`; a migração renomeia duplicatas existentes para "Nome (#id)", que não colide com outro nome.
5. **Filtros no Histórico**: os mesmos chips de categoria e menu de canais da tela inicial, aplicados às duas seções
   (URL `/history?categoria=…&canal=…`).

## Fora do escopo

Reprodutor com controles próprios (rodada separada; arquivo do vídeo fora do player do YouTube está descartado por
violar os termos do YouTube).

## Abordagens

- Unicidade: verificação na consulta (mensagem amigável) + índice único (garantia). Só verificação na aplicação
  descartada (não protege dados antigos/concorrência); só índice descartado (erro genérico difícil de traduzir).
- Edição após criar: estado na URL (`?editar=id`) renderizado no servidor, em vez de estado cliente da grade inteira.
- Remover do histórico: apagar a linha de `watch_state` (escolhido; "só remove a visualização") vs. flag de ocultação
  (manteria o progresso, contrariando o pedido).
