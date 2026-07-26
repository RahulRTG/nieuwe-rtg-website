  async function checkOnboarding(){
    if (!API.live || !API.token || onbBezig) return;
    let st; try { st = await API.call('/onboarding/status'); } catch(e){ return; }
    if (!st || st.klaar){ const g0 = onbEl('onbGate'); if (g0) g0.hidden = true; return; }
    onbStartGesprek(st);
  }
  function onbStartGesprek(st){
    const g = onbEl('onbGate'); if (!g) return;
    if (!g.hidden && onbStap) return; // al bezig, niet opnieuw beginnen
    onbSt = st; onbMondMaak();
    onbRij = onbOpenVelden();
    onbStap = onbRij.length ? 'veld' : 'teken';
    const eerste = !onbGeopend; onbGeopend = true;
    g.hidden = false;
    if (eerste) onbZeg(T('onb.intro','Fijn dat je er bent. Nog een paar dingen en je kunt op reis.'));
    setTimeout(onbVolgende, eerste ? 750 : 0);
  }
  function onbVolgende(){
    if (onbStap === 'veld' && onbRij.length){
      onbHuidig = onbRij[0];
      if (onbHuidig.type === 'kyc') return onbVraagPaspoort();
      return onbVraagVeld(onbHuidig);
    }
    onbStap = 'teken';
    onbTekenVraag();
  }
  function onbVraagTekst(v){
    const M = {
      adres: T('onb.q.adres','Wat is je straat en huisnummer?'),
      postcode: T('onb.q.postcode','En je postcode?'),
      woonplaats: T('onb.q.woonplaats','In welke plaats woon je?'),
      land: T('onb.q.land','En in welk land?'),
      geboortedatum: T('onb.q.geboortedatum','Wat is je geboortedatum?'),
      nationaliteit: T('onb.q.nationaliteit','Wat is je nationaliteit?'),
      naam: T('onb.q.naam','Hoe heet je voluit?'),
      email: T('onb.q.email','Wat is je e-mailadres?'),
      telefoon: T('onb.q.telefoon','En je telefoonnummer?')
    };
    return M[v.id] || (T('onb.q.veld','Wat is je ') + String(v.label || '').toLowerCase() + '?');
  }
  function onbVraagVeld(v){
    const inp = onbEl('onbIn'), rij = onbEl('onbRij');
    if (rij) rij.style.display = '';
    if (inp){ inp.type = onbInputType(v.type); inp.value = ''; inp.placeholder = T('onb.typ','Typ je antwoord'); }
    onbActies([]);
    onbZeg(onbVraagTekst(v));
    if (inp) inp.focus();
  }
  function onbVraagPaspoort(){
    const rij = onbEl('onbRij'); if (rij) rij.style.display = 'none';
    onbZeg(T('onb.q.paspoort','Tot slot je paspoort, zodat ik zeker weet dat jij het bent. Scan het met de RTG-scanner of kies een foto.'));
    onbActies([
      { txt: T('onb.scan','Scan je paspoort'), prim: true, doe: function(){
          if (window.RTGPaspoortScan) RTGPaspoortScan.open({ onKlaar: function(d, mrz){ onbPaspoortUpload(d, mrz); } });
          else onbEl('onbKycFile').click();
        } },
      { txt: T('onb.upload','Kies een foto'), doe: function(){ onbEl('onbKycFile').click(); } }
    ]);
  }
  // de gekozen/gescande foto versleuteld naar de kluis en het gesprek vervolgen.
  // mrz = (optioneel) de op het toestel uitgelezen paspoortzone; kloppen de
  // controlecijfers, dan vult Rahul naam/geboortedatum/nationaliteit vast in.
  async function onbPaspoortUpload(data, mrz){
    if (!data) return;
    const fout = onbEl('onbFout'); if (fout) fout.textContent = '';
    onbBezig = true;
    try {
      await API.call('/verify/upload', { image: data });
      if (user) user.verified = 'pending';
      const gelezen = await onbMrzOpslaan(mrz);
      try { onbSt = await API.call('/onboarding/status'); } catch(e){}
      onbBezig = false;
      if (gelezen) onbZeg(T('onb.mrz1','Ik heb je paspoort gelezen: ') + gelezen + T('onb.mrz2','. Klopt dat? Dan gaan we verder.'));
      if (onbSt && onbSt.klaar) return setTimeout(onbKlaar, gelezen ? 900 : 0);
      onbRij = onbOpenVelden();
      onbStap = onbRij.length ? 'veld' : 'teken';
      if (gelezen) setTimeout(onbVolgende, 900); else onbVolgende();
    } catch(e){ onbBezig = false; if (fout) fout.textContent = (e && e.message) || T('onb.upmis','Uploaden lukte niet.'); }
  }
  // MRZ-velden opslaan in het onboarding-profiel; geeft een korte omschrijving
  // terug van wat gelezen is (voor Rahul), of '' als er niets bruikbaars was.
  async function onbMrzOpslaan(mrz){
    if (!mrz) return '';
    // de vervaldatum los bewaren (geen onboarding-veld): Rahul seint er een half
    // jaar vooraf mee dat het paspoort verloopt
    if (mrz.vervaldatum){ try { await API.call('/onboarding/paspoort', { vervaldatum: mrz.vervaldatum, nummer: mrz.nummer }); } catch(e){} }
    const heeft = {}; (onbSt && onbSt.velden || []).forEach(function(v){ heeft[v.id] = v; });
    const velden = {}, stukjes = [];
    if (mrz.geboortedatum && heeft.geboortedatum){ velden.geboortedatum = mrz.geboortedatum; stukjes.push(mrz.geboortedatum); }
    if (mrz.nationaliteit && heeft.nationaliteit){ velden.nationaliteit = mrz.nationaliteit; stukjes.push(mrz.nationaliteit); }
    if (mrz.naam && heeft.naam && !heeft.naam.ingevuld){ velden.naam = mrz.naam; stukjes.push(mrz.naam); }
    if (!Object.keys(velden).length) return '';
    try { onbSt = await API.call('/onboarding/opslaan', { velden }); } catch(e){ return ''; }
    return stukjes.join(', ');
  }
  function onbTekenVraag(){
    const inp = onbEl('onbIn'), rij = onbEl('onbRij');
    if (rij) rij.style.display = '';
    if (inp){ inp.type = 'text'; inp.value = ''; inp.placeholder = T('onb.naamph','Typ je volledige naam'); }
    const c = (onbSt && onbSt.contract) || {};
    onbZeg(T('onb.teken','Laatste stap: de ') + (c.titel || T('onb.overeenkomst','overeenkomst')) + T('onb.teken2','. Typ je volledige naam om te tekenen; daarmee ga je akkoord. Wil je hem eerst lezen?'));
    onbActies([{ txt: T('onb.lees','Lees de overeenkomst'), doe: onbToonLees }]);
    if (inp) inp.focus();
  }
  function onbToonLees(){
    const l = onbEl('onbLees'); if (!l) return;
    if (l.hidden){ l.textContent = ((onbSt && onbSt.contract) || {}).tekst || ''; l.hidden = false; }
    else l.hidden = true;
  }
  function onbActies(lijst){
    const box = onbEl('onbActies'); if (!box) return;
    box.textContent = '';
    (lijst || []).forEach(function(a){
      const b = document.createElement('button'); b.type = 'button'; b.textContent = a.txt;
      if (a.prim) b.className = 'prim'; b.addEventListener('click', a.doe); box.appendChild(b);
    });
  }
  function onbKlaar(){
    const g = onbEl('onbGate'); if (g) g.hidden = true;
    onbStap = null; onbGeopend = false; onbSt = null; onbRij = [];
    onbActies([]); const l = onbEl('onbLees'); if (l){ l.hidden = true; }
    toast(T('onb.welkom','Welkom aan boord! Fijne reis.'));
  }
  async function onbInvoer(tekst){
    if (onbBezig || !onbStap) return;
    tekst = String(tekst == null ? '' : tekst).trim();
    const inp = onbEl('onbIn'); if (inp) inp.value = '';
    const fout = onbEl('onbFout'); if (fout) fout.textContent = '';
    if (onbStap === 'veld'){
      if (!tekst || !onbHuidig) return;
      onbBezig = true;
      try {
        const velden = {}; velden[onbHuidig.id] = tekst;
        onbSt = await API.call('/onboarding/opslaan', { velden });
        onbBezig = false;
        onbRij = onbOpenVelden();
        onbStap = onbRij.length ? 'veld' : 'teken';
        onbVolgende();
      } catch(e){ onbBezig = false; if (fout) fout.textContent = (e && e.message) || T('onb.mis','Dat lukte niet, probeer het nog eens.'); }
    } else if (onbStap === 'teken'){
      if (tekst.length < 2){ if (fout) fout.textContent = T('onb.naamkort','Typ je volledige naam om te tekenen.'); return; }
      onbBezig = true;
      try {
        const r = await API.call('/onboarding/teken', { naam: tekst, akkoord: true });
        onbBezig = false; onbSt = r;
        if (r && r.klaar) return onbKlaar();
        onbRij = onbOpenVelden();
        onbStap = onbRij.length ? 'veld' : 'teken';
        onbVolgende();
      } catch(e){ onbBezig = false; if (fout) fout.textContent = (e && e.message) || T('onb.mis','Dat lukte niet, probeer het nog eens.'); }
    }
  }
  async function onbPaspoortGekozen(file){
    const fout = onbEl('onbFout'); if (fout) fout.textContent = '';
    if (!file) return;
    if (file.size > 5*1024*1024){ if (fout) fout.textContent = T('onb.toobig','De foto is te groot (max 5 MB).'); return; }
    const data = await snapVerklein(file); if (!data) return;
    const mrz = await onbMrzUitFoto(data);
    return onbPaspoortUpload(data, mrz);
  }
  // een gekozen foto in een canvas laden en er de MRZ uit proberen te lezen
  function onbMrzUitFoto(dataURL){
    return new Promise(function(res){
      if (!window.RTGMRZ){ res(null); return; }
      const img = new Image();
      img.onload = function(){
        try {
          const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
          cv.getContext('2d').drawImage(img, 0, 0);
          res(RTGMRZ.lees(cv));
        } catch(e){ res(null); }
      };
      img.onerror = function(){ res(null); };
      img.src = dataURL;
    });
  }
