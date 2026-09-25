/* =========================================================
   PROMOTION MODULE
========================================================= */
const promotionSession = document.getElementById("promotionSession");
const promotionClass = document.getElementById("promotionClass");
const promotionSort = document.getElementById("promotionSort");
const promoteStudentsButton = document.getElementById("promoteStudentsButton");
const promotionBackButton = document.getElementById("promotionBackButton");
const confirmPromotionButton = document.getElementById("confirmPromotionButton");
const promotionMessage = document.getElementById("promotionMessage");
const promotionListCard = document.getElementById("promotionListCard");
const promotionReviewCard = document.getElementById("promotionReviewCard");
const promotionTableContainer = document.getElementById("promotionTableContainer");
const promotionReviewContainer = document.getElementById("promotionReviewContainer");
const promotionRecordCount = document.getElementById("promotionRecordCount");
const promotionReviewInfo = document.getElementById("promotionReviewInfo");
const promotionHistoryContainer = document.getElementById("promotionHistoryContainer");
const promotionHistoryCount = document.getElementById("promotionHistoryCount");
const refreshPromotionHistoryButton = document.getElementById("refreshPromotionHistoryButton");

let promotionStudents = [];
let promotionReviewRows = [];
let promotionHistoryRows = [];

function populatePromotionSessions(){
    if(!promotionSession) return;
    promotionSession.innerHTML = `<option value="">Please Select</option>` + sortAcademicSessions(sessions).map(s=>`<option value="${escapeHtml(String(s.id))}">${escapeHtml(s.session_name)}</option>`).join("");
}

function sortAcademicSessions(list) {
    return [...list].sort((a,b)=>{
        const da=a.start_date?new Date(a.start_date).getTime():0;
        const db=b.start_date?new Date(b.start_date).getTime():0;
        return da-db || Number(a.id)-Number(b.id);
    });
}

function getNextSession(sourceId){
    const ordered=sortAcademicSessions(sessions);
    const idx=ordered.findIndex(s=>String(s.id)===String(sourceId));
    return idx>=0 ? ordered[idx+1] || null : null;
}

async function getPromotionMarks(records, subjects){
    const marks={};
    const ids=records.map(r=>r.id);
    if(!ids.length || !subjects.length) return marks;
    const {data,error}=await supabaseClient.from("exam_marks")
        .select("academic_record_id,subject_id,examination,marks")
        .in("academic_record_id",ids).in("subject_id",subjects.map(s=>s.id));
    if(error) throw error;
    (data||[]).forEach(m=>marks[`${m.academic_record_id}_${m.subject_id}_${m.examination}`]=m.marks===null?null:Number(m.marks));
    return marks;
}

function promotionCalc(record, subjects, marks){
    let total=0, entered=0;
    subjects.forEach(sub=>{
        const h=marks[`${record.id}_${sub.id}_Half-Yearly`];
        const a=marks[`${record.id}_${sub.id}_Annual`];
        if(h!==null && h!==undefined) entered++;
        if(a!==null && a!==undefined) entered++;
        total+=(h||0)+(a||0);
    });
    const max=subjects.length*100;
    const pct=max?(total/max)*100:0;
    return {total,pct,grade:entered?gradeFromPercentage(pct):""};
}

