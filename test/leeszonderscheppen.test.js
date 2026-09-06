/* LEZEN ZONDER SCHEPPEN -- de tegenproef van een hele klasse.

   scripts/lib/eigencollectie.js kent twee deuren naar de eigen opslag van een
   domein: bak() maakt de collectie aan als hij er nog niet is, kijk() geeft een
   bevroren lege terug zonder iets te scheppen. Wie een weigering (400/403/404)
   achter een bak() zet, laat meubilair achter dat de aanvrager nooit had mogen
   maken: db.data groeit door verzoeken die NIETS mochten. Op openbare routes is
   dat door een vreemde te sturen.

   Deze toets is met opzet EEN bestand met een blok per module, en niet veertig
   losse bestanden. De vorm is per module identiek -- roep het weigerpad aan op
   een verse db en eis dat de collectie er daarna niet staat -- dus veertig
   scenario's zijn hier veertig regels en geen veertig scenario's. Elk blok
   draait volledig in het geheugen: geen server, geen db.json, geen accounts.

   Elk blok draagt ook de TEGENPROEF: het schrijfpad moet heel blijven. Wie een
   bak() te breed omzet, laat een net weggeschreven waarde in een vluchtig
   object verdwijnen -- en dat is erger dan het gebrek dat hier gerepareerd
   wordt, want het antwoord zegt dan nog steeds "gelukt".

   Draai los: node --test test/leeszonderscheppen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const heeft = (db, naam) => Object.prototype.hasOwnProperty.call(db.data, naam);
const geenMeubilair = (db, naam, wat) =>
  assert.equal(heeft(db, naam), false, wat + ' laat geen lege ' + naam + ' achter');

/* ------------------------------------------------------------------ algpin */
test('algpin: een pin opzoeken die er niet is, schept geen collectie', async () => {
  const { maakAlgPin } = require('../server/kern/algpin');
  const db = { data: {} };
  const k = maakAlgPin({
    db, save: () => {}, crypto: require('node:crypto'),
    slot: { dicht: () => false, fout: () => {}, goed: () => {} },
  });

  assert.equal(k.pinInfo('lid-1').gezet, false);
  geenMeubilair(db, 'algPin', 'pinInfo op een onbekend lid');

  const herstel = await k.pinHerstelZet('onzin', '1234');
  assert.equal(herstel.status, 400);
  geenMeubilair(db, 'algPinHerstel', 'een verlopen herstellink');

  assert.equal((await k.pinCheck('lid-1', '1234')).gezet, false);
  geenMeubilair(db, 'algPin', 'pinCheck zonder gezette pin');

  /* TEGENPROEF: het schrijfpad blijft heel. Wie rij() in zijn geheel omzet,
     krijgt hier {ok:true} terwijl er niets is bewaard. */
  assert.equal((await k.pinZet('lid-1', { pin: '2468' })).ok, true);
  assert.ok(db.data.algPin['lid-1'], 'de gezette pin staat echt in db.data');
  assert.equal((await k.pinCheck('lid-1', '2468')).ok, true);
  assert.equal((await k.pinCheck('lid-1', '1357')).status, 401);
});

/* ----------------------------------------------------------- beroepenbieb */
test('beroepenbieb: een app verwijderen die er niet staat, schept geen rij', () => {
  const { maakBeroepenBieb } = require('../server/kern/beroepenbieb');
  const db = { data: {} };
  let bewaard = 0;
  const { beroepenbieb } = maakBeroepenBieb({ db, save: () => { bewaard++; } });

  assert.equal(beroepenbieb.verwijder('handle-1', 'techniek-0').status, 404);
  geenMeubilair(db, 'beroepenInstallaties', 'een 404 op verwijder');
  assert.equal(bewaard, 0, 'en bewaart niets');

  assert.deepEqual(beroepenbieb.mijnApps('handle-1'), []);
  geenMeubilair(db, 'beroepenInstallaties', 'mijnApps op een leeg lid');

  /* TEGENPROEF: installeren schrijft nog in de echte rij, en verwijderen
     landt op diezelfde rij en niet op een vluchtige kopie. */
  assert.ok(beroepenbieb.installeer('handle-1', 'techniek-0').ok);
  assert.equal(beroepenbieb.mijnApps('handle-1').length, 1);
  assert.equal(beroepenbieb.verwijder('handle-1', 'techniek-0').aantal, 0);
  assert.deepEqual(db.data.beroepenInstallaties['handle-1'], []);
});

