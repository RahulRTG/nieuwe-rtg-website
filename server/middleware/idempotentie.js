/* DE IDEMPOTENTIELAAG -- een sleutel, een uitvoering, altijd hetzelfde antwoord.

   WAAROM DIT ER IS. De staatproef stuurde bij elke POST een idempotentiesleutel
   mee en mat wat de herhaling deed: 128 routes voerden het werk gewoon nog een
   keer uit (het commandjournaal groeide, een agendapunt kwam er twee keer in).
   De geldlaag kent het begrip al jaren (betaal.js, pay, bank geven de sleutel
   door aan Mollie/Stripe/Adyen), maar elke andere route had niets -- en 128
   pleisters op 128 routes is precies de fout die LAT.md regel 4 verbiedt. Dit
   is de ene plek.

   HOE HIJ WERKT, en elke keuze staat er met zijn reden:

   - OPT-IN. Alleen een POST op /api/ waarvan het lijf zelf een sleutel draagt
     (`idempotentieSleutel` of `idem`) doet mee. Wie geen sleutel stuurt, krijgt
     het oude gedrag; deze laag verandert niets aan verzoeken die er niet om
     vragen.
   - EN HIJ GAAT NIET VOOR EEN SPECIALIST STAAN. Dat is de duurste les van deze
     laag. De geldkant doet idempotentie al jaren zelf, en RIJKER dan een kas met
     eerste antwoorden ooit kan: /api/pakket/koop meldt `alBetaald: true`,
     /api/wbw/verreken geeft bij een tweede tik een 409 omdat er geen schuld meer
     is, en /api/pay/stuur geeft 409 als dezelfde sleutel met een ANDER bedrag
     terugkomt (een vrije omschrijving telt daar niet mee). Zulke antwoorden
     hangen af van de toestand NA de eerste aanroep; een bewaard eerste antwoord
     kan ze per definitie niet bevatten.

     Deze laag stond er blind voor en gaf overal het kale eerste antwoord terug.
     Zestien toetsen zakten daarop -- van "dubbel tikken laadt nooit dubbel" tot
     "ander bedrag onder dezelfde sleutel is een conflict" -- en ze zakten STIL,
     want na die verandering is er geen volle suite meer gedraaid. Het gevaarlijkst
     was /api/pay/stuur: daar maakte deze laag van een geweigerd conflict een
     valse "gelukt" op een bedrag dat nooit is geboekt.

     Vandaar EIGEN hieronder: de paden waar de route zijn eigen idempotentie doet
     en deze laag zich er niet mee bemoeit. Een lijst is gevaarlijk gereedschap
     (LAT.md regel 4), dus hij is niet met de hand te vertrouwen:
     test/idempotentie.test.js leest de broncode van server/routes/ en eist dat
     elke route die zelf `idem` uit het lijf haalt hier gedekt is, EN dat elke
     regel hier op minstens een echte route slaat. Vergeet iemand het, dan zakt
     de toets voordat de kas een specialist overstemt.
   - DE SLEUTEL IS route + afzender + sleutel, gehasht. De afzender zit erin
     (authorization-kop en IP) zodat twee klanten met toevallig dezelfde
     sleutel nooit elkaars antwoord krijgen -- en een hash, zodat er nergens
     een token in een kas ligt.
   - HET EERSTE ANTWOORD WINT, PLUS `herhaald: true`. De herhaling krijgt status
     en lijf van de eerste uitvoering terug, met de kop X-Idempotentie: herhaald,
     en de handler draait niet. Ook een 4xx wordt herhaald: dezelfde vraag,
     hetzelfde oordeel.

     DAT VELD IS NIET VERSIERING MAAR DE HUISTAAL, en het ontbrak: de geldlaag
     antwoordt al jaren met `Object.assign({}, bestaand, { herhaald: true })`
     (server/betaal.js). Deze laag ging ervoor staan en gaf alleen het kale
     eerste antwoord terug, met de melding in een KOP -- die niemand las. Zestien
     toetsen zakten daarop, van "dubbel tikken laadt nooit dubbel" tot "twee keer
     bestellen met dezelfde sleutel is een keer bestellen", en ze zakten stil
     omdat er na die verandering geen volle suite meer is gedraaid. Een lijst met
     routes die hun eigen idempotentie doen zou hier de verkeerde reparatie zijn
     (LAT.md regel 4): dezelfde taal spreken is de goede.
   - EEN STORING WORDT NOOIT ONTHOUDEN. Een 5xx mag opnieuw geprobeerd worden;
     een storing vastspijkeren zou van een haperend moment een permanente
     weigering maken.
   - DE KAS IS BEGRENSD EN VERGEET. Een dag TTL, een vaste bovengrens met
     wegvallen-van-de-oudste. Idempotentiesleutels beschermen tegen dubbelklikken
     en herhaalde verzoeken, niet tegen de eeuwigheid.

   DE GRENZEN, eerlijk benoemd:
   - per proces: in een cluster kent elke werker zijn eigen kas (net als de
     rem-emmers); een herhaling die op een andere werker landt draait opnieuw.
   - twee GELIJKTIJDIGE verzoeken met dezelfde sleutel draaien allebei; de kas
     vult pas als het eerste antwoord er is.
   - alleen antwoorden die via res.json() lopen worden onthouden; een route die
     streamt of res.send() gebruikt draait bij herhaling gewoon opnieuw.
   Alle drie zijn de rand van fase 1, geen verrassing achteraf -- de staatproef
   meet binnen een proces en na elkaar, dus die ziet precies wat dit belooft. */
