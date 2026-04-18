import fs from 'fs';
import path from 'path';
import BetterSqlite3 from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema/prompt-assets';

const DATA_DIR = path.join(process.cwd(), 'data');
const DEFAULT_DB_PATH = path.join(DATA_DIR, 'app.db');
const MIGRATIONS_DIR = path.join(process.cwd(), 'app/lib/db/migrations');

export interface PromptAssetDatabaseContext {
    client: BetterSqlite3.Database;
    db: BetterSQLite3Database<typeof schema>;
}

export interface CreatePromptAssetDatabaseOptions {
    fileName?: string;
    migrateDatabase?: boolean;
}

let databaseContext: PromptAssetDatabaseContext | null = null;

export function createPromptAssetDatabaseContext(
    options: CreatePromptAssetDatabaseOptions = {}
): PromptAssetDatabaseContext {
    const fileName = options.fileName ?? DEFAULT_DB_PATH;
    const shouldMigrate = options.migrateDatabase ?? true;

    if (fileName !== ':memory:') {
        fs.mkdirSync(path.dirname(fileName), { recursive: true });
    }

    const client = new BetterSqlite3(fileName);
    client.pragma('foreign_keys = ON');
    client.pragma('journal_mode = WAL');
    client.pragma('busy_timeout = 5000');

    const db = drizzle(client, { schema });

    if (shouldMigrate) {
        migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    }

    return { client, db };
}

export function getPromptAssetDatabaseContext(): PromptAssetDatabaseContext {
    if (!databaseContext) {
        databaseContext = createPromptAssetDatabaseContext();
    }

    return databaseContext;
}

export function resetPromptAssetDatabaseContext(): void {
    if (databaseContext) {
        databaseContext.client.close();
        databaseContext = null;
    }
}
