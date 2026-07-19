/* De Zaakdoos, deelbestand "netwerk": het meetstation, de buurtfailover en het
   nachtwerk. Een doos die mee mag doen aan het RTG-netwerk (RTG_DOOS_NETWERK=1)
   rapporteert compacte, anonieme lijnmetingen aan de cloud (rondreistijd en modus)
   en haalt bij die melding een eventuele opdracht van het wereldbord op. Valt de
   lijn weg, dan geeft de doos zijn melding af bij een buurdoos, die hem met een
   via-stempel doorstuurt. Om vier uur in de nacht gaat het dagrapport naar de cloud.
   Krijgt de gedeelde ctx van kern/zaakdoos/index.js. */
module.exports = (ctx) => {
  const { db, save, nu, st, teller, journaal, beheer, haalKloon, kasStats,
    CLOUD, SLEUTEL, NETWERK, DOOS_NAAM, MELD_MS, PLEK, BUREN } = ctx;

  async function meldMeting(rtt) {
    if (!NETWERK || nu() - st.laatsteMelding < MELD_MS) return;
    st.laatsteMelding = nu();
    try {
      const r = await fetch(CLOUD() + '/api/doos/meting', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-doos-sleutel': SLEUTEL },
        body: JSON.stringify({ doos: DOOS_NAAM, rtt, modus: st.modus, journaal: journaal().length, plek: PLEK || undefined,
          versie: beheer.versie, wifi: beheer.wifiRol(), stroom: beheer.stroom() || undefined }),
        signal: AbortSignal.timeout(10000)
      });
      // het kantoor kan via het wereldbord een opdracht meegeven (reset/hulp/
      // update), en geeft de gewenste netwerkrol met de eigen melding mee terug
      const d = await r.json().catch(() => ({}));
      if (d && d.netwerk) beheer.pasNetwerkToe(d.netwerk);
      if (d && d.opdracht) voerOpdrachtUit(d.opdracht);
    } catch (e) { /* geen lijn; de volgende tik probeert weer */ }
  }
  /* Een opdracht van het wereldbord, opgehaald bij de eigen melding (de cloud
     hoeft het kastje dus nooit van buiten te bereiken):
     - reset: gooi de kloon weg en haal hem vers op;
     - hulp: stuur direct het dagrapport (diagnose) en meld meteen opnieuw. */
  async function voerOpdrachtUit(actie) {
    if (actie === 'reset') {
      st.laatsteKloon = 0;
      await haalKloon();
      console.log('[doos] reset-opdracht van het kantoor uitgevoerd: verse kloon binnen');
    } else if (actie === 'hulp') {
      try {
        await fetch(CLOUD() + '/api/doos/rapport', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-doos-sleutel': SLEUTEL },
          body: JSON.stringify(dagrapport()), signal: AbortSignal.timeout(10000)
        });
      } catch (e) {}
      st.laatsteMelding = 0; // en de volgende tik meldt direct opnieuw
      console.log('[doos] hulp-opdracht van het kantoor: diagnoserapport verstuurd');
    } else if (actie === 'update') {
      // de software-update: doelversie ophalen en de update-hook draaien
      await beheer.doeUpdate();
    }
  }
  /* De buurtfailover: valt bij deze doos de lijn weg, dan geeft hij zijn
     lijnmelding af bij een buurdoos (RTG_DOOS_BUREN), die hem met een
     via-stempel doorstuurt naar de cloud. Zo ziet de vloot het verschil
     tussen "de lijn is kapot" en "het kastje staat uit". Er reist alleen
     de compacte melding mee, nooit zaakdata van wie dan ook. */
  async function meldViaBuur() {
    if (!NETWERK || !BUREN.length || nu() - st.laatsteBuurMelding < 60000) return;
    st.laatsteBuurMelding = nu();
    const melding = { doos: DOOS_NAAM, rtt: 0, modus: st.modus, journaal: journaal().length };
    for (const buur of BUREN) {
      try {
        const r = await fetch(buur + '/api/doos/buurmelding', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-doos-sleutel': SLEUTEL },
          body: JSON.stringify(melding), signal: AbortSignal.timeout(8000)
        });
        if (r.ok) return;
      } catch (e) { /* deze buur ook niet; de volgende proberen */ }
    }
  }
  // de ontvangende kant: de melding van een buurdoos doorsturen naar de cloud
  async function buurDoorgeven(b) {
    if (st.modus !== 'cloud') return false; // onze eigen lijn ligt er ook uit
    b = b || {};
    try {
      const r = await fetch(CLOUD() + '/api/doos/meting', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-doos-sleutel': SLEUTEL },
        body: JSON.stringify({ doos: b.doos, rtt: b.rtt, modus: b.modus, journaal: b.journaal, via: DOOS_NAAM }),
        signal: AbortSignal.timeout(10000)
      });
      return r.ok;
    } catch (e) { return false; }
  }

  /* Het nachtwerk zelf: eigen huishouding plus het dagrapport naar de cloud. */
  function dagrapport() {
    const inLokaal = st.modus === 'lokaal' && st.lokaalSinds ? nu() - st.lokaalSinds : 0;
    return {
      doos: DOOS_NAAM, datum: new Date(teller.sinds).toISOString().slice(0, 10),
      pings: teller.pings, rttGem: teller.pings ? Math.round(teller.rttSom / teller.pings) : 0,
      uitval: teller.uitval, lokaalMin: Math.round((teller.lokaalMs + inLokaal) / 60000),
      nagespeeld: teller.nagespeeld,
      kloonLeeftijdMin: st.laatsteKloon ? Math.round((nu() - st.laatsteKloon) / 60000) : null,
      kasStuks: kasStats().stuks, journaalNu: journaal().length
    };
  }
  async function nachtwerk() {
    // een uitgediende ref-kaart mag weg zodra het journaal leeg is
    if (!journaal().length && Object.keys(db.data.doosRefKaart || {}).length > 500) { db.data.doosRefKaart = {}; save(); }
    if (!NETWERK) return;
    try {
      const r = await fetch(CLOUD() + '/api/doos/rapport', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-doos-sleutel': SLEUTEL },
        body: JSON.stringify(dagrapport()), signal: AbortSignal.timeout(10000)
      });
      if (r.ok) {
        teller.pings = 0; teller.rttSom = 0; teller.uitval = 0; teller.lokaalMs = 0; teller.nagespeeld = 0;
        teller.sinds = Date.now();
      }
    } catch (e) { /* geen lijn; de volgende nacht opnieuw */ }
  }

  return { meldMeting, meldViaBuur, buurDoorgeven, dagrapport, nachtwerk };
};
