/* De grendel op een OPENBARE installatie die in Magnaat Test draait.

   WAAR HIJ VANDAAN KOMT. Op een draaiende RTG-installatie werkte het
   demo-wachtwoord van het eigenaarsaccount. Dat wachtwoord kan alleen via
   accounts/kluis.js zaaiHash() gezet zijn, en die weigert buiten Magnaat Test;
   er stonden dus demo-accounts, personeel met een pincode uit de broncode en
   een betaalprovider die zichzelf bevestigt op een adres waar mensen bij konden.

   De grendel daartegen BESTOND al (config/productie-lokaal.js verbiedt
   RTG_MAGNAAT_TEST=1 "in productie") en kon nooit afgaan: zowel die keuring als
   testomgeving.actief() hangen aan NODE_ENV === 'production', en in die stand
   staat de vlag toch al uit. Deze toetsen gaan over de nieuwe vraag, die niet
   aan NODE_ENV hangt: geeft deze installatie zichzelf op als openbaar? */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { adresSoort, installatieSoort, valideer } = (() => {
  const o = require('../server/config/openbaar');
  const c = require('../server/config');
  return { adresSoort: o.adresSoort, installatieSoort: o.installatieSoort, valideer: c.valideer };
})();

/* DRIE UITKOMSTEN EN NIET TWEE. Dit is de dragende toets: zou `onbekend`
   samenvallen met `openbaar`, dan breekt elke lokale start en elke toets; zou
   hij samenvallen met `lokaal`, dan is de grendel weg zodra iemand APP_URL
   weglaat. Beide vergissingen zijn hier een gezakte rij. */
test('een adres is lokaal, openbaar of onbekend -- en nooit stilzwijgend het een of het ander', () => {
  for (const h of ['localhost', '127.0.0.1', '::1', 'rtg.local', '10.1.2.3', '192.168.1.9', '172.20.0.5'])
    assert.equal(adresSoort(h), 'lokaal', h + ' hoort lokaal te zijn');
  /* RFC 2606 reserveert vier TLD's EN drie tweede-niveau-domeinen. Die laatste
     drie stonden er eerst niet bij, waardoor `rtg.example.com` -- dat
     golive.test.js en poortwacht.test.js als APP_URL gebruiken -- als openbaar
     gold. Dat brak niets omdat die toetsen op NODE_ENV=production draaien, maar
     een classificatie die toevallig niet bijt is nog steeds fout. */
  for (const h of ['app.rtg.test', 'iets.invalid', 'x.example', 'db.internal', 'anker.rtg.intern', 'webserver', '',
    'rtg.example.com', 'example.com', 'example.net', 'example.org', 'iets.example.org'])
    assert.equal(adresSoort(h), 'onbekend', h + ' hoort onbekend te zijn, niet openbaar');
  for (const h of ['app.rahultravelgroup.com', 'rtg.nl', 'www.voorbeeld.org'])
    assert.equal(adresSoort(h), 'openbaar', h + ' hoort openbaar te zijn');
  // 172.15 en 172.32 liggen BUITEN het private blok; een te ruime regex zou ze opslokken
  assert.equal(adresSoort('172.15.0.1'), 'openbaar');
  assert.equal(adresSoort('172.32.0.1'), 'openbaar');
});

test('geen APP_URL is onbekend, en een onleesbaar adres ook -- met de reden erbij', () => {
  assert.equal(installatieSoort({}).soort, 'onbekend');
  assert.match(installatieSoort({}).reden, /niet gezet/);
  assert.equal(installatieSoort({ APP_URL: 'zomaar wat' }).soort, 'onbekend');
  assert.match(installatieSoort({ APP_URL: 'zomaar wat' }).reden, /geen leesbaar adres/);
});

/* DE KERN: een harde fout die NIET aan NODE_ENV hangt. Zonder deze rij is de
   nieuwe grendel precies zo onbereikbaar als de oude. */
