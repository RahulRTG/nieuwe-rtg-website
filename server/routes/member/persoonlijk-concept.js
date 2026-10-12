/* HET CONCEPT OP HET SCHERM -- /api/fluister/concept, de terugweg van een
   wijziging die het lid op het scherm maakt in een reisconcept van Rahul
   (EDGE.md par. 14.6, live samenwerking).

   GEEN MODEL EN GEEN STUURLUS. De wijziging gaat langs de vaste controle van
   kern/fluister/reis/reisconcept.js; het antwoord draagt het concept van NU, het
   taakbeeld voor de Edge en de zin van Rahul, allemaal uit dezelfde waarden.

   ALLEEN HET EIGEN CONCEPT. De sleutel komt uit de sessie en nooit uit het
   verzoek; een id van een ander geeft hetzelfde 404 als een verzonnen id.

   EN NIETS ERNA. Deze route kent geen aanvraag, boeking, betaling of bericht --
   een concept aanpassen blijft een concept aanpassen. */
const { taakBeeld } = require('../../kern/stuur/taakbeeld');

module.exports = (kern) => {
  const { app, auth } = kern;
  app.post('/api/fluister/concept', auth, (req, res) => {
    const b = req.body || {};
    const r = kern.fluister.conceptWijzig(req.session.key, { id: b.id, versie: b.versie, velden: b.velden });
    if (r.error) return res.status(r.status).json(Object.assign({ error: r.error }, r.veld ? { veld: r.veld } : {},
      r.concept ? { concept: r.concept, taak: taakBeeld({ vraag: '', concept: r.concept, acties: [] }) } : {}));
    res.json({ ok: true, gewijzigd: r.gewijzigd, wat: r.wat || [], concept: r.concept, antwoord: r.zin,
      taak: taakBeeld({ vraag: '', concept: r.concept, acties: [] }) });
  });
};
