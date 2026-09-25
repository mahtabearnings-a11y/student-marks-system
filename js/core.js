/* =========================================================
   SUPABASE
========================================================= */

const SUPABASE_URL =
    "https://fegrjxawwhnaxvqbjesf.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_NIfpJE60FAdsZQkLhxJYGA_m-y9xJli";


const authStorage = {

    getItem(key) {
        return Promise.resolve(
            sessionStorage.getItem(key)
        );
    },

    setItem(key, value) {
        sessionStorage.setItem(
            key,
            value
        );

        return Promise.resolve();
    },

    removeItem(key) {
        sessionStorage.removeItem(key);

        return Promise.resolve();
    }

};


const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
            auth: {
                storage: authStorage,
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false
            }
        }
    );


/* =========================================================
   GLOBAL STATE
========================================================= */

let currentUser = null;

let currentRole = null;

// Prevent Admin password verification from restarting the application through
// Supabase auth events. These flags are shared with auth.js.
let adminPasswordVerificationInProgress = false;
let suppressAuthApplicationRefresh = 0;

let inactivityTimer = null;

const INACTIVITY_LIMIT =
    15 * 60 * 1000;

// Tracks which application section is currently visible.
let activeSection = "dashboard";

// Last successfully loaded/saved snapshots for the editable modules.
let marksSavedSnapshot = null;
let attendanceSavedSnapshot = null;

// Prevents multiple unsaved-change dialogs from being opened at once.
let unsavedChangesDialogOpen = false;

// Closed academic years require admin re-authentication before editing.
const academicSessionEditUnlocks = new Map();
const ACADEMIC_SESSION_UNLOCK_MS = 30 * 60 * 1000;

let sessions = [];

let studentsData = [];

let editingStudent = null;

let marksSubjects = [];
let marksRecords = [];
let marksValues = {};
let marksLoading = false;


/* =========================================================
   ELEMENTS
========================================================= */

const loginPage =
    document.getElementById("loginPage");

const appPage =
    document.getElementById("appPage");

const loginForm =
    document.getElementById("loginForm");

const loginButton =
    document.getElementById("loginButton");

const loginError =
    document.getElementById("loginError");

const userEmail =
    document.getElementById("userEmail");

const roleBadge =
    document.getElementById("roleBadge");

const logoutButton =
    document.getElementById("logoutButton");

const sessionFilter =
    document.getElementById("sessionFilter");

const classFilter =
    document.getElementById("classFilter");

const studentSearch =
    document.getElementById("studentSearch");

const studentSort =
    document.getElementById("studentSort");

const studentTableContainer =
    document.getElementById("studentTableContainer");

const studentRecordCount =
    document.getElementById("studentRecordCount");

const addStudentButton =
    document.getElementById("addStudentButton");

const refreshStudentsButton =
    document.getElementById("refreshStudentsButton");


const recycleBinNavButton =
    document.getElementById("recycleBinNavButton");

const recycleBinTableContainer =
    document.getElementById("recycleBinTableContainer");

const recycleBinRecordCount =
    document.getElementById("recycleBinRecordCount");

const selectAllRecycleBin =
    document.getElementById("selectAllRecycleBin");

const refreshRecycleBinButton =
    document.getElementById("refreshRecycleBinButton");

const restoreRecycleBinButton =
    document.getElementById("restoreRecycleBinButton");

const permanentDeleteRecycleBinButton =
    document.getElementById("permanentDeleteRecycleBinButton");

const academicYearRecycleContainer =
    document.getElementById("academicYearRecycleContainer");
const academicYearRecycleCount =
    document.getElementById("academicYearRecycleCount");
const restoreAcademicYearButton =
    document.getElementById("restoreAcademicYearButton");
const permanentDeleteAcademicYearButton =
    document.getElementById("permanentDeleteAcademicYearButton");

const recycleBinPasswordModal =
    document.getElementById("recycleBinPasswordModal");

const recycleBinDeletePassword =
    document.getElementById("recycleBinDeletePassword");

const closeRecycleBinPasswordModal =
    document.getElementById("closeRecycleBinPasswordModal");

const cancelRecycleBinPasswordButton =
    document.getElementById("cancelRecycleBinPasswordButton");

const confirmRecycleBinPasswordButton =
    document.getElementById("confirmRecycleBinPasswordButton");

