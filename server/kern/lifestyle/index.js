/* Kern-module "lifestyle" (kern/lifestyle): De Rechterhand -- de premium suite
   van de Lifestyle Pass (het hoogste dienstenniveau), op een prive-dossier per
   lid. Rahul belooft nooit een boeking of toegang die hij niet zeker kan
   waarmaken; hij noteert en verwijst eerlijk naar een mens.

   Dit is de spil: het dossier per lid en het Concierge-bureau (verzoeken met
   een statusketen, vaste voorkeuren die meereizen, en de kantoorkant waar een
   ECHTE concierge de keten doorloopt en het lid meldingen stuurt). Wat waar
   woont:
     ./verzoek   het concierge-verzoek: een schil over de concierge-lus in
                 kern/bureau (CONCIERGE.md stap 0)
     ./dossier   het Bezittingenregister (family-office light) en
                 Gezondheid & welzijn (afspraken + prive-dossier)
     ./briefing  het overkoepelende Rechterhand-overzicht en de briefing
                 van Rahul in de u-vorm
   Gedeelde context (db, save, anthropic, liveCodename) vanuit server.js. */
module.exports = ({ db, save, crypto, anthropic, liveCodename, notify, kern }) => {
  /* Het levensdossier is GEDEELD met rechterhand, bureau en levensgraaf, en
     elk domein schrijft alleen zijn eigen velden. Zie server/kern/levensdossier.js. */
  const mijn = require('../levensdossier')({ db }).voor('lifestyle');
  const nu = () => new Date().toISOString();
  const rid = () => crypto.randomBytes(4).toString('hex');
  const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n || 200);
  const vandaag = () => new Date().toISOString().slice(0, 10);
  const isDatum = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

  /* De vijf velden van DIT domein. De andere twintig horen bij rechterhand en
     bureau; die maakt deze functie met opzet niet aan. */
  function L(key) {
    for (const veld of ['verzoeken', 'bezittingen', 'afspraken', 'dossier', 'voorkeuren']) mijn.veld(key, veld);
    return mijn.lees(key);
  }

  function voorkeurenZet(key, body) {
    const l = L(key);
    const v = l.voorkeuren;
    for (const veld of ['dieet', 'restaurant', 'hotelkamer', 'stoel', 'chauffeur', 'bloemen', 'overig'])
      if (body[veld] !== undefined) v[veld] = schoon(body[veld], 160);
    save();
    return { status: 200, ok: true, voorkeuren: v };
  }

  // de gedeelde ctx voor de deelbestanden
  /* Het concierge-verzoek is een schil over de concierge-lus in kern/bureau (zie
     ./verzoek.js). Het Privékantoor wordt NA deze module gemonteerd, dus komt het
     laat binnen: via `kern`, en alleen `kern.bureau` en `kern.bureauBalie` --
     deze module leest verder niets uit de kern. */
  const verzoek = require('./verzoek')({ save, schoon, rid, nu, notify, liveCodename, L, mijn,
    bureau: () => kern.bureau, balie: () => kern.bureauBalie });
  const ctx = { db, save, anthropic, liveCodename, nu, rid, schoon, vandaag, isDatum, L, verzoekenAlle: verzoek.verzoekenAlle };
  const dossier = require('./dossier')(ctx);
  ctx.bezittingen = dossier.bezittingen;
  ctx.gezondheid = dossier.gezondheid;
  const api = {
    conciergeDesk: verzoek.conciergeDesk, conciergeVoortgang: verzoek.conciergeVoortgang,
    conciergeVraag: verzoek.conciergeVraag, conciergeIntrek: verzoek.conciergeIntrek, conciergeVerzoeken: verzoek.conciergeVerzoeken,
    lifestyleVoorkeuren: (key) => ({ status: 200, voorkeuren: L(key).voorkeuren }), lifestyleVoorkeurenZet: voorkeurenZet
  };
  Object.assign(api, dossier);
  Object.assign(api, require('./briefing')(ctx));
  return api;
};
