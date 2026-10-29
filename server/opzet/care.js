/* Toren 4: RTG Care (zorg & welzijn). Behandelingen boeken met het zorgprofiel
   dat meereist en een aparte, veilige intake-deling per aanbieder.
   De metingen-deur gaat LAAT GEBONDEN mee: kern/metingen.js hangt verderop in
   de bouw, en een kopie op dit moment zou undefined bevriezen -- de stille
   breuk waar opzet/domeingrens.js over gaat. Bij de samenvoeging van de
   Life-tak eerst weggevallen; vier zorgtoetsen wezen hem meteen aan. */
module.exports = (ctx) => {
  const { db, save, crypto, schoon, notify, zorgVoor, zorgMee, metingVanBehandelaar, betaalZaak } = ctx;
  return require('../kern/care')({ db, save, crypto, schoon, notify, zorgVoor, zorgMee,
    metingVanBehandelaar, betaalZaak });
};
