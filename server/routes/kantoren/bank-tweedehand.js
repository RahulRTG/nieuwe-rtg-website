/* Kantoren, deel "bank-tweedehand": de twee bankhandelingen die een TWEEDE MENS
   vragen, en het loket waar die tweede mens tekent.

   WAAROM DEZE TWEE EN NIET MEER. `scripts/overleving.js` had één rij die met
   zoveel woorden `nee` zei -- *een medewerker handelt te kwader trouw, in zijn
   eentje* -- en de grond eronder was gemeten: een medewerker op naam kon in zijn
   eentje rood-staan-ruimte geven en een incassoronde starten, en
   `KANTOORMACHT.json` telde NUL kantoorroutes met een tweede handtekening.

     rood staan   is geld maken met een extra stap. Wie het zelf kan zetten en
                  zelf kan opnemen, heeft geen inbraak nodig.
     de incasso   int bij leden, van veel rekeningen tegelijk, en is niet met een
                  knop terug te draaien: elke uitgevoerde betaling is een eigen
                  boeking.

   BEVRIEZEN STAAT ER MET OPZET NIET BIJ, en dat is een besluit van de eigenaar
   (9 september 2026) en geen vergeetachtigheid. Bevriezen is omkeerbaar EN het
   is de knop waarmee je een fraude STOPT. Twee mensen eisen voordat een rekening
   dicht kan, maakt de rem trager dan de diefstal -- dat is zelf een risico, en
   een strengere deur is niet vanzelf een veiligere.

   DE UITVOERING STAAT HIER EN NIET BIJ DE ROUTE. Wat er gebeurt zodra de tweede
   handtekening staat, hoort bij de HANDELING en niet bij de deur waar hij
   toevallig is aangevraagd -- de aanvraag komt uit ./bank-rekeningen.js, de
   bevestiging uit dit bestand, en beide voeren dezelfde geregistreerde functie
   uit. Een tweede plek waar "wat rood staan doet" zou staan, is precies de
   dubbeling die LAT.md regel 4 verbiedt.

   De lifecycle zelf (bevroren lijf, verlooptijd, de vergelijking van twee
   mensen) staat in kern/kantoor/tweedehandtekening.js; zie de kop daar. */
'use strict';

