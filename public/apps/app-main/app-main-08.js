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
    naarWereldkeuze();
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
  // Het onboarding-gesprek bedraden: de invoerregel, de stuur-knop en de
  // paspoort-upload. De gespreksfuncties zelf staan in 10-social-01.
  (function initOnbGesprek(){
    const go = document.getElementById('onbGo'), inp = document.getElementById('onbIn');
    if (go && inp) go.addEventListener('click', function(){ onbInvoer(inp.value); });
    if (inp) inp.addEventListener('keydown', function(e){ if (e.key === 'Enter'){ e.preventDefault(); onbInvoer(inp.value); } });
    const kf = document.getElementById('onbKycFile');
    if (kf) kf.addEventListener('change', function(){ const f = kf.files[0]; kf.value = ''; onbPaspoortGekozen(f); });
  })();

  function snapOverlay(){
    let ov = document.getElementById('snapOv'); if (ov) return ov;
    ov = document.createElement('div'); ov.id='snapOv';
    ov.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.9);display:none;flex-direction:column;align-items:center;justify-content:center;padding:1rem;';
    ov.innerHTML='<button id="snapOvX" style="position:absolute;top:1rem;right:1rem;background:none;border:none;color:#fff;font-size:1.6rem;">✕</button>'+
      '<div id="snapOvVan" style="color:#fff;font-size:.85rem;margin-bottom:0.5rem;"></div>'+
      '<img id="snapOvImg" alt="" style="max-width:100%;max-height:72vh;border-radius:12px;">'+
      '<div id="snapOvTxt" style="color:#fff;margin-top:0.75rem;text-align:center;"></div>'+
      '<div id="snapOvNote" style="color:#999;font-size:.72rem;margin-top:0.75rem;"></div>';
    document.body.appendChild(ov);
    ov.querySelector('#snapOvX').addEventListener('click', ()=>{ ov.style.display='none'; ov.querySelector('#snapOvImg').src=''; loadSocial(); });
    return ov;
  }
  async function renderSnapsStories(){
    const el = $('#homeContacts'); if (!el || !socialOK) return;
    // verhalen-strip + inkomende snaps bovenaan de contactenkaart
    let stories = [], snaps = [];
    try { stories = (await API.call('/member/stories')).stories || []; } catch(e){}
    try { snaps = (await API.call('/member/snaps')).snaps || []; } catch(e){}
    let box = el.querySelector('#snapStrip');
    if (!box){ box = document.createElement('div'); box.id='snapStrip'; el.insertBefore(box, el.firstChild.nextSibling); }
