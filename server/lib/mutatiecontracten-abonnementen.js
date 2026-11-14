/* Nieuwe versiegebonden abonnementen. Bewijs hieronder is lokaal gemeten,
   niet door een mens afgetekend en geen acceptatie door een live provider. */
'use strict';
const op = '2026-11-13';
const afgetekend = { door: 'Codex, op grond van lokale regressies en broninspectie; niet door een mens nagelezen', op };
function schrijf(naam, gemeten) {
  return { mutatieId: 'abonnementen.' + naam, herkomst: 'mens', semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' }, stand: 'PROTECTED', bewijs: { gemeten, op }, afgetekend };
}
const CONTRACTEN = {
  'POST /api/mijn/abonnement/automatisch/aanbod': schrijf('aanbod',
    'abonnementsaanbod.test.js en -route.test.js: eigen UUID met dezelfde inhoud herhaalt dezelfde snapshot; andere inhoud conflicteert; vreemde actor uitgesloten. SQLite-ketentest leest duurzaam aanbod in tweede proces.'),
  'POST /api/mijn/abonnement/automatisch/teken': schrijf('teken',
    'abonnementsaanbod-ontvangst.test.js: bestaande ontvangst en eigen aanbodhash, echte expliciete instemming plus apart mandaat; replay zonder tweede ontvangst. SQLite-ketentest verifieert ontvangst via tweede proces.'),
  'POST /api/mijn/abonnement/automatisch/betalen': schrijf('betalen',
    'abonnementen-keten.test.js en abonnementen-sqlite.test.js: zelfde factuur/BW-sleutel na verloren opslagantwoord, provideronzekerheid en activeringsfout; nulcredit maakt geen centbetaling. Provider is lokale testadapter, niet Stripe-live.'),
  'POST /api/mijn/abonnement/automatisch/herstel': schrijf('herstel',
    'abonnementen-keten.test.js en betaalwaarheid-publicatie.test.js: betaalde termijn herstelt idempotent, zonder tweede inning; herpublicatie van typed collecties verliest geen bewijs. stripe-klantactie.test.js controleert bestaande PI en geen nieuwe create.'),
  'POST /api/mijn/abonnement/automatisch/intrekken': schrijf('intrekken',
    'abonnementsaanbod-intrekken.test.js: eigen aanbodhash, herhaling, afwijzen na betaalstart en gelijktijdige typed reservering; volledige broncredit wordt vrijgegeven, bestaande ondertekening blijft bewaard.'),
  'POST /api/mijn/abonnement/automatisch/stand': {
    mutatieId: 'abonnementen.stand', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' }, stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'abonnementsaanbod-route.test.js: eigen stand, vreemd account leeg, gesloten route zonder mutatie. Geen providerstatus uit browser als betalingsbewijs.', op },
    nagekeken: 'Route, abonnementen.mijn, abonnementsaanbod.mijn en pure abonnementsherstelprojectie gelezen: alleen bestaande collecties en domeinregister lezen; geen save, notify of provider-I/O. Response no-store; geen klantsecret.',
    afgetekend
  }
};
module.exports = { CONTRACTEN };
