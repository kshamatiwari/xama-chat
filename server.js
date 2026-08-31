// =====================================================
// XAMA CHAT - SERVER
// =====================================================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const session = require("express-session");
const Database = require("better-sqlite3");
const path = require("path");
const crypto = require("crypto");

// =====================================================
// APP SETUP
// =====================================================

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: true,
        credentials: true
    }
});

// =====================================================
// DATABASE
// =====================================================

const db = new Database(
    path.join(__dirname, "xama-chat.db")
);

// Enable WAL mode
db.pragma("journal_mode = WAL");

// =====================================================
// USERS TABLE
// =====================================================

db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
`).run();

// =====================================================
// MESSAGES TABLE
// =====================================================

db.prepare(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        email TEXT NOT NULL,
        text TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at TEXT NOT NULL
    )
`).run();

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));

// =====================================================
// SESSION
// =====================================================

const sessionMiddleware = session({

    secret:
        process.env.SESSION_SECRET ||
        "xama-chat-development-secret-2026",

    resave: false,

    saveUninitialized: false,

    cookie: {

        maxAge:
            1000 *
            60 *
            60 *
            24 *
            7,

        httpOnly: true,

        sameSite: "lax",

        secure:
            process.env.NODE_ENV === "production"
    }
});

// Use session
app.use(sessionMiddleware);

// =====================================================
// STATIC FILES
// =====================================================

app.use(
    express.static(__dirname)
);

// =====================================================
// PASSWORD HASH
// =====================================================

function hashPassword(password) {

    return crypto
        .createHash("sha256")
        .update(password)
        .digest("hex");
}

// =====================================================
// FORMAT DATE
// =====================================================

function getCurrentDate() {

    return new Intl.DateTimeFormat(
        "en-IN",
        {
            timeZone: "Asia/Kolkata",
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    ).format(new Date());
}

// =====================================================
// FORMAT TIME
// =====================================================

function getCurrentTime() {

    return new Intl.DateTimeFormat(
        "en-IN",
        {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        }
    ).format(new Date());
}

// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {

    if (req.session.user) {

        return res.sendFile(
            path.join(
                __dirname,
                "Index.html"
            )
        );

    }

    return res.redirect(
        "/login.html"
    );
});

// =====================================================
// SIGNUP
// =====================================================

app.post("/signup", (req, res) => {

    try {

        const {
            name,
            email,
            password
        } = req.body;

        // ---------------------------------------------
        // CHECK FIELDS
        // ---------------------------------------------

        if (
            !name ||
            !email ||
            !password
        ) {

            return res.json({
                success: false,
                message:
                    "All fields are required."
            });

        }

        // ---------------------------------------------
        // CLEAN DATA
        // ---------------------------------------------

        const cleanName =
            String(name).trim();

        const cleanEmail =
            String(email)
                .trim()
                .toLowerCase();

        const cleanPassword =
            String(password);

        // ---------------------------------------------
        // PASSWORD LENGTH
        // ---------------------------------------------

        if (cleanPassword.length < 6) {

            return res.json({
                success: false,
                message:
                    "Password must be at least 6 characters."
            });

        }

        // ---------------------------------------------
        // CHECK EXISTING USER
        // ---------------------------------------------

        const existingUser =
            db.prepare(`
                SELECT id
                FROM users
                WHERE email = ?
            `).get(cleanEmail);

        if (existingUser) {

            return res.json({
                success: false,
                message:
                    "Email already registered."
            });

        }

        // ---------------------------------------------
        // HASH PASSWORD
        // ---------------------------------------------

        const hashedPassword =
            hashPassword(
                cleanPassword
            );

        // ---------------------------------------------
        // CREATE ACCOUNT
        // ---------------------------------------------

        const result =
            db.prepare(`
                INSERT INTO users
                (
                    name,
                    email,
                    password,
                    created_at
                )
                VALUES (?, ?, ?, ?)
            `).run(

                cleanName,
                cleanEmail,
                hashedPassword,
                new Date().toISOString()

            );

        // ---------------------------------------------
        // AUTO LOGIN
        // ---------------------------------------------

        req.session.user = {

            id:
                Number(
                    result.lastInsertRowid
                ),

            name:
                cleanName,

            email:
                cleanEmail
        };

        // ---------------------------------------------
        // RESPONSE
        // ---------------------------------------------

        return res.json({

            success: true,

            message:
                "Account created successfully.",

            user:
                req.session.user
        });

    }

    catch (error) {

        console.error(
            "Signup error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to create account."
        });

    }

});

