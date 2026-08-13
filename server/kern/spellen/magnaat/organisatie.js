/* Magnaat: WAT EEN ORGANISATIE OVER ZICHZELF KAN WETEN.

   De eerste steen van ORGANISATIE.md. Twee vragen, en ze komen allebei uit
   dezelfde plek: het besluitenlog dat al op de vestiging staat
   (./storing-keten.js). Er wordt hier NIETS bewaard -- dit is een LEZING, net
   als ../loopbaan-profiel.js, en om dezelfde reden: een tweede voorraad naast
   een som die klopt is een tweede waarheid die kan gaan afwijken.

   ================== 1. HERHALING: de schakel `leren` ==================

   De keten van ORGANISATIE.md is: waarnemen -> begrijpen -> bevoegd zijn ->
   beslissen -> uitvoeren -> overdragen -> leren. De eerste zes bestaan. De
   zevende is deze: *het probleem keert terug omdat de organisatie er niets van
   heeft opgestoken.*

   Dat is geen nieuw mechaniek maar een TELLING. Een koeling die voor de derde
   keer stukgaat is niet zwaarder kapot dan de eerste keer -- de wereld doet
   precies hetzelfde -- maar het is een ANDER VERHAAL, en dat verhaal stond
   nergens. Nu wel: *"Koeling B, derde keer sinds maand 88. Twee keer met een
   noodoplossing opgelost, nooit vervangen."*

   ER VOLGT GEEN STRAF UIT. Geen oplopende factor, geen "chronisch"-vlag die
   iets duurder maakt. Wat een herhaling kost, kostte hij de vorige keer ook --
   en juist dat is de les: de rekening was er altijd al, alleen niemand telde
   hem op. Zou er een boete op staan, dan is het geen inzicht meer maar een
   mechaniek dat je moet vermijden.

   ================== 2. WIE HET FEITELIJK DOET ==================

   Iedere onderneming heeft twee organisaties: wie er volgens het organigram
   verantwoordelijk is, en wie mensen daadwerkelijk bellen als het misgaat. Dat
   verschil staat nergens in een veld -- maar het staat wel in de besluiten.

   Deze lezing telt ze, en zegt niets meer dan wat er staat: *"van de laatste
   besluiten over deze zaak kwamen er negen van Boris (vakkracht)"*. Naast de
   formele rol is dat een zin die een organigram niet kan geven.

   GEEN SCORE, EN MET NAME GEEN `bus factor`. Wat hier NIET mag ontstaan is een
   getal dat "hoe afhankelijk ben ik van deze mens" heet, want dan is het een
   balk om te optimaliseren in plaats van iets om te ontdekken. Er staat een
   AANTAL en een NAAM; wat dat betekent bepaalt de speler.

   EN HET IS BEGRENSD, want de bron is dat (./storing-keten.js LENGTE). Deze
   lezing gaat dus over de LAATSTE besluiten en niet over de hele campagne, en
   ze zegt dat er met zoveel woorden bij. Een lezing die meer belooft dan haar
   bron kan dragen, is een verzinsel met een tabel eromheen. */
'use strict';

const KETEN = require('./storing-keten');
const STORING = require('./storing');
const D = require('./dienst');

/* Welke besluiten er op een storing lijken opgelost te hebben. `repareren` is
   de enige uitweg die hem echt weghaalt; de rest is een stand. */
const LOST_OP = 'repareren';

/* HOE VAAK DIT AL EERDER GEBEURDE. Telt de opgeloste rondes VOOR de huidige:
   elke eerdere reparatie is een keer dat de zaak dacht dat het over was.

   Hij telt op de BRON en niet op een teller op de storing zelf, en dat is met
   opzet. Een teller zou meegroeien met de storing en dus verdwijnen zodra hij
   opgeruimd wordt -- precies wanneer de herhaling begint te tellen. */
function herhaling(v, s) {
  if (!v || !s) return { keer: 1, eerder: [], sinds: s ? s.sinds : 0 };
  const eerder = KETEN.lijst(v)
    .filter(f => f.soort === s.soort && f.maand < s.sinds)
    .slice().reverse();
  const opgelost = eerder.filter(f => f.optie === LOST_OP);
  return {
    keer: opgelost.length + 1,
    /* WAT ER DE VORIGE KEREN GEBEURDE, en dat is het interessante deel: drie
       keer een noodoplossing is een ander verhaal dan drie keer een monteur. */
    eerder: eerder.map(f => ({ maand: f.maand, optie: f.optie })),
    sinds: eerder.length ? eerder[0].maand : s.sinds
  };
}

