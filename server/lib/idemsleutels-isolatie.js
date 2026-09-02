/* DE IDEMPOTENTIEVERKLARINGEN VAN DE ISOLATIELAAG.

   Zie de kop van ./idemsleutels.js voor wat de drie soorten betekenen. Wat deze
   veertien routes bijzonder maakt is dat ze in DRIE groepen uiteenvallen, en dat
   het onderscheid ertoe doet -- MUTATIECONTRACT.md is er scherp over: een
   herhaling die wordt GEWEIGERD is een toestandscontrole en geen idempotentie.
   Ze op een hoop gooien zou precies die schijnzekerheid maken.

   1. WAT LEEST. De eigen stand opvragen en de proef. De proef is de scherpste
      van de twee: hij heet "wat zou er gebeuren als", en als hij ooit iets
      verandert is deze verklaring de plek waar dat opvalt.

   2. WAT EEN DUBBELTIK MOET SLIKKEN. Verstrengen en een ceremonie beginnen. Twee
      woordelijk gelijke verzoeken binnen het venster zijn een dubbeltik: bij
      `zet` zou de tweede een tweede regel in het spoor zetten voor dezelfde
      handeling, bij `ontsluiting` zou hij een TWEEDE openstaand verzoek maken --
      en twee openstaande ceremonies voor dezelfde drager is precies de
      verwarring waar een mens een verkeerde aftekent.

   3. WAT MET OPZET WEIGERT, en dat is geen tekortkoming. `commit` en `afbreken`
      lopen langs `if (v.status !== 'open') fout(409, ...)`: een tweede aanroep
      krijgt een nette 409 omdat het verzoek al voltooid of afgebroken IS. Dat is
      een toestandscontrole. `stap/opties` vraagt elke keer een VERSE
      WebAuthn-uitdaging aan -- die hergebruiken zou de bevestiging waardeloos
      maken, want dan is een onderschepte assertie een tweede keer bruikbaar.

   `stap` staat bewust bij groep 2 en niet bij 3: kern/isolatie/ontsluiting.js
   houdt de EERSTE aftekening vast (`if (!v.voltooid[soort])`), dus een herhaling
   verandert niets en verschuift ook het tijdstip niet -- juist het gegeven waar
   een wachttijd en een onderzoek achteraf aan hangen. */
'use strict';

const SLEUTELS = {
  /* ---- 1. leest ---- */
  'POST /api/isolatie/mijn': { leest: true },
  'POST /api/techniek/isolatie/proef': { leest: true },

  /* ---- 2. een dubbeltik is geen tweede bedoeling ---- */
  'POST /api/isolatie/mijn/zet': { zelfdeVerzoek: true },                   // drager + naar + reden
  'POST /api/techniek/isolatie/zet': { zelfdeVerzoek: true },               // drager + sleutel + naar + reden
  'POST /api/isolatie/mijn/ontsluiting': { zelfdeVerzoek: true },           // drager + naar + reden
  'POST /api/techniek/isolatie/ontsluiting': { zelfdeVerzoek: true },       // drager + sleutel + naar + reden
  'POST /api/isolatie/mijn/ontsluiting/stap': { zelfdeVerzoek: true },      // id + soort
  'POST /api/techniek/isolatie/ontsluiting/stap': { zelfdeVerzoek: true },  // id + soort

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
