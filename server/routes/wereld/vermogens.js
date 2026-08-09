/* Wereld (deelmodule): de vermogens die je met de Lifestyle- en Business Pass
   erbij krijgt en die met echte gegevens werken -- bereik, bedrijfsbeeld, de
   bewaarde lijsten (talentpool en leads) en de drie AI-lenzen.

   De poort is overal dezelfde `eist(...)`: één rechtenlijst, geen lijstje per
   route. Wie het vermogen niet heeft krijgt 403 met de naam erbij, zodat het
   scherm kan zeggen WAT er ontbreekt in plaats van alleen dat het niet mag.

   Krijgt de gedeelde context een keer bij het opstarten vanuit routes/wereld.js. */
'use strict';

module.exports = ({ app, auth, save, eist, mag, inzicht, lijsten, wereldAi,
  profiel, keyVanCodenaam, gidsHaal, openVacatures }) => {

  const tierVan = (key) => (gidsHaal(key) || {}).tier || 'rtg';

  /* ---------- inzicht ---------- */

  app.post('/api/wereld/bereik', auth, eist('inzicht.bereik'), (req, res) => {
    res.json(inzicht.bereik(req.session.key));
  });

  app.post('/api/wereld/bedrijf', auth, eist('inzicht.bedrijf'), (req, res) => {
    const r = inzicht.bedrijf(req.body.q, openVacatures);
    if (r.error) return res.status(400).json(r);
    res.json(r);
  });

  /* ---------- de bewaarde lijsten ----------

     Toevoegen loopt langs dezelfde zichtbaarheid als zoeken: je kunt niemand
     bewaren die je niet had kunnen vinden. Die controle wordt hier als FUNCTIE
     meegegeven aan kern/wereld/lijsten.js in plaats van daar herhaald -- zie de
     kop van dat bestand voor waarom dat één plek moet blijven. */
  const magIkZien = (req) => (doelKey) => {
    const lagen = profiel.profielVoor(req.session.key, doelKey, tierVan(doelKey));
    return lagen.some(l => l.velden.length);
  };

  app.post('/api/wereld/lijst', auth, (req, res) => {
    const soort = String(req.body.soort || '');
    const S = lijsten.SOORTEN[soort];
    if (!S) return res.status(400).json({ error: 'Deze lijst ken ik niet.' });
    if (!mag(req, S.vermogen))
      return res.status(403).json({ error: 'Dit hoort bij de Lifestyle en Business Pass.', vermogen: S.vermogen });
    res.json(lijsten.lees(req.session.key, soort));
  });

  app.post('/api/wereld/lijst/zet', auth, async (req, res) => {
    const soort = String(req.body.soort || '');
    const S = lijsten.SOORTEN[soort];
    if (!S) return res.status(400).json({ error: 'Deze lijst ken ik niet.' });
    if (!mag(req, S.vermogen))
      return res.status(403).json({ error: 'Dit hoort bij de Lifestyle en Business Pass.', vermogen: S.vermogen });

    const codenaam = String(req.body.codenaam || '').trim().slice(0, 60);
    if (!codenaam) return res.status(400).json({ error: 'Wie?' });
    let doel = null;
    try { const t = await keyVanCodenaam(codenaam); doel = t && t.key; } catch (e) { doel = null; }
    if (!doel) return res.status(404).json({ error: 'Dit lid ken ik niet.' });

    const r = req.body.weg === true
      ? lijsten.weg(req.session.key, soort, doel)
      : (req.body.nieuw === true
        ? lijsten.voegToe(req.session.key, soort, doel, codenaam, req.body.notitie, magIkZien(req))
        : lijsten.zet(req.session.key, soort, doel, req.body));
    if (r.error) return res.status(400).json(r);
    save();
    res.json(r);
  });

  /* ---------- Rahul met drie lenzen ---------- */

  app.post('/api/wereld/rahul', auth, async (req, res) => {
    const lensNaam = String(req.body.lens || '');
    const lens = wereldAi.LENZEN[lensNaam];
    if (!lens) return res.status(400).json({ error: 'Deze vraag ken ik niet.' });
    if (!mag(req, lens.vermogen))
      return res.status(403).json({ error: 'Dit hoort bij de Lifestyle en Business Pass.', vermogen: lens.vermogen });

    // de salesbril leest openstaande vacatures; die komen uit de kern en niet
    // uit een eigen kopie, dus geven we de bron mee in plaats van hem na te maken
    const invoer = Object.assign({}, req.body, { _vacatures: openVacatures });
    const r = await wereldAi.vraag(lensNaam, req.session.key, invoer, tierVan);
    if (r.status && r.status >= 400) return res.status(r.status).json(r);
    res.json(r);
  });
};
