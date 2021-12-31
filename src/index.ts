import * as express from "express";
import * as cookieParser from "cookie-parser";
import * as cors from "cors";
import * as session from "express-session";
import * as formidable from "formidable";
import * as config from "./config";
import * as sqlite3 from "sqlite3";
import * as sqlite from "sqlite";
import { OAuth2Client } from "google-auth-library"
import { google } from "googleapis";

const SQLiteStore = require("connect-sqlite3")(session);

import * as auth from "./auth";
let app = express();
app.use(cors());
app.set("view engine", "ejs");
app.use(cookieParser());
app.use(session({
    secret: config.SESSION_SECRET,
    store: new SQLiteStore,
    saveUninitialized: false,
    resave: false
}));
app.use(express.static("./public"));

let dbPromise = sqlite.open({
    filename: "./database.db",
    driver: sqlite3.Database
})

const authenticatedClient: OAuth2Client = new OAuth2Client(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    config.REDIRECT_URIS.google
);

/*
    database interface functions start here
*/

async function ensureDB(uri: string) {
    /*
        Creates a new database file and initializes tables in case they don't exist.
    */
    let db = await sqlite.open({
        filename: uri,
        driver: sqlite3.Database
    })

    db.exec("CREATE TABLE IF NOT EXISTS users(email TEXT PRIMARY KEY, name TEXT, reg_no TEXT, room_no INTEGER, size INTEGER, ac INTEGER, swap INT DEFAULT 0);");
}

async function firstLogin(db: sqlite.Database, email: string): Promise<Boolean> {
    let row = await db.get("SELECT size, ac FROM users WHERE email = ?", email);
    return !(row != undefined && row.size != null && row.ac != null);
}

async function setSwap(db: sqlite.Database, email: string, checked: string) {
    let swap = (checked == "on") ? 1 : 0;
    await db.run("UPDATE users SET swap = ? WHERE email = ?", swap, email);
}

async function setRoom(db: sqlite.Database, email: string, room_no: number) {
    await db.run("UPDATE users SET room_no = ? WHERE email = ?", room_no, email);
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
        select distinct name, reg_no, room_no, size, ac
        from users
        where swap = 1
        order by room_no;
    `);
    return rooms;
}

/* 
    database interface functions end here 
*/

/*
    routes start here
*/

app.get('/', async function home(req, res) {
    let db = await dbPromise;

    const authURL = authenticatedClient.generateAuthUrl({
        access_type: "offline",
        scope: ["https://www.googleapis.com/auth/userinfo.profile", "https://www.googleapis.com/auth/userinfo.email"],
        hd: "vitstudent.ac.in" // Only allow accounts from the domain 'vitstudent.ac.in'
    });

    let loggedIn: boolean = false;
    let name: string = "";
    let user: Record<string, any> = { loggedIn: false }

    if (req.session["AT"] != undefined) {
        const isValid = await auth.tokenIsValid(req.session["AT"]);
        if (isValid) {
            const isFirstLogin = await firstLogin(db, req.session["EM"]);
            user = {
                loggedIn: true,
                name: req.session["NM"],
                firstLogin: isFirstLogin,
            };

            if (!isFirstLogin) {
                let details = await getUserDetails(db, req.session["EM"]);
                user['swapping'] = details.swap;
                user['regno'] = details.reg_no;
                user['room_no'] = details.room_no;
                user['size'] = details.size;
                user['ac'] = details.ac == 1;
            }
        } else if (req.session["RF"] != "undefined") {
            // Check if refresh token is present, and use it to refresh the access token
            try {
                const access_token = await auth.refreshToken(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET, req.session["RF"]);
                req.session["AT"] = access_token;
            } catch (e) {
                // User isn't logged in, clear the session
                req.session.destroy(() => { });
            }
        } else {
            // User isn't logged in, clear the session
            req.session.destroy(() => { });
        }
    } else {
        // User isn't logged in, clear the session
        req.session.destroy(() => { });
    }

    let rooms = await getAvailableRooms(db);
    let grouped: Record<number, any[]> = {};

    for (const user of rooms) {
        grouped[user.room_no] = grouped[user.room_no] || [];
        grouped[user.room_no].push(user);
    }

    res.render("index", {
        user: user,
        authLink: authURL,
        available: grouped,
        size: req.query.size,
        ac: req.query.ac
    });
});

app.post("/form/init", async function initialLogin(req, res) {
    /*
        Endpoint for setting the details on first-login
    */
    let db = await dbPromise;

    const formData = await parseForm(req);

    const ac = formData.fields["initial-class"] == "AC" ? 1 : 0;

    db.run(
        "UPDATE users SET size = ?, ac = ?, reg_no = ? WHERE email = ?;",
        formData.fields["initial-size"],
        ac,
        formData.fields["reg-no"],
        req.session["EM"]
    );

    res.redirect("/");
});

app.post("/form/swap", async function swap(req, res) {
    /*
        Endpoint for setting the swap status
    */
    let db = await dbPromise;

    const formData = await parseForm(req);

    setSwap(db, req.session["EM"], formData.fields["swap"]);
    setRoom(db, req.session["EM"], formData.fields["room-no"]);

    res.redirect("/");
})

app.get("/auth/google", async function login(req, res) {
    /*
        Logs the user in and sets the following session variables:
        EM: Google user's emai
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

    // Setting session variables
    req.session["EM"] = response.data.email;
    req.session["NM"] = response.data.given_name;
    req.session["AT"] = authenticatedClient.credentials.access_token;
    req.session["RF"] = authenticatedClient.credentials.refresh_token;

    // Instantiate a new record with no values set in the database, if the email is logging in for the first time
    let db = await dbPromise;
    db.run("INSERT OR IGNORE INTO users(email, name) VALUES(?, ?)", response.data.email, response.data.given_name);

    // Log the login event
    console.info(`[INFO] ${response.data.email} logged in at ${new Date()}`)

    res.redirect("/");
});

app.get("/logout", async function logout(req, res) {
    /*
        Logs the user out and clears the session
    */

    // Log the logout event
    console.info(`[INFO] ${req.session["EM"]} logged out at ${new Date()}`)

    // Clear the session
    req.session.destroy(() => { });

    res.redirect("/");
})

/*
    routes end here
*/

let PORT = process.env.PORT || 4000;

ensureDB("database.db");

app.listen(PORT, () => console.log(`listening on port ${PORT}`));

async function getUserDetails(db: sqlite.Database<sqlite3.Database, sqlite3.Statement>, email: string) {
    let row = await db.get("SELECT * FROM users WHERE email = ?", email);
    return row || null;
}

