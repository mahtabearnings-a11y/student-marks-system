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



