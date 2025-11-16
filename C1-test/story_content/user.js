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
  // Load once (Master fires on every slide)
if (!window.__XAPI_HELPER_LOADED__) {
  window.__XAPI_HELPER_LOADED__ = true;

  // --- Rehydrate Storyline variables from localStorage if missing ---
  setTimeout(() => {
    try {
      const p = GetPlayer && GetPlayer();
      if (!p) return;
      const storedName = localStorage.getItem("learnerName");
      const storedSid  = localStorage.getItem("sessionId");

      if (storedName && !p.GetVar("learnerName")) {
        p.SetVar("learnerName", storedName);
        p.SetVar("actorName", storedName);
        p.SetVar("actorMbox", "mailto:" + encodeURIComponent(storedName) + "@wirelxdfirm.com");
      }
      if (storedSid && !p.GetVar("sessionId")) {
        p.SetVar("sessionId", storedSid);
      }
      console.log("✅ Storyline variables synced from localStorage");
    } catch (e) {
      console.warn("Sync from localStorage failed:", e);
    }
  }, 300);

  // --- xAPI helper function ---
  window.sendXAPI = async function (verbId, verbDisplay, objectId, objectName, resultData = {}) {
    try {
      const p = GetPlayer();
      if (!p) return;

      const learnerName = p.GetVar("learnerName") || localStorage.getItem("learnerName") || "Anonymous";
      const sessionId   = p.GetVar("sessionId")   || localStorage.getItem("sessionId") || String(Date.now());
      const mbox        = "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

      const statement = {
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

      // ✅ Send through Lambda proxy (which writes to SCORM Cloud)
      const endpoint = "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws";
      const r = await fetch(endpoint + "?mode=write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(statement),
        keepalive: true
      });

      console.log(r.ok ? `✅ xAPI sent via Lambda: ${verbDisplay}` : `⚠️ xAPI failed: ${r.status}`);
    } catch (e) {
      console.error("❌ sendXAPI error:", e);
    }
  };
}

}

window.Script2 = function()
{
  // --- Global xAPI Helper (runs once across all slides) ---
if (!window.__XAPI_HELPER_LOADED__) {
  window.__XAPI_HELPER_LOADED__ = true;

  console.log("✅ xAPI helper initialized on Slide Master");

  // --- Sync Storyline variables from localStorage ---
  setTimeout(() => {
    try {
      const p = GetPlayer && GetPlayer();
      if (!p) return;
      const storedName = localStorage.getItem("learnerName");
      const storedSid  = localStorage.getItem("sessionId");

      if (storedName && !p.GetVar("learnerName")) {
        p.SetVar("learnerName", storedName);
        p.SetVar("actorName", storedName);
        p.SetVar("actorMbox", "mailto:" + encodeURIComponent(storedName) + "@wirelxdfirm.com");
      }
      if (storedSid && !p.GetVar("sessionId")) {
        p.SetVar("sessionId", storedSid);
      }
      console.log("🔁 Storyline variables synced from localStorage");
    } catch (err) {
      console.warn("⚠️ Variable sync failed:", err);
    }
  }, 300);

  // --- Global sendXAPI() helper ---
  window.sendXAPI = async function (verbId, verbDisplay, objectId, objectName, resultData = {}) {
    try {
      const p = GetPlayer();
      if (!p) throw new Error("GetPlayer() not available");

      const learnerName = p.GetVar("learnerName") || localStorage.getItem("learnerName") || "Anonymous";
      const sessionId   = p.GetVar("sessionId")   || localStorage.getItem("sessionId") || crypto.randomUUID();
      const mbox        = "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

      const statement = {
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

      const endpoint = "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws";
      const response = await fetch(endpoint + "?mode=write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(statement),
        keepalive: true
      });

      if (response.ok) console.log(`✅ xAPI sent via Lambda: ${verbDisplay}`);
      else console.warn(`⚠️ LRS returned status ${response.status}`);
    } catch (err) {
      console.error("❌ sendXAPI() failed:", err);
    }
  };
}

}

window.Script3 = function()
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

window.Script4 = function()
{
  // Load once (Master fires on every slide)
if (!window.__XAPI_HELPER_LOADED__) {
  window.__XAPI_HELPER_LOADED__ = true;

  // --- Rehydrate Storyline variables from localStorage if missing ---
  setTimeout(() => {
    try {
      const p = GetPlayer && GetPlayer();
      if (!p) return;
      const storedName = localStorage.getItem("learnerName");
      const storedSid  = localStorage.getItem("sessionId");

      if (storedName && !p.GetVar("learnerName")) {
        p.SetVar("learnerName", storedName);
        p.SetVar("actorName", storedName);
        p.SetVar("actorMbox", "mailto:" + encodeURIComponent(storedName) + "@wirelxdfirm.com");
      }
      if (storedSid && !p.GetVar("sessionId")) {
        p.SetVar("sessionId", storedSid);
      }
      console.log("✅ Storyline variables synced from localStorage");
    } catch (e) {
      console.warn("Sync from localStorage failed:", e);
    }
  }, 300);

  // --- xAPI helper function ---
  window.sendXAPI = async function (verbId, verbDisplay, objectId, objectName, resultData = {}) {
    try {
      const p = GetPlayer();
      if (!p) return;

      const learnerName = p.GetVar("learnerName") || localStorage.getItem("learnerName") || "Anonymous";
      const sessionId   = p.GetVar("sessionId")   || localStorage.getItem("sessionId") || String(Date.now());
      const mbox        = "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

      const statement = {
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

      // ✅ Send through Lambda proxy (which writes to SCORM Cloud)
      const endpoint = "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws";
      const r = await fetch(endpoint + "?mode=write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(statement),
        keepalive: true
      });

      console.log(r.ok ? `✅ xAPI sent via Lambda: ${verbDisplay}` : `⚠️ xAPI failed: ${r.status}`);
    } catch (e) {
      console.error("❌ sendXAPI error:", e);
    }
  };
}

}

