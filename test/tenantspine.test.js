/* DE TENANT SPINE EN DE IDENTITEITSBRUG -- de regels, zonder server.

   Dit huis had drie codes die alle drie "de klant" leken te betekenen. Deze
   toets legt vast wat er is afgesproken: org is de contractgrens, een
   werkruimte hoort bij hooguit een tenant, een modus die dit huis niet kan
   waarmaken wordt geweigerd MET de reden, en de brug laat niemand binnen zonder
   dat een mens een groep aan een rol heeft gekoppeld.

   Waarom zonder server: de brug hangt aan een inlog bij de identiteitsprovider
   van een klant, en die is in een toets niet na te bootsen zonder de hele
   OIDC-keten te vervalsen. De regels zitten in de module, dus daar worden ze
   ook gemeten. De routes eromheen staan in test/tenant.test.js.

   Draai los: node --test test/tenantspine.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

/* Rechtstreekse requires en geen samengesteld pad: de mutatiemotor leest de
   requires van een toets om te weten WELKE module hij op de proef stelt
   (scripts/mutatie.js, modulesVan). Een pad dat met path.join wordt opgebouwd
   ziet hij niet, en dan telt deze toets als niet-gemeten terwijl hij dat wel
   is. */
const { ROLLEN } = require('../server/bedrijf/rollen-register');
const maakRegister = require('../server/kern/tenant/register');
const maakBrug = require('../server/kern/tenant/brug');
const maakTenant = require('../server/kern/tenant');

/* De merkkern ondertekent met een sleutel die de accountlaag bij het opstarten
   zet. Deze toets start geen server, dus die sleutel wordt hier gezet -- een
   vaste, zodat de handtekening in de toets te reproduceren is. */
require('../server/accounts/state').SECRET = Buffer.alloc(32, 7);

/* Een minimale opslag in dezelfde vorm als db.data. Geen mock van de module
   die getoetst wordt -- alleen de bak eronder. */
function opzet() {
  const db = { data: { werkruimtes: {}, tenants: {} } };
  const save = () => {};
  const schoon = (t, n) => String(t == null ? '' : t).slice(0, n).trim();
  const zaken = { ESVEDRA: { code: 'ESVEDRA', name: 'Es Vedra' } };
  const findSupplier = (c) => zaken[String(c).toUpperCase()] || null;
  const register = maakRegister({ db, save, schoon, findSupplier });
  const brug = maakBrug({ db, save, register });
  const werkruimte = (code, naam) => {
    db.data.werkruimtes[code] = { code, naam, leden: {}, journaal: [] };
    return db.data.werkruimtes[code];
  };
  return { db, register, brug, werkruimte };
}

test('1. een werkruimte hoort bij hooguit EEN tenant', () => {
  const { register, werkruimte } = opzet();
  werkruimte('W1', 'Haarlem');
  register.zet({ org: 'O-A', naam: 'Groep A' });
  register.zet({ org: 'O-B', naam: 'Groep B' });

  assert.equal(register.bind('O-A', 'werkruimte', 'W1', true).ok, true, 'A krijgt de werkruimte');

  const bots = register.bind('O-B', 'werkruimte', 'W1', true);
  assert.equal(bots.status, 409, 'B krijgt hem niet');
  assert.match(bots.error, /hoort al bij de tenant O-A/);

  /* De mutatie die deze regel bewaakt: zou de botsingscontrole wegvallen, dan
     staat W1 in twee tenants en hangt het merk (straks het contract, straks de
     export) af van wie er het laatst schreef. */
  assert.deepEqual(register.haal('O-B').werkruimtes, [], 'en hij staat er ook niet half in');

  assert.equal(register.vanWerkruimte('W1').org, 'O-A', 'andersom lezen wijst naar A');
  register.bind('O-A', 'werkruimte', 'W1', false);
  assert.equal(register.vanWerkruimte('W1'), null, 'losmaken laat niets achter');
});

test('2. een werkruimte of zaak die niet bestaat, wordt niet gekoppeld', () => {
  const { register } = opzet();
  register.zet({ org: 'O-A', naam: 'Groep A' });
  assert.equal(register.bind('O-A', 'werkruimte', 'WBESTAATNIET', true).status, 404);
  assert.equal(register.bind('O-A', 'zaak', 'NERGENS', true).status, 404);
  assert.equal(register.bind('O-A', 'zaak', 'ESVEDRA', true).ok, true, 'een bestaande zaak wel');
});

