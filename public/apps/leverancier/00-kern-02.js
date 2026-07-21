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
    vracht:   { label:'Vracht',    svg:'<path d="M4 14l8-1.5L20 14l-1.4 3.6H5.4z"/><path d="M7 12.5V8h4v4M11 10.5V6h5v6.5"/><path d="M3 20c1.2.8 2.4.8 3.6 0 1.2.8 2.4.8 3.6 0 1.2.8 2.4.8 3.6 0 1.2.8 2.4.8 3.6 0"/>', cap:'vracht' },
    gebouw:   { label:'Gebouw',    svg:'<path d="M5 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17"/><path d="M15 9h3a1 1 0 0 1 1 1v11"/><path d="M3 21h18"/><path d="M8 7h2M8 11h2M8 15h2M12 7h.01M12 11h.01M12 15h.01"/>', cap:'gebouw' },
    golf:     { label:'Golfbaan',  svg:'<path d="M12 3v12"/><path d="M12 3l6 2.5-6 2.5"/><circle cx="12" cy="18.5" r="2.5"/>', cap:'golf' },
    fitclub:  { label:'Club',      svg:'<path d="M3 12h2M19 12h2M8 12h8"/><rect x="5" y="8" width="3" height="8" rx="1"/><rect x="16" y="8" width="3" height="8" rx="1"/>', cap:'fitclub' },
    weddings: { label:'Draaiboek', svg:'<path d="M12 8c-1.5-2.5-5-2.5-6 0-0.8 2 0.8 4 6 8 5.2-4 6.8-6 6-8-1-2.5-4.5-2.5-6 0z"/><path d="M12 3v2M7 4.5l1 1.5M17 4.5l-1 1.5"/>', cap:'weddings' },
    advies:   { label:'Praktijk',  svg:'<path d="M12 4v16M6 20h12"/><path d="M12 6h6l-2.5 5a3 3 0 0 0 5 0L18 6M12 6H6l2.5 5a3 3 0 0 1-5 0L6 6"/>', cap:'advies' },
    polis:    { label:'Advies',    svg:'<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12h6M12 9v6"/>', cap:'polis' },
    marina:   { label:'Marina',    svg:'<circle cx="12" cy="5" r="2"/><path d="M12 7v13"/><path d="M5 13c0 4 3 6.5 7 7 4-0.5 7-3 7-7"/><path d="M9 10h6"/>', cap:'marina' },
    beauty:   { label:'Salon',     svg:'<circle cx="6.5" cy="7" r="2.5"/><circle cx="6.5" cy="17" r="2.5"/><path d="M8.7 8.6 19 18M8.7 15.4 19 6M12.6 12l1.6 1.5"/>', cap:'beauty' },
    petcare:  { label:'Petcare',   svg:'<circle cx="8" cy="7.5" r="1.8"/><circle cx="16" cy="7.5" r="1.8"/><circle cx="4.8" cy="11.5" r="1.6"/><circle cx="19.2" cy="11.5" r="1.6"/><path d="M12 11.5c-2.8 0-5 2.2-5 4.6 0 1.6 1.2 2.9 2.8 2.9 0.9 0 1.5-0.4 2.2-0.4s1.3 0.4 2.2 0.4c1.6 0 2.8-1.3 2.8-2.9 0-2.4-2.2-4.6-5-4.6z"/>', cap:'petcare' },
    opvang:   { label:'Opvang',    svg:'<circle cx="12" cy="7" r="3"/><path d="M6 21c0-3.9 2.7-6.5 6-6.5s6 2.6 6 6.5"/><path d="M4.5 10.5c1-2.5 2.5-4 4.5-4.8M19.5 10.5c-1-2.5-2.5-4-4.5-4.8"/>', cap:'opvang' },
    boerderij:{ label:'Boerderij', svg:'<path d="M4 10l6-4 6 4"/><path d="M6 10v9h8v-9"/><path d="M14 13h6v6h-6z"/><path d="M9 19v-4h2v4"/>', cap:'boerderij' },
    creator:  { label:'Creator',   svg:'<rect x="3" y="5" width="13" height="14" rx="2"/><path d="M16 9l5-3v12l-5-3"/>', cap:'creator' },
    samenwerking:{ label:'Samenwerken', svg:'<path d="M9 11l2 2 4-4"/><circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/><path d="M7 10v4a3 3 0 0 0 3 3h4"/>' },
    facturen: { label:'Facturen',  svg:'<path d="M6 2h9l3 3v17l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h4"/>' },
    rtfmarkt: { label:'De Salon · RTF', svg:'<path d="M4 7h16l-1 4a3 3 0 0 1-3 2.4H8A3 3 0 0 1 5 11z"/><path d="M4 7 6 3h12l2 4"/><path d="M6 13v7h12v-7"/>' },
    huur:     { label:'Verhuur',   svg:'<path d="M5 12l1.6-4.6A2 2 0 0 1 8.5 6h7a2 2 0 0 1 1.9 1.4L19 12"/><rect x="3.5" y="12" width="17" height="5.5" rx="1.8"/><circle cx="7.5" cy="17.5" r="1.6"/><circle cx="16.5" cy="17.5" r="1.6"/><path d="M7 9.5h10"/>', cap:'huur' },
    verkoop:  { label:'Verkoop',   svg:'<path d="M5 12l1.6-4.6A2 2 0 0 1 8.5 6h7a2 2 0 0 1 1.9 1.4L19 12"/><rect x="3.5" y="12" width="17" height="5.5" rx="1.8"/><circle cx="7.5" cy="17.5" r="1.6"/><circle cx="16.5" cy="17.5" r="1.6"/><path d="M9.5 9.2l1.6 1.6 3-3"/>', cap:'huur' },
    retail:   { label:'Mode',      svg:'<path d="M8 4l-4 3 1.5 2.5L7 8.5V20h10V8.5l1.5 1L20 7l-4-3-2 1.5a2 2 0 0 1-4 0z"/>', cap:'retail' },
    winkelvloer:{ label:'Winkelvloer', svg:'<path d="M4 7h16l-1 4a3 3 0 0 1-3 2.4H8A3 3 0 0 1 5 11z"/><path d="M4 7 6 3h12l2 4"/><path d="M6 13v7h12v-7"/><path d="M10 20v-4h4v4"/>', cap:'retail' },
    zorgbalie:{ label:'Zorgbalie', svg:'<path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.4-7 10-7 10z"/>', cap:'care' },
    charter:  { label:'Charter',   svg:'<path d="M4 15l8-3 8 3-1.6 4H5.6z"/><path d="M12 12V4l6 4-6 1"/><path d="M3 20c1.2.8 2.4.8 3.6 0 1.2.8 2.4.8 3.6 0 1.2.8 2.4.8 3.6 0 1.2.8 2.4.8 3.6 0"/>', cap:'charter' },
    groothandel:{ label:'Groothandel', svg:'<rect x="3" y="8" width="18" height="12" rx="1.5"/><path d="M3 8l2-4h14l2 4"/><path d="M10 12h4"/>', cap:'groothandel' },
    inkoop:   { label:'Inkoop',    svg:'<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M2 3h3l2.2 12.3a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.2L21 7H6"/>', cap:'menu' },
    boardroom:{ label:'Boardroom', svg:'<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M7 20h10M12 18v2"/><path d="M7 12l2.5-2.5L12 12l3-3 2 2"/>' },
    beveiliging:{ label:'Commandocentrum', svg:'<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9.5 12l1.8 1.8 3.4-3.6"/>', cap:'beveiliging' },
    paspoort: { label:'Identiteit', svg:'<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="12" cy="10" r="2.4"/><path d="M8 16c0.5-2 2.2-3 4-3s3.5 1 4 3"/>' },
    rooms:    { label:'Kamers',    svg:'<path d="M3 18v-8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8"/><path d="M3 18h18M3 21v-3M21 21v-3"/><path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/>', cap:'bookings' },
    dorp:     { label:'Afdelingen', svg:'<path d="M3 21h18"/><path d="M5 21V8l4-3 4 3v13"/><path d="M13 21v-9h6v9"/><path d="M8 12h.01M8 15h.01M16 15h.01M16 18h.01"/>' },
    minibar:  { label:'Minibar',   svg:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 12h14"/><path d="M9 7.5v1.5M9 15.5v1.5"/>', cap:'bookings' },
    tafels:   { label:'Tafels',    svg:'<circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>', cap:'menu' },
    klussen:  { label:'Klussen',   svg:'<path d="M14.5 6.5a4 4 0 0 0-5.6 4.9L3 17.3V21h3.7l5.9-5.9a4 4 0 0 0 4.9-5.6l-2.6 2.6-2.4-2.4z"/>', cap:'bookings' },
    beheer:   { label:'Beheer',    svg:'<circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>' },
    doors:    { label:'Deuren',    svg:'<rect x="5" y="3" width="14" height="18" rx="1.5"/><circle cx="15" cy="12" r="1.2"/><path d="M5 21h14"/>', cap:'doors' },
    gasten:   { label:'Gasten',    svg:'<circle cx="12" cy="7.5" r="3"/><path d="M5.5 20c.7-3.6 3.2-5.5 6.5-5.5s5.8 1.9 6.5 5.5"/><path d="M12 14.5v2M12 19v.5"/>' },
    location: { label:'Locatie',   svg:'<path d="M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>', cap:'location' },
    gchat:    { label:'Gastchat',  svg:'<path d="M21 12a8 8 0 0 1-8 8H4l2.5-3A8 8 0 1 1 21 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>' },
    ai:       { label:'AI',        svg:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>' },
    meer:     { label:'Meer',      svg:'<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>' },
    contract: { label:'Contracten', svg:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/><path d="M14.5 18.5l1.5 1.5 3-3"/>' },
    borden:   { label:'Borden',     svg:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 8v8M12.5 8v5M17 8v3"/>' },
    reviews:  { label:'Reviews',    svg:'<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.3l6.1-.7z"/>' },
    voorraad: { label:'Voorraad',   svg:'<path d="M3 8l9-5 9 5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19z"/><path d="M3 8h18M9 12h6"/>' },
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
