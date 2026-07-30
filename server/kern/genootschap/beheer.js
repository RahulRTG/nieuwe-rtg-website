/* Genootschap (deelmodule): het beheer van de ledenlijst -- iemand beheerder
   maken, en iemand eruit zetten.

   Apart gehouden omdat het het enige stuk is waar een lid MACHT over een ander
   heeft. Dat verdient zijn eigen plek en zijn eigen regels, en die zijn:
   - de laatste beheerder kan zichzelf niet degraderen (dan blijft er een groep
     achter die niemand meer kan beheren);
   - jezelf eruit zetten bestaat niet; dat heet vertrekken en zit in index.js.
   Gemount vanuit server.js, met de groepen-module als buur. */
module.exports = ({ save, codenaamVan, keyVanCodenaam, genootschap }) => {
  async function keyVan(wie) {
    const c = String(wie || '').trim();
    if (!c || !keyVanCodenaam) return null;
    try { const t = await keyVanCodenaam(c); return (t && t.key) || null; } catch (e) { return null; }
  }

  async function rolZet(sess, id, wie, rol) {
    const gr = genootschap.groepMet(id);
    if (!gr) return { error: 'Dit genootschap bestaat niet.' };
    if (!genootschap.isBeheer(gr, sess.key)) return { error: 'Alleen een beheerder doet dit.' };
    if (!['beheerder', 'lid'].includes(rol)) return { error: 'Onbekende rol.' };
    const doel = await keyVan(wie);
    const l = doel && genootschap.lidRegel(gr, doel);
    if (!l) return { error: 'Dit lid zit niet in het genootschap.' };
    if (l.key === sess.key && rol === 'lid' && (gr.leden || []).filter(x => x.rol === 'beheerder').length === 1) {
      return { error: 'Je bent de enige beheerder.' };
    }
    l.rol = rol;
    save();
    return { ok: true, rol };
  }

  async function zetUit(sess, id, wie) {
    const gr = genootschap.groepMet(id);
    if (!gr) return { error: 'Dit genootschap bestaat niet.' };
    if (!genootschap.isBeheer(gr, sess.key)) return { error: 'Alleen een beheerder doet dit.' };
    const doel = await keyVan(wie);
    if (!doel || !genootschap.isLid(gr, doel)) return { error: 'Dit lid zit niet in het genootschap.' };
    if (doel === sess.key) return { error: 'Jezelf eruit zetten doe je met vertrekken.' };
    gr.leden = gr.leden.filter(l => l.key !== doel);
    save();
    return { ok: true };
  }


  return { rolZet, zetUit };
};
