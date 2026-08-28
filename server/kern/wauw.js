/* De wauw-laag: kleine cross-sociale magie over ALLE sociale apps (Pulse, De
   Salon, de vriendenchat, de Berichten-app), allemaal 9+ en bewust NIET
   verslavend -- het kijkt terug en viert, het trekt niet aan je mouw.

   - De stemming: een dag-emoji uit een vaste 9+-lijst die overal naast je
     codenaam verschijnt (Pulse, de Berichten-app). Verloopt vanzelf per dag.
   - De verjaardagsglans: op je verjaardag krijgt je codenaam overal een taartje.
   - De Terugblik: jouw sociale week in een warm overzicht (berichten, likes,
     reacties, gesprekken) -- terugkijken, geen scorebord.
   Gedeelde context vanuit server.js (na de sociale laag gemount). */
const { idVanKey } = require('../lib/lidsleutel');

module.exports = ({ db, save, accounts, socialConnecties }) => {
  const vandaag = () => new Date().toISOString().slice(0, 10);
  // de vaste 9+-lijst: vrolijk, neutraal, niets om achter te verschuilen
  const STEMMINGEN = ['emo-blij', 'emo-cool', 'emo-ster', 'emo-slaap', 'emo-feest', 'balans', 'balans', 'boot', 'reisboek', 'ontwerp', 'sport', 'muziek', 'balans', 'bar'];

  function W() {
    if (!db.data.wauw || typeof db.data.wauw !== 'object') db.data.wauw = { stemmingen: {} };
    if (!db.data.wauw.stemmingen) db.data.wauw.stemmingen = {};
    return db.data.wauw;
  }

  function stemmingZet(key, emoji) {
    if (emoji !== '' && !STEMMINGEN.includes(emoji)) return { status: 400, error: 'Kies een stemming uit het lijstje.' };
    const w = W();
    if (emoji === '') delete w.stemmingen[key];
    else w.stemmingen[key] = { emoji, dag: vandaag() };
    save();
    return { status: 200, ok: true, stemming: emoji || null, keuzes: STEMMINGEN };
  }
  function stemmingVan(key) {
    const s = W().stemmingen[key];
    return s && s.dag === vandaag() ? s.emoji : null; // een stemming geldt een dag
  }

  // jarig? de geboortedag (uit het eigen profiel) valt vandaag
  function jarigVan(key) {
    const id = idVanKey(key);
    if (id == null || !accounts) return false;
    let md = null;
    try { md = accounts.getMemberState(id); } catch (e) { return false; }
    return !!(md && md.geboren && String(md.geboren).slice(5) === vandaag().slice(5));
  }

  /* De Terugblik: jouw sociale week, om te vieren, niet om te vergelijken.
     Er is bewust GEEN ranglijst en geen vergelijking met anderen. */
  function terugblik(key) {
    const grens = new Date(Date.now() - 7 * 86400000).toISOString();
    const p = db.data.pulse || { posts: [] };
    const mijnPosts = (p.posts || []).filter(x => x.key === key && !x.weg && x.at > grens);
    let likes = 0, reacties = 0;
    for (const x of (p.posts || [])) {
      if (x.key !== key || x.weg) continue;
      likes += Object.keys(x.likes || {}).length;
      reacties += (x.reacties || []).filter(r => r.key !== key && r.at > grens).length;
    }
    /* Wat jij vandaag hebt gestuurd, uit de communicatiekern -- daar wonen de
       gesprekken sinds de verhuizing. Dit telt ALLE gesprekken mee (ook die van
       een rit of een bestelling) en niet alleen de vriendenchat, en dat is
       eerlijker: het gaat over hoe druk jouw dag was, niet over in welke module
       je toevallig zat. */
    let gestuurd = 0;
    for (const g of (db.data.commGesprekken || [])) {
      if (!Array.isArray(g.deelnemers) || !g.deelnemers.includes(key)) continue;
      for (const mm of ((db.data.commBerichten || {})[g.id] || [])) {
        if (mm.van === key && !mm.weg && mm.at > grens) gestuurd++;
      }
    }
    let vrienden = 0;
    try {
      const sc = socialConnecties(key);
      vrienden = (sc.connections || []).length;
    } catch (e) {}
    const zin = mijnPosts.length || gestuurd
      ? 'Wat een week: je deelde ' + mijnPosts.length + ' bericht(en), kreeg ' + likes + ' hartjes en ' + reacties + ' reactie(s), en stuurde ' + gestuurd + ' berichtje(s) naar je vrienden.'
      : 'Een stille week op de socials -- en dat is helemaal prima. Je vrienden zijn er nog steeds.';
    return { status: 200, ok: true, week: { posts: mijnPosts.length, likes, reacties, gestuurd, vrienden },
      jarig: jarigVan(key), stemming: stemmingVan(key), zin };
  }

  return { STEMMINGEN, wauwStemmingZet: stemmingZet, stemmingVan, jarigVan, wauwTerugblik: terugblik };
};
