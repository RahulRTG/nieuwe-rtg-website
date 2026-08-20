/* WAT ER GEBEURT ALS HET TEGOED OP IS.

   ../tegoed.js is de administratie: rijen, verbruik boeken, bundels bijschrijven.
   Dit bestand beantwoordt een vraag, en het is de belangrijkste van de laag: MAG
   deze aanroep nog, en zo nee -- wat kan de klant dan wel?

   HET STAAT APART OMDAT HET EEN BESLUIT IS EN GEEN BOEKHOUDING. Wie de
   plafondregels tussen de opslagcode zet, krijgt een bestand waarin een
   productbelofte en een databewerking om elkaar heen staan, en dan verandert er
   een keer iets aan de opslag waardoor het besluit meeschuift.

   "NEE" ZONDER UITWEG IS PRECIES HET MOMENT waarop een restaurant op
   vrijdagavond vastloopt. Elk antwoord draagt daarom een reden EN, als het nee
   is, wat de klant kan doen.

   REGEL 6 VAN DE EIGENAAR: geen abonnement mag ooit ongemerkt variabele kosten
   veroorzaken. Wat er boven het plafond gebeurt is dus de KEUZE van de klant --
   stoppen, vragen, automatisch aanvullen of op contract -- en automatisch
   aanvullen vraagt een maandmaximum. Dat maximum telt de bundelprijs mee: hij
   stond hier op nul zolang de inkoopkant niet bestond, en een maximum waar niets
   tegenaan telt is geen maximum. */
'use strict';

const caps = require('../capaciteiten');
const { BUNDELS, BELEID, WAARSCHUWING } = require('./inhoud');

/* DE VRAAG DIE VOORAF WORDT GESTELD. Geeft altijd een antwoord met een reden
   en, als het nee is, met wat de klant kan doen -- want "nee" zonder uitweg is
   precies het moment waarop een restaurant op vrijdagavond vastloopt. */
function magVerbruiken(r, kosten, opties) {
const c = Math.max(0, Math.round(Number(kosten) || 1));

  if (!caps.mag(r.pas, 'can_use_ai'))
    return { mag: false, reden: 'geen-ai', uitleg: 'Dit abonnement bevat geen AI-assistent.', bundels: [] };

  // contractueel: de hoogte staat op het contract, en zonder contractwaarde is
  // er geen plafond dat deze laag kent
  if (r.inbegrepen === null)
    return { mag: true, reden: 'contract', uitleg: 'De capaciteit staat op het contract.', rest: null };

  const beschikbaar = r.inbegrepen + r.bijgekocht - r.verbruikt;
  if (c <= beschikbaar) {
    const na = beschikbaar - c;
    const deel = r.inbegrepen + r.bijgekocht > 0 ? 1 - na / (r.inbegrepen + r.bijgekocht) : 1;
    return { mag: true, reden: 'binnen-tegoed', rest: na, gebruiktDeel: Math.min(1, Math.max(0, deel)),
      waarschuwing: deel >= WAARSCHUWING };
  }

  /* Over het plafond. Wat er nu gebeurt, is de KEUZE van de klant en niet van
     ons -- dat is regel 6. */
  const bundelsUit = Object.values(BUNDELS).filter(b => b.credits).map(b => ({ ...b }));
  if (r.beleid === BELEID.AUTO_AANVULLEN && r.autoBundel && BUNDELS[r.autoBundel]) {
    /* De prijs van de bundel telt mee in het maandmaximum. Stond hier nul
       zolang de inkoopkant niet bestond -- en een maximum waar niets tegenaan
       telt, is geen maximum. `prijsVan` komt via opties mee, want deze module
       kent de boardroom-instelling niet. */
    const kosten2 = Number.isFinite(((opties || {}).bundelPrijs || {}).centen) ? opties.bundelPrijs.centen : 0;
    const overMax = Number.isFinite(r.maandMaxCenten) &&
      (r.autoDezeMaandCenten + kosten2) > r.maandMaxCenten;
    if (overMax)
      return { mag: false, reden: 'maandmaximum', tekort: c - beschikbaar,
        uitleg: 'Het maandmaximum voor automatisch bijkopen is bereikt. Koop handmatig bij of verhoog het maximum.',
        bundels: bundelsUit };
    return { mag: true, reden: 'auto-aangevuld', bundel: r.autoBundel, tekort: c - beschikbaar,
      uitleg: 'Het tegoed is aangevuld met ' + BUNDELS[r.autoBundel].naam + '.' };
  }
  if (r.beleid === BELEID.CONTRACT)
    return { mag: true, reden: 'contract-overschot',
      uitleg: 'Het overschot loopt op het contract en wordt achteraf verrekend.' };

  return { mag: false, reden: r.beleid === BELEID.STOP ? 'gestopt' : 'plafond',
    tekort: c - beschikbaar,
    uitleg: r.beleid === BELEID.STOP
      ? 'Het tegoed is op en dit abonnement staat op "stoppen bij de limiet"; er worden geen extra kosten gemaakt.'
      : 'Het tegoed is op. Koop een bundel bij of zet automatisch aanvullen aan.',
    bundels: bundelsUit };
}

module.exports = { magVerbruiken };
