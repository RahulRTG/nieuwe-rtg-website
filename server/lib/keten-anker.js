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
                 zo ver is doorgeschoven); niet te beoordelen, en dat zeggen we. */
function verifieerTegenAnker(regels, anker) {
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
    return { ok: true, weg: true,
      reden: 'regel ' + anker.nr + ' is uit het begrensde journaal geschoven; niet te beoordelen' };
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
  bewijs: ['test/keten.test.js'],
  bewijsstuk: 'inzagelog.anker() -- de momentopname die weggezet moet worden',
  dekking: { beproefd: 0, totaal: 4, eenheid: 'auditjournalen met een extern anker' },
  grens: 'ONTWORPEN, NIET IN BEDRIJF. Het mechanisme is bewezen (een ingekorte kop en ' +
    'een herschreven regel worden tegen een anker allebei betrapt), maar er wordt nergens ' +
    'een anker weggezet. Zonder bestemming buiten deze database beschermt dit niets.',
  inBedrijf: false
};

module.exports = { verankerPunt, verifieerTegenAnker, CONTROL };
