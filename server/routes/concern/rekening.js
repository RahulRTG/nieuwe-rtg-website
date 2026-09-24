/* Routes "concern" (deel): de RTG-rekening op naam van een entiteit
   (kern/bank/entiteit.js, besluit van de eigenaar van 24 september 2026).

   Alleen de eigenaar van de entiteit (`mijn()`), en openen vraagt een KYC-MINIMUM
   dat de concerngraaf al kent: minstens een registratie, en minstens een
   HERKENDE bestuurder (op codenaam, ../../kern/concern/persoon.js). Een rekening
   voor een rechtspersoon zonder aanwijsbaar mens erachter is precies wat een bank
   niet opent -- en dat staat hier als weigering met de reden, niet als belofte.

   Betalen kan hier niet: geld gaat alleen van deze rekening af langs een
   goedgekeurde uitgave in het Werk OS. */
'use strict';

module.exports = (kern, { mijn, stuur, nietGevonden }) => {
  const { app, auth, entiteitBeeld, concernMagTekenen, entiteitRekening, entiteitRekeningOpen, entiteitRekeningStand } = kern;

  app.post('/api/concern/rekening', auth, (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    res.json({ ok: true, rtg: entiteitRekeningStand(), rekening: entiteitRekening(e.id),
      let: 'Van deze rekening gaat alleen geld af langs een goedgekeurde uitgave in een gekoppelde werkruimte.' });
  });

  app.post('/api/concern/rekening/open', auth, async (req, res) => {
    const e = mijn(req);
    if (!e) return stuur(res, nietGevonden);
    const reg = (entiteitBeeld(e) || {}).registraties || [];
    const m = concernMagTekenen(e.id, null);
    const herkend = (m.alleen || []).concat(m.samen || []).some(x => x.herkend);
    const mist = [];
    if (!reg.length) mist.push('een registratie (bijvoorbeeld het KvK-nummer)');
    if (!herkend) mist.push('een bestuurder of gevolmachtigde op zijn RTG-codenaam');
    if (mist.length) return res.status(409).json({ error: 'Voor een rekening mist deze entiteit nog: ' + mist.join(' en ') + '.', mist });
    const b = req.body || {};
    stuur(res, await entiteitRekeningOpen({ entiteitId: e.id, naam: b.naam, idem: b.idem }));
  });
};
