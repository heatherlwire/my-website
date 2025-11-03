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
  // ===============================
// Step 2: xAPI Send Helper
// (follows Step 1: Actor Initialization)
// ===============================
window.sendXAPI = function (verbId, verbDisplay, objectId, objectName, resultData = {}) {
  try {
    var player = GetPlayer();
    if (!player) return;

    // --- Pull the learner name from Storyline (set in Step 1) ---
    var learnerName = player.GetVar("learnerName") || "Anonymous";

    // --- Try to use actor from cmi5/xAPI launch context if present ---
    var actor = window.cmi5?.actor || window.CMI5?.actor || window.ADL?.XAPIWrapper?.actor;

    // --- If no launch-supplied actor, build one using learnerName ---
    if (!actor) {
      actor = {
        name: learnerName,
        mbox: "mailto:" + learnerName.replace(/\s+/g, "").toLowerCase() + "@demo.com"
      };
    } else {
      // Ensure the actor name reflects learnerName for clarity in the LRS
      actor.name = learnerName;
    }

    // --- Construct statement ---
    var statement = {
      actor: actor,
      verb: {
        id: verbId,
        display: { "en-US": verbDisplay }
      },
      object: {
        id: objectId,
        definition: { name: { "en-US": objectName } },
        objectType: "Activity"
      },
      result: resultData
    };

    // --- Send it ---
    ADL.XAPIWrapper.sendStatement(statement);
    console.log("xAPI sent for:", learnerName, "| verb:", verbDisplay);
  } catch (e) {
    console.error("Failed to send xAPI:", e);
  }
};

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
  // ===============================
// Step 2: xAPI Send Helper
// (follows Step 1: Actor Initialization)
// ===============================
window.sendXAPI = function (verbId, verbDisplay, objectId, objectName, resultData = {}) {
  try {
    var player = GetPlayer();
    if (!player) return;

    // --- Pull the learner name from Storyline (set in Step 1) ---
    var learnerName = player.GetVar("learnerName") || "Anonymous";

    // --- Try to use actor from cmi5/xAPI launch context if present ---
    var actor = window.cmi5?.actor || window.CMI5?.actor || window.ADL?.XAPIWrapper?.actor;

    // --- If no launch-supplied actor, build one using learnerName ---
    if (!actor) {
      actor = {
        name: learnerName,
        mbox: "mailto:" + learnerName.replace(/\s+/g, "").toLowerCase() + "@demo.com"
      };
    } else {
      // Ensure the actor name reflects learnerName for clarity in the LRS
      actor.name = learnerName;
    }

    // --- Construct statement ---
    var statement = {
      actor: actor,
      verb: {
        id: verbId,
        display: { "en-US": verbDisplay }
      },
      object: {
        id: objectId,
        definition: { name: { "en-US": objectName } },
        objectType: "Activity"
      },
      result: resultData
    };

    // --- Send it ---
    ADL.XAPIWrapper.sendStatement(statement);
    console.log("xAPI sent for:", learnerName, "| verb:", verbDisplay);
  } catch (e) {
    console.error("Failed to send xAPI:", e);
  }
};

}

window.Script4 = function()
{
  // ===============================
// Step 2: xAPI Send Helper
// (follows Step 1: Actor Initialization)
// ===============================
window.sendXAPI = function (verbId, verbDisplay, objectId, objectName, resultData = {}) {
  try {
    var player = GetPlayer();
    if (!player) return;

    // --- Pull the learner name from Storyline (set in Step 1) ---
    var learnerName = player.GetVar("learnerName") || "Anonymous";

    // --- Try to use actor from cmi5/xAPI launch context if present ---
    var actor = window.cmi5?.actor || window.CMI5?.actor || window.ADL?.XAPIWrapper?.actor;

    // --- If no launch-supplied actor, build one using learnerName ---
    if (!actor) {
      actor = {
        name: learnerName,
        mbox: "mailto:" + learnerName.replace(/\s+/g, "").toLowerCase() + "@demo.com"
      };
    } else {
      // Ensure the actor name reflects learnerName for clarity in the LRS
      actor.name = learnerName;
    }

    // --- Construct statement ---
    var statement = {
      actor: actor,
      verb: {
        id: verbId,
        display: { "en-US": verbDisplay }
      },
      object: {
        id: objectId,
        definition: { name: { "en-US": objectName } },
        objectType: "Activity"
      },
      result: resultData
    };

    // --- Send it ---
    ADL.XAPIWrapper.sendStatement(statement);
    console.log("xAPI sent for:", learnerName, "| verb:", verbDisplay);
  } catch (e) {
    console.error("Failed to send xAPI:", e);
  }
};

}

