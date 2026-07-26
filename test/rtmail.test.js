/* RTMAIL: het interne postsysteem (de rail voor de automatiseringen). Unit-test
   op de motor met een nep-db, zodat we send/postvak/ongelezen/lees los kunnen
   bewijzen zonder de server te starten.
   node --test test/rtmail.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

function maak() {
  const db = { data: {} };
  let saves = 0;
  const rtmail = require('../server/kern/rtmail')({ db, save: () => { saves++; }, crypto });
  return { rtmail, db, saves: () => saves };
}

test('adres normaliseren: kleine letters en @rtmail erachter', () => {
  const { rtmail } = maak();
  assert.equal(rtmail.normAdres('SAKURA'), 'sakura@rtmail');
  assert.equal(rtmail.normAdres(' Bloem 12 '), 'bloem12@rtmail');
  assert.equal(rtmail.normAdres('rtg@rtmail'), 'rtg@rtmail');
  assert.equal(rtmail.normAdres(''), '');
});

test('systeem stuurt, het postvak ontvangt, en de teller telt ongelezen', () => {
  const { rtmail } = maak();
  const m = rtmail.systeemStuur('sakura', 'Welkom bij RTG', 'Uw zaak staat live.');
  assert.equal(m.van, 'rtg@rtmail');
  assert.equal(m.naar, 'sakura@rtmail');
  assert.equal(m.gelezen, false);
  const vak = rtmail.postvak('sakura');
  assert.equal(vak.length, 1);
  assert.equal(vak[0].onderwerp, 'Welkom bij RTG');
  assert.equal(rtmail.ongelezen('sakura'), 1);
  // een ander postvak blijft leeg
  assert.equal(rtmail.postvak('bloem').length, 0);
});

test('lezen markeert alleen het eigen bericht, en verlaagt de teller', () => {
  const { rtmail } = maak();
  const m = rtmail.systeemStuur('sakura', 'Sollicitatie binnen', 'Een nieuwe sollicitant.');
  // een ander adres mag dit bericht niet als gelezen markeren
  assert.ok(rtmail.lees('bloem', m.id).error, 'niet jouw postvak -> fout');
  assert.equal(rtmail.ongelezen('sakura'), 1);
  const gelezen = rtmail.lees('sakura', m.id);
  assert.equal(gelezen.gelezen, true);
  assert.equal(rtmail.ongelezen('sakura'), 0);
});

test('een leeg ontvang-adres wordt geweigerd', () => {
  const { rtmail } = maak();
  assert.ok(rtmail.stuur({ van: 'rtg@rtmail', naar: '', onderwerp: 'x', tekst: 'y' }).error);
});

test('zaak naar zaak: verzonden-lijst en ontvang-lijst kloppen', () => {
  const { rtmail } = maak();
  rtmail.stuur({ van: 'sakura', naar: 'bloem', onderwerp: 'Inkoop', tekst: '10 dozen graag' });
  assert.equal(rtmail.verzonden('sakura').length, 1);
  assert.equal(rtmail.postvak('bloem').length, 1);
  assert.equal(rtmail.postvak('bloem')[0].van, 'sakura@rtmail');
});

/* ---- de veiligste-mail-laag: vertrouwen, link-scan, bijlage-nul ---- */

test('vertrouwen wordt gestempeld: systeem/lid/zaak = vertrouwd, de rest niet', () => {
  const { rtmail } = maak();
  // de systeem-afzender is altijd vertrouwd
  assert.equal(rtmail.systeemStuur('lid1', 'x', 'y').vertrouwd, true);
  assert.equal(rtmail.systeemStuur('lid1', 'x', 'y').bron, 'systeem');
  // een geverifieerde zaak of lid geeft een expliciete bron mee
  assert.equal(rtmail.stuur({ van: 'sakura', naar: 'bloem', tekst: 'hoi', bron: 'zaak' }).vertrouwd, true);
  assert.equal(rtmail.stuur({ van: 'orchidee', naar: 'lelie', tekst: 'hoi', bron: 'lid' }).vertrouwd, true);
  // standaard, of een verzonnen bron, is NIET vertrouwd -> valt terug op 'extern'
  const zonder = rtmail.stuur({ van: 'iemand', naar: 'lelie', tekst: 'klik hier' });
  assert.equal(zonder.vertrouwd, false);
  assert.equal(zonder.bron, 'extern');
  assert.equal(rtmail.stuur({ van: 'iemand', naar: 'lelie', tekst: 'x', bron: 'hacker' }).bron, 'extern');
});

