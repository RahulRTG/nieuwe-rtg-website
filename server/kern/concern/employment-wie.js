/* CONCERN (deelmodule van ./employment.js): EEN MENS, TWEE SCHRIJFWIJZEN -- en de lezer kent ze allebei.

   `persoon` komt hier op twee manieren binnen, en geen van beide is fout:
   een uitnodiging (./uitnodiging.js) en een aanname (./aanname.js) schrijven
   de LEDENSLEUTEL van wie accepteert, uit een geverifieerde sessie; de
   eigenaar die iemand met de hand aanneemt (/api/concern/mens/nieuw) kent
   alleen de CODENAAM en typt die. Zolang elke lezer maar een van de twee
   vergeleek, bestond het dienstverband voor de helft van het huis niet:
   "Mijn werk" zei "u heeft nog geen werkplek" tegen wie op codenaam was
   aangenomen, de loonrun meldde loon zonder dienstverband, en de
   toegangsreview van het kantoor (kern/kantoor/huis.js) zag een uitgenodigde
   RTG-medewerker nooit als in dienst.

   De reparatie is een LEZING en geen migratie: wie met een ledensleutel
   vraagt, krijgt ook de dienstverbanden onder zijn codenaam. Er wordt niets
   herschreven -- een dienstverband is een verklaring van een werkgever, en
   die wordt niet in bulk voor hem omgezet (ARBEID.md par. 7a). Andersom
   (van codenaam naar sleutel) loopt hier niet: die opzoeking is in deze
   laag niet synchroon te krijgen, dus een lezer die een codenaam heeft, krijgt
   precies die. Wie de sleutel heeft, vraagt op de sleutel. */
'use strict';

module.exports = (codenaamVan) => {
  function wie(persoon) {
    const p = String(persoon || '');
    const s = new Set([p]);
    let cn = null;
    try { cn = typeof codenaamVan === 'function' ? codenaamVan(p) : null; } catch (e) { cn = null; }
    if (cn && cn !== p) s.add(String(cn));
    return s;
  }
  return wie;
};