window.Script5 = function()
{
  // ===============================
// Step 2: xAPI Send Helper
// (follows Step 1: Actor Initialization)
// ===============================
window.sendXAPI = function (verbId, verbDisplay, objectId, objectName, resultData = {}) {
  try {
    var player = GetPlayer();
    if (!player) return;

    // --- Pull the learner name from Storyline (set in Step 1) ---
    var learnerName = player.GetVar("learnerName") || "Anonymous";

    // --- Try to use actor from cmi5/xAPI launch context if present ---
    var actor = window.cmi5?.actor || window.CMI5?.actor || window.ADL?.XAPIWrapper?.actor;

    // --- If no launch-supplied actor, build one using learnerName ---
    if (!actor) {
      actor = {
        name: learnerName,
        mbox: "mailto:" + learnerName.replace(/\s+/g, "").toLowerCase() + "@demo.com"
      };
    } else {
      // Ensure the actor name reflects learnerName for clarity in the LRS
      actor.name = learnerName;
    }

    // --- Construct statement ---
    var statement = {
      actor: actor,
      verb: {
        id: verbId,
        display: { "en-US": verbDisplay }
      },
      object: {
        id: objectId,
        definition: { name: { "en-US": objectName } },
        objectType: "Activity"
      },
      result: resultData
    };

    // --- Send it ---
    ADL.XAPIWrapper.sendStatement(statement);
    console.log("xAPI sent for:", learnerName, "| verb:", verbDisplay);
  } catch (e) {
    console.error("Failed to send xAPI:", e);
  }
};

}

window.Script6 = function()
{
  // ===============================
// Step 2: xAPI Send Helper
// (follows Step 1: Actor Initialization)
// ===============================
window.sendXAPI = function (verbId, verbDisplay, objectId, objectName, resultData = {}) {
  try {
    var player = GetPlayer();
    if (!player) return;

    // --- Pull the learner name from Storyline (set in Step 1) ---
    var learnerName = player.GetVar("learnerName") || "Anonymous";

    // --- Try to use actor from cmi5/xAPI launch context if present ---
    var actor = window.cmi5?.actor || window.CMI5?.actor || window.ADL?.XAPIWrapper?.actor;

    // --- If no launch-supplied actor, build one using learnerName ---
    if (!actor) {
      actor = {
        name: learnerName,
        mbox: "mailto:" + learnerName.replace(/\s+/g, "").toLowerCase() + "@demo.com"
      };
    } else {
      // Ensure the actor name reflects learnerName for clarity in the LRS
      actor.name = learnerName;
    }

    // --- Construct statement ---
    var statement = {
      actor: actor,
      verb: {
        id: verbId,
        display: { "en-US": verbDisplay }
      },
      object: {
        id: objectId,
        definition: { name: { "en-US": objectName } },
        objectType: "Activity"
      },
      result: resultData
    };

    // --- Send it ---
    ADL.XAPIWrapper.sendStatement(statement);
    console.log("xAPI sent for:", learnerName, "| verb:", verbDisplay);
  } catch (e) {
    console.error("Failed to send xAPI:", e);
  }
};

}

window.Script7 = function()
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
    var finalized = false; // Off-ramp not used yet

    // --- 3b. Write dynamic values back to Storyline for internal use ---
    p.SetVar("currentComp", compId);
    p.SetVar("currentMasteryLevel", mastery);

    // --- 4. Actor + session info ---
    var name =
      localStorage.getItem("learnerName") ||
      p.GetVar("actorName") ||
      "Anonymous";
    var sid =
      localStorage.getItem("sessionId") ||
      p.GetVar("sessionId") ||
      Date.now().toString();
    var mbox = "mailto:" + encodeURIComponent(name) + "@wirelxdfirm.com";

    // --- 5. Build the xAPI statement ---
    var verbId =
      correct >= 2
        ? "http://adlnet.gov/expapi/verbs/passed"
        : "http://adlnet.gov/expapi/verbs/failed";
    var verbDisplay = correct >= 2 ? "passed" : "failed";

    var stmt = {
      actor: { name: name, mbox: mbox },
      verb: { id: verbId, display: { "en-US": verbDisplay } },
      object: {
        id: "https://acbl.wirelxdfirm.com/activities/" + compId + "/quiz",
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
          "https://acbl.wirelxdfirm.com/extensions/finalized": finalized,
        },
      },
      timestamp: new Date().toISOString(),
    };

    // --- 6. Send to SCORM Cloud sandbox LRS ---
    var endpoint = "https://cloud.scorm.com/lrs/TENBKY6BZ6/sandbox/";
    var key = "d_cPqAqYNvM3sMTyJ2M";
    var secret = "rh70yfaxONPyu11z_vk";

    fetch(endpoint + "statements", {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(key + ":" + secret),
        "Content-Type": "application/json",
        "X-Experience-API-Version": "1.0.3",
      },
      body: JSON.stringify(stmt),
    })
      .then((r) =>
        console.log(`✅ Sent ${verbDisplay} (${mastery}) for ${compId}. Status:`, r.status)
      )
      .catch((e) => console.warn("LRS send failed:", e));

    // --- 7. Store mastery data locally for instant dashboard updates ---
    var keyBase = compId + ".";
    localStorage.setItem(keyBase + "mastery", mastery);
    localStorage.setItem(keyBase + "finalized", finalized);
    localStorage.setItem(keyBase + "testedOut", testedOut);
    localStorage.setItem(keyBase + "score", correct.toString());
    localStorage.setItem(keyBase + "missed", JSON.stringify(missedSubs));
    localStorage.setItem("currentCompetency", compId);
    localStorage.setItem("currentMasteryLevel", mastery);

    console.log("💾 Stored locally:", {
      compId,
      mastery,
      testedOut,
      finalized,
      missedSubs,
    });
  } catch (e) {
    console.warn("xAPI quiz send failed:", e);
  }
})();

}