test('link-scan: externe links worden herkend en geteld, gevaarlijke schema\'s gemarkeerd', () => {
  const { rtmail } = maak();
  const s = rtmail.scanLinks('kijk op https://kwaad.example/pad en www.ook.dit maar niet /apps/veilig');
  assert.equal(s.aantal, 2);
  assert.ok(s.externeLinks.some(u => u.includes('kwaad.example')));
  assert.equal(s.gevaarlijk, false);
  assert.equal(rtmail.scanLinks('javascript:alert(1)').gevaarlijk, true);
  // dubbele links tellen als een
  assert.equal(rtmail.scanLinks('https://a.example https://a.example').aantal, 1);
});

test('een bezorgd bericht draagt zijn link-analyse mee', () => {
  const { rtmail } = maak();
  const m = rtmail.stuur({ van: 'iemand', naar: 'lelie', tekst: 'phishing op http://boos.example nu' });
  assert.equal(m.links.aantal, 1);
  assert.equal(rtmail.postvak('lelie')[0].links.aantal, 1);
});

test('bijlagen bestaan niet: wat er ook binnenkomt, er wordt niets te openen bewaard', () => {
  const { rtmail } = maak();
  const m = rtmail.stuur({ van: 'iemand', naar: 'lelie', tekst: 'zie bijlage', bijlagen: [{ naam: 'virus.exe', data: 'x' }] });
  assert.deepEqual(m.bijlagen, []);
  assert.deepEqual(rtmail.postvak('lelie')[0].bijlagen, []);
});

/* ---- het adres per lidmaatschap (kern/rtmail-adres.js) ---- */

test('elk huis zijn eigen domein, en het domein wordt afgeleid -- nooit gekozen', () => {
  const a = require('../server/kern/rtmail-adres');
  assert.equal(a.adresVoor('rtg', 'Gouden Panter'), 'gouden-panter@rtgpass.rtg');
  assert.equal(a.adresVoor('lifestyle', 'Gouden Panter'), 'gouden-panter@lifestyle.rtg');
  assert.equal(a.adresVoor('business', 'Gouden Panter'), 'gouden-panter@business.rtg');
  assert.equal(a.adresVoor('rtf', 'Blauwe Vos'), 'blauwe-vos@rahultravelfoundation.rtg');
  assert.equal(a.adresVoor('personeel', 'Rahul'), 'rahul@rahultravelgroup.rtg');
  assert.equal(a.adresVoor('kantoor', 'Rahul'), 'rahul@rahultravelgroup.rtg');
  assert.equal(a.adresVoor('zaak', 'KIKUNOI'), 'kikunoi@partner.rtg');
  assert.equal(a.adresVoor('overheid', 'Overheid'), 'overheid@gouvernement.rtg');

  // een BEWEZEN rol weegt zwaarder dan een pas: je werkadres is waar je op
  // aanspreekbaar bent
  assert.equal(a.soortVoor({ tier: 'rtg', rollen: [{ rol: 'personeel' }] }), 'personeel');
  assert.equal(a.soortVoor({ tier: 'lifestyle', rollen: [{ rol: 'zaak' }] }), 'zaak');
  assert.equal(a.soortVoor({ tier: 'business', rollen: [] }), 'business');
  assert.equal(a.soortVoor({ tier: 'rtg', handle: 'rtf:123' }), 'rtf');
  assert.equal(a.soortVoor({ tier: 'onzin' }), 'rtg', 'onbekend valt terug op de RTG Pass');

  // het huis houdt zijn eigen namen: niemand wordt rtg@...
  assert.equal(a.adresVoor('personeel', 'RTG'), 'rtg-personeel@rahultravelgroup.rtg');
});

test('je oude adres blijft werken als je pas verandert', () => {
  const a = require('../server/kern/rtmail-adres');
  assert.equal(a.zelfdeBus('gouden-panter@rtgpass.rtg', 'gouden-panter@lifestyle.rtg'), true);
  assert.equal(a.zelfdeBus('gouden-panter@rtmail', 'gouden-panter@business.rtg'), true,
    'ook het domein van voor deze ronde blijft geldig; daar ligt post op');
  assert.equal(a.zelfdeBus('gouden-panter@rtgpass.rtg', 'blauwe-vos@rtgpass.rtg'), false);
  assert.equal(a.zelfdeBus('gouden-panter@elders.example', 'gouden-panter@rtgpass.rtg'), false,
    'van buiten het huis komt niemand in een postvak');
  const o = a.ontleed('KIKUNOI@partner.rtg');
  assert.equal(o.lokaal, 'kikunoi');
  assert.equal(o.soort, 'zaak');
  assert.equal(o.binnenshuis, true);
  assert.equal(a.ontleed('iemand@elders.example').binnenshuis, false);
});
