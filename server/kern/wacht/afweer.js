/* De Wacht, taak 2: afweer.

   Een binnendringer, een IP, sessie of account dat zich als aanvaller gedraagt,
   wordt in QUARANTAINE gezet: het schild snijdt al zijn verkeer af (403).

   Dat is de eerlijke betekenis van "onschadelijk maken" in een webserver. We
   doden geen virus op een computer ergens; we laten deze bron er hier niet meer
   in. Quarantaine verloopt vanzelf na een uur, of de eigenaar geeft eerder vrij
   - een afsluiting zonder einddatum is een val waar je later zelf in loopt. */
const { QUARANTAINE_MS } = require('./staat');

module.exports = (kamer) => {
  const { save, beveilig, W } = kamer;

  function isoleer(bron, reden) {
    bron = String(bron || '').slice(0, 120);
    if (!bron) return null;
    const w = W();
    w.quarantaine[bron] = {
      reden: String(reden || 'handmatig').slice(0, 160),
      sinds: Date.now(), tot: Date.now() + QUARANTAINE_MS
    };
    save();
    if (beveilig) beveilig.meld('quarantaine', 'kritiek',
      'Bron ' + bron + ' is in quarantaine gezet (' + (reden || '') + '). Al het verkeer van deze bron wordt afgesneden.',
      { bron: 'quarantaine:' + bron });
    return w.quarantaine[bron];
  }

  function vrij(bron) {
    const w = W(); const had = !!w.quarantaine[String(bron || '')];
    delete w.quarantaine[String(bron || '')];
    if (had) save();
    return had;
  }

  // Het schild raadpleegt dit per verzoek; verlopen quarantaine dooft vanzelf.
  function inQuarantaine(bron) {
    const w = W(); const q = w.quarantaine[String(bron || '')];
    if (!q) return false;
    if (q.tot && q.tot <= Date.now()) { delete w.quarantaine[String(bron)]; save(); return false; }
    return true;
  }

  function quarantaineLijst() {
    const w = W(); const nu = Date.now();
    return Object.entries(w.quarantaine).map(([bron, q]) => ({
      bron, reden: q.reden, sinds: q.sinds, tot: q.tot,
      resterend: Math.max(0, Math.round(((q.tot || nu) - nu) / 1000))
    }));
  }

  return { isoleer, vrij, inQuarantaine, quarantaineLijst };
};
