window.InitUserScripts = function()
{
var player = GetPlayer();
var object = player.object;
var once = player.once;
var addToTimeline = player.addToTimeline;
var setVar = player.SetVar;
var getVar = player.GetVar;
var update = player.update;
var pointerX = player.pointerX;
var pointerY = player.pointerY;
var showPointer = player.showPointer;
var hidePointer = player.hidePointer;
var slideWidth = player.slideWidth;
var slideHeight = player.slideHeight;
window.Script1 = function()
{
  /* ============================================================
   STORYLINE → OVERRIDE ALL XAPI PATHS → FORCE LAMBDA
   Fully SCORM Cloud–compliant
============================================================ */

(function () {

    /* ---------- Utility: Remove null/undefined ---------- */
    function clean(o) {
        for (let k in o) {
            if (o[k] == null) delete o[k];
            else if (typeof o[k] === "object") clean(o[k]);
        }
        return o;
    }

    /* ---------- Activity URL helper (no double-encoding) ---------- */
    function activityUrl(id) {
        if (!id) return "https://acbl.wirelxdfirm.com/activities/unknown";

        // If it already looks like a full URL, leave it alone
        if (/^https?:\/\//i.test(id)) {
            return id.trim();
        }

        // Otherwise treat as relative path after /activities/
        id = String(id).replace(/^\/+/, "");
        return "https://acbl.wirelxdfirm.com/activities/" + id;
    }

    /* ---------- Actual send function ---------- */
    async function __SEND(stmt) {

        window.lastStatementSent = stmt;
        console.log("📤 Sending to Lambda:", stmt);

        try {
            const r = await fetch(
                "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws?mode=write",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(stmt),
                    keepalive: true
                }
            );

            const data = await r.json();
            console.log("📩 Lambda response:", data);

            if (!data.ok) {
                console.error("❌ SCORM Cloud rejected:", data);
            }

            return data;

        } catch (e) {
            console.error("❌ Lambda write failed:", e);
            return { ok: false, error: e.message };
        }
    }

    /* ============================================================
       STORYLINE BUILDS TERRIBLE STATEMENTS — REBUILD FROM SCRATCH
    ============================================================= */
    async function sendXAPI(verbId, verbDisplay, objectId, objectName, resultData = {}) {
        try {

            const p = GetPlayer();
            if (!p) throw new Error("GetPlayer missing");

            const learnerName =
                p.GetVar("learnerName") ||
                localStorage.getItem("learnerName") ||
                "Anonymous";

            const sid =
                p.GetVar("sessionId") ||
                localStorage.getItem("sessionId") ||
                crypto.randomUUID();

            const mbox =
                "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

            /* ---------- AUTO-SCORING FIX (for question-level statements) ---------- */
            if (!resultData.score) {
                const isCorrect =
                    resultData.success === true ||
                    p.GetVar("isCorrect") === true ||
                    p.GetVar("Correct") === true ||
                    false;

                if (resultData.success == null) {
                    resultData.success = isCorrect;
                }

                // Question-level: 100 for correct, 0 for incorrect
                resultData.score = {
                    raw: isCorrect ? 100 : 0,
                    min: 0,
                    max: 100,
                    scaled: isCorrect ? 1 : 0
                };
            }
            // NOTE: summary/result slides already build a score object;
            // we do NOT override it because resultData.score already exists.

            /* ---------- Build full statement ---------- */
            const stmt = {
                actor: {
                    name: learnerName,
                    mbox
                },
                verb: {
                    id: verbId,
                    display: { "en-US": verbDisplay }
                },
                object: {
                    id: activityUrl(objectId),
                    definition: {
                        name: { "en-US": objectName },
                        type: "http://adlnet.gov/expapi/activities/lesson"
                    },
                    objectType: "Activity"
                },
                result: resultData,
                context: {
                    registration: sid,
                    platform: "Storyline",
                    language: "en-US"
                },
                timestamp: new Date().toISOString()
            };

            clean(stmt);
            window.lastStatementSent = stmt;
            console.log("📄 FINAL STATEMENT BUILT:", stmt);

            return await __SEND(stmt);

        } catch (e) {
            console.error("❌ ERROR building statement:", e);
        }
    }

    /* ============================================================
       OVERRIDE EVERY VERSION STORYLINE TRIES TO CALL
    ============================================================= */
    window.sendXAPI = sendXAPI;
    window.SendXAPI = sendXAPI;
    if (window.parent) window.parent.sendXAPI = sendXAPI;
    if (window.top) window.top.sendXAPI = sendXAPI;

    console.log("✅ Master Slide xAPI override loaded");

})();

}

