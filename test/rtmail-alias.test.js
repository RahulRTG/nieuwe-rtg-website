/* RTMAIL: komt post aan die naar een ALIAS gaat?

   Tot 11 oktober 2026 kon een lid een alias aanzetten (de route bestond, de
   instellingen toonden hem) terwijl de bezorging er niets mee deed: post aan
   `inkoop-een@...` belandde in een postvak dat niemand las. Een instelling die
   niets doet, is een belofte zonder lezer (MAATSTAF.md par. 7f). Deze toets
   houdt vast wat er nu wel geldt:

   1. Post aan een alias komt in het postvak van de eigenaar, en draagt de alias
      als `viaAlias` zodat de ontvanger ziet langs welke deur hij binnenkwam.
   2. Twee postvakken kunnen niet dezelfde alias hebben.
   3. Een team wint altijd van een alias: een alias mag geen teamadres worden,
      en een team dat later onder die naam ontstaat, krijgt zijn eigen post.
   4. Een alias uitzetten sluit de deur: daarna komt er niets meer via binnen.
   Draai: node --test test/rtmail-alias.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child, aTok, bTok, aAdres, bAdres;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-alias-'));
const post = async (pad, body, tok) => (await fetch(BASE + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
  body: JSON.stringify(body || {}) })).json();

async function meldAan(naam, mail, tel) {
  const r = await post('/api/auth/register', { name: naam, email: mail, phone: tel,
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(r.token, 'aangemeld: ' + naam);
  return r.token;
}
async function schrijf(tok, naar, onderwerp) {
  const c = await post('/api/member/rtmail/concept/bewaar', { naar, onderwerp, tekst: 'inhoud' }, tok);
  assert.ok(c.ok, JSON.stringify(c));
  const v = await post('/api/member/rtmail/concept/verstuur', { id: c.concept.id }, tok);
  assert.ok(v.ok, JSON.stringify(v));
  return v.bericht;
}
const postvak = async (tok) => (await post('/api/member/rtmail/vak', {}, tok)).berichten || [];

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  aTok = await meldAan('Alias Een', 'alias1@x.nl', '0612345641');
  bTok = await meldAan('Alias Twee', 'alias2@x.nl', '0612345642');
  aAdres = (await post('/api/member/rtmail/adres', {}, aTok)).adres;
  bAdres = (await post('/api/member/rtmail/adres', {}, bTok)).adres;
  assert.ok(aAdres && bAdres && aAdres !== bAdres);
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('post aan een alias komt in het postvak van de eigenaar, met de alias erbij', async () => {
  const z = await post('/api/member/rtmail/alias', { naam: 'boekhouding-een' }, aTok);
  assert.ok(z.ok, JSON.stringify(z));
  const domein = aAdres.split('@')[1];
  const m = await schrijf(bTok, 'boekhouding-een@' + domein, 'Factuur via alias');
  assert.equal(m.naar, aAdres, 'de bezorging wijst naar het postvak van A');
  assert.equal(m.viaAlias, 'boekhouding-een@' + domein);
  const bij = (await postvak(aTok)).find(x => x.onderwerp === 'Factuur via alias');
  assert.ok(bij, 'A ziet het bericht in zijn postvak');
  assert.equal(bij.viaAlias, 'boekhouding-een@' + domein, 'en ziet langs welke deur het kwam');
  // B heeft het niet, en het ligt ook niet op een los adres
  assert.ok(!(await postvak(bTok)).some(x => x.onderwerp === 'Factuur via alias'));
});

test('een alias geldt binnen het huis ook op het oude domein', async () => {
  const m = await schrijf(bTok, 'boekhouding-een', 'Zonder domein');
  assert.equal(m.naar, aAdres);
});

test('twee postvakken kunnen niet dezelfde alias dragen', async () => {
  const r = await post('/api/member/rtmail/alias', { naam: 'boekhouding-een' }, bTok);
  assert.match(r.error || '', /al van iemand anders/, JSON.stringify(r));
  const eigen = await post('/api/member/rtmail/alias', { naam: aAdres.split('@')[0] }, aTok);
  assert.match(eigen.error || '', /eigen adres/, JSON.stringify(eigen));
});

test('een team wint van een alias', async () => {
  const t = await post('/api/member/rtmail/team/maak', { naam: 'Receptie Alias' }, bTok);
  assert.ok(t.ok, JSON.stringify(t));
  const lokaal = t.team.adres.split('@')[0];
  const r = await post('/api/member/rtmail/alias', { naam: lokaal }, aTok);
  assert.match(r.error || '', /team/, JSON.stringify(r));
  // post aan het team gaat naar het team, en niet naar een alias-eigenaar
  const m = await schrijf(aTok, t.team.adres, 'Aan de receptie');
  assert.ok(!m.viaAlias, 'geen alias-omleiding');
  assert.equal(m.naar, t.team.adres);
});

test('een alias uitzetten sluit de deur', async () => {
  const uit = await post('/api/member/rtmail/alias', { naam: 'boekhouding-een', aan: false }, aTok);
  assert.ok(uit.ok);
  assert.deepEqual(uit.aliassen, []);
  const m = await schrijf(bTok, 'boekhouding-een@' + aAdres.split('@')[1], 'Na het uitzetten');
  assert.ok(!m.viaAlias, 'geen alias-omleiding');
  assert.notEqual(m.naar, aAdres);
  assert.ok(!(await postvak(aTok)).some(x => x.onderwerp === 'Na het uitzetten'));
});

test('een team dat later onder de naam van een alias ontstaat, krijgt zijn eigen post', async () => {
  const z = await post('/api/member/rtmail/alias', { naam: 'kantine-later' }, aTok);
  assert.ok(z.ok, JSON.stringify(z));
  const t = await post('/api/member/rtmail/team/maak', { naam: 'Kantine', adres: 'kantine-later' }, bTok);
  assert.ok(t.ok, JSON.stringify(t));
  const m = await schrijf(bTok, t.team.adres, 'Voor de kantine');
  assert.ok(!m.viaAlias, 'de alias van A vangt de post van het team niet op');
  assert.equal(m.naar, t.team.adres);
  assert.ok(!(await postvak(aTok)).some(x => x.onderwerp === 'Voor de kantine'));
});

/* DE KAPING DIE DE TEGENLEZING VOND. De bezorging legt bussen op gelijk zonder
   punten en streepjes, dus `hu-lp` is het servicepostvak `hulp@` en `r-t-g` het
   systeemadres. Toetsen op de exacte vorm liet beide door. */
