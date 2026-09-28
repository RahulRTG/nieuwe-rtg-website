/* VRIJHEID: RUST EN HERSTEL -- uit het rooster, nooit uit de mens.

   RTG mag zeggen: "volgens het rooster is onvoldoende herstelruimte gepland".
   RTG zegt nooit: "wij denken dat u een burn-out krijgt". Deze module leest
   daarom alleen diensten -- geen klokgedrag per minuut, geen verzuimsoort,
   geen gezondheid. Een signaal gaat over een ROOSTER en draagt het feit
   waarop het rust.

   De rustregel is dezelfde vorm als kern/beveiliging/rooster/rust.js (echte
   tijden, over de datumgrens), maar het aantal uren komt uit het BELEID en
   niet uit een constante: een cao kan meer rust geven dan de wet, en dan wint
   het hogere recht (beleid.js). Zonder vastgestelde waarde: UNKNOWN. */
'use strict';
const T = require('./tijd');

function dienstenVan(team, persoon) {
  return (team.diensten || []).filter(d => d.persoon === persoon).map(d => ({ d, iv: T.interval(d) })).filter(x => x.iv);
}

/* Botst een (nieuwe of geruilde) dienst met de rust rond de andere diensten? */
function rustToets(team, persoon, nieuw, beleid, zonder) {
  const regel = beleid.waarde('rust.minUurTussenDiensten');
  if (regel.open) return { stand: 'UNKNOWN', uitleg: regel.reden };
  const iv = T.interval(nieuw);
  if (!iv) return { stand: 'UNKNOWN', uitleg: 'De dienst heeft geen geldige tijden.' };
  for (const { d, iv: oud } of dienstenVan(team, persoon)) {
    if (zonder && zonder(d)) continue;
    const tussen = iv.van >= oud.tot ? iv.van - oud.tot : oud.van >= iv.tot ? oud.van - iv.tot : -1;
    if (tussen < regel.waarde * 60)
      return { stand: 'REST_RISK', uitleg: 'Tussen de dienst van ' + d.datum + ' en deze dienst zit minder dan ' + regel.waarde + ' uur rust.' };
  }
  return { stand: 'SAFE', uitleg: 'De rust tussen de diensten blijft minstens ' + regel.waarde + ' uur.' };
}

/* Herstelsignaal over de veertien dagen tot en met `datum`. Twee drempels uit
   beleid; is er geen, dan zegt het signaal dat hij niet kijkt. */
function herstelSignaal(team, persoon, datum, beleid) {
  const maxUren = beleid.waarde('herstel.maxUren14Dagen');
  const maxDagen = beleid.waarde('herstel.maxDagenAchterElkaar');
  if (maxUren.open && maxDagen.open) return { stand: 'NIET_GEMETEN', uitleg: 'Er is geen herstelbeleid vastgesteld; deze wachter kijkt niet.' };
  const eind = T.dagIndex(datum); const begin = eind - 13;
  const lijst = dienstenVan(team, persoon).filter(x => { const i = T.dagIndex(x.d.datum); return i >= begin && i <= eind; });
  const totaal = lijst.reduce((s, x) => s + T.uren(x.iv), 0);
  const dagen = new Set(lijst.map(x => T.dagIndex(x.d.datum)));
  let reeks = 0; let langste = 0;
  for (let i = begin; i <= eind; i++) { reeks = dagen.has(i) ? reeks + 1 : 0; langste = Math.max(langste, reeks); }
  const feiten = [];
  if (!maxUren.open && totaal > maxUren.waarde) feiten.push(totaal + ' geplande uren in veertien dagen (grens ' + maxUren.waarde + ')');
  if (!maxDagen.open && langste > maxDagen.waarde) feiten.push(langste + ' dagen achter elkaar ingepland (grens ' + maxDagen.waarde + ')');
  if (!feiten.length) return { stand: 'SAFE', uitleg: 'Volgens het rooster is er voldoende herstelruimte gepland.', uren: totaal, reeks: langste };
  return { stand: 'REST_RISK', uitleg: 'Volgens het rooster is onvoldoende herstelruimte gepland: ' + feiten.join('; ') + '.', uren: totaal, reeks: langste };
}

module.exports = { rustToets, herstelSignaal };
