/* ============================================================================
   EEN MANDREGEL WORDT EEN AFREKENREGEL -- of hij wordt geweigerd met een reden.

   Geknipt uit ./afrekening.js toen die met de prijsvraag erbij over de 10 kB
   leesgrens ging. De snede loopt langs een echte grens: hier gaat het over EEN
   regel (bestaat dit, mag het bevestigd worden, wat kost het, staat er iets in
   de weg), daar over het optellen en groeperen PER VERKOPER.

   ER BESTAAT GEEN DERDE UITKOMST. Een regel wordt een afrekenregel of een
   weigering met een reden; een regel die stilletjes uit de mand valt, is een
   mand die minder kost dan de koper dacht.
   ========================================================================== */
'use strict';

const { kan, waaromNiet } = require('./werkwoorden');
/* HET BEDRAG WORDT HIER NIET OPNIEUW GELEZEN. `bedrag` staat in EURO'S en
   `vanaf` is een vlag en geen bedrag -- twee dingen die deze laag allebei een
   keer verkeerd om heeft gehad, en een tweede lezer zou ze een tweede keer
   verkeerd om kunnen krijgen (LAT-regel 4). De uitleg staat bij de bron in
   ./koopbaar.js. */
const { vastBedragCenten: centenVan } = require('./koopbaar');
const { antwoordCenten } = require('./prijsvraag');

module.exports = () => {
  /* Een regel wordt een afrekenregel, of hij wordt geweigerd met een reden. Er
     bestaat geen derde uitkomst: een regel die stilletjes uit de mand valt, is
     een mand die minder kost dan de koper dacht. */
  function regelVan(wens, koopbaarVan) {
    const id = String((wens && wens.koopbaarId) || '');
    const aantal = Math.max(1, Math.min(999, parseInt(wens && wens.aantal, 10) || 1));
    const k = id ? koopbaarVan(id) : null;
    if (!k) return { fout: { koopbaarId: id, reden: 'Dit aanbod bestaat niet (meer).' } };
    if (!kan(k, 'bevestig')) {
      const uitleg = (k.ontbreekt || []).find(o => o.werkwoord === 'bevestig');
      return { fout: { koopbaarId: id, titel: k.titel, reden: uitleg ? uitleg.reden : waaromNiet(k, 'bevestig') } };
    }
    /* GEEN PRIJS IS NIET HETZELFDE ALS GEEN AFREKENING. Een koopbaar dat wel
       `bevestig` heeft maar geen `prijs`, is een gratis bevestiging -- een tafel,
       een bezichtiging, een afspraak. Dat is geen randgeval maar wat de meting
       afdwong: 26 van de 100 domeinen bevestigen zonder prijs (COMMERCE.json), en daarom
       hangt `bevestig` in ./werkwoordlijst.js niet meer aan `prijs`.

       Deze regel weigeren zou die correctie meteen weer ongedaan maken: dan valt
       een tafel alsnog uit de mand, nu een laag lager. Hij wordt dus een regel
       van nul.

       Wat WEL wordt geweigerd is de tegenstrijdigheid: een koopbaar dat `prijs`
       verklaart en er geen draagt. Dat is geen gratis ding maar een kapotte rij,
       en die hoort niet stil op nul te eindigen. */
    /* EEN PRIJSVRAAG WORDT HIER BEANTWOORD. Een verblijf of een reis draagt
       geen vast bedrag maar een keuze met exacte bedragen erachter (welke
       kamer, hoeveel nachten). Het antwoord staat bij de mandregel; het BEDRAG
       komt uit ./prijsvraag.js en dus uit de server -- nooit uit de browser,
       precies zoals bij een vaste prijs. Ontbreekt het antwoord, dan wordt de
       regel geweigerd MET de vraag erbij, zodat een scherm kan vragen in plaats
       van te raden. */
    let vraagUit = null;
    if (k.prijsvraag) {
      vraagUit = antwoordCenten(k.prijsvraag, (wens && wens.antwoorden) || {});
      if (vraagUit.centen == null) {
        return { fout: { koopbaarId: id, titel: k.titel, reden: vraagUit.reden, prijsvraag: k.prijsvraag } };
      }
    }
    const stuk = vraagUit ? vraagUit.centen : (kan(k, 'prijs') ? centenVan(k.prijs) : 0);
    if (stuk == null) return { fout: { koopbaarId: id, titel: k.titel, reden: 'Dit aanbod verklaart een prijs maar draagt geen bedrag; de server rekent niets uit dat er niet staat.' } };

    /* Beschikbaarheid weegt alleen mee als het koopbaar dat werkwoord HEEFT. Een
       ding zonder gemeten voorraad tegenhouden zou stilte als "op" uitleggen, en
       dat is de spiegelbeeldige fout van stilte als "beschikbaar" uitleggen. */
    let blokkade = null;
    if (kan(k, 'beschikbaarheid') && k.beschikbaar && Number.isFinite(Number(k.beschikbaar.voorraad))) {
      const vrij = Number(k.beschikbaar.voorraad);
      if (vrij <= 0) blokkade = 'Dit is op.';
      else if (aantal > vrij) blokkade = 'Er zijn er nog ' + vrij + ' van.';
    }
    return {
      regel: {
        koopbaarId: k.id, titel: k.titel, type: k.type, bron: k.bron,
        aantal, stukCenten: stuk, totaalCenten: stuk * aantal,
        /* Uitdrukkelijk, zodat een scherm "gratis" kan zetten in plaats van
           "0,00" -- dat leest als een fout in de prijs. */
        gratis: !kan(k, 'prijs'),
        /* Hoe dit bedrag is opgebouwd, als het uit een keuze kwam. Een koper
           die "Suite x 3 nachten" leest, hoeft niet te rekenen om te zien of
           het klopt. */
        keuze: vraagUit ? { uitleg: vraagUit.uitleg, optie: vraagUit.keuze, aantal: vraagUit.aantal } : null,
        levert: kan(k, 'lever'), annuleerbaar: kan(k, 'annuleer'), retourneerbaar: kan(k, 'retour'),
        /* WAAR DIT WERKELIJK WORDT BEVESTIGD. Deze laag bevestigt met opzet
           niets zelf, en dan is dit geen extraatje maar het sluitstuk: zonder
           deze verwijzing is "wij stoppen bij de deur" een doodlopend eind.
           kern/mall/aanbod.js zet hem al per rij; hier reist hij mee. */
        pagina: k.pagina || null,
        blokkade
      },
      aanbieder: k.aanbieder || null
    };
  }

  return { regelVan };
};
