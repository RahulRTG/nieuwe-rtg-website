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

/* ------------------------------------------------------------------ defensie */
test('defensie: iets opzoeken dat er niet is, schept geen zaak met zes lege vakken', () => {
  const mk = require('../server/kern/defensie');
  const db = { data: {} };
  const { defensie } = mk({ db, save: () => {}, crypto: require('node:crypto'), anthropic: null });

  assert.equal(defensie.paraatZet('XX', 'geen-id', 'beperkt', '').status, 404);
  geenMeubilair(db, 'defensie', 'een 404 op paraatZet');
  assert.equal(defensie.gewondeZet('XX', 'geen-id', 'stabiel').status, 404);
  geenMeubilair(db, 'defensie', 'een 404 op gewondeZet');

  /* DE ONVOLLEDIGE SEEDVORM. De demozaak krijgt maar vier van de zes vakken;
     een lezer die alleen de zaak controleert, maakt van deze 404 een
     TypeError op d.gewonden. */
  db.data.defensie = { G: { eenheden: [], materieel: [], bevoorrading: [], oefeningen: [] } };
  assert.equal(defensie.gewondeZet('G', 'x', 'stabiel').status, 404);
  assert.equal('gewonden' in db.data.defensie.G, false, 'en het vak blijft weg');

  /* TEGENPROEF: aanmaken schrijft nog wel, en is daarna vindbaar. */
  const e = defensie.eenheidMaak('XX', { naam: 'Alfa' });
  assert.ok(e.ok, 'de eenheid is gemaakt: ' + (e.error || ''));
  assert.equal(db.data.defensie.XX.eenheden.length, 1, 'de eenheid staat in db.data');
});

/* ---------------------------------------------------------------- gedachten */
test('gedachten: een notitie wegdoen die er niet is, schept geen lijst', () => {
  const { schoon } = require('../server/kern/util');
  const db = { data: {} };
  const k = require('../server/kern/gedachten')({ db, save: () => {}, schoon, crypto: require('node:crypto') });

  assert.equal(k.gedachteWeg('sleutel-a', 'bestaat-niet').status, 404);
  geenMeubilair(db, 'gedachten', 'een 404 op gedachteWeg');
  assert.deepEqual(k.gedachtenVan('sleutel-a').notities, []);
  geenMeubilair(db, 'gedachten', 'gedachtenVan zonder notities');

  /* TEGENPROEF: schrijven landt in db.data, een 404 van een ANDER lid laat de
     notitie staan, en de splice landt op db.data en niet op een kopie. */
  k.gedachteZet('sleutel-a', { tekst: 'iets' });
  assert.equal(db.data.gedachten.length, 1);
  const id = db.data.gedachten[0].id;
  assert.equal(k.gedachteWeg('sleutel-b', id).status, 404);
  assert.equal(db.data.gedachten.length, 1);
  k.gedachteWeg('sleutel-a', id);
  assert.equal(db.data.gedachten.length, 0, 'de splice landde op db.data');
});

/* ------------------------------------------------------------------- gemoed */
test('gemoed: een dag wissen die er niet is, schept geen dagrij', () => {
  const db = { data: {} };
  const g = require('../server/kern/gemoed')({
    db, save: () => {}, schoon: (s, n) => String(s == null ? '' : s).slice(0, n),
  });

  assert.equal(g.gemoedWeg('sleutel-a', {}).status, 404);
  geenMeubilair(db, 'gemoed', 'een 404 op gemoedWeg');
  g.gemoedVan('sleutel-b');
  geenMeubilair(db, 'gemoed', 'gemoedVan op een lid zonder rijen');

  /* TEGENPROEF: splice landt nog op de opgeslagen lijst. */
  g.gemoedZet('sleutel-a', { stemming: 'goed' });
  assert.equal(g.gemoedWeg('sleutel-a', {}).ok, true);
  assert.equal(db.data.gemoed['sleutel-a'].length, 0, 'de splice landde op db.data');
});

