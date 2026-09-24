/* =========================================================
   LOGIN
========================================================= */

function showLoginError(message) {

    loginError.textContent =
        message;

    loginError.classList.remove(
        "hidden"
    );

}


function clearLoginError() {

    loginError.textContent =
        "";

    loginError.classList.add(
        "hidden"
    );

}


async function getUserRole(userId) {

    const {
        data,
        error
    } =
        await supabaseClient
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .maybeSingle();


    if (error) {
        throw new Error(
            "Unable to determine account permissions."
        );
    }


    if (!data) {
        throw new Error(
            "This account has no assigned system role."
        );
    }


    return data.role;

}


async function showApplication(user) {

    try {

        const role =
            await getUserRole(user.id);


        if (
            role !== "admin" &&
            role !== "view_only"
        ) {
            throw new Error(
                "Invalid account role."
            );
        }


        currentUser =
            user;

        currentRole =
            role;


        userEmail.textContent =
            user.email;


        roleBadge.textContent =
            role === "admin"
                ? "Admin"
                : "View Only";


        loginPage.classList.add(
            "hidden"
        );

        appPage.classList.remove(
            "hidden"
        );


        addStudentButton.classList.toggle(
            "hidden",
            role !== "admin"
        );

        if (recycleBinNavButton) {
            recycleBinNavButton.classList.toggle(
                "hidden",
                role !== "admin"
            );
        }

        showSection("dashboard");

        startInactivityTimer();


        await loadSessions();
    populateMarksSessions();
        populateMarksSessions();

        await loadStudents();


    } catch (error) {

        console.error(error);

        await supabaseClient.auth.signOut();

        showLogin();

        showLoginError(
            error.message
        );

    }

}


function showLogin() {

    currentUser = null;

    currentRole = null;

    stopInactivityTimer();

    appPage.classList.add(
        "hidden"
    );

    loginPage.classList.remove(
        "hidden"
    );

}


loginForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        clearLoginError();

        const email =
            document
                .getElementById("loginEmail")
                .value
                .trim();

        const password =
            document
                .getElementById("loginPassword")
                .value;


        loginButton.disabled =
            true;

        loginButton.textContent =
            "Signing in...";


        try {

            const {
                data,
                error
            } =
                await supabaseClient.auth
                    .signInWithPassword({
                        email,
                        password
                    });


            if (error) {
                throw error;
            }


            await showApplication(
                data.user
            );


        } catch (error) {

            console.error(
                "Login error:",
                error
            );

            showLoginError(
                error.message ||
                "Unable to sign in."
            );

        } finally {

            loginButton.disabled =
                false;

            loginButton.textContent =
                "Sign In";

        }

    }
);


/* =========================================================
   LOGOUT
========================================================= */

logoutButton.addEventListener(
    "click",
    async function() {

        stopInactivityTimer();

        await supabaseClient.auth.signOut();

        showLogin();

    }
);


/* =========================================================
   SESSION TIMEOUT
========================================================= */

function resetInactivityTimer() {

    if (!currentUser) {
        return;
    }


    clearTimeout(
        inactivityTimer
    );


    inactivityTimer =
        setTimeout(
            async function() {

                await supabaseClient.auth.signOut();

                showLogin();

                showLoginError(
                    "You have been logged out because of 15 minutes of inactivity."
                );

            },
            INACTIVITY_LIMIT
        );

}


function startInactivityTimer() {

    resetInactivityTimer();

}


function stopInactivityTimer() {

    clearTimeout(
        inactivityTimer
    );

    inactivityTimer =
        null;

}


[
    "mousedown",
    "mousemove",
    "keydown",
    "touchstart",
    "click",
    "scroll",
    "input",
    "wheel"
].forEach(
    eventName => {

        document.addEventListener(
            eventName,
            resetInactivityTimer,
            {
                passive: true
            }
        );

    }
);


/* =========================================================
   AUTH STATE
========================================================= */

supabaseClient.auth.onAuthStateChange(
    async function(event, session) {

        if (
            session &&
            session.user
        ) {

            if (
                !currentUser ||
                currentUser.id !== session.user.id
            ) {

                await showApplication(
                    session.user
                );

            }

        } else {

            if (currentUser) {
                showLogin();
            }

        }

    }
);


