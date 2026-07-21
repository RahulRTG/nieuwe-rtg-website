/* Redactie, deelbestand "hoofdredacteur": de nieuwstips-wand die verhaal-
   ideeen uit het hele platform haalt (Pulse-trends, de bekendmakingen van het
   Rijk, de uitgewerkte ideeen van de bureaus) en de AI-hoofdredacteur die
   meeschrijft en redigeert -- maar NOOIT zelf op de publiceerknop drukt.
   Krijgt de gedeelde ctx van ./index.js. */
module.exports = (ctx) => {
  const { db, anthropic, scho, vind, RUBRIEKEN } = ctx;

  /* ---------- de samenwerking: de nieuwstips-wand uit het hele platform ---------- */
  function nieuwstips() {
    const tips = [];
    // wat leeft er bij de leden (Pulse: de trending hashtags van de week)
    const grens = new Date(Date.now() - 7 * 86400000).toISOString();
    const tel = {};
    for (const p of ((db.data.pulse || {}).posts || [])) {
      if (p.weg || p.verborgen || p.at <= grens) continue;
      for (const t of (p.tags || [])) tel[t] = (tel[t] || 0) + 1;
    }
    for (const [tag, n] of Object.entries(tel).sort((a, b) => b[1] - a[1]).slice(0, 4))
      tips.push({ bron: 'Pulse', icoon: '⚡', tip: '#' + tag + ' leeft deze week onder de leden (' + n + ' berichten). Wat zit erachter?' });
    // wat kondigt het Rijk aan (de bekendmakingen van De Overheid)
    for (const b of (db.data.rijkBekend || []).slice(0, 3))
      tips.push({ bron: 'Rijksoverheid', icoon: '🏛️', tip: b.titel + ' -- goed voor een uitlegstuk.' });
    // wat hebben de ontwerpbureaus uitgewerkt (de Ideeenkamer)
    for (const o of ((db.data.ideeen || {}).lijst || []).filter(x => x.status === 'uitgewerkt').slice(0, 3))
      tips.push({ bron: 'Ideeenkamer', icoon: '💡', tip: '"' + o.titel + '" is uitgewerkt door de bureaus -- een makingsverhaal.' });
    return { ok: true, tips: tips.slice(0, 10) };
  }

  /* ---------- de AI-hoofdredacteur: schrijft mee, redigeert, publiceert NOOIT ---------- */
  async function aiSchrijf(onderwerp, rubriek) {
    const q = scho(onderwerp, 200);
    if (!q) return { status: 400, error: 'Waar moet het stuk over gaan?' };
    const rub = RUBRIEKEN.includes(rubriek) ? rubriek : 'nieuws';
    if (anthropic) {
      try {
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 700,
          system: require('../rahul').RAHUL_LEAD + 'je bent de AI-hoofdredacteur van RTG Redactie. Schrijf een CONCEPT voor de rubriek ' + rub +
            ': een pakkende kop, een intro van twee zinnen en een artikel van drie korte alinea\'s, in helder Nederlands. ' +
            'Verzin GEEN feiten, namen of cijfers die je niet zeker weet; markeer open plekken met [check]. ' +
            'Antwoord uitsluitend als JSON: {"kop":"...","intro":"...","tekst":"..."}.',
          messages: [{ role: 'user', content: q }]
        });
        const m = ((r.content.find(c => c.type === 'text') || {}).text || '').match(/\{[\s\S]*\}/);
        if (m) { const j = JSON.parse(m[0]); if (j.kop) return { ok: true, kop: scho(j.kop, 120), intro: scho(j.intro, 300), tekst: scho(j.tekst, 8000), bron: 'ai' }; }
      } catch (e) { /* val terug */ }
    }
    return { ok: true, bron: 'demo', kop: q.slice(0, 1).toUpperCase() + q.slice(1),
      intro: 'De redactie duikt in ' + q + '. Wat er speelt en waarom het ertoe doet.',
      tekst: 'Eerste alinea: wat is er gebeurd rond ' + q + '? [check de feiten]\n\nTweede alinea: wat betekent het voor de leden en partners? [check]\n\nDerde alinea: hoe gaat dit verder? De redactie volgt het.' };
  }
  async function aiRedactie(aid) {
    const a = vind(aid);
    if (!a) return { status: 404, error: 'Artikel niet gevonden.' };
    if (anthropic) {
      try {
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 400,
          system: require('../rahul').RAHUL_LEAD + 'je bent de eindredacteur van RTG Redactie. Geef korte, scherpe maar respectvolle redactie op dit stuk: ' +
            'de kop, de eerste zin, de opbouw, spelfouten en welke feiten nog gecheckt moeten worden. Sluit af met een helder oordeel: klaar voor publicatie of nog niet. ' +
            'Publiceren beslist ALTIJD een mens, nooit jij.',
          messages: [{ role: 'user', content: 'KOP: ' + a.kop + '\nINTRO: ' + (a.intro || '-') + '\nTEKST:\n' + (a.tekst || '-') }]
        });
        const tekst = (r.content.find(c => c.type === 'text') || {}).text;
        if (tekst) return { ok: true, redactie: tekst };
      } catch (e) { /* val terug */ }
    }
    const punten = [];
    if (!a.intro) punten.push('Er is nog geen intro; twee zinnen die de lezer vastpakken.');
    if ((a.tekst || '').length < 200) punten.push('Het stuk is nog dun; werk het uit naar minstens drie alinea\'s.');
    if (/\[check\]/i.test(a.tekst || '')) punten.push('Er staan nog [check]-plekken open; eerst de feiten rond maken.');
    punten.push('Lees de kop hardop: dekt hij de lading in acht woorden?');
    return { ok: true, redactie: 'Redactie op "' + a.kop + '":\n- ' + punten.join('\n- ') + '\n\nOordeel: ' + (punten.length > 2 ? 'nog niet klaar voor publicatie.' : 'bijna klaar; publiceren blijft uw besluit.') };
  }

  return { nieuwstips, aiSchrijf, aiRedactie };
};
