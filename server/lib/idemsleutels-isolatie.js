/* DE IDEMPOTENTIEVERKLARINGEN VAN DE ISOLATIELAAG.

   Zie de kop van ./idemsleutels.js voor wat de drie soorten betekenen. Wat deze
   veertien routes bijzonder maakt is dat ze in DRIE groepen uiteenvallen, en dat
   het onderscheid ertoe doet -- MUTATIECONTRACT.md is er scherp over: een
   herhaling die wordt GEWEIGERD is een toestandscontrole en geen idempotentie.
   Ze op een hoop gooien zou precies die schijnzekerheid maken.

   1. WAT LEEST. De eigen stand opvragen en de proef. De proef is de scherpste
      van de twee: hij heet "wat zou er gebeuren als", en als hij ooit iets
      verandert is deze verklaring de plek waar dat opvalt.

   2. WAT DE KERN ZELF ONTDUBBELT, en wat de poort daarom NIET mag naspelen.
      Verstrengen, een ceremonie beginnen en een stap aftekenen leken kandidaten
      voor de bewaarde-antwoordsoort (zie de kop van ./idemsleutels.js): twee
      woordelijk gelijke verzoeken binnen het venster zijn een dubbeltik. Maar de
      proef in test/isolatie-lid.test.js en test/isolatie-passkey.test.js liet
      zien dat de kern het al zelf afhandelt, en anders dan een bewaard antwoord:
      `zet` antwoordt bij een herhaling `ongewijzigd` in plaats van het eerste
      antwoord te herhalen, want kern/isolatie/zetten.js vergelijkt met de stand
      die er NU staat; een tweede `ontsluiting` is met opzet een NIEUW verzoek
      met een eigen id, want een ceremonie die door de poort wordt weggeplakt
      terwijl de eerste allang is afgebroken laat de drager zonder weg; en een
      tweede `stap` krijgt 401 omdat de assertie eenmalig is. Een bewaard
      antwoord zou in alle drie de gevallen iets terugsturen dat niet meer waar
      is. Dezelfde vondst als bij bank/akkoord (#171): de kern ontdubbelt op de
      STAND, en de poort hoort dan van de route af te blijven.

   3. WAT MET OPZET WEIGERT, en dat is geen tekortkoming. `commit` en `afbreken`
      lopen langs `if (v.status !== 'open') fout(409, ...)`: een tweede aanroep
      krijgt een nette 409 omdat het verzoek al voltooid of afgebroken IS. Dat is
      een toestandscontrole. `stap/opties` vraagt elke keer een VERSE
      WebAuthn-uitdaging aan -- die hergebruiken zou de bevestiging waardeloos
      maken, want dan is een onderschepte assertie een tweede keer bruikbaar. */
'use strict';

const SLEUTELS = {
  /* ---- 1. leest ---- */
  'POST /api/isolatie/mijn': { leest: true },
  'POST /api/techniek/isolatie/proef': { leest: true },

  /* ---- 2. de kern ontdubbelt zelf, de poort blijft eraf ---- */
  'POST /api/isolatie/mijn/zet': { nietIdempotent: true,
    waarom: 'kern/isolatie/zetten.js antwoordt bij een herhaling `ongewijzigd` op grond van de ' +
      'stand die er NU staat; een bewaard eerste antwoord zou zeggen dat er iets ' +
      'veranderd is terwijl dat niet meer zo is' },
  'POST /api/techniek/isolatie/zet': { nietIdempotent: true,
    waarom: 'idem: de kern vergelijkt met de huidige stand en ontdubbelt daarop zelf' },
  'POST /api/isolatie/mijn/ontsluiting': { nietIdempotent: true,
    waarom: 'een tweede verzoek is met opzet een NIEUW verzoek met een eigen id: wordt het ' +
      'eerste afgebroken, dan moet de drager opnieuw kunnen beginnen zonder dat de poort ' +
      'hem het oude id teruggeeft' },
  'POST /api/techniek/isolatie/ontsluiting': { nietIdempotent: true,
    waarom: 'idem: kern/isolatie/ontsluiting.js maakt per aanroep een verzoek, en dat is de bedoeling' },
  'POST /api/isolatie/mijn/ontsluiting/stap': { nietIdempotent: true,
    waarom: 'de assertie is eenmalig: een tweede aanroep met dezelfde assertie krijgt 401, en dat ' +
      'is een toestandscontrole van de uitdaging en geen herhaalde handeling' },
  'POST /api/techniek/isolatie/ontsluiting/stap': { nietIdempotent: true,
    waarom: 'idem: een gebruikte uitdaging bewijst niets meer, dus de tweede stap wordt geweigerd' },

  /* ---- 3. weigert met opzet, en dat is een toestandscontrole ---- */
  'POST /api/isolatie/mijn/ontsluiting/commit': { nietIdempotent: true,
    waarom: 'een tweede commit krijgt 409 omdat het verzoek al voltooid IS; dat is een ' +
      'toestandscontrole en geen idempotentie, en het verschil wegpoetsen zou een ' +
      'schijnzekerheid opleveren over de zwaarste handeling van deze laag' },
  'POST /api/techniek/isolatie/ontsluiting/commit': { nietIdempotent: true,
    waarom: 'idem: kern/isolatie/ontsluiting.js weigert een verzoek dat niet meer open staat' },
  'POST /api/isolatie/mijn/ontsluiting/afbreken': { nietIdempotent: true,
    waarom: 'een tweede afbreking krijgt 409 omdat het verzoek al afgebroken is; hetzelfde ' +
      'onderscheid als bij commit' },
  'POST /api/techniek/isolatie/ontsluiting/afbreken': { nietIdempotent: true,
    waarom: 'idem: een afgebroken verzoek is geen open verzoek' },
  'POST /api/isolatie/mijn/ontsluiting/stap/opties': { nietIdempotent: true,
    waarom: 'elke aanroep vraagt een VERSE WebAuthn-uitdaging aan; een hergebruikte uitdaging ' +
      'maakt een onderschepte assertie een tweede keer bruikbaar en dat is precies wat een ' +
      'stap-op-bevestiging moet uitsluiten' },
  'POST /api/techniek/isolatie/ontsluiting/stap/opties': { nietIdempotent: true,
    waarom: 'idem: een uitdaging is eenmalig, anders bewijst hij niets' }
};

module.exports = { SLEUTELS };
