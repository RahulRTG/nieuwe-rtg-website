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
const path = require('path');

const WORTEL = path.join(__dirname, '..', 'server');
const { ROLLEN } = require(path.join(WORTEL, 'bedrijf/rollen-register'));

/* Een minimale opslag in dezelfde vorm als db.data. Geen mock van de module
   die getoetst wordt -- alleen de bak eronder. */
function opzet() {
  const db = { data: { werkruimtes: {}, tenants: {} } };
  const save = () => {};
  const schoon = (t, n) => String(t == null ? '' : t).slice(0, n).trim();
  const zaken = { ESVEDRA: { code: 'ESVEDRA', name: 'Es Vedra' } };
  const findSupplier = (c) => zaken[String(c).toUpperCase()] || null;
  const register = require(path.join(WORTEL, 'kern/tenant/register'))({ db, save, schoon, findSupplier });
  const brug = require(path.join(WORTEL, 'kern/tenant/brug'))({ db, save, register });
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
