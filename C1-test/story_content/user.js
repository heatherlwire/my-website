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
  // =======================================
//  Adaptive Learning: Initialization + Resume + Lambda "initialized" log
//  Trigger: Execute JavaScript (runs when slide 1 timeline starts)
//  Requires Storyline text vars: learnerName, actorName, actorMbox, sessionId, QuizCompleted
// =======================================
(function () {
  try {
    const player = GetPlayer();
    if (!player) return;

    // ---------- helpers ----------
    const getQS = n => {
      const m = new RegExp("[?&]" + n + "=([^&#]*)").exec(window.location.search);
      return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : null;
    };
    const b64JsonTry = s => { try { return JSON.parse(atob(s)); } catch { return null; } };
    const tidy = s => (s || "").toString().trim();

    // ---------- candidate sources ----------
    const qsName = getQS("learnerName") || getQS("name");
    const actorParam = getQS("actor");
    let actor = null;
    if (actorParam) {
      try { actor = JSON.parse(actorParam); } catch { actor = b64JsonTry(actorParam); }
    }
    const storedName = localStorage.getItem("learnerName");

    // ---------- resolve final name ----------
    let resolvedName =
      tidy(qsName) ||
      tidy(actor && (actor.name || (actor.account && actor.account.name))) ||
      tidy(storedName);

    const ENABLE_PROMPT_IF_MISSING = false;
    if (!resolvedName && ENABLE_PROMPT_IF_MISSING) {
      const tmp = prompt("Enter your name to begin:");
      if (tmp) resolvedName = tidy(tmp);
    }

    // ---------- fallback if still missing ----------
    if (!resolvedName) {
      console.warn("Actor Initialization: No learner name found. Using fallback.");
      resolvedName = "there"; // friendly fallback for "Hi there"
    }

    // ---------- derive mbox + session ----------
    const mbox = (actor && actor.mbox) || ("mailto:" + encodeURIComponent(resolvedName) + "@wirelxdfirm.com");
    let sid = localStorage.getItem("sessionId");
    if (!sid) {
      sid = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
      localStorage.setItem("sessionId", sid);
    }

    // ---------- Storyline + localStorage sync ----------
    player.SetVar("learnerName", resolvedName);
    player.SetVar("actorName", resolvedName);
    player.SetVar("actorMbox", mbox);
    player.SetVar("sessionId", sid);
    localStorage.setItem("learnerName", resolvedName);
    localStorage.setItem("actorName", resolvedName);
    localStorage.setItem("actorMbox", mbox);
    localStorage.setItem("currentCompetency", "C1");
    window.__ACBL_ACTOR__ = { name: resolvedName, mbox, sessionId: sid };

    // ---------- Resume logic ----------
    const completed = player.GetVar("QuizCompleted");
    const suspend = localStorage.getItem("StorylineResumePrompt");
    if (completed) {
      player.SetVar("QuizCompleted", false);
      localStorage.removeItem("StorylineResumePrompt");
      location.reload();
    } else if (!suspend) {
      const resume = confirm("Do you want to resume your previous attempt?");
      if (!resume) {
        localStorage.removeItem("StorylineResumePrompt");
        location.reload();
      } else {
        localStorage.setItem("StorylineResumePrompt", "yes");
      }
    }

    // ---------- Optional: send "initialized" xAPI via Lambda ----------
    const initStmt = {
      actor: { name: resolvedName, mbox },
      verb: {
        id: "http://adlnet.gov/expapi/verbs/initialized",
        display: { "en-US": "initialized" }
      },
      object: {
        id: "https://acbl.wirelxdfirm.com/activities/" +
             (window.location.pathname.split("/").pop() || "course"),
        definition: { name: { "en-US": "Course Launched" } },
        objectType: "Activity"
      },
      context: { registration: sid },
      timestamp: new Date().toISOString()
    };

    fetch("https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws?mode=write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(initStmt),
      keepalive: true
    })
      .then(r => console.log(r.ok ? "✅ Initialized logged via Lambda" : "⚠️ Init log failed:", r.status))
      .catch(e => console.warn("Init xAPI send failed:", e));

    console.log("Actor Initialization complete:", { name: resolvedName, mbox, sessionId: sid });
  } catch (e) {
    console.warn("Actor Initialization failed:", e);
  }
})();

}

