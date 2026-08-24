/* RTG Kassa: dezelfde bon twee keer versturen mag niet twee keer omzet zijn.

   WAAROM DEZE TOETS ER IS. Er stond een offline-wachtrij op de rol voor de
   kassa: bonnen die tijdens een netwerkstoring lokaal blijven staan en later
   opnieuw worden verstuurd. Voor je iets in een wachtrij zet moet je weten of
   het endpoint een herhaling herkent -- anders verdubbelt een herhaling de
   omzet.

   Dat deed het niet. `pos/sale` gaf `idem` alleen door aan RTG Pay, en alleen
   bij method 'rtgpay'. Contant, pin en tafel kenden helemaal geen herhaling:
   twee keer versturen gaf twee bonnen, twee keer voorraadafboeking en twee
   facturen. De kassa stuurde de sleutel dus wel mee en niemand keek ernaar.

   Wat hier bewezen wordt:

   1. TWEE KEER DEZELFDE SLEUTEL IS EEN BON. Ook contant, want juist daar is
      geen betaaldienst die het opmerkt.
   2. HET ANTWOORD IS HETZELFDE. De herhaling geeft dezelfde bon terug, met
      hetzelfde bonnummer -- niet een tweede bon en niet een fout.
   3. ZONDER SLEUTEL BLIJFT ALLES BIJ HET OUDE. Twee losse verkopen van
      hetzelfde bedrag zijn gewoon twee verkopen; dit is geen ontdubbeling
      op bedrag.
   4. DEZELFDE SLEUTEL VOOR EEN ANDER BEDRAG IS EEN CONFLICT en geen stille
      "gelukt" -- dezelfde binding als bij RTG Pay (lib/idem.js).

   Draai: node --experimental-sqlite --test test/kassa-herhaling.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, tok;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kassaherh-'));
const api = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const S = (pad, body) => api(pad, body, tok);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  tok = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  assert.ok(tok, 'de zaak-inlog werkt');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const dag = () => S('/api/supplier/kassa/dagrapport', {}).then(r => r.body);

test('1. dezelfde idem-sleutel levert een bon, niet twee', async () => {
  const voor = await dag();
  const bon = { total: 12.5, method: 'contant', items: [{ name: 'Koffie', qty: 1, price: 12.5 }], idem: 'wachtrij-1' };
  const a = await S('/api/supplier/pos/sale', bon);
  const b = await S('/api/supplier/pos/sale', bon);
  assert.equal(a.body.ok, true, 'de eerste verkoop lukt');
  assert.equal(b.body.ok, true, 'de herhaling geeft geen fout');
  const na = await dag();
  assert.equal(na.bonnen - voor.bonnen, 1, 'er staat een bon bij, niet twee');
  assert.equal(Math.round((na.omzet - voor.omzet) * 100), 1250, 'de omzet groeide met een keer 12,50');
});

test('2. de herhaling geeft dezelfde bon terug', async () => {
  const bon = { total: 8, method: 'contant', items: [{ name: 'Thee', qty: 1, price: 8 }], idem: 'wachtrij-2' };
  const a = await S('/api/supplier/pos/sale', bon);
  const b = await S('/api/supplier/pos/sale', bon);
  assert.equal(b.body.sale.id, a.body.sale.id, 'zelfde bon-id');
  assert.equal(b.body.sale.bon, a.body.sale.bon, 'zelfde bonnummer');
  assert.equal(b.body.herhaald, true, 'en het antwoord zegt dat het een herhaling was');
});

test('3. zonder sleutel blijven twee gelijke verkopen twee verkopen', async () => {
  const voor = await dag();
  const bon = { total: 4.25, method: 'contant', items: [{ name: 'Water', qty: 1, price: 4.25 }] };
  await S('/api/supplier/pos/sale', bon);
  await S('/api/supplier/pos/sale', bon);
  const na = await dag();
  assert.equal(na.bonnen - voor.bonnen, 2, 'geen ontdubbeling op bedrag');
});

test('4. dezelfde sleutel voor een ander bedrag is een conflict', async () => {
  await S('/api/supplier/pos/sale', { total: 20, method: 'contant', idem: 'wachtrij-4' });
  const voor = await dag();
  const r = await S('/api/supplier/pos/sale', { total: 60, method: 'contant', idem: 'wachtrij-4' });
  assert.equal(r.status, 409, 'geen stille "gelukt" voor een ander verzoek');
  const na = await dag();
  assert.equal(na.bonnen - voor.bonnen, 0, 'en er komt geen bon bij');
});

test('5. een andere omschrijving is niet een ander verzoek', async () => {
  /* Vrije tekst hoort niet in de afdruk (lib/idem.js zegt dat met zoveel
     woorden). De kassa zet er de modus, de badgenaam en de kassanaam in; dat
     mag verschillen tussen twee pogingen zonder dat het een conflict wordt. */
  const bon = { total: 6, method: 'contant', items: [{ name: 'Bier', qty: 1, price: 6 }], idem: 'wachtrij-5' };
  const a = await S('/api/supplier/pos/sale', Object.assign({}, bon, { desc: 'De Kassa (bar)' }));
  const b = await S('/api/supplier/pos/sale', Object.assign({}, bon, { desc: 'De Kassa (bar) - opnieuw verstuurd' }));
  assert.equal(b.status, 200, 'geen conflict op vrije tekst');
  assert.equal(b.body.sale.id, a.body.sale.id, 'en het is nog steeds dezelfde bon');
});

