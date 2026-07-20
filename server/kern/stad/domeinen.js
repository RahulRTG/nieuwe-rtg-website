/* RTG Stad, deel "domeinen": wat de stad meet en hoe ze reageert. Per domein
   een vaste lijst regimes (de standen waarin de eigen hardware dat domein kan
   zetten) en een stand-berekening uit de verse metingen. De drempels zijn
   bewust eenvoudig en leesbaar: het bord moet uitlegbaar blijven voor de
   boardroom. Krijgt de gedeelde ctx van kern/stad/index.js. */
module.exports = (ctx) => {
  const { nu, metingen, regie, save, seintje } = ctx;

  const VERS_MS = 30 * 60 * 1000; // een meting ouder dan een half uur telt niet meer mee

  /* Elk domein: de sensor-soort die hem voedt, de eenheid, de regimes (eerste =
     standaard) en de drempels laag->hoog voor de stand rustig/normaal/druk. */
  const DOMEINEN = [
    { id: 'verkeer', label: 'Verkeer',   sens: 'verkeer', eenheid: 'vtg/u',  regimes: ['vrij', 'gedoseerd', 'streng'],       som: 'gem', drempels: [300, 900] },
    { id: 'licht',   label: 'Verlichting', sens: 'licht', eenheid: '%',      regimes: ['gedimd', 'normaal', 'vol'],          som: 'gem', drempels: [40, 80] },
    { id: 'lucht',   label: 'Lucht',     sens: 'lucht',   eenheid: 'AQI',    regimes: ['meten', 'waarschuwen'],              som: 'max', drempels: [50, 100] },
    { id: 'geluid',  label: 'Geluid',    sens: 'geluid',  eenheid: 'dB',     regimes: ['meten', 'waarschuwen'],              som: 'max', drempels: [55, 70] },
    { id: 'energie', label: 'Energie',   sens: 'energie', eenheid: 'kW',     regimes: ['zuinig', 'normaal', 'piek'],         som: 'som', drempels: [400, 900] },
    { id: 'water',   label: 'Water',     sens: 'water',   eenheid: 'm3/u',   regimes: ['normaal', 'besparing'],              som: 'som', drempels: [80, 160] },
    { id: 'afval',   label: 'Afval',     sens: 'afval',   eenheid: '% vol',  regimes: ['op-afroep', 'dagelijks', 'intensief'], som: 'max', drempels: [60, 85] },
    { id: 'parkeer', label: 'Parkeren',  sens: 'parkeer', eenheid: 'vrij',   regimes: ['open', 'doseren'],                   som: 'som', drempels: [150, 400] }
  ];
  const perId = Object.fromEntries(DOMEINEN.map(x => [x.id, x]));

  // de verse metingen van een sensor-soort (hooguit een half uur oud)
  function vers(sens) {
    const grens = nu() - VERS_MS;
    const uit = [];
    for (const m of metingen()) { if (m.at < grens) break; if (m.sens === sens) uit.push(m); }
    return uit;
  }

  /* De stand van een domein: waarde (gem/som/max over de verse metingen, een
     per node: de laatste wint) + het label rustig/normaal/druk. Parkeren is
     omgekeerd: veel vrije plekken is juist rustig. */
  function standVan(id) {
    const x = perId[id];
    if (!x) return { waarde: null, stand: 'stil', metingen: 0 };
    const perNode = {};
    for (const m of vers(x.sens)) if (!(m.node in perNode)) perNode[m.node] = m.waarde;
    const rij = Object.values(perNode);
    if (!rij.length) return { waarde: null, stand: 'stil', metingen: 0 };
    const waarde = x.som === 'som' ? rij.reduce((a, b) => a + b, 0)
      : x.som === 'max' ? Math.max(...rij)
      : rij.reduce((a, b) => a + b, 0) / rij.length;
    const w = Math.round(waarde * 10) / 10;
    let stand = w < x.drempels[0] ? 'rustig' : w < x.drempels[1] ? 'normaal' : 'druk';
    if (id === 'parkeer') stand = w > x.drempels[1] ? 'rustig' : w > x.drempels[0] ? 'normaal' : 'druk';
    return { waarde: w, stand, metingen: rij.length };
  }

  // de waarschuwingen op het bord: alleen wat om een handeling vraagt
  function alerts() {
    const uit = [];
    const lucht = standVan('lucht'), afval = standVan('afval'), geluid = standVan('geluid'), energie = standVan('energie');
    if (lucht.stand === 'druk') uit.push({ domein: 'lucht', tekst: 'De luchtkwaliteit is slecht (AQI ' + lucht.waarde + '); overweeg het verkeersregime "streng".' });
    if (afval.stand === 'druk') uit.push({ domein: 'afval', tekst: 'Er staan containers boven de ' + Math.round(afval.waarde) + '% vol; plan een extra ophaalronde.' });
    if (geluid.stand === 'druk') uit.push({ domein: 'geluid', tekst: 'Het geluidsniveau piekt (' + geluid.waarde + ' dB); handhaving of een evenement-check.' });
    if (energie.stand === 'druk') uit.push({ domein: 'energie', tekst: 'Het net trekt zwaar (' + Math.round(energie.waarde) + ' kW); dim de verlichting of zet energie op "zuinig".' });
    return uit;
  }

  // een regime met de hand verzetten (naast de scenario-knop); altijd via audit in de route
  function regimeZet({ domein, regime, wie }) {
    const x = perId[String(domein || '')];
    if (!x) return { status: 404, error: 'Onbekend domein.' };
    const r = String(regime || '');
    if (!x.regimes.includes(r)) return { status: 400, error: 'Kies een regime: ' + x.regimes.join(', ') + '.' };
    regie().regimes[x.id] = r;
    save(); seintje();
    return { ok: true, domein: x.id, regime: r, wie: wie || 'boardroom' };
  }

  return { DOMEINEN, standVan, alerts, api: { stadRegimeZet: regimeZet } };
};
