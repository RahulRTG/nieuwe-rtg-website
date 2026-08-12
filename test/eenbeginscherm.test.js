/* ER ZIJN GEEN TWEE BEGINSCHERMEN -- EN DAT WAS NERGENS GETOETST.

   Wet RTG-032. Er lagen er ooit twee naast elkaar: /apps/app.html met het
   springboard, en /apps/index.html als scrollende pagina met een eigen kopbalk
   en tegels die apps in een iframe erbovenop openden. Twee beginschermen is er
   een te veel: je weet nooit welke "thuis" is. Alle paden komen nu op dezelfde
   plek uit, via een interne herschrijving in server/middleware/voordeur.js.

   WAAROM DEZE TOETS ER PAS NU IS. De sabotagemotor haalde de herschrijving van
   /apps/index.html weg en er werd NIETS rood. test/beginscherm.test.js bleek
   over iets anders te gaan -- de acht werelden op de bezel, de tegels, de
   wereldbundel -- en niet over de vraag welke URL's thuis uitkomen. De wet wees
   dus naar een toets die zijn onderwerp niet raakte, en dat viel pas op toen de
   handhaver echt uit ging.

   Wat hier bewaakt wordt: alle vier de paden ( /, /apps/, /apps/index.html,
   /apps/bureau.html ) leveren DEZELFDE pagina als /apps/app.html. Niet een
   omleiding maar dezelfde inhoud, want de voordeur herschrijft intern -- er zit
   met opzet geen 302 tussen, zodat de nonce-laag er gewoon overheen gaat.

   Gemuteerd en zien zakken: de herschrijving van /apps/index.html weghalen
   (toets 1 rood), en de bureau-URL weghalen (toets 1 rood).
   Draai los: node --experimental-sqlite --test test/eenbeginscherm.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-eenbeginscherm-'));

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }); base = srv.base; });
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* De pagina zonder de nonce: die is per verzoek anders, en we vergelijken
   inhoud en geen toeval. Alles wat een nonce draagt strippen we eruit. */
async function pagina(pad) {
  const r = await fetch(base + pad, { redirect: 'manual' });
  const tekst = await r.text();
  return { status: r.status, kaal: tekst.replace(/nonce="[^"]*"/g, 'nonce=""') };
}

test('alle thuis-paden leveren exact dezelfde pagina als /apps/app.html', async () => {
  const thuis = await pagina('/apps/app.html');
  assert.equal(thuis.status, 200, '/apps/app.html hoort gewoon te laden');
  assert.ok(thuis.kaal.length > 500, 'en het is een echte pagina, geen foutregel');

  for (const pad of ['/', '/apps/', '/apps/index.html', '/apps/bureau.html']) {
    const p = await pagina(pad);
    assert.equal(p.status, 200,
      pad + ' hoort de homescreen te leveren, niet om te leiden of te falen (kreeg ' + p.status + ')');
    assert.equal(p.kaal, thuis.kaal,
      pad + ' levert ANDERE inhoud dan /apps/app.html -- dan is er een tweede beginscherm, ' +
      'en dan weet niemand meer welke "thuis" is');
  }
});

test('het is een interne herschrijving en geen omleiding', async () => {
  /* Bewust geen 302: dan zou de nonce-laag eroverheen worden overgeslagen en
     viel juist de meest bezochte pagina terug op de zwakkere CSP. Zie de kop van
     server/middleware/voordeur.js -- dat is daar echt gebeurd. */
  for (const pad of ['/', '/apps/index.html']) {
    const r = await fetch(base + pad, { redirect: 'manual' });
    assert.ok(r.status < 300 || r.status >= 400,
      pad + ' geeft een omleiding (' + r.status + '); dat hoort een interne herschrijving te zijn');
  }
});
