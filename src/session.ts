// deno-lint-ignore-file no-explicit-any
import { DB, OpineRequest, OpineResponse, getCookies, Opine } from "./deps.ts";
import { execute, fetchOptional } from "./utils.ts";

export function initSessions(app: Opine) {
    app.set('session', new SqliteSessionStore());
}

export function getClientSession(req: OpineRequest, res: OpineResponse) {
    let { sid } = getCookies(req.headers);
    const session: SqliteSessionStore = req.app.get('session');

    if (!sid) {
        sid = session.createSession();
        res.cookie('sid', sid, {
            expires: new Date(Date.now() + 864e5),
            httpOnly: true
        });
    }
    return { sid, session };
}

export function destroySession(res: OpineResponse, sid: string) {
    res.clearCookie('sid');
    res.app.get('session').drop(sid);
}

export class SqliteSessionStore {
    db: DB;
    constructor() {
        this.db = new DB('./sessions.db');
        execute(this.db, 'CREATE TABLE IF NOT EXISTS sessions(id TEXT UNIQUE NOT NULL, data TEXT not null);');
    }

    createSession() {
        const id = crypto.randomUUID();
        execute(this.db, 'insert into sessions(id, data) VALUES(?, ?);', id, '{}');
        return id;
    }

    getSession(sid: string) {
        const data = fetchOptional<string[]>(this.db, 'SELECT data FROM sessions WHERE id = ?', sid);
        let parsed: Record<string, any>;
        if (data) {
            parsed = JSON.parse(data[0] || '{}');
        }
        else {
            execute(this.db, 'INSERT INTO sessions(id, data) VALUES(?, ?);', sid, '{}');
            parsed = {};
        }
        return parsed;
    }

    persist(sid: string, data: Record<string, any>) {
        execute(this.db, 'UPDATE sessions SET data = ? WHERE id = ?;', JSON.stringify(data), sid);
    }

    set(sid: string, key: string, val: any) {
        const session = this.getSession(sid);
        session[key] = val;
        this.persist(sid, session);
    }

    delete(sid: string, key: string) {
        const session = this.getSession(sid);
        delete session[key];
        this.persist(sid, session);
    }

    get<T>(sid: string, key: string): T | null {
        const session = this.getSession(sid);
        return session[key] || null;
    }

    clear(sid: string) {
        execute(this.db, 'UPDATE sessions SET data = ? where id = ?', '{}', sid);
    }

    drop(sid: string) {
        execute(this.db, 'DELETE from sessions where id = ?', sid);
    }
}