let recycleBinData = [];
let pendingPermanentDeleteIds = [];

const studentModal =
    document.getElementById("studentModal");

const studentModalTitle =
    document.getElementById("studentModalTitle");

const closeStudentModal =
    document.getElementById("closeStudentModal");

const cancelStudentButton =
    document.getElementById("cancelStudentButton");

const saveStudentButton =
    document.getElementById("saveStudentButton");

const studentForm =
    document.getElementById("studentForm");

const historyModal =
    document.getElementById("historyModal");

const historyContent =
    document.getElementById("historyContent");

const closeHistoryModal =
    document.getElementById("closeHistoryModal");

const closeHistoryButton =
    document.getElementById("closeHistoryButton");

const toast =
    document.getElementById("toast");

const unsavedChangesModal =
    document.getElementById("unsavedChangesModal");

const unsavedChangesSaveButton =
    document.getElementById("unsavedChangesSaveButton");

const unsavedChangesLeaveButton =
    document.getElementById("unsavedChangesLeaveButton");

const unsavedChangesCancelButton =
    document.getElementById("unsavedChangesCancelButton");

const adminPasswordModal =
    document.getElementById("adminPasswordModal");
const adminPasswordTitle =
    document.getElementById("adminPasswordTitle");
const adminPasswordMessage =
    document.getElementById("adminPasswordMessage");
const adminPasswordInput =
    document.getElementById("adminPasswordInput");
const adminPasswordError =
    document.getElementById("adminPasswordError");
const adminPasswordCancelButton =
    document.getElementById("adminPasswordCancelButton");
const adminPasswordConfirmButton =
    document.getElementById("adminPasswordConfirmButton");
const adminPasswordCloseButton =
    document.getElementById("adminPasswordCloseButton");

const printSession = document.getElementById("marksSession");
const printClass = document.getElementById("marksClass");
const printExam = document.getElementById("marksExam");
const printStudentSearch = document.getElementById("printStudentSearch");
const printStudentSelect = document.getElementById("printStudentSelect");
const printStudentInfo = document.getElementById("printStudentInfo");
const printStudentButton = document.getElementById("printStudentButton");
const printAllStudentsButton = document.getElementById("printAllStudentsButton");
const printClassFolioButton = document.getElementById("printClassFolioButton");
const printClassInfo = document.getElementById("printClassInfo");
const printDocumentHost = document.getElementById("printDocumentHost");
let printStudents = [];
let printSubjects = [];
let printMarks = {};
const attendanceSession = document.getElementById("attendanceSession");
const attendanceClass = document.getElementById("attendanceClass");
const attendanceSort = document.getElementById("attendanceSort");
const attendanceMonths = document.getElementById("attendanceMonths");
const attendanceSelectedLabel = document.getElementById("attendanceSelectedLabel");
const attendanceRecordCount = document.getElementById("attendanceRecordCount");
const attendanceTableContainer = document.getElementById("attendanceTableContainer");
const attendanceSaveButton = document.getElementById("attendanceSaveButton");
const attendancePrintButton = document.getElementById("attendancePrintButton");
const attendanceSelectAll = document.getElementById("attendanceSelectAll");
const attendanceClearMonths = document.getElementById("attendanceClearMonths");
let attendanceStudents = [];
let attendanceData = {};
let attendanceSelectedMonths = [];





/* =========================================================
   ACADEMIC SESSION EDIT PROTECTION
========================================================= */

function getAcademicSessionById(sessionId) {
    return sessions.find(session => String(session.id) === String(sessionId)) || null;
}

function isAcademicSessionClosed(sessionId) {
    const session = getAcademicSessionById(sessionId);
    return Boolean(session?.is_closed);
}

function hasAcademicSessionEditUnlock(sessionId) {
    const expiresAt = academicSessionEditUnlocks.get(String(sessionId)) || 0;
    if (expiresAt > Date.now()) return true;
    academicSessionEditUnlocks.delete(String(sessionId));
    return false;
}

function clearAcademicSessionEditUnlocks() {
    academicSessionEditUnlocks.clear();
}

