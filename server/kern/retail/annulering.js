/* ============================================================================
   EEN VERKOOP ONGEDAAN MAKEN -- als TEGENBOEKING en nooit door de bon te wissen.

   HIER STOND EEN GAT, en het stond zo in COMMERCE.md par. 6: `verkoopTerug`
   haalde de voorraad terug EN gooide de kassabon uit db.data.posSales. Dat is
   geen annulering maar een uitgeveegde regel. Wie de Z-lijst van gisteren naast
   die van vandaag legt, ziet een bon die er nooit is geweest -- en niemand die
   kan zeggen waarom.

   EEN BOEKHOUDING WIST NIETS, DIE BOEKT TEGEN. Dus blijft de oorspronkelijke bon
   staan (met een merkje dat hij is teruggedraaid) en komt er een TWEEDE bon bij
   die zijn spiegelbeeld is: hetzelfde, met een min ervoor. Dat is niet alleen
   netter, het is ook goedkoper: 42 plekken in dit huis lezen posSales, en de
   plekken die geld optellen komen door een tegenboeking vanzelf op nul uit --
   zonder dat er ergens een `if (!bon.geannuleerd)` bij hoeft. Een vlag zou al
   die plekken moeten bereiken, en de plek die hem vergeet telt omzet die niet
   bestaat.

   EEN WEG EN GEEN TWEE. Een kassa kent normaal twee handelingen: een VOID
   (de betaling ketste af, de transactie sloot nooit) en een RETOUR (de verkoop
   stond, en wordt teruggedraaid). Ze zijn hier met opzet niet twee mechanismen
   geworden maar een, met een GROND ernaast. Twee mechanismen zijn twee
   waarheden over dezelfde vraag "is deze omzet echt", en de bon was al een keer
   het slachtoffer van precies dat.

   WAT DIT NIET DOET: geld terugbetalen. De teruggave loopt langs
   kern/pay/verkoop.js en wordt door kern/commerce/retour.js KLAARGEZET; een
   mens drukt. Deze laag raakt de voorraad en de boeking, en dat is het.
   ========================================================================== */
'use strict';

/* De gronden. Gesloten lijst: een vrij tekstveld als reden zou binnen een maand
   vijftien spellingen van "klant wilde niet" opleveren, en dan is er niets meer
   over te tellen. De toelichting mag er los bij. */
/* HEET ANNULEERGRONDEN EN NIET `ANNULEERGRONDEN`. Dat woord staat al in
   kern/commerce/retourlijst.js voor de gronden van een RETOUR, en dat is een
   ander begrip: daar brengt een koper iets terug, hier draait een kassa een bon
   terug. Twee lijsten onder een naam is precies wat SEMANTIEK.json meet, en dit
   huis heeft er al 80. Naar buiten heette hij toch al zo. */
const ANNULEERGRONDEN = [
  { id: 'betaling-mislukt', label: 'Betaling ketste af', wat: 'De bon was geschreven, de betaling kwam niet rond.' },
  { id: 'vergissing', label: 'Vergissing aan de kassa', wat: 'Verkeerd artikel, verkeerd aantal, dubbel aangeslagen.' },
  { id: 'klant-zag-af', label: 'Klant zag ervan af', wat: 'De klant heeft de aankoop bij de kassa teruggedraaid.' },
  { id: 'retour', label: 'Retour van de klant', wat: 'De klant bracht het terug; het geld gaat langs RTG Pay.' }
];
const OP_ID = new Map(ANNULEERGRONDEN.map(g => [g.id, g]));

