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

  window.sendXAPI = async function (verbId, verbDisplay, objectId, objectName, resultData = {}) {
    try {
      const p = GetPlayer();
      if (!p) return;

      const learnerName = p.GetVar("learnerName") || localStorage.getItem("learnerName") || "Anonymous";
      const sessionId   = p.GetVar("sessionId")   || localStorage.getItem("sessionId") || String(Date.now());
      const mbox        = "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

      const statement = {
        actor: { name: learnerName, mbox: mbox },
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

      // Direct-post to your LRS (website-hosted courses)
      const endpoint = "https://cloud.scorm.com/lrs/TENBKY6BZ6/sandbox/statements";
      const auth = "Basic " + btoa("d_cPqAqYNvM3sMTyJ2M:rh70yfaxONPyu11z_vk");

      const r = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": auth,
          "Content-Type": "application/json",
          "X-Experience-API-Version": "1.0.3"
        },
        body: JSON.stringify(statement),
        keepalive: true
      });
      console.log(r.ok ? `✅ xAPI sent: ${verbDisplay}` : `⚠️ xAPI failed: ${r.status}`);
    } catch (e) {
      console.error("❌ sendXAPI error:", e);
    }
  };
}

}

window.Script2 = function()
{
  // ===============================
// Step 1: Actor Initialization
// Runs on first slide, Timeline Starts
// Trigger: Execute JavaScript – Initialize_LearnerName
// Storyline Text variables required: learnerName, actorName, actorMbox, sessionId
// ===============================
(function () {
  try {
    var player = GetPlayer();
    if (!player) return;

    // ---------- helpers ----------
    function getQS(name) {
      var m = new RegExp("[?&]" + name + "=([^&#]*)").exec(window.location.search);
      return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : null;
    }
    function b64JsonTry(str) {
      try { return JSON.parse(atob(str)); } catch (e) { return null; }
    }
    function tidy(s) { return (s || "").toString().trim(); }

    // ---------- candidate sources ----------
    // 1) Explicit query params your launcher might pass
    var qsName = getQS("learnerName") || getQS("name");
    // 2) Optional actor param (JSON object or base64-encoded JSON)
    var actorParam = getQS("actor");
    var actor = null;
    if (actorParam) {
      try {
        // try JSON first, then base64 JSON
        actor = JSON.parse(actorParam);
      } catch (e) {
        actor = b64JsonTry(actorParam);
      }
    }

    // 3) Previously stored
    var storedName = localStorage.getItem("learnerName");

    // ---------- resolve final name ----------
    var resolvedName =
      tidy(qsName) ||
      tidy(actor && (actor.name || (actor.account && actor.account.name))) ||
      tidy(storedName);

    // Optional: live-demo fallback prompt (disabled by default)
    var ENABLE_PROMPT_IF_MISSING = false;
    if (!resolvedName && ENABLE_PROMPT_IF_MISSING) {
      var tmp = prompt("Enter your name to begin:");
      if (tmp) resolvedName = tidy(tmp);
    }

    // If still missing, don’t set anything – your gating logic will handle it
    if (!resolvedName) {
      console.warn("Actor Initialization: No learner name found.");
      return;
    }

    // ---------- derive mbox if available ----------
    var mbox =
      (actor && actor.mbox) ||
      ("mailto:" + encodeURIComponent(resolvedName) + "@wirelxdfirm.com");

    // ---------- stable session id across modules ----------
    var sid = localStorage.getItem("sessionId");
    if (!sid) {
      sid = (self.crypto && self.crypto.randomUUID) ? self.crypto.randomUUID() : String(Date.now());
      localStorage.setItem("sessionId", sid);
    }

    // ---------- set Storyline variables ----------
    player.SetVar("learnerName", resolvedName);
    player.SetVar("actorName", resolvedName);
    player.SetVar("actorMbox", mbox);
    player.SetVar("sessionId", sid);

    // ---------- persist for other modules / Next Page ----------
    localStorage.setItem("learnerName", resolvedName);
    localStorage.setItem("actorName", resolvedName);
    localStorage.setItem("actorMbox", mbox);

    // Optional: expose to window if you want to read later from web objects
    window.__ACBL_ACTOR__ = { name: resolvedName, mbox: mbox, sessionId: sid };

    console.log("Actor Initialization complete:", { name: resolvedName, mbox: mbox, sessionId: sid });
  } catch (e) {
    console.warn("Actor Initialization failed:", e);
  }
})();
}

