(function(){
  const $ = s => document.querySelector(s);
  const T = (k, nl) => (window.RTGi18n ? RTGi18n.t(k, nl) : nl);
  const lang = () => (window.RTGi18n ? RTGi18n.lang : 'nl');
  // dynamische tekst (taken, bonnen, opdrachten) in de moedertaal van de medewerker
  const MTX = t => (window.MoederTaal ? MoederTaal.tekst(t) : t);
  const eur = n => '€ ' + Number(n).toLocaleString(lang() === 'en' ? 'en-US' : 'nl-NL');

  const SECTORS = [
    { id:'horeca',  icon:'🍽️', nl:'Horeca',  en:'Hospitality', sub:'Restaurants, bars, beachclubs, koffie', codes:['KIKUNOI','PONTO','VORA','BRISA','FUEGO'] },
    { id:'verblijf',icon:'🏨', nl:'Verblijf', en:'Stays', sub:'Hotels, appartementen, villa\'s', codes:['HOSHI','SAKURA','LUNARA'] },
    { id:'vervoer', icon:'🚘', nl:'Vervoer', en:'Transport', sub:'Taxi\'s, privéjets en helikopters', codes:['MKKX','JETAG','IBIZAIR'] },
    { id:'zzp', icon:'🧑‍🎨', nl:'Zelfstandig', en:'Independent', sub:'Mode, health, wellness en meer', codes:['AYAKA','KAITO','SERENA'] },
    { id:'zorg', icon:'🧖', nl:'Zorg & welzijn', en:'Care & wellness', sub:'Spa\'s, klinieken, de zorgbalie', codes:['ZENITH','CLARA'] },
    { id:'activiteiten', icon:'🎟️', nl:'Activiteiten', en:'Experiences', sub:'Tours, musea, events, galeries', codes:['ESVEDRA','MACE','FESTA','LIENZO'] },
    { id:'verhuur', icon:'🚗', nl:'Verhuur', en:'Rentals', sub:'Auto\'s, scooters, motoren, quads', codes:['ISLAREN','MOTOISLA'] },
    { id:'vastgoed', icon:'🏡', nl:'Vastgoed', en:'Real estate', sub:'Makelaar, bezichtigingen', codes:['IBIZALIV'] },
    { id:'mode', icon:'🛍️', nl:'Mode & retail', en:'Fashion & retail', sub:'Modehuizen, juweliers, winkels', codes:['MAISON','ORODOR'] },
    { id:'charter', icon:'⛵', nl:'Boten & jachten', en:'Boats & yachts', sub:'Charters, schippers, op zee', codes:['AZUL'] },
    { id:'beveiliging', icon:'🛡️', nl:'Beveiliging', en:'Security', sub:'Diensten, posten, rondes, SOS', codes:['AEGIS'] },
    { id:'boerderij', icon:'🚜', nl:'Boerderij', en:'Farm', sub:'Land, kas, dieren en oogst', codes:['CANFERRER'] },
    { id:'creator', icon:'🎬', nl:'Creators', en:'Creators', sub:'Content, planning, samenwerkingen', codes:['LUMINA'] },
    { id:'vracht', icon:'🚢', nl:'Vracht', en:'Freight', sub:'Zendingen, douane, de loods', codes:['TERRAMAR'] },
    { id:'gebouw', icon:'🏢', nl:'Kantoorgebouw', en:'Office tower', sub:'Receptie, facilitair, concierge (Zuidas)', codes:['MERIDIAAN'] },
    { id:'marina', icon:'⚓', nl:'Marina', en:'Marina', sub:'Steiger, brandstof, service, concierge', codes:['PORTELL'] },
    { id:'verzekeraar', icon:'🛡️', nl:'Verzekeraar', en:'Insurer', sub:'Adviesvragen, declaraties, pas-controle', codes:['SEGUR'] }
  ];
  const BEDRIJVEN = {
    KIKUNOI:{ name:'Sal de Mar', icon:'🍽️' }, PONTO:{ name:'Sunset Ibiza', icon:'🍸' },
    HOSHI:{ name:'Aguamarina Ibiza', icon:'🏨' }, SAKURA:{ name:'Villa Bahia Ibiza', icon:'🏡' },
    MKKX:{ name:'Ibiza Executive Cars', icon:'🚘' }, JETAG:{ name:'Aria Private Aviation', icon:'✈️' },
    IBIZAIR:{ name:'Ibiza Sky Charter', icon:'🚁' },
    AYAKA:{ name:'Atelier Marfil', icon:'🧑‍🎨' }, KAITO:{ name:'Studio Milan', icon:'🏋️' },
    ESVEDRA:{ name:'Es Vedra Cruises', icon:'⛵' }, MACE:{ name:'MACE Museum Eivissa', icon:'🏛️' },
    ISLAREN:{ name:'Isla Rent Ibiza', icon:'🚗' },
    IBIZALIV:{ name:'Ibiza Living Estates', icon:'🏡' },
    MAISON:{ name:'Maison Solène', icon:'🛍️' },
    AZUL:{ name:'Azul Yacht Charter', icon:'⛵' },
    AEGIS:{ name:'Aegis Elite Security', icon:'🛡️' },
    CANFERRER:{ name:'Finca Can Ferrer', icon:'🚜' },
    LUMINA:{ name:'Lumina Media', icon:'🎬' },
    VORA:{ name:'Vora Beach Club', icon:'🏖️' }, BRISA:{ name:'Cafe Brisa', icon:'☕' },
    FUEGO:{ name:'Chef Fuego', icon:'👨‍🍳' }, LUNARA:{ name:'Casa Lunara', icon:'🌴' },
    MOTOISLA:{ name:'Moto Isla', icon:'🛵' }, FESTA:{ name:'Festa Ibiza Events', icon:'🎪' },
    SERENA:{ name:'Serena Spa', icon:'🧖' }, ORODOR:{ name:"Casa d'Oro", icon:'💎' },
    ZENITH:{ name:'Zenith Spa & Wellness', icon:'🧖' }, CLARA:{ name:'Kliniek Clara Ibiza', icon:'🩺' },
    LIENZO:{ name:'Galeria Lienzo', icon:'🖼️' },
    TERRAMAR:{ name:'TerraMar Cargo', icon:'🚢' },
    MERIDIAAN:{ name:'Meridiaan Toren', icon:'🏢' },
    PORTELL:{ name:'Marina Portell', icon:'⚓' },
    SEGUR:{ name:'Segur Advies', icon:'🛡️' }
  };

  // De API-client komt uit de gedeelde app-shell (public/shared/appshell.js),
  // zodat alle apps zich identiek gedragen.
  const API = RTGApp.maakAPI();

  let state = null, me = null, code = null, week = null;
  let toastTimer;
  function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),3000); }
  function timeAgo(iso){ const s=Math.max(1,Math.round((Date.now()-new Date(iso))/1000)); if(s<60)return T('t.now','zojuist'); const m=Math.round(s/60); if(m<60)return m+T('t.min',' min'); const h=Math.round(m/60); if(h<24)return h+T('t.hour',' uur'); return Math.round(h/24)+T('t.days',' dg'); }
  function esc(x){ return String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

  // ---- het kantoorgebouw (Zuidas) op zak: receptie, facilitair, concierge ----
  let pdGeb = null;
  const heeftGebouw = () => !!(state && state.supplier && (state.supplier.caps || []).includes('gebouw'));
  async function laadGebouwPda(){
    if (!heeftGebouw()) return;
    try { pdGeb = await API.call('/supplier/gebouw', {}); } catch(e){ pdGeb = null; }
    renderGebouwPda();
  }
  function renderGebouwPda(){
    const tabBtn = document.getElementById('tabGebouw');
    if (tabBtn) tabBtn.style.display = heeftGebouw() ? '' : 'none';
    const wrap = $('#gebouwPdaWrap'); if (!wrap) return;
    if (!heeftGebouw()){ wrap.innerHTML = ''; return; }
    if (!pdGeb){ wrap.innerHTML = '<div class="card">…</div>'; laadGebouwPda(); return; }
    const d = pdGeb;
    const MELD = { schoonmaak: 'Schoonmaak', onderhoud: 'Onderhoud', catering: 'Catering' };
    const JET = { concierge: 'Concierge', chauffeur: 'Chauffeur', 'jet-transfer': 'Jet-transfer', lounge: 'Executive lounge' };
    let html = '';
    // de receptie: wie staat er voor de balie
    const verwacht = (d.bezoekers||[]).filter(b => b.status !== 'vertrokken');
    html += '<div class="card"><div class="k">'+T('pd.geb.receptie','Receptie')+' ('+verwacht.length+')</div>'+
      (verwacht.length ? verwacht.map(b => '<div class="task"><div class="t"><b>'+esc(b.naam)+'</b><span>'+esc(b.voorWie)+' · '+esc(b.status)+(b.badge?' · '+esc(b.badge):'')+'</span></div>'+
        (b.status==='verwacht' ? '<button class="abtn" data-pgbin="'+b.id+'">'+T('pd.geb.binnen','Binnen')+'</button>' : '<button class="abtn" data-pgweg="'+b.id+'" style="background:var(--card2);color:var(--txt);border:1px solid var(--line);">'+T('pd.geb.weg','Weg')+'</button>')+'</div>').join('')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.geb.rustig','Geen bezoekers in de rij.')+'</div>')+'</div>';
    // facilitair: de meldingen van het huis
    const open = (d.meldingen||[]).filter(m => m.status !== 'klaar');
    html += '<div class="card"><div class="k">'+T('pd.geb.fac','Facilitair')+' ('+open.length+')</div>'+
      (open.length ? open.map(m => '<div class="task"><div class="t"><b>'+esc(m.tekst)+'</b><span>'+MELD[m.soort]+' · '+T('pd.geb.verd','verdieping')+' '+m.verdieping+' · '+esc(m.status)+'</span></div>'+
        (m.status==='open' ? '<button class="abtn" data-pgmb="'+m.id+'">'+T('pd.geb.pak','Pak op')+'</button>' : '<button class="abtn" data-pgmk="'+m.id+'">'+T('pd.geb.klaar','Klaar')+'</button>')+'</div>').join('')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.geb.oporde','Het huis is op orde.')+'</div>')+'</div>';
    // valet en de jetset-diensten voor de concierge
    const valet = (d.valet||[]).filter(v => v.status !== 'klaar');
    const jetset = (d.jetset||[]).filter(j => j.status !== 'afgerond');
    html += '<div class="card"><div class="k">'+T('pd.geb.jetset','Concierge en jetset')+' ('+(valet.length+jetset.length)+')</div>'+
      valet.map(v => '<div class="task"><div class="t"><b>'+esc(v.wie)+'</b><span>'+T('pd.geb.valet','valet')+' · '+esc(v.status)+'</span></div>'+
        (v.status==='gevraagd' ? '<button class="abtn" data-pgvv="'+v.id+'">'+T('pd.geb.voorrijden','Voorrijden')+'</button>' : '<button class="abtn" data-pgvk="'+v.id+'">'+T('pd.geb.klaar','Klaar')+'</button>')+'</div>').join('')+
      jetset.map(j => '<div class="task"><div class="t"><b>'+JET[j.soort]+' · '+esc(j.voorWie)+'</b><span>'+esc(j.wens)+' · '+esc(j.moment)+' · '+esc(j.status)+'</span></div>'+
        (j.status==='aangevraagd' ? '<button class="abtn" data-pgjb="'+j.id+'">'+T('pd.geb.bevestig','Bevestig')+'</button>' : '<button class="abtn" data-pgja="'+j.id+'">'+T('pd.geb.afgerond','Afgerond')+'</button>')+'</div>').join('')+
      ((valet.length+jetset.length) ? '' : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.geb.geenjetset','Geen open verzoeken.')+'</div>')+'</div>';
    wrap.innerHTML = html;
    const doe = (sel, body) => wrap.querySelectorAll('['+sel+']').forEach(b => b.addEventListener('click', async () => {
      const { pad, data } = body(b.dataset);
      try { await API.call(pad, data); laadGebouwPda(); } catch(e){ toast(e.message); }
    }));
    doe('data-pgbin', ds => ({ pad: '/supplier/gebouw/bezoeker/status', data: { id: ds.pgbin, status: 'binnen' } }));
    doe('data-pgweg', ds => ({ pad: '/supplier/gebouw/bezoeker/status', data: { id: ds.pgweg, status: 'vertrokken' } }));
    doe('data-pgmb', ds => ({ pad: '/supplier/gebouw/melding/status', data: { id: ds.pgmb, status: 'bezig' } }));
    doe('data-pgmk', ds => ({ pad: '/supplier/gebouw/melding/status', data: { id: ds.pgmk, status: 'klaar' } }));
    doe('data-pgvv', ds => ({ pad: '/supplier/gebouw/valet/status', data: { id: ds.pgvv, status: 'voorgereden' } }));
    doe('data-pgvk', ds => ({ pad: '/supplier/gebouw/valet/status', data: { id: ds.pgvk, status: 'klaar' } }));
    doe('data-pgjb', ds => ({ pad: '/supplier/gebouw/jetset/status', data: { id: ds.pgjb, status: 'bevestigd' } }));
    doe('data-pgja', ds => ({ pad: '/supplier/gebouw/jetset/status', data: { id: ds.pgja, status: 'afgerond' } }));
  }

  // ---- de marina op zak: steiger, brandstof, service en de concierge ----
  let pdMar = null;
  const heeftMarina = () => !!(state && state.supplier && (state.supplier.caps || []).includes('marina'));
  async function laadMarinaPda(){
    if (!heeftMarina()) return;
    try { pdMar = await API.call('/supplier/marina', {}); } catch(e){ pdMar = null; }
    renderMarinaPda();
  }
  function renderMarinaPda(){
    const tabBtn = document.getElementById('tabMarina');
    if (tabBtn) tabBtn.style.display = heeftMarina() ? '' : 'none';
    const wrap = $('#marinaPdaWrap'); if (!wrap) return;
    if (!heeftMarina()){ wrap.innerHTML = ''; return; }
    if (!pdMar){ wrap.innerHTML = '<div class="card">…</div>'; laadMarinaPda(); return; }
    const d = pdMar;
    const SVC = { hijs: 'Hijskraan', helling: 'Hellingbaan', onderhoud: 'Onderhoud', schoonmaak: 'Schoonmaak' };
    const CON = { tender: 'Tender', catering: 'Catering aan boord', crew: 'Crew voor een dag', 'charter-transfer': 'Charter-transfer' };
    let html = '';
    // de steiger: bezetting in een oogopslag
    const vrij = (d.ligplaatsen||[]).filter(p => !p.boot);
    html += '<div class="card"><div class="k">'+T('pd.mr.steiger','De steiger')+' ('+d.kpi.bezet+' van '+d.kpi.ligplaatsen+')</div>'+
      '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+(vrij.length ? T('pd.mr.vrij','Vrij:')+' '+vrij.map(p=>p.id+' (tot '+p.lengteMax+' m)').join(' · ') : T('pd.mr.vol','De haven ligt vol.'))+'</div></div>';
    // de brandstofsteiger
    const tanken = (d.brandstof||[]).filter(b => b.status === 'gevraagd');
    html += '<div class="card"><div class="k">'+T('pd.mr.brand','Brandstof')+' ('+tanken.length+')</div>'+
      (tanken.length ? tanken.map(b => '<div class="task"><div class="t"><b>'+esc(b.boot)+'</b><span>'+esc(b.soort)+' · '+b.liters+' l</span></div><button class="abtn" data-pmbk="'+b.id+'">'+T('pd.mr.getankt','Getankt')+'</button></div>').join('')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.mr.geenbrand','Niemand aan de pomp.')+'</div>')+'</div>';
    // service en de helling
    const werk = (d.service||[]).filter(s => s.status !== 'klaar');
    html += '<div class="card"><div class="k">'+T('pd.mr.svc','Service en de helling')+' ('+werk.length+')</div>'+
      (werk.length ? werk.map(s => '<div class="task"><div class="t"><b>'+esc(s.boot)+'</b><span>'+SVC[s.soort]+' · '+esc(s.wens)+' · '+esc(s.status)+'</span></div>'+
        (s.status==='open' ? '<button class="abtn" data-pmsb="'+s.id+'">'+T('pd.mr.pak','Pak op')+'</button>' : '<button class="abtn" data-pmsk="'+s.id+'">'+T('pd.mr.klaar','Klaar')+'</button>')+'</div>').join('')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.mr.geensvc','De werf ligt er netjes bij.')+'</div>')+'</div>';
    // de marina-concierge
    const con = (d.concierge||[]).filter(c => c.status !== 'afgerond');
    html += '<div class="card"><div class="k">'+T('pd.mr.con','Marina-concierge')+' ('+con.length+')</div>'+
      (con.length ? con.map(c => '<div class="task"><div class="t"><b>'+CON[c.soort]+' · '+esc(c.voorWie)+'</b><span>'+esc(c.wens)+' · '+esc(c.moment)+' · '+esc(c.status)+'</span></div>'+
        (c.status==='aangevraagd' ? '<button class="abtn" data-pmcb="'+c.id+'">'+T('pd.mr.bevestig','Bevestig')+'</button>' : '<button class="abtn" data-pmca="'+c.id+'">'+T('pd.mr.afgerond','Afgerond')+'</button>')+'</div>').join('')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.mr.geencon','Geen open verzoeken.')+'</div>')+'</div>';
    wrap.innerHTML = html;
    const doe = (sel, body) => wrap.querySelectorAll('['+sel+']').forEach(b => b.addEventListener('click', async () => {
      const { pad, data } = body(b.dataset);
      try { await API.call(pad, data); laadMarinaPda(); } catch(e){ toast(e.message); }
    }));
    doe('data-pmbk', ds => ({ pad: '/supplier/marina/brandstof/klaar', data: { id: ds.pmbk } }));
    doe('data-pmsb', ds => ({ pad: '/supplier/marina/service/status', data: { id: ds.pmsb, status: 'bezig' } }));
    doe('data-pmsk', ds => ({ pad: '/supplier/marina/service/status', data: { id: ds.pmsk, status: 'klaar' } }));
    doe('data-pmcb', ds => ({ pad: '/supplier/marina/concierge/status', data: { id: ds.pmcb, status: 'bevestigd' } }));
    doe('data-pmca', ds => ({ pad: '/supplier/marina/concierge/status', data: { id: ds.pmca, status: 'afgerond' } }));
  }

  // ---- de verzekeraar op zak: adviesvragen, declaraties, pas-controle ----
  let pdPol = null, pdPolZorg = null;
  const heeftPolis = () => !!(state && state.supplier && (state.supplier.caps || []).includes('polis'));
  async function laadPolisPda(){
    if (!heeftPolis()) return;
    try { pdPol = await API.call('/supplier/polis', {}); } catch(e){ pdPol = null; }
    try { pdPolZorg = await API.call('/supplier/zorgpolis', {}); } catch(e){ pdPolZorg = null; }
    renderPolisPda();
  }
  function renderPolisPda(){
    const tabBtn = document.getElementById('tabPolis');
    if (tabBtn) tabBtn.style.display = heeftPolis() ? '' : 'none';
    const wrap = $('#polisPdaWrap'); if (!wrap) return;
    if (!heeftPolis()){ wrap.innerHTML = ''; return; }
    if (!pdPol || !pdPolZorg){ wrap.innerHTML = '<div class="card">…</div>'; laadPolisPda(); return; }
    let html = '';
    // open adviesvragen: de adviseur schrijft het advies zelf, ook op zak
    const open = (pdPol.aanvragen||[]).filter(a => a.status === 'aangevraagd');
    html += '<div class="card"><div class="k">'+T('pd.pol.advies','Adviesvragen')+' ('+open.length+')</div>'+
      (open.length ? open.map(a => '<div class="task"><div class="t"><b>'+esc(a.klant)+' · '+esc(a.product)+'</b><span>'+esc(a.situatie)+'</span></div></div>'+
        '<div style="display:flex;gap:0.4rem;margin:0.3rem 0 0.6rem;"><input data-ppat="'+a.id+'" placeholder="'+T('pd.pol.schrijf','Het advies (van u, niet van het systeem)')+'" maxlength="240" style="flex:1;background:var(--card2);border:1px solid var(--line);border-radius:8px;color:var(--txt);font:inherit;font-size:0.78rem;padding:0.4rem 0.6rem;">'+
        '<button class="abtn" data-ppak="'+a.id+'">'+T('pd.pol.klaar','Advies klaar')+'</button></div>').join('')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.pol.geenadvies','Geen open adviesvragen.')+'</div>')+'</div>';
    // declaraties: goedkeuren met een tik, afwijzen alleen met een reden
    const decl = (pdPolZorg.declaraties||[]).filter(x => x.status === 'ingediend');
    html += '<div class="card"><div class="k">'+T('pd.pol.decl','Declaraties')+' ('+decl.length+')</div>'+
      (decl.length ? decl.map(x => '<div class="task"><div class="t"><b>'+esc(x.codenaam)+' · '+esc(x.omschrijving)+'</b><span>'+eur(x.bedrag)+'</span></div>'+
        '<button class="abtn" data-ppdg="'+x.id+'">'+T('pd.pol.goed','Keur goed')+'</button></div>'+
        '<div style="display:flex;gap:0.4rem;margin:0.3rem 0 0.6rem;"><input data-ppdr="'+x.id+'" placeholder="'+T('pd.pol.reden','Reden bij afwijzen')+'" maxlength="160" style="flex:1;background:var(--card2);border:1px solid var(--line);border-radius:8px;color:var(--txt);font:inherit;font-size:0.78rem;padding:0.4rem 0.6rem;">'+
        '<button class="abtn" data-ppda="'+x.id+'" style="background:var(--card2);color:var(--txt);border:1px solid var(--line);">'+T('pd.pol.af','Wijs af')+'</button></div>').join('')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.pol.geendecl','Geen open declaraties.')+'</div>')+'</div>';
    // de pas-controle
    html += '<div class="card"><div class="k">'+T('pd.pol.pas','Pas-controle')+'</div>'+
      '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input id="ppPas" placeholder="ZP-XXXX" maxlength="12" style="flex:1;background:var(--card2);border:1px solid var(--line);border-radius:8px;color:var(--txt);font:inherit;font-size:0.85rem;padding:0.45rem 0.6rem;text-transform:uppercase;">'+
      '<button class="abtn" id="ppGo">'+T('pd.pol.check','Controleer')+'</button></div>'+
      '<div id="ppUit" style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);"></div></div>';
    wrap.innerHTML = html;
    const doe2 = (sel, fn) => wrap.querySelectorAll('['+sel+']').forEach(b => b.addEventListener('click', () => fn(b.dataset)));
    doe2('data-ppak', async ds => {
      try { await API.call('/supplier/polis/zet', { id: ds.ppak, status: 'advies-klaar', advies: (wrap.querySelector('[data-ppat="'+ds.ppak+'"]')||{}).value }); laadPolisPda(); } catch(e){ toast(e.message); }
    });
    doe2('data-ppdg', async ds => {
      try { await API.call('/supplier/zorgpolis/declaratie/beslis', { id: ds.ppdg, besluit: 'goedgekeurd', door: (me && me.name) || '' }); laadPolisPda(); } catch(e){ toast(e.message); }
    });
    doe2('data-ppda', async ds => {
      try { await API.call('/supplier/zorgpolis/declaratie/beslis', { id: ds.ppda, besluit: 'afgewezen', reden: (wrap.querySelector('[data-ppdr="'+ds.ppda+'"]')||{}).value, door: (me && me.name) || '' }); laadPolisPda(); } catch(e){ toast(e.message); }
    });
    const go = wrap.querySelector('#ppGo');
    if (go) go.addEventListener('click', async () => {
      try { const r = await API.call('/supplier/zorgpolis/pas', { pas: (wrap.querySelector('#ppPas')||{}).value });
        wrap.querySelector('#ppUit').textContent = (r.actief ? T('pd.pol.actief','Actief') : T('pd.pol.niet','Niet actief')) + ' · ' + r.pakket + ' · ' + r.codenaam;
      } catch(e){ const u = wrap.querySelector('#ppUit'); if (u) u.textContent = e.message; }
    });
  }


  /* ---------- stappen-gate: sector -> bedrijf -> wie -> pincode ----------
     De PDA staat vast op een bedrijf: na de eerste keuze onthoudt het apparaat
     het bedrijf en opent hij direct op het eigen team. Inloggen kan alleen wie
     door de werkgever is uitgenodigd en zich heeft aangemeld (dan sta je in het
     team), met de eigen pincode. */
  function pdaBedrijf(){
    try { const c = localStorage.getItem('rtg_pda_bedrijf'); return (c && BEDRIJVEN[c]) ? c : null; } catch(e){ return null; }
  }
  function stepStart(){
    // 1x aanmelden is de gewone ingang: log één keer in met uw eigen RTG-account
    // en u landt meteen op de juiste bedrijfspagina. Een vast apparaat in de zaak
    // (QR / ?bedrijf=CODE, of een onthouden bedrijf) houdt de naam-en-pincode-ingang.
    const qs = new URLSearchParams(location.search);
    if (qs.get('kantoor') != null){ stepKantoor(); return; }
    const qb = String(qs.get('bedrijf') || '').toUpperCase();
    if (qb && BEDRIJVEN[qb]){ stepWie(null, qb); return; }
    const vast = pdaBedrijf();
    if (vast) stepWie(null, vast);
    else stepLogin();
  }
  // de klok en de datum op het inlogscherm (de naam van de app staat in de badge)
  function gateTik(){ if (window.RTGKlok) RTGKlok.alles(); }
  // De hoofd-ingang: inloggen met het eigen RTG-account (e-mail/gebruikersnaam +
  // wachtwoord). Daaronder alleen aanmelden en wachtwoord vergeten; een vast
  // apparaat kan nog op naam met pincode.
  function stepLogin(){
    kantoorStop();
    $('#gateStep').innerHTML =
      '<form class="lform" id="loginForm" autocomplete="on">'+
        '<input id="liUser" type="text" autocomplete="username" placeholder="'+T('pd.li.user','E-mail of gebruikersnaam')+'" aria-label="'+T('pd.li.user','E-mail of gebruikersnaam')+'">'+
        '<input id="liPass" type="password" autocomplete="current-password" placeholder="'+T('pd.li.pass','Wachtwoord')+'" aria-label="'+T('pd.li.pass','Wachtwoord')+'">'+
        '<div class="err" id="liErr" role="alert"></div>'+
        '<button class="prim" type="submit">'+T('pd.login','Inloggen')+'</button>'+
      '</form>'+
      '<div class="llinks">'+
        '<button class="llink" id="toJoin" type="button">'+T('pd.aanmelden','Aanmelden bij een bedrijf')+'</button>'+
        '<button class="llink" id="toForgot" type="button">'+T('pd.forgot','Wachtwoord vergeten?')+'</button>'+
        '<button class="llink" id="toDevice" type="button">'+T('pd.ondevice','Vast apparaat? Inloggen met naam en pincode')+'</button>'+
      '</div>';
    $('#loginForm').addEventListener('submit', async e => {
      e.preventDefault();
      $('#liErr').textContent = '';
      const btn = e.target.querySelector('button.prim'); btn.disabled = true;
      try { await mijnLogin($('#liUser').value.trim(), $('#liPass').value); }
      catch(err){ $('#liErr').textContent = err.message || T('pd.badlogin','Onjuiste inloggegevens.'); btn.disabled = false; }
    });
    $('#toJoin').addEventListener('click', stepAanmelden);
    $('#toForgot').addEventListener('click', stepForgot);
    $('#toDevice').addEventListener('click', stepSector);
    $('#liUser').focus();
  }
  // Aanmelden bij een bedrijf: bedrijfsnaam + kassacode (van de werkgever) +
  // het eigen RTG-account + een zelfgekozen pincode. Daarna landt u meteen.
