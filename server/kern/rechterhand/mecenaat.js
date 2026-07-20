/* Rechterhand (deelmodule): Mecenaat -- uw filantropie op orde. Per gift het doel,
   het thema, het bedrag, of het een toezegging of al betaald is, en of het via de
   RTFoundation loopt. Het overzicht toont wat u heeft toegezegd, wat er is betaald
   en welk deel via de RTFoundation gaat -- die 30% van de bijdragen naar
   liefdadigheid brengt. Gemount via index.js. */
module.exports = (ctx) => {
  const { save, rid, nu, schoon, isDatum, getal, L } = ctx;
  const THEMAS = ['onderwijs', 'gezondheid', 'natuur', 'kunst', 'noodhulp', 'gemeenschap', 'overig'];
  const PERIODEN = ['eenmalig', 'maand', 'kwartaal', 'jaar'];

  function M(key) { const l = L(key); if (!Array.isArray(l.mecenaat)) l.mecenaat = []; return l.mecenaat; }

  function mecGift(key, b) {
    const doel = schoon(b.doel, 100);
    if (!doel) return { status: 400, error: 'Welk goed doel steunt u?' };
    const giften = M(key);
    const rec = { doel, thema: THEMAS.includes(b.thema) ? b.thema : 'overig',
      bedrag: getal(b.bedrag, 1e9), periode: PERIODEN.includes(b.periode) ? b.periode : 'eenmalig',
      betaald: b.betaald === true, foundation: b.foundation === true,
      datum: isDatum(b.datum) ? b.datum : '', notitie: schoon(b.notitie, 300) };
    if (b.id) { const g = giften.find(x => x.id === b.id); if (!g) return { status: 404, error: 'Deze gift staat niet in uw dossier.' }; Object.assign(g, rec); save(); return { status: 200, ok: true, gift: g }; }
    if (giften.length >= 500) return { status: 400, error: 'Uw dossier is vol.' };
    const g = Object.assign({ id: rid(), at: nu() }, rec);
    giften.unshift(g); save();
    return { status: 200, ok: true, gift: g };
  }
  function mecGiftWeg(key, id) { const l = L(key); l.mecenaat = M(key).filter(x => x.id !== id); save(); return { status: 200, ok: true }; }
  function mecBetaald(key, id, betaald) {
    const g = M(key).find(x => x.id === id);
    if (!g) return { status: 404, error: 'Deze gift staat niet in uw dossier.' };
    g.betaald = betaald === true; save();
    return { status: 200, ok: true };
  }

  function mecenaat(key) {
    const giften = M(key).slice().sort((a, b) => (b.datum || '').localeCompare(a.datum || '') || String(b.at).localeCompare(String(a.at)));
    const betaald = giften.filter(g => g.betaald).reduce((s, g) => s + g.bedrag, 0);
    const toegezegd = giften.filter(g => !g.betaald).reduce((s, g) => s + g.bedrag, 0);
    const viaFoundation = giften.filter(g => g.foundation).reduce((s, g) => s + g.bedrag, 0);
    const perThema = {};
    for (const g of giften) perThema[g.thema] = (perThema[g.thema] || 0) + g.bedrag;
    return { status: 200, giften, themas: THEMAS, perioden: PERIODEN,
      betaald, toegezegd, totaal: betaald + toegezegd, viaFoundation, perThema };
  }

  return { mecenaat, mecGift, mecGiftWeg, mecBetaald };
};
