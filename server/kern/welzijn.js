/* De welzijnslaag (RTF): het gevoelsdagboek van een kind.

   Vier regels die hier heilig zijn:
   1. OPT-IN. De gevoelens-app belooft dat er niets wordt opgeslagen, en die
      belofte blijft staan: er komt hier alleen iets binnen als het kind ZELF
      op "bewaar in mijn dagboekje" tikt.
   2. PRIVE. Het dagboek is van het profiel zelf: geen ouder, geen broertje
      en geen oppas kan erin kijken -- ook niet "voor de zekerheid". Een kind
      dat weet dat niemand meeleest, durft eerlijk te zijn.
   3. EERLIJK. Een dag heeft een gevoel (een woord, geen cijfer of score):
      geen streaks, geen "7 dagen op rij!", geen druk. Vandaag mag je
      herzien; gisteren niet herschrijven, zo was het toen.
   4. HULP DICHTBIJ, GEEN ALARM. Bij zware dagen toont het SCHERM warme
      wegen naar hulp (steun, hulpwijzer, praten); de server meldt niets
      aan niemand. Steun aanbieden is niet hetzelfde als verklikken.

   En sinds 5 oktober 2026 een vijfde: TOESTEMMING APART, BIJ EERSTE GEBRUIK
   (DPIA-GEZIN.md, AVG art. 9). Een gevoel als "bang" of "verdrietig" kan een
   gegeven over de geestelijke gezondheid zijn, en daar is het tikken op
   "bewaar" geen grondslag voor. Wie 16 of ouder is geeft die toestemming zelf
   (toestemming()); voor een jonger kind geeft een ouder hem voor het gezin
   (foundation/gezondheidstoestemming.js). Toestemming geven is iets anders dan
   meelezen: de ouder ziet het dagboek daarna nog steeds niet. Intrekken wist
   het dagboek, want zonder grondslag hoort er niets te blijven staan. */

const { ouderGeeftToestemming } = require('../lib/leeftijd');

module.exports = ({ save }) => {

  const fout = (status, error) => ({ status, error });
  const MAX_DAGEN = 400;
  // een gevoel is een woord, geen score -- dezelfde zes als op het scherm
  const GEVOELENS = ['blij', 'rustig', 'moe', 'bang', 'verdrietig', 'boos'];

  function bak(p) {
    if (!p.welzijn) p.welzijn = { stemmingen: [] };
    if (!Array.isArray(p.welzijn.stemmingen)) p.welzijn.stemmingen = [];
    return p.welzijn;
  }
  function vandaag() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  const onder16 = ouderGeeftToestemming; // lib/leeftijd.js: onder 16 beslist de ouder
  function heeftToestemming(s) {
    if (onder16(s.p)) return !!(s.g && s.g.toestemmingGezondheid && s.g.toestemmingGezondheid.at);
    return !!(s.p.welzijn && s.p.welzijn.toestemming && s.p.welzijn.toestemming.at);
  }
  function geenToestemming(s) {
    const zelf = !onder16(s.p);
    return { status: 409, hoe: 'toestemming', zelf,
      error: zelf ? 'Je dagboekje bewaren vraagt eerst je aparte toestemming.'
        : 'Vraag je ouder om toestemming te geven, dan kun je je dagboekje bewaren.' };
  }
  const schoon = (v, max) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, max);

  // het dagboek: de laatste veertien dagen, plus wat er vandaag al staat
  function dagboek(s) {
    const b = bak(s.p);
    const grens = new Date(Date.now() - 13 * 86400000);
    const van = grens.getFullYear() + '-' + String(grens.getMonth() + 1).padStart(2, '0') + '-' + String(grens.getDate()).padStart(2, '0');
    const recent = b.stemmingen.filter(x => x.dag >= van).sort((a, z) => a.dag.localeCompare(z.dag));
    return { ok: true, vandaag: vandaag(), toestemming: heeftToestemming(s), zelfToestemming: !onder16(s.p),
      dagVandaag: b.stemmingen.find(x => x.dag === vandaag()) || null,
      stemmingen: recent };
  }

  /* een gevoel voor vandaag: een dag heeft er hooguit een, en vandaag mag je
     herzien (een ochtend en een avond voelen anders). Gisteren blijft staan
     zoals het was -- een dagboek herschrijft zichzelf niet. */
  function stemming(s, { gevoel, notitie }) {
    const g = String(gevoel || '');
    if (!GEVOELENS.includes(g)) return fout(400, 'Kies een van de gezichtjes.');
    if (!heeftToestemming(s)) return geenToestemming(s);
    const b = bak(s.p);
    const dag = vandaag();
    let x = b.stemmingen.find(e => e.dag === dag);
    if (x) { x.gevoel = g; x.notitie = schoon(notitie, 200); x.at = Date.now(); }
    else {
      x = { dag, gevoel: g, notitie: schoon(notitie, 200), at: Date.now() };
      b.stemmingen.push(x);
      // oud mag weg, maar pas ver voorbij het weekbeeld
      if (b.stemmingen.length > MAX_DAGEN) b.stemmingen = b.stemmingen.slice(-MAX_DAGEN);
    }
    save();
    return { ok: true, dag: x };
  }

  /* Zelf toestemming geven of intrekken, vanaf 16. Intrekken wist het
     dagboek: geen grondslag, geen gegevens. */
  function toestemming(s, { aan }) {
    if (onder16(s.p)) return fout(409, 'Voor wie jonger is dan 16 geeft een ouder toestemming, in de privacy-instellingen van het gezin.');
    if (aan === true) {
      const b = bak(s.p);
      if (!b.toestemming) b.toestemming = { at: Date.now() };
      save();
      return { ok: true, toestemming: true };
    }
    if (aan === false) {
      delete s.p.welzijn;
      save();
      return { ok: true, toestemming: false, gewist: true };
    }
    return fout(400, 'Zeg aan of uit.');
  }

  return { welzijn: { dagboek, stemming, toestemming } };
};