/* ------------------------------------------------------- commercie/voornemen */
test('voornemen: een onbekend voornemen staken schept geen lijst', () => {
  const { maakVoornemens } = require('../server/kern/commercie/voornemen');
  const db = { data: {} };
  const V = maakVoornemens({ db, save: () => {} });

  assert.equal(V.staak('VN-BESTAAT-NIET', 'toets').status, 404);
  geenMeubilair(db, 'voornemens', 'een 404 op staak');
  assert.equal(V.keur('VN-BESTAAT-NIET', {}).status, 404);
  geenMeubilair(db, 'voornemens', 'een 404 op keur');

  /* TEGENPROEF: een voornemen dat wel wordt aangemaakt, is daarna vindbaar
     -- de lezer geeft de ECHTE lijst zodra hij bestaat. */
  const gemaakt = V.stelOp({ actor: 'toets', handeling: 'toets.tegenproef',
    doel: 'een tegenproef', stappen: [{ wat: 'een tegenproef draaien', centen: 0 }] });
  assert.ok(gemaakt.voornemen, 'het voornemen is opgesteld: ' + (gemaakt.error || ''));
  assert.equal(V.staak(gemaakt.voornemen.id, 'toets').ok, true);
  assert.equal(db.data.voornemens[0].stand, 'GESTAAKT', 'de stand staat in db.data');
});

/* ---------------------------------------------------------------- care/zaak */
test('care: een onbekende pakketboeking betalen schept geen catalogus', () => {
  const maakZaak = require('../server/kern/care/zaak.js');
  const db = { data: {} };
  const { carePakketBetaal } = maakZaak({
    db, save: () => {}, crypto: require('node:crypto'),
    nu: () => new Date().toISOString(), notify: () => {},
  });

  assert.equal(carePakketBetaal({ key: 'k1' }, 'RTG-P-BESTAATNIET').status, 404);
  geenMeubilair(db, 'carePakketBoekingen', 'een 404 op carePakketBetaal');
  geenMeubilair(db, 'carePakketten', 'een 404 op carePakketBetaal');

  /* TEGENPROEF: bestaat de boeking wel, dan schrijft de betaling in de ECHTE
     lijst -- de lezer levert geen vluchtige kopie op. */
  db.data.carePakketBoekingen = [{
    ref: 'R1', key: 'k1', paid: false, at: new Date().toISOString(), prijs: 995,
    naam: 'Herstel & Ontspan', nachten: 2, hotelNaam: 'Aguamarina', datum: '2026-09-07',
    tijd: '11:00', careRef: 'C1',
  }];
  assert.equal(carePakketBetaal({ key: 'k1' }, 'R1').ok, true);
  assert.equal(db.data.carePakketBoekingen[0].paid, true, 'de betaling staat in db.data');
  assert.equal(carePakketBetaal({ key: 'k1' }, 'R1').status, 409);
});

/* ------------------------------------------------------ fiscaal/btwaangifte */
test('btwaangifte: een aangifte indienen die niet bestaat, schept geen register', () => {
  const { maakBtwAangifte } = require('../server/kern/fiscaal/btwaangifte');
  const db = { data: { facturen: [] } };
  let bewaard = 0;
  const { btwAangifte } = maakBtwAangifte({
    db, save: () => { bewaard++; }, crypto: require('node:crypto'),
    nu: () => '2026-11-09T12:00:00.000Z',
  });

  assert.equal(btwAangifte.dienIn('btw_bestaatniet', 'Beheer', 'ABCD1234').status, 404);
  geenMeubilair(db, 'btwAangiftes', 'een 404 op dienIn');
  assert.deepEqual(btwAangifte.vanZaak('SAL'), []);
  geenMeubilair(db, 'btwAangiftes', 'vanZaak op een zaak zonder aangiftes');
  assert.equal(bewaard, 0);

  /* TEGENPROEF -- de belangrijkste van dit blok: een aangifte die WEL wordt
     gemaakt, moet in db.data landen. Deze regel zakt zodra iemand ook het
     schrijfpad op kijk() zet. */
  db.data.facturen = [{
    id: 'f1', nummer: '2026-001', code: 'SAL', datum: '2026-08-14', status: 'betaald',
    verkoper: { code: 'SAL', land: 'NL' }, klant: { naam: 'Klant' },
    regels: [{ omschrijving: 'werk', incl: 121, btw: 21 }],
    subtotaal: 100, btwBedrag: 21, totaal: 121,
  }];
  const g = btwAangifte.maak({ code: 'SAL', name: 'Sal', settings: { land: 'NL' } }, '2026K3', 'Beheer');
  assert.ok(g.ok, 'de aangifte is gemaakt: ' + (g.error || ''));
  assert.equal(db.data.btwAangiftes.length, 1, 'de aangifte staat in db.data');
});

