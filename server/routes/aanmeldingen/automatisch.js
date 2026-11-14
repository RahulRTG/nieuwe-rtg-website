/* De eigen abonnementsovereenkomst. De accountbron blijft de bestaande
   geverifieerde aanvrager; een bodyaccount kan nooit een ander lid kiezen. */
'use strict';
module.exports = ({ app, auth, aanvragerVan, aanmeldingen, env = process.env }) => {
  const handler = (methode, velden) => async (req, res) => {
      res.set('Cache-Control', 'no-store');
      try {
        const bron = aanvragerVan(req), id = bron == null ? null : Number(bron);
        if (!Number.isSafeInteger(id) || id < 1)
          return res.status(401).json({ error: 'Log in met uw eigen RTG-account.' });
        if (env.RTG_ABONNEMENTEN_ZELFSERVICE !== '1') {
          if (methode === 'mijn') return res.json({ ok: true, beschikbaar: false, contracten: [] });
          return res.status(409).json({ error: 'Nieuwe abonnementen via zelfbediening zijn nog niet vrijgegeven.' });
        }
        const motor = aanmeldingen && aanmeldingen.automatisch;
        if (!motor || typeof motor[methode] !== 'function')
          return res.status(503).json({ error: 'De abonnementenbediening is niet beschikbaar. Er zijn geen nieuwe rechten toegekend.' });
        const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
        const input = Object.fromEntries(velden.filter(k => Object.hasOwn(body, k)).map(k => [k, body[k]]));
        const r = await motor[methode](id, input);
        if (!r || typeof r !== 'object') throw Error('Geen bevestigd abonnementantwoord.');
        const status = Number.isInteger(r.status) && r.status >= 400 && r.status <= 599 ? r.status : 200;
        if (methode === 'mijn' && !r.error && r.beschikbaar !== false) {
          const register = require('../../seed/genres');
          return res.status(status).json({ ...r, beschikbaar: true, intake: { bedrijfstypes:
            register.aanvraagbareGenres().map(id => ({ id, label: register.GENRES[id].label })) } });
        }
        return res.status(status).json(r);
      } catch (_) {
        return res.status(503).json({ error: 'De opdracht is niet bevestigd. Herhaal dezelfde opdracht en controleer de stand; begin niet opnieuw met een andere sleutel.' });
      }
  };
  // Letterlijke registraties: de routecensus en schakelkast moeten elke deur zien.
  app.post('/api/mijn/abonnement/automatisch/aanbod', auth,
    handler('aanbod', ['pas', 'frequentie', 'idempotencyKey', 'aanmeldingId', 'zaakCode']));
  app.post('/api/mijn/abonnement/automatisch/teken', auth,
    handler('teken', ['contractId', 'aanbodHash', 'naam', 'akkoord', 'doorlopendeBetalingAkkoord']));
  app.post('/api/mijn/abonnement/automatisch/betalen', auth, handler('betaal', ['contractId']));
  app.post('/api/mijn/abonnement/automatisch/herstel', auth, handler('herstel', ['contractId']));
  app.post('/api/mijn/abonnement/automatisch/intrekken', auth, handler('intrekken', ['contractId', 'aanbodHash']));
  app.post('/api/mijn/abonnement/automatisch/stand', auth, handler('mijn', []));
};
