'use strict';
/* ============================================================================
   DE WERKSTROMEN, ONTLEED -- welke poorten draait de keten, en zijn die hier
   te draaien?

   HET GAT DAT DIT VULT. De keten draait op GitHub tientallen poorten die
   niemand lokaal draait: de deltapoort, het verval, het wettenregister, de
   overleving, het gezag, de envelop, de ladder, de rolronde, de gluurronde.
   Lokaal draait een mens `npm test` en `npm run check`, en de rest ziet hij
   pas als het vinkje rood is -- twintig minuten later, op een machine waar hij
   niet bij kan. Erger: een poort die er in de keten BIJ komt, komt lokaal
   nooit vanzelf mee. De twee lijsten lopen uit elkaar zonder dat iemand het
   merkt, en dat is precies de vorm van fout waar dit huis meters voor bouwt.

   DE AFLEIDING IS HET HELE PUNT. Er komt hier dus GEEN tweede lijst poorten
   naast .github/workflows/ te staan -- die zou binnen een maand achterlopen,
   en dan bewaakt hij niets meer. De lijst wordt GELEZEN uit de werkstromen
   zelf. Een stap die morgen aan ci.yml wordt toegevoegd, staat morgen in de
   lokale ronde, zonder dat iemand iets bijwerkt.

   WAT EEN POORT IS EN WAT NIET. De keten doet twee soorten dingen: hij richt
   een machine in (`npm ci`, apt-get, een map maken) en hij TOETST. Alleen dat
   tweede is een poort. De herkenning is met opzet FAIL-CLOSED: wat de
   inrichtingslijst niet kent, heet `onbekend` en wordt gemeld -- nooit stil
   overgeslagen. Een stap die deze module niet begrijpt, hoort een mens te
   verontrusten en niet stil uit de lokale ronde te verdwijnen.

   WAT DEZE MODULE NIET DOET. Hij speelt de keten niet na. Hij verdeelt niet
   over vier scherven, hij zet geen postgres neer en hij haalt geen artefact
   uit een andere job. Waar dat nodig is, zegt de poort dat van zichzelf
   (`lokaal: false` met een reden) in plaats van een uitslag te verzinnen. Een
   poort die hier niet kon draaien is `NIET GEDRAAID` en nooit `staat`.
   ========================================================================== */

const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..', '..');
const MAP = path.join(WORTEL, '.github', 'workflows');

/* ==========================================================================
   1) DE ONTLEDER -- de deelverzameling YAML die in deze bestanden staat.

   Geen dependency: dit huis installeert niets buiten de lockfile om, en een
   YAML-parser erbij halen om de eigen keten te kunnen lezen is een dure manier
   om een klein probleem op te lossen. Wat hier staat is blok-YAML: afbeeldingen,
   reeksen, blokschalen (`|`, `>`) en de enkele vloeireeks (`[ main, master ]`).
   Wat er NIET in staat -- ankers, meerdere documenten, escapes in strings --
   wordt ook niet ondersteund, en dat is een keuze die je hier moet lezen en
   niet ergens moet ontdekken.
   ========================================================================== */

/* Commentaar strippen buiten aanhalingstekens. `uses: actions/checkout@<sha> # v7`
   moet de sha overhouden; `--health-cmd "pg_isready -U postgres"` mag niet
   halverwege worden afgekapt. */
function zonderCommentaar(regel) {
  const s = String(regel);
  let aanhaling = null;
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (aanhaling) { if (c === aanhaling) aanhaling = null; continue; }
    if (c === '"' || c === "'") { aanhaling = c; continue; }
    if (c === '#' && (k === 0 || /\s/.test(s[k - 1]))) return s.slice(0, k);
  }
  return s;
}

