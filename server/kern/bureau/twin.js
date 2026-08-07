/* Het Privekantoor, deelbestand "twin": de digitale tweeling van een woning.

   Van "Villa Ibiza, verzekerd tot maart" naar "Villa Ibiza > zwembad > pomp 2,
   geplaatst 2019, laatste beurt in mei, garantie tot volgend jaar, geleverd door
   die en die". Enterprise asset management, maar dan voor een privebezit.

   WAAROM DIT GEEN NIEUWE APP IS. Een woning bestaat al: in het
   Bezittingenregister, als bezitting van soort 'vastgoed'. De tweeling hangt
   daaraan en heeft geen eigen huizenlijst -- dat zou de tweede plek zijn waar
   staat welke huizen u heeft, en dan heet er eentje op een dag anders dan de
   ander. Een tweeling zonder huis kan hier dus niet bestaan: `T()` weigert een
   ruimte in een woning die niet in het register staat.

   WAT DE TWEELING OPLEVERT DAT EEN LIJST NIET GEEFT: elke installatie draagt
   zijn eigen datums (onderhoud, garantie), en die lopen via dezelfde weg als
   alle andere termijnen -- graaf-bronnen2.js maakt er knopen van, de Control
   Tower telt ze mee, en de Situation Room meldt ze. De tweeling is dus geen
   apart scherm met een eigen waarschuwingssysteem; hij voedt het systeem dat er
   al is. Dat is de hele truc van dit kantoor: nieuwe diepte, geen nieuwe silo.

   Gemount via ./index.js. */
'use strict';

// wat er in een ruimte kan hangen; grof genoeg om alles kwijt te kunnen
const SOORTEN = ['klimaat', 'water', 'elektra', 'beveiliging', 'keuken', 'zwembad',
  'tuin', 'lift', 'net', 'overig'];

