/* ============================================================================
   HET HANDELINGSSPOOR -- wie deed wat, wanneer.

   WAAROM DIT ER IS. De bewijsmatrix telt elf schakels per route, en de kolom
   AUDIT stond op 0 van 3987. Niet omdat de meter ontbrak, maar omdat er niets
   te meten viel: van de bijna vierduizend routes lieten er een handvol een
   spoor na. De hashketen lag er (lib/keten.js), maar onder vier journalen --
   inzage in de kluis, inloggen, het onderzoekslab en de boardroom van een lid.
   Voor alle andere schrijfacties kon niemand achteraf navertellen wat er was
   gebeurd, ook de betrokkene zelf niet.

   ------------------------------------------------------------------------
   WAT ER WEL IN GAAT, EN VOORAL WAT NIET

   Per geslaagde schrijfactie: het tijdstip, WIE (de pseudonieme sleutel, dus
   `user-42` en nooit een naam), de methode, het pad, de statuscode en een
   HASH van de body.

   DE BODY ZELF GAAT ER NOOIT IN, en dat is de dragende keuze van dit bestand.
   Een auditlog dat de inhoud bewaart, is een tweede kopie van alles wat er ooit
   is ingevuld -- adressen, gezondheidsgegevens, berichten -- op een plek die
   niet versleuteld is en die juist LANG bewaard blijft. Het verwerkingsregister
   zegt dat al over het inzagejournaal: "geen namen, anders was het een tweede
   onversleutelde kopie van de kluis". Dat geldt hier dubbel zo hard.

   Wat de afdruk wel kan: laten zien DAT twee handelingen hetzelfde verzoek
   waren, en dat een regel niet is bijgesteld. Wat hij niet kan: laten zien WAT
   er in stond. Dat is precies de bedoeling.

   ALLEEN GESLAAGDE SCHRIJFACTIES. Een 4xx of 5xx heeft niets veranderd, en een
   spoor dat elke mislukte poging bewaart, loopt vol met ruis van de
   schakelkast (elke gesloten functie geeft 503). Mislukte INLOGpogingen staan
   wel apart in het beveiligingslogboek: dat is een andere vraag met een ander
   doel, en die twee horen niet op een hoop.

   ------------------------------------------------------------------------
   WIE, EN WANNEER HET EERLIJKE ANTWOORD "NIEMAND" IS

   Bij een lid is `wie` de sessiesleutel: pseudoniem, herleidbaar via de
   gescheiden kluis, precies zoals de rest van dit huis met identiteit omgaat.

   Bij de GEDEELDE kantoorcode is er niemand aan te wijzen, en dan staat er
   'kantoor (gedeelde code)' in plaats van een verzonnen naam. Dat is dezelfde
   eerlijkheid als bij de pasbesluiten in routes/aanmeldingen.js, waar een
   terugval op 'RTG-personeel' ooit elk besluit ondertekende met iets wat geen
   naam is. Een auditlog dat altijd iemand aanwijst, wijst uiteindelijk niemand
   aan.

   ------------------------------------------------------------------------
   WAT ER GEBEURT BIJ "VERGEET MIJ"

   Het spoor blijft staan; de sleutel blijft. Dat is een keuze en geen
   vergissing: een auditspoor dat verdwijnt zodra de betrokkene erom vraagt, is
   geen auditspoor meer, en dat is precies waarom er codenamen in staan en geen
   namen. Na wissing verwijst `user-42` naar een account dat niet meer bestaat
   en is de kluis leeg -- de regel is er dan nog wel, en onherleidbaar.

   De bewaartermijn staat in server/bewaarbeleid.js (tak 'handelingLog') en het
   doel in VERWERKINGSREGISTER.md. Staat het daar niet, dan bestaat de termijn
   op papier en nergens anders.
   ========================================================================== */
'use strict';

const crypto = require('crypto');
const keten = require('./keten');
const klok = require('./klok');

const MAX = 50000;          // ruim genoeg voor een jaar bij dit verkeer, en begrensd
const SCHRIJFT = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/* Velden die niet in de afdruk horen: de idem-sleutel is geen inhoud, en vrije
   tekst maakt van twee gelijke handelingen twee verschillende. Zelfde lijst en
   zelfde reden als in lib/idem-poort.js. */
const BUITEN_AFDRUK = new Set(['idem', 'idempotentieSleutel', 'notitie', 'omschrijving', 'oms', 'toelichting']);