window.Script2 = function()
{
  /* ============================================================
   TEST INITIALIZER – Bulletproof & Fully Aligned
   Handles:
   - Identity
   - Session ID
   - Competency detection
   - Sub-competency detection
   - FULL attempt reset
   - Test-start xAPI
   - Resume gate
============================================================ */

(function () {
  try {
    const p = GetPlayer();
    if (!p) return;

    /* -------------------------------
       1) Identity Resolution
    ------------------------------- */
    function getQS(name) {
      const m = new RegExp("[?&]" + name + "=([^&#]*)").exec(location.search);
      return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : null;
    }

    const qsName = getQS("learnerName") || getQS("name");
    const stored = localStorage.getItem("learnerName");
    let learner = (qsName || stored || "").trim();
    if (!learner) learner = "Anonymous";

    const mbox = "mailto:" + encodeURIComponent(learner) + "@wirelxdfirm.com";

    /* -------------------------------
       2) Session ID
    ------------------------------- */
    let sid = localStorage.getItem("sessionId");
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem("sessionId", sid);
    }

    /* -------------------------------
       3) Push Identity into Storyline
    ------------------------------- */
    p.SetVar("learnerName", learner);
    p.SetVar("actorName", learner);
    p.SetVar("actorMbox", mbox);
    p.SetVar("sessionId", sid);

    localStorage.setItem("learnerName", learner);
    localStorage.setItem("actorName", learner);
    localStorage.setItem("actorMbox", mbox);

    /* -------------------------------
       4) Detect Competency
    ------------------------------- */
    const comp = (location.href.toUpperCase().match(/C[123]/) || ["C1"])[0];

    localStorage.setItem("currentCompetency", comp);
    p.SetVar("currentComp", comp);

    /* -------------------------------
       5) Sub-Competency Auto-detect
    ------------------------------- */
    const subMatch = (document.title || "").match(/C[123][ABC]/i);

    if (subMatch) {
      const sub = subMatch[0];
      p.SetVar("CurrentSub", sub);
      p.SetVar("C1_SubCompetency", sub);
      localStorage.setItem("currentSub", sub);
    }

    /* ============================================================
       6) FULL ATTEMPT RESET – correct localStorage keys
    ============================================================ */
    (function resetAttempt() {

      localStorage.removeItem(`${comp}_mastery`);
      localStorage.removeItem(`${comp}_score`);
      localStorage.removeItem(`${comp}_missed`);

      localStorage.removeItem(`${comp}_testedOut`);
      localStorage.removeItem(`${comp}_finalized`);

      localStorage.removeItem(`${comp}.completed`);
      localStorage.removeItem(`${comp}.started`);
      localStorage.removeItem(`${comp}.startedAt`);

      console.log(`🔄 RESET: Attempt state cleared for ${comp}`);

    })();

    /* -------------------------------
       7) Test-start XAPI (launched)
    ------------------------------- */
    const startKey = `${comp}.started`;

    if (!localStorage.getItem(startKey)) {
      localStorage.setItem(startKey, "true");
      localStorage.setItem(`${comp}.startedAt`, new Date().toISOString());

      if (window.sendXAPI) {
        window.sendXAPI(
          "http://adlnet.gov/expapi/verbs/launched",
          "launched",
          `https://acbl.wirelxdfirm.com/activities/${comp}/test`,
          `${comp} Test`,
          {
            extensions: {
              "https://acbl.wirelxdfirm.com/extensions/learnerName": learner,
              "https://acbl.wirelxdfirm.com/extensions/sessionId": sid,
              "https://acbl.wirelxdfirm.com/extensions/competencyId": comp
            }
          }
        );
      }
    }

    /* -------------------------------
       8) Resume Gate
    ------------------------------- */
    const scoreKey = `${comp}_score`;
    const completedKey = `${comp}.completed`;

    const storedScore = localStorage.getItem(scoreKey);
    const storedCompleted = localStorage.getItem(completedKey) === "true";

    if (!storedScore) return;
    if (storedCompleted) return;

    if (confirm("Do you want to resume your previous test attempt?")) {
      console.log("▶ Resuming previous attempt");
    }

  } catch (err) {
    console.warn("❌ Test initializer failed:", err);
  }
})();

}

window.Script3 = function()
{
  /* ============================================================
   STORYLINE → OVERRIDE ALL XAPI PATHS → FORCE LAMBDA
   Fully SCORM Cloud–compliant
============================================================ */

(function () {

    /* ---------- Utility: Remove null/undefined ---------- */
    function clean(o) {
        for (let k in o) {
            if (o[k] == null) delete o[k];
            else if (typeof o[k] === "object") clean(o[k]);
        }
        return o;
    }

    /* ---------- Activity URL helper (no double-encoding) ---------- */
    function activityUrl(id) {
        if (!id) return "https://acbl.wirelxdfirm.com/activities/unknown";

        // If it already looks like a full URL, leave it alone
        if (/^https?:\/\//i.test(id)) {
            return id.trim();
        }

        // Otherwise treat as relative path after /activities/
        id = String(id).replace(/^\/+/, "");
        return "https://acbl.wirelxdfirm.com/activities/" + id;
    }

    /* ---------- Actual send function ---------- */
    async function __SEND(stmt) {

        window.lastStatementSent = stmt;
        console.log("📤 Sending to Lambda:", stmt);

        try {
            const r = await fetch(
                "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws?mode=write",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(stmt),
                    keepalive: true
                }
            );

            const data = await r.json();
            console.log("📩 Lambda response:", data);

            if (!data.ok) {
                console.error("❌ SCORM Cloud rejected:", data);
            }

            return data;

        } catch (e) {
            console.error("❌ Lambda write failed:", e);
            return { ok: false, error: e.message };
        }
    }

    /* ============================================================
       STORYLINE BUILDS TERRIBLE STATEMENTS — REBUILD FROM SCRATCH
    ============================================================= */
    async function sendXAPI(verbId, verbDisplay, objectId, objectName, resultData = {}) {
        try {

            const p = GetPlayer();
            if (!p) throw new Error("GetPlayer missing");

            const learnerName =
                p.GetVar("learnerName") ||
                localStorage.getItem("learnerName") ||
                "Anonymous";

            const sid =
                p.GetVar("sessionId") ||
                localStorage.getItem("sessionId") ||
                crypto.randomUUID();

            const mbox =
                "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

            /* ---------- AUTO-SCORING FIX (for question-level statements) ---------- */
            if (!resultData.score) {
                const isCorrect =
                    resultData.success === true ||
                    p.GetVar("isCorrect") === true ||
                    p.GetVar("Correct") === true ||
                    false;

                if (resultData.success == null) {
                    resultData.success = isCorrect;
                }

                // Question-level: 100 for correct, 0 for incorrect
                resultData.score = {
                    raw: isCorrect ? 100 : 0,
                    min: 0,
                    max: 100,
                    scaled: isCorrect ? 1 : 0
                };
            }
            // NOTE: summary/result slides already build a score object;
            // we do NOT override it because resultData.score already exists.

            /* ---------- Build full statement ---------- */
            const stmt = {
                actor: {
                    name: learnerName,
                    mbox
                },
                verb: {
                    id: verbId,
                    display: { "en-US": verbDisplay }
                },
                object: {
                    id: activityUrl(objectId),
                    definition: {
                        name: { "en-US": objectName },
                        type: "http://adlnet.gov/expapi/activities/lesson"
                    },
                    objectType: "Activity"
                },
                result: resultData,
                context: {
                    registration: sid,
                    platform: "Storyline",
                    language: "en-US"
                },
                timestamp: new Date().toISOString()
            };

            clean(stmt);
            window.lastStatementSent = stmt;
            console.log("📄 FINAL STATEMENT BUILT:", stmt);

            return await __SEND(stmt);

        } catch (e) {
            console.error("❌ ERROR building statement:", e);
        }
    }

    /* ============================================================
       OVERRIDE EVERY VERSION STORYLINE TRIES TO CALL
    ============================================================= */
    window.sendXAPI = sendXAPI;
    window.SendXAPI = sendXAPI;
    if (window.parent) window.parent.sendXAPI = sendXAPI;
    if (window.top) window.top.sendXAPI = sendXAPI;

    console.log("✅ Master Slide xAPI override loaded");

})();

}