test('3. "sovereign" wordt geweigerd, en zegt waarom', () => {
  const { register } = opzet();
  const uit = register.zet({ org: 'O-A', naam: 'Groep A', modus: 'sovereign' });
  assert.equal(uit.status, 400);
  assert.match(uit.error, /geen externe hosting/);
  assert.match(uit.error, /TAKEN 4\.21/);
  assert.equal(register.haal('O-A'), null, 'en de tenant is ook niet half aangemaakt');

  assert.equal(register.zet({ org: 'O-A', naam: 'Groep A' }).tenant.modus, 'powered', 'de standaard is powered');
  assert.equal(register.zet({ org: 'O-A', modus: 'private' }).tenant.modus, 'private');
  assert.equal(register.zet({ org: 'O-A', modus: 'onzin' }).status, 400);
});

test('4. zonder groepsafbeelding laat de brug NIEMAND binnen', () => {
  const { register, brug, werkruimte } = opzet();
  const w = werkruimte('W1', 'Haarlem');
  register.zet({ org: 'O-A', naam: 'Groep A' });
  register.bind('O-A', 'werkruimte', 'W1', true);

  const uit = brug.uitClaims('O-A', ['Haarlem-Managers', 'Iedereen'], 'user-7', 'Imran');
  assert.equal(uit.ok, true, 'de tenant bestaat, dus de brug draait');
  assert.deepEqual(uit.werkruimtes, [], 'maar er is niets afgebeeld, dus er gebeurt niets');
  assert.equal(Object.keys(w.leden).length, 0, 'en er staat geen lid in de werkruimte');
});

test('5. een groep wordt een tijdgebonden lidmaatschap met een rol', () => {
  const { register, brug, werkruimte } = opzet();
  const w = werkruimte('W1', 'Haarlem');
  register.zet({ org: 'O-A', naam: 'Groep A' });
  register.bind('O-A', 'werkruimte', 'W1', true);
  register.haal('O-A').groepen.push({ groep: 'Haarlem-Managers', werkruimte: 'W1', rol: 'directie' });

  const uit = brug.uitClaims('O-A', ['Haarlem-Managers'], 'user-7', 'Imran');
  assert.equal(uit.werkruimtes.length, 1);
  assert.deepEqual(uit.werkruimtes[0].rollen, ['directie']);

  const l = Object.values(w.leden)[0];
  assert.equal(l.status, 'actief');
  assert.equal(l.rtgKey, 'user-7', 'gekoppeld aan het RTG-account');
  assert.equal(l.bron, 'idp', 'en herkenbaar als beheerd door de provider');
  assert.equal(l.rollen[0].bron, 'idp', 'ook de rol draagt zijn herkomst');
  assert.ok(l.token, 'met een eigen werkruimtesleutel');
  assert.ok(w.journaal.some(r => r.wat === 'idp-lid-aangemaakt'), 'het staat in het journaal');

  // tweede keer inloggen verandert niets: dit is een synchronisatie, geen stapel
  brug.uitClaims('O-A', ['Haarlem-Managers'], 'user-7', 'Imran');
  assert.equal(Object.keys(w.leden).length, 1, 'geen tweede lid');
  assert.equal(Object.values(w.leden)[0].rollen.length, 1, 'geen tweede rol');
});

test('6. valt de groep weg, dan valt de rol weg -- en het handwerk blijft staan', () => {
  const { register, brug, werkruimte } = opzet();
  const w = werkruimte('W1', 'Haarlem');
  register.zet({ org: 'O-A', naam: 'Groep A' });
  register.bind('O-A', 'werkruimte', 'W1', true);
  register.haal('O-A').groepen.push({ groep: 'Haarlem-Managers', werkruimte: 'W1', rol: 'directie' });

  brug.uitClaims('O-A', ['Haarlem-Managers'], 'user-7', 'Imran');
  const l = Object.values(w.leden)[0];
  // een mens geeft er met de hand een rol bij
  l.rollen.push({ id: 'hr', van: null, tot: null, at: new Date().toISOString() });

  brug.uitClaims('O-A', [], 'user-7', 'Imran');
  assert.deepEqual(l.rollen.map(r => r.id), ['hr'], 'de IdP-rol is weg, de handmatige staat er nog');
  assert.equal(l.status, 'actief', 'en met een handmatige rol blijft het lidmaatschap staan');

  // nu ook het handwerk weg: dan houdt een door de IdP gemaakt lid niets over
  l.rollen = l.rollen.filter(r => r.id !== 'hr');
  brug.uitClaims('O-A', ['Haarlem-Managers'], 'user-7', 'Imran');
  brug.uitClaims('O-A', [], 'user-7', 'Imran');
  assert.equal(l.status, 'uit dienst', 'geen groep meer, geen toegang meer');
  assert.equal(l.token, null, 'en de sleutel is ingetrokken');
});

