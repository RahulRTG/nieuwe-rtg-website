/* DE VERSMALLING OP LEVENDE PADEN -- stap 2 van REPRESENTATIE.md.

   Stap 1 zette de wet neer (kern/namens/versmalling.js) en bewees hem op
   verzonnen letters: `test/namensversmalling.test.js` draait vijfhonderd
   gegenereerde doorsnedes en vraagt of er ooit iets bij komt. Dat bewijst dat de
   FORMULE klopt en niets over of zij ergens bevoegdheid beslist.

   Hier beslist zij dat wel, op twee mechanismen die niets delen: een APP van
   derden die namens een lid handelt, en RTG dat namens een ondernemer bij een
   instantie indient. Ze delen met opzet geen enkel object -- alleen de
   doorsnede. Zou er een gemeenschappelijk mandaat-object tussen komen, dan is
   dat de `Asset`-fout, en die is in dit huis al vier keer gemeten.

   WAT ELKE TOETS HIER MOET KUNNEN ZAKKEN, want een toets die je niet hebt zien
   zakken is geen toets (LAT-regel 10). Alle acht zijn met een mutatie
   nagetrokken; wat er dan omvalt staat per toets in zijn eigen kop.

   Draai los: node --test test/namensversmalling-bedrading.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const V = require('../server/kern/namens/versmalling');
const { maakMandaat } = require('../server/kern/fiscaal/gateway/mandaat');

const WORTEL = path.join(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-versmal-'));
let srv, base, lid, sup, office, tech;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const brug = (token, methode, args) =>
  api('/api/appstore/brug', { sleutel: 'vier-proef', methode, args }, token);

const HTML = '<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Vier</title></head>' +
  '<body><p id="n">0</p><script src="app.js"></script></body></html>';
const JS = 'RTG.roep("opslag.lijst", {});\n';

/* Een app die ALLE VIER de machtigingen vraagt. Dat is met opzet: pas met een
   manifest dat alles vraagt, is te zien dat er precies één afvalt en de rest
   blijft staan. Vroeg hij er maar één, dan zou "alles weg" er hetzelfde
   uitzien als "de juiste weg". */
const MANIFEST = {
  sleutel: 'vier-proef', naam: 'Vierproef', versie: '1.0.0', categorie: 'spelen',
  uitleg: 'Een proefspel dat alle vier de machtigingen van dit kanaal vraagt.',
  arena: { richting: 'hoog', eenheid: 'punten' },
  machtigingen: [
    { id: 'profiel.basis', doel: 'aanspreken' },
    { id: 'opslag.eigen', doel: 'voortgang-onthouden' },
    { id: 'arena.meedoen', doel: 'meedoen-arena' },
    { id: 'bericht.klaarzetten', doel: 'herinneren' }
  ]
};
const ALLE_VIER = MANIFEST.machtigingen.map(m => m.id);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lid = (await api('/api/auth/register', { name: 'Versmal Een', email: 'v1@x.nl', phone: '0612350001',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  tech = (await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const chef = (roster.staff || []).find(x => x.role === 'manager');
  sup = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: chef.id, pin: '1234' })).body.token;

  await api('/api/techniek/tenant', { org: 'O-VIER', naam: 'Vier Uitgeverij' }, tech);
  /* De zaak moet ONDER de organisatie hangen, anders weigert de aanvraag met
     409: een app in de officiele App Store heeft een aanspreekbare rechtspersoon
     achter zich. */
  assert.equal((await api('/api/techniek/tenant/bind',
    { org: 'O-VIER', soort: 'zaak', code: 'KIKUNOI' }, tech)).status, 200);
  const aan = await api('/api/appstore/uitgever/aanvraag', { naam: 'Vier Uitgeverij', contact: 'dev@vier.nl' }, sup);
  assert.equal(aan.status, 200, JSON.stringify(aan.body));
  await api('/api/appstore/kantoor/uitgever', { org: 'O-VIER', besluit: 'toegelaten', door: 'Sam van RTG' }, office);
  const inz = await api('/api/appstore/uitgever/inzenden', {
    manifest: MANIFEST, bestanden: [{ pad: 'index.html', inhoud: HTML }, { pad: 'app.js', inhoud: JS }]
  }, sup);
  assert.equal(inz.status, 200, JSON.stringify(inz.body.bevindingen || inz.body.fouten || inz.body.error));
  await api('/api/appstore/kantoor/toegankelijk', { versieId: inz.body.versie.id, stand: 'in-orde', fouten: 0 }, office);
  assert.equal((await api('/api/appstore/kantoor/besluit',
    { versieId: inz.body.versie.id, besluit: 'gepubliceerd', door: 'Sam van RTG' }, office)).status, 200);
});
test.after(() => stop(srv));

