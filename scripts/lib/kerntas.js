/* DE KERN-TAS VOLGEN, EN ALLEEN WAT ER AANTOONBAAR IN ZIT.

   WAAROM DIT ER IS. De machinedekking (scripts/machinedekking.js) zag een route
   alleen via zijn eigen tekst en zijn directe requires. De meeste routebestanden
   krijgen hun domein echter uit de kern-tas: `module.exports = ({ app, auth,
   library }) => ...`. LibraryOS en de Loop Fabric (#502) lopen zo door een
   collectietransactie en een envelop, en de meter telde ze toch als "raakt geen
   enkele as". Besluit van de eigenaar, 6 oktober 2026: de meter volgt de tas.

   WAAROM ZO STRENG. Een eerste proef die elke module achter de tas als tekst
   las, liet de teller van 2793 naar 1655 zakken -- niet omdat er 1138
   handelingen beter werden, maar omdat elk woord in een kernelmodule meetelde,
   commentaar inbegrepen. Dat is precies de fout die de meter in zijn kop over
   zichzelf beschrijft (een hub in de tas zette 4162 routes op "idempotent").
   Daarom drie grenzen:

   1 ALLEEN WAT EEN FABRIEK OF TOEWIJZING IN DE TAS LEGT. De basisobjecten (db,
     save, app, auth) zijn infrastructuur; wie `save` gebruikt is daarmee niet
     atomair. Een naam met meer dan een herkomst wordt niet gevolgd.
   2 STRUCTUREEL EN NIET LEXICAAL, EN ALLEEN DE MODULE ZELF. Een as telt als de
     module die de naam levert de bron van de as zelf requiret. Een woord in
     een module zegt niets; een require wel. Wat zij op haar beurt inlaadt telt
     niet mee: een facade met negenentwintig deelmodules erft anders de motor
     van elke deelmodule (gemeten: 197 mobiliteitsroutes op "atomair" omdat de
     kaarttoegang een collectietransactie draagt).
   3 EEN AANROEP ALLEEN WAAR EEN MOTOR WORDT INGESPOTEN. De collectietransactie
     komt als `bewerkCollectie` binnen en wordt dus nooit gerequired; daarvoor,
     en alleen daarvoor, telt de aanroep -- in code zonder commentaar.

   Hubs worden niet gevolgd en een route die zelf in een hub woont ook niet:
   dezelfde grens als de bestandsas. */
'use strict';

const path = require('path');
const { zonderCommentaar } = require('./bron');

/* De motoren die ingespoten worden in plaats van gerequired. */
const AANROEPEN = Object.freeze({ atomair: ['bewerkCollectie'] });
const VOLG = /^(?:fabriek|toewijzing)/;

function maakKerntas(graaf, reg) {
  const bestaat = new Set(graaf.alle);
  const los = (van, spec) => {
    if (!spec.startsWith('.')) return null;
    const p = path.posix.normalize(path.posix.join(path.posix.dirname(van), spec));
    for (const k of [p, p + '.js', p + '/index.js']) if (bestaat.has(k)) return k;
    return null;
  };
  const schoon = new Map();
  const code = (f) => {
    if (!schoon.has(f)) schoon.set(f, zonderCommentaar(graaf.tekst.get(f) || ''));
    return schoon.get(f);
  };

  /* naam -> de module die hem levert, of null met de reden. */
  const levert = new Map();
  const onopgelost = [];
  for (const r of ((reg && reg.perNaam) || [])) {
    if (r.herkomsten.length !== 1) continue;
    const h = r.herkomsten[0];
    if (!VOLG.test(h.hoe || '')) continue;
    let mod = h.bestand;
    if (mod && mod.startsWith('server/opzet/')) {
      const esc = r.naam.replace(/[$]/g, '\\$');
      const m = new RegExp('\\bkern\\.' + esc + '\\s*=\\s*(?:await\\s+)?require\\(\\s*[\'"]([^\'"]+)[\'"]').exec(code(mod));
      mod = m ? los(h.bestand, m[1]) : null;
      if (!mod) { onopgelost.push(r.naam); continue; }
    }
    if (!bestaat.has(mod) || graaf.hub.has(mod) || mod.startsWith('server/opzet/')) continue;
    levert.set(r.naam, mod);
  }

  /* Welke namen haalt een routebestand uit de tas? */
  const namenVan = (f) => {
    const t = code(f), namen = new Set();
    const zak = (lijst) => { for (const n of lijst.split(',')) { const x = n.split(':')[0].split('=')[0].trim(); if (/^[A-Za-z_$][\w$]*$/.test(x)) namen.add(x); } };
    const kop = /module\.exports\s*=\s*(?:async\s+)?(?:function\b[^(]*)?\(\s*\{([^}]*)\}/.exec(t);
    if (kop) zak(kop[1]);
    for (const m of t.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?:kern|actx|ctx|sctx)\b/g)) zak(m[1]);
    for (const m of t.matchAll(/\b(?:kern|actx|ctx|sctx)\.([A-Za-z_$][\w$]*)/g)) namen.add(m[1]);
    return namen;
  };

  const cache = new Map();
  function assenVia(f, assen) {
    if (cache.has(f)) return cache.get(f);
    const uit = { modules: [], assen: [] };
    if (!f || graaf.hub.has(f)) { cache.set(f, uit); return uit; }
    const modules = new Set();
    for (const n of namenVan(f)) { const m = levert.get(n); if (m && m !== f) modules.add(m); }
    /* Alleen de leverende module ZELF, niet wat zij inlaadt: een facade als
       kern/mobiliteit/index.js laadt negenentwintig deelmodules, en dat een
       daarvan (de kaarttoegang) een collectietransactie draagt, maakt niet alle
       197 mobiliteitsroutes atomair. Dat was de tweede overschatting. */
    const set = modules;
    for (const [naam, as] of Object.entries(assen)) {
      if (as.uitRouter || !as.tokens || !as.tokens.length) continue;
      const lezers = graaf.vraagt.get(as.bron) || new Set();
      let raak = set.has(as.bron) || [...set].some(b => lezers.has(b));
      if (!raak && AANROEPEN[naam]) {
        raak = [...set].some(b => AANROEPEN[naam].some(a => new RegExp('\\b' + a + '\\s*\\(').test(code(b))));
      }
      if (raak) uit.assen.push(naam);
    }
    uit.modules = [...modules].sort();
    cache.set(f, uit);
    return uit;
  }

  return { assenVia, levert, onopgelost, namenVan };
}

module.exports = { maakKerntas, AANROEPEN };
