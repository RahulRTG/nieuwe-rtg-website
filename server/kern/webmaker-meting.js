/* Cijfers over een website: voor de ondernemer, en voor RTG over het web heen.

   Dit huis meet nergens mensen, en hier ook niet. Wat er wordt bijgehouden is
   een TELLING van gebeurtenissen, geen dossier van bezoekers. Concreet:

   WAT ER WEL IN STAAT: hoe vaak een site is geopend, hoe vaak per pagina, hoe
   vaak per dag, en hoeveel berichten er via het formulier binnenkwamen.

   WAT ER MET OPZET NIET IN STAAT -- en dat is geen ontbrekende functie maar de
   regel van dit huis:
   - GEEN BEZOEKERS. Geen codenaam, geen sleutel, geen "terugkerende bezoeker".
     Zou dat er staan, dan is dit geen teller meer maar een lijst van wie waar
     heeft gekeken, en die hoort in dit huis nergens te bestaan.
   - GEEN TIJDSTIPPEN. Per dag een getal, niet per moment. Op een site met drie
     bezoekers per dag is "om 14:32" een aanwijzing naar een mens.
   - GEEN HERKOMST, GEEN KIJKTIJD, GEEN BEREIK. Die meten gedrag en niet
     gebruik; liever geen getal dan een getal dat iets anders meet dan het zegt.

   En een eigen bezoek telt niet mee: een ondernemer die zijn eigen site
   nakijkt, hoort zijn eigen cijfers niet op te blazen. */
module.exports = ({ store, save }) => {
  const DAGEN_MAX = 90;
  const vandaag = () => new Date().toISOString().slice(0, 10);

  function pot() {
    const s = store();
    if (!s.meting || typeof s.meting !== 'object') s.meting = {};
    return s.meting;
  }
  function rij(id) {
    const p = pot();
    if (!p[id] || typeof p[id] !== 'object') p[id] = { paginas: {}, dagen: {}, formulieren: 0 };
    const r = p[id];
    if (!r.paginas || typeof r.paginas !== 'object') r.paginas = {};
    if (!r.dagen || typeof r.dagen !== 'object') r.dagen = {};
    return r;
  }
  // de dagenlijst begrensd houden: oudste eruit
  function snoei(r) {
    const dagen = Object.keys(r.dagen).sort();
    while (dagen.length > DAGEN_MAX) delete r.dagen[dagen.shift()];
  }

  /* Een bezoek tellen. `pad` is de slug van de pagina ('' voor de voorpagina).
     `bezoeker` is alleen nodig om het eigen bezoek NIET te tellen -- hij wordt
     nergens bewaard. */
  function bezoek(d, pad, bezoeker) {
    if (!d || !d.id) return;
    if (bezoeker && bezoeker === d.eigenaar) return;   // je eigen site nakijken telt niet
    const r = rij(d.id);
    const p = String(pad || '') || 'home';
    r.paginas[p] = (r.paginas[p] || 0) + 1;
    const dag = vandaag();
    r.dagen[dag] = (r.dagen[dag] || 0) + 1;
    snoei(r);
  }
  function formulier(id) { if (id) { rij(id).formulieren = (rij(id).formulieren || 0) + 1; save(); } }

  function cijfers(d) {
    const r = rij(d.id);
    const dagen = Object.keys(r.dagen).sort().slice(-30).map(dag => ({ dag, aantal: r.dagen[dag] }));
    const paginas = Object.keys(r.paginas).map(slug => ({ slug, aantal: r.paginas[slug] }))
      .sort((a, b) => b.aantal - a.aantal);
    return { totaal: d.bezoeken || 0, paginas, dagen, formulieren: r.formulieren || 0,
             /* Zeggen wat er NIET gemeten wordt hoort bij het getal: anders
                leest iemand "12 bezoeken" als "12 mensen". */
             nietGemeten: ['wie er keek', 'hoe lang', 'waar iemand vandaan kwam', 'terugkerende bezoekers'] };
  }

  /* Het beeld voor RTG zelf: hoe staat het eigen web ervoor. Ook hier alleen
     tellingen -- sites en bezoeken, geen mensen. */
  function overzicht() {
    const lijst = store().lijst;
    const online = lijst.filter(d => d.online && d.adres);
    const bezoeken = lijst.reduce((n, d) => n + (d.bezoeken || 0), 0);
    return {
      sites: lijst.length,
      online: online.length,
      zakelijk: online.filter(d => d.zaakCode).length,
      bezoeken,
      top: online.slice().sort((a, b) => (b.bezoeken || 0) - (a.bezoeken || 0)).slice(0, 20)
        .map(d => ({ adres: d.adres, titel: d.titel, bezoeken: d.bezoeken || 0, zaak: !!d.zaakCode }))
    };
  }

  function wis(id) { const p = pot(); delete p[id]; }

  return { bezoek, formulier, cijfers, overzicht, wis };
};
