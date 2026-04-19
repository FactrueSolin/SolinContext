import { signOut } from '@logto/next/server-actions';
import { redirect } from 'next/navigation';
import { getLogtoConfig } from '../logto';

export async function POST() {
    const config = getLogtoConfig();
    await signOut(config, config.baseUrl);
}

export async function GET() {
    redirect('/');
}