window.Script5 = function()
{
  // --- Global xAPI Helper (runs once across all slides) ---
if (!window.__XAPI_HELPER_LOADED__) {
  window.__XAPI_HELPER_LOADED__ = true;

  console.log("✅ xAPI helper initialized on Slide Master");

  // --- Sync Storyline variables from localStorage ---
  setTimeout(() => {
    try {
      const p = GetPlayer && GetPlayer();
      if (!p) return;
      const storedName = localStorage.getItem("learnerName");
      const storedSid  = localStorage.getItem("sessionId");

      if (storedName && !p.GetVar("learnerName")) {
        p.SetVar("learnerName", storedName);
        p.SetVar("actorName", storedName);
        p.SetVar("actorMbox", "mailto:" + encodeURIComponent(storedName) + "@wirelxdfirm.com");
      }
      if (storedSid && !p.GetVar("sessionId")) {
        p.SetVar("sessionId", storedSid);
      }
      console.log("🔁 Storyline variables synced from localStorage");
    } catch (err) {
      console.warn("⚠️ Variable sync failed:", err);
    }
  }, 300);

  // --- Global sendXAPI() helper ---
  window.sendXAPI = async function (verbId, verbDisplay, objectId, objectName, resultData = {}) {
    try {
      const p = GetPlayer();
      if (!p) throw new Error("GetPlayer() not available");

      const learnerName = p.GetVar("learnerName") || localStorage.getItem("learnerName") || "Anonymous";
      const sessionId   = p.GetVar("sessionId")   || localStorage.getItem("sessionId") || crypto.randomUUID();
      const mbox        = "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

      const statement = {
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

      const endpoint = "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws";
      const response = await fetch(endpoint + "?mode=write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(statement),
        keepalive: true
      });

      if (response.ok) console.log(`✅ xAPI sent via Lambda: ${verbDisplay}`);
      else console.warn(`⚠️ LRS returned status ${response.status}`);
    } catch (err) {
      console.error("❌ sendXAPI() failed:", err);
    }
  };
}

}

window.Script6 = function()
{
  /* Question-level xAPI (Incorrect) */
(function() {
  const p = GetPlayer();
  const learner = p.GetVar("learnerName");
  const sid = p.GetVar("sessionId");
  const comp = p.GetVar("currentComp");
  const sub = p.GetVar("C1_SubCompetency");
  const qid = sub + "-1";
  const answer = p.GetVar("C1_Q1_Answer") || "";

  sendXAPI(
    "http://adlnet.gov/expapi/verbs/answered",
    "answered",
    `https://acbl.wirelxdfirm.com/activities/${comp}/questions/${qid}`,
    `${qid}`,
    {
      success: false,
      response: answer,
      extensions: {
        "https://acbl.wirelxdfirm.com/extensions/competencyId": comp,
        "https://acbl.wirelxdfirm.com/extensions/questionId": qid,
        "https://acbl.wirelxdfirm.com/extensions/subCompetency": sub,
        "https://acbl.wirelxdfirm.com/extensions/sessionId": sid
      }
    }
  );
})();

}

window.Script7 = function()
{
  /* Question-level xAPI (Correct) */
(function() {
  const p = GetPlayer();
  const learner = p.GetVar("learnerName");
  const sid = p.GetVar("sessionId");
  const comp = p.GetVar("currentComp");
  const sub = p.GetVar("C1_SubCompetency");
  const qid = sub + "-1";
  const answer = p.GetVar("C1_Q1_Answer") || "";

  sendXAPI(
    "http://adlnet.gov/expapi/verbs/answered",
    "answered",
    `https://acbl.wirelxdfirm.com/activities/${comp}/questions/${qid}`,
    `${qid}`,
    {
      success: true,
      response: answer,
      extensions: {
        "https://acbl.wirelxdfirm.com/extensions/competencyId": comp,
        "https://acbl.wirelxdfirm.com/extensions/questionId": qid,
        "https://acbl.wirelxdfirm.com/extensions/subCompetency": sub,
        "https://acbl.wirelxdfirm.com/extensions/sessionId": sid
      }
    }
  );
})();

}

window.Script8 = function()
{
  // Load once (Master fires on every slide)
if (!window.__XAPI_HELPER_LOADED__) {
  window.__XAPI_HELPER_LOADED__ = true;

  // --- Rehydrate Storyline variables from localStorage if missing ---
  setTimeout(() => {
    try {
      const p = GetPlayer && GetPlayer();
      if (!p) return;
      const storedName = localStorage.getItem("learnerName");
      const storedSid  = localStorage.getItem("sessionId");

      if (storedName && !p.GetVar("learnerName")) {
        p.SetVar("learnerName", storedName);
        p.SetVar("actorName", storedName);
        p.SetVar("actorMbox", "mailto:" + encodeURIComponent(storedName) + "@wirelxdfirm.com");
      }
      if (storedSid && !p.GetVar("sessionId")) {
        p.SetVar("sessionId", storedSid);
      }
      console.log("✅ Storyline variables synced from localStorage");
    } catch (e) {
      console.warn("Sync from localStorage failed:", e);
    }
  }, 300);

  // --- xAPI helper function ---
  window.sendXAPI = async function (verbId, verbDisplay, objectId, objectName, resultData = {}) {
    try {
      const p = GetPlayer();
      if (!p) return;

      const learnerName = p.GetVar("learnerName") || localStorage.getItem("learnerName") || "Anonymous";
      const sessionId   = p.GetVar("sessionId")   || localStorage.getItem("sessionId") || String(Date.now());
      const mbox        = "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

      const statement = {
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

      // ✅ Send through Lambda proxy (which writes to SCORM Cloud)
      const endpoint = "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws";
      const r = await fetch(endpoint + "?mode=write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(statement),
        keepalive: true
      });

      console.log(r.ok ? `✅ xAPI sent via Lambda: ${verbDisplay}` : `⚠️ xAPI failed: ${r.status}`);
    } catch (e) {
      console.error("❌ sendXAPI error:", e);
    }
  };
}

}

