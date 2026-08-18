/* DE INSTELLINGSWEG: hoe een echte gemeente in een echte installatie komt.

   HET GAT DAT HIER GEDICHT IS. Acht genres staan in het register op 'intern' --
   ov, luchthaven, gemeente, rijk, politie, brandweer, ambulance, marechaussee --
   met als uitleg "hoort bij de wereld zelf en wordt niet door een partner
   aangevraagd". Dat is goed: je wilt niet dat iemand zich via het
   partnerformulier tot Gemeente Amsterdam uitroept.

   Maar er was ook geen ANDERE weg. Die instellingen kwamen uitsluitend uit de
   demo-seed, en die begint zonder RTG_DEMO leeg. Vier werelden stonden op een
   echte installatie dus permanent leeg, met een eerlijke lege stand en geen
   deur ernaast. Een wereld die alleen in de demo kan bestaan is geen wereld.

   En de tweede helft: /api/partner/apply keek alleen OF een genre bestond, niet
   naar de genrepoort. 'Intern' en 'op uitnodiging' stonden daar dus gewoon
   open, terwijl het register iets anders beweerde -- dezelfde waarheid op twee
   plekken, uit elkaar gelopen (LAT-regel 4 en 6).

   Deze toets bewaakt allebei: de deur bestaat en zit bij de boardroom, en de
   verkeerde deur zit dicht.

   Draai: npm test -- --bestanden=instellingsweg */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

const CODE = 'RTG-INST-TEST';

function post(base) {
  return (pad, body, token) => fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let teller = 0;
async function versLid(P, naam) {
  const u = String(Date.now()).slice(-7) + String(++teller).padStart(3, '0');
  const r = await P('/api/auth/register', {
    name: naam, email: naam.toLowerCase() + u + '@x.nl',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg'
  });
  assert.ok(r.body.token, naam + ' is aangemeld');
  return r.body.token;
}

const GEMEENTE = { genre: 'gemeente', naam: 'Gemeente Proefdorp', plaats: 'Proefdorp', beheerder: 'B. Ambtenaar' };

test('de boardroom sluit een echte instelling aan, en de beheerder kan naar binnen', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-inst-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  try {
    const P = post(srv.base);
    const lid = await versLid(P, 'Xander');
    const kantoor = (await P('/api/office/login', { code: CODE })).body.token;
    const eigenaar = (await P('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran' })).body.token;
    assert.ok(kantoor && eigenaar, 'kantoor en boardroom zijn bereikbaar');

    /* 1. DE LIJST KOMT UIT HET REGISTER. Niet uit een overgetypt lijstje hier of
       in de kern: wie een genre op 'intern' zet, hoort het hier vanzelf te
       zien verschijnen. */
    const genres = (await P('/api/office/instelling/genres', {}, kantoor)).body.genres || [];
    const ids = genres.map(g => g.id);
    for (const moet of ['gemeente', 'luchthaven', 'ov', 'marechaussee'])
      assert.ok(ids.includes(moet), moet + ' staat in de lijst: ' + ids.join(', '));
    assert.ok(!ids.includes('restaurant'), 'en een gewoon genre juist niet: ' + ids.join(', '));
    assert.ok(genres.every(g => g.label), 'met een label uit het register erbij');

    /* 2. AANSLUITEN IS BOARDROOMWERK. Het maakt een bedrijfscode en een
       beheer-inlog aan -- hetzelfde gewicht als een partnerbesluit, dus niet
       achter de gedeelde kantoorcode en al helemaal niet achter een lid. */
    assert.equal((await P('/api/office/instelling/aansluiten', GEMEENTE, lid)).status, 401,
      'een lid sluit geen gemeente aan');
    assert.equal((await P('/api/office/instelling/aansluiten', GEMEENTE, kantoor)).status, 403,
      'de gedeelde kantoorcode ook niet');

    // 3. en de boardroom wel
    const aan = await P('/api/office/instelling/aansluiten', GEMEENTE, eigenaar);
    assert.equal(aan.status, 200, JSON.stringify(aan.body).slice(0, 220));
    assert.ok(aan.body.code, 'er komt een bedrijfscode uit: ' + JSON.stringify(aan.body).slice(0, 160));
    assert.ok(aan.body.pin, 'en een beheer-PIN');
    assert.match(String(aan.body.vervolg || ''), /offline/i,
      'met een eerlijk vervolg: hij staat nog offline (' + aan.body.vervolg + ')');

    /* 4. HIJ STAAT ER ECHT, EN NIET ALS DEMO. Het merkteken `geseed` betekent
       "door de demo neergezet en bij een schone start op te ruimen"; zou dat
       erop staan, dan ruimde de eerstvolgende start deze gemeente op. */
    const lijst = (await P('/api/office/instellingen', {}, kantoor)).body.instellingen || [];
    const mijn = lijst.find(i => i.code === aan.body.code);
    assert.ok(mijn, 'de instelling staat op de lijst');
    assert.equal(mijn.genre, 'gemeente');
    assert.equal(mijn.plaats, 'Proefdorp');
    assert.equal(mijn.demo, false, 'en niet als demo-inhoud');
    assert.equal(mijn.online, false, 'hij begint offline, net als een nieuwe partner');
    assert.ok(mijn.door, 'met de naam van wie hem aansloot: ' + mijn.door);

    /* 5. EN DE BEHEER-INLOG WERKT ECHT. Een code en een PIN die nergens op
        uitkomen zijn een belofte die de code niet waarmaakt. */
    const roster = (await P('/api/supplier/roster', { code: aan.body.code })).body;
    const manager = (roster.staff || []).find(s => s.role === 'manager');
    assert.ok(manager, 'er staat een beheerder klaar: ' + JSON.stringify(roster).slice(0, 160));
    const login = (await P('/api/supplier/login',
      { code: aan.body.code, staffId: manager.id, pin: aan.body.pin })).body;
    assert.ok(login.token, 'en die komt met zijn PIN naar binnen');

    // 6. twee keer dezelfde instelling is een nette 409
    assert.equal((await P('/api/office/instelling/aansluiten', GEMEENTE, eigenaar)).status, 409,
      'dezelfde gemeente niet nog een keer');

    /* 7. EN ALLEEN INTERNE GENRES. Kon je hier een restaurant neerzetten, dan
       was dit een tweede deur naar de catalogus die de partnerbeoordeling
       overslaat -- precies wat de aparte deuren moeten voorkomen. */
    const fout = await P('/api/office/instelling/aansluiten',
      { genre: 'restaurant', naam: 'Zomaar Een Zaak', plaats: 'Proefdorp', beheerder: 'B. Ambtenaar' }, eigenaar);
    assert.equal(fout.status, 400, 'een gewoon genre hoort hier niet: ' + JSON.stringify(fout.body).slice(0, 160));

    // en onvolledige invoer is een nette fout, geen halve instelling
    for (const [wat, invoer] of [
      ['zonder naam', { genre: 'ov', plaats: 'Proefdorp', beheerder: 'B. Ambtenaar' }],
      ['zonder plaats', { genre: 'ov', naam: 'Proefvervoer', beheerder: 'B. Ambtenaar' }],
      ['zonder beheerder', { genre: 'ov', naam: 'Proefvervoer', plaats: 'Proefdorp' }]
    ]) assert.equal((await P('/api/office/instelling/aansluiten', invoer, eigenaar)).status, 400, wat);
  } finally { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
});

