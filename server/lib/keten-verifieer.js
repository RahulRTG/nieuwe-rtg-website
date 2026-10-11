/* DE VERIFICATIE VAN EEN KETEN, uit ./keten.js gelicht (keuringsregel 13,
   10 kB): dat bestand gaat over het MAKEN van een keten (schakel, hangAan,
   noteerIn), dit over het NALOPEN ervan. `hashVan` komt van ./keten.js zelf,
   zodat er maar een definitie van een regelhash bestaat. */
'use strict';

module.exports = function maakVerifieer(hashVan) {
  /* De hele keten nalopen. `regels` staat NIEUWSTE EERST -- dat is hoe het
     inzagejournaal hem bewaart (unshift), en een verifieerder die stilletijk een
     andere volgorde aanneemt, keurt alles goed.

     Geeft terug:
       ok         niets mis
       gebroken   [{index, waarom}] -- hier klopt het niet meer
       afgekapt   de oudste regel verwijst naar een voorganger die weggevallen is;
                  normaal bij een begrensd journaal, dus apart gemeld
       zonderKeten hoeveel regels nog helemaal geen hash dragen (oude regels van
                  voor deze voorziening; die veroordelen we niet)

     EEN REGEL ZONDER HASH IS ALLEEN OUD ALS HIJ OOK OUDER IS. Hier stond dat elke
     regel zonder hash als "van voor de keten" telde, waar hij ook stond. Dan was
     vervalsen gratis: wijzig een regel midden in het spoor, haal zijn `hash`-veld
     weg, en verifieer() meldde ok -- de regel erboven sloeg de vergelijking over
     omdat zijn voorganger "nog geen keten" had (audit P1-2). Een regel van voor
     deze voorziening staat per definitie ONDER de oudste geketende regel; elke
     hashloze regel daarboven is een gat in de keten en geen erfenis. En de oudste
     geketende regel die naar een voorganger verwijst die zijn hash kwijt is, is
     precies dezelfde aanval een plek lager. */
  function verifieer(regels) {
    const l = Array.isArray(regels) ? regels : [];
    const gebroken = [];
    let zonderKeten = 0, afgekapt = false;
    let oudsteGeketend = -1;
    for (let i = l.length - 1; i >= 0; i--) if (l[i] && l[i].hash) { oudsteGeketend = i; break; }

    for (let i = 0; i < l.length; i++) {
      const r = l[i];
      if (!r || !r.hash) {
        if (i < oudsteGeketend) {
          gebroken.push({ index: i, waarom: 'regel zonder hash BINNEN de keten -- een geketende regel eronder bewijst dat hij er een hoorde te dragen' });
        } else zonderKeten++;
        continue;
      }

      /* 1. Klopt de regel met zijn eigen hash? Zo niet, dan is de INHOUD veranderd. */
      if (hashVan(r) !== r.hash) {
        gebroken.push({ index: i, waarom: 'de inhoud van deze regel klopt niet met zijn hash' });
        continue;
      }

      /* 2. Klopt de verwijzing naar de voorganger? De voorganger van regel i staat
         op i+1: de lijst loopt van nieuw naar oud. */
      const ouder = l[i + 1];
      if (!ouder) {
        /* De oudste die er nog is. Verwijst hij naar een voorganger, dan is die
           weggevallen -- de afkap, geen breuk. */
        if (r.vorige) afgekapt = true;
        continue;
      }
      /* De keten begint hier, maar alleen als deze regel dat zelf ook zegt: het
         begin van een keten verwijst naar niets. Verwijst hij wel ergens naar, dan
         is de hash van zijn voorganger weggehaald. */
      if (!ouder.hash) {
        if (r.vorige) gebroken.push({ index: i, waarom: 'verwijst naar een voorganger die zijn hash kwijt is' });
        continue;
      }
      if (r.vorige !== ouder.hash) {
        gebroken.push({ index: i, waarom: 'verwijst niet naar de regel eronder -- er is iets tussenuit of veranderd' });
      }
    }

    return { ok: gebroken.length === 0, gebroken, afgekapt, zonderKeten, geteld: l.length };
  }

  return verifieer;
};
