/* DE FEITEN IN EEN RTG ZEGEL -- wat RTG over een lid wil ondertekenen.

   De route (/api/zegel/maak in server.js) tekent; deze module bepaalt WAT er
   getekend mag worden. Ze staat los omdat server.js al over de grens van
   keuringsregel 13 zit (daar mag gerepareerd worden, niet uitgebreid), en
   omdat een regel die bepaalt wat RTG naar buiten garandeert vindbaar hoort te
   zijn onder een naam.

   EEN LEEFTIJD IN HET ZEGEL IS EEN GEZIENE LEEFTIJD. Hier stond eerst
   `leeftijdVan(geborenVan(sess))`: elke geboortedatum, ook een zelf ingetypte
   en ook die van een demo-persona zonder account. De handtekening klopte dan,
   de bewering eronder niet -- en de partner las dat RTG garant stond. Nu alleen
   met account, A3 en een datum van het document (./betrouwbaarheid.js
   `leeftijdGezien`, dezelfde regel als het jeugdbestuur). Is hij niet gezien,
   dan gaat de claim er niet in en hoort het lid waarom (`nietBewezen`); de
   partner ziet een ontbrekende claim, nooit een verzonnen.

   ALLEEN WAT GEVRAAGD IS EN WAAR IS gaat mee (selectieve onthulling); een feit
   dat onwaar is, valt weg zonder reden, een feit dat niet vast te stellen is,
   valt weg MET reden. Dat verschil ziet alleen het lid. */
'use strict';

const { maakLidstand, leeftijdGezien, waaromLeeftijdNietGezien } = require('./betrouwbaarheid');

function maakZegelfeiten({ accounts }) {
  const lidstand = maakLidstand({ accounts });
  return function zegelfeiten(sess, gevraagd) {
    const st = lidstand(sess.key);
    const lft = leeftijdGezien(st) ? st.leeftijd : null;
    const nietBewezen = {};
    for (const k of ['leeftijd18', 'leeftijd21']) {
      if (gevraagd.includes(k) && lft == null) nietBewezen[k] = waaromLeeftijdNietGezien(st);
    }
    const feiten = {
      lid: true,
      leeftijd18: lft != null && lft >= 18,
      leeftijd21: lft != null && lft >= 21,
      pas: sess.tier || (sess.account && sess.account.tier) || null,
      zakelijk: sess.tier === 'business'
    };
    const claims = {};
    for (const k of gevraagd) if (Object.prototype.hasOwnProperty.call(feiten, k) && feiten[k]) claims[k] = feiten[k];
    return { claims, nietBewezen };
  };
}

module.exports = { maakZegelfeiten };