module.exports = (ctx) => {
  const { app, kluisAuth, veilig, afdelingen, sseToOffice, kern, tweedeHand } = ctx;
  const bank = kern.bank;
  const sync = () => sseToOffice('sync', { scope: 'bank' });

  tweedeHand.registreer('bank.rood', {
    wat: 'rood-staan-ruimte op een bankrekening zetten',
    voerUit: (lijf) => {
      const r = bank.rekeningRoodZet(String(lijf.iban || ''), lijf.euro);
      if (r.ok) { afdelingen.audit('tweede handtekening', 'Rood-staan-ruimte op ' + r.iban + ' gezet op € ' + (r.roodLimiet / 100).toFixed(2)); sync(); }
      return r;
    }
  });

  /* DE INCASSORONDE LOOPT VIA DE GELDKETEN, EN NERGENS OMHEEN (MACHINE.md).

     De aanvraag heeft de hele baan al gelopen (./bank-rekeningen.js): assurance,
     mandaat, streefstand, tegenfeit, frictie, gevolg, en een VOORNEMEN met een
     besluit en een bewijstoken. Wat hier gebeurt is het sluitstuk, en het is EEN
     menselijke daad die in twee registers landt:

       1. het voornemen wordt afgetekend door deze tweede mens -- waarna het
          besluit opnieuw langs het beleid gaat, nu MET de goedkeuring erin;
       2. de uitvoering loopt door kern/commercie/voornemen/uitvoeren.js, die de
          vingerafdruk nakijkt, het bewijstoken inlevert en de veiligheidskern
          langsgaat voordat er een cent beweegt.

     ER KOMT GEEN TWEEDE TWEEDE-HANDTEKENING BIJ: deze deur BLIJFT de deur. Het
     voornemen weigert zelf al een handtekening van dezelfde persoon, en die
     vergelijking staat hierboven op de harde sleutel -- twee mechanismen voor
     dezelfde garantie is de dubbeling die LAT.md regel 4 verbiedt.

     EEN AANVRAAG ZONDER VOORNEMEN GAAT NIET DOOR. Dat is geen strengheid om de
     strengheid: een openstaande aanvraag van voor deze verandering zou anders
     stilletjes de oude weg nemen -- geld dat beweegt zonder besluit, zonder
     bewijs en zonder spoor. Hij weigert met de weg erbij (opnieuw aanvragen). */
  tweedeHand.registreer('bank.incasso', {
    wat: 'een incassoronde draaien (vaste betalingen innen)',
    voerUit: async (lijf, wie) => {
      const ketenlaag = kern.geldketen;
      if (!ketenlaag) return { status: 503,
        error: 'De geldketen is niet gemount; een incassoronde gaat niet buiten de keten om.' };
      const vid = lijf && lijf.voornemen ? String(lijf.voornemen) : '';
      if (!vid) return { status: 409,
        error: 'Deze aanvraag draagt geen voornemen en is van voor de geldketen. Vraag de ' +
          'incassoronde opnieuw aan; dan loopt zij langs het besluit en het bewijs.' };

      const bevestiger = (wie && wie.bevestigdDoor) || null;
      const tekenen = ketenlaag.tekenAf({ id: vid, door: bevestiger });
      /* Een voornemen dat NIET op WACHT stond, hoeft niet te worden afgetekend --
         een klein bedrag komt door de keuring zonder tweede handtekening. Dan is
         409 hier geen fout maar de normale gang, en de uitvoering gaat door. Elke
         ANDERE weigering stopt de handeling: zonder geldige stand voert
         kern/commercie/voornemen/uitvoeren.js niets uit. */
      if (tekenen && tekenen.error && tekenen.status !== 409) return tekenen;

      const r = await ketenlaag.uitvoer({ id: vid, door: bevestiger,
        doe: async (stap) => bank.bankIncassoRonde({ tot: Number(stap.gegevens && stap.gegevens.tot) }) });
      if (r && r.ok) {
        /* De uitkomst van de ronde zit IN de stap en niet naast het antwoord:
           kern/commercie/voornemen/uitvoeren.js hangt wat `doe` teruggaf aan
           `stappen[].uitkomst`. Dat verkeerd lezen zou hier een auditregel met
           "? betalingen, EUR 0,00" opleveren terwijl de ronde gewoon liep -- een
           spoor dat naast de waarheid staat is erger dan geen spoor. */
        const stap = (r.voornemen && r.voornemen.stappen && r.voornemen.stappen[0]) || null;
        const uit = (stap && stap.uitkomst) || {};
        afdelingen.audit('tweede handtekening', 'Incassoronde uit voornemen ' + vid + ': ' +
          (uit.uitgevoerd != null ? uit.uitgevoerd : '?') + ' vaste betaling(en), € ' +
          ((Number(uit.bedragCenten) || 0) / 100).toFixed(2));
        sync();
      }
      return r;
    }
  });

  /* HET LOKET. Alle drie achter `kluisAuth`, want alle drie vragen ze een naam:
     bevestigen spreekt voor zich, maar ook LEZEN wat er openstaat hoort bij een
     mens -- de lijst zegt welke rekeningen er op tafel liggen. Intrekken mag
     door iedereen met een kantooraccount, ook de aanvrager zelf: een aanvraag
     terugnemen maakt niets kapot, en er een ceremonie omheen zetten levert
     alleen aanvragen op die blijven staan tot ze verlopen. */
  app.post('/api/office/bank/handtekening/open', kluisAuth, (req, res) =>
    veilig(res, () => tweedeHand.open()));

  app.post('/api/office/bank/handtekening/bevestig', kluisAuth, async (req, res) => {
    const r = await tweedeHand.bevestig({ id: String((req.body || {}).id || ''), door: req.officeKey });
    veilig(res, () => {
      if (r.ok) afdelingen.audit(req.officeKey, 'Tweede handtekening gezet op "' + r.wat +
        '" (aangevraagd door ' + r.aangevraagdDoor + ')');
      return r;
    });
  });

  app.post('/api/office/bank/handtekening/intrek', kluisAuth, (req, res) => veilig(res, () => {
    const r = tweedeHand.annuleer({ id: String((req.body || {}).id || ''), door: req.officeKey });
    if (r.ok) afdelingen.audit(req.officeKey, 'Aanvraag ingetrokken: ' + r.ingetrokken.wat);
    return r;
  }));
};
