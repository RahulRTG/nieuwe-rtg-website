/* Kern-deel "clips-kantoor": melden vanuit de feed en wat het kantoor ermee
   doet (de lijst zien, een kaart weghalen). Het beeld zelf stond nooit bij
   RTG; weghalen is de kaart, de reacties en de meldingen erover. Krijgt de
   gedeelde stukken van ./clips.js. */
module.exports = ({ save, schoon, codenaamVan, sseToOffice, eigen, lijsten, clipMet, id, nu, aanwezigheid }) => {
  function meld(key, cid, reden) {
    lijsten();
    const c = clipMet(cid); if (!c) return { status: 404, error: 'Clip niet gevonden.' };
    eigen.bak('clipsMeldingen').push({ id: id(), clipId: c.id, titel: c.titel, maker: codenaamVan(c.key),
      van: codenaamVan(key), reden: schoon(reden, 300) || 'Geen reden opgegeven', at: nu() });
    /* Geen kap hier: die draait in het onderhoud (kern/kappen.js, houd 200).
       Een kap in het verzoek houdt een weigering van de begroting in stand. */
    save(); sseToOffice('sync', { scope: 'clips' });
    return { status: 200, ok: true };
  }
  function officeLijst() {
    lijsten();
    return { status: 200, meldingen: eigen.bak('clipsMeldingen').slice(-50).reverse(),
      totaal: eigen.bak('clips').length };
  }
  // kantoor haalt de kaart weg; het beeld zelf stond nooit bij RTG
  function officeVerwijder(cid) {
    lijsten();
    const c = clipMet(cid); if (!c) return { status: 404, error: 'Clip niet gevonden.' };
    eigen.zetBak('clips', eigen.bak('clips').filter(x => x.id !== c.id));
    delete eigen.bak('clipsReacties')[c.id];
    eigen.zetBak('clipsMeldingen', eigen.bak('clipsMeldingen').filter(m => m.clipId !== c.id));
    aanwezigheid.delete(c.id);
    save();
    return { status: 200, ok: true };
  }

  return { meld, officeLijst, officeVerwijder };
};
