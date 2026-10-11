/* DE TWEEDE MENS -- de handtekening onder een klaargezette geldhandeling.

   AFGESPLITST VAN ../geldketen.js (11 oktober 2026) toen dat bestand over de 10 KB
   ging. De naad is die van ./klaarzet.js: klaarzetten is voorbereiding, tekenen en
   uitvoeren zijn menselijke daden -- en dit is de eerste daarvan.
*/
'use strict';

const envelopLaag = require('../../envelop');

function maakTekenen({ voornemens, vindDossier, leg, noteer, bewaar }) {
  /* ------------------------------------------------------------------------
     DE TWEEDE MENS. Deze baan maakt GEEN eigen tweede-handtekeningmechanisme:
     kern/kantoor/tweedehandtekening.js is de deur en blijft dat. Wat hier gebeurt
     is dat diezelfde menselijke handeling ook het VOORNEMEN aftekent, zodat het
     besluit opnieuw langs het beleid gaat met de goedkeuring erin. Twee registers,
     een menselijke daad -- geen tweede poort.
     ---------------------------------------------------------------------- */
  function tekenAf({ id, door }) {
    const d = vindDossier(id);
    if (!d) return { status: 404, error: 'Er is geen geldketen met dit voornemen.' };
    const wie = String(door || '').slice(0, 60);
    if (!wie) return { status: 400, error: 'Wie tekent er af?' };

    const r = voornemens.tekenAf(id, { door: wie, context: { pad: d.pad } });
    const env = envelopLaag.maak({ kanaal: 'office', actor: null, classificatie: 'intern',
      correlatie: d.correlatie, oorzaak: d.envelop });
    if (!r.ok) {
      /* EEN VOORNEMEN DAT GEEN TWEEDE HANDTEKENING VRAAGT, HEEFT ER WEL EEN.
         Onder de goedkeuringsgrens van kern/commercie/besluit.js komt een
         voornemen meteen op GEKEURD, en dan weigert `tekenAf` met 409 ("alleen een
         wachtend voornemen wordt afgetekend"). Dat is geen ontbrekende tweede mens:
         de DEUR (kern/kantoor/tweedehandtekening.js) heeft er een geeist en die
         staat hier voor ons. Die as als `onbekend` wegschrijven zou de keten
         onterecht open laten staan -- en de mens die tekende uit het dossier
         wissen. Elke ANDERE weigering blijft wel een gat. */
      const geenTekenNodig = r.status === 409;
      leg(d, 'tweedeMens', geenTekenNodig
        ? { graad: 'gemeten', uitslag: wie,
            reden: 'een tweede mens op naam tekende aan de deur; het voornemen vroeg zelf geen ' +
              'handtekening omdat het besluit binnen het beleid viel (' + (r.error || '') + ')' }
        : { graad: 'onbekend', uitslag: 'geweigerd', reden: r.error || 'de tweede handtekening is niet gezet' });
      bewaar(d);
      noteer(env, geenTekenNodig ? 'geldketen.getekend.aan-de-deur' : 'geldketen.tekenen.geweigerd',
        { voornemen: id, door: geenTekenNodig ? wie : null, reden: r.error || null });
      return geenTekenNodig ? { status: 200, ok: true, aanDeDeur: true, reden: r.error } : r;
    }
    leg(d, 'tweedeMens', { graad: 'gemeten', uitslag: wie,
      reden: 'een tweede mens op naam heeft getekend; de laag weigert dezelfde persoon als de aanvrager' });
    const besluit = (r.voornemen && r.voornemen.besluit) || null;
    leg(d, 'autoriteit', { graad: 'gemeten', uitslag: besluit ? besluit.uitkomst : null,
      reden: (besluit && besluit.reden) || 'het besluit is na de handtekening opnieuw gewogen' });
    /* EN HET BEWIJS DAT DAT NIEUWE BESLUIT MEEGAF. Boven de goedkeuringsgrens kreeg het
       voornemen bij het klaarzetten GEEN token (het besluit was "wacht op een tweede
       mens"); pas de keuring na deze handtekening munt er een. Deze as bleef dan op
       `onbekend` staan terwijl de uitvoering het token wel inleverde, dus elk dossier
       boven de duizend euro heette niet rond om een as die WEL gelopen was. Gevonden door
       de tweede keten (de reisteruggave, 11 oktober 2026): de incassoronde in de proef
       bleef onder de grens en zag het nooit. Zonder token blijft de as wat hij was. */
    if (r.voornemen && r.voornemen.heeftBewijs)
      leg(d, 'bewijsDraagt', { graad: 'gemeten', uitslag: 'token bij het voornemen',
        reden: 'het besluit na de tweede handtekening gaf een bewijstoken mee; de uitvoering levert hem in' });
    bewaar(d);
    noteer(env, 'geldketen.getekend', { voornemen: id, door: wie, stand: r.voornemen && r.voornemen.stand });
    return r;
  }

  return tekenAf;
}

module.exports = { maakTekenen };