function showAdminPasswordDialog({
    title = "Admin Verification",
    message = "Enter your password to continue.",
    actionLabel = "Continue"
} = {}) {
    return new Promise(resolve => {
        if (!adminPasswordModal || !adminPasswordInput || !adminPasswordConfirmButton) {
            resolve(null);
            return;
        }

        adminPasswordTitle.textContent = title;
        adminPasswordMessage.textContent = message;
        adminPasswordError.textContent = "";
        adminPasswordError.classList.add("hidden");
        adminPasswordInput.value = "";
        adminPasswordConfirmButton.textContent = actionLabel;
        adminPasswordConfirmButton.disabled = false;
        adminPasswordModal.classList.remove("hidden");

        let settled = false;

        const cleanup = () => {
            adminPasswordConfirmButton.removeEventListener("click", onConfirm);
            adminPasswordCancelButton?.removeEventListener("click", onCancel);
            adminPasswordCloseButton?.removeEventListener("click", onCancel);
            adminPasswordModal?.removeEventListener("click", onBackdrop);
            document.removeEventListener("keydown", onKeyDown);
        };

        const finish = value => {
            if (settled) return;
            settled = true;
            cleanup();
            adminPasswordModal.classList.add("hidden");
            resolve(value);
        };

        const onConfirm = () => finish(adminPasswordInput.value);
        const onCancel = () => finish(null);
        const onBackdrop = event => {
            if (event.target === adminPasswordModal) finish(null);
        };
        const onKeyDown = event => {
            if (event.key === "Escape") {
                event.preventDefault();
                finish(null);
            } else if (event.key === "Enter") {
                event.preventDefault();
                finish(adminPasswordInput.value);
            }
        };

        adminPasswordConfirmButton.addEventListener("click", onConfirm);
        adminPasswordCancelButton?.addEventListener("click", onCancel);
        adminPasswordCloseButton?.addEventListener("click", onCancel);
        adminPasswordModal.addEventListener("click", onBackdrop);
        document.addEventListener("keydown", onKeyDown);
        setTimeout(() => adminPasswordInput.focus(), 50);
    });
}

async function requireAdminPasswordForAction({
    title = "Password Verification",
    message = "Enter your Recycle Bin permanent-deletion password to continue.",
    actionLabel = "Continue"
} = {}) {
    if (currentRole !== "admin") {
        showToast("Only an Admin can perform this action.", "error");
        return false;
    }

    while (true) {
        const password = await showAdminPasswordDialog({ title, message, actionLabel });
        if (password === null) return false;

        if (!password) {
            if (adminPasswordError) {
                adminPasswordError.textContent = "Please enter the Recycle Bin permanent-deletion password.";
                adminPasswordError.classList.remove("hidden");
            }
            continue;
        }

        try {
            const { error } = await supabaseClient.rpc("verify_recycle_bin_security_password", {
                p_password: password
            });

            if (error) throw error;
            return true;
        } catch (error) {
            const messageText = String(error?.message || "");
            const isWrongPassword = /incorrect|invalid.*password|wrong.*password/i.test(messageText);
            if (adminPasswordError) {
                adminPasswordError.textContent = isWrongPassword
                    ? "Wrong password. Please enter the correct password."
                    : (messageText || "Unable to verify the password.");
                adminPasswordError.classList.remove("hidden");
            }
            await new Promise(resolve => setTimeout(resolve, 150));
        }
    }
}

async function ensureAcademicSessionEditable(sessionId, action = "edit this academic year") {
    if (currentRole !== "admin") return false;

    const session = getAcademicSessionById(sessionId);
    if (!session || !session.is_closed || hasAcademicSessionEditUnlock(sessionId)) {
        return true;
    }

    const verified = await requireAdminPasswordForAction({
        title: "Academic Year Locked",
        message: `${session.session_name || "This academic year"} is closed. Enter your Recycle Bin permanent-deletion password to ${action}. The unlock lasts for 30 minutes in this session.`,
        actionLabel: "Unlock"
    });

    if (verified) {
        academicSessionEditUnlocks.set(String(sessionId), Date.now() + ACADEMIC_SESSION_UNLOCK_MS);
    }

    return verified;
}

function updateAcademicSessionProtectionUI() {
    // Kept centralized so modules can add a visual lock state later without
    // duplicating session-state checks.
}

/* =========================================================
   UNSAVED CHANGES PROTECTION
========================================================= */