module.exports = (ctx) => {
  const { db, save, nu, rid, schoon, isDatum } = ctx;

  function L(key) {
    if (!db.data.lifestyle) db.data.lifestyle = {};
    if (!db.data.lifestyle[key]) db.data.lifestyle[key] = {};
    return db.data.lifestyle[key];
  }
  // de woningen komen UIT het register; hier staat geen tweede lijst
  function woningen(key) {
    const l = db.data.lifestyle && db.data.lifestyle[key];
    return ((l && l.bezittingen) || []).filter(b => b.soort === 'vastgoed');
  }
  function T(key, huisId, maak) {
    const l = L(key);
    if (!l.twin || typeof l.twin !== 'object') l.twin = {};
    if (!woningen(key).some(b => b.id === huisId)) return null;
    if (!l.twin[huisId]) { if (!maak) return { ruimtes: [] }; l.twin[huisId] = { ruimtes: [] }; }
    const t = l.twin[huisId];
    if (!Array.isArray(t.ruimtes)) t.ruimtes = [];
    return t;
  }

  function twinRuimte(key, b) {
    const naam = schoon(b.naam, 60);
    if (!naam) return { status: 400, error: 'Hoe heet deze ruimte?' };
    const t = T(key, String(b.huisId || ''), true);
    if (!t) return { status: 404, error: 'Deze woning staat niet in uw register. Leg hem daar eerst vast.' };
    if (b.id) {
      const r = t.ruimtes.find(x => x.id === b.id);
      if (!r) return { status: 404, error: 'Deze ruimte bestaat niet.' };
      r.naam = naam; r.verdieping = schoon(b.verdieping, 30); save();
      return { status: 200, ok: true };
    }
    if (t.ruimtes.length >= 200) return { status: 400, error: 'Deze woning heeft al veel ruimtes.' };
    t.ruimtes.push({ id: rid(), naam, verdieping: schoon(b.verdieping, 30), installaties: [], at: nu() });
    save();
    return { status: 200, ok: true };
  }
  function twinRuimteWeg(key, b) {
    const t = T(key, String(b.huisId || ''), false);
    if (!t) return { status: 404, error: 'Onbekende woning.' };
    t.ruimtes = t.ruimtes.filter(x => x.id !== b.id); save();
    return { status: 200, ok: true };
  }

  function twinInstallatie(key, b) {
    const t = T(key, String(b.huisId || ''), true);
    if (!t) return { status: 404, error: 'Deze woning staat niet in uw register.' };
    const r = t.ruimtes.find(x => x.id === b.ruimteId);
    if (!r) return { status: 404, error: 'Kies eerst een ruimte.' };
    if (!Array.isArray(r.installaties)) r.installaties = [];
    const naam = schoon(b.naam, 60);
    if (!naam) return { status: 400, error: 'Wat hangt of staat hier?' };
    const rec = { naam, soort: SOORTEN.includes(b.soort) ? b.soort : 'overig',
      merk: schoon(b.merk, 60), serie: schoon(b.serie, 60),
      geplaatst: isDatum(b.geplaatst) ? b.geplaatst : '',
      onderhoudOp: isDatum(b.onderhoudOp) ? b.onderhoudOp : '',
      garantieTot: isDatum(b.garantieTot) ? b.garantieTot : '',
      leverancier: schoon(b.leverancier, 80), notitie: schoon(b.notitie, 200) };
    if (b.id) {
      const i = r.installaties.find(x => x.id === b.id);
      if (!i) return { status: 404, error: 'Niet gevonden.' };
      Object.assign(i, rec); save();
      return { status: 200, ok: true };
    }
    if (r.installaties.length >= 100) return { status: 400, error: 'Deze ruimte zit vol.' };
    r.installaties.push(Object.assign({ id: rid(), at: nu(), historie: [] }, rec)); save();
    return { status: 200, ok: true };
  }
  function twinInstallatieWeg(key, b) {
    const t = T(key, String(b.huisId || ''), false);
    if (!t) return { status: 404, error: 'Onbekende woning.' };
    for (const r of t.ruimtes) r.installaties = (r.installaties || []).filter(x => x.id !== b.id);
    save();
    return { status: 200, ok: true };
  }

  /* Een beurt bijschrijven. Dit is waarom de tweeling meer is dan een
     inventarislijst: de historie staat BIJ het ding, en de volgende datum
     schuift mee. Wie alleen een lijst heeft, weet wat er hangt; wie de historie
     heeft, weet of het is onderhouden. */
  function twinBeurt(key, b) {
    const t = T(key, String(b.huisId || ''), false);
    if (!t) return { status: 404, error: 'Onbekende woning.' };
    let inst = null;
    for (const r of t.ruimtes) { const i = (r.installaties || []).find(x => x.id === b.id); if (i) inst = i; }
    if (!inst) return { status: 404, error: 'Deze installatie bestaat niet.' };
    const wat = schoon(b.wat, 120);
    if (!wat) return { status: 400, error: 'Wat is er gedaan?' };
    if (!Array.isArray(inst.historie)) inst.historie = [];
    inst.historie.unshift({ id: rid(), wat, op: isDatum(b.op) ? b.op : new Date().toISOString().slice(0, 10),
      door: schoon(b.door, 80), kostenCenten: Math.max(0, Math.min(1e10, Math.round(Number(b.kostenCenten) || 0))) });
    if (inst.historie.length > 100) inst.historie.length = 100;
    if (isDatum(b.volgende)) inst.onderhoudOp = b.volgende;
    save();
    return { status: 200, ok: true, installatie: inst };
  }

  /* De tweeling van EEN woning, of de lijst met woningen als er geen is
     gekozen. De tellingen erbij, want "drie ruimtes, veertien installaties,
     twee met een datum deze maand" is wat je wilt zien voordat je doorklikt. */
  function twin(key, huisId) {
    const huizen = woningen(key);
    const l = db.data.lifestyle && db.data.lifestyle[key];
    const alle = (l && l.twin) || {};
    const kop = huizen.map(h => {
      const t = alle[h.id] || { ruimtes: [] };
      const inst = (t.ruimtes || []).reduce((a, r) => a.concat(r.installaties || []), []);
      return { id: h.id, naam: h.naam, ruimtes: (t.ruimtes || []).length, installaties: inst.length,
        metDatum: inst.filter(i => i.onderhoudOp || i.garantieTot).length };
    });
    if (!huisId) return { status: 200, woningen: kop, soorten: SOORTEN, gekozen: null };
    const h = huizen.find(x => x.id === huisId);
    if (!h) return { status: 404, error: 'Deze woning staat niet in uw register.' };
    const t = alle[huisId] || { ruimtes: [] };
    return { status: 200, woningen: kop, soorten: SOORTEN,
      gekozen: { id: h.id, naam: h.naam, waarde: h.waarde, ruimtes: t.ruimtes || [] } };
  }

  return { twin, twinRuimte, twinRuimteWeg, twinInstallatie, twinInstallatieWeg, twinBeurt,
    TWIN_SOORTEN: SOORTEN };
};
