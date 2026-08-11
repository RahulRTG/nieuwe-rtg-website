/* DE SIMULATIE: twaalf maanden vooruit, in drie scenario's.

   WAT DIT WEL EN NIET IS. Dit rekent de aannames van de ondernemer door. Het
   voorspelt niets, en het weet niets van zijn markt. Dat verschil is de reden
   dat elke aanname met NAAM, GETAL EN HERKOMST in het antwoord staat: wie het
   resultaat wil wantrouwen, moet kunnen zien waar het op rust. Dezelfde
   discipline als de wat-als-motor van het stadsweefsel.

   `herkomst` is daarbij het belangrijkste veld. 'opgegeven' betekent dat de
   ondernemer het getal zelf heeft ingevuld; 'aanname' betekent dat wij een
   startwaarde hebben gekozen die hij kan overschrijven. Zonder dat onderscheid
   lijkt onze gok net zo hard als zijn eigen cijfer, en dat is precies hoe een
   prognose ongemerkt van eigenaar wisselt.

   ZONDER INVOER GEEN UITKOMST. Ontbreekt er iets, dan komt er een fout met de
   ontbrekende velden erbij en geen half doorgerekende maand. Lat-regel 3.

   DE AANLOOP IS EEN AANNAME EN GEEN NATUURWET. Vrijwel niemand draait in maand
   een op vol volume; wij modelleren dat als een oploop, maar de lengte ervan
   staat als aanname in het antwoord en is te wijzigen. */
'use strict';

const MAANDEN = 12;

/* De scenario's uit de opdracht: een slechte, de basis, en groei. Het zijn
   volumefactoren en niets anders -- de kosten bewegen mee via het volume, de
   vaste lasten niet, want dat is wat vaste lasten zijn. */
const SCENARIOS = [
  { id: 'slecht', label: 'Slecht scenario', factor: 0.65, uitleg: 'Een derde minder verkoop dan u verwacht.' },
  { id: 'basis', label: 'Basisscenario', factor: 1, uitleg: 'Precies wat u zelf verwacht.' },
  { id: 'groei', label: 'Groeiscenario', factor: 1.4, uitleg: 'Veertig procent meer verkoop dan u verwacht.' }
];

const rond = (n) => Math.round(n * 100) / 100;
const rondE = (n) => Math.round(n);

