/* RTG Kassa: EEN VERSTUURDE BON IS EEN BON, ook als hij twee keer aankomt.

   WAAROM DIT ER PAS NU IS. De kassa stuurde al jaren een idem-sleutel mee
   (`idem: RTGIdem('kassa')` in apps/kassa.html), maar het endpoint gaf hem
   alleen door aan RTG Pay -- en dan nog alleen bij method 'rtgpay'. Contant,
   pin en tafel kenden helemaal geen herhaling. Twee keer versturen gaf twee
   bonnen, twee keer voorraadafboeking en twee facturen. De sleutel lag er dus
   wel, en niemand keek ernaar.

   Dat kwam boven bij het bouwen van de offline-wachtrij: een wachtrij is per
   definitie een ding dat opnieuw verstuurt. Zonder deze laag verdubbelt zo'n
   herhaling de omzet, en dan is de wachtrij geen vangnet maar een lek.

   WAT DIT WEL EN NIET IS. Dit ontdubbelt op SLEUTEL, nooit op bedrag. Twee
   klanten die om 20:14 allebei een koffie van 3,50 contant afrekenen zijn twee
   bonnen -- dat hoort zo, en toets 3 van kassa-herhaling.test.js houdt dat vast.
   Alleen wie dezelfde sleutel terugstuurt, zegt daarmee "dit is mijn vorige
   verzoek nog een keer".

   DEZELFDE MACHINERIE ALS HET GELD (server/lib/idem.js), en met opzet niet een
   eigen kopie: die module kent de dingen die hier ook gelden -- de binding aan
   het verzoek (dezelfde sleutel voor een ander bedrag is een 409 en geen stille
   "gelukt"), de vlucht-tabel voor twee verzoeken die tegelijk binnenkomen, en
   het feit dat een mislukking NIET wordt bewaard zodat een volgende poging het
   gewoon opnieuw mag doen.

   Een bewuste keuze in de afdruk: vrije tekst telt niet mee. Een andere
   omschrijving of een andere codenaam op de bon maakt het niet een ander
   verzoek; het bedrag, de betaalwijze, de tafel en de regels wel. */
'use strict';

const MAXSLEUTEL = 80;
const MAXREGELS = 40;

/* `bijeen` (optioneel) bundelt de save van de bon en die van de sleutel tot
   een commit. Zonder die bundel bestaat er een moment op schijf waarin de bon
   staat en de sleutel niet -- en precies daar boekt een herhaling dubbel. */
module.exports = ({ db, save, bijeen }) => {
  const metIdem = require('../../lib/idem')({ d: () => db.data, save, naam: 'kassaIdem', bijeen });

  /* De regels horen in de afdruk: dezelfde sleutel met een andere bon is een
     ander verzoek, ook als het totaal toevallig gelijk blijft. */
  function regels(items) {
    if (!Array.isArray(items)) return '';
    return items.slice(0, MAXREGELS).map((i) => {
      const r = i || {};
      return String(r.name || '') + '*' + (parseInt(r.qty, 10) || 1) + '@' + (Number(r.price) || 0);
    }).join(',');
  }

  function afdruk(soort, code, body) {
    const b = body || {};
    return [soort, code, Number(b.total) || 0, String(b.method || ''),
      String(b.room || ''), regels(b.items)].join('|');
  }

  function sleutelVan(body) {
    return String((body || {}).idem || '').trim().slice(0, MAXSLEUTEL);
  }

  /* `werk` geeft het ANTWOORD terug in plaats van het zelf te versturen: alleen
     zo kan een herhaling exact hetzelfde antwoord krijgen. Een antwoord zonder
     `ok` (een fout) wordt niet bewaard. */
  function eenmalig(soort, code, body, werk) {
    const s = sleutelVan(body);
    if (!s) return werk();
    return metIdem('bon:' + soort + ':' + code + ':' + s, afdruk(soort, code, body), werk);
  }

  /* EEN DEUR DIE GEEN BON IS, maar wel dezelfde instantie nodig heeft.
     `eenmalig` bouwt zijn afdruk uit bonvelden (totaal, betaalwijze, kamer,
     regels). Een cadeaukaart verkopen heeft die velden niet -- daar bepaalt de
     ZAAK plus het BEDRAG wat het verzoek is. Die deur mag daarom zijn eigen
     sleutel en afdruk meegeven, maar hij hoort dat te doen op DEZE metIdem en
     niet op een tweede exemplaar: de vlucht-tabel voor twee verzoeken die
     tegelijk binnenkomen leeft per instantie, dus twee exemplaren op dezelfde
     store delen wel de bewaarde sleutels en niet de lopende. Precies dat stond
     er even: routes/supplier/kassa/cadeaukaart.js bouwde er zelf een. */
  return { eenmalig, afdruk, sleutelVan, metEigenAfdruk: metIdem };
};
