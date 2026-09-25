/* =========================================================
   DASHBOARD COUNTS
========================================================= */

async function updateDashboardCounts() {
    const body = document.getElementById("dashboardOverviewBody");
    const totalCard = document.getElementById("dashboardTotalStudents");
    const maleCard = document.getElementById("dashboardMaleStudents");
    const femaleCard = document.getElementById("dashboardFemaleStudents");
    const sessionCard = document.getElementById("dashboardAcademicSession");
    const session = sessions.find(x => x.is_active);
    if (!session) {
        if (body) body.innerHTML = `<tr><td colspan="4">No active academic session is available.</td></tr>`;
        if (totalCard) totalCard.textContent = "—";
        if (maleCard) maleCard.textContent = "—";
        if (femaleCard) femaleCard.textContent = "—";
        if (sessionCard) sessionCard.textContent = "—";
        return;
    }

    const { data: records, error } = await supabaseClient.from("academic_records")
        .select("class_no, students(gender)").eq("session_id", session.id);
    if (error) {
        if (body) body.innerHTML = `<tr><td colspan="4">Unable to load dashboard data.</td></tr>`;
        return;
    }

    const classNames = ["Class I","Class II","Class III","Class IV","Class V","Class VI","Class VII","Class VIII"];
    const classStats = Array.from({length:8}, (_,i) => ({classNo:i+1,label:classNames[i],total:0,male:0,female:0}));
    (records || []).forEach(r => {
        const stat = classStats[Number(r.class_no)-1];
        if (!stat) return;
        stat.total++;
        const gender = String(r.students?.gender || "").trim().toLowerCase();
        if (gender === "male" || gender === "m") stat.male++;
        else if (gender === "female" || gender === "f") stat.female++;
    });

    const groupItoV = classStats.slice(0,5).reduce((a,g)=>({total:a.total+g.total,male:a.male+g.male,female:a.female+g.female}),{total:0,male:0,female:0});
    const groupVItoVIII = classStats.slice(5).reduce((a,g)=>({total:a.total+g.total,male:a.male+g.male,female:a.female+g.female}),{total:0,male:0,female:0});

    if (body) {
        const classRows = classStats.map(g => `<tr><td><strong>${g.label}</strong></td><td>${g.total}</td><td>${g.male}</td><td>${g.female}</td></tr>`).join("");
        const groupRows = `<tr class="dashboard-group-row"><td><strong>Classes I–V</strong></td><td>${groupItoV.total}</td><td>${groupItoV.male}</td><td>${groupItoV.female}</td></tr><tr class="dashboard-group-row"><td><strong>Classes VI–VIII</strong></td><td>${groupVItoVIII.total}</td><td>${groupVItoVIII.male}</td><td>${groupVItoVIII.female}</td></tr>`;
        body.innerHTML = classRows + groupRows;
    }

    const totals = classStats.reduce((a,g) => ({
        total: a.total + g.total, male: a.male + g.male, female: a.female + g.female
    }), {total:0,male:0,female:0});
    if(totalCard) totalCard.textContent = totals.total;
    if(maleCard) maleCard.textContent = totals.male;
    if(femaleCard) femaleCard.textContent = totals.female;
    if(sessionCard) sessionCard.textContent = session.session_name;
}

