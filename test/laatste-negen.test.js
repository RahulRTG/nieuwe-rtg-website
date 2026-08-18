/* ============================================================================
   DE LAATSTE ZES -- open verbindingen, padparameters en de kinderkant.

   foundation/gezin/:code/kanaal, foundation/les/:code/stream,
   foundation/schrift/:code, supplier/stream en de twee
   rtf/social/kind/boardroom-routes waren de laatste uit de dekkingsmeting.
   Ze bleven over omdat ze alle drie iets doen wat de rest niet doet.

   DRIE OPEN VERBINDINGEN. supplier/stream, les/:code/stream en gezin/:code/
   kanaal geven geen antwoord maar houden een verbinding OPEN. Een gewone
   fetch wacht dus tot de server iets stuurt of tot de tijd om is. Wat je van
   buitenaf wel kunt afrekenen is de DEUR: wie er niet in mag, krijgt zijn
   401 of 403 voordat er ook maar iets openstaat. Dat is hier de hele
   bewering, en dat staat er zo bij -- doen alsof een toets meer bewijst dan
   hij ziet is erger dan een korte toets.

   TWEE PADPARAMETERS. schrift/:code en kanaal/:code halen hun sleutel uit de
   URL en hun token uit de querystring, want een GET draagt geen kop.

   EN DE KINDERKANT. boardroom/zetveel en boardroom/herstel laten een ouder de
   standen van een KIND zetten of terugzetten naar de standaard. Dat is de
   enige plek in dit huis waar iemand de knoppen van een ander bedient, en de
   controle eromheen is dan ook dubbel: je moet beheerder zijn EN het moet je
   eigen kind zijn.

   Draai los: node --test test/laatste-negen.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, zaak, lid, G, kindHandle;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-laatste-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const fapi = (pad, body) => api('/api/foundation' + pad, body);

/* Een open verbinding pak je met een AbortController: we vragen hem op, lezen
   de status en de kop, en breken meteen af. Zonder dat abort blijft de fetch
   hangen tot de testrunner er een eind aan maakt. */
async function stroom(pad, ms) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms || 800);
  try {
    const r = await fetch(base + pad, { signal: ac.signal });
    const type = r.headers.get('content-type') || '';
    if (r.status === 200) ac.abort();
    return { status: r.status, type };
  } catch (e) {
    return { status: 0, type: '', afgebroken: true };
  } finally { clearTimeout(t); }
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP }, wachtPad: '/api/foundation/health' });
  base = srv.base;
  const roster = await api('/api/supplier/roster', { code: 'KIKUNOI' });
  const mgr = (roster.body.staff || []).find(x => x.role === 'manager');
  zaak = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  lid = (await api('/api/login', { tier: 'business' })).body.token;

  const g = (await fapi('/gezin/maak', { gezinsnaam: 'De Laatsten', naam: 'Ouder', pin: '2468' })).body;
  const kind = (await fapi('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Sem', rol: 'kind' })).body.profiel;
  const kt = (await fapi('/gezin/profiel/kies', { code: g.code, profielId: kind.id })).body.token;
  G = { code: g.code, token: g.token, kindId: kind.id, kt };
  assert.ok(zaak && lid && G.code, 'de zaak, het lid en het gezin staan klaar');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een open verbinding is nog steeds een deur', async () => {
  /* Wat hier te toetsen valt is de deur, niet de stroom. Een SSE-verbinding
     stuurt pas iets als er iets gebeurt; een toets die op inhoud wacht toetst
     de klok en niet de code. */
  assert.equal((await stroom('/api/supplier/stream')).status, 401, 'zonder token');
  assert.equal((await stroom('/api/supplier/stream?token=verzonnen')).status, 401, 'met een verzonnen token');
  assert.equal((await stroom('/api/supplier/stream?token=' + lid)).status, 401,
    'met het token van een LID: geldig, maar niet van een zaak');

  const open = await stroom('/api/supplier/stream?token=' + zaak);
  assert.equal(open.status, 200, 'de zaak zelf komt er wel in');
  assert.match(open.type, /text\/event-stream/, 'en krijgt een stroom, geen antwoord');
});