window.Script4 = function()
{
  /* C3 Q1 – Incorrect */
(function () {
    const p = GetPlayer();
    if (!p) return;

    const comp = "C3";
    const sub = p.GetVar("C3_Q1_Sub") || p.GetVar("C3_SubCompetency") || "";
    const fullSub = `${comp}${sub}`;
    const qid = `${fullSub}-Q1`;

    const learner =
        p.GetVar("learnerName") ||
        localStorage.getItem("learnerName") ||
        "Anonymous";

    let sid =
        localStorage.getItem("sessionId") ||
        crypto.randomUUID();
    localStorage.setItem("sessionId", sid);

    const answer = p.GetVar("C3_Q1_Answer") || "";

    sendXAPI(
        "http://adlnet.gov/expapi/verbs/answered",
        "answered",
        `https://acbl.wirelxdfirm.com/activities/${comp}/questions/${qid}`,
        qid,
        {
            success: false,
            response: answer,
            extensions: {
                "https://acbl.wirelxdfirm.com/extensions/competencyId": comp,
                "https://acbl.wirelxdfirm.com/extensions/subCompetency": fullSub,
                "https://acbl.wirelxdfirm.com/extensions/questionId": qid,
                "https://acbl.wirelxdfirm.com/extensions/sessionId": sid
            }
        }
    );
})();

}

window.Script5 = function()
{
  /* C3 Q1 – Correct */
(function () {
    const p = GetPlayer();
    if (!p) return;

    const comp = "C3";
    const sub = p.GetVar("C3_Q1_Sub") || p.GetVar("C2_SubCompetency") || "";
    const fullSub = `${comp}${sub}`;
    const qid = `${fullSub}-Q1`;

    const learner =
        p.GetVar("learnerName") ||
        localStorage.getItem("learnerName") ||
        "Anonymous";

    let sid =
        localStorage.getItem("sessionId") ||
        crypto.randomUUID();
    localStorage.setItem("sessionId", sid);

    const answer = p.GetVar("C3_Q1_Answer") || "";

    sendXAPI(
        "http://adlnet.gov/expapi/verbs/answered",
        "answered",
        `https://acbl.wirelxdfirm.com/activities/${comp}/questions/${qid}`,
        qid,
        {
            success: true,
            response: answer,
            extensions: {
                "https://acbl.wirelxdfirm.com/extensions/competencyId": comp,
                "https://acbl.wirelxdfirm.com/extensions/subCompetency": fullSub,
                "https://acbl.wirelxdfirm.com/extensions/questionId": qid,
                "https://acbl.wirelxdfirm.com/extensions/sessionId": sid
            }
        }
    );
})();

}

window.Script6 = function()
{
  /* ============================================================
   STORYLINE → OVERRIDE ALL XAPI PATHS → FORCE LAMBDA
   Fully SCORM Cloud–compliant
============================================================ */

(function () {

    /* ---------- Utility: Remove null/undefined ---------- */
    function clean(o) {
        for (let k in o) {
            if (o[k] == null) delete o[k];
            else if (typeof o[k] === "object") clean(o[k]);
        }
        return o;
    }

    /* ---------- Activity URL helper (no double-encoding) ---------- */
    function activityUrl(id) {
        if (!id) return "https://acbl.wirelxdfirm.com/activities/unknown";

        // If it already looks like a full URL, leave it alone
        if (/^https?:\/\//i.test(id)) {
            return id.trim();
        }

        // Otherwise treat as relative path after /activities/
        id = String(id).replace(/^\/+/, "");
        return "https://acbl.wirelxdfirm.com/activities/" + id;
    }

    /* ---------- Actual send function ---------- */
    async function __SEND(stmt) {

        window.lastStatementSent = stmt;
        console.log("📤 Sending to Lambda:", stmt);

        try {
            const r = await fetch(
                "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws?mode=write",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(stmt),
                    keepalive: true
                }
            );

            const data = await r.json();
            console.log("📩 Lambda response:", data);

            if (!data.ok) {
                console.error("❌ SCORM Cloud rejected:", data);
            }

            return data;

        } catch (e) {
            console.error("❌ Lambda write failed:", e);
            return { ok: false, error: e.message };
        }
    }

    /* ============================================================
       STORYLINE BUILDS TERRIBLE STATEMENTS — REBUILD FROM SCRATCH
    ============================================================= */
    async function sendXAPI(verbId, verbDisplay, objectId, objectName, resultData = {}) {
        try {

            const p = GetPlayer();
            if (!p) throw new Error("GetPlayer missing");

            const learnerName =
                p.GetVar("learnerName") ||
                localStorage.getItem("learnerName") ||
                "Anonymous";

            const sid =
                p.GetVar("sessionId") ||
                localStorage.getItem("sessionId") ||
                crypto.randomUUID();

            const mbox =
                "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

            /* ---------- AUTO-SCORING FIX (for question-level statements) ---------- */
            if (!resultData.score) {
                const isCorrect =
                    resultData.success === true ||
                    p.GetVar("isCorrect") === true ||
                    p.GetVar("Correct") === true ||
                    false;

                if (resultData.success == null) {
                    resultData.success = isCorrect;
                }

                // Question-level: 100 for correct, 0 for incorrect
                resultData.score = {
                    raw: isCorrect ? 100 : 0,
                    min: 0,
                    max: 100,
                    scaled: isCorrect ? 1 : 0
                };
            }
            // NOTE: summary/result slides already build a score object;
            // we do NOT override it because resultData.score already exists.

            /* ---------- Build full statement ---------- */
            const stmt = {
                actor: {
                    name: learnerName,
                    mbox
                },
                verb: {
                    id: verbId,
                    display: { "en-US": verbDisplay }
                },
                object: {
                    id: activityUrl(objectId),
                    definition: {
                        name: { "en-US": objectName },
                        type: "http://adlnet.gov/expapi/activities/lesson"
                    },
                    objectType: "Activity"
                },
                result: resultData,
                context: {
                    registration: sid,
                    platform: "Storyline",
                    language: "en-US"
                },
                timestamp: new Date().toISOString()
            };

            clean(stmt);
            window.lastStatementSent = stmt;
            console.log("📄 FINAL STATEMENT BUILT:", stmt);

            return await __SEND(stmt);

        } catch (e) {
            console.error("❌ ERROR building statement:", e);
        }
    }

    /* ============================================================
       OVERRIDE EVERY VERSION STORYLINE TRIES TO CALL
    ============================================================= */
    window.sendXAPI = sendXAPI;
    window.SendXAPI = sendXAPI;
    if (window.parent) window.parent.sendXAPI = sendXAPI;
    if (window.top) window.top.sendXAPI = sendXAPI;

    console.log("✅ Master Slide xAPI override loaded");

})();

}

