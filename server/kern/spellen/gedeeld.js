/* Spellen (deelmodule): wat elk spel van het platform krijgt.

   Vijf dingen die geen enkel spel zelf hoort te schrijven, en die daarom niet
   in een spelmodule staan maar hier: twee poorten, een eerlijke schudbeker, de
   beurtvolgorde en het duwtje naar de andere kant.

   DE TWEE POORTEN zijn regels, geen hulpjes. `wereldFout` zegt welke app een
   potje mag STARTEN (meespelen op uitnodiging kan altijd over en weer), en
   `leeftijdFout` is de 18+-poort van Proost -- die geldt op ELK
   toetredingsmoment: starten, uitnodigen en accepteren. Allebei lezen ze de
   descriptor van het spel en kennen ze geen spelnaam; wie hier een `if
   (soort === 'proost')` neerzet, heeft het register omzeild.

   SCHUDDEN GAAT OP CRYPTO, en dat is geen overdaad. Elke kaartstapel en elke
   letterzak in dit huis loopt hier langs; `Math.random()` is voorspelbaar
   genoeg om een letterzak na te rekenen, en dan is een woordduel geen duel
   meer. Fisher-Yates, met `crypto.randomInt` als bron.

   BEURT DOORSCHUIVEN kan ook TERUG (stap -1: Pesten keert de richting om). De
   dubbele modulo is er omdat een negatieve stap in JavaScript anders een
   negatieve index geeft -- `(-1 % 4)` is -1 en niet 3.

   Deze module heeft geen eigen geheugen: alles komt binnen en gaat er weer uit.
   Stond dit in de spellenhub, dan groeide die hub mee met elke regel die
   toevallig door meer dan een spel gebruikt wordt. */
module.exports = (ctx) => {
  /* `SPEL` wordt hier NIET uitgepakt maar bij elke aanroep uit de context
     gelezen. Het register vult die tabel pas na deze module, en uitpakken zou
     de lege beginwaarde vastleggen -- dan zegt `wereldFout` voor elk spel dat
     het niet bestaat, en dat viel meteen om in zesendertig toetsen. */
  const { crypto, sseToCustomer, volwassen } = ctx;
  const spel = (soort) => (ctx.SPEL || {})[soort];

  function wereldFout(wereld, soort) {
    const s = spel(soort);
    if (!s || s.wereld === wereld || (Array.isArray(s.werelden) && s.werelden.includes(wereld)) || (wereld !== 'rtg' && wereld !== 'rtf')) return null;
    return wereld === 'rtg' ? 'Dit spel vind je in de RTFoundation-app.' : 'Dit spel vind je in de RTG-leden-app.';
  }

  function leeftijdFout(soort, handle) {
    const s = spel(soort);
    if (s && s.volwassen && !volwassen(handle))
      return 'Proost is 18+. Dit spel kan alleen met leden met een geverifieerde volwassen leeftijd.';
    return null;
  }

  /* Het duwtje: de andere kant hoeft niet te wachten op zijn volgende poll.
     In een try, want een stukke live-verbinding mag een zet nooit tegenhouden. */
  const nudge = (naar, potje) => {
    try { sseToCustomer(naar, 'social', { kind: 'spel', potje: potje.id, soort: potje.soort }); } catch (e) {}
  };

  function schud(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = crypto.randomInt(0, i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }

  function beurtDoor(potje, stap) {
    const n = potje.spelers.length;
    potje.beurt = ((potje.beurt + (stap || 1)) % n + n) % n;
  }

  return { wereldFout, leeftijdFout, nudge, schud, beurtDoor };
};
