/* Living Lab, deel "bewonerpas": de klacht, een onderzoek, het labpaspoort en
   het kader, voor een bewoner MET ACCOUNT (eigenaarsbesluit 19 oktober 2026:
   alles van het buurtlab gaat achter een account; een gezinsprofiel onder het
   account van een ouder mag, zoals bij de andere buurtdeuren, ./bewoneraccount.js).

   DE KLACHT VRAAGT OOK EEN ACCOUNT, en dat koos de eigenaar bewust. Hier stond
   dat een klacht juist geen inlog mocht vragen; dat is vervangen. Een gratis
   account is genoeg, en het klachtenscherm zegt dat. De klacht blijft zichtbaar
   tot een tekenbevoegde hem afhandelt, en blokkeert intussen de deelnemersstap.

   HET LABPASPOORT IS PROGRESSIE. Punten, niveaus en badges zijn precies wat
   AGENTS.md onder de 18+-grens zet, dus maken en lezen lopen door
   progressieMag (kern/spellen/grens.js, die volwassen() leest) en niet door een
   eigen kopie van de regel. Onder de grens -- en een gezinsprofiel heeft per
   constructie geen eigen account -- wordt er niets bewaard: 403 met de zin van
   de grens. Het paspoort hangt aan het account (kern/livinglab/spel.js); een
   ander account met dezelfde code krijgt 404. */
'use strict';

module.exports = (kern, h) => {
  const { app, livinglab } = kern;
  const { veilig, lijf, codeUit, bewoner, GEEN_ACCOUNT, remBron, remCode, remLezen, remSchrijf } = h;
  const { progressieMag, GEEN_PROGRESSIE } = require('../../kern/spellen/grens')({ volwassen: kern.volwassen });
  // na het account: alleen een eigen, gekeurd, volwassen account bewaart progressie
  const progressie = (w) => !!(w.key && w.eigenaar && progressieMag(w.key));
  const GEEN = { error: GEEN_PROGRESSIE, progressie: false };

  // een onderzoek van dichtbij; bij een gescheiden studie niet meer dan titel en stap
  app.post('/api/lab2/bewoner/studie', remLezen, (req, res) => {
    if (!bewoner(req)) return res.status(401).json(GEEN_ACCOUNT);
    veilig(res, () => livinglab.studie.studie(lijf(req).id, null));
  });

  app.post('/api/lab2/bewoner/klacht', remSchrijf, (req, res) => {
    if (!bewoner(req)) return res.status(401).json(GEEN_ACCOUNT);
    veilig(res, () => livinglab.ethiek.klacht(lijf(req).id, lijf(req)));
  });

  app.post('/api/lab2/bewoner/paspoort', remBron, remCode, (req, res) => {
    const w = bewoner(req);
    if (!w) return res.status(401).json(GEEN_ACCOUNT);
    if (!progressie(w)) return res.status(403).json(GEEN);
    veilig(res, () => livinglab.spel.paspoort(codeUit(req), w.eigenaar));
  });
  app.post('/api/lab2/bewoner/paspoort-maak', remSchrijf, (req, res) => {
    const w = bewoner(req);
    if (!w) return res.status(401).json(GEEN_ACCOUNT);
    if (!progressie(w)) return res.status(403).json(GEEN);
    veilig(res, () => livinglab.spel.paspoortMaak(lijf(req), w.eigenaar));
  });

  /* Het kader: het bewonersscherm bouwt zijn keuzelijsten uit dezelfde tabel als
     het kantoorscherm, zodat er maar een waarheid is over de cyclus en de
     methoden (regel 4). */
  app.post('/api/lab2/bewoner/kader', remLezen, (req, res) => {
    if (!bewoner(req)) return res.status(401).json(GEEN_ACCOUNT);
    veilig(res, () => livinglab.kaderVoorScherm());
  });
};