window.Script7 = function()
{
  /* C3 Q2 – Incorrect */
(function () {
    const p = GetPlayer();
    if (!p) return;

    const comp = "C3";
    const sub = p.GetVar("C3_Q2_Sub") || p.GetVar("C3_SubCompetency") || "";
    const fullSub = `${comp}${sub}`;
    const qid = `${fullSub}-Q2`;

    const learner =
        p.GetVar("learnerName") ||
        localStorage.getItem("learnerName") ||
        "Anonymous";

    let sid =
        localStorage.getItem("sessionId") ||
        crypto.randomUUID();
    localStorage.setItem("sessionId", sid);

    const answer = p.GetVar("C3_Q2_Answer") || "";

    sendXAPI(
        "http://adlnet.gov/expapi/verbs/answered",
        "answered",
        `https://acbl.wirelxdfirm.com/activities/${comp}/questions/${qid}`,
        qid,
        {
            success: false,
            response: answer,
            extensions: {
                "https://acbl.wirelxdfirm.com/extensions/competencyId": comp,
                "https://acbl.wirelxdfirm.com/extensions/subCompetency": fullSub,
                "https://acbl.wirelxdfirm.com/extensions/questionId": qid,
                "https://acbl.wirelxdfirm.com/extensions/sessionId": sid
            }
        }
    );
})();

}

window.Script8 = function()
{
  /* C3 Q2 – Correct */
(function () {
    const p = GetPlayer();
    if (!p) return;

    const comp = "C3";
    const sub = p.GetVar("C3_Q2_Sub") || p.GetVar("C3_SubCompetency") || "";
    const fullSub = `${comp}${sub}`;
    const qid = `${fullSub}-Q2`;

    const learner =
        p.GetVar("learnerName") ||
        localStorage.getItem("learnerName") ||
        "Anonymous";

    let sid =
        localStorage.getItem("sessionId") ||
        crypto.randomUUID();
    localStorage.setItem("sessionId", sid);

    const answer = p.GetVar("C3_Q2_Answer") || "";

    sendXAPI(
        "http://adlnet.gov/expapi/verbs/answered",
        "answered",
        `https://acbl.wirelxdfirm.com/activities/${comp}/questions/${qid}`,
        qid,
        {
            success: true,
            response: answer,
            extensions: {
                "https://acbl.wirelxdfirm.com/extensions/competencyId": comp,
                "https://acbl.wirelxdfirm.com/extensions/subCompetency": fullSub,
                "https://acbl.wirelxdfirm.com/extensions/questionId": qid,
                "https://acbl.wirelxdfirm.com/extensions/sessionId": sid
            }
        }
    );
})();

}

