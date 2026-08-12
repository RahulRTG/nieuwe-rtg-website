/* Magnaat: DE AI ALS WERKGEVER -- wat een bedrijf doet als het mensen nodig heeft.

   VERHAAL.md par. 0d, en het dicht een gat dat pas zichtbaar werd toen de
   intro werd uitgeschreven. De AI-concurrent bouwt, breidt uit, zet prijzen en
   doet onderzoek -- maar hij NAM NOOIT IEMAND AAN. Hij was concurrent, geen
   werkgever.

   DAT MAAKT DE ECHTE START ONMOGELIJK. Het spel hoort zo te beginnen: je bent
   zestien, je hebt geen bedrijf, je opent het werkscherm en er staan vacatures.
   Maar in maand nul heeft NIEMAND een zaak, dus is er niets om op te
   solliciteren -- en de eerste die iets opent moet dan wel een speler zijn met
   startkapitaal. Precies de spawn-als-ondernemer die eruit moest.

   Met deze module bestaat Havenzicht al voordat jij binnenkomt, en zoekt het
   personeel. De eerste overwinning in Magnaat is dan niet een miljoen; het is
   dat iemand je aanneemt.

   ================== DRIE REGELS ==================

   1. HIJ SPREEKT DEZELFDE WERKWOORDEN. Geen eigen wervingssysteem: hij roept
      `functie-openen` en `aannemen` aan, dezelfde acties als een speler, met
      dezelfde loonband en dezelfde grenzen. Dat is de wet van ./beheer.js en
      ./concurrent-zet.js, hier op werving toegepast -- een tweede manier om
      iemand in dienst te nemen is een tweede arbeidsmarkt.

   2. HIJ NEEMT AAN OP VOLGORDE VAN SOLLICITEREN, en niet op "de beste". Een AI
      die kandidaten rangschikt, rangschikt mensen -- en dan bestaat er een
      cijfer dat zegt wie een betere werknemer is. Dat is precies de ranglijst
      die VERHAAL.md uitsluit. Wie het eerst komt en binnen de band vraagt,
      krijgt de baan.

   3. HIJ WERFT WAT HIJ NODIG HEEFT EN NIET MEER. Het aantal volgt uit
      `personeelNodig` (./stap.js) -- dezelfde som waarmee de motor de bezetting
      van elke zaak rekent. Een AI die vacatures strooit om de arbeidsmarkt leeg
      te trekken, speelt een spel dat niemand kan winnen. */
'use strict';
const D = require('./dienst');
const { SECTOREN } = require('./sectoren');
const { personeelNodig } = require('./stap');

/* Hoeveel vacatures een bedrijf tegelijk open heeft staan. Twee, want een rij
   van tien openstaande functies bij dezelfde zaak is geen arbeidsmarkt maar een
   muur waar een speler niet doorheen kijkt. */
const MAX_OPEN = 2;

module.exports = ({ ACTIES }) => {
  /* WELKE ROL DEZE ZAAK MIST. Van onder naar boven: eerst handen, dan vakmensen,
     dan iemand die het runt. Zo groeit een bedrijf zoals een bedrijf groeit, en
     zo is er voor een zestienjarige altijd de rol die bij hem past. */
  function ontbrekendeRol(st, v) {
    const bezet = D.dienstenBij(st, v.id).map(d => d.rol);
    const open = D.functies(st).filter(f => f.status === 'open' && f.vestiging === v.id).map(f => f.rol);
    const heeft = new Set([...bezet, ...open]);
    const nodig = personeelNodig({ sector: v.sector, omvang: v.omvang, prijs: v.prijs, tech: v.tech || [] }, 0);
    /* EEN KLEINE ZAAK HEEFT GEEN BEDRIJFSLEIDER NODIG, en een grote wel. De
       drempel is de bezetting die de motor zelf rekent -- geen apart getal. */
    for (const rol of ['hulp', 'vakkracht', 'bedrijfsleider']) {
      if (heeft.has(rol)) continue;
      if (rol === 'vakkracht' && nodig < 4) continue;
      if (rol === 'bedrijfsleider' && nodig < 10) continue;
      return rol;
    }
    return null;
  }

  /* VACATURES OPENZETTEN. Geeft terug wat er open ging, zodat het in het
     maandverslag van de AI staat en niet stil gebeurt. */
  function werven(potje, h) {
    const st = potje.staat;
    const uit = [];
    const open = D.functies(st).filter(f => f.status === 'open' && f.werkgever === h).length;
    /* DE REM STAAT IN DE LUS EN NIET ERVOOR. Hier stond ook een vroege
       terugkeer op hetzelfde getal; die was dood, want de `break` hieronder
       telt de al openstaande vacatures mee. Twee remmen op een as is een rem
       die je kunt weghalen zonder dat er iets stukgaat, en dat is precies de
       soort code waar niemand achteraf nog van weet of hij ergens voor diende. */
    for (const v of (st.vestigingen[h] || [])) {
      if (uit.length + open >= MAX_OPEN) break;
      const rol = ontbrekendeRol(st, v);
      if (!rol) continue;
      /* HET LOON IS DE BASIS VAN DE BAND en niet de bodem. Een AI die
         structureel het minimum biedt, maakt van elke sollicitatie een slechte
         deal en van de arbeidsmarkt een fopspeen. */
      const loon = D.loonband(SECTOREN[v.sector].loon, rol).basis;
      const r = ACTIES['functie-openen'](potje, h, { vestiging: v.id, rol, loon });
      if (r && r.ok) uit.push({ id: r.id, vestiging: v.id, rol, loon });
    }
    return uit;
  }

  /* SOLLICITATIES BEHANDELEN. Op volgorde van binnenkomst; zie regel 2. */
  function reagerenOpSollicitaties(potje, h) {
    const st = potje.staat;
    const uit = [];
    for (const f of D.functies(st).filter(x => x.status === 'open' && x.werkgever === h)) {
      const eerste = (f.sollicitaties || [])[0];
      if (!eerste) continue;
      const r = ACTIES.aannemen(potje, h, { id: f.id, speler: eerste.speler });
      if (r && r.ok) uit.push({ functie: f.id, rol: f.rol, loon: r.loon });
    }
    return uit;
  }

  /* DE MAAND VAN EEN AI-WERKGEVER: eerst antwoorden op wie er stond, dan pas
     nieuwe vacatures. Andersom zou een kandidaat een maand langer wachten
     terwijl er al een plek voor hem was. */
  function maandVoorWerkgever(potje, h) {
    const genomen = reagerenOpSollicitaties(potje, h);
    const geopend = werven(potje, h);
    return (genomen.length || geopend.length) ? { aangenomen: genomen, vacatures: geopend } : null;
  }

  return { MAX_OPEN, ontbrekendeRol, werven, reagerenOpSollicitaties, maandVoorWerkgever };
};
/* OOK OP DE FABRIEK, en dat is geen dubbeling maar een reparatie die dit
   bestand al eens elders heeft gekost: ./beheer.js schrijft in zijn kop op hoe
   `B.MINTARIEF` van de MODULE werd gelezen -- dat is de fabriek, dus
   `undefined` -- waarna het tarief `NaN` werd. Een toets die `MAX_OPEN` op de
   fabriek opvraagt hoort een getal te krijgen en geen stilte. */
module.exports.MAX_OPEN = MAX_OPEN;
