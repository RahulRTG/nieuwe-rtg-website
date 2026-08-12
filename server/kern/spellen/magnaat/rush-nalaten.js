/* Magnaat: WAT ER VAN EEN DIENST OVERBLIJFT -- de drie bewaarlagen.

   ./rush-maand.js gaat over wat er de maand IN gaat; dit bestand over wat er
   NA afloop van overblijft. Dat is een echte naad en geen opdeling om de
   grootte: het eerste is een invoer die elke maand opnieuw gerekend wordt, het
   tweede is een besluit over wat er BEWAARD wordt -- en dat is de gevoeligste
   vraag van deze hele laag.

   DRIE BEWAARLAGEN, EN ZE ZIJN NIET INWISSELBAAR (VERHAAL.md par. 0f punt 3):

     telemetrie    wat de maand nodig heeft om te rekenen. Leeft op de
                   vestiging (`v.storingen`, `v.onderhoud`) en houdt geen
                   verleden bij -- alleen de stand van nu.
     audit         welke besluiten er genomen zijn, met een reden. Leeft in het
                   POTJE (`st.rush.log`), is afgekapt op LOGLENGTE, en gaat weg
                   als de partij weg is. Hier hoort ELKE dienst in.
     geschiedenis  wat later nog iets over een MENS zegt. Overleeft het potje
                   (../loopbaan.js), eist een tweede mens, en komt hoogstens een
                   keer per soort. Hier hoort bijna geen dienst in.

   Zonder die derde grens wordt een levensloop een lijst van vierduizend avonden
   waarin niets bijzonders gebeurde, en dan zegt "je hebt veel gewerkt" evenveel
   als een lege regel. De gebeurtenisruggengraat is geen vuilnisbak. */
'use strict';

const R = require('./rush');
const STORING = require('./storing');
const { SOORTEN } = require('./rush-voorvallen');
const { afgerond } = require('./rush-maand');

/* Hoeveel diensten er in het log passen. Zoals bij ./beheer.js: een log dat
   alles bewaart is geen geheugen maar een bak. */
const LOGLENGTE = 40;

/* WANNEER EEN AVOND GESCHIEDENIS WORDT, en dit is de scherpste grens van deze
   laag (VERHAAL.md par. 0f wet 5, en punt 3 van de opdracht).

   DRIE BEWAARLAGEN, EN ZE ZIJN NIET INWISSELBAAR:

     telemetrie    wat de maand nodig heeft om te rekenen. Leeft op de
                   vestiging (`v.storingen`, `v.onderhoud`) en houdt geen
                   verleden bij -- alleen de stand van nu.
     audit         welke besluiten er genomen zijn, met een reden. Leeft in het
                   POTJE (`st.rush.log`), is afgekapt op LOGLENGTE, en gaat weg
                   als de partij weg is. Hier hoort ELKE dienst in.
     geschiedenis  wat later nog iets over een MENS zegt. Overleeft het potje
                   (../loopbaan.js), eist een tweede mens, en komt hoogstens een
                   keer per soort. Hier hoort bijna geen dienst in.

   Zonder die derde grens wordt een levensloop een lijst van vierduizend avonden
   waarin niets bijzonders gebeurde, en dan zegt "je hebt veel gewerkt" evenveel
   als een lege regel. De gebeurtenisruggengraat is geen vuilnisbak.

   DE DREMPEL HEEFT TWEE HELFTEN, en ze moeten allebei waar zijn:

     impact   wat de storing bij ELKAAR opgelopen heeft -- wat hij per maand
              extra kostte maal hoe lang hij al liep -- afgezet tegen wat deze
              zaak in een maand verdient. Een koelstoring in een zaak van
              veertig stoelen is een ander verhaal dan dezelfde in een van vier,
              en een die vijf maanden sleepte een ander dan een van een avond.
     rol      JIJ hebt hem beeindigd. Wie de waar overzette heeft gered wat er
              lag; wie hem meldde heeft hem doorgegeven. Allebei nuttig, allebei
              geen moment -- het incident liep gewoon door.

   EEN OP DE VIJF MAANDRESULTATEN is de drempel. Niet omdat dat getal heilig is
   maar omdat het uitkomt op: dit kostte de zaak merkbaar geld, en jij bent
   degene die er een eind aan maakte. */
const DREMPEL = 0.20;

/* Welke uitwegen het incident echt BEEINDIGEN. `overzetten` redt wat er ligt en
   `escaleren` geeft het door -- na allebei is de koeling morgen nog stuk. */
