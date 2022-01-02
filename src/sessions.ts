// deno-lint-ignore-file no-explicit-any
import { Database, OpineRequest, OpineResponse, getCookies, Opine } from "./deps.ts";
import { fetchOptional } from "./utils.ts";

function init(app: Opine) {
    app.set('session', new SqliteSessionStore());
}

function getClient(req: OpineRequest, res: OpineResponse) {
    let { sid } = getCookies(req.headers);
    const session: SqliteSessionStore = req.app.get('session');

    if (!sid) {
        sid = session.createSession();
        res.cookie('sid', sid, {
            expires: new Date(Date.now() + 864e5),
            httpOnly: true
        });
    }
    return new ClientSession(sid, session);
}

function destroy(res: OpineResponse, sid: string) {
    res.clearCookie('sid');
    res.app.get('session').drop(sid);
}

class ClientSession {
    sid: string;
    session: SqliteSessionStore;

    constructor(sid: string, session: SqliteSessionStore) {
        this.sid = sid;
        this.session = session;
    }

    get<T>(key: string): T | null {
        return this.session.get<T>(this.sid, key);
    }

    set(key: string, val: any) {
        this.session.set(this.sid, key, val);
    }

    delete(key: string) {
        this.session.delete(this.sid, key);
    }

    clear() {
        this.session.clear(this.sid);
    }

    drop() {
        this.session.drop(this.sid);
    }
}

class SqliteSessionStore {
    db: Database;
    constructor() {
        this.db = new Database('./sessions.db');
        this.db.execute("pragma journal_mode = WAL");
        this.db.execute('CREATE TABLE IF NOT EXISTS sessions(id TEXT UNIQUE NOT NULL, data TEXT not null);');
    }

    createSession() {
        const id = crypto.randomUUID();
        this.db.execute('insert into sessions(id, data) VALUES(?, ?);', id, '{}');
        return id;
    }

    getSession(sid: string) {
        const res = fetchOptional(this.db, 'SELECT data FROM sessions WHERE id = ?', sid);
        let parsed: Record<string, any>;
        if (res) {
            parsed = JSON.parse(res.data || '{}');
        }
        else {
            this.db.execute('INSERT INTO sessions(id, data) VALUES(?, ?);', sid, '{}');
            parsed = {};
        }
        return parsed;
    }

    persist(sid: string, data: Record<string, any>) {
        this.db.execute('UPDATE sessions SET data = ? WHERE id = ?;', JSON.stringify(data), sid);
    }

    get<T>(sid: string, key: string): T | null {
        const session = this.getSession(sid);
        return session[key] || null;
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

    clear(sid: string) {
        this.db.execute('UPDATE sessions SET data = ? where id = ?', '{}', sid);
    }

    drop(sid: string) {
        this.db.execute('DELETE from sessions where id = ?', sid);
    }
}

export default {
    init, destroy, getClient
}