test('een alias kan het servicepostvak en het systeemadres niet kapen', async () => {
  for (const naam of ['hu-lp', 'r-t-g', 'post.master', 'no-reply']) {
    const r = await post('/api/member/rtmail/alias', { naam }, aTok);
    assert.match(r.error || '', /houdt het huis zelf/, naam + ': ' + JSON.stringify(r));
  }
  const m = await schrijf(bTok, 'hulp@rahultravelgroup.rtg', 'Aan de service');
  assert.ok(!m.viaAlias, 'de servicepost wordt niet omgeleid');
  assert.notEqual(m.naar, aAdres);
});

/* Wat bij het BEZORGEN wint, ook van een alias die er al stond: los beproefd,
   want een zaak, een codenaam of een medewerker die NA de alias ontstaat is op
   een echte server niet in een toets te maken. */
test('bij bezorging winnen het huis, een eigenaar en een bewoond adres van een oude alias', () => {
  const vakken = { goudenpanter2679: { aliassen: ['kassa', 'hu-lp', 'bewoond'], adres: 'gouden-panter-2679@rtgpass.rtg' } };
  let eigenaarsVorm = () => false;
  const bewoond = new Set();
  const rtmail = { normAdres: (a) => a, SYSTEEM: 'rtg@rtmail',
    postvak: (a) => (bewoond.has(a.split('@')[0]) ? [{ id: 'x' }] : []) };
  const inst = require('../server/kern/rtmail-inst')({ save: () => {}, rtmail, nu: () => '',
    vrij: { bezet: () => null, eigenaarsVorm: (l) => eigenaarsVorm(l) },
    busVan: (a) => String(a).split('@')[0].replace(/[.-]/g, ''), vakInst: () => null, kap: (s) => s,
    alleVakken: () => vakken, teamOpAdres: () => null });
  assert.equal(inst.aliasDoel('kassa@partner.rtg'), 'gouden-panter-2679@rtgpass.rtg', 'de gewone omleiding werkt');
  assert.equal(inst.aliasDoel('hulp@rahultravelgroup.rtg'), null, 'een oude alias "hu-lp" vangt de servicepost niet');
  eigenaarsVorm = (l) => l === 'kassa';   // er ontstaat een zaak met deze code
  assert.equal(inst.aliasDoel('kassa@partner.rtg'), null, 'een zaakcode wint van een oudere alias');
  bewoond.add('bewoond');                  // een medewerker kreeg hier al post
  assert.equal(inst.aliasDoel('bewoond@rahultravelgroup.rtg'), null, 'een bewoond adres wint van een oudere alias');
  assert.equal(inst.aliasDoel('kassa@buiten.nl'), null, 'buiten het huis bestaat geen alias');
});
