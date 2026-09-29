/* =========================================================
   STUDENT LOGIN ACCOUNTS — ADMIN MANAGEMENT
   Creates and manages Supabase Auth-backed student accounts.
========================================================= */

let studentLoginRows = [];
let studentPasswordModalStudentId = null;

const studentAccountsTableContainer = document.getElementById("studentAccountsTableContainer");
const studentAccountRecordCount = document.getElementById("studentAccountRecordCount");
const studentAccountSearch = document.getElementById("studentAccountSearch");
const studentAccountStatusFilter = document.getElementById("studentAccountStatusFilter");
const studentAccountOverview = document.getElementById("studentAccountOverview");
const studentAccountsMessage = document.getElementById("studentAccountsMessage");
const studentPasswordAdminModal = document.getElementById("studentPasswordAdminModal");
const studentPasswordAdminForm = document.getElementById("studentPasswordAdminForm");
const studentAdminNewPassword = document.getElementById("studentAdminNewPassword");
const studentPasswordAdminStudent = document.getElementById("studentPasswordAdminStudent");
const studentPasswordAdminMessage = document.getElementById("studentPasswordAdminMessage");

function studentAccountsEscape(value) {
    return typeof escapeHtml === "function" ? escapeHtml(String(value ?? "")) : String(value ?? "");
}

function studentAccountsClassLabel(value) {
    return typeof className === "function" ? className(value) : `Class ${value ?? "—"}`;
}

function studentAccountsGeneratePassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const bytes = new Uint32Array(10);
    crypto.getRandomValues(bytes);
    let part = "";
    bytes.forEach(byte => { part += chars[byte % chars.length]; });
    return `Sasauli@${part}`;
}

function studentAccountsShowMessage(message, type = "") {
    if (!studentAccountsMessage) return;
    studentAccountsMessage.textContent = message || "";
    studentAccountsMessage.className = "student-portal-message" + (type ? ` ${type}` : "");
    if (!message) studentAccountsMessage.classList.add("hidden");
}

function studentPasswordAdminShowMessage(message, type = "") {
    if (!studentPasswordAdminMessage) return;
    studentPasswordAdminMessage.textContent = message || "";
    studentPasswordAdminMessage.className = "student-portal-message" + (type ? ` ${type}` : "");
    if (!message) studentPasswordAdminMessage.classList.add("hidden");
}

