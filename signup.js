document.addEventListener("DOMContentLoaded", () => {

    const signupForm = document.getElementById("signupForm");
    const message = document.getElementById("message");

    if (!signupForm) {
        console.error("signupForm not found");
        return;
    }

    signupForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword =
            document.getElementById("confirmPassword").value;

        if (!name || !email || !password || !confirmPassword) {
            message.textContent = "Please fill all fields.";
            return;
        }

        if (password.length < 6) {
            message.textContent =
                "Password must be at least 6 characters.";
            return;
        }

        if (password !== confirmPassword) {
            message.textContent =
                "Passwords do not match.";
            return;
        }

        try {

            message.textContent = "Creating account...";

            const response = await fetch("/signup", {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    name: name,
                    email: email,
                    password: password
                })
            });

            const result = await response.json();

            console.log("Signup response:", result);

            if (result.success) {

                message.textContent =
                    "Account created successfully!";

                setTimeout(() => {

                    // Directly open chat page
                    window.location.href = "/index.html";

                }, 800);

            } else {

                message.textContent =
                    result.message || "Account creation failed.";

            }

        } catch (error) {

            console.error("Signup error:", error);

            message.textContent =
                "Server connection failed.";

        }

    });

});
