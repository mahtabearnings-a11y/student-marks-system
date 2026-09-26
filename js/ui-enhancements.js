/* =========================================================
   GLOBAL SEARCH + LIGHT/DARK MODE
========================================================= */

(function () {
    "use strict";

    const globalSearchInput = document.getElementById("globalSearchInput");
    const globalSearchResults = document.getElementById("globalSearchResults");
    const lightModeButton = document.getElementById("lightModeButton");
    const darkModeButton = document.getElementById("darkModeButton");

    const THEME_KEY = "ums-sasauli-theme";

    function escapeSearchHtml(value) {
        if (typeof escapeHtml === "function") {
            return escapeHtml(String(value ?? ""));
        }

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function normalize(value) {
        return String(value ?? "")
            .trim()
            .toLowerCase();
    }

    function studentSearchText(student) {
        return [
            student.studentName,
            student.studentId,
            student.apaarId,
            student.rollNo,
            student.classNo,
            typeof className === "function" ? className(student.classNo) : "",
            student.fatherName,
            student.motherName,
            student.status
        ].map(normalize).join(" ");
    }

    function closeGlobalSearch() {
        if (!globalSearchResults || !globalSearchInput) return;
        globalSearchResults.classList.add("hidden");
        globalSearchInput.setAttribute("aria-expanded", "false");
    }

    function openGlobalSearch() {
        if (!globalSearchResults || !globalSearchInput) return;
        globalSearchResults.classList.remove("hidden");
        globalSearchInput.setAttribute("aria-expanded", "true");
    }

    function renderGlobalSearchResults(query) {
        if (!globalSearchResults || !globalSearchInput) return;

        const q = normalize(query);
        globalSearchResults.innerHTML = "";

        if (!q) {
            closeGlobalSearch();
            return;
        }

        const list = Array.isArray(studentsData) ? studentsData : [];
        const results = list
            .filter(student => studentSearchText(student).includes(q))
            .slice(0, 8);

        if (!results.length) {
            globalSearchResults.innerHTML = `<div class="global-search-empty">No matching student found.</div>`;
            openGlobalSearch();
            return;
        }

        results.forEach(student => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "global-search-result";
            button.setAttribute("role", "option");
            button.dataset.studentName = student.studentName || "";

            const classLabel = typeof className === "function"
                ? className(student.classNo)
                : `Class ${student.classNo ?? "-"}`;

            const meta = [
                classLabel,
                student.rollNo !== "" && student.rollNo != null ? `Roll ${student.rollNo}` : "",
                student.fatherName ? `Father: ${student.fatherName}` : ""
            ].filter(Boolean).join(" • ");

            const identifiers = [
                student.studentId ? `PEN ${student.studentId}` : "",
                student.apaarId ? `APAAR ${student.apaarId}` : ""
            ].filter(Boolean).join(" • ");

            button.innerHTML = `
                <span class="global-search-result-name">${escapeSearchHtml(student.studentName || "Unnamed Student")}</span>
                <span class="global-search-result-meta">${escapeSearchHtml(meta)}</span>
                ${identifiers ? `<span class="global-search-result-id">${escapeSearchHtml(identifiers)}</span>` : ""}
            `;

            button.addEventListener("click", async function () {
                closeGlobalSearch();

                if (typeof requestSectionChange === "function") {
                    await requestSectionChange("students");
                }

                if (typeof studentSearch !== "undefined" && studentSearch) {
                    if (typeof classFilter !== "undefined" && classFilter) {
                        classFilter.value = "all";
                    }

                    studentSearch.value = student.studentName || "";
                    if (typeof renderStudents === "function") {
                        renderStudents();
                    }
                    studentSearch.focus();
                }
            });

            globalSearchResults.appendChild(button);
        });

        openGlobalSearch();
    }

    function applyTheme(theme) {
        const dark = theme === "dark";
        document.body.classList.toggle("dark-mode", dark);

        if (lightModeButton) {
            lightModeButton.setAttribute("aria-pressed", dark ? "false" : "true");
        }

        if (darkModeButton) {
            darkModeButton.setAttribute("aria-pressed", dark ? "true" : "false");
        }

        try {
            localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
        } catch (_) {
            // Ignore storage restrictions; the current page still switches theme.
        }
    }

    function initializeTheme() {
        let saved = "light";

        try {
            saved = localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
        } catch (_) {
            saved = "light";
        }

        applyTheme(saved);
    }

    globalSearchInput?.addEventListener("input", function () {
        renderGlobalSearchResults(this.value);
    });

    globalSearchInput?.addEventListener("focus", function () {
        if (this.value.trim()) {
            renderGlobalSearchResults(this.value);
        }
    });

    globalSearchInput?.addEventListener("keydown", async function (event) {
        if (event.key === "Escape") {
            closeGlobalSearch();
            this.blur();
            return;
        }

        if (event.key === "Enter") {
            const firstResult = globalSearchResults?.querySelector(".global-search-result");
            if (firstResult) {
                event.preventDefault();
                firstResult.click();
            }
        }
    });

    document.addEventListener("click", function (event) {
        if (!event.target.closest(".topbar-search")) {
            closeGlobalSearch();
        }
    });

    lightModeButton?.addEventListener("click", function () {
        applyTheme("light");
    });

    darkModeButton?.addEventListener("click", function () {
        applyTheme("dark");
    });

    initializeTheme();
})();
