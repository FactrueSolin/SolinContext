import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    getDataDir,
    getPromptAssetDatabasePath,
} from '../../app/lib/runtime-paths';

describe('runtime paths', () => {
    afterEach(() => {
        delete process.env.DATA_DIR;
        delete process.env.PROMPT_ASSET_DB_PATH;
    });

    it('uses the repository data directory by default', () => {
        expect(getDataDir()).toBe(path.join(process.cwd(), 'data'));
        expect(getPromptAssetDatabasePath()).toBe(path.join(process.cwd(), 'data', 'app.db'));
    });

    it('respects an absolute data directory override', () => {
        process.env.DATA_DIR = '/tmp/aicontext-data';

        expect(getDataDir()).toBe('/tmp/aicontext-data');
        expect(getPromptAssetDatabasePath()).toBe('/tmp/aicontext-data/app.db');
    });

    it('respects an explicit database path override', () => {
        process.env.DATA_DIR = '/tmp/aicontext-data';
        process.env.PROMPT_ASSET_DB_PATH = '/srv/app/custom.db';

        expect(getPromptAssetDatabasePath()).toBe('/srv/app/custom.db');
    });
});
