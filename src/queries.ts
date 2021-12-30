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

    return (!size || !ac);
}

export function setSwap(db: DB, email: string, checked: string) {
    const swap = (checked == "on") ? 1 : 0;
    db.query("UPDATE users SET swap = ? WHERE email = ?", [swap, email]);
}

export function setRoom(db: DB, email: string, roomNo: number) {
    db.query("UPDATE users SET room_no = ? WHERE email = ?", [roomNo, email]);
}

export function getAvailableRooms(db: DB) {
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