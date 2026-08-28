/* Routes "festival" (deelmodule): DE PARTNERBAND.

   Zie kern/festival/partner.js voor de doctrine. Deze deur is anders dan de
   rest van dit domein, en daar zit de hele moeilijkheid:

   DE PARTNER BEZIT HET FESTIVAL NIET. Voorstellen doet de organisator, maar
   BEVESTIGEN doet de zaak die genoemd is -- en die is een andere onderneming.
   `mijn(req)` uit ../festival.js controleert eigendom van het festival, en dat
   is hier dus precies de verkeerde vraag. De partnerkant gaat daarom langs
   festivalVind() en wordt gemachtigd op de code van de INGELOGDE ZAAK.

   DIE CODE KOMT UIT DE SESSIE. Zou `zaakCode` uit het lichaam komen, dan
   bevestigt iedereen de band van iedereen en is de tweezijdigheid een
   formulier -- dezelfde fout als een naam of een klok uit de body.

   EEN 404 VOOR ALLES WAT NIET VAN JOU IS. Een zaak die een festival-id raadt,
   hoort niet te kunnen zien of het bestaat. */
'use strict';

module.exports = (kern, deur) => {
  const { app, festival, logActivity, managerOnly, supplierAuth } = kern;
  const { mijn, editieVan, geenFestival, stuur } = deur;

  const nietGevonden = { status: 404, error: 'Deze band bestaat niet.' };
  const wie = (req) => (req.actor && req.actor.name) || null;

  /* ---- de festivalkant ---- */

  app.post('/api/festival/partner', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    const b = req.body || {};
    const r = festival.partnerVoorstel(f.id, editieVan(req), { rol: b.rol, zaak: b.zaak, door: wie(req) });
    if (r.ok) logActivity(req.supplier.code, req.actor, 'stelde ' + r.partner.zaak + ' voor als ' + r.partner.rol);
    stuur(res, r);
  });

  app.post('/api/festival/partner/lijst', supplierAuth, (req, res) => {
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    stuur(res, festival.partnerLijst(f.id, editieVan(req)));
  });

  /* ---- de partnerkant ----

     Deze drie gaan NIET langs mijn(): de antwoordende zaak is niet de eigenaar
     van het festival. De kern weigert alles waar de meegegeven zaakcode niet
     bij hoort, en die code komt hieronder uit req.supplier en nergens anders. */

  /* De drie antwoorden delen hun hele vorm, maar hun PAD staat voluit. Een
     route die met een plus wordt opgebouwd is onzichtbaar voor de schakelkast
     die ze telt (scripts/check.js regel 45), en een pad dat niemand kan tellen
     is een pad dat niemand bewaakt. De gedeelde vorm zit daarom in een handler
     die drie keer wordt opgehangen, niet in een lus over drie namen. */
  const antwoord = (fn, wat) => (req, res) => {
    const b = req.body || {};
    const f = festival.festivalVind(String(b.festival || ''));
    if (!f) return stuur(res, nietGevonden);
    const r = fn(f.id, String(b.editie || ''), {
      id: b.id, deelt: b.deelt, reden: b.reden,
      zaakCode: req.supplier.code,        // uit de SESSIE, nooit uit het lichaam
      door: wie(req)
    });
    if (r.ok) logActivity(req.supplier.code, req.actor, 'antwoordde op een festivalband (' + wat + ')');
    stuur(res, r);
  };
  app.post('/api/festival/partner/bevestig', supplierAuth, antwoord(festival.partnerBevestig, 'bevestigd'));
  app.post('/api/festival/partner/weiger', supplierAuth, antwoord(festival.partnerWeiger, 'geweigerd'));
  app.post('/api/festival/partner/deelt', supplierAuth, antwoord(festival.partnerDeelt, 'deling bijgewerkt'));

  /* Opzeggen kan van BEIDE kanten. De eigenaar herkennen we doordat het
     festival op zijn naam staat; de partner aan zijn zaakcode. Beide wegen
     komen bij dezelfde kernfunctie uit, die zelf nog eens toetst. */
  app.post('/api/festival/partner/opzeg', supplierAuth, (req, res) => {
    const b = req.body || {};
    const f = festival.festivalVind(String(b.festival || ''));
    if (!f) return stuur(res, nietGevonden);
    const eigenaar = f.eigenaar === req.supplier.code;
    const r = festival.partnerOpzeg(f.id, String(b.editie || ''), {
      id: b.id, eigenaar, zaakCode: req.supplier.code, door: wie(req)
    });
    if (r.ok) logActivity(req.supplier.code, req.actor, 'zegde een festivalband op');
    stuur(res, r);
  });

  /* DE POSTBUS: welke voorstellen wachten op MIJ. Zonder deze ingang moet een
     partner het festival-id van iemand anders kennen om te kunnen antwoorden,
     en dan is de band alsnog een telefoontje. Hij toont alleen banden waarin
     deze zaak zelf genoemd is. */
  app.post('/api/festival/partner/inbox', supplierAuth, (req, res) => {
    const mij = req.supplier.code;
    const uit = [];
    for (const f of Object.values((kern.db.data.festivals || {}))) {
      for (const e of Object.values(f.edities || {})) {
        for (const p of Object.values(e.partners || {})) {
          if (p.zaak !== mij) continue;
          uit.push({ festival: f.id, festivalNaam: f.naam, editie: e.id, jaar: e.jaar,
            id: p.id, rol: p.rol, stand: p.stand, deelt: p.deelt || [], at: p.at });
        }
      }
    }
    res.json({ ok: true, banden: uit });
  });
};
