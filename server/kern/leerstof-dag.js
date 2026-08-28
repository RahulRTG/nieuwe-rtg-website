/* RTG School: de Daily Learning Guarantee -- elke schooldag weet een leerling
   wat er te doen is, en die lijst is nooit leeg zolang er iets te leren valt.

   Dit is de laag die alles ervoor bij elkaar brengt en zelf niets nieuws
   verzint. Wat erin komt bestaat al:
   - wat terugkomt uit de Memory Engine (kern/onderwijs-geheugen.js);
   - waar je gebleven bent in de leerlijn: het eerste doel dat nog open staat
     en waarvan de voorkennis wel af is (kern/leerstof-fabric.js);
   - wat de school heeft gevraagd, als de leerling in een klas zit
     (school/dag.js voegt dat vooraan toe).

   DEZE MODULE KRIJGT GEEN db EN GEEN save. Dat is geen vergetelheid maar de
   kern van het ontwerp: een dagplan wordt telkens opnieuw UITGEREKEND en nooit
   bewaard. Er is dus niets om een reeks van te maken, geen "vijf dagen achter
   elkaar", geen percentage af, geen quotum dat blijft staan. Zo'n teller is
   precies het verslavende patroon dat dit huis niet bouwt, en hij zou boven de
   18+-grens van de progressielaag uitkomen. Wat hier niet kan worden
   opgeslagen, kan later ook niet stiekem gaan tellen.

   Drie regels die het een dagplan houden en geen opdrachtenlijst:

   1. HET IS EEN VOORSTEL. Een leerling mag iets heel anders doen; er wordt
      niets afgedwongen en niets geregistreerd als "niet gedaan".
   2. HET IS BEGRENSD. Wie veertig herhalingen open heeft staan, ziet er geen
      veertig. Een berg is geen plan, en de rest komt vanzelf een andere dag.
   3. ER STAAT BIJ WAAROM. Elk stuk draagt zijn reden in gewone taal, zodat het
      een uitnodiging is en geen bevel van een machine. */
const MAX_HERHALEN = 3;
const MAX_VERDER = 3;
const MAX_STUKKEN = 5;

/* Klaar om aan te beginnen: alles wat eronder ligt is af. Een doel waarvan de
   voorkennis nog open staat, hoort niet in een dagplan -- dat is precies de
   opgave waar een kind op vastloopt zonder te weten waarom. */
const kanNu = (doel, behaald) => (doel.vereist || []).every(v => behaald[v]);

function maakDag({ onderwijs, DOELEN, PER_GROEP, PER_FASE }) {
  /* De leerlijn van de fase waarop je staat. Het basisonderwijs hangt aan de
     groep (po-g5 -> groep 5), de rest aan de fase; de bibliotheek kent beide
     onder een eigen index. */
  function lijnVan(fase) {
    if (!fase) return [];
    const po = /^po-g(\d)$/.exec(fase.id);
    return (po ? PER_GROEP[Number(po[1])] : PER_FASE[fase.id]) || [];
  }

  /* De fase waarop dit plan draait. Meestal die uit het paspoort, maar een kind
     dat door de SCHOOL in een klas is gezet heeft er zelf nooit een gekozen --
     dan is de fase van de klas het antwoord. Zonder die terugval bestaat het
     dagplan van zo'n leerling alleen uit huiswerk, en dat is precies de
     leerling voor wie de garantie bedoeld is. */
  function faseVan(pas, opties) {
    if (pas.fase) return pas.fase;
    const id = String((opties && opties.fase) || '');
    const f = id && (onderwijs.FASEN || []).find(x => x.id === id);
    return f ? { id: f.id, naam: f.naam } : null;
  }

  function dagplan(key, extra, opties) {
    const pas = onderwijs.mijn(key);
    const behaald = pas.doelen || {};
    const stukken = (extra || []).slice(0, MAX_STUKKEN);
    const fase = faseVan(pas, opties);

    if (!fase) return { ok: true, fase: null, stukken,
      let: 'Je staat nog niet op de ladder. Kies eerst je fase; daarna staat hier elke dag wat er klaarstaat.',
      uitleg: 'Dit is een voorstel voor vandaag en geen opdracht.' };

    /* Eerst wat terugkomt: iets wat je bijna kwijt bent, is meer waard dan het
       volgende nieuwe. De open lijst draagt geen datum en geen achterstand --
       zie kern/onderwijs-geheugen.js -- en dat blijft hier zo. */
    const open = (onderwijs.herhalingen(key).open || []).filter(o => DOELEN[o.doel]);
    for (const o of open.slice(0, MAX_HERHALEN)) {
      if (stukken.length >= MAX_STUKKEN) break;
      const d = DOELEN[o.doel];
      stukken.push({ soort: 'herhalen', doel: d.id, naam: d.naam, vak: d.vak,
        waarom: 'Dit heb je een tijd geleden geleerd; even ophalen houdt het vast.' });
    }

    // dan waar je gebleven bent: open doelen waarvan de voorkennis af is
    let verder = 0;
    for (const id of lijnVan(fase)) {
      if (stukken.length >= MAX_STUKKEN || verder >= MAX_VERDER) break;
      const d = DOELEN[id];
      if (!d || behaald[id] || !kanNu(d, behaald)) continue;
      stukken.push({ soort: 'verder', doel: d.id, naam: d.naam, vak: d.vak,
        waarom: 'Hier ben je gebleven, en alles wat hieronder ligt is af.' });
      verder += 1;
    }

    /* De garantie is geen belofte dat er altijd werk is, maar dat je altijd
       WEET waar je staat. Is er niets open, dan staat dat er ook -- met de
       volgende trede erbij in plaats van een lege lijst. */
    const restant = lijnVan(fase).filter(id => !behaald[id]).length;
    return { ok: true, fase: { id: fase.id, naam: fase.naam }, stukken,
      let: stukken.length ? null
        : restant
          ? 'Alles wat nu aan de beurt is, ligt achter een leerdoel dat nog open staat. Kies er hieronder een uit de leerlijn.'
          : 'Je hebt deze fase helemaal rond. Er komt vanzelf werk terug om vast te houden; de volgende trede staat bij je paspoort.',
      uitleg: 'Dit is een voorstel voor vandaag en geen opdracht. Iets anders doen mag altijd.' };
  }

  return { dagplan };
}

module.exports = { maakDag, kanNu, MAX_STUKKEN };
