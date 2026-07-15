(function(){
  const $ = s => document.querySelector(s);
  const T = (k, nl) => (window.RTGi18n ? RTGi18n.t(k, nl) : nl);
  const lang = () => (window.RTGi18n ? RTGi18n.lang : 'nl');
  const eur = n => '€ ' + Number(n).toLocaleString(lang() === 'en' ? 'en-US' : 'nl-NL');
  const STATUS = { 'nieuw':'new', 'in bereiding':'in preparation', 'klaar':'ready', 'geserveerd':'served', 'geweigerd':'declined', 'terugbetaald':'refunded',
    'aangevraagd':'requested', 'onderweg':'on the way', 'aangekomen':'at pickup', 'rijdt':'driving', 'gearriveerd':'completed' };
  const tStatus = s => (lang() === 'en' ? (STATUS[s] || s) : s);
  const TYPELABEL = { 'Hotel':'Hotel', 'Restaurant':'Restaurant', 'Bar':'Bar', 'Taxi':'Taxi', 'Privéjet':'Private jet', 'Appartement':'Apartment', 'Club':'Club' };
  const tType = s => (lang() === 'en' ? (TYPELABEL[s] || s) : s);
  const ALG = { 'vis':'fish', 'soja':'soy', 'sesam':'sesame', 'gluten':'gluten', 'noten':'nuts', 'schaaldieren':'shellfish', 'ei':'egg', 'melk':'milk', 'pinda':'peanut', 'selderij':'celery', 'mosterd':'mustard' };
  const tAlg = a => (lang() === 'en' ? (ALG[a] || a) : a);

  const DEMO = [
    { code:'KIKUNOI', name:'Sal de Mar',      type:'Restaurant', icon:'🍽️', sub:'Restaurant · Ibiza' },
    { code:'PONTO',   name:'Sunset Ibiza',    type:'Bar',        icon:'🍸', sub:'Bar · Ibiza' },
    { code:'HOSHI',   name:'Aguamarina Ibiza', type:'Hotel',     icon:'🏨', sub:'Hotel · Ibiza' },
    { code:'SAKURA',  name:'Villa Bahia Ibiza', type:'Appartement', icon:'🏡', sub:'Appartement · Ibiza' },
    { code:'MKKX',    name:'Ibiza Executive Cars', type:'Taxi',  icon:'🚘', sub:'Taxi · Ibiza' },
    { code:'JETAG',   name:'Aria Private Aviation', type:'Privéjet', icon:'✈️', sub:'Privéjet · Amsterdam' },
    { code:'IBIZAIR', name:'Ibiza Sky Charter', type:'Helikopter', icon:'🚁', sub:'Helikopter transfers · Ibiza' },
    { code:'AYAKA',   name:'Atelier Marfil', type:'Zelfstandig', icon:'🧑‍🎨', sub:'Sieraden & goudsmid · Ibiza' },
    { code:'KAITO',   name:'Studio Milan', type:'Zelfstandig', icon:'🏋️', sub:'Health & wellness · Ibiza' },
    { code:'ESVEDRA', name:'Es Vedra Cruises', type:'Activiteit', icon:'⛵', sub:'Tours & cruises · Ibiza' },
    { code:'MACE',    name:'MACE Museum Eivissa', type:'Activiteit', icon:'🏛️', sub:'Museum · Ibiza' },
    { code:'ISLAREN', name:'Isla Rent Ibiza', type:'Autoverhuur', icon:'🚗', sub:'Autoverhuur · Ibiza' },
    { code:'IBIZALIV', name:'Ibiza Living Estates', type:'Vastgoed', icon:'🏡', sub:'Makelaar · Ibiza' },
    { code:'MAISON',  name:'Maison Solène', type:'Mode', icon:'🛍️', sub:'Modehuis · Ibiza' },
    { code:'AZUL',    name:'Azul Yacht Charter', type:'Charter', icon:'⛵', sub:'Boten & jachten · Ibiza' }
  ];

  // Eigen app per sector: dezelfde motor, een eigen ingang, naam en kassa.
  const SECTOR_DEF = {
    restaurant:  { label:'RTG Restaurant',  labelEn:'RTG Restaurant', codes:['KIKUNOI'], icon:'🍽️' },
    bar:         { label:'RTG Bar & Club',  labelEn:'RTG Bar & Club', codes:['PONTO'],   icon:'🍸' },
    hotel:       { label:'RTG Hotel',       labelEn:'RTG Hotel',      codes:['HOSHI'],   icon:'🏨' },
    appartement: { label:'RTG Appartement', labelEn:'RTG Apartment',  codes:['SAKURA'],  icon:'🏡' },
    taxi:        { label:'RTG Taxi',        labelEn:'RTG Taxi',       codes:['MKKX'],    icon:'🚘' },
    privejet:    { label:'RTG Privéjet',    labelEn:'RTG Private Jet', codes:['JETAG'],  icon:'✈️' },
    helikopter:  { label:'RTG Helikopter',  labelEn:'RTG Helicopter',  codes:['IBIZAIR'], icon:'🚁' },
    zzp:         { label:'RTG Zelfstandig', labelEn:'RTG Independent', codes:['AYAKA','KAITO'], icon:'🧑‍🎨' },
    activiteiten:{ label:'RTG Activiteiten', labelEn:'RTG Experiences', codes:['ESVEDRA','MACE'], icon:'🎟️' },
    autoverhuur: { label:'RTG Autoverhuur', labelEn:'RTG Car Rental', codes:['ISLAREN'], icon:'🚗' },
    vastgoed:    { label:'RTG Vastgoed', labelEn:'RTG Real Estate', codes:['IBIZALIV'], icon:'🏡' },
    boerderij:   { label:'RTG Boerderij', labelEn:'RTG Farm', codes:['CANFERRER'], icon:'🚜' },
    creator:     { label:'RTG Creators', labelEn:'RTG Creators', codes:['LUMINA'], icon:'🎬' },
    retail:      { label:'RTG Mode', labelEn:'RTG Fashion', codes:['MAISON'], icon:'🛍️' },
    groothandel: { label:'RTG Groothandel', labelEn:'RTG Wholesale', codes:['MERCABIZA'], icon:'📦' },
    charter:     { label:'RTG Charter', labelEn:'RTG Charter', codes:['AZUL'], icon:'⛵' },
    beveiliging: { label:'RTG Beveiliging', labelEn:'RTG Security', codes:['AEGIS'], icon:'🛡️' },
    horeca:  { label:'RTG Horeca',   labelEn:'RTG Hospitality', codes:['KIKUNOI','PONTO'], icon:'🍽️', legacy:true },
    verblijf:{ label:'RTG Verblijf', labelEn:'RTG Stays',       codes:['HOSHI','SAKURA'],  icon:'🏨', legacy:true },
    vervoer: { label:'RTG Vervoer',  labelEn:'RTG Transport',   codes:['MKKX','JETAG','IBIZAIR'], icon:'🚘', legacy:true }
  };
  const SECTOR = (new URLSearchParams(location.search).get('sector') || '').toLowerCase();
  const SDEF = SECTOR_DEF[SECTOR] || null;

  const TABDEF = {
    home:     { label:'Overzicht', svg:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>' },
    orders:   { label:'Orders',    svg:'<path d="M6 2h9l3 3v17H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>', cap:'orders' },
    rides:    { label:'Ritten',    svg:'<path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11"/><rect x="3" y="11" width="18" height="6" rx="2"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/>', cap:'rides' },
    menu:     { label:'Menu',      svg:'<path d="M4 3v18M8 3v6a2 2 0 0 1-4 0M18 3c-2 0-3 2-3 5s1 4 3 4v9"/>', cap:'menu' },
    price:    { label:'Prijs',     svg:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2 0 0 1 5 0c0 2-2.5 1.5-2.5 3.5M12 16v.5"/>', cap:'pricing' },
    kassa:    { label:'Kassa',     svg:'<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M6 9V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3"/><path d="M7 13h2M11 13h2M15 13h2M7 16.5h2M11 16.5h2M15 16.5h2"/>' },
    bezorg:   { label:'Bezorgen',  svg:'<circle cx="6.5" cy="17" r="2.5"/><circle cx="17.5" cy="17" r="2.5"/><path d="M6.5 17h6.5l2.2-6.5H19"/><path d="M12.5 6.5H16l1.8 4"/><path d="M4 12h4"/>' },
    tickets:  { label:'Tickets',   svg:'<path d="M4 8a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M12 6v2M12 11v2M12 16v2"/>', cap:'tickets' },
    vastgoed: { label:'Vastgoed',  svg:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>', cap:'vastgoed' },
    boerderij:{ label:'Boerderij', svg:'<path d="M4 10l6-4 6 4"/><path d="M6 10v9h8v-9"/><path d="M14 13h6v6h-6z"/><path d="M9 19v-4h2v4"/>', cap:'boerderij' },
    creator:  { label:'Creator',   svg:'<rect x="3" y="5" width="13" height="14" rx="2"/><path d="M16 9l5-3v12l-5-3"/>', cap:'creator' },
    samenwerking:{ label:'Samenwerken', svg:'<path d="M9 11l2 2 4-4"/><circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/><path d="M7 10v4a3 3 0 0 0 3 3h4"/>' },
    facturen: { label:'Facturen',  svg:'<path d="M6 2h9l3 3v17l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h4"/>' },
    rtfmarkt: { label:'De Salon · RTF', svg:'<path d="M4 7h16l-1 4a3 3 0 0 1-3 2.4H8A3 3 0 0 1 5 11z"/><path d="M4 7 6 3h12l2 4"/><path d="M6 13v7h12v-7"/>' },
    huur:     { label:'Verhuur',   svg:'<path d="M5 12l1.6-4.6A2 2 0 0 1 8.5 6h7a2 2 0 0 1 1.9 1.4L19 12"/><rect x="3.5" y="12" width="17" height="5.5" rx="1.8"/><circle cx="7.5" cy="17.5" r="1.6"/><circle cx="16.5" cy="17.5" r="1.6"/><path d="M7 9.5h10"/>', cap:'huur' },
    verkoop:  { label:'Verkoop',   svg:'<path d="M5 12l1.6-4.6A2 2 0 0 1 8.5 6h7a2 2 0 0 1 1.9 1.4L19 12"/><rect x="3.5" y="12" width="17" height="5.5" rx="1.8"/><circle cx="7.5" cy="17.5" r="1.6"/><circle cx="16.5" cy="17.5" r="1.6"/><path d="M9.5 9.2l1.6 1.6 3-3"/>', cap:'huur' },
    retail:   { label:'Mode',      svg:'<path d="M8 4l-4 3 1.5 2.5L7 8.5V20h10V8.5l1.5 1L20 7l-4-3-2 1.5a2 2 0 0 1-4 0z"/>', cap:'retail' },
    charter:  { label:'Charter',   svg:'<path d="M4 15l8-3 8 3-1.6 4H5.6z"/><path d="M12 12V4l6 4-6 1"/><path d="M3 20c1.2.8 2.4.8 3.6 0 1.2.8 2.4.8 3.6 0 1.2.8 2.4.8 3.6 0 1.2.8 2.4.8 3.6 0"/>', cap:'charter' },
    groothandel:{ label:'Groothandel', svg:'<rect x="3" y="8" width="18" height="12" rx="1.5"/><path d="M3 8l2-4h14l2 4"/><path d="M10 12h4"/>', cap:'groothandel' },
    inkoop:   { label:'Inkoop',    svg:'<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M2 3h3l2.2 12.3a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.2L21 7H6"/>', cap:'menu' },
    boardroom:{ label:'Boardroom', svg:'<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M7 20h10M12 18v2"/><path d="M7 12l2.5-2.5L12 12l3-3 2 2"/>' },
    beveiliging:{ label:'Commandocentrum', svg:'<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9.5 12l1.8 1.8 3.4-3.6"/>', cap:'beveiliging' },
    paspoort: { label:'Identiteit', svg:'<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="12" cy="10" r="2.4"/><path d="M8 16c0.5-2 2.2-3 4-3s3.5 1 4 3"/>' },
    rooms:    { label:'Kamers',    svg:'<path d="M3 18v-8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8"/><path d="M3 18h18M3 21v-3M21 21v-3"/><path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/>', cap:'bookings' },
    minibar:  { label:'Minibar',   svg:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 12h14"/><path d="M9 7.5v1.5M9 15.5v1.5"/>', cap:'bookings' },
    tafels:   { label:'Tafels',    svg:'<circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>', cap:'menu' },
    klussen:  { label:'Klussen',   svg:'<path d="M14.5 6.5a4 4 0 0 0-5.6 4.9L3 17.3V21h3.7l5.9-5.9a4 4 0 0 0 4.9-5.6l-2.6 2.6-2.4-2.4z"/>', cap:'bookings' },
    beheer:   { label:'Beheer',    svg:'<circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>' },
    doors:    { label:'Deuren',    svg:'<rect x="5" y="3" width="14" height="18" rx="1.5"/><circle cx="15" cy="12" r="1.2"/><path d="M5 21h14"/>', cap:'doors' },
    gasten:   { label:'Gasten',    svg:'<circle cx="12" cy="7.5" r="3"/><path d="M5.5 20c.7-3.6 3.2-5.5 6.5-5.5s5.8 1.9 6.5 5.5"/><path d="M12 14.5v2M12 19v.5"/>', cap:'bookings' },
    location: { label:'Locatie',   svg:'<path d="M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>', cap:'location' },
    gchat:    { label:'Gastchat',  svg:'<path d="M21 12a8 8 0 0 1-8 8H4l2.5-3A8 8 0 1 1 21 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>' },
    ai:       { label:'AI',        svg:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>' },
    meer:     { label:'Meer',      svg:'<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>' },
    contract: { label:'Contracten', svg:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/><path d="M14.5 18.5l1.5 1.5 3-3"/>' },
    onboarding: { label:'Onboarding', svg:'<path d="M16 11a4 4 0 1 0-8 0"/><circle cx="12" cy="7" r="3"/><path d="M4 21c0-4 3.5-7 8-7 1.4 0 2.7 0.3 3.8 0.8"/><path d="M15.5 19l1.8 1.8 3.2-3.6"/>' },
    page:     { label:'Pagina',    svg:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M3 17l5-5 4 4 3-3 6 6"/>' },
    team:     { label:'Team',       svg:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.5a3 3 0 0 1 0 5.5M17 14c2.6 0.6 4 2.7 4 6"/>' }
  };

  // API-client uit de gedeelde app-shell (public/shared/appshell.js).
  const API = RTGApp.maakAPI({ foutTekst: 'API-fout' });

  let S = null;          // supplier
  let state = null;      // dashboard state
  let notifs = [];
  let source = null;

  let toastTimer;
  function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),3000); }

  // ---- sollicitatiechat: samen met de kandidaat een afspraak maken ----
  let apChatId = null, apChatTimer = null;
  function escT(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function ensureApChatEl(){
    let ov = document.getElementById('apchat'); if (ov) return ov;
    ov = document.createElement('div'); ov.id='apchat';
    ov.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:none;align-items:flex-end;justify-content:center;';
    ov.innerHTML='<div style="background:var(--bg,#12100f);border:1px solid var(--line,#2a2622);border-radius:16px 16px 0 0;width:min(100%,34rem);max-height:80vh;display:flex;flex-direction:column;">'+
      '<div style="display:flex;align-items:center;gap:.6rem;padding:.8rem 1rem;border-bottom:1px solid var(--line,#2a2622);"><b id="apchatWie" style="flex:1;"></b><button id="apchatX" style="background:none;border:none;color:var(--soft,#9a938c);font-size:1.2rem;cursor:pointer;">✕</button></div>'+
      '<div id="apchatMsgs" style="flex:1;overflow:auto;padding:1rem;display:flex;flex-direction:column;gap:.4rem;"></div>'+
      '<div style="display:flex;gap:.5rem;padding:.7rem 1rem;border-top:1px solid var(--line,#2a2622);"><input id="apchatIn" placeholder="'+T('ap.chat.ph','Bericht (bijv. Kun je donderdag om 15u?)')+'" style="flex:1;background:var(--card2,#1b1817);border:1px solid var(--line,#2a2622);border-radius:12px;padding:.55rem .8rem;color:var(--txt,#fff);"><button id="apchatSend" class="obtn primary">'+T('ap.chat.send','Stuur')+'</button></div>'+
      '</div>';
    document.body.appendChild(ov);
    ov.querySelector('#apchatX').addEventListener('click', closeApChat);
    ov.addEventListener('click', e=>{ if(e.target===ov) closeApChat(); });
    ov.querySelector('#apchatSend').addEventListener('click', sendApChat);
    ov.querySelector('#apchatIn').addEventListener('keydown', e=>{ if(e.key==='Enter') sendApChat(); });
    return ov;
  }
  function apMsgHtml(m){
    const mij = m.van==='werkgever';
    const inner = mij ? escT(m.tekst) : '<span class="xlate">'+escT(m.tekst)+'</span>';
    return '<div style="align-self:'+(mij?'flex-end':'flex-start')+';max-width:80%;padding:.45rem .75rem;border-radius:12px;'+(mij?'background:var(--gold,#C9A24B);color:#1a1710;':'background:var(--card2,#1b1817);border:1px solid var(--line,#2a2622);')+'white-space:pre-wrap;">'+inner+'</div>';
  }
  function apVertaal(root){ if(!root||!window.Vertaal) return; const to=(window.RTGi18n?RTGi18n.lang:'nl'); root.querySelectorAll('.xlate:not([data-vt])').forEach(el=>{ el.setAttribute('data-vt','1'); Vertaal.vul(el, el.textContent, to); }); }
  async function laadApChat(){
    if (!apChatId) return;
    try { const d = await API.call('/supplier/apply/chat', { id: apChatId });
      const box = document.getElementById('apchatMsgs'); if(!box) return;
      box.innerHTML = (d.chat.berichten||[]).map(apMsgHtml).join('') || '<div style="color:var(--soft,#9a938c);text-align:center;margin:auto;font-size:.85rem;">'+T('ap.chat.leeg','Nog geen berichten. Stel een afspraak voor.')+'</div>';
      apVertaal(box); box.scrollTop = box.scrollHeight;
    } catch(e){}
  }
  function openApChat(id, wie){
    apChatId = id; const ov = ensureApChatEl();
    ov.querySelector('#apchatWie').textContent = (wie||T('ap.chat.title','Chat met kandidaat'));
    ov.style.display='flex'; laadApChat();
    clearInterval(apChatTimer); apChatTimer = setInterval(laadApChat, 4000);
  }
  function closeApChat(){ apChatId=null; clearInterval(apChatTimer); const ov=document.getElementById('apchat'); if(ov) ov.style.display='none'; }
  async function sendApChat(){
    const inp = document.getElementById('apchatIn'); const t=(inp.value||'').trim(); if(!t||!apChatId) return; inp.value='';
    try { await API.call('/supplier/apply/chat/send', { id: apChatId, text: t }); laadApChat(); } catch(e){ toast(e.message); }
  }
  function timeAgo(iso){ const s=Math.max(1,Math.round((Date.now()-new Date(iso))/1000)); if(s<60)return T('t.now','zojuist'); const ago=T('t.ago',' geleden'); const m=Math.round(s/60); if(m<60)return m+T('t.min',' min')+ago; const h=Math.round(m/60); if(h<24)return h+T('t.hour',' uur')+ago; return Math.round(h/24)+T('t.days',' dag(en)')+ago; }
  function has(cap){ return S && S.caps && S.caps.includes(cap); }

  // ---- login ----
  function initials(name){ return String(name||'?').trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase(); }

  function renderGate(){
    const list = SDEF ? DEMO.filter(d => SDEF.codes.includes(d.code)) : DEMO;
    if (SDEF){
      document.title = SDEF.label + ', RTG Partners';
      const badge = document.querySelector('#gate .badge');
      if (badge) badge.textContent = (lang() === 'en' ? SDEF.labelEn : SDEF.label);
    }
    $('#gateList').innerHTML = list.map(d =>
      '<button class="gate-btn" data-code="'+d.code+'"><span class="ic">'+d.icon+'</span><span><b>'+d.name+'</b><span>'+d.sub+'</span></span></button>'
    ).join('') + (SDEF ? '' :
      '<div style="margin-top:0.9rem;font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);">'+T('gate.sectorapps','Of open de app voor uw sector')+'</div>'+
      '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem;">'+
        Object.keys(SECTOR_DEF).filter(k => !SECTOR_DEF[k].legacy).map(k => '<a class="obtn" style="text-decoration:none;" href="/apps/'+k+'.html">'+SECTOR_DEF[k].icon+' '+(lang()==='en'?SECTOR_DEF[k].labelEn:SECTOR_DEF[k].label)+'</a>').join('')+
      '</div>'+
      '<a class="obtn" style="text-decoration:none;display:inline-block;margin-top:0.8rem;border-color:rgba(169,143,28,0.4);color:var(--gold);" href="/apps/personeel.html">👤 '+T('gate.staffapp','Werkt u hier? Open de personeels-app')+'</a>'+
      '<a class="obtn" style="text-decoration:none;display:inline-block;margin-top:0.8rem;margin-left:0.5rem;" href="/apps/">📱 '+T('gate.allapps','Alle RTG-apps')+'</a>');
    document.querySelectorAll('[data-code]').forEach(b => b.addEventListener('click', () => pickPartner(b.dataset.code)));
    const lf = document.getElementById('loginForm');
    if (lf) lf.addEventListener('submit', e => {
      e.preventDefault();
      login({ username: document.getElementById('liUser').value, password: document.getElementById('liPass').value }, true);
    });
    const tog = document.getElementById('enrollToggle'), ef = document.getElementById('enrollForm');
    if (tog && ef) tog.addEventListener('click', () => {
      const open = ef.hasAttribute('hidden');
      if (open) { ef.removeAttribute('hidden'); tog.setAttribute('aria-expanded', 'true'); document.getElementById('enBedrijf').focus(); }
      else { ef.setAttribute('hidden', ''); tog.setAttribute('aria-expanded', 'false'); }
    });
    if (ef) ef.addEventListener('submit', enroll);
  }

  // Uitgenodigd door de werkgever: aanmelden met bedrijfsnaam + kassacode + eigen
  // RTG-inlog. Alleen echte RTG/Lifestyle/Business-leden komen erin.
  async function enroll(e){
    e.preventDefault();
    if (!API.enabled){ toast(T('sup.needserver','Start de server (npm start) om de leverancier-app te gebruiken.')); return; }
    const msg = document.getElementById('enrollMsg');
    const bedrijf = document.getElementById('enBedrijf').value.trim();
    const kassacode = document.getElementById('enCode').value.trim();
    const login2 = document.getElementById('enLogin').value.trim();
    const password = document.getElementById('enPass').value;
    const pin = document.getElementById('enPin').value.trim();
    msg.className = 'enroll-msg';
    msg.textContent = T('enr.busy','Bezig met aanmelden...');
    try {
      const r = await API.call('/supplier/staff/join', { bedrijf, kassacode, login: login2, password, pin });
      msg.className = 'enroll-msg ok';
      msg.textContent = T('enr.ok','Gelukt! U bent aangemeld. U wordt ingelogd...');
      await login({ code: r.code, staffId: r.staffId, pin }, false, true);
    } catch (err) {
      msg.className = 'enroll-msg err';
      msg.textContent = err.message || T('enr.fail','Aanmelden mislukt. Controleer de gegevens.');
    }
  }

  // Functies per genre: zo kiest personeel direct de eigen rol,
  // en solliciteert een kandidaat overal op dezelfde manier.
  const TYPEOF = { KIKUNOI:'restaurant', PONTO:'bar', HOSHI:'hotel', SAKURA:'apartment', MKKX:'taxi', JETAG:'jet', IBIZAIR:'helikopter', AYAKA:'zzp', KAITO:'zzp', ESVEDRA:'activiteit', MACE:'activiteit', ISLAREN:'verhuur', IBIZALIV:'vastgoed', MAISON:'retail', AZUL:'charter' };
  const FUNCS = {
    restaurant: ['Bediening','Keuken','Gastheer/gastvrouw','Afwas'],
    bar:        ['Bediening','Bar','Keuken','Security'],
    club:       ['Bediening','Bar','Security'],
    hotel:      ['Receptie','Housekeeping','Roomservice','Onderhoud','Security'],
    apartment:  ['Beheer','Housekeeping','Onderhoud'],
    taxi:       ['Taxi centrale','Chauffeur'],
    jet:        ['Operations','Crew','Piloot'],
    helikopter: ['Operations','Piloot','Crew','Grondpersoneel'],
    activiteit: ['Gids','Security','Ticketbalie'],
    verhuur:    ['Balie','Monteur','Schoonmaak'],
    vastgoed:   ['Makelaar','Bezichtigingen','Backoffice']
  };
  let pickCode = null, gateRoster = null, pendingStation = null;
  const spH2 = () => document.querySelector('#staffPick h2');
  const spDeck = () => document.querySelector('#staffPick .sp-deck');

  async function pickPartner(code){
    if (!API.enabled){ toast(T('sup.needserver','Start de server (npm start) om de leverancier-app te gebruiken.')); return; }
    pickCode = code;
    gateRoster = { supplier:{ name: code }, staff: [] };
    try { gateRoster = await API.call('/supplier/roster', { code }); } catch(e){}
    $('#spBiz').textContent = gateRoster.supplier.name;
    $('#spPin').classList.remove('open');
    renderRoles();
    $('#staffPick').classList.add('open');
  }
  // Stap 1: de rol
  function renderRoles(){
    spH2().textContent = T('sp.roleq','Wie bent u?');
    spDeck().textContent = T('sp.roledeck','Kies uw rol; u logt in met uw eigen pincode.');
    $('#spBack2') && $('#spBack2').remove();
    $('#spList').innerHTML = [
      ['personeel','👥',T('sp.r.staff','Personeel'),T('sp.r.staff.s','Bediening, keuken, receptie, chauffeurs...')],
      ['management','⭐',T('sp.r.mgmt','Management'),T('sp.r.mgmt.s','Managers en chefs, volledige toegang met eigen pincode')],
      ['sollicit','📝',T('sp.r.apply','Solliciteren'),T('sp.r.apply.s','Werken bij ' + gateRoster.supplier.name + '? Solliciteer direct.')]
    ].map(r =>
      '<button class="sp-person" data-rol="'+r[0]+'"><span class="av">'+r[1]+'</span><span><b>'+r[2]+'</b><span>'+r[3]+'</span></span></button>'
    ).join('');
    // Vaste werkplekken. Horeca krijgt keuken, bar, bediening en events;
    // elk bedrijf krijgt een Kantoor waar het management alles regelt.
    // Een werkplek open je met je eigen naam en PIN.
    const gtype = (gateRoster.supplier && gateRoster.supplier.type) || TYPEOF[pickCode] || '';
    const horeca = ['restaurant','bar','club'].includes(gtype);
    const st = [];
    if (horeca){
      st.push(
        ['keuken','\uD83D\uDD25',T('st.keuken','Keuken-scherm'),T('st.keuken.s','Bontickets, bump-knoppen, allergieen groot in beeld')],
        ['bar','\uD83C\uDF78',T('st.bar','Bar-scherm'),T('st.bar.s','Drankjes klaarmelden, ophaalcodes groot in beeld')],
        ['bediening','\uD83E\uDDFE',T('st.bediening','Bedieningspost'),T('st.bediening.s','Uitserveren, tafels en de PDA op een plek')],
        ['events','\uD83C\uDF9F',T('st.events','Events-scherm'),T('st.events.s','Gastenlijst en check-in aan de deur')]
      );
    }
    if (gtype === 'zzp'){
      st.push(['agenda','\uD83D\uDDD3\uFE0F',T('st.agenda','Agenda'),T('st.agenda.s','Uw boekingen: bevestigen, leveren en afronden')]);
    }
    if (['taxi','jet'].includes(gtype)){
      st.push(['chauffeur', gtype==='jet' ? '\u2708\uFE0F' : '\uD83D\uDE98',
        gtype==='jet' ? T('st.crew','Crew-post') : T('st.chauffeur','Chauffeurspost'),
        T('st.chauffeur.s','Uw ritten, route en verdiensten; grote knoppen per ritfase')]);
    }
    st.push(['kantoor','\uD83D\uDDDD',T('st.kantoor','Kantoor'),
      horeca ? T('st.kantoor.s','Alles aanpassen: HR, keuken, bar, bediening en events (alleen management)')
             : T('st.kantoor.s2','Alles aanpassen: HR, marketing en het aanbod (alleen management)')]);
    $('#spList').innerHTML += '<div style="margin:0.9rem 0 0.4rem;font-size:0.62rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--soft);">'+T('st.h','Werkplekken')+'</div>' +
      st.map(r => '<button class="sp-person" data-station="'+r[0]+'"><span class="av">'+r[1]+'</span><span><b>'+r[2]+'</b><span>'+r[3]+'</span></span></button>').join('');
    $('#spList').querySelectorAll('[data-station]').forEach(b => b.addEventListener('click', () => {
      pendingStation = b.dataset.station;
      renderStationPersons();
    }));
    $('#spList').querySelectorAll('[data-rol]').forEach(b => b.addEventListener('click', () => {
      const r = b.dataset.rol;
      pendingStation = null;
      if (r === 'management') renderPersons(null, true);
      else if (r === 'personeel') renderFuncs();
      else renderApply();
    }));
  }

  // Werkplek openen: iedereen van het team mag dat, op eigen naam en PIN.
  function renderStationPersons(){
    let all = gateRoster.staff || [];
    if (pendingStation === 'kantoor') all = all.filter(m => m.role === 'manager');
    const naam = stationLabel(pendingStation);
    spH2().textContent = naam;
    spDeck().textContent = pendingStation === 'kantoor'
      ? T('st.pickmgr','Het Kantoor is voor eigenaren en managers. Kies uw naam en voer uw pincode in.')
      : T('st.pickname','Wie opent deze werkplek? Kies uw naam en voer uw pincode in.');
    $('#spList').innerHTML = (all.map(m =>
      '<button class="sp-person" data-sid="'+m.id+'" data-name="'+m.name.replace(/"/g,'&quot;')+'" data-role="'+m.role+'">'+
        '<span class="av">'+initials(m.name)+'</span><span><b>'+m.name+'</b><span>'+(m.func||T('role.'+m.role, m.role==='manager'?'Manager':'Medewerker'))+'</span></span></button>'
    ).join('') || '<div class="empty" style="padding:1.2rem 0;">'+T('sp.nostaff','Nog geen persoonlijke accounts. Log in als Beheer en voeg je team toe.')+'</div>') + backBtn();
    $('#spList').querySelectorAll('.sp-person[data-sid]').forEach(b => b.addEventListener('click', () => openPin(b.dataset.sid, b.dataset.name, b.dataset.role)));
    bindBack(() => { pendingStation = null; renderRoles(); });
  }
  // Stap 2a: personeel kiest de functie
  function renderFuncs(){
    const type = TYPEOF[pickCode] || 'restaurant';
    spH2().textContent = T('sp.funcq','Wat is uw functie?');
    spDeck().textContent = T('sp.funcdeck','Kies uw functie, daarna uw naam en pincode.');
    $('#spList').innerHTML = (FUNCS[type]||[]).map(f =>
      '<button class="sp-person" data-func="'+f.replace(/"/g,'&quot;')+'"><span class="av">'+f[0]+'</span><span><b>'+f+'</b></span></button>'
    ).join('') + backBtn();
    $('#spList').querySelectorAll('[data-func]').forEach(b => b.addEventListener('click', () => renderPersons(b.dataset.func, false)));
    bindBack(renderRoles);
  }
  // Stap 2b/3: personen (van een functie, of het management)
  function renderPersons(func, mgmt){
    const all = gateRoster.staff || [];
    let list = mgmt ? all.filter(m => m.role === 'manager')
      : all.filter(m => (m.func||'').toLowerCase() === String(func).toLowerCase());
    const fallback = !mgmt && !list.length;
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
      '<div class="field" style="margin-top:0.4rem;"><label>'+T('sp.a.name','Uw naam')+'</label><input id="apName"></div>'+
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
  function backBtn(){ return '<button class="sp-biz-btn" id="spBack2" style="margin-top:0.9rem;">← '+T('sp.back','Terug')+'</button>'; }
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
    const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
    $('#spPad').innerHTML = keys.map(k => k==='' ? '<span></span>' :
      '<button class="sp-key'+(k==='⌫'?' wide':'')+'" data-k="'+k+'">'+k+'</button>').join('');
    document.querySelectorAll('#spPad [data-k]').forEach(b => b.addEventListener('click', () => pinKey(b.dataset.k)));
  }
  async function pinKey(k){
    $('#spDots').classList.remove('bad');
    if (k==='⌫'){ pinBuf = pinBuf.slice(0,-1); renderDots(); return; }
    if (pinBuf.length >= 4) return;
    pinBuf += k; renderDots();
    if (pinBuf.length === 4){
      const pin = pinBuf;
      const ok = await login({ code: pickCode, staffId: pinFor, pin }, false, true);
      if (!ok){ $('#spDots').classList.add('bad'); pinBuf=''; setTimeout(renderDots, 400); }
    }
  }
  $('#spPinCancel').addEventListener('click', () => { $('#spPin').classList.remove('open'); pinBuf=''; });

  // Gemeenschappelijke login. Geeft true/false terug bij PIN, zodat de pad kan reageren.
  async function login(body, isCred, silent){
    if (!API.enabled){ toast(T('sup.needserver','Start de server (npm start) om de leverancier-app te gebruiken.')); return false; }
    try {
      const d = await API.call('/supplier/login', body);
      API.token = d.token;
      applyState(d.state);
    } catch(e){
      if (silent) return false;
      toast(isCred ? T('login.bad','Onjuiste gebruikersnaam of wachtwoord.') : (e.message||T('login.failed','Inloggen mislukt.')));
      return false;
    }
    try { localStorage.setItem('rtg_sup_token', API.token); } catch(e){}
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
  }

  // Blijf ingelogd: met een bewaard token direct de app in, zonder PIN.
  async function restoreSession(){
    if (!API.enabled) return;
    let t = null; try { t = localStorage.getItem('rtg_sup_token'); } catch(e){}
    if (!t) return;
    API.token = t;
    try {
      const st = (await API.call('/supplier/state')).state;
      // In een sector-app alleen herstellen als de sessie bij deze sector hoort;
      // het token blijft bewaard voor de app waar het wel bij hoort.
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
    if (pickCode) pickPartner(pickCode); else $('#staffPick').classList.remove('open');
  }

  function applyState(st){ state = st; S = st.supplier; }

