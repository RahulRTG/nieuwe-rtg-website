/* ============================================================================
   MAG DEZE ZAAK PUBLIEK VERKOPEN? -- de twee sloten GELEZEN, niet nagemaakt.

   ./verkoopweg.js weigerde `publiek` onvoorwaardelijk, en zei er in zijn eigen
   kop bij waarom dat tijdelijk was: "Zodra de eigenaar het besluit neemt, is
   dat hier een regel minder en geen nieuwe laag." Dit bestand is die regel
   minder. Het NEEMT geen besluit en het BEWAART geen besluit -- het kijkt naar
   de twee sloten die kern/webdomein.js al heeft en vertelt welke er dicht zit.

   SLOT EEN is de boardroom: de functie `dom-eigendomein` staat standaard uit.
   Dat is het besluit voor het hele huis, en het is een besluit en geen
   instelling -- binnen het huis leest alleen een ingelogd lid mee, op een
   openbaar adres leest iedereen mee.

   SLOT TWEE is de zaak zelf: die koppelt per site een eigen adres en zet hem
   online. Dat blijft een eigen, bewuste handeling; een verkoper hoort niet
   publiek te worden doordat de boardroom een knop omzette.

   WAAROM DIT GEEN DERDE SLOT IS. Een verkoopweg die zichzelf publiek kan
   zetten, zou een derde slot zijn dat de andere twee omzeilt. Deze laag kan
   niets openen: hij heeft geen schrijfweg naar de functie en geen schrijfweg
   naar het domein. Hij kan alleen `nee` zeggen, of `ja, want die twee staan al
   open`. Het publieke adres dat eruit komt is het adres dat de zaak zelf heeft
   gekoppeld -- er wordt er geen nieuw verzonnen.

   NIET VAST TE STELLEN IS EEN EIGEN UITSLAG. Is een lezer niet gekoppeld, dan
   staat er `null` en niet `false`: "wij weten het niet" is iets anders dan
   "het staat dicht" (BESTUUR.md). Beide houden de verkoopweg tegen -- bij
   twijfel gaat er niets naar buiten -- maar ze zeggen niet hetzelfde, en het
   scherm hoort te tonen wat er werkelijk aan de hand is.
   ========================================================================== */
'use strict';

const FUNCTIE = 'dom-eigendomein';

const SLOTEN = [
  { id: 'boardroom', naam: 'Het besluit van de boardroom',
    wat: 'De functie "Eigen domein (buiten het RTG-web)" staat standaard uit. Zolang die uit staat, verkoopt niemand in dit huis publiek.',
    waar: 'Boardroom, functie ' + FUNCTIE },
  { id: 'eigenAdres', naam: 'Het eigen adres van de zaak',
    wat: 'De zaak koppelt zelf een adres aan een site en zet die online. Dat blijft een eigen handeling; een verkoper wordt niet publiek doordat de boardroom een knop omzette.',
    waar: 'Mijn website, bij de zaak zelf' }
];

module.exports = () => {
  /* Twee LEZERS, allebei laat gekoppeld: de functiestand en de webmaker
     bestaan pas na deze laag. Niet gekoppeld betekent `null` en niet `false`
     -- zie de kop. */
  let leesFunctie = null;      // (id) => boolean
  let leesSite = null;         // (zaakCode) => { online, domein, adres, titel } | null

  const koppel = (o) => {
    if (o && typeof o.functieAan === 'function') leesFunctie = o.functieAan;
    if (o && typeof o.siteVan === 'function') leesSite = o.siteVan;
  };

  /* Slot een. Onbekend als de functiestand niet te lezen is. */
  function boardroomOpen() {
    if (typeof leesFunctie !== 'function') return null;
    try { return !!leesFunctie(FUNCTIE); } catch (e) { return null; }
  }

  /* Slot twee. De site moet ONLINE staan en een eigen adres dragen: een site
     die uit de lucht is, is geen publieke etalage, en een adres zonder site is
     een adres dat nergens heen wijst. */
  function adresVan(zaakCode) {
    if (typeof leesSite !== 'function') return { open: null, adres: null };
    let s = null;
    try { s = leesSite(String(zaakCode || '')); } catch (e) { return { open: null, adres: null }; }
    if (!s) return { open: false, adres: null };
    const host = String(s.domein || '').trim();
    return { open: !!(host && s.online), adres: host || null };
  }

  /* De uitslag. `mag` is alleen true als BEIDE sloten aantoonbaar open staan;
     een onbekende telt hier als niet-open, want er gaat niets naar buiten op
     een vermoeden. Wat er precies aan de hand is, staat per slot in de lijst. */
  function stand(zaakCode) {
    const een = boardroomOpen();
    const twee = adresVan(zaakCode);
    const sloten = [
      Object.assign({}, SLOTEN[0], { open: een }),
      Object.assign({}, SLOTEN[1], { open: twee.open, adres: twee.adres })
    ];
    const dicht = sloten.filter(s => s.open !== true);
    return {
      mag: dicht.length === 0,
      adres: twee.adres,
      sloten,
      dicht: dicht.map(s => s.id),
      waarom: dicht.length === 0 ? null : waarom(dicht)
    };
  }

  function waarom(dicht) {
    const stukken = dicht.map(s => s.open === null
      ? s.naam + ' is niet vast te stellen; RTG zet niets publiek op een vermoeden.'
      : s.naam + ' staat dicht. ' + s.wat);
    return 'Publiek verkopen kan pas als beide sloten open staan. ' + stukken.join(' ');
  }

  return { koppel, stand, SLOTEN, FUNCTIE };
};
