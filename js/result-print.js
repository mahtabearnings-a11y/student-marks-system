/* =========================================================
   RESULT PRINT — STUDENT REPORT CARDS
   Split from the original print module without changing behavior.
========================================================= */

let printAttendanceTotals = {};
let printAttendancePeriod = "April–September";

function getPrintAttendanceMonthRange(exam){
    if(exam === "Final") return Array.from({length:12}, (_,i)=>i+1);
    if(exam === "Annual") return [7,8,9,10,11,12];
    return [1,2,3,4,5,6];
}

function getPrintAttendancePeriod(exam){
    if(exam === "Final") return "Apr – Mar";
    if(exam === "Annual") return "Oct – Mar";
    return "Apr – Sept";
}

function getPrintAttendance(recordId){
    return printAttendanceTotals[String(recordId)] || null;
}

async function loadPrintAttendanceData(){
    printAttendanceTotals = {};
    printAttendancePeriod = getPrintAttendancePeriod(printExam?.value || "Half-Yearly");

    // Keep academic record IDs exactly as returned by Supabase. Do not coerce
    // them to Number because some installations may use UUID/text IDs.
    const ids = (printStudents || [])
        .map(r => r?.id)
        .filter(id => id !== undefined && id !== null && String(id) !== "");

    if(!ids.length || typeof supabaseClient === "undefined") return;

    const months = getPrintAttendanceMonthRange(printExam?.value || "Half-Yearly");
    const workingByMonth = {};
    const presentByRecord = {};
    const hasRecordMonth = {};

    // Use the selected print session when available. This is the Marks-page
    // session and is normally the exact session of the printed results.
    const sessionId = printSession?.value ? String(printSession.value) : String(printStudents[0]?.session_id || "");

    try {
        if(sessionId){
            const { data: workingRows, error: workingError } = await supabaseClient
                .from("monthly_working_days")
                .select("month_no, working_days")
                .eq("session_id", sessionId)
                .in("month_no", months);

            if(!workingError){
                (workingRows || []).forEach(row => {
                    const monthNo = Number(row.month_no);
                    const days = row.working_days == null ? null : Number(row.working_days);
                    if(Number.isFinite(days)) workingByMonth[monthNo] = Math.max(0, days);
                });
            }
        }

        // Pull the actual student attendance records. The Attendance page
        // stores present_days per academic_record_id and month_no.
        const { data: attendanceRows, error: attendanceError } = await supabaseClient
            .from("monthly_attendance")
            .select("academic_record_id, month_no, present_days, working_days")
            .in("academic_record_id", ids)
            .in("month_no", months);

        if(!attendanceError){
            (attendanceRows || []).forEach(row => {
                const rid = String(row.academic_record_id);
                const monthNo = Number(row.month_no);
                if(!months.includes(monthNo)) return;

                if(!hasRecordMonth[rid]) hasRecordMonth[rid] = {};
                hasRecordMonth[rid][monthNo] = true;

                const rowWorking = row.working_days == null ? null : Number(row.working_days);
                if(Number.isFinite(rowWorking) && workingByMonth[monthNo] === undefined){
                    workingByMonth[monthNo] = Math.max(0, rowWorking);
                }

                const present = row.present_days == null ? null : Number(row.present_days);
                if(Number.isFinite(present)){
                    if(!presentByRecord[rid]) presentByRecord[rid] = {};
                    presentByRecord[rid][monthNo] = Math.max(0, present);
                }
            });
        }
    } catch(e) {
        // Printing must continue even when attendance data cannot be fetched.
    }

    ids.forEach(id => {
        const rid = String(id);
        let working = 0;
        let present = 0;
        let hasAny = false;

        months.forEach(monthNo => {
            const monthWorking = Number(workingByMonth[monthNo] || 0);
            const monthPresent = presentByRecord[rid]?.[monthNo];

            working += monthWorking;
            if(Number.isFinite(monthPresent)){
                present += monthPresent;
                hasAny = true;
            } else if(hasRecordMonth[rid]?.[monthNo]) {
                // A stored row with a null present value is still attendance
                // data, but contributes zero present days.
                hasAny = true;
            }
        });

        // If Working Days exist for the selected period, that is also useful
        // attendance context even before a student has any present-day row.
        if(!hasAny && working > 0) hasAny = true;

        present = Math.min(present, working || present);
        const absent = Math.max(0, working - present);
        printAttendanceTotals[rid] = {
            working,
            present,
            absent,
            pct: working ? (present / working) * 100 : 0,
            hasAny
        };
    });
}



