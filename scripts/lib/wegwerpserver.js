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

async function wachtTotOp(basis, msMax, pad) {
  const eind = Date.now() + (msMax || 60000);
  const weg = pad || '/api/health';
  while (Date.now() < eind) {
    try {
      const r = await fetch(basis + weg);
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
  /* Een VASTE poort als de aanroeper er een noemt: de geheugen-beproevingen
     controleren vooraf of de poort vrij is (een achtergebleven server is daar
     een echte fout, geen ruis) en willen hem dus zelf kiezen. Anders een vrije.
     `poortWacht`: een instrument dat een bezette poort als fout ziet, geeft die
     wens door en dan proberen we niet stil uit te wijken. */
  const poort = o.poort || await vrijePoort();
  /* Een eigen datamap tenzij de aanroeper er een meegeeft: de ketenronde
     herstart bewust op DEZELFDE map (knoeien met het zegel en kijken of de
     herstart het merkt), en dan hoort de map ook niet door klaar() te worden
     opgeruimd -- wie hem aanlevert, ruimt hem op. */
  const eigenMap = !o.datamap;
  const datamap = o.datamap || fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-' + (o.naam || 'wegwerp') + '-'));
  const basis = 'http://127.0.0.1:' + poort;

  /* Extra node-vlaggen VOOR server.js: de geheugen-beproevingen draaien met
     --expose-gc en een gc-hook om de heap te kunnen lezen. `logFd`: een
     bestaande file descriptor waar stdout/stderr heen gaan (de beproeving
     leest daar de GC-regels uit); anders een eigen server.log bij o.log. */
  const nodeArgs = [...(o.nodeArgs || []), path.join(WORTEL, 'server', 'server.js')];
  const uit = o.logFd !== undefined ? o.logFd
    : (o.log ? fs.openSync(path.join(datamap, 'server.log'), 'a') : 'ignore');
  const kind = spawn(process.execPath, nodeArgs, {
    cwd: WORTEL,
    stdio: uit === 'ignore' ? 'ignore' : ['ignore', uit, uit],
    /* DE SCHORSPOORT STAAT UIT OP EEN MEETSERVER, en dat is geen versoepeling
       maar de reparatie van een lus die zichzelf dichttrok.

       server/middleware/schorspoort.js weigert met 503 elke schrijvende aanroep
       op een route die in VERTROUWEN.json `geschorst` heet. Dat is de bedoeling
       -- in PRODUCTIE. Op een MEETserver is het fataal, en wel zo:

         1. een route krijgt een gezakte bewijscel  -> geschorst
         2. de schorspoort geeft 503 op die route
         3. de volgende proefronde kan hem niet meer uitvoeren -> ongemeten
         4. ongemeten wordt nooit meer bewezen
         5. de route blijft voor altijd geschorst

       Het register zegt zelf dat de weg omhoog "een geslaagde hermeting" is --
       en precies die hermeting werd geblokkeerd door de staat die hij moest
       opheffen. Gemeten op 2 september 2026: alle ACHT geschorste routes gaven
       in de verse idemproef `de eerste oproep deed geen werk (status 503)`, en
       het aantal `onbeschermd` in dat register viel van een handvol naar NUL --
       niet omdat er iets gerepareerd was, maar omdat er niets meer te meten
       viel. Een register dat leeg raakt doordat de deur dichtzit, leest als
       vooruitgang.

       Dit raakt alleen wegwerpservers: elk instrument in scripts/ start er een
       met een eigen datamap, en geen daarvan is het huis van een lid. Een
       aanroeper die de poort juist WIL zien, zet hem in `o.env` terug -- die
       gaat hierna en wint dus van deze regel. */
    env: Object.assign({}, process.env, {
      PORT: String(poort), RTG_DATA_DIR: datamap, SMTP_URL: '', STUN_UIT: '1',
      RTG_SCHORSPOORT_UIT: '1'
    }, o.env || {})
  });

  const klaar = () => {
    try { kind.kill('SIGKILL'); } catch (e) {}
    if (eigenMap) { try { fs.rmSync(datamap, { recursive: true, force: true }); } catch (e) {} }
  };
  process.on('exit', klaar);

  /* Sommige instrumenten saboteren de START bewust (ketenronde en
     verraadronde geven een kapot zegel of een verraden seed mee) en willen
     WETEN dat de server stierf in plaats van een uitzondering. Met
     `magSterven: true` komt dat terug als { dood: true }; zonder blijft een
     server die niet opkomt een fout, want dan is de meetopstelling stuk. */
  /* Waarop wachten we tot de server "op" is? De geheugen-beproevingen willen
     READINESS (/api/ready): pas als de duurzame opslag echt geladen is mag de
     test erin, anders meet hij een verouderde snapshot. Standaard health. */
  const gereedPad = o.gereed === 'ready' ? '/api/ready' : '/api/health';
  if (o.magSterven) {
    const eind = Date.now() + (o.wachtMs || 45000);
    while (Date.now() < eind) {
      if (kind.exitCode !== null) return { basis, poort, datamap, kind, klaar, dood: true };
      try { const r = await fetch(basis + gereedPad); if (r.ok) return { basis, poort, datamap, kind, klaar, dood: false }; } catch (e) {}
      await new Promise(r => setTimeout(r, 200));
    }
    klaar();
    throw new Error('de wegwerpserver kwam niet op en stierf ook niet binnen de wachttijd');
  }
  const op = await wachtTotOp(basis, o.wachtMs || 90000, gereedPad);
  if (!op) { klaar(); throw new Error('de wegwerpserver kwam niet op binnen de wachttijd'); }
  return { basis, poort, datamap, kind, klaar, dood: false };
}

module.exports = { start, vrijePoort, wachtTotOp, WORTEL };
