/* Kantoren, deel "reisteruggave": HET TERUGGAVERECHT VAN EEN REIS UITVOEREN.

   Een betaalde reis die wordt afgezegd of teruggeboekt, laat een RECHT achter
   (kern/reisbureau-teruggave.js). Dat recht stond klaar met "een mens van het
   kantoor voert hem uit langs kern/pay" -- en er was geen deur om dat te doen
   (Fase 0, defect D8). Dit is die deur.

   DRIE REGELS, alle drie besluiten van de eigenaar:
   - WIE het doet komt uit de sessie, nooit uit het lijf: kluisAuth, dus de
     gedeelde kantoorcode komt er niet in (AUTHORITY.md, P0b).
   - Geld op kantoor gaat met een PASSKEY, zonder terugval (25 september 2026),
     gebonden aan dit ene recht ('teruggave:' + id).
   - Vanaf DUIZEND EURO tekent een TWEEDE mens (4 oktober 2026; dezelfde grens
     als BELEID.goedkeuringBovenCenten in kern/commercie/besluit.js). Die tekent
     bij de bestaande bevestigroute van de tweede handtekening, met zijn eigen
     passkey (./bank-passkey.js) -- er komt hier geen tweede vier-ogenmechanisme.

   Afwijzen beweegt geen geld en vraagt daarom geen passkey, wel een naam en een
   reden die het lid leest. */
'use strict';

const { BELEID } = require('../../kern/commercie/besluit');

module.exports = (ctx) => {
  const { app, kluisAuth, veilig, afdelingen, kern, zwaar, boardroomUser, tweedeHand } = ctx;
  const rb = () => kern.reisbetaling;
  const VIER_OGEN_VANAF = BELEID.goedkeuringBovenCenten;

  tweedeHand.registreer('reisbureau.teruggave', {
    wat: 'een betaalde reis terugbetalen aan het lid', geld: true,
    voerUit: async (lijf, wie) => {
      const r = await rb().teruggaveUitvoeren({ id: lijf.id, door: wie && wie.aangevraagdDoor, tweede: wie && wie.bevestigdDoor });
      if (r && r.ok) afdelingen.audit('tweede handtekening', 'Reisbureau: teruggave ' + r.recht.id + ' uitgevoerd (' +
        (r.recht.centen / 100).toFixed(2) + ' EUR, reis ' + r.recht.ref + ')');
      return r;
    }
  });

  // wat er klaarstaat: open rechten, nieuwste laatst
  app.post('/api/office/reisbureau/teruggaven', kluisAuth, (req, res) => veilig(res, () => ({
    open: rb().teruggavenOpen(), vierOgenVanafCenten: VIER_OGEN_VANAF,
    let: 'Een afgezegde of teruggeboekte reis laat een recht achter. Uitvoeren of afwijzen is een besluit van een mens; er gebeurt hier niets vanzelf.' })));

  // de ceremonie, gebonden aan dit ene recht
  app.post('/api/office/reisbureau/teruggave/opties', kluisAuth, async (req, res) => {
    const id = String((req.body || {}).id || '');
    if (!rb().teruggaveVan(id)) return res.status(404).json({ error: 'Dit teruggaverecht bestaat niet.' });
    const r = await zwaar.opties(boardroomUser(req), 'reisbureau.teruggave', 'teruggave:' + id, req);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });

  app.post('/api/office/reisbureau/teruggave', kluisAuth, async (req, res) => {
    const b = req.body || {};
    const id = String(b.id || '');
    const recht = rb().teruggaveVan(id);
    if (!recht) return res.status(404).json({ error: 'Dit teruggaverecht bestaat niet.' });
    /* EERST DE STAND: anders opent een besloten recht een nieuwe aanvraag voor
       een tweede mens, die pas bij het tekenen zou zakken. */
    if (recht.uitgevoerd || recht.besluit) return res.status(409).json({ error: 'Hierover is al besloten (' + (recht.uitgevoerd ? 'uitgevoerd' : 'afgewezen') + ').' });
    if (b.besluit === 'afgewezen') {
      return veilig(res, () => {
        const r = rb().teruggaveAfwijzen({ id, door: req.officeKey, reden: b.reden });
        if (r.ok) afdelingen.audit(req.officeKey, 'Reisbureau: teruggave ' + id + ' afgewezen');
        return r;
      });
    }
    if (b.besluit !== 'uitvoeren') return res.status(400).json({ error: 'Een besluit is "uitvoeren" of "afgewezen".' });
    const zw = await zwaar.eis(boardroomUser(req), 'reisbureau.teruggave', 'teruggave:' + id, req,
      'Een teruggave van een reis', { zonderTerugval: true });
    if (!zw.ok) return zwaar.stuur(res, zw);
    if (recht.centen >= VIER_OGEN_VANAF) {
      return veilig(res, () => tweedeHand.vraag({ actie: 'reisbureau.teruggave', lijf: { id },
        onderwerp: id, door: req.officeKey }));
    }
    const r = await rb().teruggaveUitvoeren({ id, door: req.officeKey });
    veilig(res, () => {
      if (r.ok) afdelingen.audit(req.officeKey, 'Reisbureau: teruggave ' + id + ' uitgevoerd (' + (recht.centen / 100).toFixed(2) + ' EUR)');
      return r;
    });
  });
};
