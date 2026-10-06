/* ============================================================================
   DE GEMETEN INVOER EN DE VERSHEID PER REGISTER (ARCHITECTOPDRACHT.md, fase 2)

   Twee functies, en ze horen bij elkaar.

     blok(uitvoer)   wat de generator las, als blok `invoer` voor zijn stempel.
                     Alleen als hij met ./invoerspoor-preload.js is gestart;
                     anders `undefined`, en dan valt het veld uit de JSON en
                     verandert er niets.

     invoerVersheid(stempel)
                     actueel, mogelijk-verouderd of onbekend -- uitgerekend uit
                     het stempel en git, nooit opgeslagen. Er komt dus geen
                     register met versheden bij.

   WAAROM DIT GEEN "WAARSCHIJNLIJK NOG GOED" IS. scripts/versheid.js zegt met
   opzet: verouderd is verouderd, en of het erg is beslist een mens. Dat blijft
   staan, en zijn poort ook. `actueel` hier betekent iets smallers en harders:
   elk bestand dat deze meting las, is sinds de meting byte voor byte gelijk
   gebleven, er kwam in geen opgesomde map iets bij of af, en er was niets wat
   de meting las buiten het zicht van het spoor. Dat is een aantoonbare
   gelijkheid van invoer, geen schatting van gevolgen.

   DRIE STANDEN, en `onbekend` is een eersteklas uitslag:
     actueel             de invoer is aantoonbaar gelijk.
     mogelijk-verouderd  minstens een invoer is veranderd; welke staat erbij.
                         "Mogelijk", want of de uitslag verandert, weet alleen
                         een nieuwe meting.
     onbekend            geen stempel, geen gemeten invoer, ongecommit werk
                         tijdens het meten, een commit die hier niet bestaat,
                         een gezette omgevingsvariabele (die is achteraf niet na
                         te lopen), of een subproces dat buiten het spoor las.

   Het is een AS naast de bewijsgraad en de tegenspraak, en nooit een trede op
   een ladder: een uitspraak kan `bewezen` en `mogelijk-verouderd` tegelijk zijn.
   ========================================================================== */
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');

const WORTEL_STANDAARD = path.join(__dirname, '..', '..');

function blok(uitvoer) {
  const s = global.__rtgInvoerspoor;
  if (!s) return undefined;
  const uit = new Set((uitvoer || []).map((p) => String(p).replace(/\\/g, '/')));
  /* Het meetinstrument zelf is geen invoer: het bepaalt het stempel en niet de
     inhoud. Zonder deze regel maakt elke verbetering aan het spoor alle
     metingen verouderd. */
  uit.add('scripts/lib/invoerspoor-preload.js');
  uit.add('scripts/lib/invoerspoor.js');
  for (const w of s.schrijf) uit.add(w);
  const lees = new Set(s.lees);
  /* Wat via require() is geladen, telt als gelezen: dat is de code van de
     generator zelf en alles wat hij meeneemt, ook als de lader buiten de
     omhulde fs-functies om leest. */
  for (const f of Object.keys(require.cache)) {
    const r = path.relative(s.wortel, f).replace(/\\/g, '/');
    if (r && !r.startsWith('..') && !path.isAbsolute(r)) {
      lees.add(r.startsWith('node_modules/') ? 'package-lock.json' : r);
    }
  }
  const sorteer = (a) => Array.from(a).filter((p) => !uit.has(p)).sort();
  const bestanden = sorteer(lees);
  const bekend = new Set(bestanden);
  /* Of er ongecommit CODE stond terwijl er gemeten werd. Veel generators
     bouwen hun eigen stempel zonder dat veld; zonder deze regel zou een meting
     op ongecommit werk als actueel kunnen doorgaan. */
  let boomVuil = null;
  let gewijzigd = null;
  try {
    const v = require('./stempel').vuileBoom(s.wortel);
    boomVuil = v ? v.code.length > 0 : null;
    /* En ook buiten de code: las de generator een register dat zelf nog niet
       gecommit is, dan hoort zijn invoer niet bij de meetcommit. */
    if (v) gewijzigd = new Set(v.code.concat(v.anders).map((r) => r.slice(r.indexOf(' ') + 1).trim().split(' -> ').pop()));
  } catch (e) { /* onbekend */ }
  return {
    meting: 'invoerspoor',
    versie: 1,
    boomVuil,
    ongecommitteInvoer: gewijzigd ? bestanden.concat(sorteer(s.bestaat)).filter((p) => gewijzigd.has(p)) : null,
    bestanden,
    bestaat: sorteer(s.bestaat).filter((p) => !bekend.has(p)),
    mappen: Array.from(s.mappen.entries()).filter(([p]) => !uit.has(p)).sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([p, recursief]) => (recursief ? { pad: p, recursief: true } : { pad: p })),
    omgevingGekopieerd: !!s.omgevingGekopieerd,
    omgeving: Array.from(s.omgeving.entries()).filter(([, gezet]) => gezet).map(([n]) => n).sort(),
    onwaarneembaar: Array.from(s.onwaarneembaar).sort(),
    nodeHoofdversie: Number(process.versions.node.split('.')[0]),
  };
}