window.Script9 = function()
{
  // --- Global xAPI Helper (runs once across all slides) ---
if (!window.__XAPI_HELPER_LOADED__) {
  window.__XAPI_HELPER_LOADED__ = true;

  console.log("✅ xAPI helper initialized on Slide Master");

  // --- Sync Storyline variables from localStorage ---
  setTimeout(() => {
    try {
      const p = GetPlayer && GetPlayer();
      if (!p) return;
      const storedName = localStorage.getItem("learnerName");
      const storedSid  = localStorage.getItem("sessionId");

      if (storedName && !p.GetVar("learnerName")) {
        p.SetVar("learnerName", storedName);
        p.SetVar("actorName", storedName);
        p.SetVar("actorMbox", "mailto:" + encodeURIComponent(storedName) + "@wirelxdfirm.com");
      }
      if (storedSid && !p.GetVar("sessionId")) {
        p.SetVar("sessionId", storedSid);
      }
      console.log("🔁 Storyline variables synced from localStorage");
    } catch (err) {
      console.warn("⚠️ Variable sync failed:", err);
    }
  }, 300);

  // --- Global sendXAPI() helper ---
  window.sendXAPI = async function (verbId, verbDisplay, objectId, objectName, resultData = {}) {
    try {
      const p = GetPlayer();
      if (!p) throw new Error("GetPlayer() not available");

      const learnerName = p.GetVar("learnerName") || localStorage.getItem("learnerName") || "Anonymous";
      const sessionId   = p.GetVar("sessionId")   || localStorage.getItem("sessionId") || crypto.randomUUID();
      const mbox        = "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

      const statement = {
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

      const endpoint = "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws";
      const response = await fetch(endpoint + "?mode=write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(statement),
        keepalive: true
      });

      if (response.ok) console.log(`✅ xAPI sent via Lambda: ${verbDisplay}`);
      else console.warn(`⚠️ LRS returned status ${response.status}`);
    } catch (err) {
      console.error("❌ sendXAPI() failed:", err);
    }
  };
}

}

window.Script10 = function()
{
  /* Question-level xAPI (Incorrect – Q2) */
(function() {
  const p = GetPlayer();
  const learner = p.GetVar("learnerName");
  const sid = p.GetVar("sessionId");
  const comp = p.GetVar("currentComp");
  const sub = p.GetVar("C1_SubCompetency");
  const qid = sub + "-2";                     // Q2 → "-2"
  const answer = p.GetVar("C1_Q2_Answer") || "";  // Q2 answer var

  sendXAPI(
    "http://adlnet.gov/expapi/verbs/answered",
    "answered",
    `https://acbl.wirelxdfirm.com/activities/${comp}/questions/${qid}`,
    `${qid}`,
    {
      success: false,
      response: answer,
      extensions: {
        "https://acbl.wirelxdfirm.com/extensions/competencyId": comp,
        "https://acbl.wirelxdfirm.com/extensions/questionId": qid,
        "https://acbl.wirelxdfirm.com/extensions/subCompetency": sub,
        "https://acbl.wirelxdfirm.com/extensions/sessionId": sid
      }
    }
  );
})();

}

window.Script11 = function()
{
  /* Question-level xAPI (Correct) */
(function() {
  const p = GetPlayer();
  const learner = p.GetVar("learnerName");
  const sid = p.GetVar("sessionId");
  const comp = p.GetVar("currentComp");
  const sub = p.GetVar("C1_SubCompetency");
  const qid = sub + "-2";

  const answer = p.GetVar("C1_Q2_Answer") || "";

  sendXAPI(
    "http://adlnet.gov/expapi/verbs/answered",
    "answered",
    `https://acbl.wirelxdfirm.com/activities/${comp}/questions/${qid}`,
    `${qid}`,
    {
      success: true,
      response: answer,
      extensions: {
        "https://acbl.wirelxdfirm.com/extensions/competencyId": comp,
        "https://acbl.wirelxdfirm.com/extensions/questionId": qid,
        "https://acbl.wirelxdfirm.com/extensions/subCompetency": sub,
        "https://acbl.wirelxdfirm.com/extensions/sessionId": sid
      }
    }
  );
})();

}

window.Script12 = function()
{
  // Load once (Master fires on every slide)
if (!window.__XAPI_HELPER_LOADED__) {
  window.__XAPI_HELPER_LOADED__ = true;

  // --- Rehydrate Storyline variables from localStorage if missing ---
  setTimeout(() => {
    try {
      const p = GetPlayer && GetPlayer();
      if (!p) return;
      const storedName = localStorage.getItem("learnerName");
      const storedSid  = localStorage.getItem("sessionId");

      if (storedName && !p.GetVar("learnerName")) {
        p.SetVar("learnerName", storedName);
        p.SetVar("actorName", storedName);
        p.SetVar("actorMbox", "mailto:" + encodeURIComponent(storedName) + "@wirelxdfirm.com");
      }
      if (storedSid && !p.GetVar("sessionId")) {
        p.SetVar("sessionId", storedSid);
      }
      console.log("✅ Storyline variables synced from localStorage");
    } catch (e) {
      console.warn("Sync from localStorage failed:", e);
    }
  }, 300);

  // --- xAPI helper function ---
  window.sendXAPI = async function (verbId, verbDisplay, objectId, objectName, resultData = {}) {
    try {
      const p = GetPlayer();
      if (!p) return;

      const learnerName = p.GetVar("learnerName") || localStorage.getItem("learnerName") || "Anonymous";
      const sessionId   = p.GetVar("sessionId")   || localStorage.getItem("sessionId") || String(Date.now());
      const mbox        = "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

      const statement = {
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

      // ✅ Send through Lambda proxy (which writes to SCORM Cloud)
      const endpoint = "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws";
      const r = await fetch(endpoint + "?mode=write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(statement),
        keepalive: true
      });

      console.log(r.ok ? `✅ xAPI sent via Lambda: ${verbDisplay}` : `⚠️ xAPI failed: ${r.status}`);
    } catch (e) {
      console.error("❌ sendXAPI error:", e);
    }
  };
}

}

