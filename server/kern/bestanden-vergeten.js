/* RTG Bestanden (deelbestand): vergetelheid (AVG art. 17) in de kluis.

   De kluis stond niet in kern/vergeten.js. "Verwijder mijn gegevens" liet dus
   het hele bord staan -- de bestandsnamen, de mappen, en de versleutelde blobs
   op schijf. Die blobs zijn het zwaarste wat een lid hier heeft liggen:
   paspoortscans, contracten, medische brieven. Ze zijn versleuteld met de
   sleutel van de server, dus "versleuteld" betekent hier niet "onleesbaar voor
   ons" -- alleen "onleesbaar voor wie de schijf steelt".

   Twee kanten, en de tweede is makkelijk te vergeten. Het eigen bord gaat
   helemaal weg, bytes en al. En de codenaam van dit lid gaat uit de
   DEELLIJSTEN VAN ANDEREN: dat bestand blijft van die ander, maar het hoeft
   niet meer gedeeld te staan met iemand die er niet meer is. Dat is dezelfde
   lijn als de DM's en de sollicitaties in kern/vergeten.js -- de persoon eruit,
   het werk van de ander blijft.

   Synchroon, want deze bytes staan op onze eigen schijf (anders dan de
   mediastore, die ook een objectopslag op afstand kan zijn).

   Afgesplitst uit bestanden.js toen die de 10 KB passeerde. */
module.exports = function maakBestandenVergeten({ borden, wisItem, codenaamVan }) {
  function bestandenVergeet(key) {
    const alle = borden();
    const eigen = alle['lid:' + key];
    let gewist = 0;
    if (eigen) {
      for (const it of eigen.items || []) { wisItem(it); gewist++; }
      delete alle['lid:' + key];
    }
    const code = codenaamVan(key);
    let ontdeeld = 0;
    if (code) {
      for (const k of Object.keys(alle)) {
        for (const it of alle[k].items || []) {
          if (Array.isArray(it.gedeeldMet) && it.gedeeldMet.includes(code)) {
            it.gedeeldMet = it.gedeeldMet.filter(c => c !== code);
            ontdeeld++;
          }
        }
      }
    }
    return { gewist, ontdeeld };
  }
  return { bestandenVergeet };
};
