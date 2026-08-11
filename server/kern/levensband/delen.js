/* Levensband, deel "delen": wat u per stuk vrijgeeft, aan wie, en tot wanneer.

   HIER STAAT BESLUIT 2 IN CODE. Er is geen functie die "alles" deelt en geen
   pakket dat bij een soort band hoort: delen gaat per STUK, per BAND, met een
   VERVALDATUM. Van een minderjarige ziet een ouder daarom standaard niets --
   niet omdat er iets verborgen wordt, maar omdat er niets is vrijgegeven
   (LEVEN.md par. 2.8).

   WAAROM ELKE DELING EEN EINDDATUM HEEFT. Toestemming die eeuwig duurt, wordt
   vergeten. Een leerkracht die in groep zeven mocht meekijken, kijkt anders
   in het tweede studiejaar nog mee, en niemand die dat ooit opnieuw heeft
   bedoeld. De datum mag ver weg staan, maar hij staat er. */
'use strict';

module.exports = (ctx) => {
  const { pak, kijk, id, nuIso, vandaag, verlopen, levend, bandVan,
    zichtDeling, save, MAX_DELINGEN } = ctx;

  const schoon = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

  /* Wat er te delen valt. Een STUK is een onderdeel van de levenspas of een
     kamer van de levensgraaf; de namen komen uit die lagen en worden hier niet
     nagetikt. Wel begrensd: wat hier niet in staat, kan niet gedeeld worden --
     zo kan er nooit per ongeluk een kamer bij komen die niemand heeft
     afgewogen. Het gevoelsdagboek staat er bewust NIET tussen. */
  /* GEEN AANSPREEKVORM IN DEZE TEKSTEN, en dat is een geleerde les van precies
     een scherm geleden. Ze stonden hier in de u-vorm ("waar u goed in bent"),
     en dat leest prima aan de ledenkant -- maar deze lijst wordt ook getoond
     aan een kind in het foundation-huis, waar alles je/jij is. Op dat scherm
     stond het kind ineens vousvoyerend naar zijn eigen talenten te kijken.
     Een label beschrijft het GEGEVEN; wie er aangesproken wordt, is een keuze
     van het scherm en niet van de kern. */
  const STUKKEN = {
    lijn: 'de levenslijn: welke fasen er spelen',
    talenten: 'talenten: waar iemand goed in is',
    interesses: 'interesses: waar iemand mee bezig is',
    bijdrage: 'bijdrage: wat iemand voor anderen doet',
    diplomas: 'diplomas en certificaten',
    talen: 'talen: welke talen iemand spreekt',
    afspraken: 'afspraken: wat er op de agenda staat',
    gezondheid: 'gezondheid: wat er medisch speelt'
  };

  /* DIT IS GEEN VERGETEN LIJST MAAR EEN KEUZE. Het gevoelsdagboek
     (kern/welzijn) en de dromenlade zijn niet deelbaar, ook niet als iemand
     het zelf zou willen -- par. 2.5 zegt dat een droom alleen bij de mens zelf
     terugkomt, en het dagboek heeft in de code nooit een andere lezer gehad.
     Wie ze hier ooit toevoegt, verandert een grens en geen lijst. */
  const NOOIT = ['dagboek', 'stemming', 'dromen', 'gevoel'];

  function delingen(wie) {
    const w = schoon(wie, 120);
    return kijk().delingen.filter(x => x.van === w).map(zichtDeling);
  }

  /* DELEN. Alleen door wie het IS: u deelt uw eigen stuk, nooit dat van een
     ander. Een ouder kan dus niet namens een kind iets vrijgeven -- dat zou
     besluit 2 door de achterdeur ongedaan maken. */
  function deel(wie, b) {
    const d = pak();
    const w = schoon(wie, 120);
    const o = b && typeof b === 'object' ? b : {};
    const stuk = schoon(o.stuk, 40).toLowerCase();
    if (NOOIT.includes(stuk)) {
      return { status: 403, error: 'Dit is van u alleen en wordt met niemand gedeeld.' };
    }
    if (!STUKKEN[stuk]) {
      return { status: 400, error: 'Dat kunt u niet delen. Wel: ' + Object.keys(STUKKEN).join(', ') + '.' };
    }
    const band = bandVan(o.bandId);
    if (!band) return { status: 404, error: 'Deze band bestaat niet.' };
    if (band.lid !== w && band.profiel !== w) return { status: 403, error: 'Deze band is niet van u.' };
    if (!levend(band)) {
      return { status: 400, error: band.staat === 'gevraagd'
        ? 'Deze band is nog niet bevestigd; delen kan pas daarna.'
        : 'Deze band loopt niet meer.' };
    }
    /* De vervaldatum is VERPLICHT, en dat is het verschil met een gewone
       instelling. Zie de kop: toestemming die eeuwig duurt wordt vergeten. */
    const vervalt = schoon(o.vervalt, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(vervalt)) {
      return { status: 400, error: 'Tot wanneer mag de ander dit zien? Kies een datum.' };
    }
    if (vervalt < vandaag()) return { status: 400, error: 'Die datum is al voorbij.' };

    const al = d.delingen.find(x => x.van === w && x.bandId === band.id && x.stuk === stuk);
    if (al) {
      /* Opnieuw delen is de datum verzetten, niet een tweede deling. Twee
         rijen voor hetzelfde stuk zouden betekenen dat intrekken de ene wist
         en de andere laat staan. */
      al.vervalt = vervalt;
      al.at = nuIso();
      save();
      return { status: 200, ok: true, deling: zichtDeling(al) };
    }
    if (d.delingen.filter(x => x.van === w).length >= MAX_DELINGEN) {
      return { status: 400, error: 'Meer dan ' + MAX_DELINGEN + ' delingen; trek er eerst een in.' };
    }
    const x = { id: id('del'), bandId: band.id, van: w, stuk,
      wat: STUKKEN[stuk], vervalt, at: nuIso() };
    d.delingen.push(x);
    save();
    return { status: 200, ok: true, deling: zichtDeling(x) };
  }

  /* INTREKKEN. Door wie deelde, altijd, zonder uitleg. De rij gaat ECHT weg:
     een ingetrokken deling die als "ooit gedeeld" blijft staan, is een lijst
     van wat iemand ooit liet zien, en die lijst heeft niemand gevraagd. */
  function trekIn(wie, delingId) {
    const d = pak();
    const w = schoon(wie, 120);
    const i = d.delingen.findIndex(x => x.id === String(delingId));
    if (i === -1) return { status: 404, error: 'Deze deling bestaat niet.' };
    if (d.delingen[i].van !== w) return { status: 403, error: 'Deze deling is niet van u.' };
    d.delingen.splice(i, 1);
    save();
    return { status: 200, ok: true };
  }

  /* Wat de ANDER van mij mag zien, per band -- zodat het scherm kan tonen wat
     iemand heeft vrijgegeven zonder dat hij het uit losse regels moet
     afleiden. Verlopen delingen staan er wel bij, gemarkeerd: "dit zag hij
     tot vorige maand" is nuttig, en het verschil met "dit ziet hij nu" moet
     zichtbaar zijn. */
  function watZietDeAnder(wie, bandId) {
    const w = schoon(wie, 120);
    return kijk().delingen
      .filter(x => x.van === w && x.bandId === String(bandId))
      .map(zichtDeling);
  }

  return { deelStukken: () => Object.assign({}, STUKKEN), deelNooit: () => NOOIT.slice(),
    delingen, deelZet: deel, deelIn: trekIn, deelPerBand: watZietDeAnder,
    deelVerlopen: verlopen };
};
