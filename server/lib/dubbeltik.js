/* ============================================================================
   DE DUBBELTIK -- een herhaald schrijfverzoek doet het werk één keer.

   WAT DIT REPAREERT, GEMETEN EN NIET GEVOELD. `npm run idemproef` stuurt elke
   schrijfroute drie keer: twee keer met dezelfde sleutel en één keer met een
   verse, en kijkt of de herhaling iets nieuws deed. De stand op 18 augustus
   2026: 15 routes beschermd, **100 onbeschermd**, de rest ongemeten. Die honderd
   zijn geen randgevallen -- er staan `POST /api/concern/nieuw`,
   `POST /api/agenda/toevoegen` en `POST /api/meet/maak` tussen. Een load
   balancer die één keer opnieuw probeert, of een telefoon die tijdens het
   verzenden van netwerk wisselt, maakt daar twee bedrijven van.

   WAT ER AL WAS EN WAAROM DAT NIET GENOEG WAS. server/lib/idem.js doet dit voor
   geld, DUURZAAM (de sleutel gaat mee in dezelfde commit als de boeking) en met
   een afdruk van de geld-bepalende velden. Dat is de zwaarste variant en die
   hoort daar ook. Maar hij hangt aan een opslaglaag met een eigen naam
   ('payIdem', 'bankIdem') en aan het werk dat eromheen staat; hem honderd keer
   aansluiten zou honderd routes en honderd sleutelnamen betekenen. Deze laag
   staat daarom vóór de routes, kent geen enkele route, en doet één ding: hij
   herkent een herhaling.

   DRIE GRENZEN, EN ZE STAAN HIER OMDAT ZE ANDERS ONZICHTBAAR ZIJN.

   1. HIJ WERKT ALLEEN ALS DE AANROEPER EEN SLEUTEL MEEGEEFT (`idem` of
      `idempotentieSleutel` in het lijf, of de kop `Idempotency-Key`). Zonder
      sleutel verandert er niets -- en dat is met opzet. Twee identieke verzoeken
      zonder sleutel MOGEN twee notities zijn; wie dat blind zou samenvouwen,
      breekt "voeg tweemaal hetzelfde item toe" voor iedereen. De belofte van
      deze kolom is dan ook precies dat: dezelfde SLEUTEL doet het werk één keer.

   2. HIJ LEEFT IN HET GEHEUGEN VAN ÉÉN PROCES. Na een herstart is de kast leeg,
      en bij meerdere instances kent instance B de sleutel van instance A niet.
      Voor geld is dat niet goed genoeg -- daarom blijft idem.js daar staan, mét
      duurzame commit. Voor "maak een agenda-item" is het de juiste maat: het
      venster van een dubbeltik of een retry is seconden, geen dagen.

   3. EEN ANDER LIJF ONDER DEZELFDE SLEUTEL WORDT DOORGELATEN, niet geweigerd.
      Verleidelijk om daar 409 op te geven (idem.js doet dat), maar die laag weet
      WELKE velden het verzoek bepalen; deze niet. Een geldroute mag een andere
      omschrijving bij dezelfde betaling krijgen, en een 409 daarop zou werkende
      apps breken. Doorlaten betekent hier: precies wat er vandaag ook gebeurt.
      De geldroutes houden hun eigen, strengere oordeel.

   WAT ER NIET WORDT BEWAARD. Alleen antwoorden met een 2xx. Een mislukte poging
   hoort herhaalbaar te zijn -- dat is het hele punt van opnieuw proberen. En
   alleen JSON: deze laag hangt aan res.json, want een bestandsdownload of een
   stream laat zich niet in een kast leggen.
   ========================================================================== */
'use strict';

const crypto = require('crypto');
const klok = require('./klok');

const SCHRIJFT = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const STANDAARD_TTL = 10 * 60 * 1000;   // een retry-venster is seconden; tien minuten is ruim
const STANDAARD_MAX = 5000;

/* De sleutelvelden gaan NIET mee in de afdruk: ze zijn de sleutel, niet het
   verzoek. Zonder deze uitzondering zou elke afdruk per definitie kloppen en
   zou punt 3 hierboven nooit afgaan. */
const SLEUTELVELDEN = new Set(['idem', 'idempotentieSleutel', 'idempotencyKey']);

function canoniek(waarde) {
  const orden = (v) => {
    if (Array.isArray(v)) return v.map(orden);
    if (v && typeof v === 'object') {
      const uit = {};
      for (const k of Object.keys(v).sort()) if (!SLEUTELVELDEN.has(k) && v[k] !== undefined) uit[k] = orden(v[k]);
      return uit;
    }
    return v;
  };
  try { return JSON.stringify(orden(waarde)); } catch (e) { return ''; }
}

const hash = (tekst) => crypto.createHash('sha256').update(String(tekst)).digest('hex').slice(0, 32);

function sleutelUit(req) {
  const lijf = req.body && typeof req.body === 'object' ? req.body : {};
  const ruw = lijf.idem || lijf.idempotentieSleutel || lijf.idempotencyKey || req.get('idempotency-key');
  if (!ruw || typeof ruw !== 'string') return null;
  const s = ruw.trim();
  /* Een sleutel van één teken is geen sleutel maar een botsing die staat te
     wachten: twee gebruikers die allebei "1" sturen. De ondergrens is laag
     gehouden omdat bestaande apps korte prefixen gebruiken ('bv-<ref>'). */
  return s.length >= 6 && s.length <= 200 ? s : null;
}

/* WIE de herhaling stuurt hoort in de sleutel. Deze laag draait VOOR de
   inlogcontrole, dus er is nog geen account -- wel de aangeboden legitimatie.
   Die gaat er gehasht in: twee leden die dezelfde sleutel kiezen krijgen zo
   nooit elkaars antwoord te zien, en er staat geen token in het geheugen. */
