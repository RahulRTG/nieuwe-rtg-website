/* RTMAIL aan de lid-kant: elk nieuw lid krijgt een welkom in zijn eigen
   postvak, dat als kanaal in de verenigde Berichten-app verschijnt en te lezen
   is. End-to-end tegen een echte server.
   Draai: node --experimental-sqlite --test test/rtmail-lid.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, elevateTier } = require('./helper');

let BASE, child, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtmail-'));

async function api(pad, body, tok) {
  const headers = { 'Content-Type': 'application/json' };
  if (tok) headers['Authorization'] = 'Bearer ' + tok;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const reg = await json(await api('/api/auth/register', { name: 'Post Lid', email: 'post@x.nl', phone: '0612345611',
    password: 'geheim123', geboortedatum: '1992-05-05', tier: 'rtg', pasApp: 'rtg' }));
  token = reg.token;
  assert.ok(token, 'het lid is aangemeld');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een nieuw lid heeft direct een welkom in zijn RTMAIL-postvak', async () => {
  const d = await json(await api('/api/member/rtmail/inbox', {}, token));
  // sinds de domeinen per lidmaatschap bestaan draagt het adres welk huis je hoort
  assert.ok(d.adres && d.adres.endsWith('@rtgpass.rtg'), 'een RTG Pass-lid zit op rtgpass.rtg: ' + d.adres);
  assert.ok(Array.isArray(d.berichten) && d.berichten.length >= 1, 'er staat een bericht');
  assert.match(d.berichten[0].onderwerp, /Welkom/);
  assert.equal(d.berichten[0].van, 'rtg@rtmail');
  assert.equal(d.ongelezen, 1);
});

test('RTMAIL verschijnt als kanaal in de verenigde Berichten-app', async () => {
  const d = await json(await api('/api/member/berichten', {}, token));
  const kanaal = (d.kanalen || []).find(k => k.soort === 'rtmail');
  assert.ok(kanaal, 'er is een RTMAIL-kanaal');
  assert.equal(kanaal.link, '/apps/rtmail.html');
  assert.match(kanaal.laatste, /Welkom/);
  assert.equal(kanaal.ongelezen, 1);
});

test('een bericht lezen zet de teller op nul', async () => {
  const inbox = await json(await api('/api/member/rtmail/inbox', {}, token));
  const id = inbox.berichten[0].id;
  const r = await api('/api/member/rtmail/lees', { id }, token);
  assert.equal(r.status, 200);
  const na = await json(await api('/api/member/rtmail/inbox', {}, token));
  assert.equal(na.ongelezen, 0);
  assert.equal(na.berichten[0].gelezen, true);
});

test('Smart Action Dock maakt vanuit een bericht een agenda-item en project', async () => {
  const inbox = await json(await api('/api/member/rtmail/inbox', {}, token));
  const id = inbox.berichten[0].id;
  const ag = await api('/api/member/rtmail/workflow', { id, actie: 'agenda', datum: '2027-01-15' }, token);
  assert.equal(ag.status, 200);
  const agenda = await json(await api('/api/agenda/mijn-lijst', {}, token));
  assert.ok(agenda.items.some(x => x.datum === '2027-01-15'));
  const pr = await api('/api/member/rtmail/workflow', { id, actie: 'project' }, token);
  assert.equal(pr.status, 200);
  const na = await json(await api('/api/member/rtmail/inbox', {}, token));
  assert.ok(na.berichten[0].workflow.some(x => x.soort === 'agenda'));
  assert.ok(na.berichten[0].workflow.some(x => x.soort === 'project'));
});

test('een agenda-actie ZONDER datum valt terug op morgen', async () => {
  /* DE TAK DIE ER NIET IN ZAT. De toets hierboven geeft altijd een datum mee,
     en dan staat de klok in de andere helft van de ternary -- die werd dus
     nooit aangeraakt. Precies daar stond `klokNu`, een naam die bij het
     afsplitsen van ./rtmail-lid.js uit rtmail.js in het bereik achterbleef:
     een ReferenceError, netjes weggevangen tot een 500. Een tak die geen enkele
     toets aanraakt, is een tak waar zoiets ongezien in kan blijven staan.
     Zie TAKEN.md 6.17. */
  const inbox = await json(await api('/api/member/rtmail/inbox', {}, token));
  const id = inbox.berichten[0].id;
  const r = await api('/api/member/rtmail/workflow', { id, actie: 'agenda' }, token);
  assert.equal(r.status, 200, 'zonder datum hoort hij zelf een dag te kiezen');
  const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const agenda = await json(await api('/api/agenda/mijn-lijst', {}, token));
  assert.ok(agenda.items.some(x => x.datum === morgen),
    'de terugval is morgen; gevonden: ' + agenda.items.map(x => x.datum).join(', '));

  // en een datum die NIET op de vorm past valt op dezelfde tak terug
  const stuk = await api('/api/member/rtmail/workflow', { id, actie: 'agenda', datum: '15 januari' }, token);
  assert.equal(stuk.status, 200);
});

