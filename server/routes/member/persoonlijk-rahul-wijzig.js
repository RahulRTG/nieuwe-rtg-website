/* EEN WIJZIGING IN WOORDEN, IN DE RAHUL-BEURT (EDGE.md par. 14.7).

   "Maak er vijf dagen van" over het concept dat het lid aanwijst: de route laat
   kern/stuur/menscontext-wijzig.js de wijziging toepassen langs de eigen route
   van het domein -- dezelfde die het scherm gebruikt -- en antwoordt met het
   concept van NU en het taakbeeld. Geen model en geen stuurlus: een zin die
   een veld wijzigt is net zo deterministisch als een klik op dat veld.

   `gedaan` blijft false: een concept aanpassen is niets uitvoeren. Een weigering
   (een getal buiten de grenzen) komt terug als antwoord, met het concept zoals
   het nog steeds is. */
const { taakBeeld } = require('../../kern/stuur/taakbeeld');

module.exports = (kern) => function wijzigUitTekst(req, sch) {
  if (!sch || !sch.wijziging || !kern.contextDomeinen) return null;
  const r = kern.contextDomeinen.pasAanUitTekst(req.session, sch);
  if (!r) return null;
  const antwoord = r.fout ? r.fout + ' Er is niets veranderd.' : r.antwoord;
  return { ok: true, pakte: true, antwoord, gedaan: false, gewijzigd: !!r.gewijzigd, viaTekst: true,
    taak: r.concept ? taakBeeld({ vraag: req.body && req.body.q, sch, acties: [], concept: r.concept }) : null };
};
