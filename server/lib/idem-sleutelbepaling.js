/* WELKE SLEUTEL GELDT, EN VAN WIE.

   Dit stond in ./idem-poort.js, en die stond met 13,8 kB boven de maat. De naad
   die TAKEN.md 5.57 benoemt loopt hier: dit bestand beantwoordt "welke sleutel
   geldt en van wie", en de poort ernaast beantwoordt "wat gebeurt er met een
   herhaling". Dat zijn twee vragen, en de eerste is los te lezen en los te
   toetsen -- ze delen alleen de vingerafdruk uit ./idem-kast.js.

   Drie besluiten die hier wonen en die je bij het lezen van de poort niet meer
   ziet, maar die de uitkomst van elke herhaling bepalen:

     1. DE AFZENDER IS EEN HASH EN GEEN NAAM. De poort hoeft niet te weten wie
        er belt, alleen dat twee mensen nooit dezelfde opslagsleutel delen. Zo
        blijft het token uit het geheugen.
     2. `leest` SLUIT NET ZO HARD UIT ALS `nietIdempotent`. Dat stond er niet, en
        het kostte zeven toetsen: een lid dat iets bevestigde en meteen zijn
        lijst opvroeg, kreeg de LEGE lijst van ervoor terug.
     3. EEN EIGEN SLEUTEL VAN DE AANROEPER WINT VAN DE VERKLARING, ook als hij in
        het lijf zit. De verklaring is een vangnet voor wie niets meestuurt; wie
        wel iets meestuurt, heeft al gesproken.

   Draai los: node --test test/idem-poort.test.js */
'use strict';

const crypto = require('crypto');
const { sleutelVoor } = require('./idemsleutels');
const { afdrukVan } = require('./idem-kast');

const MAX_SLEUTEL = 200;        // langer is geen sleutel maar een payload

/* Wie stuurt dit? De poort hoeft niet te weten WIE het is, alleen dat twee
   verschillende mensen nooit dezelfde opslagsleutel delen. Een hash over het
   ruwe token is daarvoor genoeg en houdt het token uit het geheugen. */
function wieVan(req) {
  const auth = (typeof req.get === 'function' && req.get('authorization')) || '';
  if (auth) return crypto.createHash('sha256').update(auth).digest('hex').slice(0, 32);
  const cookie = (typeof req.get === 'function' && req.get('cookie')) || '';
  if (cookie) return crypto.createHash('sha256').update(cookie).digest('hex').slice(0, 32);
  return 'anon:' + (req.ip || '');
}

/* De header. Zie de kop voor waarom `idem` uit de body hier bewust NIET
   meetelt: dat veld is van de applicatielaag. */
function sleutelVan(req) {
  const ruw = (typeof req.get === 'function' && req.get('idempotency-key')) || '';
  if (typeof ruw !== 'string' || !ruw) return null;
  const s = ruw.trim();
  if (!s || s.length > MAX_SLEUTEL) return null;
  return s;
}

/* DE VERKLAARDE SLEUTEL -- het dubbeltikvenster.

   Naast de header kent deze poort een tweede bron: de verklaring die een route
   in ./idemsleutels.js over zichzelf aflegt. Staat daar dat een woordelijk
   gelijk verzoek een herhaling is, dan maakt de poort daar zelf een sleutel van
   -- zonder dat de client iets hoeft mee te sturen.

   Waarom dat niet generiek voor ALLE routes gebeurt, staat in de kop van
   idemsleutels.js. Kort: twee keer `{}` naar een dobbelworp zijn twee worpen,
   en een laag die dat opslikt is erger dan het probleem.

   Het venster is kort (seconden, niet uren): dit is de maat van een dubbeltik,
   niet van een bewuste tweede handeling. Een expliciete Idempotency-Key houdt
   zijn eigen, veel langere venster. */
function verklaardeSleutel(req) {
  const v = sleutelVoor(req.method, req.path || req.url || '');
  /* `leest` HOORT HIER NET ZO HARD UIT ALS `nietIdempotent`, en dat stond er
     niet. De verklaring van { leest: true } luidt met zoveel woorden "de poort
     doet hier niets": een POST die niets verandert valt niets te dedupliceren.
     Zonder deze regel kreeg zo'n route toch een verklaarde sleutel, en dus werd
     hij binnen het venster HERHAALD -- met het antwoord van de vorige keer.

     Dat is geen theoretisch lek. /api/reis/reizen en /api/reis/invoer/mijn
     staan allebei als `leest` verklaard; een lid dat een reisonderdeel
     bevestigde en meteen zijn reizen opvroeg, kreeg de LEGE lijst van ervoor
     terug -- met `herhaald: true` erin, waar niemand naar keek. Vier toetsen in
     test/invoer.test.js en drie in test/reisactiviteiten.test.js zakten hierop,
     en in de app zou het lezen als "mijn boeking is niet aangekomen".

     28 van de 85 verklaringen zeggen `leest`. Ze deden alle 28 hetzelfde. */
  if (!v || v.nietIdempotent || v.leest) return null;
  const body = req.body && typeof req.body === 'object' ? req.body : {};

  /* EEN EIGEN SLEUTEL VAN DE AANROEPER WINT VAN DE VERKLARING, OOK ALS HIJ IN
     HET LIJF ZIT.

     De header wint hierboven al (zie de aanroep). Maar dit huis draagt zijn
     idempotentiesleutel meestal in het LIJF -- `idem` of `idempotentieSleutel`,
     zie middleware/idempotentie.js en lib/idem.js -- en die zag deze poort niet.
     Gevolg: bij een route met `zelfdeVerzoek` besliste de VINGERAFDRUK van het
     lijf, en die is voor twee inhoudelijk gelijke verzoeken dezelfde, hoe vers
     de sleutel ook is die de aanroeper meestuurde.

     Dat brak precies wat een verse sleutel BETEKENT. `bank/pas/uitgeven` met
     dezelfde iban en soort maar een nieuwe sleutel is een tweede pas die het lid
     bewust aanvraagt; `supplier/betaalverzoek` met een nieuwe sleutel is een
     tweede verzoek dat de zaak bewust verstuurt. De poort gaf allebei het
     antwoord van de eerste keer terug. Vier toetsen in test/bank.test.js en
     test/directpay.test.js zakten hierop, en in de app zou het lezen als "mijn
     tweede pas is nooit gekomen".

     De verklaring is een VANGNET voor wie niets meestuurt. Wie wel iets
     meestuurt, heeft al gesproken -- en dan hoort de laag die die sleutel
     werkelijk kent (de duurzame geldlaag, of middleware/idempotentie.js) te
     beslissen, niet een vingerafdruk die de sleutel niet eens ziet. */
  const eigen = typeof body.idempotentieSleutel === 'string' ? body.idempotentieSleutel
    : (typeof body.idem === 'string' ? body.idem : null);
  if (eigen && eigen.trim()) return null;

  if (v.velden) {
    const uit = {};
    for (const veld of v.velden) uit[veld] = body[veld];
    return 'verklaard:' + crypto.createHash('sha256').update(JSON.stringify(uit)).digest('hex').slice(0, 32);
  }
  return 'verklaard:' + afdrukVan(body);
}

module.exports = { wieVan, sleutelVan, verklaardeSleutel, MAX_SLEUTEL };
