/* DE TWEEDE ZWAAR-AS: GEMETEN IN PLAATS VAN GERADEN.

   `ZWAAR` in scripts/kantoormacht.js herkent een zware kantoorhandeling aan zijn
   PAD. Dat is een ondergrens en dat staat er ook bij: een route die geld beweegt
   zonder dat zijn pad dat verraadt, valt erbuiten. Deze as stelt dezelfde vraag
   langs de andere kant -- niet "hoe heet je" maar "wat heb je AANGERAAKT" --
   en leest daarvoor het veld `opslag` uit IDEMPROEF.json: welke collecties
   veranderden toen de idempotentieproef deze route werkelijk uitvoerde.

   DE TWEE ASSEN WORDEN NOOIT OPGETELD, en dat is de hele reden dat dit een
   apart bestand is. Ze missen verschillende dingen:

     de padas mist   een route die geld beweegt onder een onschuldige naam
     de effectas mist elke route die de proef niet aan het werk kreeg

   Een som van twee ondergrenzen is geen bovengrens en ook geen ondergrens; het
   is een getal zonder betekenis. Ze staan daarom naast elkaar in het register,
   allebei met hun eigen dekking.

   DE DEKKING IS HET BELANGRIJKSTE GETAL HIER, belangrijker dan de treffers.
   Over de kantoorroutes haalt de proef ergens rond de 14%: de rest gaf 404 of
   403, of deed werk zonder een gemeten collectie te raken. Precies de zware
   bankknoppen zitten in dat gat, want die vragen een levende bank, een geldig
   IBAN en een lid met een rekening -- en die wereld zet de proef niet op. Een
   effectas die dat verzwijgt en alleen zijn treffers toont, leest als dekking.
   Vandaar `blindVoor`: de zware routes waarover deze as met opzet niets zegt.

   WAAROM DE GELDCOLLECTIES HIER MET DE HAND STAAN, en wat dat waard is. Er is
   geprobeerd ze af te leiden uit de geldlaag zelf (welke `db.data.X` noemt
   server/kern/pay, /bank, /payroll, /waarde?). Dat leverde twaalf namen op
   terwijl IDEMPROEF er achtentwintig kent die op geld lijken -- de geldlaag
   raakt de opslag namelijk via de kern-tas en niet rechtstreeks, dezelfde
   blindheid die CODE.md bij de require-graaf beschrijft. Een afleiding die
   tweederde mist is slechter dan een lijst die zegt dat hij een lijst is. Deze
   draagt daarom per naam een reden, graad `vermoed`, en dezelfde regel als
   ZWAAR: wie er iets bij zet verbreedt de meting, wie er iets afhaalt legt uit
   waarom die collectie geen waarde draagt. */
'use strict';

const path = require('path');

/* Collecties waarin een BEDRAG of een TEGOED woont. Bewust niet de
   idempotentie-administratie (`bankIdem`, `payIdem`, `payIdemAfdruk`): daar
   landt een afdruk van een verzoek, geen waarde -- een schrijfactie daar zegt
   dat er iets IS gevraagd en niet dat er iets is verplaatst. */
const GELDCOLLECTIES = Object.freeze({
  bankSaldi: 'het saldo van een bankrekening',
  bankBoekingen: 'de boekingen waaruit dat saldo volgt',
  bankRekeningen: 'het bestaan en de limieten van een rekening (rood staan woont hier)',
  bankPassen: 'de passen waarmee van een rekening wordt betaald',
  bankTerugkerend: 'vaste betalingen die vanzelf blijven lopen',
  paySaldi: 'het saldo in RTG Pay',
  payBoekingen: 'de boekingen waaruit dat saldo volgt',
  payTegoed: 'tegoed dat tegen waarde inwisselbaar is',
  payTreasury: 'de treasury-posities van een ondernemer',
  payVerzoeken: 'openstaande betaalverzoeken',
  wallet: 'het walletsaldo van een lid',
  punten: 'puntentegoed (WAARDE.md klasse LOYALTY)',
  aiTegoed: 'het AI-tegoed dat een zaak koopt en opmaakt',
  facturen: 'wat er aan iemand in rekening is gebracht',
  payrollRegels: 'de regels waarmee loon wordt gerekend',
  payrollRegelJournaal: 'de geschiedenis van die regels',
  payrollRuns: 'een loonrun, en daarmee wat er wordt uitbetaald'
});

/* De proef schrijft per oproep (a, b, c) welke collecties veranderden. `d` en
   `e` horen bij de kale ronde zonder idempotentiesleutel en tellen mee: ook daar
   is de route echt uitgevoerd. */
