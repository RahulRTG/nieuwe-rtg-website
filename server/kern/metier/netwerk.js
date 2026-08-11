/* Métier (deelmodule): aanbevelingen en het onderschrijven van vaardigheden.

   Twee regels die dit anders maken dan het gebruikelijke geklik:

   1. EEN AANBEVELING IS TEKST DIE IEMAND ZELF SCHRIJFT, en hij staat er met zijn
      codenaam onder. Geen duimpje, geen "vaardigheid bevestigd" in een tik: je
      schrijft een paar zinnen of je doet het niet. Daardoor is er ook niets te
      ruilen -- de wederkerigheidslus ("jij mij, ik jou") heeft geen knop.
   2. ONDERSCHRIJVEN KAN ALLEEN OP EEN VAARDIGHEID DIE ER AL STAAT, en alleen
      door iemand met wie je een connectie hebt. Je kunt dus niet in het wild
      vaardigheden aan iemand toeschrijven, en er is geen teller die iedereen kan
      opblazen: een persoon, een stem.

   Bewust NIET: "wie bekeek je profiel" als lokkertje. Wie je naam bekeek is een
   ander verhaal -- dat is een echte gebeurtenis met gevolgen, en die staat in
   kern/metier/bewijs.js in je eigen inzagelog.

   EN SINDS DE WERELDLAAG BESTAAT DAT EERSTE TOCH, ELDERS -- dus hoort hier te
   staan hoe die twee zich verhouden, anders spreekt de codebase zichzelf tegen.
   kern/wereld/bezoek.js houdt wel bij wie je WERELDPROFIEL opende. Wat dit
   bestand afwijst is de LOKKERTJE-vorm, en die eigenschappen zijn daar
   structureel uitgesloten: die module krijgt `notify` niet eens binnen (hij kan
   je dus niet porren), er is geen teller die groei toont, geen vergelijking met
   vorige week en geen ranglijst -- een regel per kijker, en na 90 dagen weg. En
   hij is symmetrisch: er is geen sluipstand, wie kijkt wordt zelf ook gezien.
   Métier blijft wat het is; het inzagelog van je NAAM is nog steeds een andere,
   zwaardere zaak dan het openen van een profiel. */
const { keur } = require('../veilig');

