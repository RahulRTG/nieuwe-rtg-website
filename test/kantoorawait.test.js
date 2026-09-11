/* HET KANTOOR BEVESTIGT GEEN VERWIJDERING DIE DE OPSLAG NIET HEEFT.

   TWEE FOUTEN IN EEN KETEN, en ze hielden elkaar overeind.

   1. DE VERWIJDERING. De verse faalproefronde (FAALPROEF.json, commit 61c400cc)
      gaf tien routes als `gezakt`: 2xx terwijl de toestand niet veranderde.
      Zeven van die tien VERWIJDEREN iets, en alle zeven deden hetzelfde --
      `filter(); save(); return { ok: true }`. Die save() is write-behind, dus
      `{ ok: true }` was een bevestiging die de opslag nog niet had gedaan: na een
      herstart stond het weggegooide ontwerp weer in de lijst. Sinds
      kern/kantoorwissen.js gaat die mutatie door een duurzame commit.

   2. DE WIKKEL. Om duurzaam te kunnen zijn moet de verwijdering async worden, en
      daar stond een val: `veilig` in routes/kantoren/index.js deed
      `stuur(res, werk())` ZONDER await. Een PROMISE gaat dan naar res.json() en
      serialiseert naar `{}` -- met een keurige 200. Precies de vals-succesvorm
      waar test/notitiesduurzaam.test.js voor waarschuwt, op de wikkel van 257
      kantoorroutes.

      Gemeten voordat ik hem aanraakte: NUL van die 257 routes gaf een async
      functie mee, dus het was een VAL en geen defect. Maar de reparatie van (1)
      maakt hem er wel een, en daarom horen ze in een commit en in een toets
      samen.

   Draai los: node --test test/kantoorawait.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const mappen = [];
const verseMap = () => { const m = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kaw-')); mappen.push(m); return m; };

const post = (basis, pad, body, token) => fetch(basis + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function kantoor(basis, code) {
  const o = await post(basis, 'office/login', { code });
  assert.ok(o.body.token, 'het kantoor logt in');
  return o.body.token;
}

let eerlijk, leugen, tokEerlijk, tokLeugen;
test.before(async () => {
  /* GEEN verwachtServerfout hier, en dat is een verschil dat ertoe doet.
     kern/kantoorwissen.js GEEFT het foutantwoord van lib/duurzaam.js TERUG (503
     met een reden) in plaats van te gooien, dus er ontstaat geen onafgevangen
     serveruitzondering -- alleen een console.warn. De bank doet het anders: daar
     gooit bijeen() door metIdem heen, en test/bankduurzaam.test.js verwacht die
     worp dan ook expliciet. Ik heb hier eerst wel een verwachting gezet, en de
     strenge poort liet de ronde daarop zakken: een verwachting die nooit
     uitkomt, is zelf een gezakte bewering. Dat is de poort die zijn werk doet. */
  eerlijk = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: verseMap(), OFFICE_CODE: 'KANTOOR-KAW-1' } });
  leugen = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: verseMap(), OFFICE_CODE: 'KANTOOR-KAW-2',
    RTG_VERRAAD: 'schrijf-verloren' } });
  tokEerlijk = await kantoor(eerlijk.base, 'KANTOOR-KAW-1');
  tokLeugen = await kantoor(leugen.base, 'KANTOOR-KAW-2');
});
test.after(() => {
  stop(eerlijk && eerlijk.child); stop(leugen && leugen.child);
  for (const m of mappen) { try { fs.rmSync(m, { recursive: true, force: true }); } catch (e) {} }
});

test('1. zonder verraad maakt en verwijdert het bureau gewoon een idee', async () => {
  const maak = await post(eerlijk.base, 'office/ideeen/maak', { titel: 'Jazz en zeilen', tekst: 'Arrangement voor mei.' }, tokEerlijk);
  assert.equal(maak.status, 200, JSON.stringify(maak.body).slice(0, 140));
  const id = maak.body.idee && maak.body.idee.id;
  assert.ok(id, 'het idee krijgt een id');

  const weg = await post(eerlijk.base, 'office/ideeen/verwijder', { id }, tokEerlijk);
  assert.equal(weg.status, 200);
  /* DIT IS DE await-CONTROLE, en hij is geen formaliteit: zonder await in
     `veilig` komt hier een geserialiseerde Promise uit -- status 200, lijf `{}`.
     Een toets die alleen naar de status kijkt, ziet dat verschil niet. */
  assert.equal(weg.body.ok, true, 'een 200 zonder ok is een niet-afgewachte belofte');

  const na = await post(eerlijk.base, 'office/ideeen', {}, tokEerlijk);
  assert.ok(!(na.body.lijst || []).some(o => o.id === id), 'het idee is weg uit de lijst');
});

test('2. onder een liegende opslag wordt de verwijdering NIET bevestigd', async () => {
  const maak = await post(leugen.base, 'office/ideeen/maak', { titel: 'Wegwerpidee', tekst: 'Alleen om weg te gooien.' }, tokLeugen);
  const id = maak.body.idee && maak.body.idee.id;
  assert.ok(id, 'het idee bestaat in het geheugen: ' + JSON.stringify(maak.body).slice(0, 140));

  const weg = await post(leugen.base, 'office/ideeen/verwijder', { id }, tokLeugen);
  assert.ok(weg.status < 200 || weg.status >= 300,
    'een verwijdering die de opslag niet bevestigt mag geen 2xx krijgen (kreeg ' + weg.status + ')');
  assert.notEqual(weg.body.ok, true, 'en zeker geen ok:true: ' + JSON.stringify(weg.body).slice(0, 140));
});

test('3. de wikkel geeft een async antwoord ECHT door en niet als {}', async () => {
  /* Deze toets gaat niet over verwijderen maar over `veilig` zelf. Een route
     waarvan de kern nu async is, moet zijn eigen lijf teruggeven. Zonder de
     await-reparatie is dit `{}` met een 200 -- en dat is de val die de
     verwijdering hierboven onzichtbaar zou hebben gemaakt. */
  const maak = await post(eerlijk.base, 'office/ideeen/maak', { titel: 'Tweede', tekst: 'Voor de wikkel.' }, tokEerlijk);
  const id = maak.body.idee.id;
  const weg = await post(eerlijk.base, 'office/ideeen/verwijder', { id }, tokEerlijk);
  assert.notDeepEqual(weg.body, {}, 'een leeg lijf met 200 betekent dat de wikkel de Promise heeft doorgestuurd');
  assert.equal(typeof weg.body.ok, 'boolean', 'het echte antwoord draagt ok');
});
