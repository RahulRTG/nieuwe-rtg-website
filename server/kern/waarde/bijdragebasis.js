/* DE BIJDRAGEBASIS -- en de invariant die hem eerlijk houdt.

   Wat een franchisevergoeding ook wordt, hij rekent over een BASIS: het deel van
   de bruto-ontvangst dat RTG zelf heeft geleverd, na aftrek van wat rechtstreeks
   aan derden is doorbelast. Dit bestand rekent die basis uit en zet er GEEN
   tarief naast; dat besluit staat bij de eigenaar en is op 15 september 2026
   uitdrukkelijk open gelaten (kern/commercie/vergoeding.js).

   DE INVARIANT, en hij is er een:

       bruto = doorbelasting + bijdragebasis + de benoemde overige posten

   Niet "ongeveer". Er is geen restverschil dat stilletjes verdwijnt, want
   precies daar kan geld weglekken zonder dat iemand het ziet: een cent die in
   geen enkele bak valt, verlaagt of verhoogt de basis en niemand kan zeggen
   welke. De uitslag draagt daarom `sluit` en `verschil`, en een verschil is een
   DEFECT en geen afrondingsdetail.

   WAAR DE FOUT ECHT ZIT, EN WAAROM DE OPTELLING HEM NIET VANGT. Die identiteit
   klopt namelijk vanzelf zolang elke rij in EEN bak valt -- en dat doet ze,
   want `onbekend` is de restbak. Een nieuwe partijsoort die niemand indeelt,
   valt daar in en de som blijft kloppen terwijl de BETEKENIS wegloopt. De
   tweede invariant is daarom de dragende:

       elke partijsoort uit SOORTEN heeft een VERKLAARDE bak

   Komt er een soort bij zonder dat iemand hem indeelt, dan zakt deze laag met
   zijn naam erbij in plaats van hem als onwetendheid te tellen. Een som die
   klopt is geen bewijs dat de indeling klopt.

   WAT `onbekend` HIER IS. Een eigen, zichtbare post en nooit een deel van de
   basis. Een bedrag waarvan we de eigenaar niet kennen, mag niet meetellen als
   iets wat RTG heeft geleverd (dat verhoogt de basis) en evenmin als
   doorbelasting (dat verlaagt hem). Het staat er even groot bij, en dat is de
   hele reden dat deze laag bestaat. */
'use strict';

const { SOORTEN, ONBEKEND } = require('./economischeherkomst');
const { naarEigenaar } = require('./herkomstsplitsing');

/* DE VERKLAARDE INDELING. Elke partijsoort hoort hier met een bak EN een reden;
   de reden staat erbij omdat de indeling een economisch oordeel is en geen
   technisch detail -- wie later iets wil verschuiven, hoort te lezen waarom het
   stond waar het stond. */
const INDELING = Object.freeze({
  rtg: { bak: 'bijdragebasis', waarom: 'waarde die RTG zelf levert -- dit IS de basis' },
  derde: { bak: 'doorbelasting', waarom: 'rechtstreeks doorbelast aan een leverancier buiten RTG' },
  zaak: { bak: 'doorbelasting', waarom: 'een onderneming met een leverancierscontract: ook een derde' },
  overheid: { bak: 'belasting', waarom: 'btw en heffingen zijn nooit van RTG en nooit van de leverancier' },
  psp: { bak: 'betaalkosten', waarom: 'de betaaldienstverlener levert een eigen dienst' },
  lid: { bak: 'aanDeKlant', waarom: 'komt toe aan de klant -- een terugbetaling of een tegoed' },
  gast: { bak: 'aanDeKlant', waarom: 'zelfde als een lid, maar via het partnerkanaal' },
  onbekend: { bak: 'onbekend', waarom: 'niet vastgesteld -- een eigen post en nooit verrekend' }
});

/* De bakken die samen NIET de basis en NIET de doorbelasting zijn. Ze staan als
   lijst zodat de optelling hieronder ze niet hoeft te kennen: komt er een bak
   bij, dan telt hij vanzelf mee in `overig` en valt hij niet buiten de som. */
const OVERIGE_BAKKEN = Object.freeze(['belasting', 'betaalkosten', 'aanDeKlant', 'onbekend']);

/* Is elke soort ingedeeld? Losse functie met de lijst als invoer, zodat een
   toets hem een verzonnen soort kan voeren -- een controle die alleen zijn eigen
   bron kan lezen, is niet te ijken. */
function ongedeeldeSoorten(soorten) {
  return Object.keys(soorten || SOORTEN).filter(s => !INDELING[s]);
}

/* ---------- de basis ----------
   Neemt de rijen (uit kern/waarde/economischeherkomst.js) en geeft de drie
   grootheden plus het bewijs dat ze samen het bruto vormen. */
