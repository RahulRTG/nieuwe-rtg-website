/* Het gedachtenboek: een plek om iets op te schrijven, voor uzelf.

   WAT DIT NIET IS: materiaal. Er leest geen model mee, er wordt niets
   samengevat, er komt geen stemmingsgrafiek uit en er verschijnt nergens een
   "inzicht" dat op uw eigen woorden is gebaseerd. Een dagboek dat geanalyseerd
   wordt, is geen dagboek. Dat is hier geen belofte in een tekstje maar de bouw:
   er is geen enkele route die deze tekst ergens anders heen stuurt, en de
   AI-poort ziet hem nooit.

   DE CRISISREGEL BEWAART HIER WEL, EN DAT IS HET OMGEKEERDE VAN DE CHECK-IN.
   In kern/gemoed.js wordt bij een crisiszin niets bewaard: dat is een gesprek
   waarin RTG antwoordt, en RTG hoort niet over die grens heen te antwoorden.
   Hier antwoordt RTG helemaal niet. Iemand die op zijn zwaarste moment iets
   opschrijft en zijn woorden ziet verdwijnen, wordt gestraft voor eerlijkheid --
   en raakt kwijt wat hij net moest opschrijven. Dus: de notitie wordt gewoon
   bewaard, en de weg naar echte hulp komt ERNAAST te staan.

   VERSLEUTELING KOMT VAN BENEDEN. De hele database gaat door server/kluis.js
   heen zodra RTG_ENC_KEY gezet is; dit bestand doet daar niets bovenop. Een
   tweede eigen slot zou een tweede sleutelbeheer betekenen (LAT.md regel 4). */

const { niveauVan } = require('./zorgniveau');

const MAX_TEKST = 4000;
const MAX_TERUG = 60;
const dagVan = d => new Date(d).toISOString().slice(0, 10);

module.exports = ({ db, save, schoon, crypto }) => {
  const lijst = () => {
    if (!db.data.gedachten) db.data.gedachten = [];
    return db.data.gedachten;
  };
  const mijne = key => lijst().filter(g => g.key === key);
  const toon = g => ({ id: g.id, op: g.op, at: g.at, tekst: g.tekst });

  function gedachtenVan(key) {
    const alles = mijne(key).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
    return {
      ok: true,
      notities: alles.slice(0, MAX_TERUG).map(toon),
      /* Eerlijk over wat er NIET meekomt: een lijst die stilletjes afkapt, leest
         als een lijst die compleet is. */
      meer: alles.length > MAX_TERUG ? alles.length - MAX_TERUG : 0,
      uitleg: 'Dit is van u. Er leest geen model mee, er wordt niets samengevat en '
        + 'er gaat niets naar een partner, een zaak of een coach.',
      elders: 'Wat u bij een dagcheck-in schrijft, hoort bij die check-in en staat daar, niet hier.'
    };
  }

  function gedachteZet(key, body) {
    const tekst = schoon(body.tekst, MAX_TEKST);
    if (!tekst) return { status: 400, error: 'Er staat nog niets in.' };

    const g = {
      id: crypto.randomBytes(6).toString('hex'), key, tekst,
      op: dagVan(new Date()), at: new Date().toISOString()
    };
    lijst().push(g);
    save();

    /* De grens loopt mee, maar hij houdt niets tegen. Slaat de crisisregel aan,
       dan staat de weg naar hulp NAAST wat er net is opgeschreven -- niet in
       plaats daarvan. */
    const grens = niveauVan(tekst);
    const uit = gedachtenVan(key);
    if (grens.reden === 'crisis') {
      uit.hulp = grens.escalatie;
      uit.hulpUitleg = 'Uw notitie is bewaard. RTG leest hem niet en beoordeelt hem niet; '
        + 'wat hieronder staat verschijnt omdat er woorden in staan die te zwaar zijn voor een app.';
    }
    return uit;
  }

  function gedachteWeg(key, id) {
    const rijen = lijst();
    const i = rijen.findIndex(g => g.id === String(id) && g.key === key);
    /* Ook als het id bestaat maar van iemand anders is: dan is het antwoord
       hetzelfde 404, want "bestaat wel maar niet van u" is ook een antwoord. */
    if (i < 0) return { status: 404, error: 'Die notitie staat niet in uw boek.' };
    rijen.splice(i, 1);
    save();
    return gedachtenVan(key);
  }

  return { gedachtenVan, gedachteZet, gedachteWeg };
};

module.exports.MAX_TEKST = MAX_TEKST;
module.exports.MAX_TERUG = MAX_TERUG;
