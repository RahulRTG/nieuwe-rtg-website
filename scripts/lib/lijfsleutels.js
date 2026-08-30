/* ============================================================================
   DE LIJFSLEUTEL -- een sleutel die in het LICHAAM reist, niet in de kop.

   HET PROBLEEM. scripts/lib/bewakers.js kent een soort deur die hij
   `lichaamssleutel` noemt en waaraan hij bewust GEEN rol hangt, met deze reden:
   "de sleutel staat in het lichaam en niet in de kop, dus rollen kruisen zegt
   hier niets". Dat klopt -- voor de ROLPROEF, die met een verkeerde rol
   aanklopt om scheiding te toetsen. Met een lijfsleutel bestaat "de verkeerde
   rol" niet: je hebt de sleutel of je hebt hem niet.

   Maar de IDEMPROEF kruist niets. Die herhaalt een oproep met de JUISTE sleutel
   en kijkt of de tweede keer werk oplevert. Voor dat instrument is zo'n route
   wel degelijk te beproeven, zodra er een sleutel te maken is. Eén reden, twee
   instrumenten, tegengestelde conclusies -- en zolang er maar één begrip was
   (`rol`), won de strengste en telden honderden routes als instrumenttekort.

   Vandaar dit tweede begrip NAAST rol, en met opzet niet erin: de rolproef mag
   deze deuren niet gaan kruisen, want daar zou hij groen worden op iets wat hij
   niet heeft gemeten.

   WAT EEN FAMILIE IS. Een naam, de paden waar hij over gaat, en een BOUWER die
   de wereld werkelijk aanmaakt en de velden teruggeeft die daarna in elk lijf
   meegaan. Geen verzonnen tokens: de bouwer loopt door de echte deur van het
   product, want een sleutel die niet uit de applicatie komt bewijst niets over
   de applicatie.

   EN WAT HIER NIET GEBEURT: er wordt geen omgevingsvlag omgezet om een deur
   open te krijgen. De schoolfixture (/school/school/maak) staat buiten
   NODE_ENV=test met 410 dicht, en die vlag aanzetten zou de hele server een
   andere server maken -- dan meet de proef iets wat het product niet is. Zo'n
   familie hoort langs de ECHTE weg te worden opgebouwd of eerlijk te ontbreken,
   met de reden erbij. */
'use strict';

const FAMILIES = [
  {
    naam: 'werkruimte',
    /* Alle werkPoort-, beheerVan- en lidVan-routes van het Werk OS wonen onder
       dit voorvoegsel; gemeten met scripts/handlerwacht.js. */
    prefixen: ['/api/bedrijf/'],
    velden: ['beheerToken', 'werkruimte'],
    waarom: 'werkPoort en beheerVan lezen `beheerToken` uit het lijf; de werkruimte ' +
      'ontstaat pas bij het aanmaken en het token wordt daar EEN keer getoond',
    async bouw({ post }) {
      const r = await post('/api/bedrijf/werkruimte/maak',
        { naam: 'Proefwerkruimte', land: 'NL', valuta: 'EUR' }, null);
      const d = r && r.data;
      if (!d || !d.beheerToken) return null;
      return { beheerToken: d.beheerToken, werkruimte: d.werkruimte };
    }
  }
];

/* Bouwt wat er te bouwen valt. Geeft per familie terug of het gelukt is EN
   waarom niet -- een familie die stil ontbreekt, laat honderden routes stil
   ongemeten (LAT.md regel 3). */
async function bouwLijfsleutels(ctx) {
  const gebouwd = [];
  const mislukt = [];
  const velden = new Map();   // prefix -> velden
  for (const f of FAMILIES) {
    let uit = null;
    try { uit = await f.bouw(ctx); } catch (e) { uit = null; }
    if (!uit) { mislukt.push({ naam: f.naam, reden: 'de bouwer kreeg geen sleutel terug' }); continue; }
    gebouwd.push({ naam: f.naam, velden: Object.keys(uit) });
    for (const p of f.prefixen) velden.set(p, uit);
  }
  const lijfVoor = (pad) => {
    for (const [p, v] of velden) if (String(pad).startsWith(p)) return v;
    return null;
  };
  const dekt = (pad) => !!lijfVoor(pad);
  return { gebouwd, mislukt, lijfVoor, dekt, families: FAMILIES.map(f => f.naam) };
}

/* Voor wie alleen wil weten WELKE paden een familie zou dekken, zonder een
   server te starten -- scripts/onbewezen.js gebruikt dit om een route niet als
   instrumenttekort te tellen terwijl er een sleutel voor te maken is. */
function dektPad(pad) {
  return FAMILIES.some(f => f.prefixen.some(p => String(pad).startsWith(p)));
}

module.exports = { FAMILIES, bouwLijfsleutels, dektPad };
