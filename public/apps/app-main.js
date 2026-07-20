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
      const blob = await res.blob();
      // het eigen toestel als opslag: elke download krijgt stil een kopie in
      // de Toestelkluis (OPFS), zodat het exemplaar van het lid lokaal blijft
      if (window.Toestelkluis) Toestelkluis.bewaar(filename, blob).catch(() => {});
      const url = URL.createObjectURL(blob);
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
      '<div class="big" style="font-size:1.02rem;">🎲 '+T('spel.kop','Een potje tussendoor?')+'</div>'+
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
        '<button class="go" style="background:transparent;padding:.2rem .35rem;" data-snap="'+escT(c.key)+'" data-cn="'+escT(c.codename)+'" title="Snap">📷</button>'+
        '<button class="go" style="background:transparent;padding:.2rem .35rem;" data-bel="'+escT(c.key)+'" data-cn="'+escT(c.codename)+'">📞</button>'+
        '<button class="go" style="background:transparent;padding:.2rem .35rem;" data-vid="'+escT(c.key)+'" data-cn="'+escT(c.codename)+'">🎥</button></div>'
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
      if (snapStoryMode){ await API.call('/member/story/post', { foto, tekst }); toast('✨ '+T('snap.storyok','Je verhaal staat er 24 uur op.')); loadStories(); }
      else { await API.call('/member/snap/send', { toKey: snapNaar, foto, tekst }); toast('📷 '+T('snap.verstuurd','Snap verstuurd. Hij verdwijnt na bekijken.')); }
    } catch(err){ toast(err.message); }
  }
  function snapVerklein(file){
    return new Promise(res => { const img=new Image(), rd=new FileReader();
      rd.onload=()=>{ img.onload=()=>{ const max=1000; let w=img.width,h=img.height; if(w>max||h>max){ const r=Math.min(max/w,max/h); w=Math.round(w*r); h=Math.round(h*r);} const cv=document.createElement('canvas'); cv.width=w; cv.height=h; cv.getContext('2d').drawImage(img,0,0,w,h); res(cv.toDataURL('image/jpeg',0.7)); }; img.onerror=()=>res(null); img.src=rd.result; };
      rd.onerror=()=>res(null); rd.readAsDataURL(file); });
  }
  /* ---------- verplichte onboarding + contract (blokkeert de app) ---------- */
  let onbBezig = false;
  async function checkOnboarding(){
    if (!API.live || !API.token || onbBezig) return;
    let st; try { st = await API.call('/onboarding/status'); } catch(e){ return; }
    if (!st || st.klaar){ var g0 = document.getElementById('onbGate'); if (g0) g0.hidden = true; return; }
    tekenOnbGate(st);
  }
  function onbInputType(t){ return t==='date'?'date':t==='email'?'email':t==='tel'?'tel':'text'; }
  function tekenOnbGate(st){
    const g = document.getElementById('onbGate'); if (!g) return;
    g.hidden = false;
    const vBox = document.getElementById('onbVelden');
    // bewaar wat de gebruiker al typte (een KYC-upload herbouwt dit paneel)
    const huidig = {}; vBox.querySelectorAll('input[data-veld]').forEach(function(i){ if (i.value) huidig[i.dataset.veld] = i.value; });
    vBox.textContent='';
    (st.velden||[]).forEach(function(v){
      if (v.type === 'kyc'){
        const d = document.createElement('div'); d.className='onb-kyc';
        const l = document.createElement('div');
        const b = document.createElement('b'); b.textContent = v.label; l.appendChild(b);
        const s = document.createElement('span'); s.className='sub';
        s.textContent = v.ingevuld ? T('onb.kyc.ok','Ontvangen, wordt gecontroleerd.') : T('onb.kyc.upl','Upload een foto van de voorkant van uw paspoort.');
        l.appendChild(s); d.appendChild(l);
        if (v.ingevuld){ const st2 = document.createElement('span'); st2.className='st'; st2.style.color='#7EE0A3'; st2.textContent='✓'; d.appendChild(st2); }
        else { const btn = document.createElement('button'); btn.type='button'; btn.className='onb-btn ghost'; btn.textContent=T('onb.kyc.knop','Uploaden');
          btn.addEventListener('click', ()=> document.getElementById('onbKycFile').click()); d.appendChild(btn); }
        vBox.appendChild(d); return;
      }
      const wrap = document.createElement('label'); wrap.className='onb-veld';
      const sp = document.createElement('span'); sp.textContent = v.label + (v.ingevuld ? ' ✓' : '');
      wrap.appendChild(sp);
      const inp = document.createElement('input'); inp.type = onbInputType(v.type); inp.dataset.veld = v.id;
      inp.value = huidig[v.id] != null ? huidig[v.id] : (v.waarde || ''); inp.autocomplete = ({naam:'name',email:'email',telefoon:'tel',adres:'street-address',postcode:'postal-code',woonplaats:'address-level2',land:'country-name'})[v.id] || 'off';
      wrap.appendChild(inp); vBox.appendChild(wrap);
    });
    document.getElementById('onbCTitel').textContent = st.contract.titel || '';
    document.getElementById('onbCTekst').textContent = st.contract.tekst || '';
    const ak = document.getElementById('onbAkkoord'); ak.checked = ak.checked || !!st.contract.ondertekend;
    document.getElementById('onbFout').textContent = '';
  }
  (function initOnb(){
    const kf = document.getElementById('onbKycFile');
    if (kf) kf.addEventListener('change', async () => {
      const file = kf.files[0]; kf.value=''; if (!file) return;
      if (file.size > 5*1024*1024){ document.getElementById('onbFout').textContent = T('onb.toobig','De foto is te groot (max 5 MB).'); return; }
      const data = await snapVerklein(file); if (!data) return;
      try { await API.call('/verify/upload', { image: data }); if (user) user.verified='pending'; toast(T('onb.kyc.ok','Ontvangen, wordt gecontroleerd.')); checkOnboarding(); }
      catch(e){ document.getElementById('onbFout').textContent = e.message || 'Upload mislukt.'; }
    });
    const kn = document.getElementById('onbKlaar');
    if (kn) kn.addEventListener('click', async () => {
      const fout = document.getElementById('onbFout'); fout.textContent='';
      onbBezig = true;
      try {
        const velden = {};
        document.querySelectorAll('#onbVelden input[data-veld]').forEach(function(i){ if (i.value.trim()) velden[i.dataset.veld] = i.value.trim(); });
        if (Object.keys(velden).length) { try { await API.call('/onboarding/opslaan', { velden }); } catch(e){} }
        const naam = (document.getElementById('onbNaam').value || '').trim();
        const akkoord = document.getElementById('onbAkkoord').checked;
        const r = await API.call('/onboarding/teken', { naam, akkoord });
        if (r.klaar){ document.getElementById('onbGate').hidden = true; toast(T('onb.welkom','Welkom aan boord! Fijne reis.')); onbBezig=false; return; }
        tekenOnbGate(r);
        fout.textContent = T('onb.rest','Nog niet compleet: vul de resterende velden in (ook uw paspoort).');
      } catch(e){ fout.textContent = e.message || 'Er ging iets mis.'; }
      onbBezig = false;
    });
  })();

  function snapOverlay(){
    let ov = document.getElementById('snapOv'); if (ov) return ov;
    ov = document.createElement('div'); ov.id='snapOv';
    ov.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.9);display:none;flex-direction:column;align-items:center;justify-content:center;padding:1rem;';
    ov.innerHTML='<button id="snapOvX" style="position:absolute;top:1rem;right:1rem;background:none;border:none;color:#fff;font-size:1.6rem;">✕</button>'+
      '<div id="snapOvVan" style="color:#fff;font-size:.85rem;margin-bottom:.6rem;"></div>'+
      '<img id="snapOvImg" alt="" style="max-width:100%;max-height:72vh;border-radius:12px;">'+
      '<div id="snapOvTxt" style="color:#fff;margin-top:.7rem;text-align:center;"></div>'+
      '<div id="snapOvNote" style="color:#999;font-size:.72rem;margin-top:.7rem;"></div>';
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
    let h = '<div style="display:flex;gap:.6rem;overflow-x:auto;padding:.2rem 0 .7rem;">';
    h += '<button id="storyPlus" style="flex:0 0 auto;background:none;border:none;text-align:center;width:3.6rem;cursor:pointer;"><span style="display:flex;width:3rem;height:3rem;border-radius:50%;margin:0 auto;align-items:center;justify-content:center;font-size:1.2rem;background:var(--card2);border:2px dashed var(--gold);color:var(--gold);">＋</span><span style="display:block;font-size:.6rem;color:var(--soft);margin-top:.2rem;">Verhaal</span></button>';
    h += stories.map(v=>'<button class="js-story" data-id="'+escT(v.id)+'" style="flex:0 0 auto;background:none;border:none;text-align:center;width:3.6rem;cursor:pointer;"><span style="display:flex;width:3rem;height:3rem;border-radius:50%;margin:0 auto;align-items:center;justify-content:center;font-size:.72rem;font-weight:700;background:var(--card2);border:2px solid '+(v.gezien?'var(--line)':'var(--gold)')+';">'+initCN(v.van)+'</span><span style="display:block;font-size:.6rem;color:var(--soft);margin-top:.2rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escT(v.vanMij?'Jij':v.van)+'</span></button>').join('');
    h += '</div>';
    if (snaps.length){
      h += '<div style="display:flex;flex-direction:column;gap:.35rem;margin-bottom:.5rem;">'+snaps.map(sn=>
        '<div style="display:flex;align-items:center;gap:.5rem;font-size:.78rem;"><span>📷</span><b style="flex:1;color:var(--gold);">'+escT(sn.van)+'</b><span style="color:var(--soft);">stuurde een snap</span><button class="js-opensnap go" data-id="'+escT(sn.id)+'" style="padding:.15rem .55rem;">Bekijk</button></div>'
      ).join('')+'</div>';
    }
    box.innerHTML = h;
    box.querySelector('#storyPlus').addEventListener('click', storyKies);
    box.querySelectorAll('.js-story').forEach(b => b.addEventListener('click', () => openStory(b.dataset.id)));
    box.querySelectorAll('.js-opensnap').forEach(b => b.addEventListener('click', () => openSnap(b.dataset.id)));
  }
  async function openSnap(id){
    let d; try { d = await API.call('/member/snap/view', { id }); } catch(e){ toast(e.message); return; }
    const ov = snapOverlay();
    ov.querySelector('#snapOvVan').textContent = 'Snap van ' + d.van;
    ov.querySelector('#snapOvImg').src = d.foto;
    ov.querySelector('#snapOvTxt').textContent = d.tekst || '';
    ov.querySelector('#snapOvNote').textContent = T('snap.weg','Deze snap verdwijnt zodra je sluit.');
    ov.style.display='flex';
  }
  async function openStory(id){
    let d; try { d = await API.call('/member/story/view', { id }); } catch(e){ toast(e.message); return; }
    const ov = snapOverlay();
    ov.querySelector('#snapOvVan').textContent = 'Verhaal van ' + d.van;
    ov.querySelector('#snapOvImg').src = d.foto;
    ov.querySelector('#snapOvTxt').textContent = d.tekst || '';
    ov.querySelector('#snapOvNote').textContent = '';
    ov.style.display='flex';
  }

  function renderSocialBar(){
    const el = $('#socialBar'); if (!el) return;
    if (!socialOK){ el.innerHTML = ''; return; }
    let html = '';
    for (const r of (social.requests || [])){
      html += '<div class="sc-req"><b>' + escT(r.codename) + '</b><span style="color:var(--soft);font-size:0.7rem;">' + T('sal.wilverbinden','wil verbinden') + '</span>' +
        '<button class="ja" data-scja="' + escT(r.key) + '">' + T('sal.accepteer','Accepteer') + '</button>' +
        '<button data-scnee="' + escT(r.key) + '">✕</button></div>';
    }
    html += '<div class="sc-strip">' +
      '<button class="sc-p add" id="scAddBtn"><span class="sc-av">+</span><span>' + T('sal.add','Toevoegen') + '</span></button>' +
      (social.connections || []).map(c =>
        '<button class="sc-p" data-scdm="' + escT(c.key) + '" data-cn="' + escT(c.codename) + '">' +
          '<span class="sc-av">' + initCN(c.codename) + (c.unread ? '<span class="sc-badge">' + c.unread + '</span>' : '') + '</span>' +
          '<span>' + escT(c.codename.split(' ')[0]) + '</span></button>'
      ).join('') + '</div>';
    html += '<div class="sc-zoek" id="scZoek"><input id="scQ" placeholder="' + T('sal.zoekph','Zoek op codenaam, bijv. Gouden Ibis') + '"><button id="scGo">' + T('sal.zoek','Zoek') + '</button></div>' +
      '<div class="sc-res" id="scRes"></div>';
    el.innerHTML = html;

    el.querySelectorAll('[data-scja]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/member/connect/respond', { key: b.dataset.scja, action: 'accept' }); toast(T('sal.verbonden','Verbonden.')); loadSocial(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-scnee]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/member/connect/respond', { key: b.dataset.scnee, action: 'decline' }); loadSocial(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-scdm]').forEach(b => b.addEventListener('click', () => openDm(b.dataset.scdm, b.dataset.cn)));
    const add = $('#scAddBtn'); if (add) add.addEventListener('click', () => { $('#scZoek').classList.toggle('open'); const q = $('#scQ'); if (q) q.focus(); });
    const go = $('#scGo'); if (go) go.addEventListener('click', zoekLeden);
    const q = $('#scQ'); if (q) q.addEventListener('keydown', e => { if (e.key === 'Enter') zoekLeden(); });
  }

  async function zoekLeden(){
    const q = $('#scQ').value.trim();
    if (q.length < 2){ toast(T('sal.zoekkort','Typ minimaal twee letters.')); return; }
    try {
      const d = await API.call('/member/find', { q });
      $('#scRes').innerHTML = (d.results || []).map(r =>
        '<div class="sc-hit"><span class="sc-av" style="width:34px;height:34px;font-size:0.7rem;">' + initCN(r.codename) + '</span><b>' + escT(r.codename) + '</b>' +
        (r.status === 'geen' ? '<button data-scvz="' + escT(r.key) + '">' + T('sal.verzoek','Verzoek sturen') + '</button>'
         : r.status === 'verbonden' ? '<span style="color:var(--green,#2E7D4F);font-size:0.72rem;">✓ ' + T('sal.isverbonden','verbonden') + '</span>'
         : r.status === 'aangevraagd' ? '<span style="color:var(--soft);font-size:0.72rem;">' + T('sal.gevraagd','aangevraagd') + '</span>'
         : '<span style="color:var(--gold);font-size:0.72rem;">' + T('sal.wachtu','wacht op u') + '</span>') + '</div>'
      ).join('') || '<div style="font-size:0.78rem;color:var(--soft);">' + T('sal.niksgevonden','Geen leden gevonden met deze codenaam.') + '</div>';
      $('#scRes').querySelectorAll('[data-scvz]').forEach(b => b.addEventListener('click', async () => {
        try { await API.call('/member/connect', { key: b.dataset.scvz }); toast(T('sal.verzonden','Verzoek verstuurd.')); zoekLeden(); } catch(e){ toast(e.message); }
      }));
    } catch(e){ toast(e.message); }
  }

  /* ---- dm ---- */
  async function openDm(key, naam){
    dmWith = key; dmNaam = naam;
    $('#dmNaam').textContent = naam;
    $('#dm-sheet').classList.add('open'); $('#dm-scrim').classList.add('open');
    await laadDm();
    loadSocial(); // ongelezen-teller bijwerken
  }
  async function laadDm(){
    if (!dmWith) return;
    try {
      const d = await API.call('/member/dm', { withKey: dmWith });
      $('#dmBody').innerHTML = (d.messages || []).map(m => dmBubbel(m)).join('') ||
        '<div style="font-size:0.78rem;color:var(--soft);text-align:center;margin:auto 0;">' + T('sal.dm.leeg','Nog geen berichten. Zeg hallo.') + '</div>';
      vertaalBubbels($('#dmBody'));
      $('#dmBody').scrollTop = 999999;
    } catch(e){ toast(e.message); }
  }
  // Vertaal binnenkomende berichten naar de gekozen taal van de lezer. Alleen
  // berichten van de ander (.xlate) worden vertaald; eigen berichten niet.
  function vertaalBubbels(root){
    if (!root || !window.Vertaal) return;
    root.querySelectorAll('.xlate:not([data-vt])').forEach(function(el){
      el.setAttribute('data-vt','1');
      Vertaal.vul(el, el.textContent, lang());
    });
  }
  function dmBubbel(m){
    const mijn = m.from === social.me;
    const tijd = new Date(m.at).toLocaleTimeString(lang()==='en'?'en-GB':'nl-NL',{hour:'2-digit',minute:'2-digit'});
    const txt = mijn ? escT(m.text) : '<span class="xlate">' + escT(m.text) + '</span>';
    return '<div class="dm-m' + (mijn ? ' mine' : '') + '">' + txt +
      (m.post ? '<div class="dm-post"><b>↗ ' + escT(m.post.author) + ' · ' + escT(m.post.place) + '</b>' + escT(m.post.text) + '…</div>' : '') +
      '<span class="tijd">' + tijd + '</span></div>';
  }
  function dmToevoegen(m){ const b = $('#dmBody'); b.insertAdjacentHTML('beforeend', dmBubbel(m)); vertaalBubbels(b); b.scrollTop = 999999; }
  async function stuurDm(){
    const text = $('#dmInput').value.trim();
    if (!text || !dmWith) return;
    $('#dmInput').value = '';
    try {
      const d = await API.call('/member/dm/send', { toKey: dmWith, text });
      dmToevoegen(d.message);
    } catch(e){ toast(e.message); }
  }
  $('#dmSend').addEventListener('click', stuurDm);
  $('#dmInput').addEventListener('keydown', e => { if (e.key === 'Enter') stuurDm(); });
  const dmDicht = () => { $('#dm-sheet').classList.remove('open'); $('#dm-scrim').classList.remove('open'); dmWith = null; };
  $('#dmClose').addEventListener('click', dmDicht);
  $('#rideGo').addEventListener('click', verstuurRit);
  $('#rideClose').addEventListener('click', () => { $('#ride-sheet').classList.remove('open'); $('#ride-scrim').classList.remove('open'); });
  $('#ride-scrim').addEventListener('click', () => { $('#ride-sheet').classList.remove('open'); $('#ride-scrim').classList.remove('open'); });
  $('#dm-scrim').addEventListener('click', dmDicht);

  /* ---- post delen ---- */
  let deelPost = null;
  function openShare(postId){
    if (!socialOK){ toast(T('sal.eerstlid','Alleen voor leden.')); return; }
    if (!(social.connections || []).length){ toast(T('sal.geenconn','Nog geen connecties. Voeg eerst iemand toe in De Salon.')); return; }
    deelPost = postId;
    $('#shareList').innerHTML = social.connections.map(c =>
      '<button class="sc-hit" style="width:100%;cursor:pointer;" data-deel="' + escT(c.key) + '"><span class="sc-av" style="width:34px;height:34px;font-size:0.7rem;">' + initCN(c.codename) + '</span><b>' + escT(c.codename) + '</b><span style="color:var(--gold);font-size:0.72rem;">↗</span></button>'
    ).join('');
    $('#shareList').querySelectorAll('[data-deel]').forEach(b => b.addEventListener('click', async () => {
      try {
        await API.call('/member/dm/send', { toKey: b.dataset.deel, postId: deelPost, text: '' });
        toast(T('sal.gedeeld','Gedeeld.'));
        $('#share-sheet').classList.remove('open'); $('#share-scrim').classList.remove('open');
      } catch(e){ toast(e.message); }
    }));
    $('#share-sheet').classList.add('open'); $('#share-scrim').classList.add('open');
  }
  $('#shareClose').addEventListener('click', () => { $('#share-sheet').classList.remove('open'); $('#share-scrim').classList.remove('open'); });
  $('#share-scrim').addEventListener('click', () => { $('#share-sheet').classList.remove('open'); $('#share-scrim').classList.remove('open'); });

  /* ---- bellen en videobellen (WebRTC) ---- */
  let call = null;        // { pc, stream, withKey, naam, video, richting, pendingIce, timer, t0 }
  let inkomend = null;    // { from, codename, video }

  function belUI(open){
    $('#callScreen').classList.toggle('open', !!open);
    if (!open){ $('#csRemote').srcObject = null; $('#csLocal').srcObject = null; }
  }
  function belTimer(){
    if (!call) return;
    const s = Math.round((Date.now() - call.t0) / 1000);
    $('#csTijd').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  let iceConfig = null;
  // Elke oproep verse ICE-servers (TURN met kort geldige inloggegevens roteert).
  async function haalIce(){ try { iceConfig = (await (await fetch('/api/ice')).json()).iceServers; } catch(e){ iceConfig = [{ urls:'stun:stun.l.google.com:19302' }]; } return iceConfig; }
  function maakPc(){
    const pc = new RTCPeerConnection({ iceServers: iceConfig || [{ urls:'stun:stun.l.google.com:19302' }] });
    call.stream.getTracks().forEach(t => pc.addTrack(t, call.stream));
    pc.onicecandidate = ev => { if (ev.candidate && call) API.call('/member/call', { toKey: call.withKey, kind: 'ice', payload: ev.candidate }).catch(()=>{}); };
    pc.ontrack = ev => {
      const v = $('#csRemote');
      if (v.srcObject !== ev.streams[0]) v.srcObject = ev.streams[0];
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected' && call && !call.t0){ call.t0 = Date.now(); call.timer = setInterval(belTimer, 1000); }
      if (pc.connectionState === 'failed'){ toast(T('sal.belmislukt','Verbinding mislukt. Op een streng netwerk lukt bellen soms niet.')); eindeGesprek(false); }
      else if (pc.connectionState === 'closed') eindeGesprek(false);
    };
    call.pc = pc;
    window.__rtgCall = () => call; // voor tests
    return pc;
  }
  async function pakMedia(video){
    try { return await navigator.mediaDevices.getUserMedia({ audio: true, video: video ? { facingMode: 'user' } : false }); }
    catch(e){ toast(T('sal.geenmedia','Geen toegang tot microfoon of camera.')); return null; }
  }
  function toonGesprek(naam, video){
    $('#csNaam').textContent = naam; $('#csNaam2').textContent = naam;
    $('#csAv').textContent = initCN(naam);
    $('#csAudioOnly').style.display = video ? 'none' : 'flex';
    $('#csLocal').style.display = video ? '' : 'none';
    $('#csCam').style.display = video ? '' : 'none';
    $('#csTijd').textContent = T('sal.belt','gaat over…');
    belUI(true);
  }
  async function beginGesprek(video){
    if (!dmWith) return;
    if (call){ toast(T('sal.algesprek','Er loopt al een gesprek.')); return; }
    await haalIce();
    const stream = await pakMedia(video);
    if (!stream) return;
    call = { withKey: dmWith, naam: dmNaam, video, richting: 'uit', pendingIce: [], stream, t0: 0 };
    $('#csLocal').srcObject = stream;
    toonGesprek(dmNaam, video);
    try { await API.call('/member/call', { toKey: call.withKey, kind: 'ring', video }); }
    catch(e){ toast(e.message); eindeGesprek(false); }
  }
  $('#dmBel').addEventListener('click', () => beginGesprek(false));
  $('#dmVideo').addEventListener('click', () => beginGesprek(true));
  $('#dmBlok').addEventListener('click', async () => {
    if (!dmWith) return;
    const keuze = prompt('Wat wil je doen met ' + dmNaam + '?\n\n1 = Blokkeren\n2 = Melden\n3 = Blokkeren en melden', '1');
    if (keuze === null) return;
    try {
      if (keuze === '2' || keuze === '3') { const reden = prompt('Wat is er aan de hand?', '') || ''; await API.call('/member/report', { key: dmWith, reden }); }
      if (keuze === '1' || keuze === '3') { await API.call('/member/block', { key: dmWith }); $('#dm-sheet').classList.remove('open'); loadSocial(); }
      toast(keuze === '2' ? T('sal.gemeld', 'Bedankt, je melding is doorgegeven.') : T('sal.geblokkeerd', 'Geblokkeerd.'));
    } catch (e) { toast(e.message); }
  });

  async function neemOp(){
    $('#callIncoming').classList.remove('open');
    if (!inkomend) return;
    await haalIce();
    const stream = await pakMedia(inkomend.video);
    if (!stream){ API.call('/member/call', { toKey: inkomend.from, kind: 'decline' }).catch(()=>{}); inkomend = null; return; }
    call = { withKey: inkomend.from, naam: inkomend.codename, video: inkomend.video, richting: 'in', pendingIce: [], stream, t0: 0 };
    $('#csLocal').srcObject = stream;
    toonGesprek(inkomend.codename, inkomend.video);
    await API.call('/member/call', { toKey: call.withKey, kind: 'accept' }).catch(()=>{});
    inkomend = null;
  }
  $('#ciJa').addEventListener('click', neemOp);
  $('#ciNee').addEventListener('click', () => {
    $('#callIncoming').classList.remove('open');
    if (inkomend) API.call('/member/call', { toKey: inkomend.from, kind: 'decline' }).catch(()=>{});
    inkomend = null;
  });

  function eindeGesprek(zeggen){
    if (!call) { belUI(false); return; }
    if (zeggen) API.call('/member/call', { toKey: call.withKey, kind: 'hangup' }).catch(()=>{});
    clearInterval(call.timer);
    try { call.stream.getTracks().forEach(t => t.stop()); } catch(e){}
    try { if (call.pc) call.pc.close(); } catch(e){}
    call = null;
    belUI(false);
  }
  $('#csWeg').addEventListener('click', () => eindeGesprek(true));
  $('#csMute').addEventListener('click', () => {
    if (!call) return;
    const t = call.stream.getAudioTracks()[0]; if (!t) return;
    t.enabled = !t.enabled;
    $('#csMute').classList.toggle('dicht', !t.enabled);
  });
  $('#csCam').addEventListener('click', () => {
    if (!call) return;
    const t = call.stream.getVideoTracks()[0]; if (!t) return;
    t.enabled = !t.enabled;
    $('#csCam').classList.toggle('dicht', !t.enabled);
  });

  async function flushIce(){
    if (!call || !call.pc || !call.pc.remoteDescription) return;
    for (const c of call.pendingIce.splice(0)) { try { await call.pc.addIceCandidate(c); } catch(e){} }
  }
  async function opBelsignaal(d){
    if (d.kind === 'ring'){
      if (call){ API.call('/member/call', { toKey: d.from, kind: 'busy' }).catch(()=>{}); return; }
      inkomend = { from: d.from, codename: d.codename, video: d.video };
      $('#ciAv').textContent = initCN(d.codename);
      $('#ciNaam').textContent = d.codename;
      $('#ciSoort').textContent = d.video ? T('sal.videogesprek','Videogesprek') : T('sal.spraakoproep','Spraakoproep');
      $('#callIncoming').classList.add('open');
      return;
    }
    if (!call || d.from !== call.withKey) return;
    if (d.kind === 'accept'){
      const pc = maakPc();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      API.call('/member/call', { toKey: call.withKey, kind: 'offer', payload: offer }).catch(()=>{});
    } else if (d.kind === 'offer'){
      const pc = maakPc();
      await pc.setRemoteDescription(d.payload);
      await flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      API.call('/member/call', { toKey: call.withKey, kind: 'answer', payload: answer }).catch(()=>{});
    } else if (d.kind === 'answer'){
      await call.pc.setRemoteDescription(d.payload);
      await flushIce();
    } else if (d.kind === 'ice'){
      if (call.pc && call.pc.remoteDescription) { try { await call.pc.addIceCandidate(d.payload); } catch(e){} }
      else call.pendingIce.push(d.payload);
    } else if (d.kind === 'hangup' || d.kind === 'decline' || d.kind === 'busy'){
      toast(d.kind === 'busy' ? T('sal.bezet','In gesprek.') : d.kind === 'decline' ? T('sal.geweigerd','Oproep geweigerd.') : T('sal.opgehangen','Gesprek beëindigd.'));
      eindeGesprek(false);
    }
  }

  function opSociaal(d){
    if (d.kind === 'request'){ toast('🤝 ' + d.from + ' ' + T('sal.wilverbinden','wil verbinden')); loadSocial(); }
    else if (d.kind === 'accepted'){ toast('🤝 ' + d.by + ' ' + T('sal.accepteerde','accepteerde uw verzoek')); loadSocial(); }
    else if (d.kind === 'dm'){
      if (dmWith === d.from && $('#dm-sheet').classList.contains('open')){
        dmToevoegen({ from: d.from, text: d.text, post: d.post, at: d.at });
        API.call('/member/dm', { withKey: d.from }).catch(()=>{}); // gelezen
      } else {
        toast('💬 ' + d.codename + ': ' + (d.text || '↗').slice(0, 60));
        loadSocial();
      }
    }
  }


  /* seam voor de RTG OS-laag: de eigen Bellen-, Videobellen- en Snaps-apps
     openen hiermee een kiezer en starten dan direct het gesprek of de snap */
  window.RTGSocial = {
    ok: () => socialOK,
    lijst: () => (social.connections || []),
    bel: (key, naam, video) => snelBel(key, naam, video),
    snap: key => snapKies(key)
  };
  /* ---------- live updates ---------- */

  // een scherm werkt zichzelf bij zonder page-refresh
  async function syncScope(scope){
    if (!API.live) return;
    try {
      const data = await API.call('/state');
      applyState(data.state);
    } catch (e) { return; }
    if (scope === 'payments'){ renderPay(); renderHome(); renderTrip(); }
    else if (scope === 'salon'){ renderSalon(); renderHome(); }
    else if (scope === 'orders'){ renderTerPlaatse(); if (user.tier === 'guest') loadGuestHistory(); }
        else if (scope === 'gchat'){ if (pchat) loadPChat(); }
    else if (scope === 'apply'){ renderCvCard(); if (apChatId) laadApplyChat(); }
    else if (scope === 'chat'){ if (user.account) renderChat(); }
    else if (scope === 'tickets'){ laadTickets(); }
    else if (scope === 'huur'){ laadVerhuur(); }
    else if (scope === 'charter'){ laadCharter(); }
    else if (scope === 'groothandel'){ laadBoodschappen(); }
    else if (scope === 'verkoop'){ laadShowroom(); }
    else if (scope === 'contract'){ laadContracten(); }
    else if (scope === 'vastgoed'){ laadVastgoed(); }
    else if (scope === 'care'){ laadCare(); }
    else if (scope === 'live'){ renderLive(); laadTickets(); }
    else if (scope === 'paspoort'){ laadPaspoortInbox(); }
    else if (scope === 'ontmoeting'){ laadOntmoet(); }
    else { renderPay(); renderHome(); renderTrip(); renderSalon(); renderTerPlaatse(); if (user.account) renderChat(); laadPaspoortInbox(); laadOntmoet(); }
  }

  function timeAgo(iso){
    const s = Math.max(1, Math.round((Date.now() - new Date(iso)) / 1000));
    if (s < 60) return T('t.now','zojuist');
    const ago = T('t.ago',' geleden');
    const m = Math.round(s / 60);
    if (m < 60) return m + T('t.min',' min') + ago;
    const h = Math.round(m / 60);
    if (h < 24) return h + T('t.hour',' uur') + ago;
    return Math.round(h / 24) + T('t.days',' dag(en)') + ago;
  }

  function renderBell(){
    const R = window.RTGRealtime;
    if (!R) return;
    const n = R.unread();
    const badge = $('#bellBadge');
    badge.style.display = n > 0 ? 'flex' : 'none';
    badge.textContent = n > 9 ? '9+' : n;
    const list = $('#notifList');
    list.innerHTML = R.notifications.length
      ? R.notifications.map(x =>
          '<div class="notif-item' + (x.read ? '' : ' unread') + '">' +
            '<div class="ic">' + (x.icon || '•') + '</div>' +
            '<div class="tx"><b>' + x.title + '</b><span>' + x.body + '</span><time>' + timeAgo(x.at) + '</time></div>' +
          '</div>').join('')
      : '<div class="notif-empty">'+T('app.nonotif','Nog geen meldingen. Zodra iemand op uw post reageert of u een bericht stuurt, ziet u het hier.')+'</div>';
    const pb = $('#notifPush');
    const st = R.pushState();
    if (st === 'on'){ pb.textContent = '✓ '+T('app.pushon','Push aan'); pb.classList.add('on'); }
    else if (st === 'unsupported'){ pb.style.display = 'none'; }
    else { pb.textContent = T('app.pushenable','Push aanzetten'); pb.classList.remove('on'); }
  }

  function openNotif(open){
    $('#notifPanel').classList.toggle('open', open);
    $('#notifScrim').classList.toggle('open', open);
    if (open && window.RTGRealtime && RTGRealtime.unread() > 0){
      RTGRealtime.markRead();
      renderBell();
    }
  }
  $('#bell').addEventListener('click', () => openNotif(true));
  $('#notifScrim').addEventListener('click', () => openNotif(false));
  $('#notifPush').addEventListener('click', async () => {
    if (!window.RTGRealtime) return;
    const r = await RTGRealtime.enablePush();
    toast(r === 'on' ? T('app.pushtoast.on','Push-notificaties staan aan.') : r === 'denied' ? T('app.pushtoast.denied','Toestemming geweigerd, zet meldingen aan in uw instellingen.') : T('app.pushtoast.no','Push is hier niet beschikbaar.'));
    renderBell();
  });

  document.querySelectorAll('.tabbar button').forEach(b =>
    b.addEventListener('click', () => openTab(b.dataset.tab, true)));
  $('#codeChip').addEventListener('click', () => { openTab('home'); toggleWhy(true); });

  function openTab(tab, focusView){
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.dataset.view === tab));
    document.querySelectorAll('.tabbar button').forEach(b => {
      const on = b.dataset.tab === tab;
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

  function renderAll(){
    $('#codeChipTxt').textContent = user.codename;
    // gratis gebruiker (zonder pas): reizen, betalen en AI zijn voor leden
    const guest = user.tier === 'guest';
    ['reizen','betalen','ai','assets','zorg'].forEach(t => { const b = document.querySelector('.tabbar button[data-tab="'+t+'"]'); if (b) b.style.display = guest ? 'none' : ''; });
    renderHome();
    if (!guest){ renderTrip(); renderPay(); renderAI(); renderAssets(); renderFluister(); }
    renderSalon();
    renderTerPlaatse();
    laadBestellen();
    laadBoodschappen();
    laadShowroom();
    laadTickets();
    laadVerhuur();
    laadCharter();
    laadContracten();
    laadVastgoed();
    if (!guest) laadCare();
    loadCv();
    loadVacatures();
    laadOntmoet();
    openTab('home');
    if ((rtf.gekoppeld || []).length) ensurePush(false); // stil vernieuwen als het al aan staat
  }

  /* ---------- tickets: activiteiten, tours en musea ---------- */
  let tkPartners = [], tkOpen = null, tkKeuze = null;
  async function laadTickets(){
    if (!API.live) return;
    try { tkPartners = (await API.call('/tickets/aanbod')).partners || []; } catch(e){ tkPartners = []; }
    let mijn = [];
    try { mijn = (await API.call('/tickets/mijn')).tickets || []; } catch(e){}
    const mijnEl = $('#tkMijn');
    if (mijnEl) mijnEl.innerHTML = mijn.filter(t => !t.gebruikt || t.datum >= new Date().toISOString().slice(0, 10)).map(t =>
      '<div class="card" style="border-color:rgba(208,172,87,0.35);">'+
      '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);">\uD83C\uDF9F\uFE0F '+T('tk.ticket','Ticket')+' \u00B7 '+esc(t.supplierName)+'</div>'+
      '<div style="margin-top:0.35rem;font-size:0.92rem;"><b>'+esc(t.naam)+'</b> \u00B7 '+t.datum+' '+t.tijd+' \u00B7 '+t.personen+'p</div>'+
      (t.gebruikt
        ? '<div style="margin-top:0.4rem;font-size:0.8rem;color:var(--green);">\u2705 '+T('tk.gebruikt','Binnen; ingecheckt door ')+esc(t.checkin.door)+'</div>'
        : '<div style="margin-top:0.5rem;text-align:center;background:rgba(208,172,87,0.12);border:1px dashed rgba(208,172,87,0.5);border-radius:12px;padding:0.55rem;">'+
          '<span style="font-size:1.3rem;letter-spacing:0.35em;color:var(--gold);font-weight:700;">'+esc(t.code)+'</span>'+
          '<div style="font-size:0.66rem;color:var(--soft);margin-top:0.2rem;">'+T('tk.laatzien','Laat deze code zien aan de deur')+'</div></div>')+
      // de eigen transferdienst van de zaak: aanvragen, of live zien wie er komt
      (t.transfer
        ? '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--muted);">\uD83D\uDE90 '+T('tk.tr','Transfer')+': <b style="color:var(--txt);">'+
          ({ 'wacht-op-betaling': T('tk.tr.betalen','nog betalen'), 'aangevraagd': T('tk.tr.aangevraagd','aangevraagd'), 'geaccepteerd': T('tk.tr.geacc','bevestigd'), 'onderweg': T('tk.tr.onderweg','onderweg naar u') }[t.transfer.status] || t.transfer.status)+'</b>'+
          (t.transfer.chauffeur ? ' \u00B7 '+esc(t.transfer.chauffeur) : '')+(t.transfer.etaMin ? ' \u00B7 \u23F1 '+t.transfer.etaMin+' min' : '')+
          (t.transfer.prijs ? ' \u00B7 '+eur(t.transfer.prijs) : ' \u00B7 '+T('tk.tr.incl','inclusief'))+'</div>'
        : (t.transferAan && !t.gebruikt
          ? '<div style="margin-top:0.55rem;display:flex;gap:0.4rem;">'+
            '<input id="trVan-'+t.ref+'" placeholder="'+T('tk.tr.vanph','Ophaaladres')+'" style="flex:1;background:var(--card2,var(--card));border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.7rem;font-size:0.8rem;color:var(--txt);outline:none;">'+
            '<button class="bz-btn" data-trvraag="'+t.ref+'" data-trprijs="'+t.transferPrijs+'">\uD83D\uDE90 '+(t.transferPrijs ? eur(t.transferPrijs) : T('tk.tr.gratis','Gratis'))+'</button></div>'
          : ''))+
      '</div>').join('');
    document.querySelectorAll('[data-trvraag]').forEach(b => b.addEventListener('click', async () => {
      const veld = document.getElementById('trVan-' + b.dataset.trvraag);
      try {
        const r = await API.call('/transfer/aanvraag', { ticketRef: b.dataset.trvraag, van: veld ? veld.value : '' });
        if (Number(b.dataset.trprijs) > 0) await API.call('/ride/pay', { ref: r.ride.ref });
        toast(T('tk.tr.ok','Transfer aangevraagd. U ziet hier wie u komt halen.'));
        laadTickets();
      } catch(e){ toast(e.message); }
    }));
    renderTkAanbod();
  }
  function renderTkAanbod(){
    const el = $('#tkAanbod'); if (!el) return;
    if (!tkPartners.length){ el.innerHTML = ''; return; }
    let html = '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.1rem 0 0.5rem;">'+T('tk.kop','Activiteiten, tours en musea')+'</div>';
    for (const p of tkPartners){
      html += '<div class="card"><b>'+esc(p.name)+'</b> <span class="soft-sm">\u00B7 '+esc(p.city||'')+'</span>';
      for (const a of p.activiteiten){
        const open = tkOpen === p.code + ':' + a.id;
        html += '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.6rem;">'+
          '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><div style="flex:1;"><div style="font-size:0.88rem;">'+esc(a.name)+'</div>'+
          (a.desc?'<div class="soft-sm">'+esc(a.desc)+(a.duur?' \u00B7 '+esc(a.duur):'')+'</div>':'')+'</div>'+
          '<span style="color:var(--gold);font-size:0.82rem;white-space:nowrap;">'+eur(a.prijs)+' p.p.</span></div>';
        if (open){
          const k = tkKeuze;
          const dagen = [];
          for (let d = 0; d < 7; d++){ const dt = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10); dagen.push(dt); }
          html += '<div style="margin-top:0.5rem;">'+
            '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;">'+dagen.map(d =>
              '<button class="bz-btn'+(k.datum===d?' on':'')+'" data-tkd="'+d+'">'+(d===dagen[0]?T('tk.vandaag','vandaag'):d.slice(8)+'/'+d.slice(5,7))+'</button>').join('')+'</div>'+
            '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.45rem;">'+(a.tijden||[]).map(t2 =>
              '<button class="bz-btn'+(k.tijd===t2?' on':'')+'" data-tkt="'+t2+'">'+t2+'</button>').join('')+'</div>'+
            '<div style="display:flex;align-items:center;gap:0.6rem;margin-top:0.55rem;">'+
            '<span style="font-size:0.78rem;color:var(--muted);">'+T('tk.personen','Personen')+'</span>'+
            '<button class="bz-btn" data-tkp="-1" style="padding:0.2rem 0.7rem;">\u2212</button><b>'+k.personen+'</b><button class="bz-btn" data-tkp="1" style="padding:0.2rem 0.7rem;">+</button></div>'+
            '<button class="bz-groot" id="tkKoop" style="margin-top:0.7rem;"'+(k.tijd?'':' disabled')+'>'+T('tk.koop','Koop tickets')+' \u00B7 '+eur(a.prijs * k.personen)+'</button></div>';
        } else {
          html += '<button class="bz-btn" data-tkopen="'+p.code+':'+a.id+'" style="margin-top:0.45rem;">'+T('tk.kies','Kies datum en tijd')+'</button>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    el.innerHTML = html;
    document.querySelectorAll('[data-tkopen]').forEach(b => b.addEventListener('click', () => {
      tkOpen = b.dataset.tkopen;
      tkKeuze = { datum: new Date().toISOString().slice(0, 10), tijd: null, personen: 2 };
      renderTkAanbod();
    }));
    document.querySelectorAll('[data-tkd]').forEach(b => b.addEventListener('click', () => { tkKeuze.datum = b.dataset.tkd; renderTkAanbod(); }));
    document.querySelectorAll('[data-tkt]').forEach(b => b.addEventListener('click', () => { tkKeuze.tijd = b.dataset.tkt; renderTkAanbod(); }));
    document.querySelectorAll('[data-tkp]').forEach(b => b.addEventListener('click', () => {
      tkKeuze.personen = Math.min(10, Math.max(1, tkKeuze.personen + Number(b.dataset.tkp))); renderTkAanbod();
    }));
    const koop = document.getElementById('tkKoop');
    if (koop) koop.addEventListener('click', async () => {
      const [code, actId] = tkOpen.split(':');
      try {
        const t = await API.call('/ticket/koop', { supplierCode: code, activiteitId: actId, datum: tkKeuze.datum, tijd: tkKeuze.tijd, personen: tkKeuze.personen });
        await API.call('/booking/pay', { ref: t.ticket.ref });
        toast(T('tk.ok','Betaald! Uw entreecode: ') + t.ticket.code);
        tkOpen = null; tkKeuze = null;
        laadTickets();
      } catch(e){ toast(e.message); }
    });
  }

  /* ---------- Toren 4: Zorg & welzijn (RTG Care) ----------
     Een eigen tab: mijn boekingen, mijn intake-delingen, herstelpakketten
     en het aanbod van spa's, wellness en klinieken. Boeken kiest een dag en
     tijdslot bij een behandelaar; betalen loopt via RTG Pay. Het zorgprofiel
     reist automatisch mee; medische context deelt het lid apart en per
     aanbieder, met een einddatum en altijd te stoppen. */
  let careOv = null, careOpen = null, careKeuze = null, careIntakeTekst = {};
  let carePak = [], carePakMijn = [], carePakOpen = null, carePakKeuze = null;
  const careSoort = { spa: 'Spa', wellness: 'Wellness', kliniek: 'Kliniek' };
  async function laadCare(){
    if (!API.live) return;
    try { careOv = await API.call('/care', {}); } catch(e){ careOv = null; }
    let mijn = [];
    try { mijn = (await API.call('/care/mijn', {})).boekingen || []; } catch(e){}
    try { carePak = (await API.call('/care/pakketten', {})).pakketten || []; } catch(e){ carePak = []; }
    try { carePakMijn = (await API.call('/care/pakket/mijn', {})).pakketten || []; } catch(e){ carePakMijn = []; }
    renderCareMijn(mijn);
    renderCareIntakes();
    renderCarePakketten();
    renderCareAanbod();
  }
  function renderCareMijn(mijn){
    const el = $('#careMijn'); if (!el) return;
    if (!mijn.length){ el.innerHTML = ''; return; }
    el.innerHTML = '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:0 0 0.5rem;">'+T('care.mijn','Mijn afspraken')+'</div>'+
      mijn.map(b => '<div class="card" style="border-color:rgba(139,195,168,0.35);">'+
        '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--green,#8bc3a8);">🌿 '+esc(b.aanbiederNaam)+'</div>'+
        '<div style="margin-top:0.35rem;font-size:0.92rem;"><b>'+esc(b.behandelingNaam)+'</b>'+(b.behandelaarNaam?' · '+esc(b.behandelaarNaam):'')+'</div>'+
        '<div class="soft-sm" style="margin-top:0.15rem;">'+b.datum+' · '+b.tijd+' · '+eur(b.prijs)+' · '+
          (b.paid ? '<span style="color:var(--green,#8bc3a8);">'+T('care.betaald','betaald')+'</span>' : '<span style="color:var(--gold);">'+T('care.tebetalen','nog te betalen')+'</span>')+'</div>'+
        '<div style="display:flex;gap:0.4rem;margin-top:0.55rem;">'+
          (b.paid ? '' : '<button class="bz-groot" data-care-pay="'+esc(b.ref)+'" style="flex:1;">'+T('care.betaal','Betaal')+' · '+eur(b.prijs)+'</button>')+
          '<button class="bz-btn" data-care-annul="'+esc(b.ref)+'">'+T('care.annuleer','Annuleer')+'</button>'+
        '</div></div>').join('');
    el.querySelectorAll('[data-care-pay]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/care/betaal', { ref: x.dataset.carePay }); toast(T('care.paytoast','Betaald. Tot uw afspraak.')); laadCare(); }
      catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-care-annul]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/care/annuleer', { ref: x.dataset.careAnnul }); toast(T('care.annultoast','Afspraak geannuleerd.')); laadCare(); }
      catch(e){ toast(e.message); }
    }));
  }
  function renderCareIntakes(){
    const el = $('#careIntakes'); if (!el) return;
    const list = (careOv && careOv.intakes) || [];
    if (!list.length){ el.innerHTML = ''; return; }
    el.innerHTML = '<div class="card" style="border-color:rgba(208,172,87,0.3);">'+
      '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);">🩺 '+T('care.intakes','Gedeelde medische context')+'</div>'+
      list.map(i => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-top:0.5rem;">'+
        '<div style="font-size:0.85rem;">'+esc(i.aanbiederNaam)+'<div class="soft-sm">'+T('care.tot','tot')+' '+i.vervaltOp+'</div></div>'+
        '<button class="bz-btn" data-care-intakestop="'+esc(i.id)+'">'+T('care.stopdelen','Stop delen')+'</button></div>').join('')+
      '</div>';
    el.querySelectorAll('[data-care-intakestop]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/care/intake/stop', { id: x.dataset.careIntakestop }); toast(T('care.stoptoast','Deling gestopt. Weg is weg.')); laadCare(); }
      catch(e){ toast(e.message); }
    }));
  }
  function renderCareAanbod(){
    const el = $('#careAanbod'); if (!el) return;
    const aanb = (careOv && careOv.aanbieders) || [];
    if (!aanb.length){ el.innerHTML = ''; return; }
    const dagen = [];
    for (let d = 0; d < 7; d++){ dagen.push(new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)); }
    let html = '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.1rem 0 0.5rem;">'+T('care.aanbod','Spa’s, wellness en klinieken')+'</div>';
    for (const a of aanb){
      const medisch = a.soort === 'kliniek' || (a.behandelingen || []).some(b => b.soort === 'medisch');
      html += '<div class="card"><div style="display:flex;gap:0.5rem;align-items:baseline;"><span style="font-size:1.1rem;">'+esc(a.icon||'🌿')+'</span>'+
        '<div style="flex:1;"><b>'+esc(a.naam)+'</b> <span class="soft-sm">· '+esc(careSoort[a.soort]||a.soort)+(a.waar?' · '+esc(a.waar):'')+'</span>'+
        (a.beschrijving?'<div class="soft-sm" style="margin-top:0.15rem;">'+esc(a.beschrijving)+'</div>':'')+
        ((a.behandelaars||[]).length?'<div class="soft-sm" style="margin-top:0.2rem;">👤 '+a.behandelaars.map(b => esc(b.naam)+(b.functie?' ('+esc(b.functie)+')':'')).join(' · ')+'</div>':'')+'</div></div>';
      // intake-deling voor klinieken/medische zorg: uitdrukkelijk en per aanbieder
      if (medisch){
        const actief = !!a.intakeActief;
        html += '<div style="margin-top:0.6rem;border-top:1px solid var(--line);padding-top:0.6rem;">'+
          '<div class="soft-sm" style="margin-bottom:0.35rem;">🩺 '+(actief
            ? T('care.intakeaan','U deelt medische context met deze kliniek. U kunt dit bij Mijn afspraken stoppen.')
            : T('care.intakeuit','Wilt u dat de behandelaar iets weet (medicijnen, allergie, aandoening)? Deel het apart en alleen met deze kliniek.'))+'</div>'+
          (actief ? '' :
            '<textarea data-care-intaketxt="'+esc(a.id)+'" rows="2" placeholder="'+T('care.intakeph','Bijv. ik gebruik bloedverdunners en ben allergisch voor penicilline')+'" style="width:100%;box-sizing:border-box;background:var(--card2,var(--card));border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.7rem;font-size:0.8rem;color:var(--txt);outline:none;resize:vertical;">'+esc(careIntakeTekst[a.id]||'')+'</textarea>'+
            '<button class="bz-btn" data-care-intakedeel="'+esc(a.id)+'" style="margin-top:0.4rem;">'+T('care.intakedeel','Deel met deze kliniek')+'</button>')+
          '</div>';
      }
      for (const b of (a.behandelingen || [])){
        const open = careOpen === a.id + ':' + b.id;
        const behlr = (a.behandelaars || []).find(x => x.id === b.behandelaarId);
        html += '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.6rem;">'+
          '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><div style="flex:1;"><div style="font-size:0.88rem;">'+esc(b.naam)+
            ' <span style="font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:'+(b.soort==='medisch'?'var(--gold)':'var(--green,#8bc3a8)')+';">'+(b.soort==='medisch'?T('care.med','medisch'):T('care.well','wellness'))+'</span></div>'+
            '<div class="soft-sm">'+b.duurMin+' '+T('care.min','min')+(behlr?' · '+esc(behlr.naam):'')+'</div></div>'+
            '<span style="color:var(--gold);font-size:0.82rem;white-space:nowrap;">'+eur(b.prijs)+'</span></div>';
        if (open){
          const k = careKeuze;
          html += '<div style="margin-top:0.5rem;">'+
            '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;">'+dagen.map(d =>
              '<button class="bz-btn'+(k.datum===d?' on':'')+'" data-cared="'+d+'">'+(d===dagen[0]?T('care.vandaag','vandaag'):d.slice(8)+'/'+d.slice(5,7))+'</button>').join('')+'</div>'+
            '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.45rem;">'+(b.tijden||[]).map(t2 =>
              '<button class="bz-btn'+(k.tijd===t2?' on':'')+'" data-caret="'+t2+'">'+t2+'</button>').join('')+'</div>'+
            '<button class="bz-groot" id="careBoek" style="margin-top:0.7rem;"'+(k.tijd?'':' disabled')+'>'+T('care.boek','Boek en betaal')+' · '+eur(b.prijs)+'</button></div>';
        } else {
          html += '<button class="bz-btn" data-careopen="'+a.id+':'+b.id+'" style="margin-top:0.45rem;">'+T('care.kies','Kies dag en tijd')+'</button>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-care-intaketxt]').forEach(t => t.addEventListener('input', () => { careIntakeTekst[t.dataset.careIntaketxt] = t.value; }));
    el.querySelectorAll('[data-care-intakedeel]').forEach(x => x.addEventListener('click', async () => {
      const id = x.dataset.careIntakedeel;
      try { await API.call('/care/intake/deel', { aanbiederId: id, medisch: careIntakeTekst[id] || '' }); careIntakeTekst[id] = ''; toast(T('care.deeltoast','Gedeeld. Alleen deze kliniek ziet het, tot u stopt.')); laadCare(); }
      catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-careopen]').forEach(x => x.addEventListener('click', () => {
      careOpen = x.dataset.careopen; careKeuze = { datum: dagen[0], tijd: null }; renderCareAanbod();
    }));
    el.querySelectorAll('[data-cared]').forEach(x => x.addEventListener('click', () => { careKeuze.datum = x.dataset.cared; renderCareAanbod(); }));
    el.querySelectorAll('[data-caret]').forEach(x => x.addEventListener('click', () => { careKeuze.tijd = x.dataset.caret; renderCareAanbod(); }));
    const boek = document.getElementById('careBoek');
    if (boek) boek.addEventListener('click', async () => {
      const [aanbiederId, behandelingId] = careOpen.split(':');
      try {
        const r = await API.call('/care/boek', { aanbiederId, behandelingId, datum: careKeuze.datum, tijd: careKeuze.tijd });
        await API.call('/care/betaal', { ref: r.boeking.ref });
        toast(T('care.oktoast','Geboekt en betaald. Tot uw afspraak.'));
        careOpen = null; careKeuze = null;
        laadCare();
      } catch(e){ toast(e.message); }
    });
  }
  function renderCarePakketten(){
    const el = $('#carePakketten'); if (!el) return;
    if (!carePak.length && !carePakMijn.length){ el.innerHTML = ''; return; }
    const dagen = [];
    for (let d = 0; d < 7; d++){ dagen.push(new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)); }
    let html = '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.1rem 0 0.5rem;">'+T('care.pakketten','Herstel- & verblijfpakketten')+'</div>';
    // mijn geboekte pakketten
    for (const b of carePakMijn){
      html += '<div class="card" style="border-color:rgba(194,58,94,0.3);">'+
        '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--burgundy);">🌸 '+T('care.pakket','Pakket')+'</div>'+
        '<div style="margin-top:0.3rem;font-size:0.92rem;"><b>'+esc(b.naam)+'</b></div>'+
        '<div class="soft-sm">'+b.nachten+' '+T('care.nachten','nachten')+' · '+esc(b.hotelNaam)+' · '+b.datum+' '+b.tijd+' · '+eur(b.prijs)+
          ' · '+(b.paid?'<span style="color:var(--green,#8bc3a8);">'+T('care.betaald','betaald')+'</span>':'<span style="color:var(--gold);">'+T('care.tebetalen','nog te betalen')+'</span>')+'</div>'+
        (b.paid?'':'<button class="bz-groot" data-carepakpay="'+esc(b.ref)+'" style="margin-top:0.5rem;">'+T('care.betaal','Betaal')+' · '+eur(b.prijs)+'</button>')+
        '</div>';
    }
    // aanbod
    for (const p of carePak){
      const open = carePakOpen === p.id;
      html += '<div class="card"><div style="display:flex;justify-content:space-between;gap:0.5rem;">'+
        '<div style="flex:1;"><b>'+esc(p.naam)+'</b>'+
        '<div class="soft-sm" style="margin-top:0.15rem;">'+esc(p.beschrijving)+'</div>'+
        '<div class="soft-sm" style="margin-top:0.25rem;">🏨 '+esc(p.hotelNaam)+' · '+p.nachten+' '+T('care.nachten','nachten')+' + '+esc(p.behandelingNaam)+' ('+p.duurMin+' min)</div></div>'+
        '<div style="text-align:right;white-space:nowrap;"><div style="color:var(--gold);font-size:0.95rem;">'+eur(p.prijs)+'</div>'+
        (p.bespaar>0?'<div class="soft-sm" style="color:var(--green,#8bc3a8);">'+T('care.bespaar','bespaar')+' '+eur(p.bespaar)+'</div>':'')+'</div></div>';
      if (open){
        const k = carePakKeuze;
        html += '<div style="margin-top:0.6rem;border-top:1px solid var(--line);padding-top:0.6rem;">'+
          '<div class="soft-sm" style="margin-bottom:0.35rem;">'+T('care.pakkies','Kies wanneer de behandeling valt:')+'</div>'+
          '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;">'+dagen.map(d =>
            '<button class="bz-btn'+(k.datum===d?' on':'')+'" data-carepakd="'+d+'">'+(d===dagen[0]?T('care.vandaag','vandaag'):d.slice(8)+'/'+d.slice(5,7))+'</button>').join('')+'</div>'+
          '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.45rem;">'+(p.tijden||[]).map(t2 =>
            '<button class="bz-btn'+(k.tijd===t2?' on':'')+'" data-carepakt="'+t2+'">'+t2+'</button>').join('')+'</div>'+
          '<button class="bz-groot" id="carePakBoek" style="margin-top:0.7rem;"'+(k.tijd?'':' disabled')+'>'+T('care.pakboek','Boek dit pakket')+' · '+eur(p.prijs)+'</button></div>';
      } else {
        html += '<button class="bz-btn" data-carepakopen="'+esc(p.id)+'" style="margin-top:0.5rem;">'+T('care.pakkies2','Kies dag en tijd')+'</button>';
      }
      html += '</div>';
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-carepakpay]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/care/pakket/betaal', { ref: x.dataset.carepakpay }); toast(T('care.paktoast','Pakket betaald. Fijn verblijf.')); laadCare(); }
      catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-carepakopen]').forEach(x => x.addEventListener('click', () => {
      carePakOpen = x.dataset.carepakopen; carePakKeuze = { datum: dagen[0], tijd: null }; renderCarePakketten();
    }));
    el.querySelectorAll('[data-carepakd]').forEach(x => x.addEventListener('click', () => { carePakKeuze.datum = x.dataset.carepakd; renderCarePakketten(); }));
    el.querySelectorAll('[data-carepakt]').forEach(x => x.addEventListener('click', () => { carePakKeuze.tijd = x.dataset.carepakt; renderCarePakketten(); }));
    const pb = document.getElementById('carePakBoek');
    if (pb) pb.addEventListener('click', async () => {
      try {
        const r = await API.call('/care/pakket/boek', { pakketId: carePakOpen, datum: carePakKeuze.datum, tijd: carePakKeuze.tijd });
        await API.call('/care/pakket/betaal', { ref: r.pakket.ref });
        toast(T('care.paktoast','Pakket betaald. Fijn verblijf.'));
        carePakOpen = null; carePakKeuze = null;
        laadCare();
      } catch(e){ toast(e.message); }
    });
  }

  /* ---------- autoverhuur: eerlijk huren ---------- */
  let vhPartners = [], vhOpen = null, vhKeuze = null, vhLocWatch = {};
  function vhFotoKlein(file, cb){
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => {
      const c = document.createElement('canvas'); const sc = Math.min(1, 900 / Math.max(img.width, img.height));
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL('image/jpeg', 0.7));
    }; img.src = r.result; };
    r.readAsDataURL(file);
  }
  async function laadVerhuur(){
    if (!API.live) return;
    try { vhPartners = (await API.call('/verhuur/aanbod')).partners || []; } catch(e){ vhPartners = []; }
    let mijn = [];
    try { mijn = (await API.call('/huur/mijn')).huren || []; } catch(e){}
    const el = $('#vhMijn');
    const VH_ST = { 'aangevraagd': T('vh.m.geboekt','geboekt; leg de staat vast bij het ophalen'), 'lopend': T('vh.m.lopend','onderweg; goede reis'), 'afgerond': T('vh.m.af','afgerond') };
    if (el) el.innerHTML = mijn.filter(h => h.status !== 'afgerond' || h.tot >= new Date().toISOString().slice(0, 10)).map(h =>
      '<div class="card" style="border-color:rgba(91,185,140,0.35);">'+
      '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--green);">\uD83D\uDE97 '+T('vh.m.kop','Huurauto')+' \u00B7 '+esc(h.supplierName)+'</div>'+
      '<div style="margin-top:0.35rem;font-size:0.92rem;"><b>'+esc(h.auto)+'</b>'+(h.kenteken?' ('+esc(h.kenteken)+')':'')+' \u00B7 '+h.van+' \u2192 '+h.tot+' \u00B7 '+eur(h.prijs)+'</div>'+
      (h.spec ? '<div style="margin-top:0.25rem;font-size:0.72rem;color:var(--soft);">'+esc(h.spec.categorie||'')+' \u00B7 '+(h.spec.transmissie==='automaat'?T('vh.aut','automaat'):T('vh.hand','handgesch.'))+' \u00B7 \uD83D\uDC65'+(h.spec.stoelen||'-')+' \u00B7 '+(h.spec.kmPerDag?h.spec.kmPerDag+' km/'+T('vh.dag','dag'):T('vh.onbeperkt','onbeperkt km'))+(h.borg?' \u00B7 '+T('vh.borg','borg')+' '+eur(h.borg):'')+'</div>' : '')+
      '<div style="margin-top:0.3rem;font-size:0.78rem;color:var(--muted);">'+(VH_ST[h.status]||h.status)+' \u00B7 \uD83D\uDCF7 '+T('vh.m.voor','voor')+' '+h.fotosVoor+' \u00B7 '+T('vh.m.na','na')+' '+h.fotosNa+(h.uitgifte?' \u00B7 '+h.uitgifte.kmStart+' km':'')+'</div>'+
      (h.inname ? '<div style="margin-top:0.25rem;font-size:0.78rem;color:'+(h.inname.meerkosten>0?'var(--gold)':'var(--green)')+';">'+(h.inname.meerkosten>0 ? T('vh.m.meer','Meerkosten')+': '+eur(h.inname.meerkosten)+' ('+h.inname.gereden+' km)' : '\u2713 '+h.inname.gereden+' km \u00B7 '+T('vh.m.geenmeer','geen meerkosten, borg vrij'))+'</div>' : '')+
      (h.status !== 'afgerond' ?
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.55rem;">'+
        (h.status === 'aangevraagd' ? '<button class="bz-btn" data-vhf="'+h.ref+'" data-fase="voor">\uD83D\uDCF7 '+T('vh.m.fotovoor','Staat vastleggen (voor)')+'</button>' : '')+
        (h.status === 'lopend' ? '<button class="bz-btn" data-vhf="'+h.ref+'" data-fase="na">\uD83D\uDCF7 '+T('vh.m.fotona','Staat vastleggen (na)')+'</button>'+
          '<button class="bz-btn'+(h.locatieAan?' on':'')+'" data-vhloc="'+h.ref+'" data-aan="'+(h.locatieAan?'0':'1')+'">\uD83D\uDCCD '+(h.locatieAan?T('vh.m.locuit','Locatie delen uit'):T('vh.m.locaan','Deel live locatie'))+'</button>' : '')+
        '<button data-vhsos="'+h.ref+'" style="background:var(--burgundy-deep);border:1px solid var(--burgundy);color:#fff;border-radius:999px;padding:0.5rem 1rem;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;">\uD83C\uDD98 SOS</button>'+
        '</div>' : '')+
      '</div>').join('');
    renderVhAanbod();
    koppelVhActies();
  }
  function koppelVhActies(){
    const file = (() => { let f = document.getElementById('vhLidFile');
      if (!f){ f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.capture = 'environment'; f.id = 'vhLidFile'; f.style.display = 'none'; document.body.appendChild(f); }
      return f; })();
    document.querySelectorAll('[data-vhf]').forEach(b => b.addEventListener('click', () => {
      file.onchange = () => {
        if (!file.files[0]) return;
        vhFotoKlein(file.files[0], async (dataUrl) => {
          try { await API.call('/huur/foto', { ref: b.dataset.vhf, fase: b.dataset.fase, foto: dataUrl });
            toast(T('vh.m.foto.ok','Vastgelegd. Dit is uw bewijs van de staat.')); laadVerhuur(); }
          catch(e){ toast(e.message); }
        });
        file.value = '';
      };
      file.click();
    }));
    document.querySelectorAll('[data-vhsos]').forEach(b => b.addEventListener('click', () => {
      const bericht = prompt(T('vh.m.sosvraag','Wat is er aan de hand? (gaat direct naar de verhuurder EN naar RTG)'));
      if (bericht == null) return;
      const stuur = (lat, lng) => API.call('/huur/sos', { ref: b.dataset.vhsos, bericht, lat, lng })
        .then(() => toast(T('vh.m.sosok','SOS verstuurd. De verhuurder en RTG zijn gewaarschuwd.')))
        .catch(e => toast(e.message));
      if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => stuur(p.coords.latitude, p.coords.longitude), () => stuur());
      else stuur();
    }));
    document.querySelectorAll('[data-vhloc]').forEach(b => b.addEventListener('click', async () => {
      const ref = b.dataset.vhloc, aan = b.dataset.aan === '1';
      try {
        if (aan && navigator.geolocation){
          vhLocWatch[ref] = navigator.geolocation.watchPosition(p =>
            API.call('/huur/locatie', { ref, aan: true, lat: p.coords.latitude, lng: p.coords.longitude }).catch(()=>{}));
          await API.call('/huur/locatie', { ref, aan: true });
        } else {
          if (vhLocWatch[ref] != null){ navigator.geolocation.clearWatch(vhLocWatch[ref]); delete vhLocWatch[ref]; }
          await API.call('/huur/locatie', { ref, aan: false });
        }
        toast(aan ? T('vh.m.locaanok','U deelt uw locatie met de verhuurder; uitzetten kan altijd.') : T('vh.m.locuitok','Locatie delen staat uit en is gewist.'));
        laadVerhuur();
      } catch(e){ toast(e.message); }
    }));
  }
  function renderVhAanbod(){
    const el = $('#vhAanbod'); if (!el) return;
    if (!vhPartners.length){ el.innerHTML = ''; return; }
    let html = '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.1rem 0 0.5rem;">'+T('vh.kop','Autoverhuur, RTG-veilig')+'</div>'+
      '<div style="font-size:0.72rem;color:var(--soft);margin-bottom:0.5rem;">'+T('vh.uitleg','Vaste prijs vooraf betaald. Staat vastgelegd met foto\'s voor en na. SOS-knop en RTG als scheidsrechter.')+'</div>';
    for (const p of vhPartners){
      html += '<div class="card"><b>'+esc(p.name)+'</b> <span class="soft-sm">\u00B7 '+esc(p.city||'')+'</span>';
      for (const a of p.autos){
        const open = vhOpen === p.code + ':' + a.id;
        html += '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.6rem;">'+
          '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><div style="font-size:0.88rem;">'+(a.icoon||'\uD83D\uDE97')+' '+esc(a.name)+'</div>'+
          '<span style="color:var(--gold);font-size:0.82rem;white-space:nowrap;">'+eur(a.dagprijs)+'/'+T('vh.dag','dag')+'</span></div>'+
          '<div style="font-size:0.7rem;color:var(--soft);margin-top:0.2rem;">'+esc(a.categorie||'')+' \u00B7 '+(a.transmissie==='automaat'?T('vh.aut','automaat'):T('vh.hand','handgesch.'))+' \u00B7 '+esc(a.brandstof||'')+' \u00B7 \uD83D\uDC65'+(a.stoelen||'-')+' \u00B7 \uD83E\uDDF3'+(a.bagage||0)+(a.airco?' \u00B7 \u2744\uFE0F':'')+
          ' \u00B7 '+(a.kmPerDag?a.kmPerDag+' km/'+T('vh.dag','dag'):T('vh.onbeperkt','onbeperkt km'))+' \u00B7 '+T('vh.borg','borg')+' '+eur(a.borg||0)+'</div>'+
          (a.apk && a.apk.bekend ? '<div style="font-size:0.68rem;margin-top:0.25rem;color:'+(a.apk.geldig?'var(--green)':'var(--gold)')+';">\uD83D\uDEE1\uFE0F RDW '+(a.apk.geldig?T('vh.apkok','APK geldig'):T('vh.apkuit','APK verloopt'))+' \u00B7 '+T('vh.apktot','tot')+' '+esc(a.apk.apkTot)+'</div>' : '');
        if (open){
          html += '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;">'+
            '<div class="bz-veld" style="flex:1;margin-top:0;"><label>'+T('vh.van','Ophalen')+'</label><input type="date" id="vhVan" value="'+vhKeuze.van+'"></div>'+
            '<div class="bz-veld" style="flex:1;margin-top:0;"><label>'+T('vh.tot','Inleveren')+'</label><input type="date" id="vhTot" value="'+vhKeuze.tot+'"></div></div>'+
            '<button class="bz-groot" id="vhBoek" style="margin-top:0.7rem;">'+T('vh.boek','Boek en betaal, vaste prijs')+'</button>';
        } else {
          html += '<button class="bz-btn" data-vhopen="'+p.code+':'+a.id+'" style="margin-top:0.45rem;">'+T('vh.kies','Kies periode')+'</button>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    el.innerHTML = html;
    document.querySelectorAll('[data-vhopen]').forEach(b => b.addEventListener('click', () => {
      vhOpen = b.dataset.vhopen;
      const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const overmorgen = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
      vhKeuze = { van: morgen, tot: overmorgen };
      renderVhAanbod(); koppelVhActies();
    }));
    const boek = document.getElementById('vhBoek');
    if (boek) boek.addEventListener('click', async () => {
      const [code, autoId] = vhOpen.split(':');
      try {
        const h = await API.call('/huur/boek', { supplierCode: code, autoId, van: $('#vhVan').value, tot: $('#vhTot').value });
        await API.call('/booking/pay', { ref: h.huur.ref });
        toast(T('vh.ok','Geboekt en betaald: ') + eur(h.huur.price) + T('vh.ok2',' vast, geen verrassingen aan de balie.'));
        vhOpen = null; vhKeuze = null;
        laadVerhuur();
      } catch(e){ toast(e.message); }
    });
  }

  /* ---------- charter: boten en jachten huren ---------- */
  let chPartners = [], chOpen = null, chKeuze = null, chLocWatch = {};
  async function laadCharter(){
    if (!API.live) return;
    try { chPartners = (await API.call('/charter/aanbod')).partners || []; } catch(e){ chPartners = []; }
    let mijn = [];
    try { mijn = (await API.call('/charter/mijn')).charters || []; } catch(e){}
    const el = $('#chMijn');
    const CH_ST = { 'aangevraagd': T('ch.m.geboekt','geboekt; leg de staat vast bij het uitvaren'), 'lopend': T('ch.m.lopend','op zee; behouden vaart'), 'afgerond': T('ch.m.af','afgerond') };
    if (el) el.innerHTML = mijn.filter(c => c.status !== 'afgerond' || c.tot >= new Date().toISOString().slice(0, 10)).map(c =>
      '<div class="card" style="border-color:rgba(91,185,140,0.35);">'+
      '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--green);">⛵ '+T('ch.m.kop','Charter')+' · '+esc(c.supplierName)+'</div>'+
      '<div style="margin-top:0.35rem;font-size:0.92rem;"><b>'+esc(c.boot)+'</b> ('+esc(c.type)+') · '+c.van+' → '+c.tot+' · '+eur(c.prijs)+'</div>'+
      (c.spec ? '<div style="margin-top:0.25rem;font-size:0.72rem;color:var(--soft);">'+(c.spec.lengte||0)+'m · 👥'+(c.spec.gasten||'-')+(c.spec.hutten?' · 🛏️'+c.spec.hutten:'')+' · '+(c.spec.snelheidKn||0)+' kn · '+esc(c.spec.ligplaats||'')+(c.borg?' · '+T('ch.borg','borg')+' '+eur(c.borg):'')+'</div>' : '')+
      '<div style="margin-top:0.3rem;font-size:0.78rem;color:var(--muted);">'+(c.metSkipper?'⚓ '+T('ch.m.metskipper','met schipper')+(c.skipperNaam?' ('+esc(c.skipperNaam)+')':''):T('ch.m.bareboat','bareboat'))+' · '+(CH_ST[c.status]||c.status)+' · 📷 '+c.fotosVoor+'/'+c.fotosNa+'</div>'+
      (c.teruggave ? '<div style="margin-top:0.25rem;font-size:0.78rem;color:'+(c.teruggave.meerkosten>0?'var(--gold)':'var(--green)')+';">'+(c.teruggave.meerkosten>0 ? T('ch.m.meer','Meerkosten')+': '+eur(c.teruggave.meerkosten) : '✓ '+T('ch.m.geenmeer','geen meerkosten, borg vrij'))+'</div>' : '')+
      (c.status !== 'afgerond' ?
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.55rem;">'+
        (c.status === 'aangevraagd' ? '<button class="bz-btn" data-chf="'+c.ref+'" data-fase="voor">📷 '+T('ch.m.fotovoor','Staat vastleggen (voor)')+'</button>' : '')+
        (c.status === 'lopend' ? '<button class="bz-btn" data-chf="'+c.ref+'" data-fase="na">📷 '+T('ch.m.fotona','Staat vastleggen (na)')+'</button>'+
          '<button class="bz-btn'+(c.locatieAan?' on':'')+'" data-chloc="'+c.ref+'" data-aan="'+(c.locatieAan?'0':'1')+'">📍 '+(c.locatieAan?T('ch.m.locuit','Positie delen uit'):T('ch.m.locaan','Deel live positie'))+'</button>' : '')+
        '<button data-chsos="'+c.ref+'" style="background:var(--burgundy-deep);border:1px solid var(--burgundy);color:#fff;border-radius:999px;padding:0.5rem 1rem;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;">🆘 SOS</button>'+
        '</div>' : '')+
      '</div>').join('');
    renderChAanbod();
    koppelChActies();
  }
  function koppelChActies(){
    const file = (() => { let f = document.getElementById('chLidFile');
      if (!f){ f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.capture = 'environment'; f.id = 'chLidFile'; f.style.display = 'none'; document.body.appendChild(f); }
      return f; })();
    document.querySelectorAll('[data-chf]').forEach(b => b.addEventListener('click', () => {
      file.onchange = () => {
        if (!file.files[0]) return;
        vhFotoKlein(file.files[0], async (dataUrl) => {
          try { await API.call('/charter/foto', { ref: b.dataset.chf, fase: b.dataset.fase, foto: dataUrl });
            toast(T('ch.m.foto.ok','Vastgelegd. Dit is uw bewijs van de staat.')); laadCharter(); }
          catch(e){ toast(e.message); }
        });
        file.value = '';
      };
      file.click();
    }));
    document.querySelectorAll('[data-chsos]').forEach(b => b.addEventListener('click', () => {
      const bericht = prompt(T('ch.m.sosvraag','Wat is er aan de hand? (gaat direct naar het charterbedrijf EN naar RTG)'));
      if (bericht == null) return;
      const stuur = (lat, lng) => API.call('/charter/sos', { ref: b.dataset.chsos, bericht, lat, lng })
        .then(() => toast(T('ch.m.sosok','SOS verstuurd. Het charterbedrijf en RTG zijn gewaarschuwd.')))
        .catch(e => toast(e.message));
      if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => stuur(p.coords.latitude, p.coords.longitude), () => stuur());
      else stuur();
    }));
    document.querySelectorAll('[data-chloc]').forEach(b => b.addEventListener('click', async () => {
      const ref = b.dataset.chloc, aan = b.dataset.aan === '1';
      try {
        if (aan && navigator.geolocation){
          chLocWatch[ref] = navigator.geolocation.watchPosition(p =>
            API.call('/charter/locatie', { ref, aan: true, lat: p.coords.latitude, lng: p.coords.longitude }).catch(()=>{}));
          await API.call('/charter/locatie', { ref, aan: true });
        } else {
          if (chLocWatch[ref] != null){ navigator.geolocation.clearWatch(chLocWatch[ref]); delete chLocWatch[ref]; }
          await API.call('/charter/locatie', { ref, aan: false });
        }
        toast(aan ? T('ch.m.locaanok','U deelt uw positie met het charterbedrijf; uitzetten kan altijd.') : T('ch.m.locuitok','Positie delen staat uit en is gewist.'));
        laadCharter();
      } catch(e){ toast(e.message); }
    }));
  }
  function renderChAanbod(){
    const el = $('#chAanbod'); if (!el) return;
    if (!chPartners.length){ el.innerHTML = ''; return; }
    let html = '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.1rem 0 0.5rem;">'+T('ch.kop','Boten & jachten, RTG-veilig')+'</div>'+
      '<div style="font-size:0.72rem;color:var(--soft);margin-bottom:0.5rem;">'+T('ch.uitleg','Vaste prijs vooraf. Met of zonder schipper (bareboat met vaarbewijs). Staat met foto\'s voor en na, SOS op zee en RTG als scheidsrechter.')+'</div>';
    for (const p of chPartners){
      html += '<div class="card"><b>'+esc(p.name)+'</b> <span class="soft-sm">· '+esc(p.city||'')+'</span>';
      for (const b of p.boten){
        const open = chOpen === p.code + ':' + b.id;
        html += '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.6rem;">'+
          '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><div style="font-size:0.88rem;">'+(b.icoon||'🛥️')+' '+esc(b.naam)+'</div>'+
          '<span style="color:var(--gold);font-size:0.82rem;white-space:nowrap;">'+eur(b.dagprijs)+'/'+T('ch.dag','dag')+'</span></div>'+
          '<div style="font-size:0.7rem;color:var(--soft);margin-top:0.2rem;">'+esc(b.type||'')+' · '+(b.lengte||0)+'m · 👥'+(b.gasten||'-')+(b.hutten?' · 🛏️'+b.hutten:'')+' · '+(b.snelheidKn||0)+' kn · '+esc(b.ligplaats||'')+' · '+T('ch.borg','borg')+' '+eur(b.borg||0)+
          ' · '+(b.skipperVerplicht?'⚓ '+T('ch.skipperv','schipper verplicht'):(b.vaarbewijsVereist?T('ch.vaarbewijs','vaarbewijs of schipper'):T('ch.vrij','vrij')))+'</div>';
        if (open){
          const verplicht = b.skipperVerplicht;
          html += '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;">'+
            '<div class="bz-veld" style="flex:1;margin-top:0;"><label>'+T('ch.van','Vanaf')+'</label><input type="date" id="chVan" value="'+chKeuze.van+'"></div>'+
            '<div class="bz-veld" style="flex:1;margin-top:0;"><label>'+T('ch.tot','Tot')+'</label><input type="date" id="chTot" value="'+chKeuze.tot+'"></div>'+
            '<div class="bz-veld" style="width:76px;margin-top:0;"><label>'+T('ch.gastn','Gasten')+'</label><input type="number" id="chGasten" min="1" max="'+(b.gasten||12)+'" value="'+Math.min(2,b.gasten||2)+'"></div></div>'+
            (verplicht
              ? '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.5rem;">⚓ '+T('ch.altijdskipper','Dit vaartuig vaart altijd met een schipper (+'+eur(b.skipperPrijsPerDag||0)+'/'+T('ch.dag','dag')+').')+'</div>'
              : '<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.8rem;margin-top:0.55rem;"><input type="checkbox" id="chSkipper"> ⚓ '+T('ch.wilskipper','Met schipper (+'+eur(b.skipperPrijsPerDag||0)+'/'+T('ch.dag','dag')+')')+'</label>'+
                '<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.8rem;margin-top:0.35rem;"><input type="checkbox" id="chVaarbewijs"> '+T('ch.hebvaarbewijs','Ik vaar bareboat en heb een geldig vaarbewijs')+'</label>')+
            '<button class="bz-groot" id="chBoek" style="margin-top:0.7rem;" data-verplicht="'+(verplicht?'1':'0')+'">'+T('ch.boek','Boek en betaal, vaste prijs')+'</button>';
        } else {
          html += '<button class="bz-btn" data-chopen="'+p.code+':'+b.id+'" style="margin-top:0.45rem;">'+T('ch.kies','Kies periode')+'</button>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    el.innerHTML = html;
    document.querySelectorAll('[data-chopen]').forEach(b => b.addEventListener('click', () => {
      chOpen = b.dataset.chopen;
      chKeuze = { van: new Date(Date.now() + 86400000).toISOString().slice(0, 10), tot: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) };
      renderChAanbod(); koppelChActies();
    }));
    const boek = document.getElementById('chBoek');
    if (boek) boek.addEventListener('click', async () => {
      const [code, bootId] = chOpen.split(':');
      const verplicht = boek.dataset.verplicht === '1';
      const metSkipper = verplicht || ($('#chSkipper') && $('#chSkipper').checked);
      const body = { supplierCode: code, bootId, van: $('#chVan').value, tot: $('#chTot').value, gasten: Number($('#chGasten').value), metSkipper };
      if (!metSkipper && $('#chVaarbewijs')) body.vaarbewijs = $('#chVaarbewijs').checked;
      try {
        const c = await API.call('/charter/boek', body);
        await API.call('/booking/pay', { ref: c.charter.ref });
        toast(T('ch.ok','Geboekt en betaald: ') + eur(c.charter.price) + T('ch.ok2',' vast. Behouden vaart.'));
        chOpen = null; chKeuze = null;
        laadCharter();
      } catch(e){ toast(e.message); }
    });
  }

  /* ---------- vastgoed: aanbod, interesse, bod, keyless ---------- */
  let vgOpen = null;
  const vgGeld = n => '\u20AC ' + Number(n||0).toLocaleString('nl-NL');
  async function laadVastgoed(){
    if (!API.live) return;
    let d = { panden: [], bezichtigingen: [], biedingen: [] };
    try { d = await API.call('/vastgoed/aanbod'); } catch(e){}
    const el = $('#vgMijn'); if (!el) return;
    if (!d.panden.length && !d.bezichtigingen.length && !d.biedingen.length){ el.innerHTML = ''; return; }
    const bodBij = pid => d.biedingen.filter(b => true); // biedingen zijn per pand niet gelinkt in de lijst; toon apart
    let html = '';
    // lopende bezichtigingen met keyless
    for (const b of d.bezichtigingen){
      if (b.status === 'afgewezen') continue;
      html += '<div class="card" style="border-color:rgba(91,185,140,0.4);">'+
        '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--green);">\uD83D\uDD11 '+T('vg.m.bez','Bezichtiging')+' \u00B7 '+esc(b.pand)+'</div>'+
        '<div style="margin-top:0.3rem;font-size:0.85rem;">'+({ 'aangevraagd': T('vg.m.aangevr','aangevraagd, wacht op bevestiging'), 'bevestigd': T('vg.m.bevestigd','bevestigd')+(b.moment?' \u00B7 '+String(b.moment).replace('T',' ').slice(0,16):''), 'afgewezen': T('vg.m.afgewezen','afgewezen') }[b.status] || b.status)+'</div>'+
        (b.keyless ? (b.keyless.actiefNu
          ? '<button class="bz-groot" style="margin-top:0.6rem;" data-vgkey="'+b.ref+'">\uD83D\uDD13 '+T('vg.m.open','Open de deur (keyless)')+'</button>'
          : '<div style="margin-top:0.4rem;font-size:0.76rem;color:var(--soft);">\uD83D\uDD12 '+T('vg.m.venster','Keyless toegang rond het afgesproken moment')+'</div>') : '')+
        '</div>';
    }
    // eigen biedingen
    for (const b of d.biedingen){
      html += '<div class="card"><div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);">\uD83D\uDCB0 '+T('vg.m.bod','Uw bod')+' \u00B7 '+esc(b.pand)+'</div>'+
        '<div style="margin-top:0.3rem;font-size:0.85rem;">'+vgGeld(b.bedrag)+' \u00B7 <b>'+({ 'open':T('vg.m.open2','in behandeling'),'geaccepteerd':T('vg.m.acc','geaccepteerd!'),'afgewezen':T('vg.m.afg','afgewezen'),'tegenbod':T('vg.m.tegen','tegenbod')+(b.tegenbod?' '+vgGeld(b.tegenbod):'') }[b.status]||b.status)+'</b></div></div>';
    }
    // aangeboden panden
    if (d.panden.length){
      html += '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.1rem 0 0.5rem;">\uD83C\uDFE1 '+T('vg.m.aanbod','Voor u: vastgoed')+'</div>';
      for (const p of d.panden){
        const open = vgOpen === p.supplierCode + ':' + p.id;
        html += '<div class="card">'+
          (p.fotos && p.fotos.length ? '<img src="'+p.fotos[0]+'" alt="" style="width:100%;border-radius:12px;margin-bottom:0.5rem;max-height:180px;object-fit:cover;">' : '')+
          '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><b>'+esc(p.titel)+(p.gericht?' <span style="font-size:0.6rem;color:var(--burgundy);">\u2605 '+T('vg.m.gericht','persoonlijk')+'</span>':'')+'</b>'+
          '<span style="color:var(--gold);white-space:nowrap;">'+vgGeld(p.prijs)+(p.transactie==='huur'?'/mnd':'')+'</span></div>'+
          '<div style="font-size:0.74rem;color:var(--soft);margin-top:0.2rem;">'+esc(p.soort)+' \u00B7 '+esc(p.plaats||'')+' \u00B7 \uD83D\uDECF\uFE0F'+(p.slaapkamers||0)+' \u00B7 \uD83D\uDEC1'+(p.badkamers||0)+' \u00B7 '+(p.oppervlakte||0)+'m\u00B2'+(p.zwembad?' \u00B7 \uD83C\uDFCA':'')+'</div>'+
          (open ? '<div style="margin-top:0.5rem;font-size:0.82rem;color:var(--muted);">'+escT(p.omschrijving||'')+'</div>'+
            (p.fotos && p.fotos.length > 1 ? '<div style="display:flex;gap:0.4rem;overflow-x:auto;margin-top:0.5rem;">'+p.fotos.slice(1).map(f=>'<img src="'+f+'" alt="" style="height:70px;border-radius:8px;">').join('')+'</div>' : '')+
            '<div style="display:flex;gap:0.5rem;margin-top:0.7rem;">'+
            '<button class="bz-groot" style="flex:1;" data-vgint="'+p.supplierCode+':'+p.id+'">\uD83D\uDC41\uFE0F '+T('vg.m.interesse','Bezichtigen')+'</button>'+
            '<button class="bz-btn" data-vgbod="'+p.supplierCode+':'+p.id+'">\uD83D\uDCB0 '+T('vg.m.doebod','Bod')+'</button></div>'
            : '<button class="bz-btn" data-vgopen="'+p.supplierCode+':'+p.id+'" style="margin-top:0.5rem;">'+T('vg.m.bekijk','Bekijk')+'</button>')+
          '</div>';
      }
    }
    el.innerHTML = html;
    document.querySelectorAll('[data-vgopen]').forEach(b => b.addEventListener('click', () => { vgOpen = b.dataset.vgopen; laadVastgoed(); }));
    document.querySelectorAll('[data-vgint]').forEach(b => b.addEventListener('click', async () => {
      const [code, pid] = b.dataset.vgint.split(':');
      const wens = prompt(T('vg.m.wensvraag','Wanneer zou u willen bezichtigen? (bijv. zaterdagochtend)'));
      if (wens === null) return;
      try { await API.call('/vastgoed/interesse', { supplierCode: code, pandId: pid, wens }); toast(T('vg.m.intok','De makelaar krijgt uw aanvraag en bevestigt een moment.')); laadVastgoed(); }
      catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-vgbod]').forEach(b => b.addEventListener('click', async () => {
      const [code, pid] = b.dataset.vgbod.split(':');
      const bod = prompt(T('vg.m.bodvraag','Uw bod in euro:'));
      if (!bod) return;
      try { await API.call('/vastgoed/bod', { supplierCode: code, pandId: pid, bedrag: Number(bod) }); toast(T('vg.m.bodok','Uw bod is verstuurd naar de makelaar.')); laadVastgoed(); }
      catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-vgkey]').forEach(b => b.addEventListener('click', async () => {
      try { const r = await API.call('/vastgoed/keyless', { ref: b.dataset.vgkey }); toast('\uD83D\uDD13 '+T('vg.m.geopend','De deur is open. Code: ')+r.code); }
      catch(e){ toast(e.message); }
    }));
  }

  /* ---------- contracten: digitaal ondertekenen ---------- */  /* ---------- contracten: digitaal ondertekenen ---------- */
  async function laadContracten(){
    if (!API.live) return;
    let lijst = [];
    try { lijst = (await API.call('/contracten/mijn')).contracten || []; } catch(e){}
    const el = $('#conMijn'); if (!el) return;
    const open = lijst.filter(c => c.status !== 'geweigerd');
    if (!open.length){ el.innerHTML = ''; return; }
    el.innerHTML = open.map(c =>
      '<div class="card" style="border-color:'+(c.getekendDoorMij?'rgba(91,185,140,0.4)':'rgba(208,172,87,0.5)')+';">'+
      '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:'+(c.getekendDoorMij?'var(--green)':'var(--gold)')+';">\uD83D\uDCDD '+esc(c.supplierName)+' \u00B7 '+T('con.'+c.soort, c.soort)+'</div>'+
      '<div style="margin-top:0.35rem;font-size:0.92rem;"><b>'+esc(c.titel)+'</b></div>'+
      (c.velden && c.velden.length ? '<div style="margin-top:0.2rem;font-size:0.76rem;color:var(--muted);">'+c.velden.map(v=>esc(v.label)+': '+esc(v.waarde)).join(' \u00B7 ')+'</div>' : '')+
      '<details style="margin-top:0.4rem;"><summary style="cursor:pointer;font-size:0.74rem;color:var(--gold);">'+T('con.lees','Lees de voorwaarden')+'</summary><div style="font-size:0.8rem;color:var(--muted);white-space:pre-wrap;margin-top:0.35rem;">'+escT(c.tekst)+'</div></details>'+
      (c.getekendDoorMij
        ? '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--green);">\u2705 '+(c.status==='getekend'?T('con.klaar','Getekend door beide partijen.'):T('con.wacht','U tekende; de zaak tekent nog.'))+'</div>'
        : '<div style="margin-top:0.6rem;display:flex;gap:0.5rem;"><button class="bz-groot" style="flex:1;" data-conteken="'+c.ref+'">'+T('con.teken','Ondertekenen')+'</button><button class="bz-btn" data-conweiger="'+c.ref+'">'+T('con.weiger','Weiger')+'</button></div>')+
      '</div>').join('');
    document.querySelectorAll('[data-conteken]').forEach(b => b.addEventListener('click', async () => {
      const naam = prompt(T('con.tekenvraag','Typ uw naam om digitaal te ondertekenen. Zo gaat u akkoord met de voorwaarden.'));
      if (!naam) return;
      try { await API.call('/contract/teken', { ref: b.dataset.conteken, naam, akkoord: true }); toast(T('con.tekenok','Getekend. Bedankt!')); laadContracten(); }
      catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-conweiger]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm(T('con.weigervraag','Dit contract weigeren?'))) return;
      try { await API.call('/contract/weiger', { ref: b.dataset.conweiger }); toast(T('con.weigerok','Geweigerd.')); laadContracten(); }
      catch(e){ toast(e.message); }
    }));
  }

  /* ---------- bestellen: de ophaal/bezorgdienst ---------- */
  let bzPartners = [], bzZaak = null, bzMand = {}, bzLevering = 'bezorgen', bzGeo = null, bzAdresW = '';
  async function laadBestellen(){
    if (!API.live) return;
    try { bzPartners = (await API.call('/bezorg/partners')).partners || []; } catch(e){ bzPartners = []; }
    renderBestellen();
    laadBzMijn();
  }

  // De exclusieve autoshowroom: bekijken, proefrit, kopen (bod/inruil/concierge)
  async function laadShowroom(){
    const el = $('#showroom'); if (!el || !API.live) return;
    if (user && user.tier === 'guest'){ el.innerHTML = ''; return; }
    let d, mijn;
    try { d = await API.call('/verkoop/showroom'); mijn = await API.call('/verkoop/mijn'); } catch(e){ el.innerHTML = ''; return; }
    const autos = d.autos || [];
    const deals = (mijn.deals || []).filter(x => !['gereden','afgeleverd','afgewezen','geannuleerd'].includes(x.status));
    if (!autos.length && !deals.length){ el.innerHTML = ''; return; }
    let h = '<h3 style="margin:1.6rem 0 0.3rem;font-size:1rem;">🚗 ' + T('vk.h','Autoshowroom') + '</h3><p class="sub" style="margin-bottom:0.6rem;">' + T('vk.sub','Exclusieve occasions. Proefrit, bod of inruil.') + '</p>';
    for (const d2 of deals){
      h += '<div style="border:1px solid var(--gold);border-radius:14px;padding:0.7rem 0.9rem;margin-bottom:0.7rem;"><div style="font-size:0.7rem;color:var(--gold);text-transform:uppercase;letter-spacing:0.08em;">' + (d2.soort==='koop'?'🔑 '+T('vk.koop','Koop'):'🚗 '+T('vk.proefritk','Proefrit')) + ' · ' + escT(d2.status) + '</div>' +
        '<div style="font-size:0.86rem;margin-top:0.2rem;">' + escT(d2.autoNaam) + (d2.prijs?' · € ' + d2.prijs.toLocaleString('nl-NL'):'') + (d2.moment?' · ' + escT(d2.moment):'') + '</div>' +
        (d2.soort==='koop' && d2.status==='aanvaard' ? '<button class="js-vkteken" data-ref="' + d2.ref + '" style="margin-top:0.5rem;background:var(--gold);color:#000;border:none;border-radius:10px;padding:0.5rem 0.9rem;font-weight:600;font-family:inherit;cursor:pointer;">✍️ ' + T('vk.teken','Koopcontract tekenen') + '</button>' : '') + '</div>';
    }
    h += autos.slice(0,20).map(a => '<div style="border:1px solid var(--line);border-radius:16px;padding:0.85rem;margin-bottom:0.7rem;" data-av="' + a.id + '">' +
      '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><b style="font-size:0.95rem;">' + (a.vip?'★ ':'') + escT(a.naam) + '</b><span style="font-weight:600;">€ ' + a.prijs.toLocaleString('nl-NL') + '</span></div>' +
      '<div class="sub">' + a.km.toLocaleString('nl-NL') + ' km · ' + escT(a.brandstof) + ' · ' + escT(a.transmissie) + (a.vermogenPk?' · ' + a.vermogenPk + ' pk':'') + (a.garantieMnd?' · ' + a.garantieMnd + ' mnd garantie':'') + '</div>' +
      (a.opties && a.opties.length ? '<div class="sub" style="margin-top:0.2rem;">' + a.opties.slice(0,4).map(escT).join(' · ') + '</div>' : '') +
      '<div style="display:flex;gap:0.4rem;margin-top:0.6rem;">' +
      '<button class="js-vkproef" data-code="' + a.supplierCode + '" data-id="' + a.id + '" style="flex:1;background:none;border:1px solid var(--gold);border-radius:10px;padding:0.45rem;color:var(--gold);font-weight:600;font-family:inherit;cursor:pointer;">' + T('vk.proefritk','Proefrit') + '</button>' +
      '<button class="js-vkkoop" data-code="' + a.supplierCode + '" data-id="' + a.id + '" data-prijs="' + a.prijs + '" data-naam="' + escAttr(a.naam) + '" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:10px;padding:0.45rem;font-weight:600;font-family:inherit;cursor:pointer;">' + T('vk.bodknop','Bod / kopen') + '</button>' +
      '</div></div>').join('');
    el.innerHTML = h;
    el.querySelectorAll('.js-vkteken').forEach(b => b.addEventListener('click', async () => {
      const naam = prompt(T('vk.tekennaam','Typ uw naam om het koopcontract te tekenen:')); if (!naam) return;
      try { await API.call('/verkoop/teken', { ref: b.dataset.ref, naam }); toast('✍️ ' + T('vk.getekend','Getekend. De zaak levert de auto af.')); laadShowroom(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-vkproef').forEach(b => b.addEventListener('click', async () => {
      const wens = prompt(T('vk.wens','Wanneer wilt u proefrijden? (bv. zaterdagochtend)')) || '';
      try { await API.call('/verkoop/proefrit', { supplierCode: b.dataset.code, autoId: b.dataset.id, wens }); toast('🚗 ' + T('vk.proefok','Proefrit aangevraagd. De zaak plant hem in.')); laadShowroom(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-vkkoop').forEach(b => b.addEventListener('click', async () => {
      const bod = prompt(T('vk.bodvraag','Uw bod in € (leeg = vraagprijs):'), b.dataset.prijs);
      if (bod === null) return;
      const wilInruil = confirm(T('vk.inruilvraag','Wilt u een auto inruilen?'));
      let inruil = null;
      if (wilInruil){ const merk = prompt(T('vk.inmerk','Merk + model van uw inruilauto:')); if (merk){ const jaar = prompt(T('vk.injaar','Bouwjaar?'),''); const km = prompt(T('vk.inkm','Kilometerstand?'),''); inruil = { merk, model: '', jaar, km }; } }
      const concierge = confirm(T('vk.concvraag','Concierge-aflevering op uw adres?'));
      const adres = concierge ? (prompt(T('vk.adres','Afleveradres:')) || '') : '';
      try { await API.call('/verkoop/koop', { supplierCode: b.dataset.code, autoId: b.dataset.id, bod: bod===''?undefined:bod, inruil, concierge, adres }); toast('🔑 ' + T('vk.koopok','Aanvraag verstuurd. U hoort snel van de zaak.')); laadShowroom(); } catch(e){ toast(e.message); }
    }));
  }

  // Boodschappen bij een groothandel/supermarkt (consumentprijs, met bezorging)
  async function laadBoodschappen(){
    const el = $('#boodschappen'); if (!el || !API.live) return;
    if (user && user.tier === 'guest'){ el.innerHTML = ''; return; }
    let markt, mijn;
    try { markt = await API.call('/groothandel/markt'); mijn = await API.call('/groothandel/mijn'); } catch(e){ el.innerHTML = ''; return; }
    const winkels = markt.groothandels || [];
    if (!winkels.length && !(mijn.bestellingen||[]).length){ el.innerHTML = ''; return; }
    let h = '<h3 style="margin:1.4rem 0 0.3rem;font-size:1rem;">🛒 ' + T('bo.h','Boodschappen') + '</h3><p class="sub" style="margin-bottom:0.6rem;">' + T('bo.sub','Bestel en laat bezorgen.') + '</p>';
    for (const g of winkels){
      h += '<div style="border:1px solid var(--line);border-radius:14px;padding:0.85rem;margin-bottom:0.8rem;">' +
        '<b>' + escT(g.naam) + '</b><span class="sub"> · ' + escT(g.city||'') + '</span>' +
        g.producten.slice(0,50).map(p => '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;border-top:1px solid var(--line);">' +
          '<div style="flex:1;"><span style="font-size:0.85rem;">' + escT(p.naam) + '</span><span class="sub"> · € ' + p.prijs + '/' + escT(p.eenheid) + '</span></div>' +
          '<input class="js-boq" data-code="' + g.code + '" data-pid="' + p.id + '" type="number" min="0" placeholder="0" aria-label="' + T('bo.aantal','Aantal') + '" style="width:3.6rem;text-align:center;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:0.35rem;color:var(--txt);font-family:inherit;"></div>').join('') +
        '<button class="js-bobestel" data-code="' + g.code + '" style="width:100%;margin-top:0.5rem;background:var(--gold);color:#000;border:none;border-radius:10px;padding:0.55rem;font-weight:600;font-family:inherit;cursor:pointer;">' + T('bo.bestel','Bezorgen') + '</button></div>';
    }
    if ((mijn.bestellingen||[]).length){
      h += '<div class="sub" style="margin:0.6rem 0 0.3rem;">' + T('bo.mijn','Mijn boodschappen') + '</div>';
      h += mijn.bestellingen.slice(0,10).map(o => '<div style="border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.7rem;margin-bottom:0.35rem;"><div style="display:flex;gap:0.5rem;"><b style="flex:1;font-size:0.82rem;">' + escT(o.groothandelNaam) + ' · € ' + o.subtotaal + '</b><span class="sub">' + escT(o.status) + '</span></div></div>').join('');
    }
    el.innerHTML = h;
    el.querySelectorAll('.js-bobestel').forEach(b => b.addEventListener('click', async () => {
      const regels = [];
      el.querySelectorAll('.js-boq[data-code="' + b.dataset.code + '"]').forEach(inp => { const a = Number(inp.value)||0; if (a>0) regels.push({ productId: inp.dataset.pid, aantal: a }); });
      if (!regels.length) return toast(T('bo.kies','Vul minstens een aantal in.'));
      try { await API.call('/groothandel/bestel', { groothandelCode: b.dataset.code, regels }); toast('🛒 ' + T('bo.ok','Boodschappen besteld.')); laadBoodschappen(); } catch(e){ toast(e.message); }
    }));
  }
  async function laadBzMijn(){
    const el = $('#bzMijn'); if (!el || !API.live) return;
    let mijn = [];
    try { mijn = ((await API.call('/orders/mine')).orders || []).filter(o => o.levering && !['bezorgd','opgehaald','geweigerd','terugbetaald','wacht-op-betaling'].includes(o.status)); } catch(e){}
    if (!mijn.length){ el.innerHTML = ''; return; }
    el.innerHTML = mijn.map(o => {
      const st = { 'nieuw': T('bz.m.nieuw','ontvangen door de zaak'), 'in bereiding': T('bz.m.bereid','wordt bereid'),
        'klaar': o.levering === 'ophalen' ? T('bz.m.haal','klaar om op te halen') : T('bz.m.wachtb','klaar, wacht op de bezorger'),
        'onderweg': T('bz.m.weg','onderweg naar u') }[o.status] || o.status;
      return '<div class="card" style="border-color:rgba(194,58,94,0.35);" data-bzvolg="'+o.ref+'">'+
        '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--burgundy);display:flex;align-items:center;gap:0.4rem;"><span class="livedot"></span>'+esc(o.supplierName)+' \u00B7 '+(o.levering==='ophalen'?T('bz.m.ophalen','ophalen'):T('bz.m.bezorgen','bezorging'))+'</div>'+
        '<div style="margin-top:0.4rem;font-size:0.9rem;"><b>'+st+'</b><span id="bzEta-'+o.ref+'">'+(o.status==='onderweg'&&o.etaMin?' \u00B7 \u23F1 '+o.etaMin+' min':'')+'</span></div>'+
        '<div style="margin-top:0.3rem;font-size:0.78rem;color:var(--muted);">'+o.items.map(i=>i.qty+'x '+esc(i.name)).join(', ')+
        (o.levering==='ophalen' ? ' \u00B7 '+T('bz.m.code','code')+' <b style="color:var(--gold);">'+o.pickup+'</b>' : (o.bezorger?' \u00B7 \uD83D\uDEF5 '+esc(o.bezorger.name):''))+'</div></div>';
    }).join('');
  }
  function opBezorg(d){
    // live: status, bezorger of GPS/ETA veranderd
    if (d.kind === 'gps'){
      const el = document.getElementById('bzEta-' + d.ref);
      if (el && d.etaMin) el.textContent = ' \u00B7 \u23F1 ' + d.etaMin + ' min';
      return;
    }
    laadBzMijn();
    if (d.kind === 'status' && (d.status === 'bezorgd' || d.status === 'opgehaald')) toast(T('bz.m.klaar2','Eet smakelijk! Uw bestelling is er.'));
  }
  function renderBestellen(){
    const el = $('#bzInhoud'); if (!el) return;
    if (bzZaak) return renderBzZaak();
    if (!bzPartners.length){
      el.innerHTML = '<div class="card"><div style="font-size:0.85rem;color:var(--muted);">'+T('bz.geen','Nog geen partners met een bezorgdienst op uw bestemming. Zodra een zaak de dienst opent, staat hij hier.')+'</div></div>';
      return;
    }
    el.innerHTML = bzPartners.map(p =>
      '<button class="card" style="display:block;width:100%;text-align:left;cursor:pointer;" data-bzkies="'+p.code+'">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;"><b>'+esc(p.name)+'</b><span class="soft-sm">'+esc(p.city||'')+'</span></div>'+
      '<div style="margin-top:0.3rem;font-size:0.76rem;color:var(--muted);">'+(p.bezorgen?'\uD83D\uDEF5 '+T('bz.kan.bez','bezorgen'):'')+(p.bezorgen&&p.ophalen?' \u00B7 ':'')+(p.ophalen?'\uD83E\uDDFA '+T('bz.kan.oph','ophalen'):'')+' \u00B7 '+p.producten.length+' '+T('bz.prod','producten')+'</div></button>'
    ).join('');
    document.querySelectorAll('[data-bzkies]').forEach(b => b.addEventListener('click', () => {
      bzZaak = bzPartners.find(p => p.code === b.dataset.bzkies); bzMand = {};
      bzLevering = bzZaak.bezorgen ? 'bezorgen' : 'ophalen';
      renderBzZaak();
    }));
  }
  function bzTotaal(){ return (bzZaak.producten||[]).reduce((t,p) => t + (bzMand[p.id]||0) * p.price, 0); }
  function renderBzZaak(){
    const el = $('#bzInhoud'); if (!el) return;
    const p = bzZaak;
    const n = Object.values(bzMand).reduce((a,b)=>a+b,0);
    el.innerHTML =
      '<button class="bz-btn" id="bzTerug" style="margin-bottom:0.8rem;">\u2039 '+T('bz.terug','Alle partners')+'</button>'+
      '<div class="card"><b>'+esc(p.name)+'</b>'+
      p.producten.map(x =>
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-top:0.7rem;">'+
        '<div style="flex:1;"><div style="font-size:0.88rem;">'+esc(x.name)+'</div>'+(x.desc?'<div class="soft-sm">'+esc(x.desc)+'</div>':'')+'</div>'+
        '<span style="color:var(--gold);font-size:0.82rem;">'+eur(x.price)+'</span>'+
        '<span style="display:flex;align-items:center;gap:0.45rem;">'+
        '<button class="bz-btn" data-bzmin="'+x.id+'" style="padding:0.2rem 0.7rem;">\u2212</button><b>'+(bzMand[x.id]||0)+'</b><button class="bz-btn" data-bzplus="'+x.id+'" style="padding:0.2rem 0.7rem;">+</button></span></div>'
      ).join('')+'</div>'+
      '<div class="card">'+
      '<div style="display:flex;gap:0.5rem;">'+
      (p.bezorgen?'<button class="bz-btn'+(bzLevering==='bezorgen'?' on':'')+'" data-bzlev="bezorgen">\uD83D\uDEF5 '+T('bz.kan.bez','bezorgen')+'</button>':'')+
      (p.ophalen?'<button class="bz-btn'+(bzLevering==='ophalen'?' on':'')+'" data-bzlev="ophalen">\uD83E\uDDFA '+T('bz.kan.oph','ophalen')+'</button>':'')+'</div>'+
      (bzLevering==='bezorgen' ? '<div class="bz-veld"><label>'+T('bz.adres','Bezorgadres')+'</label><input id="bzAdres" value="'+escAttr(bzAdresW)+'" placeholder="'+T('bz.adresph','Straat, nummer, plaats')+'"></div>'+
        '<button class="bz-btn'+(bzGeo?' on':'')+'" id="bzHier" style="margin-top:0.5rem;">\uD83D\uDCCD '+(bzGeo?T('bz.hierok','Locatie gedeeld voor de ETA'):T('bz.hier','Deel mijn locatie voor een live ETA'))+'</button>' : '')+
      '<button class="bz-groot" id="bzBestel" style="margin-top:1rem;"'+(n?'':' disabled')+'>'+T('bz.bestel','Bestel en betaal')+(n?' \u00B7 '+eur(bzTotaal()):'')+'</button></div>';
    const adresIn = document.getElementById('bzAdres');
    if (adresIn) adresIn.addEventListener('input', () => { bzAdresW = adresIn.value; });
    $('#bzTerug').addEventListener('click', () => { bzZaak = null; renderBestellen(); });
    document.querySelectorAll('[data-bzplus]').forEach(b => b.addEventListener('click', () => { bzMand[b.dataset.bzplus]=(bzMand[b.dataset.bzplus]||0)+1; renderBzZaak(); }));
    document.querySelectorAll('[data-bzmin]').forEach(b => b.addEventListener('click', () => { const k=b.dataset.bzmin; if (bzMand[k]) bzMand[k]--; if (!bzMand[k]) delete bzMand[k]; renderBzZaak(); }));
    document.querySelectorAll('[data-bzlev]').forEach(b => b.addEventListener('click', () => { bzLevering = b.dataset.bzlev; renderBzZaak(); }));
    const hier = document.getElementById('bzHier');
    if (hier) hier.addEventListener('click', () => {
      if (!navigator.geolocation) return toast(T('bz.geengps','Dit apparaat deelt geen locatie.'));
      navigator.geolocation.getCurrentPosition(pos => { bzGeo = { lat: pos.coords.latitude, lng: pos.coords.longitude }; renderBzZaak(); },
        () => toast(T('bz.gpsfout','Locatie delen is geweigerd; de ETA blijft dan een schatting.')));
    });
    $('#bzBestel').addEventListener('click', async () => {
      const items = Object.entries(bzMand).map(([id, qty]) => ({ id, qty }));
      if (!items.length) return;
      try {
        const b = await API.call('/bezorg/bestel', { supplierCode: p.code, levering: bzLevering, items,
          adres: bzLevering === 'bezorgen' ? bzAdresW : undefined,
          lat: bzGeo ? bzGeo.lat : undefined, lng: bzGeo ? bzGeo.lng : undefined });
        await API.call('/order/pay', { ref: b.order.ref });
        toast(bzLevering === 'ophalen' ? T('bz.ok.oph','Betaald. Uw ophaalcode: ') + b.order.pickup : T('bz.ok.bez','Betaald. U volgt de bezorging hierboven live.'));
        bzZaak = null; bzMand = {};
        renderBestellen(); laadBzMijn();
      } catch(e){ toast(e.message); }
    });
  }

  /* ---------- ter plaatse: bestellen bij RTG-partners ---------- */
  const ALG_ICON = '<svg viewBox="0 0 64 64" fill="none" stroke="#0C0C0B" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 19 V13 a7 7 0 0 1 7-7 h6"/><path d="M45 6 h6 a7 7 0 0 1 7 7 v6"/><path d="M58 45 v6 a7 7 0 0 1-7 7 h-6"/><path d="M19 58 h-6 a7 7 0 0 1-7-7 v-6"/><circle cx="23.5" cy="26.5" r="2.6" fill="#0C0C0B"/><circle cx="40.5" cy="26.5" r="2.6" fill="#0C0C0B"/><path d="M32 26 v8.5 a2.2 2.2 0 0 1-2.2 2.2"/><path d="M23 42.5 a12.5 8.5 0 0 0 18 0"/></svg>';
  let suppliers = [];
  let myOrders = [];
  let menuState = null; // { supplier, menu, qty:{}, note, tag }

  async function renderTerPlaatse(){
    if (!API.live){
      $('#supplierList').innerHTML = '<div class="empty" style="padding:2rem 1rem;color:var(--soft);text-align:center;font-size:0.85rem;">'+T('app.tp.needserver','Ter plaatse werkt via de RTG-server. Start de app met de backend om te bestellen bij partners.')+'</div>';
      return;
    }
    try {
      const [sd, od] = await Promise.all([API.call('/suppliers', { city: trip.dest }), API.call('/orders/mine')]);
      suppliers = sd.suppliers || [];
      myOrders = od.orders || [];
      $('#tpSub').textContent = T('app.tp.partnersin','RTG-partners in') + ' ' + (sd.city || trip.dest) + ', ' + T('app.tp.orderpayreserve','bestel, betaal en reserveer.');
    } catch (e) { return; }

    renderLive();  // live "onderweg"-paneel bovenaan
    renderZorg();  // zorgprofiel + wie er (met toestemming) live meekijkt

    // mijn lopende bestellingen bovenaan
    const active = myOrders.filter(o => o.status !== 'terugbetaald');
    $('#myOrders').innerHTML = active.length
      ? '<div class="sec-label">'+T('app.tp.myorders','Mijn bestellingen')+'</div>' + active.map(o => {
          const pc = o.status === 'nieuw' ? 'nieuw' : o.status === 'in bereiding' ? 'bereiding' : 'klaar';
          return '<div class="myorder" data-ref="' + o.ref + '">' +
            '<div class="r1"><div><div class="nm">' + o.supplierName + '</div><div class="sub2">' + o.items.reduce((n,i)=>n+i.qty,0) + ' ' + T('app.items','item(s)') + ' · ' + timeAgo(o.at) + '</div></div>' +
              '<div style="text-align:right;"><div class="amt">' + eur(o.total) + '</div><span class="mo-pill ' + pc + '">' + tStatus(o.status) + '</span></div></div>' +
            (o.regieKorting ? '<div class="sub2" style="text-align:right;color:var(--gold);">✦ ' + T('app.ledenvoordeel','RTG-ledenvoordeel') + ' − ' + eur(o.regieKorting) + '</div>' : '') +
            '<div class="acts">' + (o.paid
              ? '<span class="mo-paid">✓ '+T('app.paid','Betaald')+'</span>'
              : '<button class="mo-pay js-opay">' + FID_MINI + T('app.paywithfid','Betaal met Face ID') + '</button>') +
              (o.pickup ? '<button class="mo-code js-ocode">' + T('app.showcode','Toon ophaalcode') + '</button>' : '') +
              (['nieuw','wacht-op-betaling'].includes(o.status) ? '<button class="mo-code js-oann">✕ ' + T('erv.annuleer','Annuleer') + '</button>' : '') +
              (o.paid && !o.splitst ? '<button class="mo-code js-osplit">🤝 ' + T('erv.splits','Splits') + '</button>' : '') +
              (['geserveerd','bezorgd','opgehaald'].includes(o.status) ? '<button class="mo-code js-orev">⭐ ' + T('erv.review','Beoordeel') + '</button>' : '') +
              (o.tagSalon ? '<span style="font-size:0.68rem;color:var(--burgundy);margin-left:auto;">✦ '+T('app.taggedsalon','getagd voor Salon')+'</span>' : '') +
            '</div></div>';
        }).join('')
      : '';
    $('#myOrders').querySelectorAll('.myorder').forEach(el => {
      const o = active.find(x => x.ref === el.dataset.ref);
      const pb = el.querySelector('.js-opay');
      if (pb) pb.addEventListener('click', () => payOrder(o));
      const cb = el.querySelector('.js-ocode');
      if (cb) cb.addEventListener('click', () => showGlow(o));
      const ab = el.querySelector('.js-oann');
      if (ab) ab.addEventListener('click', async () => {
        try {
          const d = await API.call('/annuleer', { soort: 'order', ref: o.ref });
          toast(d.terugbetaald ? '↩️ ' + T('erv.retour','U ontvangt') + ' ' + eur(d.terugbetaald) + ' ' + T('erv.terug','retour.') : T('erv.geannuleerd','Geannuleerd.'));
          renderTerPlaatse();
        } catch(e){ toast(e.message); }
      });
      const rb = el.querySelector('.js-orev');
      if (rb) rb.addEventListener('click', () => reviewUI(el, o));
      const sb = el.querySelector('.js-osplit');
      if (sb) sb.addEventListener('click', () => splitsUI(el, o));
    });

    // partners: op afstand tonen en sorteren wanneer we de locatie weten
    const mijnPlek = window.Geo ? Geo.laatste() : null;
    const supRij = suppliers.map(s => ({ s, km: mijnPlek && s.loc ? Geo.afstandKm(mijnPlek, s.loc) : null }));
    if (mijnPlek) supRij.sort((a,b) => (a.km==null?1e9:a.km) - (b.km==null?1e9:b.km));
    $('#supplierList').innerHTML = '<div class="sec-label">'+T('app.tp.partnersdest','Partners op uw bestemming')+'</div>' + supRij.map(({s, km}) => {
      const rooms = (s.rooms || []).length, photos = (s.photos || []).length;
      const zzp = (s.services || []).length > 0;
      const viewable = s.hasMenu || rooms || photos;
      const afst = km!=null ? ' · 📍 ' + Geo.tekst(km) : '';
      const ster = s.rating ? ' · ⭐ ' + s.rating.score : '';
      const sub = (s.vak ? s.vak : tType(s.typeLabel)) + ster + ' · ' + s.city + (rooms ? ' · ' + rooms + ' ' + T('app.roomsfree','kamer(s) vrij') : '') + afst;
      return '<div class="sup-card">' +
        '<span class="ic">' + (s.icon || '📍') + '</span>' +
        '<div class="t"><b>' + s.name + '</b><span>' + sub + '</span></div>' +
        '<button class="chatb js-fav" data-fav="' + s.code + '" aria-label="' + T('fav.aria','Favoriet') + '">' + (s.favoriet ? '❤️' : '🤍') + '</button>' +
        '<button class="chatb" data-chat="' + s.code + '" aria-label="Chat">💬</button>' +
        (zzp
          ? '<button class="go" data-boek="' + s.code + '">'+T('app.tp.boek','Boek')+'</button>'
          : viewable
          ? '<button class="go" data-menu="' + s.code + '">'+(s.hasMenu ? T('app.tp.viewmenu','Bekijk kaart') : T('app.tp.view','Bekijk'))+'</button>'
          : '<button class="go ghost" data-loc="' + s.code + '">'+T('app.tp.location','Locatie')+'</button>') +
      '</div>';
    }).join('');
    $('#supplierList').querySelectorAll('[data-chat]').forEach(b => b.addEventListener('click', () => openPChat(b.dataset.chat)));
    $('#supplierList').querySelectorAll('[data-menu]').forEach(b => b.addEventListener('click', () => openMenu(b.dataset.menu)));
    $('#supplierList').querySelectorAll('[data-boek]').forEach(b => b.addEventListener('click', () => openBoekSheet(b.dataset.boek)));
    $('#supplierList').querySelectorAll('.js-fav').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await API.call('/favoriet', { supplierCode: b.dataset.fav });
        b.textContent = d.favoriet ? '❤️' : '🤍';
        toast(d.favoriet ? '❤️ ' + T('fav.on','Bewaard bij mijn adressen.') : T('fav.off','Uit mijn adressen gehaald.'));
      } catch(e){ toast(e.message); }
    }));
    // eenmalig de locatie ophalen zodat partners op afstand worden getoond en gesorteerd
    if (window.Geo && !mijnPlek && !renderTerPlaatse._gps){ renderTerPlaatse._gps = true; Geo.positie().then(p => { if (p) renderTerPlaatse(); }); }
    renderAfspraken();
  }

  // review: de actie-rij wordt vijf sterren; een tik plaatst de beoordeling
  function reviewUI(el, o){
    const acts = el.querySelector('.acts');
    acts.innerHTML = '<span style="font-size:0.72rem;color:var(--soft);align-self:center;">' + T('erv.hoewas','Hoe was het?') + '</span>' +
      [1,2,3,4,5].map(n => '<button class="mo-code js-star" data-n="' + n + '" aria-label="' + n + ' ' + T('erv.sterren','sterren') + '">' + '⭐'.repeat(1) + n + '</button>').join('');
    acts.querySelectorAll('.js-star').forEach(b => b.addEventListener('click', async () => {
      try {
        await API.call('/review', { soort: 'order', ref: o.ref, score: Number(b.dataset.n) });
        toast('⭐ ' + T('erv.bedanktreview','Dank voor uw beoordeling.'));
        renderTerPlaatse();
      } catch(e){ toast(e.message); renderTerPlaatse(); }
    }));
  }

  // splitsen: kies verbonden vrienden; ieder krijgt een betaalverzoek voor een gelijk deel
  async function splitsUI(el, o){
    let cons = [];
    try { cons = (await API.call('/member/connections')).connections || []; } catch(e){}
    if (!cons.length){ toast(T('erv.geenvrienden','Voeg eerst vrienden toe via de Salon om te kunnen splitsen.')); return; }
    const acts = el.querySelector('.acts');
    acts.innerHTML = '<div style="width:100%;">' +
      '<div style="font-size:0.72rem;color:var(--soft);margin-bottom:0.35rem;">' + T('erv.splitsmet','Splits gelijk met:') + '</div>' +
      cons.slice(0,8).map(c => '<label style="display:inline-flex;align-items:center;gap:0.3rem;margin:0 0.6rem 0.4rem 0;font-size:0.78rem;"><input type="checkbox" class="js-splid" value="' + c.key + '"> ' + c.codename + '</label>').join('') +
      '<button class="mo-pay js-splgo" style="width:100%;margin-top:0.2rem;">🤝 ' + T('erv.stuurverzoek','Stuur betaalverzoeken') + '</button></div>';
    acts.querySelector('.js-splgo').addEventListener('click', async () => {
      const metKeys = [...acts.querySelectorAll('.js-splid:checked')].map(x => x.value);
      if (!metKeys.length){ toast(T('erv.kiesvriend','Kies minstens een vriend.')); return; }
      try {
        const d = await API.call('/splits', { ref: o.ref, metKeys });
        toast('🤝 ' + T('erv.verzoekweg','Betaalverzoeken verstuurd:') + ' ' + eur(d.splits.delen[0].bedrag) + ' ' + T('erv.pp','p.p.'));
        renderTerPlaatse();
      } catch(e){ toast(e.message); }
    });
  }

  // mijn afspraken bij zelfstandigen: status volgen en achteraf betalen
  async function renderAfspraken(){
    const wrap = $('#afsprakenList');
    if (!wrap) return;
    let bs = [];
    try { bs = (await API.call('/bookings/mine')).boekingen || []; } catch(e){}
    const actief = bs.filter(b => b.status !== 'afgerond' && b.status !== 'geweigerd').slice(0, 6);
    const BST = {
      'wacht-op-betaling': [T('boek.st.wacht','wacht op betaling'), 'var(--amber, #C99A2E)'],
      'aangevraagd': [T('boek.st.aan','aangevraagd'), 'var(--soft)'],
      'bevestigd': [T('boek.st.ok','bevestigd'), 'var(--green, #4C9A75)']
    };
    wrap.innerHTML = actief.length ? '<div class="sec-label">🗓️ '+T('boek.mijn','Mijn afspraken')+'</div>' + actief.map(b => {
      const st = BST[b.status] || [b.status, 'var(--soft)'];
      return '<div class="myorder">' +
        '<div class="r1"><div><div class="nm">' + b.supplierName + '</div><div class="sub2">' + b.service.name + (b.wanneer ? ' · ' + b.wanneer : '') + '</div></div>' +
        '<div style="text-align:right;"><div class="amt">' + eur(b.price) + '</div><span style="font-size:0.62rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:' + st[1] + ';">' + st[0] + '</span></div></div>' +
        (!b.paid ? '<div class="acts"><button class="mo-pay js-bpay" data-bref="' + b.ref + '" data-bamt="' + b.price + '">' + FID_MINI + T('app.paywithfid','Betaal met Face ID') + '</button></div>' : '') +
      '</div>';
    }).join('') : '';
    wrap.querySelectorAll('.js-bpay').forEach(k => k.addEventListener('click', () => {
      payWithFaceId(eur(Number(k.dataset.bamt)), async () => {
        await API.call('/booking/pay', { ref: k.dataset.bref });
      }, { message: () => T('boek.betaald','Geboekt en betaald; u hoort het zodra het bevestigd is.'), after: () => renderTerPlaatse() });
    }));
    $('#supplierList').querySelectorAll('[data-loc]').forEach(b => b.addEventListener('click', () => {
      const s = suppliers.find(x => x.code === b.dataset.loc);
      toast(s.name + ', ' + (s.loc && s.loc.label ? s.loc.label : T('app.tp.locwhenenroute','locatie gedeeld zodra u onderweg bent')) + '.');
    }));
  }

  /* ---------- zelfstandigen boeken: diensten en producten met datum en tijd ---------- */
  let boekKeuze = null;
  function openBoekSheet(code){
    const s = suppliers.find(x => x.code === code);
    if (!s || !(s.services || []).length) return;
    boekKeuze = null;
    $('#boekSup').textContent = s.name;
    const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    $('#boekBody').innerHTML =
      (s.vak ? '<div style="font-size:0.72rem;color:var(--gold);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:0.6rem;">' + s.vak + ' · ' + s.city + '</div>' : '') +
      s.services.map(x =>
        '<div class="rowitem js-svc" data-svc="' + x.id + '" style="cursor:pointer;border:1px solid var(--line);border-radius:12px;padding:0.75rem 0.9rem;margin-bottom:0.55rem;">' +
        '<div class="t"><b>' + (x.soort === 'product' ? '📦 ' : '🗓️ ') + x.name + '</b><span>' + (x.desc || '') + (x.duurMin ? ' · ' + x.duurMin + ' min' : '') + '</span></div>' +
        '<span class="amount">' + eur(x.price) + '</span></div>').join('') +
      '<div style="display:flex;gap:0.5rem;margin-top:0.6rem;">' +
      '<input id="boekDatum" type="date" value="' + morgen + '" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.6rem;color:var(--txt);font-family:inherit;color-scheme:dark;">' +
      '<input id="boekTijd" type="time" value="14:00" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.6rem;color:var(--txt);font-family:inherit;color-scheme:dark;"></div>' +
      '<div id="boekSlots" style="margin-top:0.5rem;"></div>' +
      '<input id="boekNote" placeholder="' + T('boek.noteph','Bijv. maat, locatie of blessure') + '" style="width:100%;margin-top:0.5rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.6rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.82rem;">' +
      '<div style="font-size:0.66rem;color:var(--soft);margin:0.5rem 0 0;">' + T('boek.los','U boekt rechtstreeks bij deze professional: een losse overeenkomst, en uw betaling gaat rechtstreeks naar de professional.') + '</div>' +
      '<button id="boekGo" class="btn-pay" style="width:100%;margin-top:0.7rem;justify-content:center;">' + FID + T('boek.go','Boek en betaal') + '</button>';
    $('#boek-sheet').classList.add('open');
    $('#boek-scrim').classList.add('open');
    // de vrije tijdvakken van de professional ophalen en als chips tonen
    async function laadSlots(){
      const box = $('#boekSlots'); if (!box) return;
      if (!boekKeuze){ box.innerHTML = ''; return; }
      box.innerHTML = '<div style="font-size:0.7rem;color:var(--soft);">' + T('boek.slotsladen','Vrije tijden laden...') + '</div>';
      let d;
      try { d = await API.call('/booking/slots', { supplierCode: code, serviceId: boekKeuze, date: $('#boekDatum').value }); }
      catch(e){ box.innerHTML = ''; return; }
      if (!d.tijden || !d.tijden.length){
        box.innerHTML = '<div style="font-size:0.7rem;color:var(--soft);">' + T('boek.geenslots','Geen vrije tijden op deze dag; kies een andere datum of typ een tijd.') + '</div>';
        return;
      }
      box.innerHTML = '<div style="font-size:0.66rem;color:var(--soft);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:0.35rem;">' + T('boek.vrijetijden','Vrije tijden') + '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;">' + d.tijden.map(t =>
          '<button class="js-slot" data-t="' + t + '" style="background:var(--card);border:1px solid var(--line);border-radius:999px;padding:0.35rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.8rem;cursor:pointer;">' + t + '</button>').join('') + '</div>';
      box.querySelectorAll('.js-slot').forEach(b => b.addEventListener('click', () => {
        $('#boekTijd').value = b.dataset.t;
        box.querySelectorAll('.js-slot').forEach(x => { x.style.borderColor = 'var(--line)'; x.style.color = 'var(--txt)'; });
        b.style.borderColor = 'var(--gold)'; b.style.color = 'var(--gold)';
      }));
    }
    $('#boekBody').querySelectorAll('.js-svc').forEach(el => el.addEventListener('click', () => {
      boekKeuze = el.dataset.svc;
      $('#boekBody').querySelectorAll('.js-svc').forEach(x => x.style.borderColor = x.dataset.svc === boekKeuze ? 'var(--gold)' : 'var(--line)');
      laadSlots();
    }));
    $('#boekDatum').addEventListener('change', laadSlots);
    $('#boekGo').addEventListener('click', async () => {
      if (!boekKeuze){ toast(T('boek.kies','Kies eerst een dienst of product.')); return; }
      let d;
      try {
        d = await API.call('/booking/request', { supplierCode: code, serviceId: boekKeuze,
          date: $('#boekDatum').value, time: $('#boekTijd').value, note: $('#boekNote').value.trim() });
      } catch(e){ toast(e.message); return; }
      $('#boek-sheet').classList.remove('open');
      $('#boek-scrim').classList.remove('open');
      if (d.boeking.status === 'wacht-op-betaling'){
        payWithFaceId(eur(d.boeking.price), async () => {
          await API.call('/booking/pay', { ref: d.boeking.ref });
          return d.boeking;
        }, { message: () => T('boek.betaald','Geboekt en betaald; u hoort het zodra het bevestigd is.'), after: () => renderTerPlaatse() });
      } else {
        toast('🗓️ ' + T('boek.ok','Aanvraag verstuurd; betalen kan achteraf.'));
        renderTerPlaatse();
      }
    });
  }
  $('#boekClose').addEventListener('click', () => { $('#boek-sheet').classList.remove('open'); $('#boek-scrim').classList.remove('open'); });
  $('#boek-scrim').addEventListener('click', () => { $('#boek-sheet').classList.remove('open'); $('#boek-scrim').classList.remove('open'); });

/* ============================== RTG OS-schil ==============================
   De leden-app als telefoon-besturingssysteem: meerdere hoofdschermen
   (scroll-snap + stippen), apps in mappen, een zoekpil (Spotlight), een
   bedieningspaneel (thema, taal, push, helderheid, uitloggen) en iconen
   herschikken met een lange druk (wiebel-modus, volgorde in localStorage).

   De (verborgen) tabbar blijft het model: alle bestaande logica schakelt daar
   tabs, zichtbaarheid (gast-modus, Assets, Gezin) en badges. Deze laag
   SPIEGELT dat model; kliks op tab-iconen lopen terug het model in
   (button.click()), dus er is een navigatiepad en geen drift. */
(() => {
  const $ = s => document.querySelector(s);
  const tabbar = $('#tabbar'), app = $('#app'), content = $('#content');
  const grids = [$('#osGrid'), $('#osGrid2')];
  const dock = $('#osDock'), pages = $('#osPages'), dots = $('#osDots');
  if (!tabbar || !app || !grids[0] || !grids[1] || !dock || !pages) return;

  const pas = new URLSearchParams(location.search).get('pas') || 'rtg';
  // De Butler in het midden van het dock, als grotere gouden orb: hij is het
  // hart van het OS en doet alles wat je hem vraagt.
  const DOCK = ['betalen', 'bestellen', 'ai', 'salon', 'terplaatse'];

  /* ---------- de indeling: tab-apps, link-apps en mappen ----------
     Link-apps zijn losse leden-pagina's die als eigen app openen. */
  const LINKS = {
    spelen:      { naam: 'Spelen',       icoon: '🎲', url: '/apps/spelen.html?pas=' + encodeURIComponent(pas) },
    vrienden:    { naam: 'Vrienden',     icoon: '💬', url: '/apps/foundation/vrienden.html' },
    juridisch:   { naam: 'Juridisch',    icoon: '📜', url: '/apps/juridisch.html' },
    camera:      { naam: 'Camera',       icoon: '📸', url: '/apps/camera.html' },
    muziek:      { naam: 'RTG Sound',    icoon: '🎧', url: '/apps/muziek.html' },
    podium:      { naam: 'Podium',       icoon: '🎬', url: '/apps/podium.html' },
    flits:       { naam: 'Flits',        icoon: '🛣️', url: '/apps/flits.html' },
    theater:     { naam: 'Theater',      icoon: '🎞️', url: '/apps/theater.html' },
    wbw:         { naam: 'Wie betaalt wat', icoon: '💶', url: '/apps/wbw.html' },
    passkeys:    { naam: 'Passkeys',     icoon: '🔑', url: '/apps/passkeys.html' },
    ov:          { naam: 'OV',           icoon: '🚌', url: '/apps/ov.html' },
    stad:        { naam: 'Mijn Stad',    icoon: '🏙️', url: '/apps/stad.html' },
    clips:       { naam: 'Clips',        icoon: '🎥', url: '/apps/clips.html' },
    office:      { naam: 'RTG Office',   icoon: '📊', url: '/apps/office.html' },
    vonk:        { naam: 'Vonk',         icoon: '💘', url: '/apps/vonk.html' },
    balans:      { naam: 'Balans',       icoon: '🌿', url: '/apps/balans.html' },
    rechterhand: { naam: 'De Rechterhand', icoon: '🎩', url: '/apps/lifestyle.html' },
    reisboek:    { naam: 'Reisboek',      icoon: '🧳', url: '/apps/reisboek.html' },
    cellier:     { naam: 'Cellier',       icoon: '🍷', url: '/apps/cellier.html' },
    table:       { naam: 'Table',         icoon: '🍽️', url: '/apps/table.html' },
    maison:      { naam: 'Maison',        icoon: '🏛️', url: '/apps/maison.html' }
  };
  /* Elke functie zijn eigen app: Bellen, Videobellen en Snaps zijn eigen
     OS-apps die een kiezer openen en dan meteen doen wat u koos, via de
     sociale laag van de leden-app (WebRTC-bellen, snaps op codenaam).
     RTFoundation is EEN app: een tik toont de leeftijdskeuze en opent dan
     de hub in de passende jas (?groep= zet de bril op). */
  const OSAPPS = {
    bellen:      { naam: 'Bellen',       icoon: '📞' },
    videobellen: { naam: 'Videobellen',  icoon: '🎥' },
    snaps:       { naam: 'Snaps',        icoon: '📷' },
    rtf:         { naam: 'RTFoundation', icoon: '🕊️' }
  };
  const RTF_GROEPEN = [
    { g: 'mini',   naam: 'RTF Mini',      icoon: '🧸', sub: '0 t/m 4 jaar' },
    { g: 'kind',   naam: 'RTF Kids',      icoon: '🎒', sub: '5 t/m 11 jaar' },
    { g: 'tiener', naam: 'RTF Tiener',    icoon: '🛹', sub: '12 t/m 15 jaar' },
    { g: 'jong',   naam: 'RTF Jong',      icoon: '🚀', sub: '16 t/m 21+' },
    { g: 'volw',   naam: 'RTF Volwassen', icoon: '🧑', sub: 'ouders en verzorgers' }
  ];
  const INDELING = [
    ['tab:reizen', 'tab:betalen', 'tab:bestellen', 'tab:ai', 'tab:salon', 'tab:terplaatse',
      { sleutel: 'map-diensten', naam: 'Diensten', items: ['tab:zorg', 'tab:assets', 'tab:gezin'] }],
    [{ sleutel: 'map-sociaal', naam: 'Sociaal', items: ['link:vrienden', 'os:bellen', 'os:videobellen', 'os:snaps', 'link:spelen'] },
      'link:bank',
      'link:ov',
      'link:stad',
      'os:rtf',
      'link:camera',
      'link:muziek',
      'link:podium',
      'link:clips',
      'link:vonk',
      'link:balans',
      'link:flits',
      'link:theater',
      'link:wbw',
      'link:office',
      'link:passkeys',
      'link:juridisch']
  ];
  // De Rechterhand is de premium suite van de Lifestyle Pass (Business erft mee);
  // hij verschijnt alleen op het springboard van die passen, vooraan op pagina twee.
  if (['lifestyle', 'business'].includes(pas)) INDELING[1].splice(1, 0, 'link:rechterhand', 'link:reisboek', 'link:cellier', 'link:table', 'link:maison');

  /* ---------- mappen: eigen namen ----------
     De naam van een map is van de gebruiker: hernoemen kan in de wiebel-modus
     (tik op de map) of via de Butler; de keuze staat per pas in localStorage. */
  function mapNamen() { try { return JSON.parse(localStorage.getItem('rtg_os_mapnamen_' + pas) || '{}'); } catch (e) { return {}; } }
  function mapNaam(map) { return (mapNamen()[map.sleutel] || '').trim() || map.naam; }
  function zetMapNaam(map, naam) {
    try {
      const m = mapNamen();
      const schoon = (naam || '').trim().slice(0, 18);
      if (schoon && schoon !== map.naam) m[map.sleutel] = schoon; else delete m[map.sleutel];
      localStorage.setItem('rtg_os_mapnamen_' + pas, JSON.stringify(m));
    } catch (e) {}
    bouw();
  }

  /* ---------- gebruik bijhouden: het OS leert wat u vaak opent ----------
     Telt per app hoe vaak hij geopend wordt, met verval per dag; Spotlight
     zet daar de rij "Voor u" van. Alles blijft lokaal op het toestel. */
  function gebruik() { try { return JSON.parse(localStorage.getItem('rtg_os_gebruik_' + pas) || '{}'); } catch (e) { return {}; } }
  function telGebruik(sleutel) {
    try {
      const g = gebruik(), nu = Date.now(), oud = g[sleutel] || { n: 0, t: nu };
      const dagen = Math.max(0, (nu - (oud.t || nu)) / 86400000);
      g[sleutel] = { n: (oud.n || 0) * Math.pow(0.85, dagen) + 1, t: nu };
      localStorage.setItem('rtg_os_gebruik_' + pas, JSON.stringify(g));
    } catch (e) {}
  }
  function topGebruik(k) {
    const g = gebruik(), nu = Date.now();
    return Object.entries(g)
      .map(([s, v]) => [s, (v.n || 0) * Math.pow(0.85, Math.max(0, (nu - (v.t || nu)) / 86400000))])
      .sort((a, b) => b[1] - a[1])
      .map(([s]) => s)
      .filter(s => s.startsWith('tab:') ? itemZichtbaar(s)
        : s.startsWith('os:') ? !!OSAPPS[s.slice(3)]
        : (s.startsWith('link:') && !!LINKS[s.slice(5)]))
      .slice(0, k);
  }

  const sleutelVan = it => typeof it === 'string' ? it : it.sleutel;
  function bewaardeVolgorde(p) { try { return JSON.parse(localStorage.getItem('rtg_os_indeling_' + pas + '_' + p) || 'null'); } catch (e) { return null; } }
  function bewaarVolgorde(p, volgorde) { try { localStorage.setItem('rtg_os_indeling_' + pas + '_' + p, JSON.stringify(volgorde)); } catch (e) {} }
  function gesorteerd(p) {
    const basis = INDELING[p], orde = bewaardeVolgorde(p);
    if (!orde) return basis;
    const perSleutel = new Map(basis.map(it => [sleutelVan(it), it]));
    const uit = [];
    for (const s of orde) if (perSleutel.has(s)) { uit.push(perSleutel.get(s)); perSleutel.delete(s); }
    for (const it of basis) if (perSleutel.has(sleutelVan(it))) uit.push(it); // nieuw sinds de bewaring: achteraan
    return uit;
  }

  /* ---------- iconen bouwen ---------- */
  const tabKnop = t => tabbar.querySelector('button[data-tab="' + t + '"]');
  const tabZichtbaar = t => { const b = tabKnop(t); return !!b && b.style.display !== 'none'; };
  const tabNaam = t => { const s = tabKnop(t); const sp = s && s.querySelector('span'); return sp ? sp.textContent : t; };

  function itemDef(item) { // os-app of link-app: de registry-invoer
    return item.startsWith('os:') ? OSAPPS[item.slice(3)] : LINKS[item.slice(5)];
  }
  function tegelInhoud(item) { // svg (tab) of emoji (link/os-app) in de tegel
    if (item.startsWith('tab:')) {
      const svg = tabKnop(item.slice(4)) && tabKnop(item.slice(4)).querySelector('svg');
      return svg ? svg.cloneNode(true) : document.createTextNode('•');
    }
    const span = document.createElement('span');
    span.style.fontSize = '1.5rem';
    span.textContent = (itemDef(item) || {}).icoon || '•';
    return span;
  }
  function itemNaam(item) {
    return item.startsWith('tab:') ? tabNaam(item.slice(4)) : (itemDef(item) || {}).naam || item;
  }
  function itemZichtbaar(item) { return item.startsWith('tab:') ? tabZichtbaar(item.slice(4)) : !!itemDef(item); }
  function openItem(item) {
    if (wiebel) return; // in wiebel-modus opent er niets, net als op een telefoon
    telGebruik(item);
    if (item.startsWith('tab:')) { const b = tabKnop(item.slice(4)); if (b) b.click(); }
    else if (item.startsWith('os:')) { openOsApp(item.slice(3)); }
    else { const l = LINKS[item.slice(5)]; if (l) location.href = l.url; }
  }

  /* ---------- de kiezer: Bellen, Videobellen en Snaps ----------
     Een tik op de app opent uw contacten; een tik op een contact belt,
     videobelt of stuurt de snap meteen (via de sociale laag, RTGSocial). */
  const belScrim = $('#osBelScrim'), belTitel = $('#osBelTitel'), belLijst = $('#osBelLijst');
  function openOsApp(naam) {
    const app = OSAPPS[naam]; if (!app || !belScrim) return;
    sluitScrims();
    belTitel.textContent = app.icoon + ' ' + app.naam;
    belLijst.textContent = '';
    // RTFoundation: een leeftijdskeuze, daarna opent de juiste app (RTF-jas)
    if (naam === 'rtf') {
      let onthouden = null;
      try { onthouden = localStorage.getItem('rtf_app_groep'); } catch (e) {}
      for (const gr of RTF_GROEPEN) {
        const b = document.createElement('button');
        const zi = document.createElement('span'); zi.className = 'zi'; zi.textContent = gr.icoon;
        b.appendChild(zi);
        b.appendChild(document.createTextNode(gr.naam));
        const m = document.createElement('span'); m.className = 'zm';
        m.textContent = gr.sub + (onthouden === gr.g ? ' · vorige keer' : '');
        b.appendChild(m);
        b.addEventListener('click', () => { location.href = '/apps/foundation/index.html?groep=' + gr.g; });
        belLijst.appendChild(b);
      }
      belScrim.classList.add('open');
      return;
    }
    const S = window.RTGSocial;
    const lijst = S && S.ok && S.ok() ? S.lijst() : [];
    if (!lijst.length) {
      const d = document.createElement('div');
      d.className = 'os-bel-leeg';
      d.textContent = 'Nog geen contacten. Voeg iemand toe in De Salon; daarna belt, videobelt en snapt u met een tik, zonder telefoonnummer.';
      belLijst.appendChild(d);
      const ga = document.createElement('button');
      const gi = document.createElement('span'); gi.className = 'zi'; gi.textContent = '🫂';
      ga.appendChild(gi); ga.appendChild(document.createTextNode('Naar De Salon'));
      ga.addEventListener('click', () => { sluitScrims(); const b = tabKnop('salon'); if (b) b.click(); });
      belLijst.appendChild(ga);
    }
    for (const c of lijst) {
      const b = document.createElement('button');
      const zi = document.createElement('span'); zi.className = 'zi';
      zi.textContent = String(c.codename || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
      b.appendChild(zi);
      b.appendChild(document.createTextNode(c.codename || ''));
      const m = document.createElement('span'); m.className = 'zm'; m.textContent = app.icoon; b.appendChild(m);
      b.addEventListener('click', () => {
        sluitScrims();
        if (!window.RTGSocial) return;
        if (naam === 'snaps') RTGSocial.snap(c.key);
        else RTGSocial.bel(c.key, c.codename, naam === 'videobellen');
      });
      belLijst.appendChild(b);
    }
    belScrim.classList.add('open');
  }

  function maakAppIcoon(item, inDock) {
    const el = document.createElement('button');
    el.className = 'os-app'; el.dataset.sleutel = item;
    if (item.startsWith('tab:')) el.dataset.tab = item.slice(4);
    el.setAttribute('aria-label', itemNaam(item));
    const tegel = document.createElement('span'); tegel.className = 'os-tegel';
    tegel.appendChild(tegelInhoud(item));
    if (item.startsWith('tab:')) {
      const dot = tabKnop(item.slice(4)) && tabKnop(item.slice(4)).querySelector('span[id$="Dot"]');
      if (dot && dot.style.display !== 'none') { const b = document.createElement('span'); b.className = 'os-badge'; tegel.appendChild(b); }
    }
    el.appendChild(tegel);
    if (!inDock) { const n = document.createElement('span'); n.className = 'os-naam'; n.textContent = itemNaam(item); el.appendChild(n); }
    el.addEventListener('click', () => openItem(item));
    return el;
  }
  function maakMapIcoon(map) {
    const el = document.createElement('button');
    el.className = 'os-app os-map'; el.dataset.sleutel = map.sleutel;
    el.setAttribute('aria-label', 'Map ' + mapNaam(map));
    const tegel = document.createElement('span'); tegel.className = 'os-tegel os-map-tegel';
    for (const item of map.items.filter(itemZichtbaar).slice(0, 9)) {
      const mini = document.createElement('span'); mini.className = 'os-map-mini';
      mini.appendChild(tegelInhoud(item)); tegel.appendChild(mini);
    }
    el.appendChild(tegel);
    const n = document.createElement('span'); n.className = 'os-naam'; n.textContent = mapNaam(map); el.appendChild(n);
    // gewoon tikken opent de map; in de wiebel-modus tik je om te hernoemen
    el.addEventListener('click', () => {
      if (!wiebel) { openMap(map); return; }
      if (Date.now() - wiebelStart > 600) openHernoem(map);
    });
    return el;
  }

  function bouw() {
    grids.forEach((grid, p) => {
      grid.textContent = '';
      for (const it of gesorteerd(p)) {
        if (typeof it === 'string') { if (itemZichtbaar(it)) grid.appendChild(maakAppIcoon(it, false)); }
        else if (it.items.some(itemZichtbaar)) grid.appendChild(maakMapIcoon(it));
      }
    });
    dock.textContent = '';
    for (const t of DOCK) if (tabZichtbaar(t)) dock.appendChild(maakAppIcoon('tab:' + t, true));
    sync();
  }

  /* ---------- mappen openen ---------- */
  const mapScrim = $('#osMapScrim'), mapGrid = $('#osMapGrid'), mapTitel = $('#osMapTitel');
  function openMap(map) {
    mapTitel.textContent = mapNaam(map);
    mapGrid.textContent = '';
    for (const item of map.items.filter(itemZichtbaar)) {
      const el = maakAppIcoon(item, false);
      // alleen de map zelf dicht: een os-app (Bellen) opent hierna zijn kiezer
      el.addEventListener('click', () => mapScrim.classList.remove('open'));
      mapGrid.appendChild(el);
    }
    mapScrim.classList.add('open');
  }

  /* ---------- map hernoemen (wiebel-modus of Butler) ---------- */
  const hernoemScrim = $('#osHernoemScrim'), hernoemIn = $('#osHernoemIn');
  const hernoemOk = $('#osHernoemOk'), hernoemReset = $('#osHernoemReset');
  let hernoemDoel = null;
  function openHernoem(map) {
    if (!hernoemScrim) return;
    hernoemDoel = map;
    hernoemIn.value = mapNaam(map);
    hernoemScrim.classList.add('open');
    setTimeout(() => { hernoemIn.focus(); hernoemIn.select(); }, 60);
  }
  if (hernoemOk) hernoemOk.addEventListener('click', () => { if (hernoemDoel) zetMapNaam(hernoemDoel, hernoemIn.value); sluitScrims(); });
  if (hernoemReset) hernoemReset.addEventListener('click', () => { if (hernoemDoel) zetMapNaam(hernoemDoel, ''); sluitScrims(); });
  if (hernoemIn) hernoemIn.addEventListener('keydown', e => { if (e.key === 'Enter' && hernoemOk) hernoemOk.click(); });

  /* ---------- overlays: gedeeld sluiten ---------- */
  const scrims = ['#osMapScrim', '#osZoekScrim', '#osCcScrim', '#osHernoemScrim', '#osBelScrim'].map(s => $(s)).filter(Boolean);
  function sluitScrims() { scrims.forEach(s => s.classList.remove('open')); }
  scrims.forEach(s => s.addEventListener('click', e => { if (e.target === s) sluitScrims(); }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { sluitScrims(); zetWiebel(false); } });

  /* ---------- zoeken (Spotlight) ---------- */
  const zoekScrim = $('#osZoekScrim'), zoekInput = $('#osZoekInput'), zoekLijst = $('#osZoekLijst');
  function alleItems() {
    const uit = [];
    INDELING.flat().forEach(it => {
      if (typeof it === 'string') { if (itemZichtbaar(it)) uit.push({ item: it, uit: null }); }
      else it.items.forEach(sub => { if (itemZichtbaar(sub)) uit.push({ item: sub, uit: mapNaam(it) }); });
    });
    return uit;
  }
  // acties zijn ook gewoon vindbaar in Spotlight: instellingen als resultaten
  function osActies() {
    const uit = [
      { naam: 'Licht of donker', icoon: '🌗', doe: () => { const b = $('#rtg-thema-knop'); if (b) b.click(); } },
      { naam: 'Meldingen', icoon: '🔔', doe: () => { const b = $('#bell'); if (b) b.click(); } },
      { naam: 'Bedieningspaneel', icoon: '🎛️', doe: () => { ccSync(); if (ccScrim) ccScrim.classList.add('open'); } },
      { naam: 'Taal kiezen', icoon: '🌐', doe: () => { if (window.RTGi18n) RTGi18n.openModal(); } },
      { naam: 'Push aanzetten', icoon: '📳', doe: () => { if (window.RTGRealtime) RTGRealtime.enablePush(); } },
      { naam: 'Uitloggen', icoon: '⏻', doe: () => { const b = $('#logoutBtn'); if (b) b.click(); } }
    ];
    if (window.RTGOSThema && RTGOSThema.keuzeMogelijk()) {
      for (const t of ['bordeaux', 'parelmoer', 'standaard']) {
        uit.push({ naam: 'Thema ' + (t === 'standaard' ? 'klassiek' : t), icoon: '🎨', doe: () => RTGOSThema.zet(t) });
      }
    }
    return uit;
  }
  // De Butler vanuit het zoekscherm: open zijn app, vul de vraag in en verstuur
  // via de bestaande chat-knoppen; de hele acties-registry van de Butler
  // (bestellen, boeken, betalen, plannen, annuleren) doet dan gewoon zijn werk.
  function vraagButler(q) {
    sluitScrims();
    const b = tabKnop('ai'); if (b) b.click();
    const inp = $('#askInput'), knop = $('#askBtn');
    if (inp && knop && q) { inp.value = q; setTimeout(() => knop.click(), 150); }
    else if (inp) inp.focus();
  }
  function zoekSectie(tekst) {
    const d = document.createElement('div'); d.className = 'os-zoek-sectie'; d.textContent = tekst;
    zoekLijst.appendChild(d);
  }
  function zoekRij(icoonNode, label, meta, doe) {
    const b = document.createElement('button');
    const zi = document.createElement('span'); zi.className = 'zi'; zi.appendChild(icoonNode);
    b.appendChild(zi);
    b.appendChild(document.createTextNode(label));
    if (meta) { const m = document.createElement('span'); m.className = 'zm'; m.textContent = meta; b.appendChild(m); }
    b.addEventListener('click', doe);
    zoekLijst.appendChild(b);
  }
  function zoek() {
    const q = (zoekInput.value || '').trim().toLowerCase();
    zoekLijst.textContent = '';
    // leeg veld: eerst "Voor u", de apps die u hier het vaakst opent
    if (!q) {
      const top = topGebruik(4);
      if (top.length) {
        zoekSectie('Voor u');
        for (const s of top) zoekRij(tegelInhoud(s), itemNaam(s), null, () => { sluitScrims(); openItem(s); });
        zoekSectie('Alle apps');
      }
    }
    for (const { item, uit } of alleItems()) {
      if (q && !itemNaam(item).toLowerCase().includes(q)) continue;
      zoekRij(tegelInhoud(item), itemNaam(item), uit, () => { sluitScrims(); openItem(item); });
    }
    // acties (instellingen en schakelaars) doen mee zodra er getypt wordt
    if (q) {
      const acts = osActies().filter(a => a.naam.toLowerCase().includes(q));
      if (acts.length) {
        zoekSectie('Acties');
        for (const a of acts) {
          const ic = document.createElement('span'); ic.textContent = a.icoon;
          zoekRij(ic, a.naam, null, () => { sluitScrims(); a.doe(); });
        }
      }
    }
    // altijd onderaan: geef de vraag aan de Butler, wat het ook is
    const bi = document.createElement('span'); bi.textContent = '✦';
    zoekRij(bi, q ? 'Vraag Rahul: "' + zoekInput.value.trim() + '"' : 'Vraag Rahul', null,
      () => vraagButler(zoekInput.value.trim()));
  }
  function openZoek() { sluitScrims(); zoekScrim.classList.add('open'); zoekInput.value = ''; zoek(); zoekInput.focus(); }
  const zoekPil = $('#osZoekPil');
  if (zoekPil) zoekPil.addEventListener('click', openZoek);
  if (zoekInput) zoekInput.addEventListener('input', zoek);

  /* ---------- bedieningspaneel ---------- */
  const ccScrim = $('#osCcScrim');
  const ccBtn = $('#osCcBtn');
  if (ccBtn) ccBtn.addEventListener('click', () => { const open = ccScrim.classList.contains('open'); sluitScrims(); if (!open) { ccSync(); ccScrim.classList.add('open'); } });
  function ccSync() {
    const T = window.RTGOSThema;
    const rij = $('#osCcThema');
    if (rij) rij.style.display = T && T.keuzeMogelijk() ? '' : 'none';
    if (T) document.querySelectorAll('#osCcThema button').forEach(b => b.classList.toggle('actief', b.dataset.thema === T.huidig()));
    const push = $('#osCcPush');
    if (push && window.RTGRealtime) push.classList.toggle('aan', RTGRealtime.pushOn && RTGRealtime.pushOn());
  }
  document.querySelectorAll('#osCcThema button').forEach(b => b.addEventListener('click', () => {
    if (window.RTGOSThema) { RTGOSThema.zet(b.dataset.thema); ccSync(); }
  }));
  const ccTaal = $('#osCcTaal');
  if (ccTaal) ccTaal.addEventListener('click', () => { sluitScrims(); if (window.RTGi18n) RTGi18n.openModal(); });
  const ccPush = $('#osCcPush');
  if (ccPush) ccPush.addEventListener('click', async () => { if (window.RTGRealtime) { await RTGRealtime.enablePush(); ccSync(); } });
  const ccZoek = $('#osCcZoek');
  if (ccZoek) ccZoek.addEventListener('click', openZoek);
  // licht/donker: de (verborgen) gedeelde themaknop blijft de motor
  const ccLicht = $('#osCcLicht');
  if (ccLicht) ccLicht.addEventListener('click', () => { const b = $('#rtg-thema-knop'); if (b) b.click(); });
  const ccUit = $('#osCcUit');
  if (ccUit) ccUit.addEventListener('click', () => { sluitScrims(); const b = $('#logoutBtn'); if (b) b.click(); });
  // helderheid: puur visueel, onthouden per browser
  const helder = $('#osCcHelder');
  function zetHelder(v) { app.style.filter = v >= 110 ? '' : 'brightness(' + (v / 100) + ')'; try { localStorage.setItem('rtg_os_helder', String(v)); } catch (e) {} }
  if (helder) {
    const h = Number(localStorage.getItem('rtg_os_helder') || 100);
    helder.value = h; zetHelder(h);
    helder.addEventListener('input', () => zetHelder(Number(helder.value)));
  }

  /* ---------- wiebel-modus: herschikken met een lange druk ---------- */
  let wiebel = false, drukTimer = null, sleepEl = null, wiebelStart = 0;
  const klaarKnop = $('#osKlaar');
  function zetWiebel(aan) {
    wiebel = aan;
    if (aan) wiebelStart = Date.now();
    grids.forEach(g => g.classList.toggle('os-wiebel', aan));
    if (klaarKnop) klaarKnop.hidden = !aan;
    if (!aan) { grids.forEach((g, p) => bewaarVolgorde(p, [...g.children].map(c => c.dataset.sleutel))); sleepEl = null; }
  }
  if (klaarKnop) klaarKnop.addEventListener('click', () => zetWiebel(false));
  grids.forEach(grid => {
    grid.addEventListener('pointerdown', e => {
      const el = e.target.closest('.os-app'); if (!el) return;
      drukTimer = setTimeout(() => { zetWiebel(true); }, 550);
      if (wiebel) { sleepEl = el; el.classList.add('os-sleep'); el.setPointerCapture && el.setPointerCapture(e.pointerId); }
    });
    grid.addEventListener('pointermove', e => {
      if (drukTimer && (Math.abs(e.movementX) > 3 || Math.abs(e.movementY) > 3) && !wiebel) { clearTimeout(drukTimer); drukTimer = null; }
      if (!wiebel || !sleepEl) return;
      const onder = document.elementFromPoint(e.clientX, e.clientY);
      const doel = onder && onder.closest && onder.closest('.os-app');
      if (doel && doel !== sleepEl && doel.parentElement === sleepEl.parentElement) {
        const kinderen = [...sleepEl.parentElement.children];
        sleepEl.parentElement.insertBefore(sleepEl, kinderen.indexOf(doel) > kinderen.indexOf(sleepEl) ? doel.nextSibling : doel);
      }
    });
    const laat = () => { if (drukTimer) { clearTimeout(drukTimer); drukTimer = null; } if (sleepEl) { sleepEl.classList.remove('os-sleep'); sleepEl = null; grids.forEach((g, p) => bewaarVolgorde(p, [...g.children].map(c => c.dataset.sleutel))); } };
    grid.addEventListener('pointerup', laat);
    grid.addEventListener('pointercancel', laat);
  });

  /* ---------- pagina-stippen ---------- */
  function bouwDots() {
    dots.textContent = '';
    INDELING.forEach((_, i) => {
      const d = document.createElement('button');
      d.setAttribute('aria-label', 'Hoofdscherm ' + (i + 1));
      d.addEventListener('click', () => pages.scrollTo({ left: i * pages.clientWidth, behavior: 'smooth' }));
      dots.appendChild(d);
    });
    dotSync();
  }
  function dotSync() {
    const i = Math.round(pages.scrollLeft / Math.max(1, pages.clientWidth));
    [...dots.children].forEach((d, j) => d.classList.toggle('actief', j === i));
  }
  let dotRaf = null;
  pages.addEventListener('scroll', () => { if (!dotRaf) dotRaf = requestAnimationFrame(() => { dotRaf = null; dotSync(); }); });

  /* ---------- app-modus, statusbalk en model-spiegeling (als voorheen) ---------- */
  function actieveTab() { const b = tabbar.querySelector('button.active'); return b ? b.dataset.tab : 'home'; }
  function sync() {
    const tab = actieveTab(), open = tab !== 'home';
    app.classList.toggle('os-open', open);
    // schermvast zodra de app zichtbaar is: dock en pill echt onderin beeld
    document.body.classList.toggle('os-vast', getComputedStyle(app).display !== 'none');
    if (content) content.classList.toggle('os-thuis', !open);
    const terug = $('#osTerug'), brand = $('#osBrand'), titel = $('#osAppTitel');
    if (terug) terug.hidden = !open;
    if (brand) brand.style.display = open ? 'none' : '';
    if (titel) titel.textContent = open ? tabNaam(tab) : '';
    dock.querySelectorAll('.os-app').forEach(d => d.classList.toggle('actief', d.dataset.tab === tab));
  }
  let gepland = null;
  new MutationObserver(() => {
    if (gepland) return;
    gepland = requestAnimationFrame(() => { gepland = null; bouw(); });
  }).observe(tabbar, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] });
  // de gate/app-wissel (inloggen, uitloggen) stuurt de schermvaste modus
  new MutationObserver(sync).observe(app, { attributes: true, attributeFilter: ['style', 'class'] });

  const naarHome = () => { const b = tabKnop('home'); if (b) b.click(); };
  const terug = $('#osTerug'), pill = $('#osPill');
  if (terug) terug.addEventListener('click', naarHome);
  // de pill: een tik gaat naar het beginscherm, vasthouden roept de Butler
  // (het Siri-gebaar van dit OS), en omhoog vegen sluit de open app: de app
  // krimpt onder de vinger weg (of veert terug als de veeg te kort was)
  let pillLang = false, pillTimer = null, pillY = null, pillDy = 0, pillVeeg = false;
  const rustigOS = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (pill) {
    pill.addEventListener('pointerdown', e => {
      pillLang = false; pillY = e.clientY; pillDy = 0; pillVeeg = false;
      try { pill.setPointerCapture(e.pointerId); } catch (x) {}
      pillTimer = setTimeout(() => { pillLang = true; vraagButler(''); }, 550);
    });
    pill.addEventListener('pointermove', e => {
      if (pillY == null || pillLang) return;
      pillDy = Math.max(0, pillY - e.clientY);
      if (pillDy > 8 && !pillVeeg) {
        pillVeeg = true;
        if (pillTimer) { clearTimeout(pillTimer); pillTimer = null; } // vegen is geen vasthouden
      }
      if (!pillVeeg || rustigOS || !content) return;
      const p = Math.min(pillDy / 240, 1);
      content.style.transformOrigin = '50% 90%';
      content.style.transform = 'scale(' + (1 - p * 0.15).toFixed(4) + ') translateY(' + Math.round(-pillDy * 0.35) + 'px)';
      content.style.opacity = String(1 - p * 0.3);
    });
    const pillLos = () => {
      if (pillTimer) { clearTimeout(pillTimer); pillTimer = null; }
      if (pillY == null) return;
      const d = pillDy; pillY = null;
      if (!pillVeeg || !content) return;
      if (d > 70) {
        content.style.transform = ''; content.style.opacity = '';
        if (rustigOS) { naarHome(); return; }
        content.classList.add('os-veeg-weg');
        setTimeout(() => { naarHome(); content.classList.remove('os-veeg-weg'); }, 170);
      } else {
        content.classList.add('os-veeg-terug');
        content.style.transform = ''; content.style.opacity = '';
        setTimeout(() => content.classList.remove('os-veeg-terug'), 240);
      }
    };
    pill.addEventListener('pointerup', pillLos);
    pill.addEventListener('pointercancel', pillLos);
    pill.addEventListener('click', () => { if (!pillLang && !pillVeeg) naarHome(); pillLang = false; pillVeeg = false; });
  }

  /* De klok en de datum komen van de ene RTG-klok (/shared/klok.js), zodat
     elke app exact dezelfde tijd toont: Bodoni-cijfers met seconden en
     milliseconden. De elementen dragen data-rtg-klok / data-rtg-datum. */
  if (window.RTGKlok) RTGKlok.alles();

  /* Een app (zoals Balans) kan met #ai terugverwijzen naar de Rahul-chat:
     na het opstarten openen we dan meteen de AI-tab. */
  if (location.hash === '#ai') setTimeout(() => {
    const t = document.querySelector('.os-app[data-tab="ai"]');
    if (t) t.click();
  }, 600);

  /* ---------- batterij in de statusbalk, zoals op een telefoon ---------- */
  const bat = $('#osBat'), batVul = $('#osBatVul'), batPct = $('#osBatPct');
  if (bat && navigator.getBattery) {
    navigator.getBattery().then(b => {
      const verf = () => {
        bat.hidden = false;
        const p = Math.round(b.level * 100);
        batVul.style.width = Math.max(6, p) + '%';
        batPct.textContent = p + '%';
        bat.classList.toggle('laag', p <= 20 && !b.charging);
      };
      b.addEventListener('levelchange', verf);
      b.addEventListener('chargingchange', verf);
      verf();
    }).catch(() => {});
  }

  /* ---------- notificatie-banner: glijdt bovenin binnen ---------- */
  let bannerEl = null, bannerTimer = null;
  function bannerToon(icoon, titel, tekst) {
    if (!bannerEl) {
      bannerEl = document.createElement('button');
      bannerEl.className = 'os-banner';
      bannerEl.setAttribute('aria-live', 'polite');
      bannerEl.addEventListener('click', () => { bannerWeg(); const b = $('#bell'); if (b) b.click(); });
      app.appendChild(bannerEl);
    }
    bannerEl.textContent = '';
    const ic = document.createElement('span'); ic.className = 'ob-ic'; ic.textContent = icoon || '🔔';
    const kol = document.createElement('span');
    const t = document.createElement('div'); t.className = 'ob-titel'; t.textContent = titel || 'RTG';
    kol.appendChild(t);
    if (tekst) { const bd = document.createElement('div'); bd.className = 'ob-body'; bd.textContent = tekst; kol.appendChild(bd); }
    bannerEl.appendChild(ic); bannerEl.appendChild(kol);
    requestAnimationFrame(() => bannerEl.classList.add('open'));
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(bannerWeg, 4500);
  }
  function bannerWeg() {
    if (bannerEl) bannerEl.classList.remove('open');
    if (bannerTimer) { clearTimeout(bannerTimer); bannerTimer = null; }
  }
  // live meldingen als banner: de kern geeft zijn onChange pas bij start() aan
  // de realtime-bus, dus wikkelen we start() in en haken we daar op mee.
  if (window.RTGRealtime && typeof RTGRealtime.start === 'function') {
    const echteStart = RTGRealtime.start.bind(RTGRealtime);
    RTGRealtime.start = (token, opts) => {
      opts = opts || {};
      const oud = opts.onChange;
      opts.onChange = n => {
        if (oud) oud(n);
        if (n && n.title) bannerToon(n.icon || '🔔', n.title, n.body || '');
      };
      return echteStart(token, opts);
    };
  }

  /* ---------- de Butler bestuurt het OS ----------
     Zinnen die het OS zelf kan uitvoeren (open <app>, thema, licht/donker,
     zoek, home) onderscheppen we in de capture-fase, vóór de chat-handlers;
     al het andere gaat gewoon door naar de Butler-chat, die met zijn
     acties-registry op de server bestelt, boekt, betaalt en annuleert. */
  function alleDoelen() {
    const uit = [];
    for (const { item } of alleItems()) uit.push({ naam: itemNaam(item), doe: () => openItem(item) });
    INDELING.flat().forEach(it => { if (typeof it !== 'string') uit.push({ naam: mapNaam(it), doe: () => openMap(it) }); });
    return uit;
  }
  function osCommando(ruw) {
    const schoon = (ruw || '').trim().replace(/[?.!]+$/, '');
    const q = schoon.toLowerCase();
    if (!q) return false;
    if (/^(home|thuis|beginscherm)$/.test(q)) { sluitScrims(); naarHome(); bannerToon('✦', 'Rahul', 'Naar het beginscherm.'); return true; }
    // elke functie een eigen app: bellen en videobellen direct via de Butler
    if (/^(bel|bellen|iemand bellen)$/.test(q)) { sluitScrims(); openItem('os:bellen'); return true; }
    if (/^(videobel|videobellen|video bellen)$/.test(q)) { sluitScrims(); openItem('os:videobellen'); return true; }
    // RTF met leeftijd erbij slaat de keuze over: "open rtf kids"
    let mr = q.match(/^(?:open\s+|start\s+|ga naar\s+)?rtf\s+(mini|kids|kind|tiener|jong|volw|volwassen)$/);
    if (mr) {
      const g = ({ kids: 'kind', volwassen: 'volw' })[mr[1]] || mr[1];
      sluitScrims(); location.href = '/apps/foundation/index.html?groep=' + g;
      return true;
    }
    // mappen hernoemen: "hernoem sociaal naar vrienden" of "noem de map rtg & info om naar over rtg"
    const mh = schoon.match(/^(?:hernoem|noem)\s+(?:de\s+)?(?:map\s+)?(.+?)\s+(?:om\s+)?naar\s+(.+)$/i);
    if (mh) {
      // lidwoorden tellen niet mee: "de crew" en "crew" wijzen dezelfde map aan
      const kaal = s => String(s || '').toLowerCase().replace(/^(?:de|het|een)\s+/, '');
      const mappen = INDELING.flat().filter(it => typeof it !== 'string');
      const doel = mappen.find(mp => kaal(mapNaam(mp)) === kaal(mh[1]) || kaal(mp.naam) === kaal(mh[1]));
      if (doel) {
        zetMapNaam(doel, mh[2]);
        bannerToon('✦', 'Rahul', 'De map heet nu "' + mapNaam(doel) + '".');
        return true;
      }
    }
    let m = q.match(/^zoek(?:en)?(?:\s+naar)?\s+(.+)$/);
    if (m) { openZoek(); zoekInput.value = m[1]; zoek(); return true; }
    m = q.match(/^thema\s+(bordeaux|parelmoer|standaard|klassiek)$/);
    if (m && window.RTGOSThema && RTGOSThema.keuzeMogelijk()) {
      RTGOSThema.zet(m[1] === 'klassiek' ? 'standaard' : m[1]);
      bannerToon('✦', 'Rahul', 'Het thema staat op ' + m[1] + '.');
      return true;
    }
    if (/^(licht|donker|lichte modus|donkere modus)$/.test(q)) {
      const b = $('#rtg-thema-knop');
      if (b) { b.click(); bannerToon('✦', 'Rahul', 'De weergave is omgezet.'); return true; }
      return false;
    }
    m = q.match(/^(?:open|start|ga naar)\s+(.+)$/);
    if (m) {
      const naam = m[1].replace(/^(?:de|het|een)\s+/, '');
      const doelen = alleDoelen();
      const doel = doelen.find(d => d.naam.toLowerCase() === naam) || doelen.find(d => d.naam.toLowerCase().includes(naam));
      if (doel) { sluitScrims(); doel.doe(); bannerToon('✦', 'Rahul', doel.naam + ' staat voor u open.'); return true; }
    }
    return false;
  }
  document.addEventListener('click', e => {
    if (!e.target || !e.target.closest || !e.target.closest('#askBtn')) return;
    const inp = $('#askInput');
    if (inp && osCommando(inp.value)) { inp.value = ''; e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target || e.target.id !== 'askInput') return;
    if (osCommando(e.target.value)) { e.target.value = ''; e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);

  /* ---------- widgets op hoofdscherm 2: verbergen, terughalen, herschikken ----------
     Zelfde gebaar als bij de iconen: lang drukken op een kaart zet de
     wiebel-modus aan; de minus verbergt, de gestippelde chips halen terug,
     slepen herschikt. Kaarten die de app zelf verbergt (hidden-attribuut)
     blijven van de app; wij beheren alleen onze eigen klasse. */
  const pagina2 = $('#osPagina2'), wChips = $('#osWChips');
  const W_NAMEN = {
    homeTrip: 'Reis', homePay: 'Betalen', homeSalon: 'De Salon', homeContacts: 'Contacten',
    homeSpelen: 'Spelen', homeCv: 'CV', homeVacatures: 'Vacatures', homeFoundation: 'Foundation'
  };
  function wStand() { try { return JSON.parse(localStorage.getItem('rtg_os_widgets_' + pas) || 'null') || {}; } catch (e) { return {}; } }
  function wBewaar(st) { try { localStorage.setItem('rtg_os_widgets_' + pas, JSON.stringify(st)); } catch (e) {} }
  const wKaarten = () => pagina2 ? [...pagina2.querySelectorAll(':scope > .card')].filter(c => W_NAMEN[c.id]) : [];
  function wToepas() {
    if (!pagina2) return;
    const st = wStand(), kaarten = wKaarten();
    kaarten.forEach(c => c.classList.toggle('os-w-verborgen', (st.verborgen || []).includes(c.id)));
    const perId = new Map(kaarten.map(c => [c.id, c]));
    (st.volgorde || []).forEach(id => { const c = perId.get(id); if (c) pagina2.appendChild(c); });
  }
  let wiebelW = false, wSleep = null, wTimer = null;
  function wChipsBouw() {
    if (!wChips) return;
    wChips.textContent = '';
    for (const id of wStand().verborgen || []) {
      if (!document.getElementById(id)) continue;
      const b = document.createElement('button');
      b.textContent = '+ ' + (W_NAMEN[id] || id);
      b.addEventListener('click', () => {
        const s = wStand(); s.verborgen = (s.verborgen || []).filter(x => x !== id); wBewaar(s);
        wToepas(); zetWiebelW(true);
      });
      wChips.appendChild(b);
    }
  }
  function zetWiebelW(aan) {
    wiebelW = aan;
    if (!pagina2) return;
    pagina2.classList.toggle('os-wiebel-w', aan);
    if (klaarKnop) klaarKnop.hidden = !(aan || wiebel);
    pagina2.querySelectorAll('.os-w-min').forEach(b => b.remove());
    if (aan) {
      for (const c of wKaarten()) {
        if (c.hidden || c.classList.contains('os-w-verborgen')) continue;
        const min = document.createElement('button');
        min.className = 'os-w-min'; min.textContent = '−';
        min.setAttribute('aria-label', 'Verberg widget ' + (W_NAMEN[c.id] || c.id));
        min.addEventListener('click', e => {
          e.stopPropagation();
          const s = wStand(); s.verborgen = [...new Set([...(s.verborgen || []), c.id])]; wBewaar(s);
          wToepas(); zetWiebelW(true);
        });
        c.appendChild(min);
      }
      wChipsBouw();
    } else {
      const s = wStand(); s.volgorde = wKaarten().map(c => c.id); wBewaar(s); wSleep = null;
    }
  }
  if (klaarKnop) klaarKnop.addEventListener('click', () => { if (wiebelW) zetWiebelW(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && wiebelW) zetWiebelW(false); });
  if (pagina2) {
    pagina2.addEventListener('pointerdown', e => {
      const c = e.target.closest('.card');
      if (!c || c.parentElement !== pagina2 || !W_NAMEN[c.id]) return;
      if (e.target.closest('button, a, input') && !wiebelW) return; // knoppen in widgets gewoon laten werken
      wTimer = setTimeout(() => zetWiebelW(true), 550);
      if (wiebelW && !e.target.closest('.os-w-min')) { wSleep = c; c.classList.add('os-sleep'); }
    });
    pagina2.addEventListener('pointermove', e => {
      if (wTimer && !wiebelW && (Math.abs(e.movementX) > 3 || Math.abs(e.movementY) > 3)) { clearTimeout(wTimer); wTimer = null; }
      if (!wiebelW || !wSleep) return;
      const onder = document.elementFromPoint(e.clientX, e.clientY);
      const doel = onder && onder.closest && onder.closest('.card');
      if (doel && doel !== wSleep && doel.parentElement === pagina2) {
        const kinderen = [...pagina2.children];
        pagina2.insertBefore(wSleep, kinderen.indexOf(doel) > kinderen.indexOf(wSleep) ? doel.nextSibling : doel);
      }
    });
    const wLos = () => {
      if (wTimer) { clearTimeout(wTimer); wTimer = null; }
      if (wSleep) {
        wSleep.classList.remove('os-sleep'); wSleep = null;
        const s = wStand(); s.volgorde = wKaarten().map(c => c.id); wBewaar(s);
      }
    };
    pagina2.addEventListener('pointerup', wLos);
    pagina2.addEventListener('pointercancel', wLos);
    wToepas();
  }

  bouw(); bouwDots();

  /* De app-regie van de RTG-boardroom: apps die voor deze pas zijn uitgezet
     verdwijnen van het springboard (de server weigert hun API's sowieso al;
     dit houdt het scherm eerlijk). De sleutel hier is de functie-id op het
     schakelbord; alles wat niet genoemd wordt, blijft gewoon staan. */
  const REGIE = { spelen: 'spellen', podium: 'podium', flits: 'flits', theater: 'theater',
    wbw: 'wbw', passkeys: 'webauthn', ov: 'ov', clips: 'clips', office: 'kantoorpakket', vonk: 'vonk' };
  (function () {
    let tok = null; try { tok = localStorage.getItem('rtg_member_token'); } catch (e) {}
    if (!tok) return;
    fetch('/api/member/apps', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: '{}' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d || !Array.isArray(d.uit) || !d.uit.length) return;
        const uit = new Set(d.uit);
        let anders = false;
        for (const sleutel of Object.keys(REGIE))
          if (uit.has(REGIE[sleutel]) && LINKS[sleutel]) { delete LINKS[sleutel]; anders = true; }
        if (anders) bouw();
      }).catch(() => {});
    /* De RTG Bank-tegel bestaat pas als de boardroom de leden-bank live heeft
       gezet: de registry-invoer ontbreekt standaard ('link:bank' in de indeling
       blijft dan onzichtbaar) en komt er hier bij zodra de bank online meldt. */
    fetch('/api/bank/overzicht', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: '{}' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d && d.online) { LINKS.bank = { naam: 'RTG Bank', icoon: '🏦', url: '/apps/bank.html' }; bouw(); }
      }).catch(() => {});
  })();
})();
  /* ---------- Onderweg (live reis) ---------- */
  let liveData = null;
  let liveMode = 'driving';
  let simTimer = null;
  const RIDE_ST = { 'wacht-op-betaling':'awaiting payment', 'aangevraagd':'requested', 'geaccepteerd':'confirmed', 'onderweg':'on the way', 'aangekomen':'arrived', 'rijdt':'driving', 'aan-boord':'on board', 'gearriveerd':'completed', 'afgerond':'completed', 'geweigerd':'declined' };
  const tRide = s => (lang() === 'en' ? (RIDE_ST[s] || s) : s);

  async function renderLive(){
    if (!API.live){ $('#livePanel').innerHTML = ''; return; }
    try { liveData = (await API.call('/live/state')).live; }
    catch (e){ $('#livePanel').innerHTML = ''; return; }
    if (!liveData || !liveData.active){ stopSim(); renderLiveStart(); }
    else renderLivePanel();
  }

  function renderLiveStart(){
    const opts = suppliers.map(s => '<option value="' + s.code + '">' + s.name + ' (' + tType(s.typeLabel) + ')</option>').join('');
    const modes = [['walking','Lopen'],['driving','Rijden'],['flying','Vliegen']];
    $('#livePanel').innerHTML =
      '<div class="live-start">' +
        '<div class="lh">' + T('live.start.h','Ergens heen?') + '</div>' +
        '<div class="ld">' + T('live.start.d','Zet uw reis live. Uw partners, uw taxi, het restaurant, zien waar u bent en zorgen dat alles klaarstaat wanneer u aankomt. Altijd op codenaam, nooit op naam.') + '</div>' +
        '<div class="live-dest-row"><select id="liveDest">' + opts + '</select></div>' +
        '<div class="live-mode">' + modes.map(m => '<button data-mode="' + m[0] + '"' + (m[0]===liveMode?' class="on"':'') + '>' + T('live.mode.'+m[0], m[1]) + '</button>').join('') + '</div>' +
        '<button class="live-go" id="liveGo">' + T('live.go','Start onderweg') + '</button>' +
        '<button class="live-go" id="liveDeel" style="margin-top:0.45rem;background:none;border:1px solid var(--line);color:var(--txt);">📍 ' + T('live.deel','Deel mijn live locatie met deze zaak') + '</button>' +
        '<div style="margin-top:0.4rem;font-size:0.62rem;color:var(--soft);line-height:1.5;">' + T('live.deel.s','Alleen deze zaak ziet dan waar u bent, tot de zaak het niet meer nodig heeft of u het zelf stopt.') + '</div>' +
      '</div>';
    $('#livePanel').querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
      liveMode = b.dataset.mode;
      $('#livePanel').querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x.dataset.mode === liveMode));
    }));
    $('#liveGo').addEventListener('click', startLive);
    const ld = $('#liveDeel');
    if (ld) ld.addEventListener('click', async () => {
      try {
        const r = await API.call('/locatie/deel', { supplierCode: $('#liveDest').value });
        toast('📍 ' + r.deel.supplierName + ' ' + T('live.deelok','kijkt nu met u mee, tot het niet meer nodig is.'));
        renderZorg();
      } catch(e){ toast(e.message); }
    });
  }

  /* ---------- Toren 3: RTG Shared Assets ----------
     Altijd 300 tickets per object; een ticket is 24 uur per jaar, tien jaar
     lang. Access loopt af, Asset heeft restwaarde en stapt uit via een Tik. */
  async function renderAssets(){
    const el = $('#assetsWrap'); if (!el) return;
    if (!API.live){ el.innerHTML = ''; return; }
    let d, mijn;
    try {
      d = await API.call('/assets');
      mijn = (await API.call('/asset/mijn')).posities || [];
    } catch(e){ el.innerHTML = ''; return; }
    const posVan = id => mijn.find(p => p.assetId === id);
    el.innerHTML = d.assets.map(a => {
      const p = posVan(a.id);
      const vol = a.beschikbaar === 0;
      return '<div class="live-start" style="margin-top:0.8rem;">' +
        '<div class="lh">' + a.icon + ' ' + esc(a.naam) + '</div>' +
        '<div class="ld">' + esc(a.beschrijving) + '<br>' + esc(a.waar) + ' · ' + T('as.waarde','objectwaarde') + ' ' + eur(a.waarde) + '</div>' +
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.55rem;font-size:0.72rem;color:var(--soft);">' +
          '<span style="border:1px solid var(--line);border-radius:999px;padding:0.2rem 0.6rem;">' + a.totaal + ' ' + T('as.tickets','tickets') + ' · ' + (vol ? T('as.vol','uitverkocht') : a.beschikbaar + ' ' + T('as.vrij','beschikbaar')) + '</span>' +
          '<span style="border:1px solid var(--line);border-radius:999px;padding:0.2rem 0.6rem;">1 ' + T('as.ticket','ticket') + ' = 24 ' + T('as.uur','uur per jaar') + ' · ' + d.regels.jaren + ' ' + T('as.jaar','jaar') + '</span>' +
          '<span style="border:1px solid var(--line);border-radius:999px;padding:0.2rem 0.6rem;">' + T('as.tw','ticketwaarde nu') + ' ' + eur(a.ticketWaarde) + '</span>' +
        '</div>' +
        (p ? '<div style="margin-top:0.7rem;border:1px solid var(--gold-soft,rgba(201,154,46,0.4));border-radius:12px;padding:0.6rem 0.75rem;font-size:0.78rem;">' +
            '<b>' + T('as.mijn','Mijn positie') + ':</b> ' + p.tickets + ' ' + T('as.tickets','tickets') + ' (' + p.access + ' Access · ' + p.asset + ' Asset)' + (p.tickets ? ' · ' +
            '<b style="color:var(--gold-bright,#C99A2E);">' + p.dagenTegoed + '</b> ' + T('as.dagen','x 24 uur over dit jaar') + ' · ' + T('as.geldig','geldig tot') + ' ' + p.vervaltOp : '') +
            (p.asset ? '<br>' + T('as.uitstapw','Uitstapwaarde vandaag') + ': <b>' + eur(p.uitstapWaarde) + '</b>' : '') +
            ((p.terugkoopOnderweg||[]).length ? '<br>⏳ ' + T('as.tkw','Terugkoop onderweg') + ': ' + p.terugkoopOnderweg.map(v => eur(v.waarde) + ' ' + T('as.uiterlijk','uiterlijk') + ' ' + v.uiterlijk).join(', ') : '') +
            (p.gepland.length ? '<br>📅 ' + T('as.gepland','Gepland') + ': ' + p.gepland.join(', ') : '') +
            '<div style="display:flex;gap:0.45rem;flex-wrap:wrap;margin-top:0.5rem;">' +
              (p.tickets ? '<input type="date" data-asdatum="' + a.id + '" min="' + new Date().toISOString().slice(0,10) + '" style="flex:1;min-width:130px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.6rem;font-size:0.78rem;color:var(--txt);" aria-label="' + T('as.dag','Kies uw dag') + '">' +
              '<button class="mo-code js-asboek" data-id="' + a.id + '">' + T('as.boek','Boek mijn 24 uur') + '</button>' : '') +
              (p.asset ? '<button class="mo-code js-asuit" data-id="' + a.id + '" data-tid="' + p.assetTicketIds[0] + '" data-w="' + p.ticketWaarde + '">' + T('as.uitstap','Stap uit (1 ticket)') + '</button>' : '') +
              ((p.herroepbaar||[]).length ? '<button class="mo-code js-asherroep" data-tid="' + p.herroepbaar[0].id + '" data-p="' + p.herroepbaar[0].prijs + '">↩ ' + T('as.herroep','Herroep (14 dgn)') + '</button>' : '') +
            '</div></div>' : '') +
        (vol
          ? '<div style="margin-top:0.7rem;font-size:0.74rem;color:var(--soft);">' + T('as.volh','De pool is vol.') + ' ' + (a.wachtenden ? a.wachtenden + ' ' + T('as.wachten','op de wachtlijst.') : '') + '</div>' +
            (a.opWachtlijst
              ? '<div style="margin-top:0.4rem;font-size:0.74rem;color:var(--gold-bright,#C99A2E);">✓ ' + T('as.opwl','U staat op de wachtlijst; bij de eerstvolgende uitstapper bent u aan de beurt.') + '</div>'
              : '<button class="live-go js-aswacht" data-id="' + a.id + '" style="margin-top:0.5rem;">' + T('as.wachtknop','Zet mij op de wachtlijst') + '</button>')
          : '<div style="margin-top:0.7rem;font-size:0.72rem;color:var(--soft);line-height:1.6;">' +
            '<b style="color:var(--txt);">Access</b> · ' + eur(a.prijsAccess) + ' · ' + T('as.access.s','dienstenvoucher: alleen het gebruik (25% van de ticketwaarde). Teller reset elk jaar, na tien jaar is het klaar.') + '<br>' +
            '<b style="color:var(--txt);">Asset</b> · ' + eur(a.prijsAsset) + ' · ' + T('as.asset.s','deelnemingsbewijs in') + ' ' + esc(a.entiteit) + ': ' + T('as.asset.s2','zelfde gebruik, plus uw aandeel in de restwaarde. Uitstappen via de wachtlijst, anders koopt RTG terug binnen 30 dagen.') + '<br>' +
            '<span style="font-size:0.66rem;">' + T('as.taxatie','Servicefee') + ' ' + eur(a.serviceFee) + '/' + T('as.perjaar','jaar per ticket') + ' · ' + T('as.bedenk','14 dagen bedenktijd met volledige terugbetaling') + ' · ' + T('as.beweegt','prijzen en uitstapwaarde bewegen mee met de taxatie.') + '</span></div>' +
          '<div style="display:flex;gap:0.45rem;flex-wrap:wrap;margin-top:0.5rem;">' +
            '<input type="number" min="1" max="10" value="1" data-asaantal="' + a.id + '" style="width:64px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.6rem;font-size:0.8rem;color:var(--txt);" aria-label="aantal">' +
            '<button class="live-go js-askoop" data-id="' + a.id + '" data-smaak="access" style="flex:1;margin-top:0;">Access</button>' +
            '<button class="live-go js-askoop" data-id="' + a.id + '" data-smaak="asset" data-ent="' + esc(a.entiteit) + '" data-fee="' + a.serviceFee + '" style="flex:1;margin-top:0;background:var(--gold-bright,#C99A2E);">Asset</button>' +
          '</div>')+
        '<button class="mo-code js-asdoc" data-id="' + a.id + '" style="margin-top:0.5rem;">📄 ' + T('as.doc','Essentiele informatie') + '</button>' +
        '<div data-asdocuit="' + a.id + '" style="display:none;margin-top:0.5rem;font-size:0.7rem;color:var(--soft);line-height:1.6;border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.75rem;"></div>' +
      '</div>';
    }).join('');
    el.querySelectorAll('.js-askoop').forEach(b => b.addEventListener('click', async () => {
      const aantal = parseInt((el.querySelector('[data-asaantal="' + b.dataset.id + '"]') || {}).value, 10) || 1;
      const body = { assetId: b.dataset.id, smaak: b.dataset.smaak, aantal };
      if (b.dataset.smaak === 'asset'){
        // deelnemingsbewijs: uitdrukkelijk akkoord na de kerninformatie
        if (!window.confirm(T('as.akk1','U koopt een deelnemingsbewijs in') + ' ' + b.dataset.ent + '.\n\n' +
          T('as.akk2','De restwaarde beweegt mee met de taxatie en kan dalen. Jaarlijkse servicefee:') + ' ' + eur(Number(b.dataset.fee)) + ' ' + T('as.akk3','per ticket. Uitstappen loopt eerst via de wachtlijst; anders koopt RTG terug binnen 30 dagen. U heeft 14 dagen bedenktijd met volledige terugbetaling.') + '\n\n' +
          T('as.akk4','Gaat u akkoord?'))) return;
        body.akkoord = true;
      }
      try {
        const r = await API.call('/asset/koop', body);
        toast('🎟️ ' + r.tickets.length + ' ticket(s) · ' + eur(r.totaalPrijs) + '. ' + T('as.welkom','Welkom in de pool.'));
        renderAssets();
      } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-aswacht').forEach(b => b.addEventListener('click', async () => {
      try { const r = await API.call('/asset/wachtlijst', { assetId: b.dataset.id }); toast('📋 ' + T('as.wlok','U staat op de wachtlijst, positie') + ' ' + r.positie + '.'); renderAssets(); }
      catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-asherroep').forEach(b => b.addEventListener('click', async () => {
      if (!window.confirm(T('as.herroepvraag','Herroepen binnen de bedenktijd? U krijgt de volledige koopsom') + ' (' + eur(Number(b.dataset.p)) + ') ' + T('as.herroepvraag2','terug via een Tik.'))) return;
      try { const r = await API.call('/asset/herroep', { ticketId: b.dataset.tid }); toast('↩ ' + T('as.herroepok','Herroepen. De Tik van') + ' ' + eur(r.terug) + ' ' + T('as.uitok2','staat in uw tegoed.')); renderAssets(); }
      catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-asdoc').forEach(b => b.addEventListener('click', async () => {
      const uit = el.querySelector('[data-asdocuit="' + b.dataset.id + '"]');
      if (!uit) return;
      if (uit.style.display !== 'none'){ uit.style.display = 'none'; return; }
      try {
        const d = (await API.call('/asset/document', { assetId: b.dataset.id })).document;
        uit.innerHTML = '<b style="color:var(--txt);">' + esc(d.object) + '</b> · ' + esc(d.entiteit) + '<br>' +
          esc(d.gebruik) + '<br><b>Access:</b> ' + esc(d.smaken.access.aard) + '<br><b>Asset:</b> ' + esc(d.smaken.asset.aard) + '<br>' +
          esc(d.kosten.serviceFee) + '<br>' + esc(d.kosten.overdracht) + '<br><b>' + T('as.doc.uit','Uitstappen') + ':</b> ' + esc(d.uitstappen) + '<br><b>' + T('as.doc.bed','Bedenktijd') + ':</b> ' + esc(d.bedenktijd) + '<br><b>' + T('as.doc.risico','Risico') + ':</b> ' + esc(d.risico);
        uit.style.display = '';
      } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-asboek').forEach(b => b.addEventListener('click', async () => {
      const datum = (el.querySelector('[data-asdatum="' + b.dataset.id + '"]') || {}).value;
      if (!datum){ toast(T('as.kiesdag','Kies eerst een dag.')); return; }
      try { const r = await API.call('/asset/gebruik', { assetId: b.dataset.id, datum }); toast('📅 ' + datum + ' ' + T('as.vast','staat vast.') + ' ' + r.dagenTegoed + ' ' + T('as.dagenover','x 24 uur over dit jaar.')); renderAssets(); }
      catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-asuit').forEach(b => b.addEventListener('click', async () => {
      if (!window.confirm(T('as.uitvraag','Uitstappen? RTG betaalt de actuele ticketwaarde') + ' (' + eur(Number(b.dataset.w)) + ') ' + T('as.uitvraag2','uit via een Tik en het ticket gaat terug in de pool.'))) return;
      try { const r = await API.call('/asset/uitstap', { ticketId: b.dataset.tid }); toast('💰 ' + T('as.uitok','Uitgestapt. De Tik van') + ' ' + eur(r.waarde) + ' ' + T('as.uitok2','staat in uw tegoed.')); renderAssets(); }
      catch(e){ toast(e.message); }
    }));
  }

  /* ---------- het brein van De Butler: geheugen en seintjes ----------
     Het gesprek zelf loopt via de gewone Butler-chat op de AI-tab; deze
     kaart toont rustig wat hij weet (wisbaar) en wat hij zelf ziet. */
  let fluisterSyncAt = 0;
  async function renderFluister(){
    const el = $('#fluisterWrap'); if (!el) return;
    if (!API.live){ el.innerHTML = ''; return; }
    // de inklap-laag deelt (alleen) de gebruikstellers, zodat de Butler leert
    if (window.FocusUI && Date.now() - fluisterSyncAt > 60000){
      fluisterSyncAt = Date.now();
      API.call('/fluister/focus', { scores: FocusUI.scores() }).catch(() => {});
    }
    let prof;
    try { prof = await API.call('/fluister/profiel'); } catch(e){ el.innerHTML = ''; return; }
    // de voorspeller: RTG leert uw ritme en zet de beste verwachting klaar
    let vw = null;
    try { vw = await API.call('/voorspel'); } catch(e){}
    const v = vw && (vw.verwachtingen || [])[0];
    // synergie-pakketten: aanbod dat zaken samen hebben samengesteld
    let pk = [];
    try { pk = ((await API.call('/pakketten')).pakketten || []).slice(0, 2); } catch(e){}
    el.innerHTML =
      (v
        ? '<div class="live-start" style="margin-bottom:0.8rem;">' +
            '<div class="lh">🔮 ' + T('vs.h','Rahul verwacht') + '</div>' +
            '<div class="ld">' + esc(v.wat) + ' · ' + esc(v.waarom) + '. ' +
              T('vs.d','Klopt het niet, dan negeert u dit gewoon; Rahul leert vanzelf bij.') + '</div>' +
            '<button class="chip js-vsdoe" style="margin-top:0.5rem;">🤵 ' + T('vs.doe','Laat Rahul het klaarzetten') + '</button>' +
          '</div>'
        : '') +
      (pk.length
        ? '<div class="live-start" style="margin-bottom:0.8rem;">' +
            '<div class="lh">🤝 ' + T('pk.h','Pakketten van onze huizen') + '</div>' +
            pk.map(p => '<div style="margin-top:0.45rem;">' +
              '<div style="font-size:0.85rem;"><b>' + esc(p.naam) + '</b> · € ' + (p.prijsCenten/100).toFixed(2).replace('.', ',') + '</div>' +
              '<div style="font-size:0.72rem;color:var(--soft);">' + p.zaken.map(esc).join(' + ') +
                (p.omschrijving ? ' · ' + esc(p.omschrijving) : '') + '</div>' +
              '<button class="chip js-pkboek" data-pk="' + esc(p.id) + '" data-pknaam="' + esc(p.naam) + '" data-pkprijs="' + p.prijsCenten + '" style="margin-top:0.35rem;">' + T('pk.boek','Boek dit pakket') + '</button></div>').join('') +
          '</div>'
        : '') +
      '<div class="live-start" style="margin-bottom:0.8rem;">' +
        '<div class="lh">🤵 ' + T('fl.h','Wat Rahul weet en ziet') + '</div>' +
        '<div class="ld">' + T('fl.d','Hij onthoudt wat u vertelt ("onthoud dat..."), leert van wat u gebruikt en regelt alles in de chat hieronder: zoeken, reserveren, bestellen en afrekenen, uw 24 uur, een Tik of betaalverzoek. Vraag "wat kun je" voor het hele overzicht; geld gaat nooit zonder uw "ja" de deur uit.') + '</div>' +
        ((prof.seintjes || []).length
          ? '<div style="margin-top:0.55rem;border:1px solid var(--line);border-radius:12px;padding:0.55rem 0.7rem;">' +
              '<div style="font-size:0.6rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">' + T('fl.sein','Rahul ziet') + '</div>' +
              prof.seintjes.map(x => '<div style="margin-top:0.3rem;font-size:0.76rem;line-height:1.45;">' + esc(x.icoon) + ' ' + esc(x.tekst) + '</div>').join('') + '</div>'
          : '') +
        (prof.weetjes.length
          ? '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.5rem;">' + prof.weetjes.map((w, i) =>
              '<span style="display:inline-flex;align-items:center;gap:0.35rem;border:1px solid var(--line);border-radius:999px;padding:0.25rem 0.6rem;font-size:0.68rem;color:var(--txt);">' + esc(w.tekst) +
              '<button class="js-flweg" data-i="' + i + '" aria-label="' + T('fl.weg','vergeet dit') + '" style="background:none;border:none;color:var(--soft);cursor:pointer;font-size:0.75rem;padding:0;">✕</button></span>').join('') + '</div>'
          : '<div style="margin-top:0.5rem;font-size:0.68rem;color:var(--soft);">' + T('fl.leeg','Nog geen weetjes. Zeg bijvoorbeeld: "onthoud dat ik cava drink, nooit rode wijn".') + '</div>') +
        (prof.top.length ? '<div style="margin-top:0.4rem;font-size:0.64rem;color:var(--soft);">' + T('fl.top','Ik zie dat u het meest werkt met') + ': ' + prof.top.map(esc).join(', ') + '.</div>' : '') +
      '</div>';
    el.querySelectorAll('.js-flweg').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/fluister/vergeet', { wat: Number(b.dataset.i) }); renderFluister(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-vsdoe').forEach(b => b.addEventListener('click', () => {
      const tegel = document.querySelector('.os-app[data-tab="ai"]'); if (tegel) tegel.click();
      if (typeof ask === 'function') ask(v.vraag);
    }));
    el.querySelectorAll('.js-pkboek').forEach(b => b.addEventListener('click', async () => {
      const prijs = '€ ' + (Number(b.dataset.pkprijs)/100).toFixed(2).replace('.', ',');
      if (!window.confirm(T('pk.zeker','Pakket boeken voor') + ' ' + prijs + '? ' + T('pk.zeker2','Het bedrag gaat direct van uw RTG Pay-saldo.'))) return;
      try {
        await API.call('/pakket/koop', { id: b.dataset.pk, idem: 'pk' + Date.now() });
        toast('🤝 ' + T('pk.ok','Geboekt. De zaken weten ervan.'));
        renderFluister();
      } catch(e){ toast(e.message); }
    }));
  }

  /* ---------- de zorgvolle keten: zorgprofiel + wie kijkt mee ---------- */
  async function renderZorg(){
    const el = $('#zorgPanel'); if (!el) return;
    if (!API.live){ el.innerHTML = ''; return; }
    let zorg, delen;
    try {
      zorg = (await API.call('/zorgprofiel')).zorg;
      delen = await API.call('/locatie/mijn');
    } catch(e){ el.innerHTML = ''; return; }
    el.innerHTML =
      '<div class="live-start" style="margin-top:0.8rem;">' +
        '<div class="lh">🩺 ' + T('zorg.h','Mijn zorgprofiel') + '</div>' +
        '<div class="ld">' + T('zorg.d','Allergenen en aandachtspunten reizen automatisch mee met uw bestellingen en verblijven, alleen als u delen aanzet. De keuken en de receptie weten het dan meteen.') + '</div>' +
        '<input id="zAll" placeholder="' + T('zorg.all','Allergenen, gescheiden door komma (bijv. noten, schaaldieren)') + '" value="' + esc((zorg.allergenen || []).join(', ')) + '" style="width:100%;margin-top:0.5rem;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);">' +
        '<input id="zDieet" placeholder="' + T('zorg.dieet','Dieet (bijv. vegetarisch, halal)') + '" value="' + esc(zorg.dieet || '') + '" style="width:100%;margin-top:0.4rem;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);">' +
        '<input id="zMed" placeholder="' + T('zorg.med','Medische aandachtspunten (bijv. diabetes, rolstoel)') + '" value="' + esc(zorg.medisch || '') + '" style="width:100%;margin-top:0.4rem;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);">' +
        '<label style="display:flex;align-items:center;gap:0.5rem;margin-top:0.55rem;font-size:0.74rem;color:var(--txt);"><input type="checkbox" id="zDelen"' + (zorg.delen ? ' checked' : '') + '> ' + T('zorg.delen','Deel dit automatisch met zaken waar ik bestel of verblijf') + '</label>' +
        '<button class="live-go" id="zOpslaan" style="margin-top:0.55rem;">' + T('zorg.opslaan','Bewaar zorgprofiel') + '</button>' +
        ((delen.actief || []).length
          ? '<div style="margin-top:0.8rem;font-size:0.62rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">📍 ' + T('zorg.kijkt','Kijkt live met mij mee') + '</div>' +
            delen.actief.map(d => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-top:0.4rem;font-size:0.78rem;"><span><b>' + esc(d.supplierName) + '</b> · ' + T('zorg.sinds','sinds') + ' ' + String(d.at).slice(11, 16) + '</span><button class="mo-code js-zstop" data-id="' + d.id + '">' + T('zorg.stop','Stop delen') + '</button></div>').join('')
          : '<div style="margin-top:0.8rem;font-size:0.68rem;color:var(--soft);">📍 ' + T('zorg.niemand','Er kijkt nu niemand live met u mee.') + '</div>') +
      '</div>';
    $('#zOpslaan').addEventListener('click', async () => {
      try {
        await API.call('/zorgprofiel/zet', { allergenen: $('#zAll').value, dieet: $('#zDieet').value, medisch: $('#zMed').value, delen: $('#zDelen').checked });
        toast('🩺 ' + T('zorg.bewaard','Zorgprofiel bewaard.'));
      } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('.js-zstop').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/locatie/stop', { id: b.dataset.id }); toast('📍 ' + T('zorg.gestopt','Delen gestopt.')); renderZorg(); }
      catch(e){ toast(e.message); }
    }));
  }

  async function startLive(){
    const destCode = $('#liveDest').value;
    try { liveData = (await API.call('/live/start', { destCode, mode: liveMode })).live; toast(T('live.started','U bent onderweg. Uw partners zijn op de hoogte.')); renderLivePanel(); }
    catch (e){ toast(e.message); }
  }

  // projecteer lat/lng-punten in het 130px-kaartje (percentage-coördinaten)
  function projectPoints(pts){
    if (!pts.length) return [];
    const lats = pts.map(p => p.lat), lngs = pts.map(p => p.lng);
    let minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    let dLat = (maxLat - minLat) || 0.002, dLng = (maxLng - minLng) || 0.002;
    minLat -= dLat*0.2; maxLat += dLat*0.2; minLng -= dLng*0.2; maxLng += dLng*0.2;
    dLat = maxLat - minLat; dLng = maxLng - minLng;
    return pts.map(p => ({ x: ((p.lng - minLng)/dLng)*100, y: (1 - (p.lat - minLat)/dLat)*100 }));
  }

  function renderLivePanel(){
    const L = liveData; if (!L) return;
    const dest = L.dest;
    let head, sub = '';
    if (L.arrived && dest){ head = T('live.arrivedh','U bent <em>gearriveerd</em>'); sub = dest.name; }
    else if (dest){ head = T('live.headingto','Onderweg naar') + ' <em>' + dest.name + '</em>'; sub = dest.etaMin != null ? T('live.aankomst','aankomst over ~') + dest.etaMin + ' ' + T('live.min','min') : ''; }
    else { head = T('live.moving','U bent <em>onderweg</em>'); }

    const pts = [];
    if (L.me) pts.push({ lat: L.me.lat, lng: L.me.lng, me: true });
    L.partners.forEach(p => { if (p.loc) pts.push({ lat: p.loc.lat, lng: p.loc.lng, icon: p.icon, name: p.name }); });
    const proj = projectPoints(pts);
    const markers = proj.map((pt,i) => {
      const s = pts[i];
      return '<div class="mk' + (s.me?' me':'') + '" style="left:' + pt.x.toFixed(1) + '%;top:' + pt.y.toFixed(1) + '%;">' +
        (s.me ? '<div class="pin"></div>' : '<div>' + s.icon + '</div>') +
        '<div class="lbl">' + (s.me ? T('live.you','U') : s.name) + '</div></div>';
    }).join('');

    const partners = L.partners.map(p => {
      const isVeh = p.type === 'taxi' || p.type === 'jet';
      let eta;
      if (p.ride && isVeh){
        eta = p.taxiEtaMin != null && p.ride.status !== 'gearriveerd'
          ? '<div class="eta"><div class="n">' + p.taxiEtaMin + '</div><div class="u">' + T('live.mintoyou','min naar u') + '</div></div>'
          : '<div class="eta"><div class="n" style="font-size:0.9rem;">' + tRide(p.ride.status) + '</div></div>';
      } else if (p.isDest && L.arrived){
        eta = '<div class="eta arr"><div class="n">✓ ' + T('live.here','ter plaatse') + '</div></div>';
      } else {
        eta = p.etaMin != null ? '<div class="eta"><div class="n">' + p.etaMin + '</div><div class="u">' + T('live.minaway','min heen') + '</div></div>' : '';
      }
      let line2 = tType(p.typeLabel);
      if (p.ride){
        line2 += ' · ' + T('live.ride','rit') + ' ' + tRide(p.ride.status);
        const extra = [];
        if (p.ride.driver) extra.push('🚘 ' + p.ride.driver + (p.ride.vehicle ? ' · ' + p.ride.vehicle : ''));
        if (p.ride.quote) extra.push(T('live.vast','vaste nettoprijs') + ' ' + eur(p.ride.quote));
        if (extra.length) line2 += '<br>' + extra.join(' · ');
        // betaling achteraf: de zaak liet de rit direct rijden; afrekenen kan nu
        if (!p.ride.paid && p.ride.quote && p.ride.status !== 'wacht-op-betaling')
          line2 += '<br><button class="js-rpay" data-rref="' + p.ride.ref + '" data-rq="' + p.ride.quote + '" style="margin-top:0.35rem;background:none;border:1px solid var(--gold);color:var(--gold);border-radius:999px;padding:0.3rem 0.8rem;font-size:0.7rem;font-weight:600;font-family:inherit;cursor:pointer;">' + T('live.betaalrit','Betaal de rit') + ' · ' + eur(p.ride.quote) + '</button>';
      }
      else if (p.order) line2 += ' · ' + p.order.items + ' ' + T('app.items','item(s)') + ', ' + tStatus(p.order.status);
      return '<div class="live-partner"><span class="pic">' + p.icon + '</span><div class="pt"><b>' + p.name + '</b><span>' + line2 + '</span></div>' + eta + '</div>';
    }).join('');

    let preorder = '';
    const destSup = dest ? suppliers.find(s => s.code === dest.code) : null;
    if (dest && destSup && destSup.hasMenu && !dest.order && !L.arrived){
      preorder = '<div class="live-preorder"><span>' + T('live.preorder','Bestel vast vooruit, dan staat het klaar als u aankomt.') + '</span><button id="livePre">' + T('live.preorderbtn','Vooruit bestellen') + '</button></div>';
    }

    const hasVeh = L.partners.some(p => p.type === 'taxi' || p.type === 'jet');
    const canDoor = L.arrived && dest && dest.hasDoors;
    const acts = '<div class="live-acts">' +
      (canDoor ? '<button class="prim glowbtn" id="liveDoor">🔓 ' + T('live.door','Open de deur') + '</button>' : '') +
      '<button class="sec" id="liveSim">' + T('live.simulate','Simuleer rit') + '</button>' +
      (hasVeh ? '' : '<button class="sec" id="liveTaxi">' + T('live.taxi','Vraag een taxi') + '</button>') +
      (canDoor ? '' : '<button class="prim" id="liveShare">' + T('live.share','Deel mijn locatie') + '</button>') +
      (canDoor ? '<button class="sec" id="liveShare">' + T('live.share','Deel mijn locatie') + '</button>' : '') +
    '</div>';

    $('#livePanel').innerHTML =
      '<div class="live-panel">' +
        '<div class="live-top"><span class="live-badge"><span class="dot"></span>' + T('live.badge','Live onderweg') + '</span><button class="live-stop" id="liveStop">' + T('live.stop','Stop') + '</button></div>' +
        '<div class="live-headline">' + head + '</div>' + (sub ? '<div class="live-sub">' + sub + '</div>' : '') +
        '<div class="live-map">' + markers + '</div>' +
        preorder +
        '<div style="margin-top:0.5rem;">' + partners + '</div>' +
        acts +
      '</div>';

    $('#liveStop').addEventListener('click', stopLive);
    $('#liveSim').addEventListener('click', simulateRide);
    document.querySelectorAll('.js-rpay').forEach(b => b.addEventListener('click', () => {
      const bedrag = eur(Number(b.dataset.rq));
      payWithFaceId(bedrag, async () => {
        await API.call('/ride/pay', { ref: b.dataset.rref });
      }, { message: () => T('live.ritbetaald','Rit betaald en definitief:') + ' ' + bedrag, after: () => renderLive() });
    }));
    $('#liveShare').addEventListener('click', shareMyLocation);
    const tx = $('#liveTaxi'); if (tx) tx.addEventListener('click', requestTaxi);
    const pre = $('#livePre'); if (pre) pre.addEventListener('click', () => { if (dest) openMenu(dest.code); });
    const dr = $('#liveDoor'); if (dr) dr.addEventListener('click', async () => {
      try { const d = await API.call('/live/door'); toast('🔓 ' + d.door.name + ' ' + T('live.dooropen','is open. Vergrendelt zichzelf na') + ' ' + d.door.relockSec + ' ' + T('live.sec','seconden.')); }
      catch(e){ toast(e.message); }
    });
  }

  async function stopLive(){
    stopSim();
    try { await API.call('/live/stop'); } catch (e) {}
    liveData = null; toast(T('live.stopped','Reis gestopt.')); renderLive();
  }

  function requestTaxi(){
    const veh = suppliers.find(s => s.type === 'taxi') || suppliers.find(s => s.type === 'jet');
    if (!veh){ toast(T('live.notaxi','Geen vervoerspartner beschikbaar op deze bestemming.')); return; }
    // paspoortleeftijd: privejets boek je vanaf 18 jaar
    if (veh.type === 'jet' && user.leeftijdsgroep === '15-17'){ toast(T('live.jet18','Privejets boek je vanaf 18 jaar. Een taxi regelen we graag voor je.')); return; }
    // nette aanvraag: personen, bagage en tijdstip; de prijs komt direct terug
    $('#rideSup').textContent = veh.name;
    $('#ride-sheet').dataset.code = veh.code;
    $('#ride-sheet').classList.add('open'); $('#ride-scrim').classList.add('open');
  }
  async function verstuurRit(){
    const code = $('#ride-sheet').dataset.code;
    const wanneer = $('#ridePlan').value === 'later' ? ($('#rideTijd').value ? T('live.om','om') + ' ' + $('#rideTijd').value : 'Zo snel mogelijk') : 'Zo snel mogelijk';
    try {
      const d = await API.call('/ride/request', {
        supplierCode: code,
        toCode: (liveData && liveData.destCode) || undefined,
        passengers: Number($('#ridePax').value) || 1,
        luggage: Number($('#rideBag').value) || 0,
        when: wanneer,
        date: $('#ridePlan').value === 'later' ? $('#rideDatum').value : '',
        time: $('#ridePlan').value === 'later' ? $('#rideTijd').value : '',
        note: $('#rideNote').value.trim()
      });
      $('#ride-sheet').classList.remove('open'); $('#ride-scrim').classList.remove('open');
      if (d.ride && d.ride.status === 'wacht-op-betaling'){
        // betalen-eerst: pas na afrekenen gaat de aanvraag naar de vervoerder
        payWithFaceId(eur(d.ride.quote), async () => {
          await API.call('/ride/pay', { ref: d.ride.ref });
          return d.ride;
        }, { message: () => T('live.ritbetaald','Rit betaald en definitief:') + ' ' + eur(d.ride.quote), after: () => renderLive() });
      } else {
        toast('🚘 ' + T('live.taxireq2','Rit aangevraagd.') + (d.ride && d.ride.quote ? ' ' + T('live.vast','vaste nettoprijs') + ': ' + eur(d.ride.quote) : ''));
        await renderLive();
      }
    } catch (e){ toast(e.message); }
  }

  function shareMyLocation(){
    if (navigator.geolocation){
      navigator.geolocation.getCurrentPosition(async pos => {
        try { liveData = (await API.call('/live/update', { lat: pos.coords.latitude, lng: pos.coords.longitude })).live; renderLivePanel(); toast(T('live.shared','Locatie gedeeld met uw partners.')); }
        catch (e){ toast(e.message); }
      }, () => toast(T('live.geodenied','Locatie niet beschikbaar. Gebruik "Simuleer rit" voor de demo.')), { timeout: 4000 });
    } else toast(T('live.geono','Locatie is hier niet beschikbaar.'));
  }

  function stopSim(){ if (simTimer){ clearInterval(simTimer); simTimer = null; } }
  function simulateRide(){
    const L = liveData;
    if (!L || !L.me || !L.dest || !L.dest.loc){ toast(T('live.nosim','Kies eerst een bestemming.')); return; }
    stopSim();
    const start = { lat: L.me.lat, lng: L.me.lng };
    const end = { lat: L.dest.loc.lat, lng: L.dest.loc.lng };
    let step = 0; const N = 16;
    toast(T('live.simstart','Simulatie gestart, u nadert de bestemming.'));
    simTimer = setInterval(async () => {
      step++;
      const t = step / N;
      const lat = start.lat + (end.lat - start.lat) * t + (Math.random() - 0.5) * 0.0004;
      const lng = start.lng + (end.lng - start.lng) * t + (Math.random() - 0.5) * 0.0004;
      try { liveData = (await API.call('/live/update', { lat, lng })).live; renderLivePanel(); } catch (e) {}
      if (step >= N) stopSim();
    }, 900);
  }

  const FID_MINI = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 19 V13 a7 7 0 0 1 7-7 h6"/><path d="M45 6 h6 a7 7 0 0 1 7 7 v6"/><path d="M58 45 v6 a7 7 0 0 1-7 7 h-6"/><path d="M19 58 h-6 a7 7 0 0 1-7-7 v-6"/><circle cx="23.5" cy="26.5" r="3" fill="currentColor"/><circle cx="40.5" cy="26.5" r="3" fill="currentColor"/><path d="M32 26 v8.5 a2.2 2.2 0 0 1-2.2 2.2"/><path d="M23 42.5 a12.5 8.5 0 0 0 18 0"/></svg>';

  async function openMenu(code){
    let data;
    try { data = await API.call('/supplier/menu/get', { code }); }
    catch (e) { toast(e.message); return; }
    menuState = { supplier: data.supplier, menu: data.menu, alcohol: data.alcohol || null, qty: {}, note: '', tag: false, table: '', retail: null, retailMijn: null };
    $('#msName').textContent = data.supplier.name;
    $('#msMeta').textContent = tType(data.supplier.typeLabel) + ' · ' + data.supplier.city + (data.supplier.loc ? ' · ' + data.supplier.loc.label : '');
    // mode-/retailpartner: haal de catalogus en de eigen apart/styling erbij
    if ((data.supplier.caps || []).includes('retail')){
      try { menuState.retail = await API.call('/retail/catalogus', { supplierCode: code }); } catch(e){}
      try { menuState.retailMijn = await API.call('/retail/mijn', {}); } catch(e){}
      try { menuState.modeBezorg = (await API.call('/mode/bezorg/mijn', {})).bezorgingen || []; } catch(e){ menuState.modeBezorg = []; }
    }
    renderMenuSheet();
    $('#menu-sheet').classList.add('open');
    $('#menu-scrim').classList.add('open');
  }

  function renderMenuSheet(){
    const m = menuState.menu;
    const s = menuState.supplier;
    // fotostrip + kamers van de partner (hotels, of elke partner met foto's)
    let head = '';
    // rating + favoriet-hart + tafel reserveren (de ervaring-laag)
    head += '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.2rem 0 0.6rem;">' +
      (s.rating ? '<span style="font-size:0.8rem;">⭐ <b>' + s.rating.score + '</b> <span style="color:var(--soft);font-size:0.7rem;">(' + s.rating.aantal + ')</span></span>' : '<span style="font-size:0.72rem;color:var(--soft);">' + T('erv.nogGeenReviews','Nog geen reviews') + '</span>') +
      '<button id="msFav" style="margin-left:auto;background:none;border:1px solid var(--line);border-radius:999px;padding:0.35rem 0.8rem;font-size:0.85rem;" aria-label="' + T('fav.aria','Favoriet') + '">' + (s.favoriet ? '❤️ ' + T('fav.bewaard','Bewaard') : '🤍 ' + T('fav.bewaar','Bewaar')) + '</button></div>';
    if ((s.tableNames || []).length && s.reservationsOpen !== false){
      const morgen = new Date(Date.now() + 86400000).toISOString().slice(0,10);
      head += '<div class="ms-cat">🪑 ' + T('erv.reserveer.h','Tafel reserveren') + '</div>' +
        '<div style="display:flex;gap:0.4rem;align-items:center;padding:0.2rem 0 0.9rem;flex-wrap:wrap;">' +
        '<input type="date" id="rsvDatum" value="' + morgen + '" min="' + new Date().toISOString().slice(0,10) + '" style="flex:2;min-width:120px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('erv.datum','Datum') + '">' +
        '<input type="time" id="rsvTijd" value="20:00" style="flex:1;min-width:84px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('erv.tijd','Tijd') + '">' +
        '<select id="rsvPers" style="flex:1;min-width:70px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.5rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('erv.personen','Personen') + '">' +
        [1,2,3,4,5,6,8,10].map(n => '<option' + (n===2?' selected':'') + '>' + n + '</option>').join('') + '</select>' +
        '<button class="vbtn" id="rsvGo">' + T('erv.reserveer','Reserveer') + '</button></div>';
    }
    if (s.photos && s.photos.length)
      head += '<div class="ms-photos">' + s.photos.map(p => '<img src="' + p + '" alt="">').join('') + '</div>';
    if (s.rooms && s.rooms.length){
      const inDatum = new Date(Date.now() + 86400000).toISOString().slice(0,10);
      const uitDatum = new Date(Date.now() + 3 * 86400000).toISOString().slice(0,10);
      head += '<div class="ms-cat">' + T('app.ms.rooms','Beschikbare kamers') + '</div>' +
        '<div style="display:flex;gap:0.4rem;align-items:center;padding:0.2rem 0 0.6rem;flex-wrap:wrap;">' +
        '<input type="date" id="vbAankomst" value="' + inDatum + '" min="' + new Date().toISOString().slice(0,10) + '" style="flex:1;min-width:120px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('vb.aankomst','Aankomst') + '">' +
        '<input type="date" id="vbVertrek" value="' + uitDatum + '" min="' + inDatum + '" style="flex:1;min-width:120px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('vb.vertrek','Vertrek') + '">' +
        '<select id="vbPers" style="flex:0 1 70px;min-width:64px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.5rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('erv.personen','Personen') + '">' +
        [1,2,3,4,6].map(n => '<option' + (n===2?' selected':'') + '>' + n + '</option>').join('') + '</select></div>' +
        s.rooms.map(r => '<div class="ms-room"><div class="rt"><b>' + r.name + '</b>' + (r.desc ? '<span>' + r.desc + '</span>' : '') + '</div>' +
          '<div class="rp" style="display:flex;align-items:center;gap:0.5rem;">' + eur(r.price) + ' <span style="font-size:0.62rem;color:var(--soft);">' + T('app.ms.pernight','p.n.') + '</span>' +
          '<button class="vbtn" data-vbboek="' + r.id + '">' + T('vb.boek','Boek') + '</button></div></div>').join('') +
        '<div style="margin:0.5rem 0 0.6rem;font-size:0.74rem;color:var(--soft);">' + T('app.ms.roomnote2','Tegen nettoprijs; het huis bevestigt uw verblijf en de rekening loopt op de kamer.') + '</div>' +
        // keyless: tijdens een ingecheckt verblijf is de telefoon de sleutel
        '<div style="display:flex;gap:0.5rem;padding-bottom:0.8rem;">' +
        '<button class="vbtn" id="vbDeurKamer" style="flex:1;">🗝️ ' + T('vb.deurkamer','Open mijn kamerdeur') + '</button>' +
        '<button class="vbtn" id="vbDeurEntree" style="flex:1;background:var(--card);color:var(--txt);border:1px solid var(--line);">' + T('vb.deurentree','Open de entree') + '</button></div>';
    }
    const funcs = APPLY_FUNCS[s.type] || [];
    const applyBlock = funcs.length
      ? '<div class="ms-cat">' + T('cv.workat','Werken bij') + ' ' + s.name + '</div>' +
        '<div style="display:flex;gap:0.5rem;align-items:center;padding:0.3rem 0 0.9rem;">' +
        '<select id="apFunc2" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.9rem;font-size:0.86rem;color:var(--txt);outline:none;">' +
        funcs.map(f => '<option>' + f + '</option>').join('') + '</select>' +
        '<button class="vbtn" id="apGo2">' + T('cv.apply','Solliciteer') + '</button></div>'
      : '';
    const evs = s.events || [];
    const eventsBlock = evs.length
      ? '<div class="ms-cat">\uD83C\uDF9F ' + T('ev.h','Events') + '</div>' + evs.map(e =>
          '<div style="border:1px solid var(--line);border-radius:14px;padding:0.85rem 1rem;margin-bottom:0.6rem;">' +
          '<div style="display:flex;justify-content:space-between;gap:0.6rem;align-items:baseline;"><b style="font-size:0.92rem;">' + e.name + '</b><span style="font-size:0.7rem;color:var(--soft);flex-shrink:0;">' + e.date + (e.time ? ' \u00b7 ' + e.time : '') + '</span></div>' +
          (e.desc ? '<div style="font-size:0.78rem;color:var(--muted);margin-top:0.25rem;">' + e.desc + '</div>' : '') +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.6rem;gap:0.6rem;">' +
          '<span style="font-size:0.72rem;color:' + (e.spotsLeft > 0 ? 'var(--soft)' : 'var(--burgundy)') + ';">' + (e.spotsLeft > 0 ? e.spotsLeft + ' ' + T('ev.spots','plekken vrij') : T('ev.full','Vol')) + (e.price ? ' \u00b7 ' + eur(e.price) + ' p.p.' : ' \u00b7 ' + T('ev.free','gratis')) + '</span>' +
          (e.spotsLeft > 0 ? '<button class="vbtn" data-rsvp="' + e.id + '">' + T('ev.join','Zet mij op de lijst') + '</button>'
            : '<button class="vbtn" data-wl="' + e.id + '">⏳ ' + T('erv.wachtlijst','Wachtlijst') + '</button>') +
          '</div></div>'
        ).join('')
      : '';
    const retailBlock = menuState.retail ? retailMenuBlock() : '';
    const cats = [...new Set(m.map(x => x.cat))];
    $('#msBody').innerHTML = head + retailBlock + eventsBlock + applyBlock + cats.map(c =>
      '<div class="ms-cat">' + c + '</div>' + m.filter(x => x.cat === c).map(x => {
        const q = menuState.qty[x.id] || 0;
        // alcohol op slot: onder de landsgrens (paspoortleeftijd) niet bestelbaar
        const slot = x.station === 'bar' && menuState.alcohol && menuState.alcohol.mag === false;
        // 86 van het keukenscherm: uitverkocht, dus even niet te bestellen
        const op86 = !!x.uitverkocht;
        return '<div class="ms-item" data-id="' + x.id + '"' + (op86 ? ' style="opacity:0.5;"' : '') + '>' +
          '<div class="info"><div class="nm">' + x.name + '</div>' +
            (x.desc ? '<div class="ds">' + x.desc + '</div>' : '') +
            (x.allergens && x.allergens.length ? '<div class="alg">' + x.allergens.map(a => '<span>' + tAlg(a) + '</span>').join('') + '</div>' : '') +
          '</div>' +
          '<div class="side"><div class="pr">' + eur(x.price) + '</div>' +
            (op86 ? '<div class="qty" style="opacity:0.7;font-size:0.64rem;justify-content:center;">' + T('menu.86','uitverkocht') + '</div>'
              : slot ? '<div class="qty" style="opacity:0.55;font-size:0.64rem;justify-content:center;">🔞 ' + menuState.alcohol.grens + '+</div>'
              : '<div class="qty"><button class="js-minus">−</button><b>' + q + '</b><button class="js-plus">+</button></div>') +
          '</div></div>';
      }).join('')
    ).join('');
    const apGo = $('#apGo2');
    if (apGo) apGo.addEventListener('click', () => memberApply(menuState.supplier.code, $('#apFunc2').value, ''));
    document.querySelectorAll('[data-rsvp]').forEach(b => b.addEventListener('click', async () => {
      try {
        await API.call('/event/rsvp', { supplierCode: menuState.supplier.code, eventId: b.dataset.rsvp, qty: 1 });
        toast(T('ev.joined','U staat op de gastenlijst. Uw codenaam is uw toegang.'));
        await openMenu(menuState.supplier.code); // sheet ververst: plekken en knop kloppen weer
      } catch(e){ toast(e.message); }
    }));
    // vol event: op de wachtlijst; bij een vrijgekomen plek krijgt u meteen bericht
    document.querySelectorAll('[data-wl]').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await API.call('/wachtlijst', { supplierCode: menuState.supplier.code, eventId: b.dataset.wl });
        toast('⏳ ' + T('erv.wlok','U staat op de wachtlijst (nr. ') + d.positie + '). ' + T('erv.wlbericht','Bij een vrije plek hoort u het meteen.'));
      } catch(e){ toast(e.message); }
    }));
    // favoriet-hart + tafel reserveren
    const favB = $('#msFav');
    if (favB) favB.addEventListener('click', async () => {
      try {
        const d = await API.call('/favoriet', { supplierCode: s.code });
        menuState.supplier.favoriet = d.favoriet;
        renderMenuSheet();
      } catch(e){ toast(e.message); }
    });
    const rsvGo = $('#rsvGo');
    if (rsvGo) rsvGo.addEventListener('click', async () => {
      try {
        const d = await API.call('/reserveer', { supplierCode: s.code, datum: $('#rsvDatum').value, tijd: $('#rsvTijd').value, personen: Number($('#rsvPers').value) });
        toast('🪑 ' + T('erv.reserveerok','Reservering aangevraagd voor') + ' ' + d.reservering.datum + ' ' + d.reservering.tijd + '. ' + T('erv.zaakbevestigt','De zaak bevestigt hem zo.'));
      } catch(e){ toast(e.message); }
    });
    // keyless: de deur van je kamer of de entree, met je telefoon als sleutel
    const deur = async welke => {
      try {
        const d = await API.call('/verblijf/deur', { supplierCode: s.code, welke });
        toast('🔓 ' + d.door.name + ' ' + T('vb.deuropen','is open; hij vergrendelt zelf weer na') + ' ' + d.door.relockSec + 's.');
      } catch(e){ toast(e.message); }
    };
    const dk = $('#vbDeurKamer'); if (dk) dk.addEventListener('click', () => deur('kamer'));
    const de = $('#vbDeurEntree'); if (de) de.addEventListener('click', () => deur('entree'));
    // een kamer boeken: datums kiezen, een knop, het huis bevestigt
    $('#msBody').querySelectorAll('[data-vbboek]').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await API.call('/verblijf', {
          supplierCode: s.code, roomId: b.dataset.vbboek,
          aankomst: $('#vbAankomst').value, vertrek: $('#vbVertrek').value,
          personen: Number($('#vbPers').value)
        });
        toast('🛎️ ' + T('vb.ok','Verblijf aangevraagd:') + ' ' + d.verblijf.roomName + ', ' + d.verblijf.nachten + ' ' + T('vb.nachten','nacht(en)') + ' (' + eur(d.verblijf.totaal) + '). ' + T('erv.zaakbevestigt','De zaak bevestigt hem zo.'));
      } catch(e){ toast(e.message); }
    }));
    if (menuState.retail) bindRetailMenu();
    $('#msBody').querySelectorAll('.ms-item').forEach(el => {
      const id = el.dataset.id;
      const plus = el.querySelector('.js-plus'), min = el.querySelector('.js-minus');
      if (plus) plus.addEventListener('click', () => { menuState.qty[id] = (menuState.qty[id]||0)+1; renderMenuSheet(); });
      if (min) min.addEventListener('click', () => { menuState.qty[id] = Math.max(0,(menuState.qty[id]||0)-1); renderMenuSheet(); });
    });
    if (!m.length){ $('#msFoot').innerHTML = ''; return; }
    if (menuState.supplier.ordersOpen === false){
      $('#msFoot').innerHTML = '<div style="padding:0.9rem 0;text-align:center;font-size:0.82rem;color:var(--soft);">⏸ ' + T('app.ms.closed','Bestellingen zijn tijdelijk gesloten. De kaart blijft ter inzage.') + '</div>';
      return;
    }
    const total = m.reduce((s,x) => s + x.price * (menuState.qty[x.id]||0), 0);
    const count = Object.values(menuState.qty).reduce((a,b)=>a+b,0);
    const tafels = menuState.supplier.tableNames || [];
    $('#msFoot').innerHTML =
      (tafels.length ? '<select class="ms-note" id="msTable" style="margin-bottom:0.5rem;">'+
        '<option value="">' + T('app.ms.tableq','Aan welke tafel zit u? (optioneel)') + '</option>'+
        tafels.map(t => '<option' + (menuState.table === t ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>' : '') +
      '<input class="ms-note" id="msNote" placeholder="' + T('app.ms.note','Allergie of opmerking (bijv. geen noten)') + '" value="' + menuState.note.replace(/"/g,'&quot;') + '">' +
      '<label class="ms-tag"><input type="checkbox" id="msTag"' + (menuState.tag ? ' checked' : '') + '> ' + T('app.ms.tag','Tag dit voor De Salon (7 dagen na verblijf)') + '</label>' +
      '<select class="ms-note" id="msFooi" style="margin-top:0.4rem;" aria-label="' + T('erv.fooi','Fooi') + '">' +
        '<option value="0">' + T('erv.fooi.geen','Geen fooi') + '</option>' +
        '<option value="p5"' + (menuState.fooi==='p5'?' selected':'') + '>' + T('erv.fooi.team','Fooi voor het team') + ': 5%</option>' +
        '<option value="p10"' + (menuState.fooi==='p10'?' selected':'') + '>' + T('erv.fooi.team','Fooi voor het team') + ': 10%</option>' +
        '<option value="e5"' + (menuState.fooi==='e5'?' selected':'') + '>' + T('erv.fooi.team','Fooi voor het team') + ': € 5</option>' +
      '</select>' +
      '<div style="font-size:0.66rem;color:var(--soft);margin:0.35rem 0;">' + T('app.ms.los','U bestelt rechtstreeks bij deze zaak: een losse overeenkomst, en uw betaling gaat rechtstreeks naar de zaak.') + '</div>' +
      ((menuState.supplier.hasMenu !== false && (menuState.menu || []).some(x => x.station === 'bar'))
        ? '<div style="font-size:0.66rem;color:var(--soft);margin:0.35rem 0;">🔞 ' +
          (menuState.alcohol && menuState.alcohol.mag === false
            ? T('app.ms.geenalc','Alcohol staat voor u uit:') + ' ' + (menuState.alcohol.land || '') + ' ' + T('app.ms.vanaf','hanteert') + ' ' + menuState.alcohol.grens + '+ ' + T('app.ms.pasp','(leeftijd geverifieerd via uw paspoort).')
            : 'Alcohol: ' + ((menuState.alcohol && menuState.alcohol.grens) || 18) + '+; ' + T('app.ms.18b','de zaak kan om legitimatie vragen.')) + '</div>' : '') +
      '<button class="ms-order" id="msOrder"' + (count ? '' : ' disabled') + '>' + (count ? T('app.ms.order','Bestel') + ' ' + count + ' ' + T('app.items','item(s)') + ', ' + eur(total) : T('app.ms.choose','Kies gerechten')) + '</button>';
    const mt = $('#msTable');
    if (mt) mt.addEventListener('change', e => menuState.table = e.target.value);
    $('#msNote').addEventListener('input', e => menuState.note = e.target.value);
    $('#msTag').addEventListener('change', e => menuState.tag = e.target.checked);
    const mf = $('#msFooi');
    if (mf) mf.addEventListener('change', e => menuState.fooi = e.target.value);
    const ob = $('#msOrder');
    if (count) ob.addEventListener('click', placeOrder);
  }

  // ---- mode-/retailcatalogus in de partner-sheet ----
  function retailMenuBlock(){
    const r = menuState.retail;
    const mijn = menuState.retailMijn || { apart: [], styling: [] };
    let html = '<div class="ms-cat">🛍 ' + T('rt.m.cat','Collectie') + '</div>';
    // eigen apart-artikelen en stylingvoorstellen bij dit merk
    const apart = (mijn.apart || []).filter(a => a.supplierName === r.supplier.name);
    if (apart.length) html += '<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:0.7rem 0.9rem;margin-bottom:0.7rem;"><div style="font-size:0.7rem;color:var(--gold);letter-spacing:0.08em;text-transform:uppercase;">' + T('rt.m.apart','Voor u apart gelegd') + '</div>' +
      apart.map(a => '<div style="font-size:0.82rem;margin-top:0.3rem;">' + esc(a.artikelNaam) + ' · ' + esc(a.kleur) + ', ' + esc(a.maat) + ' <span style="color:var(--soft);">(' + T('rt.m.tot','tot') + ' ' + esc(a.tot) + ')</span></div>').join('') +
      '<button class="rt-bezorg" style="margin-top:0.55rem;width:100%;background:var(--gold);color:#000;border:none;border-radius:10px;padding:0.5rem;font-weight:600;font-family:inherit;cursor:pointer;">🚚 ' + T('mb.laat','Veilig laten bezorgen') + '</button>' +
      '<div style="font-size:0.66rem;color:var(--soft);margin-top:0.3rem;">' + T('mb.veiliguitleg','Met bezorgcode, live volgen en pas-aan-de-deur. Dure stukken: ID aan de deur.') + '</div></div>';
    // lopende bezorgingen van deze winkel
    const bez = (menuState.modeBezorg || []).filter(b => b.supplierName === r.supplier.name && !['afgeleverd','retour','geannuleerd'].includes(b.status));
    if (bez.length) html += bez.map(b => '<div style="background:var(--card);border:1px solid var(--gold);border-radius:14px;padding:0.7rem 0.9rem;margin-bottom:0.7rem;"><div style="font-size:0.7rem;color:var(--gold);letter-spacing:0.08em;text-transform:uppercase;">🚚 ' + T('mb.onderweg','Bezorging') + ' · ' + esc(b.status) + '</div>' +
      '<div style="font-size:0.85rem;margin-top:0.3rem;">' + T('mb.code','Bezorgcode') + ': <b style="letter-spacing:0.2em;font-size:1.05rem;">' + esc(b.bezorgcode) + '</b></div>' +
      '<div style="font-size:0.68rem;color:var(--soft);margin-top:0.2rem;">' + (b.koerier ? T('mb.koerieris','Koerier') + ': ' + esc(b.koerier) + (b.etaMin != null ? ' · ETA ' + b.etaMin + ' min' : '') : T('mb.geefcode','Geef deze code alleen aan de RTG-koerier aan de deur.')) + '</div></div>').join('');
    const styling = (mijn.styling || []).filter(v => v.supplierName === r.supplier.name);
    if (styling.length) html += styling.map(v => '<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:0.7rem 0.9rem;margin-bottom:0.7rem;"><div style="font-size:0.7rem;color:var(--gold);letter-spacing:0.08em;text-transform:uppercase;">✨ ' + esc(v.titel) + '</div>' +
      (v.bericht ? '<div style="font-size:0.78rem;color:var(--muted);margin-top:0.25rem;">' + esc(v.bericht) + '</div>' : '') +
      '<div style="font-size:0.8rem;margin-top:0.3rem;">' + v.items.map(i => esc(i.naam)).join(' · ') + '</div><div style="font-size:0.68rem;color:var(--soft);margin-top:0.2rem;">' + T('rt.m.van','van') + ' ' + esc(v.van) + '</div></div>').join('');
    // de artikelen
    const now = Date.now();
    html += (r.artikelen || []).map(a => {
      const drop = a.drop && a.drop.releaseMs > now;
      const bes = a.beschikbaar || [];
      return '<div style="border:1px solid var(--line);border-radius:16px;padding:0.8rem;margin-bottom:0.7rem;" data-rart="' + escAttr(a.id) + '">' +
        '<div style="display:flex;gap:0.8rem;">' +
        (a.foto ? '<img src="' + escAttr(a.foto) + '" alt="' + escAttr(a.naam) + '" style="width:72px;height:92px;object-fit:cover;border-radius:10px;flex-shrink:0;">' : '<div style="width:72px;height:92px;border-radius:10px;background:var(--card);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.4rem;">👗</div>') +
        '<div style="flex:1;min-width:0;">' +
        '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><b style="font-size:0.92rem;">' + esc(a.naam) + '</b>' +
        '<button class="rt-fav" data-rfav="' + escAttr(a.id) + '" style="background:none;border:none;font-size:1.1rem;flex-shrink:0;cursor:pointer;" aria-label="' + T('rt.m.verlang','Verlanglijst') + '">' + (a.opWishlist ? '💛' : '🤍') + '</button></div>' +
        '<div style="font-size:0.78rem;color:var(--soft);">' + esc(a.categorie || '') + (a.materiaal ? ' · ' + esc(a.materiaal) : '') + '</div>' +
        (a.kleuren && a.kleuren.length ? '<div style="font-size:0.76rem;color:var(--muted);margin-top:0.2rem;">' + a.kleuren.map(k => esc(k)).join(' · ') + '</div>' : '') +
        '<div style="font-weight:600;margin-top:0.3rem;">' + eur(a.price) + '</div>' +
        (drop ? '<div style="font-size:0.72rem;color:var(--gold);margin-top:0.3rem;">⏳ ' + T('rt.m.drop','Drop') + ' ' + esc(a.drop.datum) + ' ' + esc(a.drop.tijd) + '</div>' : '') +
        '</div></div>' +
        (!drop && bes.length ? '<div style="display:flex;gap:0.4rem;align-items:center;margin-top:0.6rem;flex-wrap:wrap;">' +
          '<span style="font-size:0.72rem;color:var(--soft);">' + T('rt.m.paskamer','Vraag een maat in de paskamer:') + '</span>' +
          '<select class="rt-maat" style="background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.6rem;font-size:0.8rem;color:var(--txt);">' +
          bes.map(v => '<option value="' + escAttr(v.vsku) + '">' + esc(v.kleur) + ' · ' + esc(v.maat) + '</option>').join('') + '</select>' +
          '<button class="vbtn rt-pas" data-rpas="' + escAttr(a.id) + '">' + T('rt.m.vraag','Vraag') + '</button></div>'
          : (drop ? '' : '<div style="font-size:0.72rem;color:var(--soft);margin-top:0.5rem;">' + T('rt.m.uitverkocht','Tijdelijk uitverkocht.') + '</div>')) +
        '</div>';
    }).join('');
    return html;
  }
  function bindRetailMenu(){
    const code = menuState.supplier.code;
    const bezBtn = document.querySelector('.rt-bezorg');
    if (bezBtn) bezBtn.addEventListener('click', async () => {
      const mijn = menuState.retailMijn || { apart: [] };
      const items = (mijn.apart || []).filter(a => a.supplierName === menuState.supplier.name)
        .map(a => ({ naam: a.artikelNaam, maat: a.maat, kleur: a.kleur, prijs: a.price || 0, aantal: 1 }));
      if (!items.length) return toast(T('mb.geenitems','Geen apart-gelegde stukken om te bezorgen.'));
      const adres = prompt(T('mb.vraagadres','Op welk adres bezorgen we?'));
      if (!adres || !adres.trim()) return;
      try {
        const r = await API.call('/mode/bezorg/aanvraag', { supplierCode: code, adres: adres.trim(), items });
        toast('🚚 ' + T('mb.aangevraagd','Bezorging aangevraagd. Bezorgcode:') + ' ' + r.bezorging.bezorgcode);
        try { menuState.modeBezorg = (await API.call('/mode/bezorg/mijn', {})).bezorgingen || []; } catch(e){}
        renderMenuSheet();
      } catch(e){ toast(e.message); }
    });
    document.querySelectorAll('[data-rfav]').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await API.call('/retail/wishlist', { code, artikelId: b.dataset.rfav });
        b.textContent = d.wishlist ? '💛' : '🤍';
        const a = (menuState.retail.artikelen || []).find(x => x.id === b.dataset.rfav); if (a) a.opWishlist = d.wishlist;
        toast(d.wishlist ? T('rt.m.opverlang','Op uw verlanglijst. De boetiek ziet het.') : T('rt.m.afverlang','Van uw verlanglijst gehaald.'));
      } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-rpas]').forEach(b => b.addEventListener('click', async () => {
      const card = b.closest('[data-rart]');
      const sel = card ? card.querySelector('.rt-maat') : null;
      if (!sel || !sel.value) return;
      try {
        await API.call('/retail/paskamer', { code, vsku: sel.value });
        toast('🚪 ' + T('rt.m.pasok','Uw maat is aangevraagd. Een medewerker brengt hem naar de paskamer.'));
      } catch(e){ toast(e.message); }
    }));
  }

  async function placeOrder(){
    const items = Object.entries(menuState.qty).filter(([,q]) => q > 0).map(([id,qty]) => ({ id, qty }));
    if (!items.length) return;
    let d;
    try {
      d = await API.call('/order', { supplierCode: menuState.supplier.code, items, table: menuState.table || '', allergyNote: menuState.note, tagSalon: menuState.tag });
    } catch (e) { toast(e.message); return; }
    $('#menu-sheet').classList.remove('open');
    $('#menu-scrim').classList.remove('open');
    if (d.order.status === 'wacht-op-betaling'){
      // betalen-eerst: de bestelling is pas definitief na directe betaling
      payOrder(d.order, menuState.fooi);
    } else {
      // deze zaak koos betaling achteraf: de bestelling loopt al, afrekenen kan zo
      toast('🛎️ ' + T('app.orderok','Bestelling geplaatst.') + ' ' + T('app.betaalachteraf','Betalen kan achteraf via Bestellingen.'));
    }
    renderTerPlaatse();
  }

  function payOrder(o, fooiKeus){
    // fooi voor het team: percentage of vast bedrag, gekozen in de bestelbon
    const fooi = fooiKeus === 'p5' ? Math.round(o.total * 5) / 100
      : fooiKeus === 'p10' ? Math.round(o.total * 10) / 100
      : fooiKeus === 'e5' ? 5 : 0;
    payWithFaceId(eur(o.total + fooi), async () => {
      await API.call('/order/pay', { ref: o.ref, fooi });
      return o;
    }, { message: () => T('app.paidto','Betaald aan') + ' ' + o.supplierName + '.' + (fooi ? ' 💛 ' + eur(fooi) + ' ' + T('erv.fooivoorteam','fooi voor het team.') : ''), after: () => renderTerPlaatse() });
  }

  $('#msClose').addEventListener('click', () => { $('#menu-sheet').classList.remove('open'); $('#menu-scrim').classList.remove('open'); });
  $('#menu-scrim').addEventListener('click', () => { $('#menu-sheet').classList.remove('open'); $('#menu-scrim').classList.remove('open'); });

  /* ---------- cv-builder + solliciteren via RTG ---------- */
  let myCv = null, myCvReady = false, myApps = [];
  const APPLY_FUNCS = {
    restaurant: ['Bediening','Keuken','Gastheer/gastvrouw','Afwas'],
    bar:        ['Bediening','Bar','Keuken','Security'],
    club:       ['Bediening','Bar','Security'],
    hotel:      ['Receptie','Housekeeping','Roomservice','Onderhoud','Security'],
    apartment:  ['Beheer','Housekeeping','Onderhoud'],
    villa:      ['Beheer','Housekeeping','Onderhoud'],
    taxi:       ['Taxi centrale','Chauffeur'],
    jet:        ['Operations','Crew','Piloot']
  };
  async function loadCv(){
    if (!API.live) return;
    try { const d = await API.call('/cv/get'); myCv = d.cv; myCvReady = d.ready; renderCvCard(); } catch(e){}
  }
  function renderCvCard(){
    const el = $('#homeCv'); if (!el) return;
    el.innerHTML = '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">'+T('cv.card.k','Werken via RTG')+'</div>'+
      (myCvReady
        ? '<div style="margin-top:0.4rem;font-size:0.85rem;color:var(--muted);">✓ '+T('cv.card.ready','Uw cv staat klaar. Solliciteer bij elke RTG-partner in een tik, via Ter plaatse.')+'</div>'
        : '<div style="margin-top:0.4rem;font-size:0.85rem;color:var(--muted);">'+T('cv.card.build','Maak eenmalig uw cv met de cv-builder en solliciteer daarna bij elke RTG-partner op dezelfde manier.')+'</div>')+
      (myApps.length ? '<div style="margin-top:0.9rem;display:flex;flex-direction:column;gap:0.45rem;">'+myApps.map(a => {
        const kleur = a.status==='aangenomen' ? '#4CAF7D' : a.status==='afgewezen' ? 'var(--burgundy)' : a.status==='uitgenodigd' ? '#4CAF7D' : 'var(--gold)';
        const label = a.status==='aangenomen' ? T('cv.st.hired','aangenomen') : a.status==='afgewezen' ? T('cv.st.rejected','afgewezen') : a.status==='uitgenodigd' ? T('cv.st.invited','uitgenodigd') : T('cv.st.new','in behandeling');
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.6rem;font-size:0.78rem;color:var(--muted);">'+
          '<span>'+a.company+' · '+a.func+'</span>'+
          '<span style="display:flex;align-items:center;gap:0.4rem;flex-shrink:0;">'+
          (a.chatId ? '<button class="chatb" style="width:auto;padding:0.2rem 0.55rem;font-size:0.7rem;" data-apchat="'+a.chatId+'" data-apco="'+encodeURIComponent(a.company)+'">💬 '+T('cv.chat','Chat')+'</button>' : '')+
          '<span style="font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;color:'+kleur+';border:1px solid '+kleur+';border-radius:999px;padding:0.15rem 0.55rem;">'+label+'</span></span></div>';
      }).join('')+'</div>' : '')+
      '<button class="vbtn" style="margin-top:0.8rem;" id="cvOpen">'+(myCvReady?T('cv.card.edit','Bewerk mijn cv'):T('cv.card.make','Maak mijn cv'))+'</button>';
    $('#cvOpen').addEventListener('click', openCvSheet);
    el.querySelectorAll('[data-apchat]').forEach(b => b.addEventListener('click', () => openApplyChat(b.dataset.apchat, decodeURIComponent(b.dataset.apco||''))));
  }
  function openCvSheet(){
    const c = myCv || {};
    $('#cvName').value = c.name || (user && user.full) || '';
    $('#cvContact').value = c.contact || (user && (user.phone || user.email)) || '';
    $('#cvHeadline').value = c.headline || '';
    $('#cvExp').value = (c.experience || []).join('\n');
    $('#cvSkills').value = (c.skills || []).join(', ');
    $('#cvLang').value = (c.languages || []).join(', ');
    $('#cvAbout').value = c.about || '';
    $('#cv-sheet').classList.add('open');
    $('#cv-scrim').classList.add('open');
  }
  function closeCvSheet(){ $('#cv-sheet').classList.remove('open'); $('#cv-scrim').classList.remove('open'); }
  $('#cvClose').addEventListener('click', closeCvSheet);
  $('#cv-scrim').addEventListener('click', closeCvSheet);
  $('#cvSave').addEventListener('click', async () => {
    try {
      const d = await API.call('/cv/save', {
        name: $('#cvName').value, contact: $('#cvContact').value, headline: $('#cvHeadline').value,
        experience: $('#cvExp').value, skills: $('#cvSkills').value, languages: $('#cvLang').value, about: $('#cvAbout').value
      });
      myCv = d.cv; myCvReady = d.ready;
      toast(d.ready ? T('cv.saved','Cv bewaard. U kunt nu overal solliciteren.') : T('cv.savedpart','Bewaard. Vul ervaring of vaardigheden aan om te kunnen solliciteren.'));
      renderCvCard(); closeCvSheet();
    } catch(e){ toast(e.message); }
  });
  async function memberApply(code, func, note){
    try {
      await API.call('/member/apply', { supplierCode: code, func, note });
      toast(T('cv.applied','Sollicitatie verstuurd, met uw RTG-cv erbij.'));
      return true;
    } catch(e){
      toast(e.message);
      if (/cv/i.test(e.message)) openCvSheet();
      return false;
    }
  }

  /* ---------- vacatures: dezelfde partnervacatures als in de RTFoundation,
     nu ook voor RTG-leden, met land- en afstandfilter en solliciteren met cv ---------- */
  const VLAG = { NL:'🇳🇱', BE:'🇧🇪', DE:'🇩🇪', FR:'🇫🇷', ES:'🇪🇸', JP:'🇯🇵' };
  const VACSOORT = { bijbaan:'Bijbaan', vakantiewerk:'Vakantiewerk', parttime:'Parttime', fulltime:'Fulltime', stage:'Stage', vrijwilliger:'Vrijwilliger' };
  let vacs = [], vacLanden = [], vacLand = '';
  async function loadVacatures(){
    try {
      const d = await API.call('/member/vacatures', vacLand ? { land: vacLand } : {});
      vacs = d.vacatures || []; vacLanden = d.landen || [];
      renderVacatures();
      // locatie ophalen zodat vacatures op afstand komen (eenmalig)
      if (window.Geo && !Geo.laatste() && !loadVacatures._gps){ loadVacatures._gps = true; Geo.positie().then(p => { if (p) renderVacatures(); }); }
    } catch(e){ $('#homeVacatures').hidden = true; }
  }
  function renderVacatures(){
    const el = $('#homeVacatures'); if (!el) return;
    if (!vacs.length && !vacLand){ el.hidden = true; return; }
    el.hidden = false;
    const mijnPlek = window.Geo ? Geo.laatste() : null;
    const rij = vacs.map(v => ({ v, km: mijnPlek && v.loc ? Geo.afstandKm(mijnPlek, v.loc) : null }));
    if (mijnPlek) rij.sort((a,b) => (a.km==null?1e9:a.km) - (b.km==null?1e9:b.km));
    const isApplied = (v) => myApps.some(a => a.func === v.func && a.company === v.bedrijf);
    const landOpts = '<option value="">🌍 '+T('vac.overal','Overal')+'</option>' +
      vacLanden.map(l => '<option value="'+l.code+'"'+(l.code===vacLand?' selected':'')+'>'+(VLAG[l.code]||'🏳️')+' '+esc(l.naam)+'</option>').join('');
    let h = '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">'+
      '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">💼 '+T('vac.k','Werk en vacatures')+'</div>'+
      '<select id="vacLand" style="background:var(--card2);color:var(--txt,#fff);border:1px solid var(--line);border-radius:999px;padding:0.3rem 0.6rem;font-size:0.72rem;">'+landOpts+'</select></div>';
    if (!rij.length){
      h += '<div style="margin-top:0.6rem;font-size:0.82rem;color:var(--muted);">'+T('vac.leeg','Nu geen open vacatures die bij u passen. Kijk gerust later nog eens.')+'</div>';
    } else {
      h += '<div style="margin-top:0.7rem;display:flex;flex-direction:column;gap:0.6rem;">'+ rij.slice(0,20).map(({v,km})=>{
        const al = isApplied(v);
        const meta = [ VACSOORT[v.soort]||v.soort, (VLAG[v.land]||'')+' '+(v.landNaam||''), v.plaats||v.stad, km!=null?('📍 '+Geo.tekst(km)):'' ].filter(x=>x&&x.trim()).join(' · ');
        return '<div style="border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.85rem;">'+
          '<div style="display:flex;align-items:flex-start;gap:0.5rem;justify-content:space-between;">'+
          '<div style="min-width:0;"><b style="font-size:0.9rem;">'+esc(v.func)+'</b>'+
          '<div style="font-size:0.74rem;color:var(--gold);font-weight:600;">'+esc(v.bedrijf)+'</div>'+
          '<div style="font-size:0.7rem;color:var(--soft);margin-top:0.15rem;">'+esc(meta)+'</div></div>'+
          (al ? '<span style="flex-shrink:0;font-size:0.6rem;letter-spacing:0.06em;text-transform:uppercase;color:#4CAF7D;border:1px solid #4CAF7D;border-radius:999px;padding:0.15rem 0.5rem;">'+T('vac.verstuurd','verstuurd')+'</span>'
               : '<button class="vbtn" style="flex-shrink:0;width:auto;padding:0.4rem 0.8rem;font-size:0.74rem;" data-vac="'+v.id+'" data-sup="'+v.supplierCode+'">'+T('vac.sol','Solliciteer')+'</button>')+
          '</div>'+
          (v.omschrijving?'<div style="font-size:0.74rem;color:var(--muted);margin-top:0.4rem;line-height:1.4;">'+esc(v.omschrijving)+'</div>':'')+
          '</div>';
      }).join('')+'</div>';
    }
    el.innerHTML = h;
    const sel = $('#vacLand'); if (sel) sel.addEventListener('change', () => { vacLand = sel.value; loadVacatures(); });
    el.querySelectorAll('[data-vac]').forEach(b => b.addEventListener('click', () => applyVac(b.dataset.sup, b.dataset.vac)));
  }
  async function applyVac(supplierCode, vacatureId){
    const v = vacs.find(x => x.id === vacatureId);
    try {
      await API.call('/member/apply', { supplierCode, vacatureId });
      toast(T('cv.applied','Sollicitatie verstuurd, met uw RTG-cv erbij.'));
      if (v) myApps.unshift({ company: v.bedrijf, func: v.func, status: 'nieuw', at: new Date().toISOString() });
      renderVacatures(); renderCvCard();
    } catch(e){
      toast(e.message);
      if (/cv/i.test(e.message)) openCvSheet();
    }
  }

  /* ---------- chat met de werkgever (na uitnodigen/aannemen) ----------
     De sollicitant en de werkgever maken hier samen een afspraak om langs te
     komen. Berichten worden automatisch naar de gekozen taal vertaald. */
  let apChatId = null, apChatTimer = null;
  function apMsgHtml(m){
    const mij = m.van === 'sollicitant';
    const inner = mij ? escT(m.tekst) : '<span class="xlate">' + escT(m.tekst) + '</span>';
    return '<div class="dm-m' + (mij ? ' mine' : '') + '">' + inner + '</div>';
  }
  function ensureApChatEl(){
    let ov = document.getElementById('apchat'); if (ov) return ov;
    ov = document.createElement('div'); ov.id='apchat';
    ov.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);display:none;align-items:flex-end;justify-content:center;';
    ov.innerHTML='<div style="background:var(--bg,#0C0C0B);border:1px solid var(--line);border-radius:16px 16px 0 0;width:min(100%,34rem);height:78vh;display:flex;flex-direction:column;">'+
      '<div style="display:flex;align-items:center;gap:.6rem;padding:.9rem 1rem;border-bottom:1px solid var(--line);"><b id="apchatWie" style="flex:1;"></b><button id="apchatX" style="background:none;border:none;color:var(--soft);font-size:1.3rem;">✕</button></div>'+
      '<div id="apchatMsgs" class="dm-body" style="flex:1;overflow:auto;padding:1rem;display:flex;flex-direction:column;gap:.4rem;"></div>'+
      '<div style="display:flex;gap:.5rem;padding:.8rem 1rem;border-top:1px solid var(--line);"><input id="apchatIn" placeholder="'+T('cv.chat.ph','Bericht (bijv. Kan ik donderdag om 15u langskomen?)')+'" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:.6rem .85rem;color:var(--txt,#fff);"><button id="apchatSend" class="vbtn" style="width:auto;padding:.5rem 1rem;">'+T('cv.chat.send','Stuur')+'</button></div>'+
      '</div>';
    document.body.appendChild(ov);
    ov.querySelector('#apchatX').addEventListener('click', closeApplyChat);
    ov.addEventListener('click', e=>{ if(e.target===ov) closeApplyChat(); });
    ov.querySelector('#apchatSend').addEventListener('click', sendApplyChat);
    ov.querySelector('#apchatIn').addEventListener('keydown', e=>{ if(e.key==='Enter') sendApplyChat(); });
    return ov;
  }
  async function laadApplyChat(){
    if (!apChatId) return;
    try { const d = await API.call('/member/apply/chat', { id: apChatId });
      const box = document.getElementById('apchatMsgs'); if(!box) return;
      box.innerHTML = (d.chat.berichten||[]).map(apMsgHtml).join('') || '<div style="color:var(--soft);text-align:center;margin:auto;font-size:0.82rem;">'+T('cv.chat.leeg','Nog geen berichten. Stel een moment voor om langs te komen.')+'</div>';
      vertaalBubbels(box); box.scrollTop = box.scrollHeight;
    } catch(e){}
  }
  function openApplyChat(id, bedrijf){
    apChatId = id; const ov = ensureApChatEl();
    ov.querySelector('#apchatWie').textContent = bedrijf || T('cv.chat.title','Chat met de werkgever');
    ov.style.display='flex'; laadApplyChat();
    clearInterval(apChatTimer); apChatTimer = setInterval(laadApplyChat, 4000);
  }
  function closeApplyChat(){ apChatId=null; clearInterval(apChatTimer); const ov=document.getElementById('apchat'); if(ov) ov.style.display='none'; }
  async function sendApplyChat(){
    const inp = document.getElementById('apchatIn'); const t=(inp.value||'').trim(); if(!t||!apChatId) return; inp.value='';
    try { await API.call('/member/apply/chat/send', { id: apChatId, text: t }); laadApplyChat(); } catch(e){ toast(e.message); }
  }

  /* ---------- gastchat met een partner ---------- */
  let pchat = null; // { code, name, dept, depts }
  const DEPT_EN = { 'Receptie':'Reception', 'Roomservice':'Room service', 'Housekeeping':'Housekeeping', 'Onderhoud':'Maintenance', 'Security':'Security', 'Beheer':'Management', 'Team':'Team' };
  const tDept = d => (lang() === 'en' ? (DEPT_EN[d] || d) : d);
  async function openPChat(code){
    const s = suppliers.find(x => x.code === code);
    if (!s) return;
    const depts = s.depts && s.depts.length ? s.depts : ['Team'];
    pchat = { code, name: s.name, dept: depts[0], depts };
    $('#pcName').textContent = s.name;
    renderPChatDepts();
    $('#pchat-sheet').classList.add('open');
    $('#pchat-scrim').classList.add('open');
    await loadPChat();
    $('#pcInput').focus();
  }
  function renderPChatDepts(){
    const el = $('#pcDepts');
    if (!pchat || pchat.depts.length < 2){ el.innerHTML = ''; return; }
    el.innerHTML = pchat.depts.map(d =>
      '<button data-dept="' + d + '"' + (d === pchat.dept ? ' class="on"' : '') + '>' + tDept(d) + '</button>'
    ).join('');
    el.querySelectorAll('[data-dept]').forEach(b => b.addEventListener('click', async () => {
      pchat.dept = b.dataset.dept;
      renderPChatDepts();
      await loadPChat();
    }));
  }
  function closePChat(){
    pchat = null;
    $('#pchat-sheet').classList.remove('open');
    $('#pchat-scrim').classList.remove('open');
  }
  async function loadPChat(){
    if (!pchat) return;
    let msgs = [];
    try { msgs = (await API.call('/partner/chat/history', { supplierCode: pchat.code, dept: pchat.dept })).messages || []; }
    catch(e){ return; }
    renderPChat(msgs);
  }
  function renderPChat(msgs){
    // Met Util.el: zowel de naam van de afzender (m.who) als de berichttekst gaan
    // structureel als tekstknoop. Dat sluit een gat: de oude versie zette m.who
    // ongefilterd in de HTML en escapete de tekst maar deels.
    const E = Util.el, body = $('#pcBody');
    if (!msgs.length){
      Util.vervang(body, E('div', { class: 'pc-empty' }, T('app.pc.empty', 'Stel uw vraag rechtstreeks aan het team. Roomservice, een verzoek aan de eigenaar, of gewoon even iets regelen.')));
      return;
    }
    Util.vervang(body, msgs.map(m => E('div', { class: 'pc-msg ' + (m.from === 'guest' ? 'me' : 'them') },
      m.from === 'partner' ? E('span', { class: 'who' }, m.who) : null,
      m.text,
      m.orig ? E('span', { style: { display: 'block', marginTop: '0.25rem', fontSize: '0.66rem', opacity: '0.55', fontStyle: 'italic' } }, m.orig) : null,
      E('time', {}, timeAgo(m.at)))));
    body.scrollTop = body.scrollHeight;
  }
  async function sendPChat(){
    const inp = $('#pcInput');
    const text = (inp.value || '').trim();
    if (!text || !pchat) return;
    inp.value = '';
    try { renderPChat((await API.call('/partner/chat/send', { supplierCode: pchat.code, dept: pchat.dept, text })).messages); }
    catch(e){ toast(e.message); }
  }
  $('#pcClose').addEventListener('click', closePChat);
  $('#pchat-scrim').addEventListener('click', closePChat);
  // vooraf al op elkaars Salon kijken: nooit vreemden van elkaar
  $('#pcSalon').addEventListener('click', () => { if (pchat) openEtalage(pchat.code); });
  $('#pcSend').addEventListener('click', sendPChat);
  $('#pcInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendPChat(); });
  // De gast vraagt zelf om aandacht: het team krijgt meteen een prioriteitsmelding.
  document.querySelectorAll('#pcAttn [data-attn]').forEach(b => b.addEventListener('click', async () => {
    if (!pchat) return;
    try { await API.call('/aandacht', { supplierCode: pchat.code, reden: b.dataset.attn }); toast(T('app.attn.ok','Het team is gewaarschuwd en komt eraan.')); }
    catch(e){ toast(e.message); }
  }));

  /* ---------- oplichtend ophaalcode-scherm ---------- */
  function showGlow(o){
    $('#gcSup').textContent = o.supplierName;
    $('#gcCode').textContent = o.pickup;
    $('#glowCode').classList.add('open');
  }
  $('#glowCode').addEventListener('click', () => $('#glowCode').classList.remove('open'));

  /* ---------- home + codenaam ---------- */

  function qrSvg(seed){
    let s = seed, cells = '';
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++){
      const corner = (x < 4 && y < 4) || (x > 8 && y < 4) || (x < 4 && y > 8);
      const on = corner
        ? ((x % 12 < 1 || x % 12 > 2 ? 1 : 0) || (y % 12 < 1 || y % 12 > 2 ? 1 : 0)) &&
          !((x % 12 === 1 || x % 12 === 2) && (y % 12 === 1 || y % 12 === 2)) || (x===1&&y===1)||(x===2&&y===2)||(x===11&&y===1)||(x===1&&y===11)
        : rnd() > 0.5;
      if (on) cells += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
    }
    return '<svg viewBox="0 0 13 13" xmlns="http://www.w3.org/2000/svg" fill="#0C0C0B">' + cells + '</svg>';
  }

  function toggleWhy(forceOpen){
    const why = document.querySelector('.codecard .why');
    if (!why) return;
    why.classList.toggle('open', forceOpen === true ? true : !why.classList.contains('open'));
  }

  function renderVerifyBanner(){
    const el = $('#verifyBanner');
    if (!el) return;
    const v = user && user.account ? user.verified : null;
    if (!user || !user.account || v === 'verified'){ el.innerHTML = ''; return; }
    if (v === 'pending'){
      el.innerHTML = '<div class="vbanner pending"><b>'+T('vf.pending.h','Verificatie in behandeling')+'</b><span>'+T('vf.pending.b','We controleren uw document. U kunt de app gewoon blijven gebruiken.')+'</span>'+
        '<button class="vbtn" id="selfieStart" style="margin-top:0.5rem;">'+T('vf.selfie','Selfie toevoegen (gezichtscontrole)')+'</button></div>';
      const sb = $('#selfieStart'); if (sb) sb.addEventListener('click', () => $('#selfieFile').click());
      return;
    }
    el.innerHTML = '<div class="vbanner"><b>'+T('vf.h','Verifieer uw identiteit, boek in één tik')+'</b>' +
      '<span>'+T('vf.b','Eén foto van de voorkant van uw paspoort plus een selfie. Zo weet RTG zeker dat u het bent (gezicht x paspoort), houden we nepaccounts buiten, en boekt u daarna zonder gedoe. Uw gegevens zijn alleen zichtbaar voor RTG.')+'</span>' +
      '<button class="vbtn" id="verifyStart">'+T('vf.btn','Document uploaden')+'</button></div>';
    $('#verifyStart').addEventListener('click', () => $('#verifyFile').click());
  }
  (function initVerifyUpload(){
    const vf = document.getElementById('verifyFile');
    if (!vf) return;
    vf.addEventListener('change', () => {
      const file = vf.files[0]; if (!file) return;
      if (file.size > 5 * 1024 * 1024){ toast(T('vf.toobig','Bestand te groot (max 5 MB).')); vf.value=''; return; }
      const reader = new FileReader();
      reader.onload = async () => {
        try { await API.call('/verify/upload', { image: reader.result }); user.verified = 'pending'; renderVerifyBanner(); toast(T('vf.sent','Document ontvangen, we controleren het.')); }
        catch (e){ toast(e.message || 'Upload mislukt.'); }
      };
      reader.readAsDataURL(file);
      vf.value = '';
    });
    const sf = document.getElementById('selfieFile');
    if (sf) sf.addEventListener('change', () => {
      const file = sf.files[0]; if (!file) return;
      if (file.size > 5 * 1024 * 1024){ toast(T('vf.toobig','Bestand te groot (max 5 MB).')); sf.value=''; return; }
      const reader = new FileReader();
      reader.onload = async () => {
        try { await API.call('/verify/selfie', { image: reader.result }); toast(T('vf.selfieok','Selfie ontvangen. RTG controleert het gezicht bij uw paspoort.')); }
        catch (e){ toast(e.message || 'Upload mislukt.'); }
      };
      reader.readAsDataURL(file);
      sf.value = '';
    });
  })();

  /* ---- paspoortverzoeken: een partner vroeg uw identiteit op (u beslist) ---- */
  let paspoortInboxData = null;
  async function laadPaspoortInbox(){
    if (!user || !user.account){ const el = $('#paspoortInbox'); if (el) el.innerHTML = ''; return; }
    try { paspoortInboxData = await API.call('/paspoort/mijn', {}); } catch(e){ paspoortInboxData = null; }
    renderPaspoortInbox();
  }
  function renderPaspoortInbox(){
    const el = $('#paspoortInbox'); if (!el) return;
    if (!user || !user.account){ el.innerHTML = ''; return; }
    if (!paspoortInboxData){ laadPaspoortInbox(); return; }
    const open = (paspoortInboxData.verzoeken || []).filter(v => v.status === 'aangevraagd');
    const lopend = (paspoortInboxData.verzoeken || []).filter(v => v.status === 'goedgekeurd');
    let html = '';
    if (open.length) html += open.map(v => '<div class="vbanner" style="border-color:var(--gold,#c9a227);">' +
      '<b>🪪 '+esc(v.supplierName)+' '+T('pi.vraagt','vraagt uw')+' '+T('pi.n.'+v.niveau, v.niveau)+'</b>' +
      '<span>'+(v.reden?esc(v.reden)+' · ':'')+T('pi.uitleg','U beslist. Bij goedkeuren ziet de partner dit 10 minuten; daarna vervalt het vanzelf.')+'</span>' +
      '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;"><button class="vbtn" data-pigo="'+v.id+'">'+T('pi.goed','Goedkeuren')+'</button>' +
      '<button class="vbtn" data-piweiger="'+v.id+'" style="background:none;border:1px solid var(--line);color:var(--txt);">'+T('pi.weiger','Weigeren')+'</button></div></div>').join('');
    if (lopend.length) html += lopend.map(v => '<div class="vbanner pending"><b>'+esc(v.supplierName)+' · '+T('pi.n.'+v.niveau, v.niveau)+' '+T('pi.gedeeld','gedeeld')+'</b>' +
      '<span>'+T('pi.lopend','De inzage loopt. U kunt hem intrekken.')+'</span>' +
      '<button class="vbtn" data-pitrek="'+v.id+'" style="margin-top:0.4rem;background:none;border:1px solid var(--line);color:var(--txt);">'+T('pi.trek','Intrekken')+'</button></div>').join('');
    el.innerHTML = html;
    el.querySelectorAll('[data-pigo]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/paspoort/beslis', { id: b.dataset.pigo, akkoord: true }); toast(T('pi.goedok','Goedgekeurd.')); await laadPaspoortInbox(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-piweiger]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/paspoort/beslis', { id: b.dataset.piweiger, akkoord: false }); toast(T('pi.weigerok','Geweigerd.')); await laadPaspoortInbox(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-pitrek]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/paspoort/trek-in', { id: b.dataset.pitrek }); toast(T('pi.trekok','Ingetrokken.')); await laadPaspoortInbox(); } catch(e){ toast(e.message); }
    }));
  }

  function renderHome(){
    renderVerifyBanner();
    laadPaspoortInbox();
    // gratis gebruiker (zonder pas): beperkte, veilige startpagina
    if (user.tier === 'guest'){ renderHomeGuest(); return; }
    const first = user.full.split(' ')[0];
    const E = Util.el; // componentframework voor de kaarten hieronder
    // de stem volgt de pas van het ingelogde lid (niet alleen de ingang)
    document.documentElement.setAttribute('data-stem', user.tier);
    stemKoppen();
    $('#homeGreeting').textContent = stem(
      'Ha ' + first + ', goed je te zien.',
      'Dag ' + first + '. Alles onder controle.',
      'Welkom terug, ' + first + '. Alles staat voor u klaar.'
    ) || (T('app.welcome','Welkom,') + ' ' + first + '.');
    $('#homeSub').textContent = TIER_LABEL[user.tier] + ' · ' + T('app.membersince','lid sinds') + ' ' + user.since;

    // De codecard met Util.el: codenaam, lidnummer en leeftijdsgroep gaan
    // structureel als tekstknoop. De QR is gegenereerd (geen gebruikerstekst) en
    // blijft als kant-en-klare SVG in een eigen container.
    const qr = E('div');
    qr.innerHTML = qrSvg(user.number.length * 7919);
    Util.vervang($('#codecard'),
      E('div', { class: 'label' }, stem(
        'Je codenaam, je identiteit in onze wereld',
        'Je codenaam, de identiteit van de zaak onderweg',
        'Uw codenaam, uw identiteit in onze wereld'
      ) || T('app.cc.label', 'Uw codenaam, uw identiteit in onze systemen')),
      E('div', { class: 'cn' }, user.codename),
      E('div', { class: 'row' },
        E('div', {},
          E('div', { class: 'mrow' }, T('app.cc.membernr', 'Lidnummer'), E('b', {}, user.number)),
          E('div', { class: 'mrow', style: { marginTop: '0.55rem' } }, T('app.cc.pass', 'Pas'), E('b', {}, TIER_LABEL[user.tier])),
          user.leeftijdsgroep ? E('div', { class: 'mrow', style: { marginTop: '0.55rem' } }, T('app.cc.age', 'Leeftijd'), E('b', {}, user.leeftijdsgroep + ' \u00b7 ' + T('app.cc.ageok', 'paspoort'))) : null),
        qr),
      E('button', { class: 'whybtn', id: 'whyBtn', onclick: () => toggleWhy() }, T('app.cc.why', 'Waarom een codenaam?') + ' \u2192'),
      E('div', { class: 'why' }, E('b', {}, T('app.cc.why.h', 'Uw echte naam staat niet in onze reisdata.')),
        ' ' + T('app.cc.why.b', 'Reserveringen, betalingen en Salon-activiteit staan op uw codenaam. Uw echte naam ligt in een gescheiden, versleutelde kluis en wordt pas bij ticketing en check-in eenmalig gekoppeld. Zou reisdata ooit gestolen worden, dan heeft de aanvaller nooit de juiste naam bij uw reizen.')));

    const open = invoices.filter(i => i.status === 'open');
    const openSum = open.reduce((s,i) => s + i.netto + i.bijdrage, 0);

    // Deze twee kaarten met Util.el: tekst structureel veilig, data-goto blijft
    // (de globale [data-goto]-binding onderaan pakt de knoppen op).
    Util.vervang($('#homeTrip'),
      E('div', { class: 'label' }, T('app.nexttrip', 'Eerstvolgende reis')),
      E('div', { class: 'big' }, trip.dest),
      E('div', { class: 'meta' }, trip.dates + ' · ' + T('app.in', 'over') + ' ' + trip.days + ' ' + T('app.days', 'dagen')),
      E('button', { class: 'go', dataset: { goto: 'reizen' } }, (stem('Bekijk je reis', 'Naar je reizen', 'Bekijk uw reis') || T('app.viewtrip', 'Bekijk uw reis')) + ' →'));
    Util.vervang($('#homePay'), open.length
      ? [E('div', { class: 'label' }, T('app.outstanding', 'Openstaand')),
         E('div', { class: 'big accent' }, eur(openSum)),
         E('div', { class: 'meta' }, open.length + ' ' + (open.length === 1 ? T('app.payment', 'betaling') : T('app.payments', 'betalingen')) + ' · ' + T('app.onetapfid', 'één tik met Face ID')),
         E('button', { class: 'go', dataset: { goto: 'betalen' } }, T('app.paynow', 'Nu betalen') + ' →')]
      : [E('div', { class: 'label' }, T('app.payments.cap', 'Betalingen')),
         E('div', { class: 'big', style: { color: 'var(--green)' } }, T('app.allsettled', 'Alles voldaan')),
         E('div', { class: 'meta' }, T('app.nothingopen', 'Er staat niets open.'))]);
    $('#homeSalon').innerHTML =
      '<div class="label">'+T('app.thesalon','De Salon')+'</div>' +
      '<div class="big gold">' + nfmt(creatorLikes) + '</div>' +
      '<div class="meta">'+T('app.likesquarter','likes dit kwartaal, content levert voorrang, korting en gratis diensten op')+'</div>' +
      '<button class="go" data-goto="salon">'+T('app.tosalon','Naar De Salon')+' →</button>';
    document.querySelectorAll('#content [data-goto]').forEach(b =>
      b.addEventListener('click', () => openTab(b.dataset.goto)));
    renderContacts();
    renderFoundation();
  }

  // Startpagina voor de gratis gebruiker (zonder pas): betalen bij partners,
  // De Salon bekijken en solliciteren. Geen ledenkaart, reis of betalingen.
  function renderHomeGuest(){
    document.documentElement.setAttribute('data-stem', 'rtg');
    stemKoppen();
    $('#homeGreeting').textContent = stem('Ha, fijn dat je er bent.', '', '') || (T('app.welcome','Welkom,') + '.');
    $('#homeSub').textContent = T('app.guestsub','Gratis, zonder pas');
    $('#codecard').innerHTML =
      '<div class="label">'+T('app.guest.k','Gratis account')+'</div>'+
      '<div class="cn" style="font-size:1.35rem;">'+T('app.guest.title','Zonder pas')+'</div>'+
      '<div style="font-size:0.82rem;color:var(--muted);line-height:1.55;margin-top:0.7rem;">'+T('app.guest.body','Je kunt bij RTG-partners betalen via de app, de foto’s in De Salon bekijken en solliciteren op vacatures met je cv. Liken en reageren bij leden hoort bij een pas.')+'</div>'+
      '<button class="go" data-goto="terplaatse" style="margin-top:0.9rem;">'+T('app.guest.pay','Betaal bij een partner')+' →</button>';
    const trip = $('#homeTrip'); if (trip) trip.style.display='none';
    // de gratis app is een bestel/betaal-app: toon de betaalgeschiedenis
    const pay = $('#homePay'); if (pay){ pay.style.display=''; pay.innerHTML = '<div class="label">'+T('app.guest.history','Mijn bestellingen en betalingen')+'</div><div class="meta">'+T('app.loading','Laden...')+'</div>'; }
    loadGuestHistory();
    const salon = $('#homeSalon');
    if (salon){ salon.style.display='';
      salon.innerHTML = '<div class="label">'+T('app.thesalon','De Salon')+'</div>'+
        '<div class="big" style="font-size:1.1rem;">'+T('app.guest.salon','Bekijk de foto’s')+'</div>'+
        '<div class="meta" style="margin:.2rem 0 .7rem;">'+T('app.guest.salonsub','Ontdek wat leden en partners delen.')+'</div>'+
        '<button class="go" data-goto="salon">'+T('app.tosalon','Naar De Salon')+' →</button>';
    }
    document.querySelectorAll('#content [data-goto]').forEach(b => b.addEventListener('click', () => openTab(b.dataset.goto)));
    const fEl = $('#homeFoundation'); if (fEl) fEl.style.display='none';
    const gtab = $('#tabGezin'); if (gtab) gtab.style.display='none';
    // een gratis account (met paspoort) kan vrienden toevoegen en met hen chatten
    if (user.account) loadSocial(); else { const c = $('#homeContacts'); if (c) c.style.display='none'; }
  }
  // Betaalgeschiedenis van de gratis gebruiker: wat is besteld en betaald.
  async function loadGuestHistory(){
    const el = $('#homePay'); if (!el) return;
    let orders = [];
    try { orders = (await API.call('/orders/mine')).orders || []; } catch(e){}
    const betaald = orders.filter(o => o.paid);
    const som = betaald.reduce((s,o) => s + o.total, 0);
    const open = orders.filter(o => !o.paid);
    el.innerHTML = '<div class="label">'+T('app.guest.history','Mijn bestellingen en betalingen')+'</div>'+
      (orders.length
        ? '<div class="big" style="font-size:1.05rem;">'+eur(som)+' <span style="font-size:0.7rem;color:var(--soft);font-weight:400;">'+T('app.guest.paid','betaald')+'</span></div>'+
          '<div class="meta" style="margin:.2rem 0 .6rem;">'+betaald.length+' '+T('app.guest.paidorders','betaalde bestelling(en)')+(open.length?(' · '+open.length+' '+T('app.guest.open','open')):'')+'</div>'+
          '<div style="display:flex;flex-direction:column;gap:.45rem;">'+orders.slice(0,6).map(o=>{
            const kleur = o.paid ? 'var(--green,#4CAF7D)' : 'var(--gold)';
            const st = o.paid ? T('app.guest.ok','betaald') : T('app.guest.te','te betalen');
            return '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.6rem;font-size:0.78rem;color:var(--muted);">'+
              '<span>'+escT(o.supplierName)+' · '+o.items.reduce((n,i)=>n+i.qty,0)+' '+T('app.items','item(s)')+' · '+timeAgo(o.at)+'</span>'+
              '<span style="flex-shrink:0;white-space:nowrap;">'+eur(o.total)+' · <span style="color:'+kleur+';">'+st+'</span>'+
              (o.paid?'':' <button class="pa" data-guestpay="'+o.ref+'" style="padding:.12rem .5rem;font-size:0.66rem;margin-left:.2rem;">'+T('app.guest.paynow','betaal')+'</button>')+'</span></div>';
          }).join('')+'</div>'
        : '<div class="meta">'+T('app.guest.none','Je hebt nog niets besteld. Betaal bij een partner via Ter plaatse.')+'</div>');
    el.querySelectorAll('[data-guestpay]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/order/pay', { ref: b.dataset.guestpay }); toast(T('app.guest.paid2','Betaald.')); loadGuestHistory(); }
      catch(e){ toast(e.message); }
    }));
  }

  /* ---------- RTFoundation: eigen gezinsruimte voor gekoppelde oppas/opa/oma ---------- */
  function esc(t){ return String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function renderFoundation(){
    const homeEl = $('#homeFoundation'), tab = $('#tabGezin'), dot = $('#tabGezinDot');
    if (!user || !user.account){ if(homeEl) homeEl.style.display='none'; if(tab) tab.style.display='none'; return; }
    const g = (rtf.gekoppeld || []), m = (rtf.meldingen || []);
    const ongelezen = m.filter(x=>!x.gelezen).length;
    if (tab) tab.style.display = g.length ? '' : 'none';
    if (dot) dot.style.display = (g.length && ongelezen) ? 'block' : 'none';
    // compacte ingang op Home
    if (homeEl){
      homeEl.style.display='';
      if (!g.length){
        homeEl.innerHTML = '<div class="label">RTFoundation</div>'+
          '<div class="big" style="font-size:1.05rem;line-height:1.4;">Ben je oppas, opa of oma?</div>'+
          '<div class="meta" style="margin:.3rem 0 .7rem;">Volg een RTFoundation-gezin met je pas, dan krijg je hun meldingen hier op je telefoon, zonder een extra app.</div>'+
          '<button class="go" id="rtfKoppelBtn">Koppel een gezin →</button>';
      } else {
        homeEl.innerHTML = '<div class="label">Je gezinsruimte'+(ongelezen?' · <span style="color:var(--gold)">'+ongelezen+' nieuw</span>':'')+'</div>'+
          '<div class="big" style="font-size:1.05rem;">'+g.map(x=>esc(x.gezinNaam)).join(', ')+'</div>'+
          '<div class="meta" style="margin:.2rem 0 .7rem;">'+(ongelezen? ongelezen+' nieuwe melding'+(ongelezen>1?'en':'') : 'Alles gelezen')+'</div>'+
          '<button class="go" data-goto="gezin">Open je gezinsruimte →</button>';
      }
      const kb = $('#rtfKoppelBtn'); if (kb) kb.addEventListener('click', rtfKoppelStart);
      homeEl.querySelectorAll('[data-goto]').forEach(b=> b.addEventListener('click', ()=> openTab(b.dataset.goto)));
    }
    renderGezin();
  }
  function rtfBerichtHtml(x){
    return '<div style="padding:.55rem .7rem;border:1px solid var(--line);border-radius:12px;margin:.4rem 0;'+(x.gelezen?'':'border-color:var(--burgundy,#C23A5E);')+(x.soort==='hulp'?'background:rgba(194,58,94,.08);':'')+'">'+
      '<div style="font-size:.72rem;color:var(--muted);">'+(x.soort==='hulp'?'🆘 ':(x.soort==='reis'?'✈️ ':''))+esc(x.gezin)+' · '+esc(x.van||'')+'</div>'+
      '<div style="font-size:.92rem;line-height:1.4;margin-top:.15rem;white-space:pre-wrap;">'+esc(x.tekst)+'</div></div>';
  }
  function renderGezin(){
    const fam = $('#gezinFamilies'), feed = $('#gezinFeed'); if (!fam || !feed) return;
    const g = (rtf.gekoppeld || []), m = (rtf.meldingen || []);
    $('#gezinSub').textContent = g.length ? 'De RTFoundation-gezinnen die je als oppas of familie volgt.' : 'Je volgt nog geen gezin.';
    fam.innerHTML = '<div class="label">Gevolgde gezinnen</div>'+
      (g.length ? g.map(x=>'<div style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;border-bottom:1px solid var(--line);"><b style="flex:1;">'+esc(x.gezinNaam)+'</b><span class="meta">als '+esc(x.profielNaam)+'</span><button class="go" style="background:transparent;color:var(--muted);padding:.2rem .4rem;" data-los="'+x.code+'|'+x.profielId+'">Ontkoppel</button></div>').join('') : '<div class="meta">Nog geen gezin gekoppeld.</div>')+
      '<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.9rem;"><button class="go" id="rtfKoppelBtn2">Koppel een gezin →</button><button class="go" id="rtfPushBtn" style="background:transparent;color:var(--muted);">🔔 Meldingen op mijn telefoon</button></div>';
    feed.innerHTML = '<div class="label">Meldingen van het gezin</div>'+
      (m.length ? m.slice(0,30).map(rtfBerichtHtml).join('') : '<div class="meta">Nog geen meldingen. Zodra het gezin iets deelt, zie je het hier en op je telefoon.</div>')+
      (g.length ? '<div style="display:flex;gap:.5rem;margin-top:.8rem;"><input id="rtfReplyIn" placeholder="Antwoord het gezin..." style="flex:1;background:var(--card2,#1B1817);border:1px solid var(--line);border-radius:12px;padding:.6rem .8rem;color:var(--txt);"><button class="go" id="rtfReplyBtn">Stuur</button></div>' : '');
    fam.querySelectorAll('[data-los]').forEach(b=> b.addEventListener('click', async ()=>{ const [code,pid]=b.dataset.los.split('|'); if(!confirm('Dit gezin niet meer volgen?')) return; try{ await API.call('/rtf/ontkoppel',{code,profielId:pid}); toast('Ontkoppeld.'); await refreshState(); renderFoundation(); if(!(rtf.gekoppeld||[]).length) openTab('home'); }catch(e){ toast(e.message); } }));
    const kb=$('#rtfKoppelBtn2'); if(kb) kb.addEventListener('click', rtfKoppelStart);
    const pb=$('#rtfPushBtn'); if(pb) pb.addEventListener('click', ()=> ensurePush(true));
    const rb=$('#rtfReplyBtn'); if(rb) rb.addEventListener('click', rtfReply);
    const ri=$('#rtfReplyIn'); if(ri) ri.addEventListener('keydown', e=>{ if(e.key==='Enter') rtfReply(); });
    if (m.filter(x=>!x.gelezen).length) API.call('/rtf/meldingen/gelezen').catch(()=>{});
    if (g.length){ laadGezinInfo(); laadGezinChat(); } else { const gc=$('#gezinChat'); if(gc) gc.style.display='none'; }
  }
  let grtInit=false, grtActief=null;
  async function laadGezinChat(){
    const box=$('#gezinChat'); if(!box) return;
    const g=(rtf.gekoppeld||[]); if(!g.length){ box.style.display='none'; return; }
    box.style.display='';
    let kan; try{ kan=await API.call('/rtf/kanaal',{ code:g[0].code }); }catch(e){ box.innerHTML='<div class="meta">Chat is nu niet beschikbaar.</div>'; return; }
    if (!grtInit && window.GezinRT){ GezinRT.init({ base:'/api/foundation', code:kan.code, token:kan.token, mijnId:kan.profielId, mijnNaam:'ik', leden:kan.leden, onChat:onGrtChat }); grtInit=true; }
    else if (window.GezinRT){ GezinRT.setLeden(kan.leden); }
    let chats=[]; try{ chats=(await GezinRT.chats()).chats||[]; }catch(e){}
    const byId={}; chats.forEach(c=> byId[c.id]=c);
    box.innerHTML='<div class="label">💬 Chat en bellen</div>'+
      '<div class="meta" style="margin-bottom:.4rem;">Bericht of (video)bel het gezin in de app.</div>'+
      kan.leden.map(function(l){ var c=byId[l.id]||{}; return '<div style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;border-bottom:1px solid var(--line);"><span style="width:2rem;height:2rem;border-radius:50%;background:'+(l.kleur||'#C9A24B')+';display:flex;align-items:center;justify-content:center;flex-shrink:0;">'+(l.avatar||'🙂')+'</span><div class="grow-min"><b>'+esc(l.naam)+'</b>'+(c.ongelezen?' <span style="color:var(--burgundy);">('+c.ongelezen+')</span>':'')+(c.laatste?'<div class="meta" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(c.laatste)+'</div>':'')+'</div><button class="go" style="padding:.2rem .5rem;" data-chat="'+l.id+'">Chat</button><button class="go" style="background:transparent;padding:.2rem .4rem;" data-bel="'+l.id+'">📞</button><button class="go" style="background:transparent;padding:.2rem .4rem;" data-video="'+l.id+'">🎥</button></div>'; }).join('')+
      '<div id="grtThread" style="display:none;margin-top:.7rem;"></div>';
    box.querySelectorAll('[data-chat]').forEach(function(b){ b.onclick=function(){ openGrtThread(b.dataset.chat, kan.leden.find(function(x){return x.id===b.dataset.chat;})); }; });
    box.querySelectorAll('[data-bel]').forEach(function(b){ b.onclick=function(){ GezinRT.bel(b.dataset.bel,false); }; });
    box.querySelectorAll('[data-video]').forEach(function(b){ b.onclick=function(){ GezinRT.bel(b.dataset.video,true); }; });
  }
  function grtMsgHtml(m){ var mij=m.vanMij; var inner = mij ? esc(m.tekst) : '<span class="xlate">'+esc(m.tekst)+'</span>'; return '<div style="align-self:'+(mij?'flex-end':'flex-start')+';max-width:80%;padding:.4rem .7rem;border-radius:12px;'+(mij?'background:var(--gold);color:#1a1710;':'background:var(--card2,#1B1817);border:1px solid var(--line);')+'white-space:pre-wrap;">'+inner+'</div>'; }
  function scrollGrt(){ var m=$('#grtMsgs'); if(m) m.scrollTop=m.scrollHeight; }
  async function openGrtThread(id, lid){
    grtActief=id; var t=$('#grtThread'); t.style.display='';
    var d={berichten:[]}; try{ d=await GezinRT.thread(id); }catch(e){}
    t.innerHTML='<div style="font-weight:600;margin-bottom:.4rem;">Gesprek met '+esc(lid?lid.naam:'')+'</div>'+
      '<div id="grtMsgs" style="max-height:14rem;overflow:auto;display:flex;flex-direction:column;gap:.3rem;">'+(d.berichten||[]).map(grtMsgHtml).join('')+'</div>'+
      '<div style="display:flex;gap:.5rem;margin-top:.5rem;"><input id="grtIn" placeholder="Bericht..." style="flex:1;background:var(--card2,#1B1817);border:1px solid var(--line);border-radius:12px;padding:.5rem .7rem;color:var(--txt);"><button class="go" id="grtStuur">Stuur</button></div>';
    $('#grtStuur').onclick=grtStuur; $('#grtIn').addEventListener('keydown',function(e){ if(e.key==='Enter') grtStuur(); });
    vertaalBubbels($('#grtMsgs'));
    scrollGrt();
  }
  async function grtStuur(){ var inp=$('#grtIn'); if(!inp) return; var t=(inp.value||'').trim(); if(!t||!grtActief) return; inp.value=''; try{ var r=await GezinRT.stuur(grtActief,t); var el=$('#grtMsgs'); if(el){ el.insertAdjacentHTML('beforeend', grtMsgHtml({tekst:r.bericht.tekst,vanMij:true})); scrollGrt(); } }catch(e){ toast(e.message); } }
  function onGrtChat(m){ if(grtActief && m.van===grtActief){ var el=$('#grtMsgs'); if(el){ el.insertAdjacentHTML('beforeend', grtMsgHtml({tekst:m.tekst,vanMij:false})); vertaalBubbels(el); scrollGrt(); } } }
  const telHref = t => 'tel:' + String(t||'').replace(/[^0-9+]/g,'');
  function geleden(iso){ const s=Math.floor((Date.now()-new Date(iso).getTime())/1000); if(s<60)return 'net nu'; if(s<3600)return Math.floor(s/60)+' min geleden'; if(s<86400)return Math.floor(s/3600)+' uur geleden'; return Math.floor(s/86400)+' dag(en) geleden'; }
  function datumKort(d){ try{ const dt=new Date(d+'T00:00:00'); const vd=new Date(); vd.setHours(0,0,0,0); const mo=new Date(vd); mo.setDate(mo.getDate()+1); if(dt.getTime()===vd.getTime())return 'Vandaag'; if(dt.getTime()===mo.getTime())return 'Morgen'; return dt.toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short'}); }catch(e){ return d; } }
  async function laadGezinInfo(){
    const box = $('#gezinInfo'); if(!box) return;
    let d; try{ d = await API.call('/rtf/overzicht'); }catch(e){ box.innerHTML=''; return; }
    box.innerHTML = (d.gezinnen||[]).map(gz=>{
      const o = gz.oppasinfo||{};
      const meerdan1 = (d.gezinnen||[]).length>1;
      let h = '';
      if (meerdan1) h += '<div class="label" style="margin:.4rem 0 .2rem;color:var(--burgundy);">'+esc(gz.gezinNaam)+'</div>';
      // Belangrijke info
      h += '<div class="card"><div class="label">📋 Belangrijke info</div>';
      h += (o.noodcontacten&&o.noodcontacten.length)
        ? '<div style="margin:.2rem 0 .6rem;">'+o.noodcontacten.map(c=>'<a href="'+telHref(c.telefoon)+'" style="display:flex;align-items:center;gap:.5rem;padding:.45rem 0;border-bottom:1px solid var(--line);text-decoration:none;color:var(--txt);"><span>📞</span><b style="flex:1;">'+esc(c.naam||'Contact')+(c.wie?' <span class="meta">· '+esc(c.wie)+'</span>':'')+'</b><span style="color:var(--gold);">'+esc(c.telefoon)+'</span></a>').join('')+'</div>'
        : '';
      h += infoRij('💊 Allergieën en medisch', o.allergie);
      h += infoRij('🍽️ Eten en bedtijden', o.eten);
      h += infoRij('🏠 Huisregels', o.huisregels);
      if (!(o.noodcontacten&&o.noodcontacten.length) && !o.allergie && !o.eten && !o.huisregels) h += '<div class="meta">Het gezin heeft nog geen info ingevuld.</div>';
      h += '<div class="meta" style="margin-top:.6rem;">Bij nood: bel 112.</div></div>';
      // Agenda
      const ag = (gz.agenda||[]).filter(a=>!a.voorbij).slice(0,8);
      h += '<div class="card"><div class="label">📅 Agenda</div>'+
        (ag.length ? ag.map(a=>'<div style="display:flex;gap:.6rem;padding:.4rem 0;border-bottom:1px solid var(--line);"><b style="color:var(--gold);white-space:nowrap;">'+(a.tijd||datumKort(a.datum))+'</b><span style="flex:1;">'+esc(a.titel)+(a.wieNaam?' <span class="meta">· '+esc(a.wieNaam)+'</span>':'')+'<div class="meta">'+datumKort(a.datum)+'</div></span></div>').join('') : '<div class="meta">Niets gepland.</div>')+'</div>';
      // Waar is iedereen
      const loc = (gz.locaties||[]);
      h += '<div class="card"><div class="label">📍 Waar is iedereen</div>'+
        (loc.length ? loc.map(l=>'<div style="display:flex;align-items:center;gap:.6rem;padding:.45rem 0;border-bottom:1px solid var(--line);"><span style="width:1.8rem;height:1.8rem;border-radius:50%;background:'+(l.kleur||'#C9A24B')+';display:flex;align-items:center;justify-content:center;">'+(l.avatar||'🙂')+'</span><div style="flex:1;"><b>'+esc(l.naam)+'</b><div class="meta">'+esc(l.status)+' · '+geleden(l.at)+'</div></div>'+(l.lat!=null?'<a href="https://www.google.com/maps?q='+l.lat+','+l.lon+'" target="_blank" rel="noopener" style="color:var(--gold);white-space:nowrap;">Kaart →</a>':'')+'</div>').join('') : '<div class="meta">Niemand deelt nu iets.</div>')+'</div>';
      return h;
    }).join('');
  }
  function infoRij(titel, tekst){ return tekst ? '<div style="margin-top:.5rem;"><div class="meta" style="font-weight:600;color:var(--txt);">'+esc(titel)+'</div><div style="white-space:pre-wrap;line-height:1.4;font-size:.92rem;">'+esc(tekst)+'</div></div>' : ''; }
  async function rtfReply(){
    const inp=$('#rtfReplyIn'); if(!inp) return; const t=(inp.value||'').trim(); if(!t) return;
    const g=(rtf.gekoppeld||[]); if(!g.length) return;
    try{ await API.call('/rtf/bericht',{ code:g[0].code, tekst:t }); inp.value=''; toast('Verstuurd naar '+g[0].gezinNaam+'.'); }
    catch(e){ toast(e.message); }
  }
  async function rtfKoppelStart(){
    const code = prompt('Vul de gezinscode in die je van het gezin kreeg:');
    if (!code) return;
    try {
      const d = await API.call('/rtf/profielen', { code: code.trim().toUpperCase() });
      const namen = d.profielen.map((p,i)=> (i+1)+'. '+p.naam + (p.gekoppeld?' (al gekoppeld)':'')).join('\n');
      const keuze = prompt('Gezin "'+d.gezinNaam+'". Welk profiel ben jij?\n'+namen+'\n\nTyp het nummer:');
      const idx = parseInt(keuze,10)-1;
      if (isNaN(idx) || !d.profielen[idx]) return;
      const r = await API.call('/rtf/koppel', { code: code.trim().toUpperCase(), profielId: d.profielen[idx].id });
      toast('Gekoppeld aan '+r.gezinNaam+'. Je krijgt hun meldingen nu ook op je telefoon.');
      await refreshState(); renderFoundation(); openTab('gezin');
      ensurePush(true);
    } catch(e){ toast(e.message || 'Koppelen lukte niet.'); }
  }
  // web-push aanzetten voor gezinsmeldingen op de telefoon
  function urlB64ToUint8(base64){
    const pad='='.repeat((4-base64.length%4)%4); const b=(base64+pad).replace(/-/g,'+').replace(/_/g,'/');
    const raw=atob(b); const arr=new Uint8Array(raw.length); for(let i=0;i<raw.length;i++)arr[i]=raw.charCodeAt(i); return arr;
  }
  async function ensurePush(interactief){
    try{
      if (!('serviceWorker' in navigator) || !('PushManager' in window)){ if(interactief) toast('Push wordt op dit toestel niet ondersteund.'); return; }
      const keyRes = await fetch('/api/push/key').then(r=>r.json()).catch(()=>({}));
      if (!keyRes.key){ if(interactief) toast('Meldingen zijn nu niet beschikbaar.'); return; }
      if (interactief || Notification.permission==='default'){
        const perm = await Notification.requestPermission();
        if (perm !== 'granted'){ if(interactief) toast('Zet meldingen aan in je instellingen om ze te ontvangen.'); return; }
      } else if (Notification.permission !== 'granted'){ return; }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: urlB64ToUint8(keyRes.key) });
      await API.call('/push/subscribe', { subscription: sub });
      if (interactief) toast('Top! Gezinsmeldingen komen nu ook op je telefoon binnen.');
    }catch(e){ if(interactief) toast('Meldingen aanzetten lukte niet.'); }
  }

  /* ---------- reizen ---------- */

  function renderTrip(){
    $('#tripSub').textContent = trip.dest + ' · ' + trip.dates + ' · ' + T('app.in','over') + ' ' + trip.days + ' ' + T('app.days','dagen');
    $('#tripList').innerHTML = trip.items.map(it =>
      '<div class="rowitem">' +
        '<div class="t"><b>' + it.title + '</b><span>' + it.when + ' · ' + it.sub + '</span></div>' +
        '<span class="pill ' + (it.status === 'paid' ? 'paid' : it.status === 'req' ? 'req' : 'open') + '">' + tLbl(it.label) + '</span>' +
      '</div>').join('');
    renderAgenda();
  }

  /* de reisagenda: alles met een datum (tafels, tickets, ritten, events)
     automatisch samengevoegd tot een dagprogramma onder de reis */
  const AGENDA_ICO = { reservering: '🪑', ticket: '🎟', boeking: '🗓', rit: '🚗', event: '🎉' };
  async function renderAgenda(){
    if (!API.live) return;
    let wrap = $('#agendaWrap');
    if (!wrap){
      wrap = document.createElement('div');
      wrap.id = 'agendaWrap';
      $('#tripList').insertAdjacentElement('afterend', wrap);
    }
    let dagen = [];
    try { dagen = (await API.call('/agenda/mijn')).dagen || []; } catch(e){ return; }
    if (!dagen.length){ wrap.innerHTML = ''; return; }
    const dagNaam = d => new Date(d + 'T12:00:00').toLocaleDateString(lang() === 'en' ? 'en-GB' : 'nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
    wrap.innerHTML = '<div class="sec-label" style="margin-top:1.2rem;">📅 ' + T('erv.agenda','Mijn programma') + '</div>' +
      dagen.map(d =>
        '<div style="font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--gold);margin:0.7rem 0 0.35rem;">' + dagNaam(d.datum) + '</div>' +
        d.items.map(it =>
          '<div class="rowitem"><div class="t"><b>' + (AGENDA_ICO[it.soort] || '·') + ' ' + it.titel + '</b><span>' + (it.tijd || T('erv.heledag','hele dag')) + ' · ' + tStatus(it.status) + '</span></div></div>'
        ).join('')
      ).join('');
  }

  /* ---------- betalen (Face ID) ---------- */

  const FID = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M6 19 V13 a7 7 0 0 1 7-7 h6"/><path d="M45 6 h6 a7 7 0 0 1 7 7 v6"/>' +
    '<path d="M58 45 v6 a7 7 0 0 1-7 7 h-6"/><path d="M19 58 h-6 a7 7 0 0 1-7-7 v-6"/>' +
    '<circle cx="23.5" cy="26.5" r="2.6" fill="currentColor" stroke="none"/><circle cx="40.5" cy="26.5" r="2.6" fill="currentColor" stroke="none"/>' +
    '<path d="M32 26 v8.5 a2.2 2.2 0 0 1-2.2 2.2"/><path d="M23 42.5 a12.5 8.5 0 0 0 18 0"/></svg>';
  const CHECK = '<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="28" stroke="#2E6B4F" stroke-width="3.5"/>' +
    '<path d="M20 33 l8.5 8.5 L45 23" stroke="#2E6B4F" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  async function executePay(target){
    let foundation = 0;
    if (API.live){
      const data = await API.call('/pay', target === 'all' ? {all:true} : {invoiceId: target});
      foundation = data.foundation;
      applyState(data.state);
    } else {
      const targets = target === 'all' ? invoices.filter(i => i.status === 'open') : invoices.filter(i => i.id === target);
      for (const inv of targets){
        inv.status = 'paid'; inv.date = 'Zojuist betaald';
        foundation += Math.round(inv.bijdrage * 0.3);
        for (const t of trip.items) if (t.invoiceId === inv.id){ t.status = 'paid'; t.label = 'Bevestigd'; }
      }
    }
    return foundation;
  }

  let payBusy = false;
  function payWithFaceId(amount, doPay, opts){
    if (payBusy) return;
    opts = opts || {};
    payBusy = true;
    const pw = $('#paywait'), card = pw.querySelector('.paycard');
    $('#payAmt').textContent = amount;
    $('#payIcon').innerHTML = FID.replace(/currentColor/g, '#0C0C0B');
    $('#payLbl').textContent = T('app.payingfid','Betalen met Face ID…');
    card.classList.add('scanning'); card.classList.remove('done');
    pw.classList.add('open');
    setTimeout(async () => {
      try {
        const result = await doPay();
        card.classList.remove('scanning'); card.classList.add('done');
        $('#payIcon').innerHTML = CHECK;
        $('#payLbl').textContent = T('app.confirmed','Bevestigd');
        setTimeout(() => {
          pw.classList.remove('open');
          payBusy = false;
          if (opts.message) toast(opts.message(result));
          else { toast(T('app.paid','Betaald') + '. ' + eur(result) + ' ' + T('app.tofoundation','gaat naar de RTFoundation.')); renderPay(); renderHome(); renderTrip(); }
          if (opts.after) opts.after(result);
        }, 700);
      } catch (e) {
        pw.classList.remove('open');
        payBusy = false;
        toast(e.message || T('app.payfailed','Betaling mislukt.'));
      }
    }, 1100);
  }

  /* ---------- betalen met munten (crypto) ----------
     Kies een munt, ontvang het exacte bedrag en een adres. RTG zet de munten via
     een vergunninghoudende aanbieder meteen om naar euro; wij houden zelf geen
     crypto vast. Zodra het netwerk bevestigt, zetten we de factuur op betaald. */
  let muntPoll = null;
  function muntStop(){ if (muntPoll){ clearInterval(muntPoll); muntPoll = null; } }
  // cfg: { euro, titel, maak: async(munt)=>verzoek, klaar?: async()=>bool }
  function openMuntSheet(cfg){
    muntStop();
    let ov = document.getElementById('munt-ov');
    if (!ov){ ov = document.createElement('div'); ov.id = 'munt-ov';
      ov.style.cssText = 'position:fixed;inset:0;z-index:130;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center;';
      document.body.appendChild(ov);
      ov.addEventListener('click', e => { if (e.target === ov){ muntStop(); ov.remove(); } });
    }
    const munten = (muntOpties && muntOpties.munten) || [];
    const naam = { btc:'Bitcoin', eth:'Ethereum', usdc:'USD Coin', usdt:'Tether' };
    ov.innerHTML = '<div style="width:100%;max-width:460px;background:var(--bg);border-radius:20px 20px 0 0;border:1px solid var(--line);padding:1.1rem 1.2rem 1.4rem;">' +
      '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;"><b style="font-size:1rem;">◈ ' + escT(cfg.titel || T('munt.title','Betaal met munten')) + '</b>' +
        '<button id="muntX" style="margin-left:auto;background:none;border:none;color:var(--muted);font-size:1.1rem;cursor:pointer;">✕</button></div>' +
      '<div style="font-size:0.78rem;color:var(--soft);margin-bottom:0.8rem;">' + T('munt.bedrag','Te betalen') + ': <b style="color:var(--txt);">' + eur(cfg.euro) + '</b>. ' + T('munt.omzet','RTG zet uw munten meteen om naar euro.') + '</div>' +
      '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.2rem;">' +
        munten.map(m => '<button class="js-muntpick" data-munt="' + m.munt + '" style="flex:1;min-width:5rem;background:var(--card);border:1px solid var(--line);color:var(--txt);border-radius:12px;padding:0.6rem;font-family:inherit;cursor:pointer;"><b style="text-transform:uppercase;">' + m.munt + '</b><br><span style="font-size:0.62rem;color:var(--soft);">' + (naam[m.munt] || m.munt) + '</span></button>').join('') +
      '</div>' +
      '<div id="muntDetail"></div></div>';
    ov.querySelector('#muntX').addEventListener('click', () => { muntStop(); ov.remove(); });
    ov.querySelectorAll('.js-muntpick').forEach(b => b.addEventListener('click', () => muntVraag(cfg, b.dataset.munt)));
  }

  async function muntVraag(cfg, munt){
    const det = document.getElementById('muntDetail');
    if (det) det.innerHTML = '<div style="font-size:0.8rem;color:var(--soft);padding:0.6rem 0;">' + T('munt.laden','Adres aanmaken…') + '</div>';
    let vz;
    try { vz = await cfg.maak(munt); }
    catch(e){ if (det) det.innerHTML = '<div style="font-size:0.8rem;color:var(--burgundy);padding:0.6rem 0;">' + (e.message || T('munt.fout','Kon geen adres maken.')) + '</div>'; return; }
    if (!det || !vz) return;
    const dot = '<span style="width:8px;height:8px;border-radius:50%;background:var(--gold);display:inline-block;flex-shrink:0;"></span>';
    det.innerHTML =
      '<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:0.9rem 1rem;margin-top:0.6rem;">' +
        '<div style="font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">' + T('munt.stuur','Stuur exact') + '</div>' +
        '<div style="font-family:\'Bodoni Moda\',serif;font-size:1.5rem;color:var(--gold);margin:0.15rem 0 0.1rem;">' + vz.bedragMunt + ' <span style="text-transform:uppercase;font-size:1rem;">' + munt + '</span></div>' +
        '<div style="font-size:0.66rem;color:var(--muted);">≈ ' + eur((vz.euroCenten || 0) / 100) + ' · ' + T('munt.koers','koers vastgezet') + '</div>' +
        '<div style="font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);margin-top:0.7rem;">' + T('munt.adres','Naar dit adres') + '</div>' +
        '<div style="display:flex;align-items:center;gap:0.4rem;margin-top:0.2rem;">' +
          '<code style="flex:1;font-size:0.66rem;word-break:break-all;color:var(--txt);background:rgba(0,0,0,0.15);border-radius:8px;padding:0.4rem 0.5rem;">' + escT(vz.adres) + '</code>' +
          '<button id="muntCopy" style="flex-shrink:0;background:none;border:1px solid var(--line);border-radius:999px;padding:0.3rem 0.6rem;font-size:0.62rem;color:var(--muted);cursor:pointer;">' + T('munt.kopieer','Kopieer') + '</button>' +
        '</div>' +
        '<div style="margin-top:0.7rem;font-size:0.72rem;color:var(--soft);display:flex;align-items:center;gap:0.4rem;">' + dot + T('munt.wacht','Wachten op bevestiging van het netwerk…') + '</div>' +
      '</div>';
    const cp = document.getElementById('muntCopy');
    if (cp) cp.addEventListener('click', async () => { try { await navigator.clipboard.writeText(vz.adres); toast(T('munt.gekopieerd','Adres gekopieerd.')); } catch(e){ toast(vz.adres); } });
    // Poll: de aanbieder-webhook bevestigt de ontvangst. In demo blijft dit staan
    // tot een echte ontvangst binnenkomt.
    if (typeof cfg.klaar !== 'function') return;
    muntStop();
    let n = 0;
    muntPoll = setInterval(async () => {
      n++;
      try {
        if (await cfg.klaar()){
          muntStop();
          const o = document.getElementById('munt-ov'); if (o) o.remove();
          toast('◈ ' + T('munt.ontvangen','Betaald met munten. Dank u.'));
          renderPay(); renderHome();
        }
      } catch(e){}
      if (n > 150) muntStop(); // na ~10 minuten stoppen met pollen
    }, 4000);
  }

  /* ---------- rechtstreeks betalen aan een partner (Face ID) ----------
     Overal in de app: één bedrag, Face ID, geld gaat direct naar de partner.
     Bereikbaar vanuit de Salon en vanuit de AI/concierge. */
  function betaalPartner(code, name, opts){
    opts = opts || {};
    const idem = 'dp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    let ov = document.getElementById('dp-ov');
    if (!ov){ ov = document.createElement('div'); ov.id = 'dp-ov';
      ov.style.cssText = 'position:fixed;inset:0;z-index:130;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center;';
      document.body.appendChild(ov);
      ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    }
    ov.innerHTML = '<div style="width:100%;max-width:460px;background:var(--bg);border-radius:20px 20px 0 0;border:1px solid var(--line);padding:1.1rem 1.2rem 1.4rem;">' +
      '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.2rem;"><b style="font-size:1rem;">' + FID_MINI + T('dp.title','Betaal direct') + '</b>' +
        '<button id="dpX" style="margin-left:auto;background:none;border:none;color:var(--muted);font-size:1.1rem;cursor:pointer;">✕</button></div>' +
      '<div style="font-size:0.8rem;color:var(--soft);margin-bottom:0.8rem;">' + T('dp.naar','Aan') + ' <b style="color:var(--txt);">' + escT(name) + '</b>. ' + T('dp.direct','Het bedrag gaat rechtstreeks naar de partner.') + '</div>' +
      (opts.omschrijving ? '<div style="font-size:0.82rem;margin-bottom:0.6rem;">' + escT(opts.omschrijving) + '</div>' : '') +
      '<label style="font-size:0.72rem;color:var(--soft);">' + T('dp.bedrag','Bedrag (€)') + '</label>' +
      '<input id="dpBedrag" type="number" inputmode="decimal" min="0.50" step="0.50" ' + (opts.bedrag ? 'value="' + opts.bedrag + '"' : '') + ' style="width:100%;font-size:1.3rem;padding:0.6rem 0.8rem;margin:0.25rem 0 0.7rem;background:var(--card);border:1px solid var(--line);border-radius:12px;color:var(--txt);">' +
      '<input id="dpNote" placeholder="' + T('dp.note','Waarvoor? (optioneel)') + '" ' + (opts.omschrijving ? 'value="' + escT(opts.omschrijving) + '"' : '') + ' style="width:100%;padding:0.55rem 0.8rem;margin-bottom:0.9rem;background:var(--card);border:1px solid var(--line);border-radius:12px;color:var(--txt);">' +
      '<button id="dpPay" class="mo-pay" style="width:100%;justify-content:center;padding:0.8rem;">' + FID_MINI + T('app.paywithfid','Betaal met Face ID') + '</button>' +
      (muntOpties && muntOpties.aan ? '<button id="dpMunt" style="width:100%;margin-top:0.5rem;background:none;border:1px solid var(--line);color:var(--muted);border-radius:999px;padding:0.7rem;font-family:inherit;font-size:0.8rem;cursor:pointer;">◈ ' + T('fin.paycoins','Met munten') + '</button>' : '') +
      '</div>';
    ov.querySelector('#dpX').addEventListener('click', () => ov.remove());
    const dpLees = () => {
      const bedrag = Math.round(Number(ov.querySelector('#dpBedrag').value) * 100) / 100;
      if (!(bedrag >= 0.5)) { toast(T('dp.min','Kies een bedrag van minstens € 0,50.')); return null; }
      return { bedrag, note: (ov.querySelector('#dpNote').value || '').trim() };
    };
    ov.querySelector('#dpPay').addEventListener('click', () => {
      const v = dpLees(); if (!v) return;
      ov.remove();
      payWithFaceId(eur(v.bedrag), async () => {
        const d = await API.call('/betaal/direct', { supplierCode: code, bedrag: v.bedrag, omschrijving: v.note, bron: opts.bron || 'app', idem });
        return d.betaling;
      }, { message: b => T('dp.betaald','Betaald aan') + ' ' + name + ': ' + eur((b.bedrag||0)/100), after: () => { if (opts.after) opts.after(); } });
    });
    const dm = ov.querySelector('#dpMunt');
    if (dm) dm.addEventListener('click', () => {
      const v = dpLees(); if (!v) return;
      ov.remove();
      openMuntSheet({
        euro: v.bedrag, titel: name,
        maak: async (munt) => (await API.call('/munt/direct', { supplierCode: code, bedrag: v.bedrag, omschrijving: v.note, munt })).verzoek,
        klaar: async () => { const mine = (await API.call('/betaal/mijn')).betalingen || []; return mine.some(p => p.betaalwijze === 'munt' && p.supplierCode === code && Math.round(p.bedrag) === Math.round(v.bedrag * 100)); }
      });
    });
  }
  // Een betaalverzoek van een partner met Face ID afrekenen.
  function betaalVerzoekPay(v){
    payWithFaceId(eur((v.bedrag||0)/100), async () => {
      const d = await API.call('/betaal/verzoek/pay', { ref: v.ref, idem: 'bv-' + v.ref });
      return d.betaling;
    }, { message: () => T('dp.verzoekbetaald','Betaalverzoek voldaan:') + ' ' + eur((v.bedrag||0)/100), after: () => { laadBetaalVerzoeken(); renderHome(); } });
  }
  // open betaalverzoeken ophalen (aan dit lid gericht)
  let betaalVerzoeken = [];
  async function laadBetaalVerzoeken(){
    if (!user || user.tier === 'guest') { betaalVerzoeken = []; return; }
    try { betaalVerzoeken = (await API.call('/betaal/verzoeken', {})).verzoeken || []; } catch(e){ betaalVerzoeken = []; }
  }

  function renderPay(){
    const open = invoices.filter(i => i.status === 'open');
    const openSum = open.reduce((s,i) => s + i.netto + i.bijdrage, 0);
    // Munt-opties eenmalig laden; zodra bekend, deze weergave opnieuw tekenen
    // (dan verschijnen de munt-knoppen). Verandert niets als acceptatie uit staat.
    if (muntOpties === null && API.live) { laadMuntOpties().then(() => renderPay()); }
    const muntAan = !!(muntOpties && muntOpties.aan && user && user.tier !== 'guest');
    // Business Pass: de volledige, boekhoudklare specificatie onder elke factuur
    // (incl. afboekcode en btw). RTG en Lifestyle houden de rustige weergave.
    const eurC = n => '€ ' + Number(n).toLocaleString(lang() === 'en' ? 'en-US' : 'nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const specRow = (l, v, strong) => '<div style="display:flex;justify-content:space-between;gap:1rem;"><span>' + l + '</span><span style="text-align:right;flex-shrink:0;' + (strong ? 'color:var(--txt);font-weight:600;' : '') + '">' + v + '</span></div>';
    const bizSpec = inv => {
      if (user.tier !== 'business') return '';
      const total = inv.netto + inv.bijdrage;
      return '<div style="margin:0 0 0.9rem;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.8rem 1rem;font-size:0.7rem;color:var(--muted);line-height:1.8;">' +
        '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);margin-bottom:0.3rem;">' + T('inv.spec','Factuurspecificatie') + '</div>' +
        specRow(T('inv.number','Factuurnummer'), inv.id) +
        specRow(T('inv.holder','Op naam van'), user.codename + ' · Business Pass') +
        (inv.netto > 0 ? specRow(T('inv.net','Nettoprijs (inkoop)'), eurC(inv.netto)) : '') +
        specRow(T('inv.contrib','Ledenbijdrage'), eurC(inv.bijdrage)) +
        specRow(T('inv.foundation','waarvan naar de RTFoundation (30%)'), eurC(Math.round(inv.bijdrage / 1.21 * 0.3 * 100) / 100)) +
        specRow(T('inv.vat','Btw 21% (in de bijdrage begrepen)'), eurC(inv.btw || 0)) +
        (inv.netto > 0 ? specRow(T('inv.toms','Reisdeel: btw-margeregeling reisdiensten'), eurC(0)) : '') +
        specRow(T('inv.total','Totaal'), eurC(total), true) +
        specRow(T('inv.ledger','Afboekcode (grootboek)'), '<b style="color:var(--txt);">' + (inv.afboekcode || '4510') + '</b> · ' + (inv.afboeklabel || '')) +
        '<div style="margin-top:0.5rem;border-top:1px solid var(--line);padding-top:0.5rem;font-size:0.64rem;">RTG (Rahul Travel Group) · KvK 82273510 · btw NL002291440B89 · ' + RTG_IBAN + '</div>' +
      '</div>';
    };
    // Financiën in één oogopslag: openstaand, dit jaar betaald, en de eigen
    // bijdrage aan de RTFoundation. Voor elke pas, rustig en zonder uitleg.
    const isContrib = d => /lidmaatschap|jaarbijdrage|maandbijdrage/i.test(d || '');
    const paidInv = invoices.filter(i => i.status === 'paid');
    const betaaldSom = paidInv.reduce((s,i) => s + i.netto + i.bijdrage, 0);
    const rtfBij = paidInv.filter(i => isContrib(i.desc)).reduce((s,i) => s + Math.round(i.bijdrage / 1.21 * 0.3 * 100) / 100, 0);
    const rtfKomt = open.filter(i => isContrib(i.desc)).reduce((s,i) => s + Math.round(i.bijdrage / 1.21 * 0.3 * 100) / 100, 0);
    const btwSom = paidInv.reduce((s,i) => s + (i.btw || 0), 0);
    const tegel = (l, v, klas) => '<div style="flex:1;min-width:6.5rem;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;">' +
      '<div style="font-size:0.56rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">' + l + '</div>' +
      '<div style="font-family:\'Bodoni Moda\',serif;font-size:1.15rem;margin-top:0.15rem;' + (klas === 'g' ? 'color:var(--gold);' : '') + '">' + v + '</div></div>';
    const finKaart = '<div style="margin-bottom:0.9rem;">' +
      '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);margin:0 0 0.5rem;">' + T('fin.title','Uw financiën') + '</div>' +
      '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">' +
        tegel(T('fin.open','Openstaand'), eur(openSum)) +
        tegel(T('fin.paid','Betaald'), eur(betaaldSom)) +
        tegel(T('fin.rtf','Naar de RTFoundation'), eur(rtfBij), 'g') +
        (user.tier === 'business' ? tegel(T('fin.vat','Btw betaald'), eur(btwSom)) : '') +
      '</div>' +
      (rtfKomt > 0 ? '<div style="margin-top:0.5rem;font-size:0.72rem;color:var(--muted);">' + T('fin.rtfnext','Van uw openstaande bijdrage gaat') + ' <b style="color:var(--gold);">' + eur(rtfKomt) + '</b> ' + T('fin.rtfnext2','naar de RTFoundation.') + '</div>' : '') +
      (API.live ? '<button id="dlOverzicht" style="margin-top:0.6rem;background:none;border:1px solid var(--line);color:var(--muted);border-radius:999px;padding:0.35rem 0.85rem;font-size:0.68rem;font-family:inherit;cursor:pointer;">⤓ ' + T('fin.dloverzicht','Download factuuroverzicht (PDF)') + '</button>' : '') +
    '</div>';
    // Filterbalk: op jaar en op soort. Handig zodra er meer facturen zijn.
    const jaarVan = i => (String(i.date || '').match(/\d{4}/) || [''])[0];
    const jaren = [...new Set(invoices.map(jaarVan).filter(Boolean))].sort().reverse();
    const zichtbaar = invoices.filter(i =>
      (payFilterJaar === 'alle' || jaarVan(i) === payFilterJaar) &&
      (payFilterType === 'alle' || (payFilterType === 'abo' ? isContrib(i.desc) : !isContrib(i.desc))));
    const chip = (actief, val, groep, label) => '<button class="js-payfilter" data-groep="' + groep + '" data-val="' + val + '" style="border:1px solid ' + (actief ? 'var(--gold)' : 'var(--line)') + ';color:' + (actief ? 'var(--gold)' : 'var(--soft)') + ';background:none;border-radius:999px;padding:0.25rem 0.7rem;font-size:0.66rem;font-family:inherit;cursor:pointer;">' + label + '</button>';
    const filterBar = (jaren.length > 1 || invoices.length > 3)
      ? '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.7rem;align-items:center;">' +
          chip(payFilterType === 'alle', 'alle', 'type', T('fin.f.alle','Alles')) +
          chip(payFilterType === 'abo', 'abo', 'type', T('fin.f.abo','Abonnement')) +
          chip(payFilterType === 'overig', 'overig', 'type', T('fin.f.overig','Overig')) +
          (jaren.length > 1 ? '<span style="width:1px;height:1rem;background:var(--line);margin:0 0.2rem;"></span>' + chip(payFilterJaar === 'alle', 'alle', 'jaar', T('fin.f.jaren','Alle jaren')) + jaren.map(j => chip(payFilterJaar === j, j, 'jaar', j)).join('') : '') +
        '</div>'
      : '';
    $('#payList').innerHTML = finKaart + filterBar + (zichtbaar.length ? '' : '<div style="color:var(--soft);font-size:0.8rem;padding:0.5rem 0;">' + T('fin.f.leeg','Geen facturen in deze selectie.') + '</div>') + zichtbaar.map(inv => {
      const total = inv.netto + inv.bijdrage;
      return '<div class="rowitem">' +
        '<div class="t"><b>' + inv.desc + '</b><span>' + inv.id + ' · ' + inv.date + '</span></div>' +
        '<div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:0.45rem;">' +
          '<span class="amount">' + eur(total) + '</span>' +
          (inv.status === 'open'
            ? '<button class="btn-pay js-pay" data-inv="' + inv.id + '" data-amt="' + total + '">' + FID + T('app.pay','Betaal') + '</button>' +
              (muntAan ? '<button class="js-munt" data-inv="' + inv.id + '" data-amt="' + total + '" style="background:none;border:1px solid var(--line);color:var(--muted);border-radius:999px;padding:0.3rem 0.75rem;font-size:0.66rem;font-family:inherit;cursor:pointer;">◈ ' + T('fin.paycoins','Met munten') + '</button>' : '')
            : '<span class="pill paid">'+T('app.paid','Betaald')+'</span>') +
          (API.live ? '<button class="js-dlinv" data-inv="' + inv.id + '" style="background:none;border:none;color:var(--soft);font-size:0.66rem;font-family:inherit;cursor:pointer;padding:0.15rem 0;">⤓ ' + T('fin.download','Download factuur') + '</button>' : '') +
        '</div>' +
      '</div>' + bizSpec(inv);
    }).join('');
    document.querySelectorAll('.js-munt').forEach(b =>
      b.addEventListener('click', () => openMuntSheet({
        euro: Number(b.dataset.amt), titel: T('munt.title','Betaal met munten'),
        maak: async (munt) => (await API.call('/munt/verzoek', { invoiceId: b.dataset.inv, munt })).verzoek,
        klaar: async () => { applyState((await API.call('/state')).state); const inv = (invoices || []).find(i => i.id === b.dataset.inv); return !!(inv && inv.status === 'paid'); }
      })));
    document.querySelectorAll('.js-dlinv').forEach(b =>
      b.addEventListener('click', () => downloadPdf('/factuur', { invoiceId: b.dataset.inv }, 'RTG-factuur-' + b.dataset.inv + '.pdf')));
    document.querySelectorAll('.js-payfilter').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.groep === 'type') payFilterType = b.dataset.val; else payFilterJaar = b.dataset.val;
      renderPay();
    }));
    const dlo = $('#dlOverzicht');
    if (dlo) dlo.addEventListener('click', () => downloadPdf('/facturen/overzicht', payFilterJaar !== 'alle' ? { jaar: payFilterJaar } : {}, 'RTG-factuuroverzicht' + (payFilterJaar !== 'alle' ? '-' + payFilterJaar : '') + '.pdf'));
    $('#payAllWrap').innerHTML = (open.length
      ? '<button class="btn-pay payall" id="payAll">' + FID + T('app.payall','Betaal alles') + ', ' + eur(openSum) + '</button>'
      : '') +
      (open.length ? '<div style="margin-top:1rem;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:0.9rem 1.1rem;font-size:0.74rem;color:var(--muted);line-height:1.6;">' +
        '<b style="color:var(--txt);font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;">'+T('app.bank.h','Liever overboeken?')+'</b><br>' +
        T('app.bank.to','Maak het bedrag over naar')+' <b style="color:var(--txt);" id="rtgIban">' + RTG_IBAN + '</b> ' +
        T('app.bank.name','t.n.v. RTG, o.v.v. uw codenaam')+' (<b style="color:var(--gold);">' + user.codename + '</b>) ' +
        T('app.bank.ref','en het factuurnummer. Na ontvangst zetten wij de factuur op betaald.') +
        ' <button id="ibanCopy" style="background:none;border:1px solid var(--line);border-radius:999px;padding:0.25rem 0.7rem;font-size:0.66rem;color:var(--muted);margin-left:0.2rem;">'+T('app.bank.copy','Kopieer IBAN')+'</button></div>' : '');
    document.querySelectorAll('.js-pay').forEach(b =>
      b.addEventListener('click', () => payWithFaceId(eur(Number(b.dataset.amt)), () => executePay(b.dataset.inv))));
    const pa = $('#payAll');
    if (pa) pa.addEventListener('click', () => payWithFaceId(eur(openSum), () => executePay('all')));
    const ic = $('#ibanCopy');
    if (ic) ic.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(RTG_IBAN); toast(T('app.bank.copied','IBAN gekopieerd.')); }
      catch(e){ toast(RTG_IBAN); }
    });
    renderGiftcards();
    renderBoekhouder();
    renderPunten();
  }

  /* RTG-punten + open betaalverzoeken (gesplitste rekeningen) + meldingsvoorkeuren */
  async function renderPunten(){
    if (!API.live || user.tier === 'guest') return;
    let wrap = $('#puntenWrap');
    if (!wrap){
      wrap = document.createElement('div');
      wrap.id = 'puntenWrap';
      $('#payAllWrap').insertAdjacentElement('afterend', wrap);
    }
    let p = null, splitsen = [], vk = null;
    try {
      [p, splitsen, vk] = await Promise.all([
        API.call('/punten').catch(() => null),
        API.call('/splitsen/mijn').then(d => d.splitsen || []).catch(() => []),
        API.call('/meldingen/voorkeur').then(d => d.voorkeur).catch(() => null)
      ]);
    } catch(e){ return; }
    const kaart = inhoud => '<div style="margin-top:1rem;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:0.9rem 1.1rem;">' + inhoud + '</div>';
    let html = '';
    // punten: saldo, tegoed en verzilveren
    if (p) html += kaart(
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.8rem;">' +
        '<div><b style="font-size:0.86rem;">✦ ' + T('erv.punten','RTG-punten') + '</b>' +
        '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.2rem;">' + p.saldo + ' ' + T('erv.puntensaldo','punten') + (p.tegoed ? ' · € ' + p.tegoed + ' ' + T('erv.tegoed','tegoed (verrekent automatisch)') : '') + '</div>' +
        '<div style="font-size:0.64rem;color:var(--soft);margin-top:0.2rem;">' + T('erv.puntenuitleg','1 punt per € 10; 100 punten = € 10 tegoed. RTG legt bij, de zaak ontvangt alles.') + '</div></div>' +
        (p.saldo >= 100 ? '<button class="vbtn" id="pzGo">' + T('erv.verzilver','Verzilver 100') + '</button>' : '') +
      '</div>');
    // open betaalverzoeken: mijn deel van gesplitste rekeningen
    const mijnKey = user.id != null ? 'user-' + user.id : user.tier;
    const echteOpen = splitsen.filter(s => s.delen.some(d2 => !d2.paid)).slice(0, 6);
    if (echteOpen.length) html += kaart(
      '<b style="font-size:0.86rem;">🤝 ' + T('erv.verzoeken','Gesplitste rekeningen') + '</b>' +
      echteOpen.map(s => {
        const mijnDeel = s.delen.find(d2 => d2.key === mijnKey && !d2.paid);
        return '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.6rem;margin-top:0.55rem;font-size:0.78rem;">' +
          '<span>' + s.supplierName + ' · ' + eur(s.totaal) + ' · ' + s.delen.filter(d2 => d2.paid).length + '/' + s.delen.length + ' ' + T('erv.betaald','betaald') + '</span>' +
          (mijnDeel
            ? '<button class="vbtn js-splpay" data-id="' + s.id + '" data-amt="' + mijnDeel.bedrag + '">' + T('erv.betaaldeel','Betaal mijn deel') + '</button>'
            : '<span style="color:var(--soft);font-size:0.68rem;">' + T('erv.wachtop','wacht op vrienden') + '</span>') +
        '</div>';
      }).join(''));
    // meldingsvoorkeuren: per soort aan of uit
    if (vk) html += kaart(
      '<b style="font-size:0.86rem;">🔔 ' + T('erv.meldingen','Meldingen') + '</b>' +
      '<div style="display:flex;flex-wrap:wrap;gap:0.5rem 1rem;margin-top:0.55rem;">' +
      [['orders', T('erv.m.orders','Bestellingen')], ['events', T('erv.m.events','Events')], ['salon', 'De Salon'], ['live', T('erv.m.live','Onderweg')], ['wachtlijst', T('erv.wachtlijst','Wachtlijst')]].map(([k, l]) =>
        '<label style="display:inline-flex;align-items:center;gap:0.35rem;font-size:0.76rem;"><input type="checkbox" class="js-vk" data-scope="' + k + '"' + (vk[k] !== false ? ' checked' : '') + '> ' + l + '</label>'
      ).join('') + '</div>');
    wrap.innerHTML = html;
    const pz = $('#pzGo');
    if (pz) pz.addEventListener('click', async () => {
      try { const d = await API.call('/punten/verzilver', { punten: 100 }); toast('✦ ' + T('erv.verzilverd','Verzilverd:') + ' € ' + d.tegoed + ' ' + T('erv.tegoedkort','tegoed.')); renderPunten(); }
      catch(e){ toast(e.message); }
    });
    wrap.querySelectorAll('.js-splpay').forEach(b => b.addEventListener('click', () =>
      payWithFaceId(eur(Number(b.dataset.amt)), async () => { await API.call('/splits/betaal', { id: b.dataset.id }); return null; },
        { message: () => T('erv.deelbetaald','Uw deel is betaald.'), after: () => renderPunten() })));
    wrap.querySelectorAll('.js-vk').forEach(c => c.addEventListener('change', async () => {
      try { await API.call('/meldingen/voorkeur', { zet: { [c.dataset.scope]: c.checked } }); }
      catch(e){ toast(e.message); }
    }));
  }

  // cadeaukaarten: kopen met Face ID, cadeau doen, inwisselen bij de zaak op code
  async function renderGiftcards(){
    const wrap = $('#gcWrap');
    if (!wrap) return;
    let kaarten = [];
    try { kaarten = (await API.call('/giftcards/mine')).kaarten || []; } catch(e){}
    if (!suppliers.length){
      try { suppliers = (await API.call('/suppliers')).suppliers || []; } catch(e){}
    }
    const opties = suppliers.map(s => '<option value="' + s.code + '">' + s.name + '</option>').join('');
    wrap.innerHTML = '<div style="margin-top:1.6rem;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:1rem 1.1rem;">' +
      '<div style="font-size:0.6rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--gold);">🎁 ' + T('gc.h','Cadeaukaarten') + '</div>' +
      '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.3rem;line-height:1.5;">' + T('gc.s','Koop een cadeaukaart van een partner en geef de code cadeau. Inwisselen gaat bij de zaak.') + '</div>' +
      (kaarten.length ? kaarten.map(k =>
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.7rem;padding:0.55rem 0;border-bottom:1px solid var(--line);font-size:0.8rem;">' +
        '<span>' + k.supplierName + '<span style="display:block;font-size:0.66rem;color:var(--gold);letter-spacing:0.06em;">' + k.code + '</span></span>' +
        '<b>' + eur(k.saldo) + '</b></div>').join('') : '') +
      '<div style="display:flex;gap:0.5rem;margin-top:0.7rem;flex-wrap:wrap;">' +
      '<select id="gcSup" style="flex:2;min-width:120px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.6rem;color:var(--txt);font-family:inherit;">' + opties + '</select>' +
      '<input id="gcAmt" type="number" placeholder="€ 50" style="flex:1;min-width:70px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.6rem;color:var(--txt);font-family:inherit;">' +
      '<button id="gcBuy" style="background:var(--knop);color:var(--knop-txt);border:none;border-radius:999px;padding:0.6rem 1rem;font-size:0.74rem;font-weight:600;font-family:inherit;">' + T('gc.koop','Koop') + '</button></div></div>';
    const kb = $('#gcBuy');
    if (kb) kb.addEventListener('click', () => {
      const bedrag = Math.round(Number($('#gcAmt').value));
      if (!(bedrag >= 10)) { toast(T('gc.min','Kies een bedrag vanaf € 10.')); return; }
      payWithFaceId(eur(bedrag), async () => {
        const d = await API.call('/giftcard/buy', { supplierCode: $('#gcSup').value, bedrag });
        return d.kaart;
      }, { message: k => T('gc.klaar','Cadeaukaart gekocht. Code:') + ' ' + k.code, after: () => renderGiftcards() });
    });
  }

  // Business Pass: de AI-boekhouder die per land weet wat terug te vorderen is
  let lidBordenUI = null;
  function renderBoekhouder(){
    const wrap = $('#bhWrap');
    if (!wrap) return;
    if (user.tier !== 'business'){ wrap.innerHTML = ''; return; }
    let land = 'NL';
    try { land = localStorage.getItem('rtg_boekland') || 'NL'; } catch(e){}
    const landen = [['NL','Nederland'],['BE','Belgie'],['DE','Duitsland'],['FR','Frankrijk'],['ES','Spanje'],['JP','Japan']];
    wrap.innerHTML = '<div style="margin-top:1rem;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:1rem 1.1rem;">' +
      '<div style="font-size:0.6rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--gold);">📚 ' + T('bh2.h','AI-boekhouder · Business Pass') + '</div>' +
      '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.3rem;line-height:1.5;">' + T('bh2.s','Kent per land de aftrekregels voor uw zakelijke reiskosten. Uw facturen staan al boekhoudklaar, met afboekcode en btw-specificatie.') + '</div>' +
      '<div style="display:flex;gap:0.5rem;margin-top:0.7rem;">' +
      '<select id="bhLand" style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.55rem;color:var(--txt);font-family:inherit;">' +
      landen.map(l => '<option value="' + l[0] + '"' + (l[0] === land ? ' selected' : '') + '>' + l[1] + '</option>').join('') + '</select>' +
      '<input id="bhQ" placeholder="' + T('bh2.ph','Bijv. kan ik dit diner terugvorderen?') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.8rem;">' +
      '<button id="bhGo" style="background:var(--knop);color:var(--knop-txt);border:none;border-radius:999px;padding:0.55rem 0.95rem;font-size:0.74rem;font-weight:600;font-family:inherit;">' + T('bh2.vraag','Vraag') + '</button></div>' +
      '<div id="bhA" style="display:none;margin-top:0.7rem;border:1px solid var(--gold);border-radius:12px;padding:0.7rem 0.9rem;font-size:0.78rem;line-height:1.6;color:var(--muted);"></div>' +
      // zzp-belastingtool: jaarwinst in, indicatie van aftrek, belasting en netto uit
      '<div style="margin-top:0.9rem;border-top:1px solid var(--line);padding-top:0.9rem;">' +
      '<div style="font-size:0.6rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--gold);">🧮 ' + T('zzp.h','Zzp-belastingtool') + '</div>' +
      '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.3rem;line-height:1.5;">' + T('zzp.s','Voor zelfstandigen: vul uw verwachte jaarwinst in voor een indicatie van uw belasting, nettowinst en wat u maandelijks opzij zet. Het land volgt de keuze hierboven.') + '</div>' +
      '<div style="display:flex;gap:0.5rem;margin-top:0.6rem;">' +
      '<input id="zzpWinst" type="number" placeholder="' + T('zzp.winstph','Jaarwinst, bijv. 60000') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.8rem;">' +
      '<button id="zzpGo" style="background:var(--knop);color:var(--knop-txt);border:none;border-radius:999px;padding:0.55rem 0.95rem;font-size:0.74rem;font-weight:600;font-family:inherit;">' + T('zzp.reken','Reken') + '</button></div>' +
      '<div style="display:flex;gap:1rem;margin-top:0.5rem;font-size:0.72rem;color:var(--muted);flex-wrap:wrap;">' +
      '<label style="display:flex;align-items:center;gap:0.35rem;"><input type="checkbox" id="zzpUren" checked> ' + T('zzp.uren','Urencriterium (1.225 uur)') + '</label>' +
      '<label style="display:flex;align-items:center;gap:0.35rem;"><input type="checkbox" id="zzpStart"> ' + T('zzp.start','Startersaftrek') + '</label></div>' +
      '<div id="zzpRes" style="display:none;margin-top:0.7rem;border:1px solid var(--line);border-radius:12px;padding:0.8rem 0.95rem;font-size:0.76rem;line-height:1.7;color:var(--muted);"></div></div></div>' +
      // Borden: dezelfde werkbord-module als de zaken gebruiken (shared/borden.js)
      '<div style="margin-top:1rem;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:1rem 1.1rem;">' +
      '<div style="font-size:0.6rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--gold);">📋 ' + T('bd2.h','Borden · uw projecten') + '</div>' +
      '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.3rem;line-height:1.5;">' + T('bd2.s','Hetzelfde werkbord als in de RTG-bedrijfsapps: lijsten en kaarten voor uw eigen projecten en administratie.') + '</div>' +
      '<div id="lidBordenWrap"></div></div>';
    if (window.BordenUI){
      if (lidBordenUI) lidBordenUI = null; // het element is zojuist opnieuw opgebouwd
      lidBordenUI = BordenUI.mount($('#lidBordenWrap'), {
        laad: () => API.call('/member/borden'),
        doe: b => API.call('/member/bord', b),
        teamleden: null,
        kanBeheren: () => true,
        T, toast
      });
    }
    const go = $('#bhGo');
    if (go) go.addEventListener('click', async () => {
      const q = $('#bhQ').value.trim();
      if (!q) return;
      try { localStorage.setItem('rtg_boekland', $('#bhLand').value); } catch(e){}
      const box = $('#bhA');
      box.style.display = 'block';
      box.textContent = '…';
      try { box.textContent = (await API.call('/member/accountant', { question: q, land: $('#bhLand').value })).answer; }
      catch(e){ box.textContent = e.message; }
    });
    const qi = $('#bhQ');
    if (qi) qi.addEventListener('keydown', e => { if (e.key === 'Enter' && go) go.click(); });
    const zg = $('#zzpGo');
    if (zg) zg.addEventListener('click', async () => {
      const winst = Math.round(Number($('#zzpWinst').value));
      const box = $('#zzpRes');
      if (!(winst > 0)) { toast(T('zzp.leeg','Vul eerst uw verwachte jaarwinst in.')); return; }
      try { localStorage.setItem('rtg_boekland', $('#bhLand').value); } catch(e){}
      box.style.display = 'block';
      box.textContent = '…';
      try {
        const d = await API.call('/member/zzp', { winst, land: $('#bhLand').value, urencriterium: $('#zzpUren').checked, starter: $('#zzpStart').checked });
        const rij = (l, v, sterk) => '<div style="display:flex;justify-content:space-between;gap:0.8rem;"><span>' + l + '</span><span style="flex-shrink:0;' + (sterk ? 'color:var(--txt);font-weight:600;' : '') + '">' + v + '</span></div>';
        box.innerHTML =
          '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);margin-bottom:0.35rem;">' + d.regime + ' · ' + d.landNaam + '</div>' +
          rij(T('zzp.winst','Jaarwinst'), eur(d.winst)) +
          d.posten.map(p2 => rij(p2.label, (p2.bedrag < 0 ? '- ' : '') + eur(Math.abs(p2.bedrag)))).join('') +
          rij(T('zzp.belastbaar','Belastbaar (na aftrek)'), eur(d.belastbaar)) +
          rij(T('zzp.teBetalen','Te betalen (indicatie)'), eur(d.belasting), true) +
          rij(T('zzp.netto','Netto over'), eur(d.netto), true) +
          '<div style="margin-top:0.55rem;padding-top:0.55rem;border-top:1px solid var(--line);color:var(--gold);">💡 ' + T('zzp.reserveer','Zet ~') + d.reserveerPct + '% ' + T('zzp.opzij','opzij: ongeveer') + ' ' + eur(d.perMaand) + ' ' + T('zzp.pm','per maand') + '.</div>' +
          '<div style="margin-top:0.5rem;">' + d.regels.map(r => '• ' + r).join('<br>') + '</div>' +
          '<div style="margin-top:0.5rem;font-size:0.64rem;color:var(--soft);">' + T('zzp.disc','Indicatie op jaarbasis; dit is voorlichting, geen bindend fiscaal advies.') + '</div>';
      } catch(e){ box.textContent = e.message; }
    });
  }

  /* ---------- AI ---------- */

  const chatHistory = [];

  function aiOpener(){
    const first = user.full.split(' ')[0];
    const lines = [ (lang()==='en'
      ? ('Good day' + (user.tier === 'business' ? '.' : ', ' + first + '.') + ' Your journey to ' + trip.dest + ' begins in ' + trip.days + ' days. I have already thought ahead:')
      : ('Goedendag' + (user.tier === 'business' ? '.' : ', ' + first + '.') + ' Uw reis naar ' + trip.dest + ' begint over ' + trip.days + ' dagen. Ik heb alvast vooruitgedacht:')) ];
    const open = invoices.filter(i => i.status === 'open');
    if (open.length){
      const sum = open.reduce((s,i) => s + i.netto + i.bijdrage, 0);
      lines.push(lang()==='en'
        ? ('• There ' + (open.length === 1 ? 'is 1 payment' : 'are ' + open.length + ' payments') + ' still open (' + eur(sum) + '). One tap in Payments and it is done.')
        : ('• Er ' + (open.length === 1 ? 'staat nog 1 betaling' : 'staan nog ' + open.length + ' betalingen') + ' open (' + eur(sum) + '). Eén tik in Betalen en het is geregeld.'));
    }
    const pending = trip.items.find(i => i.status === 'req');
    if (pending) lines.push(lang()==='en'
      ? ('• ' + pending.title.replace('Diner, ', 'Your table at ') + ' is still being requested; I am watching for the confirmation.')
      : ('• ' + pending.title.replace('Diner, ', 'Uw tafel bij ') + ' is nog in aanvraag; ik bewaak de bevestiging.'));
    lines.push(T('ai.opener.plan','• Zal ik vast een paklijst en een dagplan voor 14 oktober klaarzetten? Eén "ja" is genoeg.'));
    return lines.join('\n');
  }

  function aiAnswer(q){
    const l = q.toLowerCase().trim();
    if (/^(ja|graag|ja graag|doe maar|prima|goed|regel het|ja, regel het|yes|please|go ahead|sure|arrange it)\b/.test(l))
      return T('ai.a.yes','Geregeld. De paklijst staat klaar (lichte kleding, zwemkleding, zonnebrand, lichte trui voor de avond) en het dagplan voor 20 juli is ingepland: 10:00 boot naar Formentera, lunch aan boord, 21:00 tafel bij Sal de Mar.\n\nIk bewaak nu de bevestiging van Sal de Mar. U hoeft niets te doen.');
    if (l.includes('inpak') || l.includes('paklijst') || l.includes('pack'))
      return T('ai.a.pack','Voor Ibiza in juli (25-31°C, zonnig):\n• Lichte kleding + zwemkleding\n• Zonnebrand en een hoed\n• Nette outfit voor Sal de Mar\n• Lichte trui voor de avond\n\nZal ik er een afvinklijst van maken?');
    if (l.includes('visum') || l.includes('paspoort') || l.includes('visa') || l.includes('passport'))
      return T('ai.a.visa','Voor Ibiza (Spanje, EU) heeft u geen visum nodig; een geldige ID-kaart of paspoort volstaat. Ik zet uw boekingsbevestigingen klaar in de app.');
    if (l.includes('weer') || l.includes('weather'))
      return T('ai.a.weather','Ibiza medio juli: 25-31°C, veel zon en warme avonden. Zal ik de boot naar Formentera vroeg in de ochtend laten aanhouden?');
    if (l.includes('plan') || l.includes('dag') || l.includes('day'))
      return T('ai.a.plan','Voorstel voor 20 juli:\n• 10:00 boot naar Formentera\n• 13:00 lunch aan boord\n• 18:00 borrel bij Sunset Ibiza\n• 21:00 diner bij Sal de Mar\n\nZal ik de strandlunch reserveren?');
    if (l.includes('restaurant') || l.includes('diner') || l.includes('eten') || l.includes('dinner') || l.includes('eat'))
      return T('ai.a.rest','Uw tafel bij Sal de Mar (19 jul, 21:00) is in aanvraag, bevestiging volgt doorgaans binnen 48 uur. Wilt u een reservelijst? Ik denk aan een strandrestaurant in Cala Jondal.');
    return T('ai.a.default','Daar kom ik vandaag nog op terug. Ik kan alvast helpen met de paklijst, documenten, het weer of een dagplan, zeg het maar.');
  }

  function bubble(text, who){
    const el = document.createElement('div');
    el.className = 'bubble ' + who;
    el.textContent = text;
    $('#chat').appendChild(el);
    $('#content').scrollTop = $('#content').scrollHeight;
    return el;
  }

  const escHtml = s => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

  // een voorstel van de Butler ("even checken...") krijgt echte knoppen
  function voorstelChips(aan){
    const box = $('#chips'); if (!box) return;
    if (aan){
      box.dataset.voorstel = '1';
      box.innerHTML = '<button class="chip" id="flJa">✓ ' + T('fl.ja','Ja, doe maar') + '</button>' +
        '<button class="chip" id="flNee">✕ ' + T('fl.nee','Nee, laat maar') + '</button>';
      $('#flJa').addEventListener('click', () => ask('ja'));
      $('#flNee').addEventListener('click', () => ask('nee'));
      return;
    }
    if (!box.dataset.voorstel) return;
    delete box.dataset.voorstel;
    if (user.account && user.tier !== 'guest'){
      box.innerHTML = '<button class="chip" id="aiBetaalChip">' + FID_MINI + T('dp.aichip','Betaal een partner') + '</button>';
      const bc = $('#aiBetaalChip'); if (bc) bc.addEventListener('click', () => kiesPartnerEnBetaal('ai'));
    } else standaardChips();
  }

  async function ask(qIn){
    const q = String(qIn || '').trim();
    if (!q) return;
    // eerst de Butler-motor: geheugen, seintjes, zoeken en echt regelen
    // (reserveren, het 24-uursblok, een Tik, betaalverzoeken); pakt hij de
    // vraag niet, dan neemt de gewone gesprekslaag het over
    if (API.live){
      let r = null;
      try { r = await API.call('/fluister', { q }); } catch(e){}
      if (r && r.pakte){
        bubble(q, 'user');
        bubble(r.antwoord, 'ai');
        if (!user.account){ chatHistory.push({role:'user', content:q}); chatHistory.push({role:'assistant', content:r.antwoord}); }
        if (r.gedaan) toast('🤵 ' + T('fl.gedaan','Rahul heeft het geregeld.'));
        voorstelChips(!!r.voorstel);
        if (typeof renderFluister === 'function') renderFluister();
        $('#content').scrollTop = $('#content').scrollHeight;
        return;
      }
    }
    if (user.account){ chatSend(q); return; }   // echte accounts: gekoppeld gesprek
    bubble(q, 'user');
    chatHistory.push({role:'user', content:q});
    if (API.live){
      const pending = bubble('…', 'ai');
      API.call('/ai', {messages: chatHistory})
        .then(d => { pending.textContent = d.reply; chatHistory.push({role:'assistant', content:d.reply}); })
        .catch(() => { const r = aiAnswer(q); pending.textContent = r; chatHistory.push({role:'assistant', content:r}); })
        .finally(() => { $('#content').scrollTop = $('#content').scrollHeight; });
    } else {
      setTimeout(() => { const r = aiAnswer(q); bubble(r, 'ai'); chatHistory.push({role:'assistant', content:r}); }, 500);
    }
  }

  /* ---------- doorlopend gesprek in de app voor echte accounts ---------- */
  function renderChatMsgs(msgs, concierge){
    const chat = $('#chat');
    if (!msgs.length){
      chat.innerHTML = '';
      bubble(concierge ? T('chat.concierge.hi','Goedendag. Schrijf ons hier in de app; uw concierge helpt u persoonlijk.') : aiOpener(), 'ai');
      return;
    }
    // Met Util.el: de berichttekst (van de gast of de concierge) gaat structureel
    // als tekstknoop, dus altijd veilig ge-escaped, geen escHtml-discipline nodig.
    const E = Util.el;
    const bubbels = msgs.map(m => E('div', { class: 'bubble ' + (m.from === 'member' ? 'user' : 'ai') },
      null,
      m.text));
    const last = msgs[msgs.length - 1];
    if (concierge && last && last.from === 'member'){
      bubbels.push(E('div', { class: 'bubble ai pending' }, T('chat.concierge.pending', 'Uw concierge is ingelicht en reageert zo.')));
    }
    Util.vervang(chat, bubbels);
    $('#content').scrollTop = $('#content').scrollHeight;
  }
  async function renderChat(){
    const concierge = user.tier !== 'rtg';
    $('#aiTitle').textContent = concierge ? T('chat.concierge.title','Uw concierge.') : T('ai.title.rtg','Rahul.');
    const deck = document.querySelector('.view[data-view="ai"] .sub');
    if (deck) deck.textContent = concierge
      ? T('chat.concierge.deck','Uw persoonlijke concierge, in uw beveiligde app-lijn. Eén doorlopend gesprek.')
      : T('chat.butler.deck','Rahul, in uw beveiligde app-lijn. Eén doorlopend gesprek.');
    // Vaste snelactie: alles regelen én afrekenen kan hier. Face ID, direct naar de partner.
    if (user.tier !== 'guest'){
      $('#chips').innerHTML = '<button class="chip" id="aiBetaalChip">' + FID_MINI + T('dp.aichip','Betaal een partner') + '</button>';
      const bc = $('#aiBetaalChip'); if (bc) bc.addEventListener('click', () => kiesPartnerEnBetaal('ai'));
    } else { $('#chips').innerHTML = ''; }
    if (!API.live){ $('#chat').innerHTML = ''; bubble(aiOpener(), 'ai'); return; }
    try { const d = await API.call('/chat/history'); renderChatMsgs(d.messages, concierge); }
    catch (e) { $('#chat').innerHTML = ''; bubble(aiOpener(), 'ai'); }
  }
  // Kies een partner en reken direct met Face ID af (vanuit de AI/concierge).
  function kiesPartnerEnBetaal(bron){
    const lijst = (suppliers || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (!lijst.length){ toast(T('dp.geenpartner','Nog geen partners om aan te betalen.')); return; }
    let ov = document.getElementById('dp-pick'); if (ov) ov.remove();
    ov = document.createElement('div'); ov.id = 'dp-pick';
    ov.style.cssText = 'position:fixed;inset:0;z-index:130;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center;';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    ov.innerHTML = '<div style="width:100%;max-width:460px;max-height:80vh;overflow-y:auto;background:var(--bg);border-radius:20px 20px 0 0;border:1px solid var(--line);padding:1.1rem 1.2rem 1.4rem;">' +
      '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.8rem;"><b style="font-size:1rem;">' + T('dp.kiespartner','Aan welke partner?') + '</b><button id="dpPickX" style="margin-left:auto;background:none;border:none;color:var(--muted);font-size:1.1rem;cursor:pointer;">✕</button></div>' +
      lijst.map(s => '<button class="js-dppick" data-code="' + s.code + '" style="display:flex;align-items:center;gap:0.6rem;width:100%;text-align:left;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.8rem;margin-bottom:0.4rem;color:var(--txt);font-family:inherit;cursor:pointer;"><span style="font-size:1.1rem;">' + (s.icon || '🏛️') + '</span><span><b style="font-size:0.86rem;">' + escT(s.name) + '</b><span style="display:block;font-size:0.68rem;color:var(--soft);">' + escT(s.typeLabel || '') + (s.city ? ' · ' + escT(s.city) : '') + '</span></span></button>').join('') +
      '</div>';
    ov.querySelector('#dpPickX').addEventListener('click', () => ov.remove());
    ov.querySelectorAll('.js-dppick').forEach(b => b.addEventListener('click', () => {
      const s = lijst.find(x => x.code === b.dataset.code); ov.remove();
      betaalPartner(s.code, s.name, { bron });
    }));
  }
  async function chatSend(q){
    if (!API.live){ bubble(q, 'user'); setTimeout(() => bubble(aiAnswer(q), 'ai'), 400); return; }
    try { const d = await API.call('/chat/send', { text: q }); renderChatMsgs(d.messages, user.tier !== 'rtg'); }
    catch (e) { toast(e.message || 'Versturen mislukt.'); }
  }

  function standaardChips(){
    const chips = lang()==='en'
      ? ['Yes, arrange it','What do you know about me?','What should I pack?','Plan my day','Arrange a restaurant']
      : ['Ja, regel het','Wat weet je over mij?','Wat moet ik inpakken?','Plan mijn dag','Regel een restaurant'];
    $('#chips').innerHTML = chips.map(c => '<button class="chip">' + c + '</button>').join('');
    document.querySelectorAll('#chips .chip').forEach(c => c.addEventListener('click', () => ask(c.textContent)));
  }
  function renderAI(){
    if (user.account){ renderChat(); return; }
    $('#aiTitle').textContent = user.tier === 'rtg' ? T('ai.title.rtg','Rahul.') : user.tier === 'lifestyle' ? T('ai.title.life','Uw AI.') : T('ai.title.biz','Uw uitvoerende AI.');
    $('#chat').innerHTML = '';
    chatHistory.length = 0;
    const opener = aiOpener();
    bubble(opener, 'ai');
    chatHistory.push({role:'assistant', content:opener});
    standaardChips();
  }
  $('#askBtn').addEventListener('click', () => { ask($('#askInput').value); $('#askInput').value = ''; });
  $('#askInput').addEventListener('keydown', e => { if (e.key === 'Enter'){ ask(e.target.value); e.target.value = ''; } });
  // spreek uw vraag in: de gedeelde spraakmotor luistert, De Butler doet de rest
  if (window.Spraak) Spraak.koppel($('#askMic'), {
    opTekst: zin => { $('#askInput').value = zin; ask(zin); $('#askInput').value = ''; },
    nietVerstaan: () => toast(T('fl.michoor','Ik kon u niet verstaan; probeer het nog eens of typ het gewoon.')),
    kanNiet: () => toast(T('fl.micniet','Spraak werkt niet in deze browser; typen kan altijd.'))
  });

  /* ---------- RTG Zakelijk: het professionele netwerk van de Business Pass ---------- */
  let zakView = 'feed';
  function zakOpen(){ $('#zak-scrim').classList.add('open'); $('#zak-sheet').classList.add('open'); zakRender(); }
  function zakDicht(){ $('#zak-scrim').classList.remove('open'); $('#zak-sheet').classList.remove('open'); }
  $('#zakClose').addEventListener('click', zakDicht);
  $('#zak-scrim').addEventListener('click', zakDicht);
  document.querySelectorAll('.zak-tab').forEach(b => b.addEventListener('click', () => {
    zakView = b.dataset.zaktab;
    document.querySelectorAll('.zak-tab').forEach(x => x.classList.toggle('active', x === b));
    zakRender();
  }));

  const zakStatusKnop = (p) =>
    p.status === 'verbonden' ? '<span class="zak-open" style="color:var(--gold);border-color:var(--gold);">✓ ' + T('zak.verbonden','Verbonden') + '</span>'
    : p.status === 'aangevraagd' ? '<span class="zak-chip">' + T('zak.wacht','Aangevraagd') + '</span>'
    : p.status === 'wacht-op-u' ? '<span class="zak-chip mijn">' + T('zak.wachtu','Accepteer in Contacten') + '</span>'
    : '<button class="go js-zcon" data-key="' + escT(p.key) + '" style="padding:0.25rem 0.7rem;font-size:0.68rem;">+ ' + T('zak.verbind','Verbind') + '</button>';

  function zakProfielKaart(p){
    const skills = (p.vaardigheden || []).map(v =>
      '<span class="zak-chip' + (p.status === 'verbonden' ? ' klik js-zaanb' : '') + (v.doorMij ? ' mijn' : '') + '"' +
      ' data-key="' + escT(p.key) + '" data-v="' + escT(v.naam) + '">' + escT(v.naam) + (v.aanbevolen ? ' · ' + v.aanbevolen + ' 👍' : '') + '</span>').join('');
    return '<div class="zak-kaart">' +
      '<div style="display:flex;align-items:center;gap:0.6rem;">' +
        '<div class="grow-min"><b>' + escT(p.naam) + '</b>' +
        (p.pas ? ' <span style="font-size:0.56rem;letter-spacing:0.08em;color:var(--gold);border:1px solid var(--gold);border-radius:999px;padding:0.08rem 0.4rem;vertical-align:middle;">' + (TIER_LABEL[p.pas] || p.pas) + '</span>' : '') +
        (p.openVoorWerk ? ' <span class="zak-open">' + T('zak.open','open voor werk') + '</span>' : '') +
        '<div style="font-size:0.74rem;color:var(--muted);">' + escT(p.kop) +
        (p.sector ? ' · ' + escT(p.sector) : '') + (p.plaats ? ' · ' + escT(p.plaats) : '') + '</div>' +
        '<div style="font-size:0.62rem;color:var(--soft);">' + T('zak.codenaam','codenaam') + ' ' + escT(p.codenaam) +
        (p.gedeeld ? ' · ' + p.gedeeld + ' ' + T('zak.gedeeld','gedeelde connectie(s)') + (p.gedeeldNamen && p.gedeeldNamen.length ? ' (' + p.gedeeldNamen.map(escT).join(', ') + ')' : '') : '') + '</div></div>' +
        zakStatusKnop(p) + '</div>' +
      (p.bio ? '<div style="font-size:0.76rem;color:var(--muted);margin-top:0.45rem;line-height:1.5;">' + escT(p.bio) + '</div>' : '') +
      ((p.ervaring || []).length ? '<div style="font-size:0.7rem;color:var(--soft);margin-top:0.4rem;">' + p.ervaring.map(escT).join('<br>') + '</div>' : '') +
      (skills ? '<div style="margin-top:0.35rem;">' + skills +
        (p.status === 'verbonden' ? '<div style="font-size:0.6rem;color:var(--soft);margin-top:0.25rem;">' + T('zak.tikskill','Tik een vaardigheid aan om hem aan te bevelen.') + '</div>' : '') + '</div>' : '') +
      '</div>';
  }

  async function zakRender(){
    const body = $('#zakBody');
    body.innerHTML = '<div style="color:var(--soft);font-size:0.8rem;padding:1rem 0;">…</div>';
    try {
      if (zakView === 'feed'){
        const d = await API.call('/zakelijk/feed');
        body.innerHTML =
          '<div class="zak-kaart"><textarea id="zakPostTekst" placeholder="' + T('zak.postph','Deel een inzicht, vraag of mijlpaal met het netwerk…') + '" style="width:100%;min-height:64px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.6rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.8rem;"></textarea>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.45rem;">' +
          '<span style="font-size:0.62rem;color:var(--soft);">' + (d.mijnProfiel ? T('zak.alsprof','U post onder uw professionele naam.') : T('zak.eerstprof','Maak eerst uw profiel aan (tab Mijn profiel).')) + '</span>' +
          '<button class="go" id="zakPost" style="padding:0.35rem 0.9rem;font-size:0.7rem;">' + T('zak.plaats','Plaats') + '</button></div></div>' +
          (d.posts.length ? d.posts.map(x =>
            '<div class="zak-kaart"><div style="display:flex;gap:0.5rem;align-items:baseline;"><b style="font-size:0.82rem;">' + escT(x.naam) + '</b>' +
            '<span style="font-size:0.64rem;color:var(--soft);">' + escT(x.kop) + ' · ' + timeAgo(x.at) + '</span>' +
            (x.openVoorWerk ? '<span class="zak-open">' + T('zak.open','open voor werk') + '</span>' : '') + '</div>' +
            '<div style="font-size:0.8rem;line-height:1.55;margin-top:0.35rem;white-space:pre-wrap;">' + msgHTML(x.tekst, x.lang) + '</div>' +
            '<div style="display:flex;gap:0.9rem;margin-top:0.5rem;font-size:0.7rem;color:var(--muted);">' +
            '<button class="js-zlike" data-id="' + x.id + '" style="background:none;border:none;color:' + (x.mijnLike ? 'var(--gold)' : 'var(--muted)') + ';font-family:inherit;cursor:pointer;">👍 ' + x.likes + '</button>' +
            '<span>💬 ' + x.reactiesTotaal + '</span></div>' +
            x.reacties.map(r => '<div style="font-size:0.72rem;margin-top:0.35rem;color:var(--muted);"><b style="color:var(--txt);">' + escT(r.naam) + '</b> ' + msgHTML(r.tekst, r.lang) + '</div>').join('') +
            '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input class="js-zretxt" data-id="' + x.id + '" placeholder="' + T('zak.reageer','Reageer…') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:0.4rem 0.75rem;color:var(--txt);font-family:inherit;font-size:0.72rem;">' +
            '<button class="js-zre" data-id="' + x.id + '" style="background:none;border:1px solid var(--line);border-radius:999px;padding:0.4rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.68rem;cursor:pointer;">↩</button></div></div>').join('')
          : '<div class="zak-kaart" style="color:var(--soft);font-size:0.78rem;">' + T('zak.leeg','Nog geen posts. Wees de eerste: deel waar u aan werkt.') + '</div>');
        $('#zakPost').addEventListener('click', async () => {
          try { await API.call('/zakelijk/post', { tekst: $('#zakPostTekst').value }); zakRender(); }
          catch(e){ if (e.status === 409){ zakView = 'profiel'; document.querySelectorAll('.zak-tab').forEach(x => x.classList.toggle('active', x.dataset.zaktab === 'profiel')); zakRender(); } toast(e.message); }
        });
        body.querySelectorAll('.js-zlike').forEach(b => b.addEventListener('click', async () => {
          try { await API.call('/zakelijk/like', { id: b.dataset.id }); zakRender(); } catch(e){ toast(e.message); }
        }));
        body.querySelectorAll('.js-zre').forEach(b => b.addEventListener('click', async () => {
          const inp = body.querySelector('.js-zretxt[data-id="' + b.dataset.id + '"]');
          try { await API.call('/zakelijk/reactie', { id: b.dataset.id, tekst: inp.value }); zakRender(); } catch(e){ toast(e.message); }
        }));
        hydrateMsgs(body); // zakelijke feed leest per kijker in de eigen taal
      } else if (zakView === 'netwerk'){
        const zoek = async (q) => {
          const d = await API.call('/zakelijk/gids', { q, openVoorWerk: $('#zakFilterWerk') ? $('#zakFilterWerk').checked : false });
          $('#zakGids').innerHTML = d.resultaten.length ? d.resultaten.map(zakProfielKaart).join('')
            : '<div class="zak-kaart" style="color:var(--soft);font-size:0.78rem;">' + T('zak.geen','Geen profielen gevonden. Leden verschijnen hier zodra ze hun zakelijke profiel aanzetten.') + '</div>';
          $('#zakGids').querySelectorAll('.js-zcon').forEach(b => b.addEventListener('click', async () => {
            try { const r = await API.call('/zakelijk/connect', { key: b.dataset.key }); toast(r.status === 'aangevraagd' ? T('zak.gevraagd','Verzoek gestuurd. De ander accepteert in Contacten.') : r.status); zoek($('#zakZoek').value); }
            catch(e){ toast(e.message); }
          }));
          $('#zakGids').querySelectorAll('.js-zaanb').forEach(ch => ch.addEventListener('click', async () => {
            try { const r = await API.call('/zakelijk/aanbevelen', { key: ch.dataset.key, vaardigheid: ch.dataset.v });
              toast(r.aanbevolen ? T('zak.aanbevolen','Aanbevolen') + ': ' + ch.dataset.v : T('zak.ingetrokken','Aanbeveling ingetrokken.')); zoek($('#zakZoek').value); }
            catch(e){ toast(e.message); }
          }));
        };
        body.innerHTML = '<div style="display:flex;gap:0.4rem;margin-top:0.6rem;">' +
          '<input id="zakZoek" placeholder="' + T('zak.zoekph','Zoek op naam, sector of vaardigheid…') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:0.5rem 0.85rem;color:var(--txt);font-family:inherit;font-size:0.76rem;">' +
          '<button class="go" id="zakZoekGo" style="padding:0.35rem 0.9rem;font-size:0.7rem;">' + T('zak.zoek','Zoek') + '</button></div>' +
          '<label style="display:flex;align-items:center;gap:0.4rem;font-size:0.7rem;color:var(--muted);margin-top:0.5rem;"><input type="checkbox" id="zakFilterWerk"> ' + T('zak.filterwerk','Alleen leden die open voor werk zijn') + '</label>' +
          '<div id="zakGids"></div>';
        $('#zakZoekGo').addEventListener('click', () => zoek($('#zakZoek').value));
        $('#zakZoek').addEventListener('keydown', e => { if (e.key === 'Enter') zoek(e.target.value); });
        $('#zakFilterWerk').addEventListener('change', () => zoek($('#zakZoek').value));
        zoek('');
      } else if (zakView === 'kansen'){
        const SOORT_ICO = { opdracht:'🛠️', samenwerking:'🤝', vacature:'📋', investering:'💶', anders:'✨' };
        const laad = async () => {
          const d = await API.call('/zakelijk/kansen', { q: $('#kansZoek').value, soort: $('#kansSoortF').value || undefined });
          const kaart = (k) => '<div class="zak-kaart">' +
            '<div style="display:flex;gap:0.5rem;align-items:baseline;"><span>' + (SOORT_ICO[k.soort] || k.icon || '✨') + '</span>' +
            '<div class="grow-min"><b style="font-size:0.84rem;">' + escT(k.titel) + '</b>' +
            (!k.open ? ' <span class="zak-chip">' + T('zak.k.dicht','vervuld') + '</span>' : '') +
            '<div style="font-size:0.66rem;color:var(--soft);">' +
            (k.bron === 'partner' ? T('zak.k.partner','Vacature bij RTG-partner') : escT(k.naam) + (k.kop ? ' · ' + escT(k.kop) : '')) +
            (k.plaats ? ' · ' + escT(k.plaats) : '') + (k.land ? ' · ' + escT(k.land) : '') + ' · ' + timeAgo(k.at) + '</div></div></div>' +
            (k.omschrijving ? '<div style="font-size:0.76rem;color:var(--muted);line-height:1.5;margin-top:0.35rem;">' + escT(k.omschrijving) + '</div>' : '') +
            ((k.skills || []).length ? '<div style="margin-top:0.3rem;">' + k.skills.map(s => '<span class="zak-chip">' + escT(s) + '</span>').join('') + '</div>' : '') +
            (k.bron === 'partner'
              ? '<div style="font-size:0.64rem;color:var(--soft);margin-top:0.45rem;">' + T('zak.k.sollhint','Solliciteren gaat met uw RTG-cv via Werk & vacatures op het thuisscherm.') + '</div>'
              : (k.vanMij
                ? ((k.reacties || []).map(r => '<div style="font-size:0.72rem;margin-top:0.35rem;color:var(--muted);"><b style="color:var(--txt);">' + escT(r.naam) + '</b> <span style="color:var(--soft);">(' + escT(r.kop || '') + ')</span> ' + escT(r.tekst) + '</div>').join('') +
                  (k.open ? '<button class="js-ksluit" data-id="' + k.id + '" style="margin-top:0.5rem;background:none;border:1px solid var(--line);border-radius:999px;padding:0.35rem 0.8rem;color:var(--muted);font-family:inherit;font-size:0.66rem;cursor:pointer;">✓ ' + T('zak.k.sluit','Markeer als vervuld') + '</button>' : ''))
                : (k.open
                  ? '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input class="js-kretxt" data-id="' + k.id + '" placeholder="' + T('zak.k.reageerph','Reageer met wat u kunt betekenen…') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:0.4rem 0.75rem;color:var(--txt);font-family:inherit;font-size:0.72rem;">' +
                    '<button class="js-kre" data-id="' + k.id + '" style="background:none;border:1px solid var(--line);border-radius:999px;padding:0.4rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.68rem;cursor:pointer;">↩</button></div>' +
                    (k.reactiesTotaal ? '<div style="font-size:0.62rem;color:var(--soft);margin-top:0.3rem;">' + k.reactiesTotaal + ' ' + T('zak.k.reacties','reactie(s)') + '</div>' : '')
                  : ''))) +
            '</div>';
          const alle = (d.kansen || []).concat(d.partnerVacatures || []);
          $('#kansLijst').innerHTML = alle.length ? alle.map(kaart).join('')
            : '<div class="zak-kaart" style="color:var(--soft);font-size:0.78rem;">' + T('zak.k.leeg','Nog geen kansen. Plaats de eerste: een opdracht, samenwerking of investeringsvraag.') + '</div>';
          $('#kansLijst').querySelectorAll('.js-kre').forEach(b => b.addEventListener('click', async () => {
            const inp = $('#kansLijst').querySelector('.js-kretxt[data-id="' + b.dataset.id + '"]');
            try { await API.call('/zakelijk/kans/reageer', { id: b.dataset.id, tekst: inp.value }); toast(T('zak.k.gereageerd','Reactie geplaatst; de plaatser ziet hem direct.')); laad(); }
            catch(e){ toast(e.message); }
          }));
          $('#kansLijst').querySelectorAll('.js-ksluit').forEach(b => b.addEventListener('click', async () => {
            try { await API.call('/zakelijk/kans/sluit', { id: b.dataset.id }); laad(); } catch(e){ toast(e.message); }
          }));
        };
        const opt = (v, l) => '<option value="' + v + '">' + l + '</option>';
        body.innerHTML =
          '<div class="zak-kaart"><b style="font-size:0.8rem;">' + T('zak.k.nieuw','Plaats een kans') + '</b>' +
          '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;">' +
          '<select id="kansSoort" aria-label="' + T('zak.k.soort','Soort kans') + '" style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.5rem;color:var(--txt);font-family:inherit;font-size:0.74rem;">' +
          opt('opdracht','🛠️ ' + T('zak.k.opdracht','Opdracht')) + opt('samenwerking','🤝 ' + T('zak.k.samen','Samenwerking')) +
          opt('vacature','📋 ' + T('zak.k.vac','Vacature')) + opt('investering','💶 ' + T('zak.k.inv','Investering')) + opt('anders','✨ ' + T('zak.k.anders','Anders')) + '</select>' +
          '<input id="kansTitel" placeholder="' + T('zak.k.titelph','Titel, bijv. Fotograaf gezocht voor merkcampagne') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.6rem;color:var(--txt);font-family:inherit;font-size:0.74rem;"></div>' +
          '<textarea id="kansOms" placeholder="' + T('zak.k.omsph','Omschrijf kort wat u zoekt of biedt…') + '" style="width:100%;min-height:52px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);font-family:inherit;font-size:0.74rem;margin-top:0.4rem;"></textarea>' +
          '<div style="display:flex;gap:0.4rem;margin-top:0.4rem;align-items:center;">' +
          '<input id="kansPlaats" placeholder="' + T('zak.k.plaatsph','Plaats (optioneel)') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.6rem;color:var(--txt);font-family:inherit;font-size:0.74rem;">' +
          '<button class="go" id="kansPlaatsBtn" style="padding:0.4rem 0.95rem;font-size:0.7rem;">' + T('zak.plaats','Plaats') + '</button></div></div>' +
          '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;">' +
          '<input id="kansZoek" placeholder="' + T('zak.k.zoekph','Zoek in kansen en vacatures…') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:0.45rem 0.8rem;color:var(--txt);font-family:inherit;font-size:0.74rem;">' +
          '<select id="kansSoortF" aria-label="' + T('zak.k.filter','Filter op soort') + '" style="background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:0.4rem 0.5rem;color:var(--txt);font-family:inherit;font-size:0.7rem;">' +
          '<option value="">' + T('zak.k.alles','Alles') + '</option>' +
          opt('opdracht',T('zak.k.opdracht','Opdracht')) + opt('samenwerking',T('zak.k.samen','Samenwerking')) +
          opt('vacature',T('zak.k.vac','Vacature')) + opt('investering',T('zak.k.inv','Investering')) + '</select></div>' +
          '<div id="kansLijst"></div>';
        $('#kansPlaatsBtn').addEventListener('click', async () => {
          try {
            await API.call('/zakelijk/kans', { soort: $('#kansSoort').value, titel: $('#kansTitel').value,
              omschrijving: $('#kansOms').value, plaats: $('#kansPlaats').value });
            $('#kansTitel').value = ''; $('#kansOms').value = ''; toast(T('zak.k.geplaatst','Kans geplaatst.')); laad();
          } catch(e){
            if (e.status === 409){ zakView = 'profiel'; document.querySelectorAll('.zak-tab').forEach(x => x.classList.toggle('active', x.dataset.zaktab === 'profiel')); zakRender(); }
            toast(e.message);
          }
        });
        $('#kansZoek').addEventListener('keydown', e => { if (e.key === 'Enter') laad(); });
        $('#kansSoortF').addEventListener('change', laad);
        laad();
      } else {
        const d = await API.call('/zakelijk/profiel');
        const p = d.profiel || {};
        const veld = (label, id, val, ph) => '<div class="field"><label>' + label + '</label><input id="' + id + '" value="' + escT(val || '') + '"' + (ph ? ' placeholder="' + ph + '"' : '') + '></div>';
        body.innerHTML =
          '<div style="font-size:0.7rem;color:var(--soft);margin-top:0.6rem;line-height:1.5;">' + T('zak.uitleg','Uw profiel is pas zichtbaar in de gids als u het bewaart. U kiest zelf welke naam u zakelijk gebruikt.') + '</div>' +
          (d.cvSuggestie ? '<button id="zakUitCv" class="zak-chip klik" style="margin-top:0.5rem;">📄 ' + T('zak.uitcv','Vul aan vanuit mijn RTG-cv') + '</button>' : '') +
          veld(T('zak.naam','Professionele naam'), 'zakNaam', p.naam, T('zak.naamph','Standaard: uw codenaam')) +
          veld(T('zak.kop','Kop'), 'zakKop', p.kop, T('zak.kopph','Bijv. Oprichter, Fotograaf, Jurist')) +
          veld(T('zak.sector','Sector'), 'zakSector', p.sector) +
          veld(T('zak.plaats2','Plaats'), 'zakPlaats', p.plaats) +
          '<div class="field"><label>' + T('zak.bio','Over u') + '</label><textarea id="zakBio" style="min-height:70px;">' + escT(p.bio || '') + '</textarea></div>' +
          veld(T('zak.skills','Vaardigheden (komma’s)'), 'zakSkills', (p.vaardigheden || []).map(v => v.naam).join(', ')) +
          '<div class="field"><label>' + T('zak.erv','Ervaring (een regel per rol)') + '</label><textarea id="zakErv" style="min-height:80px;">' + escT((p.ervaring || []).join('\n')) + '</textarea></div>' +
          '<label style="display:flex;align-items:center;gap:0.4rem;font-size:0.76rem;margin-top:0.4rem;"><input type="checkbox" id="zakOpenWerk"' + (p.openVoorWerk ? ' checked' : '') + '> ' + T('zak.openwerk','Open voor werk of opdrachten') + '</label>' +
          '<label style="display:flex;align-items:center;gap:0.4rem;font-size:0.76rem;margin-top:0.3rem;"><input type="checkbox" id="zakZicht"' + (d.zichtbaar !== false ? ' checked' : '') + '> ' + T('zak.zicht','Zichtbaar in de gids') + '</label>' +
          '<button class="ms-order" id="zakBewaar" style="margin-top:0.8rem;width:100%;">' + T('zak.bewaar','Bewaar mijn profiel') + '</button>';
        if (d.cvSuggestie) $('#zakUitCv').addEventListener('click', () => {
          const s = d.cvSuggestie;
          if (!$('#zakKop').value && s.kop) $('#zakKop').value = s.kop;
          if (!$('#zakSkills').value && s.vaardigheden.length) $('#zakSkills').value = s.vaardigheden.join(', ');
          if (!$('#zakErv').value && s.ervaring.length) $('#zakErv').value = s.ervaring.join('\n');
          if (!$('#zakBio').value && s.bio) $('#zakBio').value = s.bio;
          toast(T('zak.cvok','Aangevuld vanuit uw cv. Controleer en bewaar.'));
        });
        $('#zakBewaar').addEventListener('click', async () => {
          try {
            await API.call('/zakelijk/profiel/zet', {
              naam: $('#zakNaam').value, kop: $('#zakKop').value, sector: $('#zakSector').value,
              plaats: $('#zakPlaats').value, bio: $('#zakBio').value,
              vaardigheden: $('#zakSkills').value.split(',').map(s => s.trim()).filter(Boolean),
              ervaring: $('#zakErv').value.split('\n').map(s => s.trim()).filter(Boolean),
              openVoorWerk: $('#zakOpenWerk').checked, zichtbaar: $('#zakZicht').checked
            });
            toast(T('zak.bewaard','Profiel bewaard.'));
          } catch(e){ toast(e.message); }
        });
      }
    } catch(e){
      body.innerHTML = '<div class="zak-kaart" style="color:var(--soft);font-size:0.78rem;">' + escT(e.message) + '</div>';
    }
  }

  /* ---------- interactieve AI-agenda in de backoffice + ballon op boBtn ---------- */
  let memberAgenda = null;
  function agendaBadgeLid(n){
    const btn = document.getElementById('boBtn'); if (!btn) return;
    btn.style.position = 'relative';
    let b = btn.querySelector('.ag-ballon');
    if (n > 0){
      if (!b){ b = document.createElement('span'); b.className = 'ag-ballon'; b.setAttribute('aria-label', T('ag.badge','afspraken op de agenda')); btn.appendChild(b); }
      b.textContent = n > 9 ? '9+' : String(n);
      b.style.cssText = 'position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#E0736A;color:#fff;font-size:10px;font-weight:700;line-height:16px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.4);';
    } else if (b) b.remove();
  }
  async function laadAgendaLid(){ if (!API.live || !API.token) return; try { memberAgenda = await API.call('/agenda/mijn-lijst', {}); } catch(e){ return; } agendaBadgeLid(memberAgenda.telling || 0); }
  function agendaToeLid(r){ if (r && r.items){ memberAgenda = r; agendaBadgeLid(r.telling || 0); } renderAgendaLid(); }
  function renderAgendaLid(){
    const el = document.getElementById('boAgendaCard'); if (!el) return;
    if (!memberAgenda){ el.innerHTML = '<div class="zak-kaart"><b style="font-size:0.8rem;">📅 ' + T('ag.titel','Agenda') + '</b><div class="fineprint">…</div></div>'; laadAgendaLid().then(renderAgendaLid); return; }
    const o = memberAgenda, items = o.items || [];
    const dagLbl = d => { try { return new Date(d+'T12:00:00').toLocaleDateString(lang()==='en'?'en-GB':'nl-NL',{weekday:'short',day:'numeric',month:'short'}); } catch(e){ return d; } };
    const inp = 'style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.55rem;color:var(--txt);font-family:inherit;font-size:0.76rem;"';
    let h = '<div class="zak-kaart"><b style="font-size:0.8rem;">📅 ' + T('ag.titel','Agenda') + (o.telling?' <span style="color:#E0736A;">('+o.telling+')</span>':'') + '</b>';
    h += items.length ? items.map(i => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;font-size:0.78rem;margin-top:0.45rem;opacity:'+(i.gedaan?'0.55':'1')+';"><span>'+(i.gedaan?'✓ ':'')+esc(i.titel)+'<span style="color:var(--muted);"> · '+esc(dagLbl(i.datum))+(i.tijd?' '+esc(i.tijd):'')+'</span></span><span style="white-space:nowrap;">'+(!i.gedaan?'<button class="ag-done" data-agdone="'+i.id+'" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.15rem 0.45rem;color:var(--txt);font-size:0.68rem;cursor:pointer;">✓</button> ':'')+'<button class="ag-del" data-agdel="'+i.id+'" style="background:none;border:none;color:var(--soft);cursor:pointer;">✕</button></span></div>').join('') : '<div class="fineprint" style="margin-top:0.4rem;">'+T('ag.leeg','Nog niets gepland. Typ het of laat de AI het inplannen.')+'</div>';
    h += '<div style="display:flex;gap:0.35rem;margin-top:0.6rem;flex-wrap:wrap;"><input id="agLidTitel" placeholder="'+T('ag.wat','Afspraak')+'" '+inp+' style="flex:1;min-width:7rem;"><input id="agLidDatum" type="date" '+inp+'><input id="agLidTijd" type="time" '+inp+'><button id="agLidAdd" style="background:var(--gold);border:none;border-radius:10px;padding:0.45rem 0.7rem;color:#000;font-weight:700;cursor:pointer;">+</button></div>';
    h += '<div style="margin-top:0.55rem;border-top:1px solid var(--line);padding-top:0.5rem;"><div style="font-size:0.68rem;color:var(--soft);margin-bottom:0.3rem;">✨ '+T('ag.aihint','Of typ het in gewone taal:')+'</div><div id="agLidAiOut"></div><div style="display:flex;gap:0.35rem;margin-top:0.35rem;"><input id="agLidAiIn" placeholder="'+T('ag.aiph','bijv. vergadering morgen om 15u')+'" '+inp+' style="flex:1;"><button id="agLidAiGo" style="background:var(--gold);border:none;border-radius:10px;padding:0.45rem 0.7rem;color:#000;font-weight:700;cursor:pointer;">'+T('ag.plan','Plan')+'</button></div></div>';
    h += '</div>';
    el.innerHTML = h;
    el.querySelectorAll('[data-agdone]').forEach(b => b.addEventListener('click', async () => { try { agendaToeLid(await API.call('/agenda/wijzig', { id: b.dataset.agdone, gedaan: true })); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-agdel]').forEach(b => b.addEventListener('click', async () => { try { agendaToeLid(await API.call('/agenda/verwijder', { id: b.dataset.agdel })); } catch(e){ toast(e.message); } }));
    const add = document.getElementById('agLidAdd'); if (add) add.addEventListener('click', async () => { const titel = document.getElementById('agLidTitel').value.trim(); const datum = document.getElementById('agLidDatum').value; if (!titel||!datum){ toast(T('ag.vulin','Vul een afspraak en datum in.')); return; } try { agendaToeLid(await API.call('/agenda/toevoegen', { titel, datum, tijd: document.getElementById('agLidTijd').value })); } catch(e){ toast(e.message); } });
    const aiGo = document.getElementById('agLidAiGo'); if (aiGo){ const doe = async () => { const opdracht = document.getElementById('agLidAiIn').value.trim(); if (!opdracht) return; const out = document.getElementById('agLidAiOut'); out.innerHTML = '<div class="fineprint">…</div>'; try { const r = await API.call('/agenda/ai', { opdracht }); out.innerHTML = '<div class="fineprint" style="color:'+(r.gedaan?'#7EE0A3':'var(--txt)')+';">'+esc(r.antwoord)+'</div>'; document.getElementById('agLidAiIn').value=''; agendaToeLid(r); } catch(e){ out.innerHTML = '<div class="fineprint" style="color:#E0736A;">'+esc(e.message)+'</div>'; } }; aiGo.addEventListener('click', doe); const i2 = document.getElementById('agLidAiIn'); if (i2) i2.addEventListener('keydown', e => { if (e.key==='Enter') doe(); }); }
  }

  /* ---------- mijn facturen: automatisch bij elke aankoop ---------- */
  let memberFacturen = null;
  async function laadFacturenLid(){ if (!API.live || !API.token) return; try { memberFacturen = await API.call('/facturen/mijn', {}); } catch(e){ return; } renderFacturenLid(); }
  function renderFacturenLid(){
    const el = document.getElementById('boFacturenCard'); if (!el) return;
    if (!memberFacturen){ laadFacturenLid(); return; }
    const o = memberFacturen, items = o.facturen || [];
    const inp = 'style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.55rem;color:var(--txt);font-family:inherit;font-size:0.76rem;"';
    let h = '<div class="zak-kaart"><b style="font-size:0.8rem;">🧾 ' + T('fact.mijn','Mijn facturen') + (o.telling?' <span style="color:var(--gold);">('+o.telling+')</span>':'') + '</b>';
    h += items.length
      ? '<div style="font-size:0.72rem;color:var(--muted);margin:0.3rem 0 0.4rem;">'+T('fact.besteed','Samen besteed')+': '+eur(o.besteed||0)+'</div>' + items.slice(0,30).map(f => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;font-size:0.78rem;margin-top:0.4rem;"><span>'+esc(f.verkoper)+'<span style="color:var(--muted);"> · '+esc(f.datum)+' · '+esc(f.nummer)+'</span></span><span style="white-space:nowrap;"><b>'+eur(f.totaal)+'</b> <button class="fact-pdf" data-fpdf="'+f.id+'" data-nr="'+esc(f.nummer)+'" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.15rem 0.45rem;color:var(--txt);font-size:0.68rem;cursor:pointer;">PDF</button></span></div>').join('')
      : '<div class="fineprint" style="margin-top:0.4rem;">'+T('fact.geenlid','U heeft nog geen facturen. Bij een aankoop op uw codenaam verschijnt hier automatisch de factuur.')+'</div>';
    h += '<div style="margin-top:0.55rem;border-top:1px solid var(--line);padding-top:0.5rem;"><div id="factLidAiOut"></div><div style="display:flex;gap:0.35rem;margin-top:0.35rem;"><input id="factLidAiIn" placeholder="'+T('fact.lidph','Vraag over uw facturen...')+'" '+inp+' style="flex:1;"><button id="factLidAiGo" style="background:var(--gold);border:none;border-radius:10px;padding:0.45rem 0.7rem;color:#000;font-weight:700;cursor:pointer;">'+T('fact.vraag','Vraag')+'</button></div></div>';
    h += '</div>';
    el.innerHTML = h;
    el.querySelectorAll('[data-fpdf]').forEach(b => b.addEventListener('click', () => downloadPdf('/facturen/pdf', { id: b.dataset.fpdf }, (b.dataset.nr||'factuur')+'.pdf')));
    renderKluisLid(el);
    const aiGo = document.getElementById('factLidAiGo'); if (aiGo){ const doe = async () => { const opdracht = document.getElementById('factLidAiIn').value.trim(); if (!opdracht) return; const out = document.getElementById('factLidAiOut'); out.innerHTML = '<div class="fineprint">…</div>'; try { const r = await API.call('/facturen/ai', { opdracht }); out.innerHTML = '<div class="fineprint" style="color:var(--txt);white-space:pre-wrap;">'+esc(r.antwoord)+'</div>'; document.getElementById('factLidAiIn').value=''; if (r.overzicht){ memberFacturen = r.overzicht; } } catch(e){ out.innerHTML = '<div class="fineprint" style="color:#E0736A;">'+esc(e.message)+'</div>'; } }; aiGo.addEventListener('click', doe); const i2 = document.getElementById('factLidAiIn'); if (i2) i2.addEventListener('keydown', e => { if (e.key==='Enter') doe(); }); }
  }

  /* ---------- de Toestelkluis: eigen kopieen op het eigen toestel ----------
     Elke download (factuur, overzicht) krijgt stil een kopie in de prive
     browseropslag van dit toestel; hier ziet het lid ze, opent of wist ze.
     De server houdt alleen het gezaghebbende record. */
  async function renderKluisLid(host){
    if (!window.Toestelkluis || !Toestelkluis.kan()) return;
    const items = await Toestelkluis.lijst();
    const kaart = document.createElement('div');
    kaart.className = 'zak-kaart';
    kaart.innerHTML = '<b style="font-size:0.8rem;">📱 ' + T('kluis.h','Op dit toestel') + '</b>' +
      '<div class="fineprint" style="margin-top:0.25rem;">' + T('kluis.d','Uw eigen kopieen, opgeslagen in de beveiligde opslag van deze browser. Alleen u kunt erbij; er gaat niets over de lijn.') + '</div>' +
      (items.length ? items.slice(0, 10).map(x =>
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;font-size:0.76rem;margin-top:0.4rem;">' +
          '<span>' + esc(x.naam) + '<span style="color:var(--muted);"> · ' + Math.max(1, Math.round(x.bytes/1024)) + ' kB</span></span>' +
          '<span style="white-space:nowrap;"><button class="js-klopen" data-k="' + esc(x.naam) + '" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.15rem 0.45rem;color:var(--txt);font-size:0.68rem;cursor:pointer;">' + T('kluis.open','Open') + '</button> ' +
          '<button class="js-klwis" data-k="' + esc(x.naam) + '" aria-label="' + T('kluis.wis','wis') + '" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.15rem 0.45rem;color:var(--soft);font-size:0.68rem;cursor:pointer;">✕</button></span></div>').join('')
        : '<div class="fineprint" style="margin-top:0.4rem;">' + T('kluis.leeg','Nog leeg. Download een factuur of overzicht en uw kopie verschijnt hier vanzelf.') + '</div>');
    host.appendChild(kaart);
    kaart.querySelectorAll('.js-klopen').forEach(b => b.addEventListener('click', async () => {
      const f = await Toestelkluis.haal(b.dataset.k); if (!f) return;
      const url = URL.createObjectURL(f);
      const a = document.createElement('a'); a.href = url; a.download = b.dataset.k; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }));
    kaart.querySelectorAll('.js-klwis').forEach(b => b.addEventListener('click', async () => {
      await Toestelkluis.wis(b.dataset.k); renderFacturenLid();
    }));
  }

  /* ---------- Mijn backoffice: de slimme accountkamer van elke pas ---------- */
  function boOpen(){ $('#bo-scrim').classList.add('open'); $('#bo-sheet').classList.add('open'); boRender(); }
  function boDicht(){ $('#bo-scrim').classList.remove('open'); $('#bo-sheet').classList.remove('open'); }
  $('#boBtn').addEventListener('click', boOpen);
  $('#boClose').addEventListener('click', boDicht);
  $('#bo-scrim').addEventListener('click', boDicht);
  const naarTab = (naam) => { boDicht(); const b = document.querySelector('#tabbar [data-tab="' + naam + '"]'); if (b) b.click(); };

  async function boRender(){
    const body = $('#boBody');
    $('#boSub').textContent = (TIER_LABEL[user.tier] || '') + ' · ' + (user.codename || user.name || '');
    const kaart = (titel, inhoud) => '<div class="zak-kaart"><b style="font-size:0.8rem;">' + titel + '</b>' + inhoud + '</div>';
    const rij = (l, w) => '<div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-top:0.4rem;"><span style="color:var(--muted);">' + l + '</span><b>' + w + '</b></div>';
    const knopje = (id, tekst) => '<button id="' + id + '" style="margin-top:0.55rem;margin-right:0.4rem;background:none;border:1px solid var(--line);border-radius:999px;padding:0.4rem 0.85rem;color:var(--txt);font-family:inherit;font-size:0.7rem;cursor:pointer;">' + tekst + '</button>';

    // de slimme cijfers: wat er open staat komt bovenaan, met een knop erbij
    const open = invoices.filter(i => i.status === 'open');
    const betaald = invoices.filter(i => i.status === 'paid');
    const totaalBetaald = betaald.reduce((s, i) => s + (i.netto || 0) + (i.bijdrage || 0), 0);
    const fonds = betaald.reduce((s, i) => s + Math.round((i.bijdrage || 0) * 0.3), 0);
    const acties = [];
    if (open.length) acties.push('💳 ' + open.length + ' ' + T('bo2.open','openstaande factuur/facturen; betaal in één tik via Betalen.'));
    if (user.account && user.emailVerified === false) acties.push('✉️ ' + T('bo2.mailniet','Uw e-mailadres is nog niet bevestigd.'));
    if (user.account && user.verified && user.verified !== 'verified') acties.push('🪪 ' + T('bo2.kyc','Verifieer uw identiteit om in één tik te boeken.'));

    let html = '';
    if (acties.length) html += kaart('⚡ ' + T('bo2.acties','Nu aandacht nodig'),
      acties.map(a => '<div class="fineprint">' + a + '</div>').join('') +
      (open.length ? knopje('boNaarBetalen', T('bo2.betaalnu','Naar Betalen')) : ''));
    else html += kaart('✓ ' + T('bo2.alsklaar','Alles op orde'), '<div style="font-size:0.76rem;color:var(--muted);margin-top:0.4rem;">' + T('bo2.geen','Geen openstaande zaken op uw account.') + '</div>');

    html += kaart('📊 ' + T('bo2.cijfers','Mijn cijfers'),
      rij(T('bo2.betaald','Betaald via RTG'), eur(totaalBetaald)) +
      rij(T('bo2.facturen','Facturen'), betaald.length + ' ' + T('bo2.voldaan','voldaan') + (open.length ? ' · ' + open.length + ' open' : '')) +
      rij('RTFoundation', eur(fonds) + ' ' + T('bo2.viamij','via mijn bijdragen')) +
      (myApps && myApps.length ? rij(T('bo2.sollicitaties','Sollicitaties'), String(myApps.length)) : ''));

    // interactieve AI-agenda
    if (user.tier !== 'guest') html += '<div id="boAgendaCard"></div>';
    // mijn facturen (automatisch bij elke aankoop)
    if (user.tier !== 'guest') html += '<div id="boFacturenCard"></div>';

    if (user.account){
      html += kaart('🔐 ' + T('bo2.beveiliging','Beveiliging'),
        rij(T('bo2.lidsinds','Lid sinds'), user.since || '') +
        rij(T('bo2.email','E-mail bevestigd'), user.emailVerified === false ? T('bo2.nee','nee') : T('bo2.ja','ja')) +
        '<div style="font-size:0.68rem;color:var(--soft);margin-top:0.5rem;line-height:1.5;">' + T('bo2.2fa','Wachtwoord vergeten? Dat herstelt u via de website in twee stappen: een link per e-mail plus een code op uw telefoon.') + '</div>' +
        '<div style="display:flex;gap:0.4rem;margin-top:0.55rem;flex-wrap:wrap;">' +
        '<input id="boWwHuidig" type="password" placeholder="' + T('bo2.huidig','Huidig wachtwoord') + '" autocomplete="current-password" style="flex:1;min-width:9rem;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.65rem;color:var(--txt);font-family:inherit;font-size:0.76rem;">' +
        '<input id="boWwNieuw" type="password" placeholder="' + T('bo2.nieuw','Nieuw wachtwoord') + '" autocomplete="new-password" style="flex:1;min-width:9rem;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.65rem;color:var(--txt);font-family:inherit;font-size:0.76rem;">' +
        '</div>' + knopje('boWwZet', T('bo2.wijzig','Wijzig wachtwoord')) +
        (user.emailVerified === false ? knopje('boVerstuur', T('bo2.verstuur','Stuur bevestigingsmail opnieuw')) : ''));
    } else {
      html += kaart('🔐 ' + T('bo2.beveiliging','Beveiliging'),
        '<div class="fineprint">' + T('bo2.demo','U gebruikt een demoprofiel. Met een echt account beheert u hier uw wachtwoord en tweestapsherstel.') + '</div>');
    }

    // weergave: RTG en Lifestyle kunnen tussen het pas-thema en klassiek donker
    if (vastePas === 'rtg' || vastePas === 'lifestyle'){
      const pasNaam = vastePas === 'rtg' ? T('bo2.thema.bordeaux','Bordeaux (RTG)') : T('bo2.thema.parel','Parelmoer (Lifestyle)');
      const nu = pasThemaHuidig();
      const knop = (val, tekst) => '<button class="js-thema" data-thema="' + val + '" style="margin-top:0.5rem;margin-right:0.4rem;border-radius:999px;padding:0.4rem 0.85rem;font-family:inherit;font-size:0.7rem;cursor:pointer;border:1px solid ' + (nu===val?'var(--gold)':'var(--line)') + ';background:' + (nu===val?'var(--gold)':'none') + ';color:' + (nu===val?'#000':'var(--txt)') + ';">' + tekst + '</button>';
      html += kaart('🎨 ' + T('bo2.weergave','Weergave'),
        '<div class="fineprint">' + T('bo2.weergave.s','Kies het kleurthema van deze app.') + '</div>' +
        knop(THEMA_STANDAARD[vastePas], pasNaam) + knop('standaard', T('bo2.thema.klassiek','Klassiek (donker)')));
    }

    // pas-specifiek: elke pas zijn eigen slimme snelkoppelingen
    if (user.tier === 'business'){
      html += kaart('💼 ' + T('bo2.vb','Voor uw Business Pass'),
        '<div class="fineprint">' + T('bo2.vb.s','Uw facturen zijn boekhoudklaar. De AI-boekhouder en de zzp-belastingtool staan onder Betalen; uw netwerk onder Salon.') + '</div>' +
        knopje('boNaarBoekhouder', '📚 ' + T('bo2.boekhouder','AI-boekhouder')) + knopje('boNaarZakelijk', '💼 RTG Zakelijk'));
    } else if (user.tier === 'lifestyle'){
      html += kaart('🌙 ' + T('bo2.vl','Voor uw Lifestyle Pass'),
        '<div class="fineprint">' + T('bo2.vl.s','Uw concierge denkt vooruit onder AI; uw professionele netwerk staat onder Salon.') + '</div>' +
        knopje('boNaarAi', '✨ ' + T('bo2.concierge','Concierge')) + knopje('boNaarZakelijk', '💼 RTG Zakelijk'));
    } else {
      html += kaart('🎫 ' + T('bo2.vr','Voor uw pas'),
        '<div class="fineprint">' + T('bo2.vr.s','Boeken, betalen, vrienden en De Salon zitten in uw pas. Lifestyle en Business voegen de concierge, de AI-boekhouder en RTG Zakelijk toe.') + '</div>');
    }
    body.innerHTML = html;
    renderAgendaLid();
    renderFacturenLid();

    const bind = (id, fn) => { const e = document.getElementById(id); if (e) e.addEventListener('click', fn); };
    bind('boNaarBetalen', () => naarTab('betalen'));
    bind('boNaarBoekhouder', () => naarTab('betalen'));
    bind('boNaarAi', () => naarTab('ai'));
    bind('boNaarZakelijk', () => { boDicht(); naarTab('salon'); setTimeout(() => { const z = document.getElementById('zakOpenBtn'); if (z) z.click(); }, 150); });
    body.querySelectorAll('.js-thema').forEach(b => b.addEventListener('click', () => { pasThemaZet(b.dataset.thema); boRender(); }));
    bind('boVerstuur', async () => {
      try { const d = await API.call('/auth/resend'); toast(T('bo2.gestuurd','Bevestigingsmail verstuurd.')); if (d.devVerifyUrl) console.log('verify:', d.devVerifyUrl); }
      catch(e){ toast(e.message); }
    });
    bind('boWwZet', async () => {
      try {
        await API.call('/auth/password', { huidig: $('#boWwHuidig').value, nieuw: $('#boWwNieuw').value });
        $('#boWwHuidig').value = ''; $('#boWwNieuw').value = '';
        toast(T('bo2.gewijzigd','Wachtwoord gewijzigd.'));
      } catch(e){ toast(e.message); }
    });
  }

  /* ---------- salon ---------- */

  // De publieke Salon-etalage van een partner: bio, foto's, folders, deals, polls
  async function openEtalage(code){
    let d;
    try { d = await API.call('/salon/profiel', { code }); } catch(e){ toast(e.message); return; }
    const p = d.partner;
    await laadBetaalVerzoeken();
    const vz = betaalVerzoeken.filter(v => v.supplierCode === code);
    const kanBetalen = user && user.tier !== 'guest';
    let ov = document.getElementById('etalage-ov');
    if (!ov){ ov = document.createElement('div'); ov.id = 'etalage-ov';
      ov.style.cssText = 'position:fixed;inset:0;z-index:120;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center;';
      document.body.appendChild(ov);
      ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    }
    const eur2 = n => '€ ' + Number(n||0).toLocaleString('nl-NL');
    const items = d.items || [];
    const html =
      '<div style="width:100%;max-width:560px;max-height:88vh;overflow-y:auto;background:var(--bg);border-radius:20px 20px 0 0;border:1px solid var(--line);">' +
      '<div style="position:relative;">' +
        (p.foto ? '<img src="' + p.foto + '" alt="" style="width:100%;height:150px;object-fit:cover;border-radius:20px 20px 0 0;">' : '<div style="height:80px;"></div>') +
        '<button id="etaClose" style="position:absolute;top:0.7rem;right:0.7rem;background:rgba(0,0,0,0.5);color:#fff;border:none;border-radius:999px;width:34px;height:34px;font-size:1rem;cursor:pointer;">✕</button>' +
      '</div>' +
      '<div style="padding:1rem 1.1rem 1.4rem;">' +
        '<div style="display:flex;align-items:center;gap:0.6rem;"><b style="font-size:1.1rem;font-family:\'Bodoni Moda\',serif;">' + escT(p.name) + '</b>' +
          '<button id="etaVolg" style="margin-left:auto;background:' + (p.volgIk ? 'var(--gold)' : 'none') + ';color:' + (p.volgIk ? '#000' : 'var(--gold)') + ';border:1px solid var(--gold);border-radius:999px;padding:0.3rem 0.9rem;font-size:0.72rem;font-weight:600;font-family:inherit;cursor:pointer;">' + (p.volgIk ? '✓ ' + T('sal.volgt','Volgt') : '+ ' + T('sal.volg','Volg')) + '</button></div>' +
        '<div style="font-size:0.74rem;color:var(--soft);margin-top:0.2rem;">' + (p.icon ? p.icon + ' ' : '') + escT(p.typeLabel || '') + ' · ' + escT(p.city || '') + ' · ' + p.volgers + ' ' + T('sal.volgers','volgers') + '</div>' +
        (p.bio ? '<div style="font-size:0.86rem;margin-top:0.6rem;line-height:1.5;">' + escT(p.bio) + '</div>' : '') +
        (kanBetalen ? '<button id="etaBetaal" class="mo-pay" style="width:100%;justify-content:center;margin-top:0.8rem;padding:0.7rem;">' + FID_MINI + T('dp.betaaldirect','Betaal direct met Face ID') + '</button>' : '') +
        (vz.length ? '<div style="margin-top:0.8rem;">' + vz.map(v =>
          '<div style="border:1px solid var(--gold);border-radius:12px;padding:0.7rem 0.9rem;margin-top:0.5rem;background:var(--card);">' +
          '<div style="font-size:0.58rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--gold);">' + FID_MINI + T('dp.verzoek','Betaalverzoek') + '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-top:0.3rem;"><span style="font-size:0.85rem;">' + escT(v.omschrijving || '') + '</span><b style="color:var(--gold);white-space:nowrap;">' + eur2((v.bedrag||0)/100) + '</b></div>' +
          '<button class="mo-pay js-vzpay" data-vz="' + v.ref + '" style="width:100%;justify-content:center;margin-top:0.5rem;padding:0.6rem;">' + FID_MINI + T('dp.betaalverzoek','Betaal dit verzoek') + '</button></div>').join('') + '</div>' : '') +
        (items.length
          ? items.map(it =>
            '<div style="border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.9rem;margin-top:0.7rem;">' +
            '<div style="font-size:0.58rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--gold);">' + (it.soort === 'folder' ? '📖 ' + T('sal.folder','Folder') : it.soort === 'deal' ? '🎁 ' + T('sal.deal','Aanbieding') : it.soort === 'poll' ? '📊 Poll' : '📣 ' + T('sal.bericht','Bericht')) + '</div>' +
            (it.folder ? '<div style="font-weight:600;margin-top:0.2rem;">' + escT(it.folder.titel) + '</div>' +
              ((it.folder.fotos && it.folder.fotos.length) ? '<div style="display:flex;gap:0.4rem;overflow-x:auto;margin-top:0.45rem;">' + it.folder.fotos.map(f => '<img src="' + f + '" alt="" style="height:90px;border-radius:8px;flex-shrink:0;">').join('') + '</div>' : '') +
              ((it.folder.items && it.folder.items.length) ? '<div style="margin-top:0.45rem;display:grid;gap:0.2rem;">' + it.folder.items.map(x => '<div style="display:flex;justify-content:space-between;font-size:0.8rem;"><span>' + escT(x.naam) + '</span>' + (x.prijs != null ? '<span style="color:var(--gold);">' + eur2(x.prijs) + '</span>' : '') + '</div>').join('') + '</div>' : '')
              : (it.deal ? '<div style="font-weight:600;margin-top:0.2rem;">' + escT(it.deal.titel) + (it.deal.mijnCode ? ' · <span style="color:var(--gold);">' + it.deal.mijnCode + '</span>' : '') + '</div>'
              : '<div style="font-size:0.85rem;margin-top:0.2rem;">' + escT(it.text || '') + '</div>')) +
            '</div>').join('')
          : '<div style="text-align:center;color:var(--soft);font-size:0.82rem;padding:1.4rem 0;">' + T('sal.etaleeg','Nog geen folders of aanbiedingen.') + '</div>') +
      '</div></div>';
    ov.innerHTML = html;
    ov.querySelector('#etaClose').addEventListener('click', () => ov.remove());
    ov.querySelector('#etaVolg').addEventListener('click', async () => {
      try { await API.call('/salon/volg', { code }); await refreshState(); renderSalon(); openEtalage(code); } catch(e){ toast(e.message); }
    });
    const eb = ov.querySelector('#etaBetaal');
    if (eb) eb.addEventListener('click', () => { ov.remove(); betaalPartner(code, p.name, { bron: 'salon' }); });
    ov.querySelectorAll('.js-vzpay').forEach(b => b.addEventListener('click', () => {
      const v = vz.find(x => x.ref === b.dataset.vz); if (!v) return;
      ov.remove(); betaalVerzoekPay(v);
    }));
  }

  function renderSalon(){
    const isGuest = user && user.tier === 'guest';
    // RTG Zakelijk: de ingang staat aan voor de Lifestyle en Business Pass
    const zakL = $('#zakLauncher');
    if (user && (user.tier === 'business' || user.tier === 'lifestyle')){
      zakL.style.display = 'block';
      zakL.innerHTML = '<button id="zakOpenBtn" style="display:flex;align-items:center;gap:0.7rem;width:100%;text-align:left;background:none;border:1px solid var(--gold);border-radius:14px;padding:0.75rem 1rem;margin-bottom:0.8rem;color:var(--txt);font-family:inherit;cursor:pointer;">' +
        '<span style="font-size:1.2rem;">💼</span><span style="flex:1;"><b style="font-size:0.85rem;">' + T('zak.h','RTG Zakelijk') + '</b>' +
        '<span style="display:block;font-size:0.68rem;color:var(--muted);">' + T('zak.launch','Uw professionele netwerk: profiel, gids, feed en aanbevelingen.') + '</span></span>' +
        '<span style="color:var(--gold);">›</span></button>';
      $('#zakOpenBtn').addEventListener('click', zakOpen);
    } else { zakL.style.display = 'none'; }
    $('#feed').innerHTML = posts.map(p => {
      const engage = canEngage(p);
      // gratis gebruikers (zonder pas) liken/reageren niet bij particulieren
      const mayLike = !(isGuest && !p.partner);
      const visual = p.photo
        ? '<div class="visual"><img src="' + p.photo + '" alt=""><span class="place">' + escT(p.place) + '</span></div>'
        : '<div class="visual ' + (p.visual || 'v-partner') + '"><span class="place">' + escT(p.place) + '</span></div>';
      // partners posten zonder wachttijd: hun bericht staat er direct, met
      // tijdstempel; de 7-dagen-privacyregel geldt alleen voor ledenposts
      const meta = p.partner
        ? TIER_LABEL.partner + ' · ' + p.place + ' · ' + (p.at ? timeAgo(p.at) : T('app.salon.direct','direct geplaatst'))
        : TIER_LABEL[p.tier] + ' · ' + p.place + ' · ' + T('app.salon.7days','7 dagen na verblijf');
      // bedrijfslaag: volg-knop, exclusieve aanbieding en poll
      const volg = p.partnerCode
        ? '<button class="js-volg" data-code="' + p.partnerCode + '" style="margin-left:auto;background:' + (p.volgIk ? 'var(--gold)' : 'none') + ';color:' + (p.volgIk ? '#000' : 'var(--gold)') + ';border:1px solid var(--gold);border-radius:999px;padding:0.25rem 0.75rem;font-size:0.66rem;font-weight:600;font-family:inherit;flex-shrink:0;cursor:pointer;">' + (p.volgIk ? '✓ ' + T('sal.volgt','Volgt') : '+ ' + T('sal.volg','Volg')) + '</button>'
        : '';
      const deal = p.deal
        ? '<div style="margin:0.6rem 1.1rem 0;border:1px solid var(--gold);border-radius:12px;padding:0.7rem 0.9rem;">' +
          '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);">🎁 ' + T('sal.deal','Exclusief voor leden') + (p.deal.geldigTot ? ' · t/m ' + p.deal.geldigTot : '') + '</div>' +
          '<div style="font-weight:600;font-size:0.9rem;margin-top:0.25rem;">' + p.deal.titel + '</div>' +
          (p.deal.mijnCode
            ? '<div style="margin-top:0.45rem;font-size:0.8rem;color:var(--gold);letter-spacing:0.08em;">' + T('sal.uwcode','Uw code') + ': <b>' + p.deal.mijnCode + '</b> <span style="color:var(--soft);font-size:0.68rem;">· ' + T('sal.toon','toon aan de kassa') + '</span></div>'
            : '<button class="js-claim" style="margin-top:0.5rem;background:var(--knop);color:var(--knop-txt);border:none;border-radius:999px;padding:0.45rem 0.95rem;font-size:0.72rem;font-weight:600;font-family:inherit;cursor:pointer;">' + T('sal.claim','Claim deze aanbieding') + '</button>') +
          '<div style="margin-top:0.35rem;font-size:0.62rem;color:var(--soft);">' + p.deal.claims + ' ' + T('sal.geclaimd','keer geclaimd') + '</div></div>'
        : '';
      const poll = p.poll
        ? '<div style="margin:0.6rem 1.1rem 0;border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.9rem;">' +
          '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);">📊 ' + T('sal.poll','Poll') + ' · ' + p.poll.totaal + ' ' + T('sal.stemmen','stem(men)') + '</div>' +
          p.poll.opties.map((o, i) => {
            const pct = p.poll.totaal ? Math.round(o.stemmen / p.poll.totaal * 100) : 0;
            return p.poll.gestemd
              ? '<div style="margin-top:0.45rem;"><div style="display:flex;justify-content:space-between;font-size:0.76rem;"><span>' + (o.mijn ? '✓ ' : '') + o.tekst + '</span><span style="color:var(--soft);">' + pct + '%</span></div>' +
                '<div style="height:4px;border-radius:99px;background:rgba(255,255,255,0.08);margin-top:0.25rem;overflow:hidden;"><i style="display:block;height:100%;width:' + pct + '%;background:' + (o.mijn ? 'var(--gold)' : 'var(--soft)') + ';border-radius:99px;"></i></div></div>'
              : '<button class="js-stem" data-optie="' + i + '" style="display:block;width:100%;margin-top:0.45rem;background:none;border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.7rem;color:var(--txt);font-size:0.78rem;font-family:inherit;text-align:left;cursor:pointer;">' + o.tekst + '</button>';
          }).join('') + '</div>'
        : '';
      const folder = p.folder
        ? '<div style="margin:0.6rem 1.1rem 0;border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.9rem;">' +
          '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);">📖 ' + T('sal.folder','Folder') + '</div>' +
          '<div style="font-weight:600;font-size:0.9rem;margin-top:0.25rem;">' + escT(p.folder.titel) + '</div>' +
          ((p.folder.fotos && p.folder.fotos.length) ? '<div style="display:flex;gap:0.4rem;overflow-x:auto;margin-top:0.5rem;">' + p.folder.fotos.map(f => '<img src="' + f + '" alt="" style="height:96px;border-radius:8px;flex-shrink:0;">').join('') + '</div>' : '') +
          ((p.folder.items && p.folder.items.length) ? '<div style="margin-top:0.5rem;display:grid;gap:0.2rem;">' + p.folder.items.slice(0, 12).map(it => '<div style="display:flex;justify-content:space-between;font-size:0.8rem;"><span>' + escT(it.naam) + (it.tekst ? ' <span style="color:var(--soft);">· ' + escT(it.tekst) + '</span>' : '') + '</span>' + (it.prijs != null ? '<span style="color:var(--gold);white-space:nowrap;">' + eur(it.prijs) + '</span>' : '') + '</div>').join('') + '</div>' : '') +
          '</div>'
        : '';
      const etalageBtn = p.partnerCode
        ? '<button class="pa js-etalage" data-code="' + p.partnerCode + '" title="' + T('sal.etalage','Etalage') + '">🏬 ' + T('sal.etalage','Etalage') + '</button>'
        : '';
      return '<article class="post" data-post="' + p.id + '">' +
        '<div class="head">' +
          '<div class="avatar a-' + p.tier + '">' + escT((p.author || ' ')[0]) + '</div>' +
          '<div><b>' + escT(p.author) + (p.partner ? '<span class="partner-badge">' + T('app.partner','Partner') + '</span>' : '') + '</b><span>' + escT(meta) + (p.partnerCode && p.volgers != null ? ' · ' + p.volgers + ' ' + T('sal.volgers','volgers') : '') + '</span></div>' +
          volg +
        '</div>' +
        visual +
        '<div class="body">' + msgHTML(p.text, p.lang) + '</div>' +
        folder + deal + poll +
        '<div class="acts">' +
          '<button class="pa js-like' + (p.liked ? ' liked' : '') + '"' + (mayLike ? '' : ' disabled') + '>♥ <span class="lc">' + p.likes + '</span></button>' +
          '<button class="pa js-comm"' + (engage ? '' : ' disabled') + '>' + T('app.salon.comment','Reageren') + ' (' + p.comments.length + ')</button>' +
          etalageBtn +
          '<button class="pa js-share" title="' + T('sal.deel','Delen met een connectie') + '">↗</button>' +
        '</div>' +
        '<div class="comments">' +
          '<div class="clist">' + p.comments.map(c => '<div class="comment"><b>' + escT(c.who) + '</b>, ' + msgHTML(c.text, c.lang) + '</div>').join('') + '</div>' +
          '<div class="cform"><input placeholder="' + T('app.salon.write','Schrijf een reactie…') + '"><button>' + T('app.salon.post','Plaats') + '</button></div>' +
        '</div>' +
      '</article>';
    }).join('');
    hydrateMsgs($('#feed'));

    document.querySelectorAll('.post').forEach(el => {
      const post = posts.find(p => p.id === Number(el.dataset.post));
      el.querySelector('.js-like').addEventListener('click', ev => {
        // zonder pas kun je berichten van leden wel zien, maar niet liken
        if (user && user.tier === 'guest' && !post.partner){ toast(T('sal.guestlike','Zonder pas bekijk je de Salon; liken en reageren bij leden is voor leden.')); return; }
        post.liked = !post.liked;
        post.likes += post.liked ? 1 : -1;
        ev.currentTarget.classList.toggle('liked', post.liked);
        el.querySelector('.lc').textContent = post.likes;
        if (API.live) API.call('/like', {postId: post.id, liked: post.liked}).catch(() => {});
      });
      const shareBtn = el.querySelector('.js-share');
      if (shareBtn) shareBtn.addEventListener('click', () => openShare(post.id));
      const volgBtn = el.querySelector('.js-volg');
      if (volgBtn) volgBtn.addEventListener('click', async () => {
        try {
          const d = await API.call('/salon/volg', { code: volgBtn.dataset.code });
          toast(d.volgIk ? '✦ ' + T('sal.volgok','U volgt') + ' ' + post.author + '.' : T('sal.ontvolgd','Niet meer gevolgd.'));
          await refreshState();
          renderSalon();
        } catch(e){ toast(e.message); }
      });
      const claimBtn = el.querySelector('.js-claim');
      if (claimBtn) claimBtn.addEventListener('click', async () => {
        try {
          const d = await API.call('/salon/deal/claim', { postId: post.id });
          toast('🎁 ' + T('sal.claimok','Geclaimd. Uw code:') + ' ' + d.code);
          await refreshState();
          renderSalon();
        } catch(e){ toast(e.message); }
      });
      const etaBtn = el.querySelector('.js-etalage');
      if (etaBtn) etaBtn.addEventListener('click', () => openEtalage(etaBtn.dataset.code));
      el.querySelectorAll('.js-stem').forEach(sb => sb.addEventListener('click', async () => {
        try {
          await API.call('/salon/poll/stem', { postId: post.id, optie: Number(sb.dataset.optie) });
          await refreshState();
          renderSalon();
        } catch(e){ toast(e.message); }
      }));
      const commBtn = el.querySelector('.js-comm');
      commBtn.addEventListener('click', () => {
        if (commBtn.disabled) return;
        el.querySelector('.comments').classList.toggle('open');
      });
      el.querySelectorAll('.pa:disabled').forEach(b => {
        b.style.pointerEvents = 'auto';
        b.addEventListener('click', e => {
          e.preventDefault();
          toast(user.tier === 'rtg'
            ? T('app.salon.rtgnote','Met de RTG Pass reageert u met RTG-leden, of met wie u eerst aanspreekt.')
            : T('app.salon.nocomment','Reageren is hier niet beschikbaar.'));
        });
      });
      el.querySelector('.cform button').addEventListener('click', async () => {
        const inp = el.querySelector('.cform input');
        if (!inp.value.trim()) return;
        if (API.live){
          try { await API.call('/comment', {postId: post.id, text: inp.value.trim()}); }
          catch (e) { toast(e.message || T('app.salon.notallowed','Reageren niet toegestaan.')); return; }
        }
        post.comments.push({who: user.full, tier: user.tier, text: inp.value.trim()});
        const d = document.createElement('div');
        d.className = 'comment';
        d.innerHTML = '<b>' + user.full + '</b>, ' + inp.value.trim().replace(/</g, '&lt;');
        el.querySelector('.clist').appendChild(d);
        inp.value = '';
        commBtn.textContent = T('app.salon.comment','Reageren') + ' (' + post.comments.length + ')';
        toast(T('app.salon.posted','Reactie geplaatst.'));
      });
    });
  }

  /* ================= Salon-ontmoetingen (wederzijdse connecties in de buurt) =
     Elk lid zet dit zelf aan/uit. Aan: de app stuurt af en toe de positie mee;
     een verbonden vriend die ook aanstaat en vlakbij is levert een voorstel op.
     Beiden kiezen een activiteit (of niets = afwijzen); bij een match tekenen ze
     een veiligheidscontract, waarna RTG-kantoor live meekijkt tot het klaar is.
     Bij een SOS gaat de camera aan en kijkt kantoor mee (WebRTC). */
  let ontmoetState = null, ontmoetTimer = null, ontmoetSosPc = null, ontmoetSosDate = null, ontmoetPending = null;

  async function laadOntmoet(){
    const el = $('#ontmoetPaneel'); if (!el) return;
    if (!API.live || !user || !user.account){ el.style.display = 'none'; stopOntmoetTimer(); return; }
    try { ontmoetState = await API.call('/ontmoeten/state'); }
    catch(e){ el.style.display = 'none'; return; }
    renderOntmoet();
    beheerOntmoetTimer();
  }
  function stopOntmoetTimer(){ if (ontmoetTimer){ clearInterval(ontmoetTimer); ontmoetTimer = null; } }
  // terwijl de functie aanstaat (of er een afspraak loopt) periodiek de positie sturen
  function beheerOntmoetTimer(){
    const s = ontmoetState;
    const loopt = s && (s.aan || (s.dates && s.dates.some(d => d.status === 'actief' || d.status === 'noodgeval')));
    if (loopt && !ontmoetTimer){ ontmoetTick(); ontmoetTimer = setInterval(ontmoetTick, 20000); }
    else if (!loopt) stopOntmoetTimer();
  }
  function ontmoetPositie(){
    return new Promise(res => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { maximumAge: 15000, timeout: 8000 });
    });
  }
  async function ontmoetTick(){
    const s = ontmoetState; if (!s) return;
    const pos = await ontmoetPositie();
    try {
      if (s.aan){ const r = await API.call('/ontmoeten/hier', pos || {}); ontmoetState = r.state; renderOntmoet(); }
      // live-positie voor lopende afspraken naar kantoor
      for (const d of (ontmoetState.dates || [])) if (d.status === 'actief' || d.status === 'noodgeval'){
        try { await API.call('/ontmoeten/hier-date', { dateId: d.id, lat: pos ? pos.lat : undefined, lng: pos ? pos.lng : undefined }); } catch(e){}
      }
    } catch(e){}
  }

  function ontmoetActBtns(voorstelId){
    return (ontmoetState.activiteiten || []).map(a =>
      '<button class="js-oa" data-v="' + voorstelId + '" data-a="' + a.id + '" style="flex:1;min-width:5.5rem;background:none;border:1px solid var(--gold);border-radius:12px;padding:0.6rem 0.4rem;color:var(--txt);font-family:inherit;cursor:pointer;text-align:center;">' +
      '<span style="font-size:1.3rem;display:block;">' + a.icon + '</span><b style="font-size:0.78rem;">' + escT(a.label) + '</b>' +
      '<span style="display:block;font-size:0.6rem;color:var(--muted);">' + escT(a.tekst) + '</span></button>').join('');
  }
  function renderOntmoet(){
    const el = $('#ontmoetPaneel'); const s = ontmoetState;
    if (!s){ el.style.display = 'none'; return; }
    el.style.display = 'block';
    const kaart = (inner) => '<div style="border:1px solid var(--line);border-radius:16px;padding:0.9rem 1rem;margin-bottom:0.8rem;background:rgba(255,255,255,0.02);">' + inner + '</div>';
    let h = '';
    // kop met aan/uit
    const uit = !s.aan;
    h += '<div style="display:flex;align-items:flex-start;gap:0.7rem;">' +
      '<span style="font-size:1.3rem;">🌟</span>' +
      '<div style="flex:1;"><b style="font-size:0.9rem;">' + T('ont.titel','Ontmoetingen') + '</b>' +
      '<span style="display:block;font-size:0.68rem;color:var(--muted);">' + T('ont.sub','Connecties die vlakbij zijn kunnen samen afspreken. Alleen jij bepaalt of dit aanstaat.') + '</span></div>' +
      (s.mag
        ? '<button id="ontToggle" role="switch" aria-checked="' + (s.aan ? 'true' : 'false') + '" style="flex-shrink:0;width:52px;height:30px;border-radius:999px;border:1px solid var(--gold);background:' + (s.aan ? 'var(--gold)' : 'none') + ';position:relative;cursor:pointer;" aria-label="' + T('ont.toggle','Ontmoetingen aan of uit') + '"><span style="position:absolute;top:3px;left:' + (s.aan ? '25px' : '3px') + ';width:22px;height:22px;border-radius:50%;background:' + (s.aan ? '#000' : 'var(--gold)') + ';transition:left .15s;"></span></button>'
        : '') +
      '</div>';
    if (!s.mag){
      h += '<div style="margin-top:0.6rem;font-size:0.72rem;color:var(--soft);border-top:1px solid var(--line);padding-top:0.6rem;">🔒 ' + escT(s.reden || T('ont.magniet','Nog niet beschikbaar.')) + '</div>';
      el.innerHTML = kaart(h);
      bindOntmoet();
      return;
    }
    if (uit){
      el.innerHTML = kaart(h);
      bindOntmoet();
      return;
    }
    // lopende afspraken (tekenen / actief / noodgeval)
    let blokken = '';
    for (const d of (s.dates || [])){
      const metNaam = escT(d.met);
      if (d.status === 'wacht-op-tekenen'){
        blokken += '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.7rem;">' +
          '<b style="font-size:0.82rem;">' + d.icon + ' ' + escT(d.activiteitLabel) + ' ' + T('ont.met','met') + ' ' + metNaam + '</b>' +
          '<div style="font-size:0.66rem;color:var(--muted);margin:0.3rem 0;">' + T('ont.tekenuitleg','Teken het veiligheidscontract om te starten. RTG-kantoor kijkt dan mee voor jullie veiligheid.') + '</div>' +
          '<pre style="white-space:pre-wrap;font-family:inherit;font-size:0.64rem;color:var(--soft);background:rgba(0,0,0,0.15);border-radius:10px;padding:0.6rem;max-height:8rem;overflow:auto;">' + escT(d.contract) + '</pre>' +
          '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;">' +
          (d.ikTekende
            ? '<span style="flex:1;font-size:0.72rem;color:var(--gold);align-self:center;">✓ ' + T('ont.jijtekende','Jij tekende. ') + (d.anderTekende ? '' : T('ont.wachtander','Wachten op ') + metNaam) + '</span>'
            : '<button class="js-oteken" data-d="' + d.id + '" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:999px;padding:0.55rem;font-weight:600;font-family:inherit;cursor:pointer;">✍️ ' + T('ont.teken','Contract tekenen') + '</button>') +
          '<button class="js-ostop" data-d="' + d.id + '" style="background:none;border:1px solid var(--line);border-radius:999px;padding:0.55rem 0.8rem;color:var(--soft);font-family:inherit;cursor:pointer;">' + T('ont.annuleer','Annuleren') + '</button>' +
          '</div></div>';
      } else if (d.status === 'actief' || d.status === 'noodgeval'){
        const nood = d.status === 'noodgeval';
        blokken += '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.7rem;' + (nood ? 'background:rgba(220,40,40,0.08);border-radius:10px;padding:0.7rem;' : '') + '">' +
          '<b style="font-size:0.82rem;">' + d.icon + ' ' + escT(d.activiteitLabel) + ' ' + T('ont.met','met') + ' ' + metNaam + '</b>' +
          '<div style="font-size:0.64rem;color:var(--muted);margin:0.25rem 0 0.5rem;">🛰️ ' + T('ont.kijktmee','RTG-kantoor kijkt live mee voor jullie veiligheid, tot jullie afronden.') + '</div>' +
          (nood ? '<div style="font-size:0.72rem;color:#ff8a8a;font-weight:600;margin-bottom:0.4rem;">🚨 ' + T('ont.noodloopt','Noodsignaal actief. Kantoor kijkt mee via je camera.') + '</div>' : '') +
          '<div style="display:flex;gap:0.5rem;">' +
          '<button class="js-osos" data-d="' + d.id + '" style="flex:1;background:#c62828;color:#fff;border:none;border-radius:999px;padding:0.6rem;font-weight:700;font-family:inherit;cursor:pointer;">🚨 ' + T('ont.sos','SOS') + '</button>' +
          '<button class="js-ostop" data-d="' + d.id + '" style="background:none;border:1px solid var(--line);border-radius:999px;padding:0.6rem 0.8rem;color:var(--soft);font-family:inherit;cursor:pointer;">🏁 ' + T('ont.afronden','Afronden') + '</button>' +
          '</div></div>';
      }
    }
    // open voorstellen
    let voors = '';
    for (const v of (s.voorstellen || [])){
      const metNaam = escT(v.met);
      voors += '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.7rem;">' +
        '<b style="font-size:0.82rem;">📍 ' + metNaam + ' ' + T('ont.indebuurt','is in de buurt') + '</b>';
      if (v.mijnKeuze){
        voors += '<div style="font-size:0.72rem;color:var(--gold);margin-top:0.35rem;">✓ ' + T('ont.jijkoos','Jij koos') + ' ' + escT((s.activiteiten.find(a => a.id === v.mijnKeuze) || {}).label || v.mijnKeuze) + '. ' + T('ont.wachtkeuze','Wachten op de keuze van ') + metNaam + '.</div>';
      } else {
        voors += '<div style="font-size:0.66rem;color:var(--muted);margin:0.3rem 0;">' + T('ont.kiessamen','Kies samen. Niets doen betekent afwijzen.') + '</div>' +
          '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;">' + ontmoetActBtns(v.id) + '</div>' +
          '<button class="js-oweiger" data-v="' + v.id + '" style="margin-top:0.4rem;background:none;border:none;color:var(--soft);font-size:0.68rem;font-family:inherit;cursor:pointer;text-decoration:underline;">' + T('ont.nietnu','Niet nu') + '</button>';
      }
      voors += '</div>';
    }
    if (!blokken && !voors) h += '<div style="margin-top:0.6rem;font-size:0.68rem;color:var(--muted);border-top:1px solid var(--line);padding-top:0.6rem;">' + T('ont.aanuitleg','Staat aan. Zodra een connectie vlakbij is, verschijnt hier een voorstel.') + '</div>';
    el.innerHTML = kaart(h + blokken + voors);
    bindOntmoet();
  }
  function bindOntmoet(){
    const el = $('#ontmoetPaneel');
    const tg = el.querySelector('#ontToggle');
    if (tg) tg.addEventListener('click', async () => {
      const aan = !(ontmoetState && ontmoetState.aan);
      try { const r = await API.call('/ontmoeten/aan', { aan }); ontmoetState = r.state; renderOntmoet(); beheerOntmoetTimer(); }
      catch(e){ toast(e.message); }
    });
    el.querySelectorAll('.js-oa').forEach(b => b.addEventListener('click', () => ontmoetKies(b.dataset.v, b.dataset.a)));
    el.querySelectorAll('.js-oweiger').forEach(b => b.addEventListener('click', () => ontmoetKies(b.dataset.v, 'afwijzen')));
    el.querySelectorAll('.js-oteken').forEach(b => b.addEventListener('click', () => ontmoetTeken(b.dataset.d)));
    el.querySelectorAll('.js-ostop').forEach(b => b.addEventListener('click', () => ontmoetStop(b.dataset.d)));
    el.querySelectorAll('.js-osos').forEach(b => b.addEventListener('click', () => ontmoetSos(b.dataset.d)));
  }
  async function ontmoetKies(voorstelId, keuze){
    try { const r = await API.call('/ontmoeten/kies', { voorstelId, keuze }); ontmoetState = r.state;
      if (r.status === 'gematcht') toast('🎉 ' + T('ont.match','Match! Teken het contract om te starten.'));
      renderOntmoet();
    } catch(e){ toast(e.message); }
  }
  async function ontmoetTeken(dateId){
    if (!confirm(T('ont.tekenbevestig','Ik ben 18+ met een geverifieerd paspoort en ga akkoord met het veiligheidscontract: RTG-kantoor mag mijn live-locatie zien tot de afspraak klaar is, en bij SOS meekijken via de camera en 112 bellen.'))) return;
    try { const r = await API.call('/ontmoeten/teken', { dateId }); ontmoetState = r.state; renderOntmoet(); beheerOntmoetTimer();
      if (r.status === 'actief') toast('✅ ' + T('ont.gestart','Afspraak gestart. RTG kijkt mee voor jullie veiligheid.'));
    } catch(e){ toast(e.message); }
  }
  async function ontmoetStop(dateId){
    try { const r = await API.call('/ontmoeten/stop', { dateId }); ontmoetState = r.state; ontmoetSosStop(); renderOntmoet(); beheerOntmoetTimer(); }
    catch(e){ toast(e.message); }
  }
  async function ontmoetSos(dateId){
    const pos = await ontmoetPositie();
    try {
      await API.call('/ontmoeten/sos', { dateId, bericht: T('ont.sosbericht','Ik voel me niet veilig'), lat: pos ? pos.lat : undefined, lng: pos ? pos.lng : undefined });
      toast('🚨 ' + T('ont.sosverstuurd','SOS verstuurd. RTG-kantoor is gewaarschuwd en kijkt mee.'));
      ontmoetSosLive(dateId);         // camera + microfoon naar kantoor
      try { window.location.href = 'tel:112'; } catch(e){}   // en direct de hulpdiensten
      await laadOntmoet();
    } catch(e){ toast(e.message); }
  }
  // WebRTC: stuur camera + microfoon naar RTG-kantoor (kantoor beantwoordt via SSE)
  async function ontmoetSosLive(dateId){
    if (ontmoetSosPc) return;
    try {
      await haalIce();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: 'environment' } });
      const pc = new RTCPeerConnection({ iceServers: iceConfig || [{ urls: 'stun:stun.l.google.com:19302' }] });
      ontmoetSosPc = pc; ontmoetSosDate = dateId;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.onicecandidate = e => { if (e.candidate) API.call('/ontmoeten/signaal', { dateId, payload: { ice: e.candidate } }).catch(() => {}); };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await API.call('/ontmoeten/signaal', { dateId, payload: { sdp: pc.localDescription } });
    } catch(e){ /* camera geweigerd of niet beschikbaar: de SOS zelf is al binnen */ }
  }
  function ontmoetSosStop(){
    if (ontmoetSosPc){ try { ontmoetSosPc.getSenders().forEach(s => s.track && s.track.stop()); ontmoetSosPc.close(); } catch(e){} ontmoetSosPc = null; ontmoetSosDate = null; }
  }
  // antwoord van RTG-kantoor op ons SOS-beeld (WebRTC-signaal)
  async function opOntmoetSignaal(d){
    if (!ontmoetSosPc || !d || d.dateId !== ontmoetSosDate || !d.payload) return;
    try {
      if (d.payload.sdp) await ontmoetSosPc.setRemoteDescription(new RTCSessionDescription(d.payload.sdp));
      else if (d.payload.ice) await ontmoetSosPc.addIceCandidate(new RTCIceCandidate(d.payload.ice));
    } catch(e){}
  }

  /* ---------- taal gewijzigd: dynamische schermen opnieuw opbouwen ---------- */
  window.addEventListener('rtglang', async () => {
    if (!user) return;
    const active = (document.querySelector('.tabbar button.active') || {}).dataset;
    const tab = active ? active.tab : 'home';
    // inhoud opnieuw ophalen in de nieuwe taal (facturen, reis, menu's)
    if (API.live){ try { applyState((await API.call('/state')).state); } catch (e) {} }
    renderAll();
    renderBell();
    openTab(tab);
  });

  /* ---------- PWA ---------- */

  if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')){
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', doLogout);

  /* ---------- AVG: inzage en vergetelheid ---------- */
  const privExport = document.getElementById('privExport');
  if (privExport) privExport.addEventListener('click', async () => {
    if (!API.live){ toast(T('app.priv.needlogin','Log eerst in.')); return; }
    try {
      const data = await API.call('/privacy/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'rtg-mijn-gegevens.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast(T('app.priv.exported','Uw gegevens zijn gedownload als JSON.'));
    } catch(e){ toast(e.message); }
  });
  const privDelete = document.getElementById('privDelete');
  if (privDelete) privDelete.addEventListener('click', async () => {
    if (!API.live){ toast(T('app.priv.needlogin','Log eerst in.')); return; }
    if (!confirm(T('app.priv.confirm','Weet u het zeker? Dit wist uw cv, chats, likes en locatie definitief en logt u overal uit.'))) return;
    try {
      await API.call('/privacy/delete');
      try { localStorage.removeItem('rtg_member_token'); } catch(e2){}
      location.reload();
    } catch(e){ toast(e.message); }
  });

  restoreSession();
})();
