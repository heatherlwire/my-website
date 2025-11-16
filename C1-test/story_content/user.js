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
       4. Auto-detect competency from filename
       --------------------------------------- */
    const url  = location.href.toUpperCase();
    const comp = (url.match(/C[123]/) || ["C1"])[0];  // Detects C1, C2, or C3

    localStorage.setItem("currentCompetency", comp);

    /* ---------------------------------------
       5. Test-start tracking (runs only once)
       --------------------------------------- */
    const startKey = `${comp}.started`;
    if (!localStorage.getItem(startKey)) {

      localStorage.setItem(startKey, "true");
      localStorage.setItem(`${comp}.startedAt`, new Date().toISOString());

      // Optional xAPI "launched"
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
        console.log(`🚀 xAPI launched sent for ${comp}-test`);
      } else {
        console.log(`🚀 Marked ${comp}-test as begun`);
      }
    }

    /* ---------------------------------------
       6. Resume logic (dynamic)
       --------------------------------------- */
    const scoreKey     = `${comp}.score`;
    const completeKey  = `${comp}.completed`;

    const storedScore     = localStorage.getItem(scoreKey);
    const storedCompleted = localStorage.getItem(completeKey) === "true";

    console.log("🔍 Resume Check", {
      comp,
      storedScore,
      storedCompleted,
      learner,
      sid
    });

    // Brand new attempt
    if (!storedScore) {
      console.log("✨ Starting a new attempt");
      return;
    }

    // Completed attempt
    if (storedCompleted) {
      console.log("✨ Previous attempt completed — forcing fresh start");
      return;
    }

    // Attempt in progress → ask to resume
    const resume = confirm("Do you want to resume your previous test attempt?");
    if (!resume) {
      console.log("🔄 Learner chose not to resume");
      return;
    }

    console.log("▶ Resuming previous attempt");

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
  (function(){
  var p = GetPlayer();
  var slide = window.location.href.split("/").pop(); // e.g., "C1_Q1.html"
  var qid = "C1_Q1"; // optional: rename per slide if you prefer consistent pattern

  // Access Storyline built-in question data
  var playerVars = p.GetVarNames ? p.GetVarNames() : [];
  var answer = "";
  var correct = false;

  try {
    // Storyline stores recent interaction in cmi.interactions array (SCORM/xAPI runtime)
    if (window.GetPlayer && p) {
      answer = p.GetVar("TextEntry") || p.GetVar("SelectedAnswer") || ""; // fallback
    }
  } catch(e) { console.warn("No interaction vars found:", e); }

  // Save dynamic values to Storyline variables
  p.SetVar(qid + "_Answer", answer);
})();

}