window.Script4 = function()
{
  try {
  console.log("🚀 Testing sendXAPI helper...");

  if (typeof sendXAPI !== "function") {
    alert("⚠️ sendXAPI not loaded. Ensure the master script ran.");
  } else {
    const p = GetPlayer();
    const learnerName = p.GetVar("learnerName") || localStorage.getItem("learnerName") || "Anonymous";
    const sessionId   = p.GetVar("sessionId")   || localStorage.getItem("sessionId") || crypto.randomUUID();

    sendXAPI(
      "http://adlnet.gov/expapi/verbs/experienced",
      "experienced",
      "https://wirelearningsolutions.com/test-lrs-check",
      "LRS Connectivity Test",
      {
        extensions: {
          "https://acbl.wirelxdfirm.com/extensions/learnerName": learnerName,
          "https://acbl.wirelxdfirm.com/extensions/sessionId": sessionId,
          "https://acbl.wirelxdfirm.com/extensions/test": true
        }
      }
    );

    alert("✅ Statement sent to Lambda. Check SCORM Cloud LRS for the test event.");
  }
} catch (err) {
  console.error("❌ Test trigger failed:", err);
  alert("❌ Error during test. Check browser console.");
}

}

window.Script5 = function()
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

window.Script6 = function()
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

window.Script7 = function()
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

window.Script11 = function()
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

window.Script12 = function()
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

window.Script13 = function()
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

window.Script14 = function()
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

window.Script15 = function()
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

