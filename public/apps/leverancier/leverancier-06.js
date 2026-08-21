/* de personeelskiezer: wie ben jij */
    if (fallback) list = all;
    spH2().textContent = mgmt ? T('sp.r.mgmt','Management') : func;
    spDeck().textContent = fallback ? T('sp.nofunc','Nog niemand met deze functie; kies uw naam uit het team.') : T('sp.pickname','Kies uw naam en voer uw pincode in.');
    $('#spList').innerHTML = (list.map(m =>
      '<button class="sp-person" data-sid="'+m.id+'" data-name="'+m.name.replace(/"/g,'&quot;')+'" data-role="'+m.role+'">'+
        '<span class="av">'+initials(m.name)+'</span><span><b>'+m.name+'</b><span>'+(m.func||T('role.'+m.role, m.role==='manager'?'Manager':'Medewerker'))+'</span></span></button>'
    ).join('') || '<div class="empty" style="padding:1.2rem 0;">'+T('sp.nostaff','Nog geen persoonlijke accounts. Log in als Beheer en voeg je team toe.')+'</div>') + backBtn();
    $('#spList').querySelectorAll('.sp-person[data-sid]').forEach(b => b.addEventListener('click', () => openPin(b.dataset.sid, b.dataset.name, b.dataset.role)));
    bindBack(mgmt ? renderRoles : renderFuncs);
  }
  // Solliciteren: bij elk bedrijf hetzelfde formulier
  function renderApply(){
    const type = TYPEOF[pickCode] || 'restaurant';
    spH2().textContent = T('sp.applyh','Solliciteren');
    spDeck().textContent = T('sp.applydeck','Bij elke RTG-partner solliciteert u op dezelfde manier. Het bedrijf ziet uw sollicitatie direct in de app.');
    $('#spList').innerHTML =
      '<div class="field h-mt40"><label>'+T('sp.a.name','Uw naam')+'</label><input id="apName"></div>'+
      '<div class="field"><label>'+T('sp.a.func','Functie')+'</label><select id="apFunc" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.8rem 1rem;font-size:0.9rem;color:var(--txt);outline:none;">'+
        (FUNCS[type]||[]).map(f=>'<option>'+f+'</option>').join('')+'</select></div>'+
      '<div class="field"><label>'+T('sp.a.contact','Telefoon of e-mail')+'</label><input id="apContact"></div>'+
      '<div class="field"><label>'+T('sp.a.note','Korte motivatie (optioneel)')+'</label><textarea id="apNote" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.8rem 1rem;font-size:0.9rem;color:var(--txt);outline:none;min-height:70px;resize:vertical;"></textarea></div>'+
      '<button class="bigbtn" id="apSend">'+T('sp.a.send','Verstuur sollicitatie')+'</button>' + backBtn();
    bindBack(renderRoles);
    $('#apSend').addEventListener('click', async () => {
      const name = $('#apName').value.trim(), contact = $('#apContact').value.trim();
      if (!name || !contact){ toast(T('sp.a.fill','Vul uw naam en telefoonnummer of e-mailadres in.')); return; }
      try {
        await API.call('/supplier/apply', { code: pickCode, name, func: $('#apFunc').value, contact, note: $('#apNote').value.trim() });
        toast(T('sp.a.sent','Verstuurd. ') + gateRoster.supplier.name + ' ' + T('sp.a.sent2','neemt contact met u op.'));
        renderRoles();
      } catch(e){ toast(e.message); }
    });
  }
  function backBtn(){ return '<button class="sp-biz-btn h-mt90" id="spBack2">← '+T('sp.back','Terug')+'</button>'; }
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
    // RTMAIL deep-link: een Office-actie landt direct op het juiste zakelijke
    // werkblad. Alleen bestaande tab-id's worden geaccepteerd.
    try {
      const rtmailTab = (new URLSearchParams(location.search).get('rtmail') || '').toLowerCase();
      if (rtmailTab && TABDEF[rtmailTab]) setTimeout(() => openTab(rtmailTab, true), 0);
    } catch (e) {}
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
