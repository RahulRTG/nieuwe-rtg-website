/* Rendez-vous, deelbestand "ontdek": WIE ZIE IK, EN WAT VIND IK ERVAN.

   De kandidatenlijst en de twee knoppen eronder (leuk / overslaan). Wat hier het
   meest toe doet staat in de sortering: eerst wie u al leuk vindt, dan wie u
   BINNENKORT TEGENKOMT (de Presence Graph), en pas daarna wie dezelfde steden
   heeft staan. Een gedeelde stad is een toevalligheid, samen ergens zijn is een
   aanleiding.

   Afgesplitst van ./rendezvous.js, dat het profiel houdt. Krijgt de gedeelde
   context van daar. */
module.exports = (ctx) => {
  const { R, AW, B, mag, codenaam, gedeeld, save, notify, nu, partnerVan } = ctx;

  function rvKandidaten(key) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const r = R();
    const mij = r.profielen[key] || { locaties: [] };
    const mijnLikes = r.likes[key] || {};
    const mijnPasses = r.passes[key] || {};
    const uit = [];
    /* Wie samen is, doet niet meer mee aan introducties -- niet als kijker en
       niet als kandidaat. De kring blijft wel (ONTMOETEN.md par. 2.10): tafels,
       evenementen en de concierge staan hier los van. */
    if (partnerVan && partnerVan(key)) return { status: 200, kandidaten: [], profielAan: !!mij.aan, samen: true };
    for (const [k, p] of Object.entries(r.profielen)) {
      if (k === key || !p.aan) continue;
      if (partnerVan && partnerVan(k)) continue;
      if (mijnPasses[k]) continue;
      const zijLikenMij = !!(r.likes[k] && r.likes[k][key]);
      const ikLikeHen = !!mijnLikes[k];
      uit.push({ id: k, codenaam: codenaam(k), over: p.over || '', zoekt: p.zoekt || '',
        wensen: p.wensen || [], locaties: p.locaties || [], gedeeldeLocaties: gedeeld(mij.locaties, p.locaties),
        /* Waar en wanneer u tegelijk bent. Noemt nooit wie er woont -- zie de
           derde grens in de kop van ./rendezvous-aanwezig.js. */
        samen: AW.overlapTussen(mij, p),
        likteMij: zijLikenMij && !ikLikeHen,
        status: ikLikeHen && zijLikenMij ? 'match' : ikLikeHen ? 'geliked' : 'nieuw' });
    }
    /* Eerst wie u al leuk vindt, dan wie u BINNENKORT TEGENKOMT, en pas daarna
       de gedeelde steden. Die middelste is de hele reden van de Presence Graph:
       een gedeelde stad zonder tijd is een toevalligheid, samen ergens zijn is
       een aanleiding. Geen aansporing erbij, alleen een volgorde -- LIFE.md
       par. 4.1: de app port niet aan tot een volgende stap. */
    uit.sort((a, b) => (b.likteMij - a.likteMij) || (b.samen.length - a.samen.length)
      || (b.gedeeldeLocaties.length - a.gedeeldeLocaties.length));
    return { status: 200, kandidaten: uit.slice(0, 60), profielAan: !!mij.aan };
  }

  function rvLike(key, targetKey) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const r = R();
    if (!targetKey || targetKey === key) return { status: 400, error: 'Onbekend lid.' };
    if (!r.profielen[key] || !r.profielen[key].aan) return { status: 400, error: 'Zet eerst uw eigen profiel aan.' };
    const doel = r.profielen[targetKey];
    if (!doel || !doel.aan) return { status: 404, error: 'Dit lid is niet (meer) beschikbaar.' };
    if (!r.likes[key]) r.likes[key] = {};
    if (r.passes[key]) delete r.passes[key][targetKey];
    r.likes[key][targetKey] = nu();
    const match = !!(r.likes[targetKey] && r.likes[targetKey][key]);
    save();
    if (match && notify) {
      const g = gedeeld(r.profielen[key].locaties, doel.locaties);
      const waar = g.length ? ' Denk aan een date in ' + g[0] + '.' : '';
      try { notify(key, { title: 'Rendez-vous', body: 'U heeft een match met ' + codenaam(targetKey) + '.' + waar, scope: 'lifestyle' }); } catch (e) {}
      try { notify(targetKey, { title: 'Rendez-vous', body: 'U heeft een match met ' + codenaam(key) + '.' + waar, scope: 'lifestyle' }); } catch (e) {}
    }
    return { status: 200, ok: true, match };
  }
  function rvPas(key, targetKey) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const r = R();
    if (!targetKey) return { status: 400, error: 'Onbekend lid.' };
    if (!r.passes[key]) r.passes[key] = {};
    r.passes[key][targetKey] = nu();
    if (r.likes[key]) delete r.likes[key][targetKey];
    save();
    return { status: 200, ok: true };
  }

  return { rvKandidaten, rvLike, rvPas };
};
