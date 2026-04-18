import path from 'path';

const DEFAULT_DATA_DIR = 'data';
const DEFAULT_PROMPT_ASSET_DB_FILE = 'app.db';

function resolveRuntimePath(value: string): string {
    return path.isAbsolute(value)
        ? value
        : path.resolve(/* turbopackIgnore: true */ process.cwd(), value);
}

export function getDataDir(): string {
    return resolveRuntimePath(process.env.DATA_DIR ?? DEFAULT_DATA_DIR);
}

export function getPromptAssetDatabasePath(): string {
    return resolveRuntimePath(
        process.env.PROMPT_ASSET_DB_PATH ?? path.join(getDataDir(), DEFAULT_PROMPT_ASSET_DB_FILE)
    );
}

export function getPromptAssetMigrationsDir(): string {
    return path.join(process.cwd(), 'app/lib/db/migrations');
}
