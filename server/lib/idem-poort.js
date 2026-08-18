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

   DE TWEEDE BRON: DE VERKLAARDE SLEUTEL. Alleen de header bood geen antwoord op
   de 94 routes die de idemproef vond, want die stuurt zijn sleutel in de body.
   Daarom kent deze poort er een tweede bron bij: de verklaring die een route in
   ./idemsleutels.js over ZICHZELF aflegt.

   Staat daar dat een woordelijk gelijk verzoek een herhaling is, dan maakt de
   poort daar zelf een sleutel van -- de client hoeft niets te sturen, en de
   route hoeft geen regel te veranderen. Staat er dat de route juist NIET
   idempotent is (een dobbelworp, een teller), dan doet de poort niets.

   Waarom dat een verklaring is en geen slimmigheid: twee keer `{}` naar een
   dobbelworp zijn twee legitieme worpen. Een laag die generiek op inhoud
   dedupliceert, slikt die tweede stil op -- en een verdwenen worp valt niet op,
   een dubbele boeking wel. Idempotentie is een eigenschap van de HANDELING en
   valt niet te raden. Zie de kop van ./idemsleutels.js.

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

   ========================================================================== */
'use strict';

const crypto = require('crypto');
const { sleutelVoor, VENSTER_MS } = require('./idemsleutels');
/* De bewaarkast staat apart: dat is een gegevensstructuur (ring, vervaltijd,
   wat er wel en niet in mag) zonder een enkel begrip uit het web erin. Wat
   HIER staat is het http-deel: welke sleutel geldt, wie de afzender is, en wat
   er met een herhaling gebeurt. Zie de kop van ./idem-kast.js. */
const { maakKast, afdrukVan, MAX, TTL_MS } = require('./idem-kast');

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
  if (!v || v.nietIdempotent) return null;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (v.velden) {
    const uit = {};
    for (const veld of v.velden) uit[veld] = body[veld];
    return 'verklaard:' + crypto.createHash('sha256').update(JSON.stringify(uit)).digest('hex').slice(0, 32);
  }
  return 'verklaard:' + afdrukVan(body);
}

/* De poort zelf. `nu` is injecteerbaar zodat de verlooptoets niet hoeft te
   wachten; standaard is het de huisklok en niet Date.now(). */
function maakIdemPoort(opties) {
  const ttl = (opties && opties.ttl) || TTL_MS;
  const kast = maakKast(opties);

  const inVlucht = new Map(); // opslagsleutel -> { afdruk, belofte, klaar }

  function opslagsleutel(req, sleutel) {
    return crypto.createHash('sha256')
      .update(wieVan(req) + '\u0000' + req.method + '\u0000' + (req.path || req.url || '') + '\u0000' + sleutel)
      .digest('hex');
  }

  function middleware(req, res, next) {
    if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') return next();
    /* Twee bronnen, en de header wint. Stuurt een client een eigen sleutel, dan
       is dat een bewuste opdracht met een lang venster; de verklaring is de
       vangnet-vorm met het korte dubbeltikvenster. */
    const uitKop = sleutelVan(req);
    const sleutel = uitKop || verklaardeSleutel(req);
    if (!sleutel) return next();
    const vensterMs = uitKop ? ttl : VENSTER_MS;

    const id = opslagsleutel(req, sleutel);
    const afdruk = afdrukVan(req.body);

    const eerder = kast.haal(id);
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
      /* De kast beslist zelf of dit bewaard mag worden (alleen een geslaagd
         antwoord) en snoeit meteen daarna. Levert hij false, dan is er niets
         onthouden en mag een volgende poging het werk echt opnieuw doen. */
      if (kast.zet(id, { status, lijf, afdruk }, vensterMs)) rond({ status, lijf });
      else rond(null);
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

  middleware.omvang = () => kast.omvang();
  return middleware;
}

module.exports = maakIdemPoort;
module.exports._afdrukVan = afdrukVan;
module.exports._sleutelVan = sleutelVan;
module.exports._wieVan = wieVan;
module.exports.MAX = MAX;
module.exports.TTL_MS = TTL_MS;
