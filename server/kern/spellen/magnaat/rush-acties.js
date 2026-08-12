/* Magnaat: DE DIENST DRAAIEN -- de staat en de twee handelingen.

   De wetten staan in ./rush.js, de tabel in ./rush-voorvallen.js, de maandkant
   in ./rush-maand.js; dit bestand is de BEDIENING. Dezelfde scheiding als
   ./dienst.js tegenover ./dienst-acties.js, en om dezelfde reden: de lijst
   handelingen groeit met elke rol mee en de wetten niet.

   TWEE HANDELINGEN, EN ALLEBEI VRIJ. `rush` toont je werkvloer, `rush-pak` pakt
   er iets op. Een dienst die op je beurt moet wachten duurt in een partij van
   zes met 24 uur per beurt een week -- precies de redenering waarmee de
   sollicitatie vrij werd (./dienst-acties.js). Je werkt bovendien omdat je
   dienst hebt, niet omdat het jouw beurt is.

   JE ZIET ALLEEN WAT ER OPEN STAAT, en dat is geen zuinigheid met informatie
   maar de werkvloer zelf: om acht uur weet je niet dat de tap om half tien gaat
   schuimen. Zou de hele avond vooraf op je scherm staan, dan is het een
   planningspuzzel met volledige informatie -- en dan is er een beste volgorde
   die je kunt UITREKENEN in plaats van een keuze die je moet MAKEN.

   ER IS GEEN TERUG. Geen ongedaan maken, geen opnieuw beginnen. De avond ligt
   vast (./rush.js is deterministisch), dus zou terugdraaien kunnen, dan is het
   geen dienst meer maar een puzzel met oneindig veel pogingen. Wat wel kan:
   ophouden. Dat kost niets -- wet 4, en ./rush-maand.js handhaaft het. */
'use strict';

const R = require('./rush');
const D = require('./dienst');
const { vind } = require('./rush-maand');