window.Script8 = function()
{
  (function () {
  try {
    var p = GetPlayer();
    if (!p) return;

    // --- Detect competency dynamically ---
    var url = window.location.href.toUpperCase();
    var competencyMatch = url.match(/C[123]/);
    var compId = competencyMatch ? competencyMatch[0] : "C1";

    // --- Gather Storyline data ---
    var correct = Number(p.GetVar(compId + "_Correct") || 0);
    var missedSubs = (p.GetVar(compId + "_missedSubs") || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    // --- Determine mastery level ---
    var mastery = "Failing";
    if (correct === 3) mastery = "Mastery";
    else if (correct === 2) mastery = "Proficient";
    else if (correct === 1) mastery = "Emerging";

    var testedOut = (correct === 3);
    var finalized = false; // Off-ramp not used yet

    // --- Actor + session info ---
    var learnerName = p.GetVar("learnerName") || localStorage.getItem("learnerName") || "Anonymous";
    var sessionId = p.GetVar("sessionId") || localStorage.getItem("sessionId") || (Date.now().toString());
    var mbox = "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

    // --- Build and send xAPI statement ---
    var verbId = (correct >= 2)
      ? "http://adlnet.gov/expapi/verbs/passed"
      : "http://adlnet.gov/expapi/verbs/failed";
    var verbDisplay = (correct >= 2) ? "passed" : "failed";

    var stmt = {
      actor: { name: learnerName, mbox: mbox },
      verb: { id: verbId, display: { "en-US": verbDisplay } },
      object: { id: "https://acbl.wirelxdfirm.com/activities/" + compId + "/quiz" },
      result: {
        score: { raw: correct, min: 0, max: 3 },
        success: (correct >= 2),
        completion: true,
        extensions: {
          "https://acbl.wirelxdfirm.com/extensions/learnerName": learnerName,
          "https://acbl.wirelxdfirm.com/extensions/sessionId": sessionId,
          "https://acbl.wirelxdfirm.com/extensions/competencyId": compId,
          "https://acbl.wirelxdfirm.com/extensions/masteryLevel": mastery,
          "https://acbl.wirelxdfirm.com/extensions/missed": missedSubs,
          "https://acbl.wirelxdfirm.com/extensions/testedOut": testedOut,
          "https://acbl.wirelxdfirm.com/extensions/finalized": finalized
        }
      },
      timestamp: new Date().toISOString()
    };

    // --- Send to your conference LRS ---
    var endpoint = "https://cloud.scorm.com/lrs/TENBKY6BZ6/sandbox/";
    var key = "d_cPqAqYNvM3sMTyJ2M";
    var secret = "rh70yfaxONPyu11z_vk";

    fetch(endpoint + "statements", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(key + ":" + secret),
        "Content-Type": "application/json",
        "X-Experience-API-Version": "1.0.3"
      },
      body: JSON.stringify(stmt)
    }).then(r => console.log(`✅ Sent ${verbDisplay} (${mastery}) for ${compId}. Status:`, r.status))
      .catch(e => console.warn("LRS send failed:", e));

    // --- Store locally for next page dashboard ---
    var keyBase = compId + ".";
    localStorage.setItem(keyBase + "mastery", mastery);
    localStorage.setItem(keyBase + "finalized", finalized);
    localStorage.setItem(keyBase + "testedOut", testedOut);
    localStorage.setItem(keyBase + "score", correct.toString());
    localStorage.setItem(keyBase + "missed", JSON.stringify(missedSubs));

    // --- Redirect to next page (pass all key data) ---
    var base = "https://yourhost/next.html";
    var qs = new URLSearchParams({
      learnerName: learnerName,
      sid: sessionId,
      current: compId,
      mastery: mastery,
      missed: JSON.stringify(missedSubs),
      testedOut: testedOut,
      finalized: finalized,
      score: correct
    });
    window.location.href = base + "?" + qs.toString();

  } catch (e) {
    console.warn("xAPI quiz send failed:", e);
  }
})();

}

