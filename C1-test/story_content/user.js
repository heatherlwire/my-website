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
   Adaptive Learning – Test Start + Resume Gate (Dynamic)
   Works for C1-test, C2-test, C3-test with NO edits
   ============================================================ */
(function () {
  try {
    const p = GetPlayer();
    if (!p) return;

    /* ---------------------------------------
       1. Resolve learner identity (QS > storage)
       --------------------------------------- */
    function getQS(name) {
      const m = new RegExp("[?&]" + name + "=([^&#]*)").exec(location.search);
      return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : null;
    }

    const qsName = getQS("learnerName") || getQS("name");
    const stored  = localStorage.getItem("learnerName");
    let learner   = (qsName || stored || "").trim();

    if (!learner) learner = "Anonymous";
    const mbox = "mailto:" + encodeURIComponent(learner) + "@wirelxdfirm.com";

    /* ---------------------------------------
       2. Create or restore session ID
       --------------------------------------- */
    let sid = localStorage.getItem("sessionId");
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem("sessionId", sid);
    }

    /* ---------------------------------------
       3. Push identity into Storyline variables
       --------------------------------------- */
    p.SetVar("learnerName", learner);
    p.SetVar("actorName", learner);
    p.SetVar("actorMbox", mbox);
    p.SetVar("sessionId", sid);

    localStorage.setItem("learnerName", learner);
    localStorage.setItem("actorName", learner);
    localStorage.setItem("actorMbox", mbox);

    /* ---------------------------------------
       4. Detect competency from URL & push to Storyline
       --------------------------------------- */
    const url  = location.href.toUpperCase();
    const comp = (url.match(/C[123]/) || ["C1"])[0];

    localStorage.setItem("currentCompetency", comp);
    p.SetVar("currentComp", comp);   // <-- REQUIRED FOR xAPI

    /* ---------------------------------------
       5. Detect Sub-Competency from document title
          Auto-detects patterns like C1a, C1b, C1c
       --------------------------------------- */
    const title = document.title || "";
    const subMatch = title.match(/C[123][ABC]/i);

    if (subMatch) {
      const sub = subMatch[0];
      p.SetVar("CurrentSub", sub);            // used by xAPI
      p.SetVar("C1_SubCompetency", sub);      // backward compatible
      localStorage.setItem("currentSub", sub);
    } else {
      console.log("🟡 No sub-competency found in title");
    }

    /* ---------------------------------------
       6. Test-start tracking (runs only once)
       --------------------------------------- */
    const startKey = `${comp}.started`;
    if (!localStorage.getItem(startKey)) {

      localStorage.setItem(startKey, "true");
      localStorage.setItem(`${comp}.startedAt`, new Date().toISOString());

      if (window.sendXAPI) {
        sendXAPI(
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

    /* ---------------------------------------
       7. Resume Gate
       --------------------------------------- */
    const scoreKey     = `${comp}.score`;
    const completeKey  = `${comp}.completed`;

    const storedScore     = localStorage.getItem(scoreKey);
    const storedCompleted = localStorage.getItem(completeKey) === "true";

    // New attempt → nothing stored
    if (!storedScore) return;

    // Completed attempt → force new attempt
    if (storedCompleted) return;

    // Otherwise resume
    if (confirm("Do you want to resume your previous test attempt?")) {
      console.log("▶ Resuming previous attempt");
    }

  } catch (err) {
    console.warn("❌ Init Error:", err);
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
  /* C1 Q1 – Incorrect layer */
(function () {
    const p = GetPlayer();
    if (!p) return;

    const learner =
        p.GetVar("learnerName") ||
        localStorage.getItem("learnerName") ||
        "Anonymous";

    let sid =
        localStorage.getItem("sessionId") ||
        p.GetVar("sessionId") ||
        (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

    localStorage.setItem("sessionId", sid);

    const comp = "C1";
    const subId = "C1a";     // same as above
    const qNum = 1;
    const qid = `${subId}-Q${qNum}`;

    const answer = p.GetVar("C1_Q1_Answer") || "";

    sendXAPI(
        "http://adlnet.gov/expapi/verbs/answered",
        "answered",
        `${comp}/questions/${qid}`,
        qid,
        {
            success: false,       // Incorrect layer
            response: answer,
            extensions: {
                "https://acbl.wirelxdfirm.com/extensions/competencyId": comp,
                "https://acbl.wirelxdfirm.com/extensions/subCompetency": subId,
                "https://acbl.wirelxdfirm.com/extensions/questionId": qid,
                "https://acbl.wirelxdfirm.com/extensions/sessionId": sid
            }
        }
    );
})();

}

window.Script5 = function()
{
  /* C1 Q1 – Correct layer */
(function () {
    const p = GetPlayer();
    if (!p) return;

    // Identity / session
    const learner =
        p.GetVar("learnerName") ||
        localStorage.getItem("learnerName") ||
        "Anonymous";

    let sid =
        localStorage.getItem("sessionId") ||
        p.GetVar("sessionId") ||
        (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

    localStorage.setItem("sessionId", sid);

    // This question's mapping
    const comp = "C1";          // competency
    const subId = "C1a";        // sub-competency for Q1
    const qNum = 1;
    const qid = `${subId}-Q${qNum}`; // "C1a-Q1"

    // Optional: pull text/response if you have these vars
    const answer = p.GetVar("C1_Q1_Answer") || "";
    // const qText = p.GetVar("C1_Q1_Text") || "";

    // Send xAPI via master override
    sendXAPI(
        "http://adlnet.gov/expapi/verbs/answered",
        "answered",
        `${comp}/questions/${qid}`,  // becomes https://acbl.../activities/C1/questions/C1a-Q1
        qid,
        {
            success: true,          // Correct layer
            response: answer,
            extensions: {
                "https://acbl.wirelxdfirm.com/extensions/competencyId": comp,
                "https://acbl.wirelxdfirm.com/extensions/subCompetency": subId,
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
  /* C1 Q1 – Incorrect layer */
(function () {
    const p = GetPlayer();
    if (!p) return;

    const learner =
        p.GetVar("learnerName") ||
        localStorage.getItem("learnerName") ||
        "Anonymous";

    let sid =
        localStorage.getItem("sessionId") ||
        p.GetVar("sessionId") ||
        (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

    localStorage.setItem("sessionId", sid);

    const comp = "C1";
    const subId = "C1b";
	const qNum = 2;

	const answer = p.GetVar("C1_Q2_Answer") || "";

    sendXAPI(
        "http://adlnet.gov/expapi/verbs/answered",
        "answered",
        `${comp}/questions/${qid}`,
        qid,
        {
            success: false,       // Incorrect layer
            response: answer,
            extensions: {
                "https://acbl.wirelxdfirm.com/extensions/competencyId": comp,
                "https://acbl.wirelxdfirm.com/extensions/subCompetency": subId,
                "https://acbl.wirelxdfirm.com/extensions/questionId": qid,
                "https://acbl.wirelxdfirm.com/extensions/sessionId": sid
            }
        }
    );
})();

}

window.Script8 = function()
{
  /* C1 Q1 – Correct layer */
(function () {
    const p = GetPlayer();
    if (!p) return;

    // Identity / session
    const learner =
        p.GetVar("learnerName") ||
        localStorage.getItem("learnerName") ||
        "Anonymous";

    let sid =
        localStorage.getItem("sessionId") ||
        p.GetVar("sessionId") ||
        (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

    localStorage.setItem("sessionId", sid);

    // This question's mapping
    const comp = "C1";          // competency
    const subId = "C1a";        // sub-competency for Q1
    const qNum = 1;
    const qid = `${subId}-Q${qNum}`; // "C1a-Q1"

    // Optional: pull text/response if you have these vars
    const answer = p.GetVar("C1_Q1_Answer") || "";
    // const qText = p.GetVar("C1_Q1_Text") || "";

    // Send xAPI via master override
    sendXAPI(
        "http://adlnet.gov/expapi/verbs/answered",
        "answered",
        `${comp}/questions/${qid}`,  // becomes https://acbl.../activities/C1/questions/C1a-Q1
        qid,
        {
            success: true,          // Correct layer
            response: answer,
            extensions: {
                "https://acbl.wirelxdfirm.com/extensions/competencyId": comp,
                "https://acbl.wirelxdfirm.com/extensions/subCompetency": subId,
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
  /* C1 Q1 – Incorrect layer */
(function () {
    const p = GetPlayer();
    if (!p) return;

    const learner =
        p.GetVar("learnerName") ||
        localStorage.getItem("learnerName") ||
        "Anonymous";

    let sid =
        localStorage.getItem("sessionId") ||
        p.GetVar("sessionId") ||
        (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

    localStorage.setItem("sessionId", sid);

    const comp = "C1";
    const subId = "C1c";
	const qNum = 3;
	
	const answer = p.GetVar("C1_Q3_Answer") || "";


    sendXAPI(
        "http://adlnet.gov/expapi/verbs/answered",
        "answered",
        `${comp}/questions/${qid}`,
        qid,
        {
            success: false,       // Incorrect layer
            response: answer,
            extensions: {
                "https://acbl.wirelxdfirm.com/extensions/competencyId": comp,
                "https://acbl.wirelxdfirm.com/extensions/subCompetency": subId,
                "https://acbl.wirelxdfirm.com/extensions/questionId": qid,
                "https://acbl.wirelxdfirm.com/extensions/sessionId": sid
            }
        }
    );
})();

}

window.Script11 = function()
{
  /* C1 Q1 – Correct layer */
(function () {
    const p = GetPlayer();
    if (!p) return;

    // Identity / session
    const learner =
        p.GetVar("learnerName") ||
        localStorage.getItem("learnerName") ||
        "Anonymous";

    let sid =
        localStorage.getItem("sessionId") ||
        p.GetVar("sessionId") ||
        (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

    localStorage.setItem("sessionId", sid);

    // This question's mapping
    const comp = "C1";          // competency
   	const subId = "C1c";
	const qNum = 3;



    // Optional: pull text/response if you have these vars
	const answer = p.GetVar("C1_Q3_Answer") || "";
    // const qText = p.GetVar("C1_Q1_Text") || "";

    // Send xAPI via master override
    sendXAPI(
        "http://adlnet.gov/expapi/verbs/answered",
        "answered",
        `${comp}/questions/${qid}`,  // becomes https://acbl.../activities/C1/questions/C1a-Q1
        qid,
        {
            success: true,          // Correct layer
            response: answer,
            extensions: {
                "https://acbl.wirelxdfirm.com/extensions/competencyId": comp,
                "https://acbl.wirelxdfirm.com/extensions/subCompetency": subId,
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
   RESULTS SLIDE – FINAL BULLETPROOF VERSION
   SCORM CLOUD–COMPLIANT + CORRECT SCORE COLLECTION
============================================================ */
(function () {
  function run() {
    try {
      const p = window.GetPlayer && window.GetPlayer();
      if (!p) {
        setTimeout(run, 150);
        return;
      }

      /* ---------------------------------------------------------
         IMPORTANT: Delay one cycle so Storyline finishes scoring
      --------------------------------------------------------- */
      if (window.__delayResultsRun !== true) {
        window.__delayResultsRun = true;
        setTimeout(run, 350);   // ← THIS FIXES THE 0-SCORE ISSUE 100 percent
        return;
      }

      /* ---------------------------------------------------------
         1) Detect competency (C1 / C2 / C3)
      --------------------------------------------------------- */
      const url = window.location.href.toUpperCase();
      const compMatch = url.match(/C[123]/);
      const compId = compMatch ? compMatch[0] : "C1";

      /* ---------------------------------------------------------
         2) Subscores: C1a_score, C1b_score, C1c_score
      --------------------------------------------------------- */
      const sA = Number(p.GetVar(compId + "a_score") || 0);
      const sB = Number(p.GetVar(compId + "b_score") || 0);
      const sC = Number(p.GetVar(compId + "c_score") || 0);

      const correct = sA + sB + sC;

      /* missed[] detection */
      const missed = [];
      if (sA !== 1) missed.push(compId + "a");
      if (sB !== 1) missed.push(compId + "b");
      if (sC !== 1) missed.push(compId + "c");

      /* ---------------------------------------------------------
         3) Mastery level
      --------------------------------------------------------- */
      let mastery = "Failing";
      if (correct === 3) mastery = "Mastery";
      else if (correct === 2) mastery = "Proficient";
      else if (correct === 1) mastery = "Emerging";

      const testedOut = correct === 3;
      const finalized = false;

      /* ---------------------------------------------------------
         4) Identity + Session
      --------------------------------------------------------- */
      let learner =
        localStorage.getItem("learnerName") ||
        p.GetVar("actorName") ||
        "Anonymous";

      learner = learner.trim() || "Anonymous";

      let sid =
        localStorage.getItem("sessionId") ||
        p.GetVar("sessionId") ||
        (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

      localStorage.setItem("sessionId", sid);
      const mbox = "mailto:" + encodeURIComponent(learner) + "@wirelxdfirm.com";

      /* ---------------------------------------------------------
         5) Build summary statement (COMPLETE + SCORE)
      --------------------------------------------------------- */
      const passed = correct >= 2;

      const resultObj = {
        score: { raw: correct, min: 0, max: 3 },
        success: passed,
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

      const verbId = passed
        ? "http://adlnet.gov/expapi/verbs/passed"
        : "http://adlnet.gov/expapi/verbs/failed";

      const verbDisplay = passed ? "passed" : "failed";

      const objectId = `https://acbl.wirelxdfirm.com/activities/${compId}/test`;
      const objectName = `${compId} Test`;
      const objectDesc = `Assessment for competency ${compId}`;

      /* ---------------------------------------------------------
         6) SEND VIA MASTER-SLIDE OVERRIDE
      --------------------------------------------------------- */
      if (window.sendXAPI) {
        window.sendXAPI(
          verbId,
          verbDisplay,
          objectId,
          objectName,
          resultObj,
          objectDesc
        );
        console.log("✅ Summary sent through sendXAPI()");
      } else {
        console.warn("⚠ sendXAPI() missing — fallback direct");
        fetch(
          "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws?mode=write",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              actor: { name: learner, mbox },
              verb: { id: verbId, display: { "en-US": verbDisplay } },
              object: {
                id: objectId,
                definition: {
                  name: { "en-US": objectName },
                  description: { "en-US": objectDesc },
                  type: "http://adlnet.gov/expapi/activities/assessment"
                },
                objectType: "Activity"
              },
              result: resultObj,
              context: { registration: sid },
              timestamp: new Date().toISOString()
            })
          }
        );
      }

      /* ---------------------------------------------------------
         7) Save adaptive state
      --------------------------------------------------------- */
      localStorage.setItem(`${compId}.score`, correct);
      localStorage.setItem(`${compId}.missed`, JSON.stringify(missed));
      localStorage.setItem(`${compId}.mastery`, mastery);
      localStorage.setItem(`${compId}.testedOut`, testedOut);
      localStorage.setItem(`${compId}.finalized`, finalized);
      localStorage.setItem("currentCompetency", compId);
      localStorage.setItem("currentMasteryLevel", mastery);

      console.log(`🎉 FINAL SCORE: ${correct}/3 (${mastery})`, { missed });

    } catch (e) {
      console.warn("❌ Results slide script failed:", e);
    }
  }

  run();
})();

}

window.Script14 = function()
{
  /* ============================================================
   FAILURE LAYER INITIALIZER (Bulletproof Final Version)
   Marks test attempt as completed & clears Storyline resume
============================================================ */

(function () {
  try {

    /* ----------------------------------------------------------
       1. Detect competency safely (C1 / C2 / C3)
    ---------------------------------------------------------- */
    let compId = "C1";
    try {
      const match = window.location.href.toUpperCase().match(/C[123]/);
      if (match && match[0]) compId = match[0];
      else console.warn("⚠ No compId found in URL, defaulting to C1");
    } catch (e) {
      console.warn("⚠ URL parse failed; defaulting compId = C1");
    }

    /* ----------------------------------------------------------
       2. Mark attempt as completed (adaptive state written in base)
    ---------------------------------------------------------- */
    try {
      localStorage.setItem(`${compId}.completed`, "true");
      console.log(`✔ Marked ${compId} attempt completed (FAILURE outcome)`);
    } catch (e) {
      console.warn("⚠ Could not set completion flag:", e);
    }

    /* ----------------------------------------------------------
       3. Optional SCORM completion (ignored in HTML export)
          Note: A failed test attempt is still a "completed" attempt.
    ---------------------------------------------------------- */
    try {
      const lms = window.lmsAPI || null;
      if (lms && typeof lms.SetStatus === "function") {
        lms.SetStatus("completed");
        lms.CommitData();
        console.log("✔ SCORM completion sent (FAILURE)");
      }
    } catch (e) {
      console.log("ℹ SCORM API unavailable (HTML export)");
    }

    /* ----------------------------------------------------------
       4. Clear Storyline *only* resume keys
          DO NOT clear:
            learnerName
            sessionId
            C?_mastery
            C?_missed
            C?_score
            testedOut
            finalized
    ---------------------------------------------------------- */
    try {
      const keys = Object.keys(localStorage);

      const slKeys = keys.filter(k =>
        k.startsWith("story") || k.includes("story_html5")
      );

      for (const k of slKeys) {
        localStorage.removeItem(k);
      }

      console.log("✔ Storyline resume keys cleared (FAILURE)");

    } catch (e) {
      console.warn("⚠ Could not clear resume keys:", e);
    }

    /* ----------------------------------------------------------
       5. Prevent rare Storyline double-fire
    ---------------------------------------------------------- */
    window.__failureLayerInit = true;

  } catch (err) {
    console.error("❌ Failure-layer initialization failed:", err);
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
   SUCCESS LAYER INITIALIZER (Bulletproof Final Version)
   Marks test attempt as completed & clears Storyline resume
============================================================ */

(function () {
  try {

    /* ----------------------------------------------------------
       1. Detect competency safely (C1 / C2 / C3)
    ---------------------------------------------------------- */
    let compId = "C1";
    try {
      const match = window.location.href.toUpperCase().match(/C[123]/);
      if (match && match[0]) compId = match[0];
      else console.warn("⚠ No compId found in URL, defaulting to C1");
    } catch (e) {
      console.warn("⚠ URL parse failed; defaulting compId = C1");
    }

    /* ----------------------------------------------------------
       2. Mark attempt as completed (adaptive state stays elsewhere)
    ---------------------------------------------------------- */
    try {
      localStorage.setItem(`${compId}.completed`, "true");
      console.log(`✔ Marked ${compId} attempt completed (SUCCESS outcome)`);
    } catch (e) {
      console.warn("⚠ Could not set completion flag:", e);
    }

    /* ----------------------------------------------------------
       3. Optional SCORM completion (ignored in HTML export)
    ---------------------------------------------------------- */
    try {
      const lms = window.lmsAPI || null;
      if (lms && typeof lms.SetStatus === "function") {
        lms.SetStatus("completed");
        lms.CommitData();
        console.log("✔ SCORM completion sent (SUCCESS)");
      }
    } catch (e) {
      console.log("ℹ SCORM API unavailable (HTML export)");
    }

    /* ----------------------------------------------------------
       4. Clear Storyline *only* resume keys
          DO NOT clear:
            learnerName
            sessionId
            C?_mastery
            C?_missed
            C?_score
            testedOut
            finalized
    ---------------------------------------------------------- */
    try {
      const keys = Object.keys(localStorage);

      // Storyline uses both "story" and "story_html5" patterns
      const slKeys = keys.filter(k =>
        k.startsWith("story") || k.includes("story_html5")
      );

      for (const k of slKeys) {
        localStorage.removeItem(k);
      }

      console.log("✔ Storyline resume keys cleared (SUCCESS)");

    } catch (e) {
      console.warn("⚠ Could not clear resume keys:", e);
    }

    /* ----------------------------------------------------------
       5. Prevent rare Storyline double-fire
    ---------------------------------------------------------- */
    window.__successLayerInit = true;

  } catch (err) {
    console.error("❌ Success-layer initialization failed:", err);
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
