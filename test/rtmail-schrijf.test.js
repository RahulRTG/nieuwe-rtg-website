/* RTMAIL, de schrijfkant: concepten, uitgesteld verzenden, handtekening,
   afwezigheid, aliassen en de regels die bij de BEZORGING draaien.

   De vier beweringen die er het meest toe doen:

   1. Een regel draait bij de bezorging en niet in de app. De toets stuurt post
      via een gewone verzend-ingang en kijkt of hij vanzelf in het archief
      belandt -- zonder dat de ontvanger iets heeft geopend.
   2. Een afwezigheidsbericht antwoordt EEN keer per afzender. De tweede mail
      levert geen tweede antwoord op; dat is de lus-rem, en die is de reden dat
      twee afwezige postvakken elkaar niet eindeloos beantwoorden.
   3. Uitgesteld verzenden wacht echt. Een concept met een tijdstip in de
      toekomst gaat niet weg; een tijdstip in het verleden wordt geweigerd in
      plaats van stil te mislukken.
   4. Een alias mag nooit het postvak van een ander opvangen.
   Draai: node --experimental-sqlite --test test/rtmail-schrijf.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child, aTok, bTok, aAdres, bAdres;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-schrijf-'));

async function api(pad, body, tok) {
  const headers = { 'Content-Type': 'application/json' };
  if (tok) headers['Authorization'] = 'Bearer ' + tok;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const post = async (pad, body, tok) => (await api(pad, body, tok)).json();

async function meldAan(naam, mail, tel) {
  const r = await post('/api/auth/register', { name: naam, email: mail, phone: tel,
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(r.token, 'aangemeld: ' + naam);
  return r.token;
}
// A schrijft aan B: via een concept, want dat is de weg die de app ook loopt
async function schrijf(tok, naar, onderwerp, tekst, plan) {
  const c = await post('/api/member/rtmail/concept/bewaar', { naar, onderwerp, tekst, plan }, tok);
  assert.ok(c.ok, 'concept bewaard: ' + JSON.stringify(c));
  if (plan) return c;
  const v = await post('/api/member/rtmail/concept/verstuur', { id: c.concept.id }, tok);
  assert.ok(v.ok, 'verstuurd: ' + JSON.stringify(v));
  return v;
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  aTok = await meldAan('Schrijf Een', 'schrijf1@x.nl', '0612345631');
  bTok = await meldAan('Schrijf Twee', 'schrijf2@x.nl', '0612345632');
  aAdres = (await post('/api/member/rtmail/adres', {}, aTok)).adres;
  bAdres = (await post('/api/member/rtmail/adres', {}, bTok)).adres;
  assert.ok(aAdres && bAdres && aAdres !== bAdres);
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een concept blijft staan tot het verstuurd wordt, en is dan weg uit de lade', async () => {
  const c = await post('/api/member/rtmail/concept/bewaar', { naar: bAdres, onderwerp: 'Eerste', tekst: 'hallo' }, aTok);
  assert.ok(c.ok);
  const lade = await post('/api/member/rtmail/concepten', {}, aTok);
  assert.equal(lade.concepten.length, 1);
  assert.equal(lade.concepten[0].onderwerp, 'Eerste');
  // bijwerken maakt geen tweede concept
  const c2 = await post('/api/member/rtmail/concept/bewaar', { id: c.concept.id, tekst: 'hallo, aangevuld' }, aTok);
  assert.equal(c2.concept.id, c.concept.id);
  assert.equal((await post('/api/member/rtmail/concepten', {}, aTok)).concepten.length, 1);

  const v = await post('/api/member/rtmail/concept/verstuur', { id: c.concept.id }, aTok);
  assert.ok(v.ok);
  assert.equal(v.bericht.onderwerp, 'Eerste');
  assert.equal((await post('/api/member/rtmail/concepten', {}, aTok)).concepten.length, 0, 'de lade is leeg');
  // en het bericht ligt bij B
  const inbox = await post('/api/member/rtmail/vak', {}, bTok);
  assert.ok(inbox.berichten.some(m => m.onderwerp === 'Eerste'), 'B heeft het');
});

test('een concept zonder ontvanger wordt niet verstuurd', async () => {
  const c = await post('/api/member/rtmail/concept/bewaar', { onderwerp: 'Zonder', tekst: 'x' }, aTok);
  const v = await post('/api/member/rtmail/concept/verstuur', { id: c.concept.id }, aTok);
  assert.match(v.error, /Aan wie/);
  await post('/api/member/rtmail/concept/weg', { id: c.concept.id }, aTok);
});

test('de handtekening gaat er automatisch onder', async () => {
  const h = await post('/api/member/rtmail/handtekening', { tekst: 'Met vriendelijke groet, Een' }, aTok);
  assert.ok(h.ok);
  const v = await schrijf(aTok, bAdres, 'Met groet', 'de inhoud');
  assert.match(v.bericht.tekst, /de inhoud/);
  assert.match(v.bericht.tekst, /Met vriendelijke groet, Een$/);
  await post('/api/member/rtmail/handtekening', { tekst: '' }, aTok);
});

test('uitgesteld verzenden wacht, en een tijdstip in het verleden wordt geweigerd', async () => {
  const straks = new Date(Date.now() + 3600e3).toISOString();
  const c = await schrijf(aTok, bAdres, 'Later', 'nog niet', straks);
  assert.equal(c.concept.plan, straks);
  // het staat nog in de lade en niet bij B
  const lade = await post('/api/member/rtmail/concepten', {}, aTok);
  assert.ok(lade.concepten.some(x => x.id === c.concept.id), 'wacht nog');
  assert.deepEqual(lade.zojuistVerstuurd, [], 'er is niets losgemaakt');
  const bij_b = await post('/api/member/rtmail/vak', {}, bTok);
  assert.ok(!bij_b.berichten.some(m => m.onderwerp === 'Later'), 'B heeft hem nog niet');

  const fout = await post('/api/member/rtmail/concept/bewaar', { id: c.concept.id, plan: '2020-01-01T00:00:00Z' }, aTok);
  assert.match(fout.error, /verleden/);
});

test('een gepland concept dat aan de beurt is, gaat de deur uit zodra iemand kijkt', async () => {
  // een tijdstip vlak in de toekomst, en dan even wachten: geen wekker nodig
  const zometeen = new Date(Date.now() + 1200).toISOString();
  const c = await schrijf(aTok, bAdres, 'Bijna', 'op tijd', zometeen);
  /* WACHTEN TOT HET CONCEPT LOS IS, en niet 1500 ms gokken. Er zijn twee dingen
     nodig: de klok moet voorbij `zometeen` zijn, EN iemand moet in de lade
     kijken -- dat kijken is precies wat het versturen doet ("geen wekker
     nodig"). Die twee dekte de anderhalve seconde met marge en geluk. Nu kijken
     we net zo lang tot het concept er niet meer staat; dat kijken IS de
     handeling. */
  let lade = null;
  {
    const eind = Date.now() + 20000;
    for (;;) {
      lade = await post('/api/member/rtmail/concepten', {}, aTok);
      if (lade.zojuistVerstuurd.includes(c.concept.id) || !lade.concepten.some(x => x.id === c.concept.id)) break;
      if (Date.now() >= eind) throw new Error('het geplande concept ging binnen 20 s niet de deur uit');
      await new Promise(r => setTimeout(r, 50));
    }
  }
  assert.ok(lade.zojuistVerstuurd.includes(c.concept.id) || !lade.concepten.some(x => x.id === c.concept.id),
    'het concept is losgemaakt');
  const bij_b = await post('/api/member/rtmail/vak', {}, bTok);
  assert.ok(bij_b.berichten.some(m => m.onderwerp === 'Bijna'), 'B heeft hem nu wel');
});

