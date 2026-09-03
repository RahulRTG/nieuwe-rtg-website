/* Horeca HACCP, deelbestand "controlelijsten": wat een keuken elke dag afvinkt.

   ./haccp.js gaat over METINGEN -- een temperatuur die binnen of buiten de
   grens valt, met een verplichte actie als hij eruit ligt. Dit gaat over
   ROUTINE: de opening, de sluiting, de wekelijkse schoonmaak. Een lijst is geen
   meting; hij kent geen grens en geen afwijking, alleen "gedaan" of "niet
   gedaan" met wie het afvinkte.

   Ze staan apart omdat een inspecteur er ook anders naar kijkt. Bij een meting
   wil hij zien dat er is INGEGREPEN toen het misging; bij een lijst wil hij
   zien dat hij ELKE dag is afgelopen -- een gat in de reeks is het signaal, niet
   de inhoud van een regel.

   Krijgt dezelfde ctx als ./haccp.js. */
'use strict';

module.exports = (kern) => {
  const { app, save, schoon, supplierAuth, horeca } = kern;
  const { H, Hlees, nu, id } = horeca;

  /* Dezelfde greep als in ./haccp.js, en met opzet geen gedeelde import: het is
     een regel van EEN regel die zegt waar het haccp-blok van een zaak woont.
     Hem uit elkaar trekken zou twee bestanden koppelen om drie woorden. */
  const HA = (code) => { const h = H(code); if (!h.haccp) h.haccp = { punten: {}, metingen: [], batches: {}, lijsten: {}, afgevinkt: [] }; return h.haccp; };
  const vandaag = () => nu().slice(0, 10);

  /* ---------- controlelijsten ---------- */
  app.post('/api/supplier/horeca/haccp/lijst', supplierAuth, (req, res) => {
    const ha = HA(req.supplier.code);
    const naam = schoon(req.body.naam, 60);
    if (naam && Array.isArray(req.body.vragen)) {
      ha.lijsten[naam] = { naam, vragen: req.body.vragen.slice(0, 40).map(v => schoon(v, 120)).filter(Boolean),
        moment: schoon(req.body.moment, 30) || 'opening', at: nu() };
      save();
    }
    res.json({ ok: true, lijsten: Object.values(ha.lijsten) });
  });

  app.post('/api/supplier/horeca/haccp/afvinken', supplierAuth, (req, res) => {
    /* Eerst KIJKEN. HA() richt de haccp-la in voor een zaak die er nog geen had,
       ook als de controlelijst daarna niet blijkt te bestaan en het verzoek met
       een 404 teruggaat. Zie scripts/laatspoor.js. */
    const kijk = (Hlees(req.supplier.code) || {}).haccp;
    const lijst = kijk && kijk.lijsten && kijk.lijsten[schoon(req.body.naam, 60)];
    if (!lijst) return res.status(404).json({ error: 'Die controlelijst kennen we niet.' });
    const ha = HA(req.supplier.code);
    const antwoorden = Array.isArray(req.body.antwoorden) ? req.body.antwoorden : [];
    if (antwoorden.length !== lijst.vragen.length)
      return res.status(400).json({ error: 'Beantwoord alle ' + lijst.vragen.length + ' punten; een lijst in een keer afvinken bestaat hier niet.' });
    const rijen = lijst.vragen.map((v, i) => {
      const a = antwoorden[i] || {};
      return { vraag: v, akkoord: a.akkoord === true, opmerking: schoon(a.opmerking, 160) || null };
    });
    const nietAkkoord = rijen.filter(r => !r.akkoord);
    if (nietAkkoord.some(r => !r.opmerking))
      return res.status(400).json({ error: 'Bij elk punt dat niet akkoord is, hoort een opmerking.' });
    const uit = { id: id(4), lijst: lijst.naam, moment: lijst.moment, datum: vandaag(), rijen,
      akkoord: !nietAkkoord.length, at: nu(), door: req.actor.name };
    ha.afgevinkt.unshift(uit);
    ha.afgevinkt = ha.afgevinkt.slice(0, 5000);
    save();
    res.json({ ok: true, controle: uit });
  });
};
