/* Kern-module "De Wacht": het immuunsysteem én de raadkamer van het platform.

   Vier taken, allemaal zichtbaar op het beveiligde techniek-bord:

   1. METERS & GRAFIEK (hier). Een ringbuffer van momentopnames: verzoeken,
      bans, actieve IP's, open alarmen, quarantaines, geheugen. Zo zie je op het
      bord live meters en een grafiek van de laatste ~30 minuten.
   2. AFWEER (./afweer.js). Een indringer wordt in quarantaine gezet en
      afgesneden, tijdgebonden.
   3. HYGIENE (hier). Een veegbeurt die verlopen quarantaines, oude besluiten en
      een te lange grafiek opruimt en rapporteert wat er weg ging.
   4. RAADKAMER (./raadkamer.js). De AI stelt voor, de mens beslist, en alleen
      acties uit een vaste lijst worden uitgevoerd.

   Daarnaast ./flood.js: de automatische lastafworp bij een L7-piek, plus de
   rand-status van de edge-laag.

   De modules praten met elkaar via één gedeeld kamer-object. Dat is bewust
   laatgebonden: de flood-reflex roept de afweer en de raadkamer aan, en de
   raadkamer roept de afweer en de hygiene aan. Zou elke module zijn buren bij
   het opbouwen binnenhalen, dan krijg je een kring die niet te sluiten is.

   Zuiver en testbaar: alle afhankelijkheden komen via ctx binnen. */
const { RING, maakW } = require('./staat');
const maakAfweer = require('./afweer');
const maakFlood = require('./flood');
const maakRaadkamer = require('./raadkamer');

module.exports = (ctx) => {
  const { db, save } = ctx;
  const beveilig = ctx.beveilig || null;
  // Live-signaallezers (injecteerbaar voor tests); veilige defaults zonder server.
  const lees = Object.assign({
    verzoeken: () => 0,          // monotone teller sinds opstart
    bans: () => 0,               // aantal IP's op de banlijst
    actieveIps: () => 0,         // IP's met verkeer in het venster
    verdachteBronnen: () => [],  // [{ bron, treffers }] uit het schild
    geheugenMB: () => Math.round((process.memoryUsage().rss || 0) / 1e6)
  }, ctx.lees || {});

  const W = maakW(db);
  const kamer = { db, save, beveilig, lees, W };
  let vorigeVerzoeken = null;

  /* ---------------- Meters & grafiek ---------------- */
  function meet() {
    const w = W();
    const totaal = lees.verzoeken();
    const delta = vorigeVerzoeken == null ? 0 : Math.max(0, totaal - vorigeVerzoeken);
    vorigeVerzoeken = totaal;
    const alarm = beveilig ? beveilig.samenvatting(1) : { open: 0, kritiek: 0 };
    const sample = {
      t: Date.now(),
      verzoeken: delta,
      bans: lees.bans(),
      ips: lees.actieveIps(),
      alarm: alarm.open || 0,
      kritiek: alarm.kritiek || 0,
      quarantaine: Object.keys(w.quarantaine).length,
      geheugen: lees.geheugenMB()
    };
    const la = kamer.beoordeelFlood(delta);
    sample.lastafworp = la && la.actief ? 1 : 0;
    w.grafiek.push(sample);
    if (w.grafiek.length > RING) w.grafiek.splice(0, w.grafiek.length - RING);
    return sample;
  }

  function meters() {
    const w = W();
    const laatste = w.grafiek[w.grafiek.length - 1] ||
      { verzoeken: 0, bans: 0, ips: 0, alarm: 0, kritiek: 0, geheugen: lees.geheugenMB() };
    return {
      verzoeken: laatste.verzoeken, bans: laatste.bans, ips: laatste.ips,
      alarm: laatste.alarm, kritiek: laatste.kritiek, geheugen: laatste.geheugen,
      quarantaine: Object.keys(w.quarantaine).length,
      openVoorstellen: w.raad.filter(v => v.status === 'open' || v.status === 'inconclaaf').length
    };
  }

  function grafiek() { return W().grafiek.slice(); }

  /* ---------------- Hygiene (zelf opruimen) ----------------
     Verlopen quarantaines, een te lange grafiek en afgehandelde besluiten van
     langer dan een dag geleden. Rapporteert wat er weg ging, zodat opruimen
     zichtbaar is en niet stilletjes gebeurt. */
  function opruimen() {
    const w = W(); const nu = Date.now(); let n = 0;
    for (const [bron, q] of Object.entries(w.quarantaine)) {
      if (q.tot && q.tot <= nu) { delete w.quarantaine[bron]; n++; }
    }
    if (w.grafiek.length > RING) { const weg = w.grafiek.length - RING; w.grafiek.splice(0, weg); n += weg; }
    const voor = w.raad.length;
    w.raad = w.raad.filter(v => !(['geaccepteerd', 'afgewezen'].includes(v.status) &&
      v.beslistOp && (nu - v.beslistOp) > require('./staat').OUD_BESLUIT_MS));
    n += voor - w.raad.length;
    w.hygiene = { laatst: nu, totaalOpgeruimd: (w.hygiene.totaalOpgeruimd || 0) + n, laatstAantal: n };
    save();
    return { opgeruimd: n, quarantaine: Object.keys(w.quarantaine).length, voorstellen: w.raad.length };
  }

  // De buren erbij hangen; ze zoeken elkaar op via kamer, dus de volgorde
  // waarin we ze aankoppelen maakt niet uit.
  kamer.opruimen = opruimen;
  Object.assign(kamer, maakAfweer(kamer));
  Object.assign(kamer, maakRaadkamer(kamer));
  Object.assign(kamer, maakFlood(kamer));

  // Alles wat het bord nodig heeft in één lezing.
  function bord() {
    const w = W();
    return {
      meters: meters(),
      grafiek: grafiek(),
      quarantaine: kamer.quarantaineLijst(),
      hygiene: w.hygiene,
      drempels: w.drempels,
      lastafworp: w.lastafworp || { actief: false },
      rand: kamer.randStatus(),
      raad: w.raad.slice(0, 40),
      openVoorstellen: w.raad.filter(v => v.status === 'open' || v.status === 'inconclaaf').length
    };
  }

  return {
    meet, meters, grafiek, opruimen, bord,
    isoleer: kamer.isoleer, vrij: kamer.vrij,
    inQuarantaine: kamer.inQuarantaine, quarantaineLijst: kamer.quarantaineLijst,
    voorstel: kamer.voorstel, beslis: kamer.beslis, analyseer: kamer.analyseer,
    TOEGESTAAN: require('./staat').TOEGESTAAN,
    beoordeelFlood: kamer.beoordeelFlood, lastAfworpActief: kamer.lastAfworpActief,
    zetLastafworp: kamer.zetLastafworp, randGezien: kamer.randGezien, randStatus: kamer.randStatus
  };
};