function bereken(rijen) {
  const ongedeeld = ongedeeldeSoorten(SOORTEN);
  if (ongedeeld.length) {
    /* FAIL-CLOSED, en met de naam erbij. Een basis uitrekenen terwijl een
       partijsoort nergens is ingedeeld, levert een getal op dat er precies zo
       uitziet als een getal dat klopt. */
    return {
      sluit: false, bruto: null, doorbelasting: null, bijdragebasis: null,
      waarom: 'niet elke partijsoort is ingedeeld: ' + ongedeeld.join(', ') +
        '. Zolang dat zo is, valt die soort in de restbak en klopt de som terwijl de betekenis wegloopt.'
    };
  }

  const s = naarEigenaar(rijen);
  const pe = s.perEigenaar;

  /* De vertaling van de bakken van `naarEigenaar` naar die van deze laag. Ze
     heten met opzet niet hetzelfde: die module splitst naar EIGENAAR, deze
     naar ECONOMISCHE ROL. `rtgEigen` en `bijdragebasis` zijn hetzelfde getal
     met een andere vraag erachter. */
  const bak = {
    bijdragebasis: pe.rtgEigen,
    doorbelasting: pe.derde,
    belasting: pe.overheid,
    betaalkosten: pe.psp,
    aanDeKlant: pe.aanDeKlant,
    onbekend: pe.onbekend
  };

  const overigTotaal = OVERIGE_BAKKEN.reduce((a, k) => a + (bak[k] || 0), 0);
  const bruto = bak.bijdragebasis + bak.doorbelasting + overigTotaal;

  /* HET BRUTO WORDT NIET HERBEREKEND UIT DE BAKKEN ALLEEN. Dat zou de invariant
     waardeloos maken: een som die je uit haar eigen delen opbouwt, klopt altijd.
     De tegenrekening komt uit de RIJEN zelf, langs een andere weg. */
  let uitRijen = 0;
  for (const r of (Array.isArray(rijen) ? rijen : [])) {
    if (r && r.bedragCenten != null) uitRijen += r.bedragCenten;
  }
  const verschil = bruto - uitRijen;

  return {
    sluit: verschil === 0,
    verschil,
    bruto, uitRijen,
    doorbelasting: bak.doorbelasting,
    bijdragebasis: bak.bijdragebasis,
    overig: OVERIGE_BAKKEN.reduce((o, k) => { o[k] = bak[k] || 0; return o; }, {}),
    overigTotaal,
    valuta: s.eenValuta,
    waaromGeenTotaal: s.waaromGeenTotaal,
    geteld: s.geteld, overgeslagen: s.overgeslagen,
    /* Wat deze uitslag NIET zegt, want een getal zonder grens wordt een belofte. */
    /* DE PLEK WAAR HET BESLUIT WOONT STAAT IN HET COMMENTAAR HIERBOVEN EN NIET
       IN DEZE ZIN, en dat is geen preutsheid. Toets 9 leest de CODE zonder
       commentaar en weigert daar elk woord dat naar een prijs verwijst -- juist
       omdat de verleiding is om "even" een tarief bij de waarheid te zetten. Een
       verwijzing die alleen in een toelichting staat, kan nooit per ongeluk een
       berekening worden. */
    grens: 'Dit is de BASIS en geen bedrag dat iemand verschuldigd is: er wordt in deze laag niets ' +
      'afgerekend en er komt hier ook geen afrekening in. De post `onbekend` is nergens in verrekend en staat even groot ' +
      'naast de rest. Staan er meerdere valuta tussen de rijen, dan is er geen totaal en zegt ' +
      'waaromGeenTotaal dat.',
    indeling: INDELING
  };
}

/* Waarom staat deze cent waar hij staat? De vraag die de eigenaar stelde: de
   machine moet op iedere EUR 0,01 kunnen antwoorden waarom hij boven of onder de
   streep staat. Neemt EEN rij en geeft de bak met de reden. */
function waarom(rij) {
  if (!rij) return { bak: null, waarom: 'geen rij' };
  if (rij.bedragCenten == null) return { bak: null, waarom: 'geen bedrag: dit is geen geldrij' };
  const soort = rij.economischeEigenaar || ONBEKEND;
  const i = INDELING[soort];
  if (!i) return { bak: 'onbekend', waarom: 'de partijsoort "' + soort + '" is nergens ingedeeld' };
  return {
    bak: i.bak, soort, waarom: i.waarom,
    bedragCenten: rij.bedragCenten, valuta: rij.valuta,
    grond: rij.grond || null, bronObject: rij.bronObject || null
  };
}

module.exports = { INDELING, OVERIGE_BAKKEN, ongedeeldeSoorten, bereken, waarom };
