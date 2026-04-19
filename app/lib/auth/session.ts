import { getLogtoConfig, isLogtoConfigured } from '../../logto';
import { unauthenticated } from '../api/errors';

export interface SessionIdentity {
    logtoUserId: string;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
}

function readDevSessionFromHeaders(request: Request): SessionIdentity | null {
    const logtoUserId = request.headers.get('x-dev-user-id')?.trim();

    if (!logtoUserId) {
        return null;
    }

    return {
        logtoUserId,
        email: request.headers.get('x-dev-user-email')?.trim() || null,
        name: request.headers.get('x-dev-user-name')?.trim() || null,
        avatarUrl: request.headers.get('x-dev-user-avatar-url')?.trim() || null,
    };
}

export async function getSessionIdentity(request: Request): Promise<SessionIdentity | null> {
    const devSession = readDevSessionFromHeaders(request);
    if (devSession) {
        return devSession;
    }

    if (!isLogtoConfigured()) {
        return null;
    }

    const { getLogtoContext: getSdkLogtoContext } = await import('@logto/next/server-actions');
    const context = await getSdkLogtoContext(getLogtoConfig());
    if (!context.isAuthenticated || !context.claims?.sub) {
        return null;
    }

    return {
        logtoUserId: context.claims.sub,
        email: context.claims.email ?? null,
        name: context.claims.name ?? context.claims.username ?? null,
        avatarUrl: context.claims.picture ?? null,
    };
}

export async function requireSession(request: Request): Promise<SessionIdentity> {
    const identity = await getSessionIdentity(request);
    if (!identity) {
        throw unauthenticated();
    }

    return identity;
}
