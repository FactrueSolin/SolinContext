import crypto from 'crypto';
import type { ApiConfig, EditorMessage } from '../../types';

export type ProjectRevisionOperation =
    | 'create'
    | 'update'
    | 'restore'
    | 'duplicate'
    | 'import'
    | 'migrate';

export interface ProjectRevisionSnapshot {
    name: string;
    systemPrompt: string;
    messages: EditorMessage[];
    apiConfig: ApiConfig;
    defaultCredentialId: string | null;
}

export function buildCompatHistoryKey(revisionId: string): string {
    return `${revisionId}.json`;
}

export function serializeMessages(messages: EditorMessage[]): string {
    return JSON.stringify(messages);
}

export function parseMessagesJson(messagesJson: string): EditorMessage[] {
    return JSON.parse(messagesJson) as EditorMessage[];
}

export function serializeApiConfig(apiConfig: ApiConfig): string {
    return JSON.stringify(apiConfig);
}

export function parseApiConfigJson(apiConfigJson: string): ApiConfig {
    return JSON.parse(apiConfigJson) as ApiConfig;
}

export function computeProjectContentHash(snapshot: Omit<ProjectRevisionSnapshot, 'defaultCredentialId'>): string {
    return crypto
        .createHash('sha256')
        .update(
            JSON.stringify({
                name: snapshot.name,
                systemPrompt: snapshot.systemPrompt,
                messages: snapshot.messages,
                apiConfig: snapshot.apiConfig,
            })
        )
        .digest('hex');
}

export function parseLegacyHistoryTimestamp(filename: string): number | null {
    const normalized = filename.replace(/\.json$/i, '').replace(/-/g, (match, offset) => {
        if (offset === 10) return 'T';
        if (offset === 13 || offset === 16) return ':';
        if (offset === 19) return '.';
        return match;
    });

    const timestamp = Date.parse(normalized);
    return Number.isNaN(timestamp) ? null : timestamp;
}

export function parseIsoTimestamp(value: string | null | undefined): number | null {
    if (!value) {
        return null;
    }

    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? null : timestamp;
}