window.Script13 = function()
{
  // --- Global xAPI Helper (runs once across all slides) ---
if (!window.__XAPI_HELPER_LOADED__) {
  window.__XAPI_HELPER_LOADED__ = true;

  console.log("✅ xAPI helper initialized on Slide Master");

  // --- Sync Storyline variables from localStorage ---
  setTimeout(() => {
    try {
      const p = GetPlayer && GetPlayer();
      if (!p) return;
      const storedName = localStorage.getItem("learnerName");
      const storedSid  = localStorage.getItem("sessionId");

      if (storedName && !p.GetVar("learnerName")) {
        p.SetVar("learnerName", storedName);
        p.SetVar("actorName", storedName);
        p.SetVar("actorMbox", "mailto:" + encodeURIComponent(storedName) + "@wirelxdfirm.com");
      }
      if (storedSid && !p.GetVar("sessionId")) {
        p.SetVar("sessionId", storedSid);
      }
      console.log("🔁 Storyline variables synced from localStorage");
    } catch (err) {
      console.warn("⚠️ Variable sync failed:", err);
    }
  }, 300);

  // --- Global sendXAPI() helper ---
  window.sendXAPI = async function (verbId, verbDisplay, objectId, objectName, resultData = {}) {
    try {
      const p = GetPlayer();
      if (!p) throw new Error("GetPlayer() not available");

      const learnerName = p.GetVar("learnerName") || localStorage.getItem("learnerName") || "Anonymous";
      const sessionId   = p.GetVar("sessionId")   || localStorage.getItem("sessionId") || crypto.randomUUID();
      const mbox        = "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

      const statement = {
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

      const endpoint = "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws";
      const response = await fetch(endpoint + "?mode=write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(statement),
        keepalive: true
      });

      if (response.ok) console.log(`✅ xAPI sent via Lambda: ${verbDisplay}`);
      else console.warn(`⚠️ LRS returned status ${response.status}`);
    } catch (err) {
      console.error("❌ sendXAPI() failed:", err);
    }
  };
}

}

window.Script14 = function()
{
  /* Question-level xAPI (Incorrect – Q3) */
(function() {
  const p = GetPlayer();
  const learner = p.GetVar("learnerName");
  const sid = p.GetVar("sessionId");
  const comp = p.GetVar("currentComp");
  const sub = p.GetVar("C1_SubCompetency");
  const qid = sub + "-3";                     // Q3 → "-3"
  const answer = p.GetVar("C1_Q3_Answer") || "";  // Q3 answer var

  sendXAPI(
    "http://adlnet.gov/expapi/verbs/answered",
    "answered",
    `https://acbl.wirelxdfirm.com/activities/${comp}/questions/${qid}`,
    `${qid}`,
    {
      success: false,
      response: answer,
      extensions: {
        "https://acbl.wirelxdfirm.com/extensions/competencyId": comp,
        "https://acbl.wirelxdfirm.com/extensions/questionId": qid,
        "https://acbl.wirelxdfirm.com/extensions/subCompetency": sub,
        "https://acbl.wirelxdfirm.com/extensions/sessionId": sid
      }
    }
  );
})();

}

window.Script15 = function()
{
  /* Question-level xAPI (Correct) */
(function() {
  const p = GetPlayer();
  const learner = p.GetVar("learnerName");
  const sid = p.GetVar("sessionId");
  const comp = p.GetVar("currentComp");
  const sub = p.GetVar("C1_SubCompetency");
  const qid = sub + "-2";

  const answer = p.GetVar("C1_Q2_Answer") || "";

  sendXAPI(
    "http://adlnet.gov/expapi/verbs/answered",
    "answered",
    `https://acbl.wirelxdfirm.com/activities/${comp}/questions/${qid}`,
    `${qid}`,
    {
      success: true,
      response: answer,
      extensions: {
        "https://acbl.wirelxdfirm.com/extensions/competencyId": comp,
        "https://acbl.wirelxdfirm.com/extensions/questionId": qid,
        "https://acbl.wirelxdfirm.com/extensions/subCompetency": sub,
        "https://acbl.wirelxdfirm.com/extensions/sessionId": sid
      }
    }
  );
})();

}

window.Script16 = function()
{
  // Load once (Master fires on every slide)
if (!window.__XAPI_HELPER_LOADED__) {
  window.__XAPI_HELPER_LOADED__ = true;

  // --- Rehydrate Storyline variables from localStorage if missing ---
  setTimeout(() => {
    try {
      const p = GetPlayer && GetPlayer();
      if (!p) return;
      const storedName = localStorage.getItem("learnerName");
      const storedSid  = localStorage.getItem("sessionId");

      if (storedName && !p.GetVar("learnerName")) {
        p.SetVar("learnerName", storedName);
        p.SetVar("actorName", storedName);
        p.SetVar("actorMbox", "mailto:" + encodeURIComponent(storedName) + "@wirelxdfirm.com");
      }
      if (storedSid && !p.GetVar("sessionId")) {
        p.SetVar("sessionId", storedSid);
      }
      console.log("✅ Storyline variables synced from localStorage");
    } catch (e) {
      console.warn("Sync from localStorage failed:", e);
    }
  }, 300);

  // --- xAPI helper function ---
  window.sendXAPI = async function (verbId, verbDisplay, objectId, objectName, resultData = {}) {
    try {
      const p = GetPlayer();
      if (!p) return;

      const learnerName = p.GetVar("learnerName") || localStorage.getItem("learnerName") || "Anonymous";
      const sessionId   = p.GetVar("sessionId")   || localStorage.getItem("sessionId") || String(Date.now());
      const mbox        = "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

      const statement = {
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

      // ✅ Send through Lambda proxy (which writes to SCORM Cloud)
      const endpoint = "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws";
      const r = await fetch(endpoint + "?mode=write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(statement),
        keepalive: true
      });

      console.log(r.ok ? `✅ xAPI sent via Lambda: ${verbDisplay}` : `⚠️ xAPI failed: ${r.status}`);
    } catch (e) {
      console.error("❌ sendXAPI error:", e);
    }
  };
}

}