/* ==========================================================================
   APP-MACHTIGING, over HTTP en tegen een echte server.
   ========================================================================== */

test('1. LEVEND PAD: de gever heeft minder dan hij aanvinkt, en het versmalt', async () => {
  /* Het lid vinkt alle vier aan. Drie mag hij weggeven; `arena.meedoen` niet,
     want RTG bewaart geen score van iemand van wie het identiteitsbewijs niet
     is gezien -- en wat je zelf niet hebt, kun je niet uitlenen.

     ZAKT OP: de snede uit ./winkel.js weghalen (dan komen er vier terug), of
     `eistVanLid` van arena.meedoen halen (idem). */
  const r = await api('/api/appstore/installeer',
    { sleutel: 'vier-proef', machtigingen: ALLE_VIER }, lid);
  assert.equal(r.status, 200, JSON.stringify(r.body));

  const gaf = r.body.verleend.map(m => m.id).sort();
  assert.deepEqual(gaf, ['bericht.klaarzetten', 'opslag.eigen', 'profiel.basis'],
    'precies één valt af, en de andere drie blijven gewoon staan');

  /* En het valt niet STIL weg: een lid dat een vinkje zet en het daarna niet
     terugziet, denkt dat hij zich vergist heeft. */
  assert.ok(Array.isArray(r.body.versmald) && r.body.versmald.length === 1);
  assert.equal(r.body.versmald[0].id, 'arena.meedoen');
  assert.ok(r.body.versmald[0].waarom && r.body.versmald[0].waarom.length > 30,
    'met de reden erbij, en niet alleen de vaststelling');
  assert.match(r.body.let, /kon je niet geven/);
});

test('2. LEVEND PAD: wat wel is verleend, werkt gewoon door', async () => {
  /* De besturingsproef van dit bestand. Zonder deze toets haalt een versmalling
     die ALLES wegsnijdt toets 1 met gemak -- er valt dan immers ook nooit iets
     ten onrechte door. Er moet aantoonbaar iets werken.

     ZAKT OP: `context: ALLE_IDS` in ./winkel.js weglaten. Dan telt die bron als
     LEEG, valt alles weg, en blijft toets 1 vrolijk groen. */
  const zet = await brug(lid, 'opslag.zet', { sleutel: 'stand', waarde: '7' });
  assert.equal(zet.status, 200, JSON.stringify(zet.body));
  const lees = await brug(lid, 'opslag.lees', { sleutel: 'stand' });
  assert.equal(lees.body.uit.waarde, '7', 'de app schrijft en leest gewoon in haar eigen potje');
});

test('3. LEVEND PAD: buiten de doorsnede wordt geweigerd, met de JUISTE uitweg', async () => {
  /* Dit is de reden dat er een derde foutcode bij is gekomen. De bestaande
     weigering zegt letterlijk "Alleen het lid kan dit aanzetten, in de App
     Store" -- en dat is hier onwaar: het lid kan daar drukken wat hij wil. Een
     weigering die de verkeerde uitweg noemt, is duurder dan een kale.

     ZAKT OP: de versmald-tak uit ./brug.js halen; dan valt hij terug op
     RTG_MACHTIGING_NIET_VERLEEND en slaat de doesNotMatch aan. */
  const r = await brug(lid, 'arena.zet', { score: 10 });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'RTG_MACHTIGING_VERSMALD');
  assert.equal(r.body.eis, 'progressie');
  assert.doesNotMatch(String(r.body.hoe || ''), /Alleen het lid kan dit aanzetten/);

  /* En de twee ANDERE weigeringen blijven bestaan -- er is er geen vervangen.
     `bericht.zet` is wél verleend, dus hier moet iets anders komen dan 403. */
  const wel = await brug(lid, 'bericht.zet', { tekst: 'Tot straks' });
  assert.notEqual(wel.status, 403, 'een verleende machtiging komt er gewoon door');
});