module.exports = ({ db, save, codenaamVan, keyVanCodenaam, zijnVrienden, liveCodename, notify, metier }) => {
  const TEKST_MAX = 500;
  const PER_PROFIEL = 50;
  const nu = () => new Date().toISOString();

  async function keyVan(wie) {
    const c = String(wie || '').trim();
    if (!c || !keyVanCodenaam) return null;
    try { const t = await keyVanCodenaam(c); return (t && t.key) || null; } catch (e) { return null; }
  }

  const verbonden = (a, b) => !!(zijnVrienden && a && b && zijnVrienden(a, b));

  /* Een aanbeveling schrijven over iemand anders. Alleen over iemand met wie je
     een connectie hebt: wie je niet kent, kun je ook niet aanbevelen. */
  async function beveelAan(sess, wie, tekst) {
    const m = metier.S();
    const doel = await keyVan(wie);
    if (!doel) return { error: 'Dit lid ken ik niet.' };
    if (doel === sess.key) return { error: 'Een aanbeveling over jezelf is geen aanbeveling.' };
    if (!verbonden(sess.key, doel)) return { error: 'Je kunt alleen iemand aanbevelen met wie je verbonden bent.' };
    const t = String(tekst || '').trim().slice(0, TEKST_MAX);
    if (t.length < 20) return { error: 'Schrijf een paar zinnen; een half woord helpt niemand.' };
    const k = keur(t); if (!k.ok) return { error: k.reden };

    const lijst = m.aanbeveling[doel] = Array.isArray(m.aanbeveling[doel]) ? m.aanbeveling[doel] : [];
    const eerder = lijst.find(a => a.vanKey === sess.key);
    if (eerder) { eerder.tekst = t; eerder.at = nu(); }
    else {
      lijst.unshift({ id: aanbevelingId(lijst), vanKey: sess.key, tekst: t, at: nu(), verborgen: false });
      if (lijst.length > PER_PROFIEL) lijst.length = PER_PROFIEL;
    }
    save();
    try { if (notify) notify(doel, 'Iemand schreef een aanbeveling op je Métier-profiel.'); } catch (e) {}
    return { ok: true, aanbeveling: publiek(eerder || lijst[0], sess) };
  }

  function aanbevelingId(lijst) {
    let id = Date.now();
    while (lijst.some(a => a.id === id)) id++;
    return id;
  }

  const publiek = (a, sess) => ({
    id: a.id, van: codenaamVan(a.vanKey), tekst: a.tekst, at: a.at,
    vanMij: !!(sess && a.vanKey === sess.key)
  });

  /* De eigenaar van het profiel mag een aanbeveling verbergen. Bewust GEEN
     verwijderen door de ontvanger: de schrijver houdt zijn woorden, jij bepaalt
     alleen wat er op jouw pagina staat. Wie hem schreef, ziet hem dus nog. */
  function verberg(mijnKey, id, aan) {
    const m = metier.S();
    const lijst = m.aanbeveling[mijnKey] || [];
    const a = lijst.find(x => String(x.id) === String(id));
    if (!a) return { error: 'Deze aanbeveling staat niet op jouw profiel.' };
    a.verborgen = aan !== false;
    save();
    return { ok: true, verborgen: !!a.verborgen };
  }

  function aanbevelingenVan(key, sess) {
    const m = metier.S();
    return (m.aanbeveling[key] || [])
      .filter(a => !a.verborgen || (sess && (a.vanKey === sess.key || key === sess.key)))
      .map(a => Object.assign(publiek(a, sess), { verborgen: !!a.verborgen }));
  }

  // Eigen aanbeveling weghalen: de schrijver mag zijn woorden altijd intrekken.
  function trekIn(sess, wie, id) {
    const m = metier.S();
    for (const doel of Object.keys(m.aanbeveling)) {
      const lijst = m.aanbeveling[doel];
      const i = lijst.findIndex(a => String(a.id) === String(id) && a.vanKey === sess.key);
      if (i >= 0) { lijst.splice(i, 1); save(); return { ok: true }; }
    }
    return { error: 'Deze aanbeveling is niet van jou.' };
  }

  /* Een vaardigheid onderschrijven. Alleen als hij op het profiel staat, alleen
     als jullie verbonden zijn, en hoogstens een keer per persoon per vaardigheid. */
  async function onderschrijf(sess, wie, vaardigheid, aan) {
    const m = metier.S();
    const doel = await keyVan(wie);
    if (!doel) return { error: 'Dit lid ken ik niet.' };
    if (doel === sess.key) return { error: 'Je eigen vaardigheden onderschrijven zegt niets.' };
    if (!verbonden(sess.key, doel)) return { error: 'Je kunt alleen onderschrijven bij iemand met wie je verbonden bent.' };
    const v = String(vaardigheid || '').slice(0, 40).trim();
    const heeft = (metier.profielVan(doel).vaardigheden || []).includes(v);
    if (!heeft) return { error: 'Deze vaardigheid staat niet op zijn profiel. Je kunt er niets bij verzinnen.' };

    const perLid = m.onderschrijving[doel] = (m.onderschrijving[doel] && typeof m.onderschrijving[doel] === 'object') ? m.onderschrijving[doel] : {};
    const wieAl = perLid[v] = Array.isArray(perLid[v]) ? perLid[v] : [];
    const i = wieAl.indexOf(sess.key);
    if (aan !== false && i < 0) wieAl.push(sess.key);
    if (aan === false && i >= 0) wieAl.splice(i, 1);
    save();
    return { ok: true, vaardigheid: v, aantal: wieAl.length, ikDeed: wieAl.includes(sess.key) };
  }

  // Per vaardigheid: hoeveel mensen, en deed ik zelf mee. Geen namenlijst: het
  // gaat om het vak, niet om wie het hardst juicht.
  function onderschrevenVan(key, sess) {
    const m = metier.S();
    const perLid = m.onderschrijving[key] || {};
    const uit = {};
    for (const v of Object.keys(perLid)) {
      const lijst = perLid[v] || [];
      uit[v] = { aantal: lijst.length, ikDeed: !!(sess && lijst.includes(sess.key)) };
    }
    return uit;
  }

  return { beveelAan, verberg, aanbevelingenVan, trekIn, onderschrijf, onderschrevenVan };
};
