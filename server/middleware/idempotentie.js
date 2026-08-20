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
   - DE SLEUTEL IS route + afzender + sleutel, gehasht. De afzender zit erin
     (authorization-kop en IP) zodat twee klanten met toevallig dezelfde
     sleutel nooit elkaars antwoord krijgen -- en een hash, zodat er nergens
     een token in een kas ligt.
   - HET EERSTE ANTWOORD WINT. De herhaling krijgt status en lijf van de eerste
     uitvoering terug, met de kop X-Idempotentie: herhaald, en de handler
     draait niet. Ook een 4xx wordt herhaald: dezelfde vraag, hetzelfde oordeel.
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

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX = 50000;
const MAX_LIJF = 64 * 1024;

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
      return res.status(oud.status).type('application/json').send(oud.lijf);
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
