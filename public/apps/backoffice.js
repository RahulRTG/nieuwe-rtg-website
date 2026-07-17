(function(){
  const $ = s => document.querySelector(s);
  const T = (k, nl) => (window.RTGi18n ? RTGi18n.t(k, nl) : nl);
  // klik binnen de kaart niet naar de achtergrond laten lekken (zonder inline handler)
  document.querySelectorAll('[data-stop]').forEach(el => el.addEventListener('click', e => e.stopPropagation()));
  const lang = () => (window.RTGi18n ? RTGi18n.lang : 'nl');
  // Escapet tekst die als HTML-inhoud in het scherm belandt (namen, plaatsen,
  // diensten, sollicitaties), zodat door leden/partners ingevoerde tekst nooit
  // als opmaak of script in de backoffice kan uitvoeren.
  const escHtml = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const eur = n => '€ ' + Number(n).toLocaleString(lang() === 'en' ? 'en-US' : 'nl-NL');
  const STATUS = { 'nieuw':'new', 'in bereiding':'in preparation', 'klaar':'ready', 'geserveerd':'served', 'geweigerd':'declined', 'terugbetaald':'refunded',
    'aangevraagd':'requested', 'geaccepteerd':'accepted', 'onderweg':'en route', 'aangekomen':'at pickup', 'aan-boord':'on board', 'rijdt':'on board', 'afgerond':'completed', 'gearriveerd':'completed' };
  const tStatus = s => (lang() === 'en' ? (STATUS[s] || s) : s);
  // API-client uit de gedeelde app-shell (public/shared/appshell.js).
  const API = RTGApp.maakAPI();
  let state = null, source = null;
  let tl = null, tlPage = 1, tlTimer = null;
  const enabled = API.enabled;
  const call = (path, body) => API.call(path, body);
  function timeAgo(iso){ const s=Math.max(1,Math.round((Date.now()-new Date(iso))/1000)); if(s<60)return T('t.now','zojuist'); const ago=T('t.ago',' geleden'); const m=Math.round(s/60); if(m<60)return m+T('t.min',' min')+ago; const h=Math.round(m/60); if(h<24)return h+T('t.h',' u')+ago; return Math.round(h/24)+T('t.d',' d')+ago; }

  /* Het inloggen woont in de personeels-app (kantoor-ingang, met TOTP als die
     is ingesteld); zonder geldige sessie sturen we daarheen, met een
     terug-adres zodat u na het inloggen weer hier staat. */
  function naarInlog(){
    location.replace('/apps/personeel.html?kantoor=1&terug=' + encodeURIComponent(location.pathname + location.search));
  }

  // Werk-OS-bord: Cmd+K (of de Panelen-knop in de kop) opent een springboard
  // over het bord; een tik scrolt naar het paneel en licht het even op.
  let wosBord = null;
  function startWerkOS(){
    if (wosBord || !window.WerkOS) return;
    const apps = [];
    document.querySelectorAll('#app .panel h2, #app .panel2 h2, #app h2').forEach(h => {
      const el = h.closest('.panel') || h.closest('.card') || h.parentElement;
      if (!el || apps.some(a => a.el === el)) return;
      const lab = h.querySelector('[data-i18n]');
      const ruw = ((lab ? lab.textContent : h.textContent) || '').trim().replace(/\s+/g, ' ');
      const emoji = ((h.textContent || '').match(/\p{Extended_Pictographic}/u) || [])[0] || '▦';
      const naam = ruw.replace(/^[^\p{L}]+/u, '').replace(/[▾▸›\s]+$/g, '').split('·')[0].trim().slice(0, 26);
      if (naam) apps.push({ naam, icoon: emoji, el });
    });
    wosBord = WerkOS.bord({ titel: 'RTG Backoffice, alle panelen', apps, knopIn: document.querySelector('header .wrap > span') });
  }

  function enterApp(){
    $('#gate').style.display = 'none';
    $('#app').classList.add('on');
    $('#liveInd').style.display = 'inline-flex';
    startWerkOS();
    render();
    laadTimeline();
    loadVerify();
    loadConcierge();
    loadIncidenten();
    loadSalonNaleving();
    loadOntmoetingen();
    loadTrust();
    stream();
  }

  // Blijf ingelogd: met een bewaard token direct het overzicht in; zonder
  // (of met een verlopen) token gaat het via de ene inlog in de personeels-app.
  (async function restoreSession(){
    if (!enabled) return;
    let t = null; try { t = localStorage.getItem('rtg_office_token'); } catch(e){}
    if (!t){ naarInlog(); return; }
    API.token = t;
    try {
      state = (await call('/office/state')).state;
      enterApp();
    } catch(e){
      API.token = null;
      try { localStorage.removeItem('rtg_office_token'); } catch(e2){}
      naarInlog();
    }
  })();

  async function refresh(){ try { state = (await call('/office/state')).state; render(); } catch(e){} }

  async function loadVerify(){
    let pend = [];
    try { pend = (await call('/office/verifications')).pending || []; } catch(e){ return; }
    $('#verify').innerHTML = pend.length ? pend.map(v =>
      '<div class="vrow" data-id="'+v.id+'">' +
        '<div class="vi"><div class="nm">'+escHtml(v.name)+' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+escHtml(v.codename)+'</span></div>' +
          '<div class="sub">'+escHtml(v.email||'')+' · '+escHtml(v.tier)+'</div></div>' +
        '<button class="vbtn doc" data-doc="'+v.doc+'">'+T('bo.viewdoc','Document')+'</button>' +
        '<label style="font-size:0.72rem;display:flex;align-items:center;gap:0.3rem;"><input type="checkbox" data-face checked> '+T('bo.face','Gezicht = paspoort')+'</label>' +
        '<button class="vbtn ok" data-ok>'+T('bo.approve','Goedkeuren')+'</button>' +
        '<button class="vbtn no" data-no>'+T('bo.reject','Afwijzen')+'</button>' +
      '</div>').join('') : '<div class="empty">'+T('bo.noverify','Geen openstaande verificaties.')+'</div>';
    $('#verify').querySelectorAll('.vrow').forEach(row => {
      const id = Number(row.dataset.id);
      row.querySelector('[data-doc]').addEventListener('click', e => {
        $('#docImg').src = '/api/office/doc?token='+encodeURIComponent(API.token)+'&file='+encodeURIComponent(e.target.dataset.doc);
        $('#docScrim').classList.add('open');
      });
      row.querySelector('[data-ok]').addEventListener('click', () => decide(id, 'approve', row.querySelector('[data-face]').checked));
      row.querySelector('[data-no]').addEventListener('click', () => decide(id, 'reject', false));
    });
  }
  async function decide(userId, decision, faceMatch){
    try { await call('/office/verify', { userId, decision, faceMatch: !!faceMatch }); } catch(e){ alert(e.message); return; }
    loadVerify();
  }

  // ---- paspoort-incidenten: RTG beoordeelt of een opgeeiste identiteit vrijkomt ----
  async function loadIncidenten(){
    const el = document.getElementById('incidenten'); if (!el) return;
    let inc = [];
    try { inc = (await call('/office/incidenten', { alleen: 'open' })).incidenten || []; } catch(e){ return; }
    el.innerHTML = inc.length ? inc.map(i =>
      '<div class="vrow" data-id="'+i.id+'">' +
        '<div class="vi"><div class="nm">'+escHtml(i.codenaam||'\u2013')+' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+escHtml(i.supplierName)+' · '+escHtml(i.gevraagdNiveau)+'</span></div>' +
          '<div class="sub">'+escHtml(i.reden)+'</div></div>' +
        '<button class="vbtn ok" data-vrij>'+T('bo.release','Vrijgeven')+'</button>' +
        '<button class="vbtn no" data-afw>'+T('bo.declineinc','Afwijzen')+'</button>' +
      '</div>').join('') : '<div class="empty">'+T('bo.noinc','Geen openstaande incidenten.')+'</div>';
    el.querySelectorAll('.vrow').forEach(row => {
      const id = row.dataset.id;
      row.querySelector('[data-vrij]').addEventListener('click', () => decideInc(id, 'vrijgeven'));
      row.querySelector('[data-afw]').addEventListener('click', () => decideInc(id, 'afwijzen'));
    });
  }
  async function decideInc(id, besluit){
    try { await call('/office/incident/beslis', { id, besluit }); } catch(e){ alert(e.message); return; }
    loadIncidenten();
  }

  // ---- Salon-naleving: welke partners hebben (g)een compleet profiel ----
  async function loadSalonNaleving(){
    const el = document.getElementById('salonNaleving'); if (!el) return;
    let d;
    try { d = await call('/office/salon-naleving', {}); } catch(e){ return; }
    const kop = '<div class="vrow"><div class="vi"><div class="nm">'+d.compleet+' / '+d.totaal+' '+T('bo.saloncompleet','profielen compleet')+'</div>'+
      '<div class="sub">'+(d.achter.length ? d.achter.length+' '+T('bo.salonachter','partner(s) nog niet zichtbaar voor leden') : T('bo.salonok','alle partners zijn zichtbaar'))+'</div></div></div>';
    const rows = (d.partners || []).map(p =>
      '<div class="vrow"><div class="vi"><div class="nm">'+(p.compleet?'✅':'⚠️')+' '+escHtml(p.name)+' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+escHtml(p.type)+'</span></div>'+
      '<div class="sub">'+(p.bio?'✓':'✗')+' bio · '+(p.foto?'✓':'✗')+' foto · '+p.items+' '+T('bo.salonitems','items')+' · '+p.volgers+' '+T('bo.salonvolgers','volgers')+'</div></div></div>').join('');
    el.innerHTML = kop + rows;
  }

  // ---- Salon-ontmoetingen: lopende afspraken met live-locatie en SOS ----
  async function loadOntmoetingen(){
    const el = document.getElementById('ontmoetOffice'); if (!el) return;
    let d;
    try { d = await call('/office/ontmoetingen', {}); } catch(e){ return; }
    if (!d.dates || !d.dates.length){ el.innerHTML = '<div class="empty">'+T('bo.ontgeen','Geen lopende afspraken.')+'</div>'; return; }
    el.innerHTML = d.dates.map(dt => {
      const nood = dt.sos && dt.sos.length;
      const namen = dt.deelnemers.map(p => escHtml(p.codenaam) + (p.getekend ? ' ✓' : ' ⌛')).join(' · ');
      const pos = dt.deelnemers.filter(p => p.pos).map(p => escHtml(p.codenaam) + ': ' + p.pos.lat.toFixed(4) + ', ' + p.pos.lng.toFixed(4)).join(' · ') || T('bo.ontgeenpos','nog geen locatie');
      const status = dt.status === 'noodgeval' ? '🚨 '+T('bo.ontnood','NOODGEVAL') : dt.status === 'actief' ? '🛰️ '+T('bo.ontactief','loopt') : '⌛ '+T('bo.onttekenen','wacht op tekenen');
      let sosBlok = '';
      if (nood) sosBlok = dt.sos.map(s =>
        '<div style="margin-top:0.4rem;background:rgba(220,40,40,0.12);border-radius:8px;padding:0.5rem 0.7rem;">'+
        '<b style="color:#ff8a8a;">🚨 '+escHtml(s.door)+'</b> · '+escHtml(s.bericht)+
        '<div style="margin-top:0.4rem;display:flex;gap:0.4rem;flex-wrap:wrap;">'+
        '<button class="vbtn ok" data-live="'+dt.id+'" data-naam="'+escHtml(s.door)+'">📹 '+T('bo.ontlive','Live meekijken')+'</button>'+
        '<a class="vbtn" href="tel:112" style="text-decoration:none;background:#c62828;color:#fff;">'+T('bo.ont112','Bel 112')+'</a>'+
        '<button class="vbtn" data-sosaf="'+dt.id+'" data-sosid="'+s.id+'">'+T('bo.ontsosaf','SOS afgehandeld')+'</button>'+
        '</div></div>').join('');
      return '<div class="vrow" style="'+(nood?'border:1px solid #c62828;border-radius:12px;':'')+'"><div class="vi" style="width:100%;">'+
        '<div class="nm">'+dt.icon+' '+escHtml(dt.activiteitLabel)+' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+namen+'</span></div>'+
        '<div class="sub">'+status+' · 📍 '+pos+'</div>'+ sosBlok +'</div></div>';
    }).join('');
    el.querySelectorAll('[data-sosaf]').forEach(b => b.addEventListener('click', async () => {
      try { await call('/office/ontmoeting/sos-af', { dateId: b.dataset.sosaf, sosId: b.dataset.sosid }); loadOntmoetingen(); } catch(e){ alert(e.message); }
    }));
    el.querySelectorAll('[data-live]').forEach(b => b.addEventListener('click', () => ontLiveWacht(b.dataset.live, b.dataset.naam)));
  }

  /* Live meekijken bij een SOS: het lid stuurt een WebRTC-aanbod via de office-
     stream ('ontmoeting-signaal'); wij openen het beeld en antwoorden terug. */
  let ontPc = null, ontLiveDate = null, ontIce = null;
  async function ontHaalIce(){ try { ontIce = (await (await fetch('/api/ice')).json()).iceServers; } catch(e){ ontIce = [{ urls:'stun:stun.l.google.com:19302' }]; } return ontIce; }
  function ontLiveWacht(dateId, naam){
    ontLiveDate = dateId;
    $('#ontLiveNaam').textContent = '🚨 ' + naam;
    $('#ontLiveStatus').textContent = T('bo.ontwacht','Wachten op het camerabeeld van het lid…');
    $('#ontLiveVid').srcObject = null;
    $('#ontLiveScrim').style.display = 'flex';
  }
  function ontLiveSluit(){
    $('#ontLiveScrim').style.display = 'none';
    if (ontPc){ try { ontPc.close(); } catch(e){} ontPc = null; }
    ontLiveDate = null;
  }
  async function opOntSignaal(d){
    if (!d || !d.payload || (ontLiveDate && d.dateId !== ontLiveDate)) return;
    // een nieuw aanbod: open het scherm als dat nog niet openstaat
    if (d.payload.sdp && d.payload.sdp.type === 'offer'){
      ontLiveDate = d.dateId;
      if ($('#ontLiveScrim').style.display !== 'flex'){ $('#ontLiveNaam').textContent = '🚨 ' + (d.codenaam||'SOS'); $('#ontLiveScrim').style.display = 'flex'; }
      await ontHaalIce();
      if (ontPc){ try { ontPc.close(); } catch(e){} }
      ontPc = new RTCPeerConnection({ iceServers: ontIce || [{ urls:'stun:stun.l.google.com:19302' }] });
      ontPc.ontrack = e => { $('#ontLiveVid').srcObject = e.streams[0]; $('#ontLiveStatus').textContent = T('bo.ontlivenu','Live beeld en geluid van het lid.'); };
      ontPc.onicecandidate = e => { if (e.candidate) call('/office/ontmoeting/signaal', { dateId: d.dateId, naarKey: d.van, payload: { ice: e.candidate } }).catch(()=>{}); };
      await ontPc.setRemoteDescription(new RTCSessionDescription(d.payload.sdp));
      const ans = await ontPc.createAnswer();
      await ontPc.setLocalDescription(ans);
      await call('/office/ontmoeting/signaal', { dateId: d.dateId, naarKey: d.van, payload: { sdp: ontPc.localDescription } });
    } else if (d.payload.ice && ontPc){
      try { await ontPc.addIceCandidate(new RTCIceCandidate(d.payload.ice)); } catch(e){}
    }
  }
  document.getElementById('ontLiveClose').addEventListener('click', ontLiveSluit);

  let convData = [], convUser = null;
  async function loadConcierge(){
    try { convData = (await call('/office/conversations')).conversations || []; } catch(e){ return; }
    $('#concierge').innerHTML = convData.length ? convData.map(c =>
      '<div class="vrow" data-uid="'+c.userId+'"><div class="vi"><div class="nm">'+escHtml(c.codename)+
        ' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+escHtml(c.tier)+'</span>'+
        (c.needsConcierge?' <span class="pill nieuw">'+T('bo.waiting','wacht')+'</span>':'')+'</div>'+
        '<div class="sub">'+(c.lastFrom==='concierge'?'↩ ':'')+escHtml((c.last||'').slice(0,55))+'</div></div>'+
        '<button class="vbtn ok" data-open>'+T('bo.open','Open')+'</button></div>'
    ).join('') : '<div class="empty">'+T('bo.noconv','Nog geen gesprekken.')+'</div>';
    $('#concierge').querySelectorAll('.vrow').forEach(row =>
      row.querySelector('[data-open]').addEventListener('click', () => openThread(Number(row.dataset.uid))));
    if (convUser && $('#convScrim').classList.contains('open')) openThread(convUser);
  }
  // Vertrouwenslijn: personeel van partners bereikt hier vertrouwelijk de
  // vertrouwenspersoon van RTG; de werkgever ziet deze gesprekken nooit.
  let trustData = [], trustId = null;
  async function loadTrust(){
    try { trustData = (await call('/office/trust')).threads || []; } catch(e){ return; }
    $('#trustList').innerHTML = trustData.length ? trustData.map(t =>
      '<div class="vrow"><div class="vi"><div class="nm">'+escHtml(t.name)+' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+escHtml(t.company)+'</span>'+
      (t.open?' <span class="pill nieuw">'+T('bo.waiting','wacht')+'</span>':'')+'</div>'+
      '<div class="sub">'+escHtml(((t.messages[t.messages.length-1]||{}).text||'').slice(0,55))+'</div></div>'+
      '<button class="vbtn ok" data-trust="'+t.id+'">'+T('bo.open','Open')+'</button></div>'
    ).join('') : '<div class="empty">'+T('bo.notrust','Geen berichten. De vertrouwenslijn is er voor het personeel van partners; werkgevers zien hier niets van.')+'</div>';
    $('#trustList').querySelectorAll('[data-trust]').forEach(b => b.addEventListener('click', () => openTrustThread(b.dataset.trust)));
    if (trustId && $('#convScrim').classList.contains('open')) openTrustThread(trustId);
  }
  function openTrustThread(id){
    const t = trustData.find(x => x.id === id); if (!t) return;
    trustId = id; convUser = null;
    $('#convWho').textContent = '🤝 ' + t.name + ' · ' + t.company;
    $('#convBody').innerHTML = t.messages.map(m =>
      '<div class="cmsg '+(m.from==='staff'?'in':'out')+'">'+escHtml(m.text)+'</div>').join('');
    $('#convScrim').classList.add('open');
    setTimeout(()=>{ const b=$('#convBody'); b.scrollTop=b.scrollHeight; }, 30);
  }

  function openThread(uid){
    const c = convData.find(x => x.userId === uid); if (!c) return;
    convUser = uid;
    trustId = null;
    $('#convWho').textContent = c.codename + ' · ' + c.tier;
    $('#convBody').innerHTML = c.messages.map(m =>
      '<div class="cmsg '+(m.from==='member'?'in':'out')+'">'+escHtml(m.text)+'</div>'
    ).join('');
    $('#convScrim').classList.add('open');
    setTimeout(()=>{ const b=$('#convBody'); b.scrollTop=b.scrollHeight; }, 30);
  }
  $('#convClose').addEventListener('click', () => { $('#convScrim').classList.remove('open'); trustId = null; });
  $('#convScrim').addEventListener('click', () => { $('#convScrim').classList.remove('open'); trustId = null; });
  $('#convReply').addEventListener('submit', async e => {
    e.preventDefault();
    const t = $('#convText').value.trim(); if (!t) return;
    if (trustId){
      try { await call('/office/trust/reply', { id: trustId, text: t }); $('#convText').value=''; await loadTrust(); openTrustThread(trustId); refresh(); }
      catch(e2){ alert(e2.message); }
      return;
    }
    if (!convUser) return;
    try { convData = (await call('/office/reply', { userId: convUser, text: t })).conversations || convData; $('#convText').value=''; openThread(convUser); loadConcierge(); }
    catch(e2){ alert(e2.message); }
  });

  function render(){
    const st2 = state.stats || {};
    const alerts = state.alerts || [];
    // globale zoekfilter: een veld dat door alle lijsten heen zoekt
    const q = (($('#zoekInp')||{}).value || '').trim().toLowerCase();
    const past = function(){ return !q || [].slice.call(arguments).join(' ').toLowerCase().includes(q); };
    $('#stat').innerHTML =
      '<div class="b"><div class="l">'+T('bo.partners','Partners')+'</div><div class="v">'+state.suppliers.length+'</div></div>' +
      '<div class="b"><div class="l">'+T('bo.livenu','Nu onderweg')+'</div><div class="v">'+(st2.liveNu||0)+'</div></div>' +
      '<div class="b"><div class="l">'+T('bo.today','Vandaag')+'</div><div class="v a">'+(st2.aantalVandaag||0)+' · '+eur(st2.omzetVandaag||0)+'</div></div>' +
      '<div class="b"><div class="l">'+T('bo.weekrev','Weekomzet')+'</div><div class="v g">'+eur(st2.omzetWeek||0)+'</div></div>' +
      '<div class="b"><div class="l">RTFoundation</div><div class="v g">'+eur(st2.foundation||0)+'</div></div>' +
      (st2.fondsAfdracht ? '<div class="b"><div class="l">'+T('bo.rtfteStorten','RTF af te dragen')+'</div><div class="v'+(st2.fondsAfdracht.teStorten>0 && !st2.fondsAfdracht.iban?' a':' g')+'">'+eur(st2.fondsAfdracht.teStorten||0)+'</div><div class="sub">'+(st2.fondsAfdracht.iban?(T('bo.rtfNaar','naar')+' '+escHtml(st2.fondsAfdracht.iban)):T('bo.rtfGeenIban','IBAN nog niet ingesteld'))+'</div></div>' : '') +
      (st2.muntOntvangst && st2.muntOntvangst.aan ? '<div class="b"><div class="l">'+T('bo.munt','Munten (in euro)')+'</div><div class="v g">'+eur(st2.muntOntvangst.ontvangen||0)+'</div>'+(st2.muntOntvangst.wacht?'<div class="sub">'+st2.muntOntvangst.wacht+' '+T('bo.muntWacht','openstaand')+'</div>':'')+'</div>' : '') +
      '<div class="b"><div class="l">'+T('bo.actions','Open acties')+'</div><div class="v'+(alerts.some(a=>a.level==='rood')?' a':'')+'">'+alerts.length+'</div></div>';

    // actiecentrum: vastgelopen zaken bovenaan, met een herinneringsknop
    $('#alertList').innerHTML = alerts.length ? alerts.map(a => {
      const koeling = a.nudgedAt && (Date.now() - new Date(a.nudgedAt)) < 10*60000;
      const knop = (a.kind === 'order' || a.kind === 'ride')
        ? (koeling ? '<span class="pill klaar">'+T('bo.nudged','herinnerd')+'</span>'
                   : '<button class="vbtn ok" data-nudge="'+a.ref+'" data-nkind="'+a.kind+'">⏰ '+T('bo.nudge','Stuur herinnering')+'</button>')
        : '';
      return '<div class="alert '+a.level+'"><span class="lv"></span><div class="tx">'+escHtml(a.text)+'</div>'+knop+'</div>';
    }).join('') : '<div class="empty">✓ '+T('bo.noalerts','Alles loopt. Vastgelopen bestellingen, wachtende leden en open beoordelingen verschijnen hier vanzelf.')+'</div>';
    $('#alertList').querySelectorAll('[data-nudge]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await call('/office/nudge', { ref: b.dataset.nudge, kind: b.dataset.nkind }); await refresh(); }
      catch(e){ alert(e.message); b.disabled = false; }
    }));

    // partnerprestaties: omzetranglijst met open werk en gemiddelde ritduur
    const perf = state.performance || [];
    const maxOmzet = Math.max.apply(null, perf.map(p=>p.omzet).concat([1]));
    const medaille = ['🥇','🥈','🥉'];
    $('#perfList').innerHTML = perf.length ? perf.filter(p => past(p.name, p.code, p.type)).map((p, i) =>
      '<div class="row"><div class="r1"><div style="flex:1;min-width:0;"><div class="nm">'+(medaille[i]||'')+' '+p.name+
        ' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+p.code+'</span></div>'+
        '<div class="sub">'+p.aantal+' '+T('bo.trans','transactie(s)')+' · '+p.openNu+' '+T('bo.opennow','nu open')+
        (p.gemMin!=null?' · Ø '+p.gemMin+' '+T('bo.minride','min per rit'):'')+'</div>'+
        '<div class="perfbar"><i style="width:'+Math.max(2, Math.round(p.omzet/maxOmzet*100))+'%;"></i></div></div>'+
        '<div class="amt g">'+eur(p.omzet)+'</div></div></div>'
    ).join('') : '<div class="empty">'+T('bo.noperf','Nog geen partnercijfers.')+'</div>';

    // omzet per dag: de laatste zeven dagen als staafjes, vandaag uitgelicht
    const wk = state.week || [];
    const maxDag = Math.max.apply(null, wk.map(d=>d.omzet).concat([1]));
    $('#weekChart').innerHTML = wk.map((d, i) =>
      '<div class="cb'+(i===wk.length-1?' vandaag':'')+'" title="'+d.aantal+' '+T('bo.trans','transactie(s)')+'">'+
      '<b>'+(d.omzet?eur(d.omzet):'·')+'</b><i style="height:'+Math.max(2, Math.round(d.omzet/maxDag*72))+'%;"></i><span>'+d.label+'</span></div>'
    ).join('');

    const live = (state.live || []).filter(g => past(g.codename, (g.dest&&g.dest.name)||'', (g.partners||[]).join(' ')));
    $('#liveList').innerHTML = live.length ? live.map(g =>
      '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(g.codename)+
        (g.dest?' <span style="color:var(--soft);font-weight:400;">· '+T('bo.to','naar')+' '+escHtml(g.dest.name)+'</span>':'')+'</div>'+
        '<div class="sub">'+(g.arrived?'✓ '+T('bo.arrived','gearriveerd'):T('bo.onthemove','onderweg')+' ('+T('bo.mode.'+g.mode, g.mode==='walking'?'lopend':g.mode==='flying'?'vliegend':'rijdend')+')')+
        ' · '+escHtml((g.partners||[]).join(', '))+'</div></div>'+
        '<span class="pill '+(g.arrived?'klaar':'bereiding')+'">'+(g.arrived?T('bo.arrived','gearriveerd'):T('bo.live','live'))+'</span></div></div>'
    ).join('') : '<div class="empty">'+T('bo.nolive','Niemand is nu onderweg. Zodra een lid een reis live zet, ziet u hier waar zij zijn en met welke partners.')+'</div>';

    const prijzen = state.prices.filter(p => past(p.supplierName, p.service));
    $('#prices').innerHTML = prijzen.length ? prijzen.map(p =>
      '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(p.supplierName)+'</div><div class="sub">'+escHtml(p.service)+' · '+timeAgo(p.at)+'</div></div><div class="amt g">'+eur(p.price)+'</div></div></div>'
    ).join('') : '<div class="empty">'+T('bo.noprices','Nog geen prijzen. Zodra een partner een dynamische prijs doorgeeft, verschijnt die hier live.')+'</div>';

    // tijdlijn (bestellingen & ritten) komt gepagineerd van de server
    renderTimeline();
    const totals = state.totals || {};
    $('#liveTot').textContent = totals.live > (state.live || []).length ? (state.live || []).length + ' ' + T('bo.van', 'van') + ' ' + totals.live : '';

    const apps = (state.applications || []).filter(x => past(x.name, x.func, x.company));
    $('#appsList').innerHTML = apps.length ? apps.map(x => {
      const pc = x.status==='nieuw'?'nieuw':x.status==='aangenomen'?'klaar':'bereiding';
      const st = x.status==='nieuw'?T('bo.ap.new','nieuw'):x.status==='aangenomen'?T('bo.ap.hired','aangenomen'):T('bo.ap.rejected','afgewezen');
      return '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(x.name)+' <span style="color:var(--soft);font-weight:400;">· '+escHtml(x.func)+'</span>'+
        (x.viaRTG?' <span style="font-size:0.58rem;letter-spacing:0.08em;color:var(--gold);border:1px solid var(--gold);border-radius:999px;padding:0.1rem 0.45rem;vertical-align:middle;">RTG</span>':'')+'</div>'+
        '<div class="sub">'+escHtml(x.company)+' · '+timeAgo(x.at)+'</div></div>'+
        '<span class="pill '+pc+'">'+st+'</span></div></div>';
    }).join('') : '<div class="empty">'+T('bo.noapps','Nog geen sollicitaties. Kandidaten solliciteren via de partner-apps, RTG-leden via de leden-app met hun cv.')+'</div>';

    const pas = (state.partnerApplications || []).filter(x => past(x.company, x.type, x.city, x.contactName));
    $('#paList').innerHTML = pas.length ? pas.map(x => {
      const pc = x.status==='nieuw'?'nieuw':x.status==='goedgekeurd'?'klaar':'bereiding';
      const st = x.status==='nieuw'?T('bo.pa.new','nieuw'):x.status==='goedgekeurd'?T('bo.pa.ok','goedgekeurd'):T('bo.pa.no','afgewezen');
      return '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(x.company)+' <span style="color:var(--soft);font-weight:400;">· '+escHtml(x.type)+' · '+escHtml(x.city)+'</span></div>'+
        '<div class="sub">'+escHtml(x.contactName)+' · '+escHtml(x.email)+(x.phone?' · '+escHtml(x.phone):'')+' · '+timeAgo(x.at)+(x.note?'<br>"'+escHtml(x.note.slice(0,120))+'"':'')+(x.code?' · code '+escHtml(x.code):'')+'</div></div>'+
        (x.status==='nieuw'
          ? '<div style="display:flex;gap:0.4rem;flex-shrink:0;"><button class="vbtn ok" data-paok="'+x.id+'">'+T('bo.pa.approve','Goedkeuren')+'</button><button class="vbtn" data-pano="'+x.id+'">'+T('bo.pa.reject','Afwijzen')+'</button></div>'
          : '<span class="pill '+pc+'">'+st+'</span>')+
        '</div></div>';
    }).join('') : '<div class="empty">'+T('bo.nopa','Nog geen aanvragen. Bedrijven melden zich aan via de pagina "Partner worden" op de site.')+'</div>';
    document.querySelectorAll('[data-paok]').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await call('/office/partner/decide', { id: b.dataset.paok, action: 'goedkeuren' });
        const box = $('#paResult');
        box.style.display = 'block';
        box.innerHTML = '✅ '+T('bo.pa.done','Goedgekeurd. Geef dit eenmalig door (staat ook in de welkomstmail):')+
          '<br><b>'+T('bo.pa.code','Leverancierscode')+': '+d.code+'</b> · <b>'+T('bo.pa.pin','Manager-PIN')+': '+d.pin+'</b>';
        await refresh();
      } catch(e){ alert(e.message); }
    }));
    document.querySelectorAll('[data-pano]').forEach(b => b.addEventListener('click', async () => {
      try { await call('/office/partner/decide', { id: b.dataset.pano, action: 'afwijzen' }); await refresh(); } catch(e){ alert(e.message); }
    }));

    // schoolaanmeldingen: een school kan pas personeel toelaten en klassen maken
    // nadat RTG hem hier goedkeurt
    const scholen = (state.pendingSchools || []).filter(x => past(x.naam, x.code, x.plaats));
    $('#schoolList').innerHTML = scholen.length ? scholen.map(x =>
      '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(x.naam)+' <span style="color:var(--soft);font-weight:400;">· '+escHtml(x.plaats||'')+'</span></div>'+
        '<div class="sub">'+T('bo.sc.code','code')+' '+escHtml(x.code)+' · '+x.personeel+' '+T('bo.sc.staff','aanmelding(en) personeel')+' · '+timeAgo(x.at)+'</div></div>'+
        '<div style="display:flex;gap:0.4rem;flex-shrink:0;"><button class="vbtn ok" data-scok="'+escHtml(x.code)+'">'+T('bo.sc.approve','Goedkeuren')+'</button><button class="vbtn" data-scno="'+escHtml(x.code)+'">'+T('bo.sc.reject','Afwijzen')+'</button></div>'+
      '</div></div>'
    ).join('') : '<div class="empty">'+T('bo.nosc','Geen wachtende schoolaanmeldingen. Scholen melden zich aan via de RTFoundation-app; hier keurt u ze goed voordat ze personeel en klassen kunnen aanmaken.')+'</div>';
    document.querySelectorAll('[data-scok]').forEach(b => b.addEventListener('click', async () => {
      try { await call('/office/school/decide', { code: b.dataset.scok, action: 'goedkeuren' }); await refresh(); } catch(e){ alert(e.message); }
    }));
    document.querySelectorAll('[data-scno]').forEach(b => b.addEventListener('click', async () => {
      try { await call('/office/school/decide', { code: b.dataset.scno, action: 'afwijzen' }); await refresh(); } catch(e){ alert(e.message); }
    }));
  }

  // De tijdlijn is schaalvast: de server bladert en zoekt door de volledige
  // historie; het scherm toont altijd 25 regels plus het eerlijke totaal.
  async function laadTimeline(){
    try { tl = await call('/office/timeline', { page: tlPage, q: ($('#zoekInp').value || '').trim() }); }
    catch(e){ tl = { items: [], total: 0, page: 1, pages: 1 }; }
    renderTimeline();
  }
  function renderTimeline(){
    if (!tl) return;
    const KLAAR_R = { 'afgerond':1, 'gearriveerd':1, 'geweigerd':1, 'geserveerd':1, 'terugbetaald':1, 'klaar':1 };
    $('#tlTot').textContent = '(' + tl.total.toLocaleString(lang()==='en'?'en-US':'nl-NL') + ')';
    $('#orders').innerHTML = tl.items.length ? tl.items.map(x => {
      const pc = (x.status==='nieuw'||x.status==='aangevraagd')?'nieuw':KLAAR_R[x.status]?'klaar':'bereiding';
      const icoon = x.soort==='order'?'🛎️':x.soort==='jet'?'✈️':'🚗';
      return '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(x.supplierName)+' <span style="color:var(--soft);font-weight:400;">· '+T('bo.guest','gast')+' '+escHtml(x.customerCodename)+'</span></div>'+
        '<div class="sub">'+icoon+' '+escHtml(x.sub||'')+' · '+timeAgo(x.at)+(x.when?' · '+escHtml(x.when):'')+' · '+(x.paid?T('bo.paid','betaald'):T('bo.unpaid','onbetaald'))+'</div></div>'+
        '<div style="text-align:right;"><div class="amt">'+eur(x.bedrag)+'</div><span class="pill '+pc+'">'+tStatus(x.status)+'</span></div></div></div>';
    }).join('') : '<div class="empty">'+T('bo.noorders','Nog geen bestellingen of ritten via partners.')+'</div>';
    const pager = $('#tlPager');
    pager.style.display = tl.pages > 1 ? 'flex' : 'none';
    $('#tlWaar').textContent = T('bo.pagina','Pagina') + ' ' + tl.page + ' / ' + tl.pages;
    $('#tlPrev').disabled = tl.page <= 1;
    $('#tlNext').disabled = tl.page >= tl.pages;
  }
  $('#tlPrev').addEventListener('click', () => { if (tlPage > 1){ tlPage--; laadTimeline(); } });
  $('#tlNext').addEventListener('click', () => { if (tl && tlPage < tl.pages){ tlPage++; laadTimeline(); } });

  function stream(){
    if (!window.EventSource) return;
    try { source = new EventSource('/api/office/stream?token='+encodeURIComponent(API.token)); } catch(e){ return; }
    source.addEventListener('sync', () => { refresh(); laadTimeline(); loadVerify(); loadConcierge(); loadIncidenten(); loadSalonNaleving(); loadOntmoetingen(); loadTrust(); });
    source.addEventListener('notify', e => { refresh(); const p=$('#prices'); if(p) p.classList.add('flash'); setTimeout(()=>p&&p.classList.remove('flash'),1600); });
    // Salon-ontmoetingen: SOS-alarm en het live camerabeeld (WebRTC-signaal)
    source.addEventListener('ontmoeting-sos', () => { loadOntmoetingen(); const p=$('#prices'); if(p) p.classList.add('flash'); });
    source.addEventListener('ontmoeting-signaal', e => { try { opOntSignaal(JSON.parse(e.data)); } catch(err){} });
  }

  $('#docScrim').addEventListener('click', () => { $('#docScrim').classList.remove('open'); $('#docImg').src = ''; });

  // dagbriefing: een samenvatting van vandaag in gewone taal, met een tik
  $('#briefBtn').addEventListener('click', async () => {
    const box = $('#briefBox');
    if (box.classList.contains('on')){ box.classList.remove('on'); return; }
    box.textContent = '…';
    box.classList.add('on');
    try { box.textContent = (await call('/office/briefing', { lang: lang() })).briefing; }
    catch(e){ box.textContent = e.message; }
  });

  // zoeken: filtert de panelen direct en laat de server door de volledige
  // tijdlijn zoeken (met een korte adempauze tegen onnodige verzoeken)
  $('#zoekInp').addEventListener('input', () => {
    if (!state) return;
    render();
    clearTimeout(tlTimer);
    tlTimer = setTimeout(() => { tlPage = 1; laadTimeline(); }, 350);
  });

  // export voor de boekhouding: de server bouwt het volledige bestand,
  // hoe groot de historie ook is
  $('#csvBtn').addEventListener('click', () => {
    if (API.token) window.open('/api/office/export.csv?token=' + encodeURIComponent(API.token), '_blank');
  });

  window.addEventListener('rtglang', () => { if (state){ render(); loadVerify(); } });
})();
