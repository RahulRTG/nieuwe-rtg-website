/* Backoffice (deelmodule): DE STAND VAN DE BELEIDSMOTOR IN DE SCHADUW.

   AUTHORITY.md fase 1: de motor loopt mee met de vier kantoordeuren en telt of
   hij het eens is met de poort die vandaag afdwingt (besluit A1), en welke
   kantoorroutes zonder bekende poort liepen (besluit A3). De meting woont in
   kern/beleidsmotor/; deze route leest alleen.

   boardroomAuth en niet officeAuth, om dezelfde reden als ./mensdeur.js: de lijst
   routes zonder poort is een kaart van de gaten, en die hoort niet leesbaar te
   zijn voor de gedeelde code. */
module.exports = (octx) => {
  const { kern } = octx;
  const { app, kluisAuth, boardroomAuth, beleidsmotor } = kern;

  app.post('/api/office/beleidsmotor', boardroomAuth, (req, res) => {
    if (!beleidsmotor || typeof beleidsmotor.stand !== 'function') {
      return res.status(503).json({ error: 'De beleidsmotor is niet bedraad in deze server.' });
    }
    res.json(Object.assign({}, beleidsmotor.stand(), { afdwingen: beleidsmotor.afdwingen ? beleidsmotor.afdwingen.overzicht() : null }));
  });

  /* DE TOEGANGSREVIEW (fase 8): wie houdt een kantoorzetel. Dat is een lijst
     mensen, dus hij vraagt een REDEN en laat een regel in het inzagejournaal na
     die VASTSTAAT voordat de lijst wordt samengesteld; anders weigeren we. */
  app.post('/api/office/beleidsmotor/review', boardroomAuth, async (req, res) => {
    if (!beleidsmotor || typeof beleidsmotor.review !== 'function') {
      return res.status(503).json({ error: 'De beleidsmotor is niet bedraad in deze server.' });
    }
    const reden = String((req.body || {}).reden || '').trim().slice(0, 300);
    if (reden.length < 5) return res.status(400).json({ error: 'Geef een reden op voor deze review; die komt in het inzagejournaal.' });
    const actor = require('../../opzet/envelop').wie(req);
    const spoor = await require('../../inzagelog').noteerVast({ door: { id: actor, naam: actor || 'boardroom' },
      over: 'alle houders van een kantoorzetel', waarom: reden, bron: 'office/beleidsmotor/review' });
    if (!spoor.ok) return res.status(spoor.status || 503).json({ error: spoor.error, spoor: spoor.reden });
    res.json(Object.assign({ ok: true }, beleidsmotor.review()));
  });

  /* DE SIMULATOR (fase 8): wat verandert er aan de deuren van deze codenaam als
     hij een zetel erbij krijgt of kwijtraakt? Er wordt niets veranderd, maar het
     is een vraag OVER een mens: dus boardroom, een reden en een journaalregel die
     vaststaat voordat het antwoord er is -- dezelfde regels als de review. */
  app.post('/api/office/beleidsmotor/simulatie', boardroomAuth, async (req, res) => {
    if (!beleidsmotor || typeof beleidsmotor.simuleer !== 'function') {
      return res.status(503).json({ error: 'De beleidsmotor is niet bedraad in deze server.' });
    }
    const b = req.body || {};
    const reden = String(b.reden || '').trim().slice(0, 300);
    if (reden.length < 5) return res.status(400).json({ error: 'Geef een reden op voor deze simulatie; die komt in het inzagejournaal.' });
    const t = await kern.keyVanCodenaam(b.codenaam);
    if (!t) return res.status(404).json({ error: 'Deze codenaam kennen we niet.' });
    const actor = require('../../opzet/envelop').wie(req);
    const spoor = await require('../../inzagelog').noteerVast({ door: { id: actor, naam: actor || 'boardroom' },
      over: t.codename, waarom: reden, bron: 'office/beleidsmotor/simulatie' });
    if (!spoor.ok) return res.status(spoor.status || 503).json({ error: spoor.error, spoor: spoor.reden });
    res.json(Object.assign({ ok: true, codenaam: t.codename }, beleidsmotor.simuleer(t.key, { plus: b.plus, min: b.min })));
  });

  /* WAAROM MAG IK HIER (NIET) IN? Alleen over zichzelf, en dus alleen voor wie
     een zelf HEEFT: een kantoorsessie op naam (kluisAuth). De gedeelde code
     krijgt de weigering van die poort, en die zegt precies wat hij wilde weten
     -- log in met uw eigen RTG-account. Een weigering zonder reden laat iemand
     raden; dit noemt per deur welke eis viel. */
  app.post('/api/office/beleidsmotor/waarom', kluisAuth, (req, res) => {
    if (!beleidsmotor || typeof beleidsmotor.waarom !== 'function') {
      return res.status(503).json({ error: 'De beleidsmotor is niet bedraad in deze server.' });
    }
    res.json({ ok: true, deuren: beleidsmotor.waarom(req),
      grens: 'Alleen over uzelf. Dit zegt wat de deuren vandaag zouden besluiten; de poorten zelf beslissen nog.' });
  });
};
