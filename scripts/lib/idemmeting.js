/* ============================================================================
   DE METING ALS CLASSIFICATIEGROND -- en de poort die hem tegenhoudt.

   HET PROBLEEM. Het mutatieboek kende maar EEN grond voor een formele status:
   de verklaring in server/lib/idemsleutels.js. Alles zonder verklaring viel in
   NOG_NIET_GECLASSIFICEERD, en dat waren er 3604 van de 4661. Dat getal leest
   als "over 3604 mutaties is niet nagedacht", en dat was niet waar: van diezelfde
   routes is er wel degelijk gemeten wat er gebeurt. IDEMPROEF.json draagt per
   route de uitslag van drie echte oproepen tegen een wegwerpserver.

   Nagemeten op 30 augustus 2026, over precies die 3604:

     1016  de server merkte de herhaling ZELF (herhaald: true op de tweede
           oproep, terwijl een verse sleutel wel verschilde)
     2488  de eerste oproep kwam de deur niet door (404, 403, 400, 409, 401,
           402, 422) -- er is geen geldige invoer opgebouwd, dus er valt niets
           te herhalen
       61  503: de dienst staat in deze opstelling uit
       39  overig ongemeten

   Dat is geen classificatiegat maar drie verschillende dingen, en ze vragen
   drie verschillende reparaties. De grootste bak is de FIXTURE-bak, en die had
   de eigenaar zelf al aangewezen.

   WAAROM DIT NIET GEWOON EEN REQUIRE IS. Een register kan achterlopen, en een
   verouderd register ziet er identiek uit aan een vers (scripts/lib/stempel.js).
   Een meting van een oudere commit als classificatiegrond gebruiken is precies
   de schijnzekerheid die dit boek moet voorkomen: dan staat er "geclassificeerd"
   op grond van een route die sindsdien is veranderd of verdwenen.

   Daarom is er een POORT, en die is fail-closed: is IDEMPROEF.json van een
   andere commit dan HEAD, of gemeten met ongecommit werk in de boom, of draagt
   hij geen stempel, dan levert deze module GEEN enkele classificatie -- niet een
   deel, en niet met een waarschuwing erbij. De reden komt mee terug, zodat het
   boek kan zeggen waarom het niets van de meting gebruikt in plaats van stil
   3604 te melden.

   DE GRENS DIE BLIJFT GELDEN. Een gemeten BESCHERMD is geen verklaarde
   BESCHERMD. De meting zegt: met DEZE invoer, in DEZE opstelling, merkte de
   server de herhaling. Ze zegt niet wat "hetzelfde verzoek" hier betekent -- dat
   is een besluit en geen waarneming. Het mutatieboek houdt die twee daarom uit
   elkaar met een bewijsgraad, en `metBesluitOverDuplicaat` telt alleen de
   verklaarde. Wie dat samenvouwt, maakt van 1016 waarnemingen 1016 besluiten. */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..', '..');

function git(args) {
  try {
    return execFileSync('git', args, { cwd: WORTEL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (e) { return ''; }
}

/* WELKE STATUS HOORT BIJ WELKE WAARNEMING.

   De statussen zijn die van het mutatieboek; hier staat alleen wat een
   waarneming erover zegt. Elke regel noemt de reden, want een status zonder
   reden is niet na te lopen. */
function statusUitUitslag(r) {
  const reden = String(r.reden || '');
  if (r.idempotentie === 'beschermd') {
    return { status: 'BESCHERMD', waarom: 'gemeten: ' + reden };
  }
  if (r.idempotentie === 'onbeschermd') {
    /* Met opzet GEEN status. "De herhaling deed het opnieuw" kan een defect zijn
       of precies de bedoeling (een betaalopdracht, een bericht). Dat verschil is
       een besluit en geen waarneming; deze module maakt er dus niets van, en de
       route blijft NOG_NIET_GECLASSIFICEERD tot een mens hem verklaart. */
    return null;
  }
  const code = Array.isArray(r.statussen) ? r.statussen[0] : 0;
  if (!/deed geen werk/.test(reden)) return null;
  if (code === 503) {
    return { status: 'NIET_BEPROEFBAAR',
      waarom: 'gemeten: de eerste oproep gaf 503 -- de dienst staat in deze opstelling uit' };
  }
  if ([400, 401, 402, 403, 404, 409, 422].includes(code)) {
    return { status: 'WACHT_OP_FIXTURE',
      waarom: 'gemeten: de eerste oproep gaf ' + code + ' -- er is geen geldige invoer of geen bestaand object om aan te roepen' };
  }
  return null;
}

/* Levert { klaar, reden, perRoute } -- perRoute is leeg zodra de poort dicht is. */
function meting(bestand) {
  const pad = path.join(WORTEL, bestand || 'IDEMPROEF.json');
  let j = null;
  try { j = JSON.parse(fs.readFileSync(pad, 'utf8')); } catch (e) {
    return { klaar: false, reden: 'IDEMPROEF.json is niet te lezen', perRoute: {} };
  }
  const st = j && j.stempel;
  if (!st || !st.commit) {
    return { klaar: false, reden: 'de meting draagt geen stempel; de ouderdom is niet vast te stellen', perRoute: {} };
  }
  if (st.boomVuil) {
    return { klaar: false, gemetenOp: st.op,
      reden: 'de meting is gemaakt met ongecommit werk in de boom (commit ' + st.commit +
             '); zij hoort bij een stand die nergens is vastgelegd', perRoute: {} };
  }
  const head = git(['rev-parse', '--short', 'HEAD']);
  if (!head) {
    return { klaar: false, reden: 'HEAD is niet te bepalen, dus de meting is niet te ijken', perRoute: {} };
  }
  if (head !== st.commit) {
    return { klaar: false, gemetenOp: st.op,
      reden: 'de meting is van commit ' + st.commit + ' en HEAD staat op ' + head +
             '; een meting van een andere stand is geen grond voor een status', perRoute: {} };
  }
  const perRoute = {};
  for (const r of (j.perRoute || [])) {
    const uit = statusUitUitslag(r);
    if (uit) perRoute[r.methode.toUpperCase() + ' ' + r.pad] = uit;
  }
  return { klaar: true, gemetenOp: st.op, commit: st.commit,
    reden: 'gemeten op commit ' + st.commit + ', schone boom', perRoute };
}

module.exports = { meting, statusUitUitslag };
