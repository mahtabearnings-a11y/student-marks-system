/* =========================================================
   PRINT MODULE
========================================================= */

function resetPrintState(){
    if(printStudentSearch) printStudentSearch.value="";
    if(printStudentInfo) printStudentInfo.textContent="No student selected.";
    if(printStudentSelect) printStudentSelect.innerHTML=`<option value="">Select student</option>`;
    if(printClass) printClass.value="1";
    if(printExam) printExam.value="Half-Yearly";
    if(printSession){ const active=sessions.find(s=>s.is_active); if(active) printSession.value=String(active.id); }
    printStudents=[]; printSubjects=[]; printMarks={};
    if(printClassInfo) printClassInfo.textContent="Select session, class and examination.";
}

/* =========================================================
   PRINT MODULE
========================================================= */
function populatePrintSessions() {
    if (!printSession) return;
    printSession.innerHTML = sessions.length ? sessions.map(s => `<option value="${escapeHtml(String(s.id))}">${escapeHtml(s.session_name)}</option>`).join("") : `<option value="">No sessions</option>`;
    const active = sessions.find(s => s.is_active);
    if (active) printSession.value = String(active.id);
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
    let total=0, entered=0;
    printSubjects.forEach(s=>{
        if(printExam.value==="Final"){
            const h=getPrintMark(record.id,s.id,"Half-Yearly"), a=getPrintMark(record.id,s.id,"Annual");
            if(h!==null||a!==null) entered++;
            total+=(h||0)+(a||0);
        } else { const v=getPrintMark(record.id,s.id,printExam.value); if(v!==null) entered++; total+=v||0; }
    });
    const max=printSubjects.length*(printExam.value==="Final"?100:50);
    const pct=max?(total/max)*100:0;
    return {total,pct,max,grade:entered?printGrade(pct):""};
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
        ? `<option value="">${q ? "Select student" : "Select student"}${list.length>1 ? ` (${list.length})` : ""}</option>` +
          list.map(r=>`<option value="${r.id}">${escapeHtml(r.students?.student_name||"")}</option>`).join("")
        : `<option value="">No matching student</option>`;

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
function resultHtml(record,pageNo,totalPages){
    const s=record.students||{}, c=calcPrintRecord(record);
    const isFinal=printExam.value==="Final";
    if(!isFinal){
        const rows=printSubjects.map(sub=>{
            const v=getPrintMark(record.id,sub.id,printExam.value);
            return `<tr><td class="subject">${escapeHtml(sub.subject_name)}</td><td>${v??""}</td><td>50</td></tr>`;
        }).join("");
        const summaryRows=`
          <tr class="result-total-row"><th style="text-align:left;">Total</th><td>${c.total}</td><td>${c.max}</td></tr>
          <tr class="result-total-row"><th style="text-align:left;">Percentage</th><td colspan="2">${c.pct.toFixed(2)}%</td></tr>
          <tr class="result-total-row"><th style="text-align:left;">Grade</th><td colspan="2">${escapeHtml(c.grade)}</td></tr>`;
        const tableHeader=`<tr><th>Subject</th><th>${escapeHtml(printExam.value)} / 50</th><th>Full Marks</th></tr>`;
        return `<div class="result-page"><div class="result-header"><h1>U.M.S SASAULI URDU</h1><h2>Student Result</h2><div class="small">Muzaffarpur, Bihar • Academic Session: ${escapeHtml(printSession.options[printSession.selectedIndex]?.text||"")}</div><div class="small">${escapeHtml(printExam.value)} Examination</div></div><div class="result-info"><div><b>PEN / Student ID:</b> ${escapeHtml(s.student_id||"")}</div><div><b>APAAR ID:</b> ${escapeHtml(s.apaar_id||"")}</div><div><b>Class:</b> ${escapeHtml(printClassName(record.class_no))}</div><div><b>Name:</b> ${escapeHtml(s.student_name||"")}</div><div><b>Roll:</b> ${escapeHtml(record.roll_no??"")}</div><div><b>Father's Name:</b> ${escapeHtml(s.father_name||"")}</div><div><b>Mother's Name:</b> ${escapeHtml(s.mother_name||"")}</div><div><b>Date of Birth:</b> ${escapeHtml(s.date_of_birth||"")}</div></div><table class="result-table"><thead>${tableHeader}</thead><tbody>${rows}${summaryRows}</tbody></table><div class="result-rank"><span class="rank-label">Class Rank</span><span class="rank-value">#${calcRank(record)}</span></div></div>`;
    }
    const markHeader=`<th>Half-Yearly / 50</th><th>Annual / 50</th><th>Final / 100</th><th>Full Marks</th>`;
    const rows=printSubjects.map(sub=>{
        const hv=getPrintMark(record.id,sub.id,"Half-Yearly"), av=getPrintMark(record.id,sub.id,"Annual");
        const finalMark=(hv===null && av===null) ? "" : (hv||0)+(av||0);
        return `<tr><td class="subject">${escapeHtml(sub.subject_name)}</td><td>${hv??""}</td><td>${av??""}</td><td>${finalMark}</td><td>100</td><td></td><td></td><td></td></tr>`;
    }).join("");
    const summaryRow=`<tr class="result-total-row"><th colspan="4" style="text-align:right;">Total Marks</th><td>${c.total} / ${c.max}</td><td>${c.pct.toFixed(2)}%</td><td>${escapeHtml(c.grade)}</td></tr>`;
    const tableHeader=`<tr><th>Subject</th>${markHeader}<th>Total</th><th>Percentage</th><th>Grade</th></tr>`;
    return `<div class="result-page"><div class="result-header"><h1>U.M.S SASAULI URDU</h1><h2>Student Result</h2><div class="small">Muzaffarpur, Bihar • Academic Session: ${escapeHtml(printSession.options[printSession.selectedIndex]?.text||"")}</div><div class="small">Final Examination</div></div><div class="result-info"><div><b>PEN / Student ID:</b> ${escapeHtml(s.student_id||"")}</div><div><b>APAAR ID:</b> ${escapeHtml(s.apaar_id||"")}</div><div><b>Class:</b> ${escapeHtml(printClassName(record.class_no))}</div><div><b>Name:</b> ${escapeHtml(s.student_name||"")}</div><div><b>Roll:</b> ${escapeHtml(record.roll_no??"")}</div><div><b>Father's Name:</b> ${escapeHtml(s.father_name||"")}</div><div><b>Mother's Name:</b> ${escapeHtml(s.mother_name||"")}</div><div><b>Date of Birth:</b> ${escapeHtml(s.date_of_birth||"")}</div></div><table class="result-table"><thead>${tableHeader}</thead><tbody>${rows}${summaryRow}</tbody></table><div class="result-rank"><span class="rank-label">Class Rank</span><span class="rank-value">#${calcRank(record)}</span></div></div>`;
}
function calcRank(record){ const ranked=printStudents.map(r=>({r,c:calcPrintRecord(r)})).sort((a,b)=>b.c.total-a.c.total||b.c.pct-a.c.pct||Number(a.r.roll_no??999999)-Number(b.r.roll_no??999999)); return ranked.findIndex(x=>x.r.id===record.id)+1; }
let printTitleBeforeJob="";
function openPrint(html, suggestedFileName="Student Marks Result"){
    printDocumentHost.innerHTML=`<div class="print-document">${html}</div>`;
    const folioTable=printDocumentHost.querySelector(".folio-print .result-table");
    if(folioTable) autoFitFolioTable(folioTable);
    printTitleBeforeJob=document.title;
    document.title=suggestedFileName;
    window.print();
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

function printOneStudent(){
    const r=printStudents.find(x=>String(x.id)===String(printStudentSelect.value));
    if(!r){showToast("Please select a student.","error");return;}
    const studentName=(r.students?.student_name||"Student").trim();
    openPrint(resultHtml(r,1,1), `${studentName} Marks Result`);
}
function printAllStudents(){
    if(!printStudents.length){showToast("No students found.","error");return;}
    const ordered=getPrintSortedStudents();
    const total=ordered.length;
    const classLabel=printClassName(Number(printClass.value));
    openPrint(ordered.map((r,i)=>resultHtml(r,i+1,total)).join(""), `${classLabel} ${printExam.value} Results`);
}
async function autoFitFolioTable(table){
  if(!table) return;
  const rows=[...table.rows];
  if(!rows.length) return;
  const cols=rows[0].cells.length;
  const weights=new Array(cols).fill(1);
  for(let c=0;c<cols;c++){
    let maxLen=0;
    for(const row of rows){
      const cell=row.cells[c];
      if(!cell) continue;
      const text=(cell.textContent||"").replace(/\s+/g," ").trim();
      maxLen=Math.max(maxLen,text.length);
    }
    if(c===2) weights[c]=Math.max(18,Math.min(maxLen+2,30));
    else if(c===cols-2) weights[c]=12;
    else if(c===cols-1) weights[c]=12;
    else if(c===cols-3) weights[c]=10;
    else if(c<3) weights[c]=c===0?5:c===1?6:20;
    else weights[c]=Math.max(5,Math.min(maxLen+2,8));
  }
  const minPct=11;
  weights[cols-2]=Math.max(weights[cols-2],minPct);
  const total=weights.reduce((a,b)=>a+b,0);
  [...table.rows].forEach(row=>[...row.cells].forEach((cell,c)=>{
    cell.style.width=((weights[c]/total)*100).toFixed(3)+"%";
  }));
}

function printClassFolio(){
    if(!printStudents.length){showToast("No students found.","error");return;}
    const ranked=getPrintSortedStudents();
    const heads=printSubjects.map(s=>`<th class="folio-subject-head"><div class="folio-subject-name-wrap"><span class="folio-subject-name">${escapeHtml(s.subject_name)}</span></div><small>${printExam.value==="Final"?100:50}</small></th>`).join("");
    const rows=ranked.map((r,i)=>{const c=calcPrintRecord(r);return `<tr><td>${i+1}</td><td>${escapeHtml(r.roll_no??"")}</td><td class="name">${escapeHtml(r.students?.student_name||"")}</td>${printSubjects.map(s=>{let v;if(printExam.value==="Final"){v=(getPrintMark(r.id,s.id,"Half-Yearly")||0)+(getPrintMark(r.id,s.id,"Annual")||0);}else v=getPrintMark(r.id,s.id,printExam.value);return `<td>${v??""}</td>`}).join("")}<td>${c.total}</td><td class="percentage-cell">${c.pct.toFixed(2)}%</td><td>${escapeHtml(c.grade)}</td></tr>`;}).join("");
    openPrint(`<div class="result-page folio-print"><div class="result-header"><h1>U.M.S SASAULI URDU</h1><h2>Class Marks Folio</h2><div class="small">Academic Session: ${escapeHtml(printSession.options[printSession.selectedIndex]?.text||"")} • ${escapeHtml(printClassName(Number(printClass.value)))} • ${escapeHtml(printExam.value)}</div></div><table class="result-table"><thead><tr><th>Sl.</th><th>Roll</th><th>Student Name</th>${heads}<th>Total</th><th class="percentage-head">%</th><th>Grade</th></tr></thead><tbody>${rows}</tbody></table></div>`, `${printClassName(Number(printClass.value))} ${printExam.value} Marks Folio`);
}

if (printStudentSearch) printStudentSearch.addEventListener("input", filterPrintStudents);
if (printStudentSelect) printStudentSelect.addEventListener("change", renderSelectedPrintStudent);
if (printStudentButton) printStudentButton.addEventListener("click", printOneStudent);
if (printAllStudentsButton) printAllStudentsButton.addEventListener("click", printAllStudents);
if (printClassFolioButton) printClassFolioButton.addEventListener("click", printClassFolio);
