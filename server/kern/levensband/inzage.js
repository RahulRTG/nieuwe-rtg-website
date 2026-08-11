/* Levensband, deel "inzage": wat mag IK van een ander zien?

   DIT BESTAND IS DE POORT, en hij staat standaard dicht. Er is geen lijst met
   wat een ouder "normaal" mag zien en geen pakket dat bij een soort band
   hoort: inzage() geeft uitsluitend terug wat de ander ZELF heeft vrijgegeven,
   via een deling die nog niet verlopen is, over een band die bevestigd is en
   nog loopt (LEVEN.md par. 2.8).

   Drie sloten dus, en ze moeten alle drie open staan:
     1. er is een band, en die is door BEIDE kanten bevestigd;
     2. de band is niet verbroken en niet verlopen;
     3. er is een deling van dit stuk, en die is niet verlopen.
   Valt er een weg, dan is het antwoord leeg. Niet "bijna", niet "een deel":
   leeg.

   HET VEILIGHEIDSSIGNAAL is de enige uitzondering, en hij is met opzet geen
   inzage. Een ouder hoort te kunnen zien DAT er iets aandacht vraagt zonder te
   lezen WAT er staat. signaal() geeft daarom een AANTAL en een woord, en nooit
   inhoud: geen titel, geen tekst, geen datum die terug te rekenen is naar een
   gebeurtenis. Wie dit ooit wil uitbreiden met "en dit staat er dan", opent
   precies de deur die par. 2.1 dicht houdt -- en dan is het geen signaal meer
   maar meelezen met toestemming van niemand. */
'use strict';

module.exports = (ctx) => {
  const { kijk, verlopen, levend, bandVan, zichtDeling } = ctx;

  const schoon = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

  /* De drie sloten, op een plek. Geeft de deling terug als alles open staat,
     anders null -- zodat elke aanroeper dezelfde poort passeert en niemand er
     een eigen variant naast bouwt (LAT.md regel 4). */
  function mag(kijker, eigenaar, stuk) {
    const k = schoon(kijker, 120), e = schoon(eigenaar, 120), s = schoon(stuk, 40).toLowerCase();
    if (!k || !e || !s) return null;
    for (const x of kijk().delingen) {
      if (x.van !== e || x.stuk !== s) continue;
      if (verlopen(x)) continue;
      const b = bandVan(x.bandId);
      if (!b || !levend(b)) continue;
      if (b.lid !== k && b.profiel !== k) continue;
      return x;
    }
    return null;
  }

  /* Wat mag ik van deze mens zien? Een lijst stukken, meer niet: de INHOUD
     haalt de aanroeper bij de laag die hem beheert, met deze lijst als poort.
     Zo staat de inhoud nooit twee keer, en kan deze module nooit per ongeluk
     iets doorgeven wat hij niet hoort te kennen. */
  function inzage(kijker, eigenaar) {
    const k = schoon(kijker, 120), e = schoon(eigenaar, 120);
    if (!k || !e) return { stukken: [], band: null };
    const b = kijk().banden.find(x =>
      ((x.lid === k && x.profiel === e) || (x.lid === e && x.profiel === k)) &&
      x.staat !== 'verbroken');
    if (!b || !levend(b)) return { stukken: [], band: b ? b.id : null };
    const stukken = kijk().delingen
      .filter(x => x.van === e && x.bandId === b.id && !verlopen(x))
      .map(zichtDeling);
    return { stukken, band: b.id, soort: b.soort };
  }

  /* HET SIGNAAL. Telt hoeveel dingen aandacht vragen bij iemand met wie u een
     levende band heeft, en zegt verder niets.

     De aanroeper levert de telling aan (deze laag kent geen dossiers en wil ze
     niet kennen); wat hier gebeurt is de POORT en de VORM. De vorm is
     opzettelijk arm: een woord en een aantal. Geen titels, geen datums, geen
     "sinds wanneer" -- want elk van die drie maakt van een signaal een
     aanwijzing, en van een aanwijzing een gesprek dat het kind niet heeft
     gevoerd.

     Waarom dit langs de band moet en niet langs een deling: veiligheid is
     precies het geval waarin er NIETS is vrijgegeven. Zou het signaal een
     deling vragen, dan bestond het alleen voor wie het al niet nodig had. */
  function signaal(kijker, eigenaar, telling) {
    const k = schoon(kijker, 120), e = schoon(eigenaar, 120);
    const n = Math.max(0, Math.round(Number(telling) || 0));
    const b = kijk().banden.find(x =>
      ((x.lid === k && x.profiel === e) || (x.lid === e && x.profiel === k)) &&
      x.staat !== 'verbroken');
    if (!b || !levend(b)) return { mag: false, aandacht: 0, zin: '' };
    if (!n) return { mag: true, aandacht: 0, zin: 'Er vraagt niets om aandacht.' };
    return {
      mag: true,
      aandacht: n,
      /* Geen "wat" en geen "waar", met opzet. De zin nodigt uit tot een
         gesprek en vervangt het niet. */
      zin: n === 1
        ? 'Er vraagt iets om aandacht. Wat het is, staat er niet bij -- vraag het.'
        : 'Er vragen ' + n + ' dingen om aandacht. Wat het is, staat er niet bij -- vraag het.'
    };
  }

  return { inzage, inzageMag: mag, inzageSignaal: signaal };
};