window.Script17 = function()
{
  // --- Global xAPI Helper (runs once across all slides) ---
if (!window.__XAPI_HELPER_LOADED__) {
  window.__XAPI_HELPER_LOADED__ = true;

  console.log("✅ xAPI helper initialized on Slide Master");

  // --- Sync Storyline variables from localStorage ---
  setTimeout(() => {
    try {
      const p = GetPlayer && GetPlayer();
      if (!p) return;
      const storedName = localStorage.getItem("learnerName");
      const storedSid  = localStorage.getItem("sessionId");

      if (storedName && !p.GetVar("learnerName")) {
        p.SetVar("learnerName", storedName);
        p.SetVar("actorName", storedName);
        p.SetVar("actorMbox", "mailto:" + encodeURIComponent(storedName) + "@wirelxdfirm.com");
      }
      if (storedSid && !p.GetVar("sessionId")) {
        p.SetVar("sessionId", storedSid);
      }
      console.log("🔁 Storyline variables synced from localStorage");
    } catch (err) {
      console.warn("⚠️ Variable sync failed:", err);
    }
  }, 300);

  // --- Global sendXAPI() helper ---
  window.sendXAPI = async function (verbId, verbDisplay, objectId, objectName, resultData = {}) {
    try {
      const p = GetPlayer();
      if (!p) throw new Error("GetPlayer() not available");

      const learnerName = p.GetVar("learnerName") || localStorage.getItem("learnerName") || "Anonymous";
      const sessionId   = p.GetVar("sessionId")   || localStorage.getItem("sessionId") || crypto.randomUUID();
      const mbox        = "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

      const statement = {
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

      const endpoint = "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws";
      const response = await fetch(endpoint + "?mode=write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(statement),
        keepalive: true
      });

      if (response.ok) console.log(`✅ xAPI sent via Lambda: ${verbDisplay}`);
      else console.warn(`⚠️ LRS returned status ${response.status}`);
    } catch (err) {
      console.error("❌ sendXAPI() failed:", err);
    }
  };
}

}

window.Script18 = function()
{
  /* Results slide – summary xAPI + adaptive storage ONLY */
(function () {
  try {
    const p = GetPlayer();
    if (!p) return;

    /* 1) Detect competency (C1, C2, C3) */
    const url = window.location.href.toUpperCase();
    const compMatch = url.match(/C[123]/);
    const compId = compMatch ? compMatch[0] : "C1";

    /* 2) Get scoring from question layers */
    const correct = Number(p.GetVar(compId + "_Correct") || 0);

    const missedSubs = (p.GetVar(compId + "_missedSubs") || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    /* 3) Determine mastery */
    let mastery = "Failing";
    if (correct === 3) mastery = "Mastery";
    else if (correct === 2) mastery = "Proficient";
    else if (correct === 1) mastery = "Emerging";

    const testedOut = correct === 3;
    const finalized = false;

    p.SetVar("currentComp", compId);
    p.SetVar("currentMasteryLevel", mastery);

    /* 4) Identity + session */
    const name =
      localStorage.getItem("learnerName") ||
      p.GetVar("actorName") ||
      "Anonymous";

    const sid =
      localStorage.getItem("sessionId") ||
      p.GetVar("sessionId") ||
      (Date.now().toString());

    const mbox = "mailto:" + encodeURIComponent(name) + "@wirelxdfirm.com";

    const endpoint =
      "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws";

    /* 5) SEND SUMMARY ONLY (no question loop!) */
    const passed = correct >= 2;
    const verbId = passed
      ? "http://adlnet.gov/expapi/verbs/passed"
      : "http://adlnet.gov/expapi/verbs/failed";

    const verbDisplay = passed ? "passed" : "failed";

    const summaryStmt = {
      actor: { name: name, mbox: mbox },
      verb: { id: verbId, display: { "en-US": verbDisplay } },
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
          "https://acbl.wirelxdfirm.com/extensions/missed": missedSubs,
          "https://acbl.wirelxdfirm.com/extensions/testedOut": testedOut,
          "https://acbl.wirelxdfirm.com/extensions/finalized": finalized
        }
      },
      context: { registration: sid },
      timestamp: new Date().toISOString()
    };

    fetch(endpoint + "?mode=write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(summaryStmt),
      keepalive: true
    })
      .then(r => console.log(`✅ Summary sent:`, r.status))
      .catch(e => console.warn("❌ Summary send failed:", e));

    /* 6) Adaptive storage */
    localStorage.setItem(`${compId}.score`, correct);
    localStorage.setItem(`${compId}.missed`, JSON.stringify(missedSubs));
    localStorage.setItem(`${compId}.mastery`, mastery);
    localStorage.setItem(`${compId}.testedOut`, testedOut);
    localStorage.setItem(`${compId}.finalized`, finalized);
    localStorage.setItem(`${compId}.completed`, "true");
    localStorage.setItem("currentCompetency", compId);
    localStorage.setItem("currentMasteryLevel", mastery);

  } catch (e) {
    console.warn("❌ Results slide script failed:", e);
  }
})();

}

