/* Keurt SVG-pad-data zonder browser.

   Waarom dit bestaat: een pad dat de browser niet kan parsen wordt stilzwijgend
   niet getekend. Geen foutmelding op het scherm, geen kapotte pagina -- alleen
   een vorm die er niet is. Zo stond het vingerafdruk-icoon op de passkey-knop
   maanden met drie in plaats van vier ribbels, omdat het laatste pad eindigde
   op "c0 1": een curve die zes getallen nodig heeft en er twee kreeg.

   De grammatica komt uit de SVG-spec. Twee valkuilen zitten er met opzet in,
   want daar loopt een naieve keuring op vast:

   - De twee vlaggen van een booghelling (A/a) zijn losse tekens en mogen zonder
     scheiding aan elkaar en aan het volgende getal geschreven worden. In
     "a38 38 0 100 72" is "100" dus niet het getal honderd, maar large-arc 1,
     sweep 0, en x 0. Wie dat als een getal leest, keurt geldige paden af.
   - Een string die met + aan iets anders geplakt wordt ('M' + x + ' ' + y) is
     een stuk van een pad. Dat valt niet te keuren zonder de code te draaien,
     dus slaan we het over in plaats van te gokken.

   Gebruik:
     const { keurPad, scan } = require('./svgpaden');
     keurPad('M0 0L1')  -> 'commando "L" mist 1 van 2 getal(len)'
     keurPad('M0 0L1 2') -> null
*/
const fs = require('fs');
const path = require('path');

// hoeveel getallen elk commando verwacht; A telt apart, want twee ervan zijn vlaggen
const ARG = { M: 2, L: 2, T: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, A: 7, Z: 0 };

/* Geeft null als het pad klopt, anders een zin die zegt wat eraan mankeert. */
function keurPad(d) {
  const s = String(d);
  let i = 0;
  const sp = () => { while (i < s.length && /[\s,]/.test(s[i])) i++; };
  const getal = () => {
    sp();
    const m = /^[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/.exec(s.slice(i));
    if (!m || !m[0] || m[0] === '.') return null;
    i += m[0].length;
    return m[0];
  };
  // een vlag is precies een teken: 0 of 1
  const vlag = () => { sp(); if (s[i] === '0' || s[i] === '1') { i++; return true; } return null; };

  sp();
  if (i >= s.length) return 'leeg';
  if (s[i] !== 'M' && s[i] !== 'm') return 'begint niet met M of m';

  let cmd = null;
  for (;;) {
    sp();
    if (i >= s.length) return null;
    if (/[a-zA-Z]/.test(s[i])) {
      cmd = s[i]; i++;
      if (!(cmd.toUpperCase() in ARG)) return 'onbekend commando "' + cmd + '"';
      if (cmd.toUpperCase() === 'Z') { cmd = null; continue; }
    } else if (!cmd) {
      return 'getal zonder commando op teken ' + i;
    }
    const K = cmd.toUpperCase();
    if (K === 'A') {
      for (const naam of ['rx', 'ry', 'rotatie']) if (getal() === null) return 'booghelling mist ' + naam;
      if (vlag() === null) return 'booghelling mist de large-arc-vlag (moet 0 of 1 zijn)';
      if (vlag() === null) return 'booghelling mist de sweep-vlag (moet 0 of 1 zijn)';
      for (const naam of ['x', 'y']) if (getal() === null) return 'booghelling mist ' + naam;
    } else {
      for (let n = 0; n < ARG[K]; n++) {
        if (getal() === null) return 'commando "' + cmd + '" mist ' + (ARG[K] - n) + ' van ' + ARG[K] + ' getal(len)';
      }
    }
    // extra coordinatenparen achter een M gelden als lineto
    if (K === 'M') cmd = cmd === 'M' ? 'L' : 'l';
  }
}

/* Loopt de opgegeven mappen af en geeft de paden terug die niet kloppen. */
function scan(wortel, mappen) {
  const treffers = [];
  const re = /\bd\s*[=:]\s*(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g;

  function loop(dir) {
    for (const naam of fs.readdirSync(dir)) {
      const vol = path.join(dir, naam);
      const st = fs.statSync(vol);
      if (st.isDirectory()) { if (!/node_modules|\.git|^data$|dist/.test(naam)) loop(vol); continue; }
      if (!/\.(js|html|svg|css)$/.test(naam)) continue;
      const bron = fs.readFileSync(vol, 'utf8');
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(bron))) {
        const d = m[2];
        const na = bron.slice(m.index + m[0].length, m.index + m[0].length + 40);
        if (/^\s*\+/.test(na)) continue;                 // stuk van een samengestelde string
        if (/[$\\]|\{\{/.test(d)) continue;              // sjabloon met invulling
        if (!/^[\s\d.,\-+eEmMlLhHvVcCsSqQtTaAzZ]+$/.test(d)) continue;
        if (!/^\s*[mM]/.test(d)) continue;
        const fout = keurPad(d);
        if (fout) treffers.push({ bestand: path.relative(wortel, vol), regel: bron.slice(0, m.index).split('\n').length, d, fout });
      }
    }
  }

  for (const m of mappen) {
    const p = path.join(wortel, m);
    if (fs.existsSync(p)) loop(p);
  }
  return treffers;
}

module.exports = { keurPad, scan };
