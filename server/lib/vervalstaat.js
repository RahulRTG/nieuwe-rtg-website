/* DE VERVALSTAAT LEZEN -- een waarheid, twee poorten.

   VERTROUWEN.json (scripts/vertrouwen.js) kent elke route een vervalstaat toe:
   bewezen, verschaald, verzwakt, geschorst of ongemeten (PROOF.md par. 2).
   Twee lagen stellen daar dezelfde vraag over, en ze horen hem niet allebei
   zelf te beantwoorden (LAT.md regel 4):

     de schorspoort   (server/middleware/schorspoort.js) weigert een SCHRIJVENDE
                      aanroep op een geschorste route -- de runtime-vangnet.
     de bewijspoort   (server/kern/stuur/beleid.js) biedt een geschorste route
                      helemaal niet AAN de AI aan -- de keuze-grens.

   Het verschil is de hele gedachte achter proof-aware routing: niet "de AI
   probeert iets en de beveiliging houdt hem misschien tegen", maar "een
   onbewezen handeling staat niet in de lijst waaruit de AI kiest".

   FAIL-OPEN, EN DAT IS EEN BESLUIT MET EEN REDEN. Ontbreekt het register, dan
   geeft dit bestand null en verandert er niets aan het gedrag. Beide poorten
   zijn EXTRA vernauwingen boven op een grens die er al staat (de gewone
   poortwachters, en bij de AI een met de hand samengestelde allowlist plus
   menselijke bevestiging voor elke mutatie). Een ontbrekend meetregister mag
   die grenzen niet vervangen, en ook niet het hele huis dichtzetten.

   De kas wordt elke ttlMs opnieuw gelezen; een verse meting werkt dus binnen
   een halve minuut door, niet binnen een milliseconde. */
'use strict';
const fs = require('fs');
const path = require('path');
const { segmentPatroon } = require('./padvorm');

/* RTG_VERTROUWEN wijst het register desgewenst ergens anders heen (een
   toets met een verzonnen stand, of een afwijkende inrichting). Bij elke
   leesbeurt opnieuw bepaald, want een pad dat bij het laden van de module
   wordt vastgezet is in een toets niet meer te verzetten. */
const bronPad = () => process.env.RTG_VERTROUWEN || path.join(__dirname, '..', '..', 'VERTROUWEN.json');
const BRON = bronPad();
const TTL_MS = 30000;

let kas = null;
let gelezenOp = 0;

function laad(pad, ttlMs) {
  const nu = Date.now();
  const ttl = ttlMs === undefined ? TTL_MS : ttlMs;
  const bron = pad || bronPad();
  if (kas && kas.bron === bron && nu - gelezenOp < ttl) return kas;
  gelezenOp = nu;
  const vers = { bron, letterlijk: new Map(), vormen: [], gelezen: false };
  try {
    const reg = JSON.parse(fs.readFileSync(bron, 'utf8'));
    for (const [sleutel, u] of Object.entries(reg.perRoute || {})) {
      if (!u || !u.staat) continue;
      const spatie = sleutel.indexOf(' ');
      const methode = sleutel.slice(0, spatie);
      const p = sleutel.slice(spatie + 1);
      const rx = segmentPatroon(p);
      const rij = { methode, staat: u.staat, reden: u.reden || '' };
      if (rx) vers.vormen.push(Object.assign({ rx }, rij));
      else vers.letterlijk.set(sleutel, rij);
    }
    vers.gelezen = true;
  } catch (e) { /* geen register = geen signaal; zie de kop */ }
  kas = vers;
  return kas;
}

/* De staat van EEN route, of null als het register hem niet kent (of er niet
   is). Nooit een verzonnen 'bewezen': wie niets weet, zegt niets. */
function staatVan(methode, pad, opties) {
  const o = opties || {};
  const k = laad(o.pad, o.ttlMs);
  const letterlijk = k.letterlijk.get(methode + ' ' + pad);
  if (letterlijk) return letterlijk;
  const v = k.vormen.find(x => x.methode === methode && x.rx.test(pad));
  return v || null;
}

const isGeschorst = (methode, pad, opties) => {
  const s = staatVan(methode, pad, opties);
  return !!(s && s.staat === 'geschorst');
};

/* Alleen voor de toetsen: de kas legen zodat een verzonnen register meteen
   telt. Een instrument dat zijn eigen kas niet kan resetten, dwingt een toets
   om dertig seconden te wachten -- en dan wordt hij uitgezet. */
function vergeet() { kas = null; gelezenOp = 0; }

module.exports = { staatVan, isGeschorst, vergeet, BRON, TTL_MS };