test('6. dezelfde sleutel met een andere bon is ook een conflict', async () => {
  /* Het totaal alleen is te grof. Twee bonnen van 10 euro met verschillende
     regels zijn twee verschillende verzoeken -- de voorraadafboeking en de
     factuurregels hangen aan die regels, niet aan het bedrag. */
  await S('/api/supplier/pos/sale', { total: 10, method: 'contant', items: [{ name: 'Koffie', qty: 1, price: 10 }], idem: 'wachtrij-6' });
  const voor = await dag();
  const r = await S('/api/supplier/pos/sale', { total: 10, method: 'contant', items: [{ name: 'Thee', qty: 1, price: 10 }], idem: 'wachtrij-6' });
  assert.equal(r.status, 409, 'een andere bon onder dezelfde sleutel is geen herhaling');
  const na = await dag();
  assert.equal(na.bonnen - voor.bonnen, 0, 'en er komt geen bon bij');
});

test('7. een bon uit de wachtrij draagt zijn eigen moment maar verzet de omzet niet', async () => {
  /* De kassa vertelt WANNEER hij de bon opstelde; de server houdt vast aan het
     moment van AANKOMST. Zou `at` uit de client komen, dan kan een kassa kiezen
     op welke dag zijn omzet valt -- de knop waarmee je een dagrapport verschuift. */
  const gisteren = new Date(Date.now() - 26 * 3600 * 1000).toISOString();
  const r = await S('/api/supplier/pos/sale', { total: 9, method: 'contant', idem: 'wachtrij-7', offlineVanaf: gisteren });
  assert.equal(r.body.sale.offlineVanaf, gisteren, 'het moment van de kassa staat op de bon');
  assert.equal(r.body.sale.at.slice(0, 10), new Date().toISOString().slice(0, 10),
    'maar de bon telt op de dag dat hij aankwam');
  const na = await dag();
  assert.ok(na.omzet > 0, 'en hij staat gewoon in het dagrapport van vandaag');
});

test('8. het antwoord dat onderweg verloren ging komt terug, niet een tweede bon', async () => {
  /* Het gevaarlijkste geval, en de reden dat de wachtrij bestaat: het verzoek
     KWAM aan en werd verwerkt, maar het antwoord haalde de kassa niet. De
     wachtrij stuurt hem daarna nog een keer, met dezelfde sleutel. */
  const bon = { total: 31.4, method: 'pin', items: [{ name: 'Menu', qty: 2, price: 15.7 }], idem: 'wachtrij-8' };
  const eerste = await S('/api/supplier/pos/sale', bon);            // aangekomen; antwoord raakte "kwijt"
  const voor = await dag();
  const opnieuw = await S('/api/supplier/pos/sale', Object.assign({}, bon, { offlineVanaf: new Date().toISOString() }));
  const na = await dag();
  assert.equal(na.bonnen - voor.bonnen, 0, 'de herhaling maakt geen tweede bon');
  assert.equal(opnieuw.body.sale.bon, eerste.body.sale.bon, 'en geeft het bonnummer van de eerste terug');
  assert.equal(opnieuw.body.herhaald, true, 'zichtbaar als herhaling');
});
