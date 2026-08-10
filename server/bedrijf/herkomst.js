/* RTG Werk OS (deellaag): de HERKOMST van werk uit een andere RTG-app.

   "Bus 28 is defect" gebeurt in RTG Mobility. Wat eruit volgt -- een ticket, een
   project, een contract met de leverancier -- gebeurt hier. Tot nu toe was er
   geen enkele draad tussen die twee, dus stond er in het ticket hooguit "bus 28"
   in de vrije tekst, en dat is geen verwijzing maar een hoop.

   DE VORM BESTOND AL. `kern/wereld/koppel.js` kent één afspraak voor het
   verwijzen naar iets in dit huis: `rtg://<soort>/<id>`. Die wordt hier gebruikt
   en niet nagebouwd -- er komt geen tweede verwijsvorm naast, want dan staat
   dezelfde routekaart op twee plekken (LAT-regel 4).

   EN DE GRENS BLIJFT STAAN, DAAR GAAT DEZE MODULE VOORAL OVER.

   Een werkruimtelid is GEEN RTG-lid; dat zijn twee identiteiten, en dat is de
   regel waar de hele bedrijfslaag op rust. Deze module lost een verwijzing
   daarom NOOIT op: er wordt geen titel, geen status en geen enkel veld van de
   RTG-kant opgehaald. Wat er wordt bewaard en getoond is de verwijzing zelf --
   de soort, het id, en welke app hem opent. Wie de inhoud wil zien, opent hem
   met zijn EIGEN RTG-sessie, en heeft die niet, dan ziet hij niets. Dat is
   precies het patroon van de Media OS: er reist alleen een id mee, en iedere
   lezer lost het op met zijn eigen sessie.

   Was het andersom -- deze laag haalt de titel op en zet hem in het ticket --
   dan zou een werkgever via zijn werkruimte in RTG-gegevens kunnen kijken
   zonder dat daar ooit een deur voor is opengezet. Dat is geen theoretisch
   bezwaar: het is de enige reden dat deze module zo klein is.

   WAT EEN ONBEKENDE SOORT DOET. De kaart in koppel.js kent vandaag de sociale
   soorten en een handvol andere; `voertuig` staat er niet in. Een verwijzing
   naar zo'n soort wordt hier NIET geweigerd -- hij is geldig van vorm en het
   ticket gaat er echt over -- maar het antwoord zegt met zoveel woorden dat dit
   huis er (nog) geen plek voor kent om heen te gaan. Weigeren zou de gebruiker
   dwingen om het dan maar in de vrije tekst te zetten, en dan is de draad weer
   weg. Stil een link naar de homepage geven zou erger zijn (LAT-regel 5). */
'use strict';

const koppel = require('../kern/wereld/koppel');

module.exports = (sctx) => {
  const { app, save, schoon, nu, werkPoort, log, eigenVeld } = sctx;

  /* Waar een herkomst op mag hangen. Bewust kort: dit zijn de twee soorten waar
     werk van buiten binnenkomt. Een verwijzing op alles toestaan zou een veld
     zijn dat overal staat en nergens wordt gelezen. */
  const BAK = {
    ticket: (w) => sctx.TICKETS(w),
    taak: (w) => sctx.TAKEN(w)
  };
  const RECHT = { ticket: 'service', taak: 'project' };

  /* De verwijzing in de vorm waarin hij naar buiten gaat. `opent` is null als
     dit huis de soort niet in zijn kaart heeft -- met de reden erbij, want een
     leeg veld leest als "er is niets". */
  function toon(ref) {
    const d = koppel.vorm(ref);
    if (!d) return null;
    const o = koppel.open(ref);
    return { ref, soort: d.soort, id: d.id,
      opent: o ? { app: o.url, titel: o.titel } : null,
      let: o
        ? 'Deze verwijzing wordt NIET opgelost: er is geen titel of status van de RTG-kant opgehaald. Wie de inhoud wil zien, opent hem met zijn eigen RTG-sessie -- een werkruimtelid is geen RTG-lid.'
        : 'Dit huis kent voor de soort "' + d.soort + '" geen app om heen te gaan. De verwijzing is bewaard zoals hij is; er wordt geen pagina gegokt.' };
  }

  app.post('/api/bedrijf/herkomst/zet', (req, res) => {
    const soort = String(req.body.soort || '');
    if (!BAK[soort]) return res.status(400).json({ error: 'Een herkomst hangt aan: ' + Object.keys(BAK).join(', ') + '.' });
    const g = werkPoort(req, res, RECHT[soort]); if (!g) return;
    const obj = eigenVeld(BAK[soort](g.w), String(req.body.id || ''));
    if (!obj) return res.status(404).json({ error: 'Dat ' + soort + ' kennen we niet.' });

    const ref = schoon(req.body.ref, 120);
    if (!koppel.vorm(ref)) return res.status(400).json({
      error: 'Dat is geen geldige verwijzing.',
      let: 'De vorm is rtg://<soort>/<id>, dezelfde die de rest van dit huis gebruikt. Er wordt hier geen tweede verwijsvorm bijgemaakt.' });

    obj.herkomst = { ref, door: g.l.naam, at: nu() };
    log(g.w, g.l, 'herkomst-gezet', obj.id, ref);
    save();
    res.json({ ok: true, soort, id: obj.id, herkomst: toon(ref) });
  });

  app.post('/api/bedrijf/herkomst', (req, res) => {
    const soort = String(req.body.soort || '');
    if (!BAK[soort]) return res.status(400).json({ error: 'Een herkomst hangt aan: ' + Object.keys(BAK).join(', ') + '.' });
    const g = werkPoort(req, res, RECHT[soort]); if (!g) return;
    const obj = eigenVeld(BAK[soort](g.w), String(req.body.id || ''));
    if (!obj) return res.status(404).json({ error: 'Dat ' + soort + ' kennen we niet.' });
    res.json({ ok: true, soort, id: obj.id,
      herkomst: obj.herkomst ? Object.assign({}, toon(obj.herkomst.ref),
        { door: obj.herkomst.door, at: obj.herkomst.at }) : null,
      let: obj.herkomst ? null : 'Dit ' + soort + ' heeft geen herkomst uit een andere RTG-app. Dat is geen ontbrekend gegeven maar een lege draad.' });
  });

  return { herkomstToon: toon };
};
