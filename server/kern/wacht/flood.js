/* De Wacht: de automatische lastafworp en de rand-status.

   Dit is een reflex, geen bestuur. Hij herkent een L7-piek (te veel verzoeken
   in het tienseconden-venster) en zet dan zelf de deur op een kier:

     - de zekering trip zichzelf, het middleware serveert 503 "kom zo terug",
     - de felste bronnen gaan meteen in quarantaine,
     - het gaat kritiek op het bord, en
     - er komt een raadkamer-voorstel, zodat een mens hem eerder kan opheffen.

   De zekering dooft vanzelf. Een reflex die blijft hangen is geen bescherming
   maar een storing, dus hij is tijdgebonden; de mens blijft de baas en kan hem
   ook handmatig opheffen.

   De rand-status hoort hier omdat het dezelfde vraag beantwoordt vanaf de
   andere kant: staat de eerste linie nog? Eerlijk daarover: we hebben geen
   bevoorrechte inkijk in Cloudflare. Wat we wél kunnen zien is of het verkeer
   werkelijk via de rand binnenkomt, want elk edge-verzoek draagt CF-Ray en
   CF-Connecting-IP. Dat is het waarneembare analoog. */
const { LASTAFWORP_MS, L7_DREMPEL, TOP_AFSNIJDEN, RAND_VERS_MS } = require('./staat');

module.exports = (kamer) => {
  const { save, beveilig, lees, W } = kamer;
  // Leeft in het geheugen, niet in de db: het is een live gezondheidssignaal
  // (kwam er net randverkeer binnen?), geen staat om te bewaren.
  const randLaatst = { at: 0, ray: null, provider: null };

  function beoordeelFlood(delta) {
    const w = W(); const nu = Date.now();
    const la = w.lastafworp;
    // Verlopen? Vanzelf doven.
    if (la.actief && la.tot && la.tot <= nu) { la.actief = false; la.tot = null; save(); }
    const drempel = Number(w.drempels['l7-flood']) > 0 ? Number(w.drempels['l7-flood']) : L7_DREMPEL;
    if (la.actief) { if (delta > (la.piek || 0)) { la.piek = delta; } return la; }
    if (delta <= drempel) return la;

    // Trip: tijdgebonden lastafworp aanzetten.
    la.actief = true; la.sinds = nu; la.tot = nu + LASTAFWORP_MS; la.piek = delta;
    la.drempel = drempel;
    la.reden = 'L7-piek: ' + delta + ' verzoeken/10s (drempel ' + drempel + ')';
    // De felste bronnen meteen afsnijden (isoleer slaat zelf op en meldt).
    const bronnen = (lees.verdachteBronnen() || []).slice()
      .sort((a, b) => (b.treffers || 0) - (a.treffers || 0)).slice(0, TOP_AFSNIJDEN);
    la.bronnen = bronnen.map(s => s.bron);
    for (const s of bronnen) if (s && s.bron) kamer.isoleer(s.bron, 'automatische lastafworp (L7-piek)');
    if (beveilig) beveilig.meld('lastafworp', 'kritiek',
      'Automatische lastafworp: ' + la.reden + '. De server serveert tijdelijk 503 ("kom zo terug") en sneed ' +
      bronnen.length + ' bron(nen) af. Dooft vanzelf over ' + Math.round(LASTAFWORP_MS / 60000) + ' min.',
      { bron: 'lastafworp' });
    if (!w.raad.some(v => v.status === 'open' && v.actie && v.actie.soort === 'lastafworp')) {
      kamer.voorstel({
        soort: 'afweer', titel: 'Lastafworp actief (L7-piek)',
        uitleg: 'De Wacht zette bij ' + delta + ' verzoeken/10s automatisch de deur op een kier (503). ' +
          'Hij dooft vanzelf; accepteer dit voorstel om hem nu al op te heffen, of pas de drempel aan.',
        actie: { soort: 'lastafworp', aan: false }
      });
    }
    save();
    return la;
  }

  /* Het middleware raadpleegt dit per verzoek. Bewust goedkoop en zonder
     schijf-schrijf in het hete pad: de meet-lus (elke 10s) verzorgt het opslaan. */
  function lastAfworpActief() {
    const w = W(); const la = w.lastafworp;
    if (!la || !la.actief) return false;
    if (la.tot && la.tot <= Date.now()) { la.actief = false; return false; }
    return true;
  }

  function randGezien(info) {
    info = info || {};
    randLaatst.at = Date.now();
    if (info.ray) randLaatst.ray = String(info.ray).slice(0, 60);
    if (info.provider) randLaatst.provider = String(info.provider).slice(0, 40);
  }

  function randStatus() {
    const nu = Date.now();
    const verwacht = !!(process.env.RTG_EDGE || process.env.RTG_ACHTER_RAND);
    const geziens = randLaatst.at > 0;
    const versGezien = geziens && (nu - randLaatst.at) < RAND_VERS_MS;
    let status, uitleg;
    if (versGezien) {
      status = 'actief';
      uitleg = 'Verkeer komt binnen via de rand (' + (randLaatst.provider || 'edge') + '); de eerste linie staat.';
    } else if (verwacht && geziens) {
      status = 'stil';
      uitleg = 'Rand verwacht, maar geen recent randverkeer gezien -- controleer de edge-laag.';
    } else if (verwacht) {
      status = 'wachtend';
      uitleg = 'Rand verwacht, nog geen randverkeer waargenomen.';
    } else {
      status = 'onbekend';
      uitleg = 'Geen rand/edge geconfigureerd; verkeer komt rechtstreeks binnen.';
    }
    return {
      status, verwacht, provider: randLaatst.provider, ray: randLaatst.ray,
      laatstGezien: randLaatst.at || null,
      ouderdomSec: geziens ? Math.round((nu - randLaatst.at) / 1000) : null, uitleg
    };
  }

  // Directe schakelaar voor de boardroom, naast de raadkamer-weg.
  function zetLastafworp(aan) { return kamer.voerUit({ soort: 'lastafworp', aan: !!aan }); }

  return { beoordeelFlood, lastAfworpActief, randGezien, randStatus, zetLastafworp };
};