/* --------------------------------------------------- fiscaal/gateway/index */
test('gateway: een zending opzoeken die niet bestaat, schept geen collectie', async () => {
  const { maakGateway } = require('../server/kern/fiscaal/gateway');
  const db = { data: {} };
  const { gateway } = maakGateway({
    db, save: () => {}, crypto: require('node:crypto'), nu: () => '2026-10-05T09:00:00.000Z',
    mandaat: { geldt: () => ({ ok: false, reden: 'geen mandaat' }) }, kanalen: {},
  });

  assert.equal(gateway.controleer('zdg_bestaatniet').status, 404);
  geenMeubilair(db, 'gatewayZendingen', 'een 404 op controleer');
  assert.deepEqual(gateway.vanZaak('KIKUNOI'), []);
  geenMeubilair(db, 'gatewayZendingen', 'vanZaak op een zaak zonder zendingen');
  assert.equal((await gateway.biedAan('zdg_x', 'Beheer')).status, 404);
  assert.equal(gateway.trekIn('zdg_x', 'Beheer', 'reden').status, 404);
  geenMeubilair(db, 'gatewayZendingen', 'een 404 op biedAan en trekIn');
});

/* -------------------------------------------------- fiscaal/gateway/mandaat */
test('mandaat: een mandaat opvragen dat er niet is, schept geen collectie', () => {
  const { maakMandaat } = require('../server/kern/fiscaal/gateway/mandaat');
  const db = { data: {} };
  const { mandaat } = maakMandaat({ db, save: () => {}, nu: () => '2026-10-05T09:00:00.000Z' });

  assert.equal(mandaat.trekIn('mnd_X_btw_2026-01-01', 'R. Sardjoe').status, 404);
  geenMeubilair(db, 'gatewayMandaten', 'een 404 op trekIn');
  assert.equal(mandaat.geldt('KIKUNOI', 'btw').ok, false);
  geenMeubilair(db, 'gatewayMandaten', 'een mandaatvraag die nee zegt');
  assert.equal(mandaat.vanZaak('KIKUNOI').length, 0);
  geenMeubilair(db, 'gatewayMandaten', 'vanZaak zonder mandaten');

  /* TEGENPROEF: verlenen schrijft wel, en intrekken landt daarna op de ECHTE
     rij -- zonder deze regel zou het blok ook slagen als er niets meer werkt. */
  const v = mandaat.verleen({ code: 'KIKUNOI', soort: 'btw', van: '2026-01-01', doorNaam: 'R. Sardjoe' });
  assert.ok(v.mandaat && v.mandaat.id, 'het mandaat is verleend: ' + (v.error || ''));
  assert.ok(Object.prototype.hasOwnProperty.call(db.data, 'gatewayMandaten'));
  assert.ok(mandaat.trekIn(v.mandaat.id, 'R. Sardjoe').ok);
  assert.ok(db.data.gatewayMandaten[0].ingetrokkenOp, 'de intrekking staat in db.data');
});

/* ------------------------------------------------------------------ fluister */
test('fluister: een weetje vergeten dat er niet is, schept geen profiel', () => {
  const stub = new Proxy(function () {}, { get: () => stub, apply: () => undefined });
  const db = { data: {} };
  let bewaard = 0;
  const f = require('../server/kern/fluister')({
    db, save: () => { bewaard++; }, anthropic: null, notify: () => {}, acties: {},
    schoon: (s, n) => (typeof s === 'string' ? s.trim().slice(0, n) : ''),
    reserveerTafel: stub, annuleerReservering: stub, assetGebruik: stub, zorgVoor: stub,
    pay: stub, verblijfBoek: stub, retailLegApart: stub, retailKlantProfiel: stub,
    gegevensStart: stub, gegevensZeg: stub,
  });

  assert.equal(f.fluisterVergeet('lid-1', '3').status, 404);
  geenMeubilair(db, 'fluister', 'een 404 op fluisterVergeet');
  assert.equal(bewaard, 0);

  /* En met het echte instrument, want dat is wat STAATPROEF.json meet. */
  const { vingerafdruk, verschil } = require('../server/lib/vingerafdruk');
  assert.equal(verschil(vingerafdruk({}), vingerafdruk(db.data)).aantal, 0,
    'de vingerafdruk van de opslag is niet veranderd');
});
