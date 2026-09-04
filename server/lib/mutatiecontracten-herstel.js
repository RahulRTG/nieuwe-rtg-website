/* MUTATIECONTRACTEN voor het eigenaarsherstel (kern/eigenaarherstel.js).

   Zeven routes, en ze zijn met opzet niet allemaal van dezelfde soort. Het
   verschil dat ertoe doet: **krijgt een herhaling een ander antwoord?** Dat is
   de toetsvraag van MUTATIECONTRACT.md, en hier is hij per route anders te
   beantwoorden -- dus hij is per route beantwoord en niet in een keer.

   `inrichten` is het scherpst. Twee keer inrichten geeft twee VERSCHILLENDE
   sets delen en maakt de eerste set dood. Zou iemand hem idempotent verklaren,
   dan geeft de idem-poort bij een herhaling het BEWAARDE antwoord terug -- en
   dan denkt een mens dat hij de delen van het geldige quorum voor zich heeft
   terwijl die van het vorige zijn. Dat is geen ongemak maar een quorum dat
   nergens meer op past.

   `start` is de enige die je met goed fatsoen herhaalbaar zou kunnen noemen:
   een tweede geldige start binnen een lopend herstel verandert niets en geeft
   dezelfde `klaarOp` terug. Toch staat hij hier als nietHerhaalbaar, want de
   FOUTE kant telt wel: elke poging met een verkeerd paar verhoogt de teller en
   kan het slot dichtzetten. Een route waarvan de ene helft telt en de andere
   niet, is niet idempotent -- hij is idempotent in het geval dat je hoopt, en
   dat is precies de verklaring die gevaarlijk is. */
'use strict';

const BEWIJS = { gemeten: 'test/eigenaarherstel.test.js: tien beweringen over de ceremonie met een gezette klok, twee mutaties gezien zakken', op: '2026-09-03' };
const AFGETEKEND = { door: 'Claude (Opus 5), handler per route gelezen op 3 september 2026; de idem-vraag per route apart beantwoord, niet door een mens nagelezen', op: '2026-09-03' };

const CONTRACTEN = {
  'POST /api/techniek/herstel/inrichten': {
    mutatieId: 'eigenaarherstel.inrichten',
    herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'techAuth + eigenaarAlleen + zware poort' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'elke aanroep munt drie NIEUWE delen en maakt de vorige set ongeldig. Een bewaard ' +
      'antwoord zou de delen van een quorum tonen dat niet meer bestaat.',
    bewijs: BEWIJS, afgetekend: AFGETEKEND
  },
  'POST /api/techniek/herstel/afbreken': {
    mutatieId: 'eigenaarherstel.afbreken',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'techAuth + eigenaarAlleen + zware poort' },
    stand: 'PROTECTED',
    waarom: 'de tweede aanroep vindt geen lopend herstel meer en verandert niets (404). Afbreken ' +
      'kan alleen naar een veiliger stand, dus herhalen kan geen schade doen.',
    bewijs: BEWIJS, afgetekend: AFGETEKEND
  },
  'POST /api/techniek/herstel/stand': {
    mutatieId: 'eigenaarherstel.stand',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'techAuth + eigenaarAlleen' },
    stand: 'NOT_APPLICABLE',
    waarom: 'leest alleen; schrijft niets.',
    nagekeken: 'Claude, 2026-09-03: de handler is een regel -- res.json(eigenaarherstel.stand()). ' +
      'stand() in kern/eigenaarherstel.js leest de eigen collectie via herstelstand() en stelt een ' +
      'antwoord samen: geen save(), geen meld(), geen mail. Het enige dat het lezen kan aanraken is ' +
      'de lazy init van de collectie (de lege log-array), en die is per definitie herhaalbaar. ' +
      'De opslagmeter ziet dat laatste wel; hij ziet niet dat er geen mail of melding uitgaat, en ' +
      'dat is precies het gat dat deze regel sluit.',
    bewijs: BEWIJS, afgetekend: AFGETEKEND
  },
  'POST /api/herstel/eigenaar/start': {
    mutatieId: 'eigenaarherstel.start',
    herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: { klasse: 'PUBLIC', deur: 'quorum (2 van 3) + rem per bron + vijf pogingen in de kern',
      waarom: 'Wie hier binnenkomt heeft per definitie geen sessie: dat IS het geval dat deze weg bedient -- een eigenaar zonder toestel. Een poort ervoor zou de deur sluiten voor precies de mens waarvoor hij bestaat. Wat hem beschermt is het quorum (twee van drie delen), een wachttijd van zeven dagen waarin elke werkende passkey hem afbreekt, een rem per bron plus vijf pogingen in de kern, en een kritieke melding met mail bij elke start. Zonder ingericht quorum bestaat de weg niet (EIGENAAR.md par. 5).' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'een geldige herhaling verandert niets, maar een ONgeldige telt een poging en kan het ' +
      'slot dichtzetten. Idempotent verklaren zou die tweede helft wegpoetsen -- en dat is precies ' +
      'de helft die het raden moet remmen.',
    bewijs: BEWIJS, afgetekend: AFGETEKEND
  },
  'POST /api/herstel/eigenaar/voltooien': {
    mutatieId: 'eigenaarherstel.voltooien',
    herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: { klasse: 'PUBLIC', deur: 'quorum (2 van 3) + verstreken wachttijd',
      waarom: 'Wie hier binnenkomt heeft per definitie geen sessie: dat IS het geval dat deze weg bedient -- een eigenaar zonder toestel. Een poort ervoor zou de deur sluiten voor precies de mens waarvoor hij bestaat. Wat hem beschermt is het quorum (twee van drie delen), een wachttijd van zeven dagen waarin elke werkende passkey hem afbreekt, een rem per bron plus vijf pogingen in de kern, en een kritieke melding met mail bij elke start. Zonder ingericht quorum bestaat de weg niet (EIGENAAR.md par. 5).' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'de eerste geslaagde aanroep sluit het lopende herstel en opent een venster; de tweede ' +
      'vindt geen lopend herstel meer. Hij snijdt daarnaast de sessies van het eigenaarsaccount door.',
    bewijs: BEWIJS, afgetekend: AFGETEKEND
  },
  'POST /api/herstel/eigenaar/passkey/opties': {
    mutatieId: 'eigenaarherstel.passkey.opties',
    herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: { klasse: 'PUBLIC', deur: 'alleen binnen het eenmalige herstelvenster',
      waarom: 'Zelfde weg, laatste stap. Een sessie is er nog steeds niet -- die ontstaat pas als de nieuwe passkey er is en de mens ermee inlogt. De poort is het eenmalige herstelvenster: buiten dat venster antwoordt hij 403, en het venster gaat een keer op.' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'munt een verse WebAuthn-uitdaging; een herhaling die de oude teruggaf zou die ' +
      'uitdaging herbruikbaar maken.',
    bewijs: BEWIJS, afgetekend: AFGETEKEND
  },
  'POST /api/herstel/eigenaar/passkey': {
    mutatieId: 'eigenaarherstel.passkey',
    herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: { klasse: 'PUBLIC', deur: 'alleen binnen het eenmalige herstelvenster',
      waarom: 'Zelfde weg, laatste stap. Een sessie is er nog steeds niet -- die ontstaat pas als de nieuwe passkey er is en de mens ermee inlogt. De poort is het eenmalige herstelvenster: buiten dat venster antwoordt hij 403, en het venster gaat een keer op.' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'zet de passkey en SLUIT het venster. Een tweede aanroep hoort te stuiten op een dicht ' +
      'venster; herhaalbaar maken zou van een geslaagd herstel een kwartier lang een open deur maken.',
    bewijs: BEWIJS, afgetekend: AFGETEKEND
  }
};

module.exports = { CONTRACTEN };