async function loadPromotionStudents(){
    if(!promotionSession || !promotionClass) return;
    const sessionId=Number(promotionSession.value), classNo=Number(promotionClass.value);
    if(!sessionId || !classNo) return;
    promotionMessage.textContent="Loading students...";
    promotionListCard.classList.add("hidden");
    promotionReviewCard.classList.add("hidden");
    const {data:records,error}=await supabaseClient.from("academic_records")
        .select("id,student_profile_id,session_id,class_no,roll_no,status,students(id,student_id,apaar_id,student_name,father_name,mother_name,date_of_birth,gender)")
        .eq("session_id",sessionId).eq("class_no",classNo).order("roll_no",{ascending:true});
    if(error){promotionMessage.textContent="Unable to load students: "+error.message;showToast("Unable to load promotion data.","error");return;}
    const {data:subjects,error:se}=await supabaseClient.from("subjects").select("id,subject_name,display_order").eq("class_no",classNo).order("display_order",{ascending:true});
    if(se){promotionMessage.textContent="Unable to load subjects: "+se.message;return;}
    let marks={};
    try{marks=await getPromotionMarks(records||[],subjects||[]);}catch(e){promotionMessage.textContent="Unable to load marks: "+e.message;return;}
    promotionStudents=(records||[]).map(r=>({...r,calc:promotionCalc(r,subjects||[],marks)}));
    const ranked=[...promotionStudents].sort((a,b)=>b.calc.total-a.calc.total||String(a.students?.student_name||"").localeCompare(String(b.students?.student_name||"")));
    const rankMap=new Map(ranked.map((r,i)=>[r.id,i+1]));
    promotionStudents.forEach(r=>r.rank=rankMap.get(r.id));
    renderPromotionStudents();
    promotionMessage.textContent=classNo===8
        ? "Class VIII students complete Class VIII here. Their historical records will be retained; no Class IX record will be created."
        : "Select the students you want to process, then choose Promote Students to review the proposed next class and roll numbers.";
}

function getSortedPromotionStudents(){
    const list=[...promotionStudents];
    const mode=promotionSort?.value || "roll_asc";
    return list.sort((a,b)=>{
        if(mode==="roll_asc") return Number(a.roll_no??999999)-Number(b.roll_no??999999) || String(a.students?.student_name||"").localeCompare(String(b.students?.student_name||""));
        if(mode==="roll_desc") return Number(b.roll_no??-1)-Number(a.roll_no??-1) || String(a.students?.student_name||"").localeCompare(String(b.students?.student_name||""));
        if(mode==="name_asc") return String(a.students?.student_name||"").localeCompare(String(b.students?.student_name||""),undefined,{sensitivity:"base"}) || Number(a.roll_no??999999)-Number(b.roll_no??999999);
        if(mode==="name_desc") return String(b.students?.student_name||"").localeCompare(String(a.students?.student_name||""),undefined,{sensitivity:"base"}) || Number(a.roll_no??999999)-Number(b.roll_no??999999);
        if(mode==="marks_desc") return b.calc.total-a.calc.total || Number(a.roll_no??999999)-Number(b.roll_no??999999);
        if(mode==="marks_asc") return a.calc.total-b.calc.total || Number(a.roll_no??999999)-Number(b.roll_no??999999);
        if(mode==="percentage_desc") return b.calc.pct-a.calc.pct || Number(a.roll_no??999999)-Number(b.roll_no??999999);
        if(mode==="percentage_asc") return a.calc.pct-b.calc.pct || Number(a.roll_no??999999)-Number(b.roll_no??999999);
        if(mode==="rank_asc") return Number(a.rank??999999)-Number(b.rank??999999) || Number(a.roll_no??999999)-Number(b.roll_no??999999);
        return Number(a.roll_no??999999)-Number(b.roll_no??999999);
    });
}

function renderPromotionStudents(){
    if(!promotionTableContainer)return;
    const rows=getSortedPromotionStudents().map(r=>`<tr>
        <td><input type="checkbox" class="promotion-select" data-record-id="${r.id}" checked></td>
        <td>${escapeHtml(r.roll_no??"")}</td>
        <td>${escapeHtml(r.students?.student_name||"")}</td>
        <td>${escapeHtml(r.students?.student_id||"")}</td>
        <td>${r.calc.total}</td><td>${r.calc.pct.toFixed(2)}%</td><td>${escapeHtml(r.calc.grade)}</td><td>${r.rank||""}</td>
        <td>${escapeHtml(r.status||"")}</td>
    </tr>`).join("");
    promotionTableContainer.innerHTML=`<table class="promotion-table"><thead><tr><th>Select</th><th>Current Roll</th><th>Student Name</th><th>Student ID</th><th>Final Total</th><th>%</th><th>Grade</th><th>Rank</th><th>Status</th></tr></thead><tbody>${rows||`<tr><td colspan="9">No students found.</td></tr>`}</tbody></table>`;
    promotionRecordCount.textContent=`${promotionStudents.length} student${promotionStudents.length===1?"":"s"} found`;
    promotionListCard.classList.remove("hidden");
}

