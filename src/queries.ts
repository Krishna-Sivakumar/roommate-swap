import { Database } from "./deps.ts";
import { fetchOptional } from "./utils.ts";

export function initialiseDB() {
    const db = new Database('./vswap.db');
    db.execute("pragma journal_mode = WAL");
    db.execute("CREATE TABLE IF NOT EXISTS users(email TEXT PRIMARY KEY, name TEXT, reg_no TEXT, room_no INTEGER, size INTEGER, ac INTEGER, swap INT DEFAULT 0);");
    return db;
}

export function isFirstLogin(db: Database, email: string) {
    const result = fetchOptional(db, 'select size, ac from users where email = ?', email);

    if (!result) return false;
    return (result.size == null || result.ac == null);
}

export function getSwappingUsers(db: Database) {
    return db.queryObject(`
        select name, reg_no, room_no, size, ac
        from users
        where swap = 1
        order by room_no;
    `);
}

export function getUserDetails(db: Database, key: string) {
    return fetchOptional(db, "SELECT * FROM users WHERE email = ?", key)!;
}
