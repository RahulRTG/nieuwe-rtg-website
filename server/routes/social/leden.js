/* Sociale laag (deelmodule): de RTG-ledenkant: zoeken en verbinden op
   codenaam, DM en (video)bellen. Snaps en 24-uurs verhalen staan in
   ./snaps.js. Gemount vanuit routes/social.js op de gedeelde kern. */
module.exports = (sctx) => {
  const { kern, isKindVanGezin, rtfOnbSess, rtfSociaal } = sctx;
  const { app, auth, geenGast, db, socialZoek, socialVerbind, socialAntwoord,
          socialConnecties, liveCodename, connectieTussen, verbActief, codenaamVan,
          sseToCustomer, isGeblokkeerd } = kern;

// leden en RTF-gezinsleden zoeken op codenaam (nooit op echte naam).
// De eigen naamlaag zoekt mee: wie zijn vriend een eigen naam gaf, vindt
// hem ook onder die naam -- alleen in het eigen account.
app.post('/api/member/find', auth, async (req, res) => {
  if (geenGast(req, res)) return;
  const q = String(req.body.q || '');
  const viaEigen = kern.naamlaag ? kern.naamlaag.aliasNaar(req.session.key, q) : null;
  const results = await socialZoek(req.session.key, viaEigen || q);
  res.json({ results: kern.naamlaag ? kern.naamlaag.verrijk(req.session.key, results, 'codename') : results });
});

// verzoek sturen (mag ook naar een RTF-codenaam); wachtende bestaanscheck,
// dus de route wacht mee (zie codeBestaat in kern/sociaal.js)
app.post('/api/member/connect', auth, async (req, res) => {
  if (geenGast(req, res)) return;
  const r = await socialVerbind(req.session.key, String(req.body.key || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, status: r.st });
});

// verzoek beantwoorden
app.post('/api/member/connect/respond', auth, (req, res) => {
  if (geenGast(req, res)) return;
  const r = socialAntwoord(req.session.key, String(req.body.key || ''), req.body.action);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, status: r.st });
});

// mijn vrienden + openstaande verzoeken + ongelezen tellers
app.post('/api/member/connections', auth, (req, res) => {
  if (geenGast(req, res)) return;
  const sc = socialConnecties(req.session.key);
  // de eigen naamlaag: elk contact draagt (alleen hier) het eigen etiket mee
  const eigen = l => kern.naamlaag ? kern.naamlaag.verrijk(req.session.key, l, 'codename') : l;
  res.json({ me: req.session.key, codename: liveCodename(req.session), connections: eigen(sc.connections), requests: eigen(sc.requests) });
});

// gesprek ophalen (en als gelezen markeren). Moedertaal: heeft de lezer een
// vaste taal (db.data.memberTaal), dan komen de berichten van de ander
// vertaald binnen -- iedereen praat de eigen taal, iedereen leest de zijne.
app.post('/api/member/dm', auth, async (req, res) => {
  if (geenGast(req, res)) return;
  const ander = String(req.body.withKey || '');
  const c = connectieTussen(req.session.key, ander);
  if (!verbActief(c)) return res.status(403).json({ error: 'Je bent nog niet verbonden met deze codenaam.' });
  /* Uit de communicatiekern (kern/comm/dm), niet meer uit een eigen voorraad.
     De vorm die hieronder de deur uitgaat is ongewijzigd -- schermen die er al
     waren merken niets -- maar er is nog maar EEN plek waar deze berichten
     staan. */
  const brug = kern.commDm;
  if (!brug) return res.status(503).json({ error: 'De communicatiekern is niet beschikbaar.' });
  brug.markeerGelezen(req.session.key, ander);
  let uit = brug.berichten(req.session.key, ander, 80);
  const mijnTaal = (db.data.memberTaal || {})[req.session.key];
  if (mijnTaal) {
    const vertaler = require('../../translate');
    uit = await Promise.all(uit.map(async m => {
      if (m.from === req.session.key || !m.text) return m;
      try {
        const t = await vertaler.translate(m.text, mijnTaal, m.lang || undefined);
        return t.translated ? { ...m, text: t.text, vertaaldUit: t.from } : m;
      } catch (e) { return m; }
    }));
  }
  /* mij: is dit bericht van mij? De client kent zijn eigen sessiesleutel niet
     (en hoort die niet te kennen), maar moet wel weten welke kant de bel op
     staat. Een extra veld, dus bestaande lezers merken er niets van. */
  res.json({ messages: uit.map(m => ({ ...m, mij: m.from === req.session.key })),
    codename: codenaamVan(ander), taal: mijnTaal || null });
});