function selectedPromotionStudents(){
    const ids=new Set([...document.querySelectorAll(".promotion-select:checked")].map(x=>String(x.dataset.recordId)));
    return promotionStudents.filter(r=>ids.has(String(r.id)));
}

function defaultPromotionStatus(sourceClass){ return sourceClass===8 ? "Completed" : "Promoted"; }

function openPromotionReview(){
    const selected=selectedPromotionStudents();
    if(!selected.length){showToast("Select at least one student.","error");return;}
    const sourceClass=Number(promotionClass.value), sourceSession=promotionSession.value;
    const source = sessions.find(s=>String(s.id)===String(sourceSession));
    const next=getNextSession(sourceSession);
    if(!source){showToast("Select a valid source academic year.","error");return;}
    if(!source.is_closed){
        showStudentConflictDialog("Promotion Not Allowed", "Please close the current academic year before starting the promotion.");
        promotionMessage.textContent = `Promotion is protected until ${source.session_name} is closed. Historical records must be finalized first.`;
        return;
    }
    if(sourceClass!==8 && !next){
        showToast("Create the next academic year before confirming promotion.","error");
        promotionMessage.textContent="No later academic year is available. Create the next academic year first, then return here.";
        return;
    }
    if(sourceClass!==8 && next.is_closed){
        showToast("The next academic year is closed. Activate or prepare a writable destination year first.","error");
        return;
    }
    const ordered=[...selected].sort((a,b)=>a.rank-b.rank||Number(a.roll_no??999999)-Number(b.roll_no??999999));
    promotionReviewRows=ordered.map((r,i)=>({
        recordId:r.id,studentProfileId:r.student_profile_id,name:r.students?.student_name||"",rank:r.rank,
        status:defaultPromotionStatus(sourceClass),
        classNo:sourceClass===8?8:sourceClass+1,
        rollNo:sourceClass===8?"":i+1
    }));
    renderPromotionReview();
    promotionListCard.classList.add("hidden");
    promotionReviewCard.classList.remove("hidden");
    promotionReviewInfo.textContent=sourceClass===8
        ? `${selected.length} student${selected.length===1?"":"s"} selected • Class VIII completion`
        : `${selected.length} student${selected.length===1?"":"s"} selected • Proposed destination: ${next.session_name}`;
}

