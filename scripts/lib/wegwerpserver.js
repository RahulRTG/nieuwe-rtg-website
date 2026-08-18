/* ============================================================================
   EEN WEGWERPSERVER: EIGEN POORT, EIGEN DATAMAP, DAARNA WEG.

   Elk instrument dat de server van BUITENAF beproeft heeft er een nodig, en tot
   nu toe schreef elk instrument hem zelf: rolproef-route, invoerproef-route,
   idemproef-route, staatproef-route, ketenronde, beproeving, ladder, tot-crash
   en verraadronde hebben alle negen dezelfde twintig regels. Dat is precies de
   dubbele-waarheid-vorm waar LAT.md regel 4 over gaat: verandert er iets aan hoe
   je hier een server start (een vlag erbij, een langere wachttijd), dan verandert
   dat op negen plekken of -- waarschijnlijker -- op een.

   WAAROM DE EIGEN DATAMAP NIET ONDERHANDELBAAR IS. Zonder RTG_DATA_DIR draait
   een instrument op de ECHTE database. De rolproef stuurt plausibele
   schrijfverzoeken naar duizenden routes; de staatproef vergelijkt momentopnames.
   Dat op de ontwikkeldata loslaten is geen meting maar een ongeluk.

   Dit bestand is NIEUW en de negen bestaande kopieen zijn (nog) niet omgezet.
   Dat is bewuste schuld en geen slordigheid: negen instrumenten tegelijk
   verbouwen terwijl ze de registers vullen waar dit huis op leunt, is precies
   het soort verandering dat je niet in een keer moet doen. Wat hier telt is dat
   er geen TIENDE kopie bij komt.
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const WORTEL = path.join(__dirname, '..', '..');

function vrijePoort() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.unref(); s.on('error', rej);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
  });
}

async function wachtTotOp(basis, msMax) {
  const eind = Date.now() + (msMax || 60000);
  while (Date.now() < eind) {
    try {
      const r = await fetch(basis + '/api/health');
      if (r.ok) return true;
    } catch (e) { /* nog niet op */ }
    await new Promise(r => setTimeout(r, 250));
  }
  return false;
}

/* Start er een en geef terug hoe je hem bereikt en hoe je hem opruimt. De
   opruiming hangt OOK aan process.on('exit') -- een instrument dat halverwege
   afbreekt hoort geen server en geen datamap achter te laten. */
async function start(opties) {
  const o = opties || {};
  const poort = await vrijePoort();
  const datamap = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-' + (o.naam || 'wegwerp') + '-'));
  const basis = 'http://127.0.0.1:' + poort;

  const kind = spawn(process.execPath, ['--experimental-sqlite', path.join(WORTEL, 'server', 'server.js')], {
    cwd: WORTEL,
    stdio: o.log ? ['ignore', fs.openSync(path.join(datamap, 'server.log'), 'a'), fs.openSync(path.join(datamap, 'server.log'), 'a')] : 'ignore',
    env: Object.assign({}, process.env, {
      PORT: String(poort), RTG_DATA_DIR: datamap, SMTP_URL: '', STUN_UIT: '1'
    }, o.env || {})
  });

  const klaar = () => {
    try { kind.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(datamap, { recursive: true, force: true }); } catch (e) {}
  };
  process.on('exit', klaar);

  const op = await wachtTotOp(basis, o.wachtMs || 90000);
  if (!op) { klaar(); throw new Error('de wegwerpserver kwam niet op binnen de wachttijd'); }
  return { basis, poort, datamap, kind, klaar };
}

module.exports = { start, vrijePoort, wachtTotOp, WORTEL };
