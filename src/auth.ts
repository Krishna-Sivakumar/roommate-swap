const axios = require("axios");

export async function tokenIsValid(access_token: string): Promise<boolean> {
    try {
        const url = 'https://www.googleapis.com/oauth2/v3/userinfo';
        const testResponse = await axios.get(url, {
            params: { access_token: access_token }
        })

        return true;
    } catch (e) {
        return false;
    }
}

export async function refreshToken(client_id: string, client_secret: string, refresh_token: string): Promise<string> {
    try {
        const postBody = {
            client_id: client_id,
            client_secret: client_secret,
            refresh_token: refresh_token,
            grant_type: "refresh_token"
        }

        const response = await axios.post("https://oauth2.googleapis.com/token", postBody);

        if ("error" in response.data)
            throw new Error("Refresh Token has been revoked");

        return response.data["access_token"];
    } catch (e) {
        console.error(e);
    }
}
