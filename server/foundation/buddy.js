/* RTFoundation-buddy: de gezinshulp-AI (warme coaches met een gekozen buddy en
   de leeftijdslaag), de dagelijkse bespaartip, de impact-teller en de
   gesprekskaarten. kiesBuddy/leeftijdInstr gaan op de context, zodat de
   les-AI (onderwijs.js) dezelfde buddy en leeftijdslaag gebruikt.
   Gemount vanuit foundation.js op de gedeelde context. */
module.exports = (ctx) => {
  const { router, F, db, anthropic, familieVan } = ctx;

/* De coachdata (prompts, persona's, leeftijdslaag, tips en kaarten) staat
   als pure data in een deelmodule. */
const { HULP_SYS, HULP_DEMO, AI_KINDS, BUDDY, LEEFTIJD, BESPAARTIPS, GESPREKSKAARTEN } = require('./buddy/coachdata');

function kiesBuddy(g) { return BUDDY[g] || BUDDY.vrouw; }
function buddySys(kind, g) {
  const b = kiesBuddy(g);
  return HULP_SYS[kind].replace(/^Je bent "[^"]+"/, 'Je bent ' + b.naam + ' (' + b.wie + ')');
}
function leeftijdInstr(g) {
  const l = LEEFTIJD[g];
  return l ? ' Je praat met ' + l.wie + '. ' + l.hoe + ' Pas taal, voorbeelden en niveau daarop aan.' : '';
}
router.post('/hulp/ai', async (req, res) => {
  const s = familieVan(req, res); if (!s) return;
  const kind = AI_KINDS.includes(req.body.kind) ? req.body.kind : 'geld';
  const clean = (Array.isArray(req.body.messages) ? req.body.messages : [])
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 1500) })).slice(-10);
  while (clean.length && clean[0].role !== 'user') clean.shift();
  if (!clean.length) return res.json({ text: HULP_DEMO[kind] });
  if (!anthropic) return res.json({ text: HULP_DEMO[kind], demo: true });
  try {
    const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 420, system: buddySys(kind, req.body.buddy) + leeftijdInstr(req.body.groep), messages: clean });
    res.json({ text: (r.content || []).map(b => b.text || '').join('').trim() || HULP_DEMO[kind] });
  } catch (e) { res.json({ text: HULP_DEMO[kind], demo: true }); }
});

router.get('/bespaartip', (req, res) => {
  const dag = Math.floor(Date.now() / 86400000);
  res.json({ tip: BESPAARTIPS[dag % BESPAARTIPS.length], nog: BESPAARTIPS[Math.floor(Math.random() * BESPAARTIPS.length)] });
});

/* Wat de bijdragen dóén: een warme, geaggregeerde momentopname voor de gezinnen.
   Opgehaald = alles wat leden via hun abonnement aan de RTFoundation afdroegen
   (het grootboek uit kern/fonds.js), plus het aantal aangesloten scholen en
   gezinnen. Publiek en zonder namen; alleen totalen. */
router.get('/impact', (req, res) => {
  const f = F();
  const afdrachten = Array.isArray(db.data.fondsAfdrachten) ? db.data.fondsAfdrachten : [];
  const opgehaaldCenten = afdrachten.reduce((s, a) => s + (a.centen || 0), 0);
  const scholen = f.scholen ? Object.values(f.scholen).filter(s => (s.status || 'actief') !== 'wacht').length : 0;
  const gezinnen = f.gezinnen ? Object.keys(f.gezinnen).length : 0;
  res.json({
    opgehaald: Math.round(opgehaaldCenten) / 100,
    scholen, gezinnen,
    boodschap: 'Elke maand dat iemand RTG-lid is, groeit de RTFoundation mee. Zo blijft alles hier gratis, voor iedereen.'
  });
});

router.get('/gesprekskaart', (req, res) => res.json({ kaart: GESPREKSKAARTEN[Math.floor(Math.random() * GESPREKSKAARTEN.length)] }));

  // de les-AI van de onderwijslaag gebruikt dezelfde buddy en leeftijdslaag
  ctx.kiesBuddy = kiesBuddy;
  ctx.leeftijdInstr = leeftijdInstr;
  return { kiesBuddy, leeftijdInstr };
};