function git(args, wortel) {
  return execFileSync('git', args, { cwd: wortel, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024 });
}

/* De wijzigingen tussen de meetcommit en `tegen` (standaard HEAD), als lijst
   { status, pad }. Een hernoeming levert beide kanten op. */
function wijzigingen(van, tegen, wortel) {
  const uit = git(['diff', '--name-status', '--no-renames', van, tegen || 'HEAD'], wortel);
  return uit.split('\n').filter(Boolean).map((r) => {
    const [status, ...rest] = r.split('\t');
    return { status: status[0], pad: rest.join('\t') };
  });
}

function invoerVersheid(stempel, opties) {
  const o = opties || {};
  const wortel = o.wortel || WORTEL_STANDAARD;
  const onbekend = (reden) => ({ stand: 'onbekend', reden });
  if (!stempel) return onbekend('geen stempel: dit register zegt niet wanneer en waartegen het is gemeten');
  const inv = stempel.invoer;
  if (!inv || inv.meting !== 'invoerspoor') return onbekend('geen gemeten invoer in het stempel; de generator draaide zonder invoerspoor');
  if (!stempel.commit) return onbekend('gemeten zonder commit');
  if (inv.boomVuil == null) return onbekend('niet vast te stellen of er ongecommit werk stond tijdens het meten');
  if (inv.ongecommitteInvoer == null) return onbekend('niet vast te stellen of de invoer gecommit was tijdens het meten');
  if (inv.ongecommitteInvoer.length) {
    return onbekend('de meting las invoer die nog niet gecommit was: ' + inv.ongecommitteInvoer.slice(0, 5).join(', '));
  }
  if (stempel.boomVuil === true || inv.boomVuil === true) return onbekend('gemeten met ongecommit werk in de boom; de invoer hoort bij geen enkele commit');
  if (inv.onwaarneembaar && inv.onwaarneembaar.length) {
    return onbekend('de meting las ook buiten het spoor om: ' + inv.onwaarneembaar.join(', '));
  }
  if (inv.omgevingGekopieerd) return onbekend('de meting kopieerde de hele omgeving; welke variabelen daarin meetelden is niet na te lopen');
  if (inv.omgeving && inv.omgeving.length) {
    return onbekend('de meting las gezette omgevingsvariabelen (' + inv.omgeving.join(', ') + '); die zijn achteraf niet na te lopen');
  }
  let lijst;
  try { lijst = wijzigingen(stempel.commit, o.tegen, wortel); }
  catch (e) { return onbekend('meetcommit ' + stempel.commit + ' is hier niet te vergelijken (bestaat hij hier?)'); }

  const bestanden = new Set(inv.bestanden || []);
  const bestaat = new Set(inv.bestaat || []);
  const geraakt = [];
  for (const w of lijst) {
    if (bestanden.has(w.pad)) { geraakt.push(w.pad); continue; }
    if (w.status === 'M') continue;      // alleen inhoud veranderd: raakt geen bestaansvraag of maplijst
    if (bestaat.has(w.pad)) { geraakt.push(w.pad + ' (bestaat)'); continue; }
    const map = path.posix.dirname(w.pad);
    const m = (inv.mappen || []).find((x) => x.pad === map ||
      (x.recursief && (x.pad === '' || w.pad.startsWith(x.pad + '/'))));
    if (m) geraakt.push(w.pad + ' (in opgesomde map ' + m.pad + ')');
  }
  const nuNode = Number(process.versions.node.split('.')[0]);
  if (inv.nodeHoofdversie && inv.nodeHoofdversie !== nuNode) {
    geraakt.push('Node ' + inv.nodeHoofdversie + ' -> ' + nuNode);
  }
  if (geraakt.length) {
    return { stand: 'mogelijk-verouderd', reden: geraakt.length + ' invoer(en) veranderd sinds ' + stempel.commit, geraakt };
  }
  return { stand: 'actueel', reden: 'alle ' + bestanden.size + ' gelezen bestanden, ' + bestaat.size +
    ' bestaansvragen en ' + (inv.mappen || []).length + ' opgesomde mappen zijn gelijk sinds ' + stempel.commit };
}

module.exports = { blok, invoerVersheid, wijzigingen };
