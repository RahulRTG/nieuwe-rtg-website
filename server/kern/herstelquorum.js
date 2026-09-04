/* HET HERSTELQUORUM: drie delen, twee volstaan.

   WAAROM GEEN SHAMIR. Voor 2-uit-3 is polynoomrekening in GF(256) niet nodig,
   en zelf crypto schrijven waar het niet hoeft is de duurste gewoonte die er
   is. Voor precies deze drempel bestaat een vorm die je kunt NALEZEN:

     kies drie willekeurige blokken x, y, z met  geheim = x XOR y XOR z
     deel 1 = (x, y)      deel 2 = (y, z)      deel 3 = (z, x)

   Twee willekeurige delen dragen samen altijd alle drie de blokken, dus elk
   paar herstelt het geheim. EEN deel draagt er maar twee en mist er altijd een;
   dat ontbrekende blok is uniform willekeurig, dus een enkel deel zegt
   informatietheoretisch niets -- niet "moeilijk te kraken" maar niets. Dat is
   dezelfde garantie als Shamir geeft, alleen zonder de wiskunde die je moet
   geloven.

   DE PRIJS, EERLIJK: dit generaliseert niet. Wil je ooit 3-uit-5, dan is dit
   bestand niet uit te breiden maar te vervangen door echte Shamir. Dat is
   bewust: een algemene motor bouwen voor een drempel die niemand vraagt, is
   precies waar de fout in gaat zitten die je hier niet kunt permitteren.

   WAT DE SERVER BEWAART. Alleen een verifier: HMAC-SHA256 over een vaste
   context met het geheim als sleutel. Niet het geheim, niet een deel, en geen
   kale sha256 -- die laatste zou een woordenboekaanval mogelijk maken als het
   geheim ooit klein of afgeleid zou zijn. Wie de database steelt, kan hiermee
   een herstel CONTROLEREN maar er geen starten.

   WAT HIER NIET IN ZIT: wachttijden, meldingen, afbreken, routes. Dit bestand
   rekent en verder niets; de ceremonie staat in ./eigenaarherstel.js. */
'use strict';
const crypto = require('crypto');

const BLOK = 32;                       // bytes per blok; het geheim is even groot
const CONTEXT = 'rtg-herstelquorum-v1';

const xor = (a, b) => { const u = Buffer.alloc(a.length); for (let i = 0; i < a.length; i++) u[i] = a[i] ^ b[i]; return u; };

/* De verifier. HMAC met het geheim als SLEUTEL en een vaste context als
   bericht: zo hangt de uitkomst aan het geheim en niet aan iets dat de
   aanvaller kiest. */
function verifier(geheim) {
  return crypto.createHmac('sha256', geheim).update(CONTEXT).digest('hex');
}

/* Drie delen munten. Geeft de delen als tekst terug plus de verifier die de
   server bewaart; het geheim zelf verlaat deze functie NIET -- wie het wil,
   moet twee delen hebben, en dat is precies de bedoeling. */
function munt() {
  const x = crypto.randomBytes(BLOK), y = crypto.randomBytes(BLOK), z = crypto.randomBytes(BLOK);
  const geheim = xor(xor(x, y), z);
  const deel = (nr, a, b) => 'RTGH1-' + nr + '-' + Buffer.concat([a, b]).toString('base64url');
  return {
    delen: [deel(1, x, y), deel(2, y, z), deel(3, z, x)],
    verifier: verifier(geheim)
  };
}

/* Een deel lezen. Geeft { nr, a, b } of null -- nooit een uitzondering, want
   deze functie leest wat een mens overtypt en een typefout is geen storing. */
function leesDeel(tekst) {
  const m = /^RTGH1-([123])-([A-Za-z0-9_-]+)$/.exec(String(tekst || '').trim());
  if (!m) return null;
  let ruw;
  try { ruw = Buffer.from(m[2], 'base64url'); } catch (e) { return null; }
  if (ruw.length !== BLOK * 2) return null;
  return { nr: Number(m[1]), a: ruw.subarray(0, BLOK), b: ruw.subarray(BLOK) };
}

/* Twee delen samenvoegen tot het geheim. De blokken heten per deel anders:
   deel 1 draagt (x, y), deel 2 (y, z), deel 3 (z, x). Twee VERSCHILLENDE
   nummers leveren altijd alle drie; twee keer hetzelfde deel levert er maar
   twee, en dan valt hij op de volledigheidscontrole hieronder.

   HIER STOND OOK EEN EXPLICIETE `p.nr === q.nr`-WEIGERING, en die is eruit.
   Niet omdat hij fout was maar omdat hij niet te zien viel: haal je hem weg,
   dan blijft elke toets groen, want de volledigheidscontrole doet exact
   hetzelfde werk. Twee sloten waarvan er een nooit dichtvalt, leest als twee
   sloten -- en dan verdwijnt op een dag de verkeerde (LAT.md regel 9: een
   bewering die je niet hebt zien zakken is geen bewering). */
function quorumSamen(deelA, deelB) {
  const p = leesDeel(deelA), q = leesDeel(deelB);
  if (!p || !q) return null;
  const blok = {};
  const zet = (d) => {
    if (d.nr === 1) { blok.x = d.a; blok.y = d.b; }
    else if (d.nr === 2) { blok.y = d.a; blok.z = d.b; }
    else { blok.z = d.a; blok.x = d.b; }
  };
  zet(p); zet(q);
  if (!blok.x || !blok.y || !blok.z) return null;
  return xor(xor(blok.x, blok.y), blok.z);
}

/* Klopt dit paar bij de bewaarde verifier? Tijd-veilig vergeleken: een gewone
   !== lekt via de looptijd hoeveel er klopt.

   Hij heet `quorumKlopt` en niet `klopt`: die kortere naam stond al in twee
   andere kernmodules met een andere betekenis, en een derde had er een woord
   van gemaakt dat per bestand iets anders keurt (SEMANTIEK.json telt precies
   dat). Hier klopt niet 'iets' maar een QUORUM. */
function quorumKlopt(deelA, deelB, bewaardeVerifier) {
  const geheim = quorumSamen(deelA, deelB);
  if (!geheim || !bewaardeVerifier) return false;
  const a = Buffer.from(verifier(geheim), 'utf8');
  const b = Buffer.from(String(bewaardeVerifier), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { munt, leesDeel, quorumSamen, quorumKlopt, verifier, BLOK };
