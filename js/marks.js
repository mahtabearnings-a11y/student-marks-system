/* =========================================================
   MARKS MODULE
========================================================= */

const marksSession = document.getElementById("marksSession");
const marksClass = document.getElementById("marksClass");
const marksExam = document.getElementById("marksExam");
const marksSort = document.getElementById("marksSort");
const marksTableContainer = document.getElementById("marksTableContainer");
const marksRecordCount = document.getElementById("marksRecordCount");
const saveMarksButton = document.getElementById("saveMarksButton");

function gradeFromPercentage(pct) {
    if (pct === null || Number.isNaN(pct)) return "";
    if (pct >= 80.5) return "A";
    if (pct >= 60.5) return "B";
    if (pct >= 40.5) return "C";
    if (pct >= 32.5) return "D";
    return "E";
}

function populateMarksSessions() {
    if (!marksSession) return;
    marksSession.innerHTML = sessions.length
        ? sessions.map(s => `<option value="${escapeHtml(String(s.id))}">${escapeHtml(s.session_name)}</option>`).join("")
        : `<option value="">No sessions</option>`;
    const active = sessions.find(s => s.is_active);
    if (active) marksSession.value = String(active.id);
    else if (sessionFilter && sessionFilter.value) marksSession.value = sessionFilter.value;
}

async function loadMarksGrid() {
    if (!marksSession || !marksClass || !marksExam) return;
    const sessionId = marksSession.value;
    const classNo = Number(marksClass.value);
    const exam = marksExam.value;

    if (!sessionId) {
        marksTableContainer.innerHTML = `<div class="empty-state">No academic session is available.</div>`;
        marksRecordCount.textContent = "No session selected.";
        return;
    }

    marksLoading = true;
    marksTableContainer.innerHTML = `<div class="loading">Loading marks...</div>`;

    const { data: subjects, error: subjectError } = await supabaseClient
        .from("subjects")
        .select("id, subject_name, subject_code, display_order")
        .eq("class_no", classNo)
        .order("display_order", { ascending: true });

    if (subjectError) {
        marksTableContainer.innerHTML = `<div class="empty-state">Unable to load subjects.<br><br>${escapeHtml(subjectError.message)}</div>`;
        marksLoading = false;
        return;
    }

    marksSubjects = subjects || [];

    const { data: records, error: recordError } = await supabaseClient
        .from("academic_records")
        .select(`
            id, session_id, student_profile_id, class_no, roll_no, status,
            students ( id, student_id, apaar_id, student_name, father_name, mother_name, date_of_birth, gender )
        `)
        .eq("session_id", sessionId)
        .eq("class_no", classNo)
        .order("roll_no", { ascending: true });

    if (recordError) {
        marksTableContainer.innerHTML = `<div class="empty-state">Unable to load students.<br><br>${escapeHtml(recordError.message)}</div>`;
        marksLoading = false;
        return;
    }

    marksRecords = records || [];
    marksValues = {};

    const recordIds = marksRecords.map(r => r.id);
    if (recordIds.length && marksSubjects.length) {
        const { data: markRows, error: marksError } = await supabaseClient
            .from("exam_marks")
            .select("academic_record_id, subject_id, examination, marks, full_marks")
            .in("academic_record_id", recordIds)
            .in("subject_id", marksSubjects.map(s => s.id));

        if (marksError) {
            marksTableContainer.innerHTML = `<div class="empty-state">Unable to load saved marks.<br><br>${escapeHtml(marksError.message)}</div>`;
            marksLoading = false;
            return;
        }

        (markRows || []).forEach(m => {
            marksValues[`${m.academic_record_id}_${m.subject_id}_${m.examination}`] = m.marks;
        });
    }

    syncPrintDataFromMarks();
    renderMarksGrid();
    captureMarksSavedSnapshot();
    marksLoading = false;
}

function getMark(recordId, subjectId, exam) {
    const key = `${recordId}_${subjectId}_${exam}`;
    const value = marksValues[key];
    return value === null || value === undefined ? "" : value;
}

function setMark(recordId, subjectId, exam, value) {
    const key = `${recordId}_${subjectId}_${exam}`;
    marksValues[key] = value === "" ? null : Number(value);
}


function getMarksSnapshot() {
    if (!marksSession || !marksClass || !marksExam) return null;

    const exam = marksExam.value || "";
    const values = [];

    marksRecords.forEach(record => {
        marksSubjects.forEach(subject => {
            const key = `${record.id}_${subject.id}_${exam}`;
            const raw = marksValues[key];
            const value = raw === undefined || raw === null || raw === "" ? null : Number(raw);

            // Empty cells are one canonical state. Do not let a temporary
            // input/edit history make an otherwise identical state dirty.
            if (value === null || Number.isNaN(value)) return;

            values.push([Number(record.id), Number(subject.id), value]);
        });
    });

    values.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    return JSON.stringify({
        session: String(marksSession.value || ""),
        classNo: Number(marksClass.value || 0),
        exam,
        values
    });
}