const BEEINDIGT = ['repareren', 'workaround', 'uit'];

/* WAT ER DEZE AVOND MET EEN STORING IS GEBEURD -- of niets. Geeft het feit
   terug plus `zwaar`: of het de drempel hierboven haalde. */
function storingsbesluit(v, s, vv) {
  for (const g of s.gedaan) {
    const bron = SOORTEN.find(x => x.id === g.id);
    if (!bron || !bron.storing) continue;
    const was = (v.storingen || []).find(x => x.soort === bron.storing);
    const maanden = was ? Math.max(1, s.maand - was.sinds) : 1;
    /* De opgelopen schade: wat een OPEN storing per maand extra kost, maal hoe
       lang hij liep. `s.raming` is de bevroren dervingsgrondslag van deze
       avond, dus hij schaalt vanzelf met de maat van de zaak. */
    const opgelopen = STORING.zwaarte(v, bron.storing, s.raming || 0) * maanden;
    const perMaand = Math.abs((v.resultaatTotaal || 0) / Math.max(1, v.maanden || 1));
    return { soort: bron.storing,
      /* DE WOORDEN REIZEN MEE MET HET FEIT. ../loopbaan-noteren.js hoort niet te
         weten hoe een koeling heet; een woordenboek daar zou uit de pas lopen
         met de tabel hier. */
      naam: (STORING.SOORTEN[bron.storing] || {}).naam || bron.storing,
      optie: g.optie, maanden,
      beeindigd: BEEINDIGT.includes(g.optie),
      zwaar: BEEINDIGT.includes(g.optie) && perMaand > 0
        && opgelopen >= DREMPEL * perMaand };
  }
  return null;
}

/* NA DE MAAND: wat er van de dienst overblijft. Een regel met een reden in het
   log (zoals ./beheer.js `meld`), en het FEIT op het dienstverband.

   ER STAAT GEEN OORDEEL IN. Niet "goed gedraaid" maar wat je aanpakte en wat er
   bleef liggen -- par. 0b: wat gebeurd is blijft waar, wat het betekent kan
   veranderen. Of hier ooit een moment uit groeit beslist ../loopbaan-noteren.js,
   en die leest hetzelfde feit als iedereen.

   `geboekt` MAAKT HEM IDEMPOTENT, want de wereld rekent bij en een maand kan
   meer dan eens langskomen zonder dat er een tweede regel hoort te ontstaan. */
function naMaand(potje) {
  const t = R.tafel(potje.staat);
  for (const { d, v, s, vv } of afgerond(potje)) {
    if (s.geboekt) continue;
    const u = R.uitkomst(vv, s, v);
    s.geboekt = true;
    /* WAT ER DEZE AVOND MET EEN STORING GEBEURD IS, en of dat zwaar genoeg was
       om ooit geschiedenis te worden. Het OORDEEL valt hier niet -- hier valt
       het FEIT, met de twee getallen erbij waarop ../loopbaan-noteren.js later
       beslist. Dat is par. 0b: systemen schrijven feiten, Magnaat leest
       geschiedenis. */
    const besluit = storingsbesluit(v, s, vv);
    (d.diensten = d.diensten || []).push({ maand: s.maand, vestiging: d.vestiging,
      aangepakt: s.gedaan.length, bleefLiggen: u.bleefLiggen.length,
      /* WAT EEN AVOND BIJZONDER MAAKT (wet 5): dat je een incident hebt
         opgevangen, niet dat je zes keer geklikt hebt. */
      incident: vv.some(x => x.incident && s.gedaan.some(g => g.id === x.id)),
      storing: besluit });
    t.log.unshift({ maand: s.maand, werknemer: d.werknemer, zaak: v.naam,
      derving: u.derving,
      waarom: u.verschil >= 0
        ? 'derving ' + u.verschil + ' lager dan zonder sturing'
        : 'derving ' + (-u.verschil) + ' hoger dan zonder sturing' });
  }
  if (t.log.length > LOGLENGTE) t.log.length = LOGLENGTE;
  /* OPGELOSTE STORINGEN OPRUIMEN, nadat de maand ze gezien heeft. Een lijst die
     alles bewaart is telemetrie noch geschiedenis, alleen een bak. */
  for (const rij of Object.values(potje.staat.vestigingen || {}))
    for (const v of rij) STORING.ruim(v);
}

module.exports = { naMaand, storingsbesluit, LOGLENGTE, DREMPEL, BEEINDIGT };
