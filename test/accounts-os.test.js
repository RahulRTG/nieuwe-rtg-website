/* De accountkluis (public/shared/accounts-os.js): meerdere accounts per toestel,
   snel wisselen (één actief) en "echt tegelijk" (per-venster account). Pure
   logica, dus we injecteren nep-opslag en draaien het gewoon in node.
   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const AccountsOS = require('../public/shared/accounts-os.js');

// Een minimale Web-Storage-nabootsing.
function store() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    _map: m
  };
}

test('kluis: onthoudt accounts, eerste is meteen actief', () => {
  const k = AccountsOS.maak({ local: store(), sessie: store() });
  k.voegToe('lid', { id: 'a', label: 'Aurelia', token: 'tok-a' });
  k.voegToe('lid', { id: 'b', label: 'Bram', token: 'tok-b' });
  assert.equal(k.lijst('lid').length, 2);
  assert.equal(k.actiefId('lid'), 'a', 'het eerste account is de actieve');
  assert.equal(k.huidigToken('lid'), 'tok-a');
});

test('kluis: dedupt op id en werkt bij (geen dubbele)', () => {
  const k = AccountsOS.maak({ local: store(), sessie: store() });
  k.voegToe('lid', { id: 'a', label: 'Oud', token: 'tok-1' });
  k.voegToe('lid', { id: 'a', label: 'Nieuw', token: 'tok-2' });
  assert.equal(k.lijst('lid').length, 1);
  assert.equal(k.vind('lid', 'a').label, 'Nieuw');
  assert.equal(k.vind('lid', 'a').token, 'tok-2');
});

test('kluis: snel wisselen zet de actieve en het token', () => {
  const k = AccountsOS.maak({ local: store(), sessie: store() });
  k.voegToe('lid', { id: 'a', label: 'A', token: 'tok-a' });
  k.voegToe('lid', { id: 'b', label: 'B', token: 'tok-b' });
  assert.equal(k.wissel('lid', 'b').id, 'b');
  assert.equal(k.actiefId('lid'), 'b');
  assert.equal(k.huidigToken('lid'), 'tok-b');
  assert.equal(k.wissel('lid', 'bestaat-niet'), null);
});

test('kluis: verwijderen laat de actieve doorschuiven', () => {
  const k = AccountsOS.maak({ local: store(), sessie: store() });
  k.voegToe('lid', { id: 'a', token: 'tok-a' });
  k.voegToe('lid', { id: 'b', token: 'tok-b' });
  assert.equal(k.verwijder('lid', 'a'), true);       // de actieve weg
  assert.equal(k.actiefId('lid'), 'b', 'de actieve schuift door naar b');
  assert.equal(k.verwijder('lid', 'b'), true);
  assert.equal(k.actiefId('lid'), null, 'niets meer over');
});

test('echt tegelijk: een venster-account wint van het actieve, gedeelde kluis', () => {
  const local = store();
  // Twee vensters delen dezelfde localStorage, maar hebben elk EIGEN
  // sessionStorage (zoals echte tabbladen).
  const vensterA = AccountsOS.maak({ local, sessie: store() });
  const vensterB = AccountsOS.maak({ local, sessie: store() });

  vensterA.voegToe('lid', { id: 'a', token: 'tok-a' });
  vensterA.voegToe('lid', { id: 'b', token: 'tok-b' });
  vensterA.wissel('lid', 'a'); // A draait op account a

  // Venster B opent bewust onder account b.
  vensterB.zetVensterAccount('lid', 'b');

  assert.equal(vensterA.huidigToken('lid'), 'tok-a', 'venster A blijft op a');
  assert.equal(vensterB.huidigToken('lid'), 'tok-b', 'venster B draait tegelijk op b');
  // De gedeelde "actieve" is nog steeds a; B overschrijft dat niet.
  assert.equal(vensterB.actiefId('lid'), 'a');
});

test('venster-URL en hash: opent onder het juiste account en past het toe', () => {
  const local = store();
  const nieuw = AccountsOS.maak({ local, sessie: store() });
  nieuw.voegToe('leverancier', { id: 'zaak1', token: 'sup-1' });
  nieuw.voegToe('leverancier', { id: 'zaak2', token: 'sup-2' });

  const url = nieuw.vensterURL('leverancier', 'zaak2');
  assert.ok(url.includes('apps/leverancier.html'));
  assert.ok(url.includes('rtgacc='));

  // Het net geopende venster (eigen sessionStorage) leest de hash.
  const geopend = AccountsOS.maak({ local, sessie: store() });
  const gekozen = geopend.leesVensterHash('#rtgacc=' + encodeURIComponent('leverancier~zaak2'));
  assert.deepEqual(gekozen, { wereld: 'leverancier', id: 'zaak2' });
  assert.equal(geopend.huidigToken('leverancier'), 'sup-2');
  // en het token staat op de plek waar de leverancier-app het leest
  assert.equal(local.getItem('rtg_sup_token'), 'sup-2');
});

test('kluis: onbekende wereld en rommel doen niets stuk', () => {
  const k = AccountsOS.maak({ local: store(), sessie: store() });
  assert.equal(k.voegToe('bestaatniet', { id: 'x', token: 't' }), null);
  assert.deepEqual(k.lijst('bestaatniet'), []);
  assert.equal(k.voegToe('lid', { id: 'x' }), null, 'zonder token geen account');
  assert.equal(k.leesVensterHash('#rtgacc=' + encodeURIComponent('__proto__~x')), null, 'geen rare wereld');
  assert.equal(k.huidigToken('lid'), null);
});

test('foundation-vorm: sessie-object wordt als JSON weggezet', () => {
  const local = store();
  const k = AccountsOS.maak({ local, sessie: store() });
  k.voegToe('foundation', { id: 'gezin1', token: 'tk', extra: { code: 'FAM1', token: 'tk', profiel: { naam: 'Sam' } } });
  assert.equal(k.pasToe('foundation'), true);
  const opgeslagen = JSON.parse(local.getItem('rtf_sessie'));
  assert.equal(opgeslagen.code, 'FAM1');
  assert.equal(opgeslagen.profiel.naam, 'Sam');
});
