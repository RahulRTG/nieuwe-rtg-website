/* De feestdagen, uit alle tradities, gelijk behandeld.

   De opzet volgt de Geloof & Wijsheid-Bibliotheek: geen enkele traditie is de
   norm en geen enkele staat in de marge. Wie niets gelooft hoort daar ook bij;
   die krijgt gewoon niets, en dat is geen gebrek.

   Rahul feliciteert alleen met wat het lid ZELF heeft aangegeven. Hij raadt
   nooit iemands geloof uit een naam, een land of een taal. Dat is niet alleen
   respectvol maar ook eenvoudig: er staat een keuze in het profiel of er staat
   er geen.

   Drie soorten data, met verschillende zekerheid, en dat zeggen we erbij:
     vast      een vaste datum of exact te berekenen (Kerst, Pasen, Rosj
               Hasjana, Nowruz) -- zeker;
     berekend  islamitische feesten uit de tabelkalender -- kan een dag
               schelen, want de maansikkel beslist plaatselijk;
     tabel     lunisolaire feesten waarvoor een volledige berekening een eigen
               vakgebied is (Diwali, Holi, Vesak, Guru Nanak). Die staan als
               opgezochte data in een tabel, voor de jaren die erin staan. Valt
               een jaar buiten de tabel, dan zeggen we dat we het niet weten in
               plaats van te gokken. */
const K = require('./kalenders');

/* De tradities. `bron` bepaalt hoe de datum tot stand komt. */
const FEESTEN = [
  // ---- islamitisch ----
  { id: 'ramadan', traditie: 'islam', naam: 'begin van de ramadan', bron: 'hijri', hm: [9, 1], groet: 'Ramadan Moebarak' },
  { id: 'eid-fitr', traditie: 'islam', naam: 'Eid al-Fitr', bron: 'hijri', hm: [10, 1], groet: 'Eid Moebarak' },
  { id: 'eid-adha', traditie: 'islam', naam: 'Eid al-Adha', bron: 'hijri', hm: [12, 10], groet: 'Eid Moebarak' },
  { id: 'hijri-nieuw', traditie: 'islam', naam: 'islamitisch nieuwjaar', bron: 'hijri', hm: [1, 1], groet: 'Een gezegend nieuw jaar' },
  { id: 'ashura', traditie: 'islam', naam: 'Asjoera', bron: 'hijri', hm: [1, 10], groet: null },
  { id: 'mawlid', traditie: 'islam', naam: 'Mawlid an-Nabi', bron: 'hijri', hm: [3, 12], groet: 'Een gezegende Mawlid' },

  // ---- joods ----
  { id: 'rosj', traditie: 'jodendom', naam: 'Rosj Hasjana', bron: 'joods', jm: ['tisjrei', 1], groet: 'Sjana tova' },
  { id: 'jom-kipoer', traditie: 'jodendom', naam: 'Jom Kipoer', bron: 'joods', jm: ['tisjrei', 10], groet: 'Een betekenisvolle vastendag' },
  { id: 'soekot', traditie: 'jodendom', naam: 'Soekot', bron: 'joods', jm: ['tisjrei', 15], groet: 'Chag sameach' },
  { id: 'chanoeka', traditie: 'jodendom', naam: 'Chanoeka', bron: 'joods', jm: ['kislev', 25], groet: 'Chag Chanoeka sameach' },
  { id: 'pesach', traditie: 'jodendom', naam: 'Pesach', bron: 'joods', jm: ['nisan', 15], groet: 'Chag Pesach sameach' },
  { id: 'sjavoeot', traditie: 'jodendom', naam: 'Sjavoeot', bron: 'joods', jm: ['sivan', 6], groet: 'Chag sameach' },

  // ---- christelijk ----
  { id: 'kerst', traditie: 'christendom', naam: 'Kerstmis', bron: 'vast', md: [12, 25], groet: 'Fijne kerstdagen' },
  { id: 'kerst-orthodox', traditie: 'christendom', naam: 'orthodox kerstfeest', bron: 'vast', md: [1, 7], groet: 'Fijne kerstdagen' },
  { id: 'goede-vrijdag', traditie: 'christendom', naam: 'Goede Vrijdag', bron: 'pasen', offset: -2, groet: null },
  { id: 'pasen', traditie: 'christendom', naam: 'Pasen', bron: 'pasen', offset: 0, groet: 'Zalig Pasen' },
  { id: 'hemelvaart', traditie: 'christendom', naam: 'Hemelvaart', bron: 'pasen', offset: 39, groet: null },
  { id: 'pinksteren', traditie: 'christendom', naam: 'Pinksteren', bron: 'pasen', offset: 49, groet: 'Fijne pinksterdagen' },
  { id: 'aswoensdag', traditie: 'christendom', naam: 'Aswoensdag', bron: 'pasen', offset: -46, groet: null },

  // ---- hindoeistisch, sikh, boeddhistisch ----
  { id: 'diwali', traditie: 'hindoeisme', naam: 'Diwali', bron: 'tabel', groet: 'Sjoebh Diwali' },
  { id: 'holi', traditie: 'hindoeisme', naam: 'Holi', bron: 'tabel', groet: 'Holi hai' },
  { id: 'navratri', traditie: 'hindoeisme', naam: 'Navratri', bron: 'tabel', groet: null },
  { id: 'vaisakhi', traditie: 'sikhisme', naam: 'Vaisakhi', bron: 'vast', md: [4, 14], groet: 'Vaisakhi di lakh lakh vadhaai' },
  { id: 'guru-nanak', traditie: 'sikhisme', naam: 'Guru Nanak Gurpurab', bron: 'tabel', groet: null },
  { id: 'vesak', traditie: 'boeddhisme', naam: 'Vesak', bron: 'tabel', groet: 'Een vredig Vesak' },

  // ---- overig ----
  { id: 'nowruz', traditie: 'nowruz', naam: 'Nowruz', bron: 'equinox', groet: 'Nowruz Moebarak' }
];

