/* ============================================================================
   HET ANKER -- het enige dat KOPAFKNIPPING kan zien.

   WAAROM DIT EEN EIGEN BESTAND IS. server/lib/keten.js beantwoordt de vraag
   "klopt de overgebleven geschiedenis met zichzelf". Dit bestand beantwoordt een
   andere: "is de geschiedenis nog even LANG als hij was". Die twee door elkaar
   halen is de duurste denkfout rond auditlogs, en het scheelt hier niet één
   functie maar een hele aanvalsklasse.

   Wie de nieuwste K regels weggooit, houdt een keten over die van voor naar
   achter perfect klopt: elke regel wijst naar een voorganger die er nog is,
   elke hash klopt met zijn inhoud. Lokaal is daar NIETS tegen te doen -- geen
   teller, geen hoogwatermerk, geen volgnummer -- want alles wat je ernaast zet
   staat in dezelfde database en is door dezelfde hand te wijzigen. Sporen
   wissen van wat je zojuist deed is dus precies waar een losse hashketen niet
   tegen beschermt.

   Daarvoor moet er één getal NAAR BUITEN. Een anker is een momentopname van de
   kop: welk volgnummer stond bovenaan, met welke hash, en wanneer. Publiceer
   dat -- een gescheiden systeem, een tweede partij, desnoods een uitdraai in
   een kluis -- en de geschiedenis tot dat punt ligt vast. Niemand kan er daarna
   nog regels onder weghalen zonder dat het opvalt, ook niet door de hele keten
   opnieuw uit te rekenen.

   EEN ANKER IN DEZELFDE DATABASE IS GEEN ANKER maar een tweede regel om te
   wijzigen. Deze module MAAKT het en REKENT ERMEE AF; het wegzetten is bewust
   geen taak van de module die beschermd wordt.

   EN DAAROM STAAT DE CONTROL HIER OP NIET-IN-BEDRIJF. Het mechanisme is
   bewezen (zie test/keten.test.js: een ingekorte kop en een herschreven regel
   worden allebei betrapt), maar er wordt nergens een anker weggezet. Zolang dat
   niet gebeurt beschermt dit niets, en dat hoort een eigen stand in het
   controlregister te zijn in plaats van een voetnoot bij een groene control --
   voetnoten worden bij het mappen naar een wettelijke eis niet meegelezen.

   IN BEDRIJF NEMEN, in volgorde:
     1 een bestemming kiezen waar de beheerder van deze database niet bij kan;
     2 na elke ronde het anker daarheen wegschrijven, met tijdstempel;
     3 bij elke controle het laatste anker ophalen en verifieerTegenAnker() draaien;
     4 een afwijking laten meebewegen met het alarm (kern/command/alarm.js).
   Stap 1 is geen code maar een keuze; daarom staat er hier geen halfaf script
   dat niemand aanzet.
   ========================================================================== */
'use strict';

function verankerPunt(regels) {
  const l = Array.isArray(regels) ? regels : [];
  const kop = l.find(r => r && r.hash) || null;
  if (!kop) return null;
  return { nr: Number(kop.nr) || 0, hash: kop.hash, at: kop.at || null };
}

/* Afrekenen met een eerder gepubliceerd anker. Dit is het enige dat
   KOPAFKNIPPING kan zien -- zie de kop van dit bestand.

   Drie uitkomsten, en ze betekenen echt iets anders:
     ingekort    de kop staat LAGER dan het anker: er zijn regels verdwenen die
                 aantoonbaar hebben bestaan. Dit is de aanval.
     herschreven het volgnummer van het anker is er nog, maar met een andere
                 hash: de geschiedenis is op dat punt vervangen.
     weg         het anker valt buiten wat er nog is (een begrensd journaal dat
                 zo ver is doorgeschoven).

   `weg` IS ALLEEN IN ORDE ALS DE BEWARING HET VERKLAART (audit P2-5). Hier stond
   `ok: true` bij elke verdwenen ankerregel. Dan is de goedkoopste aanval op het
   anker niet de kop afknippen maar ALLES tot en met de geankerde regel weggooien
   en een paar nieuwe regels erbij zetten: de kop staat dan hoger dan het anker,
   de geankerde regel is "uit het journaal geschoven" en de controle zei groen.
   Een journaal schuift alleen door zijn BEWARING: het is vol (`max`), of de
   geankerde regel is ouder dan de termijn (`dagen`). Verklaart geen van beide
   het, dan is er iets weg dat er nog hoorde te staan -- `ok: false`. Wie geen
   bewaring meegeeft, krijgt dus geen groen: niet te beoordelen is geen in orde. */
function bewaringVerklaart(l, anker, bewaring) {
  const b = bewaring || {};
  if (Number(b.max) > 0 && l.length >= Number(b.max)) return 'het journaal zit aan zijn bovengrens van ' + b.max + ' regels';
  const at = anker && anker.at ? Date.parse(anker.at) : NaN;
  const nu = typeof b.nu === 'function' ? b.nu() : (Number(b.nu) || Date.now());
  if (Number(b.dagen) > 0 && Number.isFinite(at) && nu - at > Number(b.dagen) * 86400000)
    return 'de geankerde regel is ouder dan de bewaartermijn van ' + b.dagen + ' dagen';
  return null;
}

function verifieerTegenAnker(regels, anker, bewaring) {
  const l = Array.isArray(regels) ? regels : [];
  if (!anker || typeof anker.nr !== 'number') return { ok: false, reden: 'geen bruikbaar anker' };
  const kop = verankerPunt(l);
  if (!kop) return { ok: false, ingekort: true, reden: 'het journaal is leeg terwijl er een anker is', anker };

  if (kop.nr < anker.nr) {
    return { ok: false, ingekort: true, kwijt: anker.nr - kop.nr,
      reden: 'de kop staat op ' + kop.nr + ' terwijl het anker ' + anker.nr +
        ' vastlegde: er zijn ' + (anker.nr - kop.nr) + ' regels verdwenen die hebben bestaan' };
  }

  const bijAnker = l.find(r => r && Number(r.nr) === anker.nr);
  if (!bijAnker) {
    const verklaring = bewaringVerklaart(l, anker, bewaring);
    if (verklaring) return { ok: true, weg: true,
      reden: 'regel ' + anker.nr + ' is uit het begrensde journaal geschoven: ' + verklaring };
    return { ok: false, weg: true,
      reden: 'regel ' + anker.nr + ' is verdwenen terwijl de bewaring dat niet verklaart -- ' +
        'het journaal is niet vol en de regel is niet ouder dan de termijn' };
  }
  if (bijAnker.hash !== anker.hash) {
    return { ok: false, herschreven: true,
      reden: 'regel ' + anker.nr + ' bestaat nog maar heeft een andere hash dan het anker vastlegde' };
  }
  return { ok: true, sindsAnker: kop.nr - anker.nr };
}

const CONTROL = {
  control: 'AUDIT-KETEN-VERANKERD',
  wat: 'het wegknippen van de NIEUWSTE auditregels valt op tegen een extern anker',
  eigenaar: 'Security',
  bewijs: ['test/keten.test.js', 'test/ankerdienst.test.js', 'test/ankerdienst-echt.test.js',
    'test/ankerketen.test.js', 'test/ankertimer.test.js', 'test/auditspoor-atomair.pg.test.js'],
  bewijsstuk: 'POST /api/office/anker -- het GETEKENDE blok met de kop van elk journaal, plus de tegenproef',
  dekking: { beproefd: 0, totaal: 7, eenheid: 'auditjournalen met een anker dat BUITEN staat' },
  /* De noemer is 7: inzage, inlog, handelingen, onderzoekslab, de
     boardroom-journalen samen, en sinds audit P1-3c het API-spoor en het
     besluitjournaal van RTG Command. Een noemer die niet meegroeit, maakt van
     een gat stilletjes een percentage. */
  grens: 'DE KETEN IS GEBOUWD, MAAR DE CONTROL IS NIET IN BEDRIJF zolang er geen echte tweede machine ' +
    'staat. Wat er wel is (audit P1-3): het blok wordt getekend met een Ed25519-sleutel die niet in de ' +
    'database staat (server/lib/ankerzegel.js), de ankertimer haalt elke ronde eerst het vorige blok terug ' +
    'en rekent ermee af -- een afwijking laat het alarm afgaan en er gaat dan geen nieuw blok weg -- en ' +
    'publieke productie start niet zonder RTG_ANKERPOST_URL (server/config/productie-anker.js). ' +
    'scripts/ankerontvanger.js is een REFERENTIE-ontvanger (alleen bijschrijven, geen teruggang); de ' +
    'echte bestemming op een andere machine met onveranderlijke opslag is een besluit over de ' +
    'infrastructuur en staat buiten deze software. Een tweede machine BINNEN RTG ziet vervalsing door een ' +
    'hand; wie beide machines bestuurt, kan beide koppen afknippen (ankerpost.js punt 5).',
  inBedrijf: false
};

module.exports = { verankerPunt, verifieerTegenAnker, CONTROL };
