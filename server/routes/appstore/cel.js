/* ============================================================================
   DE CEL -- waar code van een derde draait, en waarom dat niet in dit huis is.

   GRENS 1: DERDENCODE DRAAIT NOOIT OP DE RTG-HERKOMST. Deze route is de plek
   waar die grens wordt gemaakt, en er is geen vlag die hem uitzet.

   Vier sloten, en ze staan er alle vier omdat ze iets ANDERS tegenhouden:

     1. DE IFRAME MET sandbox="allow-scripts" (in /apps/appcel.html). Zonder
        allow-same-origin krijgt het document een NAAMLOZE herkomst. Daarmee is
        er geen localStorage van RTG, geen cookie, geen document van de ouder en
        geen sessie -- niet omdat wij het afschermen, maar omdat de browser het
        een andere partij vindt.
     2. DE CSP-KOP HIERONDER, met `sandbox allow-scripts` er OOK in. Dat tweede
        slot is er voor de weg die de eerste niet dekt: wie de cel-URL gewoon in
        een tabblad plakt, zit dan alsnog in een naamloze herkomst zonder
        formulieren en zonder navigatie naar boven.
     3. connect-src 'none'. De app heeft GEEN netwerk. Niet "alleen naar ons",
        maar geen. De enige weg naar RTG is de brug, en die loopt via het lid.
     4. DE INTEGRITEITSCONTROLE bij elke lezing (kern/appstore/bundel.js). Wat
        van schijf komt en niet overeenkomt met wat is goedgekeurd, komt er niet
        uit.

   WAAROM DEZE ROUTE GEEN INLOG VRAAGT. Een gepubliceerde bundel is publieke
   inhoud: elk lid met de app kan hem lezen, en er staat per definitie niets
   persoonlijks in -- persoonlijke gegevens komen alleen over de brug, en die
   zit wel achter een inlog. Zou hier een inlog staan, dan zou de browser de
   bundel niet mogen bewaren en werd elke opening opnieuw een verzoek. Dit is
   dus geen gat maar de reden dat het snel is: de hash staat in het pad, dus de
   inhoud is onveranderlijk en de browser bewaart hem voorgoed.
   ========================================================================== */
const zlib = require('zlib');

const { BRUGKLANT, celCsp, metBrug } = require('../../kern/appstore/brugklant');

module.exports = (kern) => {
  const { app, appstore, appstoreWinkel } = kern;

  const herkomst = (req) => (req.protocol || 'http') + '://' + (req.get('host') || 'localhost');

  /* De CSP en de brugklant komen uit kern/appstore/brugklant.js en staan niet
     meer hier. Reden: `rtg dev` serveert dezelfde cel op de machine van een
     ontwikkelaar en moet exact dezelfde twee gebruiken. Twee kopieen betekent
     dat ze een keer uiteenlopen, en dan is de fout "werkt lokaal, geblokkeerd in
     de cel" -- precies de ervaring die dit kanaal niet moet geven. */
  const CEL_CSP = celCsp;

  /* DE ENE KOP DIE HIER OMGEZET MOET WORDEN, EN WAAROM DAT GEEN VERZWAKKING IS.

     opzet/koppen.js zet op elk antwoord `Cross-Origin-Resource-Policy:
     same-origin`, en dat is goed: onze bestanden zijn geen bouwsteen voor de
     site van iemand anders. Maar de cel draait op een NAAMLOZE herkomst, en een
     naamloze herkomst is voor de browser per definitie een andere herkomst. Met
     same-origin blokkeert Chromium daarom de eigen app.js van de app EN de
     brugklant -- met ERR_BLOCKED_BY_RESPONSE.NotSameOrigin, in de cel, waar
     niemand het ziet. De naamloosheid die de veiligheid maakt, zou de app dus
     onbruikbaar maken.

     `cross-origin` is hier de juiste waarde en niet de zwakkere: deze bytes zijn
     PUBLIEKE inhoud (een gepubliceerde app-bundel, die elk lid mag lezen) en er
     staat per definitie niets persoonlijks in -- persoonlijke gegevens komen
     alleen over de brug, en die zit achter een inlog. Wat CORP hier zou
     beschermen, bestaat niet. Wat een andere site NIET kan, blijft staan:
     frame-ancestors laat alleen ons eigen scherm dit document insluiten. */
  const CEL_KOPPEN = (req, res) => {
    res.set('Content-Security-Policy', CEL_CSP(herkomst(req)));
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
  };

  /* GEMOUNT en niet als losse route. De eigen webmotor (server/web/routing.js)
     compileert alleen `:naam`-stukken tot params en zet bij een RegExp-pad
     bewust GEEN captures -- en een bundelpad is meerdere segmenten diep. Een
     mount is hier dus niet de omweg maar de rechte weg: hij strookt met wat de
     router kan, en het restpad lezen we zelf. */
  app.use('/appcel', (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const rest = String(req.url || '/').split('?')[0];

    if (rest === '/brug.js') {
      CEL_KOPPEN(req, res);
      res.set('Cache-Control', 'public, max-age=3600');
      return res.type('text/javascript').send(BRUGKLANT);
    }

    const m = /^\/([a-z][a-z0-9-]{2,39})\/([0-9a-f]{32})\/(.+)$/.exec(rest);
    if (!m) return next();
    const sleutel = m[1], hash = m[2];
    let pad;
    try { pad = decodeURIComponent(m[3]); } catch (e) { return res.status(400).type('text/plain').send('Dit pad is niet te lezen.'); }

    /* GRENS 5 in de praktijk: alleen de LIVE hash van een GEPUBLICEERDE app komt
       er nog uit. Een ingetrokken versie is op hetzelfde moment onbereikbaar als
       hij uit de winkel valt -- er is geen tweede plek die dat moet bijhouden. */
    if (!appstoreWinkel.magCel(sleutel, hash)) return res.status(404).type('text/plain').send('Deze app staat niet (meer) in de App Store.');

    const html = /\.html$/.test(pad);
    const wilGz = /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''));
    const b = appstore.opslag.lees(sleutel, hash, pad, !html && wilGz);
    if (!b) return res.status(404).type('text/plain').send('Dit bestand zit niet in deze versie.');

    CEL_KOPPEN(req, res);
    /* De hash staat in het pad, dus deze bytes veranderen nooit meer. Dit is de
       hele snelheidsbelofte: een tweede opening van een app is nul verzoeken. */
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('Vary', 'Accept-Encoding');
    res.type(b.mime);
    if (b.gz) { res.set('Content-Encoding', 'gzip'); return res.send(b.buf); }
    if (!html) return res.send(b.buf);

    const uit = Buffer.from(metBrug(b.buf.toString('utf8')), 'utf8');
    if (uit.length > 2048 && wilGz) {
      res.set('Content-Encoding', 'gzip');
      return res.send(zlib.gzipSync(uit, { level: 6 }));
    }
    res.send(uit);
  });
};