test('zonder inlog blijft het postvak dicht', async () => {
  const r = await fetch(BASE + '/api/member/rtmail/inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 401);
});

test('elk lid krijgt een adres op het domein van zijn pas, en oude post komt aan', async () => {
  const t = Date.now();
  // zelf-registreren geeft altijd RTG; om het domein per pas te toetsen tillen we
  // Lifestyle/Business op langs de office-akkoordflow (het enige geldige pad).
  const office = (await json(await api('/api/office/login', { code: 'RTG-OFFICE' }))).token;
  const maak = async (tier) => {
    const regTier = (tier === 'lifestyle' || tier === 'business') ? 'rtg' : tier;
    const tok = (await json(await api('/api/auth/register', { name: 'Lid ' + tier + t,
      email: 'a' + tier + t + '@v.test', phone: '06' + String(t).slice(-7) + (tier === 'rtg' ? '1' : tier === 'business' ? '2' : '3'),
      password: 'geheim123', geboortedatum: '1990-01-01', tier: regTier }))).token;
    if (tier === 'lifestyle' || tier === 'business') await elevateTier(BASE, tok, tier, office);
    return tok;
  };

  for (const [tier, domein] of [['rtg', 'rtgpass.rtg'], ['business', 'business.rtg'], ['lifestyle', 'lifestyle.rtg']]) {
    const tok = await maak(tier);
    const d = await json(await api('/api/member/rtmail/adres', {}, tok));
    assert.ok(d.adres, 'een lid heeft een adres');
    assert.equal(d.adres.split('@')[1], domein, tier + ' hoort op ' + domein);
    assert.equal(d.soort, tier);
    assert.ok(d.domeinen && d.domeinen.zaak === 'partner.rtg' && d.domeinen.overheid === 'gouvernement.rtg',
      'de hele lijst komt mee, zodat het scherm hem kan tonen');

    // het linkerdeel is de CODENAAM, nooit de echte naam of het e-mailadres
    const lokaal = d.adres.split('@')[0];
    assert.equal(/lid|@|v\.test/.test(lokaal), false, 'geen echte naam in het adres: ' + d.adres);

    // en het postvak van de inbox draagt hetzelfde adres
    const inbox = await json(await api('/api/member/rtmail/inbox', {}, tok));
    assert.equal(inbox.adres, d.adres);
    assert.ok(inbox.berichten.length >= 1, 'het welkom staat er nog gewoon in');
    // het welkom is bezorgd onder de normalisatie van VOOR deze ronde (die
    // spaties wiste); dat het toch in dit postvak ligt, is de belofte
    const adresLaag = require('../server/kern/rtmail-adres');
    assert.ok(inbox.berichten.every(m => adresLaag.zelfdeBus(m.naar, d.adres)),
      'post aan het adres van voor deze ronde komt in hetzelfde postvak aan: ' +
      inbox.berichten.map(m => m.naar).join(', ') + ' vs ' + d.adres);
  }

  const uitgelogd = await api('/api/member/rtmail/adres', {});
  assert.equal(uitgelogd.status, 401);
});