window.Script7 = function()
{
  /* Question-level xAPI (Incorrect) */
(function() {
  const p = GetPlayer();
  const learner = p.GetVar("learnerName");
  const sid = p.GetVar("sessionId");
  const comp = p.GetVar("currentComp");
  const sub = p.GetVar("CurrentSub");
  const qid = sub + "-1";

  sendXAPI(
    "http://adlnet.gov/expapi/verbs/answered",
    "answered",
    `https://acbl.wirelxdfirm.com/activities/${comp}/questions/${qid}`,
    `${qid}`,
    {
      success: false,
      response: "incorrect",
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
  var p = GetPlayer();

// Capture learner's selected answer (choice text or text entry)
var answer =
  p.GetVar("SelectedAnswer") ||
  p.GetVar("TextEntry") ||
  "";

// Store into per-question variable
p.SetVar("C1_Q1_Answer", answer);

}

window.Script9 = function()
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

window.Script10 = function()
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

window.Script11 = function()
{
  var p = GetPlayer();
var title = document.title || "";

// Detect patterns like “C1a”, “C1b”, “C1c”
var match = title.match(/C[123][abc]/i);

if (match) {
    p.SetVar("C1_SubCompetency", match[0]);
} else {
    console.log("Sub competency not found in title");
}

}

window.Script12 = function()
{
  (function(){
  var p = GetPlayer();
  var slide = window.location.href.split("/").pop(); // e.g., "C1_Q1.html"
  var qid = "C1_Q2"; // optional: rename per slide if you prefer consistent pattern

  // Access Storyline built-in question data
  var playerVars = p.GetVarNames ? p.GetVarNames() : [];
  var answer = "";
  var correct = false;

  try {
    // Storyline stores recent interaction in cmi.interactions array (SCORM/xAPI runtime)
    if (window.GetPlayer && p) {
      answer = p.GetVar("TextEntry") || p.GetVar("SelectedAnswer") || ""; // fallback
    }
  } catch(e) { console.warn("No interaction vars found:", e); }

  // Save dynamic values to Storyline variables
  p.SetVar(qid + "_Answer", answer);
})();

}

window.Script13 = function()
{
  /* Question-level xAPI (Incorrect) */
(function() {
  const p = GetPlayer();
  const learner = p.GetVar("learnerName");
  const sid = p.GetVar("sessionId");
  const comp = p.GetVar("currentComp");
  const sub = p.GetVar("CurrentSub");
  const qid = sub + "-1";

  sendXAPI(
    "http://adlnet.gov/expapi/verbs/answered",
    "answered",
    `https://acbl.wirelxdfirm.com/activities/${comp}/questions/${qid}`,
    `${qid}`,
    {
      success: false,
      response: "incorrect",
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

window.Script14 = function()
{
  var p = GetPlayer();

// Capture learner's selected answer (choice text or text entry)
var answer =
  p.GetVar("SelectedAnswer") ||
  p.GetVar("TextEntry") ||
  "";

// Store into per-question variable
p.SetVar("C1_Q2_Answer", answer);

}

window.Script15 = function()
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

window.Script16 = function()
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

window.Script17 = function()
{
  (function(){
  var p = GetPlayer();
  var slide = window.location.href.split("/").pop(); // e.g., "C1_Q1.html"
  var qid = "C1_Q1"; // optional: rename per slide if you prefer consistent pattern

  // Access Storyline built-in question data
  var playerVars = p.GetVarNames ? p.GetVarNames() : [];
  var answer = "";
  var correct = false;

  try {
    // Storyline stores recent interaction in cmi.interactions array (SCORM/xAPI runtime)
    if (window.GetPlayer && p) {
      answer = p.GetVar("TextEntry") || p.GetVar("SelectedAnswer") || ""; // fallback
    }
  } catch(e) { console.warn("No interaction vars found:", e); }

  // Save dynamic values to Storyline variables
  p.SetVar(qid + "_Answer", answer);
})();

}

window.Script18 = function()
{
  /* Question-level xAPI (Incorrect) */
(function() {
  const p = GetPlayer();
  const learner = p.GetVar("learnerName");
  const sid = p.GetVar("sessionId");
  const comp = p.GetVar("currentComp");
  const sub = p.GetVar("CurrentSub");
  const qid = sub + "-1";

  sendXAPI(
    "http://adlnet.gov/expapi/verbs/answered",
    "answered",
    `https://acbl.wirelxdfirm.com/activities/${comp}/questions/${qid}`,
    `${qid}`,
    {
      success: false,
      response: "incorrect",
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

window.Script19 = function()
{
  var p = GetPlayer();

// Capture learner's selected answer (choice text or text entry)
var answer =
  p.GetVar("SelectedAnswer") ||
  p.GetVar("TextEntry") ||
  "";

// Store into per-question variable
p.SetVar("C1_Q3_Answer", answer);

}

window.Script20 = function()
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

window.Script21 = function()
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

window.Script22 = function()
{
  /* Results slide - scoring, mastery, xAPI, localStorage */
(function () {
  try {
    const p = GetPlayer();
    if (!p) return;

    // 1) Detect competency from URL
    const url = window.location.href.toUpperCase();
    const compMatch = url.match(/C[123]/);
    const compId = compMatch ? compMatch[0] : "C1";

    // 2) Gather scoring variables
    const correct = Number(p.GetVar(compId + "_Correct") || 0);

    const missedSubs = (p.GetVar(compId + "_missedSubs") || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    // 3) Determine mastery
    let mastery = "Failing";
    if (correct === 3) mastery = "Mastery";
    else if (correct === 2) mastery = "Proficient";
    else if (correct === 1) mastery = "Emerging";

    const testedOut = correct === 3;
    const finalized = false;

    p.SetVar("currentComp", compId);
    p.SetVar("currentMasteryLevel", mastery);

    // 4) Identity and session
    const name =
      localStorage.getItem("learnerName") ||
      p.GetVar("actorName") ||
      "Anonymous";

    const sid =
      localStorage.getItem("sessionId") ||
      p.GetVar("sessionId") ||
      (Date.now().toString());

    const mbox =
      "mailto:" + encodeURIComponent(name) + "@wirelxdfirm.com";

    const endpoint =
      "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws";

    // 5) Question level xAPI - dynamic per sub
    for (let i = 1; i <= 3; i++) {
      const subVar = `${compId}_Q${i}_Sub`;       // C1_Q1_Sub = "C1a"
      const answerVar = `${compId}_Q${i}_Answer`;
      const correctVar = `${compId}_Q${i}_IsCorrect`;
      const textVar = `${compId}_Q${i}_Text`;

      const sub = p.GetVar(subVar) || "";
      if (!sub) continue;

      const qid = `${sub}-Q${i}`;

      const answer = p.GetVar(answerVar) || "";
      const isCorrect = !!p.GetVar(correctVar);
      const qtext = p.GetVar(textVar) || `Question ${qid}`;

      const qStmt = {
        actor: { name: name, mbox: mbox },
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
            "https://acbl.wirelxdfirm.com/extensions/learnerName": name,
            "https://acbl.wirelxdfirm.com/extensions/sessionId": sid
          }
        },
        context: { registration: sid },
        timestamp: new Date().toISOString()
      };

      fetch(endpoint + "?mode=write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(qStmt),
        keepalive: true
      })
        .then(r =>
          console.log(`📘 Sent question ${qid} for ${compId}:`, r.status)
        )
        .catch(e =>
          console.warn(`❌ Question ${qid} send failed:`, e)
        );
    }

    // 6) Summary statement
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
      .then(r =>
        console.log(
          `✅ Sent ${verbDisplay} (${mastery}) for ${compId}. Status:`,
          r.status
        )
      )
      .catch(e => console.warn("❌ Summary send failed:", e));

    // 7) Store adaptive state for next.html
    localStorage.setItem(`${compId}.score`, correct);
    localStorage.setItem(`${compId}.missed`, JSON.stringify(missedSubs));
    localStorage.setItem(`${compId}.mastery`, mastery);
    localStorage.setItem(`${compId}.testedOut`, testedOut);
    localStorage.setItem(`${compId}.finalized`, finalized);
    localStorage.setItem(`${compId}.completed`, "true");
    localStorage.setItem("currentCompetency", compId);
    localStorage.setItem("currentMasteryLevel", mastery);

    console.log("💾 Stored adaptive state:", {
      compId,
      correct,
      mastery,
      testedOut,
      finalized,
      missedSubs
    });

  } catch (e) {
    console.warn("❌ Results slide script failed:", e);
  }
})();

}

window.Script23 = function()
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

window.Script24 = function()
{
  /* Results Continue button - send learner to next.html */
(function () {
  try {
    const p = GetPlayer();
    if (!p) return;

    const url = window.location.href.toUpperCase();
    const compMatch = url.match(/C[123]/);
    const compId = compMatch ? compMatch[0] : "C1";

    const learner =
      p.GetVar("learnerName") ||
      localStorage.getItem("learnerName") ||
      "Anonymous";

    const sid =
      localStorage.getItem("sessionId") ||
      p.GetVar("sessionId") ||
      (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

    localStorage.setItem("sessionId", sid);

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

window.Script25 = function()
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

window.Script26 = function()
{
  /* Results Continue button - send learner to next.html */
(function () {
  try {
    const p = GetPlayer();
    if (!p) return;

    const url = window.location.href.toUpperCase();
    const compMatch = url.match(/C[123]/);
    const compId = compMatch ? compMatch[0] : "C1";

    const learner =
      p.GetVar("learnerName") ||
      localStorage.getItem("learnerName") ||
      "Anonymous";

    const sid =
      localStorage.getItem("sessionId") ||
      p.GetVar("sessionId") ||
      (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

    localStorage.setItem("sessionId", sid);

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
