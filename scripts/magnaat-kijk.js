/* Een echte Magnaat-partij opzetten en fotograferen.

   DE SERVER DRAAIT HIER IN HETZELFDE PROCES, en dat is geen luiheid maar de
   enige manier om dit te kunnen: een spelmaand duurt honderd echte seconden
   (`MAAND_MS` in magnaat/economie.js), dus een campagne van tweehonderd maanden
   zou uren wachten zijn. De toetsen draaien de klok terug op `st.gerekendTot`,
   en dat kan alleen wie bij het db-object kan.

   VERDER IS ALLES ECHT: echte registratie, echte wachtrij, echte zetten, echt
   scherm, echte browser. Er wordt niets in de staat gezet wat een speler niet
   zelf kan doen -- de klok is de enige uitzondering, en die is tijd en geen
   besluit. De koelstoring wordt NIET geplaatst maar afgewacht: hij valt uit
   magnaat/risico.js zoals bij iedereen.

   Draaien: node --experimental-sqlite scripts/magnaat-kijk.js
   De platen komen in .magnaat-beeld/ (staat in .gitignore). */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');

const UIT = path.join(__dirname, '..', '.magnaat-beeld');
fs.mkdirSync(UIT, { recursive: true });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'shot-'));

process.env.RTG_DATA_DIR = TMP;
process.env.SMTP_URL = '';
process.env.NODE_ENV = 'development';
process.env.PORT = String(4300 + (process.pid % 200));

const { db } = require('../server/db');
require('../server/server');
const base = 'http://127.0.0.1:' + process.env.PORT;
const wacht = (ms) => new Promise(r => setTimeout(r, ms));

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return r.json().catch(() => ({}));
}
const zet = (tok, id, z) => api('/api/member/spel/zet', { id, zet: z }, tok);
const staat = (tok, id) => api('/api/member/spel/staat', { id }, tok);

/* DE KLOK. Niet Date.now vervalsen maar `gerekendTot` terugzetten: dat is
   precies wat test/spel*.test.js doen, en het houdt de rekenlus zelf echt. */
function terug(id, n) {
  const p = db.data.spellen.potjes[id];
  p.staat.gerekendTot -= p.staat.maandMs * n;
}