window.Script9 = function()
{
  /* ============================================================
   STORYLINE → OVERRIDE ALL XAPI PATHS → FORCE LAMBDA
   Fully SCORM Cloud–compliant
============================================================ */

(function () {

    /* ---------- Utility: Remove null/undefined ---------- */
    function clean(o) {
        for (let k in o) {
            if (o[k] == null) delete o[k];
            else if (typeof o[k] === "object") clean(o[k]);
        }
        return o;
    }

    /* ---------- Activity URL helper (no double-encoding) ---------- */
    function activityUrl(id) {
        if (!id) return "https://acbl.wirelxdfirm.com/activities/unknown";

        // If it already looks like a full URL, leave it alone
        if (/^https?:\/\//i.test(id)) {
            return id.trim();
        }

        // Otherwise treat as relative path after /activities/
        id = String(id).replace(/^\/+/, "");
        return "https://acbl.wirelxdfirm.com/activities/" + id;
    }

    /* ---------- Actual send function ---------- */
    async function __SEND(stmt) {

        window.lastStatementSent = stmt;
        console.log("📤 Sending to Lambda:", stmt);

        try {
            const r = await fetch(
                "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws?mode=write",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(stmt),
                    keepalive: true
                }
            );

            const data = await r.json();
            console.log("📩 Lambda response:", data);

            if (!data.ok) {
                console.error("❌ SCORM Cloud rejected:", data);
            }

            return data;

        } catch (e) {
            console.error("❌ Lambda write failed:", e);
            return { ok: false, error: e.message };
        }
    }

    /* ============================================================
       STORYLINE BUILDS TERRIBLE STATEMENTS — REBUILD FROM SCRATCH
    ============================================================= */
    async function sendXAPI(verbId, verbDisplay, objectId, objectName, resultData = {}) {
        try {

            const p = GetPlayer();
            if (!p) throw new Error("GetPlayer missing");

            const learnerName =
                p.GetVar("learnerName") ||
                localStorage.getItem("learnerName") ||
                "Anonymous";

            const sid =
                p.GetVar("sessionId") ||
                localStorage.getItem("sessionId") ||
                crypto.randomUUID();

            const mbox =
                "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

            /* ---------- AUTO-SCORING FIX (for question-level statements) ---------- */
            if (!resultData.score) {
                const isCorrect =
                    resultData.success === true ||
                    p.GetVar("isCorrect") === true ||
                    p.GetVar("Correct") === true ||
                    false;

                if (resultData.success == null) {
                    resultData.success = isCorrect;
                }

                // Question-level: 100 for correct, 0 for incorrect
                resultData.score = {
                    raw: isCorrect ? 100 : 0,
                    min: 0,
                    max: 100,
                    scaled: isCorrect ? 1 : 0
                };
            }
            // NOTE: summary/result slides already build a score object;
            // we do NOT override it because resultData.score already exists.

            /* ---------- Build full statement ---------- */
            const stmt = {
                actor: {
                    name: learnerName,
                    mbox
                },
                verb: {
                    id: verbId,
                    display: { "en-US": verbDisplay }
                },
                object: {
                    id: activityUrl(objectId),
                    definition: {
                        name: { "en-US": objectName },
                        type: "http://adlnet.gov/expapi/activities/lesson"
                    },
                    objectType: "Activity"
                },
                result: resultData,
                context: {
                    registration: sid,
                    platform: "Storyline",
                    language: "en-US"
                },
                timestamp: new Date().toISOString()
            };

            clean(stmt);
            window.lastStatementSent = stmt;
            console.log("📄 FINAL STATEMENT BUILT:", stmt);

            return await __SEND(stmt);

        } catch (e) {
            console.error("❌ ERROR building statement:", e);
        }
    }

    /* ============================================================
       OVERRIDE EVERY VERSION STORYLINE TRIES TO CALL
    ============================================================= */
    window.sendXAPI = sendXAPI;
    window.SendXAPI = sendXAPI;
    if (window.parent) window.parent.sendXAPI = sendXAPI;
    if (window.top) window.top.sendXAPI = sendXAPI;

    console.log("✅ Master Slide xAPI override loaded");

})();

}

window.Script10 = function()
{
  /* C3 Q3 – Incorrect */
(function () {
    const p = GetPlayer();
    if (!p) return;

    const comp = "C3";
    const sub = p.GetVar("C3_Q3_Sub") || p.GetVar("C3_SubCompetency") || "";
    const fullSub = `${comp}${sub}`;
    const qid = `${fullSub}-Q3`;

    const learner =
        p.GetVar("learnerName") ||
        localStorage.getItem("learnerName") ||
        "Anonymous";

    let sid =
        localStorage.getItem("sessionId") ||
        crypto.randomUUID();
    localStorage.setItem("sessionId", sid);

    const answer = p.GetVar("C3_Q3_Answer") || "";

    sendXAPI(
        "http://adlnet.gov/expapi/verbs/answered",
        "answered",
        `https://acbl.wirelxdfirm.com/activities/${comp}/questions/${qid}`,
        qid,
        {
            success: false,
            response: answer,
            extensions: {
                "https://acbl.wirelxdfirm.com/extensions/competencyId": comp,
                "https://acbl.wirelxdfirm.com/extensions/subCompetency": fullSub,
                "https://acbl.wirelxdfirm.com/extensions/questionId": qid,
                "https://acbl.wirelxdfirm.com/extensions/sessionId": sid
            }
        }
    );
})();

}

window.Script11 = function()
{
  /* C3 Q3 – Correct */
(function () {
    const p = GetPlayer();
    if (!p) return;

    const comp = "C3";
    const sub = p.GetVar("C3_Q3_Sub") || p.GetVar("C3_SubCompetency") || "";
    const fullSub = `${comp}${sub}`;
    const qid = `${fullSub}-Q3`;

    const learner =
        p.GetVar("learnerName") ||
        localStorage.getItem("learnerName") ||
        "Anonymous";

    let sid =
        localStorage.getItem("sessionId") ||
        crypto.randomUUID();
    localStorage.setItem("sessionId", sid);

    const answer = p.GetVar("C3_Q3_Answer") || "";

    sendXAPI(
        "http://adlnet.gov/expapi/verbs/answered",
        "answered",
        `https://acbl.wirelxdfirm.com/activities/${comp}/questions/${qid}`,
        qid,
        {
            success: true,
            response: answer,
            extensions: {
                "https://acbl.wirelxdfirm.com/extensions/competencyId": comp,
                "https://acbl.wirelxdfirm.com/extensions/subCompetency": fullSub,
                "https://acbl.wirelxdfirm.com/extensions/questionId": qid,
                "https://acbl.wirelxdfirm.com/extensions/sessionId": sid
            }
        }
    );
})();

}

