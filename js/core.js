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

let inactivityTimer = null;

const INACTIVITY_LIMIT =
    15 * 60 * 1000;

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
