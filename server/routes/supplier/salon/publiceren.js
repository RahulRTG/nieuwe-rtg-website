/* Salon (deelmodule): publiceren: een post plaatsen, aanbiedingen met
   claimcodes (maken en verzilveren) en polls. Kan alleen met een compleet
   Salon-profiel (eisSalonProfiel komt mee vanuit routes/supplier/salon.js). */
module.exports = (kern, eisSalonProfiel) => {
  const { app, broadcastSync, db, express, talen, logActivity, salonNaarVolgers, save, schoon,
          sseToOffice, supplierAuth, media, salon } = kern;
app.post('/api/supplier/salon/post', express.json({ limit: '6mb' }), supplierAuth, async (req, res) => {
  /* Publiceren namens de zaak is management-werk, net als de vijf andere
     Salon-routes (deal, poll, bio, folder, stats). Deze was de enige zonder die
     poort en tegelijk de zwaarste: 600 tekens vrije tekst plus een foto, onder
     de naam van de zaak, naar alle volgers. eisSalonProfiel controleert of de
     Salon aan staat en het profiel compleet is -- niet WIE er publiceert. */
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  if (!eisSalonProfiel(req, res)) return;
  const text = String(req.body.text || '').trim().slice(0, 600);
  if (!text) return res.status(400).json({ error: 'Schrijf eerst een tekst.' });
  let photo = null;
  const pi = parseInt(req.body.photoIndex, 10);
  // Een bestaande pagina-foto is al een /media-verwijzing; een nieuwe upload
  // bewaren we in de mediastore en verwijzen we naar (nooit base64 in db.data).
  if (Number.isInteger(pi) && req.supplier.photos && req.supplier.photos[pi]) photo = req.supplier.photos[pi];
  else if (typeof req.body.image === 'string') photo = await media.bewaarPubliek(req.body.image, 1.5 * 1024 * 1024);
  const post = {
    id: Date.now(),
    author: req.supplier.name, tier: 'partner', partner: true, partnerCode: req.supplier.code,
    place: req.supplier.city, visual: null, photo,
    text, lang: talen.taalVan(req.body.lang),
    at: new Date().toISOString(),
    baseLikes: 0, likedBy: {}, comments: []
  };
  db.data.posts.unshift(post);
  salon.kap();   // het venster: een grens, op een plek (kern/salon)
  save();
  logActivity(req.supplier.code, req.actor, 'publiceerde op De Salon');
  salonNaarVolgers(req.supplier, text);
  broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  sseToOffice('sync', { scope: 'salon' });
  res.json({ ok: true, postId: post.id });
});

app.post('/api/supplier/salon/deal', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  if (!eisSalonProfiel(req, res)) return;
  const titel = schoon(req.body.titel, 80);
  const text = schoon(req.body.text, 400);
  if (!titel || !text) return res.status(400).json({ error: 'Geef de aanbieding een titel en een tekst.' });
  const geldigTot = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.geldigTot || '')) ? req.body.geldigTot : null;
  const post = {
    id: Date.now(),
    author: req.supplier.name, tier: 'partner', partner: true, partnerCode: req.supplier.code,
    place: req.supplier.city, visual: null, photo: null,
    text, lang: 'nl', at: new Date().toISOString(), baseLikes: 0, likedBy: {}, comments: [],
    deal: { titel, geldigTot, claims: [] }
  };
  db.data.posts.unshift(post);
  salon.kap();   // het venster: een grens, op een plek (kern/salon)
  save();
  logActivity(req.supplier.code, req.actor, 'zette een aanbieding op De Salon: "' + titel + '"');
  salonNaarVolgers(req.supplier, '' + titel);
  broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  res.json({ ok: true, postId: post.id });
});

app.post('/api/supplier/salon/poll', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  if (!eisSalonProfiel(req, res)) return;
  const vraag = schoon(req.body.vraag, 140);
  const opties = (Array.isArray(req.body.opties) ? req.body.opties : []).map(o => schoon(o, 60)).filter(Boolean).slice(0, 4);
  if (!vraag || opties.length < 2) return res.status(400).json({ error: 'Geef een vraag en minstens twee opties.' });
  const post = {
    id: Date.now(),
    author: req.supplier.name, tier: 'partner', partner: true, partnerCode: req.supplier.code,
    place: req.supplier.city, visual: null, photo: null,
    text: vraag, lang: 'nl', at: new Date().toISOString(), baseLikes: 0, likedBy: {}, comments: [],
    poll: { vraag, opties: opties.map(t2 => ({ tekst: t2, stemmen: [] })) }
  };
  db.data.posts.unshift(post);
  salon.kap();   // het venster: een grens, op een plek (kern/salon)
  save();
  logActivity(req.supplier.code, req.actor, 'zette een poll op De Salon');
  salonNaarVolgers(req.supplier, '' + vraag);
  broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  res.json({ ok: true, postId: post.id });
});

};