window.Script12 = function()
{
  /* ============================================================
   STORYLINE → OVERRIDE ALL XAPI PATHS → FORCE LAMBDA
   Fully SCORM Cloud–compliant
============================================================ */

(function () {

    /* ---------- Utility: Remove null/undefined ---------- */
    function clean(o) {
        for (let k in o) {
            if (o[k] == null) delete o[k];
            else if (typeof o[k] === "object") clean(o[k]);
        }
        return o;
    }

    /* ---------- Activity URL helper (no double-encoding) ---------- */
    function activityUrl(id) {
        if (!id) return "https://acbl.wirelxdfirm.com/activities/unknown";

        // If it already looks like a full URL, leave it alone
        if (/^https?:\/\//i.test(id)) {
            return id.trim();
        }

        // Otherwise treat as relative path after /activities/
        id = String(id).replace(/^\/+/, "");
        return "https://acbl.wirelxdfirm.com/activities/" + id;
    }

    /* ---------- Actual send function ---------- */
    async function __SEND(stmt) {

        window.lastStatementSent = stmt;
        console.log("📤 Sending to Lambda:", stmt);

        try {
            const r = await fetch(
                "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws?mode=write",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(stmt),
                    keepalive: true
                }
            );

            const data = await r.json();
            console.log("📩 Lambda response:", data);

            if (!data.ok) {
                console.error("❌ SCORM Cloud rejected:", data);
            }

            return data;

        } catch (e) {
            console.error("❌ Lambda write failed:", e);
            return { ok: false, error: e.message };
        }
    }

    /* ============================================================
       STORYLINE BUILDS TERRIBLE STATEMENTS — REBUILD FROM SCRATCH
    ============================================================= */
    async function sendXAPI(verbId, verbDisplay, objectId, objectName, resultData = {}) {
        try {

            const p = GetPlayer();
            if (!p) throw new Error("GetPlayer missing");

            const learnerName =
                p.GetVar("learnerName") ||
                localStorage.getItem("learnerName") ||
                "Anonymous";

            const sid =
                p.GetVar("sessionId") ||
                localStorage.getItem("sessionId") ||
                crypto.randomUUID();

            const mbox =
                "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

            /* ---------- AUTO-SCORING FIX (for question-level statements) ---------- */
            if (!resultData.score) {
                const isCorrect =
                    resultData.success === true ||
                    p.GetVar("isCorrect") === true ||
                    p.GetVar("Correct") === true ||
                    false;

                if (resultData.success == null) {
                    resultData.success = isCorrect;
                }

                // Question-level: 100 for correct, 0 for incorrect
                resultData.score = {
                    raw: isCorrect ? 100 : 0,
                    min: 0,
                    max: 100,
                    scaled: isCorrect ? 1 : 0
                };
            }
            // NOTE: summary/result slides already build a score object;
            // we do NOT override it because resultData.score already exists.

            /* ---------- Build full statement ---------- */
            const stmt = {
                actor: {
                    name: learnerName,
                    mbox
                },
                verb: {
                    id: verbId,
                    display: { "en-US": verbDisplay }
                },
                object: {
                    id: activityUrl(objectId),
                    definition: {
                        name: { "en-US": objectName },
                        type: "http://adlnet.gov/expapi/activities/lesson"
                    },
                    objectType: "Activity"
                },
                result: resultData,
                context: {
                    registration: sid,
                    platform: "Storyline",
                    language: "en-US"
                },
                timestamp: new Date().toISOString()
            };

            clean(stmt);
            window.lastStatementSent = stmt;
            console.log("📄 FINAL STATEMENT BUILT:", stmt);

            return await __SEND(stmt);

        } catch (e) {
            console.error("❌ ERROR building statement:", e);
        }
    }

    /* ============================================================
       OVERRIDE EVERY VERSION STORYLINE TRIES TO CALL
    ============================================================= */
    window.sendXAPI = sendXAPI;
    window.SendXAPI = sendXAPI;
    if (window.parent) window.parent.sendXAPI = sendXAPI;
    if (window.top) window.top.sendXAPI = sendXAPI;

    console.log("✅ Master Slide xAPI override loaded");

})();

}

window.Script13 = function()
{
  /* ============================================================
   FINAL RESULTS SLIDE – FULLY ALIGNED
   Correctly sends:
   - Score
   - Mastery level
   - Missed[]
   - TestedOut
   - Finalized
   - Competency ID
   - Session ID
============================================================ */

(function () {
  function run() {
    try {
      const p = window.GetPlayer && window.GetPlayer();
      if (!p) {
        setTimeout(run, 150);
        return;
      }

      /* 1) Delay to allow Storyline to finish scoring */
      if (!window.__delayResults) {
        window.__delayResults = true;
        setTimeout(run, 350);
        return;
      }

      /* ---------------------------------------
         2) Competency detection
      --------------------------------------- */
      const compId = (location.href.toUpperCase().match(/C[123]/) || ["C1"])[0];

      /* ---------------------------------------
         3) Three subscores (C1a, C1b, C1c)
      --------------------------------------- */
      const sA = Number(p.GetVar(compId + "a_score") || 0);
      const sB = Number(p.GetVar(compId + "b_score") || 0);
      const sC = Number(p.GetVar(compId + "c_score") || 0);

      const correct = sA + sB + sC;

      const missed = [];
      if (sA !== 1) missed.push(`${compId}a`);
      if (sB !== 1) missed.push(`${compId}b`);
      if (sC !== 1) missed.push(`${compId}c`);

      /* ---------------------------------------
         4) Mastery
      --------------------------------------- */
      let mastery = "Failing";
      if (correct === 3) mastery = "Mastery";
      else if (correct === 2) mastery = "Proficient";
      else if (correct === 1) mastery = "Emerging";

      const testedOut = correct === 3;
      const finalized = false;

      /* ---------------------------------------
         5) Identity + session
      --------------------------------------- */
      let learner =
        localStorage.getItem("learnerName") ||
        p.GetVar("actorName") ||
        "Anonymous";

      learner = learner.trim() || "Anonymous";
      const sid =
        localStorage.getItem("sessionId") ||
        p.GetVar("sessionId");

      const mbox =
        "mailto:" + encodeURIComponent(learner) + "@wirelxdfirm.com";

      /* ---------------------------------------
         6) xAPI Statement (COMPLETE)
      --------------------------------------- */
      const resultObj = {
        score: { raw: correct, min: 0, max: 3 },
        success: correct >= 2,
        completion: true,
        extensions: {
          "https://acbl.wirelxdfirm.com/extensions/learnerName": learner,
          "https://acbl.wirelxdfirm.com/extensions/sessionId": sid,
          "https://acbl.wirelxdfirm.com/extensions/competencyId": compId,
          "https://acbl.wirelxdfirm.com/extensions/masteryLevel": mastery,
          "https://acbl.wirelxdfirm.com/extensions/missed": missed,
          "https://acbl.wirelxdfirm.com/extensions/testedOut": testedOut,
          "https://acbl.wirelxdfirm.com/extensions/finalized": finalized
        }
      };

      const verbId = correct >= 2
        ? "http://adlnet.gov/expapi/verbs/passed"
        : "http://adlnet.gov/expapi/verbs/failed";

      const verbDisplay = correct >= 2 ? "passed" : "failed";

      const objectId =
        `https://acbl.wirelxdfirm.com/activities/${compId}/test`;

      /* ---------------------------------------
         7) SEND (Master Override)
      --------------------------------------- */
      if (window.sendXAPI) {
        window.sendXAPI(
          verbId,
          verbDisplay,
          objectId,
          `${compId} Test`,
          resultObj,
          `Assessment for ${compId}`
        );
      }

      /* ---------------------------------------
         8) Save adaptive state (LOCAL aligned)
      --------------------------------------- */
      localStorage.setItem(`${compId}_score`, correct);
      localStorage.setItem(`${compId}_mastery`, mastery);
      localStorage.setItem(`${compId}_missed`, JSON.stringify(missed));
      localStorage.setItem(`${compId}_testedOut`, testedOut);
      localStorage.setItem(`${compId}_finalized`, finalized);
      localStorage.setItem("currentCompetency", compId);
      localStorage.setItem("currentMasteryLevel", mastery);

      console.log(`🎉 FINAL SCORE: ${correct}/3 (${mastery})`);

    } catch (err) {
      console.warn("❌ Results slide failed:", err);
    }
  }

  run();
})();

}

