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

module.exports = (kern) => {
  const { app, appstore, appstoreWinkel } = kern;

  const herkomst = (req) => (req.protocol || 'http') + '://' + (req.get('host') || 'localhost');

  /* De CSP van de cel. Alles staat op 'none' en wat een app nodig heeft komt er
     stuk voor stuk bij -- en niet andersom, want dan is elke nieuwe browserfunctie
     stilzwijgend toegestaan. 'self' matcht niet in een naamloze herkomst; daarom
     staat de eigen herkomst er expliciet bij. */
  const CEL_CSP = (o) =>
    "default-src 'none'; script-src " + o + "; style-src " + o + " 'unsafe-inline'; " +
    "img-src " + o + " data:; font-src " + o + "; media-src " + o + " data:; " +
    "connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; " +
    "frame-ancestors " + o + "; sandbox allow-scripts";

  /* De brugklant: het ENIGE stuk code in de cel dat van RTG is. Hij wordt in elk
     celdocument gezet (zie hieronder), zodat een app hem niet kan vergeten en
     niet kan vervangen: een app die zelf naar `parent` reikt, is bij de keuring
     al afgekeurd (kern/appstore/keuring.js, VERBODEN_JS). */
  const BRUGKLANT = `(function(){'use strict';
var nr=0,open={};
function terug(e){ if(e.source!==window.parent) return; var d=e.data;
  if(!d||d.rtgcel!==1||typeof d.nr!=='number') return; var w=open[d.nr]; if(!w) return; delete open[d.nr];
  if(d.error) w.nee(new Error(d.error)); else w.ja(d.uit); }
window.addEventListener('message',terug,false);
function roep(methode,args){ return new Promise(function(ja,nee){
  var n=++nr; open[n]={ja:ja,nee:nee};
  setTimeout(function(){ if(open[n]){ delete open[n]; nee(new Error('De brug antwoordde niet op tijd.')); } },15000);
  window.parent.postMessage({rtgcel:1,nr:n,methode:String(methode),args:args||{}},'*'); }); }
window.RTG={ roep:roep, versie:1,
  /* Wat een app NIET van de brug krijgt, staat hier zodat het in de console van
     de bouwer zichtbaar is en niet in een document dat hij nooit opent. */
  nietGebouwd:{ netwerk:'Een cel heeft geen netwerk. Alles loopt via RTG.roep().',
    naam:'Een app van derden krijgt een codenaam, nooit een echte naam.',
    push:'Er is geen kanaal dat een telefoon laat trillen.' } };
})();`;

  /* GEMOUNT en niet als losse route. De eigen webmotor (server/web/routing.js)
     compileert alleen `:naam`-stukken tot params en zet bij een RegExp-pad
     bewust GEEN captures -- en een bundelpad is meerdere segmenten diep. Een
     mount is hier dus niet de omweg maar de rechte weg: hij strookt met wat de
     router kan, en het restpad lezen we zelf. */
  /* Het brugscript in elk celdocument zetten. Eerst in de <head>, zodat de app
     RTG.roep() al heeft voordat zijn eigen code draait. Geen <head>? Dan
     vooraan; de browser hangt hem alsnog in de head die hij zelf maakt.

     Injecteren en niet vragen om een <script src="/appcel/brug.js">: zo kan een
     app hem niet vergeten en niet vervangen. Zelf naar `parent` reiken is bij de
     keuring al afgekeurd (kern/appstore/keuring.js, VERBODEN_JS). */
  function metBrug(html) {
    const tag = '<script src="/appcel/brug.js"></script>';
    return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + tag) : tag + html;
  }

  app.use('/appcel', (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const rest = String(req.url || '/').split('?')[0];

    if (rest === '/brug.js') {
      res.set('Content-Security-Policy', CEL_CSP(herkomst(req)));
      res.set('X-Content-Type-Options', 'nosniff');
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

    res.set('Content-Security-Policy', CEL_CSP(herkomst(req)));
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
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
