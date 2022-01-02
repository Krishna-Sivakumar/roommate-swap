// deno-lint-ignore-file no-explicit-any
import { eta, opine, serveStatic, opineCors, urlencoded } from './deps.ts';
import { getAccessToken, getAuthUrl, getProfileInfo } from "./gauth.ts";
import { info } from "./logging.ts";
import { isFirstLogin, getSwappingUsers, getUserDetails, initialiseDB } from "./queries.ts";
import sessions from "./sessions.ts";
import { execute, getConfigFromEnv, ALLOWED_ORIGINS_RE } from "./utils.ts";

const config = getConfigFromEnv();
const db = initialiseDB();

const app = opine();

app.use(urlencoded({
    extended: true
}));

app.set("views", "./views");
app.set("view engine", "eta");
app.engine("eta", eta.renderFile);

sessions.init(app);

app.use(opineCors({
    credentials: true,
    exposedHeaders: ['X-Powered-By', 'Set-Cookie'],
    origin: ALLOWED_ORIGINS_RE
}));

// serve static files
app.use('/public', serveStatic('public'));

app.get('/', function home(req, res, next) {
    const authUrl = getAuthUrl(config);

    const session = sessions.getClient(req, res);
    const email = session.get<string>('email');

    const user: Record<string, any> = {
        loggedIn: false
    }

    if (email) {
        user.loggedIn = true;
        user.firstLogin = isFirstLogin(db, email);
        user.name = session.get<string>('name');
        const details = getUserDetails(db, email);

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
        authUrl, user, available: grouped
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

    const session = sessions.getClient(req, res);
    session.set('email', userInfo.email);
    session.set('name', userInfo.given_name);

    execute(db, "INSERT OR IGNORE INTO users(email, name) VALUES(?, ?)", userInfo.email, userInfo.given_name);
    info(`${userInfo.email} logged in at ${new Date()}`);

    res.redirect('/');
    next();
})

app.get('/auth/logout', function logout(req, res) {
    const session = sessions.getClient(req, res);
    session.clear();
    res.redirect('/');
});

app.post("/form/details", function swap(req, res, next) {
    const session = sessions.getClient(req, res);

    const email = session.get<string>('email')!;
    execute(db, 'update users set swap = ?, ac = ?, reg_no = ?, room_no = ?, size = ? where email = ?;',
        req.body['swap'] === 'on',
        req.body['ac-type'] === 'AC',
        new String(req.body['reg-no']).toUpperCase(),
        req.body['room-no'],
        req.body['room-size'],
        email
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
