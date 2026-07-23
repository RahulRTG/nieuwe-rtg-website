  /* ================= SALON-CONNECTIES =================
     Leden voegen elkaar toe op codenaam, chatten 1-op-1, delen posts
     en bellen elkaar. Bellen is echte WebRTC: beeld en geluid gaan
     rechtstreeks tussen de twee telefoons; de server geeft alleen de
     belsignalen door en ziet nooit het gesprek. */
  let social = { me: null, codename: null, connections: [], requests: [] };
  let socialOK = false;      // false = gast of nog niet geladen: geen sociale UI
  let dmWith = null, dmNaam = '';
  const escT = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const initCN = cn => String(cn||'?').trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();

  async function loadSocial(){
    if (!API.live) return;
    try {
      const d = await API.call('/member/connections');
      social = d; socialOK = true;
    } catch(e){ socialOK = false; }
    renderSocialBar();
    renderContacts();
    renderSpelen();
  }

  // Spelen-kaart op Home: voor elke pas (RTG, Lifestyle en Business dezelfde
  // spelgroep); alleen een anonieme demo-gast zonder account speelt niet mee
  function renderSpelen(){
    const el = $('#homeSpelen'); if (!el) return;
    // de kaart begint verborgen (hidden in de HTML): zo staat er nooit een
    // lege kaart op Home als de sociale laag (nog) niet geladen is
    if (!socialOK || !user || (user.tier === 'guest' && !user.account)){ el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = '<div class="label">'+T('spel.label','Spelen')+'</div>'+
      '<div class="big" style="font-size:1.02rem;">'+T('spel.kop','Een potje tussendoor?')+'</div>'+
      '<div class="meta" style="margin:.2rem 0 .7rem;">'+T('spel.uitleg','Schaken, Woordduel, Magnaat, 30 Seconden, Proost (18+) en Vingerroulette. Tegen vrienden of een random tegenstander; samen spelen maakt je niet automatisch vrienden.')+'</div>'+
      '<button class="go" id="gaSpelen">'+T('spel.ga','Naar de spellen')+' →</button>';
    el.querySelector('#gaSpelen').addEventListener('click', () => { location.href = '/apps/spelen.html?pas=' + encodeURIComponent(vastePas || 'rtg'); });
  }

  // Contacten-kaart op Home: na het toevoegen bericht of (video)bel je elkaar met één tik
  function snelBel(key, naam, video){ dmWith = key; dmNaam = naam; beginGesprek(video); }
  function renderContacts(){
    const el = $('#homeContacts'); if (!el) return;
    // ook een gratis account (met paspoort) chat met vrienden; alleen een
    // anonieme demo-gast zonder account niet
    if (!socialOK || !user || (user.tier === 'guest' && !user.account)){ el.style.display='none'; return; }
    el.style.display='';
    const conns = social.connections || [], reqs = social.requests || [];
    const totUnread = conns.reduce((n,c)=> n + (c.unread||0), 0);
    let html = '<div class="label">Contacten'+(totUnread?' · <span style="color:var(--gold)">'+totUnread+' nieuw</span>':'')+'</div>';
    reqs.forEach(r => {
      html += '<div style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;border-bottom:1px solid var(--line);">'+
        '<span class="sc-av" style="width:2rem;height:2rem;">'+initCN(r.codename)+'</span>'+
        '<div class="grow-min"><b>'+escT(r.codename)+'</b><div class="meta">wil verbinden</div></div>'+
        '<button class="go" style="padding:.2rem .6rem;" data-cja="'+escT(r.key)+'">Accepteer</button>'+
        '<button class="go" style="background:transparent;color:var(--muted);padding:.2rem .4rem;" data-cnee="'+escT(r.key)+'">✕</button></div>';
    });
    if (!conns.length && !reqs.length){
      html += '<div class="big" style="font-size:1.02rem;">Nog geen contacten</div>'+
        '<div class="meta" style="margin:.2rem 0 .7rem;">Voeg iemand toe in De Salon; daarna bericht of (video)bel je elkaar met één tik, zonder telefoonnummer.</div>'+
        '<button class="go" data-goto="salon">Iemand toevoegen →</button>';
    } else {
      html += conns.map(c =>
        '<div class="hc-rij" style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;border-bottom:1px solid var(--line);">'+
        '<span class="sc-av" style="width:2.2rem;height:2.2rem;cursor:pointer;" data-dm="'+escT(c.key)+'" data-cn="'+escT(c.codename)+'">'+initCN(c.codename)+(c.unread?'<span class="sc-badge">'+c.unread+'</span>':'')+'</span>'+
        '<b style="flex:1;min-width:0;cursor:pointer;" data-dm="'+escT(c.key)+'" data-cn="'+escT(c.codename)+'">'+escT(c.codename)+'</b>'+
        '<button class="go" style="padding:.2rem .5rem;" data-dm="'+escT(c.key)+'" data-cn="'+escT(c.codename)+'">Bericht</button>'+
        '<button class="go" style="background:transparent;padding:.2rem .35rem;" data-snap="'+escT(c.key)+'" data-cn="'+escT(c.codename)+'" title="Snap">'+RTGGlyf.svgHTML('camera')+'</button>'+
        '<button class="go" style="background:transparent;padding:.2rem .35rem;" data-bel="'+escT(c.key)+'" data-cn="'+escT(c.codename)+'">'+RTGGlyf.svgHTML('bellen')+'</button>'+
        '<button class="go" style="background:transparent;padding:.2rem .35rem;" data-vid="'+escT(c.key)+'" data-cn="'+escT(c.codename)+'">'+RTGGlyf.svgHTML('videobellen')+'</button></div>'
      ).join('') + '<button class="go" style="margin-top:.7rem;background:transparent;color:var(--muted);" data-goto="salon">+ Iemand toevoegen</button>';
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-dm]').forEach(b => b.addEventListener('click', () => openDm(b.dataset.dm, b.dataset.cn)));
    el.querySelectorAll('[data-snap]').forEach(b => b.addEventListener('click', () => snapKies(b.dataset.snap)));
    el.querySelectorAll('[data-bel]').forEach(b => b.addEventListener('click', () => snelBel(b.dataset.bel, b.dataset.cn, false)));
    el.querySelectorAll('[data-vid]').forEach(b => b.addEventListener('click', () => snelBel(b.dataset.vid, b.dataset.cn, true)));
    renderSnapsStories();
    el.querySelectorAll('[data-cja]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/member/connect/respond', { key: b.dataset.cja, action: 'accept' }); toast(T('sal.verbonden','Verbonden.')); loadSocial(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-cnee]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/member/connect/respond', { key: b.dataset.cnee, action: 'decline' }); loadSocial(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => openTab(b.dataset.goto)));
  }

  /* ---------- snaps en 24-uurs verhalen (Snapchat-achtig) ---------- */
  let snapNaar = null, snapStoryMode = false, snapFileEl = null;
  function snapFile(){ if (!snapFileEl){ snapFileEl = document.createElement('input'); snapFileEl.type='file'; snapFileEl.accept='image/*'; snapFileEl.style.display='none'; document.body.appendChild(snapFileEl); snapFileEl.addEventListener('change', snapGekozen); } return snapFileEl; }
  function snapKies(key){ snapNaar = key; snapStoryMode = false; snapFile().click(); }
  function storyKies(){ snapStoryMode = true; snapNaar = null; snapFile().click(); }
  async function snapGekozen(e){
    const f = e.target.files[0]; e.target.value=''; if(!f) return;
    const foto = await snapVerklein(f); if(!foto){ toast(T('snap.leesfout','Kon de foto niet lezen.')); return; }
    const tekst = prompt(T('snap.tekst','Tekst erbij (mag leeg):'),'') || '';
    try {
      if (snapStoryMode){ await API.call('/member/story/post', { foto, tekst }); toast(''+T('snap.storyok','Je verhaal staat er 24 uur op.')); loadStories(); }
      else { await API.call('/member/snap/send', { toKey: snapNaar, foto, tekst }); toast(''+T('snap.verstuurd','Snap verstuurd. Hij verdwijnt na bekijken.')); }
    } catch(err){ toast(err.message); }
  }
  function snapVerklein(file){
    return new Promise(res => { const img=new Image(), rd=new FileReader();
      rd.onload=()=>{ img.onload=()=>{ const max=1000; let w=img.width,h=img.height; if(w>max||h>max){ const r=Math.min(max/w,max/h); w=Math.round(w*r); h=Math.round(h*r);} const cv=document.createElement('canvas'); cv.width=w; cv.height=h; cv.getContext('2d').drawImage(img,0,0,w,h); res(cv.toDataURL('image/jpeg',0.7)); }; img.onerror=()=>res(null); img.src=rd.result; };
      rd.onerror=()=>res(null); rd.readAsDataURL(file); });
  }
  /* ---------- verplichte onboarding als gesprek met Rahul ----------
     Geen formulier meer: Rahul vraagt de ontbrekende gegevens één voor één,
     laat de overeenkomst lezen en laat je tekenen door je naam te typen. Alles
     loopt over dezelfde routes als voorheen (/onboarding/status|opslaan|teken
     en /verify/upload). De invoerregel + knoppen worden in 10-social-02
     bedraad; de gespreksfuncties staan hier. */
  let onbBezig = false, onbSt = null, onbRij = [], onbStap = null, onbHuidig = null, onbGeopend = false, onbMond = null;
  function onbEl(id){ return document.getElementById(id); }
  // Rahuls signatuurmond boven de onboarding, dezelfde als op de poort; en zijn
  // woorden verschijnen letter voor letter (RTGTyp) terwijl de mond meebeweegt.
  function onbMondMaak(){ const c = onbEl('onbMond'); if (c && !onbMond && window.RTGMond) onbMond = RTGMond.maak(c); }
  function onbZeg(t){
    const z = onbEl('onbTitel'); if (!z) return;
    const praat = onbMond ? function(ms){ onbMond.praat(ms); } : null;
    if (window.RTGTyp) RTGTyp.schrijf(z, t, { praat: praat });
    else { z.textContent = t; if (praat) praat(400); }
  }
  function onbInputType(t){ return t==='date'?'date':t==='email'?'email':t==='tel'?'tel':'text'; }
  function onbOpenVelden(){ return ((onbSt && onbSt.velden) || []).filter(function(v){ return !v.ingevuld; }); }

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
