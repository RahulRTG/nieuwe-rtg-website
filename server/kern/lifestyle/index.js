/* Kern-module "lifestyle" (kern/lifestyle): De Rechterhand -- de premium suite
   van de Lifestyle Pass (het hoogste dienstenniveau), op een prive-dossier per
   lid. Rahul belooft nooit een boeking of toegang die hij niet zeker kan
   waarmaken; hij noteert en verwijst eerlijk naar een mens.

   Dit is de spil: het dossier per lid en het Concierge-bureau (verzoeken met
   een statusketen, vaste voorkeuren die meereizen, en de kantoorkant waar een
   ECHTE concierge de keten doorloopt en het lid meldingen stuurt). Wat waar
   woont:
     ./dossier   het Bezittingenregister (family-office light) en
                 Gezondheid & welzijn (afspraken + prive-dossier)
     ./briefing  het overkoepelende Rechterhand-overzicht en de briefing
                 van Rahul in de u-vorm
   Gedeelde context (db, save, anthropic, liveCodename) vanuit server.js. */
module.exports = ({ db, save, crypto, anthropic, liveCodename, notify }) => {
  const nu = () => new Date().toISOString();
  const rid = () => crypto.randomBytes(4).toString('hex');
  const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n || 200);
  const vandaag = () => new Date().toISOString().slice(0, 10);
  const isDatum = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

  function L(key) {
    if (!db.data.lifestyle) db.data.lifestyle = {};
    if (!db.data.lifestyle[key]) db.data.lifestyle[key] = { verzoeken: [], bezittingen: [], afspraken: [], dossier: [], voorkeuren: {} };
    const l = db.data.lifestyle[key];
    for (const veld of ['verzoeken', 'bezittingen', 'afspraken', 'dossier']) if (!Array.isArray(l[veld])) l[veld] = [];
    if (!l.voorkeuren || typeof l.voorkeuren !== 'object') l.voorkeuren = {};
    return l;
  }

  /* ================= Concierge-bureau ================= */
  const CATEGORIEEN = ['reis', 'restaurant', 'evenement', 'cadeau', 'vervoer', 'huishouden', 'overig'];
  function conciergeVraag(key, body) {
    const titel = schoon(body.titel, 100);
    if (!titel) return { status: 400, error: 'Waarmee kunnen wij u van dienst zijn?' };
    const l = L(key);
    if (l.verzoeken.filter(v => v.status !== 'afgerond' && v.status !== 'ingetrokken').length >= 50)
      return { status: 400, error: 'U heeft veel lopende verzoeken. Wij ronden er graag eerst een paar met u af.' };
    const v = { id: rid(), titel, details: schoon(body.details, 800), categorie: CATEGORIEEN.includes(body.categorie) ? body.categorie : 'overig',
      status: 'aangevraagd', at: nu(), updates: [{ status: 'aangevraagd', op: nu(), notitie: 'Uw verzoek is genoteerd. Een van onze mensen neemt het persoonlijk op.' }] };
    l.verzoeken.unshift(v); save();
    return { status: 200, ok: true, verzoek: v };
  }
  function conciergeIntrek(key, id) {
    const l = L(key);
    const v = l.verzoeken.find(x => x.id === id);
    if (!v) return { status: 404, error: 'Dit verzoek vinden wij niet terug.' };
    if (v.status === 'afgerond') return { status: 400, error: 'Dit verzoek is al afgerond.' };
    v.status = 'ingetrokken'; v.updates.push({ status: 'ingetrokken', op: nu(), notitie: 'Op uw verzoek ingetrokken.' }); save();
    return { status: 200, ok: true };
  }
  function voorkeurenZet(key, body) {
    const l = L(key);
    const v = l.voorkeuren;
    for (const veld of ['dieet', 'restaurant', 'hotelkamer', 'stoel', 'chauffeur', 'bloemen', 'overig'])
      if (body[veld] !== undefined) v[veld] = schoon(body[veld], 160);
    save();
    return { status: 200, ok: true, voorkeuren: v };
  }

  /* ================= De concierge-kant (RTG-kantoor) =================
     Een echte concierge in het kantoor pakt de verzoeken op en loopt de
     statusketen door. Elke stap zet een update in het verzoek van het lid en
     stuurt het lid een melding -- zo bevestigt een MENS de boeking, nooit de AI. */
  const CONCIERGE_STATUS = ['in behandeling', 'bevestigd', 'afgerond', 'afgewezen'];
  const OPEN = s => !['afgerond', 'afgewezen', 'ingetrokken'].includes(s);
  const STAP_NOTITIE = {
    'in behandeling': 'Wij zijn ermee aan de slag.',
    bevestigd: 'Het is voor u geregeld en bevestigd.',
    afgerond: 'Afgerond. Wij wensen u een fijne ervaring.',
    afgewezen: 'Helaas is dit niet gelukt; wij nemen persoonlijk contact met u op.'
  };
  function conciergeDesk() {
    const uit = [];
    for (const [key, l] of Object.entries(db.data.lifestyle || {})) {
      for (const v of (l.verzoeken || [])) if (OPEN(v.status))
        uit.push({ key, codenaam: liveCodename ? liveCodename(key) : '', id: v.id, titel: v.titel, details: v.details,
          categorie: v.categorie, status: v.status, at: v.at, laatste: (v.updates[v.updates.length - 1] || {}).notitie || '',
          voorkeuren: l.voorkeuren || {} });
    }
    uit.sort((a, b) => String(a.at).localeCompare(String(b.at)));
    return { status: 200, verzoeken: uit, statussen: CONCIERGE_STATUS };
  }
  function conciergeVoortgang(key, id, status, notitie) {
    const l = db.data.lifestyle && db.data.lifestyle[key];
    const v = l && (l.verzoeken || []).find(x => x.id === id);
    if (!v) return { status: 404, error: 'Dit verzoek is er niet meer.' };
    if (!CONCIERGE_STATUS.includes(status)) return { status: 400, error: 'Onbekende status.' };
    v.status = status;
    v.updates.push({ status, op: nu(), notitie: schoon(notitie, 300) || STAP_NOTITIE[status] });
    if (notify) { try { notify(key, { title: 'De Rechterhand', body: 'Uw verzoek "' + v.titel + '" is nu: ' + status + '.', scope: 'lifestyle' }); } catch (e) {} }
    save();
    return { status: 200, ok: true };
  }

  // de gedeelde ctx voor de deelbestanden
  const ctx = { db, save, anthropic, liveCodename, nu, rid, schoon, vandaag, isDatum, L };
  const dossier = require('./dossier')(ctx);
  ctx.bezittingen = dossier.bezittingen;
  ctx.gezondheid = dossier.gezondheid;
  const api = {
    conciergeDesk, conciergeVoortgang,
    conciergeVraag, conciergeIntrek, conciergeVerzoeken: (key) => ({ status: 200, verzoeken: L(key).verzoeken, categorieen: CATEGORIEEN }),
    lifestyleVoorkeuren: (key) => ({ status: 200, voorkeuren: L(key).voorkeuren }), lifestyleVoorkeurenZet: voorkeurenZet
  };
  Object.assign(api, dossier);
  Object.assign(api, require('./briefing')(ctx));
  return api;
};
