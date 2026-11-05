/* =========================================================
   LETTERHEAD MODULE — isolated from student/marks workflows
========================================================= */
(function () {
    "use strict";

    const $ = id => document.getElementById(id);
    const state = {
        documents: [],
        activeId: null,
        activeStatus: "new",
        filter: "all",
        hindiManuallyEdited: false,
        translationTimer: null,
        autosaveTimer: null,
        translationSequence: 0,
        loaded: false,
        loading: false,
        viewOnly: false
    };

    const typeNames = {
        official_letter: "Official Letter",
        notice: "Notice",
        office_order: "Office Order",
        certificate: "Certificate",
        application: "Application",
        general: "General Document"
    };

    const ids = [
        "lhDocumentType", "lhAcademicSession", "lhLetterNumber", "lhLetterDate",
        "lhRecipient", "lhSubject", "lhEnglishBody", "lhHindiRecipient",
        "lhHindiSubject", "lhHindiBody", "lhHindiReviewed", "lhSaveDraftButton", "lhIssueButton",
        "lhSaveIssuedButton", "lhTranslateButton"
    ];

    function esc(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[char]));
    }

    function toast(message, type = "") {
        if (typeof showToast === "function") showToast(message, type);
        else window.alert(message);
    }

    function isAdmin() {
        return typeof currentRole !== "undefined" && currentRole === "admin";
    }

    function localDateValue() {
        const now = new Date();
        const offset = now.getTimezoneOffset();
        return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
    }

    function formatDate(value) {
        if (!value) return "—";
        const [year, month, day] = String(value).slice(0, 10).split("-");
        return day && month && year ? `${day}.${month}.${year}` : value;
    }

    function getActiveSessionName() {
        const active = Array.isArray(sessions) ? sessions.find(item => item.is_active) : null;
        return active?.session_name || "";
    }

    function populateSessions(selected = "") {
        const select = $("lhAcademicSession");
        if (!select) return;
        const list = Array.isArray(sessions) ? sessions : [];
        select.innerHTML = list.map(item => {
            const value = String(item.session_name || "");
            const label = typeof academicYearDisplayName === "function" ? academicYearDisplayName(value) : value;
            return `<option value="${esc(value)}">${esc(label)}</option>`;
        }).join("");
        const sessionFilter = $("lhSessionFilter");
        if (sessionFilter) {
            const current = sessionFilter.value;
            sessionFilter.innerHTML = `<option value="">All academic sessions</option>` + list.map(item => {
                const value = String(item.session_name || "");
                const label = typeof academicYearDisplayName === "function" ? academicYearDisplayName(value) : value;
                return `<option value="${esc(value)}">${esc(label)}</option>`;
            }).join("");
            sessionFilter.value = current;
        }
        const preferred = selected || getActiveSessionName() || list[0]?.session_name || "";
        select.value = preferred;
    }

    function formPayload() {
        return {
            document_type: $("lhDocumentType").value,
            academic_session: $("lhAcademicSession").value,
            letter_date: $("lhLetterDate").value,
            ref_number: $("lhLetterNumber").value.trim(),
            recipient: $("lhRecipient").value.trim(),
            subject: $("lhSubject").value.trim(),
            english_body: $("lhEnglishBody").value,
            hindi_recipient: $("lhHindiRecipient").value.trim(),
            hindi_subject: $("lhHindiSubject").value.trim(),
            hindi_body: $("lhHindiBody").value,
            hindi_reviewed: $("lhHindiReviewed").checked
        };
    }

    function setStatus(status, refNumber = "") {
        state.activeStatus = status;
        const badge = $("lhDocumentStatus");
        badge.className = `lh-status-pill ${status === "issued" ? "lh-status-issued" : "lh-status-draft"}`;
        badge.textContent = status === "issued" ? `Issued · ${refNumber || "Patrank assigned"}` : (status === "draft" ? "Draft · not numbered" : "New draft");
        $("lhEditorTitle").textContent = status === "issued" ? "Issued Document" : (state.activeId ? "Edit Draft" : "Create New Letter");
        $("lhSaveDraftButton").classList.toggle("hidden", status === "issued" || !isAdmin());
        $("lhIssueButton").classList.toggle("hidden", status === "issued" || !isAdmin());
        $("lhSaveIssuedButton").classList.toggle("hidden", status !== "issued" || state.viewOnly || !isAdmin());
    }

    function setFormDisabled(disabled) {
        ids.forEach(id => {
            const control = $(id);
            if (control) control.disabled = disabled || !isAdmin();
        });
        $("lhLetterNumber").readOnly = disabled || !isAdmin() || state.activeStatus !== "issued";
        ["lhPrintBothButton", "lhPrintEnglishButton", "lhPrintHindiButton"].forEach(id => { $(id).disabled = false; });
    }

    function resetEditor() {
        clearTimeout(state.translationTimer);
        clearTimeout(state.autosaveTimer);
        state.activeId = null;
        state.activeStatus = "new";
        state.hindiManuallyEdited = false;
        state.viewOnly = false;
        $("lhDocumentType").value = "official_letter";
        populateSessions();
        $("lhLetterNumber").value = "";
        $("lhLetterNumber").placeholder = "Generated when issued";
        $("lhLetterDate").value = localDateValue();
        $("lhHindiReviewed").checked = false;
        ["lhRecipient", "lhSubject", "lhEnglishBody", "lhHindiRecipient", "lhHindiSubject", "lhHindiBody"].forEach(id => { $(id).value = ""; });
        $("lhHindiNote").textContent = "Hindi will be generated automatically after you pause typing. Review it before issuing.";
        $("lhEditorHelp").textContent = "Drafts do not receive a permanent Patrank. Issue only after reviewing both languages.";
        setStatus("new");
        setFormDisabled(false);
        renderPreview();
    }

    function loadIntoEditor(doc, viewOnly = true) {
        clearTimeout(state.autosaveTimer);
        clearTimeout(state.translationTimer);
        state.activeId = doc.id;
        state.activeStatus = doc.status;
        state.viewOnly = viewOnly && doc.status === "issued";
        state.hindiManuallyEdited = Boolean(doc.hindi_recipient || doc.hindi_subject || doc.hindi_body);
        populateSessions(doc.academic_session);
        $("lhDocumentType").value = doc.document_type || "official_letter";
        $("lhLetterNumber").value = doc.ref_number || "";
        $("lhLetterNumber").placeholder = doc.status === "issued" ? "Issued Patrank" : "Generated when issued";
        $("lhLetterDate").value = doc.letter_date || localDateValue();
        $("lhRecipient").value = doc.recipient || "";
        $("lhSubject").value = doc.subject || "";
        $("lhEnglishBody").value = doc.english_body || "";
        $("lhHindiRecipient").value = doc.hindi_recipient || "";
        $("lhHindiSubject").value = doc.hindi_subject || "";
        $("lhHindiBody").value = doc.hindi_body || "";
        $("lhHindiReviewed").checked = Boolean(doc.hindi_reviewed);
        $("lhEditorHelp").textContent = doc.status === "issued"
            ? (state.viewOnly ? "Viewing an issued record. Select Edit to make password-protected changes." : "Changes to issued records create a new revision and preserve the previous version.")
            : "Drafts remain unnumbered until Issue & Finalise.";
        setStatus(doc.status, doc.ref_number);
        setFormDisabled(state.viewOnly || !isAdmin());
        renderPreview();
        document.querySelector("#letterheadSection .lh-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    async function loadLetterheadSection() {
        if (!supabaseClient || state.loading) return;
        state.loading = true;
        try {
            $("lhNewButton").classList.toggle("hidden", !isAdmin());
            document.querySelector('[data-lh-tab="recycle"]')?.classList.toggle("hidden", !isAdmin());
            populateSessions();
            $("lhSessionLabel").textContent = getActiveSessionName() || "—";
            const { data, error } = await supabaseClient
                .from("letterhead_documents")
                .select("*")
                .order("updated_at", { ascending: false });
            if (error) throw error;
            state.documents = data || [];
            state.loaded = true;
            renderRegister();
            updateStats();
            if (!state.activeId) resetEditor();
        } catch (error) {
            console.error("Letterhead load error:", error);
            const text = String(error?.message || "");
            $("lhRegisterBody").innerHTML = `<tr><td colspan="8" class="lh-empty-cell">${esc(text.includes("letterhead_documents") ? "Letterhead database setup is pending. Run the supplied SQL migration in Supabase, then refresh." : (text || "Unable to load the Letterhead register."))}</td></tr>`;
            toast(text || "Unable to load Letterhead records.", "error");
        } finally {
            state.loading = false;
        }
    }

    function updateStats() {
        const active = state.documents.filter(doc => !doc.deleted_at);
        $("lhIssuedCount").textContent = active.filter(doc => doc.status === "issued").length;
        $("lhDraftCount").textContent = active.filter(doc => doc.status === "draft").length;
        $("lhSessionLabel").textContent = getActiveSessionName() || "—";
    }

    function filteredDocuments() {
        const search = $("lhSearchInput").value.trim().toLowerCase();
        const type = $("lhTypeFilter").value;
        return state.documents.filter(doc => {
            const deleted = Boolean(doc.deleted_at);
            if (state.filter === "recycle" && !deleted) return false;
            if (state.filter !== "recycle" && deleted) return false;
            if (state.filter === "draft" && doc.status !== "draft") return false;
            if (state.filter === "issued" && doc.status !== "issued") return false;
            if (type && doc.document_type !== type) return false;
            const selectedSession = $("lhSessionFilter").value;
            if (selectedSession && doc.academic_session !== selectedSession) return false;
            const fromDate = $("lhDateFrom").value;
            const toDate = $("lhDateTo").value;
            if (fromDate && String(doc.letter_date || "") < fromDate) return false;
            if (toDate && String(doc.letter_date || "") > toDate) return false;
            if (search) {
                const haystack = [doc.ref_number, doc.subject, doc.recipient, doc.academic_session].join(" ").toLowerCase();
                if (!haystack.includes(search)) return false;
            }
            return true;
        });
    }

    function renderRegister() {
        const body = $("lhRegisterBody");
        if (!body) return;
        const rows = filteredDocuments();
        if (!rows.length) {
            body.innerHTML = `<tr><td colspan="8" class="lh-empty-cell">No documents found for this filter.</td></tr>`;
            return;
        }
        body.innerHTML = rows.map((doc, index) => {
            const status = doc.deleted_at ? "In Recycle Bin" : doc.status === "issued" ? "Issued" : "Draft";
            const statusClass = doc.deleted_at ? "lh-row-deleted" : doc.status === "issued" ? "lh-row-issued" : "lh-row-draft";
            const number = doc.ref_number || "—";
            let actions = "";
            if (doc.deleted_at) {
                actions = isAdmin()
                    ? `<button class="lh-action" data-action="restore" data-id="${esc(doc.id)}">Restore</button><button class="lh-action danger" data-action="permanent" data-id="${esc(doc.id)}">Delete permanently</button>`
                    : `<span>—</span>`;
            } else {
                actions = `<button class="lh-action" data-action="view" data-id="${esc(doc.id)}">View</button><button class="lh-action" data-action="print" data-id="${esc(doc.id)}">Print</button>`;
                if (isAdmin()) actions += `<button class="lh-action" data-action="edit" data-id="${esc(doc.id)}">Edit</button><button class="lh-action" data-action="history" data-id="${esc(doc.id)}">History</button><button class="lh-action danger" data-action="trash" data-id="${esc(doc.id)}">Bin</button>`;
            }
            return `<tr class="${statusClass}"><td>${index + 1}</td><td><strong>${esc(number)}</strong></td><td>${esc(formatDate(doc.letter_date))}</td><td>${esc(typeNames[doc.document_type] || doc.document_type)}</td><td>${esc(doc.subject || "—")}</td><td>${esc(doc.recipient || "—")}</td><td><span class="lh-table-status ${statusClass}">${esc(status)}</span></td><td><div class="lh-row-actions">${actions}</div></td></tr>`;
        }).join("");
    }

    function validatePayload(payload, issuing = false) {
        if (!payload.academic_session) return "Select an academic session.";
        if (!payload.letter_date) return "Select the document date.";
        if (issuing && !payload.recipient) return "Enter the recipient.";
        if (issuing && !payload.subject) return "Enter the subject.";
        if (issuing && !payload.english_body.trim()) return "Enter the English letter content.";
        if (issuing && (!payload.hindi_recipient.trim() || !payload.hindi_subject.trim() || !payload.hindi_body.trim())) return "Generate and review the complete Hindi translation before issuing.";
        if (issuing && !payload.hindi_reviewed) return "Confirm that you have reviewed and approved the Hindi translation.";
        return "";
    }

    async function saveDraft(showMessage = true) {
        if (!isAdmin()) throw new Error("Only an Admin can create or edit documents.");
        const payload = formPayload();
        const validation = validatePayload(payload, false);
        if (validation) throw new Error(validation);
        let result;
        if (state.activeId) {
            const { data, error } = await supabaseClient.rpc("letterhead_update_draft", {
                p_document_id: state.activeId,
                p_payload: payload
            });
            if (error) throw error;
            result = data;
        } else {
            const { data, error } = await supabaseClient.rpc("letterhead_create_draft", { p_payload: payload });
            if (error) throw error;
            result = data;
        }
        state.activeId = result.id;
        state.activeStatus = "draft";
        setStatus("draft");
        await loadLetterheadSection();
        if (showMessage) toast("Draft saved.", "success");
        return result;
    }

    async function askPassword(title, message, actionLabel) {
        if (typeof showAdminPasswordDialog !== "function") throw new Error("The existing school password dialog is unavailable.");
        const password = await showAdminPasswordDialog({ title, message, actionLabel });
        return password;
    }

    async function protectedRpcWithPrompt(rpcName, params, promptText) {
        while (true) {
            const password = await askPassword("Password Verification", promptText, "Continue");
            if (password === null) return false;
            if (!password.trim()) {
                toast("Please enter the password.", "error");
                continue;
            }
            const { error } = await supabaseClient.rpc(rpcName, { ...params, p_password: password });
            if (!error) return true;
            const message = String(error.message || "");
            if (/incorrect|invalid.*password|wrong.*password/i.test(message)) {
                toast("Wrong password. Please try again.", "error");
                continue;
            }
            throw error;
        }
    }

    async function saveIssuedChanges() {
        if (!isAdmin() || !state.activeId) return;
        const payload = formPayload();
        const validation = validatePayload(payload, true);
        if (validation) throw new Error(validation);
        while (true) {
            const password = await askPassword("Password Verification", "Enter the existing school security password to save changes to this issued document.", "Save Changes");
            if (password === null) return;
            if (!password.trim()) { toast("Please enter the password.", "error"); continue; }
            const { data, error } = await supabaseClient.rpc("letterhead_edit_issued", {
                p_document_id: state.activeId,
                p_payload: payload,
                p_password: password
            });
            if (!error) {
                state.hindiManuallyEdited = false;
                await loadLetterheadSection();
                loadIntoEditor(data, true);
                toast("Issued document updated. Previous version preserved.", "success");
                return;
            }
            const message = String(error.message || "");
            if (/incorrect|invalid.*password|wrong.*password/i.test(message)) {
                toast("Wrong password. Please try again.", "error");
                continue;
            }
            throw error;
        }
    }

    async function issueDocument() {
        if (!isAdmin()) return;
        clearTimeout(state.autosaveTimer);
        let payload = formPayload();
        const validation = validatePayload(payload, true);
        if (validation) throw new Error(validation);
        if (!confirm("Issue and finalise this document? A permanent Patrank will be assigned and cannot be reused.")) return;
        await saveDraft(false);
        const { data, error } = await supabaseClient.rpc("letterhead_issue_draft", { p_document_id: state.activeId });
        if (error) throw error;
        await loadLetterheadSection();
        loadIntoEditor(data, true);
        toast(`Document issued: ${data.ref_number}`, "success");
    }

    function scheduleDraftAutosave() {
        if (!isAdmin() || state.viewOnly || state.activeStatus === "issued") return;
        clearTimeout(state.autosaveTimer);
        state.autosaveTimer = setTimeout(async () => {
            const payload = formPayload();
            if (!payload.academic_session || !payload.letter_date) return;
            if (![payload.recipient, payload.subject, payload.english_body, payload.hindi_body].some(value => String(value || "").trim())) return;
            try {
                await saveDraft(false);
                $("lhEditorHelp").textContent = "Draft autosaved. You can continue editing; no Patrank is assigned until issue.";
            } catch (error) {
                console.warn("Letterhead draft autosave:", error);
                $("lhEditorHelp").textContent = error.message || "Draft autosave failed. Use Save Draft to retry.";
            }
        }, 2600);
    }

    function scheduleTranslation() {
        if (!isAdmin() || state.viewOnly) return;
        clearTimeout(state.translationTimer);
        state.translationTimer = setTimeout(async () => {
            const inputs = [$("lhRecipient").value.trim(), $("lhSubject").value.trim(), $("lhEnglishBody").value];
            if (!inputs.some(value => value.trim())) return;
            try { await translateNow(false); }
            catch (error) { console.warn("Automatic Hindi translation:", error); $("lhHindiNote").textContent = error.message || "Hindi translation is currently unavailable. Use Generate Hindi after setup."; }
        }, 1100);
    }

    async function translateNow(manual = false) {
        if (!isAdmin()) throw new Error("Only an Admin can generate the translation.");
        const sequence = ++state.translationSequence;
        const fields = {
            recipient: $("lhRecipient").value,
            subject: $("lhSubject").value,
            body: $("lhEnglishBody").value
        };
        if (!fields.recipient.trim() && !fields.subject.trim() && !fields.body.trim()) throw new Error("Enter some English content first.");
        if (state.hindiManuallyEdited && [$("lhHindiRecipient").value, $("lhHindiSubject").value, $("lhHindiBody").value].some(value => value.trim())) {
            const approved = confirm("Replace the Hindi text you edited manually with a fresh translation?");
            if (!approved) return;
        }
        const button = $("lhTranslateButton");
        const previous = button.textContent;
        button.disabled = true;
        button.textContent = "Translating…";
        $("lhHindiNote").textContent = "Generating Hindi translation. Please review the result before issuing.";
        try {
            const { data, error } = await supabaseClient.functions.invoke("letterhead-translate", { body: { fields, target: "hi" } });
            if (error) throw error;
            if (sequence !== state.translationSequence) return;
            const translated = data?.translated || {};
            $("lhHindiRecipient").value = translated.recipient || "";
            $("lhHindiSubject").value = translated.subject || "";
            $("lhHindiBody").value = translated.body || "";
            state.hindiManuallyEdited = false;
            $("lhHindiReviewed").checked = false;
            $("lhHindiNote").textContent = "Translation generated. Please proofread names, dates, official terms and grammar before issuing.";
            renderPreview();
            scheduleDraftAutosave();
            if (manual) toast("Hindi translation generated. Please review it.", "success");
        } catch (error) {
            const message = error?.context?.json?.error || error?.message || "Hindi translation failed.";
            $("lhHindiNote").textContent = message;
            throw new Error(message);
        } finally {
            button.disabled = !isAdmin() || state.viewOnly;
            button.textContent = previous;
        }
    }

    function imagePaths() {
        return {
            logo: new URL("school-logo-polished.png", window.location.href).href,
            heading: new URL("assets/letterhead/school-heading.png", window.location.href).href,
            signature: new URL("assets/letterhead/signature.png", window.location.href).href
        };
    }

    function printDocument(doc, language = "both") {
        const paths = imagePaths();
        const issued = doc.status === "issued" && doc.ref_number;
        const number = issued ? doc.ref_number : "DRAFT — NOT ISSUED";
        const english = language === "english" || language === "both";
        const hindi = language === "hindi" || language === "both";
        const pages = [];
        const addPage = lang => {
            const isHindi = lang === "hi";
            const recipient = isHindi ? doc.hindi_recipient : doc.recipient;
            const subject = isHindi ? doc.hindi_subject : doc.subject;
            const content = isHindi ? doc.hindi_body : doc.english_body;
            const docTitle = isHindi ? ({ notice: "सूचना", office_order: "कार्यालय आदेश", certificate: "प्रमाण-पत्र", application: "आवेदन", official_letter: "कार्यालय पत्र", general: "पत्र" }[doc.document_type] || "पत्र") : (typeNames[doc.document_type] || "Official Letter");
            pages.push(`<article class="letter-page ${isHindi ? "hindi-page" : "english-page"}">
                ${!issued ? '<div class="draft-watermark">DRAFT</div>' : ""}
                <header class="letterhead-top">
                    <img class="letterhead-logo" src="${paths.logo}" alt="School logo">
                    <img class="letterhead-heading-art" src="${paths.heading}" alt="School name and address">
                </header>
                <div class="letterhead-rule"></div>
                <div class="letter-meta"><span><b>${isHindi ? "पत्रांक" : "Patrank"}:</b> ${esc(number)}</span><span><b>${isHindi ? "दिनांक" : "Date"}:</b> ${esc(formatDate(doc.letter_date))}</span></div>
                <div class="document-type-title">${esc(docTitle)}</div>
                <div class="recipient-block"><b>${isHindi ? "सेवा में," : "To,"}</b><div>${esc(recipient).replace(/\n/g, "<br>")}</div></div>
                <div class="subject-line"><b>${isHindi ? "विषय:" : "Subject:"}</b> ${esc(subject).replace(/\n/g, "<br>")}</div>
                <div class="letter-body">${esc(content).replace(/\n/g, "<br>")}</div>
                <div class="signature-area"><div class="closing">${isHindi ? "भवदीय," : "Yours faithfully,"}</div><img class="authorized-signature" src="${paths.signature}" alt="Authorised signature"></div>
                <footer class="letter-footer">U.M.S. SASAULI URDU · Aurai-1, Muzaffarpur, Bihar</footer>
            </article>`);
        };
        if (english) addPage("en");
        if (hindi) addPage("hi");
        const popup = window.open("", "_blank");
        if (!popup) { toast("Please allow pop-ups to print the letter.", "error"); return; }
        popup.document.open();
        popup.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(number)} · U.M.S. SASAULI URDU</title><style>
            @page{size:A4 portrait;margin:13mm 16mm 15mm}*{box-sizing:border-box}body{margin:0;background:#eef2f7;color:#111827;font-family:Arial,Helvetica,sans-serif}.letter-page{position:relative;background:#fff;width:210mm;min-height:297mm;margin:10px auto;padding:0 0 15mm;page-break-after:always;break-after:page;overflow:hidden}.letter-page:last-child{page-break-after:auto;break-after:auto}.letterhead-top{display:flex;align-items:center;justify-content:center;gap:7mm;min-height:34mm;padding:0 2mm}.letterhead-logo{width:30mm;height:30mm;object-fit:contain}.letterhead-heading-art{width:140mm;max-height:33mm;object-fit:contain}.letterhead-rule{height:1.2mm;background:#174f91;margin:1mm 0 6mm}.letter-meta{display:flex;justify-content:space-between;font-size:11pt;margin:0 0 12mm}.document-type-title{text-align:center;font-weight:700;font-size:14pt;margin:-5mm 0 10mm}.recipient-block{font-size:12pt;line-height:1.7;margin-bottom:7mm}.recipient-block div{padding-left:7mm;margin-top:1mm}.subject-line{font-size:12pt;line-height:1.7;margin:0 0 7mm}.letter-body{font-size:12pt;line-height:1.85;white-space:normal;text-align:justify;overflow-wrap:anywhere}.signature-area{margin:17mm 0 0 auto;width:62mm;min-height:35mm;break-inside:avoid;page-break-inside:avoid;text-align:left}.closing{font-size:12pt;margin-bottom:2mm}.authorized-signature{width:52mm;height:21mm;object-fit:contain;object-position:left center}.letter-footer{position:absolute;bottom:2mm;left:0;right:0;text-align:center;color:#475569;font-size:9pt;border-top:.25mm solid #94a3b8;padding-top:2mm}.hindi-page{font-family:"Noto Sans Devanagari","Nirmala UI","Mangal",Arial,sans-serif}.hindi-page .letter-body,.hindi-page .subject-line,.hindi-page .recipient-block,.hindi-page .closing{font-family:"Noto Sans Devanagari","Nirmala UI","Mangal",Arial,sans-serif}.draft-watermark{position:absolute;top:43%;left:15%;transform:rotate(-32deg);font-size:60pt;font-weight:700;color:rgba(190,30,45,.10);z-index:0;pointer-events:none}.letter-page>*:not(.draft-watermark){position:relative;z-index:1}@media screen{.letter-page{box-shadow:0 4px 22px rgba(15,23,42,.15)}}@media print{body{background:#fff}.letter-page{width:auto;min-height:269mm;margin:0;padding:0 0 13mm;box-shadow:none}.letter-page:last-child{page-break-after:auto}.signature-area{break-inside:avoid;page-break-inside:avoid}}
        </style></head><body>${pages.join("")}<script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print();},500);});<\/script></body></html>`);
        popup.document.close();
    }

    function renderPreview() {
        // The small preview pages are deliberately static; the print action renders the full, source-backed A4 document.
        const payload = formPayload();
        const first = document.querySelector(".lh-mini-page .lh-mini-title");
        const second = document.querySelector(".lh-mini-hindi .lh-mini-title");
        if (first) first.textContent = payload.subject || "English letter";
        if (second) second.textContent = payload.hindi_subject || "हिन्दी पत्र";
    }

    async function showHistory(documentId) {
        const panel = $("lhHistoryPanel");
        const content = $("lhHistoryContent");
        panel.classList.remove("hidden");
        content.innerHTML = `<div class="lh-empty-cell">Loading revision history…</div>`;
        try {
            const { data, error } = await supabaseClient.from("letterhead_document_versions")
                .select("version_number, action, created_at, snapshot")
                .eq("document_id", documentId).order("version_number", { ascending: false });
            if (error) throw error;
            if (!data?.length) { content.innerHTML = `<div class="lh-empty-cell">No saved revisions found.</div>`; return; }
            content.innerHTML = data.map(row => `<div class="lh-history-row"><strong>Version ${row.version_number}</strong><span>${esc(row.action)} · ${esc(new Date(row.created_at).toLocaleString("en-IN"))}</span><small>${esc(row.snapshot?.ref_number || "Draft snapshot")} · ${esc(row.snapshot?.subject || "No subject")}</small></div>`).join("");
        } catch (error) {
            content.innerHTML = `<div class="lh-empty-cell">${esc(error.message || "Unable to load history.")}</div>`;
        }
        panel.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    async function handleRowAction(action, documentId) {
        const doc = state.documents.find(item => item.id === documentId);
        if (!doc) return;
        try {
            if (action === "view") loadIntoEditor(doc, true);
            if (action === "edit") {
                if (!isAdmin()) return;
                loadIntoEditor(doc, false);
                state.viewOnly = false;
                setFormDisabled(false);
                setStatus(doc.status, doc.ref_number);
                $("lhEditorHelp").textContent = doc.status === "issued" ? "Saving changes will ask for the existing school security password and create a new revision." : "Draft is editable without a password.";
                $("lhSaveIssuedButton").classList.toggle("hidden", doc.status !== "issued");
            }
            if (action === "print") printDocument(doc, "both");
            if (action === "history") await showHistory(doc.id);
            if (action === "trash") {
                if (!confirm(`Move ${doc.ref_number || "this draft"} to the Letterhead Recycle Bin?`)) return;
                if (doc.status === "issued") {
                    const success = await protectedRpcWithPrompt("letterhead_trash_document", { p_document_id: doc.id }, "Enter the existing school security password to move this issued document to the Recycle Bin.");
                    if (!success) return;
                } else {
                    const { error } = await supabaseClient.rpc("letterhead_trash_document", { p_document_id: doc.id, p_password: null });
                    if (error) throw error;
                }
                toast("Document moved to the Letterhead Recycle Bin.", "success");
                if (state.activeId === doc.id) resetEditor();
                await loadLetterheadSection();
            }
            if (action === "restore") {
                const success = await protectedRpcWithPrompt("letterhead_restore_document", { p_document_id: doc.id }, "Enter the existing school security password to restore this document.");
                if (!success) return;
                toast("Document restored.", "success");
                await loadLetterheadSection();
            }
            if (action === "permanent") {
                if (!confirm("Permanently delete this document and its revision snapshots? This cannot be undone.")) return;
                const success = await protectedRpcWithPrompt("letterhead_permanently_delete_document", { p_document_id: doc.id }, "Enter the existing school security password to permanently delete this document.");
                if (!success) return;
                toast("Document permanently deleted.", "success");
                await loadLetterheadSection();
            }
        } catch (error) {
            console.error("Letterhead action error:", error);
            toast(error.message || "The requested action failed.", "error");
        }
    }

    function bindEvents() {
        $("lhNewButton").addEventListener("click", resetEditor);
        $("lhCancelButton").addEventListener("click", resetEditor);
        $("lhRefreshButton").addEventListener("click", loadLetterheadSection);
        $("lhSearchInput").addEventListener("input", renderRegister);
        $("lhTypeFilter").addEventListener("change", renderRegister);
        $("lhSessionFilter").addEventListener("change", renderRegister);
        $("lhDateFrom").addEventListener("change", renderRegister);
        $("lhDateTo").addEventListener("change", renderRegister);
        document.querySelectorAll("[data-lh-tab]").forEach(button => button.addEventListener("click", () => {
            state.filter = button.dataset.lhTab;
            document.querySelectorAll("[data-lh-tab]").forEach(item => item.classList.toggle("active", item === button));
            renderRegister();
        }));
        $("lhRegisterBody").addEventListener("click", event => {
            const button = event.target.closest("button[data-action]");
            if (button) handleRowAction(button.dataset.action, button.dataset.id);
        });
        $("lhSaveDraftButton").addEventListener("click", async () => {
            try { await saveDraft(true); } catch (error) { toast(error.message || "Unable to save draft.", "error"); }
        });
        $("lhIssueButton").addEventListener("click", async () => {
            try { await issueDocument(); } catch (error) { toast(error.message || "Unable to issue document.", "error"); }
        });
        $("lhSaveIssuedButton").addEventListener("click", async () => {
            try { await saveIssuedChanges(); } catch (error) { toast(error.message || "Unable to save issued document.", "error"); }
        });
        $("lhTranslateButton").addEventListener("click", async () => {
            try { await translateNow(true); } catch (error) { toast(error.message || "Hindi translation failed.", "error"); }
        });
        ["lhRecipient", "lhSubject", "lhEnglishBody"].forEach(id => $(id).addEventListener("input", () => { $("lhHindiReviewed").checked = false; scheduleTranslation(); scheduleDraftAutosave(); renderPreview(); }));
        ["lhHindiRecipient", "lhHindiSubject", "lhHindiBody"].forEach(id => $(id).addEventListener("input", () => {
            state.hindiManuallyEdited = true;
            $("lhHindiReviewed").checked = false;
            $("lhHindiNote").textContent = "Manual Hindi corrections detected. They will be preserved unless you confirm regeneration.";
            scheduleDraftAutosave();
            renderPreview();
        }));
        ["lhDocumentType", "lhAcademicSession", "lhLetterDate"].forEach(id => $(id).addEventListener("change", () => { scheduleDraftAutosave(); renderPreview(); }));
        $("lhLetterNumber").addEventListener("change", renderPreview);
        $("lhHindiReviewed").addEventListener("change", scheduleDraftAutosave);
        $("lhPrintBothButton").addEventListener("click", () => printDocument({ ...formPayload(), status: state.activeStatus }, "both"));
        $("lhPrintEnglishButton").addEventListener("click", () => printDocument({ ...formPayload(), status: state.activeStatus }, "english"));
        $("lhPrintHindiButton").addEventListener("click", () => printDocument({ ...formPayload(), status: state.activeStatus }, "hindi"));
        $("lhCloseHistoryButton").addEventListener("click", () => $("lhHistoryPanel").classList.add("hidden"));
    }

    document.addEventListener("DOMContentLoaded", () => {
        if (!$("letterheadSection")) return;
        bindEvents();
        populateSessions();
        resetEditor();
    });

    // Public entry point called by app.js after the user selects the Letterhead tab.
    window.loadLetterheadSection = loadLetterheadSection;
})();
