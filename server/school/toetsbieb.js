/* School (deelmodule): de leerdoelen-bibliotheek voor het maak-scherm van de
   leraar. Eigen module naast toets.js: de toetsen zelf zijn de stroom, dit
   is de catalogus.

   De basisschooldoelen hangen aan een groep (1 t/m 8), de rest aan een fase
   van de ladder. Hier gingen ze in EEN emmer op d.groep -- en de
   vo/mbo/hbo/wo-doelen hebben geen groep, dus Number(undefined) werd via NaN
   een "Groep null" met alle vierendertig vervolgdoelen erin, midden in het
   maakscherm. Nu twee lijsten, elk in de eigen sleutelruimte; en een klas
   die zijn niveau kent (k.trap) krijgt alleen zijn eigen deel. */
const { DOELEN } = require('../kern/leerstof');
const { FASEN, TRAPPEN } = require('../kern/onderwijs-ladder');

module.exports = (sctx) => {
  const { router, klasVan } = sctx;

  router.post('/school/toets/bibliotheek', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const perGroep = {}, perFase = {};
    for (const d of Object.values(DOELEN)) {
      const rij = { id: d.id, vak: d.vak, naam: d.naam, ref: d.ref || null };
      if (d.groep != null) (perGroep[d.groep] = perGroep[d.groep] || []).push(rij);
      else if (d.fase) (perFase[d.fase] = perFase[d.fase] || []).push(rij);
    }
    let groepen = Object.entries(perGroep).map(([groep, doelen]) => ({ groep: Number(groep), doelen }))
      .sort((a, b) => a.groep - b.groep);
    let fasen = Object.entries(perFase).map(([fase, doelen]) => {
      const f = FASEN.find(x => x.id === fase) || { naam: fase, trap: '' };
      return { fase, naam: f.naam, trap: f.trap, trapNaam: (TRAPPEN[f.trap] || {}).naam || f.trap, doelen };
    }).sort((a, b) => FASEN.findIndex(x => x.id === a.fase) - FASEN.findIndex(x => x.id === b.fase));
    if (k.trap === 'po') fasen = [];
    else if (k.trap) { groepen = []; fasen = fasen.filter(f => f.trap === k.trap); }
    res.json({ ok: true, groepen, fasen });
  });
};
