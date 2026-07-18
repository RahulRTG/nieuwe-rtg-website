(function(){
  const $ = s => document.querySelector(s);
  const T = (k, nl) => (window.RTGi18n ? RTGi18n.t(k, nl) : nl);
  const lang = () => (window.RTGi18n ? RTGi18n.lang : 'nl');
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
  function gateTik(){
    const k = document.getElementById('gateKlok'), dt = document.getElementById('gateDatum');
    if (!k && !dt) return;
    const now = new Date(), loc = lang()==='en' ? 'en-GB' : 'nl-NL';
    if (k) k.textContent = now.toLocaleTimeString(loc, { hour:'2-digit', minute:'2-digit' });
    if (dt) dt.textContent = now.toLocaleDateString(loc, { weekday:'long', day:'numeric', month:'long' });
  }
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
  function stepAanmelden(){
    $('#gateStep').innerHTML =
      '<button class="gback" id="jaBack">← '+T('pd.back','Terug')+'</button>'+
      '<form class="lform" id="joinForm" autocomplete="on">'+
        '<input id="jaBedrijf" type="text" placeholder="'+T('pd.ja.bedrijf','Bedrijfsnaam')+'" aria-label="'+T('pd.ja.bedrijf','Bedrijfsnaam')+'">'+
        '<input id="jaCode" type="text" autocapitalize="characters" placeholder="'+T('pd.ja.code','Kassacode van uw werkgever')+'" aria-label="'+T('pd.ja.code','Kassacode van uw werkgever')+'">'+
        '<input id="jaUser" type="text" autocomplete="username" placeholder="'+T('pd.li.user','E-mail of gebruikersnaam')+'" aria-label="'+T('pd.li.user','E-mail of gebruikersnaam')+'">'+
        '<input id="jaPass" type="password" autocomplete="current-password" placeholder="'+T('pd.ja.rtgpass','Wachtwoord van uw RTG-account')+'" aria-label="'+T('pd.ja.rtgpass','Wachtwoord van uw RTG-account')+'">'+
        '<input id="jaPin" type="password" inputmode="numeric" maxlength="4" placeholder="'+T('pd.ja.pin','Kies een pincode (4 cijfers)')+'" aria-label="'+T('pd.ja.pin','Kies een pincode van 4 cijfers')+'">'+
        '<div class="err" id="jaErr" role="alert"></div>'+
        '<button class="prim" type="submit">'+T('pd.aanmelden.go','Aanmelden')+'</button>'+
      '</form>'+
      '<div class="lhint">'+T('pd.ja.hint','Nog geen RTG-account? Maak er gratis een aan in de leden-app; daarna meldt u zich hier aan met de kassacode van uw werkgever.')+'</div>';
    $('#jaBack').addEventListener('click', stepLogin);
    $('#joinForm').addEventListener('submit', async e => {
      e.preventDefault();
      $('#jaErr').textContent = '';
      const btn = e.target.querySelector('button.prim'); btn.disabled = true;
      try {
        await API.call('/supplier/staff/join', { bedrijf: $('#jaBedrijf').value.trim(), kassacode: $('#jaCode').value.trim(),
          login: $('#jaUser').value.trim(), password: $('#jaPass').value, pin: $('#jaPin').value.trim() });
        // aangemeld: log meteen in met hetzelfde account en land op het bedrijf
        await mijnLogin($('#jaUser').value.trim(), $('#jaPass').value);
      } catch(err){ $('#jaErr').textContent = err.message || T('pd.mis','Er ging iets mis.'); btn.disabled = false; }
    });
    $('#jaBedrijf').focus();
  }
  // Wachtwoord vergeten: stuurt de herstelmail; verder gaat het via de leden-app.
  function stepForgot(){
    $('#gateStep').innerHTML =
      '<button class="gback" id="fgBack">← '+T('pd.back','Terug')+'</button>'+
      '<form class="lform" id="forgotForm" autocomplete="on">'+
        '<input id="fgEmail" type="email" autocomplete="email" placeholder="'+T('pd.fg.email','Uw e-mailadres')+'" aria-label="'+T('pd.fg.email','Uw e-mailadres')+'">'+
        '<div class="err" id="fgErr" role="alert"></div>'+
        '<button class="prim" type="submit">'+T('pd.fg.go','Stuur herstel-link')+'</button>'+
      '</form>'+
      '<div class="lhint">'+T('pd.fg.hint','We sturen een link en een code om uw wachtwoord opnieuw in te stellen. Dat rondt u af in de leden-app.')+'</div>';
    $('#fgBack').addEventListener('click', stepLogin);
    $('#forgotForm').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button.prim'); btn.disabled = true;
      try { await API.call('/auth/forgot', { email: $('#fgEmail').value.trim() });
        toast(T('pd.fg.ok','Als dit adres bij ons bekend is, is de herstel-link onderweg.'));
        stepLogin();
      } catch(err){ $('#fgErr').textContent = err.message || T('pd.mis','Er ging iets mis.'); btn.disabled = false; }
    });
    $('#fgEmail').focus();
  }
  // Inloggen met het RTG-account en landen op de juiste bedrijfspagina.
  async function mijnLogin(login, password, bedrijf){
    const d = await API.call('/supplier/mijn/login', { login, password, bedrijf: bedrijf || '' });
    await landMijn(d);
  }
  // Land (of wissel) naar een van de eigen werkplekken: sessie zetten en de app openen.
  async function landMijn(d){
    API.token = d.token; state = d.state; code = d.supplier.code;
    me = { name: d.actor.name, role: d.actor.role, staffId: d.actor.staffId };
    mijnPosities = d.posities || [];
    try { localStorage.setItem('rtg_pda_token', API.token); localStorage.setItem('rtg_pda_code', code); } catch(e){}
    week = await API.call('/supplier/schedule', {}).catch(()=>null);
    enter();
  }
  function stepSector(){
    kantoorStop();
    $('#gateStep').innerHTML = '<div class="glist">' + SECTORS.map(s =>
      '<button class="gbtn" data-sec="'+s.id+'"><span class="ic">'+s.icon+'</span><span><b>'+(lang()==='en'?s.en:s.nl)+'</b><span>'+s.sub+'</span></span></button>'
    ).join('') +
      '<button class="gbtn" id="gKantoor"><span class="ic">🏢</span><span><b>'+T('pd.kantoor','RTG Kantoor')+'</b><span>'+T('pd.kantoor.sub','Aanmelden en meewerken, ook vanuit huis')+'</span></span></button>'
    + '</div>';
    document.querySelectorAll('[data-sec]').forEach(b => b.addEventListener('click', () => stepBedrijf(b.dataset.sec)));
    $('#gKantoor').addEventListener('click', stepKantoor);
  }
  function stepBedrijf(secId){
    const sec = SECTORS.find(s => s.id === secId);
    $('#gateStep').innerHTML = '<button class="gback" id="gb1">← '+T('pd.back','Terug')+'</button><div class="glist">' + sec.codes.map(c =>
      '<button class="gbtn" data-bedrijf="'+c+'"><span class="ic">'+BEDRIJVEN[c].icon+'</span><span><b>'+BEDRIJVEN[c].name+'</b><span>'+T('pd.choose','Kies uw bedrijf')+'</span></span></button>'
    ).join('') + '</div>';
    $('#gb1').addEventListener('click', stepSector);
    document.querySelectorAll('[data-bedrijf]').forEach(b => b.addEventListener('click', () => stepWie(secId, b.dataset.bedrijf)));
  }
  async function stepWie(secId, c){
    let roster = { staff: [] };
    try { roster = await API.call('/supplier/roster', { code: c }); }
    catch(e){ toast(T('pd.needserver','Start de server om in te loggen.')); return; }
    // dit apparaat staat nu vast op dit bedrijf
    try { localStorage.setItem('rtg_pda_bedrijf', c); } catch(e){}
    $('#gateStep').innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.6rem;margin-bottom:0.3rem;">'+
        '<div style="font-size:0.9rem;"><b>'+BEDRIJVEN[c].icon+' '+esc(BEDRIJVEN[c].name)+'</b><div style="font-size:0.68rem;color:var(--soft);">'+T('pd.vast','Deze PDA staat op dit bedrijf')+'</div></div>'+
        '<button class="gback" id="gbSwitch" style="margin:0;">'+T('pd.switch','Ander bedrijf')+'</button>'+
      '</div><div class="glist">' + (roster.staff||[]).map(m =>
      '<button class="gbtn" data-wie="'+m.id+'" data-nm="'+esc(m.name)+'"><span class="ic">'+(m.role==='manager'?'⭐':'👤')+'</span><span><b>'+m.name+'</b><span>'+(m.role==='manager'?'Manager':T('pd.staff','Medewerker'))+'</span></span></button>'
    ).join('') + '</div>'+
      '<div style="margin-top:0.8rem;font-size:0.7rem;line-height:1.5;color:var(--soft);">'+T('pd.nieuw','Nieuw? Vraag uw werkgever om een kassacode en meld u eenmalig aan in de leverancier-app.')+'</div>';
    $('#gbSwitch').addEventListener('click', () => {
      try { localStorage.removeItem('rtg_pda_bedrijf'); } catch(e){}
      stepSector();
    });
    document.querySelectorAll('[data-wie]').forEach(b => b.addEventListener('click', () => stepPin(secId, c, Number(b.dataset.wie), b.dataset.nm)));
  }
  function stepPin(secId, c, staffId, nm){
    $('#gateStep').innerHTML = '<button class="gback" id="gb3">← '+T('pd.back','Terug')+'</button>'+
      '<div style="margin-top:0.4rem;font-size:0.9rem;"><b>'+esc(nm)+'</b> · '+BEDRIJVEN[c].name+'</div>'+
      '<div class="pinrow"><input id="pinInp" type="password" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="off"><button id="pinGo">'+T('pd.login','Inloggen')+'</button></div>'+
      '<div style="margin-top:0.7rem;font-size:0.72rem;color:var(--soft);">'+T('pd.pinhint','Demo: manager 1234, medewerker 5678.')+'</div>';
    $('#gb3').addEventListener('click', () => stepWie(secId, c));
    const go = async () => {
      try {
        const d = await API.call('/supplier/login', { code: c, staffId, pin: $('#pinInp').value });
        API.token = d.token; state = d.state; code = c;
        me = { name: d.state.actor.name, role: d.state.actor.role, staffId: d.state.actor.staffId };
        try { localStorage.setItem('rtg_pda_token', API.token); localStorage.setItem('rtg_pda_code', code); } catch(e2){}
        week = await API.call('/supplier/schedule', {}).catch(()=>null);
        enter();
      } catch(e){ toast(e.message || T('pd.badpin','Onjuiste pincode.')); }
    };
    $('#pinGo').addEventListener('click', go);
    $('#pinInp').addEventListener('keydown', e => { if (e.key==='Enter') go(); });
    $('#pinInp').focus();
  }

  /* ---------- de kantoor-modus: de oude kantoor-PDA, nu een ingang hier ----------
     Kantoormensen zijn geen zaak-personeel: zij melden zich met de kantoorcode,
     kiezen hun kamer en werkplek (thuis of kantoor) en houden de kamerchat bij.
     Het volledige kantoor (taken, statistieken, boardroom) blijft kantoren.html. */
  let kaToken = null, kaDienst = null, kaTimer = null;
  try { kaToken = localStorage.getItem('rtg_office_token'); } catch(e){}
  try { kaDienst = JSON.parse(localStorage.getItem('rtg_kantoor_dienst') || 'null'); } catch(e){}
  const kaApi = (pad, body) => fetch('/api/office/' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + kaToken },
    body: JSON.stringify(body || {})
  }).then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || T('pd.mis','Er ging iets mis.')); return d; });
  function kantoorStop(){ if (kaTimer){ clearInterval(kaTimer); kaTimer = null; } }
  // het terug-adres van een kantoren-deeplink (?kamer=...): alleen eigen paden
  function kaTerugPad(){
    const t = new URLSearchParams(location.search).get('terug') || '';
    return (t.startsWith('/') && !t.startsWith('//')) ? t : null;
  }
  function stepKantoor(){
    kantoorStop();
    if (kaToken){ enterKantoor().catch(() => toonKantoorLogin()); return; }
    toonKantoorLogin();
  }
  function toonKantoorLogin(){
    $('#gateStep').innerHTML = '<button class="gback" id="kaTerug">← '+T('pd.back','Terug')+'</button>'+
      '<div class="card"><div class="k">'+T('pd.ka.code','Kantoorcode')+'</div>'+
      '<div class="pinrow" style="margin-top:0.6rem;"><input id="kaCode" type="password" autocomplete="current-password" style="letter-spacing:0.1em;" placeholder="&bull;&bull;&bull;&bull;">'+
      '<button id="kaGo">'+T('pd.ka.binnen','Binnen')+'</button></div>'+
      '<div class="k" style="margin-top:0.7rem;">'+T('pd.ka.totp','TOTP-code (alleen als die is ingesteld)')+'</div>'+
      '<input class="hin" id="kaTotp" inputmode="numeric" autocomplete="one-time-code" placeholder="123456" style="margin-top:0.4rem;">'+
      '<div id="kaFout" style="margin-top:0.5rem;font-size:0.76rem;color:var(--burgundy);min-height:1rem;"></div></div>';
    $('#kaTerug').addEventListener('click', stepSector);
    const go = async () => {
      $('#kaFout').textContent = '';
      try {
        const r = await fetch('/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: $('#kaCode').value.trim(), totp: $('#kaTotp').value.trim() }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || T('pd.ka.fout','Die code klopt niet.'));
        kaToken = d.token; try { localStorage.setItem('rtg_office_token', kaToken); } catch(e){}
        enterKantoor();
      } catch(e){ $('#kaFout').textContent = e.message; }
    };
    $('#kaGo').addEventListener('click', go);
    $('#kaCode').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    $('#kaCode').focus();
  }
  async function enterKantoor(){
    const k = await kaApi('kamers');
    // een kantoren-deeplink bracht ons hier alleen voor het inloggen: meteen door
    const terug = kaTerugPad();
    if (terug){ location.replace(terug); return; }
    let naam = ''; try { naam = localStorage.getItem('rtg_kantoor_naam') || ''; } catch(e){}
    $('#gateStep').innerHTML = '<button class="gback" id="kaTerug">← '+T('pd.ka.staf','Personeel van een zaak')+'</button>'+
      '<div class="card" id="kaMeld">'+
        '<div class="k">'+T('pd.ka.naam','Jouw naam')+'</div>'+
        '<input class="hin" id="kaNaam" maxlength="30" style="margin-top:0.4rem;" value="'+esc(naam)+'">'+
        '<div class="row"><select class="hin" id="kaKamer">'+k.kamers.map(x => '<option value="'+x.id+'">'+x.emoji+' '+esc(x.naam)+'</option>').join('')+'</select>'+
        '<select class="hin" id="kaWaar" style="max-width:9.5rem;"><option value="thuis">🏠 '+T('pd.ka.thuis','Thuis')+'</option><option value="kantoor">🏢 '+T('pd.ka.hier','Kantoor')+'</option></select></div>'+
        '<button class="abtn" id="kaMeldGo" style="margin-top:0.7rem;width:100%;padding:0.8rem;">'+T('pd.ka.meld','Meld je aan voor je dienst')+'</button>'+
        '<div id="kaMFout" style="margin-top:0.4rem;font-size:0.76rem;color:var(--burgundy);min-height:1rem;"></div></div>'+
      '<div class="card" id="kaDienstBlok" hidden><div id="kaDienstTekst" style="font-size:0.9rem;"></div>'+
        '<button class="abtn ghost" id="kaAfmeld" style="margin-top:0.6rem;">'+T('pd.ka.afmeld','Meld je af')+'</button></div>'+
      '<div class="card"><div class="k">'+T('pd.ka.wie','Nu aan het werk')+'</div><div id="kaWie" style="margin-top:0.4rem;"></div></div>'+
      '<div class="card"><div class="k">'+T('pd.ka.chat','De chat van jouw kamer')+'</div>'+
        '<div id="kaChat" style="max-height:15rem;overflow-y:auto;font-size:0.85rem;margin-top:0.4rem;"></div>'+
        '<div class="row"><input class="hin" id="kaTekst" maxlength="500" placeholder="'+T('pd.ka.bericht','Bericht...')+'">'+
        '<button class="abtn" id="kaStuur">'+T('pd.ka.stuur','Stuur')+'</button></div></div>'+
      '<div style="margin-top:0.6rem;font-size:0.7rem;line-height:1.5;color:var(--soft);">'+T('pd.ka.uitleg','Het volledige kantoor (statistieken, taken, boardroom) staat in de kantoren-app; dit is je zak-versie voor aanmelden en contact.')+'</div>';
    $('#kaTerug').addEventListener('click', stepSector);
    const toonDienst = () => {
      $('#kaMeld').hidden = !!kaDienst;
      $('#kaDienstBlok').hidden = !kaDienst;
      if (kaDienst) $('#kaDienstTekst').textContent = '✅ ' + kaDienst.naam + ' ' + T('pd.ka.aangemeld','is aangemeld') + ' (' + kaDienst.waar + ', ' + kaDienst.kamer + ').';
    };
    const laadWie = async () => {
      try {
        const d = await kaApi('dienst');
        $('#kaWie').innerHTML = d.aangemeld.length ? d.aangemeld.map(x =>
          '<div class="task"><span class="ic">'+(x.waar==='thuis'?'🏠':'🏢')+'</span><div class="t"><b>'+esc(x.naam)+'</b><span>'+esc(x.kamer)+'</span></div></div>').join('')
          : '<div style="color:var(--soft);font-size:0.8rem;">'+T('pd.ka.niemand','Nog niemand aangemeld.')+'</div>';
      } catch(e){}
    };
    const laadChat = async () => {
      try {
        const kamer = kaDienst ? kaDienst.kamer : $('#kaKamer').value;
        if (!kamer) return;
        const d = await kaApi('kachat', { kamer });
        $('#kaChat').innerHTML = d.berichten.length ? d.berichten.slice(-25).map(m =>
          '<div style="padding:0.25rem 0;border-bottom:1px solid var(--line);"><b style="color:var(--gold);">'+esc(m.naam)+'</b> '+esc(m.tekst||'')+(m.foto?' 📸':'')+'</div>').join('')
          : '<div style="color:var(--soft);font-size:0.8rem;">'+T('pd.ka.stil','Nog stil hier.')+'</div>';
        $('#kaChat').scrollTop = $('#kaChat').scrollHeight;
      } catch(e){}
    };
    $('#kaMeldGo').addEventListener('click', async () => {
      $('#kaMFout').textContent = '';
      try {
        const d = await kaApi('dienst/in', { naam: $('#kaNaam').value, kamer: $('#kaKamer').value, waar: $('#kaWaar').value });
        kaDienst = d.dienst;
        try { localStorage.setItem('rtg_kantoor_dienst', JSON.stringify(kaDienst)); localStorage.setItem('rtg_kantoor_naam', kaDienst.naam); } catch(e){}
        toonDienst(); laadWie();
      } catch(e){ $('#kaMFout').textContent = e.message; }
    });
    $('#kaAfmeld').addEventListener('click', async () => {
      try { await kaApi('dienst/uit', { id: kaDienst.id }); } catch(e){}
      kaDienst = null; try { localStorage.removeItem('rtg_kantoor_dienst'); } catch(e){}
      toonDienst(); laadWie();
    });
    const stuur = async () => {
      try {
        await kaApi('kachat/stuur', { kamer: kaDienst ? kaDienst.kamer : $('#kaKamer').value, naam: (kaDienst && kaDienst.naam) || $('#kaNaam').value || T('pd.ka.collega','collega'), tekst: $('#kaTekst').value });
        $('#kaTekst').value = ''; laadChat();
      } catch(e){}
    };
    $('#kaStuur').addEventListener('click', stuur);
    $('#kaTekst').addEventListener('keydown', e => { if (e.key === 'Enter') stuur(); });
    toonDienst(); laadWie(); laadChat();
    kantoorStop();
    kaTimer = setInterval(() => { if (!document.hidden && document.getElementById('kaChat')) { laadWie(); laadChat(); } else kantoorStop(); }, 8000);
  }

  function enter(){
    $('#gate').style.display = 'none';
    $('#app').classList.add('active');
    $('#meName').textContent = me.name;
    const bedrijfNaam = (BEDRIJVEN[code] && BEDRIJVEN[code].name) || (state && state.supplier && state.supplier.name) || code;
    $('#meSub').textContent = bedrijfNaam + ' · ' + (me.role==='manager'?'Manager':T('pd.staff','Medewerker'));
    renderAll();
    laadZaken().then(renderAll);
    laadZorgbalie();
    startStream();
  }
  function renderAll(){ renderToday(); renderRooster(); renderTaken(); renderKeuken(); renderKamers(); renderHulp(); renderRitten(); renderBezorgen(); renderEntree(); renderWinkel(); renderVaart(); renderVerkoop(); renderBevPda(); renderBoer(); renderZorgbalie(); renderBorden(); renderTeam(); }

  /* ---- Borden: hetzelfde werkbord als in de leverancier-app (shared/borden.js) ---- */
  let pdBordenUI = null;
  function renderBorden(){
    const wrap = $('#pdBordenWrap');
    if (!wrap || !window.BordenUI) return;
    if (pdBordenUI) { pdBordenUI.refresh(); return; }
    pdBordenUI = BordenUI.mount(wrap, {
      laad: () => API.call('/supplier/borden'),
      doe: b => API.call('/supplier/bord', b),
      teamleden: () => (state && state.staff || []).map(m => ({ id: m.id, name: m.name })),
      kanBeheren: () => !!(me && me.role === 'manager'),
      T, toast
    });
  }
  async function refresh(){ try { state = (await API.call('/supplier/state')).state; await laadZaken(); renderAll(); } catch(e){} }

  // eigen personeelszaken: kloktijden, verlofaanvragen en de vertrouwenslijn
  let zaken = null;
  let pdContracten = [];
  let aandacht = null;   // gasten die aandacht vragen + te lang stille tafels
  let netwerk = [];      // verbindingen met andere zaken (personeelsnetwerk)
  let trainData = null;  // training & tips: tip van de dag, rol-tips, eigen tips
  let coachAntwoord = null; // laatste antwoord van de AI-coach
  let tipsOpen = false;     // toon de volledige tip-lijst
  let coachRef = null;      // coaching voor een concrete tafel/bestelling
  let coachRefTafel = null; // leesbare naam van die tafel
  let wisselOpties = []; // verbonden zaken waar dit personeelslid ook op het rooster staat
  let mijnPosities = []; // eigen werkplekken (RTG-account) om tussen te wisselen na 1x aanmelden
  async function laadZaken(){
    try { zaken = await API.call('/staff/mine', {}); } catch(e){ zaken = null; }
    try { wisselOpties = (await API.call('/supplier/wissel/opties', {})).opties || []; } catch(e){ wisselOpties = []; }
    try { mijnPosities = (await API.call('/supplier/mijn/opties', {})).posities || []; } catch(e){ mijnPosities = []; }
    try { pdContracten = (await API.call('/supplier/contracten', {})).contracten || []; } catch(e){ pdContracten = []; }
    try { aandacht = await API.call('/supplier/aandacht', {}); } catch(e){ aandacht = null; }
    try { netwerk = (await API.call('/supplier/net/lijst', {})).verbindingen || []; } catch(e){ netwerk = []; }
    try { trainData = await API.call('/supplier/training', {}); } catch(e){ trainData = null; }
  }

  // Blijf ingelogd: met een bewaard token direct naar Vandaag, zonder PIN.
  async function restoreSession(){
    let t = null, c = null;
    try { t = localStorage.getItem('rtg_pda_token'); c = localStorage.getItem('rtg_pda_code'); } catch(e){}
    if (!t || !c || !BEDRIJVEN[c]) return;
    // de PDA staat vast op een bedrijf: een sessie van een ander bedrijf herstellen we niet
    const vast = pdaBedrijf();
    if (vast && vast !== c){ try { localStorage.removeItem('rtg_pda_token'); localStorage.removeItem('rtg_pda_code'); } catch(e){} return; }
    API.token = t;
    try {
      const st = (await API.call('/supplier/state')).state;
      if (!st.actor || !st.actor.staffId){ API.token = null; return; } // alleen persoonlijke logins herstellen
      state = st; code = c;
      me = { name: st.actor.name, role: st.actor.role, staffId: st.actor.staffId };
      week = await API.call('/supplier/schedule', {}).catch(()=>null);
      enter();
    } catch(e){
      API.token = null;
      try { localStorage.removeItem('rtg_pda_token'); localStorage.removeItem('rtg_pda_code'); } catch(e2){}
    }
  }

  function myShift(dayIndex){
    if (!week) return null;
    const d = week.days[dayIndex]; if (!d) return null;
    const m = d.staff.find(x => x.id === me.staffId);
    return m ? m.shift : null;
  }
  function taskList(){
    const t = [];
    (state.tickets||[]).filter(x=>x.status!=='klaar').forEach(x => t.push({ icon:'🔧', b:x.text, s:(x.room?x.room+' · ':'')+(x.status==='bezig'?T('pd.busy','wordt opgepakt'):T('pd.open','open')), kind:'ticket', id:x.id, status:x.status }));
    (state.rooms||[]).filter(r=>r.hk&&r.hk.status==='vuil').forEach(r => t.push({ icon:'🧹', b:r.name, s:T('pd.toclean','schoonmaken'), kind:'hk', id:r.id }));
    if (state.minibar){
      (state.rooms||[]).map(r=>r.name).filter(n=>!state.minibar.countedToday.includes(n)).forEach(n => t.push({ icon:'🧊', b:T('pd.minibar','Minibar tellen')+': '+n, s:T('pd.inapp','via de bedrijfsapp'), kind:'info' }));
    }
    (state.orders||[]).filter(o=>o.status==='nieuw').forEach(o => t.push({ icon:'🛎️', b:T('pd.order','Nieuwe bestelling')+' '+o.customerCodename, s:eur(o.total)+' · code '+o.pickup, kind:'info' }));
    (state.rides||[]).filter(r=>r.status==='aangevraagd').forEach(r => t.push({ icon:'🚗', b:T('pd.ride','Ritaanvraag')+' '+r.customerCodename, s:(r.from||'')+' → '+(r.to||''), kind:'info' }));
    (state.guestChats||[]).filter(c=>c.unread).forEach(c => t.push({ icon:'💬', b:c.codename+' ('+c.dept+')', s:c.last, kind:'info' }));
    return t;
  }

  function renderToday(){
    const shift = myShift(0);
    const tasks = taskList();
    $('#todaySub').textContent = new Date().toLocaleDateString(lang()==='en'?'en-GB':'nl-NL', { weekday:'long', day:'numeric', month:'long' });
    const klok = zaken && zaken.klok;
    $('#todayWrap').innerHTML =
      '<div class="card"><div class="k">'+T('pd.myshift','Uw dienst vandaag')+'</div><div class="shift-big">'+(shift||T('pd.noshift','Geen dienst'))+'</div>'+
      (klok ? '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.8rem;margin-top:0.7rem;padding-top:0.7rem;border-top:1px solid var(--line);">'+
        '<span style="font-size:0.76rem;color:var(--soft);">⏱ '+T('pd.k.vandaag','Vandaag')+' <b style="color:var(--txt);">'+klok.vandaagUren+' u</b> · '+T('pd.k.week','deze week')+' <b style="color:var(--txt);">'+klok.weekUren+' u</b></span>'+
        '<button class="abtn'+(klok.open?'':' ghost')+'" id="klokBtn">'+(klok.open?'⏹ '+T('pd.k.uit','Klok uit'):'▶ '+T('pd.k.in','Klok in'))+'</button></div>' : '')+
      '</div>'+
      '<div class="card"><div class="k">'+T('pd.tasksnow','Nu aandacht nodig')+' ('+tasks.length+')</div>'+
      (tasks.length ? tasks.slice(0,6).map(t=>'<div class="task"><span class="ic">'+t.icon+'</span><div class="t"><b>'+esc(t.b)+'</b><span>'+esc(t.s)+'</span></div></div>').join('')
        : '<div style="margin-top:0.5rem;font-size:0.82rem;color:var(--green);">✓ '+T('pd.alldone','Alles is bij.')+'</div>')+
      (tasks.length>6?'<div style="margin-top:0.5rem;font-size:0.74rem;color:var(--soft);">+'+(tasks.length-6)+' '+T('pd.more','meer onder Taken')+'</div>':'')+'</div>';
    // Service op sterrenniveau: gasten die aandacht vragen en te lang stille
    // tafels staan bovenaan, zodat niemand ooit wordt vergeten.
    const A = (aandacht && aandacht.aandacht) || [], TT = (aandacht && aandacht.traagTafels) || [];
    if (A.length || TT.length){
      let h = '<div class="card" style="border-color:var(--gold);"><div class="k" style="color:var(--gold);">'+T('pd.attn','Aandacht gevraagd')+' ('+(A.length+TT.length)+')</div>';
      h += A.map(a => '<div class="task"><span class="ic">🔔</span><div class="t"><b>'+esc(a.reden)+(a.tafel?' · '+esc(a.tafel):'')+'</b><span>'+esc(a.codename)+' · '+timeAgo(a.at)+'</span></div><button class="abtn" data-aankl="'+a.id+'">'+T('pd.help','Help')+'</button></div>').join('');
      h += TT.map(t => '<div class="task"><span class="ic">⏳</span><div class="t"><b>'+esc(t.tafel||t.ref)+'</b><span>'+esc(t.codename)+' · '+t.minuten+' min '+T('pd.waiting','zonder aandacht')+'</span></div><button class="abtn ghost" data-coachref="'+esc(t.ref)+'" data-coachtafel="'+esc(t.tafel||t.ref)+'" title="'+T('pd.tr.coachtable','Vraag de coach over deze tafel')+'">🎓</button></div>').join('');
      h += '</div>';
      $('#todayWrap').insertAdjacentHTML('afterbegin', h);
      document.querySelectorAll('[data-aankl]').forEach(b => b.addEventListener('click', async () => {
        try { await API.call('/supplier/aandacht/klaar', { id:b.dataset.aankl }); toast(T('pd.helped','Gast geholpen.')); await refresh(); openTab('vandaag'); } catch(e){ toast(e.message); }
      }));
      document.querySelectorAll('[data-coachref]').forEach(b => b.addEventListener('click', () => {
        coachRef = b.dataset.coachref; coachRefTafel = b.dataset.coachtafel; coachAntwoord = null;
        renderHulp(); openTab('hulp');
        const inp = document.getElementById('coachVraag'); if (inp) inp.focus();
      }));
    }
    const kb = document.getElementById('klokBtn');
    if (kb) kb.addEventListener('click', async () => {
      kb.disabled = true;
      try {
        const d = await API.call('/staff/clock', {});
        if (zaken) zaken.klok = d.klok;
        toast(d.actie === 'in' ? '▶ ' + T('pd.k.ingeklokt','Ingeklokt. Werk ze!') : '⏹ ' + T('pd.k.uitgeklokt','Uitgeklokt. Tot de volgende dienst.'));
        renderToday();
      } catch(e){ toast(e.message); kb.disabled = false; }
    });
    // geaccrediteerd wisselen: wie ook bij een verbonden zaak op het rooster
    // staat, stapt met een tik over, zonder opnieuw een PIN in te voeren
    if (wisselOpties.length){
      $('#todayWrap').insertAdjacentHTML('beforeend',
        '<div class="card"><div class="k">'+T('pd.ws.h','Andere afdeling')+'</div>'+
        '<div style="margin-top:0.4rem;font-size:0.76rem;color:var(--soft);">'+T('pd.ws.sub','U bent hier ook geaccrediteerd; wisselen kan direct, uw inlog reist mee.')+'</div>'+
        wisselOpties.map(o => '<div class="task"><span class="ic">'+(BEDRIJVEN[o.code]?BEDRIJVEN[o.code].icon:'🏢')+'</span><div class="t"><b>'+esc(o.naam)+'</b><span>'+T('pd.ws.acc','Geaccrediteerd via het personeelsnetwerk')+'</span></div>'+
          '<button class="abtn" data-wissel="'+esc(o.code)+'">'+T('pd.ws.ga','Wissel')+'</button></div>').join('')+'</div>');
      document.querySelectorAll('[data-wissel]').forEach(b => b.addEventListener('click', async () => {
        b.disabled = true;
        try {
          const d = await API.call('/supplier/wissel', { code: b.dataset.wissel });
          try {
            localStorage.setItem('rtg_pda_token', d.token);
            localStorage.setItem('rtg_pda_code', d.supplier.code);
            localStorage.setItem('rtg_pda_bedrijf', d.supplier.code);
          } catch(e){}
          toast('🔁 ' + T('pd.ws.ok','Gewisseld naar') + ' ' + d.supplier.name);
          setTimeout(() => location.reload(), 400);
        } catch(e){ toast(e.message); b.disabled = false; }
      }));
    }
    // 1x aanmelden: wie met het eigen RTG-account is ingelogd en bij meer bedrijven
    // werkt, wisselt hier direct van werkplek. Inklokken doet u daar zelf, apart.
    const andere = (mijnPosities || []).filter(p => p.code !== code);
    if (andere.length){
      $('#todayWrap').insertAdjacentHTML('beforeend',
        '<div class="card"><div class="k">'+T('pd.mw.h','Mijn werkplekken')+'</div>'+
        '<div style="margin-top:0.4rem;font-size:0.76rem;color:var(--soft);">'+T('pd.mw.sub','U werkt bij meer bedrijven; wissel met één tik. U klokt daar zelf in.')+'</div>'+
        andere.map(p => '<div class="task"><span class="ic">'+(BEDRIJVEN[p.code]?BEDRIJVEN[p.code].icon:'🏢')+'</span><div class="t"><b>'+esc(p.naam)+'</b><span>'+esc(p.func || (p.manager?'Manager':T('pd.staff','Medewerker')))+'</span></div>'+
          '<button class="abtn" data-mijn="'+esc(p.code)+'">'+T('pd.ws.ga','Wissel')+'</button></div>').join('')+'</div>');
      document.querySelectorAll('[data-mijn]').forEach(b => b.addEventListener('click', async () => {
        b.disabled = true;
        try {
          const d = await API.call('/supplier/mijn/wissel', { code: b.dataset.mijn });
          toast('🔁 ' + T('pd.ws.ok','Gewisseld naar') + ' ' + d.supplier.name);
          await landMijn(d); openTab('vandaag');
        } catch(e){ toast(e.message); b.disabled = false; }
      }));
    }
  }

  function renderRooster(){
    if (!week){ $('#roosterWrap').innerHTML = ''; return; }
    $('#roosterWrap').innerHTML = week.days.map((d,i) =>
      '<div class="rooster-day"><div class="dh">'+d.label+' · '+d.date.slice(8,10)+'-'+d.date.slice(5,7)+'</div>'+
      d.staff.map(m => '<div class="rrow'+(m.id===me.staffId?' me':'')+'"><b>'+esc(m.name)+(m.id===me.staffId?' ('+T('pd.you','u')+')':'')+'</b><span>'+m.shift+'</span></div>').join('')+
      '</div>'
    ).join('');
  }

  function renderTaken(){
    const tasks = taskList();
    $('#takenWrap').innerHTML = '<div class="card">'+(tasks.length ? tasks.map(t => {
      let act = '';
      if (t.kind==='ticket') act = t.status==='open'
        ? '<button class="abtn" data-tk="'+t.id+'" data-st="bezig">'+T('pd.pickup','Oppakken')+'</button>'
        : '<button class="abtn" data-tk="'+t.id+'" data-st="klaar">'+T('pd.done','Klaar')+'</button>';
      if (t.kind==='hk') act = '<button class="abtn" data-hk="'+t.id+'">'+T('pd.clean','Schoon')+'</button>';
      return '<div class="task"><span class="ic">'+t.icon+'</span><div class="t"><b>'+esc(t.b)+'</b><span>'+esc(t.s)+'</span></div>'+act+'</div>';
    }).join('') : '<div style="font-size:0.84rem;color:var(--green);padding:0.4rem 0;">✓ '+T('pd.alldone','Alles is bij.')+'</div>')+'</div>';
    const tw = $('#takenWrap');
    // melden hoort bij iedereen: een klus doorgeven en gevonden voorwerpen registreren
    const kamers = (state && state.rooms || []).map(r => r.name);
    const kamerSel = id => '<select class="hin" id="'+id+'" style="flex:1;"><option value="">'+T('hk.geenk','geen kamer')+'</option>'+kamers.map(k=>'<option>'+esc(k)+'</option>').join('')+'</select>';
    tw.innerHTML += '<div class="card"><div class="k">🔧 '+T('hk.klus.meld','Meld klus')+'</div>'+
      '<div class="row"><input class="hin" id="klusTekst" placeholder="'+T('hk.klus.ph','Omschrijf de klus...')+'" style="flex:2;">'+kamerSel('klusKamer')+'</div>'+
      '<button class="abtn" id="klusMeld" style="width:100%;margin-top:0.5rem;">'+T('hk.klus.meld','Meld klus')+'</button></div>';
    const lf = (state && state.lostfound || []).slice(0, 6);
    tw.innerHTML += '<div class="card"><div class="k">🧳 '+T('hk.lf','Gevonden voorwerp')+'</div>'+
      '<div class="row"><input class="hin" id="lfItem" placeholder="'+T('hk.lf.item','Wat heb je gevonden?')+'" style="flex:2;">'+kamerSel('lfKamer')+'</div>'+
      '<div class="row"><input class="hin" id="lfPlek" placeholder="'+T('hk.lf.plek','Bewaarplek')+'"></div>'+
      '<button class="abtn" id="lfMeld" style="width:100%;margin-top:0.5rem;">'+T('hk.lf.meld','Registreer')+'</button>'+
      (lf.length ? '<div class="k" style="margin-top:0.8rem;">'+T('hk.lf.recent','Laatst geregistreerd')+'</div>'+
        lf.map(x => '<div class="task"><div class="t"><b>'+esc(x.item)+'</b><span>'+(x.room?esc(x.room)+' · ':'')+(x.storage?esc(x.storage)+' · ':'')+timeAgo(x.at)+'</span></div></div>').join('') : '')+'</div>';
    tw.querySelectorAll('[data-tk]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/ticket/status', { id:b.dataset.tk, status:b.dataset.st }); toast(b.dataset.st==='klaar'?T('pd.tickdone','Klus afgerond.'):T('pd.tickbusy','Opgepakt.')); await refresh(); openTab('taken'); } catch(e){ toast(e.message); }
    }));
    tw.querySelectorAll('[data-hk]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/room/hk', { id:b.dataset.hk, status:'schoon' }); toast(T('pd.cleaned','Kamer staat op schoon.')); await refresh(); openTab('taken'); } catch(e){ toast(e.message); }
    }));
    const km = $('#klusMeld'); if (km) km.addEventListener('click', async () => {
      const text = $('#klusTekst').value.trim(); if (!text) return;
      try { await API.call('/supplier/ticket/add', { text, room: $('#klusKamer').value }); toast('🔧 '+T('hk.klusok','Klus gemeld.')); await refresh(); openTab('taken'); } catch(e){ toast(e.message); }
    });
    const lm = $('#lfMeld'); if (lm) lm.addEventListener('click', async () => {
      const item = $('#lfItem').value.trim(); if (!item) return;
      try { await API.call('/supplier/lost/add', { item, room: $('#lfKamer').value, storage: $('#lfPlek').value }); toast('🧳 '+T('hk.lfok','Geregistreerd.')); await refresh(); openTab('taken'); } catch(e){ toast(e.message); }
    });
  }

  /* ---------- Kamers: het volledige housekeeping-bord in de PDA ----------
     Alle PDA's leven in deze ene app. Voor zaken met kamers (hotel,
     appartementen) is dit het kamerbord met een tik per stap, vroege
     check-in vrijgeven en de minibar. Voor zaken zonder kamers
     (schoonmaakbedrijven, zzp'ers) werkt dezelfde tab op opdrachten. */
  const HK_ORDE = { defect: 0, vuil: 1, bezig: 2, schoon: 3, bezet: 4 };
  const hkVan = r => (r.hk && r.hk.status) || (r.available ? 'schoon' : 'bezet');
  const heeftKamers = () => !!(state && (state.rooms || []).length);
  const heeftOpdrachten = () => !!(state && !(state.rooms || []).length && (state.boekingen || []).length);
  // het eigen dorp op zak: bars, clubs, beachclubs en restaurants krijgen het afdelingenbord
  const heeftClubdorp = () => !!(state && !(state.rooms || []).length && state.supplier && ['bar', 'club', 'beachclub', 'restaurant'].includes(state.supplier.type));
  // het zorgprofiel van de gast, kort op een regel (reist mee met toestemming)
  const pkZorg = z => [((z.allergenen || []).length ? T('zorg.allergie', 'Allergie') + ': ' + z.allergenen.join(', ') : ''), z.dieet, z.medisch].filter(Boolean).join(' · ');
  let mbOpen = null;          // kamer waarvan de minibar-teller openstaat
  let mbTel = {};             // minibar-aantallen van die kamer
  // het receptiebord op zak: alleen de housekeeping-prioriteit is hier nodig
  let pkReceptie = null, pkReceptieAt = 0, pkReceptieBezig = false;
  function pkLaadReceptie(){
    if (pkReceptieBezig || Date.now() - pkReceptieAt < 30000) return;
    pkReceptieBezig = true;
    API.call('/supplier/receptie').then(d => { pkReceptie = d; pkReceptieAt = Date.now(); pkReceptieBezig = false; renderKamers(); })
      .catch(() => { pkReceptieBezig = false; pkReceptieAt = Date.now(); });
  }

  function renderKamers(){
    const tabBtn = $('#tabKamers');
    const aan = heeftKamers() || heeftOpdrachten() || heeftClubdorp();
    const tabNaam = heeftKamers() ? T('pd.t.kamers','Kamers') : heeftClubdorp() ? T('pd.t.dorp','Afdelingen') : T('pd.t.opdr','Opdrachten');
    if (tabBtn){
      tabBtn.style.display = aan ? '' : 'none';
      const lbl = tabBtn.querySelector('span');
      if (lbl) lbl.textContent = tabNaam;
    }
    const kop = document.querySelector('.view[data-view="kamers"] h2');
    if (kop) kop.textContent = tabNaam;
    const wrap = $('#kamersWrap'); if (!wrap || !state) return;
    if (!aan){ wrap.innerHTML = ''; return; }
    // de nachtzaak: het hele afdelingenbord (entree, garderobe, bar, vip...)
    if (!heeftKamers() && heeftClubdorp()){
      wrap.innerHTML = pkDorpKaart();
      bindKamers(wrap);
      return;
    }
    // zonder kamers (schoonmaakbedrijf, zzp) werkt de tab op opdrachten
    if (!heeftKamers()) return renderOpdrachten(wrap);
    const rooms = (state.rooms || []).slice().sort((a,b) => (HK_ORDE[hkVan(a)] ?? 9) - (HK_ORDE[hkVan(b)] ?? 9));
    let html = '';
    // de receptie kijkt mee: vuile kamers met een aankomst vandaag gaan voor
    pkLaadReceptie();
    if (pkReceptie && (pkReceptie.hkEerst || []).length)
      html += '<div class="card" style="border-left:4px solid #E5484D;"><div class="k">🧹 '+T('hk.eerst','Eerst deze')+'</div>'+
        '<div style="margin-top:0.35rem;font-size:0.85rem;"><b>'+pkReceptie.hkEerst.map(esc).join(', ')+'</b> · '+T('hk.eerst.s','daar komt vandaag alweer een gast aan.')+'</div></div>';
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
    html += rooms.map(r => {
      const s2 = hkVan(r);
      const chip = s2==='schoon' ? '<span class="hkchip groen">'+T('hk.schoon','Schoon')+'</span>'
        : s2==='vuil' ? '<span class="hkchip rood">'+T('hk.vuil','Vuil')+'</span>'
        : s2==='bezig' ? '<span class="hkchip amber">'+T('hk.bezig','Bezig')+'</span>'
        : s2==='defect' ? '<span class="hkchip rood">⚠ '+T('hk.defect','Defect')+'</span>'
        : '<span class="hkchip">'+T('hk.bezet','Bezet')+'</span>';
      let acts = '';
      if (s2 === 'vuil') acts = '<button class="abtn" data-khk="'+r.id+'" data-st="bezig">▶ '+T('hk.start','Start')+'</button>';
      else if (s2 === 'bezig' || s2 === 'defect') acts = '<button class="abtn" data-khk="'+r.id+'" data-st="schoon">✓ '+T('hk.klaar','Schoon')+'</button>';
      else if (s2 === 'schoon') acts = r.vroegVrij
        ? '<button class="abtn ghost" data-vrij="'+r.id+'" data-op="uit">'+T('hk.vrijaf','Vrijgave intrekken')+'</button>'
        : '<button class="abtn" data-vrij="'+r.id+'" data-op="aan">🛎 '+T('hk.geefvrij','Geef vrij voor vroege check-in')+'</button>';
      return '<div class="card kamer '+s2+'">'+
        '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:0.6rem;"><b style="font-size:0.98rem;">'+esc(r.name)+'</b>'+chip+'</div>'+
        (r.hk && r.hk.at ? '<div style="font-size:0.7rem;color:var(--soft);margin-top:0.2rem;">'+timeAgo(r.hk.at)+(r.hk.by?' · '+esc(r.hk.by):'')+(r.hk.note?' · '+esc(r.hk.note):'')+'</div>' : '')+
        (r.vroegVrij ? '<div style="font-size:0.74rem;color:#7BC79B;margin-top:0.3rem;">🛎 '+T('hk.vrijchip','vrij voor vroege check-in')+'</div>' : '')+
        '<div class="row" style="flex-wrap:wrap;">'+acts+
          (s2 !== 'vuil' && s2 !== 'defect' ? '<button class="abtn ghost" data-khk="'+r.id+'" data-st="vuil">'+T('hk.checkout','Check-out (vuil)')+'</button>' : '')+
          (s2 !== 'defect' ? '<button class="abtn warn" data-defect="'+r.id+'">⚠ '+T('hk.defectmeld','Defect')+'</button>' : '')+
          '<button class="abtn ghost" data-mb="'+r.id+'">🧃 '+T('hk.minibar','Minibar')+'</button></div>'+
        (mbOpen === r.id ? minibarBlok(r) : '')+
      '</div>';
    }).join('');
    html += pkDorpKaart();
    wrap.innerHTML = html;
    bindKamers(wrap);
  }
  /* Het hoteldorp op zak: dezelfde afdelingslijsten als in de zaak-app.
     Kies je kant (concierge, parking, security, spa, klusjesman, IT...),
     zet posten erbij en tik ze een stap verder. */
  let pkDorp = null, pkDorpAt = 0, pkDorpBezig = false;
  let pkDorpKant = (() => { try { return localStorage.getItem('rtg_pda_dorp') || 'klussen'; } catch(e){ return 'klussen'; } })();
  function pkLaadDorp(){
    if (pkDorpBezig || Date.now() - pkDorpAt < 20000) return;
    pkDorpBezig = true;
    API.call('/supplier/dorp').then(d => { pkDorp = d; pkDorpAt = Date.now(); pkDorpBezig = false; renderKamers(); })
      .catch(() => { pkDorpBezig = false; pkDorpAt = Date.now(); });
  }
  // het specialistische gereedschap van de gekozen kant, compact op zak
  let pkTools = null, pkToolsKant = null, pkToolsBezig = false;
  function pkLaadTools(){
    if (pkToolsBezig || pkToolsKant === pkDorpKant) return;
    pkToolsBezig = true;
    const kant = pkDorpKant;
    API.call('/supplier/dorp/tools', { afdeling: kant }).then(d => { pkTools = d; pkToolsKant = kant; pkToolsBezig = false; renderKamers(); })
      .catch(() => { pkTools = null; pkToolsKant = kant; pkToolsBezig = false; });
  }
  function pkToolsHtml(){
    const t = pkTools;
    if (!t || pkToolsKant !== pkDorpKant || !Array.isArray(t.tools)) return '';
    const kop = titel => '<div style="margin-top:0.5rem;font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;opacity:0.6;">'+esc(titel)+'</div>';
    const regel = (icoon, links, rechts, rood) => '<div style="display:flex;justify-content:space-between;gap:0.5rem;font-size:0.8rem;margin-top:0.3rem;"><span>'+(icoon?icoon+' ':'')+links+'</span>'+(rechts?'<b style="color:'+(rood?'#FF8589':'var(--gold)')+';white-space:nowrap;">'+rechts+'</b>':'')+'</div>';
    return t.tools.map(w => {
      if (w.type === 'cijfers') return kop(w.titel)+regel('', w.items.map(i => esc(i.label)+' <b>'+esc(String(i.waarde))+'</b>').join(' · '), '');
      if (w.type === 'lijst') return kop(w.titel)+((w.rijen||[]).length
        ? w.rijen.slice(0, 6).map(r => regel(r.icoon||'', esc(r.tekst)+(r.sub?'<span style="display:block;font-size:0.7rem;opacity:0.7;">'+esc(r.sub)+'</span>':''), r.rechts?esc(r.rechts):'', r.rood)).join('')
        : '<div style="font-size:0.75rem;opacity:0.65;margin-top:0.25rem;">'+esc(w.leeg||'')+'</div>');
      if (w.type === 'knoppen') return kop(w.titel)+'<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.35rem;">'+
        (w.knoppen||[]).map(k => '<button class="abtn ghost" data-pkdsnelknop="'+esc(k)+'">'+esc(k)+'</button>').join('')+'</div>';
      if (w.type === 'actie') return '<button class="abtn" data-pkdactie="'+esc(w.tekst)+'" style="width:100%;margin-top:0.45rem;">'+esc(w.knop)+'</button>';
      // de leeftijdscheck aan de deur: ja/nee op codenaam, zonder gegevens
      if (w.type === 'leeftijd') return kop(w.titel)+
        '<div style="display:flex;gap:0.35rem;margin-top:0.35rem;"><input id="pkLftIn" placeholder="'+T('pd.lft.ph','Codenaam van de gast')+'" style="flex:1;background:var(--card2,#191715);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.7rem;color:var(--txt);outline:none;font-family:inherit;font-size:0.85rem;">'+
        '<button class="abtn" data-pklft="18">18+?</button><button class="abtn ghost" data-pklft="21">21+?</button></div>'+
        '<div id="pkLftUit" style="margin-top:0.3rem;font-size:0.78rem;color:var(--soft);">'+esc(w.hint||'')+'</div>';
      if (w.type === 'meter') return kop(w.titel)+'<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.35rem;">'+
        (w.opties||[]).map(o => '<button class="abtn'+(w.stand&&w.stand.stand===o?'':' ghost')+'" data-pkdmeter="'+esc(o)+'" style="flex:1;min-width:70px;">'+esc(o)+'</button>').join('')+'</div>';
      return '';
    }).join('');
  }
  function pkDorpKaart(){
    pkLaadDorp();
    if (!pkDorp) return '';
    const afd = pkDorp.afdelingen.find(a => a.key === pkDorpKant) || pkDorp.afdelingen[0];
    pkDorpKant = afd.key;
    pkLaadTools();
    return '<div class="card"><div class="k" style="display:flex;justify-content:space-between;align-items:center;">🏘 '+T('pd.dorp','Afdelingen')+
      '<button class="abtn ghost" id="pkDorpChat" style="font-size:0.66rem;">💬 '+T('pd.dorp.chat','Teamchat')+'</button></div>'+
      '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.4rem;">'+pkDorp.afdelingen.map(a =>
        '<button class="abtn'+(a.key===pkDorpKant?'':' ghost')+'" data-pkdkant="'+a.key+'">'+a.icon+(a.openAantal?' '+a.openAantal:'')+'</button>').join('')+'</div>'+
      '<div style="margin-top:0.45rem;font-size:0.72rem;color:var(--soft);">'+afd.icon+' '+esc(afd.label)+' · '+afd.keten.join(' · ')+'</div>'+
      pkToolsHtml()+
      (afd.open.length ? afd.open.map(p => {
        const i = afd.keten.indexOf(p.status);
        const volgende = i >= 0 && i < afd.keten.length - 1 ? afd.keten[i + 1] : null;
        return '<div class="task"><div class="t"><b>'+(p.waar?esc(p.waar)+' · ':'')+esc(p.tekst)+'</b><span>'+esc(p.status)+' · '+esc(p.door)+' · '+timeAgo(p.updatedAt||p.at)+
          ((p.via||[]).length?' · '+T('pd.dorp.via','via')+' '+p.via.map(esc).join(', '):'')+'</span></div>'+
          '<div style="display:flex;gap:0.3rem;">'+(volgende?'<button class="abtn" data-pkdverder="'+p.id+'">'+esc(volgende)+'</button>':'')+
          '<button class="abtn ghost" data-pkdstuur="'+p.id+'" aria-label="doorsturen">↪</button></div></div>';
      }).join('') : '<div style="margin-top:0.4rem;font-size:0.8rem;color:var(--soft);">'+T('pd.dorp.leeg','Niets open bij deze afdeling.')+'</div>')+
      (pkDorpKant === 'concierge' && pkBuurt && pkBuurt.length
        ? '<div style="margin-top:0.5rem;font-size:0.66rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('pd.dorp.buurt','In de buurt')+'</div>'+
          '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.35rem;">'+pkBuurt.map(b =>
            '<button class="abtn ghost" data-pkdbuurt="'+esc(b.naam)+'" data-soort="'+esc(b.soort)+'" data-km="'+b.km+'">'+b.icon+' '+esc(b.naam)+' · '+b.km+' km</button>').join('')+'</div>'
        : '')+
      '<button class="abtn ghost" data-pkdnieuw style="width:100%;margin-top:0.5rem;">+ '+T('pd.dorp.nieuw','Zet iets op de lijst')+'</button></div>';
  }
  // de buurt voor de concierge-kant op zak
  let pkBuurt = null, pkBuurtBezig = false;
  function pkLaadBuurt(){
    if (pkBuurt || pkBuurtBezig) return;
    pkBuurtBezig = true;
    API.call('/supplier/dorp/buurt').then(d => { pkBuurt = d.buurt || []; pkBuurtBezig = false; renderKamers(); })
      .catch(() => { pkBuurt = []; pkBuurtBezig = false; });
  }
  /* opdrachten: de flow voor schoonmaakbedrijven en zzp'ers. Geen kamerbord
     maar de eigen boekingen: bevestigen, op locatie werken en afronden. */
  function renderOpdrachten(wrap){
    const bs = state.boekingen || [];
    const open = bs.filter(b => b.status === 'aangevraagd');
    const komend = bs.filter(b => b.status === 'bevestigd');
    const kaart = (b, acties) => '<div class="card kamer '+(b.status==='bevestigd'?'bezig':'vuil')+'">'+
      '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:0.6rem;"><b style="font-size:0.98rem;">'+esc(b.service && b.service.name || 'Opdracht')+'</b>'+
      '<span class="hkchip'+(b.status==='bevestigd'?' amber':' rood')+'">'+(b.status==='bevestigd'?T('hk.o.bevestigd','Ingepland'):T('hk.o.nieuw','Nieuw'))+'</span></div>'+
      '<div style="font-size:0.78rem;color:var(--soft);margin-top:0.25rem;">'+esc(b.customerCodename||'')+(b.wanneer?' · '+esc(b.wanneer):'')+(b.price?' · '+eur(b.price):'')+'</div>'+
      (b.note?'<div style="font-size:0.78rem;color:var(--muted);margin-top:0.3rem;">📝 '+esc(b.note)+'</div>':'')+
      (b.zorg?'<div style="font-size:0.76rem;color:#E2B93B;margin-top:0.3rem;">⚠ '+esc(pkZorg(b.zorg))+'</div>':'')+
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
    const mb = (state.minibar && state.minibar.catalog) || [];
    return '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.5rem;">'+
      mb.map(x => '<div class="mbrow"><span style="font-size:0.86rem;">'+esc(x.name)+' <span style="color:var(--soft);font-size:0.74rem;">'+eur(x.price)+'</span></span>'+
        '<span class="q"><button data-mbmin="'+x.id+'" aria-label="minder">−</button><b>'+(mbTel[x.id]||0)+'</b><button data-mbplus="'+x.id+'" aria-label="meer">+</button></span></div>').join('')+
      '<button class="abtn" data-mbboek="'+esc(r.name)+'" style="width:100%;margin-top:0.4rem;">'+T('hk.boek','Boek op de kamer')+'</button></div>';
  }
  function bindKamers(wrap){
    // het hoteldorp: kant kiezen, posten doorzetten, en er iets bij zetten
    wrap.querySelectorAll('[data-pkdkant]').forEach(b => b.addEventListener('click', () => {
      pkDorpKant = b.dataset.pkdkant;
      try { localStorage.setItem('rtg_pda_dorp', pkDorpKant); } catch(e){}
      renderKamers();
    }));
    // het specialistische gereedschap: logmoment, meter en snelposten
    wrap.querySelectorAll('[data-pkdactie]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/dorp/post', { afdeling: pkDorpKant, waar: '', tekst: b.dataset.pkdactie, directKlaar: true }); toast(T('dorp.geklokt','Geklokt.')); pkDorpAt = 0; pkToolsKant = null; pkLaadDorp(); }
      catch(e){ toast(e.message); }
    }));
    // elke afdeling in een tik bij de teamchat, de collegachat en de teamcall
    const pdc = wrap.querySelector('#pkDorpChat');
    if (pdc) pdc.addEventListener('click', () => openTab('team'));
    // de leeftijdscheck: de paspoort-bevestiging geeft ja/nee, nooit gegevens
    wrap.querySelectorAll('[data-pklft]').forEach(b => b.addEventListener('click', async () => {
      const inp = wrap.querySelector('#pkLftIn'), uit = wrap.querySelector('#pkLftUit');
      const codenaam = (inp && inp.value || '').trim();
      if (!codenaam){ toast(T('pd.lft.leeg','Vul de codenaam van de gast in.')); return; }
      const min = Number(b.dataset.pklft);
      try {
        const r = await API.call('/supplier/paspoort/vraag', { codenaam, niveau: 'bevestiging', minLeeftijd: min });
        const ok = r.bevestiging && r.bevestiging.voldoetLeeftijd === true;
        if (navigator.vibrate) navigator.vibrate(ok ? 80 : [200, 80, 200]);
        uit.innerHTML = ok
          ? '<b style="color:var(--green,#7ecb8f);font-size:1rem;">✅ '+esc(codenaam)+' '+T('pd.lft.ja','is')+' '+min+'+</b>'
          : '<b style="color:#E36385;font-size:1rem;">⛔ '+esc(codenaam)+' '+T('pd.lft.nee','is NIET aantoonbaar')+' '+min+'+</b>';
      } catch(e){ uit.innerHTML = '<b style="color:#E36385;">'+esc(e.message)+'</b>'; }
    }));
    wrap.querySelectorAll('[data-pkdmeter]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/dorp/drukte', { afdeling: pkDorpKant, stand: b.dataset.pkdmeter }); pkToolsKant = null; pkLaadTools(); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-pkdsnelknop]').forEach(b => b.addEventListener('click', async () => {
      const afd = pkDorp && (pkDorp.afdelingen.find(a => a.key === pkDorpKant) || pkDorp.afdelingen[0]);
      if (!afd) return;
      const waar = prompt(afd.waarHint) || '';
      try { await API.call('/supplier/dorp/post', { afdeling: afd.key, waar, tekst: b.dataset.pkdsnelknop }); toast(afd.icon+' '+T('pd.dorp.gezet','Staat op de lijst.')); pkDorpAt = 0; pkToolsKant = null; pkLaadDorp(); }
      catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-pkdverder]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/dorp/verder', { id: b.dataset.pkdverder }); pkDorpAt = 0; pkToolsKant = null; pkLaadDorp(); } catch(e){ toast(e.message); }
    }));
    // doorsturen: de post reist naar een andere afdeling, met het spoor erbij
    wrap.querySelectorAll('[data-pkdstuur]').forEach(b => b.addEventListener('click', async () => {
      if (!pkDorp) return;
      const naar = prompt(T('pd.dorp.stuurwaar','Naar welke afdeling?')+' ('+pkDorp.afdelingen.map(a=>a.key).join(', ')+')');
      if (!naar) return;
      try {
        await API.call('/supplier/dorp/stuurdoor', { id: b.dataset.pkdstuur, naar: naar.trim().toLowerCase() });
        toast('↪ '+T('pd.dorp.gestuurd','Doorgestuurd.'));
        pkDorpAt = 0; pkToolsKant = null; pkLaadDorp();
      } catch(e){ toast(e.message); }
    }));
    // de buurt: een tik zet de naam alvast in de wens
    if (pkDorpKant === 'concierge') pkLaadBuurt();
    wrap.querySelectorAll('[data-pkdbuurt]').forEach(b => b.addEventListener('click', async () => {
      const afd = pkDorp && pkDorp.afdelingen.find(a => a.key === 'concierge');
      const waar = prompt(afd ? afd.waarHint : 'Kamer') || '';
      const tekst = prompt(T('pd.dorp.regelwat','Wat regelen we bij')+' '+b.dataset.pkdbuurt+' ('+b.dataset.soort+', '+b.dataset.km+' km)?');
      if (!tekst) return;
      try {
        await API.call('/supplier/dorp/post', { afdeling: 'concierge', waar, tekst: b.dataset.pkdbuurt+': '+tekst });
        toast('🎩 '+T('pd.dorp.gezet','Staat op de lijst.'));
        pkDorpAt = 0; pkToolsKant = null; pkLaadDorp();
      } catch(e){ toast(e.message); }
    }));
    const dn = wrap.querySelector('[data-pkdnieuw]'); if (dn) dn.addEventListener('click', async () => {
      const afd = pkDorp && (pkDorp.afdelingen.find(a => a.key === pkDorpKant) || pkDorp.afdelingen[0]);
      if (!afd) return;
      const waar = prompt(afd.waarHint) || '';
      const tekst = prompt(afd.watHint);
      if (!tekst) return;
      try { await API.call('/supplier/dorp/post', { afdeling: afd.key, waar, tekst }); toast(afd.icon+' '+T('pd.dorp.gezet','Staat op de lijst.')); pkDorpAt = 0; pkToolsKant = null; pkLaadDorp(); }
      catch(e){ toast(e.message); }
    });
    wrap.querySelectorAll('[data-khk]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/room/hk', { id: b.dataset.khk, status: b.dataset.st }); await refresh(); } catch(e){ toast(e.message); }
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

  /* Hulp & zaken: EHBO-kennis direct bij de hand, de vertrouwenspersoon van
     RTG (volledig buiten de werkgever om) en de eigen administratie. */
  let hulpOpen = null, ziekArm = false;
  const EHBO_GIDS = () => lang() === 'en' ? [
    { t: 'Resuscitation (CPR)', i: '🫀', s: ['Check consciousness and breathing; shout for help.', 'Call 112 (or have someone call) and ask for an AED.', '30 chest compressions: centre of the chest, 5-6 cm deep, 100-120 per minute.', '2 rescue breaths, then keep alternating 30 to 2.', 'Use the AED as soon as it arrives and follow its instructions.', 'Continue until professional help takes over.'] },
    { t: 'Choking', i: '🫁', s: ['Encourage coughing first.', 'Not working? Give up to 5 firm blows between the shoulder blades.', 'Still stuck? Up to 5 abdominal thrusts (Heimlich manoeuvre).', 'Keep alternating 5 blows and 5 thrusts; call 112 if it does not clear.'] },
    { t: 'Burns', i: '🔥', s: ['Cool 10 to 20 minutes with lukewarm, gently running water.', 'No ice, no butter, no ointments.', 'Never pull off clothing that sticks to the skin.', 'Cover loosely with a sterile dressing; blisters or a large area: see a doctor.'] },
    { t: 'Severe bleeding', i: '🩸', s: ['Press firmly on the wound with a clean cloth.', 'Keep pressing; do not lift it to look.', 'Raise the arm or leg if possible.', 'Call 112 for severe or spurting bleeding.'] },
    { t: 'Allergic reaction', i: '⚠️', s: ['Known allergy with an adrenaline pen? Use it on the outside of the thigh.', 'Call 112 for swelling of face or throat, or trouble breathing.', 'Loosen tight clothing; let the person sit or lie comfortably.', 'Stay with them; a second dose can be needed after 5 to 15 minutes.'] },
    { t: 'Unconscious but breathing', i: '😴', s: ['Place the person on their side (recovery position), head tilted back.', 'Call 112.', 'Keep checking the breathing until help arrives.'] },
    { t: 'Heart attack or stroke', i: '🚑', s: ['Heart attack: pressure on the chest, pain to arm or jaw, sweating. Call 112 and let the person rest half-sitting.', 'Stroke, think FAST: Face (drooping mouth), Arm (weakness), Speech (confused), Time: call 112 at once.', 'Note the time the symptoms started; the hospital needs it.'] }
  ] : [
    { t: 'Reanimatie', i: '🫀', s: ['Controleer bewustzijn en ademhaling; roep om hulp.', 'Bel 112 (of laat bellen) en vraag om een AED.', '30 borstcompressies: midden op de borst, 5-6 cm diep, 100-120 per minuut.', '2 beademingen, en blijf wisselen: 30 om 2.', 'Gebruik de AED zodra die er is en volg de gesproken instructies.', 'Ga door tot professionele hulp het overneemt.'] },
    { t: 'Verslikking', i: '🫁', s: ['Laat eerst flink hoesten.', 'Helpt dat niet? Geef maximaal 5 stevige klappen tussen de schouderbladen.', 'Zit het nog vast? Maximaal 5 buikstoten (Heimlich-greep).', 'Blijf wisselen: 5 klappen, 5 stoten. Bel 112 als het niet loskomt.'] },
    { t: 'Brandwond', i: '🔥', s: ['Koel 10 tot 20 minuten met lauw, zacht stromend water.', 'Geen ijs, geen boter, geen zalf.', 'Trek kleding die aan de huid plakt nooit los.', 'Dek losjes af met steriel verband; blaren of een groot oppervlak: naar een arts.'] },
    { t: 'Ernstige bloeding', i: '🩸', s: ['Druk stevig op de wond met een schone doek.', 'Blijf drukken; til de doek niet op om te kijken.', 'Houd de arm of het been omhoog als dat kan.', 'Bel 112 bij een ernstige of spuitende bloeding.'] },
    { t: 'Allergische reactie', i: '⚠️', s: ['Bekende allergie met een adrenalinepen? Zet die op de buitenkant van het bovenbeen.', 'Bel 112 bij een opgezwollen gezicht of keel, of moeite met ademen.', 'Maak knellende kleding los; laat rustig zitten of liggen.', 'Blijf erbij; na 5 tot 15 minuten kan een tweede dosis nodig zijn.'] },
    { t: 'Bewusteloos, maar ademt', i: '😴', s: ['Leg de persoon op de zij (stabiele zijligging), hoofd iets achterover.', 'Bel 112.', 'Blijf de ademhaling controleren tot er hulp is.'] },
    { t: 'Hartaanval of beroerte', i: '🚑', s: ['Hartaanval: drukkende pijn op de borst, uitstraling naar arm of kaak, zweten. Bel 112 en laat halfzittend rusten.', 'Beroerte, denk aan FAST: Face (scheve mond), Arm (uitvalt), Speech (verwarde spraak), Time: bel direct 112.', 'Noteer hoe laat de klachten begonnen; het ziekenhuis heeft dat nodig.'] }
  ];
  // Training & tips: micro-learning in de PDA. Rol-bewuste tips, een tip van de
  // dag, een AI-coach en (voor de manager) eigen huistips van de zaak.
  // De trainingskaart is met het componentframework (Util.el) gebouwd: tekst
  // wordt structureel als tekstknoop gezet (dus altijd veilig ge-escaped) en de
  // knoppen dragen hun eigen handler. renderHulp laat er een plek voor open
  // (#trainKaart); vulTrainingKaart() tekent hem daarin, ook na een klik.
  function trainingKaart(){ return trainData ? '<div id="trainKaart"></div>' : ''; }
  function vulTrainingKaart(){
    const c = document.getElementById('trainKaart');
    if (!c || !window.Util) return;
    const node = bouwTrainingKaart();
    Util.vervang(c, node || document.createTextNode(''));
  }
  function bouwTrainingKaart(){
    if (!trainData) return null;
    const E = Util.el, t = trainData, tvd = t.tipVanDeDag;
    const alle = t.tips || [], eigen = t.eigen || [], gelezen = t.gelezen || [];
    const totaal = alle.length, klaar = gelezen.filter(g => alle.some(x => x.t === g)).length;
    const pct = totaal ? Math.round(klaar / totaal * 100) : 0;
    const label = { fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--soft)' };

    const coachInp = E('input', { placeholder: coachRef ? T('pd.tr.askctx', 'Vraag over deze tafel... bijv. waar let ik op?') : T('pd.tr.ask', 'Vraag de coach... bijv. hoe stel ik een wijn voor?') });
    const coachBtn = E('button', { onclick: async () => {
      const vraag = (coachInp.value || '').trim();
      if (!vraag) return;
      coachBtn.disabled = true; coachBtn.textContent = '...';
      try { coachAntwoord = await API.call('/supplier/coach', coachRef ? { vraag, ref: coachRef } : { vraag }); }
      catch (e) { toast(e.message); }
      vulTrainingKaart();
    } }, T('pd.tr.coach', 'Vraag'));

    function tipRij(x){
      const g = gelezen.includes(x.t);
      return E('div', { class: 'task', style: g ? { alignItems: 'flex-start', opacity: '0.7' } : { alignItems: 'flex-start' } },
        E('button', { class: 'ic', 'aria-label': g ? T('pd.tr.unread', 'Markeer als ongelezen') : T('pd.tr.mark', 'Markeer als gelezen'),
          style: { cursor: 'pointer', background: 'none', border: 'none', fontSize: '1.1rem' },
          onclick: async () => {
            const uit = (trainData.gelezen || []).includes(x.t);
            try { const d = await API.call('/supplier/training/gelezen', { titel: x.t, uit }); if (trainData) trainData.gelezen = d.gelezen; vulTrainingKaart(); }
            catch (e) { toast(e.message); }
          } }, g ? '✅' : '⬜'),
        E('div', { class: 't' }, E('b', {}, x.t), E('span', { style: { lineHeight: '1.5' } }, x.s)),
        (t.kanBeheren && eigen.some(e => e.t === x.t)) ? E('button', { class: 'abtn ghost', style: { flex: '0 0 auto', padding: '0.25rem 0.5rem', fontSize: '0.7rem' },
          onclick: async () => { try { await API.call('/supplier/training/remove', { titel: x.t }); await laadZaken(); vulTrainingKaart(); } catch (e) { toast(e.message); } } }, '✕') : null
      );
    }

    let beheer = null;
    if (t.kanBeheren) {
      const titelInp = E('input', { placeholder: T('pd.tr.title', 'Titel, bijv. Onze wijn-aanpak'), style: { width: '100%', marginBottom: '0.4rem' } });
      const tekstInp = E('input', { placeholder: T('pd.tr.text', 'De tip in een of twee zinnen...') });
      const addBtn = E('button', { onclick: async () => {
        const titel = (titelInp.value || '').trim(), tekst = (tekstInp.value || '').trim();
        if (!titel || !tekst) { toast(T('pd.tr.leeg', 'Geef een titel en een tekst.')); return; }
        try { await API.call('/supplier/training/add', { titel, tekst }); toast('🎓 ' + T('pd.tr.added', 'Huistip toegevoegd voor het team.')); tipsOpen = true; await laadZaken(); vulTrainingKaart(); }
        catch (e) { toast(e.message); }
      } }, T('pd.tr.add', 'Voeg toe'));
      beheer = E('div', { style: { marginTop: '0.7rem', paddingTop: '0.6rem', borderTop: '1px solid var(--line,rgba(255,255,255,0.08))' } },
        E('div', { style: Object.assign({}, label, { marginBottom: '0.4rem' }) }, T('pd.tr.own', 'Eigen huistip toevoegen')),
        titelInp,
        E('div', { class: 'compose', style: { padding: '0' } }, tekstInp, addBtn));
    }

    return E('div', { class: 'card' },
      E('div', { class: 'k' }, '🎓 ' + T('pd.tr.h', 'Training & tips'),
        t.func ? E('span', { style: { fontWeight: '500', color: 'var(--soft)', fontSize: '0.72rem' } }, ' ' + t.func) : null),
      tvd ? E('div', { style: { marginTop: '0.6rem', padding: '0.7rem 0.8rem', borderRadius: '12px', background: 'linear-gradient(135deg,rgba(197,160,89,0.16),rgba(197,160,89,0.05))', border: '1px solid rgba(197,160,89,0.3)' } },
        E('div', { style: Object.assign({}, label, { color: 'var(--gold)' }) }, T('pd.tr.tvd', 'Tip van de dag')),
        E('b', { style: { display: 'block', marginTop: '0.25rem', fontSize: '0.9rem' } }, tvd.t),
        E('span', { style: { display: 'block', marginTop: '0.2rem', fontSize: '0.8rem', lineHeight: '1.5', color: 'var(--muted)' } }, tvd.s)) : null,
      totaal ? E('div', { style: { marginTop: '0.6rem' } },
        E('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', color: 'var(--soft)' } },
          E('span', {}, T('pd.tr.prog', 'Voortgang')), E('span', {}, klaar + ' / ' + totaal + ' ' + T('pd.tr.read', 'gelezen'))),
        E('div', { style: { height: '7px', borderRadius: '99px', background: 'var(--line,rgba(255,255,255,0.1))', marginTop: '0.3rem', overflow: 'hidden' } },
          E('div', { style: { height: '100%', width: pct + '%', background: 'linear-gradient(90deg,var(--gold),#e6c874)', borderRadius: '99px', transition: 'width .35s' } })),
        (klaar >= totaal) ? E('div', { style: { marginTop: '0.3rem', fontSize: '0.7rem', color: 'var(--green)' } }, '🎉 ' + T('pd.tr.allread', 'Alle tips gelezen. Topper!')) : null) : null,
      coachRef ? E('div', { style: { marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--gold)' } },
        '🎓 ' + T('pd.tr.ctx', 'Coaching voor') + ' ' + (coachRefTafel || coachRef) + ' ',
        E('button', { class: 'abtn ghost', style: { padding: '0.1rem 0.4rem', fontSize: '0.68rem', lineHeight: '1' },
          onclick: () => { coachRef = null; coachRefTafel = null; vulTrainingKaart(); } }, '✕')) : null,
      E('div', { class: 'compose', style: { padding: '0.55rem 0 0' } }, coachInp, coachBtn),
      coachAntwoord ? E('div', { style: { marginTop: '0.55rem', padding: '0.65rem 0.8rem', borderRadius: '12px', background: 'var(--panel2,rgba(255,255,255,0.04))', border: '1px solid var(--line,rgba(255,255,255,0.08))' } },
        E('div', { style: Object.assign({}, label, { letterSpacing: '0.1em' }) }, (coachAntwoord.bron === 'ai' ? T('pd.tr.ai', 'AI-coach') : T('pd.tr.bib', 'Uit de tips')) + (coachAntwoord.tafel ? ' · ' + coachAntwoord.tafel : '')),
        E('span', { style: { display: 'block', marginTop: '0.25rem', fontSize: '0.82rem', lineHeight: '1.55' } }, coachAntwoord.antwoord)) : null,
      alle.length ? E('button', { class: 'abtn ghost', style: { width: '100%', marginTop: '0.6rem' },
        onclick: () => { tipsOpen = !tipsOpen; vulTrainingKaart(); } },
        tipsOpen ? ('▲ ' + T('pd.tr.hide', 'Verberg de tips')) : ('▼ ' + T('pd.tr.all', 'Alle tips voor mijn rol') + ' (' + alle.length + ')')) : null,
      tipsOpen ? E('div', { style: { marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' } }, alle.map(tipRij)) : null,
      beheer
    );
  }
  let pkFlLaatst = ''; // het laatste Fluister-antwoord blijft staan bij her-render
  function renderHulp(){
    const gids = EHBO_GIDS();
    const tr = (zaken && zaken.trust) || { anon: false, messages: [] };
    const vl = (zaken && zaken.verlof) || [];
    const VST = {
      nieuw: [T('pd.vl.new','in behandeling'), 'var(--soft)'],
      goedgekeurd: [T('pd.vl.ok','goedgekeurd'), 'var(--green)'],
      afgewezen: [T('pd.vl.no','afgewezen'), 'var(--burgundy)'],
      gemeld: [T('pd.vl.zm','gemeld'), 'var(--green)']
    };
    $('#hulpWrap').innerHTML =
      // Fluister: de persoonlijke assistent van dit personeelslid (eigen
      // geheugen, nooit gedeeld met de werkgever)
      '<div class="card"><div class="k">✦ '+T('pd.fl.h','Mijn assistent')+'</div>'+
      '<div style="margin-top:0.35rem;font-size:0.74rem;color:var(--soft);">'+T('pd.fl.d','Uw eigen assistent. Hij onthoudt wat u hem vertelt ("onthoud dat...") en leert van wat u gebruikt; vraag "wat weet je over mij" en wis wanneer u wilt.')+'</div>'+
      '<div id="pkFlSein"></div>'+
      '<div id="pkFlUit" style="margin-top:0.45rem;font-size:0.8rem;line-height:1.5;">'+(pkFlLaatst||'')+'</div>'+
      '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input id="pkFlIn" placeholder="'+T('pd.fl.ph','Vraag iets, of: onthoud dat...')+'" style="flex:1;background:var(--card2,#191715);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.7rem;color:var(--txt);outline:none;font-family:inherit;font-size:0.85rem;">'+
      '<button class="abtn ghost" id="pkFlMic" aria-label="'+T('pd.fl.mic','Spreek uw vraag in')+'">🎤</button>'+
      '<button class="abtn" id="pkFlStuur">'+T('pd.fl.stuur','Stuur')+'</button></div></div>'+
      trainingKaart()+
      '<div class="card"><div class="k">🩹 '+T('pd.eh.h','EHBO, direct bij de hand')+'</div>'+
      '<div style="display:flex;gap:0.5rem;margin-top:0.6rem;">'+
        '<a href="tel:112" class="abtn" style="text-decoration:none;text-align:center;flex:1;">📞 '+T('pd.eh.112','Bel 112')+'</a>'+
        '<button class="abtn ghost" id="ehboAlarm" style="flex:1;">🩹 '+T('pd.eh.alarm','EHBO-alarm team')+'</button></div>'+
      gids.map((g, i) =>
        '<div class="task" data-eh="'+i+'" style="cursor:pointer;"><span class="ic">'+g.i+'</span><div class="t"><b>'+g.t+'</b>'+
        (hulpOpen === i
          ? '<ol style="margin:0.45rem 0 0.2rem 1.1rem;font-size:0.8rem;line-height:1.5;color:var(--txt);display:flex;flex-direction:column;gap:0.3rem;">'+g.s.map(x => '<li>'+x+'</li>').join('')+'</ol>'
          : '<span>'+T('pd.eh.open','Tik voor de stappen')+'</span>')+
        '</div></div>').join('')+
      '<div style="margin-top:0.55rem;font-size:0.66rem;color:var(--soft);">'+T('pd.eh.disc','Dit is een geheugensteun, geen opleiding. Bel bij twijfel altijd 112.')+'</div></div>'+

      '<div class="card"><div class="k">🤝 '+T('pd.tp.h','Vertrouwenspersoon van RTG')+'</div>'+
      '<div style="margin-top:0.4rem;font-size:0.76rem;line-height:1.5;color:var(--soft);">'+T('pd.tp.s','Volledig vertrouwelijk: uw werkgever ziet hier niets van. Alleen de vertrouwenspersoon van RTG leest en beantwoordt uw bericht. Voor alles wat u niet op de zaak kwijt kunt: van een onveilig gevoel tot problemen met een leidinggevende.')+'</div>'+
      (tr.messages.length ? '<div class="chat" style="margin-top:0.6rem;">'+tr.messages.map(m =>
        '<div class="msg '+(m.from === 'staff' ? 'me' : 'other')+'">'+(m.from === 'rtg' ? '<span class="who">'+T('pd.tp.rtg','Vertrouwenspersoon RTG')+'</span>' : '')+esc(m.text)+'</div>').join('')+'</div>' : '')+
      '<label style="display:flex;align-items:center;gap:0.5rem;margin-top:0.6rem;font-size:0.76rem;color:var(--soft);"><input type="checkbox" id="tpAnon"'+(tr.anon ? ' checked' : '')+'> '+T('pd.tp.anon','Verstuur anoniem (uw naam wordt niet gedeeld)')+'</label>'+
      '<div class="compose" style="padding:0.6rem 0 0;"><input id="tpText" placeholder="'+T('pd.tp.ph','Vertel in vertrouwen wat er speelt...')+'"><button id="tpSend">'+T('pd.send','Stuur')+'</button></div></div>'+

      '<div class="card"><div class="k">🗂 '+T('pd.ad.h','Mijn administratie')+'</div>'+
      '<button class="abtn ghost" id="ziekBtn" style="width:100%;margin-top:0.6rem;">'+(ziekArm ? '🤒 '+T('pd.ad.ziek2','Tik nogmaals om de ziekmelding te bevestigen') : '🤒 '+T('pd.ad.ziek','Ziek melden'))+'</button>'+
      '<div style="margin-top:0.9rem;font-size:0.64rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">'+T('pd.ad.verlof','Verlof aanvragen')+'</div>'+
      '<div style="display:flex;gap:0.5rem;margin-top:0.45rem;"><input type="date" id="vlVan" class="vlin" style="flex:1;min-width:0;"><input type="date" id="vlTot" class="vlin" style="flex:1;min-width:0;"></div>'+
      '<div class="compose" style="padding:0.5rem 0 0;"><input id="vlReden" placeholder="'+T('pd.ad.reden','Reden (mag leeg blijven)')+'"><button id="vlGo">'+T('pd.ad.vraag','Vraag aan')+'</button></div>'+
      (vl.length ? '<div style="margin-top:0.6rem;">'+vl.map(v =>
        '<div class="task"><span class="ic">'+(v.soort === 'ziek' ? '🤒' : '🌴')+'</span><div class="t"><b>'+(v.soort === 'ziek' ? T('pd.ad.zm','Ziekmelding')+' '+v.van : v.van+' t/m '+(v.tot || ''))+'</b><span>'+esc(v.reden || '')+'</span></div>'+
        '<span style="font-size:0.64rem;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:'+(VST[v.status] || [v.status, 'var(--soft)'])[1]+';">'+(VST[v.status] || [v.status])[0]+'</span></div>').join('')+'</div>' : '')+
      '</div>'+

      (() => { const mijnCon = (pdContracten||[]).filter(c => c.partij.kind === 'staff' && c.partij.naam === me.name);
        return mijnCon.length ? '<div class="card"><div class="k">\uD83D\uDCDD '+T('pd.ct.h','Mijn contracten')+'</div>'+
        mijnCon.map(c => {
          const ikGetekend = !!c.tekenPartij, zaakGetekend = !!c.tekenZaak;
          return '<div class="task" style="flex-direction:column;align-items:stretch;"><div class="t"><b>'+esc(c.titel)+'</b><span>'+T('pd.ct.'+c.soort, c.soort)+' \u00B7 '+(zaakGetekend?'\u2705':'\u25CB')+' '+T('pd.ct.zaak','zaak')+' / '+(ikGetekend?'\u2705':'\u25CB')+' '+T('pd.ct.ik','ik')+'</span></div>'+
          (c.velden && c.velden.length ? '<div style="font-size:0.72rem;color:var(--soft);margin-top:0.2rem;">'+c.velden.map(v=>esc(v.label)+': '+esc(v.waarde)).join(' \u00B7 ')+'</div>' : '')+
          '<details style="margin-top:0.3rem;"><summary style="cursor:pointer;font-size:0.72rem;color:var(--gold);">'+T('pd.ct.lees','Voorwaarden')+'</summary><div style="font-size:0.76rem;color:var(--muted);white-space:pre-wrap;margin-top:0.3rem;">'+esc(c.tekst)+'</div></details>'+
          (!ikGetekend && c.status !== 'geweigerd' ? '<button class="abtn" data-ctteken="'+c.ref+'" style="margin-top:0.5rem;">'+T('pd.ct.teken','Ondertekenen')+'</button>' : (ikGetekend ? '<div style="margin-top:0.4rem;font-size:0.76rem;color:var(--green);">\u2705 '+T('pd.ct.getekend','U tekende dit contract.')+'</div>' : ''))+
          '</div>';
        }).join('')+'</div>' : '';
      })();

    // Fluister fluistert ook zelf: seintjes uit je eigen weetjes (datums die
    // naderen), zonder dat je iets hoeft te vragen
    API.call('/staff/fluister/profiel').then(prof => {
      const el = document.getElementById('pkFlSein');
      if (!el || !(prof.seintjes || []).length) return;
      el.innerHTML = '<div style="margin-top:0.45rem;border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.65rem;">'+
        '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">'+T('pd.fl.sein','Mijn assistent ziet')+'</div>'+
        prof.seintjes.map(x => '<div style="margin-top:0.28rem;font-size:0.76rem;line-height:1.45;">'+esc(x.icoon)+' '+esc(x.tekst)+'</div>').join('')+'</div>';
    }).catch(() => {});
    // Fluister: vraag stellen; de gebruikstellers van de inklap-laag reizen mee
    const pkFlVraag = async q => {
      if (!q) return;
      if (window.FocusUI) API.call('/staff/fluister/focus', { scores: FocusUI.scores() }).catch(() => {});
      try {
        const r = await API.call('/staff/fluister', { q });
        pkFlLaatst = '<span style="color:var(--soft);">› '+esc(q)+'</span><br>✦ '+esc(r.antwoord);
        const uit = document.getElementById('pkFlUit');
        if (uit) uit.innerHTML = pkFlLaatst;
      } catch(e){ toast(e.message); }
    };
    const pkfs = document.getElementById('pkFlStuur');
    if (pkfs) pkfs.addEventListener('click', () => {
      const inp = document.getElementById('pkFlIn');
      const q = (inp.value || '').trim();
      inp.value = '';
      pkFlVraag(q);
    });
    // spreek de vraag in via de gedeelde spraakmotor: handig met een
    // dienblad in de ene hand
    if (window.Spraak) Spraak.koppel(document.getElementById('pkFlMic'), {
      opTekst: zin => {
        const inp = document.getElementById('pkFlIn');
        if (inp) inp.value = zin;
        pkFlVraag(zin);
      },
      kanNiet: () => toast(T('pd.fl.micniet','Spraak werkt niet op dit toestel; typen kan altijd.'))
    });
    document.querySelectorAll('[data-eh]').forEach(el => el.addEventListener('click', () => {
      const i = Number(el.dataset.eh);
      hulpOpen = hulpOpen === i ? null : i;
      renderHulp();
    }));
    document.querySelectorAll('[data-ctteken]').forEach(b => b.addEventListener('click', async () => {
      const naam = prompt(T('pd.ct.tekenvraag','Typ uw naam om digitaal te ondertekenen:'));
      if (!naam) return;
      try { await API.call('/supplier/contract/teken', { ref: b.dataset.ctteken, naam, akkoord: true }); toast(T('pd.ct.tekenok','Ondertekend.')); await laadZaken(); renderHulp(); }
      catch(e){ toast(e.message); }
    }));
    const ea = document.getElementById('ehboAlarm');
    if (ea) ea.addEventListener('click', () => sendSOS('EHBO nodig', '🩹 '+T('pd.eh.gestuurd','EHBO-alarm verstuurd. Het team is gealarmeerd.')));
    const ts = document.getElementById('tpSend');
    if (ts) ts.addEventListener('click', async () => {
      const inp = document.getElementById('tpText');
      const text = (inp.value || '').trim();
      if (!text) return;
      try {
        const d = await API.call('/staff/trust/send', { text, anon: document.getElementById('tpAnon').checked });
        if (zaken) zaken.trust = d.trust;
        toast('🤝 '+T('pd.tp.sent','Vertrouwelijk verstuurd. Alleen RTG leest dit.'));
        renderHulp();
        openTab('hulp');
      } catch(e){ toast(e.message); }
    });
    const zb = document.getElementById('ziekBtn');
    if (zb) zb.addEventListener('click', async () => {
      if (!ziekArm){ ziekArm = true; renderHulp(); openTab('hulp'); return; }
      ziekArm = false;
      try {
        await API.call('/staff/leave/request', { soort: 'ziek' });
        toast('🤒 '+T('pd.ad.ziekok','Ziekmelding doorgegeven. Beterschap!'));
        await laadZaken(); renderHulp(); openTab('hulp');
      } catch(e){ toast(e.message); renderHulp(); }
    });
    const vg = document.getElementById('vlGo');
    if (vg) vg.addEventListener('click', async () => {
      const van = document.getElementById('vlVan').value, tot = document.getElementById('vlTot').value;
      if (!van || !tot){ toast(T('pd.ad.datum','Kies een begin- en einddatum.')); return; }
      try {
        await API.call('/staff/leave/request', { soort: 'verlof', van, tot, reden: document.getElementById('vlReden').value.trim() });
        toast('🌴 '+T('pd.ad.gevraagd','Verlof aangevraagd; de manager beslist in het Kantoor.'));
        await laadZaken(); renderHulp(); openTab('hulp');
      } catch(e){ toast(e.message); }
    });
    // De trainingskaart tekent zichzelf met Util.el (eigen handlers); vullen volstaat.
    vulTrainingKaart();
  }

  // Ritten: chauffeurs en crew van vervoerspartners (taxi en jet) werken hun
  // ritten volledig vanuit de zak af: nemen, stap voor stap rijden, verdiensten.
  const NEXT_RIDE = { 'aangevraagd':'geaccepteerd', 'geaccepteerd':'onderweg', 'onderweg':'aangekomen', 'aangekomen':'aan-boord', 'aan-boord':'afgerond', 'rijdt':'afgerond', 'gearriveerd':null };
  const RIDE_LBL = { 'geaccepteerd':['pd.r.accept','Accepteer'], 'onderweg':['pd.r.go','Ik rijd'], 'aangekomen':['pd.r.atpickup','Ik sta voor'], 'aan-boord':['pd.r.board','Aan boord'], 'afgerond':['pd.r.done','Afronden'] };
  const RIT_ST = { 'aangevraagd':['pd.rs.new','nieuw'], 'geaccepteerd':['pd.rs.acc','geaccepteerd'], 'onderweg':['pd.rs.go','onderweg'], 'aangekomen':['pd.rs.at','staat voor'], 'aan-boord':['pd.rs.board','gast aan boord'], 'rijdt':['pd.rs.board','gast aan boord'] };
  const RIT_KLAAR = st => st === 'gearriveerd' || st === 'afgerond' || st === 'geweigerd';
  const heeftRitten = () => !!(state && state.supplier && (state.supplier.caps || []).includes('rides'));
  function renderRitten(){
    const aan = heeftRitten();
    const tabBtn = document.getElementById('tabRitten');
    if (tabBtn) tabBtn.style.display = aan ? '' : 'none';
    const wrap = $('#rittenWrap');
    if (!aan){ if (wrap) wrap.innerHTML = ''; return; }
    const jet = state.supplier && state.supplier.type === 'jet';
    const ritten = state.rides || [];
    const mijn = ritten.filter(r => !RIT_KLAAR(r.status) && r.driver && r.driver.staffId === me.staffId);
    const straks = r => r.plannedFor && (new Date(r.plannedFor) - Date.now()) > 45 * 60000;
    const alleOpen = ritten.filter(r => r.status === 'aangevraagd' && !r.driver);
    const open = alleOpen.filter(r => !straks(r));
    const gepland = alleOpen.filter(straks);
    const vandaag = new Date().toISOString().slice(0, 10);
    const klaar = ritten.filter(r => (r.status === 'afgerond' || r.status === 'gearriveerd') && r.driver && r.driver.staffId === me.staffId && String(r.finishedAt || r.at).slice(0, 10) === vandaag);
    const omzet = klaar.reduce((s, r) => s + (r.quote || 0), 0);
    const regel = r => (r.from || '') + ' → ' + (r.to || T('pd.r.opendest','open bestemming')) + (r.passengers ? ' · ' + r.passengers + 'p' : '') + (r.quote ? ' · ' + eur(r.quote) : '');
    wrap.innerHTML =
      '<div class="card"><div class="k">'+T('pd.r.mijn','Uw rit')+' ('+mijn.length+')</div>'+
      (mijn.length ? mijn.map(r => {
        const nxt = NEXT_RIDE[r.status];
        const st = RIT_ST[r.status];
        return '<div class="task"><span class="ic">'+(jet?'✈️':'🚗')+'</span><div class="t"><b>'+esc(r.customerCodename)+(st?' · '+T(st[0], st[1]):'')+'</b><span>'+esc(regel(r))+(r.note?' · 📝 '+esc(r.note):'')+(r.zorg?'<span style="display:block;color:#E2B93B;">⚠ '+esc(pkZorg(r.zorg))+'</span>':'')+'</span></div>'+
          (nxt ? '<button class="abtn" data-pdgo="'+r.ref+'" data-st="'+nxt+'">'+T(RIDE_LBL[nxt][0], RIDE_LBL[nxt][1])+'</button>' : '')+'</div>';
      }).join('') : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.r.geen','Geen actieve rit. Neem hieronder een open rit aan.')+'</div>')+'</div>'+
      '<div class="card"><div class="k">'+T('pd.r.openh','Open aanvragen')+' ('+open.length+')</div>'+
      (open.length ? open.map(r =>
        '<div class="task"><span class="ic">🔔</span><div class="t"><b>'+esc(r.customerCodename)+'</b><span>'+esc(regel(r))+'</span></div><button class="abtn" data-pdneem="'+r.ref+'">'+T('pd.r.neem','Neem')+'</button></div>'
      ).join('') : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.r.geenopen','Geen open aanvragen. Nieuwe ritten verschijnen hier vanzelf.')+'</div>')+'</div>'+
      (gepland.length ? '<div class="card"><div class="k">'+T('pd.r.gepland','Gepland')+' ('+gepland.length+')</div>'+
        gepland.map(r => '<div class="task"><span class="ic">📅</span><div class="t"><b>'+esc(r.customerCodename)+'</b><span>'+esc((r.when || '') + ' · ' + regel(r))+'</span></div><button class="abtn" data-pdneem="'+r.ref+'">'+T('pd.r.neem','Neem')+'</button></div>').join('')+'</div>' : '')+
      '<div class="card"><div class="k">'+T('pd.r.vandaag','Vandaag')+'</div>'+
      '<div class="task"><span class="ic">💶</span><div class="t"><b>'+klaar.length+' '+T('pd.r.klaar','rit(ten) afgerond')+' · '+eur(omzet)+'</b><span>'+T('pd.r.netto','Volledig voor de zaak: RTG rekent 0% commissie.')+'</span></div></div></div>';
    document.querySelectorAll('[data-pdgo]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/ride/status', { ref: b.dataset.pdgo, status: b.dataset.st }); await refresh(); openTab('ritten'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-pdneem]').forEach(b => b.addEventListener('click', async () => {
      try {
        const s = await API.call('/supplier/ride/suggest', { ref: b.dataset.pdneem });
        await API.call('/supplier/ride/assign', { ref: b.dataset.pdneem, self: true, vehicleId: s.vehicleId });
        toast(T('pd.r.genomen','De rit is van u.') + (s.vehicleName ? ' · ' + s.vehicleName : ''));
        await refresh(); openTab('ritten');
      } catch(e){ toast(e.message); }
    }));
  }

  /* ---- bezorgen: ritten op naam, GPS, navigatie en AI-hulp ---- */
  let gpsWatch = null, gpsLaatst = 0, gpsPos = null;
  const heeftBezorg = () => !!(state && state.bezorg && state.bezorg.bezorgen);
  function kaartLink(o){
    if (o.geo && Number.isFinite(o.geo.lat)) return 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + o.geo.lat + ',' + o.geo.lng;
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(o.adres || '');
  }
  function afstandNaar(o){
    if (!gpsPos || !o.geo || !Number.isFinite(o.geo.lat)) return null;
    const R = 6371000, rad = d => d * Math.PI / 180;
    const dLat = rad(o.geo.lat - gpsPos.lat), dLng = rad(o.geo.lng - gpsPos.lng);
    const a = Math.sin(dLat/2)**2 + Math.cos(rad(gpsPos.lat)) * Math.cos(rad(o.geo.lat)) * Math.sin(dLng/2)**2;
    return Math.round(2 * R * Math.asin(Math.sqrt(a)));
  }
  async function gpsStuur(lat, lng){
    if (Date.now() - gpsLaatst < 8000) return; // hooguit elke 8 s naar de server
    gpsLaatst = Date.now();
    try { await API.call('/supplier/bezorg/gps', { lat, lng }); } catch(e){}
  }
  function gpsAanUit(){
    if (gpsWatch != null){ navigator.geolocation.clearWatch(gpsWatch); gpsWatch = null; renderBezorgen(); return; }
    if (!navigator.geolocation){ toast(T('pd.bz.geengps','Dit apparaat deelt geen GPS.')); return; }
    gpsWatch = navigator.geolocation.watchPosition(p => {
      gpsPos = { lat: p.coords.latitude, lng: p.coords.longitude };
      gpsStuur(gpsPos.lat, gpsPos.lng);
    }, () => toast(T('pd.bz.gpsfout','GPS staat uit of is geweigerd.')), { enableHighAccuracy: true, maximumAge: 5000 });
    renderBezorgen();
  }
  function renderBezorgen(){
    const tabBtn = document.getElementById('tabBezorgen');
    if (tabBtn) tabBtn.style.display = heeftBezorg() ? '' : 'none';
    const wrap = $('#bezorgenWrap');
    if (!wrap) return;
    if (!heeftBezorg()){ wrap.innerHTML = ''; return; }
    const alle = (state.bezorg && state.bezorg.lopend) || [];
    const mijn = alle.filter(o => o.levering === 'bezorgen' && o.bezorger && o.bezorger.staffId === me.staffId && !['bezorgd','opgehaald'].includes(o.status));
    const vrij = alle.filter(o => o.levering === 'bezorgen' && !o.bezorger);
    const mijnKlaar = mijn.filter(o => o.status === 'klaar').map(o => o.ref);
    const rij = (o, extra) => {
      const m = afstandNaar(o);
      return '<div class="task"><span class="ic">'+(o.status==='onderweg'?'\uD83D\uDEF5':'\uD83D\uDCE6')+'</span><div class="t">'+
        '<b>'+esc(o.customerCodename)+' \u00B7 '+esc(o.status)+(o.etaMin?' \u00B7 '+o.etaMin+' min':'')+'</b>'+
        '<span>'+o.items.map(i=>i.qty+'x '+esc(i.name)).join(', ')+' \u00B7 \uD83D\uDCCD '+esc(o.adres||'')+(m!=null?' \u00B7 '+(m<1000?m+' m':(m/1000).toFixed(1)+' km'):'')+'</span>'+
        '<span><a href="'+kaartLink(o)+'" target="_blank" rel="noopener" style="color:var(--gold);text-decoration:none;">\uD83D\uDDFA\uFE0F '+T('pd.bz.nav','Navigeer')+'</a></span></div>'+(extra||'')+'</div>';
    };
    wrap.innerHTML =
      '<div class="card"><div class="k">'+T('pd.bz.gps','Live GPS')+'</div>'+
      '<div class="task"><span class="ic">\uD83D\uDEF0\uFE0F</span><div class="t"><b>'+(gpsWatch!=null?T('pd.bz.gpsaan','U deelt uw positie; de klant ziet u rijden.'):T('pd.bz.gpsuit','GPS staat uit.'))+'</b>'+
      '<span>'+T('pd.bz.gpsuitleg','Alleen tijdens uw rit; stopt zodra u hem uitzet.')+'</span></div>'+
      '<button class="abtn" id="pdGps">'+(gpsWatch!=null?T('pd.bz.stop','Stop'):T('pd.bz.start','Start'))+'</button></div></div>'+
      '<div class="card"><div class="k">'+T('pd.bz.mijn','Mijn rit')+' ('+mijn.length+')</div>'+
      (mijn.length ? mijn.map(o => rij(o,
          o.status==='onderweg' ? '<button class="abtn" data-pdbz="'+o.ref+'" data-st="bezorgd">'+T('pd.bz.bezorgd','Bezorgd')+'</button>' : ''
        )).join('') +
        (mijnKlaar.length ? '<button class="abtn" id="pdVertrek" style="margin-top:0.6rem;">\uD83D\uDEF5 '+T('pd.bz.vertrek','Vertrek')+' ('+mijnKlaar.length+')</button>' : '')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.bz.geenmijn','Geen rit op uw naam. Neem hieronder leveringen aan.')+'</div>')+'</div>'+
      '<div class="card"><div class="k">'+T('pd.bz.vrij','Klaar om mee te nemen')+' ('+vrij.length+')</div>'+
      (vrij.length ? vrij.map(o =>
        '<label class="task" style="cursor:pointer;"><input type="checkbox" class="pdbzkies" value="'+o.ref+'" style="margin-right:0.4rem;accent-color:var(--gold);"'+(o.status==='klaar'?'':' ')+'>'+
        '<div class="t"><b>'+esc(o.customerCodename)+' \u00B7 '+esc(o.status)+'</b><span>'+o.items.map(i=>i.qty+'x '+esc(i.name)).join(', ')+' \u00B7 \uD83D\uDCCD '+esc(o.adres||'')+'</span></div></label>'
      ).join('') + '<button class="abtn" id="pdNeem" style="margin-top:0.6rem;">'+T('pd.bz.neem','Neem geselecteerde ritten (op uw naam)')+'</button>'
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.bz.geenvrij','Niets klaar om mee te nemen. Nieuwe leveringen verschijnen hier live.')+'</div>')+'</div>'+
      '<div class="card"><div class="k">'+T('pd.bz.ai','Snelle hulp (AI)')+'</div>'+
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;">'+
      [[T('pd.bz.ai1','Adres klopt niet'),'Het bezorgadres lijkt niet te kloppen, wat doe ik?'],
       [T('pd.bz.ai2','Gast doet niet open'),'De gast doet niet open bij de bezorging, wat doe ik?'],
       [T('pd.bz.ai3','Ik heb vertraging'),'Ik heb vertraging met de bezorging, wat doe ik?'],
       [T('pd.bz.ai4','Bestelling beschadigd'),'De bestelling is onderweg beschadigd, wat doe ik?']]
      .map(c => '<button class="abtn" data-pdbzai="'+esc(c[1])+'">'+c[0]+'</button>').join('')+'</div>'+
      '<div id="pdBzAiUit" style="margin-top:0.6rem;font-size:0.82rem;color:var(--muted);"></div></div>';
    const g = document.getElementById('pdGps'); if (g) g.addEventListener('click', gpsAanUit);
    const v = document.getElementById('pdVertrek'); if (v) v.addEventListener('click', async () => {
      try { await API.call('/supplier/bezorg/status', { refs: mijnKlaar, status: 'onderweg' }); if (gpsWatch == null) gpsAanUit(); await refresh(); openTab('bezorgen'); } catch(e){ toast(e.message); }
    });
    const n = document.getElementById('pdNeem'); if (n) n.addEventListener('click', async () => {
      const refs = [...document.querySelectorAll('.pdbzkies:checked')].map(x => x.value);
      if (!refs.length) { toast(T('pd.bz.kies','Vink eerst een of meer leveringen aan.')); return; }
      try { const r = await API.call('/supplier/bezorg/neem', { refs }); toast(r.genomen.length + ' ' + T('pd.bz.opnaam','rit(ten) op uw naam.')); await refresh(); openTab('bezorgen'); } catch(e){ toast(e.message); }
    });
    document.querySelectorAll('[data-pdbz]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/bezorg/status', { ref: b.dataset.pdbz, status: b.dataset.st }); await refresh(); openTab('bezorgen'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-pdbzai]').forEach(b => b.addEventListener('click', async () => {
      const uit = document.getElementById('pdBzAiUit');
      uit.textContent = '\u2026';
      // eerst de AI van de zaak; lukt dat niet, dan het vaste bezorgprotocol
      const vast = {
        'adres': T('pd.bz.p1','Bel of chat de gast via de zaak; klopt het adres echt niet, overleg dan met de zaak en lever niet zomaar ergens af.'),
        'open': T('pd.bz.p2','Bel aan, wacht 2 minuten, bel de gast via de zaak. Geen gehoor? Terug naar de zaak; nooit onbeheerd achterlaten.'),
        'vertraging': T('pd.bz.p3','Meld het de zaak; de klant ziet uw GPS en ETA al live. Veilig rijden gaat voor snelheid.'),
        'beschadigd': T('pd.bz.p4','Niet afleveren. Meld het de zaak; die regelt een nieuwe bereiding of terugbetaling met de klant.')
      };
      const sleutel = /adres/i.test(b.dataset.pdbzai) ? 'adres' : /open/i.test(b.dataset.pdbzai) ? 'open' : /vertraging/i.test(b.dataset.pdbzai) ? 'vertraging' : 'beschadigd';
      try {
        const r = await API.call('/supplier/ai', { q: b.dataset.pdbzai });
        uit.textContent = r.reply || vast[sleutel];
      } catch(e){ uit.textContent = vast[sleutel]; }
    }));
  }

  /* ---- de keuken op zak: uw kant van de lijn, live met het keukenscherm ----
     Zelfde rekenregels als het KDS en de servercoach: nominale tijd per kant
     (prepMin op het gerecht wint), klaar telt 0, bezig de halve tijd, niet
     gestart de volle tijd; de langzaamste kant bepaalt wanneer de rest start,
     zodat de hele tafel tegelijk warm uitgaat. Elke actie hier staat direct
     op het keukenscherm en andersom (SSE-sync). */
  const PDA_KANTEN = { warm:['🔥','Warme kant'], koud:['❄️','Koude kant'], snack:['🍟','Snacks'], dessert:['🍰','Desserts'], bar:['🍸','Bar'], pas:['🍽️','De pas'] };
  const PDA_KTIJD = { warm: 12, koud: 6, snack: 8, dessert: 5 };
  let pdaKant = (() => { try { return localStorage.getItem('rtg_pda_kant') || 'warm'; } catch(e){ return 'warm'; } })();
  const heeftKeuken = () => !!(state && (state.menu||[]).some(m => m.station !== 'bar'));
  const heeftBar = () => !!(state && (state.menu||[]).some(m => m.station === 'bar'));
  const pkBarItem = it => { const m = (state.menu||[]).find(x => x.id === it.id); return !!(m && m.station === 'bar'); };
  const pkSectieOf = it => { const m = (state.menu||[]).find(x => x.id === it.id); return (m && m.station !== 'bar') ? (m.sectie || 'warm') : null; };
  const pkSecties = o => [...new Set((o.items||[]).map(pkSectieOf).filter(Boolean))];
  const pkAge = iso => Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  function pkDuur(o, sec){
    let t = PDA_KTIJD[sec] || 8;
    (o.items||[]).forEach(it => { const m = (state.menu||[]).find(x => x.id === it.id);
      if (m && m.station !== 'bar' && (m.sectie||'warm') === sec && m.prepMin) t = Math.max(t, m.prepMin); });
    return t;
  }
  function pkPlan(o){
    const nodig = pkSecties(o), fase = o.secties || {}, rest = {};
    const faseVan = k => k === 'bar' ? (o.stations||{}).bar : fase[k];
    nodig.forEach(sec => { const t = pkDuur(o, sec); rest[sec] = fase[sec]==='klaar' ? 0 : fase[sec]==='bezig' ? Math.ceil(t/2) : t; });
    // de bar telt mee, zodat drankjes en eten samen uitgaan
    if ((o.items||[]).some(it => { const m = (state.menu||[]).find(x => x.id === it.id); return m && m.station === 'bar'; })){
      const bf = (o.stations||{}).bar;
      rest.bar = bf === 'klaar' ? 0 : bf === 'bezig' ? 2 : 4;
    }
    const alle = Object.keys(rest);
    let doel = alle.length ? Math.max.apply(null, alle.map(k => rest[k])) : 0;
    // deurhost: deelt de gast zijn reis (GPS), dan mikt het plan op de aankomst
    if (!o.guestArrived && Number.isFinite(o.guestEtaMin) && o.guestEtaMin > doel) doel = o.guestEtaMin;
    const plan = {};
    alle.forEach(k => {
      const f = faseVan(k);
      if (f==='klaar') plan[k] = doel > 0 ? { doe:'warm', min:doel } : { doe:'pas', min:0 };
      else if (f==='bezig') plan[k] = { doe:'bezig', min:rest[k] };
      else { const w = doel - rest[k]; plan[k] = w >= 2 ? { doe:'wacht', min:w } : { doe:'nu', min:0 }; }
    });
    return { doel, plan };
  }
  // de deurhost-regel: waar is de gast (GPS uit de leden-app)
  function pkGast(o){
    if (o.guestArrived) return '<div style="font-size:0.74rem;color:#7BC79B;margin-bottom:0.4rem;">✅ '+T('kds.gastin','De gast is binnen.')+'</div>';
    if (Number.isFinite(o.guestEtaMin)) return '<div style="font-size:0.74rem;color:var(--soft);margin-bottom:0.4rem;">🧭 '+T('kds.gast','Gast onderweg, ~')+o.guestEtaMin+' min</div>';
    return '';
  }
  // het overschot op de pas: wat er ligt hoef je niet te maken
  const pkOverLijst = () => (state && state.overschot) || [];
  const pkOverQty = naam => pkOverLijst().filter(x => x.name === naam).reduce((n,x) => n + x.qty, 0);
  const pkMinOver = per => { Object.keys(per).forEach(n => { const ov = pkOverQty(n); if (ov){ per[n] = Math.max(0, per[n] - ov); if (!per[n]) delete per[n]; } }); return per; };
  // pas-meldingen (tril + toast) per toestel aan of uit: de gekozen personen
  let pdaPasBel = (() => { try { return localStorage.getItem('rtg_pda_pasbel') !== 'uit'; } catch(e){ return true; } })();
  // pings gaan alleen naar wie echt ingeklokt is: niet ingeklokt = geen tril
  const ikBinnen = () => !!(me && state && state.klok && (state.klok.binnen || []).includes(me.name));

  /* ---- (video)bellen met ingeklokte collega's: echte WebRTC ----
     De gespreks-UI en de verbindingen zitten in shared/teamcall.js; hier
     alleen de koppeling met de eigen login en het SSE-kanaal. */
  if (window.TeamCall) TeamCall.init({ API, mij: () => me, T, toast });
  // en het directe chatbericht naar een collega (shared/collegachat.js)
  if (window.CollegaChat) CollegaChat.init({ API, mij: () => me, T, toast });
  /* De voorraadbalk op zak: laag, op en 86-adviezen uit het keukenbrein,
     dezelfde informatie als op het grote keuken- en barscherm. */
  let pkWv = null, pkWvAt = 0, pkWvBezig = false;
  function pkLaadWerkvloer(){
    if (pkWvBezig || Date.now() - pkWvAt < 20000) return;
    pkWvBezig = true;
    API.call('/supplier/keuken/werkvloer').then(d => { pkWv = d; pkWvAt = Date.now(); pkWvBezig = false; renderKeuken(); }).catch(() => { pkWvBezig = false; pkWvAt = Date.now(); });
  }
  function pkVoorraadKaart(){
    if (!pkWv || (!(pkWv.adviezen||[]).length && !(pkWv.op||[]).length && !(pkWv.laag||[]).length)) return '';
    return '<div class="card" style="border-left:4px solid var(--gold,#A98F1C);"><div class="k">📦 '+T('st.voorraad','Voorraad')+'</div>'+
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.4rem;align-items:center;">'+
      (pkWv.adviezen||[]).map(a => '<button class="abtn" data-pk86="'+a.menuItemId+'" style="border-color:#E5484D;color:#FF8589;">⛔ 86: '+esc(a.gerecht)+' ('+esc(a.ingredient)+' '+T('st.isop','is op')+')</button>').join('')+
      (pkWv.op||[]).map(a => '<span style="font-size:0.78rem;color:#FF8589;font-weight:600;">'+esc(a.naam)+' '+T('st.op','OP')+'</span>').join('')+
      (pkWv.laag||[]).map(a => '<span style="font-size:0.78rem;color:var(--soft);">'+esc(a.naam)+' '+T('st.laag','laag')+' ('+a.aantal+' '+esc(a.eenheid)+')</span>').join('')+
      '<button class="abtn ghost" data-pkderf>♻ '+T('st.derf','Derving melden')+'</button></div></div>';
  }
  function renderKeuken(){
    const tabBtn = document.getElementById('tabKeuken');
    if (tabBtn) tabBtn.style.display = (heeftKeuken() || heeftBar()) ? '' : 'none';
    const wrap = $('#keukenWrap'); if (!wrap) return;
    if (!heeftKeuken() && !heeftBar()){ wrap.innerHTML = ''; return; }
    // een pure bar of club heeft alleen de barkant; stuur de keuze daarheen
    if (!heeftKeuken() && pdaKant !== 'bar') pdaKant = 'bar';
    if (!heeftBar() && pdaKant === 'bar') pdaKant = 'warm';
    pkLaadWerkvloer();
    const live = (state.orders||[]).filter(o => !['geserveerd','geweigerd','terugbetaald'].includes(o.status) && pkSecties(o).length);
    // kant kiezen = inloggen op dat station; de keuze blijft op dit toestel staan
    const kanten = Object.keys(PDA_KANTEN).filter(k => k === 'bar' ? heeftBar() : (heeftKeuken() || k === 'bar'));
    let html = '<div class="card" style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;">'+kanten.map(k =>
      '<button class="abtn'+(pdaKant===k?'':' ghost')+'" data-pkkant="'+k+'">'+PDA_KANTEN[k][0]+' '+T('ks.'+k, PDA_KANTEN[k][1])+'</button>').join('')+
      '<button class="abtn'+(pdaPasBel?'':' ghost')+'" data-pkbel style="margin-left:auto;">'+(pdaPasBel?'🔔':'🔕')+' '+T('pd.k.pasbel','Pas-bel')+'</button>'+
      (ikBinnen()?'':'<span style="flex-basis:100%;font-size:0.68rem;color:var(--soft);">⏱ '+T('pd.k.nietin','Niet ingeklokt: pings staan uit tot je inklokt (tab Vandaag).')+'</span>')+'</div>';
    html += pkVoorraadKaart();
    if (pdaKant === 'pas'){
      const opDePas = live.filter(o => (o.stations||{}).keuken === 'klaar').sort((a,b) => ((b.spoed?1:0)-(a.spoed?1:0)) || (new Date(a.pasAt||a.at)-new Date(b.pasAt||b.at)));
      const bezig = live.filter(o => (o.stations||{}).keuken !== 'klaar');
      // staat alles van een tafel op de pas, dan kan de hele tafel in een keer uit
      const tafels = {};
      opDePas.forEach(o => { if (o.table) (tafels[o.table] = tafels[o.table] || []).push(o); });
      const compleet = Object.keys(tafels).filter(t => !bezig.some(o => (o.table||'') === t));
      if (compleet.length) html += '<div class="card" style="border-left:4px solid #2E7D5B;"><div class="k">🪑 '+T('pas.compleet','Tafel compleet')+'</div>'+
        compleet.map(t => '<div style="margin-top:0.35rem;font-size:0.85rem;"><b>'+esc(t)+'</b> · '+tafels[t].map(o=>o.pickup).join(', ')+' · '+T('pas.samen','stuur samen uit')+'</div>').join('')+'</div>';
      if (pkOverLijst().length) html += '<div class="card"><div class="k">🥡 '+T('over.h','Op de pas over')+'</div>'+
        pkOverLijst().map(x=>'<div class="task"><div class="t"><b>'+x.qty+'× '+esc(x.name)+'</b><span>'+esc(x.door||'')+'</span></div><button class="abtn" data-pkover="'+x.id+'">'+T('over.gebruikt','Gebruikt')+'</button></div>').join('')+'</div>';
      html += '<div class="card"><div class="k">'+T('ks.pas.klaar','Op de pas, samenstellen en doorgeven')+' ('+opDePas.length+')</div>'+
        (opDePas.length ? opDePas.map(o => { const pa = pkAge(o.pasAt || o.at);
          return '<div class="task"><span class="ic">🛎️</span><div class="t"><b>'+o.pickup+(o.table?' · '+esc(o.table):'')+'</b><span>'+(o.items||[]).filter(it=>pkSectieOf(it)).map(it=>it.qty+'× '+esc(it.name)).join(', ')+(Number.isFinite(o.guestEtaMin)&&!o.guestArrived?' · 🧭 ~'+o.guestEtaMin+'m':o.guestArrived?' · ✅':'')+'</span></div><span style="font-size:0.72rem;font-weight:700;color:'+(pa>=6?'#FF8589':pa>=3?'#E2B93B':'#7BC79B')+';">'+pa+'m</span></div>'; }).join('')
          : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('ks.pas.leeg','Nog niets op de pas. Zodra alle kanten klaar zijn, komt de bestelling hier binnen.')+'</div>')+'</div>';
      if (bezig.length) html += '<div class="card"><div class="k">'+T('ks.pas.bezig','In de maak, per kant')+' ('+bezig.length+')</div>'+
        bezig.map(o => '<div class="task"><span class="ic">🔥</span><div class="t"><b>'+o.pickup+(o.table?' · '+esc(o.table):'')+'</b><span>'+pkSecties(o).map(s2 => PDA_KANTEN[s2][0]+' '+((o.secties||{})[s2]||T('pd.k.wacht','wacht'))).join(' · ')+'</span></div><span style="font-size:0.72rem;color:var(--soft);">'+pkAge(o.at)+'m</span></div>').join('')+'</div>';
    } else if (pdaKant === 'bar'){
      /* de barkant op zak: alle bonnen met drankjes, los van de keukenkanten;
         start en klaar lopen via hetzelfde station als het grote barscherm */
      const barLive = (state.orders||[]).filter(o => !['geserveerd','geweigerd','terugbetaald'].includes(o.status) && (o.items||[]).some(pkBarItem));
      const mijn = barLive.filter(o => (o.stations||{}).bar !== 'klaar').sort((a,b) => ((b.spoed?1:0)-(a.spoed?1:0)) || (new Date(a.at)-new Date(b.at)));
      const laat = mijn.filter(o => pkAge(o.at) >= 8).length;
      const per = {};
      mijn.forEach(o => (o.items||[]).forEach(it => { if (pkBarItem(it)) per[it.name] = (per[it.name]||0) + it.qty; }));
      const allday = Object.entries(per).sort((a,b) => b[1]-a[1]).slice(0, 8);
      html += '<div class="card" style="display:flex;gap:1.2rem;align-items:center;"><div><b style="font-size:1.3rem;">'+mijn.length+'</b><span style="display:block;font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('kds.open','Open bonnen')+'</span></div>'+
        '<div><b style="font-size:1.3rem;color:'+(laat?'#FF8589':'#7BC79B')+';">'+laat+'</b><span style="display:block;font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('kds.laat','Te laat')+'</span></div>'+
        (allday.length?'<div style="flex:1;font-size:0.72rem;color:var(--soft);">'+T('kds.allday','All day')+': '+allday.map(r => r[1]+'× '+esc(r[0])).join(', ')+'</div>':'')+'</div>';
      html += mijn.length ? mijn.map(o => {
        const a = pkAge(o.at);
        const fase = (o.stations||{}).bar;
        const items = (o.items||[]).filter(pkBarItem);
        return '<div class="card" style="border-left:4px solid '+(a>=8?'#E5484D':a>=4?'#C99A2E':'#2E7D5B')+';">'+
          '<div style="display:flex;justify-content:space-between;align-items:baseline;"><b style="font-size:1.05rem;color:var(--gold);">'+o.pickup+(o.table?' · '+esc(o.table):'')+'</b><span style="font-size:0.78rem;font-weight:700;color:'+(a>=8?'#FF8589':a>=4?'#E2B93B':'#7BC79B')+';">'+a+' min</span></div>'+
          '<div style="margin:0.35rem 0 0.5rem;font-size:0.92rem;">'+items.map(it => '<div style="padding:0.15rem 0;">'+((o.spoed && (!o.spoed.itemId || o.spoed.itemId === it.id))?'⚡ ':'')+'<b style="color:var(--gold);">'+it.qty+'×</b> '+esc(it.name)+'</div>').join('')+'</div>'+
          (fase==='bezig'?'<div style="font-size:0.68rem;letter-spacing:0.05em;text-transform:uppercase;color:var(--soft);margin-bottom:0.5rem;">🍸 '+T('vp.bezig','bezig')+'</div>':'')+
          '<div style="display:flex;gap:0.5rem;">'+(!fase?'<button class="abtn ghost" data-pkbar="'+o.ref+'" data-phase="bezig" style="flex:1;">'+T('st.start','Start')+'</button>':'')+
          '<button class="abtn" data-pkbar="'+o.ref+'" data-phase="klaar" style="flex:1;">'+T('st.ready','Klaar')+'</button></div></div>';
      }).join('') : '<div class="card" style="color:var(--soft);font-size:0.85rem;">'+T('pd.b.leeg','Geen open drankbonnen. Nieuwe bestellingen verschijnen hier vanzelf, live met het barscherm.')+'</div>';
    } else {
      const sec = pdaKant;
      const mijn = live.filter(o => pkSecties(o).includes(sec) && (o.secties||{})[sec] !== 'klaar').sort((a,b) => ((b.spoed?1:0)-(a.spoed?1:0)) || (new Date(a.at)-new Date(b.at)));
      const laat = mijn.filter(o => pkAge(o.at) >= 12).length;
      // all day voor deze kant, net als op het grote scherm
      const per = {};
      mijn.forEach(o => (o.items||[]).forEach(it => { if (pkSectieOf(it) === sec) per[it.name] = (per[it.name]||0) + it.qty; }));
      pkMinOver(per);
      const allday = Object.entries(per).sort((a,b) => b[1]-a[1]).slice(0, 8);
      html += '<div class="card" style="display:flex;gap:1.2rem;align-items:center;"><div><b style="font-size:1.3rem;">'+mijn.length+'</b><span style="display:block;font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('kds.open','Open bonnen')+'</span></div>'+
        '<div><b style="font-size:1.3rem;color:'+(laat?'#FF8589':'#7BC79B')+';">'+laat+'</b><span style="display:block;font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('kds.laat','Te laat')+'</span></div>'+
        (allday.length?'<div style="flex:1;font-size:0.72rem;color:var(--soft);">'+T('kds.allday','All day')+': '+allday.map(r => r[1]+'× '+esc(r[0])).join(', ')+'</div>':'')+'</div>';
      // de bezetting van deze kant: aanmelden = het scherm rekent met jou mee
      const koks = ((state.lijn||{})[sec]) || [];
      const ikSta = me && koks.some(k => k.id === me.staffId);
      const perKok = koks.length ? Math.ceil(mijn.length / koks.length) : mijn.length;
      html += '<div class="card" style="display:flex;align-items:center;gap:0.7rem;flex-wrap:wrap;"><span style="font-size:0.8rem;">👥 '+
        (koks.length ? esc(koks.map(k=>k.name.split(' ')[0]).join(', '))+' · <b>'+perKok+'</b> '+T('lijn.perkok','bon(nen) p.p.') : T('lijn.leeg','Niemand aangemeld'))+'</span>'+
        '<button class="abtn'+(ikSta?'':' ghost')+'" data-pklijn style="margin-left:auto;">'+(ikSta?'✔ '+T('lijn.af2','Aangemeld'):T('lijn.aan','Meld je aan op deze kant'))+'</button></div>';
      // maak nu: in een keer maken, gebundeld over de bonnen
      const nuPer = {};
      mijn.forEach(o => {
        const p2 = pkPlan(o).plan[sec];
        if (!p2 || (p2.doe !== 'nu' && p2.doe !== 'bezig')) return;
        (o.items||[]).forEach(it => { if (pkSectieOf(it) === sec){ nuPer[it.name] = (nuPer[it.name]||0) + it.qty; } });
      });
      pkMinOver(nuPer);
      const nuRows = Object.entries(nuPer).sort((a,b)=>b[1]-a[1]).slice(0,6);
      if (nuRows.length) html += '<div class="card" style="border-left:4px solid #2E7D5B;"><div class="k">🔥 '+T('lijn.maaknu','Maak nu, in een keer')+'</div>'+
        '<div style="margin-top:0.4rem;font-size:0.9rem;">'+nuRows.map(r=>'<b style="color:var(--gold);">'+r[1]+'×</b> '+esc(r[0])).join(' · ')+'</div></div>';
      if (pkOverLijst().length) html += '<div class="card"><div class="k">🥡 '+T('over.h','Op de pas over')+'</div>'+
        '<div style="margin-top:0.4rem;font-size:0.85rem;">'+pkOverLijst().map(x=>'<b style="color:var(--gold);">'+x.qty+'×</b> '+esc(x.name)).join(' · ')+' · <span style="color:var(--soft);">'+T('over.eerst','gebruik eerst wat er ligt')+'</span></div></div>';
      html += mijn.length ? mijn.map(o => {
        const a = pkAge(o.at);
        const p = pkPlan(o).plan[sec];
        const adv = p ? ({ nu: '▶ '+T('vp.nu','start nu'), wacht: '⏳ '+T('vp.wacht','wacht')+' ~'+p.min+'m', bezig: '🔥 '+T('vp.bezig','bezig'), warm: '♨ '+T('vp.warm','houd warm'), pas: '✓ '+T('vp.pas','naar de pas') })[p.doe] : '';
        const fase = (o.secties||{})[sec];
        const items = (o.items||[]).filter(it => pkSectieOf(it) === sec);
        return '<div class="card" style="border-left:4px solid '+(a>=12?'#E5484D':a>=6?'#C99A2E':'#2E7D5B')+';">'+
          '<div style="display:flex;justify-content:space-between;align-items:baseline;"><b style="font-size:1.05rem;color:var(--gold);">'+o.pickup+(o.table?' · '+esc(o.table):'')+'</b><span style="font-size:0.78rem;font-weight:700;color:'+(a>=12?'#FF8589':a>=6?'#E2B93B':'#7BC79B')+';">'+a+' min</span></div>'+
          '<div style="margin:0.35rem 0 0.5rem;font-size:0.92rem;">'+items.map(it => '<div data-pkdish="'+it.id+'" style="padding:0.15rem 0;">'+((o.spoed && (!o.spoed.itemId || o.spoed.itemId === it.id))?'⚡ ':'')+'<b style="color:var(--gold);">'+it.qty+'×</b> '+esc(it.name)+'</div>').join('')+'</div>'+
          (o.allergyNote?'<div style="font-size:0.76rem;color:#FF8589;border:1px solid rgba(229,72,77,0.4);border-radius:8px;padding:0.35rem 0.5rem;margin-bottom:0.5rem;">⚠ '+esc(o.allergyNote)+'</div>':'')+
          (o.zorg?'<div style="font-size:0.76rem;color:#FF8589;border:1px solid rgba(229,72,77,0.4);border-radius:8px;padding:0.35rem 0.5rem;margin-bottom:0.5rem;">⚠ '+T('pd.zorgp','Zorgprofiel gast')+': '+esc(pkZorg(o.zorg))+'</div>':'')+
          pkGast(o)+
          (adv?'<div style="font-size:0.68rem;letter-spacing:0.05em;text-transform:uppercase;color:var(--soft);margin-bottom:0.5rem;">'+adv+'</div>':'')+
          '<div style="display:flex;gap:0.5rem;">'+(!fase?'<button class="abtn ghost" data-pkgo="'+o.ref+'" data-phase="bezig" style="flex:1;">'+T('st.start','Start')+'</button>':'')+
          '<button class="abtn" data-pkgo="'+o.ref+'" data-phase="klaar" style="flex:1;">'+T('st.ready','Klaar')+'</button></div></div>';
      }).join('') : '<div class="card" style="color:var(--soft);font-size:0.85rem;">'+T('pd.k.leeg','Niets voor deze kant. Nieuwe bonnen verschijnen hier vanzelf, live met het keukenscherm.')+'</div>';
    }
    wrap.innerHTML = html;
    wrap.querySelectorAll('[data-pkkant]').forEach(b => b.addEventListener('click', () => {
      pdaKant = b.dataset.pkkant;
      try { localStorage.setItem('rtg_pda_kant', pdaKant); } catch(e){}
      renderKeuken();
    }));
    // de voorraadbalk: 86 op advies en derving melden, recht vanaf de vloer
    wrap.querySelectorAll('[data-pk86]').forEach(b => b.addEventListener('click', async () => {
      try {
        await API.call('/supplier/menu/86', { itemId: b.dataset.pk86, op: true });
        toast('⛔ '+T('st.86gezet','86 gezet; leden kunnen het niet meer bestellen.'));
        pkWvAt = 0; pkLaadWerkvloer(); await refresh();
      } catch(e){ toast(e.message); }
    }));
    const pkDerf = wrap.querySelector('[data-pkderf]'); if (pkDerf) pkDerf.addEventListener('click', async () => {
      const naam = prompt(T('st.derfwat','Welk artikel is er weg (naam van de voorraadlijst)?')); if (!naam) return;
      const art = ((pkWv && pkWv.artikelen) || []).find(a => a.naam.toLowerCase() === naam.trim().toLowerCase());
      if (!art){ toast(T('st.derfgeen','Dat artikel staat niet op de voorraadlijst.')); return; }
      const hv = prompt(T('vr.derfvraag','Hoeveel is er weg (breuk, derving)?')); if (!hv) return;
      const reden = prompt(T('vr.derfreden','Reden?')) || '';
      try {
        await API.call('/supplier/keuken/verspilling', { artikelId: art.id, hoeveelheid: Number(String(hv).replace(',', '.')), reden });
        toast('♻ '+T('st.derfok','Geboekt in het voorraadlogboek.'));
        pkWvAt = 0; pkLaadWerkvloer();
      } catch(e){ toast(e.message); }
    });
    wrap.querySelectorAll('[data-pkover]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/overschot', { op: 'gebruikt', id: b.dataset.pkover }); await refresh(); openTab('keuken'); } catch(e){ toast(e.message); }
    }));
    // aanmelden op deze kant: het scherm en de coach rekenen met de bezetting
    const lijnBtn = wrap.querySelector('[data-pklijn]'); if (lijnBtn) lijnBtn.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/lijn', { sectie: pdaKant }); toast(d.aangemeld ? '👥 '+T('lijn.aant','Aangemeld op deze kant.') : T('lijn.aftoast','Afgemeld van deze kant.')); await refresh(); openTab('keuken'); } catch(e){ toast(e.message); }
    });
    // de gekozen personen: pas-meldingen (tril + toast) per toestel aan of uit
    const bel = wrap.querySelector('[data-pkbel]'); if (bel) bel.addEventListener('click', () => {
      pdaPasBel = !pdaPasBel;
      try { localStorage.setItem('rtg_pda_pasbel', pdaPasBel ? 'aan' : 'uit'); } catch(e){}
      toast(pdaPasBel ? '🔔 '+T('pd.k.belaan','Dit toestel krijgt pas-meldingen.') : '🔕 '+T('pd.k.beluit','Pas-meldingen staan uit op dit toestel.'));
      renderKeuken();
    });
    wrap.querySelectorAll('[data-pkgo]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/order/sectie', { ref: b.dataset.pkgo, sectie: pdaKant, phase: b.dataset.phase }); toast(b.dataset.phase==='klaar'?T('pd.k.klaar','Kant klaargemeld; het keukenscherm ziet het direct.'):T('pd.k.gestart','Gestart.')); await refresh(); openTab('keuken'); } catch(e){ toast(e.message); }
    }));
    // de barkant meldt via het station, precies zoals het grote barscherm
    wrap.querySelectorAll('[data-pkbar]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/order/station', { ref: b.dataset.pkbar, station: 'bar', phase: b.dataset.phase }); toast(b.dataset.phase==='klaar'?T('pd.b.klaar','Drankjes klaargemeld; de bediening ziet het direct.'):T('pd.k.gestart','Gestart.')); await refresh(); openTab('keuken'); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-pkdish]').forEach(d => d.addEventListener('click', async () => {
      // gerechtenkennis op zak: tik op het gerecht voor de bereidingswijze
      const open = d.nextElementSibling && d.nextElementSibling.classList.contains('pk-kennis');
      wrap.querySelectorAll('.pk-kennis').forEach(x => x.remove());
      if (open) return;
      const div = document.createElement('div');
      div.className = 'pk-kennis';
      div.style.cssText = 'white-space:pre-line;font-size:0.78rem;color:var(--soft);background:var(--card2,#191715);border:1px solid var(--line);border-radius:10px;padding:0.6rem 0.75rem;margin:0.25rem 0 0.4rem;line-height:1.55;';
      div.textContent = T('ds.laden','De AI-chef schrijft...');
      d.insertAdjacentElement('afterend', div);
      try { const k = await API.call('/supplier/menu/kennis', { itemId: d.dataset.pkdish, soort: 'bereiding' }); div.textContent = k.tekst; } catch(e){ div.textContent = e.message; }
    }));
  }

  /* ---- entree: programma van vandaag + check-in op eigen naam ---- */
  let pdProgramma = null;
  let pdVkLaatst = ''; // de laatste deurverkoop (de entreecode blijft leesbaar na verversen)
  // ---- winkelvloer (retail) ----
  let pdRetail = null;      // retail-toestand van het merk (voorraad, paskamer, apart)
  let winkelKlant = null;   // geopend klantdossier op de vloer
  let winkelCart = [];      // mobiele kassa: [{vsku, naam, kleur, maat, price, aantal}]
  const heeftRetail = () => !!(state && state.supplier && (state.supplier.caps || []).includes('retail'));
  async function laadWinkel(){
    if (!heeftRetail()) return;
    try { pdRetail = (await API.call('/supplier/retail', {})).retail; } catch(e){ pdRetail = { artikelen:[], paskamer:[], apart:[], klanten:[], stats:{} }; }
    renderWinkel();
  }
  function winkelInput(id, ph){ return '<input id="'+id+'" placeholder="'+ph+'" style="flex:1;background:var(--card2,#191715);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.85rem;font-size:0.95rem;color:var(--txt);outline:none;font-family:inherit;">'; }
  function renderWinkel(){
    const tabBtn = document.getElementById('tabWinkel');
    if (tabBtn) tabBtn.style.display = heeftRetail() ? '' : 'none';
    const wrap = $('#winkelWrap');
    if (!wrap) return;
    if (!heeftRetail()){ wrap.innerHTML = ''; return; }
    if (!pdRetail){ wrap.innerHTML = '<div class="card">…</div>'; laadWinkel(); return; }
    let html = '';
    // mobiele kassa (bon)
    const cartTot = winkelCart.reduce((n, r) => n + r.price * r.aantal, 0);
    html += '<div class="card"><div class="k" style="display:flex;justify-content:space-between;align-items:center;">'+T('pd.w.kassa','Mobiele kassa')+
      (winkelKlant?'<span style="color:var(--gold);font-size:0.66rem;">'+esc(winkelKlant.codenaam||winkelKlant.key)+'</span>':'')+'</div>'+
      (winkelCart.length ? '<div style="margin-top:0.5rem;">'+winkelCart.map((r,i) => '<div class="task"><span class="ic">👕</span><div class="t"><b>'+esc(r.naam)+'</b><span>'+esc(r.kleur)+' · '+esc(r.maat)+' · '+eur(r.price)+' × '+r.aantal+'</span></div><button class="abtn ghost" data-wcartdel="'+i+'">✕</button></div>').join('')+
        '<div style="display:flex;justify-content:space-between;font-weight:700;margin-top:0.6rem;font-size:1rem;"><span>'+T('pd.w.totaal','Totaal')+'</span><span>'+eur(cartTot)+'</span></div>'+
        '<div style="display:flex;gap:0.5rem;margin-top:0.6rem;"><button class="abtn" data-wbetaal="rtgpay" style="flex:1;">RTG Pay</button><button class="abtn" data-wbetaal="contant" style="flex:1;background:var(--card2);color:var(--txt);border:1px solid var(--line);">'+T('pd.w.contant','Contant')+'</button></div>'+
        '<button class="abtn ghost" id="wCartLeeg" style="margin-top:0.5rem;width:100%;">'+T('pd.w.leeg','Bon leegmaken')+'</button></div>'
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.w.leegbon','Zoek een artikel en tik + om het op de bon te zetten.')+'</div>')+'</div>';
    // voorraad opzoeken
    html += '<div class="card"><div class="k">'+T('pd.w.zoek','Voorraad opzoeken')+'</div>'+
      '<div style="display:flex;gap:0.5rem;margin-top:0.55rem;">'+winkelInput('wZoek', T('pd.w.zoekph','Naam, kleur of maat…'))+'<button class="abtn" id="wZoekBtn">'+T('pd.w.zoekbtn','Zoek')+'</button></div>'+
      '<div id="wZoekUit" style="margin-top:0.5rem;"></div></div>';
    // paskamerverzoeken
    const pk = pdRetail.paskamer || [];
    html += '<div class="card"><div class="k">'+T('pd.w.paskamer','Paskamerverzoeken')+' ('+pk.length+')</div>'+
      (pk.length ? pk.map(v => '<div class="task"><span class="ic">🚪</span><div class="t"><b>'+esc(v.artikelNaam)+' · '+esc(v.maat)+'</b><span>'+esc(v.codenaam||'Gast')+' · '+esc(v.kleur)+(v.paskamer?' · '+esc(v.paskamer):'')+'</span></div><button class="abtn" data-wbreng="'+v.id+'">'+T('pd.w.breng','Gebracht')+'</button></div>').join('')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.w.geenpk','Geen open verzoeken.')+'</div>')+'</div>';
    // apart gelegd
    const ap = pdRetail.apart || [];
    if (ap.length) html += '<div class="card"><div class="k">'+T('pd.w.apart','Apart gelegd')+' ('+ap.length+')</div>'+
      ap.map(r => '<div class="task"><span class="ic">🛍</span><div class="t"><b>'+esc(r.artikelNaam)+' · '+esc(r.maat)+'</b><span>'+esc(r.codenaam||r.key)+' · '+T('pd.w.tot','tot')+' '+esc(r.tot)+'</span></div></div>').join('')+'</div>';
    // klant erbij pakken
    html += '<div class="card"><div class="k">'+T('pd.w.klant','Klant erbij pakken')+'</div>'+
      '<div style="display:flex;gap:0.5rem;margin-top:0.55rem;">'+winkelInput('wKlantKey', T('pd.w.klantph','Codenaam of sleutel van het lid'))+'<button class="abtn" id="wKlantBtn">'+T('pd.w.open','Open')+'</button></div>'+
      '<div id="wKlantUit" style="margin-top:0.5rem;">'+(winkelKlant?winkelKlantKaart(winkelKlant):'')+'</div></div>';
    wrap.innerHTML = html;
    winkelBind(wrap);
  }
  function winkelKlantKaart(k){
    const maten = Object.entries(k.maten||{}).map(([a,b]) => esc(a)+': '+esc(b)).join(' · ');
    return '<div style="border-top:1px solid var(--line);padding-top:0.6rem;">'+
      '<div style="display:flex;justify-content:space-between;"><b>'+esc(k.codenaam||k.key)+'</b><span style="color:var(--gold);">'+eur(k.besteedTotaal)+'</span></div>'+
      '<div style="font-size:0.78rem;color:var(--muted);margin-top:0.2rem;">'+k.aankopen+' '+T('pd.w.aankopen','aankopen')+(maten?' · '+maten:'')+'</div>'+
      (k.voorkeuren?'<div style="font-size:0.78rem;color:var(--soft);margin-top:0.2rem;">'+esc(k.voorkeuren)+'</div>':'')+
      ((k.wishlist&&k.wishlist.length)?'<div style="font-size:0.78rem;color:var(--txt);margin-top:0.35rem;">💛 '+k.wishlist.map(w=>esc(w.naam)).join(', ')+'</div>':'')+
      '</div>';
  }
  function winkelBind(wrap){
    // kassa
    wrap.querySelectorAll('[data-wcartdel]').forEach(b => b.addEventListener('click', () => { winkelCart.splice(Number(b.dataset.wcartdel), 1); renderWinkel(); }));
    const leeg = wrap.querySelector('#wCartLeeg'); if (leeg) leeg.addEventListener('click', () => { winkelCart = []; renderWinkel(); });
    wrap.querySelectorAll('[data-wbetaal]').forEach(b => b.addEventListener('click', async () => {
      if (!winkelCart.length) return;
      const body = { method: b.dataset.wbetaal, regels: winkelCart.map(r => ({ vsku: r.vsku, aantal: r.aantal })) };
      if (body.method === 'rtgpay'){
        // tap to pay als het kan, met altijd de uitweg om de code te typen
        let code = null;
        if (window.TapPay && TapPay.kan() && window.confirm(T('pd.w.tapkeuze','Tap to pay: de klant tikt zijn toestel hiertegen. Liever de code typen (bijv. als NFC niet werkt)? Kies dan Annuleren.'))){
          toast('📳 '+T('pd.w.tap','Tap to pay: laat de klant het toestel hiertegen houden...'));
          code = await TapPay.lees(12000);
          if (!code) toast(T('pd.w.tapmis','Geen tik ontvangen; typ de code van de klant.'));
        }
        if (!code){
          const c = window.prompt(T('pd.w.paycode','Betaalcode van de klant (uit de app):'));
          if (!c) return;
          code = c.trim().toUpperCase();
        }
        body.payCode = code;
      }
      if (winkelKlant) body.klantKey = winkelKlant.key;
      try {
        const r = await API.call('/supplier/retail/verkoop', body);
        toast('✅ '+T('pd.w.verkocht','Verkocht')+' · '+eur(r.sale.total));
        winkelCart = [];
        if (winkelKlant){ try { winkelKlant = (await API.call('/supplier/retail/klant', { key: winkelKlant.key })).klant; } catch(e){} }
        await laadWinkel();
      } catch(e){ toast(e.message); }
    }));
    // zoeken
    const doeZoek = async () => {
      const uit = wrap.querySelector('#wZoekUit');
      try {
        const r = await API.call('/supplier/retail/zoek', { q: wrap.querySelector('#wZoek').value });
        uit.innerHTML = r.resultaten.length ? r.resultaten.map(v =>
          '<div class="task"><span class="ic">'+(v.voorraad>0?'👕':'🚫')+'</span><div class="t"><b>'+esc(v.artikel)+'</b><span>'+esc(v.kleur)+' · '+esc(v.maat)+' · '+eur(v.price)+' · '+T('pd.w.voorraad','voorraad')+' '+v.voorraad+'</span></div>'+
          '<div style="display:flex;gap:0.3rem;">'+
          (v.voorraad>0?'<button class="abtn" data-wadd="'+esc(v.vsku)+'" data-wnaam="'+esc(v.artikel)+'" data-wkleur="'+esc(v.kleur)+'" data-wmaat="'+esc(v.maat)+'" data-wprice="'+v.price+'">+</button>':'')+
          (v.voorraad>0?'<button class="abtn ghost" data-wapart="'+esc(v.vsku)+'">'+T('pd.w.legapart','Apart')+'</button>':'')+
          '</div></div>').join('') : '<div style="font-size:0.8rem;color:var(--soft);">'+T('pd.w.niets','Niets gevonden.')+'</div>';
        // knoppen in de resultaten binden
        uit.querySelectorAll('[data-wadd]').forEach(b => b.addEventListener('click', () => {
          const bestaand = winkelCart.find(r => r.vsku === b.dataset.wadd);
          if (bestaand) bestaand.aantal++;
          else winkelCart.push({ vsku: b.dataset.wadd, naam: b.dataset.wnaam, kleur: b.dataset.wkleur, maat: b.dataset.wmaat, price: Number(b.dataset.wprice), aantal: 1 });
          renderWinkel();
        }));
        uit.querySelectorAll('[data-wapart]').forEach(b => b.addEventListener('click', async () => {
          if (!winkelKlant) return toast(T('pd.w.eerstklant','Pak eerst een klant erbij.'));
          try { await API.call('/supplier/retail/apart', { key: winkelKlant.key, vsku: b.dataset.wapart }); toast(T('pd.w.apartok','Apart gelegd voor de klant.')); await laadWinkel(); } catch(e){ toast(e.message); }
        }));
      } catch(e){ toast(e.message); }
    };
    const zb = wrap.querySelector('#wZoekBtn'); if (zb) zb.addEventListener('click', doeZoek);
    const zi = wrap.querySelector('#wZoek'); if (zi) zi.addEventListener('keydown', e => { if (e.key === 'Enter') doeZoek(); });
    // paskamer gebracht
    wrap.querySelectorAll('[data-wbreng]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/retail/paskamer/breng', { id: b.dataset.wbreng }); toast(T('pd.w.gebracht','Gebracht.')); await laadWinkel(); } catch(e){ toast(e.message); }
    }));
    // klant openen
    const kb = wrap.querySelector('#wKlantBtn');
    const openKlant = async () => {
      const key = wrap.querySelector('#wKlantKey').value.trim(); if (!key) return;
      try { winkelKlant = (await API.call('/supplier/retail/klant', { key })).klant; renderWinkel(); }
      catch(e){ toast(e.message); }
    };
    if (kb) kb.addEventListener('click', openKlant);
    const ki = wrap.querySelector('#wKlantKey'); if (ki) ki.addEventListener('keydown', e => { if (e.key === 'Enter') openKlant(); });
  }

  // ---- op het land (boerderij): de knecht doet de taken van vandaag ----
  let pdBoer = null;
  const heeftBoer = () => !!(state && state.supplier && (state.supplier.caps || []).includes('boerderij'));
  async function laadBoer(){
    if (!heeftBoer()) return;
    try { pdBoer = (await API.call('/supplier/boerderij/overzicht', {})); } catch(e){ pdBoer = null; }
    renderBoer();
  }
  function boerPdaToe(r){ if (r && r.overzicht) pdBoer = r.overzicht; renderBoer(); }
  function renderBoer(){
    const tabBtn = document.getElementById('tabBoer');
    if (tabBtn) tabBtn.style.display = heeftBoer() ? '' : 'none';
    const wrap = $('#boerPdaWrap'); if (!wrap) return;
    if (!heeftBoer()){ wrap.innerHTML = ''; return; }
    if (!pdBoer){ wrap.innerHTML = '<div class="card">…</div>'; laadBoer(); return; }
    const o = pdBoer, vandaag = new Date().toISOString().slice(0,10);
    let html = '';
    // Vandaag-briefing (leesbaar samengevat voor de knecht)
    const br = o.briefing || { punten:[] };
    html += '<div class="card"><div class="k">🌱 '+T('pd.boer.vandaag','Vandaag op het land')+'</div>'+
      (br.punten.length ? br.punten.map(p => '<div class="task"><span class="ic">'+(p.soort==='oogst'?'🌾':p.soort==='voer'?'🐄':p.soort==='water'?'💧':p.soort==='gezondheid'?'🩺':'📋')+'</span><div class="t"><b>'+esc(p.tekst)+'</b></div></div>').join('')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.boer.rustig','Niets dringends. Fijne dag.')+'</div>')+'</div>';
    // Taken van vandaag / open
    const open = (o.taken||[]).filter(t => !t.klaar);
    html += '<div class="card"><div class="k">'+T('pd.boer.taken','Taken')+' ('+open.length+')</div>'+
      (open.length ? open.map(t => '<div class="task"><span class="ic">'+((t.voor&&t.voor<vandaag)?'⏰':'📋')+'</span><div class="t"><b>'+esc(t.wat)+'</b><span>'+(t.waar?'📍 '+esc(t.waar):'')+(t.voor?' · '+esc(t.voor):'')+'</span></div><button class="abtn" data-btaak="'+t.id+'">'+T('pd.boer.klaar','Klaar')+'</button></div>').join('')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.boer.geentaak','Geen open taken.')+'</div>')+'</div>';
    // Percelen: oogsten en water geven
    const perc = (o.percelen||[]).filter(p => p.gewasLabel && p.fase !== 'geoogst');
    if (perc.length) html += '<div class="card"><div class="k">'+T('pd.boer.perc','Percelen')+'</div>'+
      perc.map(p => '<div class="task"><span class="ic">'+(p.fase==='te-oogsten'?'🌾':'🌱')+'</span><div class="t"><b>'+esc(p.naam)+' · '+esc(p.gewasLabel)+'</b><span>'+(p.fase==='te-oogsten'?T('pd.boer.oogstklaar','oogstklaar'):(p.restDagen+' '+T('pd.boer.dgn','dagen tot oogst')))+'</span></div>'+
        (p.fase==='te-oogsten' ? '<button class="abtn" data-boogst="'+p.id+'">'+T('pd.boer.oogsten','Oogst')+'</button>' : '<button class="abtn" data-bwater="'+p.id+'" style="background:var(--card2);color:var(--txt);border:1px solid var(--line);">💧</button>')+'</div>').join('')+'</div>';
    // Dieren: voeren
    const dr = (o.dieren||[]);
    if (dr.length) html += '<div class="card"><div class="k">'+T('pd.boer.dieren','Dieren voeren')+'</div>'+
      dr.map(d => { const gevoerd = d.laatsteVoer && d.laatsteVoer.slice(0,10)===vandaag;
        return '<div class="task"><span class="ic">'+(d.soort==='melkkoe'?'🐄':d.soort==='legkip'?'🐔':d.soort==='varken'?'🐖':d.soort==='geit'?'🐐':'🐑')+'</span><div class="t"><b>'+esc(d.soortLabel)+' × '+d.aantal+'</b><span>'+(d.stal?esc(d.stal)+' · ':'')+d.voerKgPerDag+' kg '+T('pd.boer.voer','voer')+(gevoerd?' · ✓ '+T('pd.boer.gevoerd','gevoerd'):'')+'</span></div>'+
        (gevoerd?'<span style="color:#7EE0A3;font-size:1.1rem;">✓</span>':'<button class="abtn" data-bvoer="'+d.id+'">🌾 '+T('pd.boer.voeren','Voeren')+'</button>')+'</div>'; }).join('')+'</div>';
    wrap.innerHTML = html;
    wrap.querySelectorAll('[data-btaak]').forEach(b => b.addEventListener('click', async () => { try { boerPdaToe(await API.call('/supplier/boerderij/taak/klaar', { id: b.dataset.btaak })); toast(T('pd.boer.klaarok','Taak afgerond.')); } catch(e){ toast(e.message); } }));
    wrap.querySelectorAll('[data-boogst]').forEach(b => b.addEventListener('click', async () => { try { const r = await API.call('/supplier/boerderij/oogst', { id: b.dataset.boogst }); toast(T('pd.boer.oogstok','Geoogst: ')+r.opbrengst+' '+r.eenheid); boerPdaToe(r); } catch(e){ toast(e.message); } }));
    wrap.querySelectorAll('[data-bwater]').forEach(b => b.addEventListener('click', async () => { try { boerPdaToe(await API.call('/supplier/boerderij/water', { id: b.dataset.bwater })); toast(T('pd.boer.waterok','Beregend.')); } catch(e){ toast(e.message); } }));
    wrap.querySelectorAll('[data-bvoer]').forEach(b => b.addEventListener('click', async () => { try { const r = await API.call('/supplier/boerderij/voer', { id: b.dataset.bvoer }); toast(T('pd.boer.voerok','Gevoerd.')); boerPdaToe(r); } catch(e){ toast(e.message); } }));
  }

  const heeftEntree = () => !!(state && state.supplier && (state.supplier.caps || []).includes('tickets'));
  async function laadEntree(){
    if (!heeftEntree()) return;
    try { pdProgramma = await API.call('/supplier/programma', {}); } catch(e){ pdProgramma = { datum: '', slots: [] }; }
    renderEntree();
  }
  function renderEntree(){
    const tabBtn = document.getElementById('tabEntree');
    if (tabBtn) tabBtn.style.display = heeftEntree() ? '' : 'none';
    const wrap = $('#entreeWrap');
    if (!wrap) return;
    if (!heeftEntree()){ wrap.innerHTML = ''; return; }
    if (!pdProgramma){ wrap.innerHTML = '<div class="card">\u2026</div>'; laadEntree(); return; }
    const slots = pdProgramma.slots || [];
    const totBinnen = slots.reduce((n, x) => n + x.binnen, 0);
    const totVerkocht = slots.reduce((n, x) => n + x.verkocht, 0);
    wrap.innerHTML =
      '<div class="card"><div class="k">'+T('pd.e.check','Entree-check')+'</div>'+
      '<div style="display:flex;gap:0.5rem;margin-top:0.55rem;">'+
      '<input id="pdCode" placeholder="'+T('pd.e.codeph','Code, bijv. K7M2PX')+'" autocapitalize="characters" style="flex:1;background:var(--card2,#191715);border:1px solid var(--line);border-radius:12px;padding:0.75rem 0.9rem;font-size:1.05rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--txt);outline:none;font-family:inherit;">'+
      '<button class="abtn" id="pdCheck">'+T('pd.e.binnen','Binnen')+'</button></div>'+
      '<div id="pdCheckUit" style="margin-top:0.5rem;font-size:0.84rem;color:var(--muted);"></div></div>'+
      // de kassa aan de deur: kaartje verkopen, contant of met RTG Pay, VIP kan
      (slots.length ? '<div class="card"><div class="k">'+T('pd.e.verkoop','Deurverkoop')+'</div>'+
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;">'+
      '<select id="pdVkSlot" style="flex:2;min-width:150px;background:var(--card2,#191715);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.6rem;color:var(--txt);font-family:inherit;">'+
        slots.map((x,i) => '<option value="'+i+'">'+x.tijd+' \u00B7 '+esc(x.naam)+' ('+(x.capaciteit-x.verkocht)+' '+T('pd.e.vrij','vrij')+')</option>').join('')+'</select>'+
      '<input id="pdVkPers" type="number" min="1" max="20" value="1" style="width:64px;background:var(--card2,#191715);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.6rem;color:var(--txt);font-family:inherit;" aria-label="personen">'+
      '<select id="pdVkSoort" style="flex:1;min-width:90px;background:var(--card2,#191715);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.6rem;color:var(--txt);font-family:inherit;"><option value="std">'+T('pd.e.std','Standaard')+'</option><option value="vip">\u2B50 VIP</option></select></div>'+
      '<div style="display:flex;gap:0.4rem;margin-top:0.45rem;">'+
      '<button class="abtn" data-pdvk="contant" style="flex:1;">\uD83D\uDCB6 '+T('pd.e.contant','Contant')+'</button>'+
      '<button class="abtn" data-pdvk="rtgpay" style="flex:1;">RTG Pay</button></div>'+
      '<div id="pdVkUit" style="margin-top:0.5rem;font-size:0.84rem;color:var(--muted);">'+(pdVkLaatst||'')+'</div></div>' : '')+
      '<div class="card"><div class="k">'+T('pd.e.prog','Programma vandaag')+' \u00B7 '+totBinnen+'/'+totVerkocht+' '+T('pd.e.binnen2','binnen')+'</div>'+
      (slots.length ? slots.map(x =>
        '<div class="task"><span class="ic">'+(x.binnen>=x.verkocht&&x.verkocht?'\u2705':'\uD83C\uDF9F\uFE0F')+'</span><div class="t"><b>'+x.tijd+' \u00B7 '+esc(x.naam)+'</b>'+
        '<span>'+x.binnen+'/'+x.verkocht+' '+T('pd.e.binnen2','binnen')+' \u00B7 '+T('pd.e.verkocht','verkocht')+' '+x.verkocht+'/'+x.capaciteit+'</span></div></div>'
      ).join('') : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.e.leeg','Vandaag geen tijdsloten.')+'</div>')+'</div>';
    const c = document.getElementById('pdCheck');
    if (c) c.addEventListener('click', async () => {
      const uit = document.getElementById('pdCheckUit');
      try {
        const r = await API.call('/supplier/ticket/checkin', { code: $('#pdCode').value });
        uit.innerHTML = '<b style="color:var(--green);">\u2705 '+(r.ticket.vip?'\u2B50 VIP \u00B7 ':'')+esc(r.ticket.codename)+' \u00B7 '+r.ticket.personen+'p \u00B7 '+esc(r.ticket.naam)+'</b>'+
          (r.ticket.zorg?'<div style="margin-top:0.3rem;color:#E2B93B;">\u26A0 '+esc(pkZorg(r.ticket.zorg))+'</div>':'');
        $('#pdCode').value = '';
        laadEntree();
      } catch(e){ uit.innerHTML = '<b style="color:#E36385;">\u26D4 '+esc(e.message)+'</b>'; }
    });
    // de deurverkoop: het kaartje is meteen betaald en de code kan naar binnen
    wrap.querySelectorAll('[data-pdvk]').forEach(b => b.addEventListener('click', async () => {
      const uit = document.getElementById('pdVkUit');
      const slot = slots[parseInt(($('#pdVkSlot')||{}).value, 10) || 0];
      if (!slot) return;
      const body = {
        activiteitId: slot.activiteitId, tijd: slot.tijd,
        personen: parseInt(($('#pdVkPers')||{}).value, 10) || 1,
        vip: ($('#pdVkSoort')||{}).value === 'vip',
        method: b.dataset.pdvk
      };
      if (body.method === 'rtgpay'){
        // tap to pay als het kan, met altijd de uitweg om de code te typen
        let code = null;
        if (window.TapPay && TapPay.kan() && window.confirm(T('pd.w.tapkeuze','Tap to pay: de klant tikt zijn toestel hiertegen. Liever de code typen (bijv. als NFC niet werkt)? Kies dan Annuleren.'))){
          toast('\uD83D\uDCF3 '+T('pd.w.tap','Tap to pay: laat de klant het toestel hiertegen houden...'));
          code = await TapPay.lees(12000);
          if (!code) toast(T('pd.w.tapmis','Geen tik ontvangen; typ de code van de klant.'));
        }
        if (!code){
          const c = window.prompt(T('pd.w.paycode','Betaalcode van de klant (uit de app):'));
          if (!c) return;
          code = c.trim().toUpperCase();
        }
        body.payCode = code;
        body.idem = 'deur-' + Date.now();
      }
      try {
        const r = await API.call('/supplier/ticket/deurverkoop', body);
        // de code blijft staan als het programma zich ververst
        pdVkLaatst = '<b style="color:var(--green);">\u2705 '+(r.ticket.vip?'\u2B50 VIP \u00B7 ':'')+r.ticket.personen+'p \u00B7 '+esc(r.ticket.naam)+' \u00B7 \u20AC '+r.ticket.total+'</b>'+
          '<div style="margin-top:0.35rem;font-size:1.3rem;letter-spacing:0.22em;font-weight:700;color:var(--gold);">'+esc(r.ticket.code)+'</div>'+
          '<div style="font-size:0.72rem;color:var(--soft);">'+T('pd.e.geefcode','Geef deze entreecode aan de gast.')+'</div>';
        uit.innerHTML = pdVkLaatst;
        laadEntree();
      } catch(e){ uit.innerHTML = '<b style="color:#E36385;">\u26D4 '+esc(e.message)+'</b>'; }
    }));
  }

  // ---- vaart (charter): de schipper handelt de charters van vandaag af ----
  let pdCharters = null;
  const heeftCharter = () => !!(state && state.supplier && (state.supplier.caps || []).includes('charter'));
  const VAART_ST = { 'aangevraagd':'klaar om uit te varen', 'lopend':'op zee', 'afgerond':'afgerond' };
  async function laadVaart(){
    if (!heeftCharter()) return;
    try { pdCharters = (await API.call('/supplier/charter/overzicht', {})).charters; } catch(e){ pdCharters = []; }
    renderVaart();
  }
  function renderVaart(){
    const tabBtn = document.getElementById('tabVaart');
    if (tabBtn) tabBtn.style.display = heeftCharter() ? '' : 'none';
    const wrap = $('#vaartWrap');
    if (!wrap) return;
    if (!heeftCharter()){ wrap.innerHTML = ''; return; }
    if (!pdCharters){ wrap.innerHTML = '<div class="card">…</div>'; laadVaart(); return; }
    wrap.innerHTML = pdCharters.length ? pdCharters.map(c => {
      let knop = '';
      if (c.status === 'aangevraagd') knop =
        '<button class="abtn ghost" data-cvfoto="'+c.ref+'" data-fase="voor">📷 '+T('pd.va.voor','Voor-foto')+' ('+c.fotosVoor+')</button> '+
        '<button class="abtn" data-cvst="'+c.ref+'" data-st="lopend">'+T('pd.va.uitvaren','Uitvaren')+'</button>';
      else if (c.status === 'lopend') knop =
        '<button class="abtn ghost" data-cvfoto="'+c.ref+'" data-fase="na">📷 '+T('pd.va.na','Na-foto')+' ('+c.fotosNa+')</button> '+
        '<button class="abtn" data-cvst="'+c.ref+'" data-st="afgerond">'+T('pd.va.terug','Teruggeven')+'</button>';
      return '<div class="card">'+
        (c.sos && c.sos.length ? '<div style="background:rgba(194,58,94,0.16);border:1px solid var(--burgundy,#C23A5E);border-radius:10px;padding:0.5rem 0.7rem;margin-bottom:0.5rem;font-size:0.82rem;">🚨 <b>SOS:</b> '+esc(c.sos[0].bericht)+
          (Number.isFinite(c.sos[0].lat)?' · <a style="color:var(--gold,#C99A2E);" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query='+c.sos[0].lat+','+c.sos[0].lng+'">'+T('pd.va.kaart','kaart')+'</a>':'')+
          ' <button class="abtn" data-cvsosok="'+c.ref+'" style="padding:0.15rem 0.7rem;">'+T('pd.va.sosok','Afgehandeld')+'</button></div>':'')+
        '<div class="k">'+esc(c.boot)+' · '+esc(c.type)+'</div>'+
        '<div style="font-size:0.85rem;margin-top:0.3rem;">'+esc(c.codename)+' · '+c.van+' → '+c.tot+' · '+(c.gasten?c.gasten+' '+T('pd.va.gasten','gasten')+' · ':'')+(c.metSkipper?'⚓ '+T('pd.va.metskipper','met schipper'):T('pd.va.bareboat','bareboat'))+' · '+T('pd.va.st.'+c.status, VAART_ST[c.status]||c.status)+'</div>'+
        (c.teruggave ? '<div style="font-size:0.8rem;margin-top:0.2rem;color:'+(c.teruggave.meerkosten>0?'var(--amber,#C99A2E)':'var(--green,#4C9A75)')+';">'+(c.teruggave.meerkosten>0?T('pd.va.meer','Meerkosten')+' '+eur(c.teruggave.meerkosten):'✓ '+T('pd.va.geenmeer','geen meerkosten'))+'</div>':'')+
        (knop?'<div style="margin-top:0.6rem;display:flex;gap:0.4rem;flex-wrap:wrap;">'+knop+'</div>':'')+
        '</div>';
    }).join('') : '<div class="card" style="text-align:center;color:var(--soft);font-size:0.85rem;">'+T('pd.va.geen','Geen charters vandaag.')+'</div>';
    wrap.querySelectorAll('[data-cvst]').forEach(b => b.addEventListener('click', async () => {
      const body = { ref: b.dataset.cvst, status: b.dataset.st };
      if (b.dataset.st === 'lopend'){
        const uren = prompt(T('pd.va.qurenstart','Motorurenstand bij uitvaren?')); if (uren == null) return;
        body.urenStart = Number(uren); body.brandstofStart = Number(prompt(T('pd.va.qbrandstart','Brandstof bij uitvaren in achtsten (8 = vol)?'), '8'));
      } else if (b.dataset.st === 'afgerond'){
        const uren = prompt(T('pd.va.qureneind','Motorurenstand bij teruggave?')); if (uren == null) return;
        body.urenEind = Number(uren); body.brandstofEind = Number(prompt(T('pd.va.qbrandeind','Brandstof bij teruggave in achtsten (8 = vol)?'), '8'));
      }
      try { await API.call('/supplier/charter/status', body); toast(T('pd.va.ok','Bijgewerkt.')); await laadVaart(); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-cvsosok]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/charter/sos-ok', { ref: b.dataset.cvsosok }); toast(T('pd.va.sosafg','SOS afgehandeld.')); await laadVaart(); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-cvfoto]').forEach(b => b.addEventListener('click', () => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment';
      inp.onchange = () => { const file = inp.files[0]; if (!file) return; const r = new FileReader();
        r.onload = () => { const img = new Image(); img.onload = async () => {
          const cv = document.createElement('canvas'); const sc = Math.min(1, 1000 / Math.max(img.width, img.height));
          cv.width = img.width * sc; cv.height = img.height * sc; cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          try { await API.call('/supplier/charter/foto', { ref: b.dataset.cvfoto, fase: b.dataset.fase, foto: cv.toDataURL('image/jpeg', 0.7) });
            toast(T('pd.va.fotook','De staat is vastgelegd.')); await laadVaart(); } catch(e){ toast(e.message); } };
          img.src = r.result; };
        r.readAsDataURL(file); };
      inp.click();
    }));
  }

  // ---- autoverkoop op de PDA: proefritten inplannen/rijden en auto's afleveren ----
  let pdVerkoop = null;
  const heeftVerkoop = () => !!(state && state.supplier && state.supplier.type === 'verhuur');
  async function laadVerkoop(){
    if (!heeftVerkoop()) return;
    try { pdVerkoop = await API.call('/supplier/verkoop/overzicht', {}); } catch(e){ pdVerkoop = { pda: [] }; }
    renderVerkoop();
  }
  function renderVerkoop(){
    const tabBtn = document.getElementById('tabVerkoop');
    if (tabBtn) tabBtn.style.display = (heeftVerkoop() && pdVerkoop && pdVerkoop.aan) ? '' : 'none';
    const wrap = $('#verkoopWrap'); if (!wrap) return;
    if (!heeftVerkoop()){ wrap.innerHTML = ''; return; }
    if (!pdVerkoop){ wrap.innerHTML = '<div class="card">…</div>'; laadVerkoop(); return; }
    const lijst = pdVerkoop.pda || [];
    wrap.innerHTML = lijst.length ? lijst.map(d => {
      const koop = d.soort === 'koop';
      const knop = koop
        ? '<button class="abtn" data-vkaf="'+d.ref+'">'+T('pd.vk.aflever','Afgeleverd')+'</button>'
        : '<button class="abtn" data-vkgereden="'+d.ref+'">'+T('pd.vk.gereden','Proefrit gereden')+'</button>';
      return '<div class="card"><div class="k">'+(koop?'🔑 ':'🚗 ')+esc(d.autoNaam)+'</div>'+
        '<div style="font-size:0.85rem;margin-top:0.3rem;">'+esc(d.codenaam)+' · '+(koop
          ? (T('pd.vk.aflevering','aflevering')+(d.concierge?' · '+T('pd.vk.concierge','concierge')+' '+esc(d.adres||''):' · '+T('pd.vk.ophalen','ophalen'))+' · '+eur(d.prijs||0))
          : (T('pd.vk.proefrit','proefrit')+(d.moment?' · '+esc(d.moment):'')))+'</div>'+
        '<div style="margin-top:0.6rem;">'+knop+'</div></div>';
    }).join('') : '<div class="card" style="text-align:center;color:var(--soft);font-size:0.85rem;">'+T('pd.vk.geen','Niets in te plannen of af te leveren.')+'</div>';
    wrap.querySelectorAll('[data-vkgereden]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/verkoop/deal', { ref:b.dataset.vkgereden, actie:'gereden' }); toast(T('pd.vk.ok','Bijgewerkt.')); await laadVerkoop(); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-vkaf]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/verkoop/deal', { ref:b.dataset.vkaf, actie:'afgeleverd' }); toast('✅ '+T('pd.vk.afgeleverd','Afgeleverd.')); await laadVerkoop(); } catch(e){ toast(e.message); }
    }));
  }

  /* ---- PDA beveiliging: mijn dienst, inklokken, rondes, incidenten, SOS ---- */
  let pdBev = null;
  const heeftBeveiliging = () => !!(state && state.supplier && state.supplier.type === 'beveiliging');
  function bevPos(cb){ // GPS met korte time-out en veilige terugval
    let klaar = false; const fire = (lat, lng) => { if (klaar) return; klaar = true; cb(lat, lng); };
    if (navigator.geolocation){
      navigator.geolocation.getCurrentPosition(p => fire(p.coords.latitude, p.coords.longitude), () => fire(undefined, undefined), { timeout: 2500 });
      setTimeout(() => fire(undefined, undefined), 3000);
    } else fire(undefined, undefined);
  }
  async function laadBevPda(){
    if (!heeftBeveiliging()) return;
    try { pdBev = await API.call('/supplier/beveiliging/pda/diensten', {}); } catch(e){ pdBev = { diensten: [], ronde: null }; }
    renderBevPda();
  }
  function renderBevPda(){
    const tabBtn = document.getElementById('tabBevPda');
    if (tabBtn) tabBtn.style.display = heeftBeveiliging() ? '' : 'none';
    const wrap = $('#bevPdaWrap'); if (!wrap) return;
    if (!heeftBeveiliging()){ wrap.innerHTML = ''; return; }
    if (!pdBev){ wrap.innerHTML = '<div class="card">…</div>'; laadBevPda(); return; }
    const ds = pdBev.diensten || [];
    let h = '';
    // 1) SOS-noodknop, altijd bovenaan
    h += '<button class="abtn" id="bevSosBtn" style="width:100%;background:var(--rood);color:#fff;font-size:1rem;padding:0.8rem;margin-bottom:0.8rem;">🆘 '+T('pd.bev.sos','SOS · noodknop')+'</button>';
    // 2) lopende ronde
    if (pdBev.ronde){
      const r = pdBev.ronde;
      h += '<div class="card"><div class="k">🚶 '+T('pd.bev.ronde','Patrouilleronde')+' · '+esc(r.post)+'</div>'+
        '<div style="font-size:0.82rem;margin:0.3rem 0;">'+(r.checkpoints.length? r.checkpoints.map(c=>'✓ '+esc(c.naam)).join(' · ') : T('pd.bev.nogcp','Nog geen checkpoints.'))+'</div>'+
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;"><input id="bevCpNaam" placeholder="'+T('pd.bev.cpnaam','checkpoint')+'" style="flex:1;min-width:7rem;">'+
        '<button class="abtn" id="bevCpAdd">'+T('pd.bev.cpadd','Checkpoint')+'</button>'+
        '<button class="abtn ghost" id="bevRondeKlaar">'+T('pd.bev.rondeklaar','Ronde klaar')+'</button></div></div>';
    }
    // 3) mijn diensten
    h += '<div class="card"><div class="k">'+T('pd.bev.diensten','Mijn diensten')+'</div>';
    h += ds.length ? ds.map(d => {
      const ingeklokt = d.status === 'ingeklokt';
      return '<div class="task"><span class="ic">'+(ingeklokt?'🟢':'📋')+'</span><div class="t"><b>'+esc(d.post)+'</b><span>'+esc(d.datum)+' · '+esc(d.shift)+(d.klant?' · '+esc(d.klant):'')+'</span></div>'+
        (d.status==='afgerond' ? '<span style="font-size:0.72rem;color:var(--soft);">'+T('pd.bev.klaar','afgerond')+'</span>'
          : ingeklokt ? '<button class="abtn ghost" data-bevuit="'+d.id+'">'+T('pd.bev.uit','Uitklokken')+'</button>'
          : '<button class="abtn" data-bevin="'+d.id+'">'+T('pd.bev.in','Inklokken')+'</button>')+'</div>'+
        (ingeklokt && !pdBev.ronde ? '<div style="text-align:right;margin-top:-0.3rem;"><button class="abtn ghost" data-bevronde="'+d.postId+'" style="font-size:0.7rem;">🚶 '+T('pd.bev.startronde','Start ronde')+'</button></div>' : '');
    }).join('') : '<div style="font-size:0.85rem;color:var(--soft);">'+T('pd.bev.geendienst','Geen diensten ingepland.')+'</div>';
    h += '</div>';
    // 4) incident melden
    h += '<div class="card"><div class="k">📋 '+T('pd.bev.incident','Incident melden')+'</div>'+
      '<input id="bevIncSoort" placeholder="'+T('pd.bev.incsoort','soort (bijv. inbraakpoging)')+'" style="width:100%;margin-bottom:0.4rem;">'+
      '<select id="bevIncErnst" style="width:100%;margin-bottom:0.4rem;"><option value="laag">'+T('pd.bev.laag','laag')+'</option><option value="midden" selected>'+T('pd.bev.midden','midden')+'</option><option value="hoog">'+T('pd.bev.hoog','hoog')+'</option><option value="kritiek">'+T('pd.bev.kritiek','kritiek')+'</option></select>'+
      '<textarea id="bevIncTekst" placeholder="'+T('pd.bev.inctekst','wat is er gebeurd?')+'" style="width:100%;min-height:3rem;margin-bottom:0.4rem;"></textarea>'+
      '<button class="abtn" id="bevIncSend" style="width:100%;">'+T('pd.bev.incsend','Melden')+'</button></div>';
    wrap.innerHTML = h;
    // bindingen
    const bind = (id, fn) => { const e2 = document.getElementById(id); if (e2) e2.addEventListener('click', fn); };
    bind('bevSosBtn', () => { if (!confirm(T('pd.bev.sosbev','SOS versturen? Het team en RTG-kantoor worden direct gealarmeerd.'))) return;
      bevPos(async (lat, lng) => { try { await API.call('/supplier/beveiliging/pda/sos', { lat, lng }); toast('🆘 '+T('pd.bev.sosok','SOS verstuurd. Bijstand onderweg.')); } catch(e){ toast(e.message); } }); });
    wrap.querySelectorAll('[data-bevin]').forEach(b => b.addEventListener('click', () => {
      bevPos(async (lat, lng) => { try { await API.call('/supplier/beveiliging/pda/inklok', { id:b.dataset.bevin, lat, lng }); toast('🟢 '+T('pd.bev.inok','Ingeklokt op post.')); await laadBevPda(); } catch(e){ toast(e.message); } });
    }));
    wrap.querySelectorAll('[data-bevuit]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/beveiliging/pda/uitklok', { id:b.dataset.bevuit }); toast(T('pd.bev.uitok','Uitgeklokt.')); await laadBevPda(); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-bevronde]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/beveiliging/pda/ronde/start', { postId:b.dataset.bevronde }); await laadBevPda(); } catch(e){ toast(e.message); }
    }));
    bind('bevCpAdd', () => { const naam = ($('#bevCpNaam')||{}).value || '';
      bevPos(async (lat, lng) => { try { await API.call('/supplier/beveiliging/pda/ronde/checkpoint', { id: pdBev.ronde.id, naam, lat, lng }); await laadBevPda(); } catch(e){ toast(e.message); } }); });
    bind('bevRondeKlaar', async () => { try { await API.call('/supplier/beveiliging/pda/ronde/klaar', { id: pdBev.ronde.id }); toast(T('pd.bev.rondeok','Ronde afgerond.')); await laadBevPda(); } catch(e){ toast(e.message); } });
    bind('bevIncSend', () => {
      const tekst = ($('#bevIncTekst')||{}).value || '';
      if (!tekst.trim()) { toast(T('pd.bev.incleeg','Beschrijf het incident.')); return; }
      const soort = ($('#bevIncSoort')||{}).value || '';
      const ernst = ($('#bevIncErnst')||{}).value || 'midden';
      const post = ds[0] ? ds[0].post : '';
      const postId = ds.find(d => d.status==='ingeklokt') ? ds.find(d => d.status==='ingeklokt').postId : (ds[0]||{}).postId;
      bevPos(async (lat, lng) => { try { await API.call('/supplier/beveiliging/pda/incident', { soort, ernst, tekst, post, postId, lat, lng }); toast('📋 '+T('pd.bev.incok','Incident gemeld.')); await laadBevPda(); } catch(e){ toast(e.message); } });
    });
  }

  function renderTeam(){
    const team = state.team || [];
    const act = (state.activity || []).slice(0, 10);
    const staff = (state.staff || []).filter(m => m.id !== me.staffId);
    $('#teamWrap').innerHTML =
      (staff.length ? '<div class="card"><div class="k" style="display:flex;justify-content:space-between;align-items:center;">'+T('pd.buzzh','Collega oproepen')+'<span style="display:flex;gap:0.4rem;"><button class="abtn" id="teamCall" style="font-size:0.66rem;">📹 '+T('pd.teamcall','Teamcall')+'</button><button class="abtn ghost" id="buzzAll" style="font-size:0.66rem;">📢 '+T('pd.buzzall','Iedereen')+'</button></span></div>'+
        staff.map(m=>{
          const in2 = !!(state.klok && (state.klok.binnen||[]).includes(m.name));
          return '<div class="task"><span class="ic">'+(m.role==='manager'?'⭐':'👤')+'</span><div class="t"><b>'+esc(m.name)+'</b><span>'+(m.role==='manager'?'Manager':T('pd.staff','Medewerker'))+(in2?' · 🟢 '+T('pd.ingeklokt','ingeklokt'):'')+'</span></div>'+
            (in2?'<button class="abtn" data-belm="'+m.id+'" data-naam="'+esc(m.name)+'">📞</button>':'')+
            '<button class="abtn ghost" data-dmm="'+m.id+'" data-naam="'+esc(m.name)+'" style="position:relative;">💬<i data-dmbadge="'+m.id+'" style="display:none;position:absolute;top:-6px;right:-6px;background:#C23A5E;color:#fff;border-radius:999px;font-style:normal;font-size:0.6rem;min-width:1.1rem;height:1.1rem;line-height:1.1rem;text-align:center;"></i></button>'+
            '<button class="abtn ghost" data-buzz="'+m.id+'">📳 '+T('pd.buzz','Tril')+'</button></div>';
        }).join('')+'</div>' : '')+
      '<div class="card"><div class="k">'+T('pd.chat','Teamchat')+'</div><div class="chat">'+
      (team.length ? team.map(m=>'<div class="msg '+(m.who===me.name?'me':'other')+'"><span class="who">'+esc(m.who)+'</span>'+
        (m.audio?'<audio controls src="'+m.audio+'" style="width:190px;max-width:100%;height:34px;"></audio>':esc(m.text))+'</div>').join('') : '<div style="font-size:0.8rem;color:var(--soft);">'+T('pd.nochat','Nog geen berichten.')+'</div>')+
      '</div><div class="compose"><input id="tmMsg" placeholder="'+T('pd.msgph','Bericht aan het team')+'"><button id="tmSend">'+T('pd.send','Stuur')+'</button></div></div>'+
      '<div class="card"><div class="k">'+T('pd.activity','Wie deed wat')+'</div>'+
      (act.length ? act.map(e=>'<div class="act"><b>'+esc(e.who)+'</b><span>'+esc(e.text)+'</span><time>'+timeAgo(e.at)+'</time></div>').join('') : '<div style="font-size:0.8rem;color:var(--soft);padding:0.4rem 0;">'+T('pd.noact','Nog geen activiteit.')+'</div>')+'</div>'+
      // Aparte ruimte: het personeelsnetwerk met andere zaken (met toestemming).
      '<div class="card"><div class="k">'+T('pd.net','Netwerk met andere zaken')+'</div>'+
      '<div style="font-size:0.72rem;color:var(--soft);margin-bottom:0.4rem;">'+T('pd.net.sub','Aparte ruimte. Alleen zaken die uw manager heeft verbonden.')+'</div>'+
      (netwerk.length ? netwerk.map(v => {
        if (v.status==='akkoord') return '<div class="task"><span class="ic">🤝</span><div class="t"><b>'+esc(v.naam)+'</b><span>'+T('pd.net.open','tik om te chatten')+'</span></div><button class="abtn ghost" data-netopen="'+v.code+'">💬</button></div>';
        if (v.inkomend) return '<div class="task"><span class="ic">📥</span><div class="t"><b>'+esc(v.naam)+'</b><span>'+T('pd.net.inc','wil verbinden')+'</span></div>'+(me.role==='manager'?'<button class="abtn" data-netja="'+v.code+'">'+T('pd.accept','Akkoord')+'</button>':'<span style="font-size:0.7rem;color:var(--soft);">'+T('pd.net.mgr','manager beslist')+'</span>')+'</div>';
        return '<div class="task"><span class="ic">📤</span><div class="t"><b>'+esc(v.naam)+'</b><span>'+T('pd.net.wait','wacht op akkoord')+'</span></div></div>';
      }).join('') : '<div style="font-size:0.8rem;color:var(--soft);">'+T('pd.net.none','Nog geen verbindingen.')+'</div>')+
      (me.role==='manager' ? '<div class="compose" style="margin-top:0.5rem;"><input id="netCode" placeholder="'+T('pd.net.code','Bedrijfscode')+'" style="text-transform:uppercase;"><button id="netAdd">'+T('pd.net.connect','Verbind')+'</button></div>' : '')+
      '<div id="netChat"></div></div>';
    const send = async () => {
      const inp = $('#tmMsg'); const text = (inp.value||'').trim(); if (!text) return;
      inp.value = '';
      try { await API.call('/supplier/team/message', { text }); await refresh(); openTab('team'); } catch(e){ toast(e.message); }
    };
    $('#tmSend').addEventListener('click', send);
    $('#tmMsg').addEventListener('keydown', e => { if (e.key==='Enter') send(); });
    const tc = document.getElementById('teamCall'); if (tc) tc.addEventListener('click', () => window.TeamCall && TeamCall.groep());
    const ba = document.getElementById('buzzAll'); if (ba) ba.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/team/buzz', { all: true }); toast('📢 '+T('pd.allbuzzed','Hele team opgeroepen')+' ('+d.reached+').'); }
      catch(e){ toast(e.message); }
    });
    document.querySelectorAll('[data-belm]').forEach(b => b.addEventListener('click', () => window.TeamCall && TeamCall.bel(parseInt(b.dataset.belm, 10), b.dataset.naam)));
    document.querySelectorAll('[data-dmm]').forEach(b => b.addEventListener('click', () => window.CollegaChat && CollegaChat.open(parseInt(b.dataset.dmm, 10), b.dataset.naam)));
    if (window.CollegaChat) CollegaChat.badges();
    document.querySelectorAll('[data-buzz]').forEach(b => b.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/team/buzz', { staffId: Number(b.dataset.buzz) });
        toast(d.reached ? '📳 '+d.name+' '+T('pd.buzzed','wordt opgeroepen.') : d.name+' '+T('pd.buzzoff','heeft de app nu niet open.')); }
      catch(e){ toast(e.message); }
    }));
    // personeelsnetwerk: verbinden, goedkeuren en chatten in de aparte ruimte
    const na = document.getElementById('netAdd');
    if (na) na.addEventListener('click', async () => {
      const c = (document.getElementById('netCode').value||'').trim().toUpperCase(); if (!c) return;
      try { const d = await API.call('/supplier/net/verzoek', { code:c }); toast(d.status==='akkoord'?T('pd.net.linked','Verbonden.'):T('pd.net.sent','Verzoek verstuurd.')); await refresh(); openTab('team'); } catch(e){ toast(e.message); }
    });
    document.querySelectorAll('[data-netja]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/net/beslis', { code:b.dataset.netja, actie:'akkoord' }); toast(T('pd.net.linked','Verbonden.')); await refresh(); openTab('team'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-netopen]').forEach(b => b.addEventListener('click', async () => {
      netOpen = b.dataset.netopen;
      try { netBerichten = (await API.call('/supplier/net/gesprek', { code:netOpen })).berichten || []; } catch(e){ netBerichten = []; }
      renderNetChat();
    }));
    renderNetChat();
  }
  let netOpen = null, netBerichten = [];
  function renderNetChat(){
    const box = document.getElementById('netChat'); if (!box) return;
    if (!netOpen){ box.innerHTML = ''; return; }
    const naam = (netwerk.find(v => v.code === netOpen) || {}).naam || netOpen;
    box.innerHTML = '<div class="k" style="margin-top:0.7rem;">'+esc(naam)+'</div><div class="chat">'+
      (netBerichten.length ? netBerichten.map(m => '<div class="msg '+(m.code===code?'me':'other')+'"><span class="who">'+esc(m.naam+' · '+m.door)+'</span>'+esc(m.tekst)+'</div>').join('')
        : '<div style="font-size:0.8rem;color:var(--soft);">'+T('pd.net.nomsg','Nog geen berichten.')+'</div>')+
      '</div><div class="compose"><input id="netMsg" placeholder="'+T('pd.net.msgph','Bericht')+'"><button id="netSend">'+T('pd.send','Stuur')+'</button></div>';
    const doSend = async () => {
      const i = document.getElementById('netMsg'); const t = (i.value||'').trim(); if (!t) return; i.value = '';
      try { await API.call('/supplier/net/bericht', { code:netOpen, tekst:t }); netBerichten = (await API.call('/supplier/net/gesprek', { code:netOpen })).berichten || []; renderNetChat(); } catch(e){ toast(e.message); }
    };
    document.getElementById('netSend').addEventListener('click', doSend);
    document.getElementById('netMsg').addEventListener('keydown', e => { if (e.key==='Enter') doSend(); });
  }

  // opgeroepen worden: trilscherm
  function showBuzz(from){
    if (navigator.vibrate) navigator.vibrate([300,120,300,120,600]);
    let el = document.getElementById('buzzOverlay');
    if (!el){
      el = document.createElement('div');
      el.id = 'buzzOverlay';
      document.getElementById('shell').appendChild(el);
      el.addEventListener('click', () => el.classList.remove('on'));
    }
    el.innerHTML = '<div class="bz"><div class="bz-ic">📳</div><b>'+esc(from)+'</b><span>'+T('pd.buzzcalls','roept u op')+'</span><i>'+T('pd.buzzclose','Tik om te bevestigen')+'</i></div>';
    el.classList.add('on');
    setTimeout(() => el.classList.remove('on'), 8000);
  }

  function showAlarm(d){
    if (navigator.vibrate) navigator.vibrate([500,150,500,150,800]);
    let el = document.getElementById('alarmOverlay');
    if (!el){
      el = document.createElement('div');
      el.id = 'alarmOverlay';
      document.getElementById('shell').appendChild(el);
      el.addEventListener('click', () => el.classList.remove('on'));
    }
    const locTxt = d.loc ? (d.label ? d.label + ' · ' : '') + d.loc.lat.toFixed(4) + ', ' + d.loc.lng.toFixed(4) : T('pd.noloc','locatie onbekend');
    el.innerHTML = '<div class="bz"><div class="bz-ic">🚨</div><b>'+esc(d.from)+'</b><span>'+(d.note?esc(d.note):T('pd.needs','heeft direct assistentie nodig'))+'</span>'+
      '<span style="margin-top:0.6rem;font-size:0.8rem;">📍 '+esc(locTxt)+'</span><i>'+T('pd.buzzclose','Tik om te bevestigen')+'</i></div>';
    el.classList.add('on');
  }

  // SOS en EHBO-alarm: locatie meesturen als die er is, direct het hele bedrijf
  // alarmeren. Een noodknop mag nooit blijven hangen: als de locatievraag niet
  // (op tijd) beantwoord wordt, gaat het alarm zonder locatie de deur uit.
  async function sendSOS(note, melding){
    let klaar = false;
    const fire = async (lat, lng) => {
      if (klaar) return;
      klaar = true;
      try { await API.call('/supplier/security', { lat, lng, note: note || '' }); toast(melding || ('🚨 '+T('pd.sossent','Noodoproep verstuurd. Het team en RTG zijn gealarmeerd.'))); }
      catch(e){ toast(e.message); }
    };
    if (navigator.geolocation){
      navigator.geolocation.getCurrentPosition(
        pos => fire(pos.coords.latitude, pos.coords.longitude),
        () => fire(undefined, undefined),
        { timeout: 2500 }
      );
      setTimeout(() => fire(undefined, undefined), 3200);
    } else fire(undefined, undefined);
  }

  /* ---------- de zorgbalie: de behandelaar-agenda (spa of kliniek) ----------
     Alleen zaken die als zorgaanbieder gekoppeld zijn (bijv. Zenith, Clara)
     krijgen deze tab; de agenda toont per behandelaar wie er komt, met de
     zorgcontext (allergenen, intake) die het lid met toestemming deelt. */
  let zbData = null, zbDatum = null;
  async function laadZorgbalie(){
    if (!API.token) return;
    try { zbData = await API.call('/supplier/care/agenda', zbDatum ? { datum: zbDatum } : {}); }
    catch(e){ zbData = null; }
    renderZorgbalie();
  }
  function renderZorgbalie(){
    const tabBtn = document.getElementById('tabZorgbalie');
    if (tabBtn) tabBtn.style.display = zbData ? '' : 'none';
    const wrap = $('#zorgbalieWrap');
    if (!wrap) return;
    if (!zbData){ wrap.innerHTML = ''; return; }
    const dagen = [];
    for (let i = 0; i < 7; i++){
      const dt = new Date(Date.now() + i * 86400000).toISOString().slice(0, 10);
      const aan = dt === zbData.datum;
      dagen.push('<button class="abtn ghost" data-zbdag="'+dt+'" style="padding:0.4rem 0.7rem;'+(aan?'border-color:var(--gold);color:var(--gold);':'')+'"'+(aan?' aria-current="date"':'')+'>'+
        (i===0 ? T('pd.zb.vandaag','vandaag') : dt.slice(8)+'/'+dt.slice(5,7))+'</button>');
    }
    const perBehandelaar = (zbData.behandelaars || []).map(b => {
      const eigen = (zbData.afspraken || []).filter(a => a.behandelaarId === b.id);
      return '<div class="card"><div class="k">'+esc(b.naam)+' · '+esc(b.functie)+'</div>'+
        (eigen.length ? eigen.map(a =>
          '<div class="task"><span class="ic">'+(a.soort==='medisch'?'🩺':'🧖')+'</span><div class="t">'+
            '<b style="font-variant-numeric:tabular-nums;">'+esc(a.tijd)+' · '+esc(a.behandelingNaam)+'</b>'+
            '<span>'+T('pd.zb.gast','Gast')+': '+esc(a.codenaam || '')+' · '+a.duurMin+' min · '+eur(a.prijs)+'</span>'+
            (a.zorg ? '<span style="display:block;color:#E2B93B;">⚠ '+esc(pkZorg(a.zorg))+'</span>' : '')+
            (a.intake ? '<span style="display:block;color:#E2B93B;">🩺 '+esc(a.intake)+'</span>' : '')+
          '</div>'+
          (a.status === 'afgerond' ? '<span class="pill g">'+T('pd.zb.klaar','Afgerond')+'</span>'
            : '<button class="abtn" data-zbklaar="'+esc(a.ref)+'">'+T('pd.zb.afronden','Afronden')+'</button>')+
          '</div>').join('')
        : '<div style="margin-top:0.5rem;color:var(--soft);font-size:0.8rem;">'+T('pd.zb.leeg','Geen afspraken op deze dag.')+'</div>')+
      '</div>';
    }).join('');
    wrap.innerHTML = '<div class="card"><div class="k">'+esc(zbData.aanbieder || '')+'</div>'+
      '<div class="row" style="flex-wrap:wrap;margin-top:0.5rem;">'+dagen.join('')+'</div></div>' + perBehandelaar;
    wrap.querySelectorAll('[data-zbdag]').forEach(b => b.addEventListener('click', () => { zbDatum = b.dataset.zbdag; laadZorgbalie(); }));
    wrap.querySelectorAll('[data-zbklaar]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/care/afronden', { ref: b.dataset.zbklaar }); toast(T('pd.zb.klaar','Afgerond') + ' ✅'); laadZorgbalie(); }
      catch(e){ toast(e.message); }
    }));
  }

  function openTab(tab, focusView){
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.dataset.view===tab));
    document.querySelectorAll('.tabbar button').forEach(b => {
      const on = b.dataset.tab===tab;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); // schermlezer meldt de actieve tab
    });
    $('#content').scrollTop = 0;
    // Alleen bij een echte klik de focus naar de nieuwe weergave verplaatsen, zodat
    // toetsenbord- en schermlezergebruikers meelopen (niet bij programmatische wissels).
    if (focusView){
      const v = document.querySelector('.view[data-view="'+tab+'"]');
      if (v){ v.setAttribute('tabindex','-1'); v.focus({ preventScroll: true }); }
    }
  }
  document.querySelectorAll('.tabbar button').forEach(b => b.addEventListener('click', () => openTab(b.dataset.tab, true)));
  $('#switchBtn').addEventListener('click', () => {
    try { localStorage.removeItem('rtg_pda_token'); localStorage.removeItem('rtg_pda_code'); } catch(e){}
    location.reload();
  });
  $('#sosBtn').addEventListener('click', () => sendSOS());

  function startStream(){
    if (!window.EventSource) return;
    try {
      const src = new EventSource('/api/supplier/stream?token='+encodeURIComponent(API.token));
      src.addEventListener('sync', () => { refresh(); if (heeftRetail() && pdRetail) laadWinkel(); if (heeftCharter() && pdCharters) laadVaart(); if (heeftBeveiliging()) laadBevPda(); if (zbData) laadZorgbalie(); });
      // de keuken praat met de bediening: bon compleet op de pas -> belletje op de PDA,
      // maar alleen op toestellen waar de pas-bel aanstaat (de gekozen personen)
      src.addEventListener('pas', e => {
        if (!pdaPasBel || !ikBinnen()) return;
        try {
          const d = JSON.parse(e.data || '{}');
          toast('🛎️ ' + T('pas.klaar', 'Op de pas: bon ') + d.pickup + (d.table ? ' (' + d.table + ')' : ''));
          if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
        } catch(err){}
      });
      src.addEventListener('buzz', e => { const d=JSON.parse(e.data); showBuzz(d.from); });
      src.addEventListener('alarm', e => { const d=JSON.parse(e.data); if (d.from !== me.name) showAlarm(d); });
      src.addEventListener('notify', () => refresh());
      // echt (video)bellen: alle WebRTC-signalen gaan naar de teamcall-module
      if (window.TeamCall) src.addEventListener('rtc', TeamCall.event);
      if (window.CollegaChat) src.addEventListener('dm', CollegaChat.event);
    } catch(e){}
  }

  window.addEventListener('rtglang', () => { if (state) renderAll(); else stepStart(); gateTik(); });
  if ('serviceWorker' in navigator && (location.protocol==='http:'||location.protocol==='https:')) navigator.serviceWorker.register('/sw.js').catch(()=>{});
  gateTik(); setInterval(gateTik, 15000);
  stepStart();
  // het Werk-OS: springboard, dock, klok en Cmd+K, precies als op een telefoon.
  // RTG Eye (de camerabril: voertuigschouw + werkvloerregister) staat als
  // eigen app op het springboard; de knop leeft in een onzichtbare houder.
  const extraHouder = document.createElement('div');
  extraHouder.id = 'pdaExtra'; extraHouder.style.display = 'none';
  const oogKnop = document.createElement('button');
  oogKnop.type = 'button'; oogKnop.className = 'pda-app';
  oogKnop.innerHTML = '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/></svg>RTG Eye';
  oogKnop.addEventListener('click', () => { location.href = '/apps/oog.html'; });
  extraHouder.appendChild(oogKnop);
  document.body.appendChild(extraHouder);
  if (window.WerkOS) WerkOS.koppel({ thuisTab: 'vandaag', dock: ['rooster', 'taken', 'team', 'hulp'],
    extra: { houder: '#pdaExtra', knop: '.pda-app' } });
  restoreSession();
})();
