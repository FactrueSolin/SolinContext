import { handleSignIn } from '@logto/next/server-actions';
import { getLogtoConfig } from '../logto';

export async function GET(request: Request) {
    await handleSignIn(getLogtoConfig(), new URL(request.url));
}
