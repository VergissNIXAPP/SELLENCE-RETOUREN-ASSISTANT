(() => {
  const LIMIT = 500.0;
  const CATS = ["ZIGARETTEN","FEINSCHNITT","CONSUMABLES"];
  const $ = (id)=>document.getElementById(id);

  const state = { creditRate:0.90, activeCat:"ZIGARETTEN", packages:[], current:null, recognition:null, listening:false };

  const euro = (n)=> n.toFixed(2).replace(".",",")+" €";
  const round10c = (n)=> n;

  const blankPackage = (index)=>({ index, createdAt:new Date().toISOString(), items:{ZIGARETTEN:{},FEINSCHNITT:{},CONSUMABLES:{}}, history:[], closed:false });

  function save(){
    localStorage.setItem("sellence_retouren_assistant_v1", JSON.stringify({
      creditRate: state.creditRate, activeCat: state.activeCat, packages: state.packages
    }));
  }
  function load(){
    try{
      const raw = localStorage.getItem("sellence_retouren_assistant_v1");
      if(!raw) return false;
      const p = JSON.parse(raw);
      if(!p || !Array.isArray(p.packages)) return false;
      state.creditRate = p.creditRate === 0.55 ? 0.55 : 0.90;
      state.activeCat = CATS.includes(p.activeCat) ? p.activeCat : "ZIGARETTEN";
      state.packages = p.packages;
      const last = [...state.packages].reverse().find(x=>x && !x.closed);
      if(last) state.current = last;
      else{
        const next = (state.packages.length ? Math.max(...state.packages.map(x=>x.index||0)) : 0) + 1;
        state.current = blankPackage(next);
        state.packages.push(state.current);
      }
      return true;
    }catch(_){ return false; }
  }

  function totalsForPackage(pkg){
    const sums = {ZIGARETTEN:0,FEINSCHNITT:0,CONSUMABLES:0};
    for(const cat of CATS){
      const map = pkg.items[cat] || {};
      for(const k of Object.keys(map)){
        sums[cat] += parseFloat(k) * (map[k]||0);
      }
    }
    const total = sums.ZIGARETTEN + sums.FEINSCHNITT + sums.CONSUMABLES;
    return { ...sums, total, credit: total * state.creditRate };
  }
  const currentTotals = ()=> totalsForPackage(state.current);

  function toast(msg, kind="ok"){
    const el = $("toast");
    el.textContent = msg;
    el.style.color = kind==="warn" ? "rgba(255,204,102,.95)" : kind==="danger" ? "rgba(255,107,107,.95)" : "rgba(102,247,193,.95)";
    clearTimeout(toast._t);
    toast._t = setTimeout(()=>{ el.textContent=""; }, 1600);
  }

  function renderGroups(){
    const pkg = state.current, list = $("groupList");
    list.innerHTML = "";
    const map = (pkg.items[state.activeCat]||{});
    const keys = Object.keys(map).sort((a,b)=>parseFloat(a)-parseFloat(b));
    if(keys.length===0){
      const empty=document.createElement("div");
      empty.className="muted"; empty.style.textAlign="center"; empty.style.padding="10px 0";
      empty.textContent="Noch keine Einträge in dieser Kategorie.";
      list.appendChild(empty);
      return;
    }
    for(const k of keys){
      const price=parseFloat(k), count=map[k];
      const row=document.createElement("div"); row.className="groupRow";
      const left=document.createElement("div"); left.className="groupMeta";
      const badge=document.createElement("div"); badge.className="badge"; badge.textContent=euro(price);
      const info=document.createElement("div");
      info.innerHTML = `<div style="font-weight:950;">x ${count}</div><div class="muted tiny">Zwischensumme: ${euro(price*count)}</div>`;
      left.appendChild(badge); left.appendChild(info);

      const btns=document.createElement("div"); btns.className="groupBtns";
      const plus=document.createElement("button"); plus.className="smallBtn"; plus.type="button"; plus.textContent="+1";
      plus.onclick=()=> addPrice(price, state.activeCat, true);
      const minus=document.createElement("button"); minus.className="smallBtn"; minus.type="button"; minus.textContent="−1";
      minus.onclick=()=> removeOne(price, state.activeCat);
      btns.appendChild(plus); btns.appendChild(minus);

      row.appendChild(left); row.appendChild(btns);
      list.appendChild(row);
    }
  }

  function renderPackages(){
    const wrap=$("pkgList"); wrap.innerHTML="";
    const pkgs=[...state.packages].sort((a,b)=>(a.index||0)-(b.index||0));
    for(const pkg of pkgs){
      const t=totalsForPackage(pkg);
      const el=document.createElement("div"); el.className="pkgItem";
      const head=document.createElement("div"); head.className="pkgHead";
      const title=document.createElement("div"); title.className="pkgTitle";
      title.textContent = `Paket ${pkg.index}${pkg.closed ? " · abgeschlossen" : " · aktiv"}`;
      const right=document.createElement("div"); right.className="muted";
      right.textContent = `KVP: ${euro(t.total)} · Gutschrift: ${euro(t.credit)}`;
      head.appendChild(title); head.appendChild(right);

      const grid=document.createElement("div"); grid.className="pkgGrid";
      const cells=[
        ["KVP ZIGARETTEN", euro(t.ZIGARETTEN)],
        ["KVP FEINSCHNITT", euro(t.FEINSCHNITT)],
        ["KVP CONSUMABLES", euro(t.CONSUMABLES)],
        ["KVP GESAMT", euro(t.total)],
        [`Gutschrift (${Math.round(state.creditRate*100)}%)`, euro(t.credit)],
      ];
      for(const [k,v] of cells){
        const c=document.createElement("div");
        c.innerHTML = `<div class="k">${k}</div><div class="v">${v}</div>`;
        grid.appendChild(c);
      }
      el.appendChild(head); el.appendChild(grid);
      wrap.appendChild(el);
    }
  }

  function updateUI(){
    $("credit90").classList.toggle("active", state.creditRate===0.90);
    $("credit55").classList.toggle("active", state.creditRate===0.55);
    document.querySelectorAll(".pill.cat").forEach(b=> b.classList.toggle("active", b.dataset.cat===state.activeCat));
    $("activeCatLabel").textContent=state.activeCat;
    $("pkgIndex").textContent=String(state.current.index);

    const t=currentTotals();
    $("sumZ").textContent=euro(t.ZIGARETTEN);
    $("sumF").textContent=euro(t.FEINSCHNITT);
    $("sumC").textContent=euro(t.CONSUMABLES);
    $("sumAll").textContent=euro(t.total);
    $("sumCredit").textContent=euro(t.credit);
    $("pkgTotal").textContent=euro(t.total);

    const pct=Math.min(100, Math.round((t.total/LIMIT)*100));
    $("pct").textContent=String(pct);
    $("bar").style.width=pct+"%";

    renderGroups();
    renderPackages();
    save();
  }

  function ensureCurrent(){
    if(!state.current){
      state.current=blankPackage(1);
      state.packages.push(state.current);
    }
  }

  function addPrice(price, cat, silent=false){
    ensureCurrent();
    const pkg=state.current;
    if(pkg.closed){ toast("Aktuelles Paket ist abgeschlossen. Starte ein neues Paket.","warn"); return; }

    const p=round10c(price);
–${PRICE_MAX} €): ${euro(p)}`,"danger"); return; }

    const key=p.toFixed(2);
    pkg.items[cat] ||= {};
    pkg.items[cat][key] = (pkg.items[cat][key]||0) + 1;
    pkg.history.push({cat, key, ts:Date.now()});

    if(!silent) toast(`Erkannt & hinzugefügt: ${euro(p)} · ${cat}`);
    updateUI();

    const total=currentTotals().total;
    if(total>=LIMIT){
      stopListening();
      openLimitModal(total);
    }
  }

  function removeOne(price, cat){
    const pkg=state.current;
    if(!pkg || pkg.closed) return;
    const key=round10c(price).toFixed(2);
    const map=pkg.items[cat]||{};
    if(!map[key]) return;
    map[key]-=1; if(map[key]<=0) delete map[key];
    for(let i=pkg.history.length-1;i>=0;i--){
      if(pkg.history[i].cat===cat && pkg.history[i].key===key){ pkg.history.splice(i,1); break; }
    }
    toast(`Entfernt: ${euro(parseFloat(key))} · ${cat}`,"warn");
    updateUI();
  }

  function undo(){
    const pkg=state.current;
    if(!pkg || pkg.closed) return;
    const last=pkg.history.pop();
    if(!last){ toast("Nichts zum Rückgängig machen.","warn"); return; }
    const map=pkg.items[last.cat]||{};
    if(map[last.key]){ map[last.key]-=1; if(map[last.key]<=0) delete map[last.key]; }
    toast(`Undo: ${euro(parseFloat(last.key))} · ${last.cat}`,"warn");
    updateUI();
  }

  function closeCurrentPackage(){ if(state.current) state.current.closed=true; updateUI(); }

  function startNewPackage(){
    closeCurrentPackage();
    const next=(state.packages.length ? Math.max(...state.packages.map(x=>x.index||0)) : 0) + 1;
    state.current=blankPackage(next);
    state.packages.push(state.current);
    $("manualPrice").value="";
    updateUI();
  }

  function openLimitModal(total){
    $("modalTitle").textContent="500 € erreicht";
    $("modalText").textContent=`KVP im Paket: ${euro(total)}. Bitte nächstes Paket anfangen oder Retoure beenden.`;
    $("modal").classList.add("show");
  }
  const closeLimitModal=()=> $("modal").classList.remove("show");

  const speechSupported=()=> ("webkitSpeechRecognition" in window) || ("SpeechRecognition" in window);

  function parsePriceFromSpeech(text){
    let t=text.toLowerCase().replace(/€/g," euro ").replace(/euro/g," euro ").replace(/komma/g,",").replace(/punkt/g,".").replace(/\s+/g," ").trim();
    const words={"null":"0","eins":"1","eine":"1","einen":"1","zwei":"2","drei":"3","vier":"4","fünf":"5","fuenf":"5","sechs":"6","sieben":"7","acht":"8","neun":"9","zehn":"10","elf":"11","zwölf":"12","zwoelf":"12","dreizehn":"13","vierzehn":"14","fünfzehn":"15","sechzehn":"16","siebzehn":"17","achtzehn":"18","neunzehn":"19","zwanzig":"20","dreißig":"30","dreissig":"30"};
    if(words[t]!=null) return parseFloat(words[t]);

    let m=t.match(/\b(\d{1,2})([\.,](\d{1,2}))?\b/);
    if(m){
      const euros=parseInt(m[1],10);
      let cents=m[3]!=null?m[3]:null;
      if(cents!=null){
        if(cents.length===1) cents=cents+"0";
        if(cents.length>2) cents=cents.slice(0,2);
        return euros + (parseInt(cents,10)/100);
      }
      return euros;
    }
    m=t.match(/\b(\d{1,2})\s+(\d{1,2})\b/);
    if(m){
      const euros=parseInt(m[1],10);
      let cents=m[2]; if(cents.length===1) cents=cents+"0";
      return euros + (parseInt(cents,10)/100);
    }
    let replaced=t;
    for(const [w,d] of Object.entries(words)) replaced=replaced.replace(new RegExp(`\\b${w}\\b`,"g"), d);
    replaced=replaced.replace(/ euro /g," ");
    m=replaced.match(/\b(\d{1,2})([\.,](\d{1,2}))?\b/);
    if(m){
      const euros=parseInt(m[1],10);
      let cents=m[3]!=null?m[3]:null;
      if(cents!=null){ if(cents.length===1) cents=cents+"0"; return euros + (parseInt(cents,10)/100); }
      return euros;
    }
    return null;
  }

  function buildRecognition(){
    const SR=window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec=new SR();
    rec.lang="de-DE";
    rec.continuous=true;
    rec.interimResults=false;
    rec.maxAlternatives=1;

    rec.onresult=(ev)=>{
      const last=ev.results[ev.results.length-1];
      const text=(last && last[0] && last[0].transcript ? last[0].transcript : "").trim();
      if(!text) return;
      const price=parsePriceFromSpeech(text);
      if(price==null){ toast(`Nicht verstanden: „${text}“`,"warn"); return; }
      addPrice(price, state.activeCat);
    };
    rec.onerror=(e)=>{ toast("Spracherkennung Fehler: "+(e.error||"unknown"),"danger"); stopListening(); };
    rec.onend=()=>{ if(state.listening){ try{ rec.start(); }catch(_){ } } };
    return rec;
  }

  function startListening(){
    if(!speechSupported()){ toast("Spracherkennung wird von diesem Browser nicht unterstützt. Nutze Eingabe-Feld.","danger"); return; }
    if(!state.recognition) state.recognition=buildRecognition();
    state.listening=true;
    $("micDot").classList.add("on");
    $("micText").textContent="Aufnahme läuft …";
    try{ state.recognition.start(); }catch(_){}
    toast("Spracherkennung aktiv. Sprich Preise.","ok");
  }
  function stopListening(){
    state.listening=false;
    $("micDot").classList.remove("on");
    $("micText").textContent="Aufnahme starten";
    try{ state.recognition && state.recognition.stop(); }catch(_){}
  }
  const toggleListening=()=> state.listening ? stopListening() : startListening();

  function exportCSV(){
    const lines=[];
    lines.push(["Paket","Datum","KVP_Zigaretten","KVP_Feinschnitt","KVP_Consumables","KVP_Gesamt",`Gutschrift_${Math.round(state.creditRate*100)}%`].join(";"));
    const pkgs=[...state.packages].sort((a,b)=>(a.index||0)-(b.index||0));
    for(const pkg of pkgs){
      const t=totalsForPackage(pkg);
      const d=new Date(pkg.createdAt||Date.now());
      const fmt=d.toLocaleString("de-DE");
      const f=(n)=>n.toFixed(2).replace(".",",");
      lines.push([pkg.index, fmt, f(t.ZIGARETTEN), f(t.FEINSCHNITT), f(t.CONSUMABLES), f(t.total), f(t.credit)].join(";"));
    }
    lines.push(""); lines.push("DETAILS");
    lines.push(["Paket","Kategorie","Preis","Anzahl","Zwischensumme"].join(";"));
    for(const pkg of pkgs){
      for(const cat of CATS){
        const map=pkg.items[cat]||{};
        for(const k of Object.keys(map).sort((a,b)=>parseFloat(a)-parseFloat(b))){
          const price=parseFloat(k), count=map[k], sub=price*count;
          const f=(n)=>n.toFixed(2).replace(".",",");
          lines.push([pkg.index, cat, f(price), count, f(sub)].join(";"));
        }
      }
    }
    const blob=new Blob([lines.join("\n")],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=`sellence-retouren-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function bind(){
    $("credit90").onclick=()=>{ state.creditRate=0.90; updateUI(); };
    $("credit55").onclick=()=>{ state.creditRate=0.55; updateUI(); };

    document.querySelectorAll(".pill.cat").forEach(btn=>{
      btn.onclick=()=>{ state.activeCat=btn.dataset.cat; updateUI(); };
    });

    $("micBtn").onclick=toggleListening;
    $("undoBtn").onclick=undo;

    $("addManual").onclick=()=>{
      const raw=$("manualPrice").value.trim(); if(!raw) return;
      const norm=raw.replace("€","").replace(/\s+/g,"").replace(",",".");
      const val=parseFloat(norm);
      if(Number.isNaN(val)){ toast("Ungültige Eingabe.","danger"); return; }
      addPrice(val, state.activeCat);
      $("manualPrice").value=""; $("manualPrice").focus();
    };
    $("manualPrice").addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); $("addManual").click(); } });

    $("finishBtn").onclick=()=>{
      stopListening();
      const total=currentTotals().total;
      if(total<=0){ toast("Paket ist leer.","warn"); return; }
      openLimitModal(total);
    };

    $("nextPkgBtn").onclick=()=>{ closeLimitModal(); startNewPackage(); };
    $("endBtn").onclick=()=>{ closeLimitModal(); closeCurrentPackage(); toast("Retoure beendet (Pakete bleiben gespeichert).","ok"); };
$("resetBtn").onclick=()=>{
      if(confirm("Wirklich ALLES löschen? (Pakete + Einstellungen)")){
        localStorage.removeItem("sellence_retouren_assistant_v1");
        state.packages=[]; state.current=blankPackage(1); state.packages.push(state.current);
        state.creditRate=0.90; state.activeCat="ZIGARETTEN";
        stopListening(); updateUI();
      }
    };

    $("modal").addEventListener("click",(e)=>{ if(e.target.id==="modal") closeLimitModal(); });

    if(!speechSupported()){
      $("micText").textContent="Sprachmodus nicht verfügbar";
      $("micBtn").disabled=true;
      $("micBtn").style.opacity="0.7";
    }
  }

  async function registerSW(){
    if(!("serviceWorker" in navigator)) return;
    try{ await navigator.serviceWorker.register("./sw.js"); }catch(_){}
  }

  function init(){
    if(!load()){
      state.current=blankPackage(1);
      state.packages.push(state.current);
    }
    bind(); updateUI(); registerSW();
  }
  init();
})();