/* Magnaat: DE WEERGAVE -- wie mag wat weten, en waarop wordt er afgerekend.

   Afgesplitst van ./economie.js. Twee onderwerpen die bij elkaar horen en niet
   bij de klok:

   1. WIE ZIET WAT. Bij het bordspel ligt alles op tafel; bij de economie niet.
      Je eigen boeken zijn van jou. Van een ander zie je wat er OP STRAAT staat
      -- waar hij zit en hoeveel -- en niet zijn kas. Een kijker en een gedeeld
      scherm krijgen de wereld en niemands boeken. Dat is precies de
      waarschuwing die in de oude descriptor al stond voordat de economie
      bestond, en hier wordt hij waargemaakt.
   2. WAAROP WORDT ER AFGEREKEND. De winnaar is het hoogste VERMOGEN (geld plus
      wat je gebouwd hebt), want wie alles in zijn zaken heeft zitten hoort niet
      te verliezen van wie niets deed. De andere dimensies -- banen, reputatie,
      omzet -- staan op de eindstand en tellen NIET mee voor de winst. Ze laten
      zien wat voor ondernemer je was; er een tweede ranglijst van maken zou
      betekenen dat je op zes assen tegelijk aan het optimaliseren bent. */
const { capaciteit, waarde } = require('./stap');
const { prijsVan } = require('./sectoren');
const { PROJECTEN } = require('./foundation');

module.exports = ({ K, codenaamVan, rond, bijrekenen, foundationArbeid }) => {
  function eindstand(potje) {
    const st = potje.staat;
    return potje.spelers.map(h => {
      const rij = st.vestigingen[h] || [];
      const ondernemingswaarde = rij.reduce((n, v) => n + waarde(v), 0);
      const banen = rij.reduce((n, v) => n + v.personeel, 0);
      const reputatie = rij.length ? Math.round(rij.reduce((n, v) => n + v.reputatie, 0) / rij.length) : 0;
      const omzet = rij.reduce((n, v) => n + (v.omzetTotaal || 0), 0);
      return {
        codenaam: codenaamVan(h),
        geld: rond(st.geld[h]), waarde: rond(ondernemingswaarde),
        vermogen: rond(st.geld[h] + ondernemingswaarde),
        vestigingen: rij.length, banen, reputatie, omzet: rond(omzet)
      };
    }).sort((a, b) => b.vermogen - a.vermogen);
  }

  function zicht(potje, st, mij) {
    bijrekenen(potje);
    const k = K(st);
    const eigen = (st.vestigingen[mij] || []).map(v => Object.assign({}, v, {
      kavelNaam: k.kavel.get(v.kavel).naam, zone: k.kavel.get(v.kavel).zone,
      capaciteit: capaciteit(v, foundationArbeid(st)), waarde: waarde(v), prijsPer: prijsVan(v.sector, v.prijs)
    }));
    return {
      stad: k.naam, bron: k.bron, maand: st.maand, duur: st.duur, klaar: st.klaar,
      geld: rond(st.geld[mij] || 0),
      vestigingen: eigen,
      // van de anderen alleen wat aan tafel zichtbaar is: waar ze zitten en
      // hoeveel. Hun cash is van hen -- zie de waarschuwing in de descriptor
      anderen: potje.spelers.filter(sp => sp !== mij).map(sp => ({
        codenaam: codenaamVan(sp), vestigingen: (st.vestigingen[sp] || []).length,
        zones: [...new Set((st.vestigingen[sp] || []).map(v => k.kavel.get(v.kavel).zone))]
      })),
      vrij: k.kavels.filter(x => !st.kavelBezet[x.id]).length,
      foundation: { lokaal: rond(st.foundation.lokaal), centraal: rond(st.foundation.centraal),
        gedaan: st.foundation.gedaan.map(g => (PROJECTEN.find(p => p.id === g.id) || {}).naam).filter(Boolean) },
      sinds: st.laatste[mij] || null,
      eindstand: st.klaar ? eindstand(potje) : null
    };
  }
  // een gedeeld scherm en een kijker zien de wereld, niet iemands boeken
  function publiek(potje, st) {
    const k = K(st);
    return { stad: k.naam, maand: st.maand, duur: st.duur, klaar: st.klaar,
      stand: potje.spelers.map(h => ({ codenaam: codenaamVan(h), vestigingen: (st.vestigingen[h] || []).length })),
      foundation: st.foundation.gedaan.length };
  }

  return { zicht, publiek, eindstand };
};
