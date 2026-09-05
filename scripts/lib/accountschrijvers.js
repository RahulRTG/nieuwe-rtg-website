'use strict';

/* Statische inventaris van de lokale identiteitscache. De runtimegrens in
   accounts/state.js kan alleen beschermen wat via S.zin(...) loopt. Deze scan
   maakt daarom iedere account-SQL-write buiten die gevel releaseblokkerend en
   houdt iedere bewuste bypass klein, exact geteld en benoemd. */
const fs = require('node:fs');
const path = require('node:path');
const { isAccountSchrijfzin } = require('../../server/accounts/duurzaamheid');

const INTERNE_PUBLICATIES = Object.freeze({
  'server/accounts/mirror.js': 4
});

function bestanden(map) {
  const uit = [];
  for (const naam of fs.readdirSync(map, { withFileTypes: true })) {
    const volledig = path.join(map, naam.name);
    if (naam.isDirectory()) uit.push(...bestanden(volledig));
    else if (naam.isFile() && naam.name.endsWith('.js')) uit.push(volledig);
  }
  return uit.sort();
}

/* Alleen JavaScript-tekstliteraaltjes zijn relevant. Commentaar overslaan
   voorkomt dat documentatie met een voorbeeld-UPDATE als schrijfpad telt. */
function tekstliteralen(bron) {
  const uit = [];
  for (let i = 0; i < bron.length;) {
    if (bron[i] === '/' && bron[i + 1] === '/') {
      i = bron.indexOf('\n', i + 2); if (i < 0) break; continue;
    }
    if (bron[i] === '/' && bron[i + 1] === '*') {
      i = bron.indexOf('*/', i + 2); if (i < 0) break; i += 2; continue;
    }
    const teken = bron[i];
    if (teken !== "'" && teken !== '"' && teken !== '`') { i++; continue; }
    const begin = i++; let tekst = '';
    while (i < bron.length) {
      if (bron[i] === '\\') {
        tekst += bron[i];
        if (i + 1 < bron.length) tekst += bron[i + 1];
        i += 2; continue;
      }
      if (bron[i] === teken) { i++; break; }
      tekst += bron[i++];
    }
    uit.push({ begin, einde: i, tekst });
  }
  return uit;
}

function regel(bron, pos) { return bron.slice(0, pos).split('\n').length; }
function aantal(bron, patroon) { return (bron.match(patroon) || []).length; }

function controleer(root) {
  const accountsMap = path.join(root, 'server', 'accounts');
  const onbewaakt = [], bewaakt = [], expliciet = [];
  const gezienInterne = {};
  for (const bestand of bestanden(accountsMap)) {
    const rel = path.relative(root, bestand).split(path.sep).join('/');
    const bron = fs.readFileSync(bestand, 'utf8');
    const interne = aantal(bron, /\bduurzaamheid\.internePublicatie\s*\(/g);
    if (interne) gezienInterne[rel] = interne;

    for (const lit of tekstliteralen(bron)) {
      if (!isAccountSchrijfzin(lit.tekst)) continue;
      const voor = bron.slice(Math.max(0, lit.begin - 100), lit.begin);
      const na = bron.slice(lit.einde, Math.min(bron.length, lit.einde + 240));
      const viaGevel = /\bS\.zin\s*\(\s*$/.test(voor) && /^\s*\)\s*\.run\s*\(/.test(na);
      const vondst = { bestand: rel, regel: regel(bron, lit.begin),
        sql: lit.tekst.trim().replace(/\s+/g, ' ').slice(0, 100) };
      (viaGevel ? bewaakt : onbewaakt).push(vondst);
    }

    /* onderhoud.js bouwt zijn ene UPDATE uit een vaste tabel- en kolomlijst.
       Hij is niet publiek geëxporteerd; hij draait na de reeds bewaakte INSERT
       of als expliciete startup/rotatiemigratie. Elke extra directe write is
       een nieuwe uitzondering en moet deze allowlist bewust wijzigen. */
    const directeWrites = aantal(bron,
      /\bdb\.prepare\s*\(\s*(['"`])\s*(?:INSERT|REPLACE|UPDATE|DELETE)\b[\s\S]{0,240}?\.run\s*\(/gi);
    if (rel === 'server/accounts/onderhoud.js' && directeWrites === 1 &&
        /const TABEL = g\.TABEL;/.test(bron) &&
        /db\.prepare\('UPDATE ' \+ TABEL \+ ' SET '/.test(bron)) {
      expliciet.push({ bestand: rel, aantal: 1, reden: 'vaste startup/na-insert kluismigratie' });
    } else if (directeWrites) {
      onbewaakt.push({ bestand: rel, regel: 0,
        sql: directeWrites + ' directe dynamische prepare-write(s)' });
    }
  }

  const alleInterne = new Set([...Object.keys(INTERNE_PUBLICATIES), ...Object.keys(gezienInterne)]);
  for (const rel of alleInterne) {
    const verwacht = INTERNE_PUBLICATIES[rel] || 0;
    const gevonden = gezienInterne[rel] || 0;
    if (gevonden !== verwacht) onbewaakt.push({ bestand: rel, regel: 0,
      sql: `internePublicatie gevonden=${gevonden}, verwacht=${verwacht}` });
  }
  return {
    ok: onbewaakt.length === 0,
    formaat: 'rtg-accountschrijvers-v1',
    bestanden: bestanden(accountsMap).length,
    bewaakteSchrijfzinnen: bewaakt.length,
    internePublicaties: Object.values(gezienInterne).reduce((som, n) => som + n, 0),
    explicieteUitzonderingen: expliciet,
    onbewaakt
  };
}

module.exports = { INTERNE_PUBLICATIES, tekstliteralen, controleer };
