/* =========================================================
   MONTHLY ATTENDANCE MODULE
   Working Days are stored once per academic session/month.
========================================================= */
const attendanceMonthNames = [
    "April","May","June","July","August","September",
    "October","November","December","January","February","March"
];

// Unsaved-state tracking is limited to editable Present Days cells.
// Working Days are intentionally excluded from the navigation warning.
const attendanceOriginallyBlankCells = new Set();
const attendanceTouchedBlankCells = new Set();
let attendanceToastTimer = null;
let attendanceCommittedContext = { session: null, classNo: null };

function attendanceCellKey(recordId, monthNo) {
    return `${recordId}_${monthNo}`;
}

function getAttendanceTableSnapshot() {
    const values = [];
    const months = [...attendanceSelectedMonths].sort((a, b) => a - b);
    const records = [...attendanceStudents].sort((a, b) => Number(a.id) - Number(b.id));

    records.forEach(record => {
        months.forEach(monthNo => {
            const value = attendanceData[attendanceCellKey(record.id, monthNo)]?.present_days;
            values.push([
                Number(record.id),
                Number(monthNo),
                value === undefined || value === null || value === "" ? null : Number(value)
            ]);
        });
    });

    return JSON.stringify(values);
}

function captureAttendanceSavedSnapshot() {
    attendanceSavedSnapshot = getAttendanceTableSnapshot();
    attendanceOriginallyBlankCells.clear();
    attendanceTouchedBlankCells.clear();

    attendanceStudents.forEach(record => {
        attendanceSelectedMonths.forEach(monthNo => {
            const key = attendanceCellKey(record.id, monthNo);
            const value = attendanceData[key]?.present_days;
            if (value === undefined || value === null || value === "") {
                attendanceOriginallyBlankCells.add(key);
            }
        });
    });
}

function hasUnsavedAttendanceChanges() {
    if (currentRole !== "admin" || attendanceSavedSnapshot === null) return false;
    if (getAttendanceTableSnapshot() !== attendanceSavedSnapshot) return true;

    // For an originally blank cell, any completed edit remains an unsaved
    // change even when the value is cleared back to blank. For an originally
    // populated cell, returning to its original value clears the dirty state.
    return attendanceTouchedBlankCells.size > 0;
}

function attendanceShowToast(message, type = "") {
    const target = document.getElementById("toast");
    if (!target) {
        if (typeof showToast === "function") showToast(message, type);
        return;
    }

    if (attendanceToastTimer) clearTimeout(attendanceToastTimer);
    target.textContent = message;
    target.className = "toast";
    if (type) target.classList.add(type);
    target.classList.remove("hidden");

    attendanceToastTimer = setTimeout(() => {
        target.classList.add("hidden");
        attendanceToastTimer = null;
    }, 8000);
}

function attendanceClassName(n) {
    return className(Number(n));
}

function populateAttendanceSessions() {
    if (!attendanceSession) return;
    const ordered = [...sessions].sort((a, b) => (typeof academicYearStartNumber === "function" ? academicYearStartNumber(a.session_name) : Number(String(a.session_name).slice(0, 4))) - (typeof academicYearStartNumber === "function" ? academicYearStartNumber(b.session_name) : Number(String(b.session_name).slice(0, 4))) || Number(a.id) - Number(b.id));
    attendanceSession.innerHTML = `<option value="">Please Select</option>` + ordered.map(s => `<option value="${escapeHtml(String(s.id))}">${escapeHtml(s.session_name)}</option>`).join("");
    const active = sessions.find(s => s.is_active);
    attendanceSession.value = active ? String(active.id) : "";
}

function renderAttendanceMonthButtons() {
    if (!attendanceMonths) return;
    attendanceMonths.innerHTML = attendanceMonthNames.map((month, i) => `
        <button type="button" class="attendance-month-btn ${attendanceSelectedMonths.includes(i + 1) ? "selected" : ""}" data-att-month="${i + 1}">${month}</button>
    `).join("");
    attendanceMonths.querySelectorAll("[data-att-month]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const monthNo = Number(btn.dataset.attMonth);
            const nextMonths = attendanceSelectedMonths.includes(monthNo)
                ? attendanceSelectedMonths.filter(x => x !== monthNo)
                : [...attendanceSelectedMonths, monthNo].sort((a, b) => a - b);

            const proceeded = await protectUnsavedChanges("attendance", async () => {
                attendanceSelectedMonths = nextMonths;
                renderAttendanceMonthButtons();
                await resetAttendanceGridForSelectionChange();
            });

            if (!proceeded) renderAttendanceMonthButtons();
        });
    });
    if (attendanceSelectedLabel) {
        const names = attendanceSelectedMonths.map(n => attendanceMonthNames[n - 1]);
        attendanceSelectedLabel.textContent = names.length ? `Selected: ${names.join(", ")}` : "No months selected.";
    }
    renderAttendanceWorkingDaysInputs();
}