function captureMarksSavedSnapshot() {
    marksSavedSnapshot = getMarksSnapshot();
}

function hasUnsavedMarksChanges() {
    if (currentRole !== "admin" || marksSavedSnapshot === null) return false;
    return getMarksSnapshot() !== marksSavedSnapshot;
}

function calculateRow(recordId) {
    let total = 0;
    let entered = 0;
    const finalExam = marksExam.value === "Final";

    marksSubjects.forEach(subject => {
        let value = null;
        if (finalExam) {
            const half = marksValues[`${recordId}_${subject.id}_Half-Yearly`];
            const annual = marksValues[`${recordId}_${subject.id}_Annual`];
            if (half !== null && half !== undefined && half !== "") value = Number(half);
            if (annual !== null && annual !== undefined && annual !== "") value = (value || 0) + Number(annual);
            if ((half !== null && half !== undefined && half !== "") || (annual !== null && annual !== undefined && annual !== "")) entered++;
        } else {
            value = marksValues[`${recordId}_${subject.id}_${marksExam.value}`];
            if (value !== null && value !== undefined && value !== "") entered++;
        }
        if (value !== null && value !== undefined && value !== "") total += Number(value);
    });

    const max = marksSubjects.length * (finalExam ? 100 : 50);
    const pct = max ? (total / max) * 100 : 0;
    return { total, pct, grade: entered ? gradeFromPercentage(pct) : "", max };
}

function getMarksSortedRecords() {
    const list = [...marksRecords];
    const mode = marksSort?.value || "roll_asc";
    return list.sort((a, b) => {
        const rollA = Number(a.roll_no ?? 999999);
        const rollB = Number(b.roll_no ?? 999999);
        const nameA = String(a.students?.student_name || "");
        const nameB = String(b.students?.student_name || "");
        if (mode === "roll_desc") return rollB - rollA || nameA.localeCompare(nameB, undefined, {sensitivity:"base"});
        if (mode === "name_asc") return nameA.localeCompare(nameB, undefined, {sensitivity:"base"}) || rollA - rollB;
        if (mode === "name_desc") return nameB.localeCompare(nameA, undefined, {sensitivity:"base"}) || rollA - rollB;
        if (mode === "marks_desc" || mode === "marks_asc") {
            const totalA = calculateRow(a.id).total;
            const totalB = calculateRow(b.id).total;
            return mode === "marks_desc" ? (totalB - totalA || rollA - rollB) : (totalA - totalB || rollA - rollB);
        }
        return rollA - rollB || nameA.localeCompare(nameB, undefined, {sensitivity:"base"});
    });
}

function renderMarksGrid() {
    if (!marksRecords.length) {
        marksRecordCount.textContent = "0 students";
        marksTableContainer.innerHTML = `<div class="empty-state">No students found for ${escapeHtml(className(Number(marksClass.value)))} in the selected session.</div>`;
        setupFrozenTableHeader(marksTableContainer);
        return;
    }

    if (!marksSubjects.length) {
        marksRecordCount.textContent = `${marksRecords.length} students`;
        marksTableContainer.innerHTML = `<div class="empty-state">No subjects are configured for this class.</div>`;
        setupFrozenTableHeader(marksTableContainer);
        return;
    }

    const finalExam = marksExam.value === "Final";
    const maxPerSubject = finalExam ? 100 : 50;
    marksRecordCount.textContent = `${marksRecords.length} students • ${marksSubjects.length} subjects • ${marksExam.value} • ${marksSort?.selectedOptions[0]?.text || "Roll Number — Low to High"}`;

    const head = marksSubjects.map(s => `<th>${escapeHtml(s.subject_name)}<br><small>/ ${maxPerSubject}</small></th>`).join("");
    const sortedMarksRecords = getMarksSortedRecords();
    const rows = sortedMarksRecords.map((record, index) => {
        const calc = calculateRow(record.id);
        const cells = marksSubjects.map(subject => {
            if (finalExam) {
                const half = getMark(record.id, subject.id, "Half-Yearly");
                const annual = getMark(record.id, subject.id, "Annual");
                const value = (half === "" && annual === "") ? "" : Number(half || 0) + Number(annual || 0);
                return `<td class="marks-calculated">${value === "" ? "" : value}</td>`;
            }
            const value = getMark(record.id, subject.id, marksExam.value);
            const disabled = currentRole !== "admin" ? "disabled" : "";
            return `<td><input class="marks-input" type="text" inputmode="numeric" autocomplete="off" pattern="\d*" maxlength="2" value="${value === "" ? "" : escapeHtml(String(value))}" data-record="${record.id}" data-subject="${subject.id}" ${disabled}></td>`;
        }).join("");
        return `<tr><td class="sticky-roll">${escapeHtml(String(record.roll_no ?? ""))}</td><td class="sticky-name">${escapeHtml(record.students?.student_name || "")}</td>${cells}<td class="marks-calculated" data-total="${record.id}">${calc.total || (calc.total === 0 && calc.entered) ? calc.total : ""}</td><td class="marks-calculated" data-pct="${record.id}">${calc.total ? calc.pct.toFixed(2) + "%" : ""}</td><td class="marks-calculated marks-grade" data-grade="${record.id}">${escapeHtml(calc.grade)}</td></tr>`;
    }).join("");

    marksTableContainer.innerHTML = `<table class="marks-table"><thead><tr><th class="sticky-roll">Roll</th><th class="sticky-name">Student Name</th>${head}<th>Total</th><th>Percentage</th><th>Grade</th></tr></thead><tbody>${rows}</tbody></table>`;

    setupFrozenTableHeader(marksTableContainer);

    marksTableContainer.querySelectorAll(".marks-input").forEach(input => {
        input.addEventListener("input", () => {
            let value = input.value.trim();
            if (value !== "") {
                let n = Number(value);
                if (!Number.isFinite(n)) { input.value = ""; return; }
                if (n > 50) { input.value = ""; showToast("Marks cannot be more than 50.", "error"); setMark(Number(input.dataset.record), Number(input.dataset.subject), marksExam.value, null); return; }
                if (n < 0) { input.value = ""; showToast("Marks cannot be less than 0.", "error"); setMark(Number(input.dataset.record), Number(input.dataset.subject), marksExam.value, null); return; }
                n = Math.round(n);
                input.value = n;
                setMark(Number(input.dataset.record), Number(input.dataset.subject), marksExam.value, n);
            } else {
                setMark(Number(input.dataset.record), Number(input.dataset.subject), marksExam.value, null);
            }
            const calc = calculateRow(Number(input.dataset.record));
            const total = marksTableContainer.querySelector(`[data-total="${input.dataset.record}"]`);
            const pct = marksTableContainer.querySelector(`[data-pct="${input.dataset.record}"]`);
            const grade = marksTableContainer.querySelector(`[data-grade="${input.dataset.record}"]`);
            total.textContent = calc.total || calc.total === 0 ? calc.total : "";
            pct.textContent = calc.total ? calc.pct.toFixed(2) + "%" : "";
            grade.textContent = calc.grade;
        });
    });
}

