/* ============================================================================
   DE BEDOELING VAN DE WAARDEBEWEGENDE ROUTES -- geld dat het huis VERLAAT.

   Deel A (./mutatiecontracten-geld.js) gaat over routes die een STAND zetten,
   deel B over routes waar een tweede aanroep een tweede HANDELING is. Dit is de
   derde helft, en zij heeft een eigen onderwerp in plaats van alleen een
   omvangsgrens: hier gaat geld naar BUITEN. Een loonronde naar werknemers, een
   SEPA-opdracht naar een IBAN buiten RTG, en de uitbetaling aan een partner.

   WAAROM DAT EEN EIGEN CATEGORIE IS. Bij elke andere geldroute in dit register
   blijft de waarde binnen het stelsel, en dan is een dubbele boeking recht te
   zetten met een tegenboeking. Hier niet: wat de deur uit is, ligt bij een bank
   of bij een derde en komt niet vanzelf terug. Voor deze drie weegt de
   idempotentiesleutel dus zwaarder dan elders -- en bij twee van de drie is hij
   daarom ook werkelijk VERPLICHT.

   ZE KWAMEN PAS IN BEELD TOEN DE KAART HERMETEN WERD. GELDKAART.json stond op
   een oudere ronde en kende 42 waardebewegende routes; de verse ronde van
   12 september vindt er 45. Deze drie stonden niet fout verklaard -- ze stonden
   nergens, en dat is precies wat een hermeting hoort op te leveren.

   Zie de kop van deel A voor hoe deze contracten tot stand zijn gekomen en wat
   de aftekening wel en niet betekent.
   ========================================================================== */
'use strict';

const { AFGETEKEND } = require('./mutatiecontracten-geld');

const s = (klasse) => ({ klasse });

const CONTRACTEN = {
  'POST /api/bank/salaris': {
    mutatieId: 'bank.salaris', herkomst: 'mens', toegang: { klasse: 'AUTHENTICATED' }, semantiek: s('sleutelVereist'), stand: 'PROTECTED', afgetekend: AFGETEKEND,
    waarom: 'DE SLEUTEL IS VERPLICHT EN DE ROUTE ZEGT DAT ZELF. kern/bank/zakelijk.js geeft ' +
      'metIdem de optie `geld: "boekt een reeks posten ineens (bulk of loonronde)"`, en ' +
      'server/lib/idem.js weigert dan met 400 IDEMPOTENTIESLEUTEL_VERPLICHT zodra er geen ' +
      '`idem` in het lijf staat. Een loonronde zonder sleutel twee keer versturen zou een hele ' +
      'reeks mensen dubbel betalen; dat kan hier niet, want de aanroep komt niet eens langs de ' +
      'poort. Met dezelfde sleutel geeft de tweede aanroep het bewaarde antwoord terug.',
    bewijs: { gemeten: 'PROTECTED: de server merkte de herhaling zelf (herhaald: true) -- idempotentieronde 12 september 2026', op: '2026-09-12' }
  },

  'POST /api/bank/sepa': {
    mutatieId: 'bank.sepa', herkomst: 'mens', toegang: { klasse: 'AUTHENTICATED' }, semantiek: s('sleutelVereist'), stand: 'PROTECTED', afgetekend: AFGETEKEND,
    waarom: 'DIT IS DE ENIGE ROUTE IN DEZE DRIE WAARBIJ HET GELD HET HUIS ECHT VERLAAT. ' +
      'kern/bank/overboeken.js draagt `geld: "stuurt geld het huis uit, naar een IBAN buiten ' +
      'RTG"`, dus de sleutel is verplicht op dezelfde harde manier als bij de loonronde. Dat ' +
      'weegt hier zwaarder dan elders: een dubbele interne boeking is met een tegenboeking ' +
      'recht te zetten, maar een tweede SEPA-opdracht ligt bij een bank buiten RTG en komt ' +
      'niet vanzelf terug. De klasse zegt daarom `sleutelVereist` en niet `compenseerbaar`.',
    bewijs: { gemeten: 'PROTECTED: de server merkte de herhaling zelf (herhaald: true) -- idempotentieronde 12 september 2026', op: '2026-09-12' }
  },

  'POST /api/supplier/pay/uitbetaal': {
    mutatieId: 'pay.partner.uitbetaal', herkomst: 'mens', toegang: { klasse: 'AUTHENTICATED' }, semantiek: s('sleutelVereist'), stand: 'PROTECTED', afgetekend: AFGETEKEND,
    waarom: 'DE SLEUTEL BESCHERMT, MAAR HIJ IS HIER NIET VERPLICHT -- en dat verschil hoort ' +
      'genoemd. kern/pay/partner.js roept `metIdem(idem ? "uit:" + supplierCode + ":" + idem : ' +
      'null, ...)` aan ZONDER de optie `geld`, anders dan bank/sepa en bank/salaris hierboven. ' +
      'Stuurt een aanroeper geen sleutel, dan valt metIdem terug op het kale werk. Wat een ' +
      'tweede uitbetaling dan tegenhoudt is geen sleutel maar de TOESTAND: er wordt uitbetaald ' +
      'wat BESCHIKBAAR is, en na de eerste ronde is dat nul (400 "Er staat niets beschikbaars"). ' +
      'Dat is een echte bescherming en geen toeval, maar het is een andere dan de twee ' +
      'hierboven: komt er tussen twee aanroepen geld binnen, dan betaalt de tweede dat terecht ' +
      'uit. De klasse blijft `sleutelVereist` omdat dat precies is wat haar uitleg zegt -- ' +
      'zonder sleutel is een herhaling een tweede handeling.',
    bewijs: { gemeten: 'PROTECTED: de server merkte de herhaling zelf (herhaald: true) -- idempotentieronde 12 september 2026', op: '2026-09-12' }
  }
};

module.exports = { CONTRACTEN, AFGETEKEND
};

module.exports = { CONTRACTEN };