window.Script19 = function()
{
  /* ============================================================
   RESULTS SLIDE: SCORE, MASTERY, QUESTION LEVEL XAPI, SUMMARY
   FINAL VERSION
============================================================ */
(function () {
  try {
    const p = GetPlayer();
    if (!p) return;

    /* --------------------------------------------------------
       1) Detect competency automatically (C1, C2, C3)
    -------------------------------------------------------- */
    const compMatch = window.location.href.toUpperCase().match(/C[123]/);
    const compId = compMatch ? compMatch[0] : "C1";

    /* --------------------------------------------------------
       2) Scoring
    -------------------------------------------------------- */
    const correct = Number(p.GetVar(compId + "_Correct") || 0);
    const missedSubs = (p.GetVar(compId + "_missedSubs") || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    /* --------------------------------------------------------
       3) Mastery Level
    -------------------------------------------------------- */
    let mastery = "Failing";
    if (correct === 3) mastery = "Mastery";
    else if (correct === 2) mastery = "Proficient";
    else if (correct === 1) mastery = "Emerging";

    const testedOut = (correct === 3);
    const finalized = false; // only set on off-ramp page

    p.SetVar("currentComp", compId);
    p.SetVar("currentMasteryLevel", mastery);

    /* --------------------------------------------------------
       4) Identity / Session
    -------------------------------------------------------- */
    const learnerName =
      localStorage.getItem("learnerName") ||
      p.GetVar("learnerName") ||
      "Anonymous";

    let sid =
      localStorage.getItem("sessionId") ||
      p.GetVar("sessionId") ||
      (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

    localStorage.setItem("sessionId", sid);

    const mbox = "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

    const endpoint =
      "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws";

    /* --------------------------------------------------------
       5) Question-level XAPI (Q1-Q3)
       Uses your new variables:
       C1_Q1_Sub / C1_Q1_Answer / C1_Q1_IsCorrect / C1_Q1_Text
-------------------------------------------------------- */

    for (let i = 1; i <= 3; i++) {
      const sub = p.GetVar(`${compId}_Q${i}_Sub`) || "";
      if (!sub) continue;

      const answer = p.GetVar(`${compId}_Q${i}_Answer`) || "";
      const isCorrect = !!p.GetVar(`${compId}_Q${i}_IsCorrect`);
      const qtext =
        p.GetVar(`${compId}_Q${i}_Text`) || `Question ${sub}-Q${i}`;

      const qid = `${sub}-Q${i}`;

      const stmt = {
        actor: { name: learnerName, mbox: mbox },
        verb: {
          id: "http://adlnet.gov/expapi/verbs/answered",
          display: { "en-US": "answered" }
        },
        object: {
          id: `https://acbl.wirelxdfirm.com/activities/${compId}/questions/${qid}`,
          definition: {
            name: { "en-US": qid },
            description: { "en-US": qtext }
          }
        },
        result: {
          response: answer,
          success: isCorrect,
          extensions: {
            "https://acbl.wirelxdfirm.com/extensions/competencyId": compId,
            "https://acbl.wirelxdfirm.com/extensions/questionId": qid,
            "https://acbl.wirelxdfirm.com/extensions/subCompetency": sub,
            "https://acbl.wirelxdfirm.com/extensions/learnerName": learnerName,
            "https://acbl.wirelxdfirm.com/extensions/sessionId": sid
          }
        },
        context: { registration: sid },
        timestamp: new Date().toISOString()
      };

      fetch(endpoint + "?mode=write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stmt),
        keepalive: true
      }).then(r => console.log(`📘 Q${i} sent (${qid}):`, r.status));
    }

    /* --------------------------------------------------------
       6) Summary Statement (pass/fail)
-------------------------------------------------------- */
    const passed = correct >= 2;

    const summary = {
      actor: { name: learnerName, mbox: mbox },
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
          "https://acbl.wirelxdfirm.com/extensions/learnerName": learnerName,
          "https://acbl.wirelxdfirm.com/extensions/sessionId": sid,
          "https://acbl.wirelxdfirm.com/extensions/competencyId": compId,
          "https://acbl.wirelxdfirm.com/extensions/masteryLevel": mastery,
          "https://acbl.wirelxdfirm.com/extensions/missed": missedSubs,
          "https://acbl.wirelxdfirm.com/extensions/testedOut": testedOut,
          "https://acbl.wirelxdfirm.com/extensions/finalized": finalized
        }
      },
      context: { registration: sid },
      timestamp: new Date().toISOString()
    };

    fetch(endpoint + "?mode=write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(summary),
      keepalive: true
    }).then(r =>
      console.log(`✅ Summary (${mastery}, ${compId}):`, r.status)
    );

    /* --------------------------------------------------------
       7) Save adaptive state for next.html
-------------------------------------------------------- */
    localStorage.setItem(`${compId}.score`, correct);
    localStorage.setItem(`${compId}.missed`, JSON.stringify(missedSubs));
    localStorage.setItem(`${compId}.mastery`, mastery);
    localStorage.setItem(`${compId}.testedOut`, testedOut);
    localStorage.setItem(`${compId}.finalized`, finalized);
    localStorage.setItem(`${compId}.completed`, "true");
    localStorage.setItem("currentCompetency", compId);
    localStorage.setItem("currentMasteryLevel", mastery);

    console.log("💾 Stored adaptive state for next.html");

  } catch (err) {
    console.error("❌ Results Slide Failed:", err);
  }
})();

}