/* WIE DE BESLUITEN FEITELIJK NAM, op aantal. Zonder rangschikking van mensen:
   een lijst met een naam en een getal, ongesorteerd op iets anders dan aantal
   omdat een lijst nu eenmaal een volgorde heeft. */
function besluitvormers(v, codenaamVan) {
  const per = new Map();
  for (const f of KETEN.lijst(v)) {
    if (!f.wie) continue;
    const r = per.get(f.wie) || { wie: f.wie, rol: f.rol, aantal: 0 };
    r.aantal++;
    per.set(f.wie, r);
  }
  return [...per.values()].sort((a, b) => b.aantal - a.aantal)
    .map(r => ({ wie: codenaamVan ? codenaamVan(r.wie) : r.wie, rol: r.rol, aantal: r.aantal }));
}

/* HET BEELD VOOR EEN ZAAK. Twee feiten en geen oordeel:

     herhaald   wat er meer dan een keer stuk was, met wat er de vorige keren
                mee gebeurde
     handen     wie de besluiten nam, en of dat iemand anders is dan wie er
                formeel over gaat

   `formeel` is de EIGENAAR van de zaak. Dat hij erbij staat is het hele punt:
   zonder hem is "negen besluiten van Boris" een weetje, met hem is het een
   vraag over hoe dit bedrijf werkelijk in elkaar zit. */
function beeld(st, v, mij, codenaamVan) {
  const naam = (x) => (codenaamVan ? codenaamVan(x) : x);
  const herhaald = STORING.openstaand(v)
    .map(s => ({ s, h: herhaling(v, s) }))
    .filter(x => x.h.keer > 1)
    .map(x => ({
      soort: x.s.soort,
      naam: (STORING.SOORTEN[x.s.soort] || {}).naam || x.s.soort,
      keer: x.h.keer, sinds: x.h.sinds,
      /* HOE VAAK ER EEN NOODOPLOSSING WERD GEKOZEN. Dat is de vorm van
         kennisschuld die uit deze bron af te lezen is: structureel tijdelijke
         maatregelen. Meer dan tellen doet hij niet. */
      tijdelijk: x.h.eerder.filter(f => f.optie === 'workaround' || f.optie === 'uit').length
    }));
  const handen = besluitvormers(v, codenaamVan);
  /* WANNEER HET ORGANIGRAM IETS ANDERS ZEGT DAN DE PRAKTIJK. Niet bij een
     drempelgetal -- drie besluiten is geen grens die ergens uit volgt -- maar op
     het punt waar het organigram STOPT MET KLOPPEN: iemand anders beslist
     minstens zo vaak als degene die er formeel over gaat.

     Een enkel besluit van een vakkracht is geen tweede organisatie; dat is een
     vakkracht die zijn werk deed. Zou het scherm dat al melden, dan staat er een
     bevinding waar geen bevinding is, en dan leert een speler de strook te
     negeren. */
  const vanMij = handen.filter(x => x.wie === naam(mij))
    .reduce((n, x) => n + x.aantal, 0);
  const scheef = handen.some(x => x.wie !== naam(mij) && x.aantal >= Math.max(1, vanMij));
  /* WIE ER FORMEEL OVER GAAT: de eigenaar. Een bedrijfsleider met een rol op
     deze zaak telt daar niet als "formeel" -- hij is juist een van de mensen
     die feitelijk beslist, en dat onderscheid IS de vraag. */
  const rollen = D.dienstenBij(st, v.id).map(d => ({ wie: naam(d.werknemer), rol: d.rol }));
  return { herhaald, handen: scheef ? handen : [], formeel: naam(mij), rollen,
    /* EN DE GRENS VAN DE BRON, met zoveel woorden. Zie de kop. */
    laatste: KETEN.LENGTE };
}

module.exports = { LOST_OP, herhaling, besluitvormers, beeld };
