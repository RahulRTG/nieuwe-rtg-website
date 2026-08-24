/* ============================================================================
   DE KAPPEN: welke collecties een bovengrens hebben, en wie hem toepast.

   WAAROM DIT EEN EIGEN MODULE IS. Het afkappen stond in de schrijfroutes zelf:
   in kern/clips.js een `slice(-200)` middenin meld(), in kern/sociaal/snaps.js
   twee stuks middenin snapSturen() en verhaalPlaatsen(). Dat werkt -- in rust
   haalt zo'n kap een rij per verzoek weg -- maar het is de verkeerde plek, en
   dat werd zichtbaar zodra server/opzet/begroting.js er een grens op wilde
   zetten.

   HET GEVAL DAT HET AANWIJST. Staat een collectie ooit ver boven zijn kap -- na
   een import, na een herstel, of omdat iemand het getal verlaagt -- dan wil de
   kap er in EEN keer honderden of duizenden weghalen. Een begroting die dat
   weigert, maakt daar geen weigering van maar een storing die zichzelf in stand
   houdt: de collectie blijft te groot, dus het volgende verzoek loopt tegen
   precies dezelfde weigering aan. KRIMP.json noemt dat per collectie ("kap"),
   en het is de reden dat drie van de negentien gemeten collecties niet
   gehandhaafd konden worden.

   DE OPLOSSING IS EEN VERHUIZING EN GEEN UITZONDERING. Afkappen is HUISHOUDEN:
   het is niet wat een lid doet, het is wat het huis doet omdat een lid iets
   deed. Dus draait het in de onderhoudsronde (server/opzet/onderhoud.js), elke
   vijf minuten, buiten elk verzoek -- en daar vindt de begroting per ontwerp
   niets van ("buiten een verzoek gebeurt er niets"). Geen escape-luik in de
   begroting, geen tweede rechtenmodel: de handeling verhuist naar waar hij
   hoort.

   WAT DAT KOST, en dat hoort erbij: tussen twee ronden kan een collectie boven
   zijn kap uitkomen. Vijf minuten snaps op een drukke dag is een handvol rijen
   -- de kap is een geheugengrens, geen bewaartermijn. De bewaartermijnen staan
   ergens anders en zijn strenger: kern/sociaal/snaps.js gooit een snap na 24 uur
   weg en een bekeken snap meteen, en server/bewaarveger.js draagt de wisregels
   die de eigenaar heeft vastgesteld. Deze module gaat alleen over "hoe lang mag
   de lijst worden".

   WAT ER NIET IN STAAT. Dit zijn de drie kappen die in KRIMP.json opdoken, niet
   alle kappen van dit huis -- een scan telt er ruim zestig. De rest staat nog in
   zijn eigen schrijfpad. Ze horen hier stuk voor stuk bij te komen zodra iemand
   er een grens op wil, en niet in een grote verhuizing ineens: elke kap draagt
   zijn eigen opruimwerk (een snap heeft een bestand op schijf, een melding
   niet), en dat is geen zoek-vervang.
   ========================================================================== */
'use strict';

/* De kappen, met per stuk wat er bij een weggeknipte rij nog moet gebeuren.
   `wis` is optioneel: een melding is alleen een rij, een snap heeft ook een
   bestand in de mediastore. */
/* DE LIJST STAAT OP MODULEHOOGTE, en dat is niet voor de netheid.
   scripts/krimpronde.js zet per collectie in KRIMP.json of er een kap op zit --
   en dat is de vraag die bepaalt of er een grens op mag. Zolang de kappen in de
   schrijfroutes stonden, vond hij ze met een scan op `db.data.X = ...slice(`.
   Hier staat `db.data[k.collectie]`, met de naam in een variabele: onvindbaar
   voor die scan. Dus leest de ronde deze lijst, en blijft de scan ernaast staan
   voor de kappen die nog WEL in een schrijfroute zitten. Die twee zijn niet
   hetzelfde en horen ook niet hetzelfde te heten: een kap in het onderhoud is
   ongevaarlijk, een kap in het verzoek is precies het geval waarop een grens
   zichzelf vastdraait. */
const KAPPEN = [
  { collectie: 'clipsMeldingen', houd: 200 },
  { collectie: 'snaps', houd: 2000, foto: true },
  { collectie: 'stories', houd: 1000, foto: true }
];

function maakKappen({ db, save, media, log }) {
  const wisFoto = (item) => {
    if (item && item.foto && media && typeof media.verwijder === 'function') {
      try { media.verwijder(item.foto); } catch (e) { /* bestand al weg: prima */ }
    }
  };
  const lijst = KAPPEN.map(k => Object.assign({}, k, { wis: k.foto ? wisFoto : null }));

  /* EEN kap toepassen. Geeft terug hoeveel rijen eraf gingen, zodat de ronde
     het kan melden -- een veger die stil zijn werk doet, is een veger waarvan
     niemand merkt dat hij stilstaat (LAT.md regel 5). */
  function kap(k) {
    const lijst = db.data && db.data[k.collectie];
    if (!Array.isArray(lijst)) return 0;
    const over = lijst.length - k.houd;
    if (over <= 0) return 0;
    const weg = lijst.slice(0, over);
    if (k.wis) for (const rij of weg) k.wis(rij);
    db.data[k.collectie] = lijst.slice(-k.houd);
    return over;
  }

  /* De hele ronde. Een kap die omvalt mag de andere twee niet meenemen: dit is
     onderhoud, en onderhoud dat het proces raakt is erger dan onderhoud dat een
     ronde overslaat. */
  function ronde() {
    const uit = {};
    let totaal = 0;
    for (const k of lijst) {
      try {
        const n = kap(k);
        if (n) { uit[k.collectie] = n; totaal += n; }
      } catch (e) {
        if (log && log.warn) log.warn('[kappen] ' + k.collectie + ': ' + e.message);
      }
    }
    if (totaal) {
      save();
      if (log && log.info) log.info('kappen: ingekort', { rijen: totaal, waar: Object.keys(uit).join(' ') });
    }
    return { totaal, per: uit };
  }

  return { ronde, kap, KAPPEN: lijst };
}

module.exports = { maakKappen, KAPPEN };
