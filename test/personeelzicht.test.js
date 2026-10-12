/* PERSONEELSZICHT: de keukenlijn, ziekmeldingen, de online-stip en
   sollicitaties -- eigenaarsbesluiten A1, B1 en C1 (11 oktober 2026, PR #584).

   Een regel, een plek (server/kern/leverancier/personeelzicht.js, met de
   predicaten van logboekzicht.js): een manager alles wat zijn functie vraagt,
   de medewerker zelf het zijne (op staffId), een collega alleen aanwezigheid.

   Op een echte server, drie kijkers per besluit: de manager, Zora (wie het
   betreft) en Abel (een collega).

   Draai: node --test test/personeelzicht.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let H, child, TMP, tokM, zora, abel;
const api = (pad, body, token) => fetch(H + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
async function nieuw(name) {
  const n = (await api('/api/supplier/staff/add', { name }, tokM)).body;
  const tok = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: n.staff.id, pin: n.pin })).body.token;
  assert.ok(tok, 'login ' + name);
  return { id: n.staff.id, name: n.staff.name, tok };
}
const state = async (tok) => {
  const r = await api('/api/supplier/state', {}, tok);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  return r.body.state;
};
// een open stroom zolang `doe` loopt; geeft alles terug wat er binnenkwam
async function luister(tok, doe) {
  const ac = new AbortController();
  const r = await fetch(H + '/api/supplier/stream?token=' + tok, { signal: ac.signal });
  const lezer = r.body.getReader(); let tekst = '';
  const lees = (async () => { try { for (;;) { const { value, done } = await lezer.read(); if (done) break; tekst += Buffer.from(value).toString(); } } catch (e) {} })();
  await new Promise(z => setTimeout(z, 300));
  await doe();
  await new Promise(z => setTimeout(z, 1200));
  ac.abort(); await lees;
  return tekst;
}

test.before(async () => {
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-perszicht-'));
  ({ child, base: H } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '', RTG_DEMO: '1' } }));
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager');
  tokM = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  zora = await nieuw('Zora');
  abel = await nieuw('Abel');
});
test.after(() => {
  try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('A1. de keukenlijn: wie er staat ziet iedereen, op naam; het aan- en afmelden alleen de manager en de kok zelf', async () => {
  assert.equal((await api('/api/supplier/lijn', { sectie: 'warm' }, zora.tok)).status, 200);
  const r = await api('/api/supplier/lijn', { sectie: 'warm' }, abel.tok);
  assert.equal(r.status, 200);
  const namen = (l) => (l.warm || []).map(x => x.name).filter(n => n === 'Zora' || n === 'Abel');
  assert.deepEqual(namen(r.body.lijn), ['Abel', 'Zora'], 'de collega krijgt de kant op naam, niet in aanmeldvolgorde');
  assert.deepEqual(namen((await state(abel.tok)).lijn), ['Abel', 'Zora'], 'ook op /state');
  assert.deepEqual(namen((await state(tokM)).lijn), ['Zora', 'Abel'], 'de manager houdt de aanmeldvolgorde');
  const isZora = (x) => x.text === 'meldde zich aan op de kant warm' && x.who === 'Zora';
  const m = (await api('/api/supplier/activity', { aantal: 80 }, tokM)).body.activity.find(isZora);
  assert.ok(m && m.soort === 'klok-in', 'de manager ziet de aanmelding als klokregel: ' + JSON.stringify(m));
  assert.ok((await state(zora.tok)).activity.some(isZora), 'de kok zelf ziet zijn aanmelding');
  const a = await state(abel.tok);
  assert.ok(!a.activity.some(isZora) && !JSON.stringify(a).includes(m.at), 'een collega krijgt de aanmelding en het tijdstip niet');
});

test('B1. een ziekmelding: de manager DAT en sinds wanneer, de zieke zichzelf, een collega alleen "afwezig"', async () => {
  const z = await api('/api/staff/leave/request', { soort: 'ziek' }, zora.tok);
  assert.equal(z.status, 200, JSON.stringify(z.body));
  const vb = await api('/api/staff/leave/request', { soort: 'verlof', van: '2027-01-04', tot: '2027-01-08' }, zora.tok);
  assert.equal(vb.status, 200);

  const m = await state(tokM);
  const mz = m.verlof.find(v => String(v.staffId) === String(zora.id) && v.soort === 'ziek');
  assert.ok(mz && mz.van && !mz.reden, 'de manager ziet dat Zora ziek is en sinds wanneer, zonder omschrijving');
  assert.ok(m.notifications.some(n => n.title === 'Ziekmelding' && !('alleenVoor' in n)), 'de manager krijgt de melding');
  assert.ok(m.activity.some(r => r.text === 'meldde zich ziek' && r.soort === 'afwezig'));

  const zs = await state(zora.tok);
  assert.ok(zs.verlof.some(v => v.soort === 'ziek') && zs.verlof.some(v => v.van === '2027-01-04'), 'Zora ziet haar eigen meldingen');
  assert.ok(zs.notifications.some(n => n.title === 'Ziekmelding'), 'en haar eigen melding');

  const a = await state(abel.tok);
  const az = a.verlof.filter(v => String(v.staffId) === String(zora.id));
  assert.deepEqual(az, [{ staffId: zora.id, name: 'Zora', soort: 'afwezig' }], 'een collega ziet alleen dat Zora vandaag afwezig is');
  assert.ok(!a.notifications.some(n => /Ziekmelding|Verlofaanvraag/.test(n.title)), 'geen ziek- of verlofmelding voor een collega');
  assert.ok(!a.activity.some(r => /meldde zich ziek|vroeg verlof aan/.test(r.text)), 'geen logregel voor een collega');
  const t = JSON.stringify(a);
  assert.ok(!t.includes('2027-01-04') && !t.includes(mz.at), 'geen datum of tijdstip van Zora');

  // de verzuimplanning: de manager wat Zora nog kan, een collega alleen DAT ze afwezig is
  const dag = new Date().toISOString().slice(0, 10);
  const pm = await api('/api/supplier/verzuim/planning', { van: dag, tot: dag }, tokM);
  assert.ok((pm.body.afwezig.find(x => String(x.staffId) === String(zora.id)) || {}).regels, 'de manager krijgt de regels');
  const pa = await api('/api/supplier/verzuim/planning', { van: dag, tot: dag }, abel.tok);
  assert.deepEqual(pa.body.afwezig.find(x => String(x.staffId) === String(zora.id)), { afwezig: true, staffId: zora.id, naam: 'Zora' });

  // realtime: de melding gaat niet naar de stroom van een collega, en de hello telt hem niet
  const ziekOpnieuw = () => api('/api/staff/leave/request', { soort: 'ziek' }, zora.tok);
  const sa = await luister(abel.tok, ziekOpnieuw);
  assert.doesNotMatch(sa, /Ziekmelding/, 'een collega krijgt de melding niet over de stroom');
  assert.match(await luister(tokM, ziekOpnieuw), /Ziekmelding/, 'de manager wel');
  const hello = (sa.match(/event: hello\ndata: (.*)\n/) || [])[1];
  assert.ok(hello && !/Ziekmelding|Verlofaanvraag/.test(hello), 'de ongelezen meldingen bij het openen bevatten hem niet: ' + hello);
});

test('sollicitaties: alleen de manager', async () => {
  const r = await api('/api/supplier/apply', { code: 'KIKUNOI', name: 'Sanne Sollicitant', func: 'Kok', contact: 'sanne@x.nl', note: 'graag' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const m = await state(tokM);
  assert.ok(m.applications.some(x => x.name === 'Sanne Sollicitant'), 'de manager ziet de sollicitatie');
  assert.ok(m.notifications.some(n => n.title === 'Nieuwe sollicitatie'));
  for (const tok of [zora.tok, abel.tok]) {
    const s = await state(tok);
    assert.deepEqual(s.applications, [], 'een medewerker krijgt geen sollicitaties');
    assert.ok(!JSON.stringify(s).includes('Sanne Sollicitant'), 'ook niet via een melding');
  }
});

test('C1. online alleen binnen een gesprek waarin BEIDE schreven, zonder tijd en zonder bezorgteller', async () => {
  const lijst = async () => (await api('/api/staff/dm/lijst', {}, abel.tok)).body.collegas.find(c => String(c.id) === String(zora.id));
  let voor, eenzijdig, wederzijds, verstuurd;
  await luister(zora.tok, async () => {
    voor = await lijst();
    verstuurd = await api('/api/staff/dm/send', { staffId: zora.id, text: 'hoi' }, abel.tok);
    eenzijdig = await lijst();
    assert.equal((await api('/api/staff/dm/send', { staffId: abel.id, text: 'hoi terug' }, zora.tok)).status, 200);
    wederzijds = await lijst();
  });
  assert.equal(verstuurd.status, 200);
  assert.ok(!('bezorgd' in verstuurd.body), 'dm/send zegt niet op hoeveel toestellen het aankwam');
  assert.equal(voor.online, false, 'zonder gesprek geen online-stip, ook al is Zora verbonden');
  assert.equal(eenzijdig.online, false, 'een bericht van een kant dwingt de stip niet af');
  assert.equal(wederzijds.online, true, 'binnen een gesprek waarin beiden schreven wel');
  assert.deepEqual(Object.keys(wederzijds).filter(k => /at$|sinds|laatstActief|tijd/i.test(k)), [], 'geen tijdstip naast de stip');
  // de tril-oproep: geen aantal toestellen; een manager hooguit ja/nee
  const ab = await api('/api/supplier/team/buzz', { staffId: zora.id }, abel.tok);
  assert.equal(ab.status, 200);
  assert.ok(!('reached' in ab.body), 'een collega hoort niet of Zora de app open heeft');
  const mb = await api('/api/supplier/team/buzz', { all: true }, tokM);
  assert.equal(typeof mb.body.reached, 'boolean', 'de manager krijgt ja/nee en geen aantal');
});
