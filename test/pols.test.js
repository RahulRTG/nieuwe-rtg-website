/* DE POLS VAN EEN ZAAK: hoe druk, hoe luid, hoe gezellig het NU is.

   Drie bronnen -- wat wij meten, wat de zaak invult, wat gasten melden -- en
   het hele risico van deze laag zit in het door elkaar lopen daarvan. Vandaar
   dat dit bestand vooral de SCHEIDING bewaakt en niet de rekensom:

   1. NIETS GEMETEN IS NIET RUSTIG. Een zaak zonder tafels in RTG mag geen
      bezettingspercentage krijgen. Zou hij op 0% staan, dan ziet elke zaak die
      RTG niet voor haar rekeningen gebruikt er permanent leeg uit, en dat merkt
      de gast pas voor de deur.
   2. WIE MAG WAT ZEGGEN. De zaak kan haar eigen wachttijd niet invullen -- dat
      getal komt uit haar keuken. Gasten kunnen niets over het terras zeggen.
   3. EEN MENING VERANDERT DE VOLGORDE NIET. De avondplanner weegt de pols mee,
      maar alleen het gemeten deel. Een zaak die zichzelf "rustig" noemt mag
      daarmee niet omhoog komen in het voorstel.
   4. OUD IS WEG. Een invulling buiten het versvenster verdwijnt; hij wordt niet
      met een oud tijdstip alsnog als "nu" getoond.
   5. EEN GAST TELT EEN KEER. Twintig keer dezelfde knop is een melding. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, ZAAK, LID;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pols-'));
const post = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = (await post('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  ZAAK = (await post('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  assert.ok(ZAAK, 'de zaak-inlog werkt');
  const u = String(Date.now());
  const reg = await post('/api/auth/register', { name: 'Polsganger', email: 'po' + u + '@voorbeeld.nl',
    phone: '06' + u.slice(-8), password: 'geheim123',
    geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  LID = reg.body.token;
  assert.ok(LID, 'een lid kan zich registreren: ' + JSON.stringify(reg.body).slice(0, 160));
});

// inloggen bij een willekeurige zaak, voor de toetsen die er twee nodig hebben
async function zaakToken(code) {
  const roster = (await post('/api/supplier/roster', { code })).body;
  if (!roster.staff) return null;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  return (await post('/api/supplier/login', { code, staffId: mgr.id, pin: '1234' })).body.token;
}
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let tafelTeller = 0;
// een eigen tafel per toets: per tafel is er hooguit een open rekening
async function aanTafel(naam) {
  const tafel = naam || ('Pols ' + (++tafelTeller));
  const qr = await post('/api/supplier/horeca/gast/qr', { tafel }, ZAAK);
  const aan = await post('/api/gast/aanschuiven', { token: qr.body.token, naam: 'Gast' });
  assert.equal(aan.status, 200, 'aanschuiven aan ' + tafel);
  return aan.body.sleutel;
}
const vind = (lijst, onderwerp) => (lijst || []).find(x => x.onderwerp === onderwerp);

test('1. wat gemeten wordt draagt zijn rekensom, en wat niet gemeten kan worden draagt zijn reden', async () => {
  const p = await post('/api/supplier/horeca/pols', {}, ZAAK);
  assert.equal(p.status, 200);
  const alles = [...p.body.gemeten, ...p.body.nietGemeten];
  assert.ok(alles.length, 'er komt iets terug over meten');
  for (const m of p.body.gemeten) {
    assert.equal(m.bron, 'gemeten', 'elk gemeten getal draagt zijn bron');
    assert.ok(m.rekensom && m.rekensom.length > 5, m.onderwerp + ' draagt een narekenbare som');
  }
  for (const g of p.body.nietGemeten) assert.ok(g.waarom, g.onderwerp + ' zegt waarom het er niet is');
});

test('2. een zaak zonder tafels in RTG krijgt geen bezettingspercentage, maar de reden', async () => {
  /* PONTO heeft in de seed geen QR-plekken. Zou de laag dan 0% teruggeven, dan
     ziet elke zaak die RTG niet voor haar rekeningen gebruikt er leeg uit. */
  const roster = (await post('/api/supplier/roster', { code: 'PONTO' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  const tok = (await post('/api/supplier/login', { code: 'PONTO', staffId: mgr.id, pin: '1234' })).body.token;
  const p = (await post('/api/supplier/horeca/pols', {}, tok)).body;
  assert.equal(vind(p.gemeten, 'bezetting'), undefined, 'geen verzonnen percentage');
  const geen = vind(p.nietGemeten, 'bezetting');
  assert.ok(geen && /geen tafels|niet.*meten|geen rekeningen/i.test(geen.waarom), 'met de reden erbij: ' + (geen || {}).waarom);
});

test('3. de bezetting telt echte open rekeningen tegen echte tafels', async () => {
  await aanTafel('Bezet A');
  const p = (await post('/api/supplier/horeca/pols', {}, ZAAK)).body;
  const b = vind(p.gemeten, 'bezetting');
  assert.ok(b, 'nu er tafels en een open rekening zijn, is er een percentage');
  assert.ok(b.waarde > 0 && b.waarde <= 100, 'een percentage tussen 0 en 100: ' + b.waarde);
  assert.match(b.rekensom, /van de \d+ tafels/, 'de som noemt teller en noemer: ' + b.rekensom);
});

test('4. de zaak vult in wat we niet kunnen meten, met het tijdstip erbij', async () => {
  const r = await post('/api/supplier/horeca/pols/zet', { standen: { sfeer: 'feestelijk', geluid: 'levendig' } }, ZAAK);
  assert.equal(r.status, 200);
  assert.equal(r.body.gezet.length, 2);
  const s = vind(r.body.zaakZegt, 'sfeer');
  assert.equal(s.stand, 'feestelijk');
  assert.equal(s.bron, 'zaak');
  assert.match(s.label, /volgens de zaak, bijgewerkt om \d\d:\d\d/, 'het etiket noemt de bron en het tijdstip: ' + s.label);
});

test('5. de zaak mag haar eigen wachttijd niet invullen', async () => {
  /* Dat getal komt uit haar keuken en staat bij de gast in de lijst. Wie hem
     met de hand mag zetten, zet hem laag. */
  const r = await post('/api/supplier/horeca/pols/zet', { standen: { wachttijd: '5' } }, ZAAK);
  assert.equal(r.body.gezet.length, 0, 'niets gezet');
  assert.ok(vind(r.body.geweigerd, 'wachttijd'), 'en de weigering draagt haar reden');
  assert.equal(vind(r.body.zaakZegt, 'wachttijd'), undefined, 'er staat geen ingevulde wachttijd in het beeld');
});

test('6. een verzonnen stand komt er niet in, met de keuzes in de foutmelding', async () => {
  const r = await post('/api/supplier/horeca/pols/zet', { standen: { sfeer: 'exclusief' } }, ZAAK);
  assert.equal(r.body.gezet.length, 0);
  assert.match(vind(r.body.geweigerd, 'sfeer').waarom, /ingetogen, gezellig, feestelijk/);
});

test('7. een gast meldt vanaf zijn tafel; zonder tafelsleutel komt er niets binnen', async () => {
  const sleutel = await aanTafel();
  const goed = await post('/api/gast/pols/meld', { sleutel, standen: { geluid: 'luid' } });
  assert.equal(goed.status, 200);
  assert.equal(vind(goed.body.gastenZeggen, 'geluid').stand, 'luid');

  const zonder = await post('/api/gast/pols/meld', { sleutel: 'niet-bestaand-1234567890abcdef', standen: { geluid: 'stil' } });
  assert.equal(zonder.status, 401, 'zonder geldige tafelsessie geen melding');
});

test('8. gasten mogen niets zeggen over het terras: daar kunnen ze niet over oordelen', async () => {
  const sleutel = await aanTafel();
  const r = await post('/api/gast/pols/meld', { sleutel, standen: { terras: 'zon' } });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /vragen we gasten niets/i);
});

