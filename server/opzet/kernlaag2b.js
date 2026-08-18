/* DE KERN SAMENSTELLEN -- deel 2b: DE INSTELLINGEN EN HUN WERELDEN.

   Uit ./kernlaag2.js geknipt op de 10 kB-grens, en op een echte naad: dit gaat
   niet over nog een dienst in de leden-app maar over de instellingen die de
   wereld zelf vormen -- de gemeente en het rijk -- plus de deur waardoor ze
   binnenkomen. Ze horen bij elkaar en veranderen om dezelfde reden.

   DE VOLGORDE IS DE INHOUD, net als in de andere ophanglijsten: eerst de deur
   (instelling), dan de werelden die erdoorheen komen. Gemount aan het eind van
   kernlaag2, dus alles wat daar hierboven staat bestaat al. */
'use strict';

module.exports = (kern, hulp) => {
  const { accounts, anthropic, crypto, db, findSupplier, notify, notifySupplier, save, sseToSupplier } = hulp;

/* DE INSTELLINGSWEG (kern/instelling.js): hoe een echte gemeente, luchthaven of
   vervoerder hier terechtkomt. Acht genres staan op 'intern' en worden dus
   nooit via het partnerformulier aangevraagd -- maar ze kwamen ook alleen uit
   de demo-seed, dus zonder deze deur bleven die werelden op een echte
   installatie voorgoed leeg. De bouwstenen komen van `kern`: dezelfde als bij
   een goedgekeurde partneraanvraag, zodat er geen tweede manier ontstaat om een
   werkplek te maken. */
Object.assign(kern, require('../kern/instelling').maakInstelling({ db, save, accounts,
  ensureSupplierDefaults: kern.ensureSupplierDefaults, makeSupplierCode: kern.makeSupplierCode }));
/* RTG Gemeente (kern/gemeente.js): het civiele systeem als partner-genre.
   Vier pijlers (meldingen openbare ruimte, burgerzaken/afspraken, vergunningen,
   afval/belasting/bestuur) voor inwoners, gemeente-medewerkers en partners. */
Object.assign(kern, require('../kern/gemeente').maakGemeente({ db, save, crypto, anthropic,
  findSupplier, notify, notifySupplier, sseToSupplier, weefsel: kern.weefsel }));
// de gemeente-partner en zijn config bestaan meteen bij het opstarten, zodat een
// medewerker kan inloggen ook zonder dat er eerst een inwoner iets deed
kern.gemeente.seed();
/* De Overheid (kern/overheid/): Berichtenbox, Belastingdienst, RDW, KVK,
   sociale zekerheid en een referendum. */
// de bank gaat LAAT (komt pas in kernlaag4b); zie kern/overheid/naheffing-betalen.js
Object.assign(kern, require('../kern/overheid').maakOverheid({ db, save, crypto, anthropic,
  findSupplier, notify, notifySupplier, sseToSupplier,
  bankLive: () => !!(kern.bank && kern.bankLedenAan && kern.bankLedenAan()),
  bankBoek: o => kern.bank.boekAsync(o), bankSaldo: i => kern.bank.saldoVan(i) }));
kern.overheid.seed();
// de RTG-vloot (autoverhuur, tweewielers) meteen in het RDW-register, zodat een
// kenteken-check op een huurauto de APK-status teruggeeft
kern.overheid.registreerVloot();
};
