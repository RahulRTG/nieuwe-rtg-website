/* RTG Wereld -- DE VIJF ZICHTBAARHEDEN, en wie ze elk aanwijzen.

   Afgesplitst van ./profiel.js toen dat bestand tegen de 10 kB-grens aan liep.
   De naad zit waar hij inhoudelijk ook hoort: daar staat WELKE velden er zijn en
   waar ze vandaan komen, hier staat WIE ze mag zien. Dat tweede is een vraag op
   zichzelf, en het is de vraag waar deze hele laag om draait.

   ER STONDEN ER EERST ZES, met 'vrienden' NAAST 'contacten'. Bij het bouwen
   bleek dat een lege belofte: dit huis heeft EEN vriendengraaf, dus die twee
   zouden precies dezelfde mensen aanwijzen. Twee knoppen met hetzelfde gevolg is
   een leugen in de interface -- de gebruiker denkt iets af te schermen wat hij
   niet afschermt. Er zijn er nu vijf, en test/wereldprofiel.test.js legt ze op
   EEN opstelling van vier kijkers naast elkaar. Dat is de enige manier om te
   bewijzen dat ze echt iets verschillends doen; een toets die elk niveau apart
   afvinkt had die dubbeling nooit gezien. */
'use strict';

module.exports = ({ db, zijnVrienden, zakProfiel }) => {
  // de groepen staan in db.data.genootschap.GROEPEN (zie kern/genootschap/index.js);
  // dat leest hier bewust letterlijk zo, want de vorm raden ging al een keer mis
  const deeltGenootschap = (a, b) => ((db.data.genootschap || {}).groepen || [])
    .some(gr => {
      const leden = (gr.leden || []).map(l => (typeof l === 'string' ? l : l && l.key));
      return leden.includes(a) && leden.includes(b);
    });

  function magZien(niveau, kijker, doel) {
    if (kijker === doel) return true;              // je eigen profiel: altijd
    switch (niveau) {
      case 'iedereen': return true;
      case 'contacten': return !!(zijnVrienden && zijnVrienden(kijker, doel));
      // de professionele kant van diezelfde graaf: verbonden EN allebei een
      // zakelijk profiel. Zonder dat tweede deel zou 'zakelijk' hetzelfde
      // betekenen als 'contacten', en dan is het geen aparte keuze.
      case 'zakelijk': return !!(zijnVrienden && zijnVrienden(kijker, doel))
        && !!zakProfiel(kijker) && !!zakProfiel(doel);
      case 'genootschap': return deeltGenootschap(kijker, doel);
      case 'alleenik': return false;
      default: return false;                        // onbekend niveau: dicht
    }
  }


  return { magZien, deeltGenootschap };
};
