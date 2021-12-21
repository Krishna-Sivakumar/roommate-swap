const express = require("express");
const cors = require("cors");
const config = require("./config");
const sqlite3 = require("sqlite3");
const sqlite = require("sqlite");

const passport = require('passport');
const GoogleStrategy = require('passport-google-oidc');

let app = express();
app.use(cors());
app.set("view engine", "ejs");
app.use(express.static("./public"));

/*
passport.use(new GoogleStrategy({
    clientID: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    callbackURL: `${config.SERVER_ROOT_URI}/${config.redirectURI}`
}, async function verify(issuer, profile) {
    let db = await sqlite.open({
        filename: "database.db",
        driver: sqlite3.Database
    });

    console.log(profile);

    db.close();
}));
*/

let db = sqlite.open({
    filename: "./database.db",

    driver: sqlite3.Database
})

async function queryRooms(db, query) {
    let rows = [];

    const ac = escape(query.ac);
    const size = escape(query.size);
    const block = escape(query.block);
    const room_no = `%${escape(query.room_no)}%`;

    rows = await db.all("select size, room_no, email from rooms where room_no like ? or size=?", room_no, size);

    return rows;
}

app.get('/', async (req, res) => {
    db = await db;

    res.render("index", {
        authLink: "/login",
        rows: await queryRooms(db, req.query),
        size: req.query.size,
        ac: req.query.ac
    });
});

// app.get('/login', passport.authenticate("google"));

let PORT = process.env.PORT || 4000;

app.listen(PORT, () => console.log(`listening on port ${PORT}`));
