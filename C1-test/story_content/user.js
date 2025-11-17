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
  // =======================================================
//   GLOBAL xAPI Helper (loads once, safe, consistent)
// =======================================================
if (!window.__XAPI_HELPER__) {
  window.__XAPI_HELPER__ = true;

  console.log("✅ Unified xAPI helper initialized on Master Slide");

  // ---------------------------------------
  // Rehydrate Storyline variables
  // ---------------------------------------
  setTimeout(() => {
    try {
      const p = GetPlayer && GetPlayer();
      if (!p) return;

      const storedName = localStorage.getItem("learnerName");
      const storedSid  = localStorage.getItem("sessionId");

      if (storedName && !p.GetVar("learnerName")) {
        p.SetVar("learnerName", storedName);
        p.SetVar("actorName", storedName);
        p.SetVar(
          "actorMbox",
          "mailto:" + encodeURIComponent(storedName) + "@wirelxdfirm.com"
        );
      }

      if (storedSid && !p.GetVar("sessionId")) {
        p.SetVar("sessionId", storedSid);
      }

      console.log("🔁 Storyline vars synced from localStorage");
    } catch (e) {
      console.warn("⚠️ Sync from localStorage failed:", e);
    }
  }, 300);

  // ---------------------------------------
  // Global sendXAPI helper
  // ---------------------------------------
  window.sendXAPI = async function (
    verbId,
    verbDisplay,
    objectId,
    objectName,
    resultData = {}
  ) {
    try {
      const p = GetPlayer();
      if (!p) throw new Error("GetPlayer unavailable");

      const learnerName =
        p.GetVar("learnerName") ||
        localStorage.getItem("learnerName") ||
        "Anonymous";

      const sessionId =
        p.GetVar("sessionId") ||
        localStorage.getItem("sessionId") ||
        (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

      const mbox =
        "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

      const stmt = {
        actor: { name: learnerName, mbox },
        verb: { id: verbId, display: { "en-US": verbDisplay } },
        object: {
          id: objectId,
          definition: { name: { "en-US": objectName } },
          objectType: "Activity"
        },
        result: resultData,
        context: { registration: sessionId },
        timestamp: new Date().toISOString()
      };

      const endpoint =
        "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws";

      const r = await fetch(endpoint + "?mode=write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stmt),
        keepalive: true
      });

      if (r.ok)
        console.log(`✅ xAPI sent via Lambda: ${verbDisplay}`);
      else
        console.warn(`⚠️ LRS returned status ${r.status}`);
    } catch (err) {
      console.error("❌ sendXAPI failed:", err);
    }
  };
}

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
  // =======================================================
//   GLOBAL xAPI Helper (loads once, safe, consistent)
// =======================================================
if (!window.__XAPI_HELPER__) {
  window.__XAPI_HELPER__ = true;

  console.log("✅ Unified xAPI helper initialized on Master Slide");

  // ---------------------------------------
  // Rehydrate Storyline variables
  // ---------------------------------------
  setTimeout(() => {
    try {
      const p = GetPlayer && GetPlayer();
      if (!p) return;

      const storedName = localStorage.getItem("learnerName");
      const storedSid  = localStorage.getItem("sessionId");

      if (storedName && !p.GetVar("learnerName")) {
        p.SetVar("learnerName", storedName);
        p.SetVar("actorName", storedName);
        p.SetVar(
          "actorMbox",
          "mailto:" + encodeURIComponent(storedName) + "@wirelxdfirm.com"
        );
      }

      if (storedSid && !p.GetVar("sessionId")) {
        p.SetVar("sessionId", storedSid);
      }

      console.log("🔁 Storyline vars synced from localStorage");
    } catch (e) {
      console.warn("⚠️ Sync from localStorage failed:", e);
    }
  }, 300);

  // ---------------------------------------
  // Global sendXAPI helper
  // ---------------------------------------
  window.sendXAPI = async function (
    verbId,
    verbDisplay,
    objectId,
    objectName,
    resultData = {}
  ) {
    try {
      const p = GetPlayer();
      if (!p) throw new Error("GetPlayer unavailable");

      const learnerName =
        p.GetVar("learnerName") ||
        localStorage.getItem("learnerName") ||
        "Anonymous";

      const sessionId =
        p.GetVar("sessionId") ||
        localStorage.getItem("sessionId") ||
        (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

      const mbox =
        "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

      const stmt = {
        actor: { name: learnerName, mbox },
        verb: { id: verbId, display: { "en-US": verbDisplay } },
        object: {
          id: objectId,
          definition: { name: { "en-US": objectName } },
          objectType: "Activity"
        },
        result: resultData,
        context: { registration: sessionId },
        timestamp: new Date().toISOString()
      };

      const endpoint =
        "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws";

      const r = await fetch(endpoint + "?mode=write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stmt),
        keepalive: true
      });

      if (r.ok)
        console.log(`✅ xAPI sent via Lambda: ${verbDisplay}`);
      else
        console.warn(`⚠️ LRS returned status ${r.status}`);
    } catch (err) {
      console.error("❌ sendXAPI failed:", err);
    }
  };
}

}

