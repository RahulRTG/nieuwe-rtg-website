/* De sleutelwacht van de Zaakdoos-vloot. Afgesplitst uit ./doos.js toen de
   eigen sleutel per doos (AUTHORITY.md fase 7) dat bestand over de 10 kB zette.
   Geeft doosSleutelOk(req, res) terug: true als de aanroep door mag. Het
   wegschrijven van een afketser komt als functie binnen: de opslag van de vloot
   blijft in ./doos.js, en `db`/`save` zijn er alleen voor het sleutelregister. */
module.exports = ({ crypto, beveilig, noteerAfketser, db, save }) => {
  /* ---------- de sleutelwacht van de doos-vloot ----------
     Elke /api/doos/-route zit achter de gedeelde sleutel (RTG_DOOS_SLEUTEL),
     in constante tijd vergeleken. Wie te vaak een verkeerde sleutel probeert
     (brute force), wordt per IP een kwartier buitengesloten: ook een DAARNA
     juiste sleutel krijgt dan 429. Elke afketser komt in het veiligheidslog
     en telt mee op het Veiligheid-bord van de kantoren. */
  const doosAfketsers = new Map(); // ip -> [tijdstippen]
  const DOOS_AFKETS_MAX = 8, DOOS_AFKETS_VENSTER = 15 * 60 * 1000;
  /* FASE 7 (AUTHORITY.md): een EIGEN sleutel per doos, naast de gedeelde. Met
     een eigen sleutel is de naam van de doos BEWEZEN (req.doosBewezen) en komt
     hij uit het register, niet uit het verzoek. De gedeelde sleutel werkt nog
     (schaduw); elke geldige aanroep telt onder de weg waarlangs hij kwam. */
  const doosSleutels = () => require('../kern/zaakdoos/sleutels').doosSleutelsVan({ db, save, crypto });
  function doosSleutelOk(req, res) {
    const bewezen = doosSleutels().welke(req.get('x-doos-id'), req.get('x-doos-eigen-sleutel'));
    if (bewezen) { req.doosBewezen = bewezen; doosSleutels().telWeg('eigen'); return true; }
    const ip = req.ip || 'onbekend';
    const rij = (doosAfketsers.get(ip) || []).filter(t => Date.now() - t < DOOS_AFKETS_VENSTER);
    if (rij.length >= DOOS_AFKETS_MAX) {
      doosAfketsers.set(ip, rij);
      res.status(429).json({ error: 'Te veel mislukte pogingen; probeer het over een kwartier opnieuw.' });
      return false;
    }
    const s = process.env.RTG_DOOS_SLEUTEL || '';
    const g = String(req.get('x-doos-sleutel') || '');
    if (!s || g.length !== s.length || !crypto.timingSafeEqual(Buffer.from(g), Buffer.from(s))) {
      rij.push(Date.now());
      doosAfketsers.set(ip, rij);
      noteerAfketser(); // de opslag blijft in ./doos.js
      try { if (beveilig && rij.length >= DOOS_AFKETS_MAX) beveilig.meld('doos-sleutel', 'hoog', 'IP na ' + rij.length + ' verkeerde doos-sleutels een kwartier buitengesloten.', { ip }); } catch (e) {}
      res.status(403).json({ error: 'Geen toegang.' });
      return false;
    }
    doosAfketsers.delete(ip); // een goede sleutel wist de teller
    doosSleutels().telWeg('gedeeld', req.get('x-doos-id') || (req.body && req.body.doos));
    /* Staat de gedeelde sleutel dicht, dan is een GOEDE gedeelde sleutel geen
       afketser (geen blokkade per IP) maar een doos die nog om moet. Hij blijft
       in nogGedeeld staan, zodat het kantoor ziet welke. */
    if (doosSleutels().gedeeldeSleutel().dicht) {
      res.status(403).json({ error: 'De gedeelde doos-sleutel is dicht. Deze doos heeft een eigen sleutel nodig (RTG_DOOS_EIGEN_SLEUTEL met RTG_DOOS_ID).' });
      return false;
    }
    return true;
  }

  return doosSleutelOk;
};
