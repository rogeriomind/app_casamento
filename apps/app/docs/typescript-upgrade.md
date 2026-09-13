# TypeScript upgrade

Em 2026-07-25, `npm view typescript version` retornou `7.0.2`.

O projeto foi testado com `typescript@7.0.2`: `tsc --noEmit` passou, mas `npm run lint` falhou porque o `typescript-eslint` incluído pelo `eslint-config-next` ainda nao suporta TypeScript 7.0.

Versao aplicada:

```text
typescript@6.0.3
```

Esta foi a versao estavel mais recente abaixo de 7 encontrada em `npm view typescript versions --json`.

Validacoes com `typescript@6.0.3`:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Todas passaram. Nao foi necessario alterar `tsconfig.json`.
