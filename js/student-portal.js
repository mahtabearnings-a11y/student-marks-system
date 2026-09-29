/* =========================================================
   STUDENT PORTAL
   Read-only student-facing portal for authenticated student accounts.
========================================================= */

let studentPortalContext = null;
let studentPortalSessions = [];
let studentPortalMarks = {};
let studentPortalSubjects = [];
let studentPortalRecord = null;

const studentPortalSession = document.getElementById("studentPortalSession");
const studentPortalExam = document.getElementById("studentPortalExam");
const studentPortalMarksBody = document.getElementById("studentPortalMarksBody");
const studentPortalAttendanceBody = document.getElementById("studentPortalAttendanceBody");
const studentPortalAttendanceSummary = document.getElementById("studentPortalAttendanceSummary");
const studentPortalProfile = document.getElementById("studentPortalProfile");
const studentPortalNoticeList = document.getElementById("studentPortalNoticeList");
const studentPortalExamSchedule = document.getElementById("studentPortalExamSchedule");
const studentPortalTimetable = document.getElementById("studentPortalTimetable");
const studentPortalReportButton = document.getElementById("studentPortalReportButton");
const studentPortalPasswordForm = document.getElementById("studentPortalPasswordForm");
const studentPortalMessage = document.getElementById("studentPortalMessage");

function studentPortalEsc(value) {
    return typeof escapeHtml === "function" ? escapeHtml(String(value ?? "")) : String(value ?? "");
}

function studentPortalShowMessage(message, type = "") {
    if (!studentPortalMessage) return;
    studentPortalMessage.textContent = message || "";
    studentPortalMessage.className = "student-portal-message" + (type ? ` ${type}` : "");
    if (!message) studentPortalMessage.classList.add("hidden");
}

function studentPortalClassLabel(classNo) {
    if (typeof className === "function") return className(classNo);
    return `Class ${classNo}`;
}

function studentPortalGrade(pct) {
    if (!Number.isFinite(pct)) return "";
    if (pct >= 80.5) return "A";
    if (pct >= 60.5) return "B";
    if (pct >= 40.5) return "C";
    if (pct >= 32.5) return "D";
    return "E";
}

function studentPortalFormatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

async function getStudentPortalAccount(userId) {
    const { data, error } = await supabaseClient
        .from("student_accounts")
        .select("student_id, is_enabled, must_change_password, password_changed_at")
        .eq("user_id", userId)
        .maybeSingle();
    if (error) throw new Error("Unable to load student account.");
    if (!data?.student_id) throw new Error("This student account is not linked to a school student record.");
    return data;
}

async function loadStudentPortalContext() {
    const account = await getStudentPortalAccount(currentUser.id);

    const { data: student, error: studentError } = await supabaseClient
        .from("students")
        .select("id, student_id, apaar_id, student_name, father_name, mother_name, date_of_birth, gender")
        .eq("student_id", account.student_id)
        .maybeSingle();

    if (studentError) throw studentError;
    if (!student) throw new Error("The linked student record could not be found.");

    const { data: records, error: recordError } = await supabaseClient
        .from("academic_records")
        .select("id, session_id, class_no, roll_no, status")
        .eq("student_profile_id", student.id)
        .order("session_id", { ascending: false });

    if (recordError) throw recordError;
    if (!records?.length) throw new Error("No academic record is available for this student.");

    const sessionIds = [...new Set(records.map(record => record.session_id))];
    const { data: sessionRows, error: sessionError } = await supabaseClient
        .from("academic_sessions")
        .select("id, session_name, is_active")
        .in("id", sessionIds);

    if (sessionError) throw sessionError;

    const sessionMap = Object.fromEntries((sessionRows || []).map(row => [String(row.id), row]));
    studentPortalSessions = records.map(record => ({
        ...record,
        session: sessionMap[String(record.session_id)] || { id: record.session_id, session_name: `Session ${record.session_id}`, is_active: false }
    }));

    studentPortalContext = { student, account };
    studentPortalRenderProfile();
    studentPortalPopulateSessions();
    studentPortalUpdateDashboard();
    await studentPortalLoadAll();
}

function studentPortalUpdateDashboard() {
    const record = studentPortalSessions.find(r => String(r.session_id) === String(studentPortalSession?.value)) || studentPortalSessions[0];
    const s = studentPortalContext?.student;
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = String(value ?? "—"); };
    set("studentDashboardName", s?.student_name || "—");
    set("studentDashboardId", s?.student_id || "—");
    set("studentDashboardSession", record?.session?.session_name || "—");
    set("studentDashboardRoll", record?.roll_no ?? "—");
    set("studentDashboardClass", record ? studentPortalClassLabel(record.class_no) : "—");
}

