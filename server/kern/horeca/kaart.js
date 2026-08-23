/* Horeca (kern): DE KAART VAN EEN ZAAK -- één opbouw, meerdere deuren.

   WAAROM DIT VERHUISD IS. Deze functie stond in routes/gast/tafel.js en werd
   aan de kern gehangen (`kern.gastKaartVanZaak`). Dat werkte zolang alleen de
   GAST hem las. Zodra de bediening op de PDA dezelfde kaart nodig had -- tikken
   in plaats van naam en prijs typen -- bleek hij aan de verkeerde kant van de
   domeingrens te staan: het supplier-domein mag niet in een naam van het
   gast-domein grijpen, en terecht.

   Twee uitwegen, en de tweede is de goede. Je kunt de naam in GRENZEN.json
   toestaan, of je erkent dat de kaart van een zaak helemaal geen gastbegrip is.
   Het is een eigenschap van de ZAAK, en de gastdeur en de bedieningsdeur zijn
   allebei lezers. Dus staat hij hier (LAT-regel 4: één rekensom, één plek).

   WAT ERIN ZIT, EN WAAROM ELK VELD:

   - `alcohol` volgt uit de categorie, een vlaggetje of de naam. De leeftijdsregel
     in kern/gast/beleid.js hangt eraan, dus raden mag hier niet stil gebeuren --
     wie het raadt, doet het hier, één keer, zichtbaar.
   - `uitverkocht` komt uit de zaakinstelling. Hij wordt hier NIET weggefilterd:
     de gastdeur laat zulke items niet kiezen, de bediening hoort te kunnen zien
     dat iets op is. Wegfilteren zou van "op" een geheim maken.
   - `twin` is de gepubliceerde chefversie, als die er is. Een concept hoort er
     niet in: dat is nog niemands waarheid. */
'use strict';

const ALCOHOL = /wijn|bier|cava|cocktail|gin|whisk|rum|vodka|borrel/i;

module.exports = ({ findSupplier, horeca }) => {
  function kaartVanZaak(zaakcode) {
    const s = findSupplier(zaakcode);
    const menu = (s && Array.isArray(s.menu)) ? s.menu : [];
    const h = horeca.H(zaakcode);
    const uit = (h.instel && h.instel.uitverkocht) || {};
    const twins = h.dishTwins || {};
    return menu.map((m) => ({
      id: m.id, naam: m.name, uitleg: m.desc || null, cat: m.cat || 'Overig',
      foto: m.foto || m.photo || m.image || null,
      centen: Math.round(Number(m.price) * 100), allergenen: Array.isArray(m.allergens) ? m.allergens : [],
      station: m.station || null,
      alcohol: !!m.alcohol || ALCOHOL.test(String(m.name || '')),
      uitverkocht: !!uit[m.id], sindsWanneerUit: uit[m.id] ? uit[m.id].at : null,
      twin: twins[m.id] && twins[m.id].publicatie ? { versie: twins[m.id].publicatie.versie,
        presentatie: twins[m.id].publicatie.presentatie || null, service: twins[m.id].publicatie.service || null,
        pairing: twins[m.id].publicatie.pairing || null } : null
    }));
  }

  // hetzelfde, per categorie -- de vorm waarin een scherm hem tekent
  function kaartPerGroep(zaakcode) {
    const groepen = [];
    for (const item of kaartVanZaak(zaakcode)) {
      const cat = item.cat || 'Overig';
      let g = groepen.find((x) => x.cat === cat);
      if (!g) { g = { cat, items: [] }; groepen.push(g); }
      g.items.push(item);
    }
    return groepen;
  }

  return { kaartVanZaak, kaartPerGroep };
};
