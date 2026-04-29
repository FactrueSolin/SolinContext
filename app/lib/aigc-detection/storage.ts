import { createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { getDataDir } from '../runtime-paths';
import { aigcDetectionStorageError } from './errors';

export interface StoredAigcDetectionFile {
    relativePath: string;
    absolutePath: string;
    sha256: string;
    size: number;
    extension: 'pdf' | 'doc' | 'docx';
    mimeType: string;
    originalFileName: string;
}

function sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'upload';
}

function buildStoragePath(workspaceId: string, taskId: string, originalFileName: string): string {
    const now = new Date();
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return path.join('aigc-detection', workspaceId, year, month, `${taskId}-${sanitizeFileName(originalFileName)}`);
}

export function getAigcDetectionStoragePath(relativePath: string): string {
    return path.join(getDataDir(), relativePath);
}

export async function persistAigcDetectionFile(options: {
    taskId: string;
    workspaceId: string;
    fileName: string;
    mimeType: string;
    extension: 'pdf' | 'doc' | 'docx';
    bytes: Uint8Array;
}): Promise<StoredAigcDetectionFile> {
    const relativePath = buildStoragePath(options.workspaceId, options.taskId, options.fileName);
    const absolutePath = getAigcDetectionStoragePath(relativePath);

    try {
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await fs.writeFile(absolutePath, options.bytes);
    } catch (error) {
        throw aigcDetectionStorageError(
            'Failed to persist uploaded file',
            error instanceof Error ? error.message : String(error)
        );
    }

    return {
        relativePath,
        absolutePath,
        sha256: createHash('sha256').update(options.bytes).digest('hex'),
        size: options.bytes.byteLength,
        extension: options.extension,
        mimeType: options.mimeType,
        originalFileName: options.fileName,
    };
}

export async function readAigcDetectionFile(relativePath: string): Promise<Uint8Array> {
    try {
        const buffer = await fs.readFile(getAigcDetectionStoragePath(relativePath));
        return new Uint8Array(buffer);
    } catch (error) {
        throw aigcDetectionStorageError(
            'Failed to read cached file for AIGC detection',
            error instanceof Error ? error.message : String(error)
        );
    }
}

export async function deleteAigcDetectionFile(relativePath: string): Promise<void> {
    try {
        await fs.unlink(getAigcDetectionStoragePath(relativePath));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return;
        }

        throw aigcDetectionStorageError(
            'Failed to delete cached file for AIGC detection',
            error instanceof Error ? error.message : String(error)
        );
    }
}
