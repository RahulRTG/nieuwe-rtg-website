(function(){
  const $ = s => document.querySelector(s);
  const T = (k, nl) => (window.RTGi18n ? RTGi18n.t(k, nl) : nl);
  const lang = () => (window.RTGi18n ? RTGi18n.lang : 'nl');
  const nfmt = n => Number(n).toLocaleString(lang() === 'en' ? 'en-US' : 'nl-NL');
  const eur = n => '€ ' + nfmt(n);
  const STATUS = { 'wacht-op-betaling':'awaiting payment', 'nieuw':'new', 'in bereiding':'in preparation', 'klaar':'ready', 'geserveerd':'served', 'geweigerd':'declined', 'terugbetaald':'refunded' };
  const tStatus = s => (lang() === 'en' ? (STATUS[s] || s) : s);
  const LBL = { 'Bevestigd':'Confirmed', 'Wacht op betaling':'Awaiting payment', 'In aanvraag':'Requested', 'Betaald':'Paid' };
  const tLbl = s => (lang() === 'en' ? (LBL[s] || s) : s);
  const ALG = { 'vis':'fish', 'soja':'soy', 'sesam':'sesame', 'gluten':'gluten', 'noten':'nuts', 'schaaldieren':'shellfish', 'ei':'egg', 'melk':'milk', 'pinda':'peanut', 'selderij':'celery', 'mosterd':'mustard' };
  const tAlg = a => (lang() === 'en' ? (ALG[a] || a) : a);
  const TYPELABEL = { 'Hotel':'Hotel', 'Restaurant':'Restaurant', 'Bar':'Bar', 'Taxi':'Taxi', 'Privéjet':'Private jet', 'Appartement':'Apartment', 'Club':'Club' };
  const tType = s => (lang() === 'en' ? (TYPELABEL[s] || s) : s);
  const LANGNAME = { nl: { nl:'Nederlands', en:'Engels' }, en: { nl:'Dutch', en:'English' } };
  const langName = code => (LANGNAME[lang()] || LANGNAME.nl)[code] || code;
  const escAttr = s => String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  // Een bericht dat in een andere taal is geschreven, wordt automatisch voor de
  // lezer vertaald (met knop om het origineel te tonen).
  function msgHTML(text, olang){
    return '<span class="msg" data-olang="'+(olang||'nl')+'" data-otext="'+escAttr(text)+'">' +
      '<span class="msg-t">'+String(text).replace(/</g,'&lt;')+'</span>' +
      '<span class="msg-note"></span></span>';
  }
  async function hydrateMsgs(root){
    const to = lang();
    for (const el of root.querySelectorAll('.msg')){
      const from = el.dataset.olang || 'nl';
      if (from === to || el.dataset.done) continue;
      el.dataset.done = '1';
      if (!API.live) continue;
      try {
        const r = await API.call('/translate', { text: el.dataset.otext, to, from });
        if (r && r.translated){
          const tEl = el.querySelector('.msg-t'); tEl.textContent = r.text;
          const note = el.querySelector('.msg-note');
          note.innerHTML = '<button class="msg-toggle" type="button"></button>';
          const btn = note.querySelector('.msg-toggle');
          const setLabel = shown => btn.textContent = shown==='t'
            ? '🌐 ' + T('msg.from','vertaald uit') + ' ' + langName(from) + ' · ' + T('msg.orig','toon origineel')
            : '🌐 ' + T('msg.showtrans','toon vertaling');
          let shown = 't'; setLabel(shown);
          btn.addEventListener('click', () => {
            shown = shown==='t' ? 'o' : 't';
            tEl.textContent = shown==='t' ? r.text : el.dataset.otext;
            setLabel(shown);
          });
        }
      } catch (e) {}
    }
  }

  /* ---------- lokale demo-data (fallback zonder backend) ---------- */

  const PERSONAS = {
    rtg:       {name:'K. Kiss',    full:'Katja Kiss',    since:'Maart 2026',    number:'RTG · 2026 · 8841', codename:'Amberen Vos',      tier:'rtg'},
    lifestyle: {name:'F. Johanna', full:'Fleur Johanna', since:'Augustus 2025', number:'LSP · 2025 · 0217', codename:'Gouden Ibis',      tier:'lifestyle'},
    business:  {name:'R. Imran',   full:'Rahul Imran',   since:'November 2025', number:'BSP · 2025 · 1104', codename:'Noordelijke Ster', tier:'business'}
  };
  const TIER_LABEL = {rtg:'RTG Pass', lifestyle:'Lifestyle Pass', business:'Business Pass', partner:'RTG-partner'};

  let user = null;
  let invoices = [
    {id:'RTG-2026-0158', desc:'Ibiza, Aguamarina, 3 nachten', netto:1740, bijdrage:150, status:'open', date:'Vervalt 28 juli 2026'},
    {id:'RTG-2026-0141', desc:'Villa Bahia Ibiza, Cala Jondal, 4 nachten', netto:2240, bijdrage:180, status:'open', date:'Vervalt 15 augustus 2026'},
    {id:'RTG-2026-0093', desc:'Privejet Schiphol - Ibiza (retour, gedeeld)', netto:1460, bijdrage:120, status:'paid', date:'Betaald op 2 mei 2026'},
    {id:'RTG-2025-0871', desc:'Jaarbijdrage lidmaatschap 2026', netto:0, bijdrage:480, status:'paid', date:'Betaald op 4 januari 2026'}
  ];
  let trip = {
    dest:'Ibiza', dates:'18 - 25 juli 2026', days:7,
    items:[
      {when:'18 jul', title:'KLM KL1263, Amsterdam Schiphol → Ibiza', sub:'Economy comfort · 2 personen', status:'paid', label:'Bevestigd'},
      {when:'18 jul', title:'Privétransfer luchthaven → Aguamarina', sub:'Chauffeur bij aankomsthal', status:'paid', label:'Bevestigd'},
      {when:'18-21 jul', title:'Aguamarina Ibiza, Sea-view suite', sub:'3 nachten, late check-out', status:'open', label:'Wacht op betaling', invoiceId:'RTG-2026-0158'},
      {when:'19 jul', title:'Diner, Sal de Mar', sub:'Chef-menu · 21:00 uur', status:'req', label:'In aanvraag'},
      {when:'20 jul', title:'Privéboot naar Formentera', sub:'Met de groep · 10:00 uur', status:'paid', label:'Bevestigd'},
      {when:'21-25 jul', title:'Villa Bahia Ibiza, Cala Jondal', sub:'4 nachten, eigen zwembad', status:'open', label:'Wacht op betaling', invoiceId:'RTG-2026-0141'}
    ]
  };
  let posts = [
    {id:1, author:'Katja Kiss', tier:'rtg', place:'Ibiza', visual:'v-ibiza',
     text:'Met de hele vriendengroep neergestreken: de helft in het hotel aan zee, wij in de villa boven Cala Jondal. Rahul kwam met de privéjet, wij pakten de ochtendvlucht, en toch checken we samen in.',
     likes:168, liked:false, comments:[{who:'Timothy de Groot', tier:'rtg', text:'Tussen twee tentamens door even bijkomen, precies wat ik nodig had.'}]},
    {id:2, author:'Rahul Imran', tier:'business', place:'Ibiza', visual:'v-ibiza',
     text:'Ochtend: twee calls vanaf het terras. Middag: boot naar Formentera met de groep. De jet stond klaar op Schiphol Business Aviation.',
     likes:96, liked:false, comments:[]},
    {id:3, author:'Fleur Johanna', tier:'lifestyle', place:'Gstaad', visual:'v-gstaad',
     text:'Wij oude rotten trekken de bergen in terwijl de jeugd op Ibiza ligt. Chalet in Gstaad, open haard, en morgen de piste op. Op je 69e mag dat.',
     likes:132, liked:false, comments:[
       {who:'Marieke Hooi', tier:'lifestyle', text:'Als schooldirectrice tel ik de dagen af tot de vakantie; deze is het waard.'},
       {who:'William Draak', tier:'business', text:'Vanuit Monaco groeten wij Gstaad. De boekhouding klopt, de rosé ook.'}
     ]},
    {id:4, author:'Dani da Cruz Carvalho', tier:'business', place:'Monaco', visual:'v-monaco',
     text:'Na mijn voetbaljaren dacht ik alles gezien te hebben in Monaco, maar aankomen op codenaam en toch als vanouds ontvangen worden, dat is nieuw.',
     likes:214, liked:false, comments:[]},
    {id:5, author:'Feroz Mohammed', tier:'business', place:'Dubai', visual:'v-dubai',
     text:'Een week Dubai met vrienden: de een in de wolkenkrabber-suite, de ander in een strandappartement aan de Palm. Ik werk voor de Nederlandse staat, maar deze dagen tel ik even niet mee.',
     likes:78, liked:false, comments:[]}
  ];
  let creatorLikes = 320;
  let rtf = { gekoppeld: [], meldingen: [] }; // RTFoundation-gezinnen die dit lid als oppas/familie koppelde

  /* ---------- backend-koppeling ---------- */

  // Zakelijke rekening voor handmatige overboekingen (tot de betaalprovider live is).
  const RTG_IBAN = 'NL62 INGB 0111 1775 88';
  // Filters voor de facturenlijst (jaar en soort).
  let payFilterJaar = 'alle', payFilterType = 'alle';
  // Munt-ontvangst (crypto): opties komen eenmalig van de server; staat de
  // acceptatie uit, dan blijft alles zoals het was (geen munt-knoppen).
  let muntOpties = null;
  async function laadMuntOpties(){
    if (muntOpties || !API.enabled) return muntOpties;
    try { muntOpties = await API.call('/munt/opties'); } catch(e){ muntOpties = { aan: false, munten: [] }; }
    return muntOpties;
  }
  // Een PDF (factuur, overzicht) ophalen met het token en als download aanbieden.
  async function downloadPdf(pad, body, filename){
    if (!API.token) return;
    try {
      const res = await fetch('/api' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API.token }, body: JSON.stringify(body || {}) });
      if (!res.ok) throw new Error('fout');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch(e){ toast(T('fin.dlfout','Downloaden lukte niet.')); }
  }

  // API-client uit de gedeelde app-shell (public/shared/appshell.js).
  const API = RTGApp.maakAPI({ foutTekst: 'API-fout' });

  function applyState(state){
    if (!state) return;
    if (state.user) user = state.user;
    if (state.invoices) invoices = state.invoices;
    if (state.trip) trip = state.trip;
    if (state.posts) posts = state.posts;
    if (typeof state.creatorLikes === 'number') creatorLikes = state.creatorLikes;
    if (state.myApplications) myApps = state.myApplications;
    if (state.foundation) rtf = state.foundation;
  }

  // verse state van de server (bijv. na volgen, claimen of stemmen op De Salon)
  async function refreshState(){
    try { applyState((await API.call('/state')).state); } catch(e){}
  }

  let toastTimer;
  function toast(msg){
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
  }

  function canEngage(p){
    if (typeof p.canEngage === 'boolean') return p.canEngage;
    if (user.tier === 'rtg') return p.tier === 'rtg';
    return true;
  }

  /* ---------- login & tabs ---------- */

  // De gratis (bestel/betaal) laag is alleen te gebruiken na registratie met een
  // paspoort. De gratis-knop opent daarom het registratieformulier, niet een
  // anonieme sessie. De betaalde passen (demo) loggen wel direct in.
  let regTier = 'rtg';
  function updateRegKop(){
    const el = $('#regKop'); if (!el) return;
    el.textContent = regTier === 'guest'
      ? T('gate.reg.free','Gratis account met paspoort: bestel en betaal bij partners, bekijk De Salon en solliciteer. Geen betaalde pas.')
      : T('gate.reg.paid','Maak uw RTG-account aan. Aanmelden gebeurt met uw paspoort (geboortedatum).');
    const btn = $('#regForm button[type="submit"]');
    if (btn) btn.textContent = regTier === 'guest' ? T('gate.reg.freebtn','Gratis account aanmaken') : T('gate.createacc','Account aanmaken');
  }
  document.querySelectorAll('[data-login]').forEach(b =>
    b.addEventListener('click', () => {
      if (b.dataset.login === 'guest'){ regTier = 'guest'; showGateForm('register'); updateRegKop(); }
      else login(b.dataset.login);
    }));

  /* ---------- eigen app per pas, geen brede app ----------
     Elke betaalde pas heeft zijn eigen ingang (pas-rtg/lifestyle/business.html)
     die hier binnenkomt met ?pas=. Dan wordt dit DE app van die pas: het
     manifest (eigen naam en icoon op het beginscherm) wisselt mee, de poort
     toont alleen de eigen ingang, en de server weigert inloggegevens van een
     andere pas. De gratis laag heeft GEEN eigen app: die speelt mee in de
     RTG-app, met minder functies. ZONDER ?pas= bestaat er geen brede app
     meer: dan is dit alleen een keuzescherm dat naar de pas-apps verwijst. */
  const zoekParams = new URLSearchParams(location.search);
  let vastePas = zoekParams.get('pas');
  if (vastePas === 'guest') vastePas = 'rtg'; // gratis speelt in de RTG-app
  if (!['rtg','lifestyle','business'].includes(vastePas)) vastePas = null;
  // vangnet voor oude e-maillinks zonder pas: die landen in de RTG-app
  if (!vastePas && (zoekParams.get('verify') || zoekParams.get('reset'))) vastePas = 'rtg';
  if (vastePas){
    const ml = document.getElementById('manifestLink');
    if (ml) ml.href = '/manifests/pas-' + vastePas + '.webmanifest';
    const tl = document.getElementById('touchLink');
    if (tl) tl.href = '/icons/pas-' + vastePas + '-192.png';
    document.title = { rtg:'RTG Pass', lifestyle:'RTG Lifestyle Pass', business:'RTG Business Pass' }[vastePas];
    // in de RTG-app mag ook de gratis ingang (minder functies); elders alleen de eigen pas
    const mag = vastePas === 'rtg' ? ['rtg','guest'] : [vastePas];
    document.querySelectorAll('[data-login]').forEach(b => { if (!mag.includes(b.dataset.login)) b.style.display = 'none'; });
    regTier = vastePas;
  } else {

    // de ene poort: het scherm blijft kaal (alleen inloggen, aanmelden en
    // wachtwoord vergeten). Log in en uw account opent vanzelf de juiste
    // pas-app (RTG, Lifestyle of Business); aanmelden maakt een RTG-account.
    document.title = 'RTG, log in';
    const ml = document.getElementById('manifestLink');
    if (ml) ml.remove(); // een keuzescherm installeer je niet als app
    regTier = 'rtg';
  }

  /* ---------- pas-thema (kleuren van de website) ----------
     RTG krijgt het bordeauxrode thema, Lifestyle het parelmoeren thema,
     Business blijft klassiek donker. RTG en Lifestyle mogen terug naar
     klassiek; die keuze onthouden we per pas in localStorage. */
  const THEMA_STANDAARD = { rtg: 'bordeaux', lifestyle: 'parelmoer', business: 'standaard' };
  function pasThemaKey(){ return 'rtg_pas_thema_' + (vastePas || 'rtg'); }
  function pasThemaHuidig(){
    if (!vastePas || vastePas === 'business') return 'standaard'; // Business: geen keuze
    let t = null; try { t = localStorage.getItem(pasThemaKey()); } catch(e){}
    return t || THEMA_STANDAARD[vastePas] || 'standaard';
  }
  function pasThemaToepassen(){
    const t = pasThemaHuidig();
    const el = document.documentElement;
    if (t === 'standaard') el.removeAttribute('data-pas-thema');
    else el.setAttribute('data-pas-thema', t);
    // de systeem-themakleur (statusbalk) meelaten kleuren
    const kleur = { bordeaux: '#1E0912', parelmoer: '#ECE6DD' }[t] || '#0C0C0B';
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', kleur);
  }
  function pasThemaZet(t){
    try { localStorage.setItem(pasThemaKey(), t); } catch(e){}
    pasThemaToepassen();
  }
  // meteen toepassen, ook op het beginscherm
  pasThemaToepassen();
  // seam voor de OS-schil (bedieningspaneel): thema lezen/zetten zonder de
  // logica hierboven te dupliceren
  window.RTGOSThema = { huidig: pasThemaHuidig, zet: pasThemaZet, keuzeMogelijk: () => !!vastePas && vastePas !== 'business' };

  /* ---------- de stem van de pas (tone of voice) ----------
     Dezelfde vriend als op de website, maar in de taal van de pas:
     RTG (65 euro per maand) praat als de jetset-vriend (je), Business
     zakelijker en strakker, Lifestyle (20.000 per maand ex btw) als de
     concierge (u). De kleuren van de pas blijven ongemoeid; alleen de
     woorden draaien mee. In het Engels wint de i18n-laag: dan doet
     stem() niets en blijven de vertaalde teksten staan. */
  function pasStem(){
    const s = document.documentElement.getAttribute('data-stem') || vastePas;
    return s === 'lifestyle' || s === 'business' ? s : 'rtg';
  }
  function stem(rtg, business, lifestyle){
    if (lang() === 'en') return null;
    const s = pasStem();
    return s === 'business' ? business : s === 'lifestyle' ? lifestyle : rtg;
  }
  const STEMKOPPEN = [
    ['gate.title', true,
      'Zo, daar ben je.<br>Je pas, <em>altijd</em> op zak.',
      'Welkom.<br>Zaken, <em>strak</em> geregeld.',
      'Welkom thuis.<br>Uw wereld, <em>altijd</em> bij de hand.'],
    ['gate.deck', false,
      'Boeken, betalen met één tik, je eigen AI en De Salon. Alles draait op je codenaam, niet op je echte naam. Zo hoort het.',
      'Reizen, betalingen en je AI-boekhouder in één app, alles op codenaam. Efficiënt, discreet, zonder gedoe.',
      'Uw reizen, uw concierge en De Salon, verzameld in één stille app. Alles op uw codenaam; uw echte naam blijft van u.'],
    ['app.v.trip', false, 'Jouw reis.', 'Je reizen.', 'Uw reis.'],
    ['app.v.trip.note', false,
      'Wijzigen of toevoegen? Eén berichtje aan je AI is genoeg.',
      'Wijzigen of toevoegen? Meld het je AI; het staat direct in de agenda.',
      'Een wens? Fluister het uw AI; het wordt geregeld.'],
    ['app.v.pay.sub', false,
      'Eén tik, Face ID. Alles op je codenaam, zoals het hoort.',
      'Eén tik, Face ID. Elke betaling strak geboekt, op codenaam.',
      'Eén tik, Face ID. Uw betalingen dragen uw codenaam, niet uw naam.'],
    ['app.v.ai.sub', false,
      'Hij regelt het. Eén ja is genoeg.',
      'Hij regelt het en boekt het meteen in. Eén ja is genoeg.',
      'Uw wens is aan één woord genoeg.'],
    ['app.v.salon.sub', false,
      'Posts verschijnen 7 dagen na verblijf, voor je veiligheid.',
      'Posts verschijnen 7 dagen na verblijf, voor je veiligheid.',
      'Uw posts verschijnen 7 dagen na verblijf, voor uw veiligheid.']
  ];
  function stemKoppen(){
    if (lang() === 'en') return;
    const i = pasStem() === 'business' ? 1 : pasStem() === 'lifestyle' ? 2 : 0;
    STEMKOPPEN.forEach(rij => {
      const el = document.querySelector('[data-i18n="' + rij[0] + '"], [data-i18n-html="' + rij[0] + '"]');
      if (!el) return;
      if (rij[1]) el.innerHTML = rij[2 + i]; else el.textContent = rij[2 + i];
    });
    const ai = document.getElementById('aiTitle');
    if (ai) ai.textContent = ['Jouw AI.', 'Je AI.', 'Uw AI.'][i];
  }
  // meteen: de poort spreekt de taal van de gekozen ingang (?pas=...)
  stemKoppen();

  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', e => {
    e.preventDefault();
    login(null, { u: $('#liUser').value, p: $('#liPass').value });
  });
  const regForm = document.getElementById('regForm');
  if (regForm) regForm.addEventListener('submit', e => {
    e.preventDefault();
    login(null, { register: true, tier: regTier, name: $('#rgName').value, u: $('#rgEmail').value, phone: $('#rgPhone').value, geboortedatum: $('#rgGeb').value, p: $('#rgPass').value });
  });
  const toReg = document.getElementById('toReg'), toLogin = document.getElementById('toLogin'), toForgot = document.getElementById('toForgot');
  function showGateForm(which){
    ['#loginForm','#regForm','#forgotForm','#resetForm'].forEach(sel => { const f=$(sel); if(f) f.style.display='none'; });
    const map = { login:'#loginForm', register:'#regForm', forgot:'#forgotForm', reset:'#resetForm' };
    const f = $(map[which]); if (f) f.style.display = 'flex';
    if (toReg) toReg.style.display = which==='login' ? '' : 'none';
    if (toForgot) toForgot.style.display = which==='login' ? '' : 'none';
    if (toLogin) toLogin.style.display = which==='login' ? 'none' : '';
  }
  if (toReg) toReg.addEventListener('click', () => { regTier = 'rtg'; showGateForm('register'); updateRegKop(); });
  if (toForgot) toForgot.addEventListener('click', () => showGateForm('forgot'));
  if (toLogin) toLogin.addEventListener('click', () => showGateForm('login'));
  const forgotForm = document.getElementById('forgotForm');
  if (forgotForm) forgotForm.addEventListener('submit', async e => {
    e.preventDefault();
    try { await API.call('/auth/forgot', { email: $('#fgEmail').value }); }
    catch (e2){ /* stil, geen bestaan lekken */ }
    toast(T('gate.forgotsent','Als dit e-mailadres bekend is, sturen we een herstel-link.'));
    showGateForm('login');
  });
  // wachtwoord-herstel: de link uit de e-mail komt hier binnen (?reset=)
  let resetToken = null;
  const resetForm = document.getElementById('resetForm');
  if (resetForm) resetForm.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await API.call('/auth/reset', { token: resetToken, code: $('#rsCode').value, password: $('#rsPass').value });
      toast(T('gate.resetok','Wachtwoord aangepast. Log in met uw nieuwe wachtwoord.'));
      showGateForm('login');
    } catch (e2){ toast(e2.message || 'Herstel mislukt.'); }
  });
  // bevestigings- en herstel-links uit de e-mail afhandelen (voorheen het
  // aparte ledenportaal; het grote scherm zit nu gewoon in de pas-apps zelf)
  (function handleAuthLinks(){
    const q = new URLSearchParams(location.search);
    if (q.get('verify')){
      API.call('/auth/verify-email', { token: q.get('verify') })
        .then(() => toast(T('gate.verified','Uw e-mailadres is bevestigd.')))
        .catch(() => toast(T('gate.verifyfail','Bevestigingslink ongeldig of verlopen.')))
        .finally(() => history.replaceState(null, '', location.pathname + (vastePas ? '?pas=' + vastePas : '')));
    }
    if (q.get('reset')){ resetToken = q.get('reset'); showGateForm('reset'); }
  })();

  async function login(tier, cred){
    if (cred){
      if (API.enabled){
        try {
          const data = cred.register
            ? await API.call('/auth/register', { name: cred.name, email: cred.u, phone: cred.phone, geboortedatum: cred.geboortedatum, password: cred.p, tier: cred.tier, pasApp: vastePas || undefined })
            : await API.call('/auth/login', { login: cred.u, password: cred.p, pasApp: vastePas || undefined });
          API.token = data.token;
          applyState(data.state);           // user = het echte account
          tier = user.tier;
          // uw account weet zelf bij welke pas hij hoort: zonder ?pas= (of in
          // de verkeerde pas-app) opent meteen de juiste app, zoals de
          // leeftijdskeuze dat bij de RTFoundation doet
          const doelPas = user.tier === 'guest' ? 'rtg' : user.tier;
          const magHier = vastePas ? (vastePas === 'rtg' ? ['rtg', 'guest'] : [vastePas]) : [];
          if (!magHier.includes(user.tier) && ['rtg', 'lifestyle', 'business'].includes(doelPas)){
            try { localStorage.setItem('rtg_member_token', API.token); } catch (e2) {}
            location.replace(location.pathname + '?pas=' + doelPas);
            return;
          }
        } catch (e) { toast(e.message || 'Onjuiste inloggegevens.'); return; }
      } else {
        if (!(String(cred.u).trim().toLowerCase() === 'rahul' && cred.p === 'Imran')){
          toast('Onjuiste inloggegevens.'); return;
        }
        tier = 'business'; user = {...PERSONAS[tier]};
      }
    } else {
      user = {...PERSONAS[tier]};
      if (API.enabled){
        try {
          const data = await API.call('/login', {tier, pasApp: vastePas || undefined});
          API.token = data.token;
          applyState(data.state);
        } catch (e) { API.enabled = false; }
      }
    }
    if (!API.live) creatorLikes = ({rtg:320, lifestyle:680, business:210})[tier] || 0;
    if (API.live) try { localStorage.setItem('rtg_member_token', API.token); } catch(e){}
    $('#gate').style.display = 'none';
    $('#app').classList.add('active');
    renderAll();
    if (API.live && window.RTGRealtime){
      RTGRealtime.start(API.token, { onSync: syncScope, onChange: renderBell, onSocial: opSociaal, onCall: opBelsignaal, onBezorg: opBezorg, onOntmoetSignaal: opOntmoetSignaal });
    }
    loadSocial();
    checkOnboarding(); laadAgendaLid();
  }

  // Blijf ingelogd: met een bewaard token slaat de app het startscherm over.
  // De sessie weet zelf bij welke pas hij hoort: zonder ?pas= (of in de
  // verkeerde pas-app) sturen we meteen door naar de juiste app.
  async function restoreSession(){
    if (!API.enabled) return;
    let t = null; try { t = localStorage.getItem('rtg_member_token'); } catch(e){}
    if (!t) return;
    API.token = t;
    try {
      applyState((await API.call('/state')).state);
      const doelPas = user.tier === 'guest' ? 'rtg' : user.tier;
      const magHier = vastePas ? (vastePas === 'rtg' ? ['rtg','guest'] : [vastePas]) : [];
      if (!magHier.includes(user.tier)){
        if (['rtg','lifestyle','business'].includes(doelPas)){ location.replace(location.pathname + '?pas=' + doelPas); return; }
        API.token = null; return; // onbekende pas: poort tonen
      }
      $('#gate').style.display = 'none';
      $('#app').classList.add('active');
      renderAll();
      if (window.RTGRealtime) RTGRealtime.start(API.token, { onSync: syncScope, onChange: renderBell, onSocial: opSociaal, onCall: opBelsignaal, onBezorg: opBezorg, onOntmoetSignaal: opOntmoetSignaal });
      loadSocial();
      checkOnboarding(); laadAgendaLid();
    } catch(e){
      API.token = null;
      try { localStorage.removeItem('rtg_member_token'); } catch(e2){}
    }
  }

  async function doLogout(){
    try { if (API.live) await API.call('/logout'); } catch(e){}
    try { localStorage.removeItem('rtg_member_token'); } catch(e){}
    location.reload();
  }

