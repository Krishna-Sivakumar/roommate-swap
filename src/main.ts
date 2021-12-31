// deno-lint-ignore-file no-explicit-any
import { eta, opine, opineCors, serveStatic, urlencoded } from './deps.ts';
import { getAccessToken, getAuthUrl, getProfileInfo } from "./gauth.ts";
import { error, info } from "./logging.ts";
import { firstLogin, getSwappingUsers, getUserDetails, initialiseDB, setRoom, setSwap } from "./queries.ts";
import { destroySession, getSession, initSessions } from "./session.ts";
import { execute, getConfigFromEnv } from "./utils.ts";

const config = getConfigFromEnv();
const db = initialiseDB();

const app = opine();

app.use(urlencoded({
    extended: true
}));

app.set("views", "./views");
app.set("view engine", "eta");
app.engine("eta", eta.renderFile);

app.use(opineCors({
    credentials: true,
    exposedHeaders: ['X-Powered-By', 'Set-Cookie'],
    origin: "*"
}));

// serve static files
app.use(serveStatic('public'));

initSessions(app);

app.get('/', function home(req, res, next) {
    const authUrl = getAuthUrl(config);

    const [sid, session] = getSession(req);
    const email = session.get<string>(sid, 'email');

    const user: Record<string, any> = {
        loggedIn: false
    }

    if (email) {
        user.loggedIn = true;
        user.firstLogin = firstLogin(db, email);
        user.name = session.get<string>(sid, 'name');
        const details = getUserDetails(db, email);
        console.log(details);

        if (!user.firstLogin) {
            Object.assign(user, details);
        }
    }

    const users = getSwappingUsers(db);
    const grouped: Record<number, any[]> = {};

    for (const user of users) {
        grouped[user.roomNo] = grouped[user.roomNo] || [];
        grouped[user.roomNo].push(user);
    }

    const ctx = {
        authUrl, user, available: grouped, size: req.query.size, ac: req.query.ac
    };

    eta.renderFile('index.eta', ctx, { views: "./views" }, (err, html) => {
        if (err) {
            res.send(err.toString());
        }
        else {
            res.send(html);
        }
    });
    next();
});

app.get('/auth/google', async function gauth(req, res, next) {
    const authCode = req.query.code as string;
    const token = await getAccessToken(config, authCode);
    const userInfo = await getProfileInfo(token);

    const [sid, session] = getSession(req);
    session.set(sid, 'email', userInfo.email);
    session.set(sid, 'name', userInfo.given_name);

    execute(db, "INSERT OR IGNORE INTO users(email, name) VALUES(?, ?)", userInfo.email, userInfo.given_name);
    info(`${userInfo.email} logged in at ${new Date()}`);

    res.redirect('/');
    next();
})

app.get('/auth/logout', function logout(req, res) {
    const [sid, _] = getSession(req);
    destroySession(res, sid);
    res.redirect('/');
});

app.post("/form/swap", function swap(req, res, next) {
    const [sid, session] = getSession(req);
    const email = session.get<string>(sid, 'email')!;

    setSwap(db, email, req.body["swap"]);
    setRoom(db, email, req.body["room-no"]);

    res.redirect("/");
    next();
})

app.post("/form/init", function initialLogin(req, res, next) {
    const [sid, session] = getSession(req);
    const email = session.get<string>(sid, 'email')!;

    const ac = req.body["initial-class"] == "AC" ? 1 : 0;

    execute(
        db,
        "UPDATE users SET size = ?, ac = ?, reg_no = ? WHERE email = ?;",
        req.body["initial-size"], ac, req.body["reg-no"], email
    );

    res.redirect("/");
    next();
})



app.listen(config.port, () => {
    info('Listening on port', config.port);
});

declare global {
    interface ReadableStream<R = any> {
        getIterator(options?: { preventCancel?: boolean }): AsyncIterableIterator<R>;
    }
}
