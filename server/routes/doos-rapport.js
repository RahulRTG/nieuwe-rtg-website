/* De Zaakdoos-vloot, deel "rapport": het DAGRAPPORT. Afgesplitst uit ./doos.js:
   de meting en de buurmelding gaan over de lijn van NU, het rapport over de
   nacht erna -- een eigen ritme, een eigen la (doosRapporten) en een eigen
   regel voor wie hem mag lezen (zie de kop van ./doos.js, "rapport"). De
   sleutelwacht komt als doosSleutelOk mee uit ./doos-wacht.js, en het
   wegschrijven als noteerRapport uit ./doos.js: de opslag van de vloot blijft
   op een plek. */
'use strict';

module.exports = (kern, doosSleutelOk, noteerRapport) => {
  const { app, zaakdoos } = kern;
  /* Het nachtwerk van de doos-vloot: elke doos die meedoet, stuurt om vier uur
     in de nacht een dagrapport over de lijn: pings, gemiddelde rondreistijd,
     uitval en naspeelwerk. Compact en zonder zaakdata, achter de sleutel. */
  app.post('/api/doos/rapport', (req, res) => {
    if (!doosSleutelOk(req, res, 'rapport')) return;
    const b = req.body || {};
    // met een eigen sleutel rapporteert een doos alleen over zichzelf en zijn zaak
    if (req.doosZaak && b.zaak != null && String(b.zaak).toUpperCase() !== req.doosZaak)
      return res.status(403).json({ error: 'Deze sleutel rapporteert alleen voor zijn eigen zaak.' });
    /* Pas NA de keuring vastleggen: een geweigerd rapport (403) liet eerder een
       lege doosRapporten achter (scripts/laatspoor.js). De la zelf beheert
       ./doos.js -- dit bestand raakt de opslag niet aan. */
    noteerRapport({
      doos: req.doosBewezen || String(b.doos || 'doos').replace(/[<>]/g, '').slice(0, 40), zaak: req.doosZaak || null,
      datum: /^\d{4}-\d{2}-\d{2}$/.test(String(b.datum)) ? String(b.datum) : new Date().toISOString().slice(0, 10),
      pings: Math.max(0, Math.round(Number(b.pings) || 0)),
      rttGem: Math.max(0, Math.min(60000, Math.round(Number(b.rttGem) || 0))),
      uitval: Math.max(0, Math.round(Number(b.uitval) || 0)),
      lokaalMin: Math.max(0, Math.round(Number(b.lokaalMin) || 0)),
      nagespeeld: Math.max(0, Math.round(Number(b.nagespeeld) || 0)),
      kloonLeeftijdMin: b.kloonLeeftijdMin == null ? null : Math.max(0, Math.round(Number(b.kloonLeeftijdMin) || 0)),
      kasStuks: Math.max(0, Math.round(Number(b.kasStuks) || 0)),
      journaalNu: Math.max(0, Math.round(Number(b.journaalNu) || 0)), at: Date.now()
    });
    res.json({ ok: true });
  });
  /* Het dagrapport van deze doos zelf (lokaal, voor het zaak-scherm en de tests).
     Op een server die GEEN doos is valt er niets nuttigs te tonen en is dit
     alleen verkenningswerk; daar geldt dus de sleutel. Zie de kop. */
  app.get('/api/doos/rapport', (req, res) => {
    if (!zaakdoos.status().doos && !doosSleutelOk(req, res, 'rapport')) return;
    res.json(zaakdoos.dagrapport());
  });
};