async function invokeStudentLoginManager(action, payload = {}) {
    const { data, error } = await supabaseClient.functions.invoke("manage-student-login", {
        body: { action, ...payload }
    });
    if (error) {
        let message = error.message || "Student login operation failed.";
        if (data?.error) message = data.error;
        throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data || {};
}

async function loadStudentLoginAccounts() {
    if (currentRole !== "admin") return;
    if (!studentAccountsTableContainer) return;

    studentAccountsTableContainer.innerHTML = `<div class="loading">Loading student login accounts...</div>`;
    studentAccountsShowMessage("");

    try {
        const [{ data: students, error: studentsError }, { data: accounts, error: accountsError }] = await Promise.all([
            supabaseClient
                .from("students")
                .select("id, student_id, student_name, father_name, mother_name, date_of_birth, gender")
                .not("student_id", "is", null)
                .order("student_name", { ascending: true }),
            supabaseClient
                .from("student_accounts")
                .select("user_id, student_id, auth_email, is_enabled, must_change_password, password_changed_at, created_at, updated_at")
                .order("student_id", { ascending: true })
        ]);

        if (studentsError) throw studentsError;
        if (accountsError) throw accountsError;

        const studentRows = students || [];
        const studentIds = studentRows.map(s => s.student_id).filter(Boolean);
        const profileIds = studentRows.map(s => s.id).filter(id => id !== null && id !== undefined);

        let records = [];
        let credentials = [];

        if (profileIds.length) {
            const { data, error } = await supabaseClient
                .from("academic_records")
                .select("student_profile_id, session_id, class_no, roll_no, status")
                .in("student_profile_id", profileIds)
                .order("session_id", { ascending: false });
            if (error) throw error;
            records = data || [];
        }

        if (studentIds.length) {
            const { data, error } = await supabaseClient
                .from("student_login_credentials")
                .select("student_id, current_password, updated_at")
                .in("student_id", studentIds);
            if (error) throw error;
            credentials = data || [];
        }

        const accountMap = new Map((accounts || []).map(row => [String(row.student_id), row]));
        const credentialMap = new Map((credentials || []).map(row => [String(row.student_id), row]));
        const studentMap = new Map(studentRows.map(row => [String(row.student_id), row]));
        const latestRecordMap = new Map();

        records.forEach(row => {
            const key = String(studentRows.find(s => String(s.id) === String(row.student_profile_id))?.student_id || "");
            if (!key) return;
            const previous = latestRecordMap.get(key);
            if (!previous || Number(row.session_id) > Number(previous.session_id)) {
                latestRecordMap.set(key, row);
            }
        });

        // Include any orphaned account so an admin can still see and disable it.
        const allIds = [...new Set([...studentIds, ...(accounts || []).map(row => row.student_id).filter(Boolean)])];

        studentLoginRows = allIds.map(studentId => {
            const student = studentMap.get(String(studentId)) || null;
            const account = accountMap.get(String(studentId)) || null;
            const credential = credentialMap.get(String(studentId)) || null;
            const record = latestRecordMap.get(String(studentId)) || null;
            return {
                studentId: String(studentId),
                studentName: student?.student_name || "Unknown / Deleted Student",
                classNo: record?.class_no ?? "",
                rollNo: record?.roll_no ?? "",
                status: record?.status || "",
                account,
                credential,
                record
            };
        });

        studentLoginRows.sort((a, b) => a.studentName.localeCompare(b.studentName));
        renderStudentLoginAccounts();
    } catch (error) {
        console.error(error);
        studentAccountsTableContainer.innerHTML = `<div class="empty-state">Unable to load student login accounts.<br><br>${studentAccountsEscape(error.message)}</div>`;
        studentAccountRecordCount.textContent = "Unable to load accounts";
    }
}

function getFilteredStudentLoginRows() {
    const search = String(studentAccountSearch?.value || "").trim().toLowerCase();
    const status = studentAccountStatusFilter?.value || "all";

    return studentLoginRows.filter(row => {
        if (search) {
            const fields = [row.studentId, row.studentName, row.classNo, row.rollNo, row.auth_email].map(value => String(value ?? "").toLowerCase());
            if (!fields.some(value => value.includes(search))) return false;
        }
        if (status === "active" && !row.account?.is_enabled) return false;
        if (status === "disabled" && row.account?.is_enabled !== false) return false;
        if (status === "not_created" && row.account) return false;
        if (status === "first_login" && !(row.account?.must_change_password)) return false;
        return true;
    });
}

function renderStudentLoginAccounts() {
    const rows = getFilteredStudentLoginRows();
    const all = studentLoginRows;
    const created = all.filter(row => !!row.account).length;
    const active = all.filter(row => row.account?.is_enabled).length;
    const disabled = all.filter(row => row.account && row.account.is_enabled === false).length;
    const firstLogin = all.filter(row => row.account?.must_change_password).length;

    if (studentAccountOverview) {
        studentAccountOverview.innerHTML = `
            <span>${created}/${all.length} accounts created</span>
            <span>Active: <b>${active}</b></span>
            <span>Disabled: <b>${disabled}</b></span>
            <span>First login: <b>${firstLogin}</b></span>`;
    }

    if (studentAccountRecordCount) {
        studentAccountRecordCount.textContent = `${rows.length} student${rows.length === 1 ? "" : "s"}`;
    }

    if (!rows.length) {
        studentAccountsTableContainer.innerHTML = `<div class="empty-state">No matching student accounts found.</div>`;
        return;
    }

    let html = `
        <table class="student-accounts-table">
            <thead>
                <tr>
                    <th>Student</th>
                    <th>Class / Roll</th>
                    <th>Student ID / Login</th>
                    <th>Password</th>
                    <th>Account</th>
                    <th>Password Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>`;

    rows.forEach(row => {
        const account = row.account;
        const credential = row.credential;
        const enabled = account?.is_enabled === true;
        const notCreated = !account;
        const password = credential?.current_password || "—";
        const passwordStatus = !account ? "Not created" : account.must_change_password ? "First login / change required" : "Changed";
        const passwordClass = account?.must_change_password ? "student-login-status-warning" : "student-login-status-ok";
        const accountStatus = !account ? "Not created" : enabled ? "Active" : "Disabled";
        const accountStatusClass = !account ? "student-login-status-neutral" : enabled ? "student-login-status-ok" : "student-login-status-danger";

        html += `
            <tr>
                <td>
                    <strong>${studentAccountsEscape(row.studentName)}</strong>
                    <small>${studentAccountsEscape(row.status || "Current student")}</small>
                </td>
                <td>${studentAccountsEscape(row.classNo ? studentAccountsClassLabel(row.classNo) : "—")} / ${studentAccountsEscape(row.rollNo ?? "—")}</td>
                <td>
                    <strong>${studentAccountsEscape(row.studentId)}</strong>
                    <small>${studentAccountsEscape(account?.auth_email || "Login created automatically when account is provisioned")}</small>
                </td>
                <td><code class="visible-student-password">${studentAccountsEscape(password)}</code></td>
                <td><span class="student-login-status ${accountStatusClass}">${accountStatus}</span></td>
                <td><span class="student-login-status ${passwordClass}">${passwordStatus}</span>${account?.password_changed_at ? `<small class="student-login-date">${studentAccountsEscape(new Date(account.password_changed_at).toLocaleDateString("en-IN"))}</small>` : ""}</td>
                <td>
                    <div class="student-account-actions">
                        ${notCreated
                            ? `<button class="btn btn-primary btn-small" type="button" onclick="window.createStudentLogin(decodeURIComponent('${encodeURIComponent(row.studentId)}'))">Create Login</button>`
                            : `<button class="btn btn-secondary btn-small" type="button" onclick="window.openStudentPasswordAdmin(decodeURIComponent('${encodeURIComponent(row.studentId)}'))">Change Password</button>\n                               <button class="btn ${enabled ? "btn-warning" : "btn-primary"} btn-small" type="button" onclick="window.toggleStudentLogin(decodeURIComponent('${encodeURIComponent(row.studentId)}'), ${enabled ? "false" : "true"})">${enabled ? "Disable Login" : "Enable Login"}</button>`}
                    </div>
                </td>
            </tr>`;
    });

    html += `</tbody></table>`;
    studentAccountsTableContainer.innerHTML = html;
}

window.createStudentLogin = async function(studentId) {
    if (currentRole !== "admin") return;
    studentAccountsShowMessage("");
    try {
        const result = await invokeStudentLoginManager("create", { student_id: studentId });
        studentAccountsShowMessage(`Login created for ${studentId}. Temporary password: ${result.password || "see account table"}`, "success");
        await loadStudentLoginAccounts();
    } catch (error) {
        studentAccountsShowMessage(error.message, "error");
    }
};

window.toggleStudentLogin = async function(studentId, enabled) {
    if (currentRole !== "admin") return;
    const actionText = enabled ? "enable" : "disable";
    if (!confirm(`Are you sure you want to ${actionText} login for ${studentId}?`)) return;
    try {
        await invokeStudentLoginManager("set_enabled", { student_id: studentId, enabled });
        showToast(`Student login ${enabled ? "enabled" : "disabled"}.`, "success");
        await loadStudentLoginAccounts();
    } catch (error) {
        showToast(error.message, "error");
    }
};

window.openStudentPasswordAdmin = function(studentId) {
    if (currentRole !== "admin" || !studentPasswordAdminModal) return;
    const row = studentLoginRows.find(item => String(item.studentId) === String(studentId));
    if (!row?.account) return;
    studentPasswordModalStudentId = row.studentId;
    studentPasswordAdminStudent.innerHTML = `<strong>${studentAccountsEscape(row.studentName)}</strong><span>Student ID: ${studentAccountsEscape(row.studentId)}</span>`;
    studentAdminNewPassword.value = row.credential?.current_password || studentAccountsGeneratePassword();
    studentPasswordAdminShowMessage("");
    studentPasswordAdminModal.classList.remove("hidden");
    studentAdminNewPassword.focus();
};

function closeStudentPasswordAdmin() {
    studentPasswordModalStudentId = null;
    if (studentPasswordAdminModal) studentPasswordAdminModal.classList.add("hidden");
}

async function provisionAllStudentAccounts() {
    if (currentRole !== "admin") return;
    const confirmed = confirm("Create login accounts for all students who do not have one? Existing passwords will be kept. Accounts that lack a stored password will receive a new temporary password.");
    if (!confirmed) return;
    const button = document.getElementById("provisionStudentAccountsButton");
    if (button) { button.disabled = true; button.textContent = "Creating..."; }
    studentAccountsShowMessage("");
    try {
        const result = await invokeStudentLoginManager("provision_all", {});
        const created = Number(result.created || 0);
        const repaired = Number(result.repaired || 0);
        const skipped = Number(result.skipped || 0);
        studentAccountsShowMessage(`Finished. Created: ${created}; repaired: ${repaired}; skipped: ${skipped}.`, "success");
        await loadStudentLoginAccounts();
    } catch (error) {
        studentAccountsShowMessage(error.message, "error");
    } finally {
        if (button) { button.disabled = false; button.textContent = "Create Missing Accounts"; }
    }
}

async function saveAdminStudentPassword(event) {
    event.preventDefault();
    if (currentRole !== "admin" || !studentPasswordModalStudentId) return;
    const password = String(studentAdminNewPassword?.value || "");
    if (password.length < 8) {
        studentPasswordAdminShowMessage("Password must contain at least 8 characters.", "error");
        return;
    }
    const button = document.getElementById("saveStudentPasswordButton");
    if (button) button.disabled = true;
    try {
        await invokeStudentLoginManager("set_password", {
            student_id: studentPasswordModalStudentId,
            password
        });
        studentPasswordAdminShowMessage("Password saved. The student must change it at their next login.", "success");
        await loadStudentLoginAccounts();
        setTimeout(closeStudentPasswordAdmin, 600);
    } catch (error) {
        studentPasswordAdminShowMessage(error.message, "error");
    } finally {
        if (button) button.disabled = false;
    }
}

async function syncStudentLoginAfterCreate(studentId) {
    if (currentRole !== "admin" || !studentId) return;
    try {
        const result = await invokeStudentLoginManager("create", { student_id: studentId });
        return result;
    } catch (error) {
        console.error("Student login creation failed:", error);
        throw error;
    }
}

window.refreshStudentLoginAccounts = loadStudentLoginAccounts;

function initStudentAccountsModule() {
    document.getElementById("provisionStudentAccountsButton")?.addEventListener("click", provisionAllStudentAccounts);
    document.getElementById("refreshStudentAccountsButton")?.addEventListener("click", loadStudentLoginAccounts);
    document.getElementById("openStudentAccountsButton")?.addEventListener("click", () => requestSectionChange("studentAccounts"));
    studentAccountSearch?.addEventListener("input", renderStudentLoginAccounts);
    studentAccountStatusFilter?.addEventListener("change", renderStudentLoginAccounts);
    document.getElementById("closeStudentPasswordAdminModal")?.addEventListener("click", closeStudentPasswordAdmin);
    document.getElementById("generateStudentPasswordButton")?.addEventListener("click", () => {
        if (studentAdminNewPassword) studentAdminNewPassword.value = studentAccountsGeneratePassword();
    });
    studentPasswordAdminForm?.addEventListener("submit", saveAdminStudentPassword);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStudentAccountsModule);
} else {
    initStudentAccountsModule();
}
