/* ============================================================================
   DE OUDERKANT VAN DE KINDEROPVANG: DE PROJECTIE IS HET ONTWERP

   HDI.md par. 7.10. Kinderopvang bestond in dit huis al volledig en elke route
   ernaartoe was een partnerroute; een ouder kon er niet bij. Deze laag is die
   deur, en zeven zinnen houden hem eerlijk:

     1. de aanwezigheidslijst komt er NOOIT uit -- `aanwezig` draagt voornamen
        van kinderen met de naam van hun ouder erbij, en dat is de gevoeligste
        data van dit genre;
     2. namen van nanny's komen er niet uit; alleen hoeveel er gescreend zijn;
     3. een vrije plek is een GETAL en geen belofte, en het antwoord zegt zelf
        dat een vrije plek geen plek IS;
     4. een aanvraag komt binnen op `aangevraagd` en RTG bevestigt hem nooit
        zelf (COMMERCE.md par. 3: maximaal klaarzetten);
     5. de ouder kan zijn eigen aanvraag intrekken zonder te bellen -- HDI.md
        par. 3 stelt die vraag bij elke module van deze laag, en wie hem met nee
        beantwoordt bouwt volgen in plaats van in beeld houden;
     6. een aanvraag van iemand anders is een 404 en geen geslaagde intrekking;
     7. alle partners met het genre komen in beeld, niet alleen wie zich
        aanmeldt (het besluit bij deze laag).

   MET EEN MUTATIE NAGETROKKEN (LAT.md regel 2):
     - `aanwezig` meegeven in de projectie: RAAK op 1;
     - de nanny-namen meegeven in plaats van een aantal: RAAK op 2;
     - `vrij` op de capaciteit zetten in plaats van op wat over is: RAAK op 3;
     - een aanvraag meteen op `bevestigd` zetten: RAAK op 4;
     - de intrekknop weghalen: RAAK op 5;
     - de eigendomscontrole in nannyWeg laten vallen: RAAK op 6;
     - alleen partners met een vlag tonen: RAAK op 7, maar ook op 2 t/m 6.

   DIE LAATSTE IS MET OPZET ZO OPGESCHREVEN. Een mutatie die zes toetsen omlegt
   is geen scherpe mutatie: als de partnerlijst leeg raakt valt alles om, dus
   toets 7 bewijst dan minder dan hij lijkt. Hij toetst wel het enige dat hier
   te toetsen valt -- dat de CAP de waarheid is en niet een tweede vlag -- en de
   eerlijke lezing is dat toets 7 de vorm van de lijst bewaakt en niet zijn
   inhoud. Zo'n aantekening is beter dan een mutatie die net zo lang wordt
   bijgeschaafd tot ze precies een toets raakt (LAT.md regel 9).

   ZONDER SERVER. De modules krijgen een nagebouwde `db` mee met twee partners;
   dat is genoeg, want deze laag rekent niet met de database maar projecteert
   hem. Zo is de projectie -- het enige dat hier werkelijk toe doet -- te toetsen
   zonder een draaiende server, en dus ook in de scherf die geen server heeft.

   Draai los: node --test test/opvangleden.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

/* Een nagebouwd huis met twee opvangpartners en een derde die het genre niet
   heeft. De derde staat erin omdat "alle partners" iets anders is dan "alle
   partners met dit genre", en dat verschil hoort te zakken als het wegvalt. */
function huis() {
  const data = {
    suppliers: [
      { code: 'NIDO', name: 'Nido Kinderopvang', city: 'Rotterdam', caps: ['opvang'] },
      { code: 'BIJT', name: 'De Bijtjes', city: 'Delft', caps: ['opvang'] },
      { code: 'KNIP', name: 'Knipsalon', city: 'Delft', caps: ['beauty'] }
    ],
    opvang: {}
  };
  const db = { data, capsVan: (s) => s.caps || [] };
  const save = () => {};
  const state = { db, save, crypto, schoon: (v, n) => String(v == null ? '' : v).trim().slice(0, n) };
  const opvang = require('../server/kern/verzorging/opvang')(state).opvang;
  const wijzer = require('../server/kern/verzorging/opvangleden')({ db, opvang }).opvangwijzer;
  return { db, opvang, wijzer };
}

const LID = { tier: 'rtg', key: 'lid-1' };
const morgen = () => new Date(Date.now() + 864e5).toISOString().slice(0, 10);

test('1. de aanwezigheidslijst komt er nooit uit', () => {
  const { opvang, wijzer } = huis();
  // een kind aanmelden zoals de opvang dat doet: voornaam van het kind, naam van de ouder
  const groep = opvang.overzicht('NIDO').groepen[0];
  const r = opvang.kindMeld('NIDO', { groepId: groep.id, voornaam: 'Fenna', ouder: 'Sarah de Wit' });
  assert.ok(r.ok, 'het kind hoort gewoon aangemeld te kunnen worden: ' + (r.error || ''));

  const beeld = wijzer.overzicht('Amberen Vos');
  const heel = JSON.stringify(beeld);
  assert.ok(!/Fenna/.test(heel), 'de voornaam van een kind hoort nooit in de ouderkant te staan');
  assert.ok(!/Sarah de Wit/.test(heel), 'en de naam van een andere ouder al helemaal niet');
  assert.ok(!/aanwezig/.test(heel), 'het veld `aanwezig` hoort de projectie niet te verlaten');
});

