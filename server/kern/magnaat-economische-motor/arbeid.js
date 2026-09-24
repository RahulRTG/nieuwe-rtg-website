/* Magnaat Economische Motor -- de arbeidsmarkt: of een bedrijf het personeel
   krijgt dat het zoekt, gegeven de schok van de dag en zijn loonpositie. */
'use strict';
const { rond, begrens } = require('./constanten');

module.exports = (m) => {
  function pasArbeidsmarktToe(e, b, schok) {
    const verschil = rond(b.personeelDoel - b.personeel);
    if (!verschil) return 0;
    if (verschil < 0) {
      const vertrek = Math.min(b.personeel, Math.abs(verschil));
      b.personeel -= vertrek;
      m.legUit(e, 'arbeid', b.naam + ' verkleint het team', 'Het ingestelde personeelsdoel ligt lager dan de bestaande bezetting.', '-' + vertrek + ' arbeidsplaatsen', 'personeelsbesluit');
      return -vertrek;
    }
    const loonFactor = begrens(b.loonMaand / 350000, .65, 1.35);
    const beschikbaar = Math.max(0, Math.floor(verschil * schok.arbeid * loonFactor));
    const hires = Math.min(verschil, beschikbaar || (schok.id === 'arbeidstekort' ? 0 : 1));
    b.personeel += hires;
    m.legUit(e, 'arbeid', b.naam + ' werft personeel', 'Beschikbaarheid en loonpositie bepalen hoeveel vacatures werkelijk worden gevuld.', '+' + hires + ' van ' + verschil + ' vacatures', 'arbeidsaanbod x relatieve beloning');
    return hires;
  }

  return { pasArbeidsmarktToe };
};