/* ---------------------------------------------------------------- gewoonten */
test('gewoonten: aftikken van een gewoonte die er niet is, schept geen lijst', () => {
  const db = { data: {} };
  const k = require('../server/kern/gewoonten')({
    db, save: () => {}, crypto: require('node:crypto'),
    schoon: (s, n) => String(s == null ? '' : s).trim().slice(0, n),
  });

  assert.equal(k.gewoonteTik('lid-a', { id: 'bestaat-niet' }).status, 404);
  geenMeubilair(db, 'gewoonten', 'een 404 op gewoonteTik');
  assert.equal(k.gewoonteStop('lid-a', { id: 'bestaat-niet' }).status, 404);
  geenMeubilair(db, 'gewoonten', 'een 404 op gewoonteStop');

  /* TEGENPROEF: maken schrijft nog en is daarna vindbaar. */
  assert.ok(k.gewoonteMaak('lid-a', { naam: 'Wandelen' }).ok);
  assert.equal(db.data.gewoonten.length, 1);
  assert.equal(k.gewoontenVan('lid-a').gewoonten[0].naam, 'Wandelen');
});

/* ------------------------------------------------------------- handelsketen */
test('handelsketen: een handel opzoeken die er niet is, schept geen lijst', () => {
  const { maakHandelsketen } = require('../server/kern/handelsketen');
  const db = { data: {} };
  const ks = maakHandelsketen({
    db, save: () => {}, crypto: require('node:crypto'), findSupplier: () => null,
    notifySupplier: null, sseToSupplier: null, schoon: null, facturatie: null,
  });
  const zaak = { code: 'AAA', name: 'T', type: 'wasserij' };

  assert.equal(ks.betalen(zaak, 'bestaat-niet').status, 404);
  assert.equal(ks.gunnen(zaak, 'bestaat-niet', {}).status, 404);
  assert.equal(ks.intrekken(zaak, 'bestaat-niet').status, 404);
  assert.equal(ks.leveren(zaak, 'bestaat-niet', {}).status, 404);
  geenMeubilair(db, 'handel', 'vier 404-paden in de handelsketen');
  ks.mijn(zaak);
  geenMeubilair(db, 'handel', 'het overzicht van een zaak zonder handel');

  /* TEGENPROEF: een echte aanvraag legt de collectie wel aan. */
  db.data.supplierTypes = { wasserij: { label: 'Wasserij' }, horeca: { label: 'Horeca' } };
  db.data.suppliers = [];
  const a = ks.nieuweAanvraag({ code: 'AAA', name: 'T', type: 'horeca' },
    { genre: 'wasserij', titel: 'x', regels: [{ wat: 'servet', aantal: 1 }] });
  assert.ok(a.handel && a.handel.id, 'de aanvraag is aangemaakt: ' + (a.error || ''));
  assert.equal(db.data.handel.length, 1, 'de aanvraag staat in db.data');
});

/* ------------------------------------------------------------------ homekit */
test('homekit: een scene starten die er niet is, schept geen woning', () => {
  const db = { data: {} };
  let bewaard = 0;
  const { homekit } = require('../server/kern/homekit')({
    db, save: () => { bewaard++; }, crypto: require('node:crypto'),
    schoon: (s, n) => String(s == null ? '' : s).slice(0, n), anthropic: null,
  });

  assert.equal(homekit.sceneWeg('lid-1', 'sc-1').status, 404);
  assert.equal(homekit.sceneStart('lid-1', 'sc-1').status, 404);
  assert.equal(homekit.sceneBewaar('lid-1', {}).status, 400);
  geenMeubilair(db, 'homekit', 'drie weigeringen op de scenes');
  assert.equal(bewaard, 0, 'en er is niets bewaard');

  /* TEGENPROEF, en tegelijk de aliascontrole: het overzicht MOET de woning
     aanleggen, en zet() moet in diezelfde woning landen. */
  homekit.overzicht('lid-1');
  assert.ok(db.data.homekit['lid-1'].apparaten.length > 0, 'het overzicht legt de woning aan');
  homekit.zet('lid-1', 'lamp-woon', { aan: true });
  assert.equal(db.data.homekit['lid-1'].apparaten.find(a => a.id === 'lamp-woon').stand.aan, true);
});