// =====================================================
// LOGIN
// =====================================================

app.post("/login", (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;

        // ---------------------------------------------
        // CHECK FIELDS
        // ---------------------------------------------

        if (
            !email ||
            !password
        ) {

            return res.json({

                success: false,

                message:
                    "Email and password are required."
            });

        }

        // ---------------------------------------------
        // CLEAN DATA
        // ---------------------------------------------

        const cleanEmail =
            String(email)
                .trim()
                .toLowerCase();

        const cleanPassword =
            String(password);

        // ---------------------------------------------
        // HASH PASSWORD
        // ---------------------------------------------

        const hashedPassword =
            hashPassword(
                cleanPassword
            );

        // ---------------------------------------------
        // FIND USER
        // ---------------------------------------------

        const user =
            db.prepare(`
                SELECT
                    id,
                    name,
                    email
                FROM users
                WHERE email = ?
                AND password = ?
            `).get(
                cleanEmail,
                hashedPassword
            );

        // ---------------------------------------------
        // INVALID LOGIN
        // ---------------------------------------------

        if (!user) {

            return res.json({

                success: false,

                message:
                    "Invalid email or password."
            });

        }

        // ---------------------------------------------
        // CREATE SESSION
        // ---------------------------------------------

        req.session.user = {

            id:
                user.id,

            name:
                user.name,

            email:
                user.email
        };

        // ---------------------------------------------
        // SAVE SESSION
        // ---------------------------------------------

        req.session.save(
            (error) => {

                if (error) {

                    console.error(
                        "Session save error:",
                        error
                    );

                    return res.status(500)
                        .json({

                            success: false,

                            message:
                                "Unable to create login session."
                        });

                }

                return res.json({

                    success: true,

                    message:
                        "Login successful.",

                    user:
                        req.session.user
                });

            }
        );

    }

    catch (error) {

        console.error(
            "Login error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to login."
        });

    }

});

// =====================================================
// CURRENT USER
// =====================================================

app.get(
    "/current-user",
    (req, res) => {

        if (!req.session.user) {

            return res.json({

                loggedIn: false
            });

        }

        return res.json({

            loggedIn: true,

            id:
                req.session.user.id,

            name:
                req.session.user.name,

            email:
                req.session.user.email
        });

    }
);

// =====================================================
// LOGOUT
// =====================================================

app.post(
    "/logout",
    (req, res) => {

        req.session.destroy(
            (error) => {

                if (error) {

                    console.error(
                        "Logout error:",
                        error
                    );

                    return res.status(500)
                        .json({

                            success: false,

                            message:
                                "Unable to logout."
                        });

                }

                res.clearCookie(
                    "connect.sid"
                );

                return res.json({

                    success: true
                });

            }
        );

    }
);

// =====================================================
// SOCKET.IO SESSION
// =====================================================

// Share Express session with Socket.IO
io.engine.use(
    sessionMiddleware
);

// =====================================================
// ONLINE USERS
// =====================================================

const onlineUsers =
    new Map();

// =====================================================
// GET CHAT HISTORY FROM DATABASE
// =====================================================

function getChatHistory() {

    return db.prepare(`
        SELECT
            id,
            user_id AS userId,
            username,
            email,
            text,
            date,
            time,
            timestamp
        FROM messages
        ORDER BY id ASC
        LIMIT 500
    `).all();

}

// =====================================================
// SOCKET CONNECTION
// =====================================================

