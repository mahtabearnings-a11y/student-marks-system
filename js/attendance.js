/* =========================================================
   MONTHLY ATTENDANCE MODULE
========================================================= */
const attendanceMonthNames = [
    "April","May","June","July","August","September",
    "October","November","December","January","February","March"
];

function attendanceClassName(n) {
    return className(Number(n));
}

function getAttendanceSnapshot() {
    if (!attendanceSession || !attendanceClass) return null;

    const values = [];
    attendanceStudents.forEach(record => {
        attendanceSelectedMonths.forEach(monthNo => {
            const row = attendanceData[`${record.id}_${monthNo}`] || {};
            values.push([
                Number(record.id),
                Number(monthNo),
                row.working_days === undefined ? null : Number(row.working_days),
                row.present_days === undefined ? null : Number(row.present_days)
            ]);
        });
    });

    return JSON.stringify({
        session: String(attendanceSession.value || ""),
        classNo: Number(attendanceClass.value || 0),
        months: [...attendanceSelectedMonths].sort((a, b) => a - b),
        values
    });
}

function captureAttendanceSavedSnapshot() {
    attendanceSavedSnapshot = getAttendanceSnapshot();
}

function hasUnsavedAttendanceChanges() {
    if (currentRole !== "admin" || attendanceSavedSnapshot === null) return false;
    return getAttendanceSnapshot() !== attendanceSavedSnapshot;
}

function populateAttendanceSessions() {
    if (!attendanceSession) return;
    attendanceSession.innerHTML = sessions.length
        ? sessions.map(s => `<option value="${escapeHtml(String(s.id))}">${escapeHtml(s.session_name)}</option>`).join("")
        : `<option value="">No sessions</option>`;
    const active = sessions.find(s => s.is_active);
    if (active) attendanceSession.value = String(active.id);
}

function renderAttendanceMonthButtons() {
    if (!attendanceMonths) return;
    attendanceMonths.innerHTML = attendanceMonthNames.map((month, i) => `
        <button type="button" class="attendance-month-btn ${attendanceSelectedMonths.includes(i + 1) ? "selected" : ""}" data-att-month="${i + 1}">${month}</button>
    `).join("");
    attendanceMonths.querySelectorAll("[data-att-month]").forEach(btn => {
        btn.addEventListener("click", () => {
            const monthNo = Number(btn.dataset.attMonth);
            const previousMonths = [...attendanceSelectedMonths];
            const nextMonths = attendanceSelectedMonths.includes(monthNo)
                ? attendanceSelectedMonths.filter(x => x !== monthNo)
                : [...attendanceSelectedMonths, monthNo].sort((a, b) => a - b);

            protectUnsavedChanges("attendance", async () => {
                attendanceSelectedMonths = nextMonths;
                renderAttendanceMonthButtons();
                await resetAttendanceGridForSelectionChange();
            }).then(proceeded => {
                if (!proceeded) {
                    attendanceSelectedMonths = previousMonths;
                    renderAttendanceMonthButtons();
                }
            });
        });
    });
    if (attendanceSelectedLabel) {
        const names = attendanceSelectedMonths.map(n => attendanceMonthNames[n - 1]);
        attendanceSelectedLabel.textContent = names.length ? `Selected: ${names.join(", ")}` : "No months selected.";
    }
}

async function resetAttendanceGridForSelectionChange() {
    attendanceStudents = []; attendanceData = {};
    if (attendanceRecordCount) attendanceRecordCount.textContent = attendanceSelectedMonths.length ? "Loading attendance..." : "Select month(s) to continue.";
    if (!attendanceSelectedMonths.length) {
        if(attendanceTableContainer) attendanceTableContainer.innerHTML=`<div class="empty-state">Select month(s) to continue.</div>`;
        captureAttendanceSavedSnapshot();
        return;
    }
    await loadAttendanceGrid();
}