function afdrukVan(body) {
  if (!body || typeof body !== 'object') return '';
  const uit = {};
  for (const k of Object.keys(body).sort()) {
    if (BUITEN_AFDRUK.has(k)) continue;
    uit[k] = body[k];
  }
  try { return crypto.createHash('sha256').update(JSON.stringify(uit)).digest('hex').slice(0, 16); }
  catch (e) { return ''; }
}

/* WIE. Zie de kop: liever 'niemand aan te wijzen' dan een verzonnen naam. */
function wieVan(req) {
  const s = req.session;
  if (s && s.key) return String(s.key).slice(0, 60);
  const pad = String(req.path || req.url || '');
  if (pad.startsWith('/api/office') || pad.startsWith('/api/command')) return 'kantoor (gedeelde code)';
  if (pad.startsWith('/api/supplier') || pad.startsWith('/api/partner')) return 'partner (niet herleid)';
  return 'anoniem';
}

function maakHandelingsspoor({ db, save, nu, max }) {
  const tijd = nu || klok.nu;
  const grens = max || MAX;
  const eigen = require('../kern/eigencollectie')({ db, domein: 'lib/handelingsspoor', bezit: { handelingLog: 'lijst' } });

  const rij = () => eigen.bak('handelingLog');

  function noteer({ wie, methode, pad, status, afdruk }) {
    return keten.noteerIn(rij(), {
      at: new Date(tijd()).toISOString(),
      wie: String(wie || 'anoniem').slice(0, 60),
      methode: String(methode || '').slice(0, 10),
      pad: String(pad || '').slice(0, 200),
      status: Number(status) || 0,
      afdruk: String(afdruk || '')
    }, grens);
  }

  /* De ketenstand: klopt dit spoor nog met zichzelf? Zelfde vorm als bij de
     andere journalen, zodat een scherm ze naast elkaar kan tonen. */
  function ketenstand() {
    const l = rij();
    return Object.assign({ top: keten.top(l), regels: l.length }, keten.verifieer(l));
  }

  /* Lezen, nieuwste eerst. `over` filtert op een sleutel -- zodat een
     betrokkene zijn EIGEN handelingen kan opvragen zonder die van een ander te
     zien. De ketenstand gaat over het HELE spoor en niet over de selectie: een
     filter mag nooit bepalen of het bewijs klopt. Zelfde regel als bij het
     auditspoor van het onderzoekslab. */
  function lijst({ over, max: hoeveel } = {}) {
    const l = rij();
    const gefilterd = over ? l.filter(r => r.wie === String(over)) : l;
    return {
      totaal: gefilterd.length,
      regels: gefilterd.slice(0, Math.min(Number(hoeveel) || 200, 1000)),
      keten: ketenstand()
    };
  }

  /* De middleware, en hij hangt aan 'finish' EN NIET AAN res.json.

     Dat verschil is met een meter gevonden en het was een stil gat. De eerste
     opzet wikkelde res.json, want daar komt een API-antwoord uit. Maar
     server/middleware/compressie.js comprimeert elk antwoord boven ongeveer een
     kilobyte en stuurt dat met res.send -- volledig LANGS res.json heen. Elke
     geslaagde schrijfactie met een groot antwoord liet daardoor niets na, en
     precies de zwaarste handelingen hebben de grootste antwoorden.

     scripts/handelingproef-route.js vond het: /api/assets en
     /api/avond/voorkeuren gaven 200 en stonden niet in het spoor. Een auditlog
     dat zwijgt over wat er wél gebeurde is erger dan geen auditlog, want hij
     wekt vertrouwen.

     'finish' vuurt ongeacht hoe het antwoord is verstuurd -- json, send, end of
     een gecomprimeerde stroom. Bijkomend voordeel: het loggen gebeurt NA het
     antwoord, dus een journaalstoring kan de gebruiker niets meer kosten.

     'close' zonder 'finish' betekent een afgebroken verbinding: er is niets
     afgemaakt, en dan hoort er ook niets in het spoor. */
  function middleware(req, res, next) {
    if (!SCHRIJFT.has(req.method)) return next();
    res.on('finish', () => {
      const status = res.statusCode || 200;
      if (!(status >= 200 && status < 300)) return;
      try {
        noteer({ wie: wieVan(req), methode: req.method,
          pad: String(req.path || req.url || ''), status, afdruk: afdrukVan(req.body) });
        save();
      } catch (e) { /* een journaalstoring mag een handeling niet tegenhouden */ }
    });
    next();
  }

  return { middleware, noteer, lijst, ketenstand, MAX: grens };
}

module.exports = maakHandelingsspoor;
module.exports._afdrukVan = afdrukVan;
module.exports._wieVan = wieVan;
module.exports.MAX = MAX;