test('4. LEVEND PAD: een lege doorsnede is een UITKOMST en geen stilte', async () => {
  /* Het lid vinkt alleen aan wat hij niet mag geven. Dan is er niets verleend,
     en dat moet als uitkomst leesbaar zijn -- met de reden, niet als leeg vak.

     ZAKT OP: `versmald` niet teruggeven uit ./winkel.js. */
  /* DE VULCONTROLE STAAT VOOROP, en op DEZELFDE variabele. "De lijst is leeg"
     is gratis waar op een route die altijd leeg teruggeeft, en dan meet de
     bewering erna niets. Dus eerst dezelfde route met één machtiging erbij die
     hij WEL mag geven: die moet er staan. */
  let r = await api('/api/appstore/verleen',
    { sleutel: 'vier-proef', machtigingen: ['arena.meedoen', 'opslag.eigen'] }, lid);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.verleend.map(m => m.id), ['opslag.eigen'],
    'deze route levert wél iets zodra er iets te leveren valt');

  /* En nu alleen wat hij niet mag geven. Zelfde route, zelfde variabele. */
  r = await api('/api/appstore/verleen',
    { sleutel: 'vier-proef', machtigingen: ['arena.meedoen'] }, lid);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.verleend.length, 0, 'er is niets verleend');
  assert.equal((r.body.versmald || [])[0] && r.body.versmald[0].id, 'arena.meedoen',
    'en er staat waarom, in plaats van een leeg vak dat de lezer zelf invult');

  /* Terugzetten, zodat de volgorde van de toetsen hierna niet uitmaakt. */
  await api('/api/appstore/verleen', { sleutel: 'vier-proef', machtigingen: ALLE_VIER }, lid);
});

/* ==========================================================================
   FISCAAL MANDAAT. Een ander domein, dezelfde wet, geen gedeeld object.
   ========================================================================== */

function proefMandaat() {
  const db = { data: {} };
  let n = 0;
  const { mandaat } = maakMandaat({ db, save: () => {},
    nu: () => '2026-10-05T09:0' + (n++ % 10) + ':00.000Z' });
  return mandaat;
}
const GEEF = (m, extra) => m.verleen(Object.assign({ code: 'KIKUNOI', soort: 'btw',
  van: '2026-01-01', tot: '2026-12-31', doorNaam: 'R. Sardjoe', doorRol: 'eigenaar' }, extra || {}));

test('5. FISCAAL: een gever die deze soort niet mag, krijgt geen mandaat', async () => {
  /* De zaakrol is in dit huis een boolean -- manager of staff, en geen fiscaal
     recht per medewerker (kern/onderneming/toegang.js). Grof, maar echt: wie
     geen manager is, geeft hier niets weg.

     ZAKT OP: de doorsnede uit verleen() halen. */
  const m = proefMandaat();
  const nee = GEEF(m, { geverEffectief: [] });
  assert.equal(nee.status, 403, JSON.stringify(nee));
  assert.match(nee.error, /gever mag dit zelf niet/);
  assert.equal(nee.bron, 'geverEffectief', 'en het zegt WELKE bron hem tegenhield');
  assert.equal(m.vanZaak('KIKUNOI').length, 0, 'er staat ook werkelijk niets');

  /* Alleen loonheffing mogen is geen btw mogen. */
  const scheef = GEEF(m, { geverEffectief: ['loonheffing'] });
  assert.equal(scheef.status, 403);
  assert.equal(m.vanZaak('KIKUNOI').length, 0);

  /* En de besturingsproef: met de bevoegdheid erbij komt hij er wel door. */
  const ja = GEEF(m, { geverEffectief: ['btw', 'loonheffing'] });
  assert.equal(ja.ok, true, JSON.stringify(ja));
  assert.equal(m.vanZaak('KIKUNOI').length, 1);
});