window.Script14 = function()
{
  /* ============================================================
   FAILURE LAYER INITIALIZER – Fully Aligned
============================================================ */

(function () {
  try {
    const p = GetPlayer();
    if (!p) return;

    const compId =
      (location.href.toUpperCase().match(/C[123]/) || ["C1"])[0];

    const learner =
      localStorage.getItem("learnerName") ||
      p.GetVar("learnerName") ||
      "Anonymous";

    const sid =
      localStorage.getItem("sessionId") ||
      p.GetVar("sessionId");

    const mastery =
      localStorage.getItem(`${compId}_mastery`) ||
      p.GetVar("masteryLevel") ||
      "Failing";

    const score =
      Number(localStorage.getItem(`${compId}_score`) || 0);

    const missedRaw =
      localStorage.getItem(`${compId}_missed`) || "[]";

    let missed = [];
    try { missed = JSON.parse(missedRaw); } catch {}

    const testedOut =
      localStorage.getItem(`${compId}_testedOut`) === "true";

    const finalized =
      localStorage.getItem(`${compId}_finalized`) === "true";

    /* ---------- SEND COMPLETION STATEMENT ---------- */
    const stmt = {
      actor: {
        name: learner,
        mbox:
          "mailto:" +
          encodeURIComponent(learner.replace(/\s+/g, "")) +
          "@wirelxdfirm.com"
      },
      verb: {
        id: "http://adlnet.gov/expapi/verbs/completed",
        display: { "en-US": "completed" }
      },
      object: {
        id: `https://acbl.wirelxdfirm.com/activities/${compId}/test`,
        definition: {
          name: { "en-US": `${compId} Test` },
          type: "http://adlnet.gov/expapi/activities/assessment"
        }
      },
      result: {
        score: { raw: score, min: 0, max: 3 },
        success: false,
        completion: true,
        extensions: {
          "https://acbl.wirelxdfirm.com/extensions/competencyId": compId,
          "https://acbl.wirelxdfirm.com/extensions/masteryLevel": mastery,
          "https://acbl.wirelxdfirm.com/extensions/missed": missed,
          "https://acbl.wirelxdfirm.com/extensions/testedOut": testedOut,
          "https://acbl.wirelxdfirm.com/extensions/finalized": finalized,
          "https://acbl.wirelxdfirm.com/extensions/sessionId": sid
        }
      }
    };

    if (window.sendXAPI) {
      window.sendXAPI("write", stmt);
    }

    /* ---------- Mark attempt complete ---------- */
    localStorage.setItem(`${compId}.completed`, "true");

    /* ---------- Clear resume keys ---------- */
    Object.keys(localStorage)
      .filter(k => k.startsWith("story") || k.includes("story_html5"))
      .forEach(k => localStorage.removeItem(k));

    console.log(`✔ FAILURE processed for ${compId}`);

  } catch (err) {
    console.error("❌ Failure-layer failed:", err);
  }
})();

}

window.Script15 = function()
{
  /* ============================================================
   RESULTS CONTINUE BUTTON (FINAL PATCHED VERSION)
   Sends learner to adaptive next.html with identity + comp
============================================================ */
(function () {
  try {
    const p = GetPlayer();
    if (!p) return;

    /* ---------------------------------------
       1) Detect competency from URL safely
    --------------------------------------- */
    let compId = "C1";
    try {
      const match = window.location.href.toUpperCase().match(/C[123]/);
      if (match && match[0]) compId = match[0];
    } catch (_) {}

    /* ---------------------------------------
       2) Identity / session
    --------------------------------------- */
    let learner =
      p.GetVar("learnerName") ||
      localStorage.getItem("learnerName") ||
      "Anonymous";

    learner = learner.trim();
    if (!learner) learner = "Anonymous";

    let sid =
      localStorage.getItem("sessionId") ||
      p.GetVar("sessionId") ||
      (window.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()));

    localStorage.setItem("sessionId", sid);

    /* ---------------------------------------
       3) Build redirect URL (NO double-encoding)
    --------------------------------------- */
    let dest = "";
    try {
      const u = new URL("https://www.wirelearningsolutions.com/next.html");
      u.searchParams.set("learnerName", learner);  // no encoding here
      u.searchParams.set("sid", sid);
      u.searchParams.set("current", compId);
      dest = u.toString();
    } catch (e) {
      console.warn("URL builder failed, using fallback");

      dest =
        "https://www.wirelearningsolutions.com/next.html" +
        "?learnerName=" + encodeURIComponent(learner) +
        "&sid=" + encodeURIComponent(sid) +
        "&current=" + encodeURIComponent(compId);
    }

    console.log("➡ Redirecting to adaptive next.html:", dest);

    /* ---------------------------------------
       4) Prevent double-execution
    --------------------------------------- */
    if (!window.__redirectFired) {
      window.__redirectFired = true;
      window.location.href = dest;
    }

  } catch (err) {
    console.error("❌ Results Continue redirect failed:", err);
  }
})();

}

