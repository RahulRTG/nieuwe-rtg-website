/* RTG Werk OS (deellaag): SAMEN TEKENEN -- wat het bestuur uit de concerngraaf
   betekent voor de goedkeuring van een uitgave.

   Besluit van de eigenaar (24 september 2026): het bedrijf KIEST zelf, en alle
   drie de standen bestaan. Ze gelden alleen als de werkruimte aan een entiteit
   hangt (./tekengrens.js); zonder koppeling is er geen bestuur om naar te kijken.

     versmallen (standaard)  Een gewoon lid met geld.goedkeuren keurt goed zoals
                             altijd. Maar een HERKENDE bestuurder die voor dit
                             bedrag alleen gezamenlijk bevoegd is, telt pas mee
                             als een tweede gezamenlijk bevoegde ook goedkeurt.
                             Het bestuur versmalt, het neemt niets over.
     bestuur                 Een uitgave is pas rond met het bestuur erbij: een
                             herkende bestuurder of gevolmachtigde die voor dit
                             bedrag alleen bevoegd is, of twee gezamenlijk
                             bevoegden. De gewone goedkeuring blijft daarnaast
                             nodig -- de werkruimteregels vallen niet weg.
     drempel                 Tot en met een bedrag dat het bedrijf kiest geldt
                             versmallen, erboven bestuur.

   DRIE DINGEN DIE NIET MOGEN SNEUVELEN:

   1. Alleen HERKENDE bestuurders tellen (op codenaam, ../kern/concern/persoon.js).
      Een vrije naam vergelijken met een lid is raden; een externe is niemand in
      deze werkruimte.
   2. De stand kiest de EIGENAAR VAN DE ENTITEIT, dezelfde die de werkruimte
      koppelt. Een lid dat zelf moet goedkeuren, zet het regime niet losser.
   3. Staat er voor dit bedrag niemand bevoegd in de graaf, dan zegt het
      antwoord DAT, in plaats van eeuwig "wacht op goedkeuring" te tonen. */
'use strict';

const EENHEID = require('../kern/geld/eenheid');

const WIJZEN = ['versmallen', 'bestuur', 'drempel'];
const TWEEDE = 'een tweede gezamenlijk bevoegde bestuurder';

module.exports = (sctx) => {
  const { app, save, werkPoort, log, kern } = sctx;
  const euro = (c) => (Number(c || 0) / 100).toFixed(2);

  function tekenwijze(w) {
    const t = w.tekenwijze || {};
    const wijze = WIJZEN.includes(t.wijze) ? t.wijze : 'versmallen';
    return { wijze, drempel: wijze === 'drempel' ? euro(t.drempelCenten) : null, gekoppeld: !!w.entiteitId,
      uitleg: !w.entiteitId ? 'Niet aan een entiteit gekoppeld: alleen de werkruimteregels gelden.'
        : wijze === 'bestuur' ? 'Elke uitgave vraagt daarnaast het bestuur uit de concerngraaf.'
          : wijze === 'drempel' ? 'Boven ' + euro(t.drempelCenten) + ' euro vraagt een uitgave het bestuur; daaronder versmalt het alleen.'
            : 'Het bestuur versmalt alleen: een gezamenlijk bevoegde bestuurder keurt niet in zijn eentje goed.' };
  }
  const regime = (w, centen) => {
    const t = w.tekenwijze || {};
    return t.wijze === 'bestuur' || (t.wijze === 'drempel' && Number(centen || 0) > Number(t.drempelCenten || 0))
      ? 'bestuur' : 'versmallen';
  };

  /* Wat het bestuur nog mist, als extra regels voor `ontbreekt` in ./regelpoort.js. */
  function bestuurOntbreekt(w, soort, obj, geldig) {
    if (soort !== 'uitgave' || !w.entiteitId) return [];
    const m = kern.concernMagTekenen(w.entiteitId, Number(obj.waardeCenten || 0) / 100);
    const her = (lijst) => new Set((lijst || []).filter(x => x.herkend).map(x => x.wie));
    const alleen = her(m.alleen), samen = her(m.samen), teLaag = her(m.teLaag);
    const wie = (k) => { const l = (w.leden || {})[k.lidId]; return (l && l.rtgCodenaam) || null; };
    const namen = geldig.map(wie);
    const nSamen = new Set(namen.filter(n => n && samen.has(n))).size;
    const bestuurRond = namen.some(n => n && alleen.has(n)) || nSamen >= 2;

    if (regime(w, obj.waardeCenten) === 'bestuur') {
      if (bestuurRond) return [];
      if (!alleen.size && samen.size < 2) return ['het bestuur -- maar in de concerngraaf is voor dit bedrag niemand bevoegd'];
      return [nSamen === 1 ? TWEEDE : 'het bestuur (een alleen bevoegde bestuurder, of twee gezamenlijk bevoegden)'];
    }
    /* versmallen: telt er een geld-goedkeuring die NIET van een gezamenlijk
       bevoegde komt, of zijn het er twee van gezamenlijk bevoegden? Dan klaar. */
    const geld = geldig.filter(k => k.recht === 'geld.goedkeuren').map(wie);
    const telt = geld.some(n => !n || alleen.has(n) || (!samen.has(n) && !teLaag.has(n)));
    return telt || nSamen >= 2 || !geld.some(n => n && samen.has(n)) ? [] : [TWEEDE];
  }

  app.post('/api/bedrijf/werkruimte/tekenwijze', (req, res) => {
    const g = werkPoort(req, res, 'werkruimte'); if (!g) return;
    if (!g.w.entiteitId) return res.status(409).json({
      error: 'Deze werkruimte hangt niet aan een entiteit. Koppel hem eerst; zonder bestuur valt er niets te kiezen.' });
    const e = kern.entiteitVind(g.w.entiteitId);
    if (g.directie || !g.l.rtgKey || !e || e.eigenaar !== g.l.rtgKey) return res.status(403).json({
      error: 'De tekenwijze kiest de eigenaar van de gekoppelde entiteit. Wie zelf moet goedkeuren, zet het regime niet losser.',
      recht: 'werkruimte' });
    const wijze = String(req.body.wijze || '');
    if (!WIJZEN.includes(wijze)) return res.status(400).json({ error: 'Kies versmallen, bestuur of drempel.' });
    const centen = wijze === 'drempel' ? EENHEID.naarCenten(Number(req.body.drempel)) : null;
    if (wijze === 'drempel' && !(centen > 0)) return res.status(400).json({ error: 'Een drempel is een bedrag in euro boven nul.' });
    g.w.tekenwijze = { wijze, drempelCenten: centen };
    log(g.w, g.l, 'tekenwijze', null, wijze + (centen ? ' ' + euro(centen) : ''));
    save();
    res.json(Object.assign({ ok: true }, tekenwijze(g.w)));
  });

  return { tekenwijze, bestuurOntbreekt };
};
