/* de onboarding: het paspoort scannen of een bestand kiezen */
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
    if (inp){
      inp.type = 'text'; inp.value = ((onbSt.velden || []).find(v => v.id === 'naam') || {}).waarde || ''; inp.autocomplete = 'name';
      inp.placeholder = T('access.onb.name','Vul uw volledige naam in');
      inp.setAttribute('aria-label', T('access.onb.nameLabel','Volledige naam voor ondertekening'));
    }
    const c = (onbSt && onbSt.contract) || {};
    onbZeg(T('access.onb.review','Lees de overeenkomst en controleer uw naam hieronder. Bevestig dat u akkoord gaat voordat u verdergaat.'));
    const l = onbEl('onbLees');
    if (l){ l.textContent = c.tekst || c.titel || ''; l.hidden = true; l.tabIndex = 0; }
    onbEl('onbConsentLabel').hidden = false;
    onbEl('onbConsent').checked = false;
    onbEl('onbGo').dataset.i18n = 'access.onb.finish';
    onbEl('onbGo').textContent = T('access.onb.finish','Bevestig en open mijn RTG');
    onbActies([{ txt: T('access.onb.read','Lees de overeenkomst'), doe: onbToonLees }]);
    onbEl('onbGate').scrollTop = 0;
  }
  function onbToonLees(){
    const l = onbEl('onbLees'); if (!l) return;
    if (l.hidden){ l.textContent = ((onbSt && onbSt.contract) || {}).tekst || ''; l.hidden = false; }
    else l.hidden = true;
    const toggle = onbEl('onbActies').querySelector('[aria-controls="onbLees"]');
    if (toggle) toggle.setAttribute('aria-expanded', String(!l.hidden));
  }
  function onbActies(lijst){
    const box = onbEl('onbActies'); if (!box) return;
    box.textContent = '';
    (lijst || []).forEach(function(a){
      const b = document.createElement('button'); b.type = 'button'; b.textContent = a.txt;
      if (a.doe === onbToonLees){ b.setAttribute('aria-controls','onbLees'); b.setAttribute('aria-expanded','false'); }
      if (a.prim) b.className = 'prim'; b.addEventListener('click', a.doe); box.appendChild(b);
    });
  }
  /* Optional profile, social and business questions remain available in their
     own domains. Only required fields and explicit agreement block entry. */
  let onbInr = [], onbInrHuidig = null;
  async function onbInrichtenAanbod(){ return onbKlaar(); }
  function onbInrVolgende(){
    if (!onbInr.length) return onbMeebouwen();
    onbInrHuidig = onbInr.shift(); onbStap = 'inrichten';
    const inp = onbEl('onbIn'), rij = onbEl('onbRij');
    if (rij) rij.style.display = '';
    if (inp){ inp.type = onbInputType(onbInrHuidig.type); inp.value = ''; inp.placeholder = T('onb.typ','Typ je antwoord'); }
    // het waarom staat erbij: nooit een veld zonder de handeling die erom vraagt
    onbZeg(onbInrHuidig.vraag + ' ' + (onbInrHuidig.waarom || ''));
    onbActies([{ txt: T('onb.inr.sla','Sla dit over'), doe: onbInrVolgende }]);
    if (inp) inp.focus();
  }
  async function onbInrOpslaan(t){
    const velden = {}; velden[onbInrHuidig.id] = t;
    onbBezig = true;
    try { await API.call('/onboarding/inricht', { velden }); } catch(e){}
    onbBezig = false; onbInrVolgende();
  }

  function onbKlaar(){
    const g = onbEl('onbGate'); if (g) g.hidden = true;
    onbStap = null; onbGeopend = false; onbSt = null; onbRij = []; onbInr = []; onbInrHuidig = null; onbMb = []; onbMbHuidig = null;
    onbActies([]); const l = onbEl('onbLees'); if (l){ l.hidden = true; }
    naarWereldkeuze();
    toast(T('access.onb.welcome','Welkom bij RTG. Uw account is klaar voor gebruik.'));
  }
  async function onbInvoer(tekst){
    if (onbBezig || !onbStap) return;
    tekst = String(tekst == null ? '' : tekst).trim();
    const inp = onbEl('onbIn');
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
    } else if (onbStap === 'inrichten'){
      if (!tekst || !onbInrHuidig) return;
      return onbInrOpslaan(tekst);
    } else if (onbStap === 'meebouw'){
      if (!tekst || !onbMbHuidig) return;
      return onbMbOpslaan(tekst);
    } else if (onbStap === 'teken'){
      if (!onbEl('onbConsent').checked){
        if (fout) fout.textContent = T('access.onb.consent','Bevestig dat u de overeenkomst heeft gelezen en ermee akkoord gaat.');
        onbEl('onbConsent').focus(); return;
      }
      if (tekst.length < 2){ if (fout) fout.textContent = T('access.onb.nameShort','Vul uw volledige naam in om de overeenkomst te ondertekenen.'); return; }
      onbBezig = true; onbEl('onbGo').disabled = true;
      try {
        const r = await API.call('/onboarding/teken', { naam: tekst, akkoord: true });
        onbBezig = false; onbSt = r;
        if (r && r.klaar) return onbInrichtenAanbod();
        onbRij = onbOpenVelden();
        onbStap = onbRij.length ? 'veld' : 'teken';
        onbVolgende();
      } catch(e){ onbBezig = false; if (fout) fout.textContent = (e && e.message) || T('onb.mis','Dat lukte niet. Probeer het opnieuw.'); }
      finally { onbEl('onbGo').disabled = false; }
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
  // Het onboarding-gesprek bedraden: de invoerregel, de stuur-knop en de
  // paspoort-upload. De gespreksfuncties zelf staan in 10-social-01.
  (function initOnbGesprek(){
    const go = document.getElementById('onbGo'), inp = document.getElementById('onbIn');
    if (go && inp) go.addEventListener('click', function(){ onbInvoer(inp.value); });
    if (inp) inp.addEventListener('keydown', function(e){ if (e.key === 'Enter'){ e.preventDefault(); onbInvoer(inp.value); } });
    const kf = document.getElementById('onbKycFile');
    if (kf) kf.addEventListener('change', function(){ const f = kf.files[0]; kf.value = ''; onbPaspoortGekozen(f); });
  })();

