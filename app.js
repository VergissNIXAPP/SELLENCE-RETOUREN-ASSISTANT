(function () {
  var LIMIT = 500.0;
  var CATS = ["ZIGARETTEN", "FEINSCHNITT", "CONSUMABLES"];

  function $(id) { return document.getElementById(id); }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  var state = {
    creditRate: 0.90,
    activeCat: "ZIGARETTEN",
    packages: [],
    current: null,
    recognition: null,
    listening: false
  };

  function euro(n) {
    return (Math.round(n * 100) / 100).toFixed(2).replace(".", ",") + " €";
  }

  function blankPackage(index) {
    return {
      index: index,
      createdAt: new Date().toISOString(),
      items: { ZIGARETTEN: {}, FEINSCHNITT: {}, CONSUMABLES: {} },
      history: [],
      closed: false
    };
  }

  function save() {
    try {
      localStorage.setItem("sellence_retouren_assistant_v1", JSON.stringify({
        creditRate: state.creditRate,
        activeCat: state.activeCat,
        packages: state.packages
      }));
    } catch (e) {}
  }

  function load() {
    try {
      var raw = localStorage.getItem("sellence_retouren_assistant_v1");
      if (!raw) return false;
      var p = JSON.parse(raw);
      if (!p || !p.packages || !p.packages.length) return false;

      state.creditRate = (p.creditRate === 0.55) ? 0.55 : 0.90;
      state.activeCat = (CATS.indexOf(p.activeCat) >= 0) ? p.activeCat : "ZIGARETTEN";
      state.packages = p.packages;

      // find last open package
      var i;
      for (i = state.packages.length - 1; i >= 0; i--) {
        if (state.packages[i] && !state.packages[i].closed) {
          state.current = state.packages[i];
          break;
        }
      }
      if (!state.current) {
        var next = nextIndex();
        state.current = blankPackage(next);
        state.packages.push(state.current);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function nextIndex() {
    var max = 0;
    var i;
    for (i = 0; i < state.packages.length; i++) {
      var idx = state.packages[i] && state.packages[i].index ? state.packages[i].index : 0;
      if (idx > max) max = idx;
    }
    return max + 1;
  }

  function totalsForPackage(pkg) {
    var sums = { ZIGARETTEN: 0, FEINSCHNITT: 0, CONSUMABLES: 0 };
    var c, k;
    for (c = 0; c < CATS.length; c++) {
      var cat = CATS[c];
      var map = (pkg.items && pkg.items[cat]) ? pkg.items[cat] : {};
      for (k in map) {
        if (Object.prototype.hasOwnProperty.call(map, k)) {
          var price = parseFloat(k);
          var count = map[k] || 0;
          sums[cat] += price * count;
        }
      }
    }
    var total = sums.ZIGARETTEN + sums.FEINSCHNITT + sums.CONSUMABLES;
    return {
      ZIGARETTEN: sums.ZIGARETTEN,
      FEINSCHNITT: sums.FEINSCHNITT,
      CONSUMABLES: sums.CONSUMABLES,
      total: total,
      credit: total * state.creditRate
    };
  }

  function currentTotals() {
    return totalsForPackage(state.current);
  }

  function toast(msg, kind) {
    kind = kind || "ok";
    var el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.style.color = (kind === "warn") ? "rgba(255,204,102,.95)" :
                     (kind === "danger") ? "rgba(255,107,107,.95)" :
                     "rgba(102,247,193,.95)";
    if (toast._t) clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.textContent = ""; }, 1600);
  }

  function renderGroups() {
    var pkg = state.current;
    var list = $("groupList");
    if (!list) return;
    list.innerHTML = "";
    var map = (pkg.items && pkg.items[state.activeCat]) ? pkg.items[state.activeCat] : {};
    var keys = [];
    var k;
    for (k in map) {
      if (Object.prototype.hasOwnProperty.call(map, k)) keys.push(k);
    }
    keys.sort(function (a, b) { return parseFloat(a) - parseFloat(b); });

    if (keys.length === 0) {
      var empty = document.createElement("div");
      empty.className = "muted";
      empty.style.textAlign = "center";
      empty.style.padding = "10px 0";
      empty.textContent = "Noch keine Einträge in dieser Kategorie.";
      list.appendChild(empty);
      return;
    }

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var price = parseFloat(key);
      var count = map[key];

      var row = document.createElement("div");
      row.className = "groupRow";

      var left = document.createElement("div");
      left.className = "groupMeta";

      var badge = document.createElement("div");
      badge.className = "badge";
      badge.textContent = euro(price);

      var info = document.createElement("div");
      info.innerHTML = '<div style="font-weight:950;">x ' + count + '</div>' +
                       '<div class="muted tiny">Zwischensumme: ' + euro(price * count) + '</div>';

      left.appendChild(badge);
      left.appendChild(info);

      var btns = document.createElement("div");
      btns.className = "groupBtns";

      (function (p) {
        var plus = document.createElement("button");
        plus.className = "smallBtn";
        plus.type = "button";
        plus.textContent = "+1";
        plus.onclick = function () { addPrice(p, state.activeCat, true); };

        var minus = document.createElement("button");
        minus.className = "smallBtn";
        minus.type = "button";
        minus.textContent = "−1";
        minus.onclick = function () { removeOne(p, state.activeCat); };

        btns.appendChild(plus);
        btns.appendChild(minus);
      })(price);

      row.appendChild(left);
      row.appendChild(btns);
      list.appendChild(row);
    }
  }

  function renderPackages() {
    var wrap = $("pkgList");
    if (!wrap) return;
    wrap.innerHTML = "";

    // copy and sort by index (simple insertion sort)
    var pkgs = state.packages.slice(0);
    pkgs.sort(function (a, b) { return (a.index || 0) - (b.index || 0); });

    for (var i = 0; i < pkgs.length; i++) {
      var pkg = pkgs[i];
      if (!pkg) continue;
      var t = totalsForPackage(pkg);

      var el = document.createElement("div");
      el.className = "pkgItem";

      var head = document.createElement("div");
      head.className = "pkgHead";

      var title = document.createElement("div");
      title.className = "pkgTitle";
      title.textContent = "Paket " + pkg.index + (pkg.closed ? " · abgeschlossen" : " · aktiv");

      var right = document.createElement("div");
      right.className = "muted";
      right.textContent = "KVP: " + euro(t.total) + " · Gutschrift: " + euro(t.credit);

      head.appendChild(title);
      head.appendChild(right);

      var grid = document.createElement("div");
      grid.className = "pkgGrid";

      var cells = [
        ["KVP ZIGARETTEN", euro(t.ZIGARETTEN)],
        ["KVP FEINSCHNITT", euro(t.FEINSCHNITT)],
        ["KVP CONSUMABLES", euro(t.CONSUMABLES)],
        ["KVP GESAMT", euro(t.total)],
        ["Gutschrift (" + Math.round(state.creditRate * 100) + "%)", euro(t.credit)]
      ];

      for (var j = 0; j < cells.length; j++) {
        var c = document.createElement("div");
        c.innerHTML = '<div class="k">' + cells[j][0] + '</div><div class="v">' + cells[j][1] + '</div>';
        grid.appendChild(c);
      }

      el.appendChild(head);
      el.appendChild(grid);
      wrap.appendChild(el);
    }
  }

  function updateUI() {
    $("credit90").classList.toggle("active", state.creditRate === 0.90);
    $("credit55").classList.toggle("active", state.creditRate === 0.55);

    var catBtns = document.querySelectorAll(".pill.cat");
    for (var i = 0; i < catBtns.length; i++) {
      var b = catBtns[i];
      b.classList.toggle("active", b.getAttribute("data-cat") === state.activeCat);
    }

    $("activeCatLabel").textContent = state.activeCat;
    $("pkgIndex").textContent = String(state.current.index);

    var t = currentTotals();
    $("sumZ").textContent = euro(t.ZIGARETTEN);
    $("sumF").textContent = euro(t.FEINSCHNITT);
    $("sumC").textContent = euro(t.CONSUMABLES);
    $("sumAll").textContent = euro(t.total);
    $("sumCredit").textContent = euro(t.credit);
    $("pkgTotal").textContent = euro(t.total);

    var pct = Math.min(100, Math.round((t.total / LIMIT) * 100));
    $("pct").textContent = String(pct);
    $("bar").style.width = pct + "%";

    renderGroups();
    renderPackages();
    save();
  }

  function ensureCurrent() {
    if (!state.current) {
      state.current = blankPackage(1);
      state.packages.push(state.current);
    }
  }

  function addPrice(price, cat, silent) {
    silent = !!silent;
    ensureCurrent();
    var pkg = state.current;
    if (pkg.closed) {
      toast("Aktuelles Paket ist abgeschlossen. Starte ein neues Paket.", "warn");
      return;
    }

    var p = parseFloat(price);
    if (isNaN(p)) {
      toast("Preis nicht erkannt.", "warn");
      return;
    }

    // keep exact spoken price up to 2 decimals (no rounding)
    var key = (Math.round(p * 100) / 100).toFixed(2);

    if (!pkg.items[cat]) pkg.items[cat] = {};
    pkg.items[cat][key] = (pkg.items[cat][key] || 0) + 1;
    pkg.history.push({ cat: cat, key: key, ts: Date.now() });

    if (!silent) toast("Erkannt & hinzugefügt: " + euro(parseFloat(key)) + " · " + cat);
    updateUI();

    var total = currentTotals().total;
    if (total >= LIMIT) {
      stopListening();
      openLimitModal(total);
    }
  }

  function removeOne(price, cat) {
    var pkg = state.current;
    if (!pkg || pkg.closed) return;

    var key = (Math.round(parseFloat(price) * 100) / 100).toFixed(2);
    var map = pkg.items[cat] || {};
    if (!map[key]) return;

    map[key] -= 1;
    if (map[key] <= 0) delete map[key];

    for (var i = pkg.history.length - 1; i >= 0; i--) {
      if (pkg.history[i].cat === cat && pkg.history[i].key === key) {
        pkg.history.splice(i, 1);
        break;
      }
    }
    toast("Entfernt: " + euro(parseFloat(key)) + " · " + cat, "warn");
    updateUI();
  }

  function undo() {
    var pkg = state.current;
    if (!pkg || pkg.closed) return;

    var last = pkg.history.pop();
    if (!last) {
      toast("Nichts zum Rückgängig machen.", "warn");
      return;
    }
    var map = pkg.items[last.cat] || {};
    if (map[last.key]) {
      map[last.key] -= 1;
      if (map[last.key] <= 0) delete map[last.key];
    }
    toast("Undo: " + euro(parseFloat(last.key)) + " · " + last.cat, "warn");
    updateUI();
  }

  function closeCurrentPackage() {
    if (state.current) state.current.closed = true;
    updateUI();
  }

  function startNewPackage() {
    closeCurrentPackage();
    var pkg = blankPackage(nextIndex());
    state.current = pkg;
    state.packages.push(pkg);
    $("manualPrice").value = "";
    updateUI();
  }

  function openLimitModal(total) {
    $("modalTitle").textContent = "500 € erreicht";
    $("modalText").textContent = "KVP im Paket: " + euro(total) + ". Bitte nächstes Paket anfangen oder Retoure beenden.";
    $("modal").classList.add("show");
  }

  function closeLimitModal() {
    $("modal").classList.remove("show");
  }

  function speechSupported() {
    return ("webkitSpeechRecognition" in window) || ("SpeechRecognition" in window);
  }

  function parsePriceFromSpeech(text) {
    var t = String(text || "").toLowerCase();
    t = t.replace(/€/g, " euro ");
    t = t.replace(/euro/g, " euro ");
    t = t.replace(/komma/g, ",");
    t = t.replace(/punkt/g, ".");
    t = t.replace(/\s+/g, " ").trim();

    // number words (basic)
    var words = {
      "null":"0","eins":"1","eine":"1","einen":"1","zwei":"2","drei":"3","vier":"4","fünf":"5","fuenf":"5",
      "sechs":"6","sieben":"7","acht":"8","neun":"9","zehn":"10","elf":"11","zwölf":"12","zwoelf":"12",
      "dreizehn":"13","vierzehn":"14","fünfzehn":"15","sechzehn":"16","siebzehn":"17","achtzehn":"18",
      "neunzehn":"19","zwanzig":"20","dreißig":"30","dreissig":"30"
    };
    if (words[t] != null) return parseFloat(words[t]);

    // extract first number
    var m = t.match(/\b(\d{1,3})([\,\.](\d{1,2}))?\b/);
    if (m) {
      var euros = parseInt(m[1], 10);
      var cents = (m[3] != null) ? m[3] : null;
      if (cents != null) {
        if (cents.length === 1) cents = cents + "0";
        if (cents.length > 2) cents = cents.slice(0,2);
        return euros + (parseInt(cents,10) / 100);
      }
      return euros;
    }

    // replace word numbers then retry
    var replaced = t;
    for (var w in words) {
      if (Object.prototype.hasOwnProperty.call(words, w)) {
        replaced = replaced.replace(new RegExp("\\b" + w + "\\b", "g"), words[w]);
      }
    }
    replaced = replaced.replace(/ euro /g, " ");
    m = replaced.match(/\b(\d{1,3})([\,\.](\d{1,2}))?\b/);
    if (m) {
      var euros2 = parseInt(m[1], 10);
      var cents2 = (m[3] != null) ? m[3] : null;
      if (cents2 != null) {
        if (cents2.length === 1) cents2 = cents2 + "0";
        return euros2 + (parseInt(cents2,10) / 100);
      }
      return euros2;
    }

    return null;
  }

  function buildRecognition() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var rec = new SR();
    rec.lang = "de-DE";
    rec.continuous = true;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = function (ev) {
      var last = ev.results[ev.results.length - 1];
      var text = (last && last[0] && last[0].transcript) ? last[0].transcript : "";
      text = String(text).trim();
      if (!text) return;
      var price = parsePriceFromSpeech(text);
      if (price == null) {
        toast("Nicht verstanden: „" + text + "“", "warn");
        return;
      }
      addPrice(price, state.activeCat, false);
    };

    rec.onerror = function (e) {
      toast("Spracherkennung Fehler: " + (e.error || "unknown"), "danger");
      stopListening();
    };

    rec.onend = function () {
      if (state.listening) {
        try { rec.start(); } catch (e) {}
      }
    };

    return rec;
  }

  function startListening() {
    if (!speechSupported()) {
      toast("Live-Spracherkennung wird von diesem Browser nicht unterstützt. Nutze Diktat oder Eingabe-Feld.", "danger");
      return;
    }
    if (!state.recognition) state.recognition = buildRecognition();
    state.listening = true;
    $("micDot").classList.add("on");
    $("micText").textContent = "Aufnahme läuft …";
    try { state.recognition.start(); } catch (e) {}
    toast("Spracherkennung aktiv. Sprich Preise.", "ok");
  }

  function stopListening() {
    state.listening = false;
    $("micDot").classList.remove("on");
    $("micText").textContent = "Aufnahme starten";
    try { if (state.recognition) state.recognition.stop(); } catch (e) {}
  }

  function toggleListening() {
    if (state.listening) stopListening();
    else startListening();
  }

  function bind() {
    $("credit90").onclick = function () { state.creditRate = 0.90; updateUI(); };
    $("credit55").onclick = function () { state.creditRate = 0.55; updateUI(); };

    var catBtns = document.querySelectorAll(".pill.cat");
    for (var i = 0; i < catBtns.length; i++) {
      catBtns[i].onclick = function () {
        state.activeCat = this.getAttribute("data-cat");
        updateUI();
      };
    }

    $("micBtn").onclick = toggleListening;
    $("undoBtn").onclick = undo;

    $("addManual").onclick = function () {
      var raw = String($("manualPrice").value || "").trim();
      if (!raw) return;
      var norm = raw.replace("€", "").replace(/\s+/g, "").replace(",", ".");
      var val = parseFloat(norm);
      if (isNaN(val)) { toast("Ungültige Eingabe.", "danger"); return; }
      addPrice(val, state.activeCat, false);
      $("manualPrice").value = "";
      $("manualPrice").focus();
    };

    $("manualPrice").addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        $("addManual").click();
      }
    });

    var dictBtn = $("dictateBtn");
    if (dictBtn) {
      dictBtn.onclick = function () {
        var inp = $("manualPrice");
        inp.focus();
        if (inp.select) inp.select();
        toast("Diktat: iOS-Mikro am Keyboard nutzen.", "ok");
      };
    }

    $("finishBtn").onclick = function () {
      stopListening();
      var total = currentTotals().total;
      if (total <= 0) { toast("Paket ist leer.", "warn"); return; }
      openLimitModal(total);
    };

    $("nextPkgBtn").onclick = function () { closeLimitModal(); startNewPackage(); };
    $("endBtn").onclick = function () { closeLimitModal(); closeCurrentPackage(); toast("Retoure beendet (Pakete bleiben gespeichert).", "ok"); };

    $("resetBtn").onclick = function () {
      if (confirm("Wirklich ALLES löschen? (Pakete + Einstellungen)")) {
        try { localStorage.removeItem("sellence_retouren_assistant_v1"); } catch (e) {}
        state.packages = [];
        state.current = blankPackage(1);
        state.packages.push(state.current);
        state.creditRate = 0.90;
        state.activeCat = "ZIGARETTEN";
        stopListening();
        updateUI();
      }
    };

    $("modal").addEventListener("click", function (e) {
      if (e.target && e.target.id === "modal") closeLimitModal();
    });

    var hint = $("iosHint");
    if (isIOS() && hint) hint.style.display = "block";

    if (!speechSupported()) {
      $("micText").textContent = "Live-Sprachmodus (Safari)";
      $("micBtn").disabled = true;
      $("micBtn").style.opacity = "0.7";
      if (hint) hint.style.display = "block";
    }
  }

  function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js").catch(function () {});
  }

  function init() {
    if (!load()) {
      state.current = blankPackage(1);
      state.packages.push(state.current);
    }
    bind();
    updateUI();
    registerSW();
  }

  init();
})();