function ontleed(tekst) {
  const R = String(tekst).split(/\r?\n/);
  let i = 0;

  const leeg = r => !zonderCommentaar(r).trim();
  const diepte = r => r.length - r.trimStart().length;
  const eerste = vanaf => { for (let j = vanaf; j < R.length; j++) if (!leeg(R[j])) return j; return -1; };

  function schaal(ruw) {
    let s = String(ruw).trim();
    if (!s) return '';
    if (s[0] === '"' || s[0] === "'") {
      const q = s[0];
      const eind = s.indexOf(q, 1);
      return eind > 0 ? s.slice(1, eind) : s.slice(1);
    }
    if (s[0] === '[') {
      return s.replace(/^\[|\]$/g, '').split(',').map(d => schaal(d)).filter(d => d !== '');
    }
    return s;
  }

  /* Een blokschaal (`|`, `>`, met of zonder chomp-teken) loopt door zolang de
     inspringing groter is dan die van de sleutel. De regels komen VERBATIM
     terug: in een `run:` staat shell, en daar is een `#` geen YAML-commentaar. */
  function blokschaal(diep) {
    const uit = [];
    let basis = null;
    while (i < R.length) {
      const r = R[i];
      if (!r.trim()) { uit.push(''); i++; continue; }
      const d = diepte(r);
      if (d <= diep) break;
      if (basis === null) basis = d;
      uit.push(r.slice(Math.min(basis, d)));
      i++;
    }
    while (uit.length && !uit[uit.length - 1].trim()) uit.pop();
    return uit.join('\n');
  }

  function merk(obj, nr) { Object.defineProperty(obj, '__regel', { value: nr, enumerable: false }); return obj; }

  function waarde(minimaal) {
    const j = eerste(i);
    if (j < 0) return null;
    const d = diepte(R[j]);
    if (d < minimaal) return null;
    i = j;
    return /^\s*-(\s|$)/.test(zonderCommentaar(R[j])) ? reeks(d) : afbeelding(d);
  }

  function afbeelding(diep) {
    const obj = merk({}, eerste(i) + 1);
    while (i < R.length) {
      if (leeg(R[i])) { i++; continue; }
      const d = diepte(R[i]);
      if (d < diep) break;
      const regel = zonderCommentaar(R[i]);
      const m = /^\s*([^:#\s][^:]*):(?:\s+(.*?))?\s*$/.exec(regel);
      if (!m || d !== diep) break;
      const sleutel = m[1].trim().replace(/^['"]|['"]$/g, '');
      const rest = (m[2] || '').trim();
      const nr = i + 1;
      i++;
      if (/^[|>][-+]?\d*$/.test(rest)) { obj[sleutel] = blokschaal(diep); }
      else if (rest === '') {
        const genest = waarde(diep + 1);
        obj[sleutel] = genest === null ? null : genest;
      } else obj[sleutel] = schaal(rest);
      if (obj[sleutel] && typeof obj[sleutel] === 'object' && !Array.isArray(obj[sleutel]) && !obj[sleutel].__regel)
        merk(obj[sleutel], nr);
    }
    return obj;
  }

  function reeks(diep) {
    const uit = [];
    while (i < R.length) {
      if (leeg(R[i])) { i++; continue; }
      const d = diepte(R[i]);
      if (d !== diep) break;
      const m = /^(\s*)-(?:\s+(.*?))?\s*$/.exec(zonderCommentaar(R[i]));
      if (!m) break;
      const rest = (m[2] || '').trim();
      const nr = i + 1;
      if (!rest) { i++; uit.push(waarde(diep + 1)); continue; }
      /* Een afbeelding waarvan de eerste sleutel op de streepjesregel staat.
         Het streepje wordt door spaties vervangen, zodat de sleutel gewoon op
         zijn eigen kolom staat en de afbeelding daar begint. */
      if (/^[^:\s][^:]*:(\s|$)/.test(rest)) {
        const kolom = R[i].length - R[i].slice(m[1].length + 1).trimStart().length;
        R[i] = ' '.repeat(kolom) + R[i].slice(kolom);
        uit.push(merk(afbeelding(kolom), nr));
        continue;
      }
      i++;
      uit.push(schaal(rest));
    }
    return uit;
  }

  const doc = waarde(0);
  return doc === null ? {} : doc;
}

/* ==========================================================================
   2) WAT IS EEN POORT, EN WAT IS INRICHTING?

   De keten doet twee dingen: een machine klaarzetten en toetsen. Alleen dat
   tweede hoort lokaal na te draaien. De lijst hieronder beschrijft de SHELL --
   installeren, mappen maken, variabelen zetten, stroom sturen -- en niet onze
   eigen poorten. Dat is met opzet: wie er een toets bij zet, hoeft hier niets
   te melden, en wie hier iets vergeet krijgt `onbekend` te zien in plaats van
   stilte.
   ========================================================================== */
const INRICHTING = [
  /^npm\s+ci\b/,
  /^npm\s+(?:i|install|add)\b/,
  /^(?:yarn|pnpm)\s+(?:i|install|add)\b/,
  /^npx\s+playwright\s+install\b/,
  /^sudo\b/, /^apt-get\b/,
  /^docker\s+(?:login|build|push|pull|tag|save|inspect|rm|run|compose|info)\b/,
  /^gh\s/,
  /^git\s+(?:config|add|commit|push|fetch|checkout|switch|remote|tag|rev-parse)\b/,
  /^(?:set|export|exit|echo|printf|cat|mkdir|mv|cp|rm|ls|find|touch|tee|shopt|sleep|test|true|false|source|\.|:)\b/,
  /^(?:if|then|else|elif|fi|for|do|done|while|case|esac|function)\b/,
  /^[A-Za-z_][A-Za-z0-9_]*=/,
  /^[{}()]/,
  /^\|\|/,
  /^:(?:\s|$)/,
  /^\[/,
  /^[A-Za-z0-9_:*?.\[\]-]*\)\s/,
  /^node\s+(?:-e|--eval)\b/,
];

/* TWEE EIGEN SCRIPTS DIE GEEN POORT ZIJN, en ze staan hier met hun reden.
   browserinstall.js INSTALLEERT (het is onze `npm ci` voor Chromium) en
   gezakte-toetsen.js RAPPORTEERT (het leest het log van een gezakte stap terug
   en velt zelf geen oordeel). Ze een poort noemen zou de lokale ronde twee
   stappen geven die niets kunnen bewijzen. Er staat verder niets in deze lijst,
   en dat hoort zo te blijven: elke naam hier is een poort die niemand meer
   ziet. */
const GEEN_POORT = ['scripts/browserinstall.js', 'scripts/gezakte-toetsen.js'];

/* Uit een `run:`-blok de losse opdrachten halen. Regels met een backslash
   lopen door, en een regel valt uiteen in de stukken die de shell los
   uitvoert -- anders verdwijnt `node scripts/gezakte-toetsen.js` achter een
   `if ...; then`, en dat is precies waar een poort zich kan verstoppen.

   HET SPLITSEN KIJKT NAAR AANHALINGSTEKENS EN NAAR $( ), en dat is geen
   nettigheid. De eerste versie sneed gewoon op `|` en `;`, en hakte daarmee elk
   jq-programma en elke echo met een streepje erin in stukken die er als
   onbekende opdrachten uitzagen -- eenenzeventig stuks, allemaal ruis, en ruis
   in een fail-closed melding leert precies het wegkijken aan waar hij tegen is. */
function opdrachtenUit(run) {
  const regels = [];
  let buffer = '';
  let aanhaling = null;
  let heredoc = null;
  for (const ruw of String(run || '').split('\n')) {
    /* Een heredoc is invoer en geen opdracht. Zonder deze grens leest de meter
       de tekst van een issue-bericht regel voor regel als shell -- en meldt
       vervolgens dat "Commit" een onbekende opdracht is. */
    if (heredoc !== null) { if (ruw.trim() === heredoc) heredoc = null; continue; }
    const r = ruw.trim();
    if (!buffer && !aanhaling && (!r || r.startsWith('#'))) continue;
    const hd = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/.exec(r);
    const naOpen = aanhalingNa(ruw, aanhaling);
    if (aanhaling || naOpen) {
      /* Een string die over meerdere regels loopt (een `node -e` met een
         programma erin) is EEN opdracht; hem per regel lezen levert brokstukken. */
      buffer += (buffer ? '\n' : '') + r;
      aanhaling = naOpen;
      if (!aanhaling) { regels.push(buffer.trim()); buffer = ''; }
      continue;
    }
    if (r.endsWith('\\')) { buffer += r.slice(0, -1).trim() + ' '; continue; }
    regels.push((buffer + r).trim());
    buffer = '';
    if (hd) heredoc = hd[2];
  }
  if (buffer.trim()) regels.push(buffer.trim());

  const uit = [];
  for (const regel of regels) {
    for (const stuk of splitsShell(regel)) {
      const s = stuk.trim().replace(/^(?:then|else|do)\s+/, '').trim();
      if (s) uit.push({ opdracht: s.replace(/\s+/g, ' '), informatief: /\|\|\s*true\s*$/.test(regel) });
    }
  }
  return uit;
}

/* Welk aanhalingsteken staat er aan het EIND van deze regel nog open? */
function aanhalingNa(regel, begin) {
  let q = begin || null;
  const stapel = [];
  const s = String(regel);
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (c === '\\' && q !== "'") { k++; continue; }
    if (c === '$' && s[k + 1] === '(') { stapel.push(q); q = null; k++; continue; }
    if (c === ')' && stapel.length && !q) { q = stapel.pop(); continue; }
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") q = c;
  }
  return q;
}

/* Splitsen op de plekken waar de shell zelf een nieuwe opdracht begint: `&&`,
   `||`, `;` en de pijp. Wat tussen aanhalingstekens of in een `$( )` staat,
   blijft heel -- dat is een argument of een subshell, geen tweede poort. */
function splitsShell(regel) {
  const uit = [];
  let stuk = '', aanhaling = null;
  const stapel = [];
  const s = String(regel);
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    /* `$(` opent een NIEUWE shell-context, ook binnen aanhalingstekens: in
       "$(node -e "iets")" is het binnenste paar een eigen string. Zonder deze
       stapel loopt de meter vanaf zo'n regel scheef en gaat hij de rest van het
       blok als een aanhaling lezen. */
    if (c === '$' && s[k + 1] === '(') { stapel.push(aanhaling); aanhaling = null; stuk += '$('; k++; continue; }
    if (c === ')' && stapel.length && !aanhaling) { aanhaling = stapel.pop(); stuk += c; continue; }
    if (aanhaling) { stuk += c; if (c === aanhaling) aanhaling = null; continue; }
    if (c === '"' || c === "'" || c === '`') { aanhaling = c; stuk += c; continue; }
    if (!stapel.length) {
      if (c === '&' && s[k + 1] === '&') { uit.push(stuk); stuk = ''; k++; continue; }
      if (c === '|' && s[k + 1] === '|') { uit.push(stuk); stuk = ''; k++; continue; }
      if (c === '|' || c === ';') { uit.push(stuk); stuk = ''; continue; }
    }
    stuk += c;
  }
  uit.push(stuk);
  return uit;
}

function soortVan(opdracht) {
  const s = String(opdracht).trim();
  if (INRICHTING.some(r => r.test(s))) return 'inrichting';
  if (/^npm\s+(?:run\s+)?[A-Za-z0-9:_-]+/.test(s)) return 'toets';
  if (/^(?:node|npx|cargo|sh|bash)\s/.test(s)) return 'toets';
  if (/^git\s+diff\b/.test(s)) return 'toets';
  return 'onbekend';
}

let scriptsCache = null;
function pakketScripts() {
  if (!scriptsCache) scriptsCache = JSON.parse(fs.readFileSync(path.join(WORTEL, 'package.json'), 'utf8')).scripts || {};
  return scriptsCache;
}

/* HET DOEL IS DE EENHEID, NIET DE OPDRACHTREGEL. `opgelost` is de opdracht
   NADAT de npm-namen door package.json heen zijn vertaald -- die is nodig om
   twee poorten uit elkaar te houden die hetzelfde script met andere vlaggen
   draaien (`overleving:ijking` en `overleving:controle` zijn twee poorten en
   geen een). `npm test`,
   `npm run test:deel -- --deel=2/4` en `npm run test:coverage` zijn drie
   opdrachten en EEN doel: scripts/test-runner.js. Zonder die stap zou de
   lokale ronde dezelfde suite vier keer draaien en toch beweren dat er iets
   niet gedekt is. De npm-namen worden daarvoor door package.json heen
   opgelost -- de enige plek waar die vertaling al staat. */
function doelVan(opdracht, scripts) {
  scripts = scripts || pakketScripts();
  let cmd = String(opdracht).trim();
  let samengesteld = false;
  for (let ronde = 0; ronde < 5; ronde++) {
    const m = /^npm\s+(?:run\s+)?([A-Za-z0-9:_-]+)/.exec(cmd);
    if (!m || !scripts[m[1]]) break;
    if (/&&|\|\|/.test(scripts[m[1]])) { samengesteld = true; cmd = 'npm run ' + m[1]; break; }
    cmd = scripts[m[1]];
  }
  if (samengesteld) return { doel: cmd, opgelost: cmd, samengesteld: true };
  const js = /(?:^|\s)((?:scripts|server|test)\/[^\s'"]+\.js)/.exec(cmd);
  if (js) return { doel: js[1], opgelost: cmd, samengesteld: false };
  return { doel: cmd.split(/\s+/).slice(0, 2).join(' '), opgelost: cmd, samengesteld: false };
}

/* WELKE VOORZIENING VRAAGT DEZE POORT? Twee komen uit de werkstroom zelf (de
   stap zet DATABASE_URL of REDIS_URL, of de job installeert een browser); de
   derde komt uit de BRON van de poort: een script dat `docker` start, heeft
   docker nodig. Dat is geen lijstje namen maar een meting, en hij blijft dus
   kloppen als er morgen een tweede dockerproef bij komt. */
function voorzieningen(gat, jobBrowser) {
  const uit = new Set();
  for (const sleutel of Object.keys(gat.env || {})) {
    if (/^DATABASE_URL$/.test(sleutel)) uit.add('postgres');
    if (/^REDIS_URL$/.test(sleutel)) uit.add('redis');
  }
  if (jobBrowser) uit.add('browser');
  /* TWEE VOORZIENINGEN DIE UIT DE OPDRACHT ZELF KOMEN. Een `git diff
     --exit-code` meet een SCHONE werkboom -- in de keten is dat de checkout, hier
     is het bijna nooit waar, en hem toch draaien geeft rood voor werk in
     uitvoering in plaats van voor een bouwsel dat achterloopt. En een opdracht
     die tegen `origin/main` vergelijkt, heeft die ref nodig; in een ondiepe
     kloon bestaat hij niet. */
  if (/^git\s+diff\b/.test(gat.opdracht) && /--exit-code/.test(gat.opdracht)) uit.add('schone-werkboom');
  for (const ref of String(gat.opdracht).match(/\borigin\/[A-Za-z0-9._\/-]+/g) || []) uit.add('gitref:' + ref);
  if (gat.doel && gat.doel.endsWith('.js')) {
    try {
      const bron = fs.readFileSync(path.join(WORTEL, gat.doel), 'utf8');
      if (/(?:spawnSync|spawn|execFileSync|execFile)\(\s*'docker'/.test(bron)) uit.add('docker');
    } catch (e) { /* geen bestand: dat meldt de poortcontrole al */ }
  }
  return [...uit];
}

const KETENWAARDE = /\$\{\{|\$GITHUB_|\$\{?GITHUB/;

/* IS DE KETENWAARDE ALLEEN EEN VERDELING? Een `${{ matrix.… }}` betekent per
   definitie dat dezelfde poort over meer machines wordt uitgesmeerd; het hele
   doel in een keer is dan een eerlijke lokale vorm. Alles ANDERS -- `inputs.*`,
   `github.*`, een shellvariabele -- is geen verdeling maar een keuze, en die mag
   je niet wegstrepen. Dat is geen theorie: `.github/workflows/takken.yml` draait
   `node scripts/takken.js --verwijder --max='${{ inputs.maximum }}'`, en een
   vorm die de argumenten weglaat is daar niet dezelfde handeling maar een
   andere. Wie een opdracht kaalplukt tot hij lokaal past, verzint een poort. */
function alleenVerdeeld(opdracht) {
  const s = String(opdracht);
  if (!/\$\{\{/.test(s)) return false;
  if (/\$(?!\{\{)\{?[A-Za-z_]/.test(s)) return false;
  return (s.match(/\$\{\{([^}]*)\}\}/g) || []).every(e => /\{\{\s*matrix\./.test(e));
}

function werkstromen(map) {
  const dir = map || MAP;
  return fs.readdirSync(dir).filter(n => /\.ya?ml$/.test(n)).sort().map(naam => {
    const doc = ontleed(fs.readFileSync(path.join(dir, naam), 'utf8'));
    return { bestand: naam, naam: doc.name || naam, aanleiding: Object.keys(doc.on || doc.true || {}), doc };
  });
}

/* DE POORTEN VAN DE KETEN. Elke uitvoerbare opdracht in elke werkstroom, met
   waar hij staat, wat hij is, en of hij hier te draaien is. Wat niet lokaal
   kan, draagt de REDEN -- er staat nergens een lege waarde en nergens een
   stille nul. */
function poorten(opties) {
  const o = opties || {};
  const uit = [];
  for (const ws of werkstromen(o.map)) uit.push(...poortenVanDoc(ws));
  return uit;
}

/* Dezelfde afleiding voor EEN bestand, zodat scripts/ci-keten.js zijn vijfde
   regel per werkstroom kan stellen zonder de hele map te lezen. */
function poortenVan(bestand, tekst) {
  const doc = ontleed(tekst);
  return poortenVanDoc({ bestand, naam: doc.name || bestand, aanleiding: Object.keys(doc.on || doc.true || {}), doc });
}

function poortenVanDoc(ws) {
  const scripts = pakketScripts();
  const uit = [];
  const jobs = ws.doc.jobs || {};
  for (const jobId of Object.keys(jobs)) {
    const job = jobs[jobId] || {};
    const stappen = Array.isArray(job.steps) ? job.steps : [];
    /* Twee eigenschappen van de JOB die elke poort erin raken. */
    const artefact = stappen.some(s => s && typeof s.uses === 'string' && /download-artifact/.test(s.uses));
    const browser = stappen.some(s => s && typeof s.run === 'string' &&
      /browserinstall\.js|playwright\s+install/.test(s.run));
    for (const stap of stappen) {
      if (!stap || typeof stap.run !== 'string') continue;
      for (const { opdracht, informatief } of opdrachtenUit(stap.run)) {
        const soort = soortVan(opdracht);
        const { doel, opgelost, samengesteld } = soort === 'toets' ? doelVan(opdracht, scripts) : { doel: null, opgelost: null };
        const gat = {
          werkstroom: ws.bestand, aanleiding: ws.aanleiding,
          job: jobId, jobnaam: typeof job.name === 'string' ? job.name : jobId,
          stap: typeof stap.name === 'string' ? stap.name : '(zonder naam)',
          regel: stap.__regel || 0,
          opdracht, soort, doel, opgelost: opgelost || opdracht, samengesteld: !!samengesteld,
          informatief: !!informatief, env: stap.env && typeof stap.env === 'object' ? stap.env : {}
        };
        if (soort === 'toets' && GEEN_POORT.includes(doel)) gat.soort = 'inrichting';
        gat.voorzieningen = gat.soort === 'toets' ? voorzieningen(gat, browser) : [];
        gat.artefact = artefact;
        gat.ketenwaarde = KETENWAARDE.test(opdracht);
        gat.verdeeld = alleenVerdeeld(opdracht);
        gat.geheim = gat.ketenwaarde ? false :
          Object.values(gat.env).some(v => typeof v === 'string' && /\$\{\{\s*secrets\./.test(v));
        uit.push(gat);
      }
    }
  }
  return uit;
}

/* ==========================================================================
   3) IS DEZE POORT HIER TE DRAAIEN, EN ZO NEE: WAAROM NIET?

   Vier van de vijf redenen zijn structureel -- de keten geeft iets mee dat op
   deze machine niet bestaat. De vijfde is een DEFECT: een poort die naar een
   bestand wijst dat hier niet staat, draait in de keten ook niet. Daarom komt
   die er als aparte soort uit; `scripts/ci-keten.js` zakt erop.
   ========================================================================== */
const SHELLVARIABELE = /\$(?!\{\{)\{?[A-Za-z_][A-Za-z0-9_]*/;

function oordeel(gat) {
  if (gat.soort !== 'toets') return { lokaal: false, soortReden: 'geen-poort', reden: 'geen poort' };
  if (gat.doel && /^(?:scripts|server|test)\//.test(gat.doel) && !fs.existsSync(path.join(WORTEL, gat.doel)))
    return { lokaal: false, soortReden: 'doel-weg', reden: 'het doel ' + gat.doel + ' staat niet in deze werkboom' };
  if (gat.artefact)
    return { lokaal: false, soortReden: 'artefact', reden: 'deze job leest een artefact uit een andere job van dezelfde run' };
  if (gat.geheim)
    return { lokaal: false, soortReden: 'geheim', reden: 'de stap krijgt een geheim uit de keten mee' };
  if (gat.ketenwaarde)
    return { lokaal: false, soortReden: 'ketenwaarde', reden: gat.verdeeld
      ? 'de keten verdeelt deze poort over meer machines; het hele doel in een keer is hier de vorm'
      : 'de keten geeft hier een waarde mee die hier niet bestaat (context of invoer); dezelfde opdracht zonder die waarde is een ANDERE handeling' };
  if (SHELLVARIABELE.test(gat.opdracht))
    return { lokaal: false, soortReden: 'variabele', reden: 'de opdracht leunt op een variabele uit een eerdere stap' };
  return { lokaal: true, soortReden: null, reden: null };
}

/* De omgevingsvariabelen die de STAP zelf zet en die hier ook betekenis
   hebben. Een waarde uit de keten (`${{ ... }}`) hoort daar niet bij: die
   bestaat op deze machine niet, en hem letterlijk doorgeven zou een poort op
   een verzonnen waarde laten draaien. */
function stapOmgeving(gat) {
  const uit = {};
  for (const [k, v] of Object.entries(gat.env || {}))
    if (typeof v === 'string' && !/\$\{\{/.test(v)) uit[k] = v;
  return uit;
}

module.exports = { ontleed, zonderCommentaar, opdrachtenUit, splitsShell, aanhalingNa, soortVan, doelVan,
  werkstromen, poorten, poortenVan, oordeel, alleenVerdeeld, stapOmgeving, INRICHTING, GEEN_POORT, MAP, WORTEL };
