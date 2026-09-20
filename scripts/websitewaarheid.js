'use strict';

/* De openbare website mag namen, routes en prijzen niet zelf opnieuw bedenken.
   Dit bestand maakt een kleine, openbare momentopname van de twee bronnen die
   de app zelf gebruikt: rtg-edge-worlds.js en pasladder.js. De website leest
   die momentopname; de bouw en `npm run check` weigeren een verouderde versie. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const WERELDBRON = path.join(ROOT, 'public/shared/rtg-edge-worlds.js');
const DOEL = path.join(ROOT, 'public/site/website-truth.json');
const VOLGORDE = ['living', 'travel', 'work', 'foundation'];

function wereldenUitBron() {
  const code = fs.readFileSync(WERELDBRON, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox, { filename: WERELDBRON });
  return { code, werelden: sandbox.window.RTGEdgeWorlds };
}

function routeBestaat(route) {
  const schoon = String(route || '').split(/[?#]/)[0];
  if (!schoon.startsWith('/')) return false;
  return fs.existsSync(path.join(ROOT, 'public', schoon.replace(/^\//, '')));
}

function euro(centen) {
  if (centen === 0) return 'Kosteloos';
  return '€ ' + new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 }).format(centen / 100);
}

function maak() {
  const { code, werelden } = wereldenUitBron();
  if (!werelden) throw new Error('rtg-edge-worlds.js leverde geen werelden op');

  const wereldUit = {};
  for (const id of VOLGORDE) {
    const wereld = werelden[id];
    if (!wereld) throw new Error('wereld ontbreekt in appbron: ' + id);
    const routes = [wereld.huis, wereld.home, wereld.workspace]
      .concat(wereld.all.map((functie) => functie[3]));
    const ontbreekt = [...new Set(routes)].filter((route) => !routeBestaat(route));
    if (ontbreekt.length) throw new Error(id + ' verwijst naar ontbrekende app-route(s): ' + ontbreekt.join(', '));
    wereldUit[id] = {
      name: wereld.kaart,
      appName: wereld.naam,
      publicRoute: wereld.huis,
      homeRoute: wereld.home,
      workspaceRoute: wereld.workspace,
      action: wereld.actie,
      groupCount: wereld.groups.length,
      featureCount: wereld.all.length,
      groups: wereld.groups.map((groep) => ({ name: groep[0], count: groep[1].length })),
      tools: wereld.tools.map((functie) => ({ id: functie[0], name: functie[1], route: functie[3] }))
    };
  }

  const ladder = require('../server/kern/pasladder').treden();
  const passen = {};
  for (const pas of ladder) {
    const id = pas.id === 'gratis' ? 'community' : pas.id;
    passen[id] = {
      appId: pas.id,
      name: pas.naam,
      available: pas.beschikbaar,
      contractPrice: pas.contractueel,
      priceLabel: pas.contractueel ? 'Vanaf ' + euro(pas.bodemCenten) : euro(pas.standaardCenten),
      billingNote: pas.contractueel
        ? 'De uiteindelijke maandprijs wordt per klant afgesproken.'
        : (pas.standaardCenten === 0 ? 'Geen maandelijkse bijdrage.' : 'Per maand, exclusief btw.'),
      audience: pas.voor
    };
  }

  const hashBron = code + '\n' + JSON.stringify(ladder);
  const uit = {
    schema: 1,
    source: ['public/shared/rtg-edge-worlds.js', 'server/kern/pasladder.js'],
    sourceHash: crypto.createHash('sha256').update(hashBron).digest('hex'),
    worlds: wereldUit,
    passes: passen
  };
  /* Objecten uit de vm-context dragen een ander prototype. Maak hier gewone
     gegevens van, zodat iedere Node-aanroeper exact hetzelfde object krijgt. */
  return JSON.parse(JSON.stringify(uit));
}

function tekst() { return JSON.stringify(maak(), null, 2) + '\n'; }

function schrijf() {
  const nieuw = tekst();
  const oud = fs.existsSync(DOEL) ? fs.readFileSync(DOEL, 'utf8') : '';
  if (nieuw !== oud) fs.writeFileSync(DOEL, nieuw);
  return nieuw !== oud;
}

function controle() {
  if (!fs.existsSync(DOEL)) throw new Error('public/site/website-truth.json ontbreekt');
  if (fs.readFileSync(DOEL, 'utf8') !== tekst()) {
    throw new Error('website-truth.json loopt achter op de app; draai npm run websitewaarheid');
  }
  return true;
}

if (require.main === module) {
  try {
    if (process.argv.includes('--controle')) {
      controle();
      console.log('[websitewaarheid] website en app gebruiken dezelfde bron');
    } else {
      console.log(schrijf() ? '[websitewaarheid] website bijgewerkt uit appbron' : '[websitewaarheid] al actueel');
    }
  } catch (fout) {
    console.error('[websitewaarheid] ' + fout.message);
    process.exitCode = 1;
  }
}

module.exports = { maak, schrijf, controle };
