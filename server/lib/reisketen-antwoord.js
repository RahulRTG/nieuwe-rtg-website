/* Gedeelde foutgrens voor de drie BESTAANDE deuren van de reisketen.
   Geen route of autorisatie wordt hier aangemaakt. */
'use strict';
const { agentVan } = require('../kern/agentteken');
const { lokaleInstallatie } = require('../kern/vrijgave/lokaal');
module.exports = async (req, res, actor, werk, presenteer) => {
  /* Tot de bestaande Deep Green- en externe transactiekwalificatie compleet
     zijn bestaat deze route alleen op een bewezen lokale proefinstallatie.
     Geen nieuwe GO-vlag en geen productie-uitzondering voor beheerders. */
  if (!lokaleInstallatie(process.env).ja) return res.status(503).json({ error: 'Deze reiscontractketen is nog niet voor openbare of productie-uitvoering gekwalificeerd.', code: 'reisketen-no-go' });
  if (agentVan(req)) return res.status(403).json({ error: 'Deze contracthandeling vraagt een persoonlijke bediening; AI-autorisatie is hier niet gekwalificeerd.' });
  if (!actor || actor.error) return res.status(actor && actor.status || 403).json({ error: actor && actor.error || 'Geen persoonlijke bevoegdheid.' });
  try {
    const r = await werk(actor);
    if (!r.error && presenteer) return presenteer(r);
    return res.status(r.error ? r.status || 400 : 200).json(r);
  } catch (e) {
    console.error('[reisketen]', e && e.code || 'opslag-niet-bevestigd');
    return res.status(503).json({ error: 'De uitkomst kon niet worden bevestigd. Vernieuw de reis en herhaal dezelfde handeling, niet een nieuwe.' });
  }
};