window.Script20 = function()
{
  /* ============================================================
   FAILURE LAYER INITIALIZER
   Marks test attempt as completed & clears Storyline resume
   ============================================================ */

(function () {
  try {
    const url = window.location.href.toUpperCase();

    /* ----------------------------------------------------------
       1. Detect the competency dynamically
    ---------------------------------------------------------- */
    const compMatch = url.match(/C[123]/);
    const compId = compMatch ? compMatch[0] : "C1";

    /* ----------------------------------------------------------
       2. Mark attempt as completed
          NOTE: Mastery and missed subs are NOT stored here.
          Results Slide handles all adaptive logic.
    ---------------------------------------------------------- */
    localStorage.setItem(`${compId}.completed`, "true");
    console.log(`✔ Marked ${compId} attempt as completed (FAIL outcome)`);

    /* ----------------------------------------------------------
       3. SCORM completion (ignored for HTML export)
    ---------------------------------------------------------- */
    try {
      const lms = window.lmsAPI || null;
      if (lms && lms.SetStatus) {
        lms.SetStatus("completed");
        lms.CommitData();
        console.log("✔ SCORM completion sent");
      }
    } catch (e) {
      console.log("ℹ SCORM API unavailable (HTML export)");
    }

    /* ----------------------------------------------------------
       4. Purge Storyline internal resume state ONLY
          DO NOT clear your adaptive values like:
          - C1_mastery
          - C1_missed
          - C1_score
          - sessionId
          - learnerName
    ---------------------------------------------------------- */
    try {
      const keys = Object.keys(localStorage);
      const slKeys = keys.filter(k =>
        k.startsWith("story") || k.includes("story_html5")
      );

      slKeys.forEach(k => localStorage.removeItem(k));
      console.log("✔ Storyline resume state cleared");

    } catch (e) {
      console.warn("⚠ Resume purge failed:", e);
    }

  } catch (err) {
    console.error("❌ Failure-layer completion failed:", err);
  }
})();

}

window.Script21 = function()
{
  /* ============================================================
   RESULTS CONTINUE BUTTON
   Sends learner to adaptive next.html with identity + comp
============================================================ */
(function () {
  try {
    const p = GetPlayer();
    if (!p) return;

    /* ---------------------------------------
       1) Detect competency from URL
    --------------------------------------- */
    const compMatch = window.location.href.toUpperCase().match(/C[123]/);
    const compId = compMatch ? compMatch[0] : "C1";

    /* ---------------------------------------
       2) Identity / session
    --------------------------------------- */
    const learner =
      p.GetVar("learnerName") ||
      localStorage.getItem("learnerName") ||
      "Anonymous";

    let sid =
      localStorage.getItem("sessionId") ||
      p.GetVar("sessionId") ||
      (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

    localStorage.setItem("sessionId", sid);

    /* ---------------------------------------
       3) Build redirect URL
    --------------------------------------- */
    const u = new URL("https://www.wirelearningsolutions.com/next.html");
    u.searchParams.set("learnerName", learner);
    u.searchParams.set("sid", sid);
    u.searchParams.set("current", compId);

    console.log("➡ Redirecting to adaptive next.html:", u.toString());

    window.location.href = u.toString();

  } catch (err) {
    console.error("❌ Results Continue redirect failed:", err);
  }
})();

}

window.Script22 = function()
{
  /* ============================================================
   RESULTS SLIDE: SCORE, MASTERY, QUESTION LEVEL XAPI, SUMMARY
   FINAL VERSION
============================================================ */
(function () {
  try {
    const p = GetPlayer();
    if (!p) return;

    /* --------------------------------------------------------
       1) Detect competency automatically (C1, C2, C3)
    -------------------------------------------------------- */
    const compMatch = window.location.href.toUpperCase().match(/C[123]/);
    const compId = compMatch ? compMatch[0] : "C1";

    /* --------------------------------------------------------
       2) Scoring
    -------------------------------------------------------- */
    const correct = Number(p.GetVar(compId + "_Correct") || 0);
    const missedSubs = (p.GetVar(compId + "_missedSubs") || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    /* --------------------------------------------------------
       3) Mastery Level
    -------------------------------------------------------- */
    let mastery = "Failing";
    if (correct === 3) mastery = "Mastery";
    else if (correct === 2) mastery = "Proficient";
    else if (correct === 1) mastery = "Emerging";

    const testedOut = (correct === 3);
    const finalized = false; // only set on off-ramp page

    p.SetVar("currentComp", compId);
    p.SetVar("currentMasteryLevel", mastery);

    /* --------------------------------------------------------
       4) Identity / Session
    -------------------------------------------------------- */
    const learnerName =
      localStorage.getItem("learnerName") ||
      p.GetVar("learnerName") ||
      "Anonymous";

    let sid =
      localStorage.getItem("sessionId") ||
      p.GetVar("sessionId") ||
      (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

    localStorage.setItem("sessionId", sid);

    const mbox = "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

    const endpoint =
      "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws";

    /* --------------------------------------------------------
       5) Question-level XAPI (Q1-Q3)
       Uses your new variables:
       C1_Q1_Sub / C1_Q1_Answer / C1_Q1_IsCorrect / C1_Q1_Text
-------------------------------------------------------- */

    for (let i = 1; i <= 3; i++) {
      const sub = p.GetVar(`${compId}_Q${i}_Sub`) || "";
      if (!sub) continue;

      const answer = p.GetVar(`${compId}_Q${i}_Answer`) || "";
      const isCorrect = !!p.GetVar(`${compId}_Q${i}_IsCorrect`);
      const qtext =
        p.GetVar(`${compId}_Q${i}_Text`) || `Question ${sub}-Q${i}`;

      const qid = `${sub}-Q${i}`;

      const stmt = {
        actor: { name: learnerName, mbox: mbox },
        verb: {
          id: "http://adlnet.gov/expapi/verbs/answered",
          display: { "en-US": "answered" }
        },
        object: {
          id: `https://acbl.wirelxdfirm.com/activities/${compId}/questions/${qid}`,
          definition: {
            name: { "en-US": qid },
            description: { "en-US": qtext }
          }
        },
        result: {
          response: answer,
          success: isCorrect,
          extensions: {
            "https://acbl.wirelxdfirm.com/extensions/competencyId": compId,
            "https://acbl.wirelxdfirm.com/extensions/questionId": qid,
            "https://acbl.wirelxdfirm.com/extensions/subCompetency": sub,
            "https://acbl.wirelxdfirm.com/extensions/learnerName": learnerName,
            "https://acbl.wirelxdfirm.com/extensions/sessionId": sid
          }
        },
        context: { registration: sid },
        timestamp: new Date().toISOString()
      };

      fetch(endpoint + "?mode=write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stmt),
        keepalive: true
      }).then(r => console.log(`📘 Q${i} sent (${qid}):`, r.status));
    }

    /* --------------------------------------------------------
       6) Summary Statement (pass/fail)
-------------------------------------------------------- */
    const passed = correct >= 2;

    const summary = {
      actor: { name: learnerName, mbox: mbox },
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
          "https://acbl.wirelxdfirm.com/extensions/learnerName": learnerName,
          "https://acbl.wirelxdfirm.com/extensions/sessionId": sid,
          "https://acbl.wirelxdfirm.com/extensions/competencyId": compId,
          "https://acbl.wirelxdfirm.com/extensions/masteryLevel": mastery,
          "https://acbl.wirelxdfirm.com/extensions/missed": missedSubs,
          "https://acbl.wirelxdfirm.com/extensions/testedOut": testedOut,
          "https://acbl.wirelxdfirm.com/extensions/finalized": finalized
        }
      },
      context: { registration: sid },
      timestamp: new Date().toISOString()
    };

    fetch(endpoint + "?mode=write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(summary),
      keepalive: true
    }).then(r =>
      console.log(`✅ Summary (${mastery}, ${compId}):`, r.status)
    );

    /* --------------------------------------------------------
       7) Save adaptive state for next.html
-------------------------------------------------------- */
    localStorage.setItem(`${compId}.score`, correct);
    localStorage.setItem(`${compId}.missed`, JSON.stringify(missedSubs));
    localStorage.setItem(`${compId}.mastery`, mastery);
    localStorage.setItem(`${compId}.testedOut`, testedOut);
    localStorage.setItem(`${compId}.finalized`, finalized);
    localStorage.setItem(`${compId}.completed`, "true");
    localStorage.setItem("currentCompetency", compId);
    localStorage.setItem("currentMasteryLevel", mastery);

    console.log("💾 Stored adaptive state for next.html");

  } catch (err) {
    console.error("❌ Results Slide Failed:", err);
  }
})();

}

