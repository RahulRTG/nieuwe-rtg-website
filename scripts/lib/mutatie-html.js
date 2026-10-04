'use strict';
// Schermproeven kunnen lokaal gedrag en opmaak bewaken zonder API-antwoorden
// te lezen. Muteer daarvoor de echte pagina, met behoud van geldige scripts.
const { loop } = require('./ontleed');
const { Script } = require('node:vm');

function bereiken(bron) {
  const scripts = [], tags = [];
  let open = null, rauw = null;
  loop(bron, () => {}, (naam, sluit, tag, eind) => {
    if (open) {
      if (naam === 'script' && sluit) {
        if (open.javascript) scripts.push({ start: open.start, eind: eind - tag.length });
        open = null;
      }
      return;
    }
    if (rauw) { if (sluit && naam === rauw) rauw = null; return; }
    if (sluit) return;
    if (['style', 'textarea', 'title', 'template', 'svg'].includes(naam)) { rauw = naam; return; }
    tags.push({ naam, start: eind - tag.length, eind });
    if (naam !== 'script') return;
    const type = /\stype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
    const soort = type ? (type[1] || type[2] || type[3] || '').toLowerCase() : '';
    open = { start: eind, javascript: !/\ssrc\s*=/i.test(tag) && ['', 'text/javascript', 'application/javascript'].includes(soort) };
  });
  return { scripts, tags };
}

const OPERATOREN_HTML = [
  { naam: 'html-bron-weg', htmlAttr: true, vind: () => [] },
  { naam: 'html-hoofdinhoud-weg', html: 'main', vind: () => [] },
  { naam: 'html-breedte-breken', html: 'body', vind: () => [] }
];

function muteerHtml(bron, op, index, muteerJs) {
  const { scripts, tags } = bereiken(bron);
  if (op.htmlAttr) {
    const gevonden = [];
    for (const t of tags) {
      const rauw = bron.slice(t.start, t.eind);
      const m = /\s(?:src|href)\s*=\s*(["'])(\/[^"']+)\1/i.exec(rauw);
      if (m) gevonden.push({ start: t.start + m.index + m[0].indexOf(m[2]), eind: t.start + m.index + m[0].indexOf(m[2]) + m[2].length });
    }
    const p = gevonden[index || 0];
    return p ? bron.slice(0, p.start) + '/__rtg_mutatie__' + bron.slice(p.eind) : null;
  }
  if (op.html) {
    const p = tags.filter(t => t.naam === op.html)[index || 0];
    if (!p) return null;
    // Display none laat de DOM en listeners intact, maar ontneemt de inhoud.
    // De breedtefout simuleert een verdwenen responsieve begrenzing.
    const regel = op.html === 'main' ? 'main{display:none!important}' : 'body{min-width:200vw!important}';
    return bron.slice(0, p.eind) + '<style>' + regel + '</style>' + bron.slice(p.eind);
  }
  let gezocht = index || 0;
  for (const p of scripts) {
    const script = bron.slice(p.start, p.eind);
    for (let n = 0; ; n++) {
      const nieuw = muteerJs(script, op, n);
      if (nieuw === null) break;
      if (gezocht-- === 0) return bron.slice(0, p.start) + nieuw + bron.slice(p.eind);
    }
  }
  return null;
}

function geldigeScripts(bron) {
  try {
    for (const p of bereiken(bron).scripts) new Script(bron.slice(p.start, p.eind));
    return true;
  } catch (e) { return false; }
}

module.exports = { bereiken, OPERATOREN_HTML, muteerHtml, geldigeScripts };