/* De tabel voor de lunisolaire feesten. Alleen jaren die er echt in staan;
   daarbuiten geven we niets terug in plaats van te gokken. */
const TABEL = {
  diwali:     { 2026: [11, 8], 2027: [10, 29], 2028: [11, 15], 2029: [11, 5], 2030: [10, 26] },
  holi:       { 2026: [3, 4], 2027: [3, 22], 2028: [3, 11], 2029: [3, 1], 2030: [3, 20] },
  navratri:   { 2026: [10, 11], 2027: [9, 30], 2028: [10, 18], 2029: [10, 8], 2030: [9, 27] },
  'guru-nanak': { 2026: [11, 24], 2027: [11, 14], 2028: [11, 1], 2029: [11, 21], 2030: [11, 10] },
  vesak:      { 2026: [5, 31], 2027: [5, 20], 2028: [5, 8], 2029: [5, 27], 2030: [5, 16] }
};

const ZEKERHEID = { vast: 'vast', pasen: 'vast', joods: 'vast', equinox: 'vast', hijri: 'berekend', tabel: 'tabel' };

/* De datum (UTC-middernacht) van een feest in een gregoriaans jaar, of null. */
function datumVan(feest, jaar) {
  switch (feest.bron) {
    case 'vast': return K.utc(jaar, feest.md[0], feest.md[1]);
    case 'pasen': return K.pasen(jaar) + feest.offset * K.DAG;
    case 'equinox': return K.lenteEquinox(jaar);
    case 'hijri': {
      // Een islamitisch jaar is korter, dus een feest kan twee keer in een
      // gregoriaans jaar vallen. We geven ze allebei terug via alleDatums().
      const hj = Math.floor((jaar - 622) * 33 / 32);
      for (const j of [hj - 1, hj, hj + 1]) {
        const ms = K.hijriDatum(j, feest.hm[0], feest.hm[1]);
        if (new Date(ms).getUTCFullYear() === jaar) return ms;
      }
      return null;
    }
    case 'joods': {
      const jj = jaar + 3760;
      for (const j of [jj, jj + 1]) {
        const ms = K.joodsDatum(j, feest.jm[0], feest.jm[1]);
        if (new Date(ms).getUTCFullYear() === jaar) return ms;
      }
      return null;
    }
    case 'tabel': {
      const t = (TABEL[feest.id] || {})[jaar];
      return t ? K.utc(jaar, t[0], t[1]) : null;
    }
    default: return null;
  }
}

/* Alle feesten van een of meer tradities in een venster rond vandaag.
   tradities: array met id's ('islam', 'jodendom', ...). Leeg = alles. */
function feestenRond(tradities, vanaf, dagenVooruit) {
  const nu = vanaf instanceof Date ? vanaf : new Date();
  const start = K.utc(nu.getUTCFullYear(), nu.getUTCMonth() + 1, nu.getUTCDate());
  // let op: 0 is een geldige waarde (alleen vandaag), dus geen `|| 45`
  const eind = start + (dagenVooruit == null ? 45 : dagenVooruit) * K.DAG;
  const set = tradities && tradities.length ? new Set(tradities) : null;
  const uit = [];
  for (const f of FEESTEN) {
    if (set && !set.has(f.traditie)) continue;
    for (const jaar of [nu.getUTCFullYear(), nu.getUTCFullYear() + 1]) {
      const ms = datumVan(f, jaar);
      if (ms == null || ms < start || ms > eind) continue;
      uit.push({
        id: f.id, naam: f.naam, traditie: f.traditie, groet: f.groet,
        datum: new Date(ms).toISOString().slice(0, 10),
        overDagen: K.dagVerschil(ms, start),
        zekerheid: ZEKERHEID[f.bron] || 'berekend',
        // De datum is de DAG zelf. In de joodse en islamitische traditie begint
        // een dag bij zonsondergang, dus het feest begint de avond ervoor: wie
        // op de kalenderdatum feliciteert is een avond te laat.
        avondErvoor: f.bron === 'joods' || f.bron === 'hijri',
        // De eerlijke voetnoot, per soort. Staat er altijd bij.
        noot: f.bron === 'hijri'
          ? 'Berekend uit de tabelkalender; de plaatselijke maansikkel beslist en het kan een dag schelen. De dag begint bij zonsondergang de avond ervoor.'
          : (f.bron === 'joods' ? 'De dag begint bij zonsondergang de avond ervoor.'
            : (f.bron === 'tabel' ? 'Uit een opgezochte tabel; buiten de opgenomen jaren zeggen we het liever niet.' : null))
      });
    }
  }
  return uit.sort((a, b) => a.overDagen - b.overDagen);
}

// Is er vandaag iets? (voor de felicitatie)
function vandaag(tradities, nu) {
  return feestenRond(tradities, nu, 0).filter(f => f.overDagen === 0);
}

const TRADITIES = [...new Set(FEESTEN.map(f => f.traditie))];

module.exports = { FEESTEN, TRADITIES, feestenRond, vandaag, datumVan, TABEL };
