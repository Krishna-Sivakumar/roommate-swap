import { Database } from "./deps.ts";
import { error } from "./logging.ts";

export function scream(code: number, ...data: unknown[]) {
    if (code == 0) console.log(...data);
    else error(...data);
    Deno.exit(code);
}

export function fetchOptional(db: Database, query: string, ...params: (string | boolean | number)[]) {
    const result = db.queryObject(query, ...params);
    if (result.length === 0) return null;
    return result[0];
}

export interface VswapConfig {
    clientSecret: string,
    clientId: string,
    port: number,
    rootUri: string,
    redirectUris: Record<string, string>
}

export function getConfigFromEnv(): VswapConfig {
    const port = parseInt(Deno.env.get("PORT") ?? "3001");

    const clientId = Deno.env.get("VSWAP_CLIENT_ID");
    const clientSecret = Deno.env.get("VSWAP_CLIENT_SECRET");

    const rootUri = Deno.env.get("VSWAP_SERVER_URI") || "https://roomswap.ml";

    const redirectUris = {
        google: `${rootUri}/auth/google`
    };

    if (!clientId || !clientSecret) {
        throw scream(1, "You must set the VSWAP_CLIENT_ID and VSWAP_CLIENT_SECRET variables to proceed.");
    }

    return {
        port, clientId, clientSecret, rootUri, redirectUris
    };
}

export const ALLOWED_ORIGINS_RE = /.*(localhost|roomswap.ml|127.0.0.1).*/;