window.Script9 = function()
{
  (function () {
  try {
    var p = GetPlayer();
    if (!p) return;

    // --- Detect competency dynamically ---
    var url = window.location.href.toUpperCase();
    var competencyMatch = url.match(/C[123]/);
    var compId = competencyMatch ? competencyMatch[0] : "C1";

    // --- Gather Storyline data ---
    var correct = Number(p.GetVar(compId + "_Correct") || 0);
    var missedSubs = (p.GetVar(compId + "_missedSubs") || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    // --- Determine mastery level ---
    var mastery = "Failing";
    if (correct === 3) mastery = "Mastery";
    else if (correct === 2) mastery = "Proficient";
    else if (correct === 1) mastery = "Emerging";

    var testedOut = (correct === 3);
    var finalized = false; // Off-ramp not used yet

    // --- Actor + session info ---
    var learnerName = p.GetVar("learnerName") || localStorage.getItem("learnerName") || "Anonymous";
    var sessionId = p.GetVar("sessionId") || localStorage.getItem("sessionId") || (Date.now().toString());
    var mbox = "mailto:" + encodeURIComponent(learnerName) + "@wirelxdfirm.com";

    // --- Build and send xAPI statement ---
    var verbId = (correct >= 2)
      ? "http://adlnet.gov/expapi/verbs/passed"
      : "http://adlnet.gov/expapi/verbs/failed";
    var verbDisplay = (correct >= 2) ? "passed" : "failed";

    var stmt = {
      actor: { name: learnerName, mbox: mbox },
      verb: { id: verbId, display: { "en-US": verbDisplay } },
      object: { id: "https://acbl.wirelxdfirm.com/activities/" + compId + "/quiz" },
      result: {
        score: { raw: correct, min: 0, max: 3 },
        success: (correct >= 2),
        completion: true,
        extensions: {
          "https://acbl.wirelxdfirm.com/extensions/learnerName": learnerName,
          "https://acbl.wirelxdfirm.com/extensions/sessionId": sessionId,
          "https://acbl.wirelxdfirm.com/extensions/competencyId": compId,
          "https://acbl.wirelxdfirm.com/extensions/masteryLevel": mastery,
          "https://acbl.wirelxdfirm.com/extensions/missed": missedSubs,
          "https://acbl.wirelxdfirm.com/extensions/testedOut": testedOut,
          "https://acbl.wirelxdfirm.com/extensions/finalized": finalized
        }
      },
      timestamp: new Date().toISOString()
    };

    // --- Send to your conference LRS ---
    var endpoint = "https://cloud.scorm.com/lrs/TENBKY6BZ6/sandbox/";
    var key = "d_cPqAqYNvM3sMTyJ2M";
    var secret = "rh70yfaxONPyu11z_vk";

    fetch(endpoint + "statements", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(key + ":" + secret),
        "Content-Type": "application/json",
        "X-Experience-API-Version": "1.0.3"
      },
      body: JSON.stringify(stmt)
    }).then(r => console.log(`✅ Sent ${verbDisplay} (${mastery}) for ${compId}. Status:`, r.status))
      .catch(e => console.warn("LRS send failed:", e));

    // --- Store locally for next page dashboard ---
    var keyBase = compId + ".";
    localStorage.setItem(keyBase + "mastery", mastery);
    localStorage.setItem(keyBase + "finalized", finalized);
    localStorage.setItem(keyBase + "testedOut", testedOut);
    localStorage.setItem(keyBase + "score", correct.toString());
    localStorage.setItem(keyBase + "missed", JSON.stringify(missedSubs));

    // --- Redirect to next page (pass all key data) ---
    var base = "https://yourhost/next.html";
    var qs = new URLSearchParams({
      learnerName: learnerName,
      sid: sessionId,
      current: compId,
      mastery: mastery,
      missed: JSON.stringify(missedSubs),
      testedOut: testedOut,
      finalized: finalized,
      score: correct
    });
    window.location.href = base + "?" + qs.toString();

  } catch (e) {
    console.warn("xAPI quiz send failed:", e);
  }
})();

}

};