test('een regel draait bij de BEZORGING, niet in de app', async () => {
  const r = await post('/api/member/rtmail/regel/maak',
    { naam: 'nieuwsbrief weg', veld: 'onderwerp', bevat: 'nieuwsbrief', actie: 'opbergen' }, bTok);
  assert.ok(r.ok, JSON.stringify(r));
  await schrijf(aTok, bAdres, 'Nieuwsbrief augustus', 'weer een');
  // B heeft niets aangeraakt; het bericht hoort al in het archief te staan
  const inbox = await post('/api/member/rtmail/vak', {}, bTok);
  assert.ok(!inbox.berichten.some(m => m.onderwerp === 'Nieuwsbrief augustus'), 'niet in de inbox');
  const arch = await post('/api/member/rtmail/vak', { map: 'archief' }, bTok);
  assert.ok(arch.berichten.some(m => m.onderwerp === 'Nieuwsbrief augustus'), 'wel in het archief');
  const lijst = await post('/api/member/rtmail/regels', {}, bTok);
  assert.equal(lijst.regels.find(x => x.id === r.regel.id).geraakt, 1, 'de teller staat op een');
});

test('een regel die uitstaat doet niets, en een onbekende actie wordt geweigerd', async () => {
  const lijst = await post('/api/member/rtmail/regels', {}, bTok);
  const id = lijst.regels[0].id;
  await post('/api/member/rtmail/regel/zet', { id, aan: false }, bTok);
  await schrijf(aTok, bAdres, 'Nieuwsbrief september', 'en nog een');
  const inbox = await post('/api/member/rtmail/vak', {}, bTok);
  assert.ok(inbox.berichten.some(m => m.onderwerp === 'Nieuwsbrief september'), 'nu gewoon in de inbox');
  await post('/api/member/rtmail/regel/zet', { id, aan: true }, bTok);

  const raar = await post('/api/member/rtmail/regel/maak',
    { veld: 'onderwerp', bevat: 'x', actie: 'doorsturen' }, bTok);
  assert.match(raar.error, /actie bestaat niet/);
  const raar2 = await post('/api/member/rtmail/regel/maak',
    { veld: 'sterrenbeeld', bevat: 'x', actie: 'ster' }, bTok);
  assert.match(raar2.error, /Waarop moet deze regel letten/);
});