test('Magnaat Test op een openbaar adres is een HARDE fout, ook zonder NODE_ENV=production', () => {
  const r = valideer({ APP_URL: 'https://app.rahultravelgroup.com', RTG_MAGNAAT_TEST: '1' });
  assert.equal(r.productie, false, 'deze omgeving is juist NIET productie -- dat is het hele punt');
  assert.equal(r.hardeFouten.length, 1, 'de grendel ging niet af: ' + JSON.stringify(r.hardeFouten));
  assert.match(r.hardeFouten[0], /RTG_MAGNAAT_TEST=1/);
  assert.match(r.hardeFouten[0], /app\.rahultravelgroup\.com/);
  // en hij zegt wat er dan openstaat, niet alleen dat het niet mag
  assert.match(r.hardeFouten[0], /pincode die in de broncode staat/);
  assert.match(r.hardeFouten[0], /Zet de vlag uit/);
});

test('de oude demo-vlag valt onder dezelfde grendel', () => {
  const r = valideer({ APP_URL: 'https://rtg.nl', RTG_DEMO: '1' });
  assert.equal(r.hardeFouten.length, 1);
  assert.match(r.hardeFouten[0], /RTG_DEMO=1/);
});

/* DE TEGENPROEF, EN ZONDER HAAR IS DE TOETS HIERBOVEN WAARDELOOS. De
   goedkoopste implementatie van "blokkeer Magnaat Test" is hem overal
   blokkeren, en dan staat de suite groen terwijl geen enkele toets en geen
   enkele lokale start nog werkt. */
test('lokaal en onbekend blijven gewoon draaien -- de grendel breekt het normale werk niet', () => {
  for (const env of [
    { RTG_MAGNAAT_TEST: '1' },                                            // de toetsen zelf
    { APP_URL: 'http://localhost:3000', RTG_MAGNAAT_TEST: '1' },          // lokaal ontwikkelen
    { APP_URL: 'https://rtg.local', RTG_MAGNAAT_TEST: '1' },              // een machine op het eigen net
    { APP_URL: 'https://app.rtg.test', RTG_MAGNAAT_TEST: '1' }            // een gereserveerde naam
  ]) {
    const r = valideer(env);
    assert.equal(r.hardeFouten.length, 0, 'de grendel hield een legitieme start tegen: ' + JSON.stringify(env));
  }
});

test('een openbaar adres zonder demostand wordt niet tegengehouden', () => {
  const r = valideer({ APP_URL: 'https://app.rahultravelgroup.com' });
  assert.equal(r.hardeFouten.length, 0);
});

/* ZWIJGEN IS DE DERDE FAALVORM. Staat de vlag aan terwijl het adres onbekend
   is, dan mag er niet geblokkeerd worden -- maar stil doorlopen is precies hoe
   deze installatie in deze toestand terecht is gekomen. */
test('Magnaat Test zonder bekend adres blokkeert niet, maar zwijgt ook niet', () => {
  const r = valideer({ RTG_MAGNAAT_TEST: '1' });
  assert.equal(r.hardeFouten.length, 0);
  const m = r.waarschuwingen.filter(w => /Magnaat Test staat aan/.test(w));
  assert.equal(m.length, 1, 'er wordt niets gemeld: ' + JSON.stringify(r.waarschuwingen));
  assert.match(m[0], /NIET vast te stellen/);
});

/* DE SCHADUWRONDE. Een openbare installatie buiten productie komt de
   productiekeuring nooit tegen; die draait hier wel, maar uitsluitend als
   melding. Twee dingen moeten kloppen: de regels worden GEZIEN, en ze
   BLOKKEREN niet. */
test('op een openbaar adres draait de productiekeuring mee als melding, zonder te blokkeren', () => {
  const r = valideer({ APP_URL: 'https://app.rahultravelgroup.com' });
  const schaduw = r.waarschuwingen.filter(w => w.startsWith('SCHADUW'));
  assert.ok(schaduw.length > 1, 'de schaduwronde meldt niets: ' + JSON.stringify(r.waarschuwingen).slice(0, 400));
  // de regels die er het meest toe doen komen langs
  assert.ok(schaduw.some(w => /RTG_VAULT_KEY/.test(w)), 'de kluissleutel wordt niet gemeld');
  assert.ok(schaduw.some(w => /RTG_ENC_KEY/.test(w)), 'versleuteling-at-rest wordt niet gemeld');
  assert.ok(schaduw.some(w => /zouden deze start blokkeren/.test(w)), 'de optelsom ontbreekt');
  assert.equal(r.hardeFouten.length, 0, 'de schaduwronde blokkeert, en dat hoort zij niet te doen');
  assert.equal(r.fouten.length, 0, 'de schaduwronde lekt in de gewone foutenbak');
});

