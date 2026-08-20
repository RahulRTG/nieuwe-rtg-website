/* RTG Festival (deelmodule): DE BUNDEL. De keten van een product, en hoeveel
   er nog van weg kan.

   Afgesplitst van ./verkoop.js op de 10 kB-grens, en de knip valt op een echte
   naad: hier wordt UITGEREKEND wat een product is en hoeveel ruimte er is, daar
   wordt er GEHANDELD (reserveren, loslaten, rondmaken). De eerste kant is puur
   rekenwerk zonder gevolgen en mag zo vaak worden aangeroepen als nodig; de
   tweede verandert de wereld.

   EEN BUNDEL VERBRUIKT ALLES WAT ERIN ZIT. "Festival + glamping" kan alleen
   verkocht worden als BEIDE nog plek hebben, en een verkochte bundel haalt van
   allebei een plek af. De krapste schakel bepaalt dus wat er nog kan.

   VERVALLEN WORDT GEREKEND EN NIET OPGERUIMD. Een reservering draagt een `tot`;
   of hij nog meetelt wordt bij elke vraag opnieuw bepaald tegen het moment dat
   de aanroeper meegeeft. Een opruimtaak zou betekenen dat de voorraad klopt
   zodra die taak liep, en dat is precies de tussenstand waarin er te veel wordt
   verkocht. */
'use strict';

const MAX_DIEPTE = 6;

module.exports = (ctx) => {
  const { editieVind } = ctx;

  /* De keten van een product: zichzelf plus alles wat erin zit. Geeft null bij
     een te diepe bundel -- de aanroeper weigert dan, want een halfgelezen keten
     telt de verkeerde voorraad.

     AL GEZIEN IS NIET HETZELFDE ALS EEN LUS, en dat verschil stond hier eerst
     fout. Een product dat al in de verzameling zit, wordt gewoon overgeslagen:
     bij een RUIT (een bundel met twee onderdelen die allebei hetzelfde product
     bevatten) is dat de goede uitkomst -- je krijgt die ene plek een keer, niet
     twee keer, en de bundel hoort niet geweigerd te worden. Hier stond `return
     null`, en dat maakte van elke legitieme ruit een lus.

     Een ECHTE lus loopt hier ook op vast: a -> b -> a komt bij de derde stap
     zichzelf tegen en stopt. Wat er dan uitkomt ({a, b}) is precies de
     verzameling die telt.

     HIER STOND OOK EEN DIEPTEGRENDEL, EN DIE IS WEG. Een mutatie liet zien dat
     hij niets meer ving: sinds de regel hierboven eindigt elke lus vanzelf, en
     een bundel die legitiem diep is wordt al bij het SCHRIJVEN geweigerd
     (ketenDiepte, hieronder). Dode code die op een wacht lijkt is erger dan geen
     wacht, want de volgende vertrouwt hem (LAT-regel 4). De grendel in
     ketenDiepte blijft wel staan: die loopt zonder verzameling en zou op een
     met de hand gemaakte lus wel oneindig doorgaan. */
  function keten(e, id, uit) {
    const p = (e.producten || {})[String(id || '')];
    if (!p) return null;
    if (uit.has(p.id)) return uit;                // al geteld: een ruit, geen lus
    uit.add(p.id);
    for (const oid of (p.onderdelen || [])) {
      if (!keten(e, oid, uit)) return null;
    }
    return uit;
  }

  /* HOE DIEP EEN VOORGESTELDE BUNDEL WORDT. productZet roept dit LAAT aan via
     de gedeelde context (./index.js vult die per deel aan), zodat de dieptegrens
     valt bij het SCHRIJVEN en niet pas bij het lezen -- dezelfde les als bij de
     terreinboom: een bundel die netjes wordt aangenomen en daarna nergens meer
     te lezen is, is een stille fout (LAT-regel 5). */
  function ketenDiepte(e, ids, diepte) {
    if ((diepte || 0) > MAX_DIEPTE) return Infinity;
    let diepst = diepte || 0;
    for (const id of (ids || [])) {
      const p = (e.producten || {})[String(id)];
      if (!p) continue;
      const d = ketenDiepte(e, p.onderdelen, (diepte || 0) + 1);
      if (d > diepst) diepst = d;
    }
    return diepst;
  }

  /* De rechten die een pas van dit product krijgt: de eigen rechten plus die
     van alles wat erin zit. Ze worden GEKOPIEERD, net als bij pasUitgeven -- wie
     morgen de bundel wijzigt, bepaalt niet wat er gisteren verkocht is. */
  function productRechten(e, id) {
    const k = keten(e, id, new Set());
    if (!k) return null;
    const uit = [];
    for (const pid of k) {
      for (const r of ((e.producten[pid] || {}).rechten || [])) uit.push({ ...r });
    }
    return uit;
  }

  const actief = (v, moment) => v.stand === 'betaald'
    || (v.stand === 'gereserveerd' && String(v.tot || '') > moment);

  /* Wat er van DIT product weg is: elke actieve verkoop waarvan de keten dit
     product bevat. Een verkochte bundel telt dus mee bij elk onderdeel. */
  function verbruikt(e, id, moment) {
    let n = 0;
    for (const v of Object.values(e.verkopen || {})) {
      if (!actief(v, moment)) continue;
      const k = keten(e, v.product, new Set());
      if (k && k.has(String(id))) n++;
    }
    return n;
  }

  /* Hoeveel er nog van dit product verkocht kan worden: de krapste schakel in
     de keten wint. Oneindig als niets in de keten een voorraad heeft. */
  function ruimte(fid, eid, productId, moment) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const id = String(productId || '');
    const k = keten(e, id, new Set());
    if (!k) return { status: 409, error: 'Deze bundel is niet te lezen; kijk de onderdelen na.' };
    let vrij = Infinity, krapste = null;
    for (const pid of k) {
      const p = e.producten[pid];
      if (p.voorraad == null) continue;
      const over = p.voorraad - verbruikt(e, pid, moment);
      if (over < vrij) { vrij = over; krapste = p.naam; }
    }
    return { ok: true, product: id, ruimte: vrij === Infinity ? null : Math.max(0, vrij), krapste };
  }

  return { keten, ketenDiepte, productRechten, verbruikt, ruimte, actief,
    KETEN_MAX: MAX_DIEPTE };
};
