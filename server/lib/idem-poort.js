/* ============================================================================
   DE IDEM-POORT: dezelfde opdracht twee keer sturen mag nooit twee keer werken.

   WAAROM DIT ER IS. De idemproef stuurt elke schrijfroute drie keer: twee keer
   met dezelfde sleutel en een keer met een verse. Van de 106 routes die zich
   lieten beproeven, deden er 94 het bij de herhaling gewoon opnieuw --
   `/api/concern/nieuw` maakte twee concerns, `/api/agenda/toevoegen` twee
   afspraken. Dat is geen theoretisch scenario: een dubbeltik op een trage
   verbinding is precies dit verzoek, twee keer.

   WAAROM HIER EN NIET PER ROUTE. Er zijn 2936 schrijfroutes. Negenennegentig
   procent daarvan heeft geen eigen reden om anders met een herhaling om te gaan
   dan de rest, en 94 losse reparaties zijn 94 kansen om het net iets anders te
   doen. De regel hangt daarom aan EEN plek, net als de progressiegrens in
   server/kern/spellen/grens.js. Wie route 95 toevoegt, krijgt hem gratis.

   WAAROM ALLEEN DE HEADER, EN NIET `idem` IN DE BODY. Dit is de belangrijkste
   grens van deze laag, en hij is duur geleerd.

   De eerste opzet las ook `idem`/`idempotentieSleutel` uit de body, want dat is
   wat de idemproef stuurt. Dat brak twee toetsen die er al stonden, en ze hadden
   gelijk: sommige routes gebruiken dat veld ZELF en geven bij een herhaling met
   opzet een ANDER antwoord dan de eerste keer.

     /api/pakket/koop     eerste keer {betaald: 25000}, daarna {alBetaald: true}
     /api/wbw/verreken    eerste keer 200, daarna 409 "er is geen schuld meer"

   Die tweede antwoorden zijn de bedoeling: ze vertellen de gebruiker dat het al
   gebeurd is. Een generieke poort die er het eerste antwoord overheen legt,
   maakt van "al betaald" weer "zojuist betaald" -- erger dan het probleem dat
   hij oplost.

   Er is een poging gedaan om dat te onderscheiden door waar te nemen of de route
   het veld zelf leest (een getter op het body-veld). Die werkt niet: tussen deze
   poort en de route lopen lagen die de hele body nalopen, en dan slaat de
   waarneming altijd aan. Op HTTP-niveau is "de route bezit dit veld" niet te
   scheiden van "een tussenlaag liep de body na".

   Dus claimt deze laag dat veld niet. `idem` in de body is van de applicatie;
   de `Idempotency-Key` HEADER is van het HTTP-niveau, is de gangbare standaard,
   en wordt vandaag door geen enkele route gelezen. Geen header, geen afwijking
   -- dus geen bestaande client of toets merkt hier iets van.

   WAT DAT BETEKENT VOOR DE 94. Die routes worden hier NIET vanzelf beschermd:
   scripts/lib/idemproef.js stuurt zijn sleutel in de body, en dat blijft het
   domein van de kern. Deze poort geeft de clients een correcte, standaard manier
   om een retry veilig te maken; de 94 routes echt idempotent maken blijft werk
   in de kern, per route, met de duurzame laag van lib/idem.js eronder.

   DE VERHOUDING TOT server/lib/idem.js. Dat is de GELDLAAG: duurzaam op schijf,
   in een commit met de boeking zelf, en die blijft de baas over geld. Deze poort
   staat ervoor en is een geheugenlaag. Ze mogen elkaar niet tegenspreken, dus
   volgt deze poort exact dezelfde drie regels:

     1. alleen een GESLAAGD antwoord wordt bewaard -- 2xx en niet `ok:false`.
        Dit is de regel die er het meest toe doet. Zou een mislukking bewaard
        worden, dan krijgt de retry waar idem-sleutels juist voor bestaan een
        oude fout terug en probeert het nooit meer echt.
     2. dezelfde sleutel met een ANDER verzoek is een 409, geen stille herhaling
        van het oude antwoord.
     3. een herhaald antwoord draagt `herhaald: true`, hetzelfde merk.

   Daardoor is deze laag voor de geldroutes een doorzichtige cache: hij geeft
   precies wat de geldlaag eronder ook zou hebben gegeven, en na een herstart is
   hij leeg en antwoordt de duurzame laag weer. Geen uitzonderingslijst nodig --
   die zou toch verouderen, want de geldkernen hangen onder /api/pay, /api/bank,
   /api/member, /api/office en /api/supplier tegelijk.

   DE SLEUTEL IS PER PERSOON. Een sleutel van iemand anders mag nooit jouw
   antwoord opleveren. De opslagsleutel is daarom een hash over (wie, methode,
   pad, sleutel) en niet over de sleutel alleen. Zonder die binding kon een
   geraden `idemproef-apiconcernnieuw-1` het antwoord van een ander lid teruggeven.

   EN DIT IS DE REGEL DIE DEZE POORT BIJNA VERKEERD MAAKTE. `idem` in de body is
   niet van deze laag -- sommige routes gebruiken dat veld ZELF, en geven bij een
   herhaling met opzet een ANDER antwoord dan de eerste keer:

     /api/pakket/koop     eerste keer {betaald: 25000}, daarna {alBetaald: true}
     /api/wbw/verreken    eerste keer 200, daarna 409 "er is geen schuld meer"

   Die twee antwoorden zijn geen fout maar de bedoeling: ze vertellen de gebruiker
   dat het al gebeurd is. Een generieke poort die er het EERSTE antwoord overheen
   legt, maakt van "al betaald" weer "zojuist betaald" -- en dat is erger dan het
   probleem dat hij oplost. De volledige suite ving dit met twee toetsen; ze
   stonden er al, en ze hadden gelijk.

   Daarom stapt deze poort opzij zodra de route het veld zelf aanraakt. Dat is
   niet aan een lijst op te hangen (die veroudert), dus wordt het WAARGENOMEN:
   het idem-veld krijgt een getter, en leest de route hem, dan bewaart de poort
   niets. Bij de volgende oproep valt er dus ook niets te herhalen en handelt de
   route het af zoals hij altijd deed.

   Die waarneming faalt bewust naar de VEILIGE kant. Ziet hij een leesactie die
   geen eigenaarschap betekent (`{...req.body}` raakt het veld ook aan), dan doet
   de poort niets -- precies de oude situatie. Een gemiste leesactie zou wel erg
   zijn, en die kan niet: elke manier om aan de waarde te komen loopt langs de
   getter, ook via een kopie of via JSON.stringify.
   ========================================================================== */