function renderPromotionReview(){
    const sourceClass=Number(promotionClass.value);
    const classOptions=Array.from({length:8},(_,i)=>`<option value="${i+1}">Class ${className(i+1).replace(/^Class\s*/i,"")}</option>`).join("");
    promotionReviewContainer.innerHTML=`<table class="promotion-table"><thead><tr><th>Student</th><th>Rank</th><th>Status</th><th>Proposed Class</th><th>Proposed Roll</th></tr></thead><tbody>${promotionReviewRows.map((r,i)=>{
        const opts=sourceClass===8
            ? `<option value="8" selected>Class VIII – Completed</option>`
            : classOptions.replace(`value="${r.classNo}"`,`value="${r.classNo}" selected`);
        const statusOpts=sourceClass===8
            ? `<option value="Completed" ${r.status==="Completed"?"selected":""}>Completed</option><option value="Left School" ${r.status==="Left School"?"selected":""}>Left School</option>`
            : `<option value="Promoted" ${r.status==="Promoted"?"selected":""}>Promoted</option><option value="Repeated" ${r.status==="Repeated"?"selected":""}>Repeated</option><option value="Left School" ${r.status==="Left School"?"selected":""}>Left School</option>`;
        return `<tr><td style="text-align:left"><strong>${escapeHtml(r.name)}</strong></td><td>${r.rank}</td><td><select class="promotion-review-status" data-index="${i}">${statusOpts}</select></td><td><select class="promotion-review-class" data-index="${i}" ${sourceClass===8||r.status==='Left School'?"disabled":""}>${opts}</select></td><td><input class="promotion-roll" data-index="${i}" type="text" inputmode="numeric" value="${escapeHtml(r.rollNo)}" ${sourceClass===8||r.status==='Left School'?"disabled":""}></td></tr>`;
    }).join("")}</tbody></table>`;
    promotionReviewContainer.querySelectorAll(".promotion-review-status").forEach(el=>el.addEventListener("change",()=>{
        const i=Number(el.dataset.index);
        promotionReviewRows[i].status=el.value;
        if(Number(promotionClass.value)!==8){
            if(el.value==="Promoted") promotionReviewRows[i].classNo=Number(promotionClass.value)+1;
            else promotionReviewRows[i].classNo=Number(promotionClass.value);
        }
        if(el.value==="Left School") promotionReviewRows[i].rollNo="";
        renderPromotionReview();
    }));
    promotionReviewContainer.querySelectorAll(".promotion-review-class").forEach(el=>el.addEventListener("change",()=>{promotionReviewRows[Number(el.dataset.index)].classNo=Number(el.value);}));
    promotionReviewContainer.querySelectorAll(".promotion-roll").forEach(el=>el.addEventListener("input",()=>{promotionReviewRows[Number(el.dataset.index)].rollNo=el.value.replace(/\D/g,"");}));
}

async function confirmPromotion(){
    if(currentRole!=="admin"){showToast("Only an Admin can confirm promotion.","error");return;}
    if(!promotionReviewRows.length)return;
    const sourceSessionId=Number(promotionSession.value), sourceClass=Number(promotionClass.value), next=getNextSession(sourceSessionId);
    if(sourceClass!==8 && !next){showToast("Create the next academic year first.","error");return;}
    if(sourceClass!==8 && next.is_closed){showToast("The destination academic year is closed.","error");return;}
    const bad=promotionReviewRows.find(r=>r.status!=="Left School" && sourceClass!==8 && (!r.rollNo || Number(r.rollNo)<1 || Number(r.classNo)<1 || Number(r.classNo)>8));
    if(bad){showToast(`Please enter a valid class and roll for ${bad.name}.`,"error");return;}

    const source = sessions.find(s=>Number(s.id)===sourceSessionId);
    if(!source?.is_closed){
        showStudentConflictDialog("Promotion Not Allowed", "Please close the current academic year before starting the promotion.");
        return;
    }
    const message=sourceClass===8
        ? `Complete ${promotionReviewRows.length} selected Class VIII student${promotionReviewRows.length===1?"":"s"}? Their historical data will remain unchanged.`
        : `Confirm promotion for ${promotionReviewRows.length} selected student${promotionReviewRows.length===1?"":"s"} to ${next.session_name}? A new academic record will be created for each selected student.`;
    if(!confirm(message))return;

    const passwordVerified = await requireAdminPasswordForAction({
        title: "Confirm Promotion",
        message: `Enter your Recycle Bin permanent-deletion password to finalize this promotion batch from ${source?.session_name || "the selected academic year"}.`,
        actionLabel: "Confirm Promotion"
    });
    if(!passwordVerified) return;

    confirmPromotionButton.disabled=true;
    try{
        const batchId = crypto.randomUUID();
        const rows = promotionReviewRows.map(row => ({
            source_record_id: row.recordId,
            student_profile_id: row.studentProfileId,
            status: row.status,
            class_no: row.status === "Left School" ? Number(promotionClass.value) : Number(row.classNo),
            roll_no: row.status === "Left School" ? null : (row.rollNo === "" ? null : Number(row.rollNo))
        }));

        const { data, error } = await supabaseClient.rpc("promote_students_batch", {
            p_source_session_id: sourceSessionId,
            p_destination_session_id: sourceClass === 8 ? null : Number(next.id),
            p_rows: rows,
            p_batch_id: batchId
        });
        if(error) throw error;

        showToast(sourceClass===8?"Class VIII completion saved successfully.":"Promotion confirmed successfully.","success");
        resetPromotionState();
        promotionMessage.textContent=sourceClass===8?"Class VIII completion has been recorded. Historical data remains preserved.":"Promotion completed successfully. Historical data remains preserved.";
        await loadSessions();
        await loadPromotionStudents();
        await loadPromotionHistory();
        await loadStudents();
        if (typeof updateDashboardCounts === "function") await updateDashboardCounts();
        void data;
    }catch(e){
        showToast("Promotion could not be completed: "+e.message,"error");
    }finally{confirmPromotionButton.disabled=false;}
}

