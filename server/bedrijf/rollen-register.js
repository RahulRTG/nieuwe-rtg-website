/* RTG Werk OS: HET REGISTER van rechten en rollen. Tabellen, geen logica --
   die staat in ./rollen.js, dat er de poort, het journaal en de rollenkaart
   omheen bouwt.

   Ze staan apart omdat het twee dingen zijn die op een andere manier
   veranderen. Aan dit bestand komt iemand die een ROL of een RECHT toevoegt, en
   dan wil je in één scherm zien wat er al is en wie wat mag; aan ./rollen.js
   komt iemand die aan de werking sleutelt. Zelfde reden als bij het kader van
   het Living Lab (kern/livinglab/kader.js): een tabelset die je in één blik
   moet kunnen overzien, hoort niet verspreid tussen de functies die hem lezen.

   DRIE KEUZES DIE HIER VASTLIGGEN, en ze zijn alle drie zichtbaar in de tabel:

   1. RECHTEN ZIJN WERKWOORDEN, GEEN AFDELINGEN. Een rol is een bundel rechten
      en niet andersom; wie iemand een afdeling geeft, geeft hem daarmee nog
      geen inzage. Zo kan een tijdelijke controller wel de cijfers zien zonder
      ook de personeelsdossiers open te trekken.
   2. DE ZWAARSTE INZAGE VRAAGT EEN REDEN. Vier rechten staan in REDEN_NODIG:
      het personeelsdossier, de klantprijzen, de beveiligingslaag en het
      journaal zelf. Ze gaan alleen open MET een opgegeven reden, en die reden
      komt in het journaal te staan (de inhoud niet). De lijst staat er met
      NAMEN en niet als "alles met een punt erin": een leesteken is geen regel,
      en de volgende die er een recht bij zet moet de keuze zien.
   3. EEN EXTERNE ZIET NIETS TENZIJ HET IS GEDEELD. Klanten, accountants,
      advocaten en freelancers krijgen de rol 'extern': die draagt geen enkel
      recht. Wat zij zien wordt per ruimte expliciet gedeeld -- afwezigheid is
      de standaard en niet de uitzondering. Daarom staat 'extern' hieronder ook
      met een LEGE rechtenlijst en niet als ontbrekende regel: een rol die er
      niet staat is een vergissing, een rol met nul rechten is een besluit. */
'use strict';

/* De inzage die een reden vraagt. Bewust een korte, expliciete lijst. */
const REDEN_NODIG = ['mens.gevoelig', 'klant.prijs', 'it.beveiliging', 'journaal'];

const RECHTEN = ['werkruimte', 'mens', 'mens.gevoelig', 'project', 'kennis', 'kennis.beheer',
  'klant', 'klant.prijs', 'service', 'bouw', 'geld', 'geld.goedkeuren', 'recht', 'it',
  'it.beveiliging', 'besluit', 'cijfer', 'journaal'];

const ROLLEN = [
  { id: 'directie', naam: 'Directie', rechten: ['werkruimte', 'mens', 'project', 'kennis', 'kennis.beheer', 'klant', 'klant.prijs', 'service', 'bouw', 'geld', 'geld.goedkeuren', 'recht', 'it', 'besluit', 'cijfer', 'journaal'] },
  { id: 'bestuur', naam: 'Bestuur of raad van commissarissen', rechten: ['cijfer', 'besluit', 'journaal'] },
  { id: 'hr', naam: 'HR', rechten: ['mens', 'mens.gevoelig', 'kennis'] },
  { id: 'financieel', naam: 'Financiën', rechten: ['geld', 'cijfer', 'klant'] },
  { id: 'verkoop', naam: 'Verkoop', rechten: ['klant', 'kennis'] },
  { id: 'service', naam: 'Klantenservice', rechten: ['service', 'klant', 'kennis'] },
  { id: 'engineering', naam: 'Ontwikkeling', rechten: ['bouw', 'project', 'kennis'] },
  { id: 'projectleider', naam: 'Projectleiding', rechten: ['project', 'kennis', 'cijfer'] },
  { id: 'jurist', naam: 'Juridische zaken', rechten: ['recht', 'besluit', 'kennis'] },
  { id: 'it', naam: 'IT en beveiliging', rechten: ['it', 'it.beveiliging', 'kennis'] },
  { id: 'marketing', naam: 'Marketing', rechten: ['kennis', 'klant'] },
  { id: 'medewerker', naam: 'Medewerker', rechten: ['kennis'] },
  { id: 'auditor', naam: 'Auditor (alleen lezen)', rechten: ['journaal', 'cijfer'], alleenLezen: true },
  { id: 'extern', naam: 'Externe (klant, accountant, advocaat, freelancer)', rechten: [] }
];

module.exports = { REDEN_NODIG, RECHTEN, ROLLEN };