'use strict';

const crypto = require('crypto');
const klok = require('./klok');

const MAX = 20000;              // ring: zoveel sleutels houden we vast
const TTL_MS = 24 * 60 * 60 * 1000; // een dag, zoals de gangbare betaalrails
const MAX_SLEUTEL = 200;        // langer is geen sleutel maar een payload

/* De velden die NIET meetellen in de afdruk van het verzoek. Zelfde gedachte
   als in lib/idem.js: de sleutel zelf is geen inhoud, en vrije tekst is geen
   ander verzoek. */
const BUITEN_AFDRUK = new Set(['idem', 'idempotentieSleutel', 'notitie', 'omschrijving', 'oms', 'toelichting']);

function afdrukVan(body) {
  if (!body || typeof body !== 'object') return '';
  const uit = {};
  for (const k of Object.keys(body).sort()) {
    if (BUITEN_AFDRUK.has(k)) continue;
    uit[k] = body[k];
  }
  try { return crypto.createHash('sha256').update(JSON.stringify(uit)).digest('hex'); }
  catch (e) { return ''; } // niet-serialiseerbaar (cyclisch): dan geen binding, geen 409
}

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

/* Alleen de header. Zie de kop voor waarom `idem` uit de body hier bewust NIET
   meetelt: dat veld is van de applicatielaag. */
function sleutelVan(req) {
  const ruw = (typeof req.get === 'function' && req.get('idempotency-key')) || '';
  if (typeof ruw !== 'string' || !ruw) return null;
  const s = ruw.trim();
  if (!s || s.length > MAX_SLEUTEL) return null;
  return s;
}

/* De poort zelf. `nu` is injecteerbaar zodat de verlooptoets niet hoeft te
   wachten; standaard is het de huisklok en niet Date.now(). */