test('7. een IdP herstelt geen ontslag', () => {
  const { register, brug, werkruimte } = opzet();
  const w = werkruimte('W1', 'Haarlem');
  register.zet({ org: 'O-A', naam: 'Groep A' });
  register.bind('O-A', 'werkruimte', 'W1', true);
  register.haal('O-A').groepen.push({ groep: 'Haarlem-Managers', werkruimte: 'W1', rol: 'directie' });

  brug.uitClaims('O-A', ['Haarlem-Managers'], 'user-7', 'Imran');
  const l = Object.values(w.leden)[0];

  // een MENS zet hem uit dienst, met een eigen reden
  l.status = 'uit dienst'; l.token = null; l.uitReden = 'Ontslag op staande voet.';

  const uit = brug.uitClaims('O-A', ['Haarlem-Managers'], 'user-7', 'Imran');
  assert.equal(l.status, 'uit dienst', 'de groep brengt hem niet terug');
  assert.equal(l.token, null, 'en er komt geen nieuwe sleutel');
  assert.equal(uit.werkruimtes[0].geblokkeerd, true, 'het antwoord zegt dat er iets in de weg staat');
});

test('8. intrekken raakt ELKE werkruimte van de tenant, in hetzelfde verzoek', () => {
  const { register, brug, werkruimte } = opzet();
  const a = werkruimte('W1', 'Haarlem'); const b = werkruimte('W2', 'Utrecht');
  const c = werkruimte('W3', 'Van een andere klant');
  register.zet({ org: 'O-A', naam: 'Groep A' });
  register.zet({ org: 'O-B', naam: 'Groep B' });
  register.bind('O-A', 'werkruimte', 'W1', true);
  register.bind('O-A', 'werkruimte', 'W2', true);
  register.bind('O-B', 'werkruimte', 'W3', true);
  const t = register.haal('O-A');
  t.groepen.push({ groep: 'G', werkruimte: 'W1', rol: 'directie' });
  t.groepen.push({ groep: 'G', werkruimte: 'W2', rol: 'hr' });
  register.haal('O-B').groepen.push({ groep: 'G', werkruimte: 'W3', rol: 'directie' });

  brug.uitClaims('O-A', ['G'], 'user-7', 'Imran');
  brug.uitClaims('O-B', ['G'], 'user-7', 'Imran');
  assert.equal(Object.keys(a.leden).length, 1);
  assert.equal(Object.keys(c.leden).length, 1, 'dezelfde persoon werkt ook bij een andere klant');

  const uit = brug.deprovisioneer('O-A', 'user-7');
  assert.equal(uit.geraakt.length, 2, 'beide werkruimtes van deze tenant');
  assert.equal(Object.values(a.leden)[0].status, 'uit dienst');
  assert.equal(Object.values(b.leden)[0].token, null);

  /* DE GRENS DIE HIER ECHT TOE DOET. Een deprovisioning van de ene klant mag
     niet de werkplek bij de andere klant sluiten -- dat zou betekenen dat een
     IdP-beheerder van A iemand uit de systemen van B kan zetten. */
  assert.equal(Object.values(c.leden)[0].status, 'actief', 'de andere tenant blijft ongemoeid');
  assert.ok(Object.values(c.leden)[0].token, 'inclusief zijn sleutel daar');
});

