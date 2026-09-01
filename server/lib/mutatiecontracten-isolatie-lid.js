/* DE BEDOELING VAN DE ZES SCHRIJFROUTES VAN HET LEDENSCHERM.

   Los van ./mutatiecontracten-isolatie.js (de kantoorkant) omdat de bewijskracht
   verschilt en dat verschil niet mag verdwijnen tussen twaalf regels: daar wordt
   db.data byte voor byte vergeleken, hier draait een echte server met een
   database die de toets niet kan uitlezen.

   Wat deze zes verder van de kantoorkant onderscheidt is de TOEGANG. Daar is het
   eigenaar-only; hier is het OBJECT_SCOPED op req.session.key, en dat is de enige
   regel die er echt toe doet: zou een lid zijn eigen sleutel mogen meesturen, dan
   kan hij de sessie van iemand anders in isolatie zetten. */
'use strict';

const AFGETEKEND = {
  door: 'Claude (Opus 5), op grond van de meegedraaide meting in test/isolatie-lid.test.js; ' +
    'niet door een mens nagelezen',
  op: '2026-09-01'
};

/* DE LEDENROUTES DRAGEN EEN EIGEN BEWIJS, en dat is met opzet een ZWAKKERE
   formulering dan hierboven. De kernmeting vergelijkt db.data byte voor byte;
   de ledenroutes draaien tegen een echte server met een database die de toets
   niet kan uitlezen, dus daar wordt het ANTWOORD en de STAND vergeleken. Dat is
   minder scherp -- een schrijfactie in een collectie die het antwoord niet raakt,
   zou hij missen -- en die grens hoort in het bewijs te staan en niet in de
   marge. */
const BEWIJS_LID = {
  gemeten: 'twee identieke aanroepen tegen een draaiende server; antwoord en stand daarna vergeleken ' +
    '(test/isolatie-lid.test.js, toets 6). Zwakker dan een byte-vergelijking van db.data: een ' +
    'schrijfactie die het antwoord niet raakt, zou deze meting missen',
  op: '2026-09-01'
};

const CONTRACTEN = {
  'POST /api/isolatie/mijn': {
    mutatieId: 'isolatie.mijn.lezen',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'req.session.key',
      wat: 'het antwoord gaat uitsluitend over de dragers van de ingelogde sessie' },
    stand: 'NOT_APPLICABLE',
    nagekeken: 'de handler is regel voor regel gelezen bij het schrijven ervan (1 september 2026) en ' +
      'roept alleen isolatie.context(), standVan() en ontsluiting.open() aan; geen van drieën schrijft. ' +
      'De gemeten ronde bevestigt dat twee aanroepen hetzelfde teruggeven.',
    waarom: 'deze route leest de eigen stand en verandert niets.',
    bewijs: BEWIJS_LID,
    afgetekend: AFGETEKEND
  },
  'POST /api/isolatie/mijn/zet': {
    mutatieId: 'isolatie.mijn.zet',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'req.session.key',
      wat: 'de sleutel komt uit de SESSIE en nooit uit het verzoek; een lid kan alleen zijn eigen ' +
        'identiteit, sessie of apparaat zetten' },
    stand: 'PROTECTED',
    waarom: 'de tweede aanroep ziet dat de drager al op die stand staat en komt terug met ' +
      '`richting: ongewijzigd`: geen schrijfactie, geen spoorregel. Verlagen kan langs deze route ' +
      'sowieso niet -- dat loopt over de ceremonie.',
    bewijs: BEWIJS_LID,
    afgetekend: AFGETEKEND
  },
  'POST /api/isolatie/mijn/ontsluiting': {
    mutatieId: 'isolatie.mijn.ontsluiting.start',
    herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'req.session.key',
      wat: 'de drager wordt uit de sessie afgeleid' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'een tweede verzoek IS een tweede verzoek, en dat hoort zo: het weigeren zou betekenen ' +
      'dat een vergeten of half afgemaakt verzoek de drager voorgoed vastzet. Het verzoek verlaagt ' +
      'zelf niets, dus een tweede verzoek kost een regel in de lijst en geen bevoegdheid.',
    bewijs: BEWIJS_LID,
    afgetekend: AFGETEKEND
  },
  'POST /api/isolatie/mijn/ontsluiting/stap': {
    mutatieId: 'isolatie.mijn.ontsluiting.stap',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'req.body.id + req.session.key',
      wat: 'het verzoek moet aan een drager van DEZE sessie hangen; een vreemd nummer krijgt ' +
        'hetzelfde antwoord als een verzonnen nummer' },
    stand: 'PROTECTED',
    waarom: 'dezelfde stap nog eens aftekenen laat de EERSTE aftekening staan, met haar ' +
      'oorspronkelijke tijdstip -- het gegeven waar de wachttijd aan hangt.',
    bewijs: BEWIJS_LID,
    afgetekend: AFGETEKEND
  },
  'POST /api/isolatie/mijn/ontsluiting/commit': {
    mutatieId: 'isolatie.mijn.ontsluiting.commit',
    herkomst: 'mens',
    semantiek: { klasse: 'hooguitEens' },
    toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'req.body.id + req.session.key' },
    stand: 'PROTECTED',
    waarom: 'zelfde vorm als de kantoorkant: 409 op een verzoek dat niet meer open staat, en er ' +
      'verandert niets. De bescherming is die statuscontrole in de route zelf en niet een ' +
      'idempotentiesleutel.',
    bewijs: BEWIJS_LID,
    afgetekend: AFGETEKEND
  },
  'POST /api/isolatie/mijn/ontsluiting/afbreken': {
    mutatieId: 'isolatie.mijn.ontsluiting.afbreken',
    herkomst: 'mens',
    semantiek: { klasse: 'hooguitEens' },
    toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'req.body.id + req.session.key' },
    stand: 'PROTECTED',
    waarom: 'de tweede aanroep wordt met 409 geweigerd omdat het verzoek al is afgebroken; gemeten.',
    bewijs: BEWIJS_LID,
    afgetekend: AFGETEKEND
  }
};

module.exports = { CONTRACTEN };