function getAttendanceSortedStudents() {
    const list = [...attendanceStudents];
    const mode = attendanceSort?.value || "roll_asc";
    return list.sort((a, b) => {
        if (mode === "roll_asc") return Number(a.roll_no ?? 999999) - Number(b.roll_no ?? 999999) || String(a.students?.student_name || "").localeCompare(String(b.students?.student_name || ""));
        if (mode === "roll_desc") return Number(b.roll_no ?? -1) - Number(a.roll_no ?? -1) || String(a.students?.student_name || "").localeCompare(String(b.students?.student_name || ""));
        if (mode === "name_asc") return String(a.students?.student_name || "").localeCompare(String(b.students?.student_name || ""), undefined, { sensitivity: "base" }) || Number(a.roll_no ?? 999999) - Number(b.roll_no ?? 999999);
        if (mode === "name_desc") return String(b.students?.student_name || "").localeCompare(String(a.students?.student_name || ""), undefined, { sensitivity: "base" }) || Number(a.roll_no ?? 999999) - Number(b.roll_no ?? 999999);
        const aa = getAttendanceStudentTotals(a.id).pct, bb = getAttendanceStudentTotals(b.id).pct;
        if (mode === "attendance_desc") return bb - aa || Number(a.roll_no ?? 999999) - Number(b.roll_no ?? 999999);
        if (mode === "attendance_asc") return aa - bb || Number(a.roll_no ?? 999999) - Number(b.roll_no ?? 999999);
        return Number(a.roll_no ?? 999999) - Number(b.roll_no ?? 999999);
    });
}

function getAttendanceStudentTotals(recordId) {
    let working = 0;
    let present = 0;
    attendanceSelectedMonths.forEach(monthNo => {
        const row = attendanceData[`${recordId}_${monthNo}`] || {};
        working += Math.max(0, Number(row.working_days || 0));
        present += Math.max(0, Number(row.present_days || 0));
    });
    present = Math.min(present, working);
    const absent = Math.max(0, working - present);
    const hasAny = attendanceSelectedMonths.some(monthNo => { const row=attendanceData[`${recordId}_${monthNo}`]||{}; return row.working_days!==undefined || row.present_days!==undefined; });
    const pct = working ? (present / working) * 100 : null;
    return { working, present, absent, pct, hasAny };
}

function attendanceMaxDays(monthNo) {
    const sessionName = attendanceSession?.options[attendanceSession.selectedIndex]?.text || "2026–27";
    const m = String(sessionName).match(/(\d{4})/);
    const startYear = m ? Number(m[1]) : new Date().getFullYear();
    // Attendance session runs April–March. Convert the academic month number
    // to the real calendar month and calculate its exact number of days.
    const calendarMonth = monthNo <= 9 ? monthNo + 3 : monthNo - 9;
    const year = monthNo <= 9 ? startYear : startYear + 1;
    return new Date(year, calendarMonth, 0).getDate();
}

function setAttendanceInputLimits() {
    attendanceTableContainer?.querySelectorAll('input[data-att-rec][data-att-field="working"]').forEach(input => {
        const monthNo = Number(input.dataset.attMonth);
        input.max = String(attendanceMaxDays(monthNo));
        input.title = `Maximum ${attendanceMaxDays(monthNo)} working days for ${attendanceMonthNames[monthNo - 1]}.`;
    });
    attendanceTableContainer?.querySelectorAll('input[data-att-rec][data-att-field="present"]').forEach(input => {
        const monthNo = Number(input.dataset.attMonth);
        const rec = Number(input.dataset.attRec);
        const working = attendanceData[`${rec}_${monthNo}`]?.working_days;
        input.max = working === undefined ? "0" : String(working);
        input.title = working === undefined
            ? "Enter Working Days first."
            : `Present Days cannot exceed ${working} working days.`;
    });
}

function updateAttendanceCell(recordId, monthNo, field, value) {
    const key = `${recordId}_${monthNo}`;
    if (!attendanceData[key]) attendanceData[key] = {};

    const inputValue = String(value ?? "").trim();
    const dataField = field === "working" ? "working_days" : "present_days";

    if (inputValue === "") {
        delete attendanceData[key][dataField];
        updateAttendanceTotalsRow(recordId);
        setAttendanceInputLimits();
        return;
    }

    const n = Number(inputValue);
    const workingLimit = attendanceMaxDays(monthNo);
    const max = field === "working"
        ? workingLimit
        : Number(attendanceData[key].working_days);

    const invalid =
        !Number.isFinite(n) ||
        !Number.isInteger(n) ||
        n < 0 ||
        n > max ||
        (field === "present" && !Number.isFinite(max));

    if (invalid) {
        // Invalid attendance input is immediately cleared and is not kept in
        // the in-memory data, so it cannot be saved to Supabase.
        delete attendanceData[key][dataField];
        updateAttendanceTotalsRow(recordId);
        setAttendanceInputLimits();
        return;
    }

    attendanceData[key][dataField] = n;

    if (field === "working" && attendanceData[key].present_days !== undefined && attendanceData[key].present_days > n) {
        delete attendanceData[key].present_days;
        const presentInput = attendanceTableContainer?.querySelector(
            `input[data-att-rec="${recordId}"][data-att-month="${monthNo}"][data-att-field="present"]`
        );
        if (presentInput) presentInput.value = "";
    }

    updateAttendanceTotalsRow(recordId);
    setAttendanceInputLimits();
}
function updateAttendanceTotalsRow(recordId) {
    const t = getAttendanceStudentTotals(recordId);
    document.querySelector(`[data-att-total-wd="${recordId}"]`)?.replaceChildren(document.createTextNode(String(t.working)));
    document.querySelector(`[data-att-total-p="${recordId}"]`)?.replaceChildren(document.createTextNode(String(t.present)));
    document.querySelector(`[data-att-total-a="${recordId}"]`)?.replaceChildren(document.createTextNode(String(t.absent)));
    document.querySelector(`[data-att-pct="${recordId}"]`)?.replaceChildren(document.createTextNode(t.pct === null ? "" : `${t.pct.toFixed(2)}%`));
}