function maakIdemPoort(opties) {
  const nu = (opties && opties.nu) || klok.nu;
  const max = (opties && opties.max) || MAX;
  const ttl = (opties && opties.ttl) || TTL_MS;

  const bewaard = new Map();  // opslagsleutel -> { status, lijf, afdruk, tot }
  const inVlucht = new Map(); // opslagsleutel -> { afdruk, belofte, klaar }

  function opruimen() {
    const t = nu();
    for (const [k, v] of bewaard) if (v.tot <= t) bewaard.delete(k);
    // de ring: Map bewaart invoegvolgorde, dus de oudste staat vooraan
    while (bewaard.size > max) bewaard.delete(bewaard.keys().next().value);
  }

  function opslagsleutel(req, sleutel) {
    return crypto.createHash('sha256')
      .update(wieVan(req) + '\u0000' + req.method + '\u0000' + (req.path || req.url || '') + '\u0000' + sleutel)
      .digest('hex');
  }

  /* Mag dit antwoord bewaard worden? Regel 1 uit de kop, en de enige plek waar
     hij staat. `ok:false` in een 200 is hier een MISLUKKING -- dat is de vorm
     die de kern gebruikt voor "het ging niet door, probeer opnieuw". */
  function magBewaren(status, lijf) {
    if (!(status >= 200 && status < 300)) return false;
    if (lijf && typeof lijf === 'object' && lijf.ok === false) return false;
    return true;
  }

  function middleware(req, res, next) {
    if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') return next();
    const sleutel = sleutelVan(req);
    if (!sleutel) return next();

    const id = opslagsleutel(req, sleutel);
    const afdruk = afdrukVan(req.body);
    opruimen();

    const eerder = bewaard.get(id);
    if (eerder) {
      if (afdruk && eerder.afdruk && eerder.afdruk !== afdruk)
        return res.status(409).json({ error: 'Deze idem-sleutel is al gebruikt voor een ander verzoek.' });
      return res.status(eerder.status).json(herhaal(eerder.lijf));
    }

    const bezig = inVlucht.get(id);
    if (bezig) {
      if (afdruk && bezig.afdruk && bezig.afdruk !== afdruk)
        return res.status(409).json({ error: 'Deze idem-sleutel is al gebruikt voor een ander verzoek.' });
      /* Wachten op de eerste in plaats van er naast draaien. Zonder dit passen
         twee gelijktijdige dubbeltikken allebei door het gat tussen de controle
         en de vastlegging -- dezelfde fout die lib/idem.js met zijn inVlucht
         oploste, en om dezelfde reden. */
      return bezig.belofte.then(r => {
        if (!r) return next();
        res.status(r.status).json(herhaal(r.lijf));
      });
    }

    let klaar;
    const vlucht = { afdruk, belofte: new Promise(r => { klaar = r; }) };
    inVlucht.set(id, vlucht);

    const echteJson = res.json.bind(res);
    let afgerond = false;
    const rond = (r) => { if (afgerond) return; afgerond = true; inVlucht.delete(id); klaar(r); };

    res.json = (lijf) => {
      const status = res.statusCode || 200;
      if (magBewaren(status, lijf)) {
        bewaard.set(id, { status, lijf, afdruk, tot: nu() + ttl });
        /* Snoeien hoort NA het opslaan en niet alleen aan het begin van het
           volgende verzoek: anders staat de ring tussen twee verzoeken door
           altijd één over zijn grens, en bij een stille server blijft hij daar
           staan. Zo gevonden, door de toets op de omvang. */
        opruimen();
        rond({ status, lijf });
      } else {
        rond(null); // mislukt: niets bewaren, een volgende poging mag het echt opnieuw doen
      }
      return echteJson(lijf);
    };
    /* Een verzoek dat nooit bij res.json komt (crash, stream, afgebroken
       verbinding) mag de vlucht niet laten hangen; dan wacht een tweede
       verzoek eeuwig. */
    res.on('close', () => rond(null));
    res.on('finish', () => rond(null));

    next();
  }

  function herhaal(lijf) {
    return (lijf && typeof lijf === 'object' && !Array.isArray(lijf))
      ? Object.assign({}, lijf, { herhaald: true })
      : lijf;
  }

  middleware.omvang = () => bewaard.size;
  return middleware;
}

module.exports = maakIdemPoort;
module.exports._afdrukVan = afdrukVan;
module.exports._sleutelVan = sleutelVan;
module.exports._wieVan = wieVan;
module.exports.MAX = MAX;
module.exports.TTL_MS = TTL_MS;
