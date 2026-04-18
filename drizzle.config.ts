import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    dialect: 'sqlite',
    schema: './app/lib/db/schema/prompt-assets.ts',
    out: './app/lib/db/migrations',
    dbCredentials: {
        url: './data/app.db',
    },
});
