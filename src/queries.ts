// deno-lint-ignore-file no-explicit-any
import { DB } from "./deps.ts";
import { fetchOptional, fetchMany } from "./utils.ts";

export function initialiseDB() {
    const db = new DB('./vswap.db');
    db.query("CREATE TABLE IF NOT EXISTS users(email TEXT PRIMARY KEY, name TEXT, reg_no TEXT, room_no INTEGER, size INTEGER, ac INTEGER, swap INT DEFAULT 0);");

    return db;
}

export function firstLogin(db: DB, email: string) {
    const result = fetchOptional<(number | null)[]>(db, 'select size, ac from users where email = ?', email);

    if (!result) return false;
    const [size, ac] = result;

    return (size == null || ac == null);
}

export function getSwappingUsers(db: DB) {
    const result = fetchMany(db, `
        select distinct name, reg_no, room_no, size, ac
        from users
        where swap = 1
        order by room_no;
    `);

    const rooms: Record<string, any>[] = [];

    for (const row of result) {
        const [name, regNo, roomNo, size, ac] = row;
        rooms.push({ name, regNo, roomNo, size, ac });
    }

    return rooms;
}

export function getUserDetails(db: DB, key: string) {
    const [email, name, reg_no, room_no, size, ac, swap] = fetchOptional<string[]>(db, "SELECT * FROM users WHERE email = ?", key)!;
    return { email, name, regNo: reg_no, roomNo: room_no, size, ac, swapping: swap };
}
