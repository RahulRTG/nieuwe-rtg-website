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
      aan niemand. Steun aanbieden is niet hetzelfde als verklikken. */

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
  const schoon = (v, max) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, max);

  // het dagboek: de laatste veertien dagen, plus wat er vandaag al staat
  function dagboek(s) {
    const b = bak(s.p);
    const grens = new Date(Date.now() - 13 * 86400000);
    const van = grens.getFullYear() + '-' + String(grens.getMonth() + 1).padStart(2, '0') + '-' + String(grens.getDate()).padStart(2, '0');
    const recent = b.stemmingen.filter(x => x.dag >= van).sort((a, z) => a.dag.localeCompare(z.dag));
    return { ok: true, vandaag: vandaag(),
      dagVandaag: b.stemmingen.find(x => x.dag === vandaag()) || null,
      stemmingen: recent };
  }

  /* een gevoel voor vandaag: een dag heeft er hooguit een, en vandaag mag je
     herzien (een ochtend en een avond voelen anders). Gisteren blijft staan
     zoals het was -- een dagboek herschrijft zichzelf niet. */
  function stemming(s, { gevoel, notitie }) {
    const g = String(gevoel || '');
    if (!GEVOELENS.includes(g)) return fout(400, 'Kies een van de gezichtjes.');
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

  return { welzijn: { dagboek, stemming } };
};
