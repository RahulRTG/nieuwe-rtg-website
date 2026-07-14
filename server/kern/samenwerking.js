/* De samenwerkingslaag: koppelt content creators en leveranciers met EGn knop.

   Twee bewegingen, allebei uitmondend in EGn samenwerking:
   1. EEN KNOP VOOR DE CREATOR: stel een leverancier een samenwerking voor.
   2. EEN KNOP VOOR DE LEVERANCIER: plaats een oproep voor content creators;
      creators reageren en de leverancier kiest er een.

   Een leverancier kan ook rechtstreeks een creator een voorstel sturen. Elke
   samenwerking heeft een status (voorgesteld -> geaccepteerd/afgewezen) en een
   kort bericht. maakSamenwerking(state) volgt het vaste kern-patroon. */

const CONTENT_SOORTEN = ['reel', 'post', 'story', 'video', 'vlog', 'review', 'unboxing', 'livestream', 'fotoshoot', 'campagne'];

function maakSamenwerking({ db, save, crypto, findSupplier, notifySupplier, sseToSupplier, schoon }) {
  const id = (p) => (p || 'x') + crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));
  const getal = (v, max) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0; };

  function store() {
    if (!Array.isArray(db.data.samenwerkingen)) db.data.samenwerkingen = [];
    if (!Array.isArray(db.data.creatorOproepen)) db.data.creatorOproepen = [];
    return db.data;
  }
  function isCreator(s) { return !!s && ((db.data.supplierTypes[s.type] || {}).caps || []).includes('creator'); }
  function creatorInfo(s) {
    const c = s.creator || {};
    const bereik = (c.platforms || []).reduce((n, p) => n + (p.volgers || 0), 0);
    return { code: s.code, name: s.name, city: s.city || null, niche: c.niche || null, bereik, platforms: (c.platforms || []).length };
  }
  function supplierInfo(s) {
    const t = db.data.supplierTypes[s.type] || {};
    return { code: s.code, name: s.name, city: s.city || null, type: s.type, typeLabel: t.label || s.type, icon: t.icon || '🏷️' };
  }

  // Lijsten om te bladeren (met een limiet; voor grote aantallen komt er later
  // zoeken bij, net als elders in het platform).
  function creators(limit) {
    store();
    return db.data.suppliers.filter(isCreator).slice(0, limit || 100).map(creatorInfo);
  }
  function leveranciers(limit) {
    store();
    return db.data.suppliers.filter(s => !isCreator(s)).slice(0, limit || 100).map(supplierInfo);
  }

  function swPubliek(sw, mijnCode) {
    const van = findSupplier(sw.vanCode), naar = findSupplier(sw.naarCode);
    const ander = sw.vanCode === mijnCode ? naar : van;
    return {
      id: sw.id, status: sw.status, bericht: sw.bericht, soort: sw.soort || null, budget: sw.budget || 0,
      richting: sw.vanCode === mijnCode ? 'uit' : 'in', at: sw.at, uitOproep: !!sw.uitOproep,
      ander: ander ? (isCreator(ander) ? creatorInfo(ander) : supplierInfo(ander)) : { code: '?', name: 'onbekend' }
    };
  }

  // EEN KNOP: een samenwerking voorstellen aan een andere partij.
  function stelVoor(vanS, naarCode, data) {
    store();
    naarCode = String(naarCode || '').toUpperCase();
    const naar = findSupplier(naarCode);
    if (!naar || naar.code === vanS.code) return { error: 'Kies een geldige partij om mee samen te werken.' };
    // creator <-> leverancier: precies een van beide moet een creator zijn
    if (isCreator(vanS) === isCreator(naar)) return { error: 'Een samenwerking loopt tussen een creator en een leverancier.' };
    const dubbel = db.data.samenwerkingen.find(x => x.status === 'voorgesteld' &&
      ((x.vanCode === vanS.code && x.naarCode === naarCode) || (x.vanCode === naarCode && x.naarCode === vanS.code)));
    if (dubbel) return { error: 'Er loopt al een openstaand voorstel met deze partij.' };
    const sw = {
      id: id('sw'), vanCode: vanS.code, naarCode, initiatiefCreator: isCreator(vanS),
      bericht: scho(data.bericht, 400), soort: CONTENT_SOORTEN.includes(data.soort) ? data.soort : null,
      budget: Math.round(getal(data.budget, 1e7)), status: 'voorgesteld', at: nu(), uitOproep: false
    };
    db.data.samenwerkingen.unshift(sw);
    db.data.samenwerkingen = db.data.samenwerkingen.slice(0, 5000);
    save();
    if (notifySupplier) notifySupplier(naarCode, { icon: '🤝', title: 'Nieuw samenwerkingsvoorstel', body: vanS.name + ' wil samenwerken.' });
    if (sseToSupplier) sseToSupplier(naarCode, 'sync', { scope: 'samenwerking' });
    return { ok: true, id: sw.id };
  }

  // Beslissen over een binnenkomend voorstel.
  function beslis(s, swId, actie) {
    store();
    const sw = db.data.samenwerkingen.find(x => x.id === swId);
    if (!sw) return { error: 'Voorstel niet gevonden.' };
    if (sw.naarCode !== s.code) return { error: 'Dit voorstel is niet aan u gericht.' };
    if (sw.status !== 'voorgesteld') return { error: 'Dit voorstel is al afgehandeld.' };
    sw.status = actie === 'accepteren' ? 'geaccepteerd' : 'afgewezen';
    sw.beslistOp = nu();
    save();
    if (notifySupplier) notifySupplier(sw.vanCode, { icon: sw.status === 'geaccepteerd' ? '✅' : '✖️', title: 'Samenwerking ' + sw.status, body: s.name + ' heeft gereageerd.' });
    if (sseToSupplier) sseToSupplier(sw.vanCode, 'sync', { scope: 'samenwerking' });
    return { ok: true, status: sw.status };
  }

  // Mijn samenwerkingen (in + uit).
  function mijn(s) {
    store();
    const lijst = db.data.samenwerkingen.filter(x => x.vanCode === s.code || x.naarCode === s.code).map(x => swPubliek(x, s.code));
    return { in: lijst.filter(x => x.richting === 'in'), uit: lijst.filter(x => x.richting === 'uit') };
  }

  /* ---- oproepen: de leverancier roept creators op ---- */
  function oproepPubliek(op, mijnCode) {
    const s = findSupplier(op.supplierCode);
    return {
      id: op.id, titel: op.titel, omschrijving: op.omschrijving, soort: op.soort || null, budget: op.budget || 0,
      open: op.open, at: op.at, van: s ? supplierInfo(s) : { code: op.supplierCode, name: 'onbekend' },
      aantalReacties: (op.reacties || []).length,
      reacties: op.supplierCode === mijnCode ? (op.reacties || []).map(r => { const c = findSupplier(r.creatorCode); return { creatorCode: r.creatorCode, bericht: r.bericht, at: r.at, status: r.status, creator: c ? creatorInfo(c) : { code: r.creatorCode, name: 'onbekend' } }; }) : undefined,
      ikReageerde: (op.reacties || []).some(r => r.creatorCode === mijnCode)
    };
  }
  function plaatsOproep(s, data) {
    store();
    if (isCreator(s)) return { error: 'Een oproep voor creators plaats je als leverancier.' };
    const titel = scho(data.titel, 80);
    if (!titel) return { error: 'Geef de oproep een titel.' };
    const op = {
      id: id('op'), supplierCode: s.code, titel, omschrijving: scho(data.omschrijving, 600),
      soort: CONTENT_SOORTEN.includes(data.soort) ? data.soort : null, budget: Math.round(getal(data.budget, 1e7)),
      open: true, reacties: [], at: nu()
    };
    db.data.creatorOproepen.unshift(op);
    db.data.creatorOproepen = db.data.creatorOproepen.slice(0, 3000);
    save();
    // seed-brede melding naar creators zou hier kunnen; we houden het simpel en
    // laten creators de open oproepen zelf zien.
    return { ok: true, id: op.id };
  }
  function sluitOproep(s, oproepId) {
    store();
    const op = db.data.creatorOproepen.find(x => x.id === oproepId);
    if (!op || op.supplierCode !== s.code) return { error: 'Oproep niet gevonden.' };
    op.open = false; save(); return { ok: true };
  }
  // Open oproepen die een creator kan zien.
  function openOproepen(s, limit) {
    store();
    return db.data.creatorOproepen.filter(op => op.open).slice(0, limit || 100).map(op => oproepPubliek(op, s.code));
  }
  function mijnOproepen(s) {
    store();
    return db.data.creatorOproepen.filter(op => op.supplierCode === s.code).map(op => oproepPubliek(op, s.code));
  }
  // Een creator reageert op een oproep.
  function reageer(creatorS, oproepId, data) {
    store();
    if (!isCreator(creatorS)) return { error: 'Alleen content creators reageren op een oproep.' };
    const op = db.data.creatorOproepen.find(x => x.id === oproepId);
    if (!op || !op.open) return { error: 'Deze oproep staat niet (meer) open.' };
    if (op.reacties.some(r => r.creatorCode === creatorS.code)) return { error: 'U heeft al gereageerd.' };
    op.reacties.push({ creatorCode: creatorS.code, bericht: scho(data.bericht, 400), status: 'open', at: nu() });
    save();
    if (notifySupplier) notifySupplier(op.supplierCode, { icon: '🎬', title: 'Reactie op je oproep', body: creatorS.name + ' reageerde op "' + op.titel + '".' });
    if (sseToSupplier) sseToSupplier(op.supplierCode, 'sync', { scope: 'samenwerking' });
    return { ok: true };
  }
  // De leverancier kiest een creator uit de reacties -> samenwerking.
  function kies(s, oproepId, creatorCode) {
    store();
    const op = db.data.creatorOproepen.find(x => x.id === oproepId);
    if (!op || op.supplierCode !== s.code) return { error: 'Oproep niet gevonden.' };
    const r = op.reacties.find(x => x.creatorCode === creatorCode);
    if (!r) return { error: 'Deze creator reageerde niet op de oproep.' };
    r.status = 'gekozen';
    const sw = {
      id: id('sw'), vanCode: s.code, naarCode: creatorCode, initiatiefCreator: false,
      bericht: 'Gekozen voor "' + op.titel + '". ' + (r.bericht || ''), soort: op.soort, budget: op.budget,
      status: 'geaccepteerd', at: nu(), uitOproep: true
    };
    db.data.samenwerkingen.unshift(sw);
    save();
    if (notifySupplier) notifySupplier(creatorCode, { icon: '🎉', title: 'Je bent gekozen!', body: s.name + ' koos jou voor "' + op.titel + '".' });
    if (sseToSupplier) sseToSupplier(creatorCode, 'sync', { scope: 'samenwerking' });
    return { ok: true, id: sw.id };
  }

  return {
    CONTENT_SOORTEN, isCreator, creators, leveranciers,
    stelVoor, beslis, mijn,
    plaatsOproep, sluitOproep, openOproepen, mijnOproepen, reageer, kies
  };
}

module.exports = { maakSamenwerking, SAMENWERKING_SOORTEN: CONTENT_SOORTEN };