window.Script4 = function()
{
  /* Q1 Incorrect – Final Patched Version */
(function () {
    const p = GetPlayer();
    if (!p) return;

    /* -------------------------------------------------------
       Identity / Session
    ------------------------------------------------------- */
    const learner =
        p.GetVar("learnerName") ||
        localStorage.getItem("learnerName") ||
        "Anonymous";

    let sid =
        localStorage.getItem("sessionId") ||
        p.GetVar("sessionId") ||
        (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

    localStorage.setItem("sessionId", sid);

    /* -------------------------------------------------------
       Competency + Question Data
    ------------------------------------------------------- */
    const comp = "C1";

    const sub = p.GetVar("C1_Q1_Sub") || "";
    const answer = p.GetVar("C1_Q1_Answer") || "";
    const qText = p.GetVar("C1_Q1_Text") || "";
    const success = !!p.GetVar("C1_Q1_IsCorrect");   // FALSE for incorrect

    const qid = `${comp}${sub}-Q1`;      // C1a-Q1
    const fullSub = `${comp}${sub}`;     // C1a

    /* -------------------------------------------------------
       Send XAPI
    ------------------------------------------------------- */
    sendXAPI(
        "http://adlnet.gov/expapi/verbs/answered",
        "answered",
        `https://acbl.wirelxdfirm.com/activities/${comp}/questions/${qid}`,
        qid,
        {
            success,
            response: answer,
            extensions: {
                "https://acbl.wirelxdfirm.com/extensions/competencyId": comp,
                "https://acbl.wirelxdfirm.com/extensions/subCompetency": fullSub,
                "https://acbl.wirelxdfirm.com/extensions/questionId": qid,
                "https://acbl.wirelxdfirm.com/extensions/sessionId": sid
            }
        },
        qText
    );
})();

}

window.Script5 = function()
{
  /* Q1 Correct – Final Patched Version */
(function () {
    const p = GetPlayer();
    if (!p) return;

    /* -------------------------------------------------------
       Identity / Session
    ------------------------------------------------------- */
    const learner =
        p.GetVar("learnerName") ||
        localStorage.getItem("learnerName") ||
        "Anonymous";

    let sid =
        localStorage.getItem("sessionId") ||
        p.GetVar("sessionId") ||
        (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

    localStorage.setItem("sessionId", sid);

    /* -------------------------------------------------------
       Competency + Question Data
    ------------------------------------------------------- */
    const comp = "C1";

    const sub = p.GetVar("C1_Q1_Sub") || "";
    const answer = p.GetVar("C1_Q1_Answer") || "";
    const qText = p.GetVar("C1_Q1_Text") || "";
    const success = !!p.GetVar("C1_Q1_IsCorrect");

    const qid = `${comp}${sub}-Q1`;       // ex: C1a-Q1
    const fullSub = `${comp}${sub}`;      // ex: C1a

    /* -------------------------------------------------------
       Send XAPI via helper
    ------------------------------------------------------- */
    sendXAPI(
        "http://adlnet.gov/expapi/verbs/answered",
        "answered",
        `https://acbl.wirelxdfirm.com/activities/${comp}/questions/${qid}`,
        qid,
        {
            success: success,
            response: answer,
            extensions: {
                "https://acbl.wirelxdfirm.com/extensions/competencyId": comp,
                "https://acbl.wirelxdfirm.com/extensions/subCompetency": fullSub,
                "https://acbl.wirelxdfirm.com/extensions/questionId": qid,
                "https://acbl.wirelxdfirm.com/extensions/sessionId": sid
            }
        },
        qText
    );
})();

}

window.Script6 = function()
{
  // =======================================================
//   GLOBAL xAPI Helper (loads once, safe, consistent)
// =======================================================
if (!window.__XAPI_HELPER__) {
  window.__XAPI_HELPER__ = true;

  console.log("✅ Unified xAPI helper initialized on Master Slide");

  // ---------------------------------------
  // Rehydrate Storyline variables
  // ---------------------------------------
  setTimeout(() => {
    try {
      const p = GetPlayer && GetPlayer();
      if (!p) return;

      const storedName = localStorage.getItem("learnerName");
      const storedSid  = localStorage.getItem("sessionId");

      if (storedName && !p.GetVar("learnerName")) {
        p.SetVar("learnerName", storedName);
        p.SetVar("actorName", storedName);
        p.SetVar(
          "actorMbox",
          "mailto:" + encodeURIComponent(storedName) + "@wirelxdfirm.com"
        );
      }

      if (storedSid && !p.GetVar("sessionId")) {
        p.SetVar("sessionId", storedSid);
      }

      console.log("🔁 Storyline vars synced from localStorage");
    } catch (e) {
      console.warn("⚠️ Sync from localStorage failed:", e);
    }
  }, 300);

  // ---------------------------------------
  // Global sendXAPI helper
  // ---------------------------------------
  window.sendXAPI = async function (
    verbId,
    verbDisplay,
    objectId,
    objectName,
    resultData = {}
  ) {
    try {
      const p = GetPlayer();
      if (!p) throw new Error("GetPlayer unavailable");

      const learnerName =
        p.GetVar("learnerName") ||
        localStorage.getItem("learnerName") ||
        "Anonymous";

      const sessionId =
        p.GetVar("sessionId") ||
        localStorage.getItem("sessionId") ||
        (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

      const mbox =
        "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

      const stmt = {
        actor: { name: learnerName, mbox },
        verb: { id: verbId, display: { "en-US": verbDisplay } },
        object: {
          id: objectId,
          definition: { name: { "en-US": objectName } },
          objectType: "Activity"
        },
        result: resultData,
        context: { registration: sessionId },
        timestamp: new Date().toISOString()
      };

      const endpoint =
        "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws";

      const r = await fetch(endpoint + "?mode=write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stmt),
        keepalive: true
      });

      if (r.ok)
        console.log(`✅ xAPI sent via Lambda: ${verbDisplay}`);
      else
        console.warn(`⚠️ LRS returned status ${r.status}`);
    } catch (err) {
      console.error("❌ sendXAPI failed:", err);
    }
  };
}

}

window.Script7 = function()
{
  /* Q2 Incorrect – Final Patched Version */
(function () {
    const p = GetPlayer();
    if (!p) return;

    /* -------------------------------------------------------
       Identity / Session
    ------------------------------------------------------- */
    const learner =
        p.GetVar("learnerName") ||
        localStorage.getItem("learnerName") ||
        "Anonymous";

    let sid =
        localStorage.getItem("sessionId") ||
        p.GetVar("sessionId") ||
        (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

    localStorage.setItem("sessionId", sid);

    /* -------------------------------------------------------
       Competency + Question Data
    ------------------------------------------------------- */
    const comp = "C1";

    const sub = p.GetVar("C1_Q2_Sub") || "";
    const answer = p.GetVar("C1_Q2_Answer") || "";
    const qText = p.GetVar("C1_Q2_Text") || "";
    const success = !!p.GetVar("C1_Q2_IsCorrect");  // will be false

    const qid = `${comp}${sub}-Q2`;       // ex: C1b-Q2
    const fullSub = `${comp}${sub}`;      // ex: C1b

    /* -------------------------------------------------------
       Send XAPI via helper
    ------------------------------------------------------- */
    sendXAPI(
        "http://adlnet.gov/expapi/verbs/answered",
        "answered",
        `https://acbl.wirelxdfirm.com/activities/${comp}/questions/${qid}`,
        qid,
        {
            success: success,
            response: answer,
            extensions: {
                "https://acbl.wirelxdfirm.com/extensions/competencyId": comp,
                "https://acbl.wirelxdfirm.com/extensions/subCompetency": fullSub,
                "https://acbl.wirelxdfirm.com/extensions/questionId": qid,
                "https://acbl.wirelxdfirm.com/extensions/sessionId": sid
            }
        },
        qText
    );
})();

}

window.Script8 = function()
{
  /* Q2 Correct – Final Patched Version */
(function () {
    const p = GetPlayer();
    if (!p) return;

    /* -------------------------------------------------------
       Identity / Session
    ------------------------------------------------------- */
    const learner =
        p.GetVar("learnerName") ||
        localStorage.getItem("learnerName") ||
        "Anonymous";

    let sid =
        localStorage.getItem("sessionId") ||
        p.GetVar("sessionId") ||
        (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

    localStorage.setItem("sessionId", sid);

    /* -------------------------------------------------------
       Competency + Question Data
    ------------------------------------------------------- */
    const comp = "C1";

    const sub = p.GetVar("C1_Q2_Sub") || "";
    const answer = p.GetVar("C1_Q2_Answer") || "";
    const qText = p.GetVar("C1_Q2_Text") || "";
    const success = !!p.GetVar("C1_Q2_IsCorrect");

    const qid = `${comp}${sub}-Q2`;       // ex: C1b-Q2
    const fullSub = `${comp}${sub}`;      // ex: C1b

    /* -------------------------------------------------------
       Send XAPI via helper
    ------------------------------------------------------- */
    sendXAPI(
        "http://adlnet.gov/expapi/verbs/answered",
        "answered",
        `https://acbl.wirelxdfirm.com/activities/${comp}/questions/${qid}`,
        qid,
        {
            success: success,
            response: answer,
            extensions: {
                "https://acbl.wirelxdfirm.com/extensions/competencyId": comp,
                "https://acbl.wirelxdfirm.com/extensions/subCompetency": fullSub,
                "https://acbl.wirelxdfirm.com/extensions/questionId": qid,
                "https://acbl.wirelxdfirm.com/extensions/sessionId": sid
            }
        },
        qText
    );
})();

}

window.Script9 = function()
{
  // =======================================================
//   GLOBAL xAPI Helper (loads once, safe, consistent)
// =======================================================
if (!window.__XAPI_HELPER__) {
  window.__XAPI_HELPER__ = true;

  console.log("✅ Unified xAPI helper initialized on Master Slide");

  // ---------------------------------------
  // Rehydrate Storyline variables
  // ---------------------------------------
  setTimeout(() => {
    try {
      const p = GetPlayer && GetPlayer();
      if (!p) return;

      const storedName = localStorage.getItem("learnerName");
      const storedSid  = localStorage.getItem("sessionId");

      if (storedName && !p.GetVar("learnerName")) {
        p.SetVar("learnerName", storedName);
        p.SetVar("actorName", storedName);
        p.SetVar(
          "actorMbox",
          "mailto:" + encodeURIComponent(storedName) + "@wirelxdfirm.com"
        );
      }

      if (storedSid && !p.GetVar("sessionId")) {
        p.SetVar("sessionId", storedSid);
      }

      console.log("🔁 Storyline vars synced from localStorage");
    } catch (e) {
      console.warn("⚠️ Sync from localStorage failed:", e);
    }
  }, 300);

  // ---------------------------------------
  // Global sendXAPI helper
  // ---------------------------------------
  window.sendXAPI = async function (
    verbId,
    verbDisplay,
    objectId,
    objectName,
    resultData = {}
  ) {
    try {
      const p = GetPlayer();
      if (!p) throw new Error("GetPlayer unavailable");

      const learnerName =
        p.GetVar("learnerName") ||
        localStorage.getItem("learnerName") ||
        "Anonymous";

      const sessionId =
        p.GetVar("sessionId") ||
        localStorage.getItem("sessionId") ||
        (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

      const mbox =
        "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

      const stmt = {
        actor: { name: learnerName, mbox },
        verb: { id: verbId, display: { "en-US": verbDisplay } },
        object: {
          id: objectId,
          definition: { name: { "en-US": objectName } },
          objectType: "Activity"
        },
        result: resultData,
        context: { registration: sessionId },
        timestamp: new Date().toISOString()
      };

      const endpoint =
        "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws";

      const r = await fetch(endpoint + "?mode=write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stmt),
        keepalive: true
      });

      if (r.ok)
        console.log(`✅ xAPI sent via Lambda: ${verbDisplay}`);
      else
        console.warn(`⚠️ LRS returned status ${r.status}`);
    } catch (err) {
      console.error("❌ sendXAPI failed:", err);
    }
  };
}

}

window.Script10 = function()
{
  /* Q3 Incorrect – Final Patched Version */
(function () {
    const p = GetPlayer();
    if (!p) return;

    /* -------------------------------------------------------
       Identity / Session
    ------------------------------------------------------- */
    const learner =
        p.GetVar("learnerName") ||
        localStorage.getItem("learnerName") ||
        "Anonymous";

    let sid =
        localStorage.getItem("sessionId") ||
        p.GetVar("sessionId") ||
        (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

    localStorage.setItem("sessionId", sid);

    /* -------------------------------------------------------
       Competency + Question Data
    ------------------------------------------------------- */
    const comp = "C1";

    const sub = p.GetVar("C1_Q3_Sub") || "";
    const answer = p.GetVar("C1_Q3_Answer") || "";
    const qText = p.GetVar("C1_Q3_Text") || "";

    // SAFEST way (Storyline sometimes returns "False" as a string)
    const success = p.GetVar("C1_Q3_IsCorrect") === true;

    const qid = `${comp}${sub}-Q3`;   // ex: C1c-Q3
    const fullSub = `${comp}${sub}`;  // ex: C1c

    /* -------------------------------------------------------
       Send XAPI
    ------------------------------------------------------- */
    sendXAPI(
        "http://adlnet.gov/expapi/verbs/answered",
        "answered",
        `https://acbl.wirelxdfirm.com/activities/${comp}/questions/${qid}`,
        qid,
        {
            success,
            response: answer,
            extensions: {
                "https://acbl.wirelxdfirm.com/extensions/competencyId": comp,
                "https://acbl.wirelxdfirm.com/extensions/subCompetency": fullSub,
                "https://acbl.wirelxdfirm.com/extensions/questionId": qid,
                "https://acbl.wirelxdfirm.com/extensions/sessionId": sid
            }
        },
        qText
    );
})();

}

window.Script11 = function()
{
  /* Q3 Correct – Final Patched Version */
(function () {
    const p = GetPlayer();
    if (!p) return;

    /* -------------------------------------------------------
       Identity / Session
    ------------------------------------------------------- */
    const learner =
        p.GetVar("learnerName") ||
        localStorage.getItem("learnerName") ||
        "Anonymous";

    let sid =
        localStorage.getItem("sessionId") ||
        p.GetVar("sessionId") ||
        (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

    localStorage.setItem("sessionId", sid);

    /* -------------------------------------------------------
       Competency + Question Data
    ------------------------------------------------------- */
    const comp = "C1";

    const sub = p.GetVar("C1_Q3_Sub") || "";
    const answer = p.GetVar("C1_Q3_Answer") || "";
    const qText = p.GetVar("C1_Q3_Text") || "";
    const success = !!p.GetVar("C1_Q3_IsCorrect");

    const qid = `${comp}${sub}-Q3`;       // ex: C1c-Q3
    const fullSub = `${comp}${sub}`;      // ex: C1c

    /* -------------------------------------------------------
       Send XAPI via helper
    ------------------------------------------------------- */
    sendXAPI(
        "http://adlnet.gov/expapi/verbs/answered",
        "answered",
        `https://acbl.wirelxdfirm.com/activities/${comp}/questions/${qid}`,
        qid,
        {
            success: success,
            response: answer,
            extensions: {
                "https://acbl.wirelxdfirm.com/extensions/competencyId": comp,
                "https://acbl.wirelxdfirm.com/extensions/subCompetency": fullSub,
                "https://acbl.wirelxdfirm.com/extensions/questionId": qid,
                "https://acbl.wirelxdfirm.com/extensions/sessionId": sid
            }
        },
        qText
    );
})();

}

window.Script12 = function()
{
  // =======================================================
//   GLOBAL xAPI Helper (loads once, safe, consistent)
// =======================================================
if (!window.__XAPI_HELPER__) {
  window.__XAPI_HELPER__ = true;

  console.log("✅ Unified xAPI helper initialized on Master Slide");

  // ---------------------------------------
  // Rehydrate Storyline variables
  // ---------------------------------------
  setTimeout(() => {
    try {
      const p = GetPlayer && GetPlayer();
      if (!p) return;

      const storedName = localStorage.getItem("learnerName");
      const storedSid  = localStorage.getItem("sessionId");

      if (storedName && !p.GetVar("learnerName")) {
        p.SetVar("learnerName", storedName);
        p.SetVar("actorName", storedName);
        p.SetVar(
          "actorMbox",
          "mailto:" + encodeURIComponent(storedName) + "@wirelxdfirm.com"
        );
      }

      if (storedSid && !p.GetVar("sessionId")) {
        p.SetVar("sessionId", storedSid);
      }

      console.log("🔁 Storyline vars synced from localStorage");
    } catch (e) {
      console.warn("⚠️ Sync from localStorage failed:", e);
    }
  }, 300);

  // ---------------------------------------
  // Global sendXAPI helper
  // ---------------------------------------
  window.sendXAPI = async function (
    verbId,
    verbDisplay,
    objectId,
    objectName,
    resultData = {}
  ) {
    try {
      const p = GetPlayer();
      if (!p) throw new Error("GetPlayer unavailable");

      const learnerName =
        p.GetVar("learnerName") ||
        localStorage.getItem("learnerName") ||
        "Anonymous";

      const sessionId =
        p.GetVar("sessionId") ||
        localStorage.getItem("sessionId") ||
        (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

      const mbox =
        "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

      const stmt = {
        actor: { name: learnerName, mbox },
        verb: { id: verbId, display: { "en-US": verbDisplay } },
        object: {
          id: objectId,
          definition: { name: { "en-US": objectName } },
          objectType: "Activity"
        },
        result: resultData,
        context: { registration: sessionId },
        timestamp: new Date().toISOString()
      };

      const endpoint =
        "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws";

      const r = await fetch(endpoint + "?mode=write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stmt),
        keepalive: true
      });

      if (r.ok)
        console.log(`✅ xAPI sent via Lambda: ${verbDisplay}`);
      else
        console.warn(`⚠️ LRS returned status ${r.status}`);
    } catch (err) {
      console.error("❌ sendXAPI failed:", err);
    }
  };
}

}

window.Script13 = function()
{
  /* ============================================================
   Results slide – clean xAPI + accurate missed[] detection
   BULLETPROOF PATCHED VERSION
============================================================ */
(function () {
  function run() {
    try {
      const p = (window.GetPlayer && window.GetPlayer());
      if (!p) {
        // Try again shortly if Storyline player is not ready yet
        setTimeout(run, 200);
        return;
      }

      /* ---------------------------------------------------------
         1) Detect competency
      --------------------------------------------------------- */
      const url = window.location.href.toUpperCase();
      const compMatch = url.match(/C[123]/);
      const compId = compMatch ? compMatch[0] : "C1";

      /* ---------------------------------------------------------
         2) Sub-competency scoring (Ca / Cb / Cc)
      --------------------------------------------------------- */
      const sA = Number(p.GetVar(compId + "a_score") || 0);
      const sB = Number(p.GetVar(compId + "b_score") || 0);
      const sC = Number(p.GetVar(compId + "c_score") || 0);

      const correct = sA + sB + sC;

      const missed = [];
      if (sA !== 1) missed.push(compId + "a");
      if (sB !== 1) missed.push(compId + "b");
      if (sC !== 1) missed.push(compId + "c");

      /* ---------------------------------------------------------
         3) Mastery calculation
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
      const name =
        localStorage.getItem("learnerName") ||
        p.GetVar("actorName") ||
        "Anonymous";

      let sid =
        localStorage.getItem("sessionId") ||
        p.GetVar("sessionId") ||
        ((window.crypto && window.crypto.randomUUID)
          ? window.crypto.randomUUID()
          : String(Date.now()));

      // Keep sessionId in localStorage for next.html + Lambda summary
      localStorage.setItem("sessionId", sid);

      const mbox = "mailto:" + encodeURIComponent(name) + "@wirelxdfirm.com";

      /* ---------------------------------------------------------
         5) Build xAPI summary statement
      --------------------------------------------------------- */
      const passed = correct >= 2;

      const summaryStmt = {
        actor: { name, mbox },
        verb: {
          id: passed
            ? "http://adlnet.gov/expapi/verbs/passed"
            : "http://adlnet.gov/expapi/verbs/failed",
          display: { "en-US": passed ? "passed" : "failed" }
        },
        object: {
          id: `https://acbl.wirelxdfirm.com/activities/${compId}/test`,
          objectType: "Activity"
        },
        result: {
          score: { raw: correct, min: 0, max: 3 },
          success: passed,
          completion: true,
          extensions: {
            "https://acbl.wirelxdfirm.com/extensions/learnerName": name,
            "https://acbl.wirelxdfirm.com/extensions/sessionId": sid,
            "https://acbl.wirelxdfirm.com/extensions/competencyId": compId,
            "https://acbl.wirelxdfirm.com/extensions/masteryLevel": mastery,
            "https://acbl.wirelxdfirm.com/extensions/missed": missed,
            "https://acbl.wirelxdfirm.com/extensions/testedOut": testedOut,
            "https://acbl.wirelxdfirm.com/extensions/finalized": finalized
          }
        },
        context: { registration: sid },
        timestamp: new Date().toISOString()
      };

      /* ---------------------------------------------------------
         6) Send xAPI via Lambda
      --------------------------------------------------------- */
      const endpoint =
        "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws";

      // Prefer the global helper if present, fall back to direct fetch
      if (window.sendXAPI) {
        window.sendXAPI(
          summaryStmt.verb.id,
          summaryStmt.verb.display["en-US"],
          summaryStmt.object.id,
          `${compId} Test`,
          summaryStmt.result
        );
        console.log("✅ Summary routed through sendXAPI helper");
      } else {
        fetch(endpoint + "?mode=write", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(summaryStmt),
          keepalive: true
        })
          .then(r => console.log("✅ Summary sent direct:", r.status))
          .catch(e => console.warn("❌ Summary send failed:", e));
      }

      /* ---------------------------------------------------------
         7) Adaptive storage (for next.html)
      --------------------------------------------------------- */
      localStorage.setItem(`${compId}.score`, correct);
      localStorage.setItem(`${compId}.missed`, JSON.stringify(missed));
      localStorage.setItem(`${compId}.mastery`, mastery);
      localStorage.setItem(`${compId}.testedOut`, testedOut);
      localStorage.setItem(`${compId}.finalized`, finalized);
      localStorage.setItem("currentCompetency", compId);
      localStorage.setItem("currentMasteryLevel", mastery);

      console.log("✅ Results script completed for", compId, {
        correct,
        mastery,
        missed
      });
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