/* ----------------------------------------------------------------- labfonds */
test('labfonds: stemmen op een voorstel dat er niet is, schept geen fonds', () => {
  const db = { data: {} };
  const { labfonds } = require('../server/kern/labfonds')({
    db, save: () => {}, crypto: require('node:crypto'), anthropic: null,
  });

  assert.equal(labfonds.stem('lid-1', 'bestaat-niet', 'voor').status, 404);
  geenMeubilair(db, 'labFonds', 'een 404 op stem');

  /* TEGENPROEF: loc() houdt bak() -- de startset locaties MOET ontstaan zodra
     iemand het fonds echt opent, anders is er niets om op te stemmen. */
  assert.ok(labfonds.fonds('lid-1').locaties.length >= 3, 'het fondsoverzicht legt de locaties aan');
  assert.ok(db.data.labFonds.locaties.ibiza, 'en die staan in db.data');
});

/* ------------------------------------------------------------ journalistiek */
test('journalistiek: een krant lezen op een leeg adres, schept geen redactie', () => {
  const db = { data: {} };
  const j = require('../server/kern/journalistiek')({
    db, save: () => {}, crypto: require('node:crypto'),
    schoon: (s, n) => String(s || '').slice(0, n),
    findSupplier: code => ({ code, name: 'Krant ' + code }), claude: null,
  });

  /* /api/krant/* vraagt geen sessie: dit is de kant die een vreemde raakt. */
  assert.equal(j.krant('NIET').status, 404);
  geenMeubilair(db, 'redacties', 'een 404 op krant');
  assert.equal(j.leesArtikel('NIET', 'x').status, 404);
  assert.equal(j.publiceer('NIET', 'x').status, 404);
  assert.equal(j.naarConcept('NIET', 'x').status, 404);
  assert.equal(j.artikelVol('NIET', 'x'), null);
  assert.equal(j.rubriekBewaar('NIET', '').status, 400);
  assert.deepEqual(j.krantGids(), []);
  geenMeubilair(db, 'redacties', 'zeven weigerpaden in de journalistiek');

  /* TEGENPROEF: de redactie schrijft nog, en de leesteller loopt op de ECHTE
     opslag -- die zakt zodra iemand ook het schrijfpad op kijk() zet. */
  const a = j.bewaarArtikel('EEN', { titel: 'Kop', inhoud: 'tekst', rubriek: 'Stad' });
  assert.ok(a.artikel && a.artikel.id, 'het artikel is bewaard: ' + (a.error || ''));
  assert.ok(j.publiceer('EEN', a.artikel.id).ok);
  j.leesArtikel('EEN', a.artikel.id);
  j.leesArtikel('EEN', a.artikel.id);
  assert.equal(j.artikelVol('EEN', a.artikel.id).gelezen, 2, 'de teller loopt op db.data');
});