module.exports = ({ intakeOntbreekt }) => {

  /* De aannames die wij invullen als de ondernemer ze niet geeft. Elk hiervan
     is te overschrijven via de intake of via de aanroep. */
  const STANDAARD = {
    aanloopMaanden: { waarde: 6, uitleg: 'Aantal maanden voordat u op vol volume draait.' },
    startFractie: { waarde: 0.25, uitleg: 'Deel van uw verwachte volume dat u in maand 1 haalt.' },
    reservePercentage: { waarde: 30, uitleg: 'Deel van de winst dat u opzij zet voor belasting. Een reservering, geen berekening -- de echte aanslag hangt af van uw rechtsvorm en uw persoonlijke situatie.' }
  };

  /* Het volume van maand m: lineair oplopend van startFractie naar vol, en
     daarna vlak. Bewust simpel en bewust zichtbaar. */
  function volumeIn(maand, vol, aanloop, startFractie) {
    if (maand >= aanloop) return vol;
    const stap = (1 - startFractie) / Math.max(1, aanloop - 1);
    return vol * (startFractie + stap * (maand - 1));
  }

  function draaiScenario(inv, factor) {
    const maanden = [];
    let kas = inv.startkapitaal;
    let runway = null;
    for (let m = 1; m <= MAANDEN; m++) {
      const aantal = volumeIn(m, inv.verwachtPerMaand * factor, inv.aanloopMaanden, inv.startFractie);
      const omzet = aantal * inv.prijs;
      const inkoop = aantal * inv.kostprijs;
      const bruto = omzet - inkoop;
      const resultaat = bruto - inv.vasteLasten;
      const reserve = resultaat > 0 ? resultaat * (inv.reservePercentage / 100) : 0;
      const netto = resultaat - reserve;
      kas += netto;
      if (runway === null && kas < 0) runway = m - 1;
      maanden.push({ maand: m, aantal: rond(aantal), omzet: rondE(omzet), inkoop: rondE(inkoop),
        brutomarge: rondE(bruto), vasteLasten: rondE(inv.vasteLasten), resultaat: rondE(resultaat),
        belastingreserve: rondE(reserve), netto: rondE(netto), kas: rondE(kas) });
    }
    const som = (v) => rondE(maanden.reduce((s, x) => s + x[v], 0));
    const jaarOmzet = som('omzet');
    return {
      maanden,
      maand12: maanden[MAANDEN - 1],
      jaar: {
        omzet: jaarOmzet, inkoop: som('inkoop'), brutomarge: som('brutomarge'),
        vasteLasten: som('vasteLasten'), resultaat: som('resultaat'),
        belastingreserve: som('belastingreserve'), netto: som('netto'),
        margePercentage: jaarOmzet > 0 ? Math.round((som('brutomarge') / jaarOmzet) * 100) : null
      },
      eindkas: maanden[MAANDEN - 1].kas,
      /* De maand waarin de kas onder nul duikt, of null als dat niet gebeurt.
         Dit is het getal waar de stress test op aanslaat. */
      runwayMaanden: runway
    };
  }

  /* De simulatie. `over` mag aannames overschrijven; wat er niet in staat komt
     uit STANDAARD en wordt als zodanig gemerkt. */
  function simuleer(o, over) {
    const intake = o.intake || {};
    const mist = intakeOntbreekt(intake, 'simulatie');
    if (mist && mist.length) {
      return { status: 400, error: 'De simulatie kan nog niet rekenen.', ontbreekt: mist,
        uitleg: 'Zonder deze getallen zou de uitkomst onze aanname zijn en niet uw plan.' };
    }
    const b = over || {};
    const pak = (naam) => {
      const eigen = Number(b[naam]);
      return Number.isFinite(eigen) && eigen >= 0
        ? { waarde: eigen, herkomst: 'opgegeven' }
        : { waarde: STANDAARD[naam].waarde, herkomst: 'aanname' };
    };
    const aanloop = pak('aanloopMaanden');
    const startF = pak('startFractie');
    const reserve = pak('reservePercentage');

    const inv = {
      prijs: intake.idee.prijs, kostprijs: intake.idee.kostprijs,
      verwachtPerMaand: intake.idee.verwachtPerMaand, vasteLasten: intake.idee.vasteLasten,
      startkapitaal: Number(intake.persoon && intake.persoon.startkapitaal) || 0,
      aanloopMaanden: Math.max(1, Math.round(aanloop.waarde)),
      startFractie: Math.min(1, Math.max(0, startF.waarde)),
      reservePercentage: Math.min(100, Math.max(0, reserve.waarde))
    };

    const scenarios = {};
    for (const s of SCENARIOS) {
      scenarios[s.id] = Object.assign({ id: s.id, label: s.label, uitleg: s.uitleg, factor: s.factor },
        draaiScenario(inv, s.factor));
    }

    return {
      ok: true, scenarios,
      /* Elke aanname met naam, getal en herkomst. Zie de kop. */
      aannames: [
        { naam: 'prijs per eenheid', waarde: inv.prijs, herkomst: 'opgegeven' },
        { naam: 'kostprijs per eenheid', waarde: inv.kostprijs, herkomst: 'opgegeven' },
        { naam: 'verwacht aantal per maand', waarde: inv.verwachtPerMaand, herkomst: 'opgegeven' },
        { naam: 'vaste lasten per maand', waarde: inv.vasteLasten, herkomst: 'opgegeven' },
        { naam: 'startkapitaal', waarde: inv.startkapitaal,
          herkomst: (intake.persoon && intake.persoon.startkapitaal !== undefined && intake.persoon.startkapitaal !== null) ? 'opgegeven' : 'aanname',
          uitleg: 'Zonder opgave rekenen we met nul, want geleend geld dat er niet is, is geen buffer.' },
        { naam: 'aanloop in maanden', waarde: inv.aanloopMaanden, herkomst: aanloop.herkomst, uitleg: STANDAARD.aanloopMaanden.uitleg },
        { naam: 'volume in maand 1', waarde: inv.startFractie, herkomst: startF.herkomst, uitleg: STANDAARD.startFractie.uitleg },
        { naam: 'belastingreservering in %', waarde: inv.reservePercentage, herkomst: reserve.herkomst, uitleg: STANDAARD.reservePercentage.uitleg }
      ],
      voorbehoud: 'Dit is een doorrekening van uw eigen aannames over twaalf maanden. Het is geen voorspelling en geen fiscaal advies; de belastingreservering is een reservering en geen berekende aanslag.'
    };
  }

  return { SIMULATIE_SCENARIOS: SCENARIOS, simuleer };
};

module.exports.SCENARIOS = SCENARIOS;
module.exports.MAANDEN = MAANDEN;
