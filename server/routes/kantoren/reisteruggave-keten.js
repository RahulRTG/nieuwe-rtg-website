/* Kantoren, deel "reisteruggave-keten": DE TERUGGAVE NA DE TWEEDE HANDTEKENING.

   AFGESPLITST VAN ./reisteruggave.js toen dat over de 10 KB ging, op dezelfde naad
   als ./bank-tweedehand.js tegenover ./bank-incasso.js: de route zet klaar, en wat
   er gebeurt zodra de handtekening staat hoort bij de HANDELING en niet bij de deur
   waar hij is aangevraagd.

   Gemount vanuit ./reisteruggave.js, met dezelfde context. */
'use strict';

module.exports = (ctx) => {
  const { afdelingen, kern, tweedeHand } = ctx;
  const rb = () => kern.reisbetaling;

  /* VANAF DE VIER-OGENGRENS LOOPT DE TERUGGAVE DOOR DE GELDKETEN (MACHINE.md), en
     nergens omheen -- zelfde vorm als de incassoronde (./bank-tweedehand.js).

     De aanvraag heeft de baan tot het besluit al gelopen (hieronder, bij de route):
     assurance, mandaat, streefstand, tegenfeit, frictie, gevolg, en een VOORNEMEN met
     een besluit en een bewijstoken. Hier komt het sluitstuk, als EEN menselijke daad
     in twee registers: de tweede mens tekent het voornemen af, en de uitvoering gaat
     door kern/commercie/voornemen/uitvoeren.js (vingerafdruk, bewijstoken,
     veiligheidskern) voordat er een cent beweegt.

     EEN AANVRAAG ZONDER VOORNEMEN GAAT NIET DOOR. Een openstaande aanvraag van voor
     deze verandering zou anders stil de oude weg nemen: geld zonder besluit, zonder
     bewijs en zonder spoor. Hij weigert met de weg erbij.

     EEN WEIGERING VAN HET DOMEIN IS EEN WEIGERING VAN DE STAP. `teruggaveUitvoeren`
     antwoordt met een status en gooit niet; zou die uitkomst gewoon worden
     teruggegeven, dan zet de uitvoerlaag het voornemen op UITGEVOERD terwijl er geen
     cent bewoog. Daarom wordt hij hier een fout, en dan staakt het voornemen met de
     reden erbij. */
  tweedeHand.registreer('reisbureau.teruggave', {
    wat: 'een betaalde reis terugbetalen aan het lid', geld: true,
    voerUit: async (lijf, wie) => {
      const ketenlaag = kern.geldketen;
      if (!ketenlaag) return { status: 503,
        error: 'De geldketen is niet gemount; een teruggave vanaf de vier-ogengrens gaat niet buiten de keten om.' };
      const vid = lijf && lijf.voornemen ? String(lijf.voornemen) : '';
      if (!vid) return { status: 409,
        error: 'Deze aanvraag draagt geen voornemen en is van voor de geldketen. Vraag de teruggave ' +
          'opnieuw aan; dan loopt zij langs het besluit en het bewijs.' };
      const bevestiger = (wie && wie.bevestigdDoor) || null;
      const tekenen = ketenlaag.tekenAf({ id: vid, door: bevestiger });
      if (tekenen && tekenen.error && tekenen.status !== 409) return tekenen;

      let domein = null;
      const r = await ketenlaag.uitvoer({ id: vid, door: bevestiger, verzoek: wie && wie.verzoek,
        doe: async (stap) => {
          domein = await rb().teruggaveUitvoeren({ id: stap.gegevens && stap.gegevens.id,
            door: wie && wie.aangevraagdDoor, tweede: bevestiger });
          if (!domein || !domein.ok) throw new Error((domein && domein.error) || 'de teruggave is niet geboekt');
          return { recht: domein.recht.id, centen: domein.recht.centen,
            delen: (domein.recht.besluit && domein.recht.besluit.delen) || null };
        } });
      if (r && r.ok && domein && domein.ok) {
        afdelingen.audit('tweede handtekening', 'Reisbureau: teruggave ' + domein.recht.id + ' uitgevoerd (' +
          (domein.recht.centen / 100).toFixed(2) + ' EUR, reis ' + domein.recht.ref + ', voornemen ' + vid + ')');
        /* Het contract van voor de keten blijft: het antwoord draagt het recht. De keten
           komt ERBIJ (het voornemen), niet in plaats van. */
        return { status: 200, ok: true, recht: domein.recht, voornemen: r.voornemen };
      }
      /* Weigerde het domein, dan is ZIJN antwoord de reden (een 409 blijft een 409). */
      if (domein && !domein.ok) return Object.assign({}, domein, { voornemen: r && r.voornemen });
      return r;
    }
  });
};
