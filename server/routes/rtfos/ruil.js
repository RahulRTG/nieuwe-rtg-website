/* De routes van de buurtruil (kern/rtfos/ruil.js).

   DE ENIGE RTFOS-DEUR DIE OP EEN LEDENSESSIE OPENGAAT. Alle andere ingangen van
   dit domein staan achter de kantoordeur of op een uitgegeven code; deze staat
   open voor wie een eigen RTG-account heeft, want een buurtruil waar je een code
   voor moet aanvragen is geen buurtruil.

   DAT IS METEEN DE LEEFTIJDSGRENS, en hij is geen apart lijstje. Een eigen
   RTG-account is precies wat een beschermd kind NIET heeft: gezinsprofielen
   onder de RTFoundation hangen aan een gezin en dragen geen eigen sessie (zie
   de kop van kern/volwassen.js, die dezelfde eigenschap gebruikt). Wie hier
   binnenkomt, is dus geen kind uit de besloten laag -- zonder dat deze module
   een geboortedatum hoeft te lezen.

   WAAROM NIET volwassen(): die poort vraagt A3 -- RTG heeft het paspoort
   gezien. Voor een bewaarde spelprestatie is dat de juiste lat; voor het
   weggeven van een kinderfiets sluit hij vrijwel iedereen buiten, en dan wijkt
   de buurt uit naar een groep waar niemand meekijkt. De grens die hier telt is
   "een mens met een eigen account, aanspreekbaar op een codenaam".

   DE REM STAAT OP DE SESSIE EN NIET OP HET IP. Een IP is in een flat gedeeld,
   en juist daar wonen de mensen voor wie dit bedoeld is. */
'use strict';

const rem = require('../../rem');

module.exports = ({ app, auth, geenGast, liveCodename, rtfos, veilig }) => {
  const ik = req => liveCodename(req.session);
  const lijf = req => req.body || {};

  /* Schrijven mag vaker dan een mens typt en veel minder vaak dan een script
     lukt. Lezen mag ruim: de lijst ververst na elke handeling. */
  const schrijfRem = rem({ windowMs: 60000, limit: 20, key: req => 'rtfruil|' + String(ik(req) || req.ip) });
  const leesRem = rem({ windowMs: 60000, limit: 120, key: req => 'rtfruil-lees|' + String(ik(req) || req.ip) });

  app.post('/api/rtfos/ruil/lijst', auth, leesRem, (req, res) => {
    if (geenGast(req, res)) return;
    veilig(res, () => rtfos.ruil.lijst(Object.assign({}, lijf(req), { codenaam: ik(req) })));
  });
  app.post('/api/rtfos/ruil/mijn', auth, leesRem, (req, res) => {
    if (geenGast(req, res)) return;
    veilig(res, () => rtfos.ruil.mijn(ik(req)));
  });
  app.post('/api/rtfos/ruil/plaats', auth, schrijfRem, (req, res) => {
    if (geenGast(req, res)) return;
    veilig(res, () => rtfos.ruil.plaats(ik(req), lijf(req)));
  });
  app.post('/api/rtfos/ruil/sluit', auth, schrijfRem, (req, res) => {
    if (geenGast(req, res)) return;
    veilig(res, () => rtfos.ruil.sluit(ik(req), lijf(req)));
  });
  app.post('/api/rtfos/ruil/interesse', auth, schrijfRem, (req, res) => {
    if (geenGast(req, res)) return;
    veilig(res, () => rtfos.ruil.interesse(ik(req), lijf(req)));
  });
  app.post('/api/rtfos/ruil/meld', auth, schrijfRem, (req, res) => {
    if (geenGast(req, res)) return;
    veilig(res, () => rtfos.ruil.meld(ik(req), lijf(req)));
  });
};
