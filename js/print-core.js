/* =========================================================
   PRINT CORE — SHARED PRINT STATE / DATA / UTILITIES
   Split from the original print module without changing behavior.
========================================================= */

/* =========================================================
   PRINT MODULE
========================================================= */

function resetPrintState(){
    if(printStudentSearch) printStudentSearch.value="";
    if(printStudentInfo) printStudentInfo.textContent="No student selected.";
    if(printStudentSelect) printStudentSelect.innerHTML=`<option value="">Please Select</option>`;
    if(printClass) printClass.value="";
    if(printExam) printExam.value="";
    if(printSession){ const active=sessions.find(s=>s.is_active); printSession.value=active?String(active.id):""; }
    printStudents=[]; printSubjects=[]; printMarks={};
    if(printClassInfo) printClassInfo.textContent="Select session, class and examination.";
}

/* =========================================================
   PRINT MODULE
========================================================= */
function populatePrintSessions() {
    if (!printSession) return;
    const ordered = [...sessions].sort((a, b) => (typeof academicYearStartNumber === "function" ? academicYearStartNumber(a.session_name) : Number(String(a.session_name).slice(0, 4))) - (typeof academicYearStartNumber === "function" ? academicYearStartNumber(b.session_name) : Number(String(b.session_name).slice(0, 4))) || Number(a.id) - Number(b.id));
    printSession.innerHTML = `<option value="">Please Select</option>` + ordered.map(s => `<option value="${escapeHtml(String(s.id))}">${escapeHtml(s.session_name)}</option>`).join("");
    const active = sessions.find(s => s.is_active);
    printSession.value = active ? String(active.id) : "";
}

function printClassName(n){ return className(Number(n)); }

function printGrade(p){ return gradeFromPercentage(p); }

function syncPrintDataFromMarks(){
    if(!printSession || !printClass || !printExam) return;
    printSubjects = marksSubjects || [];
    printStudents = marksRecords || [];
    printMarks = {};
    Object.keys(marksValues || {}).forEach(key => { printMarks[key] = marksValues[key]; });
    filterPrintStudents();
    renderPrintClassInfo();
}

function getPrintMark(recordId,subjectId,exam){
    const key=`${recordId}_${subjectId}_${exam}`;
    const live=marksValues?.[key];
    if(live!==undefined) return live===null||live===""?null:Number(live);
    const v=printMarks[key];
    return v===null||v===undefined?null:Number(v);
}
function calcPrintRecord(record){
    let total=0, entered=0, complete=true;
    printSubjects.forEach(s=>{
        if(printExam.value==="Final"){
            const h=getPrintMark(record.id,s.id,"Half-Yearly");
            const a=getPrintMark(record.id,s.id,"Annual");
            if(h!==null && a!==null) entered++;
            else complete=false;
            total+=(h||0)+(a||0);
        } else {
            const v=getPrintMark(record.id,s.id,printExam.value);
            if(v!==null) entered++;
            else complete=false;
            total+=v||0;
        }
    });
    const max=printSubjects.length*(printExam.value==="Final"?100:50);
    const pct=max?(total/max)*100:0;
    return {total,pct,max,grade:entered?printGrade(pct):"",entered,complete};
}
function filterPrintStudents(){
    if(!printStudentSelect) return;
    const q=(printStudentSearch.value||"").trim().toLowerCase();
    const list=getPrintSortedStudents().filter(r=>{
        const s=r.students||{};
        return !q ||
            String(s.student_id||"").toLowerCase().includes(q) ||
            String(s.student_name||"").toLowerCase().includes(q) ||
            String(r.roll_no??"").toLowerCase().includes(q);
    });
    printStudentSelect.innerHTML=list.length
        ? `<option value="">Please Select${list.length>1 ? ` (${list.length})` : ""}</option>` +
          list.map(r=>`<option value="${r.id}">${escapeHtml(r.students?.student_name||"")}</option>`).join("")
        : `<option value="">Please Select</option><option value="" disabled>No matching student</option>`;

    // Automatically select an exact match, or the only matching student.
    if(list.length){
        const exact=list.find(r=>{
            const s=r.students||{};
            return q && (
                String(s.student_id||"").toLowerCase()===q ||
                String(s.student_name||"").toLowerCase()===q ||
                String(r.roll_no??"").toLowerCase()===q
            );
        });
        if(exact) printStudentSelect.value=String(exact.id);
        else if(list.length===1 && q) printStudentSelect.value=String(list[0].id);
    }
    renderSelectedPrintStudent();
}
function renderSelectedPrintStudent(){
    const r=printStudents.find(x=>String(x.id)===String(printStudentSelect.value));
    if(!r){ printStudentInfo.textContent="No student selected."; return; }
    printStudentInfo.innerHTML=`<strong>${escapeHtml(r.students?.student_name||"")}</strong><br>Roll: ${escapeHtml(r.roll_no??"")} ${r.students?.student_id?`| PEN: ${escapeHtml(r.students.student_id)}`:""} ${r.students?.apaar_id?`| APAAR ID: ${escapeHtml(r.students.apaar_id)}`:""}`;
}
function renderPrintClassInfo(){ printClassInfo.textContent=`${printStudents.length} students • ${printSubjects.length} subjects • ${printExam.value}`; }

let printTitleBeforeJob="";
async function waitForPrintAssets(root){
    const images=[...root.querySelectorAll("img")];
    await Promise.all(images.map(img=>{
        if(img.complete) return Promise.resolve();
        return new Promise(resolve=>{
            const done=()=>resolve();
            img.addEventListener("load",done,{once:true});
            img.addEventListener("error",done,{once:true});
        });
    }));
    if(document.fonts?.ready){
        try{ await document.fonts.ready; }catch(e){}
    }
}

function openPrint(html, suggestedFileName="Student Marks Result"){
    printDocumentHost.innerHTML=`<div class="print-document">${html}</div>`;
    printDocumentHost.querySelectorAll(".folio-print .result-table").forEach(autoFitFolioTable);
    printTitleBeforeJob=document.title;
    document.title=suggestedFileName;
    requestAnimationFrame(async()=>{
        await waitForPrintAssets(printDocumentHost);
        setTimeout(()=>window.print(),50);
    });
}
window.addEventListener("afterprint",()=>{ if(printTitleBeforeJob!==""){ document.title=printTitleBeforeJob; printTitleBeforeJob=""; } });
function getPrintSortedStudents(){
    const list=[...(printStudents||[])];
    const mode=marksSort?.value||"roll_asc";
    return list.sort((a,b)=>{
        const rollA=Number(a.roll_no??999999), rollB=Number(b.roll_no??999999);
        const nameA=String(a.students?.student_name||""), nameB=String(b.students?.student_name||"");
        if(mode==="roll_desc") return rollB-rollA || nameA.localeCompare(nameB,undefined,{sensitivity:"base"});
        if(mode==="name_asc") return nameA.localeCompare(nameB,undefined,{sensitivity:"base"}) || rollA-rollB;
        if(mode==="name_desc") return nameB.localeCompare(nameA,undefined,{sensitivity:"base"}) || rollA-rollB;
        if(mode==="marks_desc" || mode==="marks_asc"){
            const totalA=calcPrintRecord(a).total, totalB=calcPrintRecord(b).total;
            return mode==="marks_desc" ? (totalB-totalA || rollA-rollB) : (totalA-totalB || rollA-rollB);
        }
        return rollA-rollB || nameA.localeCompare(nameB,undefined,{sensitivity:"base"});
    });
}

