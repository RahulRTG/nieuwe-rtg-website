/* Payroll OS: DE UREN UIT DE KLOK.

   HIER SLUIT DE KETEN. Het platform weet al wie wanneer inklokte; de loonmotor
   weet hoe je van uren naar loon komt. Wat ertussen ontbrak is de vertaling --
   en dat is precies de plek waar loonadministraties met de hand werk doen dat
   fout gaat: uren overtypen, nachttoeslag met een rekenmachine, en niemand die
   merkt dat er een uitklok mist.

   TWEE LAGEN, EN HET VERSCHIL IS WEZENLIJK:

     METEN  -- wat is er feitelijk geklokt: uren, nachturen, zondaguren,
               feestdaguren. Dat zijn FEITEN; ze volgen uit de klok en uit
               niets anders.
     WEGEN  -- welke toeslag daarop hoort. Dat volgt uit de cao, het contract
               en de bedrijfsregels, en verschilt per sector en per werkgever.

   Ze staan hier apart omdat ze anders vastroesten. Een import die meteen
   "overuren 125%" oplevert, heeft de cao in de meetcode gebakken; verandert de
   cao, dan verandert de meting mee en klopt de historie niet meer. Meten levert
   getallen, wegen levert componenten.

   DE CONTROLES ZITTEN IN DE METING, NIET ERNA. Een ontbrekende uitklok is geen
   waarschuwing achteraf maar een gat in de invoer: je weet niet hoe lang die
   dienst duurde. Zo'n dienst telt daarom NIET mee en komt als bevinding terug.
   Stilzwijgend afronden op "waarschijnlijk acht uur" is precies hoe iemand te
   weinig of te veel betaald krijgt zonder dat iemand het ziet. */
'use strict';

const UUR = 3600000;
/* De nacht loopt van 00:00 tot 06:00. Dat is een bedrijfsregel en hoort dus
   eigenlijk uit de cao te komen; hij staat hier als STANDAARD die je kunt
   meegeven, niet als waarheid. */
const STANDAARD = { nachtVan: 0, nachtTot: 6, weekUren: 40 };

const rond1 = (u) => Math.round(u * 10) / 10;

/* Hoeveel van een dienst valt in het nachtvenster. Een dienst van 22:00 tot
   06:00 loopt over middernacht heen; wie dat per dag rekent, telt de helft
   niet mee. Daarom uur voor uur, met de klok mee. */
function nachtUren(van, tot, nachtVan, nachtTot) {
  let ms = 0;
  for (let t = van; t < tot; t += UUR) {
    const eind = Math.min(t + UUR, tot);
    const uurVanDeDag = new Date(t).getHours();
    const inNacht = nachtVan < nachtTot
      ? (uurVanDeDag >= nachtVan && uurVanDeDag < nachtTot)
      : (uurVanDeDag >= nachtVan || uurVanDeDag < nachtTot);
    if (inNacht) ms += eind - t;
  }
  return ms / UUR;
}

