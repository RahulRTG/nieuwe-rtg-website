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
            ? '' + T('msg.from','vertaald uit') + ' ' + langName(from) + ' · ' + T('msg.orig','toon origineel')
            : '' + T('msg.showtrans','toon vertaling');
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
  // Een 403 met kyc:true (bijv. een gratis lid dat RTG Pay gebruikt zonder
  // paspoort) laat Rahul meteen de paspoort-stap van de onboarding tonen.
  const _apiCall = API.call.bind(API);
  API.call = function (pad, body) {
    return _apiCall(pad, body).catch(function (e) {
      if (e && e.data && e.data.kyc && typeof checkOnboarding === 'function') { try { checkOnboarding(); } catch (x) {} }
      throw e;
    });
  };

  function applyState(state){
    if (!state) return;
    if (state.user) user = state.user;
    if (state.invoices) invoices = state.invoices;
    if (state.trip) trip = state.trip;
    if (state.posts) posts = state.posts;
    if (typeof state.creatorLikes === 'number') creatorLikes = state.creatorLikes;
