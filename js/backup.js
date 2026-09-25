/* =========================================================
   BACKUP & RECOVERY
   ========================================================= */

const BACKUP_TABLES = [
    "students",
    "academic_sessions",
    "academic_records",
    "subjects",
    "exam_marks",
    "monthly_attendance",
    "promotion_history",
    "recycle_bin"
];

const BACKUP_CHUNK_SIZE = 500;

const backupStatus = document.getElementById("backupStatus");
const createBackupButton = document.getElementById("createBackupButton");
const restoreBackupButton = document.getElementById("restoreBackupButton");
const backupFileInput = document.getElementById("backupFileInput");

function setBackupStatus(message, type = "info") {
    if (!backupStatus) return;
    const colors = {
        info: "#6b7280",
        success: "#047857",
        error: "#b91c1c"
    };
    backupStatus.style.color = colors[type] || colors.info;
    backupStatus.innerHTML = escapeHtml(message);
}

async function fetchAllBackupRows(tableName) {
    const rows = [];
    let offset = 0;

    while (true) {
        const { data, error } = await supabaseClient
            .from(tableName)
            .select("*")
            .range(offset, offset + BACKUP_CHUNK_SIZE - 1);

        if (error) throw error;

        const batch = data || [];
        rows.push(...batch);

        if (batch.length < BACKUP_CHUNK_SIZE) break;
        offset += BACKUP_CHUNK_SIZE;
    }

    return rows;
}

async function getBackupSummary() {
    if (currentRole !== "admin") {
        setBackupStatus("Only an Admin can create or restore application backups.", "error");
        return;
    }

    try {
        const counts = {};
        for (const tableName of BACKUP_TABLES) {
            const { count, error } = await supabaseClient
                .from(tableName)
                .select("*", { count: "exact", head: true });
            if (error) throw error;
            counts[tableName] = Number(count || 0);
        }

        setBackupStatus(
            `Ready. ${counts.students} students, ${counts.academic_records} academic records, ` +
            `${counts.exam_marks} marks, ${counts.monthly_attendance} attendance rows, and ` +
            `${counts.promotion_history} promotion-history rows are available for backup.`,
            "success"
        );
    } catch (error) {
        console.error(error);
        setBackupStatus(`Unable to read backup information: ${error.message || "Unknown error"}`, "error");
    }
}

async function createFullBackup() {
    if (currentRole !== "admin") {
        showToast("Only an Admin can create a backup.", "error");
        return;
    }

    if (!confirm("Create a full backup of the application data and download it as a JSON file?")) {
        return;
    }

    createBackupButton.disabled = true;
    createBackupButton.textContent = "Creating Backup…";
    setBackupStatus("Collecting application data…", "info");

    try {
        const tables = {};

        for (const tableName of BACKUP_TABLES) {
            setBackupStatus(`Backing up ${tableName.replaceAll("_", " ")}…`, "info");
            tables[tableName] = await fetchAllBackupRows(tableName);
        }

        const payload = {
            backup_version: 1,
            application: "Student Management System",
            created_at: new Date().toISOString(),
            note: "Authentication credentials and recycle-bin security password are intentionally excluded.",
            tables
        };

        const blob = new Blob(
            [JSON.stringify(payload, null, 2)],
            { type: "application/json" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        link.href = url;
        link.download = `student-management-backup-${stamp}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);

        setBackupStatus("Full backup created successfully and downloaded.", "success");
        showToast("Full backup downloaded successfully.", "success");
    } catch (error) {
        console.error(error);
        setBackupStatus(`Backup failed: ${error.message || "Unknown error"}`, "error");
        showToast(`Backup failed: ${error.message || "Unknown error"}`, "error");
    } finally {
        createBackupButton.disabled = false;
        createBackupButton.textContent = "Download Full Backup";
    }
}

async function upsertBackupRows(tableName, rows) {
    if (!Array.isArray(rows) || !rows.length) return;

    for (let i = 0; i < rows.length; i += BACKUP_CHUNK_SIZE) {
        const batch = rows.slice(i, i + BACKUP_CHUNK_SIZE);
        const { error } = await supabaseClient
            .from(tableName)
            .upsert(batch);
        if (error) throw error;
    }
}

async function restoreBackupFile(file) {
    if (currentRole !== "admin") {
        showToast("Only an Admin can restore a backup.", "error");
        return;
    }

    if (!file) return;

    try {
        const text = await file.text();
        const payload = JSON.parse(text);

        if (!payload || payload.backup_version !== 1 || !payload.tables) {
            throw new Error("This is not a valid Student Management System backup file.");
        }

        if (!confirm(
            "Restore the selected backup? Existing matching records may be updated. " +
            "This action should only be used with a trusted backup file."
        )) {
            return;
        }

        restoreBackupButton.disabled = true;
        createBackupButton.disabled = true;
        restoreBackupButton.textContent = "Restoring…";
        setBackupStatus("Restoring application data…", "info");

        // Parent/reference tables first, then dependent tables.
        const restoreOrder = [
            "students",
            "academic_sessions",
            "subjects",
            "academic_records",
            "exam_marks",
            "monthly_attendance",
            "promotion_history",
            "recycle_bin"
        ];

        for (const tableName of restoreOrder) {
            const rows = payload.tables[tableName] || [];
            if (!rows.length) continue;
            setBackupStatus(`Restoring ${tableName.replaceAll("_", " ")}…`, "info");
            await upsertBackupRows(tableName, rows);
        }

        setBackupStatus("Backup restored successfully. Refreshing application data…", "success");
        showToast("Backup restored successfully.", "success");

        if (typeof loadSessions === "function") await loadSessions();
        if (typeof loadStudents === "function") await loadStudents();
        if (typeof updateDashboardCounts === "function") await updateDashboardCounts();
        if (typeof loadAcademicYearManager === "function") await loadAcademicYearManager();
    } catch (error) {
        console.error(error);
        setBackupStatus(`Restore failed: ${error.message || "Unknown error"}`, "error");
        showToast(`Restore failed: ${error.message || "Unknown error"}`, "error");
    } finally {
        restoreBackupButton.disabled = false;
        createBackupButton.disabled = false;
        restoreBackupButton.textContent = "Restore Backup";
        if (backupFileInput) backupFileInput.value = "";
    }
}

async function loadBackupSection() {
    await getBackupSummary();
}

if (createBackupButton) {
    createBackupButton.addEventListener("click", createFullBackup);
}

if (restoreBackupButton && backupFileInput) {
    restoreBackupButton.addEventListener("click", () => {
        if (currentRole !== "admin") {
            showToast("Only an Admin can restore a backup.", "error");
            return;
        }
        backupFileInput.click();
    });

    backupFileInput.addEventListener("change", async event => {
        const file = event.target.files?.[0];
        await restoreBackupFile(file);
    });
}
