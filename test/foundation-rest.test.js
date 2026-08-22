/* ============================================================================
   DE LAATSTE FOUNDATION-ROUTES -- 5 endpoints, twee heel verschillende kanten.

   Hiermee is de foundation-groep uit de dekkingsmeting afgewerkt. Wat er nog
   lag: het digibord van een les (bord/undo), de agenda van een les (agenda en
   agenda/verwijder), het wijzigen van een gezinsprofiel (profiel/wijzig) en
   het op-gelezen-zetten van gezinsberichten (bericht/gelezen).

   WAT ER OP HET SPEL STAAT

   - HET BORD EN DE AGENDA ZIJN VAN DE BEGELEIDER. Een leerling zit in
     dezelfde les en heeft een geldig token; het verschil tussen meedoen en
     lesgeven moet in de route staan, niet in het scherm. Een leerling die het
     bord kan terugdraaien wist het werk van de klas.
   - ER MOET ALTIJD EEN BEHEERDER BLIJVEN. Zichzelf terugzetten naar 'kind' is
     de kortste weg naar een gezin waar niemand meer iets kan. Die uitweg is
     dicht, en dat is geen theorie: het is precies de fout die je een keer
     maakt en dan nooit meer kunt herstellen.
   - GELEZEN IS PERSOONLIJK. Wie zijn eigen berichten wegleest, mag daarmee
     niet de ongelezen stand van een ander opruimen.

   Draai los: node --test test/foundation-rest.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-rest-'));

function api(pad, body) {
  return fetch(BASE + '/api/foundation' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const get = pad => fetch(BASE + '/api/foundation' + pad).then(r => r.json());

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. het digibord draait terug wie de les geeft, niet wie hem volgt', async () => {
  const les = (await api('/les/maak', { vak: 'Rekenen', naam: 'Juf Nora' })).body;
  assert.ok(les.code && les.token, 'de les staat klaar');
  const leerling = (await api('/les/join', { code: les.code, naam: 'Sem' })).body;
  assert.ok(leerling.token, 'de leerling doet mee: ' + JSON.stringify(leerling).slice(0, 140));

  const streek = n => ({ code: les.code, token: les.token,
    stroke: { tool: 'pen', kleur: '#ffffff', dikte: 4, points: [[n, n], [n + 10, n + 10]] } });
  for (const n of [10, 30, 50]) assert.equal((await api('/bord/stroke', streek(n))).status, 200);
  assert.equal((await get('/bord/' + les.code)).strokes.length, 3);

  /* De leerling heeft een geldig token voor deze les. Het verschil tussen
     meedoen en lesgeven moet in de route staan: een leerling die het bord kan
     terugdraaien wist het werk van de klas, en niemand ziet wie het deed. */
  const poging = await api('/bord/undo', { code: les.code, token: leerling.token });
  assert.equal(poging.status, 403, 'een leerling draait het bord niet terug');
  assert.equal((await get('/bord/' + les.code)).strokes.length, 3, 'en er is niets weg');

  assert.equal((await api('/bord/undo', { code: les.code, token: les.token })).status, 200);
  assert.equal((await get('/bord/' + les.code)).strokes.length, 2, 'de begeleider haalt zijn laatste streek weg');

  // tot de bodem, en daarna is undo gewoon een lege handeling
  for (let i = 0; i < 5; i++) assert.equal((await api('/bord/undo', { code: les.code, token: les.token })).status, 200);
  assert.equal((await get('/bord/' + les.code)).strokes.length, 0, 'een leeg bord blijft leeg');

  assert.equal((await api('/bord/undo', { code: 'ZZZZZZ', token: les.token })).status, 404);
});

test('2. de lesagenda is ook van de begeleider', async () => {
  const les = (await api('/les/maak', { vak: 'Aardrijkskunde', naam: 'Meester Bram' })).body;
  const leerling = (await api('/les/join', { code: les.code, naam: 'Fay' })).body;

  assert.equal((await api('/agenda', { code: les.code, token: les.token, tekst: '' })).status, 400,
    'een leeg agendapunt is geen agendapunt');
  assert.equal((await api('/agenda', { code: les.code, token: leerling.token, tekst: 'Geen huiswerk' })).status, 403,
    'een leerling zet niets in de agenda van de klas');

  const mk = await api('/agenda', { code: les.code, token: les.token,
    tekst: 'Toets hoofdstuk 3', datum: '2027-09-14' });
  assert.equal(mk.status, 200);
  assert.equal(mk.body.agenda.length, 1);
  const itemId = mk.body.agenda[0].id;

  assert.equal((await api('/agenda/verwijder', { code: les.code, token: leerling.token, itemId })).status, 403,
    'en haalt er ook niets uit');
  const weg = await api('/agenda/verwijder', { code: les.code, token: les.token, itemId });
  assert.equal(weg.status, 200);
  assert.equal(weg.body.agenda.length, 0, 'de begeleider haalt het punt weg');
});