test('6. FISCAAL: een NIET OPGEGEVEN bron is een storing, geen weigering', async () => {
  /* Dit is belofte 2 in uitvoering, en het verschil is niet cosmetisch. Een
     ontbrekende bron als "deze gever mag niets" lezen, geeft een plausibel en
     volstrekt verkeerd antwoord: er heeft niemand gekeken. 503 en niet 403,
     want er is niets mis met deze gever.

     Dit sluit tegelijk het gat dat de kop van mandaat.js al jaren beschrijft:
     "wie dat controleert staat buiten deze module (de route)". Dat was een
     belofte; nu weigert de module een aanroeper die zwijgt.

     ZAKT OP: in versmalNamens de onbekende-tak weghalen -- dan komt er een
     gewone 403 terug en is een vergeten bedrading niet meer van een echte
     weigering te onderscheiden. */
  const m = proefMandaat();
  const stil = GEEF(m, {});                      // precies zoals een vergeten aanroeper hem stuurt
  assert.equal(stil.status, 503, JSON.stringify(stil));
  assert.equal(stil.code, 'RTG_VERSMALLING_ONBEPAALBAAR');
  assert.match(stil.error, /niemand gekeken/);
  assert.equal(m.vanZaak('KIKUNOI').length, 0, 'en er is niets verleend');

  /* Een bron van het verkeerde TYPE is ook niet leeg maar stuk. */
  const stuk = GEEF(m, { geverEffectief: 'btw' });
  assert.equal(stuk.status, 503);
  assert.match(stuk.error, /Geen verzameling/);
});

/* ==========================================================================
   DE REGRESSIE DIE ERTOE DOET.
   ========================================================================== */

test('7. DE GROEI-LEK: een gever die later MEER mag, verbreedt niets vanzelf', async () => {
  /* Hier lekken delegatiesystemen: de broncontext verandert later en een ooit
     veilige afleiding groeit ongemerkt mee. Dat kan alleen als de uitkomst bij
     GEBRUIK opnieuw uit de bron wordt afgeleid.

     Deze laag snijdt daarom bij het VERLENEN en bewaart de uitkomst. Wat er
     staat is wat er toen mocht; een gever die morgen meer mag, verandert daar
     niets aan tot een mens opnieuw verleent -- en dan gaat het opnieuw door de
     doorsnede. Dat laatste is de "tenzij": groeien mag, maar alleen met een
     handeling en nooit vanzelf.

     ZAKT OP: `geldt()` de doorsnede laten herrekenen tegen een verse
     geverEffectief. Dan wordt stap 3 hieronder ineens `ok: true`. */
  const m = proefMandaat();

  // 1. de gever mag vandaag alleen loonheffing; btw wordt geweigerd
  assert.equal(GEEF(m, { soort: 'btw', geverEffectief: ['loonheffing'] }).status, 403);
  assert.equal(m.vanZaak('KIKUNOI').length, 0);

  // 2. hij verleent wat hij wel mag, en dat staat er
  assert.equal(GEEF(m, { soort: 'loonheffing', geverEffectief: ['loonheffing'] }).ok, true);
  assert.equal(m.geldt('KIKUNOI', 'loonheffing', '2026-06-01').ok, true);

  // 3. DE KERN: de gever mag nu MEER. De geweigerde btw wordt geen mandaat.
  assert.equal(m.geldt('KIKUNOI', 'btw', '2026-06-01').ok, false,
    'een eerdere weigering wordt nooit alsnog een verlening doordat de gever groeide');
  assert.equal(m.vanZaak('KIKUNOI').filter(x => x.soort === 'btw').length, 0);

  // 4. de "tenzij": met een NIEUWE handeling mag het wel, en die snijdt opnieuw
  assert.equal(GEEF(m, { soort: 'btw', geverEffectief: ['btw', 'loonheffing'] }).ok, true);
  assert.equal(m.geldt('KIKUNOI', 'btw', '2026-06-01').ok, true);

  // 5. en intrekken blijft dominant -- groei draait een intrekking niet terug
  const btw = m.vanZaak('KIKUNOI').find(x => x.soort === 'btw');
  assert.equal(m.trekIn(btw.id, 'R. Sardjoe', 'niet langer gewenst').ok, true);
  assert.equal(m.geldt('KIKUNOI', 'btw', '2026-06-01').ok, false);
  assert.match(m.geldt('KIKUNOI', 'btw', '2026-06-01').reden, /ingetrokken/);
});

/* ==========================================================================
   ARCHITECTUUR. Twee lagen die dezelfde wet gebruiken, en geen gedeelde motor.
   ========================================================================== */

