/* =========================================================
   FOLIO PRINT — CLASS MARKS FOLIO
   Split from the original print module without changing behavior.
========================================================= */

function autoFitFolioTable(table){
    if(!table) return;

    const headerCells = table.tHead?.rows?.[0]?.cells || [];
    const cols = headerCells.length;
    if(!cols) return;

    const subjectCount = Math.max(0, cols - 6);

    // A4 portrait with 8mm page margins = 194mm printable width.
    // This is the equivalent of Word's "AutoFit to Window":
    // the complete table fills the printable width, while identity/result
    // columns keep practical widths and all subject columns share the rest.
    const printableWidth = 194;
    const fixed = {
        serial: 8,
        roll: 10,
        name: 55,
        total: 14,
        percentage: 18,
        grade: 16
    };
    const fixedWidth = fixed.serial + fixed.roll + fixed.name + fixed.total + fixed.percentage + fixed.grade;
    const remaining = Math.max(0, printableWidth - fixedWidth);
    const subjectWidth = subjectCount ? remaining / subjectCount : 0;

    const widths = [fixed.serial, fixed.roll, fixed.name];
    for(let i=0; i<subjectCount; i++) widths.push(subjectWidth);
    widths.push(fixed.total, fixed.percentage, fixed.grade);

    table.style.width = "194mm";
    table.style.maxWidth = "194mm";
    table.style.minWidth = "194mm";
    table.style.tableLayout = "fixed";

    table.querySelector('colgroup[data-folio-autofit]')?.remove();
    const colgroup = document.createElement("colgroup");
    colgroup.dataset.folioAutofit = "true";
    widths.forEach(width => {
        const col = document.createElement("col");
        col.style.width = `${width.toFixed(2)}mm`;
        colgroup.appendChild(col);
    });
    table.insertBefore(colgroup, table.firstChild);

    [...table.rows].forEach(row => [...row.cells].forEach((cell, index) => {
        cell.style.width = `${widths[index].toFixed(2)}mm`;
        cell.style.maxWidth = `${widths[index].toFixed(2)}mm`;
        cell.style.overflowWrap = index === 2 ? "anywhere" : "normal";
        cell.style.wordBreak = "normal";
    }));
}
function formatFolioSubjectLabel(subjectName){
    const normalized = String(displaySubjectName(subjectName || "")).trim().replace(/\s+/g, " ");
    const key = normalized.toLowerCase();

    // Keep the folio universal: only genuinely long/awkward labels receive
    // a compact or balanced Word-style treatment. Other names stay unchanged.
    if(key === "environmental science" || key === "environmental studies"){
        return "ENV. SC.";
    }
    if(key === "social science"){
        return "Social<br>Science";
    }
    if(key === "mathematics"){
        return "Mathe<br>matics";
    }

    // For future long multi-word subjects, split at the nearest word boundary
    // before rotation so the heading remains inside its own table cell.
    const words = normalized.split(" ").filter(Boolean);
    if(words.length > 1 && normalized.length > 17){
        let best = 1;
        let bestDiff = Infinity;
        for(let i=1;i<words.length;i++){
            const left = words.slice(0,i).join(" ");
            const right = words.slice(i).join(" ");
            const diff = Math.abs(left.length - right.length);
            if(diff < bestDiff){
                bestDiff = diff;
                best = i;
            }
        }
        const left = escapeHtml(words.slice(0,best).join(" "));
        const right = escapeHtml(words.slice(best).join(" "));
        return `${left}<br>${right}`;
    }

    return escapeHtml(normalized);
}

