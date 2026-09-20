/* Mutatiecontracten voor muziek van mensen in RTG Sound. De twee leesroutes
   raken niets aan; publiceren, waarderen en verwijderen zijn tegen een
   netwerretry beschermd. Alleen een luisterkaart is bewust telkens nieuw. */
'use strict';

const AUTH = { klasse: 'AUTHENTICATED' };
const AF = { door: 'Codex, muziekfeedkern en routes gelezen en met twee leden beproefd', op: '2026-09-19' };
const bewijs = gemeten => ({ gemeten: 'test/muziek-bestanden.test.js ' + gemeten, op: '2026-09-19' });
const beschermd = (mutatieId, klasse, gemeten) => ({
  mutatieId, herkomst: 'mens', semantiek: { klasse }, toegang: AUTH,
  stand: 'PROTECTED', bewijs: bewijs(gemeten), afgetekend: AF
});
const lezer = (mutatieId, gemeten) => ({
  mutatieId, herkomst: 'mens', semantiek: { klasse: 'idempotent' }, toegang: AUTH,
  stand: 'NOT_APPLICABLE', bewijs: bewijs(gemeten),
  nagekeken: 'Codex, 2026-09-19: handler en kernfunctie gelezen; zij filteren en projecteren db.data.muziekBestanden zonder save, bestandsschrijfweg of externe oproep',
  afgetekend: AF
});

const CONTRACTEN = {
  'POST /api/muziek/bestand': beschermd('muziek.feed.publiceren', 'sleutelVereist',
    'herhaalt dezelfde Idempotency-Key en ontvangt hetzelfde nummer zonder tweede bestand of feedregel'),
  'POST /api/muziek/bestanden': lezer('muziek.feed.eigen',
    'leest de eigen lijst en laat opslag en bestanden ongemoeid'),
  'POST /api/muziek/feed': lezer('muziek.feed.lezen',
    'leest als tweede lid de openbare feed en laat opslag en bestanden ongemoeid'),
  'POST /api/muziek/bestand-ticket': {
    mutatieId: 'muziek.feed.luisterkaart', herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' }, toegang: AUTH,
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Elke bewuste aanvraag maakt een nieuwe korte luisterkaart; kaarten zijn onafhankelijke, tijdelijke capabilities en veranderen het nummer of de feed niet.',
    bewijs: bewijs('vraagt een luisterkaart aan, gebruikt haar volledig en met byte-ranges en toont dat een onbekende kaart niets ontsluit'),
    afgetekend: AF
  },
  'POST /api/muziek/bestand-weg': beschermd('muziek.feed.verwijderen', 'idempotent',
    'verwijdert één eigen nummer, trekt de kaart in en toont dat feedregel en versleutelde bytes wegblijven'),
  'POST /api/muziek/mooi': beschermd('muziek.feed.waarderen', 'idempotent',
    'zet waardering expliciet aan en herhaalt dezelfde stand zonder dubbeltelling')
};

module.exports = { CONTRACTEN };
