/* De housekeeper-PDA: de vloer op zak. Kamers in de slimste volgorde (de AI
   weegt aankomende gasten mee), een tik per stap (vuil -> bezig -> schoon ->
   vrijgeven voor vroege check-in), minibar boeken op de kamer, klussen en
   gevonden voorwerpen. Alles live met de receptie en de hotel-app (SSE). */
(function(){
  const $ = s => document.querySelector(s);
  const T = (k, nl) => (window.RTGi18n ? RTGi18n.t(k, nl) : nl);
  const lang = () => (window.RTGi18n ? RTGi18n.lang : 'nl');
  const eur = n => '€ ' + Number(n).toLocaleString(lang() === 'en' ? 'en-US' : 'nl-NL');

  // housekeeping is er voor hotels en appartementen, en net zo goed voor
  // schoonmaakbedrijven en zelfstandigen: zonder kamers werkt de app op
  // opdrachten (boekingen) in plaats van op een kamerbord
  const ZAKEN = [
    { code: 'HOSHI', name: 'Aguamarina Ibiza', icon: '🏨', sub: 'Hotel, Santa Eularia' },
    { code: 'SAKURA', name: 'Villa Bahia Ibiza', icon: '🏡', sub: 'Appartementen, Cala Jondal' },
    { code: 'AYAKA', name: 'Atelier Marfil', icon: '🧑‍🎨', sub: 'Zelfstandige, diensten op locatie' },
    { code: 'KAITO', name: 'Studio Milan', icon: '🏋️', sub: 'Zelfstandige, diensten op locatie' }
  ];

  const API = RTGApp.maakAPI();
  let state = null, me = null, code = null;
  let mbOpen = null;          // kamer waarvan de minibar-teller openstaat
  let mbTel = {};             // minibar-aantallen van die kamer
  let toastTimer;
  function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),3000); }
  function esc(x){ return String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
  function timeAgo(iso){ const s=Math.max(1,Math.round((Date.now()-new Date(iso))/1000)); if(s<60)return T('t.now','zojuist'); const m=Math.round(s/60); if(m<60)return m+T('t.min',' min'); const h=Math.round(m/60); if(h<24)return h+T('t.hour',' uur'); return Math.round(h/24)+T('t.days',' dg'); }

  /* ---------- de stappen-gate: zaak -> wie -> pincode ---------- */
  function stepZaak(){
    $('#gate').innerHTML = '<span class="badge">'+T('hk.badge','RTG Housekeeping')+'</span>'+
      '<h1>'+T('hk.title','De vloer op <em>zak</em>.')+'</h1>'+
      '<p class="deck">'+T('hk.deck','Kamers, klussen, minibar en gevonden voorwerpen. Een tik per stap; de receptie ziet alles live.')+'</p>'+
      '<div class="glist" role="group" aria-label="'+T('hk.kies','Kies uw hotel')+'">'+
      ZAKEN.map(z => '<button class="gbtn" data-zaak="'+z.code+'"><span class="ic">'+z.icon+'</span><span><b>'+z.name+'</b><span>'+z.sub+'</span></span></button>').join('')+'</div>';
    document.querySelectorAll('[data-zaak]').forEach(b => b.addEventListener('click', () => stepWie(b.dataset.zaak)));
  }
  async function stepWie(c){
    let roster;
    try { roster = await API.call('/supplier/roster', { code: c }); }
    catch(e){ toast(e.message); return; }
    $('#gate').innerHTML = '<button class="gback" id="terug">← '+T('hk.terug','terug')+'</button>'+
      '<h1>'+T('hk.wie','Wie ben je?')+'</h1>'+
      '<div class="glist">'+(roster.staff||[]).map(m =>
        '<button class="gbtn" data-wie="'+m.id+'"><span class="ic">👤</span><span><b>'+esc(m.name)+'</b><span>'+esc(m.func||m.role)+'</span></span></button>').join('')+'</div>';
    $('#terug').addEventListener('click', stepZaak);
    document.querySelectorAll('[data-wie]').forEach(b => b.addEventListener('click', () => stepPin(c, b.dataset.wie)));
  }
  function stepPin(c, staffId){
    $('#gate').innerHTML = '<button class="gback" id="terug">← '+T('hk.terug','terug')+'</button>'+
      '<h1>'+T('hk.pin','Je pincode')+'</h1>'+
      '<div class="pinrow"><input id="pinInp" type="password" inputmode="numeric" maxlength="6" autocomplete="off" aria-label="'+T('hk.pin','Je pincode')+'"><button id="pinGo">→</button></div>';
    $('#terug').addEventListener('click', () => stepWie(c));
    const go = async () => {
      try {
        const d = await API.call('/supplier/login', { code: c, staffId: parseInt(staffId, 10), pin: $('#pinInp').value });
        API.token = d.token;
        try { localStorage.setItem('rtg_hk_token', d.token); localStorage.setItem('rtg_hk_code', c); } catch(e){}
        me = { name: d.state.actor.name, staffId: d.state.actor.staffId };
        code = c;
        binnen(d.state);
      } catch(e){ toast(e.message); }
    };
    $('#pinGo').addEventListener('click', go);
    $('#pinInp').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    $('#pinInp').focus();
  }
  async function restoreSession(){
    let t, c;
    try { t = localStorage.getItem('rtg_hk_token'); c = localStorage.getItem('rtg_hk_code'); } catch(e){}
    if (!t || !c) return false;
    API.token = t;
    try {
      const st = (await API.call('/supplier/state')).state;
      if (!st.actor || !st.actor.staffId){ API.token = null; return false; }
      me = { name: st.actor.name, staffId: st.actor.staffId };
      code = c;
      binnen(st);
      return true;
    } catch(e){ API.token = null; return false; }
  }
  function binnen(st){
    state = st;
    $('#gate').style.display = 'none';
    $('#app').classList.add('active');
    $('#wieNaam').textContent = me.name;
    $('#wieZaak').textContent = (state.supplier && state.supplier.name) || T('hk.app','Housekeeping');
    renderAll();
    startStream();
  }
  async function refresh(){ try { state = (await API.call('/supplier/state')).state; renderAll(); } catch(e){} }

  /* ---------- kamers: de slimste volgorde, een tik per stap ---------- */
  const HK_ORDE = { defect: 0, vuil: 1, bezig: 2, schoon: 3, bezet: 4 };
  const hkVan = r => (r.hk && r.hk.status) || (r.available ? 'schoon' : 'bezet');
  function renderKamers(){
    const wrap = $('#kamersWrap'); if (!wrap || !state) return;
    // zonder kamers (schoonmaakbedrijf, zzp) werkt de app op opdrachten
    if (!(state.rooms || []).length) return renderOpdrachten(wrap);
    const rooms = (state.rooms || []).slice().sort((a,b) => (HK_ORDE[hkVan(a)] ?? 9) - (HK_ORDE[hkVan(b)] ?? 9));
    let html = '';
    // de AI kijkt vooruit: gasten onderweg (GPS) bepalen de prioriteit
    const onderweg = (state.guests || []).filter(g => g.heading && !g.arrived && Number.isFinite(g.etaMin));
    const vuil = rooms.filter(r => hkVan(r) === 'vuil').length;
    if (onderweg.length && vuil)
      html += '<div class="card" style="border-left:4px solid var(--amber);"><div class="k">🧭 '+T('hk.prio','Prioriteit')+'</div>'+
        '<div style="margin-top:0.35rem;font-size:0.86rem;">'+onderweg.length+' '+T('hk.gast','gast(en) onderweg, eerste over ~')+Math.min.apply(null, onderweg.map(g=>g.etaMin))+' min · '+vuil+' '+T('hk.vuilcnt','kamer(s) vuil')+'. '+T('hk.gast2','Zorg dat er een schone kamer klaarstaat.')+'</div></div>';
    // de teller van de vloer
    const n = s2 => rooms.filter(r => hkVan(r) === s2).length;
    html += '<div class="card stat"><div><b style="color:#FF8589;">'+n('vuil')+'</b><span>'+T('hk.vuil','Vuil')+'</span></div>'+
      '<div><b style="color:#E2B93B;">'+n('bezig')+'</b><span>'+T('hk.bezig','Bezig')+'</span></div>'+
      '<div><b style="color:#7BC79B;">'+n('schoon')+'</b><span>'+T('hk.schoon','Schoon')+'</span></div>'+
      '<div><b>'+rooms.filter(r=>r.vroegVrij).length+'</b><span>'+T('hk.vrij','Vrijgegeven')+'</span></div></div>';
    html += rooms.length ? rooms.map(r => {
      const s2 = hkVan(r);
      const chip = s2==='schoon' ? '<span class="hkchip groen">'+T('hk.schoon','Schoon')+'</span>'
        : s2==='vuil' ? '<span class="hkchip rood">'+T('hk.vuil','Vuil')+'</span>'
        : s2==='bezig' ? '<span class="hkchip amber">'+T('hk.bezig','Bezig')+'</span>'
        : s2==='defect' ? '<span class="hkchip rood">⚠ '+T('hk.defect','Defect')+'</span>'
        : '<span class="hkchip">'+T('hk.bezet','Bezet')+'</span>';
      let acts = '';
      if (s2 === 'vuil') acts = '<button class="abtn" data-hk="'+r.id+'" data-st="bezig">▶ '+T('hk.start','Start')+'</button>';
      else if (s2 === 'bezig' || s2 === 'defect') acts = '<button class="abtn" data-hk="'+r.id+'" data-st="schoon">✓ '+T('hk.klaar','Schoon')+'</button>';
      else if (s2 === 'schoon') acts = r.vroegVrij
        ? '<button class="abtn ghost" data-vrij="'+r.id+'" data-op="uit">'+T('hk.vrijaf','Vrijgave intrekken')+'</button>'
        : '<button class="abtn" data-vrij="'+r.id+'" data-op="aan">🛎 '+T('hk.geefvrij','Geef vrij voor vroege check-in')+'</button>';
      return '<div class="card kamer '+s2+'">'+
        '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:0.6rem;"><b style="font-size:0.98rem;">'+esc(r.name)+'</b>'+chip+'</div>'+
        (r.hk && r.hk.at ? '<div style="font-size:0.7rem;color:var(--soft);margin-top:0.2rem;">'+timeAgo(r.hk.at)+(r.hk.by?' · '+esc(r.hk.by):'')+(r.hk.note?' · '+esc(r.hk.note):'')+'</div>' : '')+
        (r.vroegVrij ? '<div style="font-size:0.74rem;color:#7BC79B;margin-top:0.3rem;">🛎 '+T('hk.vrijchip','vrij voor vroege check-in')+'</div>' : '')+
        '<div class="row" style="flex-wrap:wrap;">'+acts+
          (s2 !== 'vuil' && s2 !== 'defect' ? '<button class="abtn ghost" data-hk="'+r.id+'" data-st="vuil">'+T('hk.checkout','Check-out (vuil)')+'</button>' : '')+
          (s2 !== 'defect' ? '<button class="abtn warn" data-defect="'+r.id+'">⚠ '+T('hk.defectmeld','Defect')+'</button>' : '')+
          '<button class="abtn ghost" data-mb="'+r.id+'">🧃 '+T('hk.minibar','Minibar')+'</button></div>'+
        (mbOpen === r.id ? minibarBlok(r) : '')+
      '</div>';
    }).join('') : '<div class="card">'+T('hk.geenkamers','Geen kamers voor deze zaak.')+'</div>';
    wrap.innerHTML = html;
    bindKamers(wrap);
  }
  /* ---------- opdrachten: de flow voor schoonmaakbedrijven en zzp'ers ----------
     Geen kamerbord maar de eigen boekingen: bevestigen, op locatie werken en
     afronden. Klussen en gevonden voorwerpen werken precies hetzelfde. */
  function renderOpdrachten(wrap){
    const bs = state.boekingen || [];
    const open = bs.filter(b => b.status === 'aangevraagd');
    const komend = bs.filter(b => b.status === 'bevestigd');
    const kaart = (b, acties) => '<div class="card kamer '+(b.status==='bevestigd'?'bezig':'vuil')+'">'+
      '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:0.6rem;"><b style="font-size:0.98rem;">'+esc(b.service && b.service.name || 'Opdracht')+'</b>'+
      '<span class="hkchip'+(b.status==='bevestigd'?' amber':' rood')+'">'+(b.status==='bevestigd'?T('hk.o.bevestigd','Ingepland'):T('hk.o.nieuw','Nieuw'))+'</span></div>'+
      '<div style="font-size:0.78rem;color:var(--soft);margin-top:0.25rem;">'+esc(b.customerCodename||'')+(b.wanneer?' · '+esc(b.wanneer):'')+(b.price?' · '+eur(b.price):'')+'</div>'+
      (b.note?'<div style="font-size:0.78rem;color:var(--muted);margin-top:0.3rem;">📝 '+esc(b.note)+'</div>':'')+
      '<div class="row" style="flex-wrap:wrap;">'+acties+'</div></div>';
    let html = '<div class="card stat"><div><b style="color:#FF8589;">'+open.length+'</b><span>'+T('hk.o.nieuw','Nieuw')+'</span></div>'+
      '<div><b style="color:#E2B93B;">'+komend.length+'</b><span>'+T('hk.o.bevestigd','Ingepland')+'</span></div></div>';
    html += open.map(b => kaart(b, '<button class="abtn" data-bk="'+b.ref+'" data-st="bevestigd">✓ '+T('hk.o.bevestig','Bevestig')+'</button><button class="abtn warn" data-bk="'+b.ref+'" data-st="geweigerd">'+T('hk.o.weiger','Weiger')+'</button>')).join('');
    html += komend.map(b => kaart(b, '<button class="abtn" data-bk="'+b.ref+'" data-st="afgerond">✓ '+T('hk.o.klaar','Rond af')+'</button>')).join('');
    if (!open.length && !komend.length) html += '<div class="card">'+T('hk.o.leeg','Geen open opdrachten. Nieuwe boekingen verschijnen hier vanzelf.')+'</div>';
    wrap.innerHTML = html;
    wrap.querySelectorAll('[data-bk]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/booking/status', { ref: b.dataset.bk, status: b.dataset.st }); await refresh(); } catch(e){ toast(e.message); }
    }));
  }

  function minibarBlok(r){
    const mb = state.minibar || [];
    return '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.5rem;">'+
      mb.map(x => '<div class="mbrow"><span style="font-size:0.86rem;">'+esc(x.name)+' <span style="color:var(--soft);font-size:0.74rem;">'+eur(x.price)+'</span></span>'+
        '<span class="q"><button data-mbmin="'+x.id+'" aria-label="minder">−</button><b>'+(mbTel[x.id]||0)+'</b><button data-mbplus="'+x.id+'" aria-label="meer">+</button></span></div>').join('')+
      '<button class="abtn" data-mbboek="'+r.name+'" style="width:100%;margin-top:0.4rem;">'+T('hk.boek','Boek op de kamer')+'</button></div>';
  }
  function bindKamers(wrap){
    wrap.querySelectorAll('[data-hk]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/room/hk', { id: b.dataset.hk, status: b.dataset.st }); await refresh(); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-vrij]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/room/vrij', { id: b.dataset.vrij, op: b.dataset.op === 'aan' }); toast(b.dataset.op==='aan' ? '🛎 '+T('hk.vrijtoast','Vrijgegeven; de receptie ziet het direct.') : T('hk.vrijaf','Vrijgave intrekken')); await refresh(); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-defect]').forEach(b => b.addEventListener('click', async () => {
      const note = prompt(T('hk.defectq','Wat is er kapot?'), '');
      if (note === null) return;
      try { await API.call('/supplier/room/hk', { id: b.dataset.defect, status: 'defect', note }); await refresh(); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-mb]').forEach(b => b.addEventListener('click', () => {
      mbOpen = mbOpen === b.dataset.mb ? null : b.dataset.mb;
      mbTel = {};
      renderKamers();
    }));
    wrap.querySelectorAll('[data-mbplus]').forEach(b => b.addEventListener('click', () => { mbTel[b.dataset.mbplus] = (mbTel[b.dataset.mbplus]||0)+1; renderKamers(); }));
    wrap.querySelectorAll('[data-mbmin]').forEach(b => b.addEventListener('click', () => { mbTel[b.dataset.mbmin] = Math.max(0,(mbTel[b.dataset.mbmin]||0)-1); renderKamers(); }));
    wrap.querySelectorAll('[data-mbboek]').forEach(b => b.addEventListener('click', async () => {
      const items = Object.entries(mbTel).filter(([,q]) => q > 0).map(([id, qty]) => ({ id, qty }));
      if (!items.length) return;
      try { await API.call('/supplier/minibar/count', { room: b.dataset.mbboek, items }); mbOpen = null; mbTel = {}; toast('🧃 '+T('hk.geboekt','Geboekt op de kamer.')); await refresh(); } catch(e){ toast(e.message); }
    }));
  }

  /* ---------- klussen en gevonden voorwerpen ---------- */
  function renderKlussen(){
    const wrap = $('#klussenWrap'); if (!wrap || !state) return;
    const open = (state.tickets || []).filter(t => t.status !== 'klaar');
    const kamers = (state.rooms || []).map(r => r.name);
    const kamerSel = id => '<select class="hin" id="'+id+'" style="flex:1;"><option value="">'+T('hk.geenk','geen kamer')+'</option>'+kamers.map(k=>'<option>'+esc(k)+'</option>').join('')+'</select>';
    let html = '<div class="card"><div class="k">🔧 '+T('hk.klus.open','Open klussen')+' ('+open.length+')</div>'+
      (open.length ? open.map(t => '<div class="task"><div class="t"><b>'+esc(t.text)+'</b><span>'+(t.room?esc(t.room)+' · ':'')+timeAgo(t.at)+(t.status==='bezig'&&t.by?' · '+esc(t.by):'')+'</span></div>'+
        (t.status==='open' ? '<button class="abtn ghost" data-klus="'+t.id+'" data-st="bezig">'+T('hk.pak','Oppakken')+'</button>' : '')+
        '<button class="abtn" data-klus="'+t.id+'" data-st="klaar">✓ '+T('hk.rond','Klaar')+'</button></div>').join('')
      : '<div style="margin-top:0.4rem;font-size:0.8rem;color:var(--soft);">'+T('hk.geenklus','Geen open klussen.')+'</div>')+
      '<div class="row"><input class="hin" id="klusTekst" placeholder="'+T('hk.klus.ph','Omschrijf de klus...')+'" style="flex:2;">'+kamerSel('klusKamer')+'</div>'+
      '<button class="abtn" id="klusMeld" style="width:100%;margin-top:0.5rem;">'+T('hk.klus.meld','Meld klus')+'</button></div>';
    const lf = (state.lostfound || []).slice(0, 6);
    html += '<div class="card"><div class="k">🧳 '+T('hk.lf','Gevonden voorwerp')+'</div>'+
      '<div class="row"><input class="hin" id="lfItem" placeholder="'+T('hk.lf.item','Wat heb je gevonden?')+'" style="flex:2;">'+kamerSel('lfKamer')+'</div>'+
      '<div class="row"><input class="hin" id="lfPlek" placeholder="'+T('hk.lf.plek','Bewaarplek')+'"></div>'+
      '<button class="abtn" id="lfMeld" style="width:100%;margin-top:0.5rem;">'+T('hk.lf.meld','Registreer')+'</button>'+
      (lf.length ? '<div class="k" style="margin-top:0.8rem;">'+T('hk.lf.recent','Laatst geregistreerd')+'</div>'+
        lf.map(x => '<div class="task"><div class="t"><b>'+esc(x.item)+'</b><span>'+(x.room?esc(x.room)+' · ':'')+(x.storage?esc(x.storage)+' · ':'')+timeAgo(x.at)+'</span></div></div>').join('') : '')+'</div>';
    wrap.innerHTML = html;
    wrap.querySelectorAll('[data-klus]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/ticket/status', { id: b.dataset.klus, status: b.dataset.st }); await refresh(); } catch(e){ toast(e.message); }
    }));
    const km = $('#klusMeld'); if (km) km.addEventListener('click', async () => {
      const text = $('#klusTekst').value.trim(); if (!text) return;
      try { await API.call('/supplier/ticket/add', { text, room: $('#klusKamer').value }); toast('🔧 '+T('hk.klusok','Klus gemeld.')); await refresh(); } catch(e){ toast(e.message); }
    });
    const lm = $('#lfMeld'); if (lm) lm.addEventListener('click', async () => {
      const item = $('#lfItem').value.trim(); if (!item) return;
      try { await API.call('/supplier/lost/add', { item, room: $('#lfKamer').value, storage: $('#lfPlek').value }); toast('🧳 '+T('hk.lfok','Geregistreerd.')); await refresh(); } catch(e){ toast(e.message); }
    });
  }

  /* ---------- meer: de klok, het team en de volledige PDA ---------- */
  function renderMeer(){
    const wrap = $('#meerWrap'); if (!wrap || !state) return;
    const binnenNu = !!(state.klok && (state.klok.binnen || []).includes(me.name));
    // collega's bellen: alleen wie is ingeklokt is bereikbaar
    const collegas = (state.staff || []).filter(m => m.id !== me.staffId);
    wrap.innerHTML = '<div class="card"><div class="k">⏱ '+T('hk.klok','Klok')+'</div>'+
      '<div style="display:flex;align-items:center;gap:0.7rem;margin-top:0.5rem;"><span style="font-size:0.9rem;">'+(binnenNu?'🟢 '+T('hk.binnen','Ingeklokt'):'⚪ '+T('hk.nietin','Niet ingeklokt'))+'</span>'+
      '<button class="abtn" id="klokBtn" style="margin-left:auto;">'+(binnenNu?T('hk.uit','Klok uit'):T('hk.in','Klok in'))+'</button></div>'+
      '<div style="font-size:0.72rem;color:var(--soft);margin-top:0.5rem;">'+T('hk.klok.deck','Inklokken via de app: zo ziet de zaak precies wie wanneer en hoelang werkt.')+'</div></div>'+
      (collegas.length ? '<div class="card"><div class="k">📞 '+T('hk.bel','Collega bellen')+'</div>'+
        collegas.map(m => {
          const in2 = !!(state.klok && (state.klok.binnen || []).includes(m.name));
          return '<div class="task"><div class="t"><b>'+esc(m.name)+'</b><span>'+(in2?'🟢 '+T('hk.binnen','Ingeklokt'):'⚪ '+T('hk.nietin','Niet ingeklokt'))+'</span></div>'+
            (in2?'<button class="abtn" data-bel="'+m.id+'" data-naam="'+esc(m.name)+'">📞</button>':'')+'</div>';
        }).join('')+'</div>' : '')+
      '<a class="card" style="display:block;text-decoration:none;color:inherit;" href="/apps/personeel.html"><div class="k">📱 '+T('hk.pda','Open de volledige PDA')+'</div>'+
      '<div style="margin-top:0.4rem;font-size:0.8rem;color:var(--soft);">'+T('hk.pda.s','Rooster, teamchat, walkie-talkie en SOS.')+'</div></a>'+
      '<button class="abtn warn" id="uitlog" style="width:100%;margin-top:0.9rem;">'+T('hk.uitlog','Uitloggen op dit toestel')+'</button>';
    const kb = $('#klokBtn'); if (kb) kb.addEventListener('click', async () => {
      try { await API.call('/staff/clock', {}); await refresh(); } catch(e){ toast(e.message); }
    });
    wrap.querySelectorAll('[data-bel]').forEach(b => b.addEventListener('click', () => belStart(parseInt(b.dataset.bel, 10), b.dataset.naam)));
    const ul = $('#uitlog'); if (ul) ul.addEventListener('click', () => {
      try { localStorage.removeItem('rtg_hk_token'); localStorage.removeItem('rtg_hk_code'); } catch(e){}
      location.reload();
    });
  }

  function renderAll(){ renderKamers(); renderKlussen(); renderMeer(); }

  /* ---------- tabs en live sync ---------- */
  function openTab(tab){
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.dataset.view === tab));
    document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  }
  document.querySelectorAll('.tabbar button').forEach(b => b.addEventListener('click', () => openTab(b.dataset.tab)));
  $('#switchBtn').addEventListener('click', () => {
    try { localStorage.removeItem('rtg_hk_token'); localStorage.removeItem('rtg_hk_code'); } catch(e){}
    location.reload();
  });
  /* ---- collega's bellen: belsignaal over het zaak-kanaal (zelfde als de PDA) ---- */
  let belTimer = null;
  function belOverlay(html){
    let el = document.getElementById('hkBel');
    if (!el){ el = document.createElement('div'); el.id = 'hkBel'; el.style.cssText = 'position:fixed;inset:0;z-index:200;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;padding:2rem;'; document.body.appendChild(el); }
    el.innerHTML = '<div style="background:var(--card);border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:1.6rem;max-width:320px;width:100%;text-align:center;">'+html+'</div>';
    return el;
  }
  function belSluit(){ const el = document.getElementById('hkBel'); if (el) el.remove(); clearInterval(belTimer); belTimer = null; }
  function belVerbonden(naam){
    let sec = 0;
    const el = belOverlay('<div style="font-size:2rem;">📞</div><b style="display:block;margin-top:0.4rem;">'+esc(naam)+'</b>'+
      '<div id="belTijd" style="font-size:0.9rem;color:var(--soft);margin-top:0.3rem;font-variant-numeric:tabular-nums;">0:00</div>'+
      '<button class="abtn warn" id="belOp" style="margin-top:1rem;width:100%;">'+T('hk.bel.op','Ophangen')+'</button>');
    clearInterval(belTimer);
    belTimer = setInterval(() => { sec++; const t = document.getElementById('belTijd'); if (t) t.textContent = Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0'); }, 1000);
    el.querySelector('#belOp').addEventListener('click', belSluit);
  }
  async function belStart(staffId, naam){
    try { await API.call('/staff/bel', { staffId }); } catch(e){ toast(e.message); return; }
    const el = belOverlay('<div style="font-size:2rem;">📞</div><b style="display:block;margin-top:0.4rem;">'+esc(naam)+'</b>'+
      '<div style="font-size:0.85rem;color:var(--soft);margin-top:0.3rem;">'+T('hk.bel.gaat','Gaat over...')+'</div>'+
      '<button class="abtn ghost" id="belStop" style="margin-top:1rem;width:100%;">'+T('hk.bel.stop','Stop')+'</button>');
    el.querySelector('#belStop').addEventListener('click', belSluit);
  }

  function startStream(){
    if (!window.EventSource) return;
    let src;
    try { src = new EventSource('/api/supplier/stream?token='+encodeURIComponent(API.token)); } catch(e){ return; }
    src.addEventListener('sync', () => refresh());
    src.addEventListener('notify', () => refresh());
    src.addEventListener('bel', e => {
      try {
        const d = JSON.parse(e.data || '{}');
        if (!me || d.naar !== me.staffId) return;
        if (navigator.vibrate) navigator.vibrate([200, 80, 200, 80, 200]);
        const el = belOverlay('<div style="font-size:2rem;">📞</div><b style="display:block;margin-top:0.4rem;">'+esc(d.van)+'</b>'+
          '<div style="font-size:0.85rem;color:var(--soft);margin-top:0.3rem;">'+T('hk.bel.in','belt je...')+'</div>'+
          '<div style="display:flex;gap:0.6rem;margin-top:1rem;"><button class="abtn" id="belJa" style="flex:1;">'+T('hk.bel.aan','Neem aan')+'</button><button class="abtn warn" id="belNee" style="flex:1;">'+T('hk.bel.weiger','Weiger')+'</button></div>');
        el.querySelector('#belJa').addEventListener('click', async () => { try { await API.call('/staff/bel/antwoord', { vanId: d.vanId, akkoord: true }); } catch(err){} belVerbonden(d.van); });
        el.querySelector('#belNee').addEventListener('click', async () => { try { await API.call('/staff/bel/antwoord', { vanId: d.vanId, akkoord: false }); } catch(err){} belSluit(); });
      } catch(err){}
    });
    src.addEventListener('bel-antwoord', e => {
      try {
        const d = JSON.parse(e.data || '{}');
        if (!me || d.vanId !== me.staffId) return;
        if (d.akkoord) belVerbonden(d.naam);
        else { belSluit(); toast(T('hk.bel.nee','Niet aangenomen.')); }
      } catch(err){}
    });
  }

  restoreSession().then(ok => { if (!ok) stepZaak(); });
})();