/* DE ANDERE DEUR ZIT DICHT. Het register zegt van acht genres dat een partner ze
   niet aanvraagt; /api/partner/apply hield zich daar niet aan en keek alleen of
   het genre BESTOND. Een lid kon zich dus via het gewone formulier als gemeente
   of marechaussee aanmelden. */
test('via het partnerformulier komt niemand als gemeente of marechaussee binnen', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-inst2-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  try {
    const P = post(srv.base);
    const lid = await versLid(P, 'Zita');
    const aanvraag = (type, company) => ({ company, type, city: 'Proefdorp',
      contactName: 'Z. Aanvrager', email: 'z' + Date.now() + '@x.nl', akkoord: true });

    for (const genre of ['gemeente', 'luchthaven', 'ov', 'marechaussee', 'rijk']) {
      const r = await P('/api/partner/apply', aanvraag(genre, 'Zogenaamd ' + genre), lid);
      assert.equal(r.status, 403, genre + ' hoort geweigerd te worden, kreeg ' + r.status +
        ' ' + JSON.stringify(r.body).slice(0, 140));
      assert.ok(r.body.error && r.body.error.length > 15, genre + ': met uitleg erbij (' + r.body.error + ')');
    }

    // en een gewoon genre gaat gewoon door: dit is geen dichte deur voor iedereen
    const goed = await P('/api/partner/apply', aanvraag('restaurant', 'Gewoon Een Zaak'), lid);
    assert.equal(goed.status, 200, 'een open genre blijft open: ' + JSON.stringify(goed.body).slice(0, 160));

    // een genre dat helemaal niet bestaat blijft een 400, geen 403
    assert.equal((await P('/api/partner/apply', aanvraag('ruimtevaart', 'Verzonnen BV'), lid)).status, 400,
      'een onbekend genre is een andere fout dan een gesloten genre');
  } finally { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
});
