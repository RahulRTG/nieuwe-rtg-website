/* RTMAIL: het eigen, interne postsysteem van het RTG-platform. Geen externe
   e-mail (dat blijft server/mail.js met SMTP/outbox), maar een postvak-op-
   codenaam binnen het huis zelf -- de rail waarover de automatiseringen straks
   hun berichten sturen: een ontvangstbevestiging aan een sollicitant, een
   inkoopvoorstel naar een groothandel, een factuur-seintje, een bericht van de
   overheid. Alles op codenamen/zaakcodes; echte namen blijven in de kluis.

   Adres: "<code>@rtmail" (kleine letters). De vaste systeem-afzender is
   "rtg@rtmail" -- daar komt alles vandaan wat het platform zelf verstuurt.
   Zero-dependency: alleen db, save en crypto (voor de id's) komen binnen.

   VEILIGSTE MAIL VAN HET HUIS. Twee banen, streng gescheiden:
   - VERTROUWD (systeem/Rahul, geverifieerd RTG/RTF-lid, geverifieerde RTG/RTF-
     zaak): de premium, snelle, AI-gedreven beleving.
   - ONBETROUWD (al het andere -- een afzender buiten de code, of niet te
     verifiëren): links zijn nooit te openen en bijlagen bestaan niet. Nul
     phishing-, nul malware-oppervlak.
   Het vertrouwen wordt GESTEMPELD bij het versturen (de afzender is dan door de
   inlog geverifieerd), niet achteraf geraden. De standaard is onbetrouwbaar:
   wie geen bron meegeeft, is niet vertrouwd. RTMAIL draagt bovendien nooit een
   te openen bijlage -- de body is platte tekst, punt.

   Bewust adviserend/onthoudend: RTMAIL bezorgt en bewaart, maar besluit niets
   en raakt geen geld -- een geld- of toegangs-actie loopt altijd langs de
   bestaande poorten waar een mens beslist. */