window.Script23 = function()
{
  /* ============================================================
   SUCCESS LAYER INITIALIZER
   Marks test attempt as completed & clears Storyline resume
   ============================================================ */

(function () {
  try {
    const url = window.location.href.toUpperCase();

    /* ----------------------------------------------------------
       1. Detect competency (C1 / C2 / C3)
    ---------------------------------------------------------- */
    const compMatch = url.match(/C[123]/);
    const compId = compMatch ? compMatch[0] : "C1";

    /* ----------------------------------------------------------
       2. Mark attempt as completed
          Results slide base layer will set mastery, score, missed.
    ---------------------------------------------------------- */
    localStorage.setItem(`${compId}.completed`, "true");
    console.log(`✔ Marked ${compId} attempt as completed (SUCCESS outcome)`);

    /* ----------------------------------------------------------
       3. Optional: SCORM completion
       (Ignored on HTML export but safe for LMS mode)
    ---------------------------------------------------------- */
    try {
      const lms = window.lmsAPI || null;
      if (lms && lms.SetStatus) {
        lms.SetStatus("completed");
        lms.CommitData();
        console.log("✔ SCORM completion sent");
      }
    } catch (e) {
      console.log("ℹ SCORM API unavailable (HTML export)");
    }

    /* ----------------------------------------------------------
       4. CLEAR ONLY STORYLINE'S RESUME STATE
       Never clear:
         - C1.mastery
         - C1.score
         - C1.missed
         - sessionId
         - learnerName
       These are used by next.html.
    ---------------------------------------------------------- */
    try {
      const keys = Object.keys(localStorage);
      const slKeys = keys.filter(k =>
        k.startsWith("story") || k.includes("story_html5")
      );

      slKeys.forEach(k => localStorage.removeItem(k));
      console.log("✔ Storyline resume state cleared (success)");
    } catch (e) {
      console.warn("⚠ Resume purge failed:", e);
    }

  } catch (err) {
    console.error("❌ Success-layer completion failed:", err);
  }
})();

}

window.Script24 = function()
{
  /* ============================================================
   RESULTS CONTINUE BUTTON
   Sends learner to adaptive next.html with identity + comp
============================================================ */
(function () {
  try {
    const p = GetPlayer();
    if (!p) return;

    /* ---------------------------------------
       1) Detect competency from URL
    --------------------------------------- */
    const compMatch = window.location.href.toUpperCase().match(/C[123]/);
    const compId = compMatch ? compMatch[0] : "C1";

    /* ---------------------------------------
       2) Identity / session
    --------------------------------------- */
    const learner =
      p.GetVar("learnerName") ||
      localStorage.getItem("learnerName") ||
      "Anonymous";

    let sid =
      localStorage.getItem("sessionId") ||
      p.GetVar("sessionId") ||
      (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

    localStorage.setItem("sessionId", sid);

    /* ---------------------------------------
       3) Build redirect URL
    --------------------------------------- */
    const u = new URL("https://www.wirelearningsolutions.com/next.html");
    u.searchParams.set("learnerName", learner);
    u.searchParams.set("sid", sid);
    u.searchParams.set("current", compId);

    console.log("➡ Redirecting to adaptive next.html:", u.toString());

    window.location.href = u.toString();

  } catch (err) {
    console.error("❌ Results Continue redirect failed:", err);
  }
})();

}

};
