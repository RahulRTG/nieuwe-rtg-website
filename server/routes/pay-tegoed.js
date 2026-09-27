/* RTG Pay, het TEGOED van een lid: een bon die je voor een ander koopt en die
   hij verzilvert -- of die je zelf terugneemt.

   AFGESPLITST VAN ./pay.js omdat dat bestand over de keuringsgrens van 10240
   byte ging. De snede loopt langs de EIGENAAR van het geld: alles wat in pay.js
   overblijft gaat over de wallet van het lid zelf (opladen, sturen, een
   verzoek, een tik- of kascode), dit gaat over geld dat hij voor IEMAND ANDERS
   klaarzet. Dat verschil zit ook in de poorten: kopen en verzilveren zijn
   geld-momenten en dragen dezelfde twee poorten als de rest; het overzicht en
   het terugnemen niet -- kijken kost niets, en terugnemen haalt je eigen geld
   op uit een bon die je zelf hebt betaald.

   Krijgt `stuur`, `geenGast`, `kyc` en `geenEchtAccount` mee van ./pay.js: dat
   zijn de poorten van de AANROEPER en niet van dit onderwerp. */
'use strict';

module.exports = (kern, { stuur, geenGast, kyc, geenEchtAccount }) => {
  const { app, auth, liveCodename, pay } = kern;

  /* Tegoed: een lid koopt tegoed voor een ander (kern/pay/tegoed.js). Kopen en
     verzilveren zijn geld-momenten en dragen dezelfde twee poorten als de rest
     hier; het overzicht, het terugnemen en een nieuwe code niet -- kijken kost
     niets, en terugnemen haalt je eigen geld op uit een bon die je zelf hebt
     betaald. De kale code staat alleen in het antwoord op /koop en /roteer
     (lib/eenmalig-geheim-routes.js houdt elke retrycache daarbuiten). */
  app.post('/api/pay/tegoed', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    res.json(await pay.tegoedOverzicht(liveCodename(req.session)));
  });
  app.post('/api/pay/tegoed/koop', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    if (kyc(req, res)) return;
    stuur(res, await pay.tegoedKoop({ codenaam: liveCodename(req.session), centen: req.body.centen, aanCodenaam: req.body.aan, oms: req.body.oms, idem: req.body.idem }));
  });
  app.post('/api/pay/tegoed/verzilver', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    if (kyc(req, res)) return;
    stuur(res, await pay.tegoedVerzilver({ codenaam: liveCodename(req.session), code: req.body.code,
      tegoedId: req.body.id, idem: req.body.idem }));
  });
  app.post('/api/pay/tegoed/terug', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await pay.tegoedTerug({ codenaam: liveCodename(req.session), tegoedId: String(req.body.id || ''),
      intrekken: req.body.intrekken === true, idem: req.body.idem }));
  });
  app.post('/api/pay/tegoed/roteer', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await pay.tegoedRoteer({ codenaam: liveCodename(req.session), tegoedId: String(req.body.id || ''), idem: req.body.idem }));
  });

  // de tik: ontvangen met een aanraking (tikcode), betalen met een knop
  /* Tik- en kascode staan alleen kaal in het antwoord op hun uitgifte
     (lib/eenmalig-geheim-routes.js: no-store, buiten elke retrycache); intrekken
     is server-side en raakt alleen de open codes van de aanroeper zelf. */
  app.post('/api/pay/tikcode', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await pay.tikCode({ codenaam: liveCodename(req.session), idem: req.body.idem }));
  });
  app.post('/api/pay/tikcode/intrek', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, await pay.tikIntrek({ codenaam: liveCodename(req.session) }));
  });
  app.post('/api/pay/tik', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    if (kyc(req, res)) return;
    stuur(res, await pay.tikBetaal({ van: liveCodename(req.session), code: req.body.code, centen: req.body.centen, oms: req.body.oms, idem: req.body.idem }));
  });
  app.post('/api/pay/tiks', auth, (req, res) => {
    if (geenGast(req, res)) return;
    res.json(pay.tikFeed(liveCodename(req.session)));
  });
  /* de kassacode: vijf minuten geldig, tot een zelfgekozen maximum. Een nieuwe
     code trekt de vorige in; het geld beweegt pas bij /api/supplier/pay/in. */
  app.post('/api/pay/kascode', auth, async (req, res) => {
    if (geenEchtAccount(req, res)) return;
    stuur(res, await pay.kasCode({ codenaam: liveCodename(req.session), maxCenten: req.body.maxCenten, idem: req.body.idem }));
  });
  app.post('/api/pay/kascode/intrek', auth, async (req, res) => {
    if (geenEchtAccount(req, res)) return;
    stuur(res, await pay.kasIntrek({ codenaam: liveCodename(req.session) }));
  });
};
