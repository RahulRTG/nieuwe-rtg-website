/* ============================================================================
   HET AI-BUDGET PER PERSOON.

   Er stonden al twee grenzen op de modelkraan, en allebei missen ze iets:

     ./ai-meter.js  telt het HELE HUIS en draait dicht op een dagbedrag. Dat
                    vangt een lek, maar pas als iedereen er last van heeft: de
                    kraan gaat voor de honderdste bezoeker dicht doordat de
                    eerste hem heeft leeggetrokken.
     ./ai-rem.js    telt aanroepen per MINUUT per IP. Dat vangt een uitschieter,
                    maar een script dat netjes 59 per minuut doet loopt een dag
                    lang door.

   Wat er tussen zat: een grens die bij de PERSOON hoort. Die staat hier.

   EEN IP IS GEEN PERSOON. De rem hiernaast sleutelt op IP, en voor een rem per
   minuut is dat prima. Voor een dag- of maandbudget is het fout, en op twee
   manieren tegelijk: een kantoor deelt een IP met honderd collega's (die dan
   samen een budget krijgen), en een lid dat van wifi naar 4G loopt is opeens
   iemand anders met een vol budget. De sleutel is daarom sess.key --
   'user-<id>' voor een echt account. Dat is geen naam en geen e-mailadres; de
   echte naam staat in de identiteitskluis en hoort daar te blijven (CLAUDE.md:
   privacy by design). Wie niet is ingelogd valt terug op het IP en krijgt het
   gratis-budget, want anders is uitloggen de manier om er onderuit te komen.

   DE BEDRAGEN EN DE VENSTERS staan in BUDGETTEN hieronder; WAAROM ze zijn zoals
   ze zijn staat in README.md ("Het AI-budget per persoon"). Twee dingen die je
   moet weten voordat je een getal aanraakt:

     - Het venster doet meer dan het bedrag. EUR 0,50 per dag is over een maand
       ook EUR 15. Het verschil tussen gratis en RTG Pass is dus VRIJHEID (mag
       je je maand op een dag opmaken) en niet volume.
     - Een oppervlak van de RTFoundation telt wel mee maar sluit NOOIT. Dat
       volgt uit test/modelkeuze.test.js: wat een kind te horen krijgt is geen
       kostenpost. Alleen het huisplafond kan die aanroepen nog stoppen.

   EN WAT DIT NIET IS: geen aftelteller, en geen verkooptrechter. Het bericht
   bij een vol budget noemt met opzet geen andere pas. Zie de README en
   CLAUDE.md (geen kunstmatige urgentie) en LIFE.md (een relatie is geen
   trechter).

   DE MUNT. De prijstabel van de meter staat in DOLLAR, want zo factureren de
   aanbieders; deze budgetten staan in EURO. De koers daartussen veroudert net
   zo hard als die prijstabel, staat hieronder met een peildatum, en is er om
   een orde van grootte te bewaken -- niet om een boekhouding op te baseren.
   ========================================================================== */
'use strict';
const klok = require('./lib/klok');
const ctx = require('./ai-context');
/* De bedragen, de koers, de pas-vertaling en de lijst die nooit sluit staan in
   ./ai-budget-beleid.js -- dat is wat een eigenaar aanpast, dit is hoe het
   geteld wordt. */
const beleid = require('./ai-budget-beleid');
const { budgetten, pasVan, vrijgesteldPad, usdNaarEuro, koers } = beleid;

/* De sleutel waarop geteld wordt. Een echt account levert sess.key
   ('user-<id>'); dat is pseudoniem en blijft dat. Zonder sessie het IP, met een
   voorvoegsel zodat de twee soorten sleutels elkaar nooit kunnen raken. */
function sleutelVan(sessie, ip) {
  if (sessie && sessie.key) return 'lid:' + sessie.key;
  return ip ? 'ip:' + ip : null;
}

/* Het venster waar deze aanroep in valt: '2026-08-19' of '2026-08'. */
function vensterVan(soort, nu) {
  const d = new Date(nu || klok.nu()).toISOString();
  return soort === 'maand' ? d.slice(0, 7) : d.slice(0, 10);
}

/* ---------------------------------------------------------------------------
   DE OPSLAG. Dit moet een herstart overleven, anders is het geen budget: wie
   een plafond raakt zou dan hoeven te wachten tot er iemand implementeert.
   Daarom de database en niet het geheugen -- anders dan de meter hiernaast, die
   bewust vluchtig is omdat hij een noodrem is en geen boekhouding.

   De opslag wordt INGESPOTEN zodat dit los te beproeven is; zonder komt hij uit
   ./db. Laat-gebonden, want ai-budget wordt geladen voordat de opslag klaar is.
--------------------------------------------------------------------------- */
let opslagHaak = null;
function zetOpslag(haak) { opslagHaak = haak; }

function bak() {
  if (opslagHaak) return opslagHaak();
  const { db, save } = require('./db');
  db.data.aiBudget = db.data.aiBudget || {};
  return { data: db.data.aiBudget, bewaar: save };
}

