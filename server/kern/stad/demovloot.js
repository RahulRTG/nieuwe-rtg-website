/* RTG Stad, deel "demovloot": de stad die leeft zonder hardware.

   Zolang er geen echte Stadsdozen hangen, zaait dit deel er negen en laat het
   ze meebewegen met een begrensde random walk. Dat is geen sier: een bord dat
   leeg is, ziet er precies zo uit als een bord dat stuk is, en dan leert
   niemand het lezen.

   De demodozen dragen demo:true en hebben GEEN sleutel -- niemand kan namens ze
   insturen. Ze staan los van kern/stad/nodes.js omdat dat bestand over ECHTE
   hardware gaat: sleutels, poorten, buffers en kalibratie. Die twee door elkaar
   laten lopen is hoe een demo per ongeluk productiegedrag krijgt.
   Krijgt de gedeelde ctx plus de helpers van nodes.js. */
module.exports = (ctx, H) => {
  const { save, crypto, nu, nodes, metingen, MAX_METINGEN } = ctx;
  const { BEREIK, zorgPlaats, boekReeks } = H;
  const MAGNAAT_TEST = require('../../testomgeving').actief(process.env);

  /* De demoseed: acht Stadsdozen over de zes zones van het weefsel, alleen als
     de stad nog leeg is. De demodozen dragen demo:true; hun sleutels bestaan
     niet (niemand kan namens ze insturen), hun waarden komen uit de simulator
     hieronder. */
  function zorgBasis() {
    if (!MAGNAAT_TEST) { zorgPlaats(); return; }
    if (Object.keys(nodes()).length) { zorgPlaats(); return; }
    const demo = [
      ['Stadsdoos Plein',      'Centrum',          ['verkeer', 'lucht', 'geluid', 'licht']],
      ['Stadsdoos Haven',      'Marina',           ['verkeer', 'water', 'parkeer']],
      ['Stadsdoos Molenstraat','Oud-West',         ['verkeer', 'geluid', 'afval', 'licht']],
      ['Stadsdoos Fabriek',    'Bedrijvenkwartier',['energie', 'lucht', 'afval']],
      ['Stadsdoos Park',       'Groenzone',        ['lucht', 'geluid', 'water', 'grondwater']],
      ['Stadsdoos Strand',     'Boulevard',        ['verkeer', 'parkeer', 'licht', 'waterstand']],
      ['Stadsdoos Markt',      'Centrum',          ['afval', 'parkeer', 'energie', 'hitte']],
      ['Stadsdoos Sluis',      'Marina',           ['water', 'energie', 'licht', 'waterstand', 'riool']],
      // de klimaatdoos: dezelfde hardware, andere sensoren (kern/stadsweefsel/klimaat.js)
      ['Stadsdoos Weerpaal',   'Oud-West',         ['regen', 'hitte', 'riool', 'grondwater']]
    ];
    const START = { verkeer: 420, licht: 62, lucht: 38, geluid: 52, energie: 120, water: 22, afval: 35, parkeer: 90,
      regen: 1.5, grondwater: 120, riool: 35, waterstand: 45, hitte: 24 };
    for (const [naam, zone, sens] of demo) {
      const serial = 'SD-' + crypto.randomBytes(3).toString('hex').toUpperCase();
      nodes()[serial] = { serial, naam, zone, sensoren: sens, demo: true, actief: true,
        sleutelHash: null, laatsteContact: nu(), waarden: Object.fromEntries(sens.map(s => [s, START[s]])) };
    }
    save();
    zorgPlaats();
  }


  // De demovloot leeft: hooguit elke vijf minuten een nieuwe, licht verschoven
  // meting. Alleen schrijven als er echt iets veranderde -- het stadsbeeld wordt
  // vaak opgevraagd (bord + SSE) en elke save is een fsync naar schijf.
  function simuleer() {
    if (!MAGNAAT_TEST) return;
    const grens = nu() - 5 * 60 * 1000;
    let geraakt = false;
    for (const n of Object.values(nodes())) {
      if (!n.demo || !n.actief || (n.laatsteMeting || 0) > grens) continue;
      for (const s of n.sensoren) {
        const [lo, hi] = BEREIK[s];
        const stap = (hi - lo) * 0.04;
        const v = Math.min(hi, Math.max(lo, (n.waarden[s] || lo) + (Math.random() * 2 - 1) * stap));
        n.waarden[s] = Math.round(v * 10) / 10;
        metingen().unshift({ node: n.serial, zone: n.zone, sens: s, waarde: n.waarden[s], at: nu() });
        boekReeks(n, s, n.waarden[s], nu());
      }
      n.laatsteMeting = nu(); n.laatsteContact = nu();
      geraakt = true;
    }
    if (!geraakt) return;
    if (metingen().length > MAX_METINGEN) metingen().length = MAX_METINGEN;
    save();
  }

  return { zorgBasis, simuleer };
};
