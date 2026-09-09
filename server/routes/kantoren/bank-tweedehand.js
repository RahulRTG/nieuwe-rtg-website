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

  tweedeHand.registreer('bank.incasso', {
    wat: 'een incassoronde draaien (vaste betalingen innen)',
    voerUit: async (lijf) => {
      const r = await bank.bankIncassoRonde(lijf && lijf.tot != null ? { tot: Number(lijf.tot) } : {});
      if (r.ok && r.uitgevoerd > 0) { afdelingen.audit('tweede handtekening', 'Incassoronde: ' + r.uitgevoerd + ' vaste betaling(en), € ' + (r.bedragCenten / 100).toFixed(2)); sync(); }
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
