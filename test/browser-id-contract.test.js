'use strict';
/* Het browser-id-contract.

   RTGId/RTGIdem wordt ook gebruikt door scripts die al tijdens het parsen
   kunnen draaien. Daarom is "id.js staat ergens op de pagina" niet genoeg:
   de parserblokkerende veiligheidslaag moet voor de eerste mogelijke
   aanroeper staan. Sinds metgezel.js idempotentiesleutels voor Samen maakt,
   geldt dat contract voor ieder scherm met de metgezel.

   Deze toets bewaakt daarnaast het echte faalgedrag. Valt Web Crypto weg, dan
   mag de client nooit terugvallen op Date.now/Math.random en mag een muterende
   handeling dus geen id krijgen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cachenaamVoor } = require('../scripts/lib/swvingerafdruk');

const WORTEL = path.join(__dirname, '..');
const PUBLIC = path.join(WORTEL, 'public');
const ID_PAD = path.join(PUBLIC, 'shared', 'id.js');
const AANROEP = /\bRTGId(?:em)?\s*\(/;

function loop(map, doe) {
  for (const naam of fs.readdirSync(map)) {
    const bestand = path.join(map, naam);
    const stat = fs.statSync(bestand);
    if (stat.isDirectory()) loop(bestand, doe);
    else doe(bestand);
  }
}

function webpad(bestand) {
  return path.relative(PUBLIC, bestand).split(path.sep).join('/');
}

function doelVan(pagina, src) {
  const schoon = String(src || '').split(/[?#]/, 1)[0];
  if (schoon.startsWith('/')) return schoon.slice(1);
  return path.posix.normalize(path.posix.join(path.posix.dirname(pagina), schoon));
}

function scripts(bron) {
  const uit = [];
  const patroon = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  for (const m of bron.matchAll(patroon)) {
    const src = /\bsrc\s*=\s*(["'])(.*?)\1/i.exec(m[1]);
    uit.push({ begin: m.index, attrs: m[1], src: src ? src[2] : null, inhoud: m[2] });
  }
  return uit;
}

function gebruikers() {
  const uit = new Set();
  loop(PUBLIC, (bestand) => {
    const rel = webpad(bestand);
    if (!/\.(?:js|html)$/.test(rel) || rel.startsWith('dist/') || rel === 'shared/id.js') return;
    if (AANROEP.test(fs.readFileSync(bestand, 'utf8'))) uit.add(rel);
  });
  return uit;
}

test('RTGId en RTGIdem leveren 128 bits uitsluitend uit Web Crypto', () => {
  const gezien = [];
  const window = {
    RTGId: () => 'oude-onveilige-definitie',
    crypto: {
      getRandomValues(bytes) {
        gezien.push(bytes.length);
        for (let i = 0; i < bytes.length; i++) bytes[i] = i;
        return bytes;
      }
    }
  };
  vm.runInNewContext(fs.readFileSync(ID_PAD, 'utf8'), { window, Uint8Array });

  assert.equal(window.RTGId, window.RTGIdem, 'de algemene en idempotentienaam zijn exact dezelfde helper');
  assert.equal(window.RTGIdem('order'), 'order-000102030405060708090a0b0c0d0e0f');
  assert.deepEqual(gezien, [16], 'de helper vraagt per id zestien CSPRNG-bytes');
});

test('zonder Web Crypto faalt RTGId gesloten en raakt klok noch Math.random', () => {
  let zwakkeAanroepen = 0;
  const window = {};
  vm.runInNewContext(fs.readFileSync(ID_PAD, 'utf8'), {
    window,
    Uint8Array,
    Date: { now() { zwakkeAanroepen++; return 1; } },
    Math: { random() { zwakkeAanroepen++; return 0.5; } }
  });

  assert.equal(typeof window.RTGIdem, 'function', 'de fail-closed helper bestaat ook als de bron ontbreekt');
  assert.throws(() => window.RTGIdem('geld'), /Veilige browser-willekeur ontbreekt/);
  assert.equal(zwakkeAanroepen, 0, 'geen voorspelbare nood-id uit klok of Math.random');
});

test('geen browserconsumer behandelt de verplichte helper nog als optioneel', () => {
  const fouten = [];
  loop(PUBLIC, (bestand) => {
    const rel = webpad(bestand);
    if (!/\.(?:js|html)$/.test(rel) || rel.startsWith('dist/')) return;
    const bron = fs.readFileSync(bestand, 'utf8');
    bron.split('\n').forEach((regel, i) => {
      if (/\b(?:window\.|w\.)?RTGId(?:em)?\s*\?/.test(regel)) {
        fouten.push(rel + ':' + (i + 1));
      }
    });
  });
  assert.deepEqual(fouten, [], 'een optionele helper opent opnieuw een zwakke of lege terugval');
});

test('ieder mogelijk RTGId-gebruik heeft de parserblokkerende helper al voor zich', () => {
  const gebruikt = gebruikers();
  const fouten = [];
  let paginas = 0;

  loop(PUBLIC, (bestand) => {
    const pagina = webpad(bestand);
    if (!pagina.endsWith('.html') || pagina.startsWith('dist/')) return;
    const bron = fs.readFileSync(bestand, 'utf8');
    const tags = scripts(bron);
    const nodig = gebruikt.has(pagina) || tags.some((tag) => tag.src && gebruikt.has(doelVan(pagina, tag.src)));
    if (!nodig) return;
    paginas++;

    const idTags = tags.filter((tag) => doelVan(pagina, tag.src) === 'shared/id.js');
    if (idTags.length !== 1) {
      fouten.push(pagina + ': verwacht precies één /shared/id.js, vond ' + idTags.length);
      return;
    }
    const id = idTags[0];
    if (/\b(?:defer|async)\b|\btype\s*=\s*(["'])module\1/i.test(id.attrs)) {
      fouten.push(pagina + ': id.js is niet parserblokkerend');
    }
    const headEind = bron.search(/<\/head\s*>/i);
    if (headEind < 0 || id.begin > headEind) fouten.push(pagina + ': id.js staat niet in <head>');

    for (const tag of tags) {
      if (tag.begin >= id.begin) break;
      const externGebruikt = tag.src && gebruikt.has(doelVan(pagina, tag.src));
      const inlineGebruikt = !tag.src && AANROEP.test(tag.inhoud);
      if (externGebruikt || inlineGebruikt) {
        fouten.push(pagina + ': RTGId kan vóór id.js worden aangeroepen door ' + (tag.src || 'inline script'));
      }
    }
  });

  assert.ok(paginas >= 250, 'de toets hoort het volledige globale oppervlak te zien, niet een handvol voorbeelden');
  assert.deepEqual(fouten, []);
});

test('beide offline shells leveren id.js mee en dragen hun actuele inhoudsafdruk', () => {
  for (const rel of ['sw.js', 'apps/foundation/sw.js']) {
    const bron = fs.readFileSync(path.join(PUBLIC, rel), 'utf8');
    assert.match(bron, /const SHELL = \[[\s\S]*?'\/shared\/id\.js'/,
      rel + ' cachet de parserkritieke helper');
    const afdruk = cachenaamVoor(bron, PUBLIC);
    assert.equal(afdruk.huidig, afdruk.nieuw, rel + ' draagt de afdruk van de gewijzigde shell');
  }
});

test('de Samen-mutaties sturen nooit een lege vervangs-idempotentiesleutel', () => {
  const bundel = fs.readFileSync(path.join(PUBLIC, 'shared', 'metgezel.js'), 'utf8');
  const deel = fs.readFileSync(path.join(PUBLIC, 'shared', 'metgezel', 'metgezel-03.js'), 'utf8');
  for (const [naam, bron] of [['bundel', bundel], ['deel', deel]]) {
    assert.match(bron, /typeof window\.RTGIdem !== 'function'/, naam + ' controleert de veiligheidslaag');
    assert.match(bron, /idem: veiligeIdem\('samen-maak'\)/, naam + ' beveiligt het maken');
    assert.match(bron, /idem: veiligeIdem\('samen-code'\)/, naam + ' beveiligt de rotatie');
    assert.doesNotMatch(bron, /RTGIdem\([^)]*\)\s*:\s*''/, naam + ' heeft geen lege terugval');
  }
});