test('9. alleen een rol die bestaat, en het journaal noemt geen namen', () => {
  const { register, brug, werkruimte } = opzet();
  const w = werkruimte('W1', 'Haarlem');
  register.zet({ org: 'O-A', naam: 'Groep A' });
  register.bind('O-A', 'werkruimte', 'W1', true);
  register.haal('O-A').groepen.push({ groep: 'G', werkruimte: 'W1', rol: 'bestaat-niet' });

  brug.uitClaims('O-A', ['G'], 'user-7', 'Imran');
  assert.equal(Object.keys(w.leden).length, 0, 'een onbekende rol levert geen lidmaatschap op');

  register.haal('O-A').groepen[0].rol = ROLLEN[0].id;
  brug.uitClaims('O-A', ['G'], 'user-7', 'Imran');
  assert.equal(Object.keys(w.leden).length, 1);
  for (const r of w.journaal) {
    assert.equal(r.wie, 'identiteitsprovider', 'het journaal noemt de bron en niet de mens');
    assert.ok(!/Imran/.test(JSON.stringify(r)), 'en nergens de naam uit het token');
  }
});

/* ---------- het merk: de handtekening en wat er als KEUZE geldt ---------- */
function merkOpzet() {
  const db = { data: { werkruimtes: {}, tenants: {} } };
  const schoon = (t, n) => String(t == null ? '' : t).slice(0, n).trim();
  const tenant = maakTenant({ db, save: () => {}, schoon, findSupplier: () => null, bedrijf: () => null });
  tenant.register.zet({ org: 'O-M', naam: 'Imran Group' });
  return { db, tenant };
}

test('10. een merk dat buitenom is gewijzigd, komt er niet uit', () => {
  const { db, tenant } = merkOpzet();
  tenant.merkZet('O-M', { naam: 'Imran Group One', accent: '#1B7F5A' });
  assert.equal(tenant.merkVan('O-M').merk.naam, 'Imran Group One');

  /* Rechtstreeks in de opslag, want dat IS het geval waarvoor de handtekening
     bestaat: een backup die wordt teruggezet, een migratie, een fout in een
     ander proces. Een merk uit de opslag vertrouwen zou betekenen dat de naam
     van de ene klant boven de wereld van de andere kan komen. */
  db.data.tenants['O-M'].merk.merk.naam = 'Andere Klant BV';

  const na = tenant.merkVan('O-M');
  assert.equal(na.merk.naam, 'Imran Group', 'de standaard valt terug op de tenantnaam');
  assert.notEqual(na.merk.naam, 'Andere Klant BV', 'en zeker niet op wat er in de opslag was gezet');
  assert.match(na.let, /klopte niet met zijn eigen handtekening/, 'met de reden erbij');
  assert.match(na.herkomst, /Rahul Travel Group/, 'de herkomstregel staat er ook dan');
});

test('11. alleen wat de klant zette geldt als keuze', () => {
  const { db, tenant } = merkOpzet();
  tenant.merkZet('O-M', { naam: 'Imran Group One' });

  /* De standaardkleur mag GEEN gekozen kleur worden. Bouwt de volgende
     bewaring voort op het manifest in plaats van op de ruwe velden, dan staat
     hier ineens een accent dat niemand heeft gekozen -- en dan volgt deze
     tenant een wijziging van de RTG-standaard nooit meer. */
  assert.deepEqual(Object.keys(db.data.tenants['O-M'].merkVelden), ['naam']);
  assert.equal(tenant.merkVan('O-M').merk.accent, '#7F1634', 'naar buiten toe wel volledig ingevuld');

  tenant.merkZet('O-M', { payoff: 'Werk zoals het hoort' });
  assert.deepEqual(Object.keys(db.data.tenants['O-M'].merkVelden).sort(), ['naam', 'payoff'],
    'een tweede bewaring vult aan en gooit de eerste niet weg');
  assert.equal(tenant.merkVan('O-M').merk.naam, 'Imran Group One');
});

/* ---------- de vernietiging zelf ----------
   Over de lijn is deze tak niet te halen: de bewaartermijn is minimaal dertig
   dagen en een toets kan de klok niet vooruitzetten. Hier wordt de termijn in
   de opslag teruggezet -- dat is precies wat de tijd ook zou doen, en het is de
   enige tak van deze laag die gegevens ONOMKEERBAAR weghaalt. Ongetoetst laten
   omdat hij lastig te bereiken is, is bij die tak de verkeerde keuze. */
