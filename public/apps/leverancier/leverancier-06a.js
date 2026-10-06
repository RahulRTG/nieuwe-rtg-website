/* inloggen met het eigen RTG-account, met de tweede stap, en de app openen */
  // de werkplek-zone kan om een positie vragen: dan een keer ophalen en
  // opnieuw proberen; de server vergelijkt en bewaart er niets van
  const vraagPositie = () => new Promise(af => {
    if (!navigator.geolocation) return af(null);
    navigator.geolocation.getCurrentPosition(
      p => af({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => af(null), { enableHighAccuracy: true, timeout: 8000 });
  });

  /* DE TWEEDE STAP (N19). Staat de tweede factor van het account aan, dan geeft
     het wachtwoord alleen een bewijs, en DEZELFDE route ruilt dat met een code
     om (server/routes/supplier/pda/posities-inlog.js). Het codeveld staat in
     leverancier.html (#codeForm); de rest van de poort wacht zolang. Geeft een
     belofte op de werksessie. Terug, een verlopen bewijs of geen werkplek meer
     wijst af met een fout die `tweede` draagt, zodat de aanroeper de echte reden
     toont en niet "onjuiste inloggegevens". Een verkeerde code blijft staan. */
  function vraagCode(d, body){
    const vorm = $('#codeForm'), veld = $('#liCode'), fout = $('#codeFout');
    const weg = [$('#loginForm'), document.getElementById('gateGesprek'), $('#gate .enroll-box')].filter(Boolean);
    const was = weg.map(x => x.style.display);
    weg.forEach(x => { x.style.display = 'none'; });
    vorm.hidden = false; fout.textContent = ''; veld.value = '';
    try { veld.focus(); } catch(e){}
    return new Promise((af, mis) => {
      const sluit = (dan) => {
        vorm.hidden = true; vorm.onsubmit = null; $('#codeTerug').onclick = null;
        weg.forEach((x, i) => { x.style.display = was[i]; });
        dan();
      };
      const stop = (tekst) => sluit(() => mis(Object.assign(new Error(tekst), { tweede: true })));
      $('#codeTerug').onclick = () => stop(T('gate.code.terug', 'De inlog is afgebroken. Log opnieuw in.'));
      vorm.onsubmit = async (e) => {
        e.preventDefault(); fout.textContent = '';
        const knop = vorm.querySelector('button[type="submit"]'); knop.disabled = true;
        try {
          const r = await API.call('/supplier/mijn/login', { bewijs: d.bewijs, code: veld.value.trim(), bedrijf: (body && body.bedrijf) || '' });
          knop.disabled = false;
          sluit(() => af(r));
        } catch (err) {
          knop.disabled = false; veld.value = '';
          // verlopen, of geen werkplek meer: terug naar de inlog, met de reden
          if (err.status === 401 || err.status === 404) return stop(err.message);
          fout.textContent = err.message || T('login.failed', 'Inloggen mislukt.');
          try { veld.focus(); } catch(e2){}
        }
      };
    });
  }

  // Productie gebruikt uitsluitend /supplier/mijn/login. Alleen de expliciete
  // Magnaat Test-kiezer mag nog naar de oude /supplier/login.
  async function login(body, legacy, silent){
    if (!API.enabled){ toast(T('sup.needserver','Start de server (npm start) om de leverancier-app te gebruiken.')); return false; }
    try {
      let d;
      const route = legacy ? '/supplier/login' : '/supplier/mijn/login';
      try { d = await API.call(route, body); }
      catch(e1){
        if (!(e1.data && e1.data.locatieNodig)) throw e1;
        const pos = await vraagPositie();
        if (!pos) throw e1;
        d = await API.call(route, Object.assign({ positie: pos }, body));
      }
      if (!legacy && d.tweedeFactorNodig) d = await vraagCode(d, body);
      API.token = d.token;
      applyState(d.state);
      if (legacy) koppelAanRtgAccount(body, false); // uitsluitend testmigratie
    } catch(e){
      // de tweede stap heeft een eigen reden; de poort en de aanmelding tonen hem zelf
      if (silent) { if (e.tweede) throw e; return false; }
      toast(e.tweede ? e.message : !legacy ? T('login.bad','Onjuiste RTG-inloggegevens.') : (e.message||T('login.failed','Inloggen mislukt.')));
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
