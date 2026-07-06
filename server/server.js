/* RTG Ledenportaal — backend.
   Start: npm start (of node server/server.js). Draait op http://localhost:3000.
   Zet ANTHROPIC_API_KEY in de omgeving om de persoonlijke AI op de echte
   Claude API te laten draaien; zonder key vallen we terug op demo-antwoorden. */

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { db, load, save } = require('./db');

load();

const app = express();
app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, '..')));

/* ---------- Claude API (optioneel) ---------- */

let anthropic = null;
if (process.env.ANTHROPIC_API_KEY) {
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    anthropic = new Anthropic();
    console.log('Persoonlijke AI: Claude API actief (claude-opus-4-8).');
  } catch (e) {
    console.warn('ANTHROPIC_API_KEY gevonden maar @anthropic-ai/sdk ontbreekt — demo-antwoorden actief.');
  }
} else {
  console.log('Persoonlijke AI: demo-antwoorden (zet ANTHROPIC_API_KEY voor echte Claude).');
}

/* ---------- personas & sessies ---------- */

const PERSONAS = {
  guest:     { name: 'Gast',         full: 'Gast',               since: null,             number: null },
  rtg:       { name: 'S. Janssen',   full: 'Sophie Janssen',     since: 'Maart 2026',     number: 'RTG · 2026 · 8841' },
  lifestyle: { name: 'I. van Rhijn', full: 'Isabelle van Rhijn', since: 'Augustus 2025',  number: 'LSP · 2025 · 0217' },
  business:  { name: 'A. de Vries',  full: 'Alexander de Vries', since: 'November 2025',  number: 'BSP · 2025 · 1104' }
};

// token -> { tier, key } (in-memory; verdwijnt bij herstart, data blijft in db.json)
const sessions = new Map();

function auth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const sess = token && sessions.get(token);
  if (!sess) return res.status(401).json({ error: 'Niet ingelogd.' });
  req.session = sess;
  next();
}

/* ---------- Salon-rechten (server-side afgedwongen) ----------
   gast: alleen liken; RTG: reageren/dm'en met RTG-leden;
   Lifestyle & Business: volledige interactie met alle leden.
   Wederkerigheid: spreekt een hoger lid een RTG-lid aan (reactie of DM
   op diens post), dan mag dat RTG-lid bij die persoon terugpraten. */
function hasContact(higherFull, rtgFull) {
  return db.data.contacts.some(c => c.higher === higherFull && c.rtg === rtgFull);
}

function addContact(higherFull, rtgFull) {
  if (!hasContact(higherFull, rtgFull)) {
    db.data.contacts.push({ higher: higherFull, rtg: rtgFull });
  }
}

function canEngage(sess, post) {
  if (sess.tier === 'guest') return false;
  if (sess.tier === 'rtg') {
    if (post.tier === 'rtg') return true;
    return hasContact(post.author, PERSONAS.rtg.full);
  }
  return true;
}

function engageError(viewerTier) {
  if (viewerTier === 'guest') return 'Zonder pas kunt u alleen liken. Reageren en berichten zijn voor leden.';
  return 'Met de RTG Pass reageert en dm’t u alleen met andere RTG-leden — tenzij dit lid u eerst heeft aangesproken.';
}

/* Na een reactie/DM van een hoger lid op een RTG-post: leg het contact vast. */
function registerContact(sess, post) {
  if ((sess.tier === 'lifestyle' || sess.tier === 'business') && post.tier === 'rtg') {
    addContact(PERSONAS[sess.tier].full, post.author);
  }
}

/* ---------- state per gebruiker ---------- */

function stateFor(sess) {
  const persona = PERSONAS[sess.tier];
  const posts = db.data.posts.map(p => ({
    id: p.id, author: p.author, tier: p.tier, place: p.place, visual: p.visual,
    text: p.text, reward: p.reward, featured: !!p.featured,
    likes: p.baseLikes + Object.keys(p.likedBy).length,
    liked: !!p.likedBy[sess.key],
    comments: p.comments,
    canEngage: canEngage(sess, p)
  }));
  const state = { user: { tier: sess.tier, ...persona }, posts, creatorCredit: 0, creatorLikes: 0 };
  if (sess.tier !== 'guest') {
    state.invoices = db.data.invoices;
    state.trip = db.data.trip;
    state.creatorCredit = db.data.creatorCredit[sess.tier] || 0;
    state.creatorLikes = db.data.creatorLikes[sess.tier] || 0;
  }
  return state;
}

/* ---------- endpoints ---------- */

app.get('/api/health', (req, res) => res.json({ ok: true, ai: anthropic ? 'claude' : 'demo' }));

app.post('/api/login', (req, res) => {
  const tier = String(req.body.tier || '');
  if (!PERSONAS[tier]) return res.status(400).json({ error: 'Onbekende pas.' });
  const token = crypto.randomBytes(24).toString('hex');
  const sess = { tier, key: tier === 'guest' ? 'guest-' + token.slice(0, 8) : tier };
  sessions.set(token, sess);
  res.json({ token, state: stateFor(sess) });
});

