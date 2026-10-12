/* HET VANGNET VAN DE LEIDINGSPLEK IN POSTGRESQL-MODUS (kern/rtmail-leiding.js)
   -- zevende tegenlezing van PR #584.

   schoonLeiding() VERHUIST beperkte post uit het gedeelde postvak, en dat is een
   mutatie -- ook op een LEESpad. In PostgreSQL-modus weigert de requestcommit een
   gewijzigde collectie zonder save() terecht (PG_SAVE_ONTBREEKT, een 500): de
   draad-lezer riep het vangnet aan zonder saver, en postbrug en mailpost ook.
   Dezelfde klasse als test/leespad-schrijft-niet.test.js, maar andersom: dit
   leespad MOET schrijven, dus het moet ook opslaan.

   Daarom is de saver VERPLICHT (zonder gooit schoonLeiding, ook als er niets te
   verhuizen is), en draait hier de echte middleware van db/postgres-verzoeken
   met een nagemaakte motor. Plus de bronscan per leesplek.

   Draai: node --test test/rtmail-leiding-pg.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs'); const path = require('path');
const { schoonLeiding, isBeperkt } = require('../server/kern/rtmail-leiding');

const stray = (id) => ({ id, van: 'rtg@rtmail', naar: 'kik@rtmail', soort: 'personeel', onderwerp: 'Nieuwe sollicitatie',
  tekst: 'x', at: new Date().toISOString(), gelezen: false, bron: 'systeem', draad: id });

test('schoonLeiding zonder saver gooit, ook als er niets te verhuizen is', () => {
  assert.throws(() => schoonLeiding({ berichten: [] }), /bewaar/);
  assert.throws(() => schoonLeiding({ berichten: [stray('a')] }, null), /bewaar/);
  let n = 0;
  const data = { berichten: [stray('b')] };
  assert.equal(schoonLeiding(data, () => { n++; }), 1);
  assert.equal(n, 1, 'een verhuizing slaat op');
  assert.equal(data.leiding[0].id, 'b');
});

test('PostgreSQL-modus: een leespad dat beperkte post verhuist, commit in plaats van een 500', async () => {
  const W = path.join(__dirname, '..', 'server');
  const r = (p) => require(path.join(W, p));
  const web = r('web'), state = r('db/state'), context = r('db/verzoekcontext'), maakGrens = r('db/postgres-verzoeken');
  state.setRuweData({ rtmail: { berichten: [{ id: 'g1', van: 'a@rtmail', naar: 'kik@rtmail', soort: 'bericht',
    onderwerp: 'hoi', tekst: 'x', at: new Date().toISOString(), draad: 'g1' }], leiding: [] } });
  const db = state.db;
  const save = () => { context.noteerSave(); }; save.sleutels = () => context.noteerSave();
  const rtmail = r('kern/rtmail')({ db, save, crypto });
  const vak = r('kern/rtmail-vak')({ db, save, rtmail });
  const draad = r('kern/rtmail-draad')({ db, save, rtmail, vak });
  let commits = 0;
  const motor = { async commitVerzoek(data, w) { commits++; for (const x of w) data[x.sleutel] = JSON.parse(x.waardeJson); return {}; },
    pool: { query: async () => ({ rows: [] }) }, laadAlles: async () => state.getRuweData(), openstaandeWijzigingen: () => [] };
  const grens = maakGrens({ store: 'postgres', db, state, motor: () => motor, slot: fn => fn(), basisKlaar: () => true });
  grens.gestart();
  const app = web(); app.use(grens.middleware()); app.use(web.json());
  app.post('/draad', (req, res) => res.json(draad.draad('kik', 'g1')));
  app.post('/lijst', (req, res) => res.json(draad.lijst('kik', {})));
  app.post('/vak', (req, res) => res.json(vak.lijst('kik')));
  const srv = await new Promise(ja => { const s = app.listen(0, '127.0.0.1', () => ja(s)); });
  try {
    for (const [i, p] of ['/draad', '/lijst', '/vak'].entries()) {
      // een oude instantie (rolling deploy) zet beperkte post in het gedeelde postvak
      state.getRuweData().rtmail.berichten.unshift(stray('s' + i));
      const voor = commits;
      const resp = await fetch('http://127.0.0.1:' + srv.address().port + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      const tekst = await resp.text();
      assert.equal(resp.status, 200, p + ': ' + tekst);
      assert.ok(!tekst.includes('Nieuwe sollicitatie'), p + ' levert de beperkte post');
      assert.ok(commits > voor, p + ': de verhuizing is niet gecommit');
      const raw = state.getRuweData().rtmail;
      assert.ok(raw.leiding.some(m => m.id === 's' + i) && !raw.berichten.some(isBeperkt), p + ': niet verhuisd');
    }
  } finally { grens.stop(); srv.close(); }
});

test('bron: elke leesplek van het gedeelde postvak staat achter het vangnet, met een saver', () => {
  /* Per BESTAND (iets dat rtmail en berichten noemt moet het vangnet aanroepen)
     en per REGEL (een regel die rtmail...berichten leest heeft het vangnet vlak
     ervoor of erna). Een aanroep zonder saver is in PostgreSQL-modus een 500. */
  const W = path.join(__dirname, '..', 'server');
  const VRIJ = { [path.join('kern', 'rtmail.js')]: 'de opslag zelf (store roept migreer aan)',
    [path.join('kern', 'rtmail-leiding.js')]: 'het vangnet zelf' };
  // geeft de lijst door aan kern/rtgone-projecten.js, die filtert met isBeperkt (toets hieronder)
  const REGELVRIJ = /rtmailBerichten: \(\) =>/;
  const fout = [];
  const loop = (map) => {
    for (const n of fs.readdirSync(map)) {
      const f = path.join(map, n);
      if (fs.statSync(f).isDirectory()) { loop(f); continue; }
      if (!n.endsWith('.js')) continue;
      const rel = path.relative(W, f);
      if (VRIJ[rel]) continue;
      const t = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, '');
      if (/schoonLeiding\(\s*[^,()]*\)/.test(t)) fout.push(rel + ': schoonLeiding zonder saver');
      if (!/\.rtmail\b/.test(t) || !/\.berichten\b/.test(t)) continue;
      if (!/schoonLeiding\(|isBeperkt\(/.test(t)) { fout.push(rel + ': geen vangnet'); continue; }
      const regels = t.split('\n');
      regels.forEach((r, i) => {
        if (!/rtmail\b[^;\n]*\.berichten/.test(r) || REGELVRIJ.test(r)) return;
        const buurt = regels.slice(Math.max(0, i - 2), i + 2).join('\n');
        if (!/schoonLeiding\(|isBeperkt\(/.test(buurt)) fout.push(rel + ':' + (i + 1) + ': leest zonder vangnet');
      });
    }
  };
  loop(W);
  assert.deepEqual(fout, [], 'leesplekken zonder het vangnet van kern/rtmail-leiding.js');
});

test('RTG One: het overzicht van vandaag en een project van een mail laten beperkte post weg', () => {
  const ctx = { key: 'k1', codename: 'amber', label: 'Amber' };
  const db = { data: { rtmail: { berichten: [Object.assign(stray('w1'), { naar: 'amber@rtmail' }),
    { id: 'g1', van: 'x@rtmail', naar: 'amber@rtmail', soort: 'bericht', onderwerp: 'hoi', tekst: 'x', at: new Date().toISOString() }] } } };
  const { rtgone } = require('../server/kern/rtgone')({ db, save: () => {}, crypto });
  const mail = rtgone.state('rtg', ctx).vandaag.items.filter(m => m.soort === 'rtmail').map(m => m.id);
  assert.ok(mail.includes('g1'), 'gewone post staat in het overzicht');
  assert.ok(!mail.includes('w1'), 'beperkte post staat in het overzicht van vandaag');
  assert.equal(rtgone.projectVanMail({ mailId: 'w1' }, ctx).status, 404, 'van beperkte post kan een project worden');
  assert.ok(rtgone.projectVanMail({ mailId: 'g1' }, ctx).project, 'van gewone post wel');
});