function loopOpzet() {
  const db = { data: { werkruimtes: {}, tenants: {} } };
  const schoon = (t, n) => String(t == null ? '' : t).slice(0, n).trim();
  const tenant = maakTenant({ db, save: () => {}, schoon, findSupplier: () => null, bedrijf: () => null });
  db.data.werkruimtes.W1 = { code: 'W1', naam: 'Klant', at: new Date().toISOString(),
    beheerToken: 'geheim', journaal: [],
    leden: { a: { id: 'a', naam: 'Pia', status: 'actief', token: 'sleutel-a', rollen: [] } },
    projecten: { p1: { id: 'p1', naam: 'Uitrol' } } };
  tenant.register.zet({ org: 'O-W', naam: 'Klant' });
  tenant.register.bind('O-W', 'werkruimte', 'W1', true);
  return { db, tenant };
}
const verstrijk = (db) => { db.data.tenants['O-W'].levensloop.bewaarTot = new Date(Date.now() - 1000).toISOString(); };

test('12. na de termijn wordt er vernietigd, met een bewijs zonder persoonsgegevens', () => {
  const { db, tenant } = loopOpzet();
  const L = tenant.levensloop;
  L.zet('O-W', { naar: 'opzegging', reden: 'Klant stopt.' });
  L.zet('O-W', { naar: 'bewaring', reden: 'Uitloop.' });
  verstrijk(db);

  assert.equal(L.vernietig('O-W', {}).status, 400, 'er tekent altijd iemand');

  const uit = L.vernietig('O-W', { door: 'R. Imran' });
  assert.equal(uit.ok, true);
  assert.equal(db.data.werkruimtes.W1, undefined, 'de werkruimte is weg');
  assert.deepEqual(db.data.tenants['O-W'].werkruimtes, [], 'en de binding ook');
  assert.equal(L.stand('O-W').stand, 'vernietigd');

  const b = uit.bewijs;
  assert.equal(b.door, 'R. Imran');
  assert.equal(b.werkruimtes.length, 1);
  assert.ok(b.werkruimtes[0].catalogus.find(c => c.soort === 'projecten').aantal === 1,
    'het bewijs telt wat er weg is');
  assert.match(b.checksum, /^[0-9a-f]{64}$/);

  /* HET BEWIJS MAG NIET ZIJN WAT HET BEWIJST. Een vernietigingsbewijs met de
     naam van een medewerker erin is een kopie van precies dat wat vernietigd
     moest worden -- en die blijft dan voor altijd staan. */
  const tekst = JSON.stringify(b);
  assert.ok(!tekst.includes('Pia'), 'geen namen in het bewijs');
  assert.ok(!tekst.includes('sleutel-a'), 'en geen sleutels');
  assert.ok(!tekst.includes('Uitrol'), 'en geen inhoud');
});

test('13. na de vernietiging valt er niets meer op te halen, en niets meer te doen', () => {
  const { db, tenant } = loopOpzet();
  const L = tenant.levensloop;
  L.zet('O-W', { naar: 'opzegging', reden: 'Stopt.' });
  L.zet('O-W', { naar: 'bewaring', reden: 'Uitloop.' });
  verstrijk(db);
  L.vernietig('O-W', { door: 'R. Imran' });

  assert.equal(tenant.uitgang.exporteer('W1').status, 404, 'er is niets meer te exporteren');
  assert.equal(L.vernietig('O-W', { door: 'R. Imran' }).status, 409, 'en niets meer te vernietigen');
  assert.equal(L.zet('O-W', { naar: 'actief', reden: 'Toch terug.' }).status, 409,
    'vernietigd is een eindstand -- daar komt niemand uit terug');
  assert.ok(db.data.tenants['O-W'].levensloop.bewijs, 'alleen het bewijs blijft staan');
});

test('14. een bewaringsplicht wint van een verstreken termijn', () => {
  const { db, tenant } = loopOpzet();
  const L = tenant.levensloop;
  L.zet('O-W', { naar: 'opzegging', reden: 'Stopt.' });
  L.zet('O-W', { naar: 'bewaring', reden: 'Uitloop.' });
  verstrijk(db);
  L.houdVast('O-W', true, 'Lopend geschil.', 'R. Imran');

  const poging = L.vernietig('O-W', { door: 'R. Imran' });
  assert.equal(poging.status, 409);
  assert.match(poging.error, /bewaringsplicht/);
  assert.ok(db.data.werkruimtes.W1, 'en er is niets weggehaald');

  L.houdVast('O-W', false, null, 'R. Imran');
  assert.equal(L.vernietig('O-W', { door: 'R. Imran' }).ok, true, 'opgeheven: dan kan het wel');
});
