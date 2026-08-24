/* VEEL PATRONEN, EEN DOORLOOP -- Aho-Corasick zonder afhankelijkheid.

   WAAR DIT UIT KOMT. De dekkingsanalyse in scripts/keuring.js vraagt van 4195
   routes of ze ergens in de toetscode voorkomen, met ZEVEN vormen per route (de
   volle route, en de afgeknipte vorm met en zonder leidende slash, elk tussen
   enkele, dubbele of accent-aanhalingstekens -- zie patronenVoor in
   ./routedekking.js). Dat waren 29.365 aanroepen van String.includes over een
   tekst van 10 MB: ruim 126 gigabyte scannen, gemeten 16,9 seconde los en 18,3
   binnen dekking(). En die analyse wordt niet een keer per ronde gedraaid maar
   bij elke meting die endpointsZonderTest, dekkingPct of keuringScheef nodig
   heeft -- in de meterijking alleen al goed voor 85 van de 126 seconden.

   Aho-Corasick draait het om: alle patronen gaan EEN keer in een boom, en de
   tekst gaat er EEN keer doorheen. De uitkomst is per definitie dezelfde -- het
   is dezelfde vraag, "komt deze tekenreeks voor" -- alleen niet meer
   vermenigvuldigd met het aantal patronen.

   DAT "PER DEFINITIE" IS HIER NIET GENOEG, en dat is de reden dat er een toets
   naast staat. Deze uitkomst voedt twee RATELTANDEN (endpointsZonderTest en
   dekkingPct in NORM.json). Een snellere zoeker die net iets anders vindt, is
   geen versnelling maar een stille verschuiving van een norm. test/veelzoek.test.js
   houdt hem daarom tegen de naïeve variant op de ECHTE toetscode: alle 4195
   routes, alle zeven vormen, en de uitkomsten moeten route voor route gelijk
   zijn. Precies wat test/ast-grens.test.js voor de grenscontrole doet.

   EN DIE TOETS DOET IETS WAT DE ECHTE CODE VANDAAG NIET VRAAGT, met opzet. Van
   de 29.365 patronen die de routekaart oplevert is er gemeten NUL een echt
   achtervoegsel van een ander -- elk patroon begint met /api/ of met een
   aanhalingsteken, en die twee vallen nooit samen. De regel hieronder die de
   uitvoer van de faalknoop overneemt is daarmee op de huidige aanroep niet te
   zien: haal hem weg en de dekking blijft exact gelijk. Hij blijft staan omdat
   dit een ALGEMENE zoeker is, en test/veelzoek.test.js toets 2 houdt hem tegen
   patronen die de vorm wel hebben. Zonder die aparte toets zou het onderdeel
   stuk kunnen gaan zonder dat er iets zakt.

   WAT HIJ NIET IS: een reguliere-expressiemotor. Hij zoekt letterlijke
   tekenreeksen, meer niet. Dat is precies wat includes() ook doet, en het is de
   reden dat de gelijkwaardigheid te bewijzen valt.
   ========================================================================== */
'use strict';

/* Een knoop is een gewoon object met een Map naar kinderen. Geen array van 256:
   de patronen hier zijn paden en woorden, dus het alfabet dat werkelijk voorkomt
   is klein en een Map is dan zuiniger dan een array per knoop. */
function nieuweKnoop() {
  return { kind: new Map(), fail: null, uit: null, diep: 0 };
}

/* Bouw de automaat uit een lijst patronen. Lege patronen worden overgeslagen --
   die zouden overal matchen en dat is geen vraag maar een fout in de aanroep. */
function bouw(patronen) {
  const wortel = nieuweKnoop();
  const lijst = [];
  for (const ruw of patronen) {
    const p = String(ruw == null ? '' : ruw);
    if (!p) continue;
    const i = lijst.length;
    lijst.push(p);
    let k = wortel;
    for (const teken of p) {
      let v = k.kind.get(teken);
      if (!v) { v = nieuweKnoop(); v.diep = k.diep + 1; k.kind.set(teken, v); }
      k = v;
    }
    /* Meerdere patronen kunnen dezelfde tekenreeks zijn (een route die twee keer
       in de kaart staat). Dan hangen ze aan dezelfde knoop, en moeten ze ALLEBEI
       gemeld worden -- vandaar een lijst en geen enkele index. */
    (k.uit || (k.uit = [])).push(i);
  }

  /* De faalverwijzingen, in breedte. De faalverwijzing van een knoop wijst naar
     de langste echte achtervoegsel-knoop die ook in de boom zit; zo hoeft de
     tekst nooit terug. */
  const rij = [];
  for (const kind of wortel.kind.values()) { kind.fail = wortel; rij.push(kind); }
  for (let i = 0; i < rij.length; i++) {
    const k = rij[i];
    for (const [teken, kind] of k.kind) {
      let f = k.fail;
      while (f && !f.kind.has(teken)) f = f.fail;
      kind.fail = (f && f.kind.get(teken)) || wortel;
      /* De uitvoer van de faalknoop erbij: staat "api/bank" in de boom en
         eindigt hier "x/api/bank", dan hoort die ook gemeld te worden. Zonder
         deze regel mist de automaat elk patroon dat een achtervoegsel is van een
         ander. Op de huidige routepatronen komt die vorm niet voor (gemeten: 0
         van 29.365), dus deze regel is daar niet te zien -- hij hoort bij de
         zoeker en niet bij die ene aanroeper. test/veelzoek.test.js toets 2 is
         het enige wat hem tegenhoudt; zie de kop. */
      if (kind.fail.uit) kind.uit = (kind.uit || []).concat(kind.fail.uit);
      rij.push(kind);
    }
  }
  return { wortel, patronen: lijst };
}

/* Welke patronen komen voor in deze tekst? Geeft een Set van INDEXEN in de lijst
   die aan bouw() is meegegeven -- niet de tekenreeksen zelf, want die kunnen
   dubbel voorkomen en de aanroeper weet met een index precies welke van zijn
   patronen het was.

   Stopt NIET vroeg. Alles in een doorloop vinden is het hele punt; een
   vroegtijdige uitstap zou een tweede doorloop kosten voor de volgende vraag. */
function zoek(tekst, automaat) {
  const uit = new Set();
  const t = String(tekst == null ? '' : tekst);
  let k = automaat.wortel;
  for (let i = 0; i < t.length; i++) {
    const teken = t[i];
    while (k !== automaat.wortel && !k.kind.has(teken)) k = k.fail;
    k = k.kind.get(teken) || automaat.wortel;
    if (k.uit) for (const idx of k.uit) uit.add(idx);
  }
  return uit;
}

/* De vorm die de aanroepers werkelijk willen: welke van deze patronen komen voor.
   Geeft een Set van de PATRONEN zelf. */
function welkeKomenVoor(tekst, patronen) {
  const a = bouw(patronen);
  const idx = zoek(tekst, a);
  const uit = new Set();
  for (const i of idx) uit.add(a.patronen[i]);
  return uit;
}

module.exports = { bouw, zoek, welkeKomenVoor };