test('3. een profiel wijzigt de beheerder, en er blijft er altijd een', async () => {
  const g = (await api('/gezin/maak', { gezinsnaam: 'De Vries', naam: 'Ouder Een', pin: '2468' })).body;
  const kind = (await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Noor', rol: 'kind' })).body.profiel;
  const kt = (await api('/gezin/profiel/kies', { code: g.code, profielId: kind.id })).body.token;
  const mij = await get('/gezin/' + g.code + '/mij?token=' + g.token);
  const mijnId = (mij.profiel || mij).id;

  assert.equal((await api('/gezin/profiel/wijzig', { code: g.code, token: kt, profielId: kind.id, naam: 'Baas' })).status, 403,
    'een kind wijzigt geen profielen, ook zijn eigen niet');
  assert.equal((await api('/gezin/profiel/wijzig', { code: g.code, token: g.token, profielId: 'bestaatniet', naam: 'X' })).status, 404);

  const naam = await api('/gezin/profiel/wijzig', { code: g.code, token: g.token, profielId: kind.id, naam: 'Noortje', groep: 4 });
  assert.equal(naam.status, 200);
  assert.equal(naam.body.profiel.naam, 'Noortje');

  assert.equal((await api('/gezin/profiel/wijzig', { code: g.code, token: g.token, profielId: kind.id, pin: '12' })).status, 400,
    'een pincode van twee cijfers is geen pincode');

  /* DE UITWEG DIE DICHT MOET. Er is een beheerder; zou die zichzelf naar
     'kind' kunnen zetten, dan is er een gezin waar niemand meer een profiel
     kan aanmaken, wijzigen of verwijderen -- en dat is niet meer terug te
     draaien, want er is niemand meer die het mag. */
  const zelf = await api('/gezin/profiel/wijzig', { code: g.code, token: g.token, profielId: mijnId, rol: 'kind' });
  assert.equal(zelf.status, 400, 'de laatste beheerder degradeert zichzelf niet');
  assert.match(zelf.body.error, /minstens een beheerder/i);

  // met een tweede beheerder mag het wel: dan blijft er een over
  assert.equal((await api('/gezin/profiel/wijzig', { code: g.code, token: g.token, profielId: kind.id, rol: 'beheerder' })).status, 200);
  assert.equal((await api('/gezin/profiel/wijzig', { code: g.code, token: g.token, profielId: mijnId, rol: 'ouder' })).status, 200,
    'nu er een tweede beheerder is, kan de eerste een stap terug doen');
});

test('4. gelezen is persoonlijk', async () => {
  const g = (await api('/gezin/maak', { gezinsnaam: 'De Boer', naam: 'Ouder', pin: '1357' })).body;
  const mk = async naam => {
    const p = (await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam, rol: 'ouder' })).body.profiel;
    return { id: p.id, token: (await api('/gezin/profiel/kies', { code: g.code, profielId: p.id })).body.token };
  };
  const een = await mk('Ouder Twee');
  const twee = await mk('Ouder Drie');

  assert.equal((await api('/gezin/bericht', { code: g.code, token: g.token, naar: 'allen', tekst: 'Vanavond eten we vroeg.' })).status, 200);

  const lees = (t) => get('/gezin/' + g.code + '/berichten?token=' + t).then(d => d.berichten || []);
  const voorEen = await lees(een.token);
  assert.ok(voorEen.some(b => /vroeg/.test(b.tekst) && !b.gelezen), 'het bericht staat ongelezen bij de eerste');
  assert.ok((await lees(twee.token)).some(b => /vroeg/.test(b.tekst) && !b.gelezen), 'en ook bij de tweede');

  assert.equal((await api('/gezin/bericht/gelezen', { code: g.code, token: een.token })).status, 200);
  assert.ok((await lees(een.token)).every(b => b.gelezen), 'voor wie het wegleest staat alles op gelezen');

  /* De bewering die ertoe doet: de ander is niet meegesleept. Een gedeelde
     gelezen-stand betekent dat een huisgenoot je meldingen voor je wegklikt,
     en dan mis je iets waarvan het huis denkt dat je het gezien hebt. */
  assert.ok((await lees(twee.token)).some(b => /vroeg/.test(b.tekst) && !b.gelezen),
    'bij de ander staat het nog steeds ongelezen');

  assert.equal((await api('/gezin/bericht/gelezen', { code: g.code, token: 'geenGeldigToken' })).status, 403,
    'zonder geldig profiel valt er niets te lezen');
});