test('2. nannys komen als aantal terug, niet als namen', () => {
  const { wijzer } = huis();
  const beeld = wijzer.overzicht('Amberen Vos');
  const heel = JSON.stringify(beeld);
  assert.ok(!/Sofia|Mees/.test(heel),
    'nannys zijn medewerkers op hun werkplek; hun namen horen niet in een lijst die elke ouder opvraagt');
  const nido = beeld.opvangen.find(o => o.code === 'NIDO');
  assert.equal(nido.nannysGescreend, 2, 'hoeveel er gescreend zijn mag wel, want dat gaat over de opvang');
});

test('3. een vrije plek is een getal, en het antwoord zegt dat het geen plek is', () => {
  const { opvang, wijzer } = huis();
  const groep = opvang.overzicht('NIDO').groepen[0];      // capaciteit 9
  opvang.kindMeld('NIDO', { groepId: groep.id, voornaam: 'Fenna', ouder: 'Sarah' });
  opvang.kindMeld('NIDO', { groepId: groep.id, voornaam: 'Joep', ouder: 'Sarah' });

  const g = wijzer.overzicht('Amberen Vos').opvangen.find(o => o.code === 'NIDO').groepen[0];
  assert.equal(g.capaciteit, 9);
  assert.equal(g.vrij, 7, 'vrij hoort te tellen wat er OVER is, niet wat de groep groot is');

  const beeld = wijzer.overzicht('Amberen Vos');
  assert.match(beeld.grens, /niet dat u hem heeft/,
    'het antwoord hoort zelf te zeggen dat een vrije plek geen plek is');
  assert.match(beeld.zelfDoen, /reserveert hier niets/,
    'en dat RTG niets voor u aanvraagt (COMMERCE.md par. 3)');
});

test('4. een aanvraag komt binnen op aangevraagd, en RTG bevestigt hem nooit zelf', () => {
  const { wijzer } = huis();
  const r = wijzer.vraag(LID, 'Amberen Vos', { code: 'NIDO', datum: morgen(), van: '08:00', tot: '17:00', wens: 'twee dagen' });
  assert.ok(r.ok, r.error || '');
  assert.equal(r.aanvraag.status, 'aangevraagd',
    'een aanvraag die meteen bevestigd is, is een belofte die RTG niet mag doen');
  assert.match(r.wat_nu, /er is nog niets vastgelegd/,
    'en de ouder hoort te lezen dat er nog niets vaststaat');

  // een gast zet niets klaar, en een dag in het verleden ook niet
  assert.equal(wijzer.vraag({ tier: 'guest' }, 'X', { code: 'NIDO', datum: morgen(), van: '08:00', tot: '17:00' }).status, 403);
  assert.equal(wijzer.vraag(LID, 'X', { code: 'NIDO', datum: '2020-01-01', van: '08:00', tot: '17:00' }).status, 400);
  assert.equal(wijzer.vraag(LID, 'X', { code: 'BESTAATNIET', datum: morgen(), van: '08:00', tot: '17:00' }).status, 404);
});

test('5. de ouder kan zijn eigen aanvraag intrekken zonder te bellen', () => {
  const { wijzer } = huis();
  const r = wijzer.vraag(LID, 'Amberen Vos', { code: 'NIDO', datum: morgen(), van: '08:00', tot: '17:00' });
  assert.equal(wijzer.mijn('Amberen Vos').aanvragen.length, 1);

  const weg = wijzer.weg('Amberen Vos', 'NIDO', r.aanvraag.id);
  assert.ok(weg.ok, 'intrekken hoort te lukken: ' + (weg.error || ''));
  assert.equal(wijzer.mijn('Amberen Vos').aanvragen.length, 0,
    'na intrekken hoort de aanvraag weg te zijn; HDI.md par. 3: kan de persoon dit uitzetten zonder iemand te bellen?');
});

test('6. een aanvraag van iemand anders is een 404', () => {
  const { opvang, wijzer } = huis();
  const r = wijzer.vraag(LID, 'Amberen Vos', { code: 'NIDO', datum: morgen(), van: '08:00', tot: '17:00' });

  const stiekem = wijzer.weg('Grijze Reiger', 'NIDO', r.aanvraag.id);
  assert.equal(stiekem.status, 404, 'een id van iemand anders hoort een 404 te zijn, geen geslaagde intrekking');
  assert.equal(wijzer.mijn('Amberen Vos').aanvragen.length, 1, 'en de aanvraag hoort er nog te staan');

  // en wie hem ziet, ziet hem alleen op zijn eigen codenaam
  assert.equal(wijzer.mijn('Grijze Reiger').aanvragen.length, 0);

  /* Een BEVESTIGDE aanvraag trekt de ouder niet zelf terug: daar staat een mens
     voor ingepland. De melding zegt dat, en zegt niet "dit kan niet". */
  const bev = opvang.nannyZet('NIDO', { id: r.aanvraag.id, status: 'bevestigd', nannyId: 'n1' });
  assert.ok(bev.ok, bev.error || '');
  const na = wijzer.weg('Amberen Vos', 'NIDO', r.aanvraag.id);
  assert.equal(na.status, 409);
  assert.match(na.error, /contact op met de opvang/);
});

test('7. alle partners met het genre komen in beeld, en alleen die', () => {
  const { wijzer } = huis();
  const codes = wijzer.overzicht('Amberen Vos').opvangen.map(o => o.code).sort();
  assert.deepEqual(codes, ['BIJT', 'NIDO'],
    'wie de cap opvang heeft staat erin; er is geen tweede vlag waar een partner zich voor aanmeldt');
  assert.ok(!codes.includes('KNIP'), 'en een salon hoort er niet bij te staan');
});
