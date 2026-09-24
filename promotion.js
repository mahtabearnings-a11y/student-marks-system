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
let promotionStudents = [];
let promotionReviewRows = [];

function populatePromotionSessions(){
    if(!promotionSession) return;
    promotionSession.innerHTML = sessions.length
        ? sessions.map(s=>`<option value="${escapeHtml(String(s.id))}">${escapeHtml(s.session_name)}</option>`).join("")
        : `<option value="">No sessions</option>`;
    const active=sessions.find(s=>s.is_active);
    if(active) promotionSession.value=String(active.id);
}

function getNextSession(sourceId){
    const ordered=[...sessions].sort((a,b)=>Number(a.id)-Number(b.id));
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
        .select("id,student_profile_id,class_no,roll_no,status,students(id,student_id,apaar_id,student_name,father_name,mother_name,date_of_birth,gender)")
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
    const next=getNextSession(sourceSession);
    if(sourceClass!==8 && !next){
        showToast("Create the next academic session before confirming promotion.","error");
        promotionMessage.textContent="No later academic session is available. Create the next session first, then return here.";
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
        : `${selected.length} student${selected.length===1?"":"s"} selected • Proposed next session: ${next.session_name}`;
}

function renderPromotionReview(){
    const sourceClass=Number(promotionClass.value);
    const next=getNextSession(promotionSession.value);
    const classOptions=Array.from({length:8},(_,i)=>`<option value="${i+1}">Class ${className(i+1).replace(/^Class\s*/i,"")}</option>`).join("");
    promotionReviewContainer.innerHTML=`<table class="promotion-table"><thead><tr><th>Student</th><th>Rank</th><th>Status</th><th>Proposed Class</th><th>Proposed Roll</th></tr></thead><tbody>${promotionReviewRows.map((r,i)=>{
        const opts=sourceClass===8
            ? `<option value="8" selected>Class VIII – Completed</option>`
            : classOptions.replace(`value="${r.classNo}"`,`value="${r.classNo}" selected`);
        const statusOpts=sourceClass===8
            ? `<option value="Completed" ${r.status==="Completed"?"selected":""}>Completed</option><option value="Left School" ${r.status==="Left School"?"selected":""}>Left School</option>`
            : `<option value="Promoted" ${r.status==="Promoted"?"selected":""}>Promoted</option><option value="Repeated" ${r.status==="Repeated"?"selected":""}>Repeated</option><option value="Left School" ${r.status==="Left School"?"selected":""}>Left School</option>`;
        return `<tr><td style="text-align:left"><strong>${escapeHtml(r.name)}</strong></td><td>${r.rank}</td><td><select class="promotion-review-status" data-index="${i}">${statusOpts}</select></td><td><select class="promotion-review-class" data-index="${i}" ${sourceClass===8?"disabled":""}>${opts}</select></td><td><input class="promotion-roll" data-index="${i}" type="text" inputmode="numeric" value="${escapeHtml(r.rollNo)}" ${sourceClass===8?"disabled":""}></td></tr>`;
    }).join("")}</tbody></table>`;
    promotionReviewContainer.querySelectorAll(".promotion-review-status").forEach(el=>el.addEventListener("change",()=>{
        const i=Number(el.dataset.index);promotionReviewRows[i].status=el.value;
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
    if(sourceClass!==8 && !next){showToast("Create the next academic session first.","error");return;}
    const bad=promotionReviewRows.find(r=>r.status!=="Left School" && sourceClass!==8 && (!r.rollNo || Number(r.rollNo)<1 || Number(r.classNo)<1 || Number(r.classNo)>8));
    if(bad){showToast(`Please enter a valid class and roll for ${bad.name}.`,"error");return;}
    const message=sourceClass===8
        ? `Complete ${promotionReviewRows.length} selected Class VIII student${promotionReviewRows.length===1?"":"s"}? Their historical data will remain unchanged.`
        : `Confirm promotion for ${promotionReviewRows.length} selected student${promotionReviewRows.length===1?"":"s"} to ${next.session_name}?`;
    if(!confirm(message))return;

    confirmPromotionButton.disabled=true;
    try{
        for(const row of promotionReviewRows){
            const source={id:row.recordId,student_profile_id:row.studentProfileId,roll_no:promotionStudents.find(x=>x.id===row.recordId)?.roll_no??null};
            if(sourceClass===8){
                const {error:he}=await supabaseClient.from("promotion_history").insert({student_profile_id:row.studentProfileId,from_session_id:sourceSessionId,to_session_id:null,from_class:8,to_class:null,from_roll:source.roll_no,to_roll:null,status:row.status});
                if(he)throw he;
                continue;
            }
            if(row.status==="Left School"){
                const {error:he}=await supabaseClient.from("promotion_history").insert({student_profile_id:row.studentProfileId,from_session_id:sourceSessionId,to_session_id:next.id,from_class:sourceClass,to_class:null,from_roll:source.roll_no,to_roll:null,status:"Left School"});
                if(he)throw he;
                continue;
            }
            const {data:existing,error:ee}=await supabaseClient.from("academic_records").select("id").eq("session_id",next.id).eq("student_profile_id",row.studentProfileId).maybeSingle();
            if(ee)throw ee;
            if(existing){throw new Error(`${row.name} already has an academic record in ${next.session_name}.`);}
            const {error:ae}=await supabaseClient.from("academic_records").insert({session_id:next.id,student_profile_id:row.studentProfileId,class_no:row.classNo,roll_no:Number(row.rollNo),status:row.status});
            if(ae)throw ae;
            const {error:he}=await supabaseClient.from("promotion_history").insert({student_profile_id:row.studentProfileId,from_session_id:sourceSessionId,to_session_id:next.id,from_class:sourceClass,to_class:row.classNo,from_roll:source.roll_no,to_roll:Number(row.rollNo),status:row.status});
            if(he)throw he;
        }
        showToast(sourceClass===8?"Class VIII completion saved successfully.":"Promotion confirmed successfully.","success");
        resetPromotionState();
        promotionMessage.textContent=sourceClass===8?"Class VIII completion has been recorded. Historical data remains preserved.":"Promotion completed successfully. Historical data remains preserved.";
    }catch(e){
        showToast("Promotion could not be completed: "+e.message,"error");
    }finally{confirmPromotionButton.disabled=false;}
}

if(promotionSession)promotionSession.addEventListener("change",loadPromotionStudents);
if(promotionClass)promotionClass.addEventListener("change",loadPromotionStudents);
if(promotionSort)promotionSort.addEventListener("change",renderPromotionStudents);
if(promoteStudentsButton)promoteStudentsButton.addEventListener("click",openPromotionReview);
if(promotionBackButton)promotionBackButton.addEventListener("click",()=>{promotionReviewCard.classList.add("hidden");promotionListCard.classList.remove("hidden");});
if(confirmPromotionButton)confirmPromotionButton.addEventListener("click",confirmPromotion);



/* =========================================================
   PROMOTION STATE RESET
========================================================= */
function resetPromotionState(){
    const active = sessions.find(s => s.is_active);
    if (promotionSession) promotionSession.value = active ? String(active.id) : "";
    if (promotionClass) promotionClass.value = "1";
    if (promotionSort) promotionSort.value = "roll_asc";
    promotionStudents = [];
    promotionReviewRows = [];
    if (promotionListCard) promotionListCard.classList.add("hidden");
    if (promotionReviewCard) promotionReviewCard.classList.add("hidden");
    if (promotionMessage) promotionMessage.textContent = "Select a session and class. Students will appear automatically.";
    if (promotionTableContainer) promotionTableContainer.innerHTML = "";
    if (promotionReviewContainer) promotionReviewContainer.innerHTML = "";
}