function printClassFolio(){
    if(!printStudents.length){showToast("No students found.","error");return;}

    const ranked=getPrintSortedStudents();
    const heads=printSubjects.map(s=>{
        const subjectLabel=formatFolioSubjectLabel(s.subject_name);
        return `<th class="folio-subject-head folio-rotated-head">
            <div class="folio-subject-name-wrap">
                <span class="folio-subject-name">${subjectLabel}</span>
            </div>
            <span class="folio-subject-full-marks">${printExam.value==="Final"?100:50}</span>
        </th>`;
    }).join("");

    const slHead='<th class="folio-rotated-head"><span class="folio-head-label">Sl.<br>No.</span></th>';
    const rollHead='<th class="folio-rotated-head"><span class="folio-head-label">Roll</span></th>';
    const nameHead='<th class="folio-rotated-head"><span class="folio-head-label">Student Name</span></th>';
    const totalHead='<th class="folio-rotated-head"><span class="folio-head-label">Total</span></th>';
    const percentHead='<th class="folio-rotated-head percentage-head"><span class="folio-head-label">%</span></th>';
    const gradeHead='<th class="folio-rotated-head"><span class="folio-head-label">Grade</span></th>';

    const rowData=ranked.map((r,i)=>{
        const c=calcPrintRecord(r);
        const rowHtml=`<tr><td>${i+1}</td><td>${escapeHtml(r.roll_no??"")}</td><td class="name">${escapeHtml(r.students?.student_name||"")}</td>${printSubjects.map(s=>{
            let v;
            if(printExam.value==="Final"){
                v=(getPrintMark(r.id,s.id,"Half-Yearly")||0)+(getPrintMark(r.id,s.id,"Annual")||0);
            } else {
                v=getPrintMark(r.id,s.id,printExam.value);
            }
            return `<td>${v??""}</td>`;
        }).join("")}<td>${c.total}</td><td class="percentage-cell">${c.pct.toFixed(2)}%</td><td>${escapeHtml(c.grade)}</td></tr>`;

        // Estimate row height so long names get a little extra room without
        // pushing the entire folio page into an accidental third page.
        const nameLength=String(r.students?.student_name||"").trim().length;
        const estimatedHeight=nameLength>30 ? 13 : nameLength>22 ? 11 : 9;
        return {rowHtml, estimatedHeight};
    });

    // The folio is rendered as real A4 page sheets, like a Word document.
    // This gives every page its own watermark while keeping the repeated
    // header and border geometry identical from page to page.
    const pages=[];
    const maxRowsPerPage=24;
    const maxBodyHeight=216;
    let current=[];
    let currentHeight=0;

    rowData.forEach(item=>{
        const wouldOverflow = current.length>0 && (
            current.length>=maxRowsPerPage ||
            currentHeight + item.estimatedHeight > maxBodyHeight
        );
        if(wouldOverflow){
            pages.push(current);
            current=[];
            currentHeight=0;
        }
        current.push(item);
        currentHeight+=item.estimatedHeight;
    });
    if(current.length) pages.push(current);

    const sessionName=escapeHtml(printSession.options[printSession.selectedIndex]?.text||"");
    const classLabel=escapeHtml(printClassName(Number(printClass.value)));
    const examLabel=escapeHtml(printExam.value);
    const tableHead=`<thead><tr>${slHead}${rollHead}${nameHead}${heads}${totalHead}${percentHead}${gradeHead}</tr></thead>`;

    const pageHtml=pages.map((pageRows,pageIndex)=>`<div class="result-page folio-print${pageIndex ? " folio-page-break" : ""}">
        <div class="result-header">
            <h1>U.M.S SASAULI URDU</h1>
            <h2>Class Marks Folio</h2>
            <div class="small">Academic Session: ${sessionName} • ${classLabel} • ${examLabel}</div>
        </div>
        <table class="result-table">
            ${tableHead}
            <tbody>${pageRows.map(item=>item.rowHtml).join("")}</tbody>
        </table>
    </div>`).join("");

    openPrint(pageHtml, `${printClassName(Number(printClass.value))} ${printExam.value} Marks Folio`);
}

if (printStudentSearch) printStudentSearch.addEventListener("input", filterPrintStudents);
if (printStudentSelect) printStudentSelect.addEventListener("change", renderSelectedPrintStudent);
if (printStudentButton) printStudentButton.addEventListener("click", printOneStudent);
if (printAllStudentsButton) printAllStudentsButton.addEventListener("click", printAllStudents);
if (printClassFolioButton) printClassFolioButton.addEventListener("click", printClassFolio);