window.Script3 = function()
{
  var player = GetPlayer();
var completed = player.GetVar("QuizCompleted");
var suspend = window.localStorage.getItem("StorylineResumePrompt");

if (completed) {
    // Learner finished before — restart the quiz
    player.SetVar("QuizCompleted", false);
    window.localStorage.removeItem("StorylineResumePrompt");
    window.location.reload(); // forces restart
} else if (!suspend) {
    // If mid-quiz and resume not yet asked
    var resume = confirm("Do you want to resume your previous attempt?");
    if (!resume) {
        window.localStorage.removeItem("StorylineResumePrompt");
        window.location.reload();
    } else {
        window.localStorage.setItem("StorylineResumePrompt", "yes");
    }
}
}

window.Script4 = function()
{
  // Load once (Master fires on every slide)
if (!window.__XAPI_HELPER_LOADED__) {
  window.__XAPI_HELPER_LOADED__ = true;

  window.sendXAPI = async function (verbId, verbDisplay, objectId, objectName, resultData = {}) {
    try {
      const p = GetPlayer();
      if (!p) return;

      const learnerName = p.GetVar("learnerName") || localStorage.getItem("learnerName") || "Anonymous";
      const sessionId   = p.GetVar("sessionId")   || localStorage.getItem("sessionId") || String(Date.now());
      const mbox        = "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

      const statement = {
        actor: { name: learnerName, mbox: mbox },
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

      // Direct-post to your LRS (website-hosted courses)
      const endpoint = "https://cloud.scorm.com/lrs/TENBKY6BZ6/sandbox/statements";
      const auth = "Basic " + btoa("d_cPqAqYNvM3sMTyJ2M:rh70yfaxONPyu11z_vk");

      const r = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": auth,
          "Content-Type": "application/json",
          "X-Experience-API-Version": "1.0.3"
        },
        body: JSON.stringify(statement),
        keepalive: true
      });
      console.log(r.ok ? `✅ xAPI sent: ${verbDisplay}` : `⚠️ xAPI failed: ${r.status}`);
    } catch (e) {
      console.error("❌ sendXAPI error:", e);
    }
  };
}

}

window.Script5 = function()
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

window.Script6 = function()
{
  // Load once (Master fires on every slide)
if (!window.__XAPI_HELPER_LOADED__) {
  window.__XAPI_HELPER_LOADED__ = true;

  window.sendXAPI = async function (verbId, verbDisplay, objectId, objectName, resultData = {}) {
    try {
      const p = GetPlayer();
      if (!p) return;

      const learnerName = p.GetVar("learnerName") || localStorage.getItem("learnerName") || "Anonymous";
      const sessionId   = p.GetVar("sessionId")   || localStorage.getItem("sessionId") || String(Date.now());
      const mbox        = "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

      const statement = {
        actor: { name: learnerName, mbox: mbox },
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

      // Direct-post to your LRS (website-hosted courses)
      const endpoint = "https://cloud.scorm.com/lrs/TENBKY6BZ6/sandbox/statements";
      const auth = "Basic " + btoa("d_cPqAqYNvM3sMTyJ2M:rh70yfaxONPyu11z_vk");

      const r = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": auth,
          "Content-Type": "application/json",
          "X-Experience-API-Version": "1.0.3"
        },
        body: JSON.stringify(statement),
        keepalive: true
      });
      console.log(r.ok ? `✅ xAPI sent: ${verbDisplay}` : `⚠️ xAPI failed: ${r.status}`);
    } catch (e) {
      console.error("❌ sendXAPI error:", e);
    }
  };
}

}

window.Script7 = function()
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

window.Script8 = function()
{
  // Load once (Master fires on every slide)
if (!window.__XAPI_HELPER_LOADED__) {
  window.__XAPI_HELPER_LOADED__ = true;

  window.sendXAPI = async function (verbId, verbDisplay, objectId, objectName, resultData = {}) {
    try {
      const p = GetPlayer();
      if (!p) return;

      const learnerName = p.GetVar("learnerName") || localStorage.getItem("learnerName") || "Anonymous";
      const sessionId   = p.GetVar("sessionId")   || localStorage.getItem("sessionId") || String(Date.now());
      const mbox        = "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

      const statement = {
        actor: { name: learnerName, mbox: mbox },
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

      // Direct-post to your LRS (website-hosted courses)
      const endpoint = "https://cloud.scorm.com/lrs/TENBKY6BZ6/sandbox/statements";
      const auth = "Basic " + btoa("d_cPqAqYNvM3sMTyJ2M:rh70yfaxONPyu11z_vk");

      const r = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": auth,
          "Content-Type": "application/json",
          "X-Experience-API-Version": "1.0.3"
        },
        body: JSON.stringify(statement),
        keepalive: true
      });
      console.log(r.ok ? `✅ xAPI sent: ${verbDisplay}` : `⚠️ xAPI failed: ${r.status}`);
    } catch (e) {
      console.error("❌ sendXAPI error:", e);
    }
  };
}

}

window.Script9 = function()
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

window.Script10 = function()
{
  // Load once (Master fires on every slide)
if (!window.__XAPI_HELPER_LOADED__) {
  window.__XAPI_HELPER_LOADED__ = true;

  window.sendXAPI = async function (verbId, verbDisplay, objectId, objectName, resultData = {}) {
    try {
      const p = GetPlayer();
      if (!p) return;

      const learnerName = p.GetVar("learnerName") || localStorage.getItem("learnerName") || "Anonymous";
      const sessionId   = p.GetVar("sessionId")   || localStorage.getItem("sessionId") || String(Date.now());
      const mbox        = "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

      const statement = {
        actor: { name: learnerName, mbox: mbox },
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

      // Direct-post to your LRS (website-hosted courses)
      const endpoint = "https://cloud.scorm.com/lrs/TENBKY6BZ6/sandbox/statements";
      const auth = "Basic " + btoa("d_cPqAqYNvM3sMTyJ2M:rh70yfaxONPyu11z_vk");

      const r = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": auth,
          "Content-Type": "application/json",
          "X-Experience-API-Version": "1.0.3"
        },
        body: JSON.stringify(statement),
        keepalive: true
      });
      console.log(r.ok ? `✅ xAPI sent: ${verbDisplay}` : `⚠️ xAPI failed: ${r.status}`);
    } catch (e) {
      console.error("❌ sendXAPI error:", e);
    }
  };
}

}

window.Script11 = function()
{
  (function () {
  var p = GetPlayer();
  if (!p) return;

  // Built-in Storyline Results variables (from the Results slide)
  window.__SL_RESULTS__ = {
    scorePercent: Number(p.GetVar("Results.ScorePercent") || 0),
    scorePoints:  Number(p.GetVar("Results.ScorePoints")  || 0),
    maxPoints:    Number(p.GetVar("Results.MaxPoints")    || 0),
    passPercent:  Number(p.GetVar("Results.PassPercent")  || 0),
    passPoints:   Number(p.GetVar("Results.PassPoints")   || 0),
    passFail:     !!p.GetVar("Results.PassFail"), // true if passed
    slideCount:   Number(p.GetVar("Results.SlideCount")   || 0),
    slidesViewed: Number(p.GetVar("Results.SlidesViewed") || 0),
    viewedPercent:Number(p.GetVar("Results.SlidesViewedPercent") || 0)
  };

  // Optional: log it so you can verify
  console.log("Results.* pulled:", window.__SL_RESULTS__);
})();

}

window.Script12 = function()
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

    var testedOut = (correct === 3);
    var finalized = false;

    // --- 3b. Write dynamic values back to Storyline ---
    p.SetVar("currentComp", compId);
    p.SetVar("currentMasteryLevel", mastery);

    // --- 4. Actor + session info ---
    var name = localStorage.getItem("learnerName") || p.GetVar("actorName") || "Anonymous";
    var sid = localStorage.getItem("sessionId") || p.GetVar("sessionId") || Date.now().toString();
    var mbox = "mailto:" + encodeURIComponent(name) + "@wirelxdfirm.com";

    // --- 5. LRS connection details (declare before fetch calls) ---
    var endpoint = "https://cloud.scorm.com/lrs/TENBKY6BZ6/sandbox/";
    var key = "d_cPqAqYNvM3sMTyJ2M";
    var secret = "rh70yfaxONPyu11z_vk";

    // --- 5b. Send per-question xAPI statements (C1a-1..3 etc.) ---
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

      fetch(endpoint + "statements", {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(key + ":" + secret),
          "Content-Type": "application/json",
          "X-Experience-API-Version": "1.0.3"
        },
        body: JSON.stringify(qStmt),
        keepalive: true
      })
        .then(r => console.log(`📘 Sent question ${qid}:`, r.status))
        .catch(e => console.warn(`❌ Question ${qid} failed:`, e));
    }

    // --- 6. Build and send summary statement ---
    var verbId = correct >= 2
      ? "http://adlnet.gov/expapi/verbs/passed"
      : "http://adlnet.gov/expapi/verbs/failed";
    var verbDisplay = correct >= 2 ? "passed" : "failed";

    var stmt = {
      actor: { name: name, mbox: mbox },
      verb: { id: verbId, display: { "en-US": verbDisplay } },
      object: { id: `https://acbl.wirelxdfirm.com/activities/${compId}/quiz` },
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

    fetch(endpoint + "statements", {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(key + ":" + secret),
        "Content-Type": "application/json",
        "X-Experience-API-Version": "1.0.3"
      },
      body: JSON.stringify(stmt)
    })
      .then(r => console.log(`✅ Sent ${verbDisplay} (${mastery}) for ${compId}. Status:`, r.status))
      .catch(e => console.warn("LRS send failed:", e));

    // --- 7. Store mastery data locally ---
    var keyBase = compId + ".";
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

