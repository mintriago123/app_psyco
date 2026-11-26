This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Despliegue del progreso atómico

En una base nueva, aplica primero `supabase/schema.sql`. En una base que ya
tiene usuarios, conserva el esquema instalado y aplica
`supabase/migrations/202611250001_atomic_game_progress.sql`.

Durante el cambio al cliente nuevo, aplica `supabase/cutover-atomic-game-progress.sql`
y publica el cliente en la misma ventana de despliegue. El script retira los
permisos de escritura directa y mantiene la lectura del progreso propio. Las
pestañas con el cliente anterior deben recargar para usar las RPC. Ejecuta primero
ambos pasos en el entorno de prueba.

Para verificar el motor con las dependencias locales, ejecuta
`bash scripts/verify-phase2.sh`. Ejecuta también `pnpm build` y `pnpm lint`.

La prueba de concurrencia usa una instancia PostgreSQL local desechable y el
paquete `pg` disponible para Node.js. Indica una base vacía con un usuario que
pueda crear roles y esquemas.

```bash
ATOMIC_PROGRESS_TEST_DATABASE_URL=postgresql://localhost/app_psyco_test node scripts/verify-atomic-progress.mjs
```
