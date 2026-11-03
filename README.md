# ZamparTube

Um "YouTube pessoal": só vídeos dos canais que você escolher, **sem Shorts**, sem recomendações e com um feed que termina ("Você está em dia").

- Feed com os vídeos novos dos seus canais, com filtro por categoria e opção de dispensar vídeos
- Player oficial do YouTube, que retoma de onde você parou e marca o vídeo como assistido aos 90%
- Tela final própria, no lugar das sugestões do YouTube
- Playlists pessoais e "Assistir depois"
- Busca nos vídeos já salvos, que não gasta cota da API
- Gravações de lives (lives ao vivo e agendadas ficam de fora)
- Atualização automática diária, mais o botão "Atualizar agora"
- Pode ser instalado na tela inicial do celular (PWA)

## Variáveis de ambiente

| Variável | Para que serve |
| --- | --- |
| `YOUTUBE_API_KEY` | Chave da YouTube Data API v3. Fica só no servidor. |
| `DATABASE_URL` | Connection string do Neon (PostgreSQL). |
| `APP_PASSWORD` | Senha para entrar no app. |
| `SESSION_SECRET` | Segredo longo e aleatório que assina o cookie de login. |
| `CRON_SECRET` | Segredo que a Vercel Cron envia para `/api/cron/sync`. |

Para gerar segredos aleatórios, rode:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Rodar no seu computador

```bash
npm install
```

Copie `.env.example` para `.env.local` e preencha as variáveis. Depois crie as tabelas no banco:

```bash
npx drizzle-kit migrate
```

E suba o app em http://localhost:3000:

```bash
npm run dev
```

Para testar sem o Neon, use um banco local em arquivo: coloque `DATABASE_URL=pglite:./.pglite` no `.env.local` e crie esse banco com:

```bash
npm run db:dev
```

Para rodar os testes:

```bash
npm test
```

## Publicar na Vercel

1. Crie o banco no [Neon](https://neon.tech) e copie a connection string.
2. Crie as tabelas no Neon, com `DATABASE_URL` apontando para ele:

   ```bash
   npx drizzle-kit migrate
   ```

3. Importe o repositório na [Vercel](https://vercel.com) e cadastre as 5 variáveis de ambiente.
4. Faça o deploy. A atualização diária roda às 06:00 (horário de Brasília), configurada no `vercel.json`. Confira em *Settings → Cron Jobs*.

## Como os Shorts ficam de fora

- Os vídeos vêm da playlist de "vídeos longos" de cada canal (`UULF…`). As gravações de lives vêm da playlist de lives (`UULV…`).
- Todo vídeo com até 3 minutos ainda passa por uma checagem no próprio YouTube antes de aparecer. Na dúvida, ele fica escondido.

## Limitações conhecidas

- As playlists `UULF` e `UULV` funcionam há anos, mas não estão na documentação oficial do YouTube. Se a `UULF` sumir, o app usa a playlist de uploads normal e fica dependendo só da checagem acima.
- Links e telas finais que o criador coloca **dentro** do vídeo não podem ser removidos.
- A busca usa o dicionário em português do PostgreSQL e diferencia acentos em alguns casos.
- A cota grátis da API é de 10.000 unidades por dia. Com algumas dezenas de canais, o uso fica bem abaixo disso.
