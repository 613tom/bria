/* ==========================================================================
   BRIA Academy — team grid
   URL parameters:
     ?tags=level-2            show only people carrying that tag
     ?tags=fertility,level-1  show anyone carrying either tag
     ?heading=Your%20teachers override the H1 (omit or blank to hide)
     ?intro=Some%20text       intro line under the H1
     ?filters=1               force the tag filter chips on
   ========================================================================== */

(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var requested = (params.get("tags") || "")
    .split(",")
    .map(function (t) { return t.trim().toLowerCase(); })
    .filter(Boolean);

  var root = document.getElementById("team-root");
  var openId = null;
  var data = null;
  var activeFilter = "all";

  fetch("team.json", { cache: "no-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (json) {
      data = json;
      render();
    })
    .catch(function () {
      root.innerHTML =
        '<div class="notice">The team list could not be loaded. Reload the page, ' +
        "or check that team.json sits next to index.html in the repo.</div>";
      postHeight();
    });

  /* ---------------------------------------------------------------- helpers */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function initials(name) {
    return name
      .replace(/^Dr\.?\s+/i, "")
      .split(/\s+/)
      .slice(0, 2)
      .map(function (w) { return w.charAt(0); })
      .join("");
  }

  function inScope(person) {
    if (!requested.length) return true;
    return (person.tags || []).some(function (t) {
      return requested.indexOf(String(t).toLowerCase()) !== -1;
    });
  }

  function visible() {
    var list = (data.people || []).filter(inScope);
    if (activeFilter !== "all") {
      list = list.filter(function (p) {
        return (p.tags || []).indexOf(activeFilter) !== -1;
      });
    }
    return list;
  }

  /* ----------------------------------------------------------------- render */

  function render() {
    var html = "";
    var heading = params.get("heading");
    var intro = params.get("intro");

    if (heading || intro) {
      html += '<div class="head">';
      if (heading) html += "<h1>" + esc(heading) + "</h1>";
      if (intro) html += "<p>" + esc(intro) + "</p>";
      html += "</div>";
    }

    // Filter chips: shown when the embed is not already scoped to one tag
    var showFilters = params.get("filters") === "1" || requested.length !== 1;
    if (showFilters) {
      var tags = (data.tagOrder || Object.keys(data.tagLabels || {})).filter(function (t) {
        return (data.people || []).some(function (p) {
          return inScope(p) && (p.tags || []).indexOf(t) !== -1;
        });
      });
      if (tags.length > 1) {
        html += '<div class="filters">';
        html += chip("all", "Everyone");
        tags.forEach(function (t) {
          html += chip(t, (data.tagLabels || {})[t] || t);
        });
        html += "</div>";
      }
    }

    html += '<div class="grid">';
    var people = visible();
    if (!people.length) {
      html += '<div class="notice">No team members to show yet.</div>';
    }
    people.forEach(function (p) {
      html += cardHtml(p) + panelHtml(p);
    });
    html += "</div>";

    root.innerHTML = html;
    bind();
    postHeight();
  }

  function chip(value, label) {
    return (
      '<button class="filter" type="button" data-filter="' + esc(value) + '"' +
      ' aria-pressed="' + (activeFilter === value) + '">' + esc(label) + "</button>"
    );
  }

  function cardHtml(p) {
    var shot = p.image
      ? '<img class="shot" src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">'
      : '<div class="shot shot--empty" aria-hidden="true">' + esc(initials(p.name)) + "</div>";

    return (
      '<button class="card' + (openId === p.id ? " is-open" : "") + '" type="button"' +
      ' data-id="' + esc(p.id) + '" aria-expanded="' + (openId === p.id) + '"' +
      ' aria-controls="panel-' + esc(p.id) + '">' +
      shot +
      '<div class="meta"><div class="name">' + esc(p.name) + "</div>" +
      '<p class="creds">' + esc(p.credentials || "") + "</p></div>" +
      '<div class="more"><span class="label">' +
      (openId === p.id ? "Hide bio" : "Read bio") +
      '</span><svg class="chev" width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true">' +
      '<path d="M1 1.5 6 6.5l5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></div>' +
      "</button>"
    );
  }

  function panelHtml(p) {
    var bio = Array.isArray(p.bio) ? p.bio : [p.bio || ""];
    var links = [];
    if (p.links && p.links.linkedin) {
      links.push('<a href="' + esc(p.links.linkedin) + '" target="_blank" rel="noopener">LinkedIn</a>');
    }
    if (p.links && p.links.email) {
      links.push('<a href="mailto:' + esc(p.links.email) + '">Email</a>');
    }

    return (
      '<div class="panel' + (openId === p.id ? " is-open" : "") + '" id="panel-' + esc(p.id) +
      '" role="region" aria-label="About ' + esc(p.name) + '">' +
      "<h2>" + esc(p.name) + "</h2>" +
      '<p class="creds">' + esc(p.credentials || "") + "</p>" +
      '<div class="bio">' +
      bio.map(function (para) { return "<p>" + esc(para) + "</p>"; }).join("") +
      "</div>" +
      (links.length ? '<div class="links">' + links.join("") + "</div>" : "") +
      '<button class="close" type="button" data-close="1">Close</button>' +
      "</div>"
    );
  }

  /* ------------------------------------------------------------------ events */

  function bind() {
    root.querySelectorAll(".card").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-id");
        openId = openId === id ? null : id;
        render();
        if (openId) {
          var card = root.querySelector('.card[data-id="' + openId + '"]');
          if (card) card.focus({ preventScroll: true });
        }
      });
    });

    root.querySelectorAll("[data-close]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openId = null;
        render();
      });
    });

    root.querySelectorAll(".filter").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activeFilter = btn.getAttribute("data-filter");
        openId = null;
        render();
      });
    });

    root.querySelectorAll("img.shot").forEach(function (img) {
      img.addEventListener("load", postHeight);
      img.addEventListener("error", function () {
        img.style.display = "none";
        postHeight();
      });
    });
  }

  /* ------------------------------------------- tell the parent page our height */

  function postHeight() {
    var h = document.documentElement.scrollHeight;
    try {
      window.parent.postMessage({ briaTeamHeight: h }, "*");
    } catch (e) {}
  }

  window.addEventListener("resize", postHeight);
  if (window.ResizeObserver) {
    new ResizeObserver(postHeight).observe(document.documentElement);
  }
})();
