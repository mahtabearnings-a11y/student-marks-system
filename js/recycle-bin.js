/* =========================================================
   RECYCLE BIN
========================================================= */

function formatRecycleBinDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function getSelectedRecycleBinIds() {
    return Array.from(
        document.querySelectorAll(
            '.recycle-bin-checkbox:checked'
        )
    )
    .map(input => Number(input.value))
    .filter(Number.isFinite);
}

function updateRecycleBinSelectionState() {
    const checkboxes = Array.from(
        document.querySelectorAll('.recycle-bin-checkbox')
    );

    const selectedCount = checkboxes.filter(cb => cb.checked).length;

    if (restoreRecycleBinButton) {
        restoreRecycleBinButton.disabled = selectedCount === 0;
    }

    if (permanentDeleteRecycleBinButton) {
        permanentDeleteRecycleBinButton.disabled = selectedCount === 0;
    }

    if (selectAllRecycleBin) {
        selectAllRecycleBin.checked =
            checkboxes.length > 0 &&
            selectedCount === checkboxes.length;

        selectAllRecycleBin.indeterminate =
            selectedCount > 0 &&
            selectedCount < checkboxes.length;
    }
}

function renderRecycleBin() {
    if (!recycleBinTableContainer) return;

    recycleBinRecordCount.textContent =
        `${recycleBinData.length} item${recycleBinData.length === 1 ? "" : "s"}`;

    if (!recycleBinData.length) {
        recycleBinTableContainer.innerHTML = `
            <div class="empty-state">
                Recycle Bin is empty.
            </div>
        `;
        updateRecycleBinSelectionState();
        return;
    }

    const rows = recycleBinData.map(item => {
        const snapshot = item.snapshot || {};
        const student = snapshot.students || {};
        const academicRecords = Array.isArray(snapshot.academic_records)
            ? snapshot.academic_records
            : [];

        const currentRecord =
            academicRecords.find(record => record.session_id === activeSessionId()) ||
            academicRecords[0] ||
            {};

        return `
            <tr>
                <td style="text-align:center;">
                    <input
                        type="checkbox"
                        class="recycle-bin-select recycle-bin-checkbox"
                        value="${Number(item.id)}">
                </td>

                <td>
                    <strong>${escapeHtml(item.student_name || student.student_name || "")}</strong>
                </td>

                <td>
                    ${className(currentRecord.class_no)}
                </td>

                <td>
                    ${currentRecord.roll_no ?? "Not Assigned"}
                </td>

                <td>
                    ${escapeHtml(student.student_id || "") || "<span style='color:#9ca3af'>Blank</span>"}
                </td>

                <td>
                    ${formatRecycleBinDate(item.deleted_at)}
                </td>

                <td>
                    <span class="recycle-bin-status">Deleted</span>
                </td>
            </tr>
        `;
    }).join("");

    recycleBinTableContainer.innerHTML = `
        <table class="recycle-bin-table">
            <thead>
                <tr>
                    <th style="width:48px;text-align:center;">Select</th>
                    <th>Student Name</th>
                    <th>Class</th>
                    <th>Roll No.</th>
                    <th>Student ID</th>
                    <th>Deleted On</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;

    document
        .querySelectorAll('.recycle-bin-checkbox')
        .forEach(cb => {
            cb.addEventListener("change", updateRecycleBinSelectionState);
        });

    updateRecycleBinSelectionState();
}

function activeSessionId() {
    const active = sessions.find(session => session.is_active);
    return active ? active.id : null;
}

async function loadRecycleBin() {
    if (!recycleBinTableContainer) return;

    recycleBinTableContainer.innerHTML =
        `<div class="loading">Loading Recycle Bin...</div>`;

    if (currentRole !== "admin") {
        recycleBinTableContainer.innerHTML = `
            <div class="empty-state">
                Only an Admin can access the Recycle Bin.
            </div>
        `;
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from("recycle_bin")
            .select("id, original_student_id, student_name, deleted_at, restored_at, snapshot")
            .is("restored_at", null)
            .order("deleted_at", { ascending: false });

        if (error) {
            throw error;
        }

        recycleBinData = data || [];
        renderRecycleBin();

    } catch (error) {
        console.error("Recycle Bin load failed:", error);
        recycleBinData = [];
        recycleBinTableContainer.innerHTML = `
            <div class="empty-state">
                Unable to load Recycle Bin.
                <br><br>
                <strong>${escapeHtml(error.message || "Unknown error")}</strong>
                <br><br>
                Please refresh the page and try again.
            </div>
        `;
    }
}

async function getRecycleBinExistingStudentDetails(studentProfileId, sessionId) {
    const { data, error } = await supabaseClient
        .from("students")
        .select("id, student_name, student_id, apaar_id")
        .eq("id", studentProfileId)
        .limit(1);

    if (error) throw error;

    const student = data?.[0] || {};
    let academic = {};

    if (sessionId) {
        const { data: records, error: recordError } = await supabaseClient
            .from("academic_records")
            .select("class_no, roll_no")
            .eq("student_profile_id", studentProfileId)
            .eq("session_id", sessionId)
            .limit(1);

        if (recordError) throw recordError;
        academic = records?.[0] || {};
    }

    return {
        name: student.student_name || "Not Available",
        studentId: student.student_id || "Not Available",
        apaarId: student.apaar_id || "Not Available",
        classNo: academic.class_no ?? "Not Available",
        rollNo: academic.roll_no ?? "Not Assigned"
    };
}

async function checkRecycleBinRestoreConflicts(selectedItems) {
    const conflicts = [];

    for (const item of selectedItems) {
        const snapshot = item.snapshot || {};
        const student = snapshot.students || {};
        const records = Array.isArray(snapshot.academic_records)
            ? snapshot.academic_records
            : [];

        // 1. School Student ID conflict
        if (student.student_id) {
            const { data, error } = await supabaseClient
                .from("students")
                .select("id, student_name, student_id, apaar_id")
                .eq("student_id", student.student_id)
                .limit(1);

            if (error) throw error;

            if (data && data.length) {
                const existing = data[0];
                const details = await getRecycleBinExistingStudentDetails(
                    existing.id,
                    records[0]?.session_id
                );

                conflicts.push({
                    type: "Student ID",
                    item,
                    detail: student.student_id,
                    existingStudent: details
                });
                continue;
            }
        }

        // 2. APAAR ID conflict (only when the deleted student has one)
        if (student.apaar_id) {
            const { data, error } = await supabaseClient
                .from("students")
                .select("id, student_name, student_id, apaar_id")
                .eq("apaar_id", student.apaar_id)
                .limit(1);

            if (error) throw error;

            if (data && data.length) {
                const existing = data[0];
                const details = await getRecycleBinExistingStudentDetails(
                    existing.id,
                    records[0]?.session_id
                );

                conflicts.push({
                    type: "APAAR ID",
                    item,
                    detail: student.apaar_id,
                    existingStudent: details
                });
                continue;
            }
        }

        // 3. Class + Roll conflict in the same academic session
        for (const record of records) {
            if (record.roll_no === null || record.roll_no === undefined || record.roll_no === "") {
                continue;
            }

            const { data, error } = await supabaseClient
                .from("academic_records")
                .select("id, student_profile_id, class_no, roll_no, students(id, student_name, student_id, apaar_id)")
                .eq("session_id", record.session_id)
                .eq("class_no", record.class_no)
                .eq("roll_no", record.roll_no)
                .limit(1);

            if (error) throw error;

            if (data && data.length) {
                const existing = data[0];
                const details = {
                    name: existing.students?.student_name || "Not Available",
                    studentId: existing.students?.student_id || "Not Available",
                    apaarId: existing.students?.apaar_id || "Not Available",
                    classNo: existing.class_no ?? "Not Available",
                    rollNo: existing.roll_no ?? "Not Assigned"
                };

                conflicts.push({
                    type: "Class + Roll",
                    item,
                    detail: `Class ${record.class_no}, Roll ${record.roll_no}`,
                    existingStudent: details
                });
                break;
            }
        }
    }

    return conflicts;
}

function formatRecycleBinConflict(conflict) {
    const existing = conflict.existingStudent || {};

    return `
        <div style="margin-bottom:12px;">
            The student cannot be restored because the required information is already assigned to another student.
        </div>
        <div style="margin-bottom:8px;font-weight:700;">Existing Student</div>
        <div style="display:grid;grid-template-columns:120px 1fr;gap:6px 10px;text-align:left;">
            <div><strong>Name</strong></div><div>${escapeHtml(existing.name || "Not Available")}</div>
            <div><strong>Student ID</strong></div><div>${escapeHtml(existing.studentId || "Not Available")}</div>
            <div><strong>APAAR ID</strong></div><div>${escapeHtml(existing.apaarId || "Not Available")}</div>
            <div><strong>Class</strong></div><div>${escapeHtml(String(existing.classNo ?? "Not Available"))}</div>
            <div><strong>Roll No.</strong></div><div>${escapeHtml(String(existing.rollNo ?? "Not Assigned"))}</div>
        </div>
    `;
}

async function restoreSelectedRecycleBin() {
    if (currentRole !== "admin") return;

    const ids = getSelectedRecycleBinIds();

    if (!ids.length) {
        showToast("Please select at least one student.", "error");
        return;
    }

    const selectedItems = recycleBinData.filter(
        item => ids.includes(Number(item.id))
    );

    const names = selectedItems
        .map(item => item.student_name)
        .filter(Boolean);

    const confirmed = confirm(
        `Restore ${ids.length} selected student${ids.length === 1 ? "" : "s"}?` +
        (names.length
            ? `\n\n${names.join("\n")}`
            : "")
    );

    if (!confirmed) return;

    restoreRecycleBinButton.disabled = true;

    try {
        // Preflight visible school-level identifiers before any restore occurs.
        // If one selected student conflicts, stop the restore so the operation
        // does not partially restore a multi-selection.
        const conflicts = await checkRecycleBinRestoreConflicts(selectedItems);

        if (conflicts.length) {
            showStudentConflictDialog(
                "Existing Student",
                formatRecycleBinConflict(conflicts[0])
            );
            return;
        }

        let restoredCount = 0;

        for (const id of ids) {
            const { error } = await supabaseClient.rpc(
                "restore_student_from_recycle_bin",
                {
                    p_recycle_bin_id: id
                }
            );

            if (error) {
                throw error;
            }

            restoredCount++;
        }

        await loadRecycleBin();
        await loadStudents();
        await updateDashboardCounts();

        showToast(
            `${restoredCount} student${restoredCount === 1 ? "" : "s"} restored successfully.`,
            "success"
        );

    } catch (error) {
        console.error(error);

        await loadRecycleBin();
        await loadStudents();
        await updateDashboardCounts();

        showToast(
            error.message || "Restore failed.",
            "error"
        );

    } finally {
        updateRecycleBinSelectionState();
    }
}

function closeRecycleBinPasswordDialog() {
    pendingPermanentDeleteIds = [];

    if (recycleBinDeletePassword) {
        recycleBinDeletePassword.value = "";
    }

    if (recycleBinPasswordModal) {
        recycleBinPasswordModal.classList.add("hidden");
    }
}

function openRecycleBinPasswordDialog(ids) {
    pendingPermanentDeleteIds = [...ids];

    if (recycleBinDeletePassword) {
        recycleBinDeletePassword.value = "";
    }

    if (recycleBinPasswordModal) {
        recycleBinPasswordModal.classList.remove("hidden");
    }

    setTimeout(() => {
        if (recycleBinDeletePassword) {
            recycleBinDeletePassword.focus();
        }
    }, 50);
}

async function permanentlyDeleteSelectedRecycleBin() {
    if (currentRole !== "admin") return;

    const ids = getSelectedRecycleBinIds();

    if (!ids.length) {
        showToast("Please select at least one student.", "error");
        return;
    }

    const selectedItems = recycleBinData.filter(
        item => ids.includes(Number(item.id))
    );

    const names = selectedItems
        .map(item => item.student_name)
        .filter(Boolean);

    const confirmed = confirm(
        `Permanently delete ${ids.length} selected student${ids.length === 1 ? "" : "s"}?` +
        (names.length
            ? `\n\n${names.join("\n")}`
            : "") +
        `\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    openRecycleBinPasswordDialog(ids);
}

