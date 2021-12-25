import * as express from "express";
import * as cookieParser from "cookie-parser"
import * as config from "./config";
import * as sqlite3 from "sqlite3";
import * as sqlite from "sqlite";
import { OAuth2Client } from "google-auth-library"
import { google } from "googleapis";
const cors = require("cors");

let app = express();
app.use(cors());
app.set("view engine", "ejs");
app.use(cookieParser())
app.use(express.static("./public"));

let dbPormise = sqlite.open({
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

app.get('/', async function home(req, res) {
    let db = await dbPormise;

    const authURL = authenticatedClient.generateAuthUrl({
        access_type: "offline",
        scope: "https://www.googleapis.com/auth/userinfo.profile",
        hd: "vitstudent.ac.in"                                      // Only allow accounts from the domain 'vitstudent.ac.in'
    });

    let loggedIn: boolean = false;
    let name: string = "";

    if (req.cookies.AT != undefined) {
        // Log the user in if the access token cookie is present
        loggedIn = true;
        name = req.cookies.NM;
        try {
            // Verify if access token is still valid
            let getter = google.oauth2({ auth: authenticatedClient, version: "v2" })
            let _ = await getter.userinfo.get({});
        } catch (e) {
            // Log user out if it isn't
            res.clearCookie("NM");
            res.clearCookie("AT");
            loggedIn = false;
            console.error(e);
        }
    }

    res.render("index", {
        user: {
            loggedIn: loggedIn,
            name: name
        },
        authLink: authURL,
        rows: await queryRooms(db, req.query),
        size: req.query.size,
        ac: req.query.ac
    });
});

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
    console.log(authenticatedClient.credentials);

    // Set relevant cookies
    res.cookie("NM", response.data.given_name, { httpOnly: true });
    res.cookie("AT", authenticatedClient.credentials.access_token, { httpOnly: true });
    res.cookie("RF", authenticatedClient.credentials.refresh_token, { httpOnly: true });

    // Log the login event
    console.info(`[INFO] ${response.data.email} logged in at ${new Date()}`)

    res.redirect("/");
});

app.get("/logout", async function logout(req, res) {
    /*
        Logs the user out and clears all cookies
    */

    // Clear user-related cookies
    res.clearCookie("NM");
    res.clearCookie("AT");
    res.clearCookie("RF");

    // Log the logout event
    console.info(`[INFO] ${req.cookies.NM} logged out at ${new Date()}`)
    res.redirect("/");
})

let PORT = process.env.PORT || 4000;

ensureDB("database.db");

app.listen(PORT, () => console.log(`listening on port ${PORT}`));
