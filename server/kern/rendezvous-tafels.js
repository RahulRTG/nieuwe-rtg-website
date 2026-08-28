/* Rendez-vous, deelbestand "tafels": DE KANTOORKANT VAN THE TABLE.

   Een tafel wordt door RTG samengesteld en niet door een lid: zes of acht mensen
   die iets aan elkaar hebben, en een avond die klopt. Dat is curatie, en curatie
   is mensenwerk.

   WAAROM DIT LOS STAAT VAN ./rendezvous-kring.js. Daar staat wat een GENODIGDE
   ziet, en de belangrijkste eigenschap daarvan is dat de gastenlijst er niet uit
   komt. Hier staat precies het tegenovergestelde: het kantoor MOET de lijst zien,
   anders kan het niets samenstellen. Twee tegengestelde regels in een bestand
   gaan vroeg of laat door elkaar lopen; zo staan ze uit elkaar en leest het
   verschil zichzelf.

   HET KANTOOR WERKT OP CODENAMEN, net als overal. Dat het kantoor ziet wie er
   samen aan tafel zitten is inherent aan samenstellen -- maar het ziet
   codenamen, en een echte naam vraagt zoals altijd om de kluis, met een reden en
   een regel in het inzagejournaal (server/inzagelog.js).

   EN DE STILLE KUNST BLIJFT STIL. Het kantoor mag twee mogelijke introducties
   dezelfde uitnodiging sturen; er is met opzet GEEN veld om dat vast te leggen,
   want zodra het genoteerd wordt, is het iets dat kan uitlekken. Wie het bedacht,
   weet het; de software hoeft het niet te weten. */
module.exports = ({ T, id, isDatum, schoon, nu, save, notify, codenaam }) => {

  function tafelMaak(b) {
    const naam = schoon(b.naam, 80);
    if (!naam) return { status: 400, error: 'Geef de tafel een naam.' };
    const plaatsen = Math.max(2, Math.min(12, parseInt(b.plaatsen, 10) || 8));
    const t = { id: id(), naam, stad: schoon(b.stad, 40), datum: isDatum(b.datum) ? b.datum : '',
      tijd: /^\d{2}:\d{2}$/.test(b.tijd || '') ? b.tijd : '', thema: schoon(b.thema, 120),
      plaatsen, genodigden: {}, at: nu() };
    for (const k of (Array.isArray(b.genodigden) ? b.genodigden : []).slice(0, plaatsen)) t.genodigden[k] = { status: 'open', at: nu() };
    T()[t.id] = t; save();
    for (const k of Object.keys(t.genodigden)) {
      try { notify(k, { title: 'Rendez-vous', body: 'Een uitnodiging: ' + naam + (t.stad ? ', ' + t.stad : '') + '.', scope: 'lifestyle' }); } catch (e) {}
    }
    /* Ook het antwoord op MAKEN draagt de lijst niet terug. Het kantoor ziet hem
       in het overzicht hieronder; hier zou hij alleen maar meeliften naar een
       plek waar niemand hem nodig heeft. */
    return { status: 200, ok: true, tafel: { ...t, genodigden: undefined, aantal: Object.keys(t.genodigden).length } };
  }

  // iemand later toevoegen aan een tafel die nog niet vol zit
  function tafelNodig(tid, key) {
    const t = T()[String(tid || '')];
    if (!t) return { status: 404, error: 'Deze tafel bestaat niet.' };
    if (!key) return { status: 400, error: 'Onbekend lid.' };
    if (t.genodigden[key]) return { status: 200, ok: true, al: true };
    if (Object.keys(t.genodigden).length >= t.plaatsen) return { status: 409, error: 'De tafel zit vol.' };
    t.genodigden[key] = { status: 'open', at: nu() };
    save();
    try { notify(key, { title: 'Rendez-vous', body: 'Een uitnodiging: ' + t.naam + (t.stad ? ', ' + t.stad : '') + '.', scope: 'lifestyle' }); } catch (e) {}
    return { status: 200, ok: true, aantal: Object.keys(t.genodigden).length };
  }

  /* Het overzicht voor het kantoor: wel de gastenlijst, op codenaam, met wie er
     heeft toegezegd. Dit is de enige plek waar die lijst het kern uit komt. */
  function tafelKantoor() {
    const uit = Object.values(T()).map(t => ({
      id: t.id, naam: t.naam, stad: t.stad, datum: t.datum, tijd: t.tijd, thema: t.thema,
      plaatsen: t.plaatsen, at: t.at,
      genodigden: Object.entries(t.genodigden).map(([k, g]) => ({ codenaam: codenaam(k), status: g.status })),
      toegezegd: Object.values(t.genodigden).filter(g => g.status === 'ja').length
    })).sort((a, b) => String(b.datum || b.at).localeCompare(String(a.datum || a.at)));
    return { status: 200, tafels: uit };
  }

  return { rvTafelMaak: tafelMaak, rvTafelNodig: tafelNodig, rvTafelKantoor: tafelKantoor };
};