async function confirmPermanentDelete() {
    if (currentRole !== "admin") return;

    const ids = [...pendingPermanentDeleteIds];
    const password = recycleBinDeletePassword
        ? recycleBinDeletePassword.value
        : "";

    if (!ids.length) {
        closeRecycleBinPasswordDialog();
        return;
    }

    if (!password) {
        showToast("Please enter the password.", "error");
        return;
    }

    confirmRecycleBinPasswordButton.disabled = true;

    try {
        const { data, error } = await supabaseClient.rpc(
            "permanently_delete_recycle_bin",
            {
                p_recycle_bin_ids: ids,
                p_password: password
            }
        );

        if (error) {
            throw error;
        }

        closeRecycleBinPasswordDialog();

        await loadRecycleBin();

        showToast(
            `${Number(data) || ids.length} student${ids.length === 1 ? "" : "s"} permanently deleted.`,
            "success"
        );

    } catch (error) {
        console.error(error);

        showToast(
            error.message || "Permanent deletion failed.",
            "error"
        );

    } finally {
        if (confirmRecycleBinPasswordButton) {
            confirmRecycleBinPasswordButton.disabled = false;
        }
    }
}


if (selectAllRecycleBin) {
    selectAllRecycleBin.addEventListener("change", function() {
        document
            .querySelectorAll(".recycle-bin-checkbox")
            .forEach(cb => {
                cb.checked = this.checked;
            });

        updateRecycleBinSelectionState();
    });
}

if (refreshRecycleBinButton) {
    refreshRecycleBinButton.addEventListener(
        "click",
        loadRecycleBin
    );
}

if (restoreRecycleBinButton) {
    restoreRecycleBinButton.addEventListener(
        "click",
        restoreSelectedRecycleBin
    );
}

if (permanentDeleteRecycleBinButton) {
    permanentDeleteRecycleBinButton.addEventListener(
        "click",
        permanentlyDeleteSelectedRecycleBin
    );
}

if (closeRecycleBinPasswordModal) {
    closeRecycleBinPasswordModal.addEventListener(
        "click",
        closeRecycleBinPasswordDialog
    );
}

if (cancelRecycleBinPasswordButton) {
    cancelRecycleBinPasswordButton.addEventListener(
        "click",
        closeRecycleBinPasswordDialog
    );
}

if (confirmRecycleBinPasswordButton) {
    confirmRecycleBinPasswordButton.addEventListener(
        "click",
        confirmPermanentDelete
    );
}

if (recycleBinPasswordModal) {
    recycleBinPasswordModal.addEventListener("click", function(event) {
        if (event.target === recycleBinPasswordModal) {
            closeRecycleBinPasswordDialog();
        }
    });
}

