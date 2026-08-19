/* een account voor alles: partner kiezen en de staat toepassen */
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
  /* ================= werkplekken: keuken, bar, bediening =================
     Elk gerecht op de kaart hoort bij een station (keuken of bar). Een
     bestelling verschijnt als ticket op elk station dat iets moet maken;
     pas als alle stations klaar zijn, is de bestelling klaar en ziet de
     bedieningspost hem bij "Uit te serveren". */
  let stationMode = null, stClockTimer = null;
  // een scherm per keukensectie: hetzelfde keukenscherm, zes kanten
  const KSECTIES = {
    chef:    ['\uD83D\uDC68\u200D\uD83C\uDF73', 'Chef'],
    warm:    ['\uD83D\uDD25', 'Warme kant'],
    koud:    ['\u2744\uFE0F', 'Koude kant'],
    snack:   ['\uD83C\uDF5F', 'Snacks'],
    dessert: ['\uD83C\uDF70', 'Desserts'],
    pas:     ['\uD83C\uDF7D\uFE0F', 'De pas']
  };
  let keukenSectie = (() => { try { return localStorage.getItem('rtg_sup_ksectie') || 'chef'; } catch(e){ return 'chef'; } })();
  function sectieOf(it){
    const m = (state && state.menu || []).find(x => x.id === it.id);
    return (m && m.station !== 'bar') ? (m.sectie || 'warm') : null;
  }
  function sectiesVanOrder(o){
    const set = new Set();
    (o.items||[]).forEach(it => { const s2 = sectieOf(it); if (s2) set.add(s2); });
    return [...set];
  }

  function stationOf(it){
    const m = (state && state.menu || []).find(x => x.id === it.id);
    return m && m.station === 'bar' ? 'bar' : 'keuken';
  }

  /* ---- het vuurplan: zelfde rekenregels als de servercoach ----
     Nominale tijd per kant (prepMin op het gerecht wint); klaar telt 0,
     bezig de halve tijd, niet gestart de volle tijd. De langzaamste kant
     bepaalt het doel; de rest start precies zo laat dat alles tegelijk
     warm op de pas ligt. */
  const KTIJD = { warm: 12, koud: 6, snack: 8, dessert: 5 };
  function sectieDuur(o, sec){
    let t = KTIJD[sec] || 8;
    (o.items||[]).forEach(it => {
      const m = (state && state.menu || []).find(x => x.id === it.id);
      if (m && m.station !== 'bar' && (m.sectie||'warm') === sec && m.prepMin) t = Math.max(t, m.prepMin);
    });
    return t;
  }
  function vuurplan(o){
    const nodig = sectiesVanOrder(o);
    const fase = o.secties || {};
    const faseVan = k => k === 'bar' ? (o.stations||{}).bar : fase[k];
    const rest = {};
    nodig.forEach(sec => { const t = sectieDuur(o, sec); rest[sec] = fase[sec]==='klaar' ? 0 : fase[sec]==='bezig' ? Math.ceil(t/2) : t; });
    // de bar telt als eigen kant mee: drankjes gaan met de rest van de bon samen uit
    if ((o.items||[]).some(it => stationOf(it) === 'bar')){
      const bf = (o.stations||{}).bar;
      rest.bar = bf === 'klaar' ? 0 : bf === 'bezig' ? 2 : 4;
    }
    const alle = Object.keys(rest);
    let doel = alle.length ? Math.max.apply(null, alle.map(k => rest[k])) : 0;
    // de deurhost-koppeling: deelt de gast zijn reis (GPS), dan mikt het
    // vuurplan op de aankomst, zodat alles warm klaarstaat als de gast zit
    // (behalve bij spoed: dan telt alleen de kooktijd)
    if (!o.spoed && !o.guestArrived && Number.isFinite(o.guestEtaMin) && o.guestEtaMin > doel) doel = o.guestEtaMin;
    const plan = {};
    alle.forEach(k => {
      const f = faseVan(k);
      if (f==='klaar') plan[k] = doel > 0 ? { doe:'warm', min:doel } : { doe:'pas', min:0 };
      else if (f==='bezig') plan[k] = { doe:'bezig', min:rest[k] };
      else { const w = doel - rest[k]; plan[k] = w >= 2 ? { doe:'wacht', min:w } : { doe:'nu', min:0 }; }
    });
    // spoed van de bediening: niets houdt nog in, alles start nu
    if (o.spoed) alle.forEach(k => { if (plan[k].doe === 'wacht') plan[k] = { doe:'nu', min:0 }; });
    return { doel, plan };
  }
  // spoedbonnen bovenaan, daarna de oudste eerst; het spoedmerkje per gerecht
  const spoedEerst = (a,b) => ((b.spoed?1:0) - (a.spoed?1:0)) || opTijd(a,b);
  const spoedMerk = (o, it) => (o.spoed && (!o.spoed.itemId || o.spoed.itemId === it.id)) ? '' : '';
  // KDS-tijdbanden: groen tot 6 min, amber tot 12, rood daarna, knipperen vanaf 18
  function ageKlasse(a){ return a >= 18 ? ' late flash' : a >= 12 ? ' late' : a >= 6 ? ' warn' : ' ok'; }
  function vpChip(sec, p){
    if (!p) return '';
    const kant = KSECTIES[sec] || (sec === 'bar' ? ['','Bar'] : ['·', sec]);
    const lbl = { nu: T('vp.nu','start nu'), wacht: T('vp.wacht','wacht'), bezig: T('vp.bezig','bezig'), warm: T('vp.warm','houd warm'), pas: T('vp.pas','naar de pas') }[p.doe] || '';
    const min = (p.doe==='wacht'||p.doe==='bezig'||p.doe==='warm') && p.min ? ' ~'+p.min+'m' : '';
    return '<span class="vp '+p.doe+'">'+kant[0]+' '+T('ks.'+sec, kant[1])+' · '+lbl+min+'</span>';
  }
  // de deurhost-regel op de bon: waar is de gast (GPS uit de leden-app)
  function gastRegel(o){
    if (o.guestArrived) return '<div class="tkc-who">'+T('kds.gastin','De gast is binnen.')+'</div>';
    if (Number.isFinite(o.guestEtaMin)) return '<div class="tkc-who">'+T('kds.gast','Gast onderweg, ~')+o.guestEtaMin+' min</div>';
    return '';
  }
  // hoe lang staat het al op de pas: sneller rood dan de bontijd (eten wordt koud)
  function pasKlasse(a){ return a >= 6 ? ' late flash' : a >= 3 ? ' warn' : ' ok'; }
  // de statusbalk boven de bonnen: open, te laat, oudste
  function stStats(list){
    const ages = list.map(o => ageMin(o.at));
    const laat = ages.filter(a => a >= 12).length;