app.post('/api/logout', auth, (req, res) => {
  for (const [token, sess] of sessions) if (sess === req.session) sessions.delete(token);
  res.json({ ok: true });
});

app.post('/api/state', auth, (req, res) => res.json({ state: stateFor(req.session) }));

/* Eén tik betaalt: één factuur ({invoiceId}) of alles wat openstaat ({all:true}).
   De echte Face ID-/Apple Pay-verificatie gebeurt op het toestel; de server
   verwerkt de betaling in één aanroep. */
app.post('/api/pay', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  let targets;
  if (req.body.all) {
    targets = db.data.invoices.filter(i => i.status === 'open');
    if (!targets.length) return res.status(409).json({ error: 'Er staat niets open.' });
  } else {
    const inv = db.data.invoices.find(i => i.id === req.body.invoiceId);
    if (!inv) return res.status(404).json({ error: 'Factuur niet gevonden.' });
    if (inv.status === 'paid') return res.status(409).json({ error: 'Deze factuur is al betaald.' });
    targets = [inv];
  }
  let foundation = 0;
  for (const inv of targets) {
    inv.status = 'paid';
    inv.date = 'Zojuist betaald';
    foundation += Math.round(inv.bijdrage * 0.3);
    for (const item of db.data.trip.items) {
      if (item.invoiceId === inv.id) { item.status = 'paid'; item.label = 'Bevestigd'; }
    }
  }
  save();
  res.json({ ok: true, foundation, state: stateFor(req.session) });
});

app.post('/api/like', auth, (req, res) => {
  const post = db.data.posts.find(p => p.id === Number(req.body.postId));
  if (!post) return res.status(404).json({ error: 'Post niet gevonden.' });
  // Liken mag iedereen, ook zonder pas.
  if (req.body.liked) post.likedBy[req.session.key] = true;
  else delete post.likedBy[req.session.key];
  save();
  res.json({ ok: true, likes: post.baseLikes + Object.keys(post.likedBy).length });
});

app.post('/api/comment', auth, (req, res) => {
  const post = db.data.posts.find(p => p.id === Number(req.body.postId));
  if (!post) return res.status(404).json({ error: 'Post niet gevonden.' });
  if (!canEngage(req.session, post)) {
    return res.status(403).json({ error: engageError(req.session.tier) });
  }
  const text = String(req.body.text || '').trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: 'Lege reactie.' });
  const persona = PERSONAS[req.session.tier];
  const comment = { who: persona.full, tier: req.session.tier, text };
  post.comments.push(comment);
  registerContact(req.session, post);
  save();
  res.json({ ok: true, comment });
});

app.post('/api/dm', auth, (req, res) => {
  const post = db.data.posts.find(p => p.id === Number(req.body.postId));
  if (!post) return res.status(404).json({ error: 'Post niet gevonden.' });
  if (!canEngage(req.session, post)) {
    return res.status(403).json({ error: engageError(req.session.tier) });
  }
  const text = String(req.body.text || '').trim().slice(0, 1000);
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  registerContact(req.session, post);
  db.data.dms.push({
    from: PERSONAS[req.session.tier].full,
    fromTier: req.session.tier,
    to: post.author,
    text,
    at: new Date().toISOString()
  });
  save();
  res.json({ ok: true });
});

/* ---------- persoonlijke AI ---------- */

const AI_TONE = {
  rtg: 'Je bent "de Butler": rustig, ingetogen, old money kalmte. Je tutoyeert niet, je vousvoyeert.',
  lifestyle: 'Je werkt naast de persoonlijke concierge: warm, voorkomend en persoonlijk. U-vorm.',
  business: 'Je bent een uitvoerende AI voor een zakelijk lid: kort, precies, to the point. U-vorm, geen overbodige woorden.'
};

function aiSystemPrompt(tier) {
  const persona = PERSONAS[tier];
  const trip = db.data.trip;
  const openInvoices = db.data.invoices.filter(i => i.status === 'open');
  return [
    'Je bent de exclusieve persoonlijke reis-AI van Rahul Travel Group (RTG), een membership-reisclub die tegen inkoopprijs boekt en 30% van elke ledenbijdrage aan de RTFoundation doneert.',
    AI_TONE[tier] || AI_TONE.rtg,
    'Je bent de frictieloze vriend van het lid: je wacht niet op vragen maar denkt vooruit. Signaleer zelf wat geregeld moet worden (openstaande betalingen, aanvragen die nog niet bevestigd zijn, vergeten voorbereidingen) en sluit elk antwoord af met één concreet voorstel dat het lid met een enkel "ja" kan afdoen. Betalingen gaan in het portaal met één tik (Face ID of Apple Pay) — verwijs daarnaar, vraag nooit om betaalgegevens.',
    'Zegt het lid "ja" of iets vergelijkbaars, dan bevestig je kort dat het geregeld is en noem je wat je vervolgens in de gaten houdt.',
    'Je helpt het lid met reisvoorbereiding: paklijsten, documenten en visa, weer, dagplanning, restaurants en wijzigingen aan geboekte diensten. Antwoord in het Nederlands, beknopt (maximaal ~120 woorden), zonder opsmuk.',
    `Het lid: ${persona.full} (${tier === 'rtg' ? 'RTG Pass' : tier === 'lifestyle' ? 'Lifestyle Pass' : 'Business Pass'}), lid sinds ${persona.since}.`,
    `Komende reis: ${trip.dest}, ${trip.dates} (over ${trip.days} dagen). Geboekte diensten: ${trip.items.map(i => `${i.title} [${i.label}]`).join('; ')}.`,
    openInvoices.length
      ? `Openstaande betalingen: ${openInvoices.map(i => `${i.desc} (€ ${i.netto + i.bijdrage})`).join('; ')}. Wijs daar alleen op als het relevant is.`
      : 'Er staan geen betalingen open.',
    'Verzin geen boekingen of prijzen die hierboven niet staan. Als je iets niet weet of niet kunt regelen, zeg dat eerlijk en bied aan het uit te zoeken.'
  ].join('\n');
}