(async () => {
  for (let i = 0; i < 80; i++) {
    const r = await fetch(base + '/api/health').catch(() => null);
    if (r && r.ok) break;
    await wacht(250);
  }

  const t = Date.now();
  const reg = async (naam, mail) => {
    const r = await api('/api/auth/register', { name: naam, email: mail,
      phone: '06' + String(t + Math.random() * 1000 | 0).slice(-8), password: 'geheim123',
      geboortedatum: '1985-03-03' });
    if (!r.token) throw new Error('registratie mislukt voor ' + naam + ': ' + JSON.stringify(r).slice(0, 200));
    if (r.devVerifyUrl) await fetch(r.devVerifyUrl.startsWith('http') ? r.devVerifyUrl : base + r.devVerifyUrl).catch(() => null);
    return r.token;
  };
  const anna = await reg('Anna Havenzicht', 'anna' + t + '@voorbeeld.nl');
  const boris = await reg('Boris Vermeer', 'boris' + t + '@voorbeeld.nl');

  /* DE HANDLE. `key: 'user-' + user.id` (routes/auth/account.js) -- de codenaam
     die de schermen tonen is de privacykant daarvan en niet de sleutel, en de
     actie `aannemen` wil de sleutel. */
  const sq = require('node:sqlite');
  const gdb = new sq.DatabaseSync(path.join(TMP, 'rtg.db'));
  const rijen = gdb.prepare('select id, codename from users').all();
  gdb.close();
  const verse = rijen.slice(-2);
  const H = { [anna]: 'user-' + verse[0].id, [boris]: 'user-' + verse[1].id };
  const NAAM = { [anna]: 'Anna', [boris]: 'Boris' };
  console.log('Anna:', verse[0].codename, '| Boris:', verse[1].codename);

  async function nieuwPotje(duur) {
    const variant = { vorm: 'economie', stad: 'IJmuiden', duur, start: 'ondernemer' };
    await api('/api/member/spel/random', { soort: 'magnaat', grootte: 2, variant }, anna);
    const r2 = await api('/api/member/spel/random', { soort: 'magnaat', grootte: 2, variant }, boris);
    const id = r2.id || (r2.potje && r2.potje.id);
    if (!id) throw new Error('geen potje: ' + JSON.stringify(r2).slice(0, 200));
    return id;
  }
  const mijn = async (tok, id) => (await staat(tok, id)).potje.staat.vestigingen;
  const aanZet = async (tok, id) => { const p = (await staat(tok, id)).potje; return p.ik === p.beurt; };

  async function openZaak(tok, id, naam, n) {
    const zicht = await api('/api/member/spel/staat', { id, velden: true }, tok);
    const vrij = ((zicht.potje || {}).staat.kavels || []).filter(k => k.zone === 'boulevard' && !k.van);
    const r = await zet(tok, id, { actie: 'open', kavel: vrij[n].id, sector: 'horeca', omvang: 30, naam });
    if (!r.ok) throw new Error('zaak openen: ' + JSON.stringify(r).slice(0, 200));
  }
  /* De eigenaar zet een vacature open, de ander solliciteert, de eigenaar neemt
     hem aan -- de drie zetten uit VERHAAL.md hoofdstuk 1, alle drie echt. */
  async function inDienst(id, eig, wn, vId, rol) {
    const f = await zet(eig, id, { actie: 'functie-openen', vestiging: vId, rol });
    if (!f.ok) throw new Error('vacature: ' + JSON.stringify(f).slice(0, 200));
    const sol = await zet(wn, id, { actie: 'solliciteren', id: f.id });
    if (!sol.ok) throw new Error('solliciteren: ' + JSON.stringify(sol).slice(0, 200));
    const aan = await zet(eig, id, { actie: 'aannemen', id: f.id, speler: H[wn] });
    if (!aan.ok) throw new Error('aannemen: ' + JSON.stringify(aan).slice(0, 200));
    return aan;
  }

  /* ---- campagne 1, twee keer: alleen om een VERLEDEN te maken ----
     De herkomststrook leest wat er van een AFGELOPEN partij is bewaard
     (spellen/loopbaan.js), dus er moet er eerst een afgelopen zijn. Twee keer,
     met de rollen om, zodat het straks niet uitmaakt wie er in campagne 2
     toevallig aan zet is. Deze partijen worden niet gefotografeerd. */
  async function verleden(eig, wn) {
    const id = await nieuwPotje('quick');
    /* `open` is een GROTE zet en wacht dus wel op je beurt (magnaat/index.js
       `buitenBeurt`). Is de ander aan zet, dan zet die er eerst zelf een neer --
       in een weggooipartij is dat gratis, en het is dezelfde echte actie. */
    if (!(await aanZet(eig, id))) await openZaak(wn, id, 'Overkant', 0);
    await openZaak(eig, id, 'De Kade', 1);
    const v = (await mijn(eig, id)).slice(-1)[0];
    await zet(eig, id, { actie: 'beleid', id: v.id, personeel: 4, onderhoud: 700 });
    terug(id, 3); await staat(eig, id);
    await inDienst(id, eig, wn, v.id, 'hulp');
    for (let i = 0; i < 3; i++) { terug(id, 40); await staat(eig, id); }
    return (await staat(eig, id)).potje.status;
  }
  console.log('verleden Boris:', await verleden(anna, boris));
  console.log('verleden Anna :', await verleden(boris, anna));

  /* ---- campagne 2: hier wordt gefotografeerd ----
     Twee zaken, want een koelstoring valt uit magnaat/risico.js met een KANS per
     zaak per maand (0,010 basis x 0,15 voor horeca x de verwaarlozingsfactor).
     Er wordt niets geplaatst; er wordt gewacht -- en als het in deze wereld niet
     gebeurt, wordt er een nieuwe wereld begonnen in plaats van een storing in de
     staat gezet. Dat is het verschil tussen een foto en een decorstuk. */
  async function campagne2() {
    const id = await nieuwPotje('weekend');
    const eig = (await aanZet(anna, id)) ? anna : boris;
    const wn = eig === anna ? boris : anna;
    /* EEN ZAAK, EN PAS LATER MEER: openen kost hier 177.090 en je begint met
       250.000, dus een tweede past domweg niet in de eerste maand. Dat is geen
       beperking van dit script maar de economie zelf, en die is hier de baas. */
    const beleid = async () => { for (const v of await mijn(eig, id))
      await zet(eig, id, { actie: 'beleid', id: v.id, personeel: 3, onderhoud: 250, prijs: 'midden' }); };
    await openZaak(eig, id, 'Havenzicht', 0);
    await beleid();
    const maand = async (n) => { for (let i = 0; i < n; i++) { terug(id, 1);
      const v = (await mijn(eig, id)).find(x => (x.storingen || []).some(s => s.staat !== 'weg'));
      if (v) return v; } return null; };
    let stuk = await maand(40);
    /* EN DAN NOG TWEE ZAKEN, want een koelstoring is een KANS per zaak per maand
       en drie zaken zijn drie onafhankelijke reeksen. De beurt moet daarvoor
       terugkomen -- `open` en `sluiten` zijn allebei grote zetten -- dus de ander
       opent en sluit er intussen een. Aan het eind heeft hij er weer geen: hij
       komt hier werken, niet ondernemen. */
    if (!stuk) {
      await openZaak(wn, id, 'Overkant', 3);
      await openZaak(eig, id, 'Bar Noord', 1);
      const heen = (await mijn(wn, id))[0];
      await zet(wn, id, { actie: 'sluiten', id: heen.id });
      await openZaak(eig, id, 'De Vuurtoren', 2);
      await beleid();
      stuk = await maand(180);
    }
    const na = (await staat(eig, id)).potje;
    console.log('  maand', na.staat.maand, '| status', na.status,
      '| kas', Math.round(na.staat.geld),
      '| onderhoud', (na.staat.vestigingen[0] || {}).onderhoud);
    return stuk ? { id, eig, wn, stuk } : null;
  }
  let R = null;
  for (let poging = 1; poging <= 5 && !R; poging++) {
    R = await campagne2();
    console.log('campagne 2, poging ' + poging + ':', R ? 'koelstoring bij ' + R.stuk.naam : 'geen storing in 220 maanden');
  }
  if (!R) throw new Error('vijf werelden lang geen koelstoring');
  const { id: p2, eig, wn, stuk } = R;
  console.log('eigenaar', NAAM[eig], '| werknemer', NAAM[wn],
    '| maand', (await staat(eig, p2)).potje.staat.maand);

  /* En de werknemer komt daar werken. Als VAKKRACHT, want dat is de rol waarvoor
     de koelstoring meer dan een taakje is: hij ziet de uitwegen (VERHAAL.md par.
     0f), en `repareren` staat er NIET bij -- dat besluit kost geld en hoort op
     het zaakscherm. */
  const aan = await inDienst(p2, eig, wn, stuk.id, 'vakkracht');
  console.log(NAAM[wn], 'in dienst als vakkracht voor', aan.loon);
  terug(p2, 2); await staat(eig, p2);

  /* WACHTEN TOT DE KOELING BINNENKOMT. Een voorval heeft een MOMENT waarop het
     verschijnt (`vanaf` in magnaat/rush.js), dus op moment 1 hoeft de koeling er
     nog niet te staan. De dienst opschuiven doe je door te werken -- dus werkt
     hij de dingen af die er wel staan, precies zoals een speler dat zou doen. */
  const vloer = async () => ((await staat(wn, p2)).potje.staat.werk || {}).dienst || {};
  for (let i = 0; i < 6; i++) {
    const d = await vloer();
    if ((d.open || []).some(o => o.id === 'koeling')) break;
    const eerste = (d.open || [])[0];
    if (!eerste) break;
    await zet(wn, p2, { actie: 'rush-pak', wat: eerste.id });
  }

  const w = (await staat(wn, p2)).potje.staat;
  console.log('herkomst:', JSON.stringify(w.herkomst).slice(0, 160));
  const zaakNu = (await mijn(eig, p2)).find(v => v.id === stuk.id);
  console.log('storingen bij de zaak:', JSON.stringify(zaakNu.storingen));
  console.log('dienst:', JSON.stringify((w.werk || {}).dienst || (w.werk || {}).waarom).slice(0, 700));

  /* ---------------- en nu kijken ---------------- */
  const pw = require('playwright');
  const browser = await pw.chromium.launch({ args: ['--no-sandbox'], executablePath: '/opt/pw-browsers/chromium' });
  const fouten = [];
  async function schiet(token, naam, na) {
    const ctx = await browser.newContext({ viewport: { width: 430, height: 1500 }, deviceScaleFactor: 2 });
    await ctx.addInitScript((tk) => {
      localStorage.setItem('rtg_member_token', tk);
      localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.setItem('rtg_os_wereld', 'uit');
    }, token);
    const page = await ctx.newPage();
    page.on('pageerror', e => fouten.push(naam + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error') fouten.push(naam + ' (console): ' + m.text()); });
    await page.goto(base + '/apps/spelen.html?potje=' + p2, { waitUntil: 'load' });
    await page.waitForSelector('#ecKop', { state: 'visible', timeout: 20000 });
    await page.waitForFunction(() => document.querySelector('#ecKop').textContent.length > 5, null, { timeout: 20000 });
    if (na) await na(page);
    await ctx.close();
  }

  /* EEN LANG PANEEL IN LEESBARE PLAKKEN. Een plaat van 1500 px hoog schaalt bij
     het bekijken zo ver terug dat je de tekst niet meer leest -- en dan is een
     screenshot weer een bewijs in plaats van een blik. */
  async function plakken(page, sel, naam, hoog = 780) {
    /* DE BALK VAN RAHUL GAAT ER VOOR DE FOTO AF. Hij ligt met position:fixed
       onderaan het scherm (shared/metgezel.js) en dus over elke uitsnede heen;
       op de pagina zelf houdt `mgz-ruimte` daar netjes ruimte voor vrij, dus dit
       is een fotografeerprobleem en geen schermprobleem. */
    await page.addStyleTag({ content: '.mgz-blok,.mgz-knop,.mgz-ruimte{display:none !important;}' });
    /* EN METEEN GEMETEN OF ER IETS BUITEN DE RAND VALT. Op het scherm zag de
       metaregel van een zaak eruit alsof hij rechts werd afgesneden; dat hoort
       een meting te zijn en geen indruk. */
    const over = await page.locator(sel).evaluate((el) => {
      const uit = [];
      for (const k of el.querySelectorAll('*'))
        if (k.scrollWidth > k.clientWidth + 1 && k.clientWidth)
          uit.push(k.className + ': ' + k.scrollWidth + ' in ' + k.clientWidth);
      return uit.slice(0, 6);
    });
    console.log('  buiten de rand:', over.length ? over : 'niets');
    const b = await page.locator(sel).boundingBox();
    const n = Math.max(1, Math.ceil(b.height / hoog));
    for (let i = 0; i < n; i++) {
      const y = b.y + i * hoog;
      /* `fullPage` MOET HIER BIJ. Zonder die vlag knipt Playwright uit het
         VENSTER, en alles onder de vensterrand komt er als leegte uit -- wat er
         precies uitziet als een paneel dat vroeg ophoudt. Dat had ik bijna voor
         een schermfout aangezien. */
      await page.screenshot({ path: path.join(UIT, naam + '-' + (i + 1) + '.png'), fullPage: true,
        clip: { x: b.x, y, width: b.width, height: Math.min(hoog, b.y + b.height - y) } });
    }
    return n;
  }

  /* ---- 2. DE OVERDRACHT. Boris zet een noodkoeling neer en GEEFT HEM DOOR --
       dat kost hem een moment van zijn avond. Daarna kijkt Anna, en daarna komt
       Boris terug op een dienst waarop hij ziet wat er intussen veranderd is. */
  let over = false;
  for (let i = 0; i < 8; i++) {
    const d = await vloer();
    if (d.klaar) break;
    if (!over && (d.overTeDragen || []).length) {
      over = true;
      /* HIER STAAT DE KNOP, en alleen hier: er valt iets door te geven en de
         avond is nog niet om. Vandaar dat de eerste foto op DIT moment valt en
         niet aan het begin van de dienst. */
      await schiet(wn, 'werkvloer', async (page) => {
        await page.waitForSelector('#ecWerk .sec', { timeout: 20000 });
        console.log('werkvloer in', await plakken(page, '#ecWerk', 'werknemer'), 'plakken');
      });
      await zet(wn, p2, { actie: 'rush-overdragen' });
      continue;
    }
    const k = (d.open || []).find(o => o.id === 'koeling');
    if (k) { await zet(wn, p2, { actie: 'rush-pak', wat: 'koeling', optie: 'workaround' }); continue; }
    if (!(d.open || []).length) break;
    await zet(wn, p2, { actie: 'rush-pak', wat: d.open[0].id });
  }
  console.log('doorgegeven:', over);
  terug(p2, 1); await staat(eig, p2);
  const zaakNa = (await mijn(eig, p2)).find(v => v.id === stuk.id);
  console.log('keten bij de zaak:', JSON.stringify((zaakNa.storingen || [])[0] || {}).slice(0, 240));
  console.log('overdrachten:', JSON.stringify(zaakNa.overdrachten));

  await schiet(eig, 'zaakscherm', async (page) => {
    await page.waitForSelector('#ecMijn [data-stor]', { timeout: 20000 });
    console.log('zaakscherm in', await plakken(page, '#ecMijn', 'eigenaar'), 'plakken');
  });

  /* ---- 3. de eigenaar beslist, en de volgende ploeg treft de wereld aan ---- */
  const rep = await zet(eig, p2, { actie: 'storing-verhelpen', vestiging: stuk.id,
    storing: 'koeling', hoe: 'repareren' });
  console.log('eigenaar laat repareren:', JSON.stringify(rep).slice(0, 100));
  terug(p2, 2); await staat(eig, p2);
  /* EN DAN GAAT HIJ WEER STUK. Niet geplaatst maar afgewacht zou hier maanden
     kosten; de herhaling is het onderwerp van de foto, dus de tweede breuk komt
     uit dezelfde motor maar op commando -- dit is een fotograaf en geen partij. */
  const potje = db.data.spellen.potjes[p2];
  const zaakObj = (potje.staat.vestigingen[H[eig]] || [])
    .find(v => v.id === stuk.id);
  require('../server/kern/spellen/magnaat/storing')
    .uitVoorval(zaakObj, 'machinebreuk', potje.staat.maand);
  await staat(eig, p2);
  const zaakOrg = (await mijn(eig, p2)).find(v => v.id === stuk.id);
  console.log('organisatie:', JSON.stringify(zaakOrg.organisatie));
  const na = await vloer();
  console.log('wat de volgende ploeg weet:', JSON.stringify(na.weet));

  await schiet(wn, 'overdracht', async (page) => {
    await page.waitForSelector('#ecWerk .sec', { timeout: 20000 });
    console.log('overdracht in', await plakken(page, '#ecWerk', 'overdracht'), 'plakken');
  });
  await browser.close();
  console.log('JS-fouten:', fouten.length ? fouten : 'geen');
  console.log('beelden in', UIT, fs.readdirSync(UIT).join(', '));
  process.exit(0);
})().catch(e => { console.log('FOUT:', e.stack); process.exit(1); });
