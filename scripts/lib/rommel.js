/* ============================================================================
   ROMMEL-INVOER, DETERMINISTISCH -- emoji, gigastrings, diep genest, injecties.

   WAAROM DIT HIER STAAT EN NIET IN EEN SCRIPT. Deze generator woonde in
   scripts/beproeving.js, en de invoerproef had er precies dezelfde nodig. Twee
   kopieen van "wat is gemene invoer" lopen gegarandeerd uiteen, en dan meet de
   ene ronde iets anders dan de andere terwijl beide "rommel" zeggen (LAT.md,
   regel 4). Dus een plek, en de aanroepers geven hun eigen teller mee.

   DETERMINISTISCH IS HIER GEEN LUXE. Een crash op willekeurige invoer is niet
   na te spelen, en een bevinding die je niet kunt herhalen wordt niet
   gerepareerd maar weggewuifd. `maakTeller(seed)` geeft dezelfde reeks bij
   dezelfde seed, dus een gevonden 500 komt terug met het commando erbij.

   WAT ROMMEL WEL EN NIET BEWIJST. Een 400 op rommel zegt IETS over de
   validatie en NIETS over de autorisatie: de validatie weigert het verzoek
   voordat de rechten aan de beurt zijn. Wie rechten wil beproeven heeft
   plausibele invoer nodig -- zie scripts/lib/rolproef.js, die daarom het
   tegenovergestelde stuurt.
   ========================================================================== */
'use strict';

const EMO = '😀🎉💥🔥🤡🍕🚀💩👻🥶🦄🌈';

/* Dezelfde teller als in beproeving.js (mulberry32), zodat een seed daar en
   hier dezelfde reeks geeft. Math.random() is niet te seeden en dus niet na te
   spelen. */
function maakTeller(seed) {
  let s = (Number(seed) || 1234567) >>> 0;
  return function rng() {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* De velden zijn niet verzonnen maar afgekeken van de echte routes: een lijf
   met alleen onbekende sleutels wordt door de meeste handlers genegeerd, en dan
   meet je of de server een LEEG verzoek overleeft in plaats van een gemeen. */
const VELDEN = ['q', 'ref', 'code', 'id', 'aanbiederId', 'behandelingId', 'datum', 'tijd',
  'bedrag', 'centen', 'aantal', 'supplierCode', 'pakketId', 'text', 'tekst', 'medisch',
  'naam', 'personen', 'token', 'staffId', 'pin', 'niveau', 'pad', 'bevestigd', 'aan', 'soort'];

function maakRommel(rng) {
  const rint = n => Math.floor(rng() * n);
  const rkeuze = a => a[rint(a.length)];
  const emojiStr = (n) => { let s = ''; for (let i = 0; i < n; i++) s += EMO[rint(EMO.length)]; return s; };
  const diep = (n) => { let o = {}, c = o; for (let i = 0; i < n; i++) { c.x = {}; c = c.x; } c.eind = 1; return o; };

  function chaosWaarde(d) {
    if (d > 4) return rkeuze([1, 'x', true, null]);
    switch (rint(15)) {
      case 0: return emojiStr(rint(30) + 1);
      case 1: return '𝕏' + emojiStr(3) + ' <script>alert(1)</script>';
      case 2: return "'; DROP TABLE member_dir;-- " + emojiStr(2);
      case 3: return 'A'.repeat(rint(20000));
      case 4: return -rint(1e9) - 1;
      case 5: return Number.MAX_SAFE_INTEGER * (rng() > 0.5 ? 1 : -1);
      case 6: return rkeuze([null, true, false, '']);
      case 7: return diep(rint(60));
      case 8: return Array.from({ length: rint(50) }, () => chaosWaarde(d + 1));
      case 9: return { [emojiStr(2)]: chaosWaarde(d + 1), aantal: -rint(999), q: emojiStr(1) };
      case 10: return '2026-99-99';
      case 11: return '99:99';
      case 12: return '../../etc/passwd';
      case 13: return '{{7*7}}${jndi:ldap://x}';   // template/JNDI-injectie
      default: return chaosBody(d + 1);
    }
  }
  function chaosBody(d) {
    if (d > 3) return chaosWaarde(d);
    const body = {};
    const k = rint(5);
    for (let i = 0; i < k; i++) body[rkeuze(VELDEN)] = chaosWaarde(d + 1);
    return body;
  }
  return { chaosBody, chaosWaarde, emojiStr, diep, rint, rkeuze };
}

module.exports = { maakTeller, maakRommel, EMO, VELDEN };
