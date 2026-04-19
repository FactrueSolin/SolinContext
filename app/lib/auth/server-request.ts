import { headers } from 'next/headers';

export async function createServerRequest(url = 'http://localhost/'): Promise<Request> {
    const requestHeaders = await headers();

    return new Request(url, {
        headers: new Headers(requestHeaders),
    });
}
