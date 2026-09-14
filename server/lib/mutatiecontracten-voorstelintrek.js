/* ============================================================================
   HET MUTATIECONTRACT VAN INTREKKEN (/api/{member,supplier,staff}/voorstel/intrek).

   EERST HET CONTRACT, DAN DE ROUTE -- de volgorde uit ./mutatiecontracten.js.

   DE STAND IS GEMETEN EN NIET BEREDENEERD. Er is op 13 september 2026 een
   dubbeltik-ronde gedraaid tegen een wegwerpserver, met de voorstellenlijst zelf
   als meetpunt:

     een voorstel open, twee keer intrekken   -> 200, daarna 404 (aantal 0)
     twee voorstellen open, twee keer         -> 409, daarna 409 (aantal 2)

   De tweede regel is de belangrijkste: bij twee openstaande voorstellen verdween
   er ook na de tweede oproep geen enkele. Een herhaling kan hier dus geen tweede
   effect hebben, in geen van beide toestanden.

   EN DIT IS EEN TOESTANDSCONTROLE EN GEEN DUPLICAATLAAG (MUTATIECONTRACT.md
   par. 5o). Er wordt geen idempotentiesleutel herkend; de tweede oproep vindt
   simpelweg niets meer om in te trekken en zegt dat. Dat verschil wordt hier niet
   weggepoetst -- wat vaststaat is dat er geen tweede effect KAN ontstaan, niet
   dat een dubbeltik wordt herkend. Zelfde formulering als
   ./mutatiecontracten-vertegenwoordiging.js, en om dezelfde reden.

   WAAROM 404 GEEN GEBREK IS. De eerste oproep laat de stand achter die de tweede
   aantreft; dat de tweede een andere STATUS geeft dan de eerste, is precies wat
   een toestandscontrole doet. De stand van het systeem is na een en na twee
   oproepen dezelfde, en dat is wat `idempotent` in kern/mutatie.js betekent.
   ========================================================================== */
'use strict';

const OP = '2026-09-13';

/* DE AFTEKENING IS EERLIJK OVER WAT ZE IS. Opgesteld door Claude op grond van een
   dubbeltik-ronde die in dezelfde sessie is gedraaid -- niet door een mens die
   hem heeft nagelezen. Wie hem naleest, vervangt deze regel door zijn naam. */
const AFGETEKEND = {
  door: 'Claude (Opus 5), op grond van een gedraaide dubbeltik-ronde tegen een wegwerpserver; ' +
    'niet door een mens nagelezen',
  op: OP
};

const BEWIJS = {
  gemeten: 'dubbeltik-ronde 2026-09-13: met EEN openstaand voorstel gaf de tweede oproep 404 ' +
    '(aantal 0) en met TWEE openstaande voorstellen gaven beide oproepen 409 (aantal 2) -- na de ' +
    'tweede oproep stond de lijst er in beide gevallen net zo bij als na de eerste. ' +
    'TOESTANDSCONTROLE en geen duplicaatlaag: er wordt geen sleutel herkend, de tweede oproep ' +
    'vindt niets meer om in te trekken.',
  op: OP
};

const intrek = (route, mutatieId, deur) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED', deur },
  stand: 'PROTECTED',
  bewijs: BEWIJS,
  afgetekend: AFGETEKEND
}];

/* ALLEEN HET LID. De zaak- en personeelsroutes zijn er bewust niet: het besluit
   van de eigenaar ging over een lid, en de allowlist opent het pad ook alleen
   daar. Zie de kop van routes/stuur.js. */
const CONTRACTEN = Object.fromEntries([
  intrek('POST /api/member/voorstel/intrek', 'stuur.voorstel.intrek.lid', 'auth')
]);

module.exports = { CONTRACTEN };
