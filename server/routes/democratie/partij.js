/* Routes "democratie", de deur van een partij (kern/democratie/partijen.js en
   ./voorstellen.js, POLITIEK.md par. 7.1).

   EEN DEUR VOOR ALLE PARTIJEN. Dezelfde paden, dezelfde limieten en dezelfde
   versie voor elke partij; wie er binnenkomt, bepaalt alleen OP WIENS NAAM iets
   komt te staan. Er is geen sessie en geen RTG-account: de partijsleutel uit het
   register IS de geloofsbrief (alleen als hash op schijf, door het kantoor in te
   trekken en te vervangen). Hij reist in een eigen kop en nooit in de URL, want
   een URL belandt in logs.

   DE REM. Per bron, tegen wie sleutels probeert. Een verkeerde of ingetrokken
   sleutel krijgt 401 zonder te zeggen WAAROM, want "deze partij bestaat maar
   de sleutel klopt niet" is al een antwoord. */
'use strict';

const rem = require('../../rem');

const VERSIE = 'v1';
const KOP = 'x-partij-sleutel';

module.exports = ({ app, democratie, stuur }) => {
  const bronRem = rem({ windowMs: 60000, limit: 120, key: req => 'partijdeur|' + String(req.ip) });

  const alsPartij = async (req, res, werk) => {
    const p = democratie.partijVanSleutel(req.get(KOP));
    if (!p) return res.status(401).json({ error: 'Deze deur is voor partijen uit het register, met hun eigen sleutel in de kop ' + KOP + '.' });
    res.set('RTG-Democratie-Versie', VERSIE);
    try { stuur(res, await werk(p, req.body || {})); }
    catch (e) { console.error('[democratie]', e); res.status(500).json({ error: 'Dit lukte niet.' }); }
  };

  app.post('/api/democratie/partij/wie', bronRem, (req, res) => alsPartij(req, res, (p) => democratie.partij.wie(p)));
  app.post('/api/democratie/partij/kwesties', bronRem, (req, res) => alsPartij(req, res, () => democratie.partij.kwesties()));
  app.post('/api/democratie/partij/voorstel/plaats', bronRem, (req, res) => alsPartij(req, res, (p, b) => democratie.partij.plaats(p, b)));
  app.post('/api/democratie/partij/voorstel/toelicht', bronRem, (req, res) => alsPartij(req, res, (p, b) => democratie.partij.toelicht(p, b)));
  app.post('/api/democratie/partij/voorstel/aanname', bronRem, (req, res) => alsPartij(req, res, (p, b) => democratie.partij.aanname(p, b)));
  app.post('/api/democratie/partij/voorstel/mijn', bronRem, (req, res) => alsPartij(req, res, (p) => democratie.partij.mijn(p)));
};