function showUnsavedChangesDialog() {
    return new Promise(resolve => {
        if (!unsavedChangesModal) {
            resolve("cancel");
            return;
        }

        if (unsavedChangesDialogOpen) {
            resolve("cancel");
            return;
        }

        unsavedChangesDialogOpen = true;
        unsavedChangesModal.classList.remove("hidden");

        let settled = false;

        const finish = choice => {
            if (settled) return;
            settled = true;
            unsavedChangesDialogOpen = false;
            unsavedChangesModal.classList.add("hidden");
            cleanup();
            resolve(choice);
        };

        const onSave = () => finish("save");
        const onLeave = () => finish("leave");
        const onCancel = () => finish("cancel");
        const onKeyDown = event => {
            if (event.key === "Escape") {
                event.preventDefault();
                finish("cancel");
            }
        };

        const cleanup = () => {
            unsavedChangesSaveButton?.removeEventListener("click", onSave);
            unsavedChangesLeaveButton?.removeEventListener("click", onLeave);
            unsavedChangesCancelButton?.removeEventListener("click", onCancel);
            document.removeEventListener("keydown", onKeyDown);
        };

        unsavedChangesSaveButton?.addEventListener("click", onSave);
        unsavedChangesLeaveButton?.addEventListener("click", onLeave);
        unsavedChangesCancelButton?.addEventListener("click", onCancel);
        document.addEventListener("keydown", onKeyDown);

        // Default focus goes to the safest action.
        setTimeout(() => unsavedChangesCancelButton?.focus(), 0);
    });
}

function hasUnsavedChangesForSection(section) {
    if (section === "marks" && typeof hasUnsavedMarksChanges === "function") {
        return hasUnsavedMarksChanges();
    }
    if (section === "attendance" && typeof hasUnsavedAttendanceChanges === "function") {
        return hasUnsavedAttendanceChanges();
    }
    return false;
}

async function protectUnsavedChanges(section, continueAction) {
    if (!hasUnsavedChangesForSection(section)) {
        await continueAction();
        return true;
    }

    const choice = await showUnsavedChangesDialog();

    if (choice === "cancel") {
        return false;
    }

    if (choice === "save") {
        let saved = false;

        if (section === "marks" && typeof saveMarks === "function") {
            saved = await saveMarks({ reload: false });
        } else if (section === "attendance" && typeof saveAttendance === "function") {
            saved = await saveAttendance({ reload: false });
        }

        if (!saved) {
            return false;
        }
    }

    await continueAction();
    return true;
}

function hasAnyUnsavedChanges() {
    return hasUnsavedChangesForSection("marks") || hasUnsavedChangesForSection("attendance");
}

