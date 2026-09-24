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
    // Keep an empty/deleted mark as null. Do not use Number(null),
    // because JavaScript converts null to 0 and that would create
    // a false mark/calculation change after the user deletes a value.
    marksValues[key] = value === "" || value === null || value === undefined
        ? null
        : Number(value);
}


function getMarksSnapshot() {
    if (!marksSession || !marksClass || !marksExam) return null;

    const exam = marksExam.value || "";
    const values = [];

    marksRecords.forEach(record => {
        marksSubjects.forEach(subject => {
            const key = `${record.id}_${subject.id}_${exam}`;
            const value = marksValues[key];
            values.push([
                Number(record.id),
                Number(subject.id),
                value === undefined || value === null || value === "" ? null : Number(value)
            ]);
        });
    });

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
        if (finalExam) {
            const halfRaw = marksValues[`${recordId}_${subject.id}_Half-Yearly`];
            const annualRaw = marksValues[`${recordId}_${subject.id}_Annual`];
            const half = halfRaw === null || halfRaw === undefined || halfRaw === "" ? null : Number(halfRaw);
            const annual = annualRaw === null || annualRaw === undefined || annualRaw === "" ? null : Number(annualRaw);

            if (half !== null || annual !== null) {
                entered++;
                total += (Number.isFinite(half) ? half : 0) + (Number.isFinite(annual) ? annual : 0);
            }
        } else {
            const raw = marksValues[`${recordId}_${subject.id}_${marksExam.value}`];
            if (raw !== null && raw !== undefined && raw !== "") {
                const value = Number(raw);
                if (Number.isFinite(value)) {
                    entered++;
                    total += value;
                }
            }
        }
    });

    const max = marksSubjects.length * (finalExam ? 100 : 50);
    const pct = max > 0 ? (total / max) * 100 : 0;
    return { total, pct, grade: entered > 0 ? gradeFromPercentage(pct) : "", max, entered };
}

function updateMarksCalculatedRow(recordId) {
    const calc = calculateRow(Number(recordId));
    const total = marksTableContainer.querySelector(`[data-total="${recordId}"]`);
    const pct = marksTableContainer.querySelector(`[data-pct="${recordId}"]`);
    const grade = marksTableContainer.querySelector(`[data-grade="${recordId}"]`);

    if (!total || !pct || !grade) return;

    if (calc.entered > 0) {
        total.textContent = String(calc.total);
        pct.textContent = `${calc.pct.toFixed(2)}%`;
        grade.textContent = calc.grade;
    } else {
        total.textContent = "";
        pct.textContent = "";
        grade.textContent = "";
    }
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
            return `<td><input class="marks-input" type="text" inputmode="numeric" autocomplete="off" maxlength="2" value="${value === "" ? "" : escapeHtml(String(value))}" data-record="${record.id}" data-subject="${subject.id}" ${disabled}></td>`;
        }).join("");
        return `<tr><td class="sticky-roll">${escapeHtml(String(record.roll_no ?? ""))}</td><td class="sticky-name">${escapeHtml(record.students?.student_name || "")}</td>${cells}<td class="marks-calculated" data-total="${record.id}">${calc.entered > 0 ? calc.total : ""}</td><td class="marks-calculated" data-pct="${record.id}">${calc.entered > 0 ? calc.pct.toFixed(2) + "%" : ""}</td><td class="marks-calculated marks-grade" data-grade="${record.id}">${calc.entered > 0 ? escapeHtml(calc.grade) : ""}</td></tr>`;
    }).join("");

    marksTableContainer.innerHTML = `<table class="marks-table"><thead><tr><th class="sticky-roll">Roll</th><th class="sticky-name">Student Name</th>${head}<th>Total</th><th>Percentage</th><th>Grade</th></tr></thead><tbody>${rows}</tbody></table>`;

    setupFrozenTableHeader(marksTableContainer);

    marksTableContainer.querySelectorAll(".marks-input").forEach(input => {
        input.addEventListener("input", () => {
            const recordId = Number(input.dataset.record);
            const subjectId = Number(input.dataset.subject);
            const exam = marksExam.value;
            let value = input.value.trim().replace(/\D/g, "");

            if (value === "") {
                input.value = "";
                setMark(recordId, subjectId, exam, null);
                updateMarksCalculatedRow(recordId);
                return;
            }

            let n = Number(value);
            if (!Number.isFinite(n)) {
                input.value = "";
                setMark(recordId, subjectId, exam, null);
                updateMarksCalculatedRow(recordId);
                return;
            }

            if (n > 50) {
                input.value = "";
                setMark(recordId, subjectId, exam, null);
                showToast("Marks cannot be more than 50.", "error");
                updateMarksCalculatedRow(recordId);
                return;
            }

            n = Math.round(n);
            input.value = String(n);
            setMark(recordId, subjectId, exam, n);
            updateMarksCalculatedRow(recordId);
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

