/* Routes "festival" (deelmodule): DE GASTENKANT.

   DE TWEEDE LEDENKANT VAN DIT DOMEIN, naast ./groep.js -- en met dezelfde
   opbouw, want het is dezelfde soort gebruiker. Alles hier hangt aan `auth` en
   niet aan `supplierAuth`: dit is een lid, geen zaak.

   DE CODENAAM KOMT UIT DE SESSIE. Voor de zevende keer in dit domein, en hier
   met de scherpste gevolgen van allemaal: zou hij uit het lichaam komen, dan
   leest iedereen de PASCODE van iedereen. Een pascode is het toegangsbewijs;
   wie hem heeft, staat binnen.

   ER IS GEEN ROUTE DIE FESTIVALS OPSOMT. Een lid ziet de edities waar hij zelf
   iets heeft (een pas, een groep) en verder niets. Een publieke lijst zou een
   marketingpagina zijn, en die zijn er in dit huis bewust uit. */
'use strict';

module.exports = (kern) => {
  const { app, auth, festival, geenGast, liveCodename } = kern;

  const httpCode = (v) => (Number.isInteger(v) && v >= 100 && v <= 599 ? v : 200);
  const stuur = (res, r) => res.status(httpCode(r && r.status)).json(r);

  app.post('/api/festival/gast/edities', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, festival.gastEdities(liveCodename(req.session)));
  });

  app.post('/api/festival/gast/passen', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const b = req.body || {};
    stuur(res, festival.gastPassen(String(b.festival || ''), String(b.editie || ''),
      liveCodename(req.session)));      // uit de SESSIE, nooit uit het lichaam
  });

  /* Het programma is niet persoonlijk, maar staat toch achter `auth`: er is in
     dit huis geen publieke kant, en een line-up is het eerste dat er een van
     zou maken. */
  app.post('/api/festival/gast/programma', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const b = req.body || {};
    stuur(res, festival.gastProgramma(String(b.festival || ''), String(b.editie || ''), b.dag));
  });
};