// Browser refresh/close dialogs are controlled by the browser itself. We only
// trigger them when there is genuinely unsaved data; normal navigation uses
// the custom three-button dialog above.
window.addEventListener("beforeunload", event => {
    if (!currentUser || !hasAnyUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = "";
});


/* =========================================================
   FROZEN TABLE HEADERS
   Uses a viewport-fixed header clone so the table header
   remains frozen even when the page itself is the scroller.
========================================================= */

const frozenTableHeaderStates = new WeakMap();

function destroyFrozenTableHeader(container) {
    const state = frozenTableHeaderStates.get(container);
    if (!state) return;

    window.removeEventListener("scroll", state.update, true);
    window.removeEventListener("resize", state.update, true);
    container.removeEventListener("scroll", state.update, true);

    if (state.resizeObserver) {
        state.resizeObserver.disconnect();
    }

    state.host.remove();
    frozenTableHeaderStates.delete(container);
}

function setupFrozenTableHeader(containerOrId) {
    const container = typeof containerOrId === "string"
        ? document.getElementById(containerOrId)
        : containerOrId;

    if (!container) return;

    destroyFrozenTableHeader(container);

    const table = container.querySelector("table");
    const headerRow = table?.querySelector("thead tr");

    if (!table || !headerRow || !headerRow.children.length) {
        return;
    }

    const host = document.createElement("div");
    host.className = "frozen-table-header";
    host.setAttribute("aria-hidden", "true");

    const viewport = document.createElement("div");
    viewport.className = "frozen-table-header-viewport";

    const clonedTable = table.cloneNode(false);
    clonedTable.classList.add("frozen-table-header-table");
    clonedTable.style.position = "absolute";
    clonedTable.style.left = "0";
    clonedTable.style.top = "0";
    clonedTable.style.margin = "0";
    clonedTable.style.minWidth = "0";
    clonedTable.style.maxWidth = "none";
    clonedTable.style.width = "0";

    const clonedHead = table.querySelector("thead").cloneNode(true);
    const clonedRow = clonedHead.querySelector("tr");
    clonedTable.appendChild(clonedHead);

    const stickyCells = document.createElement("div");
    stickyCells.className = "frozen-table-header-sticky-cells";

    viewport.appendChild(clonedTable);
    viewport.appendChild(stickyCells);
    host.appendChild(viewport);
    document.body.appendChild(host);

    function copyCellMetrics() {
        const containerRect = container.getBoundingClientRect();
        const tableRect = table.getBoundingClientRect();
        const originalCells = Array.from(headerRow.children);
        const clonedCells = Array.from(clonedRow?.children || []);
        const headerRect = headerRow.getBoundingClientRect();

        host.style.left = `${containerRect.left}px`;
        host.style.width = `${Math.max(0, container.clientWidth)}px`;
        host.style.height = `${Math.max(1, headerRect.height)}px`;

        clonedTable.style.width = `${Math.max(1, tableRect.width)}px`;
        clonedRow.style.height = `${Math.max(1, headerRect.height)}px`;

        originalCells.forEach((cell, index) => {
            const clone = clonedCells[index];
            if (!clone) return;
            const width = cell.getBoundingClientRect().width;
            clone.style.width = `${width}px`;
            clone.style.minWidth = `${width}px`;
            clone.style.maxWidth = `${width}px`;
            clone.style.boxSizing = "border-box";
            clone.style.height = `${Math.max(1, headerRect.height)}px`;
        });

        /* Keep any horizontally-sticky header cells visually locked
           over the fixed header while the table is horizontally scrolled. */
        stickyCells.innerHTML = "";
        let stickyLeft = 0;

        originalCells.forEach((cell, index) => {
            const isSticky =
                cell.classList.contains("sticky-roll") ||
                cell.classList.contains("sticky-name");

            if (!isSticky) return;

            const clone = document.createElement("div");
            clone.className = `frozen-sticky-header-cell ${cell.className || ""}`.trim();
            clone.innerHTML = cell.innerHTML;
            const width = cell.getBoundingClientRect().width;

            clone.style.position = "absolute";
            clone.style.left = `${stickyLeft}px`;
            clone.style.top = "0";
            clone.style.width = `${width}px`;
            clone.style.minWidth = `${width}px`;
            clone.style.maxWidth = `${width}px`;
            clone.style.height = `${Math.max(1, headerRect.height)}px`;
            clone.style.boxSizing = "border-box";
            clone.style.zIndex = "4";

            stickyCells.appendChild(clone);
            stickyLeft += width;
        });

        stickyCells.style.width = `${Math.max(0, stickyLeft)}px`;
        stickyCells.style.height = `${Math.max(1, headerRect.height)}px`;
        stickyCells.style.display = stickyLeft ? "block" : "none";
    }

    function update() {
        if (!document.documentElement.contains(table)) {
            destroyFrozenTableHeader(container);
            return;
        }

        const section = container.closest(".app-section");
        if (section?.classList.contains("hidden")) {
            host.classList.remove("is-visible");
            return;
        }

        const headerRect = headerRow.getBoundingClientRect();
        const tableRect = table.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        if (containerRect.width <= 0 || headerRect.height <= 0) {
            host.classList.remove("is-visible");
            return;
        }

        const shouldFreeze =
            headerRect.top <= 0 &&
            tableRect.bottom > 0;

        if (!shouldFreeze) {
            host.classList.remove("is-visible");
            return;
        }

        copyCellMetrics();

        host.classList.add("is-visible");

        const horizontalOffset = container.scrollLeft || 0;
        clonedTable.style.transform = `translate3d(${-horizontalOffset}px, 0, 0)`;
    }

    const resizeObserver = typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(update)
        : null;

    if (resizeObserver) {
        resizeObserver.observe(container);
        resizeObserver.observe(table);
        resizeObserver.observe(headerRow);
    }

    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update, true);
    container.addEventListener("scroll", update, true);

    const state = {
        host,
        update,
        resizeObserver
    };

    frozenTableHeaderStates.set(container, state);

    requestAnimationFrame(update);
}
