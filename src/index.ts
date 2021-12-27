import * as express from "express";
import * as cookieParser from "cookie-parser";
import * as formidable from "formidable";
import * as config from "./config";
import * as sqlite3 from "sqlite3";
import * as sqlite from "sqlite";
import { OAuth2Client } from "google-auth-library"
import { google } from "googleapis";
const cors = require("cors");

import * as auth from "./auth";

let app = express();
app.use(cors());
app.set("view engine", "ejs");
app.use(cookieParser())
app.use(express.static("./public"));

let dbPromise = sqlite.open({
    filename: "./database.db",
    driver: sqlite3.Database
})

const authenticatedClient: OAuth2Client = new OAuth2Client(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    config.redirectURIs[0]
);

async function ensureDB(uri: string) {
    /*
        Creates a new database file and initializes tables in case they don't exist.
    */
    let db = await sqlite.open({
        filename: uri,
        driver: sqlite3.Database
    })

    db.exec("CREATE TABLE IF NOT EXISTS rooms(email TEXT PRIMARY KEY, room_no INTEGER, size INTEGER, ac INTEGER, swap INT DEFAULT 0);");
}

async function queryRooms(db: sqlite.Database, query): Promise<any[]> {
    const ac = escape(query.ac);
    const size = escape(query.size);
    const block = escape(query.block);
    const room_no = `%${escape(query.room_no)}%`;

    return db.all("select size, room_no, email from rooms where room_no like ? and size=?", room_no, size);
}

async function firstLogin(db: sqlite.Database, email: string): Promise<Boolean> {
    let row = await db.get("SELECT size, ac FROM rooms WHERE email = ?", email);
    return !(row != undefined && row.size != null && row.ac != null);
}

async function setSwap(db: sqlite.Database, email: string, checked: string) {
    let swap = (checked == "on") ? 1 : 0;
    await db.run("UPDATE TABLE rooms SET swap = ? WHERE email = ?", swap, email);
}

async function setRoom(db: sqlite.Database, email: string, room_no: number) {
    await db.run("UPDATE rooms SET room_no = ? WHERE email = ?", room_no, email);
}

interface Form {
    fields: Object,
    files: Object
}

async function parseForm(req): Promise<Form> {
    return new Promise((resolve, reject) => {
        formidable({ multiples: true }).parse(req, (err, fields, files) => {
            if (err) {
                reject(err);
                return;
            }

            const res: Form = {
                fields: fields,
                files: files
            }

            resolve(res);
        })
    })
}

async function getAvailableRooms(db: sqlite.Database): Promise<any[]> {
    const rooms = await db.all(`
        select distinct room_no as room_no, count(room_no) as count
        from rooms
        where swap = 1
        group by room_no order by room_no;
    `);
    return rooms;
}

app.get('/', async function home(req, res) {
    let db = await dbPromise;

    const authURL = authenticatedClient.generateAuthUrl({
        access_type: "offline",
        scope: ["https://www.googleapis.com/auth/userinfo.profile", "https://www.googleapis.com/auth/userinfo.email"],
        hd: "vitstudent.ac.in"                                      // Only allow accounts from the domain 'vitstudent.ac.in'
    });

    let loggedIn: boolean = false;
    let name: string = "";
    let user: Object = { loggedIn: false }

    if (req.cookies.AT != undefined) {
        const isValid = await auth.tokenIsValid(req.cookies.AT);
        if (isValid) {
            user = {
                loggedIn: true,
                name: req.cookies.NM,
                firstLogin: await firstLogin(db, req.cookies.EM)
            };
        } else if (req.cookies.RF != "undefined") {
            // Check if refresh token is present, and use it to refresh the access token
            try {
                const access_token = await auth.refreshToken(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET, req.cookies.RF);
                req.cookies("AT", access_token, { httpOnly: true });
            } catch (e) {
                // User isn't logged in, clear cookies if present
                res.clearCookie("EM");
                res.clearCookie("NM");
                res.clearCookie("AT");
                res.clearCookie("RF");
            }
        } else {
            // User isn't logged in, clear cookies if present
            res.clearCookie("EM");
            res.clearCookie("NM");
            res.clearCookie("AT");
            res.clearCookie("RF");
        }
    } else {
        // User isn't logged in, clear cookies if present
        res.clearCookie("EM");
        res.clearCookie("NM");
        res.clearCookie("AT");
        res.clearCookie("RF");
    }

    res.render("index", {
        user: user,
        authLink: authURL,
        rows: await queryRooms(db, req.query),
        ava: await getAvailableRooms(db),
        size: req.query.size,
        ac: req.query.ac
    });
});

app.post("/form/init", async function initialLogin(req, res) {
    let db = await dbPromise;

    const formData = await parseForm(req);

    const ac = formData.fields["initial-class"] == "AC" ? 1 : 0;

    db.run(
        "UPDATE rooms SET size = ?, ac = ? WHERE email = ?;",
        formData.fields["initial-size"],
        ac,
        req.cookies.EM
    );

    res.redirect("/");
});

app.post("/form/swap", async function swap(req, res) {
    let db = await dbPromise;

    const formData = await parseForm(req);

    setSwap(db, req.cookies.EM, formData.fields["swap"]);
    setRoom(db, req.cookies.EM, formData.fields["room-no"]);

    res.redirect("/");
})

app.get("/auth/google", async function login(req, res) {
    /*
        Logs the user in and sets the following cookies:
        NM: Google user's given_name
        AT: Access Token
        RF: Refresh Token
    */

    const authCode = req.query.code as string;
    const r = await authenticatedClient.getToken(authCode);
    authenticatedClient.setCredentials(r.tokens);

    // Get userinfo from googleapis
    let getter = google.oauth2({ auth: authenticatedClient, version: "v2" })
    let response = await getter.userinfo.get({});

    // Set relevant cookies
    res.cookie("EM", response.data.email, { httpOnly: true });
    res.cookie("NM", response.data.given_name, { httpOnly: true });
    res.cookie("AT", authenticatedClient.credentials.access_token, { httpOnly: true });
    res.cookie("RF", authenticatedClient.credentials.refresh_token, { httpOnly: true });

    // Instantiate a new record with no values set in the database, if the email is logging in for the first time
    let db = await dbPromise;
    db.run("INSERT OR IGNORE INTO rooms(email) VALUES(?)", response.data.email);

    // Log the login event
    console.info(`[INFO] ${response.data.email} logged in at ${new Date()}`)

    res.redirect("/");
});

app.get("/logout", async function logout(req, res) {
    /*
        Logs the user out and clears all cookies
    */

    // Clear user-related cookies
    res.clearCookie("EM");
    res.clearCookie("NM");
    res.clearCookie("AT");
    res.clearCookie("RF");

    // Log the logout event
    console.info(`[INFO] ${req.cookies.EM} logged out at ${new Date()}`)
    res.redirect("/");
})

let PORT = process.env.PORT || 4000;

ensureDB("database.db");

app.listen(PORT, () => console.log(`listening on port ${PORT}`));
