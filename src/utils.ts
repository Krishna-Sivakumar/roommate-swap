import { DB, ExtMapping, NextFunction, OpineRequest, OpineResponse, path, Row } from "./deps.ts";
import { error } from "./logging.ts";

export function scream(code: number, ...data: unknown[]) {
    if (code == 0) console.log(...data);
    else error(...data);
    Deno.exit(code);
}

export function execute(db: DB, query: string, ...params: (string | boolean | number)[]) {
    db.query(query, params);
}

export function fetchOptional<T extends Row>(db: DB, query: string, ...params: (string | boolean | number)[]): T | null {
    const result = fetchMany<T>(db, query, ...params);
    if (result.length === 0) return null;
    return result[0];
}

export function fetchMany<T extends Row>(db: DB, query: string, ...params: (string | boolean | number)[]): T[] {
    const result = db.query<T>(query, params);
    return result;
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

export function serveDir(dirPath: string) {
    return async function serveStaticDir(req: OpineRequest, res: OpineResponse, next: NextFunction) {
        let p = (req.path).replace(/^\//, '').trim();
        if (p.endsWith('/')) {
            p = path.join(p, 'index.html');
        }
        try {
            const finalPath = path.join(dirPath, p);
            const extension = path.extname(finalPath);
            res.setStatus(200)
                .type(ExtMapping[extension][0] || 'text/plain')
                .send(await Deno.readFile(finalPath));
        }
        catch (e) {
            if (e instanceof Deno.errors.NotFound) {
                res.setStatus(404);
            }
            else {
                res.setStatus(500);
            }
            res.type('text/plain').send(e);
        }
        next()
    }
}