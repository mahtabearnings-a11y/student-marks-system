/* =========================================================
   LOAD SESSIONS
========================================================= */

async function loadSessions() {

    const {
        data,
        error
    } =
        await supabaseClient
            .from("academic_sessions")
            .select(
                "id, session_name, is_active"
            )
            .order(
                "session_name",
                {
                    ascending: false
                }
            );


    if (error) {
        throw error;
    }


    sessions =
        data || [];


    sessionFilter.innerHTML =
        "";


    sessions.forEach(
        session => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                session.id;

            option.textContent =
                session.session_name;

            if (session.is_active) {
                option.selected =
                    true;
            }

            sessionFilter.appendChild(
                option
            );

        }
    );


    if (!sessions.length) {

        sessionFilter.innerHTML =
            `<option value="">No sessions</option>`;

    }

}


/* =========================================================
   CLASS NAME
========================================================= */

function className(classNo) {

    const names = {
        1: "Class I",
        2: "Class II",
        3: "Class III",
        4: "Class IV",
        5: "Class V",
        6: "Class VI",
        7: "Class VII",
        8: "Class VIII"
    };

    return names[classNo] || "-";

}


/* =========================================================
   SECTION NAVIGATION
========================================================= */
function resetStudentsState(){
    if(sessionFilter){ const active=sessions.find(s=>s.is_active); sessionFilter.value=active?String(active.id):""; }
    if(classFilter) classFilter.value="";
    if(studentSearch) studentSearch.value="";
    if(studentSort) studentSort.value="rollAsc";
}
function resetMarksState(){
    if(marksSession){ const active=sessions.find(s=>s.is_active); marksSession.value=active?String(active.id):""; }
    if(marksClass) marksClass.value="1";
    if(marksExam) marksExam.value="Half-Yearly";
    if(marksSort) marksSort.value="roll_asc";
}
function resetModuleState(section){
    if(section==="students") resetStudentsState();
    if(section==="marks") resetMarksState();
    if(section==="reports") resetPrintState();
    if(section==="attendance") resetAttendanceState();
    if(section==="promotion") resetPromotionState();
}


/* =========================================================
   SECTION NAVIGATION
========================================================= */


function showSection(section, options = {}) {
    resetModuleState(section);
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.section === section));
    document.querySelectorAll(".app-section").forEach(item => item.classList.add("hidden"));
    const target = document.getElementById(section + "Section");
    if (target) target.classList.remove("hidden");

    if (options.updateHash !== false && window.location.hash !== "#" + section) {
        window.history.replaceState(null, "", "#" + section);
    }

    if (section === "students") loadStudents();
    if (section === "marks") { populateMarksSessions(); loadMarksGrid(); }
    if (section === "attendance") { populateAttendanceSessions(); renderAttendanceMonthButtons(); }
    if (section === "promotion") { populatePromotionSessions(); loadPromotionStudents(); }
    if (section === "recycleBin") { loadRecycleBin(); }
}


/* =========================================================
   NAVIGATION
========================================================= */

document
    .querySelectorAll(".nav-btn")
    .forEach(
        button => {

            button.addEventListener(
                "click",
                function() {

                    showSection(this.dataset.section);

                }
            );

        }
    );


window.addEventListener(
    "hashchange",
    function() {

        if (!currentUser) {
            return;
        }

        const section = getInitialSection(currentRole);

        if (section === window.location.hash.replace(/^#/, "")) {
            showSection(section, { updateHash: false });
        } else {
            showSection(section);
        }

    }
);



/* =========================================================
   DELETE STUDENT
========================================================= */

window.deleteStudent =
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
                `Are you sure you want to move "${student.studentName}" to the Recycle Bin?\n\nThe student's records will be safely kept in the Recycle Bin and can be restored later.`
            );

        if (!confirmed) {
            return;
        }

        try {

            const { error } =
                await supabaseClient.rpc(
                    "move_student_to_recycle_bin",
                    {
                        p_student_id:
                            student.studentProfileId
                    }
                );

            if (error) {
                throw error;
            }

            await loadStudents();
            await updateDashboardCounts();

            showToast(
                "Student moved to Recycle Bin.",
                "success"
            );

        } catch (error) {

            console.error(error);

            showToast(
                "Unable to move student to Recycle Bin: " +
                error.message,
                "error"
            );

        }

    };


/* =========================================================
   TOAST
========================================================= */

function showToast(
    message,
    type = ""
) {

    toast.textContent =
        message;

    toast.className =
        "toast";

    if (type) {
        toast.classList.add(
            type
        );
    }


    setTimeout(
        function() {

            toast.classList.add(
                "hidden"
            );

        },
        3500
    );

}


/* =========================================================
   INITIALIZE
========================================================= */

async function initializeApplication() {

    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .auth
                .getSession();


        if (error) {
            throw error;
        }


        if (
            data.session &&
            data.session.user
        ) {

            await showApplication(
                data.session.user
            );

        } else {

            showLogin();

        }


    } catch (error) {

        console.error(error);

        showLogin();

    }

}


initializeApplication();
