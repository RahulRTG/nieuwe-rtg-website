/* Centrale productiestop voor betaalfuncties.

   RTG_BETALEN_UIT=1 betekent meer dan "geen provider-sleutel": ook interne
   wallets, munten, cadeaukaarten en routes die alleen administratief op
   "betaald" zetten moeten dan weigeren. Anders lijkt een handeling geslaagd
   terwijl er in werkelijkheid niets is afgeschreven.

   Alleen muterende HTTP-methodes worden geraakt. Financiele overzichten,
   facturen, loonberekeningen en rapportages blijven daardoor beschikbaar. De
   echte grootboeken hebben daarnaast hun eigen stop; die vangt ook achtergrond-
   taken en toekomstige routes af. */
'use strict';

const BERICHT = 'Betalen staat bewust uitgeschakeld. Er is niets afgeschreven.';
const MUTEREND = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const HELE_BETAALDOMEINEN = [
  /^\/api\/pay(?:\/|$)/,
  /^\/api\/betaal(?:\/|$)/,
  /^\/api\/munt(?:\/|$)/
];

const GELDACTIES = [
  /^\/api\/bank\/(?:storten|overboek|naar-wallet|van-wallet|sepa|bulk|salaris)(?:\/|$)/,
  /^\/api\/bank\/pas\/betaal$/,
  /^\/api\/bank\/krediet\/aflossing$/,
  /^\/api\/bank\/terugkerend\/zet$/,
  /^\/api\/office\/bank\/(?:krediet\/besluit|salaris\/run)$/,
  /^\/api\/office\/payroll\/betaalbestand$/,
  /^\/api\/giftcard\/buy$/,
  /^\/api\/supplier\/giftcard\/(?:sell|redeem)$/,
  /* DE KASSA DIE EEN BON OPHAALT ZET HEM OP BETAALD, en dat is precies wat de
     kop van dit bestand verbiedt: zonder betaalrail mag er nergens een betaling
     worden gesimuleerd of alleen administratief als voldaan gemarkeerd.
     kassa/innen.js doet dat wel -- o.paid = true, betaaldMet = 'rtg', paidAt, en
     een verkoopregel in het dagoverzicht -- en hij glipte langs beide stoppen:
     de catch-all hieronder kijkt naar het LAATSTE padstuk en `redeem` staat daar
     niet in, en de interne stop van RTG Pay (kern/pay/stand.js) wordt hier niet
     aangeroepen omdat er geen geld door de poort gaat.

     Gevonden door scripts/zaakwig.js: op trede 3 (de vloer zonder betaalrail)
     gaf /api/supplier/pos/redeem 200 en stond de bon daarna op betaald. Het
     precedent staat een regel hoger: giftcard/redeem staat er al in, om dezelfde
     reden. */
  /^\/api\/supplier\/pos\/redeem$/,
  /^\/api\/wallet\/munt\/(?:koop|wissel)$/,
  /^\/api\/supplier\/betaalverzoek(?:\/|$)/,
  /* `vooraf` en `vastleg` staan hier omdat ze geld bewegen: vooraf laat de
     wallet zo nodig bijladen via de kaart-naad, en vastleg boekt het werkelijke
     bedrag naar de zaak. Zonder deze twee regels zou de pre-autorisatie tijdens
     een betaalstop gewoon doorlopen -- de catch-all hieronder kijkt naar het
     LAATSTE padstuk en "vooraf" noch "vastleg" staat in die lijst.

     `vrijgeef` staat er met opzet NIET bij. Die beweegt geen geld maar geeft
     een vastgezet bedrag terug aan het lid, en dat moet juist kunnen als
     betalen uitstaat: anders blijft het geld van een lid vastzitten precies
     zolang als de storing duurt. */
  /^\/api\/supplier\/pay\/(?:in|uitbetaal|vooraf|vastleg)$/,
  /* De treasury verplaatst geen geld -- oormerken zijn voornemens -- maar
     `zet` en `apart` veranderen wel WAT ER UITBETAALD KAN WORDEN. Tijdens een
     betaalstop is dat sturen aan een knop waarvan de uitkomst stilstaat, en dat
     leest als werk dat doorloopt. `vrij` blijft open, zoals `vrijgeef`
     hierboven: geld weer vrijgeven moet altijd kunnen. */
  /^\/api\/supplier\/pay\/treasury\/(?:zet|apart)$/,
  /\/(?:betaal|pay|afrekenen|refund|uitbetaal|overboeken|verreken|betaald)$/
];

function isBetaalactie(methode, pad) {
  if (!MUTEREND.has(String(methode || '').toUpperCase())) return false;
  const schoonPad = String(pad || '').split('?')[0];
  return HELE_BETAALDOMEINEN.some(re => re.test(schoonPad)) || GELDACTIES.some(re => re.test(schoonPad));
}

function antwoord(res) {
  return res.status(503).json({ error: BERICHT, code: 'betalingen-uit' });
}

module.exports = function betaalstop({ app, uit } = {}) {
  const actief = uit == null ? process.env.RTG_BETALEN_UIT === '1' : uit === true;
  if (!actief) return { actief: false };
  app.use((req, res, next) => isBetaalactie(req.method, req.path || req.url) ? antwoord(res) : next());
  return { actief: true };
};

module.exports.isBetaalactie = isBetaalactie;
module.exports.BERICHT = BERICHT;
