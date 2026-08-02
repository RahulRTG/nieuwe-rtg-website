/* De facturen en de reis van een lid, klaargemaakt voor het scherm: bedragen,
   afboekcodes, btw en alles vertaald naar de taal van het toestel.

   Afgesplitst van ../lid.js omdat dat bestand tegen de omvangsmeter aan liep en
   dit de natuurlijke naad was: stateFor bouwt de hele leden-app-state, en dit is
   het enige stuk daarin dat over geld gaat.

   WAAROM DE PRIJS HIER NIET STAAT. Hij stond er ooit wel: `{ rtg: 65,
   lifestyle: 20000, business: 7500 }`, hard in euro's, terwijl de eigenaar de
   pasprijs in de boardroom zet (kern/geldregie.js). Wie daar de prijs veranderde
   kreeg een lid te zien met de OUDE prijs op zijn factuur, terwijl het
   betaalschema van de aanmelding wel met de nieuwe rekende. Twee plekken, een
   waarheid, en de factuur trok aan het kortste eind.

   Erger nog was de Business Pass. Die is volgens de regie nadrukkelijk
   `opMaat: true` en heeft dus GEEN maandprijs; hier stond 7500, en dat werd
   7500 x 1,21 = 9.075 euro op de factuur van een lid -- een bedrag dat nergens
   is afgesproken. maandCentenUit geeft voor business null, en null is hier een
   antwoord: dan blijft staan wat er stond en verzinnen we niets. */
'use strict';
const { maandCentenUit } = require('../pasprijs');

const PASNAAM = { rtg: 'RTG Pass', lifestyle: 'Lifestyle Pass', business: 'Business Pass' };

/* `deps` komt binnen en niet `deps.geldPasprijzen`: die tabel wordt door
   server.js later ingevuld dan deze fabriek draait, dus we lezen hem pas op het
   moment dat er echt een factuur wordt gemaakt. */
function maakFacturen({ i18n, deps }) {
  function facturenVoor(md, tier, lang) {
    const bijdrageCenten = maandCentenUit(deps.geldPasprijzen, tier);
    return (md.invoices || []).map(inv => {
      const contrib = /lidmaatschap|jaarbijdrage|maandbijdrage/i.test(inv.desc);
      if (contrib && PASNAAM[tier]) {
        inv = {
          ...inv,
          desc: (lang === 'en' ? 'Monthly contribution ' : 'Maandbijdrage ') + PASNAAM[tier] +
                (bijdrageCenten == null ? (lang === 'en' ? ' (bespoke)' : ' (prijs op maat)') : '') +
                (lang === 'en' ? ' · July 2026' : ' · juli 2026'),
          // alleen invullen als er echt een prijs IS; anders het bedrag laten staan
          ...(bijdrageCenten == null ? {} : { netto: 0, bijdrage: Math.round(bijdrageCenten * 1.21) / 100 })
        };
      }
      return {
        ...inv, desc: contrib ? inv.desc : i18n.localize(inv.desc, lang), date: i18n.localize(inv.date, lang),
        afboekcode: contrib ? '4560' : '4510',
        afboeklabel: lang === 'en'
          ? (contrib ? 'subscriptions and memberships' : 'travel and lodging expenses')
          : (contrib ? 'contributies en abonnementen' : 'reis- en verblijfkosten'),
        btw: Math.round((inv.bijdrage - inv.bijdrage / 1.21) * 100) / 100
      };
    });
  }

  // De reis, met de losse programmaonderdelen vertaald. Geen reis: geen veld.
  function reisVoor(md, lang) {
    if (!md.trip) return null;
    return {
      ...md.trip,
      dates: i18n.localize(md.trip.dates, lang),
      items: (md.trip.items || []).map(it => ({
        ...it, when: i18n.localize(it.when, lang), title: i18n.localize(it.title, lang), sub: i18n.localize(it.sub, lang)
      }))
    };
  }

  return { facturenVoor, reisVoor };
}

module.exports = maakFacturen;
module.exports.PASNAAM = PASNAAM;
