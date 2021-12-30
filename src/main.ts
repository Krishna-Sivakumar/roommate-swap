// deno-lint-ignore-file no-explicit-any
import { json, opine, opineCors, serveStatic, urlencoded } from './deps.ts';
import { getAccessToken, getAuthUrl, getProfileInfo } from "./gauth.ts";
import { info } from "./logging.ts";
import { initialiseDB } from "./queries.ts";
import { destroySession, getSession, initSessions } from "./session.ts";
import { getConfigFromEnv } from "./utils.ts";

const config = getConfigFromEnv();
const db = initialiseDB();

const app = opine();

app.use(opineCors({
    credentials: true,
    exposedHeaders: ['X-Powered-By', 'Set-Cookie'],
    origin: "*"
}));

app.use(json());
app.use(urlencoded());

// serve static files
app.use(serveStatic('./public'));

initSessions(app);

app.get('/', function home(req, res, next) {
    const authUrl = getAuthUrl(config);

    const [sid, session] = getSession(req);
    const email = session.get<string>(sid, 'email');

    const context: Record<string, any> = {
        authUrl, isLoggedIn: false
    }

    if (email) {
        context.isLoggedIn = true;
        res.send('logged in');
    }
    else {
        res.send(authUrl);
    }

    next();
});

app.get('/auth/google', async function gauth(req, res, next) {
    const authCode = req.query.code as string;
    const token = await getAccessToken(config, authCode);
    const userInfo = await getProfileInfo(token);

    const [sid, session] = getSession(req);
    session.set(sid, 'email', userInfo.email);

    res.redirect('/');
    next();
})

app.get('/auth/logout', function logout(req, res) {
    const [sid, _] = getSession(req);
    destroySession(res, sid);
    res.redirect('/');
});

app.listen(config.port, () => {
    info('Listening on port', config.port);
});

declare global {
    interface ReadableStream<R = any> {
        getIterator(options?: { preventCancel?: boolean }): AsyncIterableIterator<R>;
    }
}
