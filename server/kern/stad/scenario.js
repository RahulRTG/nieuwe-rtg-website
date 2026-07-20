/* RTG Stad, deel "scenario": de ENE knop waarmee de boardroom de hele stad in
   een stand zet. Elk scenario is een vaste, leesbare set regimes over alle
   domeinen; de knop verzet ze in een keer (en overschrijft losse handmatige
   regimes -- de knop is de waarheid). Het nood-scenario meldt zich daarnaast
   bij de beveiligingslaag, zodat de meldkamer het ook ziet.
   Krijgt de gedeelde ctx van kern/stad/index.js. */
module.exports = (ctx) => {
  const { regie, save, seintje, beveilig, nu } = ctx;

  const SCENARIOS = [
    { naam: 'nacht',     label: '🌙 Nacht',     uitleg: 'De stad slaapt: licht gedimd, netten zuinig, ophalen op afroep.',
      regimes: { verkeer: 'vrij', licht: 'gedimd', lucht: 'meten', geluid: 'waarschuwen', energie: 'zuinig', water: 'normaal', afval: 'op-afroep', parkeer: 'open' } },
    { naam: 'rustig',    label: '🍃 Rustig',    uitleg: 'Een kalme dag: alles open, de netten zuinig.',
      regimes: { verkeer: 'vrij', licht: 'normaal', lucht: 'meten', geluid: 'meten', energie: 'zuinig', water: 'normaal', afval: 'op-afroep', parkeer: 'open' } },
    { naam: 'normaal',   label: '🏙️ Normaal',   uitleg: 'De gewone doordeweekse stand.',
      regimes: { verkeer: 'vrij', licht: 'normaal', lucht: 'meten', geluid: 'meten', energie: 'normaal', water: 'normaal', afval: 'dagelijks', parkeer: 'open' } },
    { naam: 'druk',      label: '🔥 Druk',      uitleg: 'Spits en drukte: verkeer gedoseerd, extra licht, lucht en geluid op waarschuwen.',
      regimes: { verkeer: 'gedoseerd', licht: 'vol', lucht: 'waarschuwen', geluid: 'waarschuwen', energie: 'normaal', water: 'normaal', afval: 'dagelijks', parkeer: 'doseren' } },
    { naam: 'evenement', label: '🎆 Evenement', uitleg: 'Groot evenement: streng verkeersregime, intensief ophalen, netten op piek.',
      regimes: { verkeer: 'streng', licht: 'vol', lucht: 'waarschuwen', geluid: 'waarschuwen', energie: 'piek', water: 'normaal', afval: 'intensief', parkeer: 'doseren' } },
    { naam: 'nood',      label: '🚨 Nood',      uitleg: 'Calamiteit: alles op streng en vol; de meldkamer krijgt een melding.',
      regimes: { verkeer: 'streng', licht: 'vol', lucht: 'waarschuwen', geluid: 'waarschuwen', energie: 'piek', water: 'besparing', afval: 'op-afroep', parkeer: 'doseren' } }
  ];
  const perNaam = Object.fromEntries(SCENARIOS.map(s => [s.naam, s]));

  function zet({ naam, wie }) {
    const s = perNaam[String(naam || '')];
    if (!s) return { status: 400, error: 'Kies een scenario: ' + SCENARIOS.map(x => x.naam).join(', ') + '.' };
    const r = regie();
    const oud = r.scenario;
    r.scenario = s.naam;
    r.regimes = { ...s.regimes };   // de knop is de waarheid: losse regimes gaan mee
    r.sinds = nu(); r.door = wie || 'boardroom';
    save(); seintje();
    if (s.naam === 'nood' && beveilig && beveilig.meld) {
      try { beveilig.meld('stad-nood', 'kritiek', 'RTG Stad staat in het NOOD-scenario (gezet door ' + (wie || 'boardroom') + ').', { bron: 'stad' }); } catch (e) {}
    }
    return { ok: true, scenario: s.naam, oud, regimes: { ...r.regimes }, wie: wie || 'boardroom' };
  }

  return { SCENARIOS, api: { stadScenarioZet: zet } };
};
