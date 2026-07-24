/* RTMAIL: het eigen, interne postsysteem van het RTG-platform. Geen externe
   e-mail (dat blijft server/mail.js met SMTP/outbox), maar een postvak-op-
   codenaam binnen het huis zelf -- de rail waarover de automatiseringen straks
   hun berichten sturen: een ontvangstbevestiging aan een sollicitant, een
   inkoopvoorstel naar een groothandel, een factuur-seintje, een bericht van de
   overheid. Alles op codenamen/zaakcodes; echte namen blijven in de kluis.

   Adres: "<code>@rtmail" (kleine letters). De vaste systeem-afzender is
   "rtg@rtmail" -- daar komt alles vandaan wat het platform zelf verstuurt.
   Zero-dependency: alleen db, save en crypto (voor de id's) komen binnen.

   Bewust adviserend/onthoudend: RTMAIL bezorgt en bewaart, maar besluit niets
   en raakt geen geld -- een geld- of toegangs-actie loopt altijd langs de
   bestaande poorten waar een mens beslist. */
module.exports = ({ db, save, crypto }) => {
  const SYSTEEM = 'rtg@rtmail';
  const MAX = 20000; // ruwe bovengrens op het totaal, zodat het geheugen begrensd blijft

  const kap = (s, n) => String(s == null ? '' : s).slice(0, n);
  // adres normaliseren: kleine letters, geen rare tekens, en "@rtmail" erachter
  // als er nog geen domein staat. Zo is "SAKURA" hetzelfde als "sakura@rtmail".
  function normAdres(a) {
    let s = String(a == null ? '' : a).trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '');
    if (!s) return '';
    if (!s.includes('@')) s = s + '@rtmail';
    return s.slice(0, 80);
  }

  function store() {
    if (!db.data.rtmail || !Array.isArray(db.data.rtmail.berichten)) db.data.rtmail = { berichten: [] };
    return db.data.rtmail;
  }

  // Een bericht bezorgen. "naar" is verplicht; "van" valt terug op de systeem-
  // afzender. Geeft het bezorgde bericht terug (of een { error } bij een leeg adres).
  function stuur({ van, naar, onderwerp, tekst, soort } = {}) {
    const naarA = normAdres(naar);
    if (!naarA) return { error: 'Geen geldig ontvang-adres.' };
    const msg = {
      id: crypto.randomBytes(6).toString('hex'),
      van: normAdres(van) || SYSTEEM,
      naar: naarA,
      onderwerp: kap(onderwerp, 160) || '(geen onderwerp)',
      tekst: kap(tekst, 8000),
      soort: kap(soort, 24) || 'bericht',
      at: new Date().toISOString(),
      gelezen: false
    };
    const s = store();
    s.berichten.unshift(msg);
    if (s.berichten.length > MAX) s.berichten.length = MAX;
    save();
    return msg;
  }

  // De rail voor de automatiseringen: het platform stuurt vanuit "rtg@rtmail".
  function systeemStuur(naar, onderwerp, tekst, soort) {
    return stuur({ van: SYSTEEM, naar, onderwerp, tekst, soort: soort || 'systeem' });
  }

  const pub = m => ({ id: m.id, van: m.van, naar: m.naar, onderwerp: m.onderwerp, tekst: m.tekst, soort: m.soort, at: m.at, gelezen: !!m.gelezen });

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

  return { SYSTEEM, normAdres, stuur, systeemStuur, postvak, verzonden, ongelezen, lees };
};