async function saveMarks({ reload = true } = {}) {
    if (currentRole !== "admin") {
        showToast("View Only users cannot save marks.", "error");
        return false;
    }
    if (marksExam.value === "Final") {
        showToast("Final marks are calculated from Half-Yearly and Annual marks and are not entered separately.", "info");
        return false;
    }
    if (!marksRecords.length || !marksSubjects.length) {
        showToast("Load a class before saving marks.", "error");
        return false;
    }

    saveMarksButton.disabled = true;
    saveMarksButton.textContent = "Saving...";

    const rows = [];
    marksRecords.forEach(record => {
        marksSubjects.forEach(subject => {
            const value = marksValues[`${record.id}_${subject.id}_${marksExam.value}`];
            if (value !== undefined) {
                rows.push({
                    academic_record_id: record.id,
                    subject_id: subject.id,
                    examination: marksExam.value,
                    marks: value === null || value === "" ? null : Number(value),
                    full_marks: 50
                });
            }
        });
    });

    const { error } = await supabaseClient
        .from("exam_marks")
        .upsert(rows, { onConflict: "academic_record_id,subject_id,examination" });

    saveMarksButton.disabled = false;
    saveMarksButton.textContent = "Save All Marks";

    if (error) {
        console.error(error);
        showToast("Unable to save marks: " + error.message, "error");
        return false;
    }

    captureMarksSavedSnapshot();
    showToast("Marks saved successfully.", "success");

    if (reload) {
        await loadMarksGrid();
    }

    return true;
}

async function handleMarksContextChange(control, previousValue) {
    const nextValue = control.value;
    const restoreValue = previousValue ?? nextValue;

    // Put the control back to the currently loaded grid while the dialog/save
    // operation is being handled. This guarantees Save & Leave saves the data
    // that is actually on screen rather than the newly selected context.
    control.value = restoreValue;

    const proceeded = await protectUnsavedChanges("marks", async () => {
        control.value = nextValue;
        await loadMarksGrid();
    });

    if (!proceeded) {
        control.value = restoreValue;
    }
}

if (marksSession) marksSession.addEventListener("change", function () {
    const previous = marksSavedSnapshot ? JSON.parse(marksSavedSnapshot).session : this.value;
    handleMarksContextChange(this, previous);
});
if (marksClass) marksClass.addEventListener("change", function () {
    const previous = marksSavedSnapshot ? JSON.parse(marksSavedSnapshot).classNo : Number(this.value);
    handleMarksContextChange(this, String(previous));
});
if (marksExam) marksExam.addEventListener("change", function () {
    const previous = marksSavedSnapshot ? JSON.parse(marksSavedSnapshot).exam : this.value;
    handleMarksContextChange(this, previous);
});
if (marksSort) marksSort.addEventListener("change", () => { renderMarksGrid(); filterPrintStudents(); });
if (saveMarksButton) saveMarksButton.addEventListener("click", () => saveMarks());