test('8. ARCHITECTUUR: de gedeelde laag leert geen domeinwoorden', async () => {
  /* Belofte 3. De wet mag over bevoegdheidssleutels gaan en nooit over WELKE.
     Zodra kern/namens/ weet wat `arena.meedoen` of `loonheffing` is, is het
     geen invariant meer maar het begin van een supermandaat-object -- en dan
     staat er over een jaar één klasse met een `extra`-veld per domein.

     ZAKT OP: één domeinwoord in versmalling.js zetten. */
  const MAP = path.join(WORTEL, 'server/kern/namens');

  /* A. DE KOPPELING, structureel. Dit is de scherpe helft: een domeinbegrip
     KENNEN begint met het kunnen aanroepen. Deze laag mag alleen zijn eigen
     buren requiren plus de codenaamzeef uit kern/envelop.js.

     Waarom dit de dragende toets is en niet de woordscan hieronder: een scan
     over woorden vond eerst `projectie.js`, omdat daar in een VELDBESCHRIJVING
     "de machtiging, het mandaat, de sessie" staat -- proza als data, en geen
     koppeling. Dat is een geldige uitslag van het verkeerde experiment
     (BEWIJSMACHINE.md par. 6a). Een require is niet uit te leggen. */
  for (const naam of fs.readdirSync(MAP)) {
    const bron = fs.readFileSync(path.join(MAP, naam), 'utf8');
    for (const m of bron.matchAll(/require\(\s*'([^']+)'/g)) {
      const pad = m[1];
      assert.ok(pad.startsWith('./') || pad === '../envelop',
        naam + ' requiret `' + pad + '`. Deze laag kent alleen zichzelf en de codenaamzeef; ' +
        'wat gedeeld wordt is de WET en niet de machine.');
    }
  }

  /* B. DE WET ZELF, tot in de woorden. Alleen versmalling.js, en met opzet
     inclusief het commentaar: dat bestand draagt vandaag geen enkel
     domeinbegrip, ook niet als voorbeeld, en dat hoort zo te blijven. Wie er
     "voor bijvoorbeeld arena.meedoen" bij schrijft, is een regel later bezig
     hem apart te behandelen. */
  const wet = fs.readFileSync(path.join(MAP, 'versmalling.js'), 'utf8');
  assert.doesNotMatch(wet, /\b(arena|appstore|loonheffing|btw|manifest|uitgever)\b/i,
    'de doorsnede hoort niet te weten waarover hij gaat');
  /* C. En andersom: de twee mechanismen bereiken allebei de WET, en geen van
     beide de ander. De appstore doet dat via ./gevermacht.js -- daar woont zijn
     snede, en winkel.js roept die alleen aan. */
  const snede = fs.readFileSync(path.join(WORTEL, 'server/kern/appstore/gevermacht.js'), 'utf8');
  const mnd = fs.readFileSync(path.join(WORTEL, 'server/kern/fiscaal/gateway/mandaat.js'), 'utf8');
  assert.match(snede, /require\('\.\.\/namens\/versmalling'\)/);
  assert.match(mnd, /require\('\.\.\/\.\.\/namens\/versmalling'\)/);
  assert.ok(!/fiscaal/.test(snede), 'de appstore kent de fiscale kant niet');
  assert.ok(!/appstore/.test(mnd), 'en andersom ook niet');
});

test('9. versmalNamens: onbekend is een verklaarde weigering en geen lege uitkomst', () => {
  /* De unittoets onder toets 6. Hij staat er apart omdat de HTTP-kant maar één
     van de twee standen kan laten zien, en het verschil tussen "gemeten leeg"
     en "niet aangesloten" juist het hele punt is. */
  const gemeten = V.versmalNamens({ gevraagd: ['a'], geverEffectief: [], beleid: ['a'], context: ['a'] });
  assert.equal(gemeten.ok, true, 'een LEGE bron is gemeten en dus een geldig antwoord');
  assert.deepEqual(gemeten.effectief, []);
  assert.equal(gemeten.versmald[0].bron, 'geverEffectief');

  const onbekend = V.versmalNamens({ gevraagd: ['a'], beleid: ['a'], context: ['a'] });
  assert.equal(onbekend.ok, false, 'een ONTBREKENDE bron is geen antwoord maar een gebrek');
  assert.deepEqual(onbekend.weigering.onbekend, ['geverEffectief']);
  assert.deepEqual(onbekend.effectief, [], 'en er komt hoe dan ook niets doorheen');

  /* De besturingsproef: hij moet ook JA kunnen zeggen. */
  const ja = V.versmalNamens({ gevraagd: ['a'], geverEffectief: ['a'], beleid: ['a'], context: ['a'] });
  assert.equal(ja.ok, true);
  assert.deepEqual(ja.effectief, ['a']);
});
