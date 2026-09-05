/* de bouwstempel-controle en de start van de app-bundel: html en script van dezelfde bouw */
(function(){
/* HTML EN SCRIPT MOETEN VAN DEZELFDE BOUW ZIJN.

   Een browser, een CDN of een service worker kan de pagina vers hebben en dit
   script nog uren oud (of omgekeerd). Die mix bouwt het beginscherm niet meer
   op: de gebruiker ziet zwart, en niets in de console legt uit waarom. Dat is
   hier echt gebeurd, meer dan eens, en elke keer duurde het lang voordat
   iemand doorhad dat de code al gerepareerd was.

   npm run build zet in beide bestanden dezelfde stempel. Wijken ze af, dan
   haalt de app zichzelf EEN keer vers op -- met een merk in sessionStorage,
   zodat een blijvend verschil (een proxy die niets doorlaat) geen herlaadlus
   wordt maar gewoon doorgaat. Doorgaan met een mismatch is nog altijd beter
   dan een zwart scherm, en de melding in de console zegt dan wat er speelt. */
var RTG_BOUW = 'abb6f724';
(function bouwWacht(){
  try {
    var m = document.querySelector('meta[name="rtg-bouw"]');
    var html = m ? m.getAttribute('content') : null;
    if (!html || html === RTG_BOUW) return;
    if (sessionStorage.getItem('rtg_bouw_ververst') === html) {
      console.warn('[rtg] html-bouw ' + html + ' naast script-bouw ' + RTG_BOUW + '; verversen hielp niet, we gaan door.');
      return;
    }
    sessionStorage.setItem('rtg_bouw_ververst', html);
    console.warn('[rtg] html-bouw ' + html + ' naast script-bouw ' + RTG_BOUW + '; eenmalig vers ophalen.');
    location.reload();
  } catch (e) { /* geen sessionStorage: dan liever doorgaan dan omvallen */ }
})();
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

  /* ---------- gegevens: echt via API, synthetisch alleen via Magnaat ---------- */

  const MAGNAAT = window.RTG_MAGNAAT_PROEF && window.RTG_MAGNAAT_DATA
    ? window.RTG_MAGNAAT_DATA : {};
  const PERSONAS = MAGNAAT.personas || {};
  const TIER_LABEL = {rtg:'RTG Pass', lifestyle:'Lifestyle Pass', business:'Business Pass', partner:'RTG-partner'};

  /* DEZE DRIE BEGINNEN LEEG, en dat is de hele pointe van de demo-erfenis.

     Hier stonden vier facturen, een uitgewerkte zomerreis en een stapel
     Salon-posts als BEGINWAARDE. applyState() overschrijft wat de server
     stuurt -- maar een reis die er niet is stuurt de server niet mee
     (`if (state.trip)`), en dan bleef die demo-villa gewoon staan op het
     beginscherm van iemand die zich net had aangemeld. De server begint een nieuw account leeg
     (server/kern/lid.js); dit was de laatste plek waar demo-inhoud nog voor
     eigen gegevens doorging.

     De trainingsinhoud staat apart in magnaat-data.js en wordt alleen door
     laadMagnaatData() geladen in de afgeschermde Magnaat-kopie, zonder backend.

     test/nieuwlid-leeg.test.js legt allebei de helften vast. */
  let user = null;
  let invoices = [];
  let trip = null;
  let posts = [];
  let creatorLikes = 0;
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
