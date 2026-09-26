/* WELKE GELDGEBEURTENISSEN HEEFT EEN WORLD-SCENARIO WERKELIJK GERAAKT?

   Een scenario dat "alle 27 gebeurtenissen" belooft, moet dat kunnen laten
   zien. Deze hulp laadt de World-modules opnieuw, met op elke regel die een
   been van de geldkaart draagt (scripts/lib/magnaatgeldkaart.js) een teller
   ervoor. De code van World verandert daarbij niet: de teller telt alleen, en
   hij staat uitsluitend in deze toetsomgeving. Begint het been met een
   voorwaarde (`if (...) { st.geld[h] += ...`), dan komt de teller BINNEN de
   tak: anders telt hij ook als de mutatie niet gebeurt. */
'use strict';
const fs = require('fs');
const path = require('path');
const Module = require('module');
const kaart = require('../../scripts/lib/magnaatgeldkaart');

const WORTEL = path.join(__dirname, '..', '..');

function beenregels() {
  const perBestand = new Map();
  for (const g of kaart.GEBEURTENISSEN) {
    for (const been of g.benen) {
      const bron = fs.readFileSync(path.join(WORTEL, been.bestand), 'utf8').split('\n');
      bron.forEach((regel, i) => {
        if (!regel.includes(been.code)) return;
        if (been.na) {
          const volgende = bron.slice(i + 1).find(x => x.trim());
          if (!volgende || !volgende.includes(been.na)) return;
        }
        const bestand = path.join(WORTEL, been.bestand);
        if (!perBestand.has(bestand)) perBestand.set(bestand, []);
        perBestand.get(bestand).push({ regel: i, id: g.id, code: been.code });
      });
    }
  }
  return perBestand;
}

/* Laadt `laad()` met tellers en geeft de tellingen terug. */
function metDekking(laad) {
  const regels = beenregels();
  const telling = {};
  globalThis.__geldkaart = (id) => { telling[id] = (telling[id] || 0) + 1; };
  const oud = Module._extensions['.js'];
  const map = path.join(WORTEL, 'server/kern/spellen/magnaat') + path.sep;
  for (const k of Object.keys(require.cache)) if (k.startsWith(map)) delete require.cache[k];
  Module._extensions['.js'] = function (module, bestand) {
    const benen = regels.get(bestand);
    if (!benen) return oud(module, bestand);
    const bron = fs.readFileSync(bestand, 'utf8').split('\n');
    for (const b of benen) {
      /* Binnen de regel, direct voor de code: dan telt hij precies als die
         mutatie loopt, ook als er een voorwaarde voor staat op dezelfde regel. */
      const teller = 'globalThis.__geldkaart(' + JSON.stringify(b.id) + '); ';
      const binnen = /^if \(.*?\) \{ /.exec(b.code);
      bron[b.regel] = bron[b.regel].replace(b.code, binnen ? binnen[0] + teller + b.code.slice(binnen[0].length) : teller + b.code);
    }
    module._compile(bron.join('\n'), bestand);
  };
  try { laad(); } finally {
    Module._extensions['.js'] = oud;
    for (const k of Object.keys(require.cache)) if (k.startsWith(map)) delete require.cache[k];
    delete globalThis.__geldkaart;
  }
  return telling;
}

module.exports = { metDekking };