test('9. een gast telt een keer, ook na twintig keer drukken', async () => {
  const a = await aanTafel();
  const b = await aanTafel();
  for (let i = 0; i < 20; i++) await post('/api/gast/pols/meld', { sleutel: a, standen: { drukte: 'vol' } });
  const laatste = await post('/api/gast/pols/meld', { sleutel: b, standen: { drukte: 'rustig' } });
  const d = vind(laatste.body.gastenZeggen, 'drukte');
  assert.equal(d.aantal, 2, 'twee gasten, twee stemmen -- niet eenentwintig');
  assert.deepEqual(d.verdeling, { vol: 1, rustig: 1 }, 'en de hele verdeling is zichtbaar');
  assert.match(d.label, /volgens 2 gasten/);
});

test('10. de drie bronnen blijven gescheiden en er komt geen totaalcijfer uit', async () => {
  const sleutel = await aanTafel();
  await post('/api/supplier/horeca/pols/zet', { standen: { sfeer: 'ingetogen' } }, ZAAK);
  await post('/api/gast/pols/meld', { sleutel, standen: { sfeer: 'feestelijk' } });
  const p = (await post('/api/gast/pols', { sleutel })).body;
  assert.equal(vind(p.zaakZegt, 'sfeer').stand, 'ingetogen', 'de zaak zegt het ene');
  assert.equal(vind(p.gastenZeggen, 'sfeer').stand, 'feestelijk', 'de gasten het andere');
  assert.equal(p.score, undefined, 'en er wordt geen cijfer van gemaakt dat ze verzoent');
  assert.equal(p.sfeer, undefined, 'ook niet stiekem als los veld');
  const bronnen = new Set([...p.gemeten, ...p.zaakZegt, ...p.gastenZeggen].map(x => x.bron));
  assert.ok(bronnen.size >= 2, 'er staan echt meer bronnen naast elkaar');
  for (const x of [...p.gemeten, ...p.zaakZegt, ...p.gastenZeggen]) assert.ok(x.label, x.onderwerp + ' draagt een etiket');
});

