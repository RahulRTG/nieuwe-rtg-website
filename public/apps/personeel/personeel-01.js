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
    { id:'creator', icon:'🎬', nl:'Creators', en:'Creators', sub:'Content, planning, samenwerkingen', codes:['LUMINA'] }
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
    LIENZO:{ name:'Galeria Lienzo', icon:'🖼️' }
  };

  // De API-client komt uit de gedeelde app-shell (public/shared/appshell.js),
  // zodat alle apps zich identiek gedragen.
  const API = RTGApp.maakAPI();

  let state = null, me = null, code = null, week = null;
  let toastTimer;
  function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),3000); }
  function timeAgo(iso){ const s=Math.max(1,Math.round((Date.now()-new Date(iso))/1000)); if(s<60)return T('t.now','zojuist'); const m=Math.round(s/60); if(m<60)return m+T('t.min',' min'); const h=Math.round(m/60); if(h<24)return h+T('t.hour',' uur'); return Math.round(h/24)+T('t.days',' dg'); }
  function esc(x){ return String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

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
