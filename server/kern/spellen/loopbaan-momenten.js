/* DE MOMENTEN -- wat er van een loopbaan het onthouden waard is.

   Afgesplitst van ./loopbaan.js op de naad die het onderwerp zelf aangeeft: daar
   het REGISTER (wie werkte waar, hoe lang, en de 18+-grens die erover gaat),
   hier de HERINNERING (wat er blijft hangen, en in welke woorden). Twee dingen
   met een verschillend tempo -- het register is af zodra het klopt, de lijst
   momenten groeit met elke laag die er een oplevert.

   EEN HERINNERING IS GEEN LOGREGEL. Wat het terugkijkfilmpje uit hoofdstuk 13
   werkend maakt, is dat er WEINIG in staat en dat elk item TWEE MENSEN raakt.
   Die tweede is geen veld maar de wet: `onthoud` in ./loopbaan.js weigert een
   moment zonder tweede codenaam. Dat maakt het onvervalsbaar (je kunt jezelf
   geen verleden geven), het houdt de lijst kort, en het is precies waarom die
   zinnen blijven hangen. */
'use strict';

/* DE MOMENTEN DIE HET ONTHOUDEN WAARD ZIJN. Acht, en er staat met opzet geen
   omzet, vermogen of aantal tussen: die staan al op de eindstand van een potje
   en horen daar. Een herinnering die een getal is, is een score met een lijstje
   eromheen.

   `samen` is geen veld maar de wet: elk moment hieronder noemt een TWEEDE
   codenaam, en `onthoud` weigert er een zonder.

   DE LAATSTE TWEE ZIJN DE NALATENSCHAP (fase C, GAMEHALL.md 12.9). Ze horen
   HIER en niet in een eigen laag, en dat is een besluit: wat iemand nalaat is
   geen tweede soort geschiedenis maar dezelfde. Een overdracht is precies wat
   de grondwet toelaat om een potje te overleven -- geen kas, geen zaak, geen
   waarde, maar het FEIT dat jij jouw levenswerk aan iemand gaf en dat hij het
   aannam (VERHAAL.md paragraaf 1: uit tijd en uit wat je deed, nooit uit geld).

   En hij voldoet vanzelf aan de wet van deze laag: WIE ZONDER OPVOLGER
   uitstapt, wikkelt af en laat niemand achter. Dan is er geen tweede mens en
   dus geen moment -- niet omdat het verdriet minder is, maar omdat dit register
   over samenwerking gaat en niet over een leeg pand. */
const MOMENTEN = {
  eerste_baan: { naam: 'Je eerste baan',
    zin: (m) => 'Je begon als ' + m.wat + ' bij ' + m.samen + '.' },
  eerste_promotie: { naam: 'Je eerste promotie',
    zin: (m) => m.samen + ' vond je goed genoeg voor ' + m.wat + '.' },
  eerste_zaak: { naam: 'Je eerste eigen zaak',
    zin: (m) => 'Je begon voor jezelf, na ' + m.wat + ' bij ' + m.samen + '.' },
  samen_door: { naam: 'Samen doorgekomen',
    zin: (m) => 'Je hield het vol bij ' + m.samen + ' toen het tegenzat: ' + m.wat + '.' },
  opgeleid: { naam: 'Iemand die jij opleidde',
    zin: (m) => m.samen + ' begon voor zichzelf, na ' + m.wat + ' bij jou.' },
  eerste_mens: { naam: 'Je eerste medewerker',
    zin: (m) => m.samen + ' kwam bij je werken als ' + m.wat + '.' },
  /* De twee kanten van een overdracht, en ze staan er allebei omdat het voor
     allebei een moment is -- net als eerste_baan en eerste_mens. Wie stopt
     onthoudt aan wie hij het gaf; wie doorgaat onthoudt van wie hij het kreeg. */
  doorgegeven: { naam: 'Je gaf het door',
    zin: (m) => 'Je stopte na ' + m.wat + ', en ' + m.samen + ' ging verder waar jij ophield.' },
  overgenomen: { naam: 'Je nam het over',
    zin: (m) => 'Je nam over wat ' + m.samen + ' in ' + m.wat + ' had opgebouwd.' }
};
const MOMENTLIJST = Object.keys(MOMENTEN);

/* Hoe lang iets duurde, in mensentaal. "3 jaar 2 maanden" is de zin uit
   hoofdstuk 3 van de visie, en een getal in maanden is dat niet. */
function duur(maanden) {
  const m = Math.max(0, Math.round(maanden || 0));
  const j = Math.floor(m / 12), r = m % 12;
  if (!j) return r + (r === 1 ? ' maand' : ' maanden');
  if (!r) return j + (j === 1 ? ' jaar' : ' jaar');
  return j + ' jaar ' + r + (r === 1 ? ' maand' : ' maanden');
}


  /* DE TERUGBLIK: hoofdstuk 13, en met opzet zonder cijfers. Wie hem opvraagt
       krijgt zinnen, geen tabel -- want een terugblik die uit getallen bestaat is
       de eindstand met een andere naam. */
function maakTerugblik({ alle, mag, GEEN_PROGRESSIE }) {
  return function terugblik(handle, codenaam) {
      const l = alle()[codenaam] || { banen: [], momenten: [] };
      if (!mag(handle)) return { mag: false, reden: GEEN_PROGRESSIE, momenten: [], banen: [] };
      return {
        mag: true,
        /* Waar je begon, en dat is de zin waar het allemaal om draait. */
        begin: l.banen.length ? l.banen[0] : null,
        banen: l.banen.map(b => Object.assign({}, b)),
        /* Hoe lang je in totaal voor iemand anders werkte. Geen geld, wel tijd --
           zie de grens hierboven. */
        gewerkt: duur(l.banen.reduce((n, b) => n + (b.maanden || 0), 0)),
        werkgevers: [...new Set(l.banen.map(b => b.werkgever))],
        momenten: l.momenten.map(m => ({ soort: m.soort, naam: MOMENTEN[m.soort].naam,
          zin: MOMENTEN[m.soort].zin(m), samen: m.samen }))
      };
  };
}

module.exports = { MOMENTEN, MOMENTLIJST, duur, maakTerugblik };
