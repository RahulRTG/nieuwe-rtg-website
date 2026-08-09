/* HET GLOBAL COMMAND CENTER -- één beeld van hoe RTG en RTF er nu voor staan.

   Per domein: hoeveel objecten er zijn, wat er openstaat aan herstel, hoeveel
   uitzonderingen op een mens wachten, en of daar iets bij zit dat over zijn
   termijn is. Daarboven één oordeel per domein en één voor het geheel.

   DE STAND WORDT GERÉKEND, NIET GEZET. Er is geen veld "status" dat iemand op
   groen kan zetten. Het oordeel komt elke keer opnieuw uit de gegevens, en de
   redenen die eronder liggen staan erbij. Een stoplicht dat je kunt overrulen
   is een stoplicht dat op den duur altijd groen staat.

   EN HIJ ZWIJGT NIET ALS ER NIETS IS. Een domein zonder gegevens krijgt de
   stand "leeg" en niet "in orde": dat verschil is precies waar LAT.md regel 3
   over gaat. Niet gemeten is geen groen. */
'use strict';

const { SOORTEN, rijen } = require('./register');

const OK = 'in orde', LET = 'let op', STORING = 'storing', LEEG = 'leeg';

function maakPuls({ db, runbooks, zaken, toezicht, journaal, beleid }) {
  /* De domeinen komen uit het register, zodat er geen tweede lijst met
     domeinnamen ontstaat die na de eerste uitbreiding uit de pas loopt. */
  function domeinen() {
    const per = new Map();
    for (const soort of SOORTEN) {
      const g = per.get(soort.domein) || { domein: soort.domein, soorten: [], objecten: 0 };
      const n = rijen(db, soort).length;
      g.soorten.push({ type: soort.type, label: soort.label, meervoud: soort.meervoud, aantal: n });
      g.objecten += n;
      per.set(soort.domein, g);
    }
    return per;
  }

  function beeld() {
    const per = domeinen();
    const rbs = runbooks.lijst();
    const zLijst = zaken.lijst({ max: 1000 });
    const nuIso = new Date().toISOString();

    for (const rb of rbs) {
      const soort = SOORTEN.find(s => s.type === rb.type);
      if (!soort) continue;
      const g = per.get(soort.domein);
      if (!g) continue;
      g.herstel = (g.herstel || 0) + rb.kandidaten;
      if (rb.kandidaten) {
        g.runbooks = g.runbooks || [];
        g.runbooks.push({ id: rb.id, naam: rb.naam, kandidaten: rb.kandidaten,
          niveau: rb.oordeel.niveau, score: rb.oordeel.score, klantImpact: rb.klantImpact });
      }
    }
    for (const z of zLijst) {
      const g = per.get(z.domein);
      if (!g) continue;
      if (z.status !== zaken.KLAAR) {
        g.open = (g.open || 0) + 1;
        if (z.termijn < nuIso) g.overTermijn = (g.overTermijn || 0) + 1;
      }
    }

    const uit = [...per.values()].map(g => {
      const redenen = [];
      if (g.overTermijn) redenen.push(g.overTermijn + ' uitzondering(en) over de termijn');
      if (g.open) redenen.push(g.open + ' open uitzondering(en)');
      if (g.herstel) redenen.push(g.herstel + ' geval(len) wachten op herstel');
      const klant = (g.runbooks || []).some(r => r.klantImpact && r.kandidaten);
      let stand = OK;
      if (!g.objecten) stand = LEEG;
      else if (g.overTermijn || (klant && g.herstel >= 10)) stand = STORING;
      else if (g.open || g.herstel) stand = LET;
      return { domein: g.domein, stand, objecten: g.objecten, soorten: g.soorten,
        herstel: g.herstel || 0, open: g.open || 0, overTermijn: g.overTermijn || 0,
        runbooks: g.runbooks || [], redenen: redenen.length ? redenen : ['niets openstaand'] };
    });

    const rang = { [STORING]: 0, [LET]: 1, [LEEG]: 2, [OK]: 3 };
    uit.sort((a, b) => rang[a.stand] - rang[b.stand] || b.herstel - a.herstel);

    const agents = toezicht.alle();
    const zt = zaken.tellingen();
    const keten = journaal.controleer();
    const stand = uit.some(d => d.stand === STORING) ? STORING
      : uit.some(d => d.stand === LET) ? LET
        : uit.every(d => d.stand === LEEG) ? LEEG : OK;

    return {
      stand, at: nuIso, domeinen: uit,
      zaken: zt,
      agents: { totaal: agents.length, gestopt: agents.filter(a => a.gestopt).length,
        bijnaOpBudget: agents.filter(a => a.actiesOver < a.actiesMax * 0.1).length, lijst: agents },
      herstel: { runbooks: rbs.length, kandidaten: rbs.reduce((n, r) => n + r.kandidaten, 0),
        autoAan: beleid.waarde('herstel.autoAan', true) !== false },
      journaal: { regels: journaal.aantal(), venster: journaal.venster(), keten },
      beleid: { regels: beleid.alles().length, voorstellenOpen: beleid.openVoorstellen().length },
      /* WAT DIT BEELD NIET WEET, en dat hoort erbij te staan: het leest de
         collecties uit het register. Domeinen die (nog) geen soort in het
         register hebben, tellen hier niet mee -- ze staan dan niet op groen,
         ze staan er niet. */
      dekking: { soorten: SOORTEN.length, domeinen: uit.length }
    };
  }

  /* De korte vorm voor een balk of een telefoon: één regel per domein. */
  function kort() {
    const b = beeld();
    return { stand: b.stand, at: b.at,
      regels: b.domeinen.map(d => ({ domein: d.domein, stand: d.stand, open: d.open, herstel: d.herstel })),
      zakenOpen: b.zaken.open, agentsGestopt: b.agents.gestopt };
  }

  return { beeld, kort, OK, LET, STORING, LEEG };
}

module.exports = { maakPuls, OK, LET, STORING, LEEG };
