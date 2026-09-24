/* =========================================================
   ACADEMIC YEAR MANAGEMENT
========================================================= */

const academicYearNameInput = document.getElementById("academicYearName");
const academicYearStartInput = document.getElementById("academicYearStartDate");
const academicYearEndInput = document.getElementById("academicYearEndDate");
const createAcademicYearButton = document.getElementById("createAcademicYearButton");
const cancelAcademicYearEditButton = document.getElementById("cancelAcademicYearEditButton");
const refreshAcademicYearsButton = document.getElementById("refreshAcademicYearsButton");
const academicYearsTableContainer = document.getElementById("academicYearsTableContainer");
const academicYearsMessage = document.getElementById("academicYearsMessage");

let editingAcademicYearId = null;

function academicYearStatus(session) {
    if (session.deleted_at) return "Deleted";
    if (session.is_active) return "Active";
    if (session.is_closed) return "Closed";
    return "Draft";
}

function academicYearStatusBadge(status) {
    const cls = status.toLowerCase().replace(/\s+/g, "-");
    return `<span class="academic-year-status academic-year-status-${cls}">${escapeHtml(status)}</span>`;
}

function sortAcademicSessionsForManager(items) {
    return [...items].sort((a, b) => {
        const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
        const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
        return dateB - dateA || Number(b.id) - Number(a.id);
    });
}