function studentPortalPopulateSessions() {
    if (!studentPortalSession) return;
    studentPortalSession.innerHTML = studentPortalSessions.map(record =>
        `<option value="${studentPortalEsc(record.session_id)}">${studentPortalEsc(record.session.session_name)}</option>`
    ).join("");

    const active = studentPortalSessions.find(record => record.session?.is_active) || studentPortalSessions[0];
    if (active) studentPortalSession.value = String(active.session_id);
}

function studentPortalRenderProfile() {
    const s = studentPortalContext?.student;
    if (!s || !studentPortalProfile) return;

    const record = studentPortalSessions.find(r => String(r.session_id) === String(studentPortalSession?.value)) || studentPortalSessions[0];
    studentPortalProfile.innerHTML = `
        <div class="student-profile-grid">
            <div><small>Student Name</small><strong>${studentPortalEsc(s.student_name)}</strong></div>
            <div><small>Student ID</small><strong>${studentPortalEsc(s.student_id || "—")}</strong></div>
            <div><small>APAAR ID</small><strong>${studentPortalEsc(s.apaar_id || "—")}</strong></div>
            <div><small>Class</small><strong>${studentPortalEsc(record ? studentPortalClassLabel(record.class_no) : "—")}</strong></div>
            <div><small>Roll Number</small><strong>${studentPortalEsc(record?.roll_no ?? "—")}</strong></div>
            <div><small>Father's Name</small><strong>${studentPortalEsc(s.father_name || "—")}</strong></div>
            <div><small>Mother's Name</small><strong>${studentPortalEsc(s.mother_name || "—")}</strong></div>
            <div><small>Date of Birth</small><strong>${studentPortalEsc(studentPortalFormatDate(s.date_of_birth))}</strong></div>
            <div><small>Gender</small><strong>${studentPortalEsc(s.gender || "—")}</strong></div>
            <div><small>Status</small><strong>${studentPortalEsc(record?.status || "Active")}</strong></div>
        </div>`;
}

async function studentPortalLoadAll() {
    const sessionId = Number(studentPortalSession?.value);
    const record = studentPortalSessions.find(r => String(r.session_id) === String(sessionId));
    studentPortalRecord = record || null;
    studentPortalRenderProfile();

    if (!record) return;

    await Promise.all([
        studentPortalLoadMarks(record),
        studentPortalLoadAttendance(record),
        studentPortalLoadNotices(record),
        studentPortalLoadSchedules(record)
    ]);
}

async function studentPortalLoadMarks(record) {
    studentPortalMarks = {};
    if (studentPortalMarksBody) studentPortalMarksBody.innerHTML = `<tr><td colspan="6">Loading marks…</td></tr>`;

    const { data: subjects, error: subjectError } = await supabaseClient
        .from("subjects")
        .select("id, subject_name, display_order")
        .eq("class_no", record.class_no)
        .order("display_order", { ascending: true });
    if (subjectError) throw subjectError;
    studentPortalSubjects = subjects || [];

    const { data: marks, error: marksError } = await supabaseClient
        .from("exam_marks")
        .select("subject_id, examination, marks, full_marks")
        .eq("academic_record_id", record.id);
    if (marksError) throw marksError;

    (marks || []).forEach(mark => {
        studentPortalMarks[`${mark.subject_id}_${mark.examination}`] = mark;
    });

    if (studentPortalExam && ![...studentPortalExam.options].some(option => option.value === studentPortalExam.value)) {
        studentPortalExam.value = "Half-Yearly";
    }
    studentPortalRenderMarks();
}

