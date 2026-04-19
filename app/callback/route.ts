import { handleSignIn } from '@logto/next/server-actions';
import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';
import { getLogtoConfig } from '../logto';

export async function GET(request: NextRequest) {
    const config = getLogtoConfig();

    await handleSignIn(config, request.nextUrl.searchParams);
    redirect('/');
}
