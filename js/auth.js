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

    // Student accounts are identified by an explicit school-student mapping.
    // This avoids changing the existing staff-role values in user_roles.
    try {
        const { data: studentLink, error: studentLinkError } = await supabaseClient
            .from("student_accounts")
            .select("user_id")
            .eq("user_id", userId)
            .maybeSingle();

        if (!studentLinkError && studentLink) {
            return "student";
        }
    } catch (error) {
        // Continue to the existing staff-role lookup. This keeps the existing
        // application usable before the one-time Student Portal migration runs.
    }

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


async function showApplication(user, options = {}) {

    try {

        const role =
            await getUserRole(user.id);

        if (role === "student") {
            await showStudentApplication(user, options);
            return;
        }

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

        if (typeof resetStudentPortalView === "function") {
            resetStudentPortalView();
        }

        if (typeof clearAcademicSessionEditUnlocks === "function") {
            clearAcademicSessionEditUnlocks();
        }

        userEmail.textContent =
            user.email;

        roleBadge.textContent =
            role === "admin"
                ? "Admin"
                : "View Only";


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

        const studentLoginAccountCard = document.getElementById("studentLoginAccountCard");
        if (studentLoginAccountCard) {
            studentLoginAccountCard.classList.toggle("hidden", role !== "admin");
        }


        // A successful new login always starts at Dashboard.
        // During an authenticated refresh, restore the current hash instead.
        const initialSection =
            options.forceDashboard
                ? "dashboard"
                : getInitialSection(role);

        // Load the data needed by the selected section before exposing the app.
        await loadSessions();

        showSection(initialSection, { updateHash: true });

        await loadStudents();

        startInactivityTimer();

        loginPage.classList.add(
            "hidden"
        );

        appPage.classList.remove(
            "hidden"
        );

        document.body.classList.add(
            "auth-ready"
        );


    } catch (error) {

        console.error(error);

        await supabaseClient.auth.signOut();

        showLogin();

        document.body.classList.add(
            "auth-ready"
        );

        showLoginError(
            error.message
        );

    }

}


function getInitialSection(role) {

    const requestedSection =
        decodeURIComponent(
            window.location.hash.replace(/^#/, "")
        );

    if (!requestedSection) {
        return "dashboard";
    }

    const navButton =
        document.querySelector(
            `.nav-btn[data-section="${CSS.escape(requestedSection)}"]`
        );

    const target =
        document.getElementById(
            requestedSection + "Section"
        );

    if (!navButton || !target) {
        return "dashboard";
    }

    if (
        requestedSection === "recycleBin" &&
        role !== "admin"
    ) {
        return "dashboard";
    }

    return requestedSection;
}


function showLogin() {

    currentUser = null;

    currentRole = null;

    if (typeof resetStudentPortalView === "function") {
        resetStudentPortalView();
    }

    if (typeof clearAcademicSessionEditUnlocks === "function") {
        clearAcademicSessionEditUnlocks();
    }

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


            // The SIGNED_IN auth event handles the successful login
            // and always starts the application at Dashboard.


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

        const sectionAtLogout = activeSection;
        const proceeded = await protectUnsavedChanges(sectionAtLogout, async () => {
            stopInactivityTimer();
            await supabaseClient.auth.signOut();
            showLogin();
        });

        if (!proceeded) {
            return;
        }

    }
);


/* =========================================================
   SESSION TIMEOUT
========================================================= */

let lastActivityTimestamp = 0;
let inactivityCountdownInterval = null;
const sessionTimerElement = document.getElementById("sessionTimer");

function formatInactivityTime(milliseconds) {

    const totalSeconds = Math.max(
        0,
        Math.ceil(milliseconds / 1000)
    );

    const minutes = String(
        Math.floor(totalSeconds / 60)
    ).padStart(2, "0");

    const seconds = String(
        totalSeconds % 60
    ).padStart(2, "0");

    return `${minutes}:${seconds}`;

}


function updateInactivityDisplay() {

    if (!sessionTimerElement) {
        return;
    }

    if (!currentUser || !lastActivityTimestamp) {
        sessionTimerElement.textContent = "15:00";
        return;
    }

    const elapsed =
        Date.now() - lastActivityTimestamp;

    const remaining =
        Math.max(0, INACTIVITY_LIMIT - elapsed);

    sessionTimerElement.textContent =
        formatInactivityTime(remaining);

}


function resetInactivityTimer(force = false) {

    if (!currentUser) {
        return;
    }

    const now = Date.now();

    if (!force && now - lastActivityTimestamp < 1000) {
        return;
    }

    lastActivityTimestamp = now;

    updateInactivityDisplay();

    clearTimeout(
        inactivityTimer
    );

    inactivityTimer = setTimeout(
        async function() {

            inactivityTimer = null;

            // No warning and no unsaved-change prompt: the session
            // expires automatically after 15 minutes of inactivity.
            if (sessionTimerElement) {
                sessionTimerElement.textContent = "00:00";
            }

            stopInactivityTimer();

            await supabaseClient.auth.signOut();
            showLogin();

        },
        INACTIVITY_LIMIT
    );

}


function startInactivityTimer() {

    stopInactivityTimer();

    resetInactivityTimer(true);

    inactivityCountdownInterval =
        setInterval(
            updateInactivityDisplay,
            1000
        );

}


function stopInactivityTimer() {

    clearTimeout(
        inactivityTimer
    );

    inactivityTimer =
        null;

    clearInterval(
        inactivityCountdownInterval
    );

    inactivityCountdownInterval =
        null;

    lastActivityTimestamp = 0;

    if (sessionTimerElement) {
        sessionTimerElement.textContent = "15:00";
    }

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
                    session.user,
                    {
                        // INITIAL_SESSION means an existing session is being restored.
                        // SIGNED_IN means a new successful login.
                        forceDashboard: event === "SIGNED_IN"
                    }
                );

            }

        } else {

            if (currentUser) {
                showLogin();
            }

            // Do not expose either auth screen until Supabase has finished
            // determining the initial session.
            if (event === "INITIAL_SESSION") {
                document.body.classList.add(
                    "auth-ready"
                );
            }

        }

    }
);
