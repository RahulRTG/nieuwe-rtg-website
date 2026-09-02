/* DE BEDOELING VAN DE ZES SCHRIJFROUTES VAN DE ISOLATIELAAG.

   Zes regels, en alle zes zijn ze GEMETEN in plaats van ingevuld. De meting
   staat in test/isolatie.test.js toets 9 en draait mee: hij vergelijkt db.data
   byte voor byte na de eerste en na de tweede aanroep. Byte voor byte en niet
   per veld, want anders bepaalt degene die de toets schrijft welke velden
   meetellen.

   TWEE VAN DE ZES ZIJN OM DEZE REDEN VERANDERD, en dat hoort hier te staan
   omdat het contract anders een gedrag beschrijft dat er niet was:

   1. `zet` schreef bij een tweede identieke aanroep dezelfde stand opnieuw weg
      EN een spoorregel die zei dat er iets was verstrengd. Het spoor loog dan
      over een handeling die niet plaatsvond. Hij doet nu niets.
   2. `stap` overschreef het tijdstip van een al afgetekende stap. Daarmee
      verschoof het moment waarop het bewijs geleverd wérd -- het gegeven waar
      een wachttijd en een onderzoek achteraf aan hangen. De eerste blijft staan.

   WAAROM DE COMMIT `PROTECTED` HEET EN TOCH GEEN IDEMPOTENTIESLEUTEL HEEFT.
   MUTATIECONTRACT.md staat erop dat een herhaling die wordt GEWEIGERD een
   toestandscontrole is en geen idempotentie. Dat klopt, en daarom staat het er
   met zoveel woorden bij: de bescherming is de statuscontrole in de route zelf
   ("dit verzoek is al voltooid"), wat de klasse toestaat als "een eigen
   afhandeling in de route". Wie dit later leest en er een sleutel bij zoekt,
   vindt hem niet, en dat is geen omissie. */
'use strict';

const BEWIJS = {
  gemeten: 'db.data byte voor byte vergeleken na de eerste en na de tweede aanroep ' +
    '(test/isolatie.test.js, toets 9 -- hij draait mee en veroudert dus niet)',
  op: '2026-09-01'
};

const AFGETEKEND = {
  door: 'Claude (Opus 5), op grond van de meegedraaide meting in test/isolatie.test.js; ' +
    'niet door een mens nagelezen',
  op: '2026-09-01'
};

/* WAAROM ALLE ZES `AUTHENTICATED` DRAGEN EN NIET `CAPABILITY_GATED`, terwijl ze
   achter `eigenaarAlleen` staan en dus strenger zijn dan "elke ingelogde
   identiteit". CAPABILITY_GATED eist de NAAM van een bevoegdheid, zodat
   kern/bevoegdheid/lijst.js en de route over hetzelfde ding praten. Die lijst
   kent geen eigenaar-bevoegdheid: `eigenaarAlleen` is een vaste rolcontrole en
   geen vermogen dat iemand kan hebben of niet.

   De klasse invullen die het strengst KLINKT zou het register laten zeggen dat
   er een bevoegdheid bestaat die er niet is, en dan gaat iemand hem later
   zoeken. De klasse staat dus op wat de router werkelijk waarneemt, en de
   strengere deur staat er als `deur` naast. Dat het register geen klasse heeft
   voor een vaste rol, is een gat in het register en geen eigenschap van deze
   zes routes -- het hoort daar opgelost te worden en niet hier weggeschreven. */