function renderAttendanceTable() {
    if (!attendanceTableContainer) return;
    if (!attendanceStudents.length) {
        attendanceTableContainer.innerHTML = `<div class="empty-state">No students found for the selected class and session.</div>`;
        return;
    }
    const sorted = getAttendanceSortedStudents();
    const selected = attendanceSelectedMonths;
    const headers = selected.map(monthNo => `<th>${attendanceMonthNames[monthNo - 1]}<br><small>Working Days / Present</small></th>`).join("");
    const rows = sorted.map(r => {
        const monthCells = selected.map(monthNo => {
            const row = attendanceData[`${r.id}_${monthNo}`] || {};
            return `<td><input class="attendance-input" type="number" min="0" step="1" inputmode="numeric" value="${row.working_days ?? ""}" data-att-rec="${r.id}" data-att-month="${monthNo}" data-att-field="working" aria-label="Working Days"><input class="attendance-input" type="number" min="0" step="1" inputmode="numeric" value="${row.present_days ?? ""}" data-att-rec="${r.id}" data-att-month="${monthNo}" data-att-field="present" style="margin-top:5px" aria-label="Present Days"></td>`;
        }).join("");
        const t = getAttendanceStudentTotals(r.id);
        return `<tr>
            <td>${escapeHtml(String(r.roll_no ?? ""))}</td>
            <td class="student-name-cell">${escapeHtml(r.students?.student_name || "")}</td>
            ${monthCells}
            <td data-att-total-wd="${r.id}">${t.hasAny?t.working:""}</td>
            <td data-att-total-p="${r.id}">${t.hasAny?t.present:""}</td>
            <td data-att-total-a="${r.id}">${t.hasAny?t.absent:""}</td>
            <td data-att-pct="${r.id}">${t.pct===null?"":t.pct.toFixed(2)+"%"}</td>
        </tr>`;
    }).join("");
    attendanceTableContainer.innerHTML = `<div class="attendance-grid-wrapper"><table class="attendance-table"><thead><tr><th>Roll</th><th>Student Name</th>${headers}<th>Working Days</th><th>Present</th><th>Absent</th><th>Attendance %</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    attendanceTableContainer.querySelectorAll("input[data-att-rec]").forEach(input => {
        input.addEventListener("focus", () => { if(input.value==="0") input.value=""; });
        input.addEventListener("input", () => {
            const rec=Number(input.dataset.attRec), month=Number(input.dataset.attMonth), field=input.dataset.attField;
            updateAttendanceCell(rec,month,field,input.value);
            const row=attendanceData[`${rec}_${month}`]||{};
            const stored=field==="working"?row.working_days:row.present_days;
            if(String(input.value).trim()!=="" && stored===undefined) input.value=""; else if(stored!==undefined) input.value=String(stored);
            if(field==="working" && row.present_days!==undefined && Number(row.present_days)>Number(row.working_days)) { delete row.present_days; const p=attendanceTableContainer.querySelector(`input[data-att-rec="${rec}"][data-att-month="${month}"][data-att-field="present"]`); if(p)p.value=""; }
        });
    });
    if (attendanceRecordCount) attendanceRecordCount.textContent = `${attendanceStudents.length} students • ${selected.map(n => attendanceMonthNames[n - 1]).join(", ")} • ${attendanceSort?.selectedOptions[0]?.text || "Roll Number — Low to High"}`;
    setAttendanceInputLimits();
}

async function loadAttendanceGrid() {
    if (!attendanceSession || !attendanceClass) return;
    if (!attendanceSelectedMonths.length) {
        showToast("Please select at least one month.", "error");
        return;
    }
    const sessionId = Number(attendanceSession.value);
    const classNo = Number(attendanceClass.value);
    attendanceTableContainer.innerHTML = `<div class="loading">Loading attendance...</div>`;
    const { data: records, error } = await supabaseClient
        .from("academic_records")
        .select(`id, session_id, student_profile_id, class_no, roll_no, status, students ( id, student_id, student_name )`)
        .eq("session_id", sessionId)
        .eq("class_no", classNo);
    if (error) {
        attendanceTableContainer.innerHTML = `<div class="empty-state">Unable to load students.<br><br>${escapeHtml(error.message)}</div>`;
        return;
    }
    attendanceStudents = records || [];
    attendanceData = {};
    const ids = attendanceStudents.map(r => r.id);
    if (ids.length) {
        const { data: rows, error: attendanceError } = await supabaseClient
            .from("monthly_attendance")
            .select("academic_record_id, month_no, working_days, present_days")
            .in("academic_record_id", ids);
        if (attendanceError) {
            attendanceTableContainer.innerHTML = `<div class="empty-state">Unable to load attendance.<br><br>${escapeHtml(attendanceError.message)}<br><br>Please make sure the monthly_attendance table has been created in Supabase.</div>`;
            return;
        }
        (rows || []).forEach(row => {
            attendanceData[`${row.academic_record_id}_${row.month_no}`] = {
                working_days: row.working_days === null ? undefined : Number(row.working_days),
                present_days: row.present_days === null ? undefined : Number(row.present_days)
            };
        });
    }
    renderAttendanceTable();
    captureAttendanceSavedSnapshot();
}

async function saveAttendance({ reload = true } = {}) {
    if (currentRole !== "admin") {
        showToast("View Only users cannot save attendance.", "error");
        return false;
    }
    if (!attendanceSelectedMonths.length || !attendanceStudents.length) {
        showToast("Load a class and select month(s) before saving.", "error");
        return false;
    }

    // A half-filled attendance pair is not a valid record. Refuse to leave
    // the page through Save & Leave until the row is completed or cleared.
    let invalidPartialEntry = false;
    attendanceStudents.forEach(record => {
        attendanceSelectedMonths.forEach(monthNo => {
            const row = attendanceData[`${record.id}_${monthNo}`] || {};
            const hasW = row.working_days !== undefined;
            const hasP = row.present_days !== undefined;
            if (hasW !== hasP) invalidPartialEntry = true;
        });
    });

    if (invalidPartialEntry) {
        showToast("Please enter both Working Days and Present Days, or clear both, before saving.", "error");
        return false;
    }

    attendanceSaveButton.disabled = true;
    attendanceSaveButton.textContent = "Saving...";
    const rows = [];
    attendanceStudents.forEach(record => {
        attendanceSelectedMonths.forEach(monthNo => {
            const row=attendanceData[`${record.id}_${monthNo}`]||{};
            const hasW=row.working_days!==undefined; const hasP=row.present_days!==undefined;
            if(!hasW && !hasP) return;
            rows.push({academic_record_id:record.id,month_no:monthNo,working_days:Number(row.working_days),present_days:Number(row.present_days)});
        });
    });
    const { error } = await supabaseClient
        .from("monthly_attendance")
        .upsert(rows, { onConflict: "academic_record_id,month_no" });
    attendanceSaveButton.disabled = false;
    attendanceSaveButton.textContent = "Save Attendance";
    if (error) {
        showToast("Unable to save attendance: " + error.message, "error");
        return false;
    }

    captureAttendanceSavedSnapshot();
    showToast("Attendance saved successfully.", "success");

    if (reload) {
        await loadAttendanceGrid();
    }

    return true;
}

function printAttendanceSummary() {
    if (!attendanceSelectedMonths.length || !attendanceStudents.length) {
        showToast("Load attendance and select month(s) first.", "error");
        return;
    }
    const sorted = getAttendanceSortedStudents();
    const classLabel = attendanceClassName(Number(attendanceClass.value));
    const sessionLabel = attendanceSession.options[attendanceSession.selectedIndex]?.text || "";
    const monthNames = attendanceSelectedMonths.map(n => attendanceMonthNames[n - 1]);
    const periodLabel = monthNames.join(" & ");
    const rows = sorted.map((record, index) => {
        const t = getAttendanceStudentTotals(record.id);
        const pctText = t.pct === null ? "" : `${t.pct.toFixed(2)}%`;
        return `<tr><td>${index + 1}</td><td>${escapeHtml(String(record.roll_no ?? ""))}</td><td class="subject">${escapeHtml(record.students?.student_name || "")}</td><td>${t.working}</td><td>${t.present}</td><td>${t.absent}</td><td>${pctText}</td></tr>`;
    }).join("");
    const totals = sorted.reduce((acc, record) => { const t = getAttendanceStudentTotals(record.id); acc.working += t.working; acc.present += t.present; return acc; }, {working:0,present:0});
    const overallPct = totals.working ? (totals.present / totals.working) * 100 : 0;
    const html = `<div class="result-page"><div class="result-header"><h1>U.M.S SASAULI URDU</h1><h2>Class Attendance Summary</h2><div class="small">Academic Session: ${escapeHtml(sessionLabel)} • ${escapeHtml(classLabel)}</div><div class="small">${escapeHtml(periodLabel)}</div></div><table class="result-table attendance-print-table"><thead><tr><th>Sl.</th><th>Roll</th><th>Student Name</th><th>Working Days</th><th>Present</th><th>Absent</th><th>Attendance %</th></tr></thead><tbody>${rows}</tbody></table><div class="result-summary"><b>Total Students:</b> ${sorted.length} &nbsp;&nbsp; <b>Working Days:</b> ${totals.working} &nbsp;&nbsp; <b>Present:</b> ${totals.present} &nbsp;&nbsp; <b>Absent:</b> ${totals.working - totals.present} &nbsp;&nbsp; <b>Attendance:</b> ${overallPct.toFixed(2)}%</div></div>`;
    openPrint(html, `${classLabel} ${periodLabel} Attendance Summary`);
}

function resetAttendanceState() {
    const active = sessions.find(s => s.is_active);
    if (attendanceSession && active) attendanceSession.value = String(active.id);
    if (attendanceClass) attendanceClass.value = "1";
    if (attendanceSort) attendanceSort.value = "roll_asc";
    attendanceSelectedMonths = [];
    attendanceStudents = [];
    attendanceData = {};
    attendanceSavedSnapshot = null;
    renderAttendanceMonthButtons();
    if (attendanceRecordCount) attendanceRecordCount.textContent = "Select session, class and month(s).";
    if (attendanceTableContainer) attendanceTableContainer.innerHTML = `<div class="empty-state">Select session, class and month(s) to load attendance.</div>`;
}

async function handleAttendanceContextChange(control, previousValue, loader) {
    const nextValue = control.value;
    const restoreValue = previousValue ?? nextValue;
    control.value = restoreValue;

    const proceeded = await protectUnsavedChanges("attendance", async () => {
        control.value = nextValue;
        await loader();
    });

    if (!proceeded) {
        control.value = restoreValue;
    }
}

if (attendanceSelectAll) attendanceSelectAll.addEventListener("click", function () {
    const previousMonths = [...attendanceSelectedMonths];
    const nextMonths = attendanceMonthNames.map((_, i) => i + 1);

    protectUnsavedChanges("attendance", async () => {
        attendanceSelectedMonths = nextMonths;
        renderAttendanceMonthButtons();
        await resetAttendanceGridForSelectionChange();
    }).then(proceeded => {
        if (!proceeded) {
            attendanceSelectedMonths = previousMonths;
            renderAttendanceMonthButtons();
        }
    });
});

if (attendanceClearMonths) attendanceClearMonths.addEventListener("click", function () {
    const previousMonths = [...attendanceSelectedMonths];

    protectUnsavedChanges("attendance", async () => {
        attendanceSelectedMonths = [];
        renderAttendanceMonthButtons();
        await resetAttendanceGridForSelectionChange();
    }).then(proceeded => {
        if (!proceeded) {
            attendanceSelectedMonths = previousMonths;
            renderAttendanceMonthButtons();
        }
    });
});

if (attendanceSaveButton) attendanceSaveButton.addEventListener("click", () => saveAttendance());
if (attendanceSession) attendanceSession.addEventListener("change", function () {
    const previous = attendanceSavedSnapshot ? JSON.parse(attendanceSavedSnapshot).session : this.value;
    handleAttendanceContextChange(this, previous, resetAttendanceGridForSelectionChange);
});
if (attendanceClass) attendanceClass.addEventListener("change", function () {
    const previous = attendanceSavedSnapshot ? JSON.parse(attendanceSavedSnapshot).classNo : Number(this.value);
    handleAttendanceContextChange(this, String(previous), resetAttendanceGridForSelectionChange);
});
if (attendanceSort) attendanceSort.addEventListener("change", renderAttendanceTable);
if (attendancePrintButton) attendancePrintButton.addEventListener("click", printAttendanceSummary);
