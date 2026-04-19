import { signIn } from '@logto/next/server-actions';
import { getLogtoConfig } from '../logto';

export async function GET() {
    const config = getLogtoConfig();

    await signIn(config, {
        redirectUri: `${config.baseUrl}/callback`,
        postRedirectUri: config.baseUrl,
    });
}