/* bericht sturen; optioneel met een gedeelde Salon-post of een stuk uit de
   Media OS erbij.

   HET STUK GAAT MEE ALS ID EN NIET ALS KOPIE, en dat is hier meer dan
   zuinigheid. De ontvanger lost het op met ZIJN EIGEN sessie (/api/mediaos/
   stuk), dus zijn eigen deuren gelden: wat achter de 18+-deur staat of door de
   maker is weggehaald, is via een gesprek niet alsnog binnen te halen. Een
   bevroren kopie in het bericht zou precies dat wel doen -- en zou bovendien
   blijven staan nadat de maker hem had weggehaald.

   Aan de verzendkant staat dezelfde controle: je deelt alleen wat je zelf op
   dit moment kunt zien. Anders is een gesprek een manier om te toetsen welke
   id's bestaan. */
app.post('/api/member/dm/send', auth, async (req, res) => {
  if (geenGast(req, res)) return;
  const ander = String(req.body.toKey || '');
  const c = connectieTussen(req.session.key, ander);
  if (!verbActief(c)) return res.status(403).json({ error: 'Je bent nog niet verbonden met deze codenaam.' });
  const text = String(req.body.text || '').slice(0, 500).trim();
  // de 9+-poort: de vriendenchat deelt de leeftijdsgrens met de rest van de socials
  if (text) { const keur9 = require('../../kern/veilig').keur(text); if (!keur9.ok) return res.status(400).json({ error: keur9.reden }); }
  let postDeel = null;
  if (req.body.postId != null) {
    const p = db.data.posts.find(x => x.id === Number(req.body.postId));
    if (p) postDeel = { id: p.id, author: p.author, place: p.place, text: String(p.text || '').slice(0, 120), photo: p.photo || null };
  }
  /* Een gedeeld mediastuk (uit de Media OS-tak) reist NET ALS een gedeelde
     post als bijlage mee -- maar sinds de DM's in de communicatiekern wonen,
     gaat hij daar doorheen en niet meer rechtstreeks in memberChats. Alleen
     het id plus de vorm, zodat het gesprek een leesbare regel heeft ook als
     de ontvanger er niet bij kan; titel en maker komen bij het OPENEN uit de
     Media OS -- dan klopt het ook nog als de maker de naam verandert of het
     stuk weghaalt. */
  let stukDeel = null;
  if (req.body.stukId != null) {
    if (!kern.mediaStuk) return res.status(409).json({ error: 'De Media OS draait hier niet.' });
    const sid = String(req.body.stukId || '');
    const bij = await kern.mediaStuk(req.session, sid);
    if (!bij || bij.error) return res.status(bij && bij.status === 404 ? 404 : 403).json({ error: (bij && bij.error) || 'Dit stuk kunt u niet delen.' });
    stukDeel = { id: sid, vorm: (bij.stuk || {}).vorm || null };
  }
  if (!text && !postDeel && !stukDeel) return res.status(400).json({ error: 'Leeg bericht.' });
  /* Het bericht draagt zijn brontaal mee (de moedertaal van de schrijver),
     zodat de leeskant precies weet waarvandaan te vertalen. Bewaren doet de
     communicatiekern; de controles hierboven -- verbonden, 9+-poort, lengte --
     blijven hier, want die gaan over vriendschap en veiligheid en niet over
     berichten. */
  const brug = kern.commDm;
  if (!brug) return res.status(503).json({ error: 'De communicatiekern is niet beschikbaar.' });
  const msg = brug.stuur(req.session.key, ander, { tekst: text, post: postDeel, stuk: stukDeel,
    lang: (db.data.memberTaal || {})[req.session.key] || null });
  const mijnNaam = liveCodename(req.session);
  sseToCustomer(ander, 'social', { kind: 'dm', from: req.session.key, codename: mijnNaam, text: msg.text, post: msg.post, stuk: msg.stuk, at: msg.at });
  res.json({ ok: true, message: msg });
});

// bel-signalering: pure doorgeefluik tussen twee verbonden leden
app.post('/api/member/call', auth, (req, res) => {
  if (geenGast(req, res)) return;
  const ander = String(req.body.toKey || '');
  if (isGeblokkeerd(req.session.key, ander)) return res.status(403).json({ error: 'Dit contact is niet beschikbaar.' });
  const c = connectieTussen(req.session.key, ander);
  if (!verbActief(c)) return res.status(403).json({ error: 'Je bent nog niet verbonden met deze codenaam.' });
  const kind = String(req.body.kind || '');
  if (!['ring', 'accept', 'offer', 'answer', 'ice', 'hangup', 'decline', 'busy'].includes(kind))
    return res.status(400).json({ error: 'Onbekend signaal.' });
  sseToCustomer(ander, 'call', {
    kind, from: req.session.key, codename: liveCodename(req.session),
    video: !!req.body.video, payload: req.body.payload || null
  });
  res.json({ ok: true });
});

/* Snaps en 24-uurs verhalen staan in ./snaps.js (uitgeknipt op de 10 kB-grens,
   op de naad van het onderwerp). */
};
