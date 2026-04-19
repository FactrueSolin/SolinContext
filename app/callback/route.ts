import { handleSignIn } from '@logto/next/server-actions';
import { getLogtoConfig } from '../logto';

export async function GET(request: Request) {
    const config = getLogtoConfig();

    await handleSignIn(config, new URL(request.url));
    return Response.redirect(new URL(config.baseUrl));
}
