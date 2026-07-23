  function bindBack(fn){ const b = $('#spBack2'); if (b) b.addEventListener('click', fn); }

  $('#spBack').addEventListener('click', () => $('#staffPick').classList.remove('open'));

  // Stap 2: persoon gekozen → pincode invoeren.
  let pinFor = null, pinBuf = '';
  function renderDots(){
    document.querySelectorAll('#spDots i').forEach((el,i)=> el.classList.toggle('on', i < pinBuf.length));
  }
  function openPin(sid, name, role){
    pinFor = Number(sid); pinBuf = '';
    $('#spPinName').textContent = name;
    $('#spPinRole').textContent = T('role.'+role, role==='manager'?'Manager':'Medewerker');
    $('#spDots').classList.remove('bad'); renderDots();
    $('#spPin').classList.add('open');
  }
  function buildPad(){
    const keys = ['1','2','3','4','5','6','7','8','9','','0',''];
    $('#spPad').innerHTML = keys.map(k => k==='' ? '<span></span>' :
      '<button class="sp-key'+(k===''?' wide':'')+'" data-k="'+k+'">'+k+'</button>').join('');
    document.querySelectorAll('#spPad [data-k]').forEach(b => b.addEventListener('click', () => pinKey(b.dataset.k)));
  }
  async function pinKey(k){
    $('#spDots').classList.remove('bad');
    if (k===''){ pinBuf = pinBuf.slice(0,-1); renderDots(); return; }
    if (pinBuf.length >= 4) return;
    pinBuf += k; renderDots();
    if (pinBuf.length === 4){
      const pin = pinBuf;
      const ok = await login({ code: pickCode, staffId: pinFor, pin }, false, true);
      if (!ok){ $('#spDots').classList.add('bad'); pinBuf=''; setTimeout(renderDots, 400); }
    }
  }
  $('#spPinCancel').addEventListener('click', () => { $('#spPin').classList.remove('open'); pinBuf=''; });

  // de werkplek-zone kan om een positie vragen: dan een keer ophalen en
  // opnieuw proberen; de server vergelijkt en bewaart er niets van
  const vraagPositie = () => new Promise(af => {
    if (!navigator.geolocation) return af(null);
    navigator.geolocation.getCurrentPosition(
      p => af({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => af(null), { enableHighAccuracy: true, timeout: 8000 });
  });

  // Gemeenschappelijke login. Geeft true/false terug bij PIN, zodat de pad kan reageren.
  async function login(body, isCred, silent){
    if (!API.enabled){ toast(T('sup.needserver','Start de server (npm start) om de leverancier-app te gebruiken.')); return false; }
    try {
      let d;
      try { d = await API.call('/supplier/login', body); }
      catch(e1){
        if (!(e1.data && e1.data.locatieNodig)) throw e1;
        const pos = await vraagPositie();
        if (!pos) throw e1;
        d = await API.call('/supplier/login', Object.assign({ positie: pos }, body));
      }
      API.token = d.token;
      applyState(d.state);
      koppelAanRtgAccount(body, isCred); // een account voor alles: stil koppelen
    } catch(e){
      if (silent) return false;
      toast(isCred ? T('login.bad','Onjuiste gebruikersnaam of wachtwoord.') : (e.message||T('login.failed','Inloggen mislukt.')));
      return false;
    }
    try { localStorage.setItem('rtg_sup_token', API.token); } catch(e){}
    // de zaak opent zijn eigen sector-app (behalve midden in een kassa-station)
    if (!pendingStation && naarEigenSector(S)) return true;
    if (pendingStation){
      try { localStorage.setItem('rtg_sup_station', pendingStation); } catch(e){}
      enterStation(pendingStation);
    } else {
      try { localStorage.removeItem('rtg_sup_station'); } catch(e){}
      enterApp();
    }
    return true;
  }

  function enterApp(){
    $('#staffPick').classList.remove('open');
    $('#spPin').classList.remove('open');
    $('#gate').style.display = 'none';
    $('#app').classList.add('active');
    buildTabs();
    renderAll();
    startStream();
    loadNotifs();
    // de moedertaal van de ingelogde medewerker: het hele scherm en de
    // bonnen volgen (de keuze zelf zet hij in de personeels-app)
    if (window.MoederTaal) MoederTaal.start((p, b) => API.call(p, b), () => { try { renderAll(); } catch(e){} });
  }

  // Blijf ingelogd: met een bewaard token direct de app in, zonder PIN.
  async function restoreSession(){
    if (!API.enabled) return;
    let t = null; try { t = localStorage.getItem('rtg_sup_token'); } catch(e){}
    if (!t) return;
    API.token = t;
    try {
      const st = (await API.call('/supplier/state')).state;
      // de bewaarde sessie weet bij welke sector hij hoort: verkeerde (of
      // ontbrekende) ingang stuurt meteen door naar de eigen sector-app
      if (st.supplier && naarEigenSector(st.supplier)) return;
      // vangnet voor zaken zonder eigen sector-ingang
      if (SDEF && st.supplier && !SDEF.codes.includes(st.supplier.code)){ API.token = null; return; }
      applyState(st);
      let stn = null; try { stn = localStorage.getItem('rtg_sup_station'); } catch(e2){}
      if (stn) enterStation(stn); else enterApp();
    } catch(e){
      API.token = null;
      try { localStorage.removeItem('rtg_sup_token'); } catch(e2){}
    }
  }

  // Wissel van gebruiker: sessie loslaten, terug naar het inlogscherm.
  function switchUser(){
    if (source){ try{ source.close(); }catch(_){} source = null; }
    stationMode = null; pendingStation = null;
    $('#station').classList.remove('on');
    API.token = null; state = null; S = null; notifs = [];
    try { localStorage.removeItem('rtg_sup_token'); localStorage.removeItem('rtg_sup_station'); } catch(e){}
    $('#app').classList.remove('active');
    $('#gate').style.display = '';
    if (pickCode) pickPartner(pickCode); else $('#staffPick').classList.remove('open');
  }

  function applyState(st){ state = st; S = st.supplier; }

  /* ---- Een account voor alles ----
     Wie hier net zijn werk-inlog bewees EN een RTG-leden-account op dit
     toestel heeft, wordt stil gekoppeld: voortaan is dat ene account genoeg.
     En op het inlogscherm: staat er al een koppeling, dan verschijnt een
     "verder met uw RTG-account"-keuze die de werk-sessie direct start. */
  function lidToken(){ try { return localStorage.getItem('rtg_member_token'); } catch(e){ return null; } }
  const accApi = (pad, body) => fetch('/api/account/' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lidToken() },
    body: JSON.stringify(body || {}) }).then(r => r.json().then(j => ({ ok: r.ok, j })));
  async function koppelAanRtgAccount(body, isCred){
    if (!lidToken()) return;
    try {
      const soort = body.staffId != null ? 'personeel' : (isCred ? 'zaak' : null);
      if (!soort) return;
      const r = await accApi('koppel', soort === 'personeel'
        ? { soort, code: body.code, staffId: body.staffId, pin: body.pin }
        : { soort, username: body.username, password: body.password });
      if (r.ok) toast(T('acc.gekoppeld', 'Gekoppeld aan uw RTG-account: voortaan is een inlog genoeg.'));
    } catch(e){}
  }
  async function rtgAccountKeuze(){
    const gate = $('#gate');
    if (!gate || !API.enabled || !lidToken()) return;
    try {
      const r = await accApi('rollen');
      const rollen = (r.ok && r.j.rollen || []).filter(x => x.rol === 'zaak' || x.rol === 'personeel');
      if (!rollen.length) return;
      const doos = document.createElement('div');
      doos.className = 'login-form';
      doos.setAttribute('aria-label', 'Verder met uw RTG-account');
      doos.innerHTML = rollen.map((x, i) =>
        '<button type="button" data-acc-start="' + i + '">' + (x.naam || 'Beheer') + ' · ' + (x.zaakNaam || x.code) +
        ' <small>' + T('acc.een', 'met uw RTG-account') + '</small></button>').join('');
      gate.querySelector('.login-form').after(doos);
      doos.querySelectorAll('[data-acc-start]').forEach(b => b.addEventListener('click', async () => {
        const x = rollen[Number(b.dataset.accStart)];
        const s = await accApi('start', { rol: x.rol, code: x.code, staffId: x.staffId });
        if (!s.ok) return toast(s.j.error || T('login.failed', 'Inloggen mislukt.'));
        API.token = s.j.token;
        try { localStorage.setItem('rtg_sup_token', API.token); } catch(e){}
        applyState(s.j.state);
        // Rahul denkt mee (agenda, uren, zorgprofiel): advies, nooit een slot
        API.call('/supplier/werkadvies', {}).then(a => { if (a && a.advies) toast('' + a.advies.tekst); }).catch(()=>{});
        if (naarEigenSector(S)) return;
        enterApp();
      }));
    } catch(e){}
  }
  setTimeout(rtgAccountKeuze, 800);


  /* De Zaakdoos: draait dit scherm op het kastje in de zaak, zeg dan eerlijk
     wanneer de lijn weg is. Alles blijft gewoon werken; het journaal
     synchroniseert vanzelf zodra de lijn terug is. */
  (function () {
    let doosTimer = null, doosBanner = false;
    async function doosCheck() {
      try {
        const d = await (await fetch('/api/doos/status')).json();
        if (!d.doos) return; // gewone cloudserver: niets te bewaken
        if (!doosTimer) doosTimer = setInterval(doosCheck, 10000);
        if (d.modus === 'lokaal' && window.RTGNet) {
          doosBanner = true;
          RTGNet.toon('' + T('doos.lokaal', 'Zaakdoos: de lijn is weg; de zaak draait lokaal door en synchroniseert vanzelf.') + (d.journaal ? ' (' + d.journaal + ' actie(s) in het journaal)' : ''));
        } else if (doosBanner && window.RTGNet) { doosBanner = false; RTGNet.verberg(); }
      } catch (e) {}
    }
    setTimeout(doosCheck, 2500);
  })();