function renderAttendanceWorkingDaysInputs() {
    if (!attendanceWorkingDaysContainer) return;
    if (!attendanceSelectedMonths.length) {
        attendanceWorkingDaysContainer.innerHTML = `<div class="attendance-working-days-empty">Select month(s) above to enter Working Days once per month. Use Save Attendance to save changes.</div>`;
        return;
    }
    attendanceWorkingDaysContainer.innerHTML = attendanceSelectedMonths.map(monthNo => `
        <div class="attendance-working-day-item">
            <label for="attendanceWorkingDay_${monthNo}">${attendanceMonthNames[monthNo - 1]}</label>
            <input id="attendanceWorkingDay_${monthNo}" class="attendance-working-day-input" type="text" inputmode="numeric" autocomplete="off" pattern="\\d*" maxlength="2" value="${attendanceWorkingDays[monthNo] ?? ""}" data-working-month="${monthNo}" aria-label="Working Days for ${attendanceMonthNames[monthNo - 1]}">
        </div>
    `).join("");
    attendanceWorkingDaysContainer.querySelectorAll("input[data-working-month]").forEach(input => {
        const monthNo = Number(input.dataset.workingMonth);
        input.max = String(attendanceMaxDays(monthNo));
        input.title = `Maximum ${attendanceMaxDays(monthNo)} working days for ${attendanceMonthNames[monthNo - 1]}. Changes are saved with Save Attendance.`;
        input.addEventListener("input", async () => {
            if (isAcademicSessionClosed(attendanceSession.value) && !hasAcademicSessionEditUnlock(attendanceSession.value)) {
                const allowed = await ensureAcademicSessionEditable(attendanceSession.value, "edit Attendance");
                if (!allowed) {
                    input.value = attendanceWorkingDays[monthNo] === undefined ? "" : String(attendanceWorkingDays[monthNo]);
                    return;
                }
            }
            const raw = String(input.value ?? "").trim();
            if (raw === "") {
                delete attendanceWorkingDays[monthNo];
            } else {
                /* Do not validate against Present Days while typing. A user must
                   be able to change 29 -> 2 -> 21 without triggering a false
                   error. Full Working Days validation happens on Save. */
                const n = Number(raw);
                attendanceWorkingDays[monthNo] = Number.isFinite(n) ? n : raw;
            }
            setAttendanceInputLimits();
            renderAttendanceTable();
        });
    });
}
function captureAttendanceDirtyStateOnly() {
    renderAttendanceWorkingDaysInputs();
}

async function resetAttendanceGridForSelectionChange() {
    attendanceStudents = [];
    attendanceData = {};
    if (attendanceRecordCount) attendanceRecordCount.textContent = attendanceSelectedMonths.length ? "Loading attendance..." : "Select month(s) to continue.";
    renderAttendanceWorkingDaysInputs();
    if (!attendanceSelectedMonths.length) {
        if (attendanceTableContainer) attendanceTableContainer.innerHTML=`<div class="empty-state">Select month(s) to continue.</div>`;
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
        const aa = getAttendanceStudentTotals(a.id).pct ?? -1, bb = getAttendanceStudentTotals(b.id).pct ?? -1;
        if (mode === "attendance_desc") return bb - aa || Number(a.roll_no ?? 999999) - Number(b.roll_no ?? 999999);
        if (mode === "attendance_asc") return aa - bb || Number(a.roll_no ?? 999999) - Number(b.roll_no ?? 999999);
        return Number(a.roll_no ?? 999999) - Number(b.roll_no ?? 999999);
    });
}

function getAttendanceStudentTotals(recordId) {
    let working = 0;
    let present = 0;
    attendanceSelectedMonths.forEach(monthNo => {
        working += Math.max(0, Number(attendanceWorkingDays[monthNo] ?? 0));
        const row = attendanceData[`${recordId}_${monthNo}`] || {};
        present += Math.max(0, Number(row.present_days ?? 0));
    });
    present = Math.min(present, working || present);
    const absent = Math.max(0, working - present);
    const hasAny = attendanceSelectedMonths.some(monthNo => attendanceWorkingDays[monthNo] !== undefined || attendanceData[`${recordId}_${monthNo}`]?.present_days !== undefined);
    const pct = working ? (present / working) * 100 : null;
    return { working, present, absent, pct, hasAny };
}

function attendanceMaxDays(monthNo) {
    const sessionName = attendanceSession?.options[attendanceSession.selectedIndex]?.text || "2026–27";
    const m = String(sessionName).match(/(\d{4})/);
    const startYear = m ? Number(m[1]) : new Date().getFullYear();
    const calendarMonth = monthNo <= 9 ? monthNo + 3 : monthNo - 9;
    const year = monthNo <= 9 ? startYear : startYear + 1;
    return new Date(year, calendarMonth, 0).getDate();
}

function setAttendanceInputLimits() {
    attendanceTableContainer?.querySelectorAll('input[data-att-rec][data-att-field="present"]').forEach(input => {
        const monthNo = Number(input.dataset.attMonth);
        const working = attendanceWorkingDays[monthNo];
        input.max = working === undefined ? "0" : String(working);
        input.title = working === undefined
            ? "Enter Working Days above first."
            : `Present Days cannot exceed ${working} working days.`;
    });
}

function updateAttendanceCell(recordId, monthNo, value) {
    const key = `${recordId}_${monthNo}`;
    if (!attendanceData[key]) attendanceData[key] = {};
    const inputValue = String(value ?? "").trim();
    if (inputValue === "") {
        delete attendanceData[key].present_days;
        updateAttendanceTotalsRow(recordId);
        setAttendanceInputLimits();
        return;
    }
    const n = Number(inputValue);
    const working = Number(attendanceWorkingDays[monthNo]);
    const invalid = !Number.isFinite(n) || !Number.isInteger(n) || n < 0 || !Number.isFinite(working) || n > working;
    if (invalid) {
        delete attendanceData[key].present_days;
        updateAttendanceTotalsRow(recordId);
        setAttendanceInputLimits();
        return;
    }
    attendanceData[key].present_days = n;
    updateAttendanceTotalsRow(recordId);
    setAttendanceInputLimits();
}

function updateAttendanceTotalsRow(recordId) {
    const t = getAttendanceStudentTotals(recordId);
    document.querySelector(`[data-att-total-wd="${recordId}"]`)?.replaceChildren(document.createTextNode(t.hasAny?t.working:""));
    document.querySelector(`[data-att-total-p="${recordId}"]`)?.replaceChildren(document.createTextNode(t.hasAny?t.present:""));
    document.querySelector(`[data-att-total-a="${recordId}"]`)?.replaceChildren(document.createTextNode(t.hasAny?t.absent:""));
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
    const headers = selected.map(monthNo => `<th>${attendanceMonthNames[monthNo - 1]}<br><small>Present Days</small></th>`).join("");
    const rows = sorted.map(r => {
        const monthCells = selected.map(monthNo => {
            const row = attendanceData[`${r.id}_${monthNo}`] || {};
            return `<td><input class="attendance-input" type="text" inputmode="numeric" autocomplete="off" pattern="\d*" maxlength="2" value="${row.present_days ?? ""}" data-att-rec="${r.id}" data-att-month="${monthNo}" data-att-field="present" aria-label="Present Days for ${attendanceMonthNames[monthNo - 1]}"></td>`;
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
    attendanceTableContainer.querySelectorAll('input[data-att-rec][data-att-field="present"]').forEach(input => {
        input.addEventListener("focus", () => { if(input.value==="0") input.value=""; });
        input.addEventListener("input", async () => {
            const rec=Number(input.dataset.attRec), month=Number(input.dataset.attMonth);
            const rowBefore = attendanceData[`${rec}_${month}`] || {};
            const previousValue = rowBefore.present_days;
            if (isAcademicSessionClosed(attendanceSession.value) && !hasAcademicSessionEditUnlock(attendanceSession.value)) {
                const allowed = await ensureAcademicSessionEditable(attendanceSession.value, "edit Attendance");
                if (!allowed) { input.value = previousValue === undefined ? "" : String(previousValue); return; }
            }
            const raw = String(input.value ?? "").trim();
            const working = attendanceWorkingDays[month];
            if (raw !== "" && working === undefined) {
                input.value = previousValue === undefined ? "" : String(previousValue);
                attendanceShowToast(`Enter Working Days for ${attendanceMonthNames[month - 1]} first.`, "error");
                return;
            }
            updateAttendanceCell(rec, month, input.value);
            const key = attendanceCellKey(rec, month);
            if (attendanceOriginallyBlankCells.has(key)) {
                // Remember that an originally blank cell was actually edited.
                // Thus blank -> 24 -> blank remains an unsaved edit.
                attendanceTouchedBlankCells.add(key);
            }
            const stored=attendanceData[`${rec}_${month}`]?.present_days;
            if(String(input.value).trim()!=="" && stored===undefined) input.value=""; else if(stored!==undefined) input.value=String(stored);
        });
    });
    if (attendanceRecordCount) attendanceRecordCount.textContent = `${attendanceStudents.length} students • ${selected.map(n => attendanceMonthNames[n - 1]).join(", ")} • ${attendanceSort?.selectedOptions[0]?.text || "Please Select"}`;
    setAttendanceInputLimits();
}

async function loadAttendanceGrid() {
    if (!attendanceSession || !attendanceClass) return;
    attendanceSavedSnapshot = null;
    attendanceOriginallyBlankCells.clear();
    attendanceTouchedBlankCells.clear();
    if (!attendanceSelectedMonths.length) { attendanceShowToast("Please select at least one month.", "error"); return; }
    const sessionId = Number(attendanceSession.value);
    const classNo = Number(attendanceClass.value);
    attendanceTableContainer.innerHTML = `<div class="loading">Loading attendance...</div>`;
    const { data: records, error } = await supabaseClient
        .from("academic_records")
        .select(`id, session_id, student_profile_id, class_no, roll_no, status, students ( id, student_id, student_name )`)
        .eq("session_id", sessionId)
        .eq("class_no", classNo);
    if (error) { attendanceTableContainer.innerHTML = `<div class="empty-state">Unable to load students.<br><br>${escapeHtml(error.message)}</div>`; return; }
    attendanceStudents = records || [];
    attendanceData = {};

    const { data: workingRows, error: workingError } = await supabaseClient
        .from("monthly_working_days")
        .select("session_id, month_no, working_days")
        .eq("session_id", sessionId)
        .in("month_no", attendanceSelectedMonths);
    if (workingError) {
        attendanceTableContainer.innerHTML = `<div class="empty-state">Unable to load Working Days.<br><br>${escapeHtml(workingError.message)}<br><br>Please run the attendance working-days SQL migration first.</div>`;
        return;
    }
    attendanceSelectedMonths.forEach(monthNo => delete attendanceWorkingDays[monthNo]);
    (workingRows || []).forEach(row => {
        if (row.working_days !== null && row.working_days !== undefined) attendanceWorkingDays[Number(row.month_no)] = Number(row.working_days);
    });

    const ids = attendanceStudents.map(r => r.id);
    if (ids.length) {
        const { data: rows, error: attendanceError } = await supabaseClient
            .from("monthly_attendance")
            .select("academic_record_id, month_no, present_days, working_days")
            .in("academic_record_id", ids);
        if (attendanceError) {
            attendanceTableContainer.innerHTML = `<div class="empty-state">Unable to load attendance.<br><br>${escapeHtml(attendanceError.message)}</div>`;
            return;
        }
        (rows || []).forEach(row => {
            const monthNo = Number(row.month_no);
            if (!attendanceSelectedMonths.includes(monthNo)) return;
            const present = row.present_days === null ? undefined : Number(row.present_days);
            if (present === undefined) return;
            attendanceData[`${row.academic_record_id}_${monthNo}`] = { present_days: present };
            if (attendanceWorkingDays[monthNo] === undefined && row.working_days !== null && row.working_days !== undefined) {
                attendanceWorkingDays[monthNo] = Number(row.working_days);
            }
        });
    }
    renderAttendanceWorkingDaysInputs();
    renderAttendanceTable();
    captureAttendanceSavedSnapshot();
    attendanceCommittedContext = {
        session: attendanceSession?.value || null,
        classNo: attendanceClass?.value || null
    };
}

async function saveAttendance({ reload = true } = {}) {
    if (currentRole !== "admin") { attendanceShowToast("View Only users cannot save attendance.", "error"); return false; }
    if (!attendanceSelectedMonths.length || !attendanceStudents.length) { attendanceShowToast("Load a class and select month(s) before saving.", "error"); return false; }

    for (const monthNo of attendanceSelectedMonths) {
        const working = attendanceWorkingDays[monthNo];
        const hasPresent = attendanceStudents.some(record => attendanceData[`${record.id}_${monthNo}`]?.present_days !== undefined);
        if (hasPresent && (working === undefined || working === null)) {
            attendanceShowToast(`Enter Working Days for ${attendanceMonthNames[monthNo - 1]}.`, "error");
            return false;
        }
        if (working !== undefined) {
            const max = attendanceMaxDays(monthNo);
            if (!Number.isInteger(Number(working)) || Number(working) < 0 || Number(working) > max) {
                attendanceShowToast(`Invalid Working Days for ${attendanceMonthNames[monthNo - 1]}.`, "error");
                return false;
            }
            const maxPresent = attendanceStudents.reduce((m, record) => Math.max(m, Number(attendanceData[`${record.id}_${monthNo}`]?.present_days ?? 0)), 0);
            if (maxPresent > Number(working)) {
                attendanceShowToast(`Present Days cannot exceed Working Days for ${attendanceMonthNames[monthNo - 1]}.`, "error");
                return false;
            }
        }
    }

    const editable = await ensureAcademicSessionEditable(attendanceSession.value, "save Attendance");
    if (!editable) return false;

    attendanceSaveButton.disabled = true;
    attendanceSaveButton.textContent = "Saving...";
    try {
        const sessionId = Number(attendanceSession.value);
        const workingRows = attendanceSelectedMonths
            .filter(monthNo => attendanceWorkingDays[monthNo] !== undefined)
            .map(monthNo => ({ session_id: sessionId, month_no: monthNo, working_days: Number(attendanceWorkingDays[monthNo]), updated_at: new Date().toISOString() }));

        if (workingRows.length) {
            const { error } = await supabaseClient.from("monthly_working_days").upsert(workingRows, { onConflict: "session_id,month_no" });
            if (error) throw error;
        }

        const selectedIds = attendanceStudents.map(record => record.id);
        const { error: deleteError } = await supabaseClient
            .from("monthly_attendance")
            .delete()
            .in("academic_record_id", selectedIds)
            .in("month_no", attendanceSelectedMonths);
        if (deleteError) throw deleteError;

        const rows = [];
        attendanceStudents.forEach(record => {
            attendanceSelectedMonths.forEach(monthNo => {
                const present = attendanceData[`${record.id}_${monthNo}`]?.present_days;
                if (present === undefined) return;
                rows.push({
                    academic_record_id: record.id,
                    month_no: monthNo,
                    working_days: Number(attendanceWorkingDays[monthNo]),
                    present_days: Number(present)
                });
            });
        });
        if (rows.length) {
            const { error } = await supabaseClient.from("monthly_attendance").insert(rows);
            if (error) throw error;
        }

        // Remove canonical Working Days for cleared months only when no student has attendance there.
        const clearMonths = attendanceSelectedMonths.filter(monthNo => attendanceWorkingDays[monthNo] === undefined && !attendanceStudents.some(record => attendanceData[`${record.id}_${monthNo}`]?.present_days !== undefined));
        if (clearMonths.length) {
            const { error } = await supabaseClient.from("monthly_working_days").delete().eq("session_id", sessionId).in("month_no", clearMonths);
            if (error) throw error;
        }

        captureAttendanceSavedSnapshot();
        attendanceShowToast("Attendance saved successfully.", "success");
        if (reload) await loadAttendanceGrid();
        return true;
    } catch (error) {
        attendanceShowToast("Unable to save attendance: " + (error.message || "Unknown error"), "error");
        return false;
    } finally {
        attendanceSaveButton.disabled = false;
        attendanceSaveButton.textContent = "Save Attendance & Working Days";
    }
}

function printAttendanceSummary() {
    if (!attendanceSelectedMonths.length || !attendanceStudents.length) { attendanceShowToast("Load attendance and select month(s) first.", "error"); return; }
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
    const perStudentWorking = attendanceSelectedMonths.reduce((sum, monthNo) => sum + Number(attendanceWorkingDays[monthNo] || 0), 0);
    const totalPresent = sorted.reduce((sum, record) => sum + getAttendanceStudentTotals(record.id).present, 0);
    const totalWorkingAcrossStudents = perStudentWorking * sorted.length;
    const totalAbsent = Math.max(0, totalWorkingAcrossStudents - totalPresent);
    const overallPct = totalWorkingAcrossStudents ? (totalPresent / totalWorkingAcrossStudents) * 100 : 0;
    const html = `<div class="result-page"><div class="result-header"><h1>U.M.S SASAULI URDU</h1><h2>Class Attendance Summary</h2><div class="small">Academic Session: ${escapeHtml(sessionLabel)} • ${escapeHtml(classLabel)}</div><div class="small">${escapeHtml(periodLabel)}</div></div><table class="result-table attendance-print-table"><thead><tr><th>Sl.</th><th>Roll</th><th>Student Name</th><th>Working Days</th><th>Present</th><th>Absent</th><th>Attendance %</th></tr></thead><tbody>${rows}</tbody></table><div class="result-summary"><b>Total Students:</b> ${sorted.length} &nbsp;&nbsp; <b>Working Days / Student:</b> ${perStudentWorking} &nbsp;&nbsp; <b>Total Present:</b> ${totalPresent} &nbsp;&nbsp; <b>Total Absent:</b> ${totalAbsent} &nbsp;&nbsp; <b>Attendance:</b> ${overallPct.toFixed(2)}%</div></div>`;
    openPrint(html, `${classLabel} ${periodLabel} Attendance Summary`);
}

function resetAttendanceState() {
    attendanceSavedSnapshot = null;
    attendanceOriginallyBlankCells.clear();
    attendanceTouchedBlankCells.clear();
    if (attendanceToastTimer) {
        clearTimeout(attendanceToastTimer);
        attendanceToastTimer = null;
    }
    const active = sessions.find(s => s.is_active);
    if (attendanceSession && active) attendanceSession.value = String(active.id);
    if (attendanceClass) attendanceClass.value = "1";
    if (attendanceSort) attendanceSort.value = "";
    attendanceSelectedMonths = [];
    attendanceStudents = [];
    attendanceData = {};
    attendanceWorkingDays = {};
    attendanceCommittedContext = { session: attendanceSession?.value || null, classNo: attendanceClass?.value || null };
    renderAttendanceMonthButtons();
    if (attendanceRecordCount) attendanceRecordCount.textContent = "Select session, class and month(s).";
    if (attendanceTableContainer) attendanceTableContainer.innerHTML = `<div class="empty-state">Select session, class and month(s) to load attendance.</div>`;
}

if (attendanceSaveButton) attendanceSaveButton.addEventListener("click", () => saveAttendance());
if (attendanceSession) attendanceSession.addEventListener("change", async function () {
    const requested = this.value;
    const committed = attendanceCommittedContext.session;
    if (hasUnsavedAttendanceChanges() && committed !== null) {
        this.value = committed;
        const proceeded = await protectUnsavedChanges("attendance", async () => {
            this.value = requested;
            attendanceCommittedContext.session = requested;
            await resetAttendanceGridForSelectionChange();
        });
        if (!proceeded) this.value = committed;
        return;
    }
    attendanceCommittedContext.session = requested;
    await resetAttendanceGridForSelectionChange();
});
if (attendanceClass) attendanceClass.addEventListener("change", async function () {
    const requested = this.value;
    const committed = attendanceCommittedContext.classNo;
    if (hasUnsavedAttendanceChanges() && committed !== null) {
        this.value = committed;
        const proceeded = await protectUnsavedChanges("attendance", async () => {
            this.value = requested;
            attendanceCommittedContext.classNo = requested;
            await resetAttendanceGridForSelectionChange();
        });
        if (!proceeded) this.value = committed;
        return;
    }
    attendanceCommittedContext.classNo = requested;
    await resetAttendanceGridForSelectionChange();
});
if (attendanceSort) attendanceSort.addEventListener("change", renderAttendanceTable);
if (attendancePrintButton) attendancePrintButton.addEventListener("click", printAttendanceSummary);
