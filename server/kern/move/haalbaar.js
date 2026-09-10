/* RTG Move (deelmodule): IS DEZE REIS HAALBAAR -- het oordeel over de naden.

   Dit is de vraag die een reisbureau vóór de verkoop wil stellen: klopt deze
   planning in de tijd, of stuur ik iemand op reis met een overstap die niet
   bestaat. De naden komen uit ./naad; hier worden ze tot een oordeel over de
   hele reis.

   DRIE REGELS DIE HET OORDEEL EERLIJK HOUDEN.

   1. DE STRENGSTE NAAD BEPAALT DE REIS. Eén onhaalbare overgang maakt de reis
      onhaalbaar; er wordt niet gemiddeld. Dezelfde vorm als de stand van een
      rij in APPWERKT.json (de strengste van haar bewijzen) en als de drie
      plafonds in kern/livinglab/graden.js waar het laagste wint. Een gemiddelde
      over acht goede naden en één onmogelijke leest als "grotendeels in orde",
      en dat is precies de reis die misgaat.

   2. ONBEKEND WORDT APART GETELD EN NOOIT WEGGEMOFFELD. Een reis met zes naden
      waarvan er vijf niet te bepalen zijn, is niet "RUIM" omdat de zesde ruim
      is. `naden.nietTeBepalen` staat daarom naast het oordeel, en `dekking`
      zegt over welk deel van de reis Move iets kon zeggen. Zonder die twee is
      een groen oordeel over een half gemeten reis een geruststelling zonder
      grond -- de faalvorm die BETROUWBAARHEID.md par. 6 nr. 1 heeft opgeleverd.

   3. ER KOMT GEEN SAMENGESTELD CIJFER. Geen haalbaarheidsscore van 0 tot 100:
      dat verbergt welke naad bewoog (BEWIJSMACHINE.md over het entropiecijfer,
      en LAT-regel 11 over de scorecard). Het oordeel is een woord met de naad
      erbij die hem veroorzaakt. */
'use strict';

const { naad, UITKOMST, RANG } = require('./naad');

/* De reis erft de strengste naad. GEEN_BEWEGING telt daarbij als het gunstigste
   geval en niet als "onbekend": dat er niets af te leggen valt, is een
   volwaardig antwoord. */
function strengste(uitkomsten) {
  for (const u of RANG) if (uitkomsten.includes(u)) return u;
  return null;
}

/* DE VOLGORDE WORDT HIER GEMAAKT EN NIET AANGENOMEN, en dat is geen
   voorzichtigheid maar een gemeten bug.

   De eerste echte ronde over twee betaalde boekingen (10:00 en 11:15) gaf
   `beschikbaarMin: -135` en een keurig onderbouwd ONHAALBAAR: RTG rekende een
   overgang TERUG IN DE TIJD. Oorzaak: `reiswereld.komend()` sorteert op zijn
   eigen rangorde (signaal en datum), niet zuiver chronologisch, en deze module
   nam "de volgorde waarin ze binnenkomen" voor "de volgorde waarin ze
   plaatsvinden". Het antwoord zag er compleet en berekend uit, met een echte
   reistijd en een echte bron erbij -- de gevaarlijkste vorm van fout.

   Sorteren gebeurt daarom HIER, in de module die bepaalt wat "opeenvolgend"
   betekent, zodat geen enkele aanroeper die vraag nog kan verkeerd hebben.

   EN WAT GEEN TIJD HEEFT, KAN NIET IN DE RIJ. Een onderdeel zonder tijdstip
   valt niet te ordenen, dus het kan ook geen buur zijn in een overgang. Het
   verdwijnt niet stil: het wordt geteld als `zonderTijd` met de reden erbij.
   Zou het wel meedoen op zijn plek in de invoer, dan zou de rij weer een
   aangenomen volgorde dragen -- dezelfde fout een laag lager. */
function haalbaar({ onderdelen, reisTijd, afstandM }) {
  const alle = Array.isArray(onderdelen) ? onderdelen : [];
  const zonderTijd = alle.filter(o => !o || o.nodigAt == null).length;
  const rij = alle.filter(o => o && o.nodigAt != null).slice()
    .sort((a, b) => a.nodigAt - b.nodigAt);
  if (rij.length < 2) {
    return { oordeel: null, naden: [], telling: { totaal: 0, nietTeBepalen: 0, zonderTijd },
      waarom: zonderTijd
        ? 'Minder dan twee onderdelen met een tijdstip; ' + zonderTijd + ' onderdeel(en) kennen geen tijd en kunnen niet geordend worden.'
        : 'Een reis met minder dan twee onderdelen heeft geen overgang.' };
  }

  const naden = [];
  for (let i = 0; i < rij.length - 1; i++) {
    const a = rij[i], b = rij[i + 1];
    const n = naad({
      van: { plek: a.plek, klaarAt: a.klaarAt },
      naar: { plek: b.plek, nodigAt: b.nodigAt },
      reisTijd, afstandM
    });
    /* HET KENMERK GAAT MEE, want een naad die niet terug te voeren is op een
       onderdeel is niet te gebruiken. `vooraf` moet weten welke naden een
       VOORNEMEN raakt, en op de titel matchen is een gok -- twee onderdelen
       mogen dezelfde titel dragen. */
    naden.push(Object.assign({
      nr: i + 1,
      van: { titel: a.titel || '', soort: a.soort || '', kenmerk: a.kenmerk || '' },
      naar: { titel: b.titel || '', soort: b.soort || '', kenmerk: b.kenmerk || '' }
    }, n));
  }

  const bepaald = naden.filter(n => n.uitkomst !== UITKOMST.NIET_TE_BEPALEN);
  const oordeel = strengste(bepaald.map(n => n.uitkomst));

  /* De naad die het oordeel veroorzaakt, met naam en toenaam. Een oordeel
     zonder aanwijsbare oorzaak is een orakel (EXECUTIE.md over de score-opbouw:
     een cijfer zonder opbouw). */
  const oorzaak = oordeel ? (naden.find(n => n.uitkomst === oordeel) || null) : null;

  return {
    oordeel,
    oorzaak: oorzaak ? { nr: oorzaak.nr, van: oorzaak.van, naar: oorzaak.naar,
      margeMin: oorzaak.margeMin ?? null } : null,
    naden,
    telling: {
      totaal: naden.length,
      nietTeBepalen: naden.length - bepaald.length,
      onhaalbaar: naden.filter(n => n.uitkomst === UITKOMST.ONHAALBAAR).length,
      krap: naden.filter(n => n.uitkomst === UITKOMST.KRAP).length,
      /* Onderdelen zonder tijdstip doen niet mee aan een overgang, en dat hoort
         zichtbaar te zijn: een reis waarvan de helft niet te ordenen is, heeft
         een oordeel over de andere helft. */
      zonderTijd
    },
    /* DEKKING: over welk deel van de reis kon Move iets zeggen. Dit is het
       getal dat een adviseur moet zien voordat hij het oordeel gebruikt. */
    dekking: naden.length ? Math.round(bepaald.length / naden.length * 100) : 0,
    /* En als er NIETS te bepalen was, is er geen oordeel -- geen stilzwijgend
       groen. `oordeel: null` met de reden erbij. */
    waarom: oordeel ? null
      : 'Van geen enkele overgang zijn plek en tijd bekend; over de haalbaarheid valt niets te zeggen.'
  };
}

module.exports = { haalbaar, strengste };