test('11. een invulling die te oud is verdwijnt, in plaats van als "nu" te blijven staan', async () => {
  /* Terugzetten in de tijd kan alleen door de opslag zelf een oud tijdstip te
     geven; dat doen we via de route die hem schreef en daarna een sprong in de
     klok van de opslag. Hier gaat het om het GEDRAG: buiten het venster hoort
     hij weg te zijn, niet oud getoond. */
  const laag = require('../server/kern/horeca/pols');
  const opslag = { data: { horeca: {} } };
  let bewaard = 0;
  const save = () => { bewaard++; };
  const schoon = (v, n) => String(v == null ? '' : v).slice(0, n);
  const horeca = require('../server/kern/horeca')({ db: opslag, save, crypto: require('crypto'), schoon });
  const p = laag({ save, schoon, horeca });
  p.zetZaak('X', { sfeer: 'feestelijk' });
  assert.equal(p.zaakZegt('X').length, 1, 'vers staat hij er');
  opslag.data.horeca.X.pols.zaak.sfeer.at = new Date(Date.now() - (p.VERS.zaak + 1) * 60000).toISOString();
  assert.equal(p.zaakZegt('X').length, 0, 'buiten het venster is hij weg');
  assert.equal(opslag.data.horeca.X.pols.zaak.sfeer, undefined, 'en hij is ook echt opgeruimd');

  /* En lezen schrijft alleen als er ook echt iets is opgeruimd. Anders kost een
     avondplan met twaalf zaken twaalf schrijfrondes voor niets. */
  p.zetZaak('Y', { sfeer: 'gezellig' });
  bewaard = 0;
  p.pols('Y');
  assert.equal(bewaard, 0, 'een pols lezen waar niets verlopen is, schrijft niet');
  opslag.data.horeca.Y.pols.zaak.sfeer.at = new Date(Date.now() - (p.VERS.zaak + 1) * 60000).toISOString();
  p.pols('Y');
  assert.equal(bewaard, 1, 'een pols lezen die iets opruimt, bewaart dat wel');
});

test('12. de avondplanner weegt wat gemeten is, en negeert wat de zaak zelf invult', async () => {
  /* Dit is de toets die de hele scheiding waard maakt. Zou een ingevulde
     "rustig" meetellen, dan schrijft elke zaak zichzelf naar boven. */
  const steller = require('../server/kern/avond/samenstellen')({ findSupplier: null, planlaag: null, voorkeuren: null });
  const zaakZegt = [{ onderwerp: 'drukte', stand: 'rustig', bron: 'zaak', label: 'volgens de zaak' }];
  const gasten = [{ onderwerp: 'drukte', stand: 'rustig', bron: 'gasten', label: 'volgens 9 gasten' }];
  const meting = [{ onderwerp: 'bezetting', waarde: 20, tekst: '20% bezet', bron: 'gemeten', label: 'gemeten door RTG' }];
  assert.equal(steller.polsPunten(zaakZegt).punten, 0, 'wat de zaak zegt beweegt niets');
  assert.equal(steller.polsPunten(gasten).punten, 0, 'wat gasten zeggen beweegt de volgorde ook niet');
  const m = steller.polsPunten(meting);
  assert.ok(m.punten > 0, 'een gemeten lege zaal telt wel mee');
  assert.match(m.redenen[0], /gemeten door RTG/, 'en de reden noemt de bron: ' + m.redenen[0]);
  const druk = steller.polsPunten([{ onderwerp: 'wachttijd', waarde: 45, tekst: '45 minuten', bron: 'gemeten', label: 'gemeten door RTG' }]);
  assert.ok(druk.punten < 0, 'een keuken die achterloopt telt tegen');
});

