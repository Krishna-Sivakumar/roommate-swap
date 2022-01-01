import { VswapConfig } from "./utils.ts";

export async function getProfileInfo(accessToken: string) {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo?fields=given_name,email,picture,id,verified_email', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (response.status != 200) throw new Error('Error: Failed to get user information');

    return await response.json();
}

export async function getAccessToken(config: VswapConfig, code: string): Promise<string> {
    const params = new URLSearchParams();
    params.set("client_id", config.clientId);
    params.set("client_secret", config.clientSecret);
    params.set("redirect_uri", config.redirectUris.google);
    params.set("code", code);
    params.set("grant_type", "authorization_code");

    const response = await fetch('https://www.googleapis.com/oauth2/v4/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
    });

    if (response.status != 200) throw new Error('Error: Failed to receive access token');

    const json = await response.json();
    return json.access_token;
}

export function getAuthUrl(config: VswapConfig) {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');

    url.searchParams.set('scope', 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email');
    url.searchParams.set('redirect_uri', config.redirectUris['google']);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('access_type', 'online');
    url.searchParams.set('hd', 'vitstudent.ac.in');

    return url.toString();
}

export async function isAuthTokenValid(accessToken: string) {
    try {
        const url = new URL('https://www.googleapis.com/oauth2/v3/userinfo');
        url.searchParams.set('access_token', accessToken);
        const res = await fetch(url.toString());

        return res.ok;
    }
    catch {
        return false;
    }
}