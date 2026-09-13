# App Casamento

Monorepo com duas aplicações independentes:

- `apps/app`: captura pública, convidados, uploads de fotos e vídeos, Bunny Storage/Stream.
- `apps/portal`: portal privado para proprietários, álbuns, favoritos e sincronização.

Cada aplicação mantém seu `package.json`, lockfile, Prisma Client, banco e migrações. Use Node 24.

```sh
npm --prefix apps/app ci
npm --prefix apps/portal ci
npm --prefix apps/app run dev
npm --prefix apps/portal run dev
```

O vínculo entre um álbum do portal e um evento da captura é administrativo e simulado por padrão:

```sh
npm --prefix apps/portal run capture:link -- --owner-email dono@example.com --portal-event-id portal-event-id --capture-event-id capture-event-id --capture-client-hash hash-do-cliente
npm --prefix apps/portal run capture:link -- --owner-email dono@example.com --portal-event-id portal-event-id --capture-event-id capture-event-id --capture-client-hash hash-do-cliente --apply
```

O deploy de produção ocorre após merge na `main`, por GitHub Actions, com os dois Compose isolados na VPS Contabo. O portal usa `portal.productpulse.com.br`; a captura permanece em `digax.productpulse.com.br`.

Consulte `docs/deploy.md` para secrets, DNS, migração e recuperação.