function maakUren({ opslag, regels }) {
  const cfg = Object.assign({}, STANDAARD, regels || {});

  const klokVan = (code) => {
    const k = opslag.vreemd.klokVan(code);
    return Array.isArray(k) ? k : [];
  };

  /* ---------- meten ---------- */
  /* Levert per medewerker de gemeten feiten plus de bevindingen. Een periode is
     'JJJJ-MM'. */
  function meet(code, periode, opties) {
    const o = opties || {};
    const rijen = klokVan(code).filter(e => String(e.in || '').slice(0, 7) === periode);
    const perPersoon = new Map();
    const bevindingen = [];

    // eerst per persoon sorteren, zodat overlap te zien is
    const perId = new Map();
    for (const e of rijen) {
      if (!perId.has(e.staffId)) perId.set(e.staffId, []);
      perId.get(e.staffId).push(e);
    }

    for (const [staffId, lijst] of perId) {
      lijst.sort((a, b) => (a.in < b.in ? -1 : a.in > b.in ? 1 : 0));
      const feit = { staffId, naam: (lijst[0] || {}).name || null,
        uren: 0, nachturen: 0, zondaguren: 0, diensten: 0 };
      let vorigEind = null;

      for (const e of lijst) {
        /* Ontbrekende uitklok: de duur is onbekend. Niet schatten. */
        if (!e.out) {
          bevindingen.push({ soort: 'ontbrekende_uitklok', ernst: 'hoog', staffId,
            eigenaar: 'manager', wanneer: e.in,
            uitleg: 'Er is ingeklokt op ' + e.in + ' maar niet uitgeklokt. Deze dienst telt niet mee tot hij is aangevuld.',
            status: 'open' });
          continue;
        }
        const van = new Date(e.in).getTime(), tot = new Date(e.out).getTime();
        if (!(tot > van)) {
          bevindingen.push({ soort: 'onmogelijke_dienst', ernst: 'hoog', staffId, eigenaar: 'manager',
            wanneer: e.in, uitleg: 'De uitklok ligt niet na de inklok.', status: 'open' });
          continue;
        }
        /* Twee diensten die elkaar overlappen: iemand kan niet op twee plekken
           tegelijk klokken, dus een van beide klopt niet. Allebei laten
           meetellen zou de uren verdubbelen. */
        if (vorigEind && van < vorigEind) {
          bevindingen.push({ soort: 'overlappende_dienst', ernst: 'hoog', staffId, eigenaar: 'manager',
            wanneer: e.in, uitleg: 'Deze dienst begint voordat de vorige is geëindigd; een van beide klopt niet.',
            status: 'open' });
          continue;
        }
        /* Uren na uitdiensttreding. De einddatum komt van buiten (het contract),
           want de klok weet niet wie er nog in dienst is. */
        if (o.uitDienstOp && o.uitDienstOp[staffId] && e.in.slice(0, 10) > o.uitDienstOp[staffId]) {
          bevindingen.push({ soort: 'uren_na_uitdienst', ernst: 'hoog', staffId, eigenaar: 'administrateur',
            wanneer: e.in, uitleg: 'Er is geklokt na de laatste werkdag (' + o.uitDienstOp[staffId] + ').',
            status: 'open' });
          continue;
        }

        const duur = (tot - van) / UUR;
        feit.uren += duur;
        feit.nachturen += nachtUren(van, tot, cfg.nachtVan, cfg.nachtTot);
        if (new Date(van).getDay() === 0) feit.zondaguren += duur;
        feit.diensten++;
        vorigEind = tot;
      }

      feit.uren = rond1(feit.uren);
      feit.nachturen = rond1(feit.nachturen);
      feit.zondaguren = rond1(feit.zondaguren);
      perPersoon.set(staffId, feit);
    }

    return { periode, code, feiten: [...perPersoon.values()], bevindingen };
  }

  /* ---------- wegen ---------- */
  /* Van feiten naar componenten. De regels komen van buiten (cao, contract,
     bedrijf); wat hier staat is de STANDAARD, en hij is met opzet mager:
     liever te weinig automatisch dan een toeslag die niemand heeft afgesproken.

     Overuren gaan over het contract heen, niet over een vast getal: een
     nulurencontract kent ze niet en een 24-urencontract eerder dan een van 40. */
  function weeg(feit, contract, toeslagen) {
    const t = Object.assign({ nachtDeel: 0.20, overurenDeel: 0.25, drempelUren: null }, toeslagen || {});
    const invoer = [];
    const drempel = t.drempelUren != null ? t.drempelUren
      : (contract && contract.urenPerWeek ? contract.urenPerWeek * 4.33 : null);

    const normaal = drempel != null ? Math.min(feit.uren, rond1(drempel)) : feit.uren;
    const over = drempel != null ? rond1(Math.max(0, feit.uren - drempel)) : 0;

    if (normaal > 0) invoer.push({ component: 'gewerkte_uren', aantal: normaal });
    if (over > 0) invoer.push({ component: 'overuren_125', aantal: over,
      tariefCenten: Math.round(contract.uurloonCenten * (1 + t.overurenDeel)) });
    if (feit.nachturen > 0 && t.nachtDeel > 0) invoer.push({ component: 'nachttoeslag',
      aantal: feit.nachturen, tariefCenten: Math.round(contract.uurloonCenten * t.nachtDeel) });

    return { invoer, gewerkteUren: feit.uren,
      uitleg: { normaal, over, nachturen: feit.nachturen, drempelUren: drempel } };
  }

  return { meet, weeg, nachtUren, STANDAARD: cfg };
}

module.exports = { maakUren, nachtUren, STANDAARD };