function resultHeaderHtml(){
    const sessionName = escapeHtml(printSession?.options?.[printSession.selectedIndex]?.text || "");
    const examName = escapeHtml(printExam?.value || "");
    return `<div class="result-header">
        <div class="result-header-top">
            <div class="result-logo-wrap"><img src="./school-logo-polished.png" alt="U.M.S SASAULI URDU" class="result-school-logo"></div>
            <div class="result-header-text">
                <h1>U.M.S SASAULI URDU</h1>
                <div class="result-estd">ESTD. 1986</div>
                <div class="result-location">Muzaffarpur, Bihar</div>
            </div>
        </div>
        <div class="result-divider"></div>
        <div class="result-title">STUDENT RESULT</div>
        <div class="result-session-row">
            <span><b>Academic Session:</b> ${sessionName}</span>
            <span><b>Examination:</b> ${examName}</span>
        </div>
    </div>`;
}

function resultInfoHtml(record, student){
    const name = String(student.student_name || "");
    return `<div class="result-info">
        <div class="result-info-column">
            <div class="result-info-item"><b>PEN / Student ID:</b><span>${escapeHtml(student.student_id||"")}</span></div>
            <div class="result-info-item"><b>APAAR ID:</b><span class="long-value">${escapeHtml(student.apaar_id||"")}</span></div>
            <div class="result-info-item"><b>Class:</b><span>${escapeHtml(printClassName(record.class_no))}</span></div>
            <div class="result-info-item"><b>Student Name:</b><span class="student-name-value">${escapeHtml(name)}</span></div>
            <div class="result-info-item"><b>Roll Number:</b><span>${escapeHtml(record.roll_no??"")}</span></div>
        </div>
        <div class="result-info-column">
            <div class="result-info-item"><b>Father's Name:</b><span class="long-value">${escapeHtml(student.father_name||"")}</span></div>
            <div class="result-info-item"><b>Mother's Name:</b><span class="long-value">${escapeHtml(student.mother_name||"")}</span></div>
            ${(() => {
                const a = getPrintAttendance(record.id);
                const working = a?.hasAny ? a.working : "—";
                const present = a?.hasAny ? a.present : "—";
                const absent = a?.hasAny ? a.absent : "—";
                const pct = a?.hasAny && a.working ? `${a.pct.toFixed(2)}%` : "—";
                return `
                    <div class="result-info-item result-attendance-period"><b>Attendance:</b><span>${escapeHtml(printAttendancePeriod)}</span></div>
                    <div class="result-info-item result-attendance-row"><b>Working Days:</b><span>${escapeHtml(String(working))}</span></div>
                    <div class="result-info-item result-attendance-row"><b>Present:</b><span>${escapeHtml(String(present))}</span></div>
                    <div class="result-info-item result-attendance-row"><b>Absent:</b><span>${escapeHtml(String(absent))}</span></div>
                    <div class="result-info-item result-attendance-row"><b>Attendance %:</b><span>${escapeHtml(String(pct))}</span></div>
                `;
            })()}
        </div>
    </div>`;
}

function resultSummaryHtml(calc, rank){
    const result = !calc.entered ? "" : (!calc.complete ? "Incomplete" : (calc.grade === "E" ? "Not Passed" : "Passed"));
    return `<div class="result-summary-grid">
        <div class="result-summary-card"><span>Percentage</span><strong>${calc.pct.toFixed(2)}%</strong></div>
        <div class="result-summary-card"><span>Grade</span><strong>${escapeHtml(calc.grade||"")}</strong></div>
        <div class="result-summary-card"><span>Class Rank</span><strong>#${rank}</strong></div>
        <div class="result-summary-card"><span>Result</span><strong>${escapeHtml(result)}</strong></div>
    </div>`;
}

function resultSignatureHtml(){
    return `<div class="result-signatures">
        <div class="result-signature-box">
            <div class="result-signature-line"></div>
            <div class="result-signature-label">Class Teacher's Signature</div>
        </div>
        <div class="result-signature-box">
            <div class="result-signature-line"></div>
            <div class="result-signature-label">Headmaster's Signature</div>
        </div>
    </div>`;
}