test('13. de lijst met onderwerpen komt van de server, niet uit het scherm', async () => {
  const sleutel = await aanTafel();
  const gast = (await post('/api/gast/pols', { sleutel })).body;
  const zaak = (await post('/api/supplier/horeca/pols', {}, ZAAK)).body;
  assert.ok(gast.meldbaar.length, 'de gast krijgt te horen waarover hij iets mag zeggen');
  assert.ok(zaak.invulbaar.length, 'de zaak krijgt te horen wat zij mag invullen');
  assert.ok(gast.meldbaar.every(o => o.standen && o.standen.length), 'met de keuzes erbij');
  assert.equal(zaak.invulbaar.find(o => o.sleutel === 'wachttijd'), undefined, 'en de wachttijd staat er niet bij');
  assert.equal(gast.meldbaar.find(o => o.sleutel === 'terras'), undefined, 'net zomin als het terras bij de gast');
});

test('14. de avondplanner krijgt de pols ECHT binnen, en zegt erbij waarom', async () => {
  /* Toets 12 bewijst dat de weegfunctie het goede doet. Dat zegt niets over de
     BEDRADING: als `polsVan` in routes/avond.js zou verdwijnen, blijft toets 12
     groen en merkt niemand dat een voorstel de pols niet meer meeneemt. Daarom
     gaat deze toets over de route.

     De opzet is met opzet omgedraaid: eerst vragen we WELKE zaak wordt gekozen,
     en pas daarna geven we juist die zaak meetbare tafels. Andersom zou de
     toets stil kunnen slagen op een zaak waar niets te meten valt. */
  const eerst = await post('/api/avond/voorstel', { start: '19:00', personen: 2, plafondPP: 20000 }, LID);
  assert.equal(eerst.status, 200, JSON.stringify(eerst.body).slice(0, 160));
  const stap = eerst.body.avond.stappen.find(s => s.soort === 'eten');
  assert.ok(stap && stap.zaak, 'er wordt een zaak gekozen om te eten');

  const tok = await zaakToken(stap.zaak);
  assert.ok(tok, 'we kunnen bij die zaak inloggen om er tafels aan te maken');
  for (let i = 1; i <= 5; i++) await post('/api/supplier/horeca/gast/qr', { tafel: 'Leeg ' + i }, tok);
  const meting = (await post('/api/avond/pols', { zaken: [stap.zaak] }, LID)).body.pols[stap.zaak];
  const bez = vind(meting.gemeten, 'bezetting');
  assert.ok(bez && bez.waarde <= 40, 'die zaak is nu meetbaar rustig: ' + JSON.stringify(bez));

  const daarna = await post('/api/avond/voorstel', { start: '19:00', personen: 2, plafondPP: 20000 }, LID);
  const uitleg = (daarna.body.uitleg || []).find(u => u.zaak === stap.zaak);
  assert.ok(uitleg, 'dezelfde zaak wordt nog steeds voorgesteld');
  const rustig = uitleg.waarom.filter(w => /is nu rustig/.test(w))[0];
  assert.ok(rustig, 'en het voorstel noemt de meting: ' + JSON.stringify(uitleg.waarom));
  assert.match(rustig, /gemeten door RTG/, 'met de bron erbij, zodat je weet wie dat zegt');
});

test('15. de pols van een zaak die niets doorgeeft is stil, en zegt dat ook', async () => {
  /* Een leeg antwoord is geen "rustig". Dit is dezelfde regel als bij de
     gaten in het avondplan: liever zeggen dat we het niet weten. */
  const r = await post('/api/avond/pols', { zaken: ['BESTAATNIET'] }, LID);
  assert.equal(r.status, 200);
  const p = r.body.pols.BESTAATNIET;
  assert.equal(p.stil, true, 'er is niets bekend, en dat staat er als zodanig');
  assert.deepEqual(p.gemeten, [], 'geen verzonnen getallen');
  assert.ok(p.nietGemeten.length, 'wel de reden waarom er niets is');
});
