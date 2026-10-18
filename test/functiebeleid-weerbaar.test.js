/* HET FUNCTIEBELEID -- een vreemde hoort niets, een gast telt mee, twijfel over het land telt niet.

   server/middleware/functiebeleid.js geeft per verzoek het oordeel van de zesde
   as (mag RTG dit: vergunning, ook per land), de beveiligingsas (isolatiepoort)
   en de schakelaars van de beheerder (pas, land, woonplaats, genre). De echte
   module draait hier met een kleine catalogus als stub, zodat elke tak raakbaar is.

   Wat hier niet mag sneuvelen:
   1. Een beller zonder geldig token hoort alleen de neutrale zin: geen functie,
      geen naam, geen vergunning en geen reden. Een bekende beller krijgt uitleg.
   2. Een gastsessie (geen accounttoken) telt mee via haar pas.
   3. Een vergunning die per land telt kijkt naar het land van het lid (ook
      afgeleid uit de nationaliteit); is dat niet te lezen, dan blijft het
      oorspronkelijke oordeel staan.
   4. De veilige noodstand van het huis sluit een mutatie met 503, voor alles uit.
   5. Een functie die standaard UIT staat, is ook op een verse installatie dicht;
      genre, land en woonplaats komen pas mee als er zulke regels zijn.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - functiebeleid.js: `if (tok && !gebruiker && sessie && sessie.tier) tier = sessie.tier;` weg -> toets 2 zakt.
   - functiebeleid.js: `if (land) oordeel = bevoegd.mag(...)` -> `if (false)` -> toets 3 zakt.
   - schakelaar-antwoord.js dicht(): `if (!bekend) return { error: ZIN.globaal };` weg -> toets 5 zakt.

   Draai los: node --test test/functiebeleid-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const maakBeleid = require('../server/middleware/functiebeleid');
const { ZIN } = require('../server/middleware/schakelaar-antwoord');

const KREDIET = { id: 'bank.krediet', naam: 'Krediet', vermogen: 'kredietverlening', doelgroepen: ['rtg', 'zaak'] };
function catalogus(o = {}) {
  return Object.assign({
    functieVoorPad: (p) => (p.startsWith('/api/bank/krediet') || p.startsWith('/api/supplier/krediet') ? KREDIET
      : (p === '/api/nieuw' ? { id: 'nieuw', standaard: false } : null)),
    doelgroepVanVerzoek: (p, u) => (p.startsWith('/api/supplier') ? 'zaak' : (u ? 'rtg' : null)),
    tierNaarDoelgroep: (t) => (t === 'rtg' ? 'rtg' : null),
    HEEFT_UIT_STANDAARD: false, HEEFT_GENRE_STANDAARD: false,
    heeftGenreRegels: () => false, heeftLandRegels: () => false, heeftPlaatsRegels: () => false,
    plaatsNorm: (p) => String(p || '').toLowerCase(),
    padGeblokkeerd: () => null
  }, o);
}
const accounts = (o = {}) => Object.assign({
  verifyToken: (t) => { if (t === 'lid') return { id: 5 }; throw new Error('geen account'); },
  getMemberState: () => ({ nationaliteit: 'Belgische' })
}, o);
const verzoek = (pad, token, methode = 'POST') => ({ path: pad, method: methode, body: {},
  get: (k) => (k === 'authorization' && token ? 'Bearer ' + token : '') });

test('1. een vreemde hoort de neutrale zin; een bekende beller krijgt uitleg', () => {
  const bevoegd = { mag: () => ({ mag: false, uitleg: 'Hiervoor is een vergunning nodig.', vermogen: 'kredietverlening', reden: 'GEEN_VERGUNNING' }),
    landTelt: () => false };
  const beleid = maakBeleid({ db: { data: {} }, accounts: accounts(), functies: catalogus(), sessionFor: () => null,
    bevoegdVan: () => bevoegd });
  const vreemd = beleid(verzoek('/api/supplier/krediet', 'onzin'));
  assert.deepEqual(vreemd, { status: 503, antwoord: { error: ZIN.globaal } }, 'geen vergunningsnaam voor een vreemde');
  const lid = beleid(verzoek('/api/bank/krediet', 'lid'));
  assert.equal(lid.antwoord.functie, 'bank.krediet');
  assert.equal(lid.antwoord.bevoegdheidReden, 'GEEN_VERGUNNING');
  assert.equal(lid.antwoord.nodig, undefined);
  assert.equal(beleid(verzoek('/api/bank/krediet')), null, 'niemand op een ledenpad: deze laag zwijgt, de deur antwoordt');
});

test('2. een gastsessie telt mee via haar pas', () => {
  const bevoegd = { mag: () => ({ mag: false, uitleg: 'nee' }), landTelt: () => false };
  const sessionFor = (t) => { if (t === 'gast') return { tier: 'rtg' }; throw new Error('onbekend'); };
  const beleid = maakBeleid({ db: { data: {} }, accounts: accounts(), functies: catalogus(), sessionFor, bevoegdVan: () => bevoegd });
  assert.equal(beleid(verzoek('/api/bank/krediet', 'gast')).antwoord.error, 'nee');
  assert.equal(beleid(verzoek('/api/bank/krediet', 'raar')), null, 'een sessie die gooit is niemand');
});

test('3. een landvergunning kijkt naar het land; onleesbaar land laat het oordeel staan', () => {
  const vragen = [];
  const bevoegd = { mag: (v, o) => { vragen.push(o || null); return o && o.land === 'BE' ? { mag: false, uitleg: 'niet in BE' } : { mag: true }; },
    landTelt: () => true };
  const met = (acc) => maakBeleid({ db: { data: {} }, accounts: acc, functies: catalogus(), sessionFor: () => null, bevoegdVan: () => bevoegd });
  assert.equal(met(accounts())(verzoek('/api/bank/krediet', 'lid')).antwoord.error, 'niet in BE');
  assert.deepEqual(vragen, [null, { land: 'BE' }]);
  for (const md of [{ nationaliteit: 'Franse' }, { nationaliteit: 'Spaans' }, { nationaliteit: 'Japanse' }, null]) {
    assert.equal(met(accounts({ getMemberState: () => md }))(verzoek('/api/bank/krediet', 'lid')), null, JSON.stringify(md));
  }
  assert.equal(met(accounts({ getMemberState: () => { throw new Error('kluis dicht'); } }))(verzoek('/api/bank/krediet', 'lid')), null);
});

test('4. de veilige noodstand sluit een mutatie voor alles uit', () => {
  const db = { data: { techniek: { incidentcontrole: { modus: 'beschermd' } } } };
  const beschermstand = { houdtTegen: () => ({ functie: 'pay', naam: 'Betalen', categorie: 'geld', waarom: 'noodstand' }) };
  const beleid = maakBeleid({ db, accounts: accounts(), functies: catalogus(), sessionFor: () => null, beschermstand });
  const uit = beleid(verzoek('/api/pay/stuur', 'lid'));
  assert.equal(uit.status, 503);
  assert.equal(uit.antwoord.reden, 'bescherming');
  assert.equal(beleid(verzoek('/api/pay/stuur', 'lid', 'GET')), null, 'lezen gaat door');
});

test('5. standaard-uit is ook vers dicht; genre, land en plaats alleen bij zulke regels', () => {
  const gezien = [];
  const f = catalogus({ HEEFT_UIT_STANDAARD: true,
    padGeblokkeerd: (p, staat, ctx) => { gezien.push(ctx); return p === '/api/nieuw' ? { id: 'nieuw', naam: 'Nieuw', reden: 'raadsel' } : null; } });
  const beleid = maakBeleid({ db: { data: {} }, accounts: accounts(), functies: f, sessionFor: () => null });
  assert.equal(beleid(verzoek('/api/oud', 'lid')), null, 'standaard aan blijft op de snelle uitgang');
  const nieuw = beleid(verzoek('/api/nieuw', 'lid'));
  assert.equal(nieuw.antwoord.error, ZIN.globaal, 'een onbekende reden valt terug op de algemene zin');
  assert.equal(nieuw.antwoord.doelgroep, 'rtg');
  assert.deepEqual(beleid(verzoek('/api/nieuw')).antwoord, { error: ZIN.globaal },
    'ook bij een schakelaar: de vreemde hoort geen functienaam');

  const staat = { iets: true };
  const regels = catalogus({ heeftGenreRegels: () => true, heeftLandRegels: () => true, heeftPlaatsRegels: () => true,
    padGeblokkeerd: (p, s, ctx) => { gezien.push(ctx); return null; } });
  const zaken = { Z1: { type: 'horeca' } };
  const sessionFor = (t) => (t === 'zaak' ? { role: 'supplier', code: 'Z1' } : (t === 'kapot' ? { role: 'supplier', code: 'X' } : null));
  const b2 = maakBeleid({ db: { data: { techniek: { functies: staat } } }, functies: regels, sessionFor,
    findSupplier: (c) => { if (c === 'X') throw new Error('weg'); return zaken[c] || null; },
    accounts: accounts({ getMemberState: () => ({ land: 'NL', plaats: 'Haarlem' }) }) });
  b2(verzoek('/api/supplier/menu', 'zaak'));
  b2(verzoek('/api/staff/rooster', 'kapot'));
  b2(verzoek('/api/member/x', 'lid'));
  assert.deepEqual(gezien.slice(-3).map(c => [c.genre, c.land, c.plaats, c.persoon]),
    [['horeca', null, null, null], [null, null, null, null], [null, 'NL', 'haarlem', 'user-5']]);
});
