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

        <table>

            <thead>

                <tr>

                    <th>Roll No.</th>

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

                    <td>
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

            </tbody>

        </table>

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
            throw new Error(`Student ID ${studentId} is already used by another student.`);
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
            throw new Error(`APAAR ID ${apaarId} is already used by another student.`);
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
            const existingName = data[0]?.students?.student_name || "another student";
            throw new Error(`Roll No. ${rollNo} is already used by ${existingName} in ${className(classNo)} for this academic session.`);
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

            showToast(
                error.message ||
                "Unable to save student.",
                "error"
            );

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

        historyModal.classList.remove(
            "hidden"
        );


        historyContent.innerHTML =
            `<div class="loading">
                Loading student history...
            </div>`;


        try {

            const {
                data,
                error
            } =
                await supabaseClient
                    .from("academic_records")
                    .select(`
                        id,
                        session_id,
                        class_no,
                        roll_no,
                        status,
                        academic_sessions (
                            session_name
                        )
                    `)
                    .eq(
                        "student_profile_id",
                        studentProfileId
                    )
                    .order(
                        "session_id",
                        {
                            ascending: true
                        }
                    );


            if (error) {
                throw error;
            }


            if (!data || !data.length) {

                historyContent.innerHTML =
                    `<div class="empty-state">
                        No academic history found.
                    </div>`;

                return;

            }


            const student =
                studentsData.find(
                    item =>
                        item.studentProfileId ===
                        studentProfileId
                );


            let html = "";


            if (student) {

                html += `

                    <div style="margin-bottom:18px">

                        <h3 style="color:#123b73">
                            ${escapeHtml(
                                student.studentName
                            )}
                        </h3>

                        <p style="font-size:13px;color:#6b7280;line-height:1.7">
                            Student ID:
                            ${
                                student.studentId
                                    ? escapeHtml(
                                        student.studentId
                                      )
                                    : "Blank"
                            }
                            <br>
                            APAAR ID:
                            ${
                                student.apaarId
                                    ? escapeHtml(
                                        student.apaarId
                                      )
                                    : "Blank"
                            }
                        </p>

                    </div>

                `;

            }


            html += `
                <div class="history-list">
            `;


            data.forEach(
                record => {

                    const sessionName =
                        record
                            .academic_sessions
                            ?.session_name ||
                        "-";


                    html += `

                        <div class="history-item">

                            <div class="history-title">
                                ${escapeHtml(
                                    sessionName
                                )}
                            </div>

                            <div class="history-details">

                                Class:
                                <strong>
                                    ${className(
                                        record.class_no
                                    )}
                                </strong>

                                &nbsp; | &nbsp;

                                Roll:
                                <strong>
                                    ${escapeHtml(
                                        record.roll_no ?? ""
                                    )}
                                </strong>

                                &nbsp; | &nbsp;

                                Status:
                                <strong>
                                    ${escapeHtml(
                                        record.status ||
                                        "Current"
                                    )}
                                </strong>

                            </div>

                        </div>

                    `;

                }
            );


            html += `
                </div>
            `;


            historyContent.innerHTML =
                html;


        } catch (error) {

            historyContent.innerHTML =
                `<div class="empty-state">
                    Unable to load history.
                    <br><br>
                    ${escapeHtml(
                        error.message
                    )}
                </div>`;

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
            input.value = normalizeStudentText(input.value);
            try { input.setSelectionRange(start, end); } catch (_) {}
        });
    }
});

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