test('2. de leskamer en het gezinskanaal doen hetzelfde bij de deur', async () => {
  const les = (await fapi('/les/maak', { vak: 'Rekenen', naam: 'Juf Nora' })).body;
  const leerling = (await fapi('/les/join', { code: les.code, naam: 'Sem' })).body;

  assert.equal((await stroom('/api/foundation/les/ZZZZZZ/stream?role=docent&token=' + les.token)).status, 404,
    'een lescode die niet bestaat');
  assert.equal((await stroom('/api/foundation/les/' + les.code + '/stream?role=docent&token=' + leerling.token)).status, 403,
    'een leerling die zich voor docent uitgeeft');
  assert.equal((await stroom('/api/foundation/les/' + les.code + '/stream?role=leerling&token=verzonnen')).status, 403,
    'en een leerling zonder geldig token');

  const doc = await stroom('/api/foundation/les/' + les.code + '/stream?role=docent&token=' + les.token);
  assert.equal(doc.status, 200, 'de begeleider komt binnen');
  assert.match(doc.type, /text\/event-stream/);

  // het gezinskanaal: alleen met een geldig profieltoken van dat gezin
  assert.equal((await stroom('/api/foundation/gezin/' + G.code + '/kanaal?token=verzonnen')).status, 403);
  assert.equal((await stroom('/api/foundation/gezin/ZZZZ/kanaal?token=' + G.token)).status >= 400, true,
    'een gezinscode die niet bestaat');
  const kan = await stroom('/api/foundation/gezin/' + G.code + '/kanaal?token=' + G.token);
  assert.equal(kan.status, 200, 'het eigen gezin komt binnen');
  assert.match(kan.type, /text\/event-stream/);
});

test('3. het schrift is van de leerling die erin schrijft', async () => {
  const les = (await fapi('/les/maak', { vak: 'Taal', naam: 'Meester Bram' })).body;
  const een = (await fapi('/les/join', { code: les.code, naam: 'Fay' })).body;
  const twee = (await fapi('/les/join', { code: les.code, naam: 'Noor' })).body;

  const haal = (code, token) => fetch(base + '/api/foundation/schrift/' + code + '?token=' + token)
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  assert.equal((await haal('ZZZZZZ', een.token)).status, 404, 'een les die niet bestaat');
  assert.equal((await haal(les.code, 'verzonnen')).status >= 400, true, 'een token dat niet meedoet');

  const mijn = await haal(les.code, een.token);
  assert.equal(mijn.status, 200);
  assert.ok('schrift' in mijn.body, 'de leerling krijgt zijn eigen schrift');

  /* Twee leerlingen in dezelfde les hebben elk hun eigen schrift. Het pad
     draagt alleen de LESCODE, dus de scheiding hangt volledig aan het token --
     precies de plek waar je wilt weten dat het klopt. Vandaar dat er eerst
     echt iets IN het ene schrift gaat: op twee lege schriften slaagt "ze zijn
     niet hetzelfde" nooit, en dan bewijst de bewering niets. */
  const opslaan = await fapi('/schrift/opslaan',
    { code: les.code, token: een.token, pages: [{ type: 'tekst', titel: 'Som 1', inhoud: 'De som van Fay.' }] });
  assert.equal(opslaan.status, 200, 'Fay schrijft iets op: ' + JSON.stringify(opslaan.body).slice(0, 140));

  const vanFay = await haal(les.code, een.token);
  const vanNoor = await haal(les.code, twee.token);
  assert.ok((vanFay.body.schrift.pages || []).some(x => x.inhoud === 'De som van Fay.'),
    'het staat in het schrift van Fay');
  assert.ok(!(vanNoor.body.schrift.pages || []).some(x => x.inhoud === 'De som van Fay.'),
    'en niet in dat van Noor: de scheiding hangt aan het token, niet aan de lescode');
});

test('4. de knoppen van een kind bedient een ouder, en alleen van eigen kind', async () => {
  const profielen = (await fetch(base + '/api/foundation/gezin/' + G.code + '/mij?token=' + G.kt).then(r => r.json()));
  kindHandle = (profielen.profiel || profielen).handle || (profielen.profiel || profielen).codenaam;

  for (const pad of ['/api/rtf/social/kind/boardroom/zetveel', '/api/rtf/social/kind/boardroom/herstel']) {
    assert.equal((await api(pad, { code: G.code, token: 'verzonnen', kindHandle })).status, 403,
      pad + ' zonder geldig gezinstoken');
    /* HET KIND ZELF MAG HET NIET. Dit is de enige plek in dit huis waar iemand
       de knoppen van een ander bedient, en dan hoort de bediener een ouder te
       zijn -- anders zet een kind zijn eigen beperkingen uit. */
    assert.equal((await api(pad, { code: G.code, token: G.kt, kindHandle })).status, 403,
      pad + ' door het kind zelf');
    // en een handle die niet bij dit gezin hoort
    assert.equal((await api(pad, { code: G.code, token: G.token, kindHandle: 'geen-kind-van-dit-gezin' })).status, 403,
      pad + ' voor een kind van iemand anders');
  }
});
