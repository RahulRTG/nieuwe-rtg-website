/* DE VORM VAN EEN REIS (hoort bij kern/reizen.js).

   Wat een Reis IS als hij af is: zijn naam, zijn venster, wie er meegaan, welke
   apps eraan meedoen, hoe hij ervoor staat -- en waarom deze onderdelen bij
   elkaar horen. De VERDELING (welke regel bij welke reis hoort) staat in
   reizen.js; dit is wat er uit die verdeling tevoorschijn komt.

   Hier wordt niets geoordeeld wat elders al geoordeeld is: de betekenis van een
   status woont in kern/reiswereld.js en de rangorde van de signalen in
   kern/wereldkern.js. Deze module kiest alleen welke van de bestaande het
   luidst is. */
'use strict';

const { RANG } = require('./wereldkern');

/* De herkomst van een onderdeel: waar het systeem het vandaan heeft. Zes
   waarden (REIZEN.md par. 2.2), plus een zevende die er met de reisuitnodiging
   bij kwam: `gedeeld` -- een reisgenoot heeft dit met u gedeeld. Dat is een
   echte, eigen bron en geen variant van `handmatig`: u heeft dat hotel niet
   geboekt en dat document niet, en dat verschil hoort te blijven staan.
   `extern` is nog niet bereikbaar; dat komt met de partnerkant. Ze staan er nu
   al in omdat dit het woordenboek is en niet de voorraad.

   Een onderdeel ZONDER geldige herkomst wordt niet geplaatst. Dat is geen
   pietluttigheid: op herkomst hangt straks wat er met een onderdeel mag
   gebeuren -- een ingelezen hotelbevestiging is geen verkochte boeking. Een
   onbekende waarde stil als `rtg` behandelen zou dat verschil weggummen. */
const HERKOMSTEN = ['rtg', 'partner', 'extern', 'document', 'beeld', 'handmatig', 'gedeeld'];

/* Bestemmingen vergelijken. "Ibiza (uit Geneve)" en "Ibiza" zijn dezelfde
   plaats; "Dubai" en "Dubai Marina" ook. "Rome" en "Romeinse Riviera" NIET --
   vandaar hele woorden en geen letterlijke bevatting, want dat laatste voegt
   plaatsen samen die alleen op hun eerste letters lijken. */
function woorden(s) {
  return String(s || '').toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .split(/[^a-z0-9à-ÿ]+/).filter(Boolean);
}
function zelfdePlaats(a, b) {
  const x = woorden(a), y = woorden(b);
  if (!x.length || !y.length) return false;
  const klein = x.length <= y.length ? x : y, groot = klein === x ? y : x;
  return klein.every(w => groot.includes(w));
}

/* Het zwaarste signaal van de onderdelen wordt het signaal van de Reis. Niet
   zelf een oordeel verzinnen: de betekenis van een status woont in
   reiswereld.js, en de rangorde in wereldkern.js. Hier wordt alleen gekozen
   welke van de bestaande het luidst is. */
function zwaarste(onderdelen) {
  let uit = '';
  for (const o of onderdelen) {
    const rang = RANG[o.sig || ''];
    if (rang !== undefined && rang < RANG[uit]) uit = o.sig || '';
  }
  return uit;
}

function afmaken(reis) {
  const o = reis.onderdelen;
  const personen = o.map(x => Number(x.personen)).filter(n => n > 0);
  return {
    /* Een stabiele naam voor deze reis: dezelfde reis heet bij elke aanroep
       hetzelfde, zodat een scherm hem kan onthouden. Uit de gegevens zelf --
       geen teller en geen toeval, want die zouden bij elke aanroep wisselen. */
    id: 'R-' + woorden(reis.bestemming).join('-') + '-' + reis.venster.van,
    bestemming: reis.bestemming,
    venster: reis.venster,
    /* Het aantal reizigers alleen waar een domein het ECHT weet (het
       reisbureau kent het, een verblijf en een vlucht niet). Hier een 1
       neerzetten zou een getal verzinnen dat er nooit stond. */
    personen: personen.length ? Math.max(...personen) : null,
    onderdelen: o,
    apps: [...new Set(o.map(x => x.app).filter(Boolean))],
    herkomsten: [...new Set(o.map(x => x.herkomst))],
    sig: zwaarste(o),
    telling: {
      onderdelen: o.length,
      aandacht: o.filter(x => x.sig === 'aandacht' || x.sig === 'incident').length,
      wachtend: o.filter(x => !!x.wacht).length,
      onbekend: o.filter(x => !x.sig).length
    },
    /* Waarom deze onderdelen bij elkaar horen. Een groepering die zichzelf
       niet kan uitleggen, is niet na te rekenen door wie hem wantrouwt -- en
       dat is precies de gebruiker die gelijk heeft. */
    grond: o.length === 1
      ? 'Eén onderdeel; er is niets om mee samen te voegen.'
      : o.length + ' onderdelen met dezelfde bestemming (' + reis.bestemming +
        ') binnen ' + reis.venster.van + ' t/m ' + reis.venster.tot + '.'
  };
}

module.exports = { HERKOMSTEN, woorden, zelfdePlaats, zwaarste, afmaken };