/* --------------------------------------------------------------- hulpdienst */
test('hulpdienst: zes weigerpaden laten de hulpkast onaangeroerd', () => {
  const db = { data: { suppliers: [
    { code: 'GUARDIA', name: 'Politie', type: 'politie' },
    { code: 'BOMBERS', name: 'Brandweer', type: 'brandweer' },
    { code: 'CANMISSES', name: 'Zkh', type: 'ziekenhuis' },
    { code: 'CONSULTA', name: 'HA', type: 'huisarts' },
  ] } };
  /* Exact wat initdata/deel6-diensten.js neerzet: vier van de zes vakken. */
  db.data.hulp = {
    eenheden: { GUARDIA: [{ id: 'he0', naam: 'NH11', soort: 'land', status: 'vrij' }] },
    bedden: { CANMISSES: { totaal: 24, bezet: 0 } },
  };
  const { hulpdienst } = require('../server/kern/hulpdienst')({
    db, save: () => {}, crypto: require('node:crypto'), anthropic: null,
    findSupplier: c => db.data.suppliers.find(s => s.code === c),
  });

  const voor = JSON.stringify(db.data.hulp);
  const weigeringen = [
    () => hulpdienst.eenheidZet('BOMBERS', 'x', 'vrij'),
    () => hulpdienst.meldingWijs('GUARDIA', 'x', 'he0'),
    () => hulpdienst.meldingStatus('GUARDIA', 'x', 'afgerond'),
    () => hulpdienst.bijstandVraag('GUARDIA', 'x', 'BOMBERS'),
    () => hulpdienst.opnameZet('CANMISSES', 'x', 'opgenomen'),
    () => hulpdienst.consultZet('CONSULTA', 'x', 'afgerond'),
  ];
  for (const w of weigeringen) assert.equal(w().status, 404);
  assert.equal(JSON.stringify(db.data.hulp), voor, 'zes 404-en veranderden niets aan db.data.hulp');
});

/* ------------------------------------------------------- ledenbalie-zetels */
test('ledenbalie-zetels: de baliepoort weigert zonder een lege la aan te leggen', () => {
  const db = { data: {} };
  const m = require('../server/kern/ledenbalie-zetels')({
    db, save: () => {}, accounts: { getUserById: id => (id === 1 ? { id: 1 } : null) },
    magBoardroom: () => false,
  });

  assert.equal(m.magBalie('user-9'), false);
  geenMeubilair(db, 'balieZetels', 'een geweigerde baliepoort');
  assert.deepEqual(m.balieZetels(), []);
  assert.equal(m.balieZetelWeg('user-9').ok, true);
  geenMeubilair(db, 'balieZetels', 'een zetel weghalen die er niet is');

  /* TEGENPROEF: inleggen schrijft nog en de poort ziet het. Zonder deze regel
     ziet een omzetting van lijst() zelf er groen uit terwijl de push in het
     niets verdwijnt. */
  m.balieZetelZet('user-1');
  assert.equal(db.data.balieZetels.length, 1);
  assert.equal(m.magBalie('user-1'), true);
});

/* ----------------------------------------------------------------- lesmaker */
test('lesmaker: een les openen die niet bestaat, schept geen lessenkaart', async () => {
  const { schoon } = require('../server/kern/util');
  const db = { data: {} };
  const { lesmaker } = require('../server/kern/lesmaker')({
    db, save: () => {}, crypto: require('node:crypto'), schoon,
    anthropic: null, leeftijdInstr: () => '',
  });

  assert.equal(lesmaker.leraar('ZZZZZZ', 'x').status, 403);
  geenMeubilair(db, 'lessen', 'een 403 op leraar');

  /* TEGENPROEF: een echte les komt er wel, en een antwoord landt in db.data. */
  const les = await lesmaker.maakLes({ onderwerp: 'De waterkringloop' });
  assert.ok(les.code, 'de les is gemaakt: ' + (les.error || ''));
  assert.equal(Object.keys(db.data.lessen).length, 1);
});

/* ------------------------------------------------------------ mall/aanvragen */
test('mall: een aanvraag sluiten die niet bestaat, schept geen lijst', () => {
  const db = { data: {} };
  const { mallAanvragen } = require('../server/kern/mall/aanvragen')({
    db, save: () => {}, crypto: require('node:crypto'),
    plek: { plekVan: ({ stad }) => ({ stad }), bereikVan: () => ({}), bedient: () => true },
  });

  assert.equal(mallAanvragen.sluit('k', 'bestaat-niet').status, 404);
  assert.equal(mallAanvragen.kies('k', 'x', 'Y').status, 404);
  assert.equal(mallAanvragen.plaats('k', 'Lid', { wat: 'ab' }).status, 400);
  geenMeubilair(db, 'mallAanvragen', 'drie weigeringen in de Mall');

  /* TEGENPROEF: een geldige aanvraag legt de lijst wel aan. */
  const ok = mallAanvragen.plaats('k', 'Lid', {
    wat: 'Massage aan huis', verdieping: 'beauty', plek: 'Amsterdam' });
  assert.ok(ok.ok, 'de aanvraag staat: ' + (ok.error || ''));
  assert.equal(db.data.mallAanvragen.length, 1);
});