function studentPortalRenderMarks() {
    if (!studentPortalMarksBody) return;
    const exam = studentPortalExam?.value || "Half-Yearly";
    let total = 0;
    let max = 0;

    const rows = studentPortalSubjects.map((subject, index) => {
        let obtained = "";
        let full = exam === "Final" ? 100 : 50;

        if (exam === "Final") {
            const half = Number(studentPortalMarks[`${subject.id}_Half-Yearly`]?.marks);
            const annual = Number(studentPortalMarks[`${subject.id}_Annual`]?.marks);
            const hasHalf = Number.isFinite(half);
            const hasAnnual = Number.isFinite(annual);
            if (hasHalf || hasAnnual) {
                obtained = (hasHalf ? half : 0) + (hasAnnual ? annual : 0);
                total += obtained;
                max += 100;
            } else {
                max += 100;
            }
        } else {
            const row = studentPortalMarks[`${subject.id}_${exam}`];
            if (row && row.marks !== null && row.marks !== undefined && row.marks !== "") {
                obtained = Number(row.marks);
                if (Number.isFinite(obtained)) total += obtained;
            }
            max += full;
        }

        const rowClass = obtained === "" ? "" : obtained < (full * 0.33) ? "student-mark-low" : "";
        return `<tr class="${rowClass}"><td>${index + 1}</td><td class="student-subject-cell">${studentPortalEsc(subject.subject_name)}</td><td>${obtained === "" ? "—" : studentPortalEsc(obtained)}</td><td>${full}</td></tr>`;
    }).join("");

    const pct = max ? (total / max) * 100 : 0;
    const grade = studentPortalGrade(pct);
    const entered = Object.values(studentPortalMarks).some(row => row && row.examination === exam && row.marks !== null && row.marks !== undefined && row.marks !== "");

    studentPortalMarksBody.innerHTML = rows || `<tr><td colspan="4">No subjects configured for this class.</td></tr>`;
    const summary = document.getElementById("studentPortalMarksSummary");
    if (summary) {
        summary.innerHTML = `
            <div><small>Total</small><strong>${entered ? total : "—"}</strong></div>
            <div><small>Full Marks</small><strong>${max || "—"}</strong></div>
            <div><small>Percentage</small><strong>${entered ? `${pct.toFixed(2)}%` : "—"}</strong></div>
            <div><small>Grade</small><strong>${entered ? studentPortalEsc(grade) : "—"}</strong></div>`;
    }
}

async function studentPortalLoadAttendance(record) {
    if (studentPortalAttendanceBody) studentPortalAttendanceBody.innerHTML = `<tr><td colspan="5">Loading attendance…</td></tr>`;
    const months = Array.from({ length: 12 }, (_, index) => index + 1);

    const [{ data: workingRows, error: workingError }, { data: attendanceRows, error: attendanceError }] = await Promise.all([
        supabaseClient.from("monthly_working_days").select("month_no, working_days").eq("session_id", record.session_id).in("month_no", months),
        supabaseClient.from("monthly_attendance").select("month_no, present_days, working_days").eq("academic_record_id", record.id).in("month_no", months)
    ]);

    if (workingError) throw workingError;
    if (attendanceError) throw attendanceError;

    const working = Object.fromEntries((workingRows || []).map(row => [Number(row.month_no), Number(row.working_days || 0)]));
    const present = Object.fromEntries((attendanceRows || []).map(row => [Number(row.month_no), Number(row.present_days || 0)]));
    const monthNames = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

    let totalWorking = 0;
    let totalPresent = 0;
    const rows = monthNames.map((name, index) => {
        const monthNo = index + 1;
        const wd = Number(working[monthNo] || 0);
        const pr = Number(present[monthNo] || 0);
        const abs = Math.max(0, wd - pr);
        const pct = wd ? `${((pr / wd) * 100).toFixed(2)}%` : "—";
        totalWorking += wd;
        totalPresent += pr;
        return `<tr><td>${name}</td><td>${wd || "—"}</td><td>${attendanceRows?.some(r => Number(r.month_no) === monthNo) ? pr : "—"}</td><td>${wd ? abs : "—"}</td><td>${pct}</td></tr>`;
    }).join("");

    const totalAbsent = Math.max(0, totalWorking - totalPresent);
    const totalPct = totalWorking ? ((totalPresent / totalWorking) * 100).toFixed(2) : "—";
    if (studentPortalAttendanceBody) studentPortalAttendanceBody.innerHTML = rows;
    if (studentPortalAttendanceSummary) studentPortalAttendanceSummary.innerHTML = `Total Working Days: <b>${totalWorking || "—"}</b> &nbsp; Present: <b>${totalPresent || "—"}</b> &nbsp; Absent: <b>${totalWorking ? totalAbsent : "—"}</b> &nbsp; Attendance: <b>${totalPct}${totalWorking ? "%" : ""}</b>`;
}