function formatAcademicYearDate(value) {
    if (!value) return "—";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function resetAcademicYearForm() {
    editingAcademicYearId = null;
    if (academicYearNameInput) academicYearNameInput.value = "";
    if (academicYearStartInput) academicYearStartInput.value = "";
    if (academicYearEndInput) academicYearEndInput.value = "";
    if (createAcademicYearButton) createAcademicYearButton.textContent = "Create Academic Year";
    if (cancelAcademicYearEditButton) cancelAcademicYearEditButton.classList.add("hidden");
}

function prepareAcademicYearEdit(session) {
    editingAcademicYearId = Number(session.id);
    academicYearNameInput.value = session.session_name || "";
    academicYearStartInput.value = session.start_date || "";
    academicYearEndInput.value = session.end_date || "";
    createAcademicYearButton.textContent = "Save Academic Year";
    cancelAcademicYearEditButton.classList.remove("hidden");
    academicYearNameInput.focus();
}

function renderAcademicYears() {
    if (!academicYearsTableContainer) return;

    const items = sortAcademicSessionsForManager(sessions);
    if (!items.length) {
        academicYearsTableContainer.innerHTML = `<div class="empty-state">No academic years found.</div>`;
        return;
    }

    const rows = items.map(session => {
        const status = academicYearStatus(session);
        const canDelete = !session.is_active && !session.deleted_at;
        const canEdit = !session.deleted_at;
        const canActivate = !session.is_active && !session.deleted_at;
        const canClose = session.is_active && !session.deleted_at;

        const actions = [];
        if (canEdit) {
            actions.push(`<button class="btn btn-secondary btn-small academic-year-edit" data-id="${Number(session.id)}">Edit</button>`);
        }
        if (canClose) {
            actions.push(`<button class="btn btn-secondary btn-small academic-year-close" data-id="${Number(session.id)}">Close Year</button>`);
        }
        if (canActivate) {
            actions.push(`<button class="btn btn-primary btn-small academic-year-activate" data-id="${Number(session.id)}">Set Active</button>`);
        }
        if (canDelete) {
            actions.push(`<button class="btn btn-danger btn-small academic-year-delete" data-id="${Number(session.id)}">Move to Recycle Bin</button>`);
        }

        return `<tr>
            <td><strong>${escapeHtml(session.session_name || "")}</strong></td>
            <td>${formatAcademicYearDate(session.start_date)}</td>
            <td>${formatAcademicYearDate(session.end_date)}</td>
            <td>${academicYearStatusBadge(status)}</td>
            <td>${actions.join(" ") || "—"}</td>
        </tr>`;
    }).join("");

    academicYearsTableContainer.innerHTML = `<table class="academic-years-table">
        <thead><tr><th>Academic Year</th><th>Start</th><th>End</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
    </table>`;

    academicYearsTableContainer.querySelectorAll(".academic-year-edit").forEach(button => {
        button.addEventListener("click", async () => {
            const session = sessions.find(item => Number(item.id) === Number(button.dataset.id));
            if (!session) return;
            if (session.is_closed) {
                const verified = await requireAdminPasswordForAction({
                    title: "Edit Closed Academic Year",
                    message: `${session.session_name} is closed. Enter your Admin password to edit its details.`,
                    actionLabel: "Unlock & Edit"
                });
                if (!verified) return;
            }
            prepareAcademicYearEdit(session);
        });
    });

    academicYearsTableContainer.querySelectorAll(".academic-year-close").forEach(button => {
        button.addEventListener("click", () => closeAcademicYear(Number(button.dataset.id)));
    });

    academicYearsTableContainer.querySelectorAll(".academic-year-activate").forEach(button => {
        button.addEventListener("click", () => activateAcademicYear(Number(button.dataset.id)));
    });

    academicYearsTableContainer.querySelectorAll(".academic-year-delete").forEach(button => {
        button.addEventListener("click", () => moveAcademicYearToRecycleBin(Number(button.dataset.id)));
    });
}

async function loadAcademicYearManager() {
    if (!academicYearsTableContainer) return;
    if (currentRole !== "admin") {
        academicYearsTableContainer.innerHTML = `<div class="empty-state">Only an Admin can manage academic years.</div>`;
        return;
    }
    renderAcademicYears();
}

async function createOrUpdateAcademicYear() {
    if (currentRole !== "admin") return;

    const name = academicYearNameInput?.value.trim() || "";
    const startDate = academicYearStartInput?.value || null;
    const endDate = academicYearEndInput?.value || null;

    if (!name) {
        showToast("Academic year name is required.", "error");
        return;
    }

    if (startDate && endDate && startDate >= endDate) {
        showToast("End date must be after the start date.", "error");
        return;
    }

    createAcademicYearButton.disabled = true;
    try {
        if (editingAcademicYearId) {
            const current = sessions.find(item => Number(item.id) === editingAcademicYearId);
            if (current?.is_closed && !hasAcademicSessionEditUnlock(editingAcademicYearId)) {
                const verified = await requireAdminPasswordForAction({
                    title: "Edit Closed Academic Year",
                    message: `${current.session_name} is closed. Enter your Admin password to save these changes.`,
                    actionLabel: "Save Changes"
                });
                if (!verified) return;
            }

            const { error } = await supabaseClient.rpc("update_academic_session", {
                p_session_id: editingAcademicYearId,
                p_session_name: name,
                p_start_date: startDate,
                p_end_date: endDate
            });
            if (error) throw error;
            showToast("Academic year updated successfully.", "success");
        } else {
            const { error } = await supabaseClient.rpc("create_academic_session", {
                p_session_name: name,
                p_start_date: startDate,
                p_end_date: endDate
            });
            if (error) throw error;
            showToast("Academic year created as Draft.", "success");
        }

        resetAcademicYearForm();
        await loadSessions();
        renderAcademicYears();
        if (typeof populatePromotionSessions === "function") populatePromotionSessions();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Unable to save the academic year.", "error");
    } finally {
        createAcademicYearButton.disabled = false;
    }
}

async function closeAcademicYear(sessionId) {
    const session = sessions.find(item => Number(item.id) === Number(sessionId));
    if (!session) return;

    const verified = await requireAdminPasswordForAction({
        title: "Close Academic Year",
        message: `Closing ${session.session_name} will make its academic records protected. A password will be required before editing them later.`,
        actionLabel: "Close Year"
    });
    if (!verified) return;

    if (!confirm(`Close academic year ${session.session_name}?\n\nThe year will remain available for viewing and historical records will be preserved.`)) return;

    try {
        const { error } = await supabaseClient.rpc("close_academic_session", { p_session_id: sessionId });
        if (error) throw error;
        await loadSessions();
        renderAcademicYears();
        if (typeof populatePromotionSessions === "function") populatePromotionSessions();
        if (typeof loadPromotionStudents === "function") await loadPromotionStudents();
        showToast(`${session.session_name} is now closed.`, "success");
    } catch (error) {
        showToast(error.message || "Unable to close the academic year.", "error");
    }
}

async function activateAcademicYear(sessionId) {
    const session = sessions.find(item => Number(item.id) === Number(sessionId));
    if (!session) return;

    const verified = await requireAdminPasswordForAction({
        title: "Set Active Academic Year",
        message: `Set ${session.session_name} as the active academic year? The currently active year will be closed automatically.`,
        actionLabel: "Set Active"
    });
    if (!verified) return;

    if (!confirm(`Set ${session.session_name} as the active academic year?`)) return;

    try {
        const { error } = await supabaseClient.rpc("activate_academic_session", { p_session_id: sessionId });
        if (error) throw error;
        clearAcademicSessionEditUnlocks();
        await loadSessions();
        renderAcademicYears();
        if (typeof populatePromotionSessions === "function") populatePromotionSessions();
        if (typeof loadPromotionStudents === "function") await loadPromotionStudents();
        if (typeof loadStudents === "function") await loadStudents();
        if (typeof updateDashboardCounts === "function") await updateDashboardCounts();
        showToast(`${session.session_name} is now active.`, "success");
    } catch (error) {
        showToast(error.message || "Unable to activate the academic year.", "error");
    }
}

async function moveAcademicYearToRecycleBin(sessionId) {
    const session = sessions.find(item => Number(item.id) === Number(sessionId));
    if (!session) return;

    const verified = await requireAdminPasswordForAction({
        title: "Move Academic Year to Recycle Bin",
        message: `Move ${session.session_name} to the Recycle Bin? Its connected academic records will be preserved and can be restored with the year.`,
        actionLabel: "Move to Recycle Bin"
    });
    if (!verified) return;

    if (!confirm(`Move ${session.session_name} to the Recycle Bin?`)) return;

    try {
        const { error } = await supabaseClient.rpc("move_academic_session_to_recycle_bin", { p_session_id: sessionId });
        if (error) throw error;
        clearAcademicSessionEditUnlocks();
        await loadSessions();
        renderAcademicYears();
        showToast(`${session.session_name} moved to the Recycle Bin.`, "success");
    } catch (error) {
        showToast(error.message || "Unable to move the academic year to the Recycle Bin.", "error");
    }
}

if (createAcademicYearButton) createAcademicYearButton.addEventListener("click", createOrUpdateAcademicYear);
if (cancelAcademicYearEditButton) cancelAcademicYearEditButton.addEventListener("click", resetAcademicYearForm);
if (refreshAcademicYearsButton) refreshAcademicYearsButton.addEventListener("click", async () => {
    await loadSessions();
    renderAcademicYears();
});