module.exports = ({ db, save, crypto }) => {
  const SYSTEEM = 'rtg@rtmail';
  const MAX = 20000; // ruwe bovengrens op het totaal, zodat het geheugen begrensd blijft
  // De bronnen die het vertrouwen bepalen. Alleen deze drie zijn vertrouwd;
  // alles daarbuiten valt terug op 'extern' en is dus geblokkeerd.
  const VERTROUWDE_BRONNEN = ['systeem', 'lid', 'zaak'];

  const kap = (s, n) => String(s == null ? '' : s).slice(0, n);
  // adres normaliseren: kleine letters, geen rare tekens, en "@rtmail" erachter
  // als er nog geen domein staat. Zo is "SAKURA" hetzelfde als "sakura@rtmail".
  function normAdres(a) {
    let s = String(a == null ? '' : a).trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '');
    if (!s) return '';
    if (!s.includes('@')) s = s + '@rtmail';
    return s.slice(0, 80);
  }

  /* ---- de veiligheidsscan op de tekst ----
     RTMAIL rendert platte tekst; hier merken we vooruit welke stukken een link
     (kunnen) zijn, zodat de client ze kan defangen en de motor kan tellen. We
     zoeken alleen naar wat een klikbare/gevaarlijke link zou worden: een schema
     (http/https/ftp), een "www."-start, of een gevaarlijk schema. Puur, geen
     netwerk. Externe adressen (mailto/andere codes) blijven gewoon tekst. */
  const LINK_RE = new RegExp('(?:https?:\\/\\/|ftp:\\/\\/|www\\.)[^\\s<>()"\'\\]]+', 'gi');
  const GEVAAR_RE = /(?:javascript|data|vbscript|file)\s*:/i;
  function scanLinks(tekst) {
    const t = String(tekst == null ? '' : tekst);
    const externeLinks = (t.match(LINK_RE) || []).map(u => u.replace(/[.,;:!?)]+$/, '').slice(0, 300)).filter(Boolean);
    // dubbelen eruit, en begrensd zodat een spam-bericht de opslag niet opblaast
    const uniek = Array.from(new Set(externeLinks)).slice(0, 40);
    return { externeLinks: uniek, aantal: uniek.length, gevaarlijk: GEVAAR_RE.test(t) };
  }

  // De bron opschonen tot een van de bekende waarden; onbekend -> 'extern'.
  function schoonBron(bron, van) {
    if (van === SYSTEEM) return 'systeem';
    const b = String(bron || '').trim().toLowerCase();
    return VERTROUWDE_BRONNEN.includes(b) ? b : 'extern';
  }

  function store() {
    if (!db.data.rtmail || !Array.isArray(db.data.rtmail.berichten)) db.data.rtmail = { berichten: [] };
    return db.data.rtmail;
  }

  /* Een bericht bezorgen. "naar" is verplicht; "van" valt terug op de systeem-
     afzender. "bron" bepaalt het vertrouwen (systeem/lid/zaak = vertrouwd; al het
     andere = 'extern', geblokkeerd) en hoort door de geverifieerde inlog gezet te
     worden -- niet door de client. Een bijlage bestaat niet: wat er ook binnenkomt,
     er wordt niets opgeslagen dat te openen valt. Geeft het bezorgde bericht terug
     (of een { error } bij een leeg adres). */
  function stuur({ van, naar, onderwerp, tekst, soort, bron } = {}) {
    const naarA = normAdres(naar);
    if (!naarA) return { error: 'Geen geldig ontvang-adres.' };
    const vanA = normAdres(van) || SYSTEEM;
    const b = schoonBron(bron, vanA);
    const tekstK = kap(tekst, 8000);
    const links = scanLinks(tekstK);
    const msg = {
      id: crypto.randomBytes(6).toString('hex'),
      van: vanA,
      naar: naarA,
      onderwerp: kap(onderwerp, 160) || '(geen onderwerp)',
      tekst: tekstK,
      soort: kap(soort, 24) || 'bericht',
      bron: b,
      vertrouwd: VERTROUWDE_BRONNEN.includes(b),
      links, // { externeLinks:[], aantal, gevaarlijk }
      bijlagen: [], // RTMAIL draagt nooit een te openen bijlage -- bewust altijd leeg
      at: new Date().toISOString(),
      gelezen: false
    };
    const s = store();
    s.berichten.unshift(msg);
    if (s.berichten.length > MAX) s.berichten.length = MAX;
    save();
    return msg;
  }

  // De rail voor de automatiseringen: het platform stuurt vanuit "rtg@rtmail"
  // (bron 'systeem', altijd vertrouwd).
  function systeemStuur(naar, onderwerp, tekst, soort) {
    return stuur({ van: SYSTEEM, naar, onderwerp, tekst, soort: soort || 'systeem', bron: 'systeem' });
  }

  const pub = m => ({
    id: m.id, van: m.van, naar: m.naar, onderwerp: m.onderwerp, tekst: m.tekst, soort: m.soort,
    bron: m.bron || (m.van === SYSTEEM ? 'systeem' : 'extern'),
    vertrouwd: m.vertrouwd != null ? !!m.vertrouwd : (m.van === SYSTEEM),
    links: m.links || scanLinks(m.tekst),
    bijlagen: [],
    at: m.at, gelezen: !!m.gelezen
  });

  // Het postvak IN van een adres (nieuwste eerst).
  function postvak(adres, { limit = 60 } = {}) {
    const a = normAdres(adres);
    return store().berichten.filter(m => m.naar === a).slice(0, Math.max(1, Math.min(200, limit))).map(pub);
  }
  // Wat een adres zelf verstuurd heeft.
  function verzonden(adres, { limit = 60 } = {}) {
    const a = normAdres(adres);
    return store().berichten.filter(m => m.van === a).slice(0, Math.max(1, Math.min(200, limit))).map(pub);
  }
  function ongelezen(adres) {
    const a = normAdres(adres);
    return store().berichten.reduce((n, m) => n + (m.naar === a && !m.gelezen ? 1 : 0), 0);
  }
  // Een bericht als gelezen markeren -- alleen als het echt aan dit adres is.
  function lees(adres, id) {
    const a = normAdres(adres);
    const m = store().berichten.find(x => x.id === id && x.naar === a);
    if (!m) return { error: 'Dit bericht staat niet in dit postvak.' };
    if (!m.gelezen) { m.gelezen = true; save(); }
    return pub(m);
  }

  return { SYSTEEM, VERTROUWDE_BRONNEN, normAdres, scanLinks, stuur, systeemStuur, postvak, verzonden, ongelezen, lees };
};