async function studentPortalLoadNotices(record) {
    if (!studentPortalNoticeList) return;
    const { data, error } = await supabaseClient
        .from("student_notices")
        .select("title, message, published_at")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(20);
    if (error) {
        studentPortalNoticeList.innerHTML = `<div class="student-empty-state">No notices are available yet.</div>`;
        return;
    }
    studentPortalNoticeList.innerHTML = (data || []).map(notice => `
        <article class="student-notice-card">
            <div><strong>${studentPortalEsc(notice.title)}</strong><small>${studentPortalEsc(studentPortalFormatDate(notice.published_at))}</small></div>
            <p>${studentPortalEsc(notice.message)}</p>
        </article>`).join("") || `<div class="student-empty-state">No notices are published yet.</div>`;
}

async function studentPortalLoadSchedules(record) {
    if (studentPortalExamSchedule) {
        const { data, error } = await supabaseClient
            .from("exam_schedules")
            .select("examination, exam_date, start_time, end_time, room_no")
            .eq("class_no", record.class_no)
            .eq("session_id", record.session_id)
            .order("exam_date", { ascending: true });
        if (!error && data?.length) {
            studentPortalExamSchedule.innerHTML = data.map(row => `<tr><td>${studentPortalEsc(row.examination)}</td><td>${studentPortalEsc(studentPortalFormatDate(row.exam_date))}</td><td>${studentPortalEsc(row.start_time || "—")}</td><td>${studentPortalEsc(row.end_time || "—")}</td><td>${studentPortalEsc(row.room_no || "—")}</td></tr>`).join("");
        } else {
            studentPortalExamSchedule.innerHTML = `<tr><td colspan="5">No examination schedule published yet.</td></tr>`;
        }
    }

    if (studentPortalTimetable) {
        const { data, error } = await supabaseClient
            .from("class_timetables")
            .select("day_name, period_no, subject_name, start_time, end_time")
            .eq("class_no", record.class_no)
            .eq("session_id", record.session_id)
            .order("day_order", { ascending: true })
            .order("period_no", { ascending: true });
        if (!error && data?.length) {
            studentPortalTimetable.innerHTML = data.map(row => `<tr><td>${studentPortalEsc(row.day_name)}</td><td>${studentPortalEsc(row.period_no)}</td><td>${studentPortalEsc(row.subject_name)}</td><td>${studentPortalEsc(row.start_time || "—")}</td><td>${studentPortalEsc(row.end_time || "—")}</td></tr>`).join("");
        } else {
            studentPortalTimetable.innerHTML = `<tr><td colspan="5">No timetable published yet.</td></tr>`;
        }
    }
}

