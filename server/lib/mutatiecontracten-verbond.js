/* De mutatiecontracten van het verbond (kern/verbond/, GEMEENSCHAP-FASE0.md
   par. 4.2). Gemeten in test/verbond-server.test.js toets 5: elke route twee
   keer met hetzelfde lijf tegen een echte server, met daartussen een telling
   van verbonden, tijdlijnregels en meldingen. Na de tweede oproep was geen van
   drie veranderd, en het antwoord droeg hetzelfde verbond.

   De idempotentie zit in de module en niet in de duplicaatlaag: een herhaalde
   handeling wordt herkend aan de STAND (al getekend, al opgezegd door deze
   kant, dezelfde tekst, hetzelfde lopende voorstel). Een tweede kant die
   opzegt nadat de eerste al opzei, is geen herhaling maar een toestandsfout en
   krijgt 409 met de reden. */
'use strict';

const OP = '2026-10-11';
const AF = { door: 'Claude (Opus 5.5), op grond van test/verbond-server.test.js toets 5; niet door een mens nagelezen', op: OP };
const VERBOND = { klasse: 'OBJECT_SCOPED', objectVeld: 'verbond',
  uitleg: 'alleen een lid of beheerder van een van beide genootschappen; voor ieder ander bestaat het verbond niet (404)' };
const GROEP = { klasse: 'OBJECT_SCOPED', objectVeld: 'groep',
  uitleg: 'alleen een beheerder van het genootschap dat voorstelt (403), en het andere genootschap moet voor hem vindbaar zijn (404)' };
const LID = { klasse: 'AUTHENTICATED', deur: 'auth' };
const gemeten = (hoe) => ({ gemeten: 'test/verbond-server.test.js toets 5 (' + OP + '): ' + hoe, op: OP });

const schrijft = (mutatieId, toegang, hoe) => ({ mutatieId, herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang, stand: 'PROTECTED', bewijs: gemeten(hoe), afgetekend: AF });
const leest = (mutatieId, toegang, hoe) => ({ mutatieId, herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang, stand: 'NOT_APPLICABLE', bewijs: gemeten(hoe),
  nagekeken: 'Claude las de handler: alleen eigen.kijk() op verbonden, dat een ontbrekende collectie niet aanmaakt, en geen notify of save',
  afgetekend: AF });

const CONTRACTEN = {
  'POST /api/verbond/voorstel': schrijft('verbond.voorstel', GROEP,
    'de tweede gaf 200 met al: true en hetzelfde verbond; er bleef een verbond en een melding.'),
  'POST /api/verbond/teken': schrijft('verbond.teken', VERBOND,
    'de tweede gaf 200 met al: true; geen tweede tijdlijnregel en geen tweede melding.'),
  'POST /api/verbond/wijzig': schrijft('verbond.wijzig', VERBOND,
    'dezelfde tekst nog eens gaf 200 met al: true; de tekens bleven staan en er kwam geen regel bij.'),
  'POST /api/verbond/zeg-op': schrijft('verbond.zeg-op', VERBOND,
    'de tweede opzegging door dezelfde kant gaf 200 met al: true en de reden van de eerste bleef staan.'),
  'POST /api/verbond/mijn': leest('verbond.mijn', LID, 'twee keer 200 met een gelijk antwoord.'),
  'POST /api/verbond/lees': leest('verbond.lees', VERBOND, 'twee keer 200 met een gelijk antwoord.')
};

module.exports = { CONTRACTEN };