module.exports = () => {
  /* De dienst van deze speler, met de zaak erbij -- of de reden dat er geen is.
     Een vraag, een antwoord: alles hieronder begint hier. */
  function mijnDienst(st, h) {
    const d = D.dienstVan(st, h);
    if (!d) return { error: 'Je hebt geen baan.' };
    const v = vind(st, d.vestiging);
    if (!v) return { error: 'Die zaak bestaat niet meer.' };
    if (!R.magRush(d.rol, v.sector))
      return { error: 'Voor deze rol is er nog geen werkvloer op je PDA.' };
    return { d, v };
  }

  /* De staat van EEN dienst, in DEZE maand. Een nieuwe maand is een nieuwe
     avond: de oude staat wordt overschreven en niet bewaard, want wat er van een
     dienst overblijft is de logregel en niet het klikpad (./rush-maand.js). */
  function staat(st, d, v) {
    const t = R.tafel(st);
    const bestaand = t.diensten[d.id];
    if (bestaand && bestaand.maand === st.maand) return bestaand;
    return (t.diensten[d.id] = { maand: st.maand, slot: 0, gedaan: [], klaar: false,
      vestiging: d.vestiging, werknemer: d.werknemer,
      /* DE EURO'S WORDEN HIER BEVROREN, aan het begin van de avond. `R.raming`
         leest de omzetgeschiedenis van de zaak, en die verschuift zodra de maand
         gedraaid heeft -- dan staat er aan het eind van je dienst een ander
         bedrag op je scherm dan er in het log belandt. Een speeltest vond dat;
         geen enkele toets keek ernaar, omdat beide getallen op zichzelf klopten. */
      raming: R.raming(v) });
  }

  /* Wat er NU open staat: binnengekomen, en nog niet opgepakt. */
  const openstaand = (vv, s, slot) => vv
    .filter(x => x.vanaf <= slot && !s.gedaan.some(g => g.id === x.id));

  /* RUSTIGE MOMENTEN GAAN VANZELF VOORBIJ. Staat er niets open, dan is er niets
     te kiezen en loopt de tijd door -- een avond met een gaatje erin is een
     avond en geen vastloper. Hij stopt zodra er iets openstaat, en anders aan
     het eind van de dienst.

     DIT IS DE ENIGE PLEK WAAR DE KLOK VERSPRINGT, en dat is met opzet: zou
     `rush-pak` het ook doen, dan staat de tijd op twee plekken en lopen die
     uiteen zodra er een derde bijkomt. Hij is idempotent, dus twee keer kijken
     verandert niets -- dezelfde eis als bij het bijrekenen van de wereld. */
  function verzet(vv, s) {
    while (!s.klaar && s.slot < R.SLOTS && !openstaand(vv, s, s.slot).length) s.slot++;
    if (s.slot >= R.SLOTS) { s.slot = R.SLOTS; s.klaar = true; }
    return s;
  }

  /* HET BEELD VOOR HET SCHERM. De bedragen zijn de raming van deze zaak
     (./rush.js), want een werkvloer toont euro's en geen gewichten. */
  function beeld(potje, h) {
    const st = potje.staat;
    const mijn = mijnDienst(st, h);
    if (mijn.error) return { status: 200, ok: true, dienst: null, waarom: mijn.error };
    const { d, v } = mijn;
    const vv = R.bouw(potje.id, d, st.maand, d.rol);
    const s = verzet(vv, staat(st, d, v));
    const schaal = s.raming / Math.max(0.001, R.opVolgorde(vv));
    return { status: 200, ok: true, dienst: {
      id: d.id, zaak: v.naam, rol: (D.ROLLEN[d.rol] || {}).naam,
      maand: st.maand, moment: Math.min(s.slot + 1, R.SLOTS), momenten: R.SLOTS,
      klaar: s.klaar,
      open: s.klaar ? [] : openstaand(vv, s, s.slot).map(x => ({
        id: x.id, wat: x.wat,
        /* WAT HET NU AL GEKOST HEEFT en wat het per moment nog kost. Geen
           urgentiekleurtje, geen sterretjes, geen aftellende balk: drie
           bedragen, en de speler weegt zelf. Dat is wet 1. */
        gelopen: R.rond(x.groei * Math.max(0, s.slot - x.vanaf) * schaal),
        perMoment: R.rond(x.groei * schaal),
        blijftLiggen: R.rond(x.kost * schaal)
      })),
      gedaan: s.gedaan.map(g => ({ id: g.id, moment: g.slot + 1,
        deed: (vv.find(x => x.id === g.id) || {}).deed || g.id })),
      uitkomst: s.klaar ? R.uitkomst(vv, s, v) : null
    } };
  }

  const ACTIETABEL = {
    /* KIJKEN. Geen zet, geen kosten, geen beurt -- en met opzet dezelfde actie
       waarmee je de dienst opent en waarmee je hem volgt. */
    'rush'(potje, h) { return beeld(potje, h); },

    /* IETS OPPAKKEN. Een moment, een voorval. */
    'rush-pak'(potje, h, zet) {
      const st = potje.staat;
      const mijn = mijnDienst(st, h);
      if (mijn.error) return { status: 409, error: mijn.error };
      const { d, v } = mijn;
      const vv = R.bouw(potje.id, d, st.maand, d.rol);
      const s = verzet(vv, staat(st, d, v));
      if (s.klaar) return { status: 409, error: 'Je dienst zit erop.' };
      const wat = openstaand(vv, s, s.slot).find(x => x.id === String(zet.wat || ''));
      if (!wat) return { status: 404, error: 'Daar staat nu niets voor open.' };
      s.gedaan.push({ id: wat.id, slot: s.slot });
      s.slot++;
      verzet(vv, s);
      return beeld(potje, h);
    }
  };

  /* WAT HET WERKBEELD ERVAN MEEKRIJGT, en met opzet alleen deze twee velden.
     `beeld` is een ANTWOORD op een actie en draagt dus `status` en `ok`; die
     horen niet in de spelstand terecht te komen, want daar betekenen ze iets
     anders. Zonder deze uitgang lekten ze er via `Object.assign` gewoon in. */
  const vloer = (potje, h) => { const b = beeld(potje, h);
    return { dienst: b.dienst, waarom: b.waarom }; };

  return { ACTIES: ACTIETABEL, VRIJE_ACTIES: Object.keys(ACTIETABEL), beeld, vloer };
};
