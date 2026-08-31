// ==========================================
// XAMA CHAT - CLIENT
// ==========================================

let socket = null;
let username = "";

const input = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const messagesBox = document.getElementById("messages");


// ==========================================
// GET LOGGED IN USER FIRST
// ==========================================

async function loadUser() {

    try {

        const response = await fetch("/current-user", {
            credentials: "include"
        });

        const user = await response.json();

        console.log("Current user:", user);

        // User is not logged in
        if (!user.loggedIn) {

            window.location.href = "/login.html";
            return;

        }

        // Save current user's name
        username = user.name;

        console.log("Logged in user:", username);


        // ==================================
        // CONNECT SOCKET ONLY AFTER LOGIN
        // ==================================

        connectSocket();

    } catch (error) {

        console.error("User loading error:", error);

    }
}


// ==========================================
// SOCKET CONNECTION
// ==========================================

function connectSocket() {

    socket = io({
        auth: {
            username: username
        }
    });


    // ======================================
    // SOCKET CONNECTED
    // ======================================

    socket.on("connect", () => {

        console.log(
            "Socket connected:",
            socket.id,
            "User:",
            username
        );

    });


    // ======================================
    // RECEIVE NEW MESSAGE
    // ======================================

    socket.on("chat message", (data) => {

        console.log("Message received:", data);

        displayMessage(data);

    });


    // ======================================
    // CHAT HISTORY
    // ======================================

    socket.on("chat history", (history) => {

        console.log("Chat history:", history);

        messagesBox.innerHTML = "";

        history.forEach((message) => {

            displayMessage(message);

        });

    });


    // ======================================
    // SOCKET ERROR
    // ======================================

    socket.on("connect_error", (error) => {

        console.error(
            "Socket connection error:",
            error.message
        );

    });

}


// ==========================================
// SEND MESSAGE
// ==========================================

function sendMessage() {

    const text = input.value.trim();

    if (!text) {
        return;
    }

    if (!socket || !socket.connected) {

        console.log("Socket is not connected.");
        return;

    }


    // Send message
    socket.emit("chat message", {

        username: username,

        text: text

    });


    // Clear input
    input.value = "";

    input.focus();

}


// ==========================================
// DISPLAY MESSAGE
// ==========================================

function displayMessage(data) {

    const message = document.createElement("div");


    // Check sender
    const isMine =
        data.username === username;


    message.className = isMine
        ? "message sent"
        : "message received";


    // ======================================
    // USER NAME
    // ======================================

    const name = document.createElement("div");

    name.className = "message-name";

    name.textContent =
        data.username || "Unknown User";


    // ======================================
    // MESSAGE TEXT
    // ======================================

    const text = document.createElement("div");

    text.className = "message-text";

    text.textContent =
        data.text || "";


    // ======================================
    // DATE + TIME
    // ======================================

    const time = document.createElement("div");

    time.className = "message-time";

    if (data.date && data.time) {

        time.textContent =
            `${data.date} ${data.time}`;

    } else {

        // Fallback
        const now = new Date();

        time.textContent =
            now.toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });

    }


    // ======================================
    // ADD ELEMENTS
    // ======================================

    message.appendChild(name);

    message.appendChild(text);

    message.appendChild(time);


    messagesBox.appendChild(message);


    // Scroll to latest message
    messagesBox.scrollTop =
        messagesBox.scrollHeight;

}


// ==========================================
// SEND BUTTON
// ==========================================

sendButton.addEventListener("click", () => {

    sendMessage();

});


// ==========================================
// ENTER KEY
// ==========================================

input.addEventListener("keydown", (event) => {

    if (event.key === "Enter") {

        event.preventDefault();

        sendMessage();

    }

});


// ==========================================
// START APPLICATION
// ==========================================

loadUser();