const CONTRACTEN = {
  'POST /api/techniek/isolatie/zet': {
    mutatieId: 'isolatie.zet',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'techAuth + eigenaarAlleen' },
    stand: 'PROTECTED',
    waarom: 'de tweede aanroep ziet dat de drager al op die stand staat en doet niets: geen ' +
      'schrijfactie, geen spoorregel, geen melding. Verlagen kan langs deze route sowieso niet.',
    bewijs: BEWIJS,
    afgetekend: AFGETEKEND
  },
  'POST /api/techniek/isolatie/ontsluiting': {
    mutatieId: 'isolatie.ontsluiting.start',
    herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'techAuth + eigenaarAlleen' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'een tweede verzoek IS een tweede verzoek, en dat hoort zo. Het weigeren zou betekenen ' +
      'dat een vergeten of half afgemaakt verzoek de drager voorgoed vastzet -- en dan wordt de ' +
      'ceremonie de reden dat niemand hem meer gebruikt. Het verzoek verlaagt zelf niets, dus een ' +
      'tweede verzoek verlaagt ook niets: het kost een regel in de lijst en geen bevoegdheid.',
    bewijs: BEWIJS,
    afgetekend: AFGETEKEND
  },
  /* DE BEVESTIGING AANVRAGEN. Zie de ledenkant: de challenge munten en de
     assertie inleveren zijn twee gebeurtenissen. */
  'POST /api/techniek/isolatie/ontsluiting/stap/opties': {
    mutatieId: 'isolatie.ontsluiting.stap.opties',
    herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'techAuth + eigenaarAlleen' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'elke aanroep munt een nieuwe WebAuthn-uitdaging; een herhaling die de oude teruggaf ' +
      'zou de uitdaging herbruikbaar maken en daarmee de binding opheffen waarvoor de route bestaat.',
    bewijs: { gemeten: 'niet gemeten: de uitkomst is per ontwerp verschillend', op: '2026-09-02' },
    afgetekend: AFGETEKEND
  },
  'POST /api/techniek/isolatie/ontsluiting/stap': {
    mutatieId: 'isolatie.ontsluiting.stap',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'techAuth + eigenaarAlleen' },
    stand: 'PROTECTED',
    waarom: 'dezelfde stap nog eens aftekenen laat de EERSTE aftekening staan, met haar oorspronkelijke ' +
      'tijdstip. Dat tijdstip is het gegeven waar de wachttijd en een onderzoek achteraf aan hangen.',
    bewijs: BEWIJS,
    afgetekend: AFGETEKEND
  },
  'POST /api/techniek/isolatie/ontsluiting/commit': {
    mutatieId: 'isolatie.ontsluiting.commit',
    herkomst: 'mens',
    semantiek: { klasse: 'hooguitEens' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'techAuth + eigenaarAlleen' },
    stand: 'PROTECTED',
    waarom: 'de tweede aanroep wordt met 409 geweigerd omdat het verzoek niet meer open staat, en er ' +
      'verandert niets. De bescherming is die statuscontrole in de route zelf en NIET een ' +
      'idempotentiesleutel -- een toestandscontrole is iets anders dan idempotentie, en die twee ' +
      'lopen hier met opzet niet door elkaar.',
    bewijs: BEWIJS,
    afgetekend: AFGETEKEND
  },
  'POST /api/techniek/isolatie/ontsluiting/afbreken': {
    mutatieId: 'isolatie.ontsluiting.afbreken',
    herkomst: 'mens',
    semantiek: { klasse: 'hooguitEens' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'techAuth + eigenaarAlleen' },
    stand: 'PROTECTED',
    waarom: 'zelfde vorm als de commit: 409 op een verzoek dat niet meer open staat, en niets verandert.',
    bewijs: BEWIJS,
    afgetekend: AFGETEKEND
  },
  'POST /api/techniek/isolatie/proef': {
    mutatieId: 'isolatie.proef',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'techAuth + eigenaarAlleen' },
    stand: 'NOT_APPLICABLE',
    nagekeken: 'de handler is regel voor regel gelezen bij het schrijven ervan (1 september 2026) en ' +
      'roept alleen isolatie.context(), isolatie.besluit() en het isolatiefilter aan; geen van drieën ' +
      'schrijft. De gemeten ronde bevestigt dat db.data niet beweegt. Dat er GEEN spoorregel ontstaat ' +
      'is hier het punt: een proef die zichtbaar wordt in het audit, is geen proef meer maar een ' +
      'handeling, en dan durft niemand hem te draaien voor hij een klant dichtzet.',
    waarom: 'deze route rekent uit wat er zou gebeuren en voert niets uit.',
    bewijs: BEWIJS,
    afgetekend: AFGETEKEND
  }
};

module.exports = { CONTRACTEN };
