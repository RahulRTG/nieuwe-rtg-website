/* DRAAGT ELK SCHERM DE FOUTMELDER? -- van voornemen naar machine.

   STANDAARD.md par. 0c zet vijf eisen in de tabel met "geen handhaver" erachter,
   en dit is er een van: *een scherm draagt de foutmelder (par. 4.1)*. Een eis
   zonder handhaver is een voornemen, en dat document zegt zelf dat het
   verschuiven van die verhouding zijn eigen voortgangsmaat is. Hier schuift er
   een.

   WAT ER AL WAAR WAS, EN WAAROM DAT NIET GENOEG IS. De foutmelder wordt niet per
   scherm ingeladen maar door de voordeur ingespoten: server/middleware/
   voordeur.js leest elk .html-bestand onder public/ en haalt het door
   kopinjectie.js. In de praktijk droeg dus elk scherm hem al -- precies EEN
   scherm (apps/app.html) noemt hem zelf, en de injectie slaat dat er niet
   nogmaals bovenop.

   Dat is een goede constructie en juist daarom een gevaarlijke: hij is op EEN
   plek uit te zetten. Wie morgen een scherm langs een eigen route serveert, of
   de volgorde in kopinjecties() verzet, haalt de foutmelder van 292 schermen af
   zonder dat er iets rood wordt. Een gebrek dat op een dag ontstaat en pas
   maanden later opvalt als "we hebben geen clientfouten meer gezien" -- de
   stilste storing die er is.

   WAAROM DIT MEET WAT DE SERVER VERSTUURT EN NIET WAT ER OP SCHIJF STAAT. De
   bewering gaat over wat een browser krijgt. Een scan over de bestanden zou
   precies een treffer geven (app.html) en de andere 291 ten onrechte rood
   noemen, of -- erger -- na een reparatie van die scan groen staan op iets dat
   nooit is opgehaald. Dus: server starten, elk scherm ophalen, kijken wat er
   binnenkomt.

   WAT DEZE TOETS NIET DOET. Hij controleert niet of de foutmelder ook WERKT --
   dat doet test/foutmelder.test.js. Hier gaat het alleen over de vraag of hij
   bij elk scherm aan boord is.

   Draai los: node --test test/foutmelder-dekking.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const WORTEL = path.join(__dirname, '..');
const PUBLIEK = path.join(WORTEL, 'public');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-foutmelder-'));

/* De schermen: elk .html-bestand onder public/, als PAD zoals een browser hem
   vraagt. Afgeleid uit de boom en niet uit een lijst -- een lijst veroudert, en
   dan bewaakt deze toets de schermen die er vorig jaar waren. */
function schermen(map = PUBLIEK, uit = []) {
  for (const naam of fs.readdirSync(map)) {
    const vol = path.join(map, naam);
    const st = fs.statSync(vol);
    if (st.isDirectory()) schermen(vol, uit);
    else if (naam.endsWith('.html')) uit.push('/' + path.relative(PUBLIEK, vol).split(path.sep).join('/'));
  }
  return uit;
}

let srv, base;

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('elk scherm dat de server verstuurt draagt de foutmelder', async () => {
  const lijst = schermen();
  assert.ok(lijst.length > 250,
    'er horen honderden schermen te zijn; ' + lijst.length + ' is te weinig om iets te bewijzen ' +
    '-- dan zoekt deze toets op de verkeerde plek en zou hij groen staan zonder iets te meten');

  const zonder = [], onbereikbaar = [];
  for (const pad of lijst) {
    let r;
    try { r = await fetch(base + pad); }
    catch (e) { onbereikbaar.push(pad + ' -- ' + String((e && e.message) || e).slice(0, 80)); continue; }
    if (r.status !== 200) { onbereikbaar.push(pad + ' -- HTTP ' + r.status); continue; }
    const html = await r.text();
    if (!/src="[^"]*\/shared\/foutmelder\.js/.test(html)) zonder.push(pad);
  }

  /* NIET OPGEHAALD IS GEEN UITSPRAAK OVER HET SCHERM. Zelfde regel als in
     TIKKEN.md: wat niet gemeten is, mag nooit als "in orde" langskomen -- en
     ook niet als "fout". Het staat apart, met de reden erbij. */
  assert.deepEqual(onbereikbaar, [],
    'deze schermen zijn niet opgehaald, dus er is niets over te zeggen:\n  ' + onbereikbaar.join('\n  '));

  assert.deepEqual(zonder, [],
    zonder.length + ' scherm(en) komen zonder foutmelder bij de browser aan. Een clientfout op zo\'n ' +
    'scherm bereikt niemand, en dat merk je pas maanden later als "we zien geen fouten meer".\n  ' +
    zonder.join('\n  '));
});

/* DE INJECTIE STAAT OP EEN PLEK, EN DAT HOORT ZO TE BLIJVEN.

   De toets hierboven meet de uitkomst; deze bewaakt de vorm. Zou iemand de
   foutmelder in de schermen zelf gaan zetten, dan blijft de meting groen terwijl
   de garantie verdwijnt: 292 losse tags lopen uiteen, een injectie niet. */
test('de foutmelder wordt op EEN plek ingespoten', () => {
  const bronnen = [];
  const zoek = (map) => {
    for (const naam of fs.readdirSync(map)) {
      const vol = path.join(map, naam);
      if (fs.statSync(vol).isDirectory()) { zoek(vol); continue; }
      if (!naam.endsWith('.js')) continue;
      const s = fs.readFileSync(vol, 'utf8');
      if (/['"]<script src="\/shared\/foutmelder\.js|\/shared\/foutmelder\.js" nonce=/.test(s))
        bronnen.push(path.relative(WORTEL, vol));
    }
  };
  zoek(path.join(WORTEL, 'server'));
  assert.deepEqual(bronnen, ['server/middleware/kopinjectie.js'],
    'de foutmelder hoort door precies een plek te worden ingespoten; gevonden: ' + bronnen.join(', '));
});
