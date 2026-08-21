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
const klok = require('../../lib/klok');
const { maandCentenUit } = require('../pasprijs');
const btw = require('../commercie/btw');

const PASNAAM = { rtg: 'RTG Pass', lifestyle: 'Lifestyle Pass', business: 'Business Pass' };

/* WELKE MAAND ER OP DE BIJDRAGEFACTUUR STAAT.

   Hier stond letterlijk ' · juli 2026' -- de maand van de demo-seed, geplakt op
   de factuur van iedereen, voor altijd. Een lid dat zich in maart aanmeldde las
   dus "Maandbijdrage RTG Pass · juli 2026". De factuur draagt zijn eigen maand
   nu mee (eersteBijdrageFactuur hieronder, veld `maand`, vorm JJJJ-MM); staat
   die er niet op (oude of geseede facturen), dan blijft de maand weg in plaats
   van dat we er een verzinnen. */
const MAAND_NL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const MAAND_EN = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
function maandNaam(maand, lang) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(maand || ''));
  if (!m) return '';
  const i = Number(m[2]) - 1;
  if (i < 0 || i > 11) return '';
  return (lang === 'en' ? MAAND_EN : MAAND_NL)[i] + ' ' + m[1];
}

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
                (maandNaam(inv.maand, lang) ? ' · ' + maandNaam(inv.maand, lang) : ''),
          // alleen invullen als er echt een prijs IS; anders het bedrag laten staan
          /* Het btw-tarief kwam hier als `* 1.21` binnen. Nu uit het
             btw-profiel (../commercie/btw.js); zonder profiel is dat NL 21%,
             hetzelfde antwoord als vroeger maar niet langer het enige mogelijke. */
          ...(bijdrageCenten == null ? {} : { netto: 0,
            bijdrage: btw.overNetto(bijdrageCenten, md.btwProfiel).brutoCenten / 100 })
        };
      }
      return {
        ...inv, desc: contrib ? inv.desc : i18n.localize(inv.desc, lang), date: i18n.localize(inv.date, lang),
        afboekcode: contrib ? '4560' : '4510',
        afboeklabel: lang === 'en'
          ? (contrib ? 'subscriptions and memberships' : 'travel and lodging expenses')
          : (contrib ? 'contributies en abonnementen' : 'reis- en verblijfkosten'),
        btw: btw.overBruto(Math.round((inv.bijdrage || 0) * 100), md.btwProfiel).btwCenten / 100
      };
    });
  }

  /* DE EERSTE MAANDBIJDRAGE VAN EEN NIEUW LID MET EEN PAS.

     Dat een nieuw lid iets te betalen had, kwam tot nu toe uit de DEMO-seed:
     memberTemplate kopieerde "Maandbijdrage lidmaatschap juli 2026" (nummer
     RTG-2026-0207) naar elk vers account. De datum klopte niet, het nummer was
     van iemand anders, en het bedrag stond in de seed.

     De verplichting zelf is wel echt -- bij een pas hoort een bijdrage -- dus
     die blijft, maar als een factuur VAN DIT LID: een eigen nummer, de maand
     waarin hij lid werd, en de prijs uit dezelfde bron als hierboven. De gratis
     gast-laag heeft geen pas en dus geen bijdrage: die krijgt niets. */
  /* De maandbijdrage inclusief btw, in euro's; null (op maat) wordt 0.

     HIER STOND NOG `* 1.21`, EN DAT WAS DE HELFT VAN EEN REPARATIE. Toen het
     tarief uit ../commercie/btw.js ging komen, is facturenVoor() hierboven
     omgezet en deze niet -- terwijl dit de plek is waar de factuur wordt
     GEMAAKT. Twee rekensommen voor hetzelfde bedrag lopen uit elkaar zodra er
     een tweede profiel bijkomt, en dan toont het scherm iets anders dan er in
     de factuur staat: precies de fout die de kop van dit bestand beschrijft.

     Zonder profiel geeft btw.js NL 21% -- hetzelfde antwoord als vroeger, maar
     niet langer het enige mogelijke. Het profiel hoort bij het lid en niet bij
     de trede, dus wie er een heeft geeft hem mee. */
  function centenNaarBijdrage(tier, btwProfiel) {
    const centen = maandCentenUit(deps.geldPasprijzen, tier);
    return centen == null ? 0 : btw.overNetto(centen, btwProfiel).brutoCenten / 100;
  }

  function eersteBijdrageFactuur(tier, userId, opDatum) {
    if (!['rtg', 'lifestyle', 'business'].includes(tier)) return null;
    const d = opDatum ? new Date(opDatum) : klok.datum();
    if (isNaN(d.getTime())) return null;
    const m2 = String(d.getMonth() + 1).padStart(2, '0');
    const verval = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return {
      id: 'RTG-' + d.getFullYear() + '-' + m2 + '-' + String(userId || 0).padStart(4, '0'),
      desc: 'Maandbijdrage lidmaatschap',
      maand: d.getFullYear() + '-' + m2,
      /* HET BEDRAG STAAT ER OOK ECHT OP.

         ./lid/facturen.js vult de prijs bij het TONEN in (uit de boardroom), en
         daarmee zou het scherm kloppen terwijl de opgeslagen factuur op nul
         stond -- en de betaalwegen lezen de opgeslagen factuur. Betalen zou dan
         afketsen op "op deze factuur staat niets meer open". Dus: bij het maken
         dezelfde bron (kern/pasprijs.js) en dezelfde btw-rekensom. Is er geen
         prijs (Business is op maat), dan blijft het bedrag 0 en spreekt RTG het
         met het lid af -- er wordt hier niets verzonnen. */
      netto: 0, bijdrage: centenNaarBijdrage(tier), status: 'open',
      date: 'Vervalt 1 ' + MAAND_NL[verval.getMonth()] + ' ' + verval.getFullYear()
    };
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

  return { facturenVoor, reisVoor, eersteBijdrageFactuur };
}

module.exports = maakFacturen;
module.exports.PASNAAM = PASNAAM;