/* Demo-antwoorden wanneer er geen Claude API-key is. */
function cannedAnswer(q) {
  const l = q.toLowerCase().trim();
  if (/^(ja|graag|ja graag|doe maar|prima|goed|regel het|ja, regel het)\b/.test(l))
    return 'Geregeld. De paklijst staat klaar in uw reisoverzicht (lichte lagen, regenjas, nette schoenen die makkelijk uitgaan, adapter type A) en het dagplan voor 14 oktober is ingepland: Arashiyama om 08:00, lunch in Sagano, uw theeceremonie om 15:00 en een avondwandeling langs Pontocho.\n\nVolgende dat ik in de gaten houd: de bevestiging van Kikunoi Honten. U hoeft niets te doen.';
  if (l.includes('inpak') || l.includes('paklijst') || l.includes('koffer'))
    return 'Voor Kyoto in oktober (14–22°C, kans op regen):\n— Lichte lagen + een regenjas\n— Nette schoenen die makkelijk uitgaan (ryokan & tempels)\n— Ingetogen kleding voor Kikunoi Honten\n— Adapter type A\n\nZal ik hier een afvinklijst van maken in uw reisoverzicht?';
  if (l.includes('visum') || l.includes('paspoort') || l.includes('document'))
    return 'Voor Japan heeft u geen visum nodig bij verblijf tot 90 dagen. Uw paspoort moet geldig zijn tijdens het hele verblijf. Ik zet uw boekingsbevestigingen alvast klaar voor de douane-app (Visit Japan Web).';
  if (l.includes('weer'))
    return 'Kyoto medio oktober: gemiddeld 14–22°C, af en toe regen, en het begin van de herfstkleuren — de esdoorns in Arashiyama beginnen dan net te kleuren. De beste ochtend voor de bamboetuin is direct na zonsopgang; zal ik een vroege wandeling inplannen?';
  if (l.includes('plan') || l.includes('dag') || l.includes('doen'))
    return 'Voorstel voor 14 oktober:\n— 08:00 Arashiyama vóór de drukte\n— 11:30 lunch bij een sobameester in Sagano\n— 15:00 uw privé-theeceremonie in Gion (staat al vast)\n— 19:00 avondwandeling langs Pontocho\n\nZal ik de lunch laten reserveren?';
  if (l.includes('restaurant') || l.includes('eten') || l.includes('diner'))
    return 'Uw tafel bij Kikunoi Honten (15 okt, 19:30) is in aanvraag — bevestiging volgt doorgaans binnen 48 uur. Wilt u een reservelijst? Ik denk aan Gion Sasaki of een counter-kaiseki in Higashiyama, beide via ons netwerk tegen normale prijs.';
  return 'Daar zoek ik het fijne van uit en ik kom er vandaag nog op terug. Voor uw reis naar Kyoto kan ik alvast helpen met de paklijst, documenten, het weer of een dagplanning — zeg het maar.';
}

app.post('/api/ai', auth, async (req, res) => {
  if (req.session.tier === 'guest') {
    return res.status(403).json({ error: 'De persoonlijke AI is exclusief voor leden.' });
  }
  // Alleen role/content overnemen, geschiedenis begrensd op de laatste 12 beurten.
  const history = (Array.isArray(req.body.messages) ? req.body.messages : [])
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }))
    .slice(-12);
  // De Claude API vereist dat het gesprek met een user-beurt begint; de
  // proactieve opener van de AI staat vooraan als assistant — knip die eraf.
  while (history.length && history[0].role !== 'user') history.shift();
  if (!history.length || history[history.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'Geen vraag ontvangen.' });
  }

  if (anthropic) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        system: aiSystemPrompt(req.session.tier),
        messages: history
      });
      const reply = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n')
        .trim();
      return res.json({ reply: reply || 'Excuses, ik heb geen antwoord kunnen formuleren.', source: 'claude' });
    } catch (e) {
      console.error('Claude API-fout, val terug op demo-antwoord:', e.message);
    }
  }
  res.json({ reply: cannedAnswer(history[history.length - 1].content), source: 'demo' });
});

/* ---------- start ---------- */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RTG-portaal draait op http://localhost:${PORT} — open http://localhost:${PORT}/portaal.html`);
});
