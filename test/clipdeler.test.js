/* DE CLIPDELER STAAT ÉÉN KEER.

   Korte video's staan alleen op het toestel van de maker en reizen
   rechtstreeks (WebRTC-datakanaal). Sinds de Media OS dezelfde clips in de
   stand FLOW toont, zijn er TWEE schermen die ze afspelen. Precies daar begint
   de fout die LAT.md regel 4 beschrijft: een tweede exemplaar van dit protocol
   houdt een tweede waarheid vast over de knip, de ondertitels, de cache en het
   uitdienen, en die lopen uiteen zonder dat iets klaagt.

   Deze toets bewaakt dat er één laag is. Hij kijkt naar de BRON en niet naar
   gedrag -- het echte P2P-verkeer vraagt twee browsers met elk een eigen
   toestelopslag, en dat is een e2e-vraag. Wat hij wel kan: aanwijzen dat er
   ergens een tweede RTCPeerConnection of een tweede OPFS-schrijver opduikt.

   Draai los: node --experimental-sqlite --test test/clipdeler.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const lees = (p) => fs.readFileSync(path.join(WORTEL, p), 'utf8');
const DELER = 'public/shared/clipdeler.js';
// de twee schermen die clips afspelen; wie er een derde bijbouwt, hoort hier te landen
const SCHERMEN = ['public/apps/clips.html', 'public/apps/media.html'];

test('1. de deler is geldige JS en levert RTGClipDeler', () => {
  const bron = lees(DELER);
  assert.doesNotThrow(() => new Function(bron), 'de deler ontleedt');
  assert.match(bron, /w\.RTGClipDeler = \{ start: start \};/, 'en hangt zichzelf op');
  // beide kanten horen erin te zitten: kijken EN uitdienen
  assert.match(bron, /function dienUit/, 'de deler dient ook uit');
  assert.match(bron, /function kijkOntvang/, 'en ontvangt');
  assert.match(bron, /aanwezig/, 'en klopt de aanwezigheid van de maker aan');
});

test('2. elk scherm dat clips speelt, laadt de deler', () => {
  for (const p of SCHERMEN) {
    assert.ok(lees(p).includes('/shared/clipdeler.js'), p + ' laadt de gedeelde clipdeler');
  }
});

test('3. geen tweede exemplaar van het protocol buiten de deler', () => {
  /* Een pagina die zelf een RTCPeerConnection opzet voor clips, of zelf naar
     OPFS schrijft, heeft het protocol gekopieerd. Podium en Theater hebben hun
     eigen P2P (live-relay, Thuisarchief) en staan daar met reden buiten: dat
     zijn andere stromen met andere regels, geen kopie van deze. */
  const eigenP2P = ['public/apps/podium.html', 'public/apps/theater.html'];
  const alles = [];
  (function loop(map) {
    for (const naam of fs.readdirSync(path.join(WORTEL, map))) {
      const rel = map + '/' + naam;
      if (fs.statSync(path.join(WORTEL, rel)).isDirectory()) { loop(rel); continue; }
      if (/\.(html|js)$/.test(naam)) alles.push(rel);
    }
  })('public/apps');

  /* De maatstaf is scherp gehouden: alleen een bestand dat de CLIPS-API
     aanspreekt EN zelf een verbinding of een toestelarchief opzet, heeft het
     protocol gekopieerd. Een eerdere versie zocht op het woord "clip" plus een
     RTCPeerConnection en wees app-main.js aan -- dat noemt Clips alleen als
     tegel en belt over een heel andere lijn. Een meter die dat soort dingen
     aanwijst wordt binnen een week weggeklikt (LAT.md regel 10). */
  const raaktClips = (bron) => /['"]\/api\/clips\/|api\('signaal'/.test(bron);
  const fout = [];
  for (const p of alles) {
    if (eigenP2P.includes(p)) continue;
    const bron = lees(p);
    if (!raaktClips(bron)) continue;
    if (/getDirectory\(\)/.test(bron)) fout.push(p + ': schrijft zelf naar het toestelarchief');
    if (/new RTCPeerConnection/.test(bron)) fout.push(p + ': zet zelf een verbinding op voor clips');
  }
  assert.deepEqual(fout, [], 'het clipprotocol staat alleen in ' + DELER);
});

test('4. de deler zelf raakt geen enkele knop van een pagina aan', () => {
  /* Een gedeelde laag die #knopjes uit clips.html kent, is geen laag maar een
     halve pagina: dan werkt hij in het ene scherm en stil niet in het andere.
     Hij krijgt een VLAK mee en zoekt daarbinnen; verder praat hij alleen via
     de meegegeven opStatus. */
  const bron = lees(DELER);
  assert.ok(!/getElementById|querySelector\('#/.test(bron), 'geen id uit een pagina in de gedeelde laag');
  assert.match(bron, /vlak\.querySelector\('video'\)/, 'hij zoekt binnen het vlak dat hij meekrijgt');
});
