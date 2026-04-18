import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    dialect: 'sqlite',
    schema: './app/lib/db/schema/prompt-assets.ts',
    out: './app/lib/db/migrations',
    dbCredentials: {
        url: process.env.PROMPT_ASSET_DB_PATH ?? './data/app.db',
    },
});