/* ------------------------------------------------------------- mediaos/smaak */
test('mediaos/smaak: bijsturen zonder doel schept geen smaakprofiel', () => {
  const { maakSmaak } = require('../server/kern/mediaos/smaak');
  const { schoon } = require('../server/kern/util');
  const db = { data: {} };
  let saves = 0;
  const m = maakSmaak({ db, save: () => saves++, schoon });

  assert.equal(m.smaakStuur('lid-1', { richting: 'meer' }).status, 400);
  geenMeubilair(db, 'mediaSmaak', 'bijsturen zonder maker of onderwerp');
  m.smaakVan('lid-1');
  geenMeubilair(db, 'mediaSmaak', 'een smaakprofiel lezen dat er niet is');
  assert.equal(saves, 0);

  /* TEGENPROEF: een echte zet landt in db.data en is terug te lezen. */
  assert.equal(m.smaakStuur('lid-1', { richting: 'meer', maker: 'Iemand' }).ok, true);
  assert.equal(db.data.mediaSmaak['lid-1'].makers.Iemand, 1);
  assert.equal(m.smaakVan('lid-1').makers.Iemand, 1);
});

/* ---------------------------------------------------------------- ketenchat */
test('ketenchat: een geweigerd gesprek legt geen ketenkast aan', () => {
  const db = { data: { hulp: { eenheden: {}, bedden: {} },
    suppliers: [{ code: 'GUARDIA', name: 'Politie', type: 'politie' }] } };
  const { ketenchat } = require('../server/kern/ketenchat')({
    db, save: () => {}, crypto: require('node:crypto'),
    findSupplier: c => db.data.suppliers.find(s => s.code === c),
  });
  const s = db.data.suppliers[0];
  const actor = { staffId: 1, manager: true, name: 'Chef' };
  const geenKeten = wat => {
    assert.equal(db.data.hulp.keten, undefined, wat + ' legt geen ketenkast aan');
    delete db.data.hulp.keten;   // en meet niet alleen het eerste geval
  };

  assert.equal(ketenchat.gesprek(s, actor, 'keten').status, 403);
  geenKeten('een gesprek zonder partners');
  assert.equal(ketenchat.gesprek(s, actor, 'zzz').status, 404);
  geenKeten('een kanaal dat niet bestaat');
  assert.equal(ketenchat.beslis('GUARDIA', 'URGENCIA', true).status, 404);
  geenKeten('beslissen over een verzoek dat er niet is');
  assert.equal(ketenchat.groepMaak('GUARDIA', actor, { naam: 'x', leden: [] }).status, 400);
  geenKeten('een groep zonder leden');

  /* TEGENPROEF: verbinden schrijft nog, en het gesprek opent daarna. */
  db.data.suppliers.push({ code: 'BOMBERS', name: 'Brandweer', type: 'brandweer' });
  assert.ok(ketenchat.verzoek('GUARDIA', 'BOMBERS').ok);
  assert.ok(ketenchat.beslis('BOMBERS', 'GUARDIA', true).ok);
  assert.equal(db.data.hulp.keten.links[0].status, 'akkoord');
  assert.equal(ketenchat.gesprek(s, actor, 'keten').ok, true);
});