'use strict';
const crypto = require('crypto');

/* De paden waar de route zijn EIGEN idempotentie doet. Prefixen, want een
   domein dat het begrip kent, kent het op al zijn geldroutes. Zie de kop: deze
   lijst wordt door test/idempotentie.test.js tegen de broncode gehouden. */
const EIGEN = [
  '/api/pay/',            // de wallet: eigen sleutelbinding, 409 bij een ander bedrag
  '/api/bank/',           // storten en SEPA geven de sleutel door aan de rail
  '/api/wbw/',            // verrekenen: een tweede tik is 409, er is geen schuld meer
  '/api/pakket/',         // synergie-pakketten melden alBetaald
  '/api/gast/',           // de gastenkassa: bestellen, afrekenen, bezorgen, foodcourt
  '/api/podium/',         // cadeaus, abonnementen en kaartjes lopen over de wallet
  '/api/ov/',             // check-uit rekent af via de wallet
  /* Deze vier vond de toets zelf, op zijn eerste ronde, en dat is precies
     waarom hij de lijst tegen de broncode houdt in plaats van hem te geloven:
     ze werden ook overstemd, en er was toevallig geen toets die erover viel.
     Let op /api/supplier/ticket/ (enkelvoud, deurverkoop): het gelijkende
     /api/supplier/tickets doet GEEN eigen idempotentie en hoort hier dus niet
     bij -- de toets vertelde dat door de tweede kant ook te meten. */
  '/api/betaal/',         // de betaalkern: direct betalen en een verzoek voldoen
  '/api/supplier/pay/',   // de zaak int en betaalt uit via de wallet
  '/api/supplier/pos/',   // kassa-checkout en losse verkoop
  '/api/supplier/ticket/' // deurverkoop
];
const doetHetZelf = (pad) => EIGEN.some(p => pad.startsWith(p));

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX = 50000;
const MAX_LIJF = 64 * 1024;

/* Het bewaarde lijf, met de huismarkering erbij. Alleen een JSON-OBJECT krijgt
   het veld: een lijst of een kale waarde heeft geen plek om hem te dragen, en
   die verzinnen zou het antwoord veranderen in plaats van het te merken. Lukt
   het ontleden niet, dan gaat het lijf onveranderd terug -- liever het eerste
   antwoord precies zoals het was dan een half omgebouwd antwoord. */
function metHerhaald(lijf) {
  try {
    const d = JSON.parse(lijf);
    if (!d || typeof d !== 'object' || Array.isArray(d)) return lijf;
    if (d.herhaald === true) return lijf;
    return JSON.stringify(Object.assign({}, d, { herhaald: true }));
  } catch (e) { return lijf; }
}

module.exports = () => {
  const kas = new Map(); // hash -> { status, lijf, op }

  function ruim() {
    if (kas.size < MAX) return;
    /* De oudste eruit: een Map onthoudt de invoegvolgorde, dus de eerste
       duizend sleutels zijn de oudste duizend. */
    let n = 0;
    for (const k of kas.keys()) { kas.delete(k); if (++n >= 1000) break; }
  }

  return function idempotentie(req, res, next) {
    if (req.method !== 'POST' || !req.path.startsWith('/api/')) return next();
    if (doetHetZelf(req.path)) return next();
    const b = req.body;
    const sleutel = b && (typeof b.idempotentieSleutel === 'string' ? b.idempotentieSleutel
      : (typeof b.idem === 'string' ? b.idem : null));
    if (!sleutel) return next();

    const wie = (req.get('authorization') || '') + '|' + String(req.ip || '');
    const id = crypto.createHash('sha256')
      .update(req.method + ' ' + req.path + '|' + wie + '|' + sleutel).digest('hex');

    const oud = kas.get(id);
    if (oud && Date.now() - oud.op < TTL_MS) {
      res.set('X-Idempotentie', 'herhaald');
      return res.status(oud.status).type('application/json').send(metHerhaald(oud.lijf));
    }

    const echteJson = res.json.bind(res);
    res.json = (data) => {
      try {
        const lijf = JSON.stringify(data);
        if (res.statusCode < 500 && typeof lijf === 'string' && lijf.length <= MAX_LIJF) {
          ruim();
          kas.set(id, { status: res.statusCode, lijf, op: Date.now() });
        }
      } catch (e) { /* een antwoord dat niet te serialiseren is, is niet te herhalen */ }
      return echteJson(data);
    };
    next();
  };
};

module.exports.EIGEN = EIGEN;
module.exports.doetHetZelf = doetHetZelf;
