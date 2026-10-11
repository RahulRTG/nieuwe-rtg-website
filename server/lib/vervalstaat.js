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
const { vastePaden } = require('../web/routeindex');

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
      /* `route` is de sleutel uit het register, zodat een lezer weet WELKE
         route hij raakte en niet alleen met welke spelling hij binnenkwam. */
      const rij = { methode, staat: u.staat, reden: u.reden || '', route: sleutel };
      if (rx) vers.vormen.push(Object.assign({ rx }, rij));
      else vers.letterlijk.set(sleutel, rij);
    }
    vers.gelezen = true;
  } catch (e) { /* geen register = geen signaal; zie de kop */ }
  kas = vers;
  return kas;
}

/* De staat van EEN route, of null als het register hem niet kent (of er niet
   is). Nooit een verzonnen 'bewezen': wie niets weet, zegt niets.

   WAT "DIT PAD" IS, BESLIST DE ROUTER (N26 in de V1-audit). Hier stond een
   letterlijke opzoeking op het pad zoals het binnenkwam, terwijl de router een
   vast pad ook MET een slash erachter bij dezelfde handler laat komen (padMatch
   in ../web/routing.js), en een :param-route ook (zijn RegExp eindigt op \/?).
   Een geschorste schrijfroute was daardoor met een slash erachter gewoon uit te
   voeren: /api/foundation/les/maak gaf 503, /api/foundation/les/maak/ maakte
   een les aan.

   Het verzoekpad gaat daarom eerst door vastePaden() uit ../web/routeindex.js,
   precies de sleutels waarop de router zoekt, en pas DAARNA wordt er
   letterlijk vergeleken of een patroon gematcht. Dezelfde functie leest de
   inlogpauze (isInlogPad in ../middleware/remmen.js, N18). Geen eigen
   normalisatie ernaast: die valt ruimer of krapper uit dan de router, en dan is
   er weer een tweede opvatting van hetzelfde pad. Hoofdletters, een dubbele
   slash binnenin of procentcodering brengen een verzoek bij geen handler;
   test/schorspoort-spelling.test.js laat de router dat zelf zeggen.

   EEN GRENS DIE VANDAAG NIETS RAAKT, EN EEN TOETS DIE DAT ZO HOUDT. Een route
   die op een SLASH eindigt, komt met een slash EXTRA bij zijn handler, en die
   spelling vindt deze lezer niet. Dat geldt voor elke vorm waarin die slash
   ontstaat: een vast pad (een POST op '/api/t/' bereikt de router ook als
   /api/t//), een :param-route (een PUT op '/api/p/:id/', ook /api/p/1//) en de
   wortel van een gemounte router (een POST op '/' van een router die onder
   '/api/x' hangt, ook /api/x//). De oorzaak is de registersleutel: leesLagen()
   in ../web/routing.js haalt de slash weg (/api/t, /api/p/:id, /api/x), de
   router niet, dus vastePaden() komt hooguit op /api/t/ uit. Hier een slash
   extra weghalen is geen uitweg: dan sluit de poort ook /api/t// van een route
   die ZONDER slash is opgehangen, een spelling die de router nergens heen
   brengt, en dat is de tweede opvatting van het pad waar deze functie juist
   vanaf is.
   Wat wel kan is vasthouden dat zo'n route niet bestaat: toets 5 in
   test/schorspoort-spelling.test.js hangt elke schrijvende laag van de ECHTE
   router opnieuw op, vraagt de router per spelling of hij bij de handler
   komt, en zakt zodra deze lezer er dan een niet vindt. Daarmee ziet hij ook
   een .all()-route (de sleutel draagt ALL, gezocht wordt op de methode van
   het verzoek) en een :param midden in een segment (segmentPatroon() kent
   alleen /:). Gemeten op 6 oktober 2026: 5291 schrijvende lagen, van geen
   enkele vorm een.

   DE VOORBEELDEN STAAN IN WOORDEN EN NIET ALS AANROEP. De capabilityscanner
   (../kern/magnaat-capabilities-bronnen.js) leest server/ met commentaar en
   al, en telde ze als aanroep geschreven als twee routes die niet bestaan. */
function staatVan(methode, pad, opties) {
  const o = opties || {};
  const k = laad(o.pad, o.ttlMs);
  const paden = vastePaden(String(pad || ''));
  for (const p of paden) {
    const letterlijk = k.letterlijk.get(methode + ' ' + p);
    if (letterlijk) return letterlijk;
  }
  for (const p of paden) {
    const v = k.vormen.find(x => x.methode === methode && x.rx.test(p));
    if (v) return v;
  }
  return null;
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
