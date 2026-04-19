import type { LogtoNextConfig } from '@logto/next';

function readEnv(name: string): string | undefined {
    const value = process.env[name]?.trim();
    return value ? value : undefined;
}

function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
}

function getRequiredEnv(name: string): string {
    const value = readEnv(name);

    if (!value) {
        throw new Error(`Missing required env: ${name}`);
    }

    return value;
}

export function isLogtoConfigured(): boolean {
    return Boolean(
        readEnv('APP_BASE_URL') &&
            readEnv('LOGTO_ENDPOINT') &&
            readEnv('LOGTO_APP_ID') &&
            readEnv('LOGTO_APP_SECRET') &&
            readEnv('LOGTO_COOKIE_SECRET')
    );
}

export function getLogtoConfig(): LogtoNextConfig {
    const baseUrl = trimTrailingSlash(getRequiredEnv('APP_BASE_URL'));

    return {
        endpoint: getRequiredEnv('LOGTO_ENDPOINT'),
        appId: getRequiredEnv('LOGTO_APP_ID'),
        appSecret: getRequiredEnv('LOGTO_APP_SECRET'),
        baseUrl,
        cookieSecret: getRequiredEnv('LOGTO_COOKIE_SECRET'),
        cookieSecure: process.env.NODE_ENV === 'production',
        scopes: (readEnv('LOGTO_SCOPES') ??
            'openid profile email offline_access urn:logto:scope:organizations').split(/\s+/),
    };
}