const OPROEPEN = ['a', 'b', 'c', 'd', 'e'];

function collectiesVan(rij) {
  const uit = new Set();
  const bakken = [rij.opslag || {}, (rij.zonderSleutel || {}).opslag || {}];
  for (const bak of bakken)
    for (const sleutel of OPROEPEN)
      for (const naam of Object.keys(bak[sleutel] || {})) uit.add(naam);
  return uit;
}

/* Waarom een route buiten de meting valt. Drie standen, en `geenWerk` is met
   opzet geen `geenEffect`: "de proef kwam er niet doorheen" is iets anders dan
   "er gebeurde niets" -- dezelfde grens die kern/stuur/gevolg.js trekt tussen
   `onbekend` en `geen-effect-gemeten`. */
function standVan(rij) {
  if (/deed geen werk/.test(String(rij.reden || ''))) return 'geenWerk';
  return collectiesVan(rij).size ? 'gemeten' : 'geenOpslag';
}

/* @param routes  de kantoorroutes uit scripts/kantoormacht.js ({ methode, pad })
   @param isZwaarPad  de padherkenning van diezelfde meter, om `blindVoor` te vullen
   @param heeftMens   of de deur van een route een bewezen mens eist
   @param rijen  OPTIONEEL: een nagebouwde proefronde in plaats van IDEMPROEF.json.
     Alleen voor de toets, en met opzet als parameter en niet als vlag: een toets
     die de echte meting voedt, beweegt mee met het huis en meet daarna zichzelf
     niet meer. Zelfde reden als de nagebouwde lusstap in test/herkomstlus.js. */
function meetEffect(routes, isZwaarPad, heeftMens, wortel, rijen) {
  let perRoute = [];
  const bron = rijen ? 'nagebouwd (toets)' : 'IDEMPROEF.json';
  if (rijen) perRoute = rijen;
  else {
    try {
      perRoute = require(path.join(wortel, 'IDEMPROEF.json')).perRoute || [];
    } catch (e) {
      return { bruikbaar: false,
        reden: 'IDEMPROEF.json ontbreekt of is onleesbaar; zonder die proef is er geen gemeten effect. ' +
          'Draai `npm run idemproef`.' };
    }
  }

  const proef = new Map();
  for (const rij of perRoute) {
    if (!rij || rij.methode !== 'POST' || typeof rij.pad !== 'string') continue;
    proef.set(rij.pad, rij);
  }

  const dekking = { gemeten: 0, geenWerk: 0, geenOpslag: 0, nietInProef: 0, totaal: routes.length };
  const raakt = [];
  const blindVoor = [];

  for (const r of routes) {
    const rij = proef.get(r.pad);
    if (!rij) {
      dekking.nietInProef++;
      if (isZwaarPad(r.pad)) blindVoor.push({ pad: r.pad, waarom: 'staat niet in de proefronde' });
      continue;
    }
    const stand = standVan(rij);
    dekking[stand]++;
    if (stand !== 'gemeten') {
      if (isZwaarPad(r.pad))
        blindVoor.push({ pad: r.pad, waarom: stand === 'geenWerk'
          ? 'de proef kreeg deze route niet aan het werk (' + String(rij.reden || '').slice(0, 80) + ')'
          : 'de route deed werk maar raakte geen gemeten collectie aan' });
      continue;
    }
    const geld = [...collectiesVan(rij)].filter(c => GELDCOLLECTIES[c]).sort();
    if (geld.length) raakt.push({ pad: r.pad, collecties: geld, opNaam: !!heeftMens(r) });
  }

  raakt.sort((a, b) => a.pad.localeCompare(b.pad));
  blindVoor.sort((a, b) => a.pad.localeCompare(b.pad));

  return {
    bruikbaar: true,
    bron,
    graad: 'vermoed',
    dekking,
    dekkingPct: dekking.totaal ? Math.round(1000 * dekking.gemeten / dekking.totaal) / 10 : 0,
    raakt,
    raaktZonderMens: raakt.filter(r => !r.opNaam).map(r => r.pad),
    blindVoor,
    grens: 'Deze as ziet alleen wat de idempotentieproef WERKELIJK heeft uitgevoerd. Zij wordt ' +
      'nooit opgeteld bij de padas: twee ondergrenzen die verschillende dingen missen, geven ' +
      'samen geen bovengrens. `blindVoor` noemt de zware routes waarover zij zwijgt.'
  };
}

module.exports = { meetEffect, GELDCOLLECTIES };