function wieHash(req) {
  const kop = req.get('authorization') || '';
  const koek = req.get('cookie') || '';
  if (kop || koek) return hash(kop + '|' + koek);
  return hash('ip|' + (req.ip || ''));
}

function maakDubbeltik(opties) {
  const o = opties || {};
  const ttl = o.ttlMs || STANDAARD_TTL;
  const max = o.max || STANDAARD_MAX;
  const nu = o.nu || klok.nu;
  const overslaan = o.overslaan || (() => false);
  const log = o.log || null;

  const kast = new Map();   // id -> { afdruk, klaar, status, data, at, wachters[] }
  const gemist = new Set();  // paden die al een keer gemeld zijn (zie res.on('finish'))
  const staat = { gezien: 0, herhaald: 0, doorgelaten: 0, bewaard: 0, gemist: 0 };

  function veeg() {
    const grens = nu() - ttl;
    for (const [id, rij] of kast) if (rij.at && rij.at < grens) kast.delete(id);
    /* Blijft hij dan nog te groot, dan valt de oudste eraf. Een kast die
       ongelimiteerd groeit is een geheugenlek met een nette naam. */
    while (kast.size > max) kast.delete(kast.keys().next().value);
  }

  function wek(rij, uitslag) {
    const wachters = rij.wachters;
    rij.wachters = [];
    for (const w of wachters) { try { w(uitslag); } catch (e) { /* een wachter mag de rest niet meenemen */ } }
  }

  function herhaal(res, rij) {
    staat.herhaald++;
    res.set('x-rtg-herhaald', '1');
    const data = rij.data;
    /* `herhaald: true` is het merk waaraan zowel een client als de idemproef
       ziet dat de server de herhaling zelf herkende -- een mededeling, geen
       gevolgtrekking uit een vergelijking. Bij een lijst kan dat merk niet in
       het lijf; dan doet de kop het werk. */
    if (data && typeof data === 'object' && !Array.isArray(data)) return res.status(rij.status).json(Object.assign({}, data, { herhaald: true }));
    return res.status(rij.status).json(data);
  }

  function middleware() {
    return function dubbeltik(req, res, next) {
      if (!SCHRIJFT.has(req.method)) return next();
      if (overslaan(req)) return next();
      const sleutel = sleutelUit(req);
      if (!sleutel) return next();

      const id = wieHash(req) + ':' + hash(req.method + ' ' + req.path + ' ' + sleutel);
      const afdruk = hash(canoniek(req.body));
      staat.gezien++;

      const bestaand = kast.get(id);
      if (bestaand) {
        if (bestaand.afdruk !== afdruk) { staat.doorgelaten++; return next(); }   // grens 3
        if (bestaand.klaar) return herhaal(res, bestaand);
        /* IN VLUCHT. Het eerste verzoek is nog bezig; het tweede wacht op
           diens uitslag in plaats van het werk nog een keer te doen. Zonder dit
           venster passen twee gelijktijdige verzoeken er allebei doorheen --
           precies het geval waar een dubbeltik uit bestaat. */
        return bestaand.wachters.push((uitslag) => {
          if (uitslag && uitslag.klaar) return herhaal(res, uitslag);
          next();   // het eerste verzoek mislukte: dit mag het gewoon proberen
        });
      }

      const rij = { afdruk, klaar: false, status: 200, data: null, at: nu(), wachters: [] };
      kast.set(id, rij);
      if (kast.size > max) veeg();

      const echteJson = res.json.bind(res);
      res.json = (data) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          rij.status = res.statusCode; rij.data = data; rij.klaar = true; rij.at = nu();
          staat.bewaard++;
          wek(rij, rij);
        } else {
          kast.delete(id);
          wek(rij, null);
        }
        return echteJson(data);
      };
      /* Geen JSON-antwoord (een download, een redirect, een stream) of een
         verbinding die afbreekt: dan is er niets om te herhalen, en een rij die
         voor eeuwig "in vlucht" staat zou elke volgende poging laten hangen. */
      res.on('finish', () => {
        if (rij.klaar) return;
        kast.delete(id);
        wek(rij, null);
        /* EN ALS ER WEL EEN GESLAAGD ANTWOORD WAS, ZEG HET DAN. Dit is de fout
           die deze laag bijna stil om zeep hielp: jsonGzip() verving res.json NA
           de dubbeltik en stuurde grote antwoorden via res.send, zodat er niets
           te bewaren viel -- alleen bij antwoorden boven de kilobyte, alleen bij
           clients die compressie vragen. Een beschermlaag die onder die
           voorwaarden stil afhaakt, is erger dan geen beschermlaag. Dus: één
           melding per pad, niet per verzoek, want een storm helpt niemand. */
        if (res.statusCode >= 200 && res.statusCode < 300 && !gemist.has(req.path)) {
          gemist.add(req.path);
          staat.gemist++;
          const zin = '[dubbeltik] ' + req.method + ' ' + req.path + ' gaf een geslaagd antwoord buiten res.json om; ' +
            'deze route is NIET tegen dubbeltik beschermd. Staat er een nieuwe res.json-wikkel na de dubbeltik?';
          if (log && typeof log.warn === 'function') log.warn(zin); else console.warn(zin);
        }
      });
      res.on('close', () => { if (!rij.klaar) { kast.delete(id); wek(rij, null); } });
      next();
    };
  }

  return { middleware, staat: () => Object.assign({ inKast: kast.size }, staat), veeg, kast };
}

module.exports = { maakDubbeltik, canoniek, sleutelUit, SCHRIJFT };