io.on(
    "connection",
    (socket) => {

        // ---------------------------------------------
        // GET SESSION
        // ---------------------------------------------

        const sessionData =
            socket.request.session;

        console.log(
            "Socket connected:",
            socket.id
        );

        // ---------------------------------------------
        // CHECK LOGIN
        // ---------------------------------------------

        if (
            !sessionData ||
            !sessionData.user
        ) {

            console.log(
                "Unauthenticated socket:",
                socket.id
            );

            socket.disconnect(true);

            return;
        }

        // ---------------------------------------------
        // CURRENT USER
        // ---------------------------------------------

        const user =
            sessionData.user;

        console.log(
            "User connected:",
            user.name,
            user.email
        );

        // ---------------------------------------------
        // STORE ONLINE USER
        // ---------------------------------------------

        onlineUsers.set(
            socket.id,
            {

                id:
                    user.id,

                name:
                    user.name,

                email:
                    user.email
            }
        );

        // ---------------------------------------------
        // SEND CHAT HISTORY
        // ---------------------------------------------

        socket.emit(
            "chat history",
            getChatHistory()
        );

        // ---------------------------------------------
        // SEND ONLINE USERS
        // ---------------------------------------------

        io.emit(
            "online users",
            Array.from(
                onlineUsers.values()
            )
        );

        // =================================================
        // RECEIVE CHAT MESSAGE
        // =================================================

        socket.on(
            "chat message",
            (message) => {

                try {

                    // -------------------------------------
                    // VALIDATE MESSAGE
                    // -------------------------------------

                    if (
                        !message ||
                        !message.text
                    ) {

                        return;
                    }

                    const text =
                        String(
                            message.text
                        ).trim();

                    if (!text) {

                        return;
                    }

                    // -------------------------------------
                    // CURRENT DATE/TIME
                    // -------------------------------------

                    const now =
                        new Date();

                    const date =
                        getCurrentDate();

                    const time =
                        getCurrentTime();

                    const timestamp =
                        now.getTime();

                    // -------------------------------------
                    // CREATE MESSAGE
                    // -------------------------------------

                    const messageData = {

                        id:
                            crypto.randomUUID(),

                        userId:
                            user.id,

                        username:
                            user.name,

                        email:
                            user.email,

                        text:
                            text,

                        date:
                            date,

                        time:
                            time,

                        timestamp:
                            timestamp
                    };

                    // -------------------------------------
                    // SAVE MESSAGE
                    // -------------------------------------

                    db.prepare(`
                        INSERT INTO messages
                        (
                            user_id,
                            username,
                            email,
                            text,
                            date,
                            time,
                            timestamp,
                            created_at
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(

                        user.id,

                        user.name,

                        user.email,

                        text,

                        date,

                        time,

                        timestamp,

                        now.toISOString()

                    );

                    // -------------------------------------
                    // SEND TO EVERYONE
                    // -------------------------------------

                    io.emit(
                        "chat message",
                        messageData
                    );

                    console.log(
                        "Message:",
                        messageData
                    );

                }

                catch (error) {

                    console.error(
                        "Message error:",
                        error
                    );

                }

            }
        );

        // =================================================
        // TYPING START
        // =================================================

        socket.on(
            "typing",
            () => {

                socket.broadcast.emit(
                    "user typing",
                    {

                        userId:
                            user.id,

                        name:
                            user.name
                    }
                );

            }
        );

        // =================================================
        // TYPING STOP
        // =================================================

        socket.on(
            "stop typing",
            () => {

                socket.broadcast.emit(
                    "user stopped typing",
                    {

                        userId:
                            user.id
                    }
                );

            }
        );

        // =================================================
        // DISCONNECT
        // =================================================

        socket.on(
            "disconnect",
            () => {

                onlineUsers.delete(
                    socket.id
                );

                console.log(
                    "User disconnected:",
                    user.name
                );

                io.emit(
                    "online users",
                    Array.from(
                        onlineUsers.values()
                    )
                );

            }
        );

    }
);

// =====================================================
// ERROR HANDLER
// =====================================================

app.use(
    (error, req, res, next) => {

        console.error(
            "Server error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Internal server error."
        });

    }
);

// =====================================================
// START SERVER
// =====================================================

const PORT =
    process.env.PORT || 3000;

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Xama Chat server running on port ${PORT}`
        );

    }
);