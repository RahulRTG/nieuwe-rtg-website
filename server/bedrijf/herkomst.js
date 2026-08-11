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
   regel waar de hele bedrijfslaag op rust. De gewone leesroute lost een
   verwijzing daarom NOOIT op: er wordt geen titel, geen status en geen enkel
   veld van de RTG-kant opgehaald.

   ER IS EEN TWEEDE ROUTE (/herkomst/open) DIE DAT WEL DOET, EN PRECIES DAAROM
   STAAT DE GRENS ERIN. Hij vraagt een echte RTG-sessie, en die moet het account
   zijn dat DIT lid eenmalig zelf koppelde. Niet de werkgever opent de deur maar
   de medewerker; het beheer-token komt er niet in, juist omdat het alle rechten
   draagt. Wat er gelezen wordt, blijft NIET in de werkruimte staan. Welke
   soorten dat zijn en met welke grens per soort, staat in ./oplosbaar.js; dat
   dit domein daarvoor kern-namen gebruikt, staat in GRENZEN.json. Wat er wordt bewaard en getoond is de verwijzing zelf --
   de soort, het id, en welke app hem opent. Wie de inhoud wil zien, opent hem
   met zijn EIGEN RTG-sessie, en heeft die niet, dan ziet hij niets. Dat is
   precies het patroon van de Media OS: er reist alleen een id mee, en iedere
   lezer lost het op met zijn eigen sessie.

   Was het andersom -- deze laag haalt de titel op en zet hem in het ticket --
   dan zou een werkgever via zijn werkruimte in RTG-gegevens kunnen kijken
   zonder dat daar ooit een deur voor is opengezet. Dat is geen theoretisch
   bezwaar: het is de enige reden dat deze module zo klein is.

   WAT EEN ONBEKENDE SOORT DOET. Een verwijzing naar een soort die de kaart van
   koppel.js niet kent, wordt hier NIET geweigerd -- hij is geldig van vorm en
   het ticket gaat er echt over -- maar het antwoord zegt met zoveel woorden dat
   dit huis er (nog) geen plek voor kent om heen te gaan. Weigeren zou de
   gebruiker dwingen het dan maar in de vrije tekst te zetten, en dan is de draad
   weer weg. Stil een link naar de homepage geven zou erger zijn (LAT-regel 5). */
'use strict';

const koppel = require('../kern/wereld/koppel');

/* WELKE SOORTEN WORDEN OPGELOST, EN WAAROM ZO WEINIG. Oplossen betekent dat er
   een titel van de RTG-kant meekomt, en dat mag alleen voor gegevens die dit
   lid ook op de gewone manier zou zien. Een zaak draagt een openbare naam (hij
   staat in de Mall), dus die kan. Voor alles wat NIET op deze lijst staat komt
   er geen titel maar de reden -- en die lijst uitbreiden is per soort een eigen
   afweging, geen vinkje. */
/* WELKE SOORTEN WORDEN OPGELOST, en met welke grens per soort, staat in
   ./oplosbaar.js -- samen ging dit bestand over de 10 kB van keuringsregel 13.
   De naad is echt: hier staat de ROUTE (wie mag vragen, en met welke sessie),
   daar staat per soort WAT er dan gelezen wordt en binnen welke grens. */
const OPLOSBAAR = require('./oplosbaar');

module.exports = (sctx) => {
  const { app, save, schoon, nu, werkPoort, log, eigenVeld, kern } = sctx;
  const { auth } = kern;

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

  /* De verwijzing OPLOSSEN mag alleen met de identiteit van het LID, en nooit
     met die van de werkruimte. `auth` haalt de RTG-sessie uit de kop; die moet
     bovendien dezelfde zijn als het account dat dit lid eenmalig koppelde
     (bedrijf/aansluiting.js, twee sleutels van dezelfde persoon). Zo opent niet
     de werkgever de deur maar de medewerker zelf -- wie niet koppelde, ziet
     alleen de verwijzing, precies zoals daarvoor.

     Dat `auth` hier voor de route hangt, betekent dat deze weg een RTG-sessie
     VRAAGT. De route zonder oplossen blijft daarom bestaan; wie geen sessie
     heeft, hoort niet buitengesloten te worden van zijn eigen ticket. */
  function opgelostVoor(g, ref, sessieKey) {
    const d = koppel.vorm(ref);
    if (!d) return { mag: false, reden: 'geen geldige verwijzing' };
    if (!g.l || !g.l.rtgKey) return { mag: false, reden: 'u heeft uw RTG-account niet aan dit lidmaatschap gekoppeld; zonder die koppeling wordt er niets van de RTG-kant gelezen' };
    if (!sessieKey || sessieKey !== g.l.rtgKey) return { mag: false, reden: 'de meegestuurde RTG-sessie is niet het account dat aan dit lidmaatschap is gekoppeld' };
    const lezer = OPLOSBAAR[d.soort];
    if (!lezer) return { mag: false, reden: 'de soort "' + d.soort + '" wordt niet opgelost; dat is per soort een eigen afweging en geen vinkje' };
    const uit = lezer(kern, d.id, sessieKey);
    return uit ? { mag: true, titel: uit.titel, sub: uit.sub || null }
      : { mag: false, reden: d.soort === 'voertuig'
        ? 'dit voertuig staat niet in de vloot van een vervoerder waar u werkt -- gekoppeld zijn is daarvoor niet genoeg'
        : 'gekoppeld en toegestaan, maar dit object bestaat aan de RTG-kant niet (meer)' };
  }

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

  /* Dezelfde vraag, maar MET uw eigen RTG-sessie erbij. Alleen langs deze weg
     komt er een titel van de andere kant mee. */
  app.post('/api/bedrijf/herkomst/open', auth, (req, res) => {
    const soort = String(req.body.soort || '');
    if (!BAK[soort]) return res.status(400).json({ error: 'Een herkomst hangt aan: ' + Object.keys(BAK).join(', ') + '.' });
    const g = werkPoort(req, res, RECHT[soort]); if (!g) return;
    if (g.directie) return res.status(403).json({
      error: 'Oplossen doet een lid met zijn eigen gekoppelde RTG-account, niet het beheer-token.',
      let: 'Anders opent de werkgever de deur naar RTG-gegevens in plaats van de medewerker, en dat is precies de grens waar deze laag op rust.' });
    const obj = eigenVeld(BAK[soort](g.w), String(req.body.id || ''));
    if (!obj) return res.status(404).json({ error: 'Dat ' + soort + ' kennen we niet.' });
    if (!obj.herkomst) return res.status(404).json({ error: 'Dit ' + soort + ' heeft geen herkomst.' });

    const op = opgelostVoor(g, obj.herkomst.ref, req.session && req.session.key);
    res.json({ ok: true, soort, id: obj.id,
      herkomst: Object.assign({}, toon(obj.herkomst.ref), { door: obj.herkomst.door, at: obj.herkomst.at }),
      opgelost: op.mag ? { titel: op.titel, sub: op.sub } : null,
      reden: op.mag ? null : op.reden,
      let: op.mag
        ? 'Deze titel is gelezen met UW RTG-sessie, niet met die van de werkruimte. De werkruimte bewaart hem niet: bij de volgende lezer wordt hij opnieuw met diens eigen sessie opgehaald, of niet.'
        : 'Er is niets van de RTG-kant gelezen. De verwijzing staat er wel; u opent hem zelf in de andere app.' });
  });

  return { herkomstToon: toon };
};
