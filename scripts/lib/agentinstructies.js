/* ============================================================================
   DE AGENTINSTRUCTIES -- wat een agent bij de start van een sessie leest, en of
   er bij het opknippen van CLAUDE.md iets verloren ging (ARCHITECTOPDRACHT.md,
   fase 1).

   WAAROM DIT ER IS. CLAUDE.md groeide tot 226.798 bytes en werd bij elke sessie
   van Claude Code in zijn geheel geladen, terwijl Codex (dat AGENTS.md leest)
   NIETS kreeg: geen merkregel, geen grens. Fase 1 maakt AGENTS.md de ene bron
   voor beide, laat CLAUDE.md ernaar verwijzen, en zet de samenvattingen per
   diepte-document woordelijk in DOCUMENTENKAART.md, dat niet vanzelf laadt.

   TWEE DINGEN STAAN HIER, EN ZE ZIJN MET OPZET GESCHEIDEN.

     meet()        hoeveel tekst een agent bij de start krijgt. Tokens worden
                   GESCHAT met schatTokens() uit kern/ai/contextpakket.js
                   (tekens gedeeld door drie, graad `vermoed`) -- dezelfde
                   methode als `npm run contextmeting`, zodat voor en na met
                   dezelfde maat zijn gemeten. Met `ref` meet hij een oude
                   commit uit git, zodat de nulmeting reproduceerbaar is.

     ontbrekend()  welke blokken van de OUDE CLAUDE.md niet woordelijk op hun
                   bestemming staan. De inventaris (test/fixtures/
                   agentinstructies-inventaris.json) legt per blok een hash en
                   een bestemming vast; dit is het bewijs dat er geen regel
                   verdween. Een getalmerkteken wordt bij het vergelijken
                   leeggemaakt, want `npm run getallen` herschrijft het getal
                   ertussen en dat is geen inhoudswijziging.

   WAT DIT NIET IS. Geen contextselectie en geen nieuwe waarheid: er wordt
   niets samengevat, herschreven of gekozen. Dat is fase 7.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { schatTokens } = require('../../server/kern/ai/contextpakket');

const WORTEL = path.join(__dirname, '..', '..');
const INVENTARIS = path.join(WORTEL, 'test', 'fixtures', 'agentinstructies-inventaris.json');

/* Een blok is wat tussen twee lege regels staat -- dezelfde knip als waarmee de
   inventaris is gemaakt. Een verplaatst blok blijft zo een heel blok. */
function blokken(tekst) {
  return String(tekst).replace(/\r\n/g, '\n').split(/\n[ \t]*\n/)
    .map((b) => b.replace(/\s+$/g, '')).filter((b) => b.trim() !== '');
}

function normaliseer(blok) {
  return String(blok)
    .replace(/<!--getal:([a-zA-Z0-9._-]+)-->[\s\S]*?<!--\/getal-->/g, '<!--getal:$1-->')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

function hash(blok) {
  return crypto.createHash('sha256').update(normaliseer(blok)).digest('hex').slice(0, 16);
}

function lees(bestand, ref) {
  if (!ref) {
    const p = path.join(WORTEL, bestand);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  }
  try {
    return execFileSync('git', ['show', ref + ':' + bestand],
      { cwd: WORTEL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
  } catch (e) { return null; }
}

/* Wat Claude Code bij de start laadt: CLAUDE.md in de wortel plus wat die met
   een regel `@pad` importeert, recursief. Een import die niet bestaat telt als
   ontbrekend en niet als nul -- dan klopt de meting niet. */
function startClaude(ref) {
  const gezien = new Set();
  const delen = [];
  const ontbreekt = [];
  function volg(bestand, diepte) {
    if (gezien.has(bestand) || diepte > 5) return;
    gezien.add(bestand);
    const t = lees(bestand, ref);
    if (t == null) { ontbreekt.push(bestand); return; }
    delen.push({ bestand, tekst: t });
    for (const r of t.split('\n')) {
      const m = /^@([^\s]+)\s*$/.exec(r.trim());
      if (m) volg(path.posix.normalize(path.posix.join(path.posix.dirname(bestand), m[1])), diepte + 1);
    }
  }
  volg('CLAUDE.md', 0);
  return { delen, ontbreekt };
}

/* Wat Codex bij de start in de wortel laadt: AGENTS.md. Geen import-syntaxis. */
function startCodex(ref) {
  const t = lees('AGENTS.md', ref);
  return { delen: t == null ? [] : [{ bestand: 'AGENTS.md', tekst: t }], ontbreekt: t == null ? ['AGENTS.md'] : [] };
}

function maat(start) {
  const tekst = start.delen.map((d) => d.tekst).join('\n');
  return {
    bestanden: start.delen.map((d) => d.bestand),
    ontbreekt: start.ontbreekt,
    bytes: Buffer.byteLength(tekst, 'utf8'),
    tekens: tekst.length,
    tokensGeschat: schatTokens(tekst),
  };
}

function meet(ref) {
  return {
    ref: ref || 'werkboom',
    methode: 'schatTokens uit server/kern/ai/contextpakket.js (tekens / 3), graad vermoed',
    claude: maat(startClaude(ref)),
    codex: maat(startCodex(ref)),
  };
}

function inventaris() {
  return JSON.parse(fs.readFileSync(INVENTARIS, 'utf8'));
}

/* Per inventarisblok: staat hij woordelijk (op de merktekens na) in zijn
   bestemming? `bronnen` mag een map bestand -> tekst zijn, zodat een toets een
   mutatie in het geheugen kan doorrekenen zonder de schijf te raken. */
function ontbrekend(inv, bronnen) {
  const perBestand = new Map();
  const tekstVan = (b) => {
    if (!perBestand.has(b)) {
      const t = bronnen && Object.prototype.hasOwnProperty.call(bronnen, b) ? bronnen[b] : lees(b);
      perBestand.set(b, new Set(t == null ? [] : blokken(t).map(hash)));
    }
    return perBestand.get(b);
  };
  return inv.blokken.filter((b) => !tekstVan(b.bestemming).has(b.hash));
}

module.exports = { blokken, normaliseer, hash, meet, inventaris, ontbrekend, lees, INVENTARIS, WORTEL };