function studentPortalReportHtml() {
    const record = studentPortalRecord;
    const s = studentPortalContext?.student;
    if (!record || !s) return "";
    const exam = studentPortalExam?.value || "Half-Yearly";
    const sessionName = record.session?.session_name || "";
    const total = [...(studentPortalMarksBody?.querySelectorAll("tr") || [])].reduce((sum, row) => {
        const value = Number(row.children?.[2]?.textContent);
        return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    const full = exam === "Final" ? studentPortalSubjects.length * 100 : studentPortalSubjects.length * 50;
    const pct = full ? (total / full) * 100 : 0;
    const grade = studentPortalGrade(pct);

    const rows = studentPortalSubjects.map((subject, index) => {
        let value = "";
        if (exam === "Final") {
            const half = Number(studentPortalMarks[`${subject.id}_Half-Yearly`]?.marks);
            const annual = Number(studentPortalMarks[`${subject.id}_Annual`]?.marks);
            if (Number.isFinite(half) || Number.isFinite(annual)) value = (Number.isFinite(half) ? half : 0) + (Number.isFinite(annual) ? annual : 0);
            return `<tr><td>${index + 1}</td><td>${studentPortalEsc(subject.subject_name)}</td><td>${value === "" ? "" : value}</td><td>100</td></tr>`;
        }
        const mark = studentPortalMarks[`${subject.id}_${exam}`]?.marks;
        value = mark === null || mark === undefined || mark === "" ? "" : mark;
        return `<tr><td>${index + 1}</td><td>${studentPortalEsc(subject.subject_name)}</td><td>${studentPortalEsc(value)}</td><td>50</td></tr>`;
    }).join("");

    return `<!doctype html><html><head><meta charset="utf-8"><title>${studentPortalEsc(s.student_name)} - ${studentPortalEsc(exam)} Result</title><style>
        @page{size:A4 portrait;margin:12mm}body{font-family:"Times New Roman",serif;color:#111;margin:0}.result{position:relative}.watermark{position:fixed;left:50%;top:52%;transform:translate(-50%,-50%);width:300px;opacity:.07;z-index:-1}.head{text-align:center;border-bottom:1.5px solid #123b73;padding-bottom:8px}.head img{width:64px;height:64px;object-fit:contain;vertical-align:middle;margin-right:10px}.head h1{display:inline-block;vertical-align:middle;font-size:20px;margin:0}.meta{display:grid;grid-template-columns:1fr 1fr;gap:5px 20px;margin:15px 0;font-size:12px}.meta div{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:3px 0}.title{text-align:center;font-weight:bold;font-size:16px;margin:10px 0}.table{width:100%;border-collapse:collapse;font-size:12px}.table th,.table td{border:1px solid #111;padding:6px;text-align:center}.table th:nth-child(2),.table td:nth-child(2){text-align:left}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:15px}.summary div{border:1px solid #333;padding:8px;text-align:center}.signatures{display:flex;justify-content:space-between;margin-top:55px;font-size:11px}.signatures div{width:34%;text-align:center;border-top:1px solid #111;padding-top:4px}@media print{button{display:none}}
    </style></head><body><div class="result"><img class="watermark" src="${location.href.replace(/[^/]*$/, "school-logo-polished.png")}" alt=""><div class="head"><img src="${location.href.replace(/[^/]*$/, "school-logo-polished.png")}" alt="Logo"><h1>U.M.S SASAULI URDU<br><small>ESTD. 1986 • Muzaffarpur, Bihar</small></h1></div><div class="title">STUDENT RESULT</div><div class="meta"><div><b>Student Name</b><span>${studentPortalEsc(s.student_name)}</span></div><div><b>Session</b><span>${studentPortalEsc(sessionName)}</span></div><div><b>Student ID</b><span>${studentPortalEsc(s.student_id || "—")}</span></div><div><b>Examination</b><span>${studentPortalEsc(exam)}</span></div><div><b>Class</b><span>${studentPortalEsc(studentPortalClassLabel(record.class_no))}</span></div><div><b>Roll Number</b><span>${studentPortalEsc(record.roll_no ?? "—")}</span></div><div><b>Father's Name</b><span>${studentPortalEsc(s.father_name || "—")}</span></div><div><b>Mother's Name</b><span>${studentPortalEsc(s.mother_name || "—")}</span></div></div><table class="table"><thead><tr><th>Sl. No.</th><th>Subject</th><th>Obtained Marks</th><th>Full Marks</th></tr></thead><tbody>${rows}<tr><th colspan="2">Total</th><th>${total}</th><th>${full}</th></tr></tbody></table><div class="summary"><div>Percentage<br><b>${pct.toFixed(2)}%</b></div><div>Grade<br><b>${studentPortalEsc(grade)}</b></div><div>Result<br><b>${grade === "E" ? "Not Passed" : "Passed"}</b></div></div><div class="signatures"><div>Class Teacher's Signature</div><div>Headmaster's Signature</div></div></div><script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`;
}

function studentPortalPrintReport() {
    const html = studentPortalReportHtml();
    if (!html) return;
    const win = window.open("", "studentReportCard", "width=900,height=900");
    if (!win) {
        studentPortalShowMessage("Please allow pop-ups to print or save the report card.", "error");
        return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
}

async function studentPortalChangePassword(event) {
    event.preventDefault();
    const password = document.getElementById("studentNewPassword")?.value || "";
    const confirm = document.getElementById("studentConfirmPassword")?.value || "";
    if (password.length < 8) { studentPortalShowMessage("Password must contain at least 8 characters.", "error"); return; }
    if (password !== confirm) { studentPortalShowMessage("The passwords do not match.", "error"); return; }
    try {
        const { data, error } = await supabaseClient.functions.invoke("manage-student-login", { body: { action: "change_password", password } });
        if (error) throw new Error(data?.error || error.message || "Unable to change password.");
        studentPortalPasswordForm.reset();
        if (studentPortalContext?.account) {
            studentPortalContext.account.must_change_password = false;
            studentPortalContext.account.password_changed_at = new Date().toISOString();
        }
        closeStudentForcePasswordModal();
        studentPortalShowMessage("Password changed successfully.", "success");
    } catch (error) {
        studentPortalShowMessage(error.message || "Unable to change password.", "error");
    }
}

function showStudentForcePasswordModal() {
    const modal = document.getElementById("studentForcePasswordModal");
    const form = document.getElementById("studentForcePasswordForm");
    const message = document.getElementById("studentForcePasswordMessage");
    if (!modal) return;
    if (form) form.reset();
    if (message) { message.textContent = ""; message.className = "student-portal-message hidden"; }
    modal.classList.remove("hidden");
    setTimeout(() => document.getElementById("studentForcePassword")?.focus(), 50);
}

function closeStudentForcePasswordModal() {
    document.getElementById("studentForcePasswordModal")?.classList.add("hidden");
}

async function studentForcePasswordSubmit(event) {
    event.preventDefault();
    const password = document.getElementById("studentForcePassword")?.value || "";
    const confirm = document.getElementById("studentForcePasswordConfirm")?.value || "";
    const message = document.getElementById("studentForcePasswordMessage");
    const button = document.getElementById("studentForcePasswordButton");
    if (password.length < 8) { if (message) { message.textContent = "Password must contain at least 8 characters."; message.className = "student-portal-message error"; } return; }
    if (password !== confirm) { if (message) { message.textContent = "The passwords do not match."; message.className = "student-portal-message error"; } return; }
    if (button) { button.disabled = true; button.textContent = "Saving..."; }
    try {
        const { data, error } = await supabaseClient.functions.invoke("manage-student-login", { body: { action: "change_password", password } });
        if (error) throw new Error(data?.error || error.message || "Unable to change password.");
        if (studentPortalContext?.account) {
            studentPortalContext.account.must_change_password = false;
            studentPortalContext.account.password_changed_at = new Date().toISOString();
        }
        closeStudentForcePasswordModal();
        studentPortalShowMessage("Password changed successfully. Welcome to the Student Portal.", "success");
    } catch (error) {
        if (message) { message.textContent = error.message || "Unable to change password."; message.className = "student-portal-message error"; }
    } finally {
        if (button) { button.disabled = false; button.textContent = "Save New Password"; }
    }
}


async function showStudentApplication(user, options = {}) {
    currentUser = user;
    currentRole = "student";
    userEmail.textContent = user.email || "Student";
    roleBadge.textContent = "Student";
    if (recycleBinNavButton) recycleBinNavButton.classList.add("hidden");
    document.getElementById("studentAccountsNavButton")?.classList.add("hidden");
    document.querySelectorAll(".staff-only-nav").forEach(item => item.classList.add("hidden"));
    document.querySelectorAll(".student-only-nav").forEach(item => item.classList.remove("hidden"));
    document.querySelectorAll(".staff-only-section").forEach(item => item.classList.add("hidden"));
    document.querySelectorAll(".student-only-section").forEach(item => item.classList.remove("hidden"));

    const avatar = document.querySelector(".user-avatar");
    if (avatar) avatar.textContent = "ST";

    if (studentPortalSession) studentPortalSession.value = "";
    studentPortalShowMessage("");
    await loadStudentPortalContext();

    if (!studentPortalContext?.account?.is_enabled) {
        throw new Error("Student login is currently disabled by the school administrator.");
    }

    showSection("studentDashboard", { updateHash: true, skipReset: true });

    loginPage.classList.add("hidden");
    appPage.classList.remove("hidden");
    document.body.classList.add("auth-ready", "student-mode");
    startInactivityTimer();

    if (studentPortalContext.account.must_change_password) {
        showStudentForcePasswordModal();
    }
}


function resetStudentPortalView() {
    studentPortalContext = null;
    studentPortalSessions = [];
    studentPortalMarks = {};
    studentPortalSubjects = [];
    studentPortalRecord = null;
    document.querySelectorAll(".student-only-nav").forEach(item => item.classList.add("hidden"));
    document.querySelectorAll(".student-only-section").forEach(item => item.classList.add("hidden"));
    document.querySelectorAll(".staff-only-nav").forEach(item => item.classList.remove("hidden"));
    document.querySelectorAll(".staff-only-section").forEach(item => item.classList.remove("hidden"));
    document.body.classList.remove("student-mode");
}

studentPortalSession?.addEventListener("change", async () => { studentPortalUpdateDashboard(); await studentPortalLoadAll(); });
studentPortalExam?.addEventListener("change", studentPortalRenderMarks);
studentPortalReportButton?.addEventListener("click", studentPortalPrintReport);
document.querySelectorAll("[data-student-link]").forEach(button => button.addEventListener("click", () => requestSectionChange(button.dataset.studentLink)));
studentPortalPasswordForm?.addEventListener("submit", studentPortalChangePassword);
document.getElementById("studentForcePasswordForm")?.addEventListener("submit", studentForcePasswordSubmit);