test('in echte productie verandert er niets aan het bestaande gedrag', () => {
  const r = valideer({ NODE_ENV: 'production', APP_URL: 'https://app.rahultravelgroup.com' });
  assert.equal(r.productie, true);
  assert.ok(r.fouten.length > 0, 'de productiekeuring hoort gewoon te draaien');
  assert.equal(r.hardeFouten.length, 0, 'in productie staat de demovlag toch al uit');
  assert.equal(r.waarschuwingen.filter(w => w.startsWith('SCHADUW')).length, 0,
    'de schaduwronde hoort NIET te draaien als de echte keuring al draait -- dat zou alles dubbel melden');
});

/* De private beta leest dezelfde adressoort. Zijn regel is de omgekeerde
   (aantoonbaar lokaal), dus het middengebied hoort daar juist WEL een fout te
   zijn -- precies zoals voor deze wijziging. */
test('de private beta houdt zijn eigen, strengere richting', () => {
  const lokaal = valideer({ NODE_ENV: 'production', RTG_PRIVATE_BETA: '1', APP_URL: 'http://localhost:3000' });
  assert.equal(lokaal.fouten.filter(f => /RTG_PRIVATE_BETA/.test(f)).length, 0);
  for (const url of ['https://app.rahultravelgroup.com', 'https://app.rtg.test', '']) {
    const r = valideer({ NODE_ENV: 'production', RTG_PRIVATE_BETA: '1', APP_URL: url });
    assert.equal(r.fouten.filter(f => /RTG_PRIVATE_BETA/.test(f)).length, 1,
      'private beta liet een niet-aantoonbaar lokaal adres door: ' + JSON.stringify(url));
  }
});

/* ================= DE START ZELF =================

   Alles hierboven toetst valideer(), en dat is een zuivere functie. Of de START
   werkelijk afbreekt loopt via pasToe() en process.exit(1), en dat bewijst geen
   enkele unittoets -- LAT.md regel 17: een poort bewijst alleen zijn eigen
   bereik. Daarom hier twee echte processen. */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

function startPoging(env) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-openbaar-'));
  try {
    const tekst = execFileSync(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000,
      env: { ...process.env, RTG_DATA_DIR: map, PORT: '0', NODE_ENV: '', DATABASE_URL: '', ...env }
    });
    return { code: 0, tekst };
  } catch (e) {
    return { code: e.status == null ? 1 : e.status, tekst: String(e.stdout || '') + String(e.stderr || '') };
  }
}

test('de server START NIET met Magnaat Test op een openbaar adres', () => {
  const r = startPoging({ APP_URL: 'https://app.rahultravelgroup.com', RTG_MAGNAAT_TEST: '1' });
  assert.equal(r.code, 1, 'de server kwam gewoon op; de grendel doet niets in een echt proces');
  assert.match(r.tekst, /start afgebroken/);
  assert.match(r.tekst, /hangt NIET aan NODE_ENV/);
  assert.match(r.tekst, /app\.rahultravelgroup\.com/);
  /* En de schaduwronde staat er dus ook echt, met de optelsom: dit is wat een
     beheerder te zien krijgt in plaats van niets. */
  assert.match(r.tekst, /SCHADUW: \d+ productieregel\(s\) zouden deze start blokkeren/);
});

test('een lokale Magnaat Test-installatie komt gewoon op', async () => {
  const s = await startServer({ env: { APP_URL: 'http://localhost:3000' } });
  try {
    const r = await fetch(s.base + '/api/health');
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.testomgeving, true, 'de helper draait niet in Magnaat Test; dan bewijst deze rij niets');
  } finally { await stop(s); }
});
