/* Routes "democratie", de deur van een partij (kern/democratie/partijen.js,
   ./partijrol.js en ./voorstellen.js, POLITIEK.md par. 7.1).

   EEN DEUR VOOR ALLE PARTIJEN. Dezelfde paden, dezelfde limieten en dezelfde
   versie voor elke partij; wie er binnenkomt, bepaalt alleen OP WIENS NAAM iets
   komt te staan.

   EEN ACCOUNT MET DE PARTIJROL (eigenaarsbesluit 19 oktober 2026; vervangt het
   besluit van 29 september 2026). Wie namens een partij handelt, komt binnen met
   zijn eigen RTG-account (een gratis account is genoeg), en dat account hangt
   aan de partij. Koppelen gaat met de eenmalige koppelcode uit het register, in
   een eigen kop en nooit in de URL, want een URL belandt in logs. Zonder sessie
   401, met een account zonder rol 403. DE MIGRATIE: een partij van voor het
   besluit, zonder gekoppeld account, komt met haar oude sleutel in de kop nog
   binnen tot er een account aan hangt.

   DE REM. Per bron, tegen wie sleutels probeert. Een verkeerde of ingetrokken
   sleutel krijgt 401 zonder te zeggen WAAROM, want "deze partij bestaat maar
   de sleutel klopt niet" is al een antwoord. */
'use strict';

const rem = require('../../rem');

const VERSIE = 'v1';
const KOP = 'x-partij-sleutel';

// losSessie IS de centrale resolveSession (gemonteerd in kern/isolatie/sessiedragers.js)
const { losSessie: resolveSession } = require('../../kern/isolatie/sessiedragers');

module.exports = ({ app, auth, democratie, stuur }) => {
  const bronRem = rem({ windowMs: 60000, limit: 120, key: req => 'partijdeur|' + String(req.ip) });

  // het account van dit verzoek, of null; alleen een eigen account (user-N) kan een partijrol dragen
  const accountVan = (req) => {
    const kop = (req.get && req.get('authorization')) || '';
    let s = null;
    try { s = kop.startsWith('Bearer ') ? resolveSession(kop.slice(7)) : null; } catch (e) { s = null; }
    return s && /^user-\d+$/.test(String(s.key || '')) ? s : null;
  };

  const alsPartij = async (req, res, werk) => {
    const s = accountVan(req);
    const p = s ? democratie.partijVanAccount(s.key, (req.body || {}).partij) : democratie.partijVanOudeSleutel(req.get(KOP));
    if (!p && s) return res.status(403).json({ error: 'Dit account handelt niet namens een partij. Koppel het met de koppelcode van uw partij.' });
    if (!p) return res.status(401).json({ error: 'Log in met het RTG-account dat namens uw partij handelt; een gratis account is genoeg.', accountNodig: true });
    res.set('RTG-Democratie-Versie', VERSIE);
    try { stuur(res, await werk(p, req.body || {})); }
    catch (e) { console.error('[democratie]', e); res.status(500).json({ error: 'Dit lukte niet.' }); }
  };

  /* Een account koppelen met de eenmalige koppelcode; het account komt uit de
     sessie, nooit uit het lijf (kern/democratie/partijrol.js). */
  app.post('/api/democratie/partij/koppel', auth, bronRem, async (req, res) => {
    const s = req.session || {};
    try { stuur(res, await democratie.partijKoppel(req.get(KOP), s.key)); }
    catch (e) { console.error('[democratie]', e); res.status(500).json({ error: 'Dit lukte niet.' }); }
  });
  app.post('/api/democratie/partij/wie', bronRem, (req, res) => alsPartij(req, res, (p) => democratie.partij.wie(p)));
  app.post('/api/democratie/partij/kwesties', bronRem, (req, res) => alsPartij(req, res, () => democratie.partij.kwesties()));
  app.post('/api/democratie/partij/voorstel/plaats', bronRem, (req, res) => alsPartij(req, res, (p, b) => democratie.partij.plaats(p, b)));
  app.post('/api/democratie/partij/voorstel/toelicht', bronRem, (req, res) => alsPartij(req, res, (p, b) => democratie.partij.toelicht(p, b)));
  app.post('/api/democratie/partij/voorstel/aanname', bronRem, (req, res) => alsPartij(req, res, (p, b) => democratie.partij.aanname(p, b)));
  app.post('/api/democratie/partij/voorstel/mijn', bronRem, (req, res) => alsPartij(req, res, (p) => democratie.partij.mijn(p)));
};