module.exports = (ctx) => {
  const { db, save, id, nu, rond, schoon, isRetail, variantVan, sseToSupplier, sseToOffice } = ctx;

  const bonnen = (code) => (db.data.posSales[code] = db.data.posSales[code] || []);

  /* De tegenboeking. `sale` mag een id zijn of de bon zelf -- de kassaroute
     heeft hem al in de hand na een mislukte betaling, en dan is hem opnieuw
     opzoeken een tweede manier om hetzelfde te vinden. */
  function annuleerVerkoop(s, saleOfId, opt) {
    if (!isRetail(s)) return { status: 400, error: 'Deze zaak is geen retail.' };
    const o = opt || {};
    const grond = OP_ID.get(schoon(o.grond, 30));
    if (!grond) return { status: 400, error: 'Kies een grond: ' + ANNULEERGRONDEN.map(g => g.id).join(', ') + '.' };

    const lijst = bonnen(s.code);
    const bon = (saleOfId && typeof saleOfId === 'object')
      ? lijst.find(x => x.id === saleOfId.id)
      : lijst.find(x => x.id === schoon(saleOfId, 40));
    if (!bon) return { status: 404, error: 'Deze kassabon bestaat niet (meer).' };

    /* Twee dingen die niet mogen, en allebei omdat ze de telling scheeftrekken:
       een bon twee keer terugdraaien haalt de voorraad twee keer terug, en een
       TEGENBOEKING terugdraaien zou een tegen-tegenboeking zijn. */
    if (bon.geannuleerd) return { status: 409, error: 'Deze bon is al teruggedraaid op ' + bon.geannuleerd.at + '.' };
    if (bon.soort === 'annulering') return { status: 409, error: 'Dit is zelf een tegenboeking; die draait u niet terug.' };

    // de voorraad terug, per variant die we nog kennen
    const terug = [];
    for (const it of bon.items || []) {
      const hit = it.vsku ? variantVan(s, it.vsku) : null;
      if (hit) { hit.variant.voorraad += (it.qty || 1); terug.push({ vsku: it.vsku, aantal: it.qty || 1 }); }
    }

    const at = nu();
    bon.geannuleerd = { at, door: schoon(o.door, 60) || 'Team', grond: grond.id,
      toelichting: schoon(o.toelichting, 300) || '' };

    /* DE SPIEGEL. Zelfde vorm als de bon (kern/retail/vloer.js maakt hem), met
       een min voor het bedrag en voor elk aantal. `soort` en `vanBon` maken hem
       herkenbaar; wie alleen `total` optelt, hoeft ze niet te kennen. */
    const tegen = {
      id: id(), soort: 'annulering', vanBon: bon.id, grond: grond.id,
      method: bon.method, total: rond(-(bon.total || 0)),
      items: (bon.items || []).map(it => ({ vsku: it.vsku, name: it.name,
        qty: -(it.qty || 1), price: it.price })),
      actor: schoon(o.door, 60) || 'Team', at, room: bon.room || null, retail: true
    };
    lijst.unshift(tegen);
    db.data.posSales[s.code] = lijst.slice(0, 20000);
    save();
    if (sseToSupplier) sseToSupplier(s.code, 'sync', { scope: 'retail' });
    if (sseToOffice) sseToOffice('sync', { scope: 'orders' });
    return { ok: true, bon, tegenboeking: tegen, voorraadTerug: terug };
  }

  /* De oude naam blijft bestaan en doet nu hetzelfde als de rest: de route
     roept hem aan als RTG Pay na de verkoop alsnog afketst. Een tweede
     mechanisme voor dat ene geval zou een tweede waarheid zijn over de vraag of
     die omzet echt is. */
  const verkoopTerug = (s, sale, door) =>
    annuleerVerkoop(s, sale, { grond: 'betaling-mislukt', door: door || 'Kassa',
      toelichting: 'De betaling kwam niet rond; de bon is direct teruggedraaid.' });

  /* Wat er van een bon te zien is: de bon zelf, of hij is teruggedraaid, en
     door welke tegenboeking. Zodat een scherm het kan tonen in plaats van twee
     losse regels waarvan er een negatief is. */
  function bonBeeld(s, saleId) {
    const lijst = bonnen(s.code);
    const bon = lijst.find(x => x.id === schoon(saleId, 40));
    if (!bon) return null;
    return {
      id: bon.id, at: bon.at, total: bon.total, items: bon.items || [], method: bon.method,
      soort: bon.soort || 'verkoop', vanBon: bon.vanBon || null,
      geannuleerd: bon.geannuleerd || null,
      tegenboeking: (lijst.find(x => x.vanBon === bon.id) || {}).id || null
    };
  }

  return { annuleerVerkoop, verkoopTerug, bonBeeld, GRONDEN: ANNULEERGRONDEN };
};