function resultHtml(record,pageNo,totalPages){
    const s=record.students||{}, c=calcPrintRecord(record);
    const rank=calcRank(record);
    const isFinal=printExam.value==="Final";
    if(!isFinal){
        const rows=printSubjects.map((sub,index)=>{
            const v=getPrintMark(record.id,sub.id,printExam.value);
            return `<tr><td class="serial-cell">${index+1}</td><td class="subject">${escapeHtml(displaySubjectName(sub.subject_name))}</td><td>${v??""}</td><td>50</td></tr>`;
        }).join("");
        const tableHeader=`<tr><th>Sl. No.</th><th>Subject</th><th>Obtained Marks</th><th>Full Marks</th></tr>`;
        const summaryRows=`<tr class="result-total-row"><th colspan="2">Total</th><td>${c.total}</td><td>${c.max}</td></tr>`;
        return `<div class="result-page">
            ${resultHeaderHtml()}
            ${resultInfoHtml(record,s)}
            <table class="result-table result-table-standard"><colgroup><col class="serial-col"><col class="subject-col"><col class="marks-col"><col class="full-col"></colgroup><thead>${tableHeader}</thead><tbody>${rows}${summaryRows}</tbody></table>
            ${resultSummaryHtml(c,rank)}
            ${resultSignatureHtml()}
        </div>`;
    }
    const markHeader=`<th>Half-Yearly<br>/ 50</th><th>Annual<br>/ 50</th><th>Total<br>/ 100</th><th>Full Marks</th>`;
    const finalRows=printSubjects.map((sub,index)=>{
        const hv=getPrintMark(record.id,sub.id,"Half-Yearly"), av=getPrintMark(record.id,sub.id,"Annual");
        const subjectTotal=(hv!==null || av!==null) ? (hv||0)+(av||0) : "";
        return {index, hv, av, subjectTotal, subject:displaySubjectName(sub.subject_name)};
    });
    const rows=finalRows.map(({index,hv,av,subjectTotal,subject})=>{
        return `<tr><td class="serial-cell">${index+1}</td><td class="subject">${escapeHtml(subject)}</td><td>${hv??""}</td><td>${av??""}</td><td>${subjectTotal}</td><td>100</td></tr>`;
    }).join("");
    const halfYearlyTotal=finalRows.reduce((sum,row)=>sum+(row.hv||0),0);
    const annualTotal=finalRows.reduce((sum,row)=>sum+(row.av||0),0);
    const combinedTotal=finalRows.reduce((sum,row)=>sum+(Number(row.subjectTotal)||0),0);
    const tableHeader=`<tr><th>Sl.<br>No.</th><th>Subject</th>${markHeader}</tr>`;
    const summaryRows=`<tr class="result-total-row"><th colspan="2">Total</th><td>${halfYearlyTotal}</td><td>${annualTotal}</td><td>${combinedTotal}</td><td>${c.max}</td></tr>`;
    return `<div class="result-page">
        ${resultHeaderHtml()}
        ${resultInfoHtml(record,s)}
        <table class="result-table final-result-table"><colgroup><col class="serial-col"><col class="subject-col"><col class="marks-col"><col class="marks-col"><col class="marks-col"><col class="full-col"></colgroup><thead>${tableHeader}</thead><tbody>${rows}${summaryRows}</tbody></table>
        ${resultSummaryHtml(c,rank)}
        ${resultSignatureHtml()}
    </div>`;
}
function calcRank(record){ const ranked=printStudents.map(r=>({r,c:calcPrintRecord(r)})).sort((a,b)=>b.c.total-a.c.total||b.c.pct-a.c.pct||Number(a.r.roll_no??999999)-Number(b.r.roll_no??999999)); return ranked.findIndex(x=>x.r.id===record.id)+1; }

async function printOneStudent(){
    const r=printStudents.find(x=>String(x.id)===String(printStudentSelect.value));
    if(!r){showToast("Please select a student.","error");return;}
    await loadPrintAttendanceData();
    const studentName=(r.students?.student_name||"Student").trim();
    openPrint(resultHtml(r,1,1), `${studentName} Marks Result`);
}
async function printAllStudents(){
    if(!printStudents.length){showToast("No students found.","error");return;}
    await loadPrintAttendanceData();
    const ordered=getPrintSortedStudents();
    const total=ordered.length;
    const classLabel=printClassName(Number(printClass.value));
    openPrint(ordered.map((r,i)=>resultHtml(r,i+1,total)).join(""), `${classLabel} ${printExam.value} Results`);
}

