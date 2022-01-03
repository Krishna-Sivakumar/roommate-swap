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

/**
*   Filters users from the 'user' table based on a list of parameters.
*
*   @param db: database instance to query.
*   @param options: list of parameters to filter users with.
*
*   Following is the role of each parameter:
*
*   - `reg_no`: prefix match of registration number (overrides all other parameters)
*   - `room_no`: prefix match of room number (overrides everything except reg_no)
*   - `size_min` and `size_max`: match of room sizes between size_min and size_max
*   - `floor_min` and `floor_max`: match of rooms in floors between floor_min and floor_max
*   - `ac_type`: match of rooms with AC or Non-AC
*
*   @returns A 2-tuple encapsulating the filtered rows and the result status message.
*/
export function filterUsers(db: Database, options: {[index: string]: string | number}): [Record<string, any>[], string] {

    let result;

    const status_messages = {
        reg_no: "No rooms with the queried registration number found.",
        room_no: "No rooms with the queried room number found.",
        others: "No rooms with the queried parameters found.",
        success: ""
    }

    let search_status = status_messages.success;

    if (options.reg_no) {
        result = db.queryObject(
            "SELECT name, reg_no, room_no, size, ac FROM users WHERE reg_no LIKE ?",
            options.reg_no + "%"
        );

        if (result.length == 0)
            search_status = status_messages.reg_no;

    } else if (options.room_no) {
        result = db.queryObject(
            "SELECT name, reg_no, room_no, size, ac FROM users where room_no LIKE ?",
            options.room_no + "%"
        );

        if (result.length == 0)
            search_status = status_messages.room_no;

    } else {
        const isAC = (options.ac_type == "AC")? 1 : 0;

        const floorMax = (options.floor_max as number + 1) * 100 - 1;
        const floorMin = Math.min((options.floor_min as number) * 100, floorMax);

        const sizeMax = (options.size_max as number);
        const sizeMin = Math.min((options.size_min as number), sizeMax);

        result = db.queryObject(
            "SELECT name, reg_no, room_no, size, ac FROM users WHERE ac = ? AND (room_no BETWEEN ? AND ?) AND (size BETWEEN ? AND ?)",
            isAC,
            floorMin,
            floorMax,
            sizeMin,
            sizeMax
        );

        if (result.length == 0)
            search_status = status_messages.others;
    }

    return [result, search_status];
}