test('een afwezigheidsbericht antwoordt EEN keer per afzender', async () => {
  const a = await post('/api/member/rtmail/afwezig', { tekst: 'Ik ben tot maandag weg.' }, bTok);
  assert.ok(a.ok, JSON.stringify(a));
  await schrijf(aTok, bAdres, 'Vraag een', 'ben je er?');
  await schrijf(aTok, bAdres, 'Vraag twee', 'en nu?');
  const bijA = await post('/api/member/rtmail/vak', {}, aTok);
  const antwoorden = bijA.berichten.filter(m => /^Afwezig: /.test(m.onderwerp));
  assert.equal(antwoorden.length, 1, 'precies een afwezigheidsantwoord, ook na twee berichten');
  assert.match(antwoorden[0].tekst, /tot maandag weg/);
  // uitzetten werkt
  const uit = await post('/api/member/rtmail/afwezig', { aan: false }, bTok);
  assert.equal(uit.afwezig, null);
});

test('een afwezigheidsbericht zonder tekst wordt geweigerd', async () => {
  const r = await post('/api/member/rtmail/afwezig', { tekst: '   ' }, bTok);
  assert.match(r.error, /Wat moet er in/);
});

test('een alias kan niet het postvak van een ander kapen', async () => {
  const eigenLokaal = bAdres.split('@')[0];
  const r = await post('/api/member/rtmail/alias', { naam: eigenLokaal }, aTok);
  assert.ok(r.error, 'A mag zich geen alias geven die naar B wijst: ' + JSON.stringify(r));
  const goed = await post('/api/member/rtmail/alias', { naam: 'inkoop-een' }, aTok);
  assert.ok(goed.ok, JSON.stringify(goed));
  assert.deepEqual(goed.aliassen, ['inkoop-een']);
  const inst = await post('/api/member/rtmail/instellingen', {}, aTok);
  assert.deepEqual(inst.instellingen.aliassen, ['inkoop-een']);
});
