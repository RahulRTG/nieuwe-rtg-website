/* HET PLAN WEGEN -- het voornemen opstellen, keuren, en de baan dichtzetten.

   AFGESPLITST VAN ./klaarzet.js toen dat over de 10 KB ging, en de naad is de
   goede: hierboven worden de assen VASTGESTELD (wie, met welke zekerheid, binnen
   welke grens), hier wordt het PLAN gewogen. Dat tweede is het enige deel waar een
   besluit valt, en het hoort in een bestand dat je in zijn geheel kunt lezen.

   DE KEURING GAAT OVER HET TOTAAL. Vijf keer 190 euro is geen vijf kleine
   besluiten maar een van 950, en die zin hoort een mens te lezen VOORDAT er iets
   gebeurt. De keuring zelf staat in kern/commercie/voornemen/keuring.js; hier komt
   alleen het antwoord in het dossier.
*/
'use strict';

const envelopLaag = require('../../envelop');
const { KLASSEN } = require('./klassen');

function maakWeging({ voornemens, tijd, leg, noteer, bewaar, publiek }) {
  /* De aanroeper in ./klaarzet.js heeft de assen al gevuld en geeft het dossier,
     de envelop, de klasse en de MENS mee. Die laatste staat er apart bij en wordt
     hier niet uit het dossier gevist: het voornemen hangt aan de naam van de
     aanvrager, en een tweede plek die uitrekent wie dat was, is een tweede
     waarheid over de actor. */
  return function weeg(o, dossier, env, klasse, mens) {
      /* 8. HET VOORNEMEN. Het totaal wordt gewogen VOOR de eerste boeking; de
            keuring haalt het besluit (autoriteit) en het bewijstoken erbij. */
      const opgesteld = voornemens.stelOp({ actor: mens.naam, handeling: o.handeling,
        doel: dossier.doel, stappen: o.stappen, sleutel: o.sleutel });
      if (!opgesteld.ok) return opgesteld;
      const vid = opgesteld.voornemen.id;
      dossier.voornemen = vid;
      leg(dossier, 'voornemen', { graad: 'gemeten', uitslag: opgesteld.voornemen.stand,
        totaalCenten: opgesteld.voornemen.totaalCenten, hergebruikt: !!opgesteld.hergebruikt,
        reden: 'het hele plan is opgesteld en het totaal staat vast voordat er iets gebeurt' });

      /* DE ECONOMISCHE SLEUTEL. Hij komt van de aanroeper en NOOIT van de client:
         twee medewerkers die allebei op de knop drukken, sturen twee verschillende
         client-sleutels en innen twee keer. */
      leg(dossier, 'idempotentie', { graad: o.sleutel ? 'gemeten' : 'onbekend',
        uitslag: o.sleutel || null,
        reden: o.sleutel
          ? 'de sleutel hangt aan de handeling zelf, dus een tweede verzoek is hetzelfde voornemen'
          : 'er is geen economische sleutel meegegeven; een herhaling is dan een tweede handeling' });
      leg(dossier, KLASSEN[klasse].verplicht.includes('atomair') ? 'atomair' : 'hervatbaar',
        o.uitvoerbelofte || { graad: 'onbekend', uitslag: null,
          reden: 'de aanroeper heeft niet gezegd hoe de uitvoering zich houdt als zij halverwege faalt' });

      /* EEN HERHAALDE AANVRAAG KEURT NIET OPNIEUW, en dat is precies waar de
         economische sleutel voor is. `stelOp` geeft bij dezelfde sleutel HETZELFDE
         voornemen terug (`hergebruikt`), en dat stond hier vervolgens opnieuw langs
         de keuring -- die dan terecht 409 gaf ("een voornemen in stand GEKEURD
         wordt niet opnieuw gekeurd"). Een tweede klik op dezelfde knop kreeg dus
         een fout terwijl er niets mis was: de idempotentie werkte en de baan
         struikelde eroverheen. Gevonden door de e2e-proef in
         test/tweedehandtekening.test.js, niet door een unittoets.

         OPGESTELD en WACHT gaan WEL opnieuw langs de keuring: dan is er nog geen
         besluit, of het wacht op een handtekening, en dat is exact wat `keur` zelf
         toelaat. */
      const herbruik = opgesteld.hergebruikt && opgesteld.voornemen.stand !== 'OPGESTELD' &&
        opgesteld.voornemen.stand !== 'WACHT';
      const gekeurd = herbruik
        ? { status: 200, ok: true, voornemen: voornemens.publiek(voornemens.vind(vid)), hergebruikt: true }
        : voornemens.keur(vid, { context: { pad: o.pad, door: mens.naam } });
      const stand = (gekeurd.voornemen && gekeurd.voornemen.stand) || null;
      const besluit = (gekeurd.voornemen && gekeurd.voornemen.besluit) || null;
      if (!gekeurd.ok) {
        leg(dossier, 'autoriteit', { graad: 'onbekend', uitslag: null,
          reden: 'de keuring kwam niet tot een besluit: ' + (gekeurd.error || 'onbekende storing') });
        bewaar(dossier);
        noteer(env, 'geldketen.klaarzet.gestrand', { voornemen: vid, klasse, fout: gekeurd.error || null });
        return gekeurd;
      }
      leg(dossier, 'autoriteit', { graad: 'gemeten', uitslag: besluit ? besluit.uitkomst : null,
        reden: (besluit && besluit.reden) || 'de bevoegdheid en het beleid zijn gewogen over het TOTAAL' });
      leg(dossier, 'bewijsDraagt', gekeurd.voornemen && gekeurd.voornemen.heeftBewijs
        ? { graad: 'gemeten', uitslag: 'token bij het voornemen',
            reden: 'het besluit gaf een bewijstoken mee; de uitvoering levert hem in' }
        : { graad: 'onbekend', uitslag: null,
            reden: 'er is geen bewijstoken gemunt (geen ondertekensleutel, of het besluit gaf er geen); ' +
              'de uitvoering draait dan op de STAND van het voornemen en niet op meegedragen bewijs' });
      leg(dossier, 'envelop', { graad: 'gemeten', uitslag: env.id,
        reden: 'elke stap van deze baan draagt dezelfde correlatie, en elk gevolg weet waardoor het ontstond' });

      const schakel = noteer(env, 'geldketen.klaargezet', { voornemen: vid, klasse,
        totaalCenten: opgesteld.voornemen.totaalCenten, stand, door: mens.naam });
      dossier.keten = schakel.hash;
      leg(dossier, 'bewijsketen', { graad: 'gemeten', uitslag: schakel.hash,
        reden: 'deze stap hangt in een hashketen (lib/keten.js) die niet te herschrijven is zonder dat het opvalt' });
      leg(dossier, 'tweedeMens', { graad: 'onbekend', uitslag: null,
        reden: 'er heeft nog niemand getekend; deze as vult zich bij de bevestiging' });
      bewaar(dossier);

      return { status: 200, ok: true, voornemen: gekeurd.voornemen, dossier: publiek(dossier),
        envelop: { id: env.id, correlatie: env.correlatie } };
  };
}

module.exports = { maakWeging };