async function loadPromotionHistory(){
    if(!promotionHistoryContainer || currentRole!=="admin") return;
    promotionHistoryContainer.innerHTML = `<div class="loading">Loading promotion history...</div>`;
    try {
        const {data, error} = await supabaseClient
            .from("promotion_history")
            .select("id,student_profile_id,from_session_id,to_session_id,from_class,to_class,from_roll,to_roll,status,batch_id,created_at,reverted_at")
            .order("created_at", {ascending:false});
        if(error) throw error;
        promotionHistoryRows = data || [];

        const studentIds = [...new Set(promotionHistoryRows.map(row=>row.student_profile_id).filter(Boolean))];
        const sessionIds = [...new Set(promotionHistoryRows.flatMap(row=>[row.from_session_id,row.to_session_id]).filter(Boolean))];
        const [studentResult, sessionResult] = await Promise.all([
            studentIds.length ? supabaseClient.from("students").select("id,student_name,student_id").in("id", studentIds) : Promise.resolve({data:[],error:null}),
            sessionIds.length ? supabaseClient.from("academic_sessions").select("id,session_name").in("id", sessionIds) : Promise.resolve({data:[],error:null})
        ]);
        if(studentResult.error) throw studentResult.error;
        if(sessionResult.error) throw sessionResult.error;
        const studentsMap = new Map((studentResult.data||[]).map(s=>[String(s.id),s]));
        const sessionsMap = new Map((sessionResult.data||[]).map(s=>[String(s.id),s]));

        if(!promotionHistoryRows.length){
            promotionHistoryCount.textContent = "0 records";
            promotionHistoryContainer.innerHTML = `<div class="empty-state">No promotion history found.</div>`;
            return;
        }

        const grouped = [];
        const batches = new Map();
        promotionHistoryRows.forEach(row=>{
            const key = row.batch_id || `legacy-${row.id}`;
            if(!batches.has(key)) batches.set(key, []);
            batches.get(key).push(row);
        });
        batches.forEach((rows,key)=>grouped.push({key,rows,createdAt:rows.map(r=>r.created_at).filter(Boolean).sort().reverse()[0] || null}));
        grouped.sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));

        promotionHistoryCount.textContent = `${promotionHistoryRows.length} record${promotionHistoryRows.length===1?"":"s"} in ${grouped.length} batch${grouped.length===1?"":"es"}`;
        promotionHistoryContainer.innerHTML = `<table class="promotion-history-table"><thead><tr><th>Date</th><th>Student(s)</th><th>From</th><th>To</th><th>Status</th><th>Action</th></tr></thead><tbody>${grouped.map(group=>{
            const first=group.rows[0];
            const names=group.rows.slice(0,4).map(r=>studentsMap.get(String(r.student_profile_id))?.student_name||"Unknown");
            const extra=group.rows.length>4?` +${group.rows.length-4}`:"";
            const fromName=sessionsMap.get(String(first.from_session_id))?.session_name||"—";
            const toName=first.to_session_id? (sessionsMap.get(String(first.to_session_id))?.session_name||"—") : "Completed";
            const statuses=[...new Set(group.rows.map(r=>r.status))].join(", ");
            const reversible = Boolean(first.batch_id) && group.rows.every(r=>!r.reverted_at && (r.status !== "Reverted"));
            const action = reversible ? `<button class="btn btn-danger btn-small promotion-revert" data-batch-id="${escapeHtml(String(first.batch_id))}">Revert Batch</button>` : (group.rows.every(r=>r.reverted_at) ? `<span class="academic-year-status academic-year-status-closed">Reverted</span>` : "—");
            return `<tr><td>${formatPromotionDate(group.createdAt)}</td><td>${escapeHtml(names.join(", ")+extra)}</td><td>${escapeHtml(fromName)} • Class ${escapeHtml(String(first.from_class ?? ""))}</td><td>${escapeHtml(toName)}${first.to_class?` • Class ${escapeHtml(String(first.to_class))}`:""}</td><td>${escapeHtml(statuses)}</td><td>${action}</td></tr>`;
        }).join("")}</tbody></table>`;
        promotionHistoryContainer.querySelectorAll(".promotion-revert").forEach(button=>button.addEventListener("click",()=>revertPromotionBatch(button.dataset.batchId)));
    } catch(error) {
        promotionHistoryContainer.innerHTML = `<div class="empty-state">Unable to load promotion history.<br><br>${escapeHtml(error.message||"Unknown error")}</div>`;
    }
}