window.Script13 = function()
{
  (function () {
  try {
    var p = (typeof GetPlayer === "function") && GetPlayer();
    if (!p) return;

    // --- 0) Constants ---
    var DOMAIN = "https://www.wirelearningsolutions.com";
    var LRS_ENDPOINT = "https://cloud.scorm.com/lrs/TENBKY6BZ6/sandbox/statements";
    var LRS_AUTH = "Basic " + btoa("d_cPqAqYNvM3sMTyJ2M:rh70yfaxONPyu11z_vk");
    var NS = "https://acbl.wirelearningsolutions.com/extensions/";
    var EX = function (k) { return NS + k; };

    // --- 1) Detect competency ---
    var href = (window.location && window.location.href || "").toUpperCase();
    var compId = (href.match(/\/(C[123])[^/]*\//) || href.match(/(C[123])/) || ["", "C1"])[1];

    // --- 2) Identity ---
    var learnerName = p.GetVar("learnerName") || localStorage.getItem("learnerName") || "Anonymous";
    var sessionId = p.GetVar("sessionId") || localStorage.getItem("sessionId") || (self.crypto?.randomUUID?.() || String(Date.now()));
    localStorage.setItem("learnerName", learnerName);
    localStorage.setItem("sessionId", sessionId);
    var mbox = "mailto:" + encodeURIComponent(learnerName) + "@wirelearningsolutions.com";

    // --- 3) Quiz results ---
    var correct = Number(p.GetVar(compId + "_Correct") || 0);
    var missedSubs = (p.GetVar(compId + "_missedSubs") || "").split(",").map(s => s.trim()).filter(Boolean);

    var mastery = "Failing";
    if (correct === 3) mastery = "Mastery";
    else if (correct === 2) mastery = "Proficient";
    else if (correct === 1) mastery = "Emerging";

    var testedOut = (correct === 3);
    var finalized = false;

    // --- 4) Send xAPI statement to LRS ---
    var stmt = {
      actor: {
        name: learnerName,
        mbox: mbox
      },
      verb: {
        id: "http://adlnet.gov/expapi/verbs/answered",
        display: { "en-US": "answered" }
      },
      object: {
        id: DOMAIN + "/activities/" + compId + "/quiz",
        definition: {
          name: { "en-US": compId + " quiz" },
          description: { "en-US": "Competency quiz results for " + compId }
        }
      },
      result: {
        score: { raw: correct },
        success: correct >= 2,
        completion: true,
        extensions: {
          [EX("learnerName")]: learnerName,
          [EX("competencyId")]: compId,
          [EX("masteryLevel")]: mastery,
          [EX("missed")]: missedSubs,
          [EX("testedOut")]: testedOut,
          [EX("finalized")]: finalized
        }
      },
      context: {
        extensions: {
          [EX("sessionId")]: sessionId
        }
      },
      timestamp: new Date().toISOString()
    };

    fetch(LRS_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": LRS_AUTH,
        "X-Experience-API-Version": "1.0.3",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(stmt)
    }).then(r => console.log("✅ Sent xAPI:", r.status)).catch(e => console.warn("❌ LRS send failed:", e));

    // --- 5) Redirect to next.html ---
    var NEXT_URL = DOMAIN + "/next.html";
    var q = new URLSearchParams({
      learnerName: learnerName,
      sid: sessionId,
      current: compId,
      mastery: mastery,
      missed: JSON.stringify(missedSubs),
      testedOut: String(testedOut),
      finalized: String(finalized),
      score: String(correct)
    });
    var fullNext = NEXT_URL + "?" + q.toString();

    setTimeout(function () {
      try {
        if (window.top && window.top !== window && window.top.location.hostname === window.location.hostname) {
          window.top.location.href = fullNext;
        } else {
          window.location.href = fullNext;
        }
      } catch (e) {
        window.location.href = fullNext;
      }
    }, 500); // small delay to ensure xAPI POST completes

  } catch (e) {
    console.warn("Continue button error:", e);
  }
})();

}

window.Script14 = function()
{
  (function () {
  try {
    var p = (typeof GetPlayer === "function") && GetPlayer();
    if (!p) return;

    // --- 0) Constants ---
    var DOMAIN = "https://www.wirelearningsolutions.com";
    var LRS_ENDPOINT = "https://cloud.scorm.com/lrs/TENBKY6BZ6/sandbox/statements";
    var LRS_AUTH = "Basic " + btoa("d_cPqAqYNvM3sMTyJ2M:rh70yfaxONPyu11z_vk");
    var NS = "https://acbl.wirelearningsolutions.com/extensions/";
    var EX = function (k) { return NS + k; };

    // --- 1) Detect competency ---
    var href = (window.location && window.location.href || "").toUpperCase();
    var compId = (href.match(/\/(C[123])[^/]*\//) || href.match(/(C[123])/) || ["", "C1"])[1];

    // --- 2) Identity ---
    var learnerName = p.GetVar("learnerName") || localStorage.getItem("learnerName") || "Anonymous";
    var sessionId = p.GetVar("sessionId") || localStorage.getItem("sessionId") || (self.crypto?.randomUUID?.() || String(Date.now()));
    localStorage.setItem("learnerName", learnerName);
    localStorage.setItem("sessionId", sessionId);
    var mbox = "mailto:" + encodeURIComponent(learnerName) + "@wirelearningsolutions.com";

    // --- 3) Quiz results ---
    var correct = Number(p.GetVar(compId + "_Correct") || 0);
    var missedSubs = (p.GetVar(compId + "_missedSubs") || "").split(",").map(s => s.trim()).filter(Boolean);

    var mastery = "Failing";
    if (correct === 3) mastery = "Mastery";
    else if (correct === 2) mastery = "Proficient";
    else if (correct === 1) mastery = "Emerging";

    var testedOut = (correct === 3);
    var finalized = false;

    // --- 4) Send xAPI statement to LRS ---
    var stmt = {
      actor: {
        name: learnerName,
        mbox: mbox
      },
      verb: {
        id: "http://adlnet.gov/expapi/verbs/answered",
        display: { "en-US": "answered" }
      },
      object: {
        id: DOMAIN + "/activities/" + compId + "/quiz",
        definition: {
          name: { "en-US": compId + " quiz" },
          description: { "en-US": "Competency quiz results for " + compId }
        }
      },
      result: {
        score: { raw: correct },
        success: correct >= 2,
        completion: true,
        extensions: {
          [EX("learnerName")]: learnerName,
          [EX("competencyId")]: compId,
          [EX("masteryLevel")]: mastery,
          [EX("missed")]: missedSubs,
          [EX("testedOut")]: testedOut,
          [EX("finalized")]: finalized
        }
      },
      context: {
        extensions: {
          [EX("sessionId")]: sessionId
        }
      },
      timestamp: new Date().toISOString()
    };

    fetch(LRS_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": LRS_AUTH,
        "X-Experience-API-Version": "1.0.3",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(stmt)
    }).then(r => console.log("✅ Sent xAPI:", r.status)).catch(e => console.warn("❌ LRS send failed:", e));

    // --- 5) Redirect to next.html ---
    var NEXT_URL = DOMAIN + "/next.html";
    var q = new URLSearchParams({
      learnerName: learnerName,
      sid: sessionId,
      current: compId,
      mastery: mastery,
      missed: JSON.stringify(missedSubs),
      testedOut: String(testedOut),
      finalized: String(finalized),
      score: String(correct)
    });
    var fullNext = NEXT_URL + "?" + q.toString();

    setTimeout(function () {
      try {
        if (window.top && window.top !== window && window.top.location.hostname === window.location.hostname) {
          window.top.location.href = fullNext;
        } else {
          window.location.href = fullNext;
        }
      } catch (e) {
        window.location.href = fullNext;
      }
    }, 500); // small delay to ensure xAPI POST completes

  } catch (e) {
    console.warn("Continue button error:", e);
  }
})();

}

};
