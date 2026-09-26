/* =========================================================
   STUDENTS MODULE
========================================================= */

/* =========================================================
   LOAD STUDENTS
========================================================= */

async function loadStudents() {

    studentTableContainer.innerHTML =
        `<div class="loading">
            Loading students...
        </div>`;


    const sessionId =
        sessionFilter.value;


    if (!sessionId) {

        studentsData = [];

        renderStudents();

        return;

    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("academic_records")
            .select(`
                id,
                session_id,
                student_profile_id,
                class_no,
                roll_no,
                status,
                students (
                    id,
                    student_id,
                    apaar_id,
                    student_name,
                    father_name,
                    mother_name,
                    date_of_birth,
                    gender
                )
            `)
            .eq(
                "session_id",
                sessionId
            );


    if (error) {

        console.error(error);

        studentTableContainer.innerHTML =
            `<div class="empty-state">
                Unable to load students.
                <br><br>
                ${escapeHtml(error.message)}
            </div>`;

        return;

    }


    studentsData =
        (data || []).map(
            record => ({

                academicRecordId:
                    record.id,

                sessionId:
                    record.session_id,

                studentProfileId:
                    record.student_profile_id,

                classNo:
                    record.class_no,

                rollNo:
                    record.roll_no,

                status:
                    record.status || "",

                studentId:
                    record.students?.student_id || "",

                apaarId:
                    record.students?.apaar_id || "",

                studentName:
                    record.students?.student_name || "",

                fatherName:
                    record.students?.father_name || "",

                motherName:
                    record.students?.mother_name || "",

                dob:
                    record.students?.date_of_birth || "",

                gender:
                    record.students?.gender || ""

            })
        );


    renderStudents();

    updateDashboardCounts();

}


/* =========================================================
   RENDER STUDENTS
========================================================= */

function getFilteredStudents() {

    let list =
        [...studentsData];


    const classValue =
        classFilter.value;


    if (classValue !== "all") {

        list =
            list.filter(
                student =>
                    String(
                        student.classNo
                    ) === classValue
            );

    }


    const search =
        studentSearch.value
            .trim()
            .toLowerCase();


    if (search) {

        list =
            list.filter(
                student => {

                    return (

                        String(
                            student.studentId
                        )
                        .toLowerCase()
                        .includes(search)

                        ||

                        student.studentName
                            .toLowerCase()
                            .includes(search)

                        ||

                        String(
                            student.rollNo ?? ""
                        )
                        .toLowerCase()
                        .includes(search)

                    );

                }
            );

    }


    const sort =
        studentSort.value;


    list.sort(
        (a,b) => {

            if (sort === "roll_asc") {
                return (
                    (a.rollNo ?? 999999)
                    -
                    (b.rollNo ?? 999999)
                );
            }


            if (sort === "roll_desc") {
                return (
                    (b.rollNo ?? -1)
                    -
                    (a.rollNo ?? -1)
                );
            }


            if (sort === "name_asc") {
                return a.studentName
                    .localeCompare(
                        b.studentName
                    );
            }


            if (sort === "name_desc") {
                return b.studentName
                    .localeCompare(
                        a.studentName
                    );
            }


            if (sort === "id_asc") {
                return String(
                    a.studentId
                ).localeCompare(
                    String(b.studentId)
                );
            }


            if (sort === "id_desc") {
                return String(
                    b.studentId
                ).localeCompare(
                    String(a.studentId)
                );
            }


            if (sort === "status_asc") {
                return String(
                    a.status
                ).localeCompare(
                    String(b.status)
                );
            }


            return 0;

        }
    );


    return list;

}


function renderStudents() {

    const list =
        getFilteredStudents();


    studentRecordCount.textContent =
        `${list.length} student${list.length === 1 ? "" : "s"}`;


    if (!list.length) {

        studentTableContainer.innerHTML =
            `<div class="empty-state">
                No students found for the selected filters.
            </div>`;

        return;

    }


    let html = `

        <div class="student-grid-wrapper"><table class="student-table"><thead>

                <tr>

                    <th class="sticky-roll">Roll No.</th>

                    <th>Student ID</th>

                    <th>APAAR ID</th>

                    <th>Student Name</th>

                    <th>Father's Name</th>

                    <th>Mother's Name</th>

                    <th>Date of Birth</th>

                    <th>Gender</th>

                    <th>Class</th>

                    <th>Status</th>

                    <th>Actions</th>

                </tr>

            </thead>

            <tbody>
    `;


    list.forEach(
        student => {

            html += `

                <tr>

                    <td class="sticky-roll">
                        ${escapeHtml(
                            student.rollNo ?? ""
                        )}
                    </td>

                    <td>
                        ${student.studentId
                            ? escapeHtml(
                                student.studentId
                              )
                            : "<span style='color:#9ca3af'>Blank</span>"
                        }
                    </td>

                    <td>
                        ${student.apaarId
                            ? escapeHtml(
                                student.apaarId
                              )
                            : "<span style='color:#9ca3af'>Blank</span>"
                        }
                    </td>

                    <td>
                        <strong>
                            ${escapeHtml(
                                student.studentName
                            )}
                        </strong>
                    </td>

                    <td>
                        ${escapeHtml(
                            student.fatherName
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            student.motherName
                        )}
                    </td>

                    <td>
                        ${formatDate(
                            student.dob
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            student.gender
                        )}
                    </td>

                    <td>
                        ${className(
                            student.classNo
                        )}
                    </td>

                    <td>
                        ${statusBadge(
                            student.status
                        )}
                    </td>

                    <td>

                        <div class="actions">

                            <button
                                class="btn btn-secondary btn-small"
                                onclick="viewHistory(${student.studentProfileId})">

                                History

                            </button>

                            ${
                                currentRole === "admin"
                                ?

                                `

                                <button
                                    class="btn btn-secondary btn-small"
                                    onclick="editStudent(${student.academicRecordId})">

                                    Edit

                                </button>

                                <button
                                    class="btn btn-warning btn-small"
                                    onclick="markLeft(${student.academicRecordId})">

                                    Left

                                </button>

                                <button
                                    class="btn btn-danger btn-small"
                                    onclick="deleteStudent(${student.academicRecordId})">

                                    Delete

                                </button>

                                `

                                : ""

                            }

                        </div>

                    </td>

                </tr>

            `;

        }
    );


    html += `

            </tbody></table></div>

    `;


    studentTableContainer.innerHTML =
        html;


}


/* =========================================================
   STATUS BADGE
========================================================= */

function statusBadge(status) {

    if (!status) {

        return `
            <span class="status-badge">
                Current
            </span>
        `;

    }


    let css =
        "status-badge";


    if (status === "Promoted") {
        css += " status-promoted";
    }

    if (status === "Repeated") {
        css += " status-repeated";
    }

    if (status === "Left School") {
        css += " status-left";
    }

    if (status === "New Student") {
        css += " status-new";
    }


    return `
        <span class="${css}">
            ${escapeHtml(status)}
        </span>
    `;

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(value) {

    return String(
        value ?? ""
    )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


/* =========================================================
   DATE
========================================================= */

function formatDate(value) {

    if (!value) {
        return "";
    }


    const parts =
        value.split("-");


    if (parts.length !== 3) {
        return escapeHtml(value);
    }


    return `${parts[2]}-${parts[1]}-${parts[0]}`;

}




/* =========================================================
   FILTER EVENTS
========================================================= */

sessionFilter.addEventListener(
    "change",
    async function() {

        await loadStudents();

    }
);


classFilter.addEventListener(
    "change",
    function() {

        renderStudents();

        updateDashboardCounts();

    }
);


studentSearch.addEventListener(
    "input",
    function() {

        renderStudents();

    }
);


studentSort.addEventListener(
    "change",
    function() {

        renderStudents();

    }
);


refreshStudentsButton.addEventListener(
    "click",
    async function() {

        await loadStudents();

        showToast(
            "Student list refreshed.",
            "success"
        );

    }
);




/* =========================================================
   MODAL HELPERS
========================================================= */

function openStudentModal() {

    studentModal.classList.remove(
        "hidden"
    );

}


function closeStudentForm() {

    studentModal.classList.add(
        "hidden"
    );

    editingStudent =
        null;

    studentForm.reset();

}


/* =========================================================
   ADD STUDENT
========================================================= */

addStudentButton.addEventListener(
    "click",
    function() {

        if (currentRole !== "admin") {
            return;
        }


        editingStudent =
            null;


        studentModalTitle.textContent =
            "Add Student";


        studentForm.reset();


        const selectedClass =
            classFilter.value;


        if (
            selectedClass !== "all"
        ) {

            document
                .getElementById(
                    "formClass"
                )
                .value =
                selectedClass;

        }


        document
            .getElementById(
                "formStatus"
            )
            .value =
            "New Student";


        openStudentModal();

    }
);


/* =========================================================
   EDIT STUDENT
========================================================= */

window.editStudent =
    function(academicRecordId) {

        if (currentRole !== "admin") {
            return;
        }


        const student =
            studentsData.find(
                item =>
                    item.academicRecordId ===
                    academicRecordId
            );


        if (!student) {

            showToast(
                "Student record not found.",
                "error"
            );

            return;

        }


        editingStudent =
            student;


        studentModalTitle.textContent =
            "Edit Student";


        document
            .getElementById(
                "formStudentId"
            )
            .value =
            student.studentId;


        document
            .getElementById(
                "formApaarId"
            )
            .value =
            student.apaarId || "";


        document
            .getElementById(
                "formStudentName"
            )
            .value =
            student.studentName;


        document
            .getElementById(
                "formFatherName"
            )
            .value =
            student.fatherName;


        document
            .getElementById(
                "formMotherName"
            )
            .value =
            student.motherName;


        document
            .getElementById(
                "formDob"
            )
            .value =
            student.dob || "";


        document
            .getElementById(
                "formGender"
            )
            .value =
            student.gender;


        document
            .getElementById(
                "formClass"
            )
            .value =
            student.classNo;


        document
            .getElementById(
                "formRoll"
            )
            .value =
            student.rollNo ?? "";


        document
            .getElementById(
                "formStatus"
            )
            .value =
            student.status;


        openStudentModal();

    };


/* =========================================================
   STUDENT DATA VALIDATION & NORMALIZATION
========================================================= */

function normalizeStudentText(value) {
    return String(value ?? "").trim().toUpperCase();
}

function showStudentConflictDialog(title, message) {
    const modal = document.getElementById("studentConflictModal");
    const titleEl = document.getElementById("studentConflictTitle");
    const messageEl = document.getElementById("studentConflictMessage");
    const okButton = document.getElementById("studentConflictOkButton");
    if (!modal || !titleEl || !messageEl || !okButton) {
        showToast(message, "error");
        return;
    }
    titleEl.textContent = title;
    messageEl.innerHTML = message;
    modal.classList.remove("hidden");
    okButton.focus();
}

function closeStudentConflictDialog() {
    const modal = document.getElementById("studentConflictModal");
    if (modal) modal.classList.add("hidden");
}

async function getStudentConflictDetails(studentProfileId, sessionId) {
    const { data, error } = await supabaseClient
        .from("academic_records")
        .select("class_no, roll_no")
        .eq("student_profile_id", studentProfileId)
        .eq("session_id", sessionId)
        .limit(1);
    if (error) throw error;
    return data?.[0] || {};
}

function normalizeStudentFormFields() {
    const ids = [
        "formStudentId",
        "formApaarId",
        "formStudentName",
        "formFatherName",
        "formMotherName"
    ];
    ids.forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = normalizeStudentText(input.value);
    });
    const gender = document.getElementById("formGender");
    if (gender && gender.value) gender.value = normalizeStudentText(gender.value);
}

async function validateStudentUniqueFields({studentId, apaarId, classNo, rollNo, sessionId}) {
    const editingProfileId = editingStudent?.studentProfileId || null;
    const editingRecordId = editingStudent?.academicRecordId || null;

    if (studentId) {
        let query = supabaseClient
            .from("students")
            .select("id, student_name, student_id")
            .eq("student_id", studentId)
            .limit(1);
        if (editingProfileId) query = query.neq("id", editingProfileId);
        const { data, error } = await query;
        if (error) throw error;
        if (data?.length) {
            const existing = data[0];
            const details = await getStudentConflictDetails(existing.id, sessionId);
            throw {
                type: "student-conflict",
                title: "Student ID Already in Use",
                name: existing.student_name || "—",
                classNo: details.class_no,
                rollNo: details.roll_no,
                message: `Student ID <strong>${escapeHtml(studentId)}</strong> is already being used by another student.`
            };
        }
    }

    if (apaarId) {
        let query = supabaseClient
            .from("students")
            .select("id, student_name, apaar_id")
            .eq("apaar_id", apaarId)
            .limit(1);
        if (editingProfileId) query = query.neq("id", editingProfileId);
        const { data, error } = await query;
        if (error) throw error;
        if (data?.length) {
            const existing = data[0];
            const details = await getStudentConflictDetails(existing.id, sessionId);
            throw {
                type: "student-conflict",
                title: "APAAR ID Already in Use",
                name: existing.student_name || "—",
                classNo: details.class_no,
                rollNo: details.roll_no,
                message: `APAAR ID <strong>${escapeHtml(apaarId)}</strong> is already being used by another student.`
            };
        }
    }

    if (rollNo !== null && Number.isInteger(rollNo) && rollNo > 0) {
        let query = supabaseClient
            .from("academic_records")
            .select("id, class_no, roll_no, students ( student_name )")
            .eq("session_id", sessionId)
            .eq("class_no", classNo)
            .eq("roll_no", rollNo)
            .limit(1);
        if (editingRecordId) query = query.neq("id", editingRecordId);
        const { data, error } = await query;
        if (error) throw error;
        if (data?.length) {
            const existing = data[0];
            throw {
                type: "student-conflict",
                title: "Roll Number Already in Use",
                name: existing.students?.student_name || "—",
                classNo: existing.class_no,
                rollNo: existing.roll_no,
                message: `Roll No. <strong>${escapeHtml(String(rollNo))}</strong> is already being used by another student in this class.`
            };
        }
    }
}
/* =========================================================
   SAVE STUDENT
========================================================= */

saveStudentButton.addEventListener(
    "click",
    async function() {

        if (currentRole !== "admin") {

            showToast(
                "Only Admin can modify students.",
                "error"
            );

            return;

        }


        normalizeStudentFormFields();

        const studentName =
            normalizeStudentText(
                document.getElementById("formStudentName").value
            );


        if (!studentName) {

            showToast(
                "Student Name is required.",
                "error"
            );

            return;

        }


        const studentIdRaw =
            normalizeStudentText(
                document.getElementById("formStudentId").value
            );

        const studentId =
            studentIdRaw || null;


        const apaarId =
            normalizeStudentText(
                document.getElementById("formApaarId").value
            ) || null;


        const fatherName =
            normalizeStudentText(
                document.getElementById("formFatherName").value
            ) || null;


        const motherName =
            normalizeStudentText(
                document.getElementById("formMotherName").value
            ) || null;


        const dob =
            document
                .getElementById(
                    "formDob"
                )
                .value || null;


        const gender =
            normalizeStudentText(
                document.getElementById("formGender").value
            ) || null;


        const classNo =
            Number(
                document
                    .getElementById(
                        "formClass"
                    )
                    .value
            );


        const rollRaw =
            document
                .getElementById(
                    "formRoll"
                )
                .value;


        const rollNo =
            rollRaw === ""
                ? null
                : Number(rollRaw);


        const status =
            document
                .getElementById(
                    "formStatus"
                )
                .value;

        if (!Number.isInteger(classNo) || classNo < 1 || classNo > 8) {
            showToast("Please select a valid class.", "error");
            return;
        }

        if (rollNo !== null && (!Number.isInteger(rollNo) || rollNo <= 0)) {
            showToast("Roll Number must be a positive whole number.", "error");
            return;
        }

        const sessionId = Number(sessionFilter.value);
        if (!Number.isInteger(sessionId) || sessionId <= 0) {
            showToast("Please select a valid academic session.", "error");
            return;
        }

        saveStudentButton.disabled =
            true;

        saveStudentButton.textContent =
            "Saving...";


        try {

            await validateStudentUniqueFields({
                studentId,
                apaarId,
                classNo,
                rollNo,
                sessionId
            });

            if (editingStudent) {

                await updateExistingStudent({

                    studentId,
                    apaarId,
                    studentName,
                    fatherName,
                    motherName,
                    dob,
                    gender,
                    classNo,
                    rollNo,
                    status

                });

            } else {

                await createNewStudent({

                    studentId,
                    apaarId,
                    studentName,
                    fatherName,
                    motherName,
                    dob,
                    gender,
                    classNo,
                    rollNo,
                    status

                });

            }


            closeStudentForm();

            await loadStudents();

            showToast(
                "Student saved successfully.",
                "success"
            );


        } catch (error) {

            console.error(error);

            if (error?.type === "student-conflict") {
                showStudentConflictDialog(
                    error.title || "Duplicate Student Data",
                    `${error.message}<br><br><strong>Student Name:</strong> ${escapeHtml(error.name || "—")}<br><strong>Class:</strong> ${escapeHtml(error.classNo ? className(error.classNo) : "—")}<br><strong>Roll No.:</strong> ${escapeHtml(error.rollNo ?? "—")}`
                );
            } else {
                showToast(
                    error.message ||
                    "Unable to save student.",
                    "error"
                );
            }

        } finally {

            saveStudentButton.disabled =
                false;

            saveStudentButton.textContent =
                "Save Student";

        }

    }
);


/* =========================================================
   CREATE NEW STUDENT
========================================================= */

async function createNewStudent(values) {

    const {
        data: student,
        error: studentError
    } =
        await supabaseClient
            .from("students")
            .insert({

                student_id:
                    values.studentId,

                apaar_id:
                    values.apaarId,

                student_name:
                    values.studentName,

                father_name:
                    values.fatherName,

                mother_name:
                    values.motherName,

                date_of_birth:
                    values.dob,

                gender:
                    values.gender

            })
            .select()
            .single();


    if (studentError) {
        throw studentError;
    }


    const sessionId =
        Number(
            sessionFilter.value
        );


    const {
        error: recordError
    } =
        await supabaseClient
            .from("academic_records")
            .insert({

                student_profile_id:
                    student.id,

                session_id:
                    sessionId,

                class_no:
                    values.classNo,

                roll_no:
                    values.rollNo,

                status:
                    values.status

            });


    if (recordError) {

        /*
          If the academic record fails,
          remove the newly-created profile.
        */

        await supabaseClient
            .from("students")
            .delete()
            .eq(
                "id",
                student.id
            );


        throw recordError;

    }

}


/* =========================================================
   UPDATE EXISTING STUDENT
========================================================= */

async function updateExistingStudent(values) {

    const studentProfileId =
        editingStudent.studentProfileId;


    const {
        error: profileError
    } =
        await supabaseClient
            .from("students")
            .update({

                student_id:
                    values.studentId,

                apaar_id:
                    values.apaarId,

                student_name:
                    values.studentName,

                father_name:
                    values.fatherName,

                mother_name:
                    values.motherName,

                date_of_birth:
                    values.dob,

                gender:
                    values.gender,

                updated_at:
                    new Date().toISOString()

            })
            .eq(
                "id",
                studentProfileId
            );


    if (profileError) {
        throw profileError;
    }


    const {
        error: recordError
    } =
        await supabaseClient
            .from("academic_records")
            .update({

                class_no:
                    values.classNo,

                roll_no:
                    values.rollNo,

                status:
                    values.status,

                updated_at:
                    new Date().toISOString()

            })
            .eq(
                "id",
                editingStudent.academicRecordId
            );


    if (recordError) {
        throw recordError;
    }

}


/* =========================================================
   MARK LEFT SCHOOL
========================================================= */

window.markLeft =
    async function(academicRecordId) {

        if (currentRole !== "admin") {
            return;
        }


        const student =
            studentsData.find(
                item =>
                    item.academicRecordId ===
                    academicRecordId
            );


        if (!student) {
            return;
        }


        const confirmed =
            confirm(
                `Mark "${student.studentName}" as Left School for this academic session?\n\nThe student's records will NOT be deleted.`
            );


        if (!confirmed) {
            return;
        }


        const {
            error
        } =
            await supabaseClient
                .from("academic_records")
                .update({

                    status:
                        "Left School",

                    updated_at:
                        new Date().toISOString()

                })
                .eq(
                    "id",
                    academicRecordId
                );


        if (error) {

            showToast(
                error.message,
                "error"
            );

            return;

        }


        await loadStudents();


        showToast(
            "Student marked as Left School.",
            "success"
        );

    };




/* =========================================================
   STUDENT HISTORY
========================================================= */

window.viewHistory =
    async function(studentProfileId) {

        historyModal.classList.remove("hidden");
        historyContent.innerHTML = `<div class="loading">Loading student history...</div>`;

        const gradeForHistory = pct => {
            if (pct === null || Number.isNaN(pct)) return "";
            if (pct >= 80.5) return "A";
            if (pct >= 60.5) return "B";
            if (pct >= 40.5) return "C";
            if (pct >= 32.5) return "D";
            return "E";
        };

        const safeNumber = value => {
            const n = Number(value);
            return Number.isFinite(n) ? n : null;
        };

        const displayValue = value => value === null || value === undefined || value === ""
            ? ""
            : escapeHtml(String(value));

        try {

            const {
                data: records,
                error: recordsError
            } = await supabaseClient
                .from("academic_records")
                .select(`
                    id,
                    session_id,
                    class_no,
                    roll_no,
                    status,
                    academic_sessions (
                        id,
                        session_name
                    )
                `)
                .eq("student_profile_id", studentProfileId)
                .order("session_id", { ascending: true });

            if (recordsError) throw recordsError;

            const student = studentsData.find(
                item => item.studentProfileId === studentProfileId
            );

            if (!records || !records.length) {
                historyContent.innerHTML = `<div class="empty-state">No academic history found.</div>`;
                return;
            }

            const recordIds = records.map(record => record.id);
            const classNos = [...new Set(records.map(record => Number(record.class_no)).filter(Number.isFinite))];

            const [
                marksResult,
                attendanceResult,
                workingDaysResult,
                promotionResult,
                subjectsResult
            ] = await Promise.all([
                supabaseClient
                    .from("exam_marks")
                    .select("academic_record_id, subject_id, examination, marks, full_marks")
                    .in("academic_record_id", recordIds),
                supabaseClient
                    .from("monthly_attendance")
                    .select("academic_record_id, month_no, present_days")
                    .in("academic_record_id", recordIds),
                supabaseClient
                    .from("monthly_working_days")
                    .select("session_id, month_no, working_days")
                    .in("session_id", records.map(record => Number(record.session_id))),
                supabaseClient
                    .from("promotion_history")
                    .select("from_session_id, to_session_id, from_class, to_class, from_roll, to_roll, status")
                    .eq("student_profile_id", studentProfileId),
                supabaseClient
                    .from("subjects")
                    .select("id, class_no, subject_name, display_order")
                    .in("class_no", classNos)
                    .order("display_order", { ascending: true })
            ]);

            if (marksResult.error) throw marksResult.error;
            if (attendanceResult.error) throw attendanceResult.error;
            if (workingDaysResult.error) throw workingDaysResult.error;
            if (promotionResult.error) throw promotionResult.error;
            if (subjectsResult.error) throw subjectsResult.error;

            const marksRows = marksResult.data || [];
            const attendanceRows = attendanceResult.data || [];
            const promotionRows = promotionResult.data || [];
            const subjectRows = subjectsResult.data || [];

            const recordMap = new Map(records.map(record => [String(record.id), record]));
            const subjectMap = new Map(subjectRows.map(subject => [String(subject.id), subject]));
            const promotionSessionIds = [
                ...new Set(
                    promotionRows
                        .flatMap(row => [row.from_session_id, row.to_session_id])
                        .filter(id => id !== null && id !== undefined)
                        .map(String)
                )
            ];

            let promotionSessions = [];
            if (promotionSessionIds.length) {
                const { data, error } = await supabaseClient
                    .from("academic_sessions")
                    .select("id, session_name")
                    .in("id", promotionSessionIds.map(Number));
                if (error) throw error;
                promotionSessions = data || [];
            }
            const promotionSessionMap = new Map(
                promotionSessions.map(session => [String(session.id), session.session_name])
            );

            const marksByRecord = {};
            marksRows.forEach(row => {
                if (!marksByRecord[row.academic_record_id]) marksByRecord[row.academic_record_id] = {};
                const exam = String(row.examination || "Other");
                if (!marksByRecord[row.academic_record_id][exam]) {
                    marksByRecord[row.academic_record_id][exam] = [];
                }
                marksByRecord[row.academic_record_id][exam].push(row);
            });

            const workingDaysBySessionMonth = new Map();
            (workingDaysResult.data || []).forEach(row => {
                const key = `${String(row.session_id)}_${Number(row.month_no)}`;
                workingDaysBySessionMonth.set(key, safeNumber(row.working_days));
            });

            const attendanceByRecord = {};
            attendanceRows.forEach(row => {
                if (!attendanceByRecord[row.academic_record_id]) attendanceByRecord[row.academic_record_id] = [];
                const present = safeNumber(row.present_days);
                const record = recordMap.get(String(row.academic_record_id));
                const working = record ? workingDaysBySessionMonth.get(`${String(record.session_id)}_${Number(row.month_no)}`) ?? null : null;
                if (working !== null || present !== null) {
                    attendanceByRecord[row.academic_record_id].push({
                        month: Number(row.month_no),
                        working,
                        present
                    });
                }
            });

            const monthNames = [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            ];

            const calculateExamSummary = (rows, record) => {
                const meaningful = rows.filter(row => row.marks !== null && row.marks !== undefined && row.marks !== "");
                if (!meaningful.length) return { rows: [], total: null, full: null, pct: null, grade: "" };

                let total = 0;
                let full = 0;
                const detailRows = [...meaningful].sort((a, b) => {
                    const sa = subjectMap.get(String(a.subject_id));
                    const sb = subjectMap.get(String(b.subject_id));
                    return Number(sa?.display_order ?? 9999) - Number(sb?.display_order ?? 9999);
                });

                detailRows.forEach(row => {
                    const marks = safeNumber(row.marks);
                    const fm = safeNumber(row.full_marks);
                    if (marks !== null) total += marks;
                    if (fm !== null) full += fm;
                });

                const pct = full > 0 ? (total / full) * 100 : null;
                return {
                    rows: detailRows,
                    total,
                    full,
                    pct,
                    grade: pct === null ? "" : gradeForHistory(pct)
                };
            };

            const calculateSummaryFromRows = rows => {
                const meaningful = (rows || []).filter(row => row.marks !== null && row.marks !== undefined && row.marks !== "");
                if (!meaningful.length) return null;
                let total = 0;
                let full = 0;
                meaningful.forEach(row => {
                    const marks = safeNumber(row.marks);
                    const fm = safeNumber(row.full_marks);
                    if (marks !== null) total += marks;
                    if (fm !== null) full += fm;
                });
                const pct = full > 0 ? (total / full) * 100 : null;
                return { total, full, pct, grade: pct === null ? "" : gradeForHistory(pct) };
            };

            const renderExamSection = record => {
                const examGroups = marksByRecord[record.id] || {};
                const halfRows = examGroups["Half-Yearly"] || examGroups["Half Yearly"] || [];
                const annualRows = examGroups["Annual"] || [];
                const finalRows = examGroups["Final"] || [];
                const derivedFinalRows = finalRows.length ? finalRows : [
                    ...halfRows.map(row => ({ ...row })),
                    ...annualRows.map(row => ({ ...row }))
                ];
                const summaries = [
                    ["Half-Yearly", calculateSummaryFromRows(halfRows)],
                    ["Annual", calculateSummaryFromRows(annualRows)],
                    ["Final", calculateSummaryFromRows(derivedFinalRows)]
                ];
                const cards = summaries.map(([label, summary]) => {
                    if (!summary) return `<div class="history-exam-card"><div class="history-exam-header"><strong>${label}</strong><span>Not Recorded</span></div></div>`;
                    return `<div class="history-exam-card"><div class="history-exam-header"><strong>${label}</strong><span>Total <strong>${displayValue(summary.total)}</strong> &nbsp;•&nbsp; Percentage <strong>${summary.pct === null ? "" : summary.pct.toFixed(2) + "%"}</strong> &nbsp;•&nbsp; Grade <strong>${escapeHtml(summary.grade)}</strong></span></div></div>`;
                }).join("");
                return `<div class="history-subsection"><div class="history-section-label">Marks</div>${cards}</div>`;
            };

            const renderAttendanceSection = record => {
                const rows = (attendanceByRecord[record.id] || []).sort((a, b) => a.month - b.month);
                const working = [...workingDaysBySessionMonth.entries()]
                    .filter(([key]) => key.startsWith(`${String(record.session_id)}_`))
                    .reduce((sum, [, value]) => sum + (value ?? 0), 0);
                const present = rows.reduce((sum, row) => sum + (row.present ?? 0), 0);
                if (!working && !rows.length) {
                    return `<div class="history-subsection"><div class="history-section-label">Attendance</div><div class="history-muted">No attendance recorded.</div></div>`;
                }
                return `
                    <div class="history-subsection">
                        <div class="history-section-label">Attendance</div>
                        <div class="history-attendance-summary">
                            <span><strong>Working Days (Total):</strong> ${working}</span>
                            <span><strong>Present Days (Total):</strong> ${present}</span>
                        </div>
                    </div>
                `;
            };

            const renderPromotionHistory = () => {
                const yearFromSessionName = value => {
                    const match = String(value || "").match(/(\d{4})/);
                    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
                };

                const relevant = [...promotionRows].sort((a, b) => {
                    const aName = promotionSessionMap.get(String(a.from_session_id)) || "";
                    const bName = promotionSessionMap.get(String(b.from_session_id)) || "";
                    const yearDiff = yearFromSessionName(aName) - yearFromSessionName(bName);
                    if (yearDiff !== 0) return yearDiff;

                    const aToName = promotionSessionMap.get(String(a.to_session_id)) || "";
                    const bToName = promotionSessionMap.get(String(b.to_session_id)) || "";
                    return yearFromSessionName(aToName) - yearFromSessionName(bToName);
                });
                if (!relevant.length) {
                    return `<div class="history-subsection"><div class="history-section-label">Promotion History</div><div class="history-muted">No promotion history recorded.</div></div>`;
                }
                return `
                    <div class="history-subsection">
                        <div class="history-section-label">Promotion History</div>
                        <div class="history-promotion-list">
                            ${relevant.map(row => {
                                const fromSession = promotionSessionMap.get(String(row.from_session_id)) || "-";
                                const toSession = row.to_session_id ? (promotionSessionMap.get(String(row.to_session_id)) || "-") : "-";
                                const fromClass = row.from_class ? className(row.from_class) : "-";
                                const toClass = row.to_class ? className(row.to_class) : (row.status || "-");
                                const fromRoll = row.from_roll ?? "-";
                                const toRoll = row.to_roll ?? "-";
                                return `
                                    <div class="history-promotion-item">
                                        <div><strong>${escapeHtml(fromSession)}</strong> · ${escapeHtml(fromClass)} · Roll ${displayValue(fromRoll)}</div>
                                        <div class="history-promotion-arrow">→</div>
                                        <div><strong>${escapeHtml(toSession)}</strong> · ${escapeHtml(toClass)} · Roll ${displayValue(toRoll)}</div>
                                        <div class="history-promotion-status">${escapeHtml(row.status || "Promoted")}</div>
                                    </div>
                                `;
                            }).join("")}
                        </div>
                    </div>
                `;
            };

            let html = "";
            if (student) {
                const currentRecord = [...records].sort((a, b) => Number(b.session_id) - Number(a.session_id))[0];
                html += `
                    <div class="history-student-header">
                        <div>
                            <h3>${escapeHtml(student.studentName)}</h3>
                            <p>
                                Student ID: ${student.studentId ? escapeHtml(student.studentId) : "Blank"}<br>
                                APAAR ID: ${student.apaarId ? escapeHtml(student.apaarId) : "Blank"}
                            </p>
                        </div>
                        <div class="history-current-badge">
                            <span>Current</span>
                            <strong>${escapeHtml(currentRecord?.academic_sessions?.session_name || "-")}</strong>
                            <small>${escapeHtml(currentRecord ? className(currentRecord.class_no) : "-")} · Roll ${displayValue(currentRecord?.roll_no)}</small>
                        </div>
                    </div>
                `;
            }

            html += `<div class="history-timeline">`;
            records.forEach((record, index) => {
                const sessionName = record.academic_sessions?.session_name || "-";
                const isLast = index === records.length - 1;
                html += `
                    <div class="history-year-card ${isLast ? "current-year" : ""}">
                        <div class="history-year-header">
                            <div>
                                <div class="history-year-title">${escapeHtml(sessionName)}</div>
                                <div class="history-year-meta">${escapeHtml(className(record.class_no))} · Roll ${displayValue(record.roll_no)} · ${escapeHtml(record.status || "Current")}</div>
                            </div>
                            ${isLast ? `<span class="history-current-pill">Current</span>` : ""}
                        </div>
                        ${renderExamSection(record)}
                        ${renderAttendanceSection(record)}
                    </div>
                `;
            });
            html += `</div>`;
            html += renderPromotionHistory();

            historyContent.innerHTML = html;

        } catch (error) {
            historyContent.innerHTML = `
                <div class="empty-state">
                    Unable to load history.
                    <br><br>
                    ${escapeHtml(error.message)}
                </div>
            `;
        }
    };


/* =========================================================
   LIVE UPPERCASE INPUTS
========================================================= */

[
    "formStudentId",
    "formApaarId",
    "formStudentName",
    "formFatherName",
    "formMotherName"
].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
        input.addEventListener("input", () => {
            const start = input.selectionStart;
            const end = input.selectionEnd;
            input.value = String(input.value ?? "").toUpperCase();
            try { input.setSelectionRange(start, end); } catch (_) {}
        });
    }
});

/* =========================================================
   STUDENT CONFLICT DIALOG EVENTS
========================================================= */

const studentConflictOkButton = document.getElementById("studentConflictOkButton");
const studentConflictModal = document.getElementById("studentConflictModal");
const studentConflictCloseButton = document.getElementById("studentConflictCloseButton");

if (studentConflictOkButton) studentConflictOkButton.addEventListener("click", closeStudentConflictDialog);
if (studentConflictCloseButton) studentConflictCloseButton.addEventListener("click", closeStudentConflictDialog);
if (studentConflictModal) {
    studentConflictModal.addEventListener("click", event => {
        if (event.target === studentConflictModal) closeStudentConflictDialog();
    });
}

/* =========================================================
   MODAL EVENTS
========================================================= */

closeStudentModal.addEventListener(
    "click",
    closeStudentForm
);


cancelStudentButton.addEventListener(
    "click",
    closeStudentForm
);


closeHistoryModal.addEventListener(
    "click",
    function() {

        historyModal.classList.add(
            "hidden"
        );

    }
);


closeHistoryButton.addEventListener(
    "click",
    function() {

        historyModal.classList.add(
            "hidden"
        );

    }
);