window.Script16 = function()
{
  /* ============================================================
   SUCCESS LAYER INITIALIZER – Fully Aligned
============================================================ */

(function () {
  try {
    const p = GetPlayer();
    if (!p) return;

    const compId =
      (location.href.toUpperCase().match(/C[123]/) || ["C1"])[0];

    const learner =
      localStorage.getItem("learnerName") ||
      p.GetVar("learnerName") ||
      "Anonymous";

    const sid =
      localStorage.getItem("sessionId") ||
      p.GetVar("sessionId");

    const mastery =
      localStorage.getItem(`${compId}_mastery`) ||
      p.GetVar("masteryLevel") ||
      "Failing";

    const score =
      Number(localStorage.getItem(`${compId}_score`) || 0);

    const missedRaw =
      localStorage.getItem(`${compId}_missed`) || "[]";

    let missed = [];
    try { missed = JSON.parse(missedRaw); } catch {}

    const testedOut =
      localStorage.getItem(`${compId}_testedOut`) === "true";

    const finalized =
      localStorage.getItem(`${compId}_finalized`) === "true";

    /* ---------- SEND COMPLETION STATEMENT ---------- */
    const stmt = {
      actor: {
        name: learner,
        mbox:
          "mailto:" +
          encodeURIComponent(learner.replace(/\s+/g, "")) +
          "@wirelxdfirm.com"
      },
      verb: {
        id: "http://adlnet.gov/expapi/verbs/completed",
        display: { "en-US": "completed" }
      },
      object: {
        id: `https://acbl.wirelxdfirm.com/activities/${compId}/test`,
        definition: {
          name: { "en-US": `${compId} Test` },
          type: "http://adlnet.gov/expapi/activities/assessment"
        }
      },
      result: {
        score: { raw: score, min: 0, max: 3 },
        success: mastery === "Mastery",
        completion: true,
        extensions: {
          "https://acbl.wirelxdfirm.com/extensions/competencyId": compId,
          "https://acbl.wirelxdfirm.com/extensions/masteryLevel": mastery,
          "https://acbl.wirelxdfirm.com/extensions/missed": missed,
          "https://acbl.wirelxdfirm.com/extensions/testedOut": testedOut,
          "https://acbl.wirelxdfirm.com/extensions/finalized": finalized,
          "https://acbl.wirelxdfirm.com/extensions/sessionId": sid
        }
      }
    };

    if (window.sendXAPI) {
      window.sendXAPI("write", stmt);
    }

    /* ---------- Mark attempt complete ---------- */
    localStorage.setItem(`${compId}.completed`, "true");

    /* ---------- Clear resume keys ---------- */
    Object.keys(localStorage)
      .filter(k => k.startsWith("story") || k.includes("story_html5"))
      .forEach(k => localStorage.removeItem(k));

    console.log(`✔ SUCCESS processed for ${compId}`);

  } catch (err) {
    console.error("❌ Success-layer failed:", err);
  }
})();

}

window.Script17 = function()
{
  /* ============================================================
   RESULTS CONTINUE BUTTON (FINAL PATCHED VERSION)
   Sends learner to adaptive next.html with identity + comp
============================================================ */
(function () {
  try {
    const p = GetPlayer();
    if (!p) return;

    /* ---------------------------------------
       1) Detect competency from URL safely
    --------------------------------------- */
    let compId = "C1";
    try {
      const match = window.location.href.toUpperCase().match(/C[123]/);
      if (match && match[0]) compId = match[0];
    } catch (_) {}

    /* ---------------------------------------
       2) Identity / session
    --------------------------------------- */
    let learner =
      p.GetVar("learnerName") ||
      localStorage.getItem("learnerName") ||
      "Anonymous";

    learner = learner.trim();
    if (!learner) learner = "Anonymous";

    let sid =
      localStorage.getItem("sessionId") ||
      p.GetVar("sessionId") ||
      (window.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()));

    localStorage.setItem("sessionId", sid);

    /* ---------------------------------------
       3) Build redirect URL (NO double-encoding)
    --------------------------------------- */
    let dest = "";
    try {
      const u = new URL("https://www.wirelearningsolutions.com/next.html");
      u.searchParams.set("learnerName", learner);  // no encoding here
      u.searchParams.set("sid", sid);
      u.searchParams.set("current", compId);
      dest = u.toString();
    } catch (e) {
      console.warn("URL builder failed, using fallback");

      dest =
        "https://www.wirelearningsolutions.com/next.html" +
        "?learnerName=" + encodeURIComponent(learner) +
        "&sid=" + encodeURIComponent(sid) +
        "&current=" + encodeURIComponent(compId);
    }

    console.log("➡ Redirecting to adaptive next.html:", dest);

    /* ---------------------------------------
       4) Prevent double-execution
    --------------------------------------- */
    if (!window.__redirectFired) {
      window.__redirectFired = true;
      window.location.href = dest;
    }

  } catch (err) {
    console.error("❌ Results Continue redirect failed:", err);
  }
})();

}

};
