/* ============================================================================
   EEN VELDNAAM, MEER BETEKENISSEN -- de vorm die vier keer terugkwam.

   Domeinen noemen hun sleutel `id` (of `token`), maar WAT dat id is verschilt
   per deelgebied. Vier keer gemeten, vier keer hetzelfde:

     livinglab   /api/lab2/bewijs  is een STUDIE, /api/lab2/app een APPARAAT,
                 /api/lab2/mijn een LABPAS, /api/lab2/lab een LAB
     spel        /api/member/spel/opgeven wil een ANDER potje dan de rest,
                 want het beeindigt er een
     postbus     /team is een TEAM, /concept een CONCEPT, /regel een REGEL,
                 de rest een BERICHT
     gezin       daar is het `token`: bij /api/rtf/leerling het KIND, bij
                 /api/rtf/social/gezin de OUDER

   WAAROM DIT EEN EIGEN MODULE IS. Niet omdat de code lang is -- hij is acht
   regels -- maar omdat de FOUT duur en onzichtbaar is. Bij de postbus gaf ik
   elk rtmail-pad hetzelfde team-id mee, en de meting ZAKTE: 1938 -> 1936. Geen
   enkele lamp ging branden; er stonden alleen een paar routes minder op
   `beschermd`, en dat lees je niet terug tenzij je het toevallig vergelijkt.
   Ik had die valkuil op dat moment al drie keer opgeschreven en liep er zelf
   in.

   Wat deze module toevoegt boven een handgeschreven if-reeks is dus de GRENS,
   op een plek waar de volgende wereld hem tegenkomt:

     - een deelgebied dat er niet in staat, krijgt GEEN id (404 is eerlijker
       dan het verkeerde ding)
     - een ding dat de wereld niet heeft gemaakt, wordt niet verzonnen
     - het langste deelgebied wint, zodat /a/bc niet onder /a/b valt

   De TABEL zelf hoort bij de wereld en niet hier: welk deelgebied wat bedoelt
   is een meting aan dat domein, en die hoort te staan waar hij is gedaan. */
'use strict';
const { dekt } = require('./padgrens');

/* `tabel` is { '<deelgebied>': '<soort>' }, `bak` is { '<soort>': waarde }.
   `veld` is de naam waaronder het meegaat -- meestal `id`, bij het gezin
   `token`. */
function idVoor(tabel, bak, pad, veld) {
  const naam = veld || 'id';
  if (!tabel || !bak) return {};
  let beste = null;
  for (const [deel, soort] of Object.entries(tabel)) {
    if (!dekt(pad, deel)) continue;
    if (!beste || deel.length > beste.deel.length) beste = { deel, soort };
  }
  if (!beste) return {};
  const w = bak[beste.soort];
  return w ? { [naam]: w } : {};
}

/* Voor een wereld die zijn tabel wil laten nakijken: elke soort die de tabel
   noemt, hoort de wereld ook te kunnen maken. Een tabel die naar een ding
   wijst dat nergens ontstaat, is een stille 404-fabriek. */
function ongedekteSoorten(tabel, soortenDieBestaan) {
  const kan = new Set(soortenDieBestaan || []);
  return [...new Set(Object.values(tabel || {}))].filter(s => !kan.has(s));
}

module.exports = { idVoor, ongedekteSoorten };
