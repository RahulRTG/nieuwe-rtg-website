/* School (deelmodule): de toets als meetinstrument -- keuring vooraf, spiegel
   achteraf.

   VOORAF (kern/toetsbouw.js). De docent kiest leerdoelen en een aantal vragen,
   en krijgt te horen wat die toets werkelijk meet: dekking, vraagvorm, overlap,
   tijd, en de taalbelasting van de opgaven zelf. De keuring BOUWT NIET; er
   wordt niets veranderd aan een toets. Ze rekent na en de docent beslist.

   Ze doet dat op ECHTE opgaven: er worden een paar vragen uit dezelfde
   generator getrokken die de toets zelf ook gebruikt. Oordelen over een
   aanname in plaats van over de vraag die er komt, is oordelen over niets.

   ACHTERAF (kern/toetsspiegel.js). Per leerdoel hoe het ging en of het
   onderscheid maakt -- over de groep geteld, zonder een enkele leerling. Onder
   de vijf gemaakte toetsen zegt de spiegel niets, want dan is het getal in
   feite de uitslag van die paar kinderen met een ander etiket erop. */
const { DOELEN } = require('../kern/leerstof');
const { opgave } = require('../kern/leerstof-gen');
const { keur } = require('../kern/toetsbouw');
const { spiegel } = require('../kern/toetsspiegel');

const PROEVEN = 3;

module.exports = (sctx) => {
  const { router, eigenVeld, klasVan } = sctx;

  /* ---------- vooraf: wat meet deze toets ---------- */
  router.post('/school/toets/keuring', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const ids = (Array.isArray(req.body.doelen) ? req.body.doelen : [])
      .map(d => String(d || '').trim()).filter(Boolean).slice(0, 20);
    const perDoel = Math.max(1, Math.min(20, Number(req.body.perDoel) || 3));
    if (!ids.length) return res.status(400).json({ error: 'Kies de leerdoelen die u wilt meten.' });
    const doelen = ids.map(id => eigenVeld(DOELEN, id)).filter(Boolean);
    if (doelen.length !== ids.length)
      return res.status(400).json({ error: 'Een van deze leerdoelen staat niet in de leerlijn.' });

    // echte opgaven uit dezelfde generator als de toets straks gebruikt
    const proeven = {};
    for (const d of doelen) {
      proeven[d.id] = [];
      for (let i = 0; i < PROEVEN; i++) {
        const o = opgave(d.gen);
        proeven[d.id].push({ v: o.v, opties: o.opties || null });
      }
    }
    res.json(keur(doelen, perDoel, proeven, { fase: k.fase || null, groep: k.groep || null }));
  });

  /* ---------- achteraf: hoe deed de toets het ---------- */
  router.post('/school/toets/spiegel', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const t = (k.toetsen || []).find(x => x.id === String(req.body.toetsId || ''));
    if (!t) return res.status(404).json({ error: 'Toets niet gevonden.' });
    /* De werken gaan hier naar binnen omdat het onderscheid per leerling
       gerekend moet worden. Wat eruit komt is geteld over de groep; er komt
       geen sleutel en geen naam mee naar buiten. */
    const uit = spiegel(t, Object.values(t.werk || {}), DOELEN);
    res.json(Object.assign({ toets: { id: t.id, naam: t.naam, soort: t.soort } }, uit));
  });
};
