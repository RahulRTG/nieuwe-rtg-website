/* School (deelmodule): het klasbeeld van de Misconception Graph.

   Wat een leraar hieraan heeft is niet een cijfer maar een LES: deze denkfout
   is vandaag elf keer langsgekomen bij dit leerdoel. Daar hoort een klassikale
   mini-uitleg bij, en die maakt de docent beter in plaats van hem te vervangen.

   De harde grens hier, en de reden dat dit een eigen bestand is: er wordt
   GETELD EN NIET BIJGEHOUDEN WIE. In de klas staat per leerdoel per denkfout
   een aantal en een laatste datum, en verder niets -- geen leerlingsleutel,
   geen lijst, geen manier om een telling terug te voeren op een kind. Dat is
   met opzet, want een dossier van de missers van een kind is precies wat dit
   huis niet maakt. De prijs is dat een leraar niet ziet WIE het was; de winst
   is dat niemand het ooit kan opvragen.

   De teller loopt tot de leraar zegt dat het besproken is. Dat is geen
   opruimknop maar de werkwijze zelf: een signaal dat is behandeld hoort weg,
   anders staat er over een maand een berg die niets meer betekent. */
const { DOELEN } = require('../kern/leerstof');
const { DENKFOUTEN } = require('../kern/leerstof-denkfout-lijst');

const MAX_PATRONEN = 200;

/* De telling hangt aan de klas en niet aan een leerling. Vorm:
   k.patronen[doel][denkfoutId] = { aantal, laatst } */
function tel(k, doel, id, nu) {
  if (!k.patronen || typeof k.patronen !== 'object') k.patronen = {};
  const perDoel = k.patronen[doel] = k.patronen[doel] || {};
  const rij = perDoel[id] = perDoel[id] || { aantal: 0, laatst: null };
  rij.aantal += 1;
  rij.laatst = nu;
  // een bovengrens, zodat een klas die jaren draait niet ongemerkt volloopt
  const doelen = Object.keys(k.patronen);
  if (doelen.length > MAX_PATRONEN) delete k.patronen[doelen[0]];
  return rij;
}

module.exports = (sctx) => {
  const { router, save, nu, klasVan } = sctx;

  /* ---------- wat ziet deze klas ---------- */
  router.post('/school/denkfout/klas', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const rijen = [];
    for (const [doel, perDoel] of Object.entries(k.patronen || {}))
      for (const [id, rij] of Object.entries(perDoel))
        if (DENKFOUTEN[id]) rijen.push({ doel, doelNaam: (DOELEN[doel] || {}).naam || doel,
          id, naam: DENKFOUTEN[id].naam, uitleg: DENKFOUTEN[id].uitleg,
          aantal: rij.aantal, laatst: rij.laatst });
    rijen.sort((a, b) => b.aantal - a.aantal);
    res.json({ ok: true, patronen: rijen.slice(0, 40), aantal: rijen.length,
      uitleg: 'Hoe vaak dit denkpatroon in deze klas langskwam bij het oefenen. Er staat niet bij wie: dit wordt geteld en niet bijgehouden per leerling.' });
  });

  /* ---------- besproken: het signaal is behandeld, dus het hoort weg ---------- */
  router.post('/school/denkfout/besproken', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const doel = String(req.body.doel || '').trim();
    const id = String(req.body.denkfout || '').trim();
    if (!k.patronen || !k.patronen[doel] || !k.patronen[doel][id])
      return res.status(404).json({ error: 'Dit patroon staat niet (meer) open in deze klas.' });
    delete k.patronen[doel][id];
    if (!Object.keys(k.patronen[doel]).length) delete k.patronen[doel];
    save();
    res.json({ ok: true, uitleg: 'Weg uit het overzicht. Er is niets bewaard over wie het betrof; dat was er ook niet.' });
  });
};
module.exports.tel = tel;