/* Alles van een ander venster mag weg: een dagstand van vorige week zegt niets
   meer en zou de opslag onbeperkt laten groeien. */
function schoonVeeg(data, dagNu, maandNu) {
  for (const k of Object.keys(data)) {
    const v = data[k];
    if (!v || (v.venster !== dagNu && v.venster !== maandNu)) delete data[k];
  }
}

/* ---------------------------------------------------------------------------
   DE VRAAG EN DE BOEKING.
--------------------------------------------------------------------------- */

/* Mag deze persoon nog een EXTERNE aanroep doen? `opties.vrijgesteld` is waar
   voor een Foundation-oppervlak: dat telt wel mee maar sluit nooit. */
function magNog(opties, nu) {
  const o = opties || {};
  const vrij = o.vrijgesteld !== undefined ? o.vrijgesteld : vrijgesteldPad(ctx.pad());
  if (vrij) return { mag: true, vrijgesteld: true };
  const sessie = o.sessie !== undefined ? o.sessie : ctx.sessie();
  const ip = o.ip !== undefined ? o.ip : ctx.ip();
  const sleutel = sleutelVan(sessie, ip);
  /* Geen verzoek eromheen: een achtergrondtaak of een script. Die horen geen
     persoonsbudget op te maken en er ook niet door gestopt te worden; voor hen
     is het huisplafond de grens. */
  if (!sleutel) return { mag: true, buitenVerzoek: true };

  const pas = pasVan(sessie);
  const budget = budgetten()[pas];
  if (!budget || !budget.cent) return { mag: true, pas };

  const venster = vensterVan(budget.venster, nu);
  const b = bak();
  const rij = b.data[sleutel];
  const besteed = (rij && rij.venster === venster) ? Number(rij.cent) || 0 : 0;
  return { mag: besteed < budget.cent, pas, venster, besteedCent: besteed, budgetCent: budget.cent };
}

/* Boek wat deze aanroep heeft gekost. `usd` komt uit ai-meter.kostenVan(). Ook
   een vrijgestelde aanroep wordt geboekt -- je wilt zien wat de Foundation
   kost, hij wordt er alleen niet op afgesloten. */
function boek(usd, opties, nu) {
  const o = opties || {};
  const sessie = o.sessie !== undefined ? o.sessie : ctx.sessie();
  const ip = o.ip !== undefined ? o.ip : ctx.ip();
  const sleutel = sleutelVan(sessie, ip);
  if (!sleutel) return null;

  const pas = pasVan(sessie);
  const budget = budgetten()[pas] || beleid.BUDGETTEN.gratis;
  const venster = vensterVan(budget.venster, nu);
  const cent = usdNaarEuro(usd) * 100;
  const vrij = o.vrijgesteld !== undefined ? o.vrijgesteld : vrijgesteldPad(ctx.pad());

  const b = bak();
  schoonVeeg(b.data, vensterVan('dag', nu), vensterVan('maand', nu));
  let rij = b.data[sleutel];
  if (!rij || rij.venster !== venster) rij = b.data[sleutel] = { venster, cent: 0, aanroepen: 0, pas };
  rij.cent += cent;
  rij.aanroepen += 1;
  rij.pas = pas;
  if (vrij) rij.vrijCent = (rij.vrijCent || 0) + cent;
  try { b.bewaar(); } catch (e) {}
  return rij;
}

/* De stand van EEN persoon, voor het luik en voor een eerlijk bericht. Geen
   scherm hoort dit als aftelteller te tonen -- zie de kop. */
function stand(opties, nu) {
  const uit = magNog(Object.assign({}, opties, { vrijgesteld: false }), nu);
  if (uit.buitenVerzoek) return null;
  return {
    pas: uit.pas,
    venster: uit.venster || null,
    vensterSoort: (budgetten()[uit.pas] || {}).venster || null,
    besteedEuro: uit.besteedCent != null ? Math.round(uit.besteedCent) / 100 : null,
    budgetEuro: uit.budgetCent != null ? uit.budgetCent / 100 : null,
    op: !uit.mag,
    koers: koers(),
    koersPeildatum: beleid.KOERS_PEILDATUM,
    let: 'schatting: de aanbieders factureren in dollar, dit rekent om tegen een vaste koers'
  };
}

/* Het bericht bij een vol budget. Het noemt met opzet GEEN andere pas. */
const BERICHT = 'Je AI-tegoed voor deze periode is op. De rest van RTG werkt gewoon door: ' +
  'navigatie, schermen en workflows blijven beschikbaar, en je kunt alles ook handmatig doen.';

function alleTellingen() { return bak().data; }
function nulstel() { const b = bak(); for (const k of Object.keys(b.data)) delete b.data[k]; }

module.exports = { magNog, boek, stand, sleutelVan, vensterVan,
  zetOpslag, alleTellingen, nulstel, BERICHT, beleid };