window.Script16 = function()
{
  (function () {
  try {
    var p = GetPlayer();
    if (!p) return;

    // --- 1. Detect which competency this file represents ---
    var url = window.location.href.toUpperCase();
    var competencyMatch = url.match(/C[123]/);
    var compId = competencyMatch ? competencyMatch[0] : "C1";

    // --- 2. Gather Storyline variables ---
    var correct = Number(p.GetVar(compId + "_Correct") || 0);
    var missedSubs = (p.GetVar(compId + "_missedSubs") || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    // --- 3. Determine mastery level ---
    var mastery = "Failing";
    if (correct === 3) mastery = "Mastery";
    else if (correct === 2) mastery = "Proficient";
    else if (correct === 1) mastery = "Emerging";

    var testedOut = correct === 3;
    var finalized = false;

    // --- 3b. Write dynamic values back to Storyline ---
    p.SetVar("currentComp", compId);
    p.SetVar("currentMasteryLevel", mastery);

    // --- 4. Actor + session info ---
    var name = localStorage.getItem("learnerName") || p.GetVar("actorName") || "Anonymous";
    var sid  = localStorage.getItem("sessionId")   || p.GetVar("sessionId") || Date.now().toString();
    var mbox = "mailto:" + encodeURIComponent(name) + "@wirelxdfirm.com";

    // --- 5. Lambda endpoint ---
    var endpoint = "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws";

    // --- 5b. Send per-question xAPI statements ---
    for (let i = 1; i <= 3; i++) {
      const qid = `${compId.toLowerCase()}a-${i}`;
      const ansVar = `${compId}_Q${i}_Answer`;
      const correctVar = `${compId}_Q${i}_IsCorrect`;
      const textVar = `${compId}_Q${i}_Text`;

      const answer = p.GetVar(ansVar) || "";
      const isCorrect = !!p.GetVar(correctVar);
      const qtext = p.GetVar(textVar) || `Question ${qid}`;

      const qStmt = {
        actor: { name: name, mbox: mbox },
        verb: { id: "http://adlnet.gov/expapi/verbs/answered", display: { "en-US": "answered" } },
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
            "https://acbl.wirelxdfirm.com/extensions/learnerName": name,
            "https://acbl.wirelxdfirm.com/extensions/sessionId": sid,
            "https://acbl.wirelxdfirm.com/extensions/competencyId": compId,
            "https://acbl.wirelxdfirm.com/extensions/questionId": qid
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
      .then(r => console.log(`📘 Sent question ${qid}:`, r.status))
      .catch(e => console.warn(`❌ Question ${qid} failed:`, e));
    }

    // --- 6. Build and send summary statement ---
    var verbId =
      correct >= 2
        ? "http://adlnet.gov/expapi/verbs/passed"
        : "http://adlnet.gov/expapi/verbs/failed";
    var verbDisplay = correct >= 2 ? "passed" : "failed";

    var stmt = {
      actor: { name: name, mbox: mbox },
      verb: { id: verbId, display: { "en-US": verbDisplay } },
      object: {
        id: `https://acbl.wirelxdfirm.com/activities/${compId}/quiz`,
        objectType: "Activity"
      },
      result: {
        score: { raw: correct, min: 0, max: 3 },
        success: correct >= 2,
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
      timestamp: new Date().toISOString()
    };

    fetch(endpoint + "?mode=write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stmt),
      keepalive: true
    })
    .then(r => console.log(`✅ Sent ${verbDisplay} (${mastery}) for ${compId}. Status:`, r.status))
    .catch(e => console.warn("LRS send failed:", e));

    // --- 7. Store mastery data locally ---
    const keyBase = compId + ".";
    localStorage.setItem(keyBase + "mastery", mastery);
    localStorage.setItem(keyBase + "finalized", finalized);
    localStorage.setItem(keyBase + "testedOut", testedOut);
    localStorage.setItem(keyBase + "score", correct.toString());
    localStorage.setItem(keyBase + "missed", JSON.stringify(missedSubs));
    localStorage.setItem("currentCompetency", compId);
    localStorage.setItem("currentMasteryLevel", mastery);

    console.log("💾 Stored locally:", { compId, mastery, testedOut, finalized, missedSubs });
  } catch (e) {
    console.warn("xAPI quiz send failed:", e);
  }
})();

}

window.Script17 = function()
{
  (function () {
  try {
    console.log("🚀 Adaptive Continue (final stable build)");

    // --- Guard: prevent double trigger ---
    if (localStorage.getItem("continue.lock")) return;
    localStorage.setItem("continue.lock", "1");
    setTimeout(() => localStorage.removeItem("continue.lock"), 3000);

    // --- Storyline Player ---
    const p = GetPlayer && GetPlayer();
    if (!p) return;

    // --- Detect competency (C1/C2/C3) ---
    const url = window.location.href.toUpperCase();
    const compId = (url.match(/C[123]/) || ["C1"])[0];
    console.log("📘 Competency:", compId);

    // --- Quiz data ---
    const correct = Number(p.GetVar(compId + "_Correct") || 0);
    const missedSubs = (p.GetVar(compId + "_missedSubs") || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    // --- Determine mastery ---
    let mastery = "Failing";
    if (correct === 3) mastery = "Mastery";
    else if (correct === 2) mastery = "Proficient";
    else if (correct === 1) mastery = "Emerging";

    const testedOut = correct === 3;
    const finalized = false;

    // --- Identity & session ---
    const learnerName = p.GetVar("learnerName") || localStorage.getItem("learnerName") || "Anonymous";
    const sid = localStorage.getItem("sessionId") || crypto.randomUUID();
    localStorage.setItem("sessionId", sid);

    const NS = "https://acbl.wirelearningsolutions.com/extensions/";
    const endpoint = "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws";

    // --- Function to send statements ---
    async function sendToLRS(statement, label) {
      try {
        const res = await fetch(endpoint + "?mode=write", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ statements: [statement] }),
          keepalive: true
        });
        console.log(`📡 Sent ${label}:`, res.status);
      } catch (e) {
        console.warn(`⚠️ LRS send failed for ${label}:`, e);
      }
    }

    // --- Build xAPI statement ---
    const stmt = {
      actor: { name: learnerName, mbox: `mailto:${encodeURIComponent(learnerName)}@wirelxdfirm.com` },
      verb: {
        id: correct >= 2 ? "http://adlnet.gov/expapi/verbs/passed" : "http://adlnet.gov/expapi/verbs/failed",
        display: { "en-US": correct >= 2 ? "passed" : "failed" }
      },
      object: {
        id: `https://acbl.wirelearningsolutions.com/activities/${compId}/quiz`,
        objectType: "Activity"
      },
      result: {
        score: { raw: correct, min: 0, max: 3 },
        success: correct >= 2,
        completion: true,
        extensions: {
          [NS + "learnerName"]: learnerName,
          [NS + "sessionId"]: sid,
          [NS + "competencyId"]: compId,
          [NS + "masteryLevel"]: mastery,
          [NS + "missed"]: missedSubs,
          [NS + "testedOut"]: testedOut,
          [NS + "finalized"]: finalized
        }
      },
      context: { registration: sid },
      timestamp: new Date().toISOString()
    };

    // --- Save locally ---
    localStorage.setItem(compId + ".mastery", mastery);
    localStorage.setItem(compId + ".missed", JSON.stringify(missedSubs));
    localStorage.setItem(compId + ".status", correct === 3 ? "Completed" : "InProgress");

    // --- Send to Lambda/LRS ---
    sendToLRS(stmt, `Quiz result (${compId})`);

    // --- Adaptive Routing ---
    let nextUrls = [];
    let status = correct === 3 ? "Completed" : "InProgress";

    if (mastery === "Mastery") {
      nextUrls = [`C${Number(compId.replace("C", "")) + 1}-test/story.html`];
    } else if (mastery === "Proficient") {
      nextUrls = missedSubs.flatMap(sub => [
        `content/${sub}-content.html`,
        `apply/${sub}-apply.html`
      ]);
      nextUrls.push(`${compId}-test/story.html`);
    } else {
      const subs = ["a", "b", "c"].map(x => `${compId}${x}`);
      nextUrls = subs.flatMap(sub => [
        `content/${sub}-content.html`,
        `apply/${sub}-apply.html`
      ]);
      nextUrls.push(`${compId}-test/story.html`);
    }

    localStorage.setItem("adaptivePath", JSON.stringify(nextUrls));
    localStorage.setItem("currentCompetency", compId);
    localStorage.setItem(`${compId}_status`, status);

    // --- Redirect ---
    const nextPage = nextUrls[0] || "next.html";
    const base = "https://www.wirelearningsolutions.com/";
    const redirectUrl = `${base}${nextPage}?learnerName=${encodeURIComponent(learnerName)}&sid=${encodeURIComponent(sid)}&current=${compId}`;

    console.log("➡️ Redirecting to:", redirectUrl);
    window.location.href = redirectUrl;

  } catch (e) {
    console.error("❌ Continue button error:", e);
  }
})();

}

