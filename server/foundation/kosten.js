/* WAT KOST DIT GEZIN, EN WIE BETAALT DAT.

   De RTFoundation is gratis voor elk gezin. Dit scherm laat zien wat dat
   betekent in euro's -- niet als rekening, maar als antwoord op een vraag die
   een gezin nooit hoeft te stellen en soms toch stelt: draag ik iemand iets bij?

   HET ANTWOORD KOMT EERST, HET BEDRAG DAARNA. Het veld `betaald` staat vooraan
   in het antwoord en zegt met zoveel woorden dat de RTFoundation dit betaalt en
   dat er nooit een rekening komt. Een kostenbeeld dat opent met een bedrag leest
   als een openstaande post, en dat is precies de indruk die hier niet mag
   ontstaan. LEVEN.md: nooit sturen, altijd openen -- en de bijdrage-spiegel is
   nooit vergelijkend, dus er staat ook geen "meer dan andere gezinnen" bij.

   ALLEEN DE BEHEERDER. Niet omdat het geheim is, maar omdat dit een cijfer over
   het HELE gezin is en een kind geen boodschap heeft aan wat het kost dat het
   sommen oefent. Dat is dezelfde regel waarom de progressielaag bij 18+ stopt:
   je legt een bedrag niet naast een kind neer.

   LAAT GEBONDEN. De kostenkern wordt in kernlaag4 gebouwd en deze router lang
   daarvoor; zonder kern antwoordt deze route dat de laag nog niet wakker is, en
   niet met een nul. */
'use strict';

module.exports = (ctx) => {
  const { router, gezinVan, beheerderVan } = ctx;
  let haalKosten = null;
  function setKostenHook(fn) { haalKosten = typeof fn === 'function' ? fn : null; }

  router.post('/kosten', (req, res) => {
    const g = gezinVan(req, res); if (!g) return;
    if (!beheerderVan(g, req, res)) return;
    const kosten = haalKosten && haalKosten();
    if (!kosten) return res.status(503).json({ error: 'De kostenlaag is nog niet wakker; probeer het zo weer.' });
    const p = /^\d{4}-\d{2}$/.test(String(req.body.periode || '')) ? String(req.body.periode) : kosten.periodeVan();
    const drager = kosten.drager('gezin', g.code);
    const o = kosten.voorDrager(p, drager);
    res.json({
      ok: true,
      betaald: {
        door: 'RTFoundation',
        zin: 'De RTFoundation betaalt dit. U krijgt hiervoor nooit een rekening.',
        rekening: false
      },
      periode: p,
      overzicht: o,
      zegtNiet: {
        nietGemeten: o.nietGemeten,
        toegerekend: 'Elektriciteit en serverhuur zijn niet per gebruiker te meten. Wat daarvan hier staat is een verdeling van de echte nota naar het gemeten gebruik, en draagt daarom de graad "vermoed".'
      }
    });
  });

  return { setKostenHook };
};
