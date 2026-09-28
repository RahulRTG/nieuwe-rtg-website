/* De sleutelwacht van de Zaakdoos-vloot. Afgesplitst uit ./doos.js toen de
   eigen sleutel per doos (AUTHORITY.md fase 7) dat bestand over de 10 kB zette.
   Geeft doosSleutelOk(req, res, familie) terug: true als de aanroep door mag.
   Het register (kern.doosSleutels) en het wegschrijven van een afketser komen
   als functie binnen: de opslag van de vloot blijft in ./doos.js.

   TWEE WEGEN, EN IN PRODUCTIE MAAR EEN (besluit B12, 27 september 2026):
     eigen sleutel  x-doos-id + x-doos-eigen-sleutel, per doos en gebonden aan
                    zijn zaak (kern/zaakdoos/sleutels.js), met een scope per
                    familie: meting, rapport, update, buurmelding, kloon. Dan
                    zijn req.doosBewezen (de doos) en req.doosZaak (de zaak)
                    BEWEZEN: ze komen uit het register, niet uit het verzoek.
     gedeeld        RTG_DOOS_SLEUTEL, alleen BUITEN productie. In productie
                    opent hij niets meer, ook niet met de juiste waarde.
   Beide vergelijkingen lopen over hashes van gelijke lengte met timingSafeEqual.
   Wie te vaak een verkeerde sleutel probeert, wordt per IP een kwartier
   buitengesloten: ook een DAARNA juiste sleutel krijgt dan 429. */
module.exports = ({ crypto, beveilig, noteerAfketser, register }) => {
  const doosAfketsers = new Map(); // ip -> [tijdstippen]
  const DOOS_AFKETS_MAX = 8, DOOS_AFKETS_VENSTER = 15 * 60 * 1000;
  const productie = () => process.env.NODE_ENV === 'production';
  const h = s => crypto.createHash('sha256').update('rtg-doos-gedeeld|' + String(s)).digest();
  const FOUT = { verlopen: 'Deze doossleutel is verlopen. Laat hem roteren door een manager van de zaak of het kantoor.',
    ingetrokken: 'Deze doossleutel is ingetrokken.', 'scope-ontbreekt': 'Deze doossleutel mag dit eindpunt niet gebruiken.' };

  function afketser(req, res, ip, rij) {
    rij.push(Date.now());
    doosAfketsers.set(ip, rij);
    noteerAfketser(); // de opslag blijft in ./doos.js
    try { if (beveilig && rij.length >= DOOS_AFKETS_MAX) beveilig.meld('doos-sleutel', 'hoog', 'IP na ' + rij.length + ' verkeerde doos-sleutels een kwartier buitengesloten.', { ip }); } catch (e) {}
    res.status(403).json({ error: 'Geen toegang.' });
    return false;
  }

  function doosSleutelOk(req, res, familie) {
    const ip = req.ip || 'onbekend';
    const rij = (doosAfketsers.get(ip) || []).filter(t => Date.now() - t < DOOS_AFKETS_VENSTER);
    if (rij.length >= DOOS_AFKETS_MAX) {
      doosAfketsers.set(ip, rij);
      res.status(429).json({ error: 'Te veel mislukte pogingen; probeer het over een kwartier opnieuw.' });
      return false;
    }
    const reg = register();
    const eigen = req.get('x-doos-eigen-sleutel');
    if (eigen) {
      const b = reg.welke(req.get('x-doos-id'), eigen, familie);
      if (b && b.fout) { res.status(403).json({ code: 'doos-sleutel-' + b.fout, error: FOUT[b.fout] || 'Geen toegang.' }); return false; }
      if (b) {
        doosAfketsers.delete(ip);
        req.doosBewezen = b.doos; req.doosZaak = b.zaak; req.doosSleutelTot = b.expires_at;
        reg.telGebruik(b.doos); reg.telWeg('eigen');
        return true;
      }
    }
    /* De gedeelde sleutel: in productie wordt hij niet eens vergeleken. */
    const s = process.env.RTG_DOOS_SLEUTEL || '';
    const g = String(req.get('x-doos-sleutel') || '');
    if (productie() || !s || !g || !crypto.timingSafeEqual(h(g), h(s))) return afketser(req, res, ip, rij);
    doosAfketsers.delete(ip); // een goede sleutel wist de teller
    reg.telWeg('gedeeld', req.get('x-doos-id') || (req.body && req.body.doos));
    /* Staat de gedeelde sleutel dicht, dan is een GOEDE gedeelde sleutel geen
       afketser (geen blokkade per IP) maar een doos die nog om moet. */
    if (reg.gedeeldeSleutel().dicht) {
      res.status(403).json({ error: 'De gedeelde doos-sleutel is dicht. Deze doos heeft een eigen sleutel nodig (RTG_DOOS_EIGEN_SLEUTEL met RTG_DOOS_ID).' });
      return false;
    }
    return true;
  }

  return doosSleutelOk;
};