window.Script18 = function()
{
  (function () {
  try {
    console.log("🚀 Adaptive Continue (final stable build)");

    // --- Guard: prevent double trigger ---
    if (localStorage.getItem("continue.lock")) return;
    localStorage.setItem("continue.lock", "1");
    setTimeout(() => localStorage.removeItem("continue.lock"), 3000);

    // --- Storyline Player ---
    const p = GetPlayer && GetPlayer();
    if (!p) return;

    // --- Detect competency (C1/C2/C3) ---
    const url = window.location.href.toUpperCase();
    const compId = (url.match(/C[123]/) || ["C1"])[0];
    console.log("📘 Competency:", compId);

    // --- Quiz data ---
    const correct = Number(p.GetVar(compId + "_Correct") || 0);
    const missedSubs = (p.GetVar(compId + "_missedSubs") || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    // --- Determine mastery ---
    let mastery = "Failing";
    if (correct === 3) mastery = "Mastery";
    else if (correct === 2) mastery = "Proficient";
    else if (correct === 1) mastery = "Emerging";

    const testedOut = correct === 3;
    const finalized = false;

    // --- Identity & session ---
    const learnerName = p.GetVar("learnerName") || localStorage.getItem("learnerName") || "Anonymous";
    const sid = localStorage.getItem("sessionId") || crypto.randomUUID();
    localStorage.setItem("sessionId", sid);

    const NS = "https://acbl.wirelearningsolutions.com/extensions/";
    const endpoint = "https://kh2do5aivc7hqegavqjeiwmd7q0smjqq.lambda-url.us-east-1.on.aws";

    // --- Function to send statements ---
    async function sendToLRS(statement, label) {
      try {
        const res = await fetch(endpoint + "?mode=write", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ statements: [statement] }),
          keepalive: true
        });
        console.log(`📡 Sent ${label}:`, res.status);
      } catch (e) {
        console.warn(`⚠️ LRS send failed for ${label}:`, e);
      }
    }

    // --- Build xAPI statement ---
    const stmt = {
      actor: { name: learnerName, mbox: `mailto:${encodeURIComponent(learnerName)}@wirelxdfirm.com` },
      verb: {
        id: correct >= 2 ? "http://adlnet.gov/expapi/verbs/passed" : "http://adlnet.gov/expapi/verbs/failed",
        display: { "en-US": correct >= 2 ? "passed" : "failed" }
      },
      object: {
        id: `https://acbl.wirelearningsolutions.com/activities/${compId}/quiz`,
        objectType: "Activity"
      },
      result: {
        score: { raw: correct, min: 0, max: 3 },
        success: correct >= 2,
        completion: true,
        extensions: {
          [NS + "learnerName"]: learnerName,
          [NS + "sessionId"]: sid,
          [NS + "competencyId"]: compId,
          [NS + "masteryLevel"]: mastery,
          [NS + "missed"]: missedSubs,
          [NS + "testedOut"]: testedOut,
          [NS + "finalized"]: finalized
        }
      },
      context: { registration: sid },
      timestamp: new Date().toISOString()
    };

    // --- Save locally ---
    localStorage.setItem(compId + ".mastery", mastery);
    localStorage.setItem(compId + ".missed", JSON.stringify(missedSubs));
    localStorage.setItem(compId + ".status", correct === 3 ? "Completed" : "InProgress");

    // --- Send to Lambda/LRS ---
    sendToLRS(stmt, `Quiz result (${compId})`);

    // --- Adaptive Routing ---
    let nextUrls = [];
    let status = correct === 3 ? "Completed" : "InProgress";

    if (mastery === "Mastery") {
      nextUrls = [`C${Number(compId.replace("C", "")) + 1}-test/story.html`];
    } else if (mastery === "Proficient") {
      nextUrls = missedSubs.flatMap(sub => [
        `content/${sub}-content.html`,
        `apply/${sub}-apply.html`
      ]);
      nextUrls.push(`${compId}-test/story.html`);
    } else {
      const subs = ["a", "b", "c"].map(x => `${compId}${x}`);
      nextUrls = subs.flatMap(sub => [
        `content/${sub}-content.html`,
        `apply/${sub}-apply.html`
      ]);
      nextUrls.push(`${compId}-test/story.html`);
    }

    localStorage.setItem("adaptivePath", JSON.stringify(nextUrls));
    localStorage.setItem("currentCompetency", compId);
    localStorage.setItem(`${compId}_status`, status);

    // --- Redirect ---
    const nextPage = nextUrls[0] || "next.html";
    const base = "https://www.wirelearningsolutions.com/";
    const redirectUrl = `${base}${nextPage}?learnerName=${encodeURIComponent(learnerName)}&sid=${encodeURIComponent(sid)}&current=${compId}`;

    console.log("➡️ Redirecting to:", redirectUrl);
    window.location.href = redirectUrl;

  } catch (e) {
    console.error("❌ Continue button error:", e);
  }
})();

}

};