/* ----------------------------------------------- navigatie/partner-events */
test('partner-events: de gebeurtenissen lezen schept geen lijst', () => {
  const db = { data: {} };
  const p = require('../server/kern/navigatie/partner-events')({
    db, save: () => {}, crypto: require('node:crypto'), haversine: () => 1e6,
  });

  p.navPartnerEvents('X');
  p.partnerEventsRond({ lat: 38.9, lng: 1.4 });
  geenMeubilair(db, 'navPartnerEvents', 'de gebeurtenissen lezen');

  /* TEGENPROEF: melden legt hem wel aan en is daarna leesbaar. */
  assert.equal(p.navPartnerEvent({ code: 'HOTEL-X' }, { soort: 'file', lat: 38.9, lng: 1.4 }).status, 200);
  assert.equal(p.navPartnerEvents('HOTEL-X').gebeurtenissen.length, 1);
  assert.ok(Object.prototype.hasOwnProperty.call(db.data, 'navPartnerEvents'));
});

/* ---------------------------------------------------------------------- oog */
test('oog: uitgifte loggen van een stuk dat er niet is, schept geen spullen', () => {
  const { maakOog } = require('../server/kern/oog');
  const db = { data: {} };
  const oog = maakOog({
    db, save: () => {}, crypto: require('node:crypto'),
    schoon: (v, n) => String(v == null ? '' : v).slice(0, n),
    sseToSupplier: () => {}, logActivity: null,
  });
  const zaak = { code: 'Z1', fleet: [] };

  assert.equal(oog.oogUitgifteLog(zaak, { name: 'PDA' }, { itemId: 'sp-bestaatniet' }).status, 404);
  geenMeubilair(db, 'oogSpullen', 'een 404 op oogUitgifteLog');
  oog.oogSpullen(zaak);
  oog.oogNulmetingVan(zaak, 'v1');
  geenMeubilair(db, 'oogSpullen', 'de spullenlijst lezen');
  geenMeubilair(db, 'oogNulmeting', 'een nulmeting lezen die er niet is');

  /* TEGENPROEF: een stuk toevoegen legt de collectie wel aan en is vindbaar. */
  const sp = oog.oogLeer(zaak, { name: 'PDA' }, { naam: 'Zaklamp', sig: [1, 2, 3] });
  assert.ok(sp.ok, 'het stuk is aangeleerd: ' + (sp.error || ''));
  assert.equal(oog.oogSpullen(zaak).length, 1);
});

/* --------------------------------------------------------------- kletspraat */
test('kletspraat: een geweigerd gesprek schept geen kletsla', async () => {
  const maak = require('../server/kern/kletspraat');
  const basis = (vrienden) => {
    const db = { data: {} };
    const k = maak({
      db, save: () => {}, crypto: require('node:crypto'),
      sociaal: { codenaamVan: h => h, zijnVrienden: () => vrienden },
      ordersVanKlant: () => [], boekingenVanKlant: () => [],
      anthropic: null, dagContext: () => ({ zin: '' }), sseToCustomer: () => {},
    });
    return { db, k };
  };

  let { db, k } = basis(true);
  assert.equal(k.kletsAan('u1'), false);
  k.kletsLijst('u1');
  assert.equal(k.kletsHaal('u1', 'bestaat-niet').status, 404);
  assert.equal((await k.kletsStart('u1', 'u1')).status, 400);
  geenMeubilair(db, 'klets', 'vier weigerpaden in de kletspraat');

  ({ db, k } = basis(false));
  assert.equal((await k.kletsStart('u1', 'u2')).status, 403);
  geenMeubilair(db, 'klets', 'kletsen met iemand die geen vriend is');

  /* TEGENPROEF, en tegelijk de aliasvangst: met een omgezet schrijfpad landt
     de push in het niets en blijft gesprekken leeg. */
  ({ db, k } = basis(true));
  k.kletsZet('u1', true);
  k.kletsZet('u2', true);
  assert.ok(db.data.klets.aan.u1, 'de schakelaar staat in db.data');
  const g = await k.kletsStart('u1', 'u2');
  assert.ok(g.ok, 'het gesprek is gestart: ' + (g.error || ''));
  assert.equal(db.data.klets.gesprekken.length, 1, 'het gesprek staat in db.data');
});
