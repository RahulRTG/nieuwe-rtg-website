/* Compositie van de Magnaat Partnerstudio: een digitale bedrijfstweeling voor
   officiële RTG-partners, met gescheiden concept, proef en publicatie. */
'use strict';

module.exports = (opties) => {
  const basis = require('./magnaat-partnerstudio-basis')(opties);
  const model = require('./magnaat-partnerstudio-model')({ basis });
  const publicatie = require('./magnaat-partnerstudio-publicatie')({ basis, crypto: opties.crypto });
  const training = require('./magnaat-partnerstudio-training')({ basis });
  const api = Object.assign({}, model, publicatie, {
    proefStart: (supplier, actor) => training.proefStart(supplier, actor, model),
    proefAntwoord: (supplier, actor, id, keuze) => training.proefAntwoord(supplier, actor, id, keuze, model),
    trainingStart: (sleutel, code) => {
      const t = basis.staat().bedrijven[basis.tekst(code, 40).toUpperCase()];
      return t && t.gepubliceerd
        ? training.start('member:' + basis.tekst(sleutel, 150), t.gepubliceerd.snapshot, 'wereldeconomie')
        : { status: 404, error: 'Dit officiële partnerbedrijf staat niet in de Magnaat-wereld.' };
    },
    trainingAntwoord: (sleutel, id, keuze) => training.antwoord('member:' + basis.tekst(sleutel, 150), id, keuze),
    trainingClaim: (sleutel, id) => training.claim('member:' + basis.tekst(sleutel, 150), id),
    /* Alleen voor servermodules. Er bestaat bewust geen route die de volledige
       bedrijfstweeling naar een wereldlijst of browser stuurt. */
    trainingsmodel: (code) => {
      const t = basis.staat().bedrijven[basis.tekst(code, 40).toUpperCase()];
      return t && t.gepubliceerd ? {
        snapshot: basis.kopie(t.gepubliceerd.snapshot), meta: basis.kopie(t.gepubliceerd.meta)
      } : null;
    }
  });
  return { magnaatPartnerstudio: api };
};