function formatPromotionDate(value){
    if(!value) return "—";
    const date=new Date(value);
    if(Number.isNaN(date.getTime())) return escapeHtml(value);
    return date.toLocaleString("en-IN",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
}

async function revertPromotionBatch(batchId){
    if(!batchId) return;
    const verified = await requireAdminPasswordForAction({
        title: "Revert Promotion",
        message: "Enter your Recycle Bin permanent-deletion password to revert this promotion batch. The new academic records will be removed only when they contain no Marks or Attendance.",
        actionLabel: "Revert Promotion"
    });
    if(!verified) return;

    if(!confirm("Revert this promotion batch? Historical academic records from the previous year will not be changed.")) return;

    try {
        const {error} = await supabaseClient.rpc("revert_promotion_batch", {p_batch_id: batchId});
        if(error) throw error;
        showToast("Promotion batch reverted successfully.", "success");
        await loadSessions();
        await loadPromotionStudents();
        await loadPromotionHistory();
        await loadStudents();
        if (typeof updateDashboardCounts === "function") await updateDashboardCounts();
    } catch(error) {
        showToast(error.message || "Promotion could not be reverted.", "error");
    }
}

if(promotionSession)promotionSession.addEventListener("change",loadPromotionStudents);
if(promotionClass)promotionClass.addEventListener("change",loadPromotionStudents);
if(promotionSort)promotionSort.addEventListener("change",renderPromotionStudents);
if(promoteStudentsButton)promoteStudentsButton.addEventListener("click",openPromotionReview);
if(promotionBackButton)promotionBackButton.addEventListener("click",()=>{promotionReviewCard.classList.add("hidden");promotionListCard.classList.remove("hidden");});
if(confirmPromotionButton)confirmPromotionButton.addEventListener("click",confirmPromotion);
if(refreshPromotionHistoryButton)refreshPromotionHistoryButton.addEventListener("click",loadPromotionHistory);

function resetPromotionState(){
    const active = sessions.find(s => s.is_active);
    if (promotionSession) promotionSession.value = active ? String(active.id) : (sessions[0] ? String(sessions[0].id) : "");
    if (promotionClass) promotionClass.value = "1";
    if (promotionSort) promotionSort.value = "";
    promotionStudents = [];
    promotionReviewRows = [];
    if (promotionListCard) promotionListCard.classList.add("hidden");
    if (promotionReviewCard) promotionReviewCard.classList.add("hidden");
    if (promotionMessage) promotionMessage.textContent = "Select a session and class. Students will appear automatically.";
    if (promotionTableContainer) promotionTableContainer.innerHTML = "";
    if (promotionReviewContainer) promotionReviewContainer.innerHTML = "";
}
