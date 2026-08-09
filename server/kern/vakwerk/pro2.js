/* Vakwerk Pro, deel 2: klantenboek, werkbonnen en onderhoudsherinneringen.
   Het klantenboek is een CRM op codenaam (echte namen kent het bewust niet):
   historie, omzet en een eigen notitie per klant. De digitale werkbon sluit
   een afgeronde klus netjes af en reist mee met de boeking van het lid. Het
   herhaal-interval per dienst (bijv. APK: 12 maanden) zet klanten die aan de
   beurt zijn op het bord; een herinnering is een bewuste knop van de zaak,
   hooguit eens per 30 dagen -- nooit automatische spam. */
module.exports = (ctx) => {
  const { db, save, findSupplier, boekingenVanZaak, ordersVanZaak, scho, notify, sseToCustomer, geldDag } = ctx;
  const nu = () => new Date().toISOString();
  /* Het klantenboek staat in kern/klantenboek.js: de vraag "wie zijn mijn
     klanten" hangt niet aan een genre, en twee boeken naast elkaar lopen
     uiteen (lat-regel 4). Vakwerk houdt er dus geen eigen meer op na. */
  const boek = require('../klantenboek')({ db, save, scho, boekingenVanZaak, ordersVanZaak });
  const klantenboek = boek.klantenboek;
  const klantNotitie = boek.klantNotitie;

  /* ---- de digitale werkbon: een afgeronde klus netjes afsluiten ---- */
  function werkbonOpen(code) {
    return (boekingenVanZaak(code) || [])
      .filter(b => b.status === 'afgerond' && !b.werkbon)
      .sort((a, b) => String(b.finishedAt || b.at).localeCompare(String(a.finishedAt || a.at)))
      .slice(0, 5)
      .map(b => ({ ref: b.ref, dienst: (b.service && b.service.name) || 'Dienst', klant: b.customerCodename, datum: geldDag(b) }));
  }
  function werkbonZet(code, actor, body) {
    const b = (boekingenVanZaak(code) || []).find(x => x.ref === String((body || {}).ref || ''));
    if (!b) return { status: 404, error: 'Boeking niet gevonden.' };
    if (b.status !== 'afgerond') return { status: 409, error: 'Een werkbon hoort bij een afgeronde klus.' };
    if (b.werkbon) return { status: 409, error: 'Deze klus heeft al een werkbon.' };
    const werk = scho((body || {}).werk, 300);
    if (werk.length < 5) return { status: 400, error: 'Beschrijf kort het uitgevoerde werk.' };
    b.werkbon = { werk, materiaal: scho((body || {}).materiaal, 200) || null, door: actor.name, at: nu() };
    save();
    notify(b.customerTier, { icon: 'agenda', title: b.supplierName, body: 'De werkbon van uw klus staat klaar: ' + werk.slice(0, 90), scope: 'orders' });
    sseToCustomer(b.customerKey || b.customerTier, 'sync', { scope: 'orders' });
    return { status: 200, ok: true, werkbon: b.werkbon };
  }

  /* ---- herhaal-onderhoud: interval per dienst, herinnering per knop ---- */
  function herhaalZet(code, body) {
    const s = findSupplier(code);
    const d = ((s && s.services) || []).find(x => x.id === String((body || {}).id || ''));
    if (!d) return { status: 404, error: 'Deze dienst bestaat niet (meer).' };
    const mnd = Math.round(Number((body || {}).mnd));
    if (mnd >= 1 && mnd <= 60) d.herhaalMnd = mnd; else delete d.herhaalMnd;
    save();
    return { status: 200, ok: true, herhaalMnd: d.herhaalMnd || null };
  }
  function onderhoudLijst(code) {
    const s = findSupplier(code);
    const metInterval = ((s && s.services) || []).filter(d => d.herhaalMnd >= 1);
    if (!metInterval.length) return [];
    const laatst = new Map(); // klant|dienst -> nieuwste afgeronde dag
    for (const b of (boekingenVanZaak(code) || [])) {
      if (b.status !== 'afgerond' || !b.customerCodename || !b.service) continue;
      const k = b.customerCodename + '|' + b.service.id;
      const dag = geldDag(b);
      const oud = laatst.get(k);
      if (!oud || dag > oud.dag) laatst.set(k, { dag, key: b.customerKey, tier: b.customerTier });
    }
    const herinnerd = db.data.vakHerinnerd = db.data.vakHerinnerd || {};
    const uit = [];
    for (const d of metInterval) {
      const grens = new Date(Date.now() - d.herhaalMnd * 30.44 * 864e5).toISOString().slice(0, 10);
      for (const [k, v] of laatst) {
        const [codenaam, dienstId] = k.split('|');
        if (dienstId !== d.id || v.dag > grens) continue;
        const hKey = code + '|' + k;
        const h = herinnerd[hKey];
        uit.push({ codenaam, dienstId: d.id, dienst: d.name, laatst: v.dag,
          mndGeleden: Math.round((Date.now() - new Date(v.dag).getTime()) / (30.44 * 864e5)),
          herinnerd: !!(h && h > new Date(Date.now() - 30 * 864e5).toISOString()) });
      }
    }
    return uit.sort((a, b) => a.laatst.localeCompare(b.laatst)).slice(0, 20);
  }
  function onderhoudHerinner(code, body) {
    const codenaam = scho((body || {}).codenaam, 60), dienstId = String((body || {}).dienstId || '');
    const rij = onderhoudLijst(code).find(o => o.codenaam === codenaam && o.dienstId === dienstId);
    if (!rij) return { status: 404, error: 'Deze klant staat niet in de onderhoudslijst.' };
    if (rij.herinnerd) return { status: 429, error: 'Al herinnerd; dat kan eens per 30 dagen.' };
    const b = (boekingenVanZaak(code) || []).find(x => x.customerCodename === codenaam && x.service && x.service.id === dienstId);
    if (!b) return { status: 404, error: 'Geen boeking gevonden voor deze klant.' };
    const s = findSupplier(code);
    notify(b.customerTier, { icon: 'agenda', title: s.name, body: 'Vriendelijke herinnering: uw "' + rij.dienst + '" was ' + rij.mndGeleden + ' maanden geleden. Boeken kan in de Mall, wanneer het u uitkomt.', scope: 'orders' });
    sseToCustomer(b.customerKey || b.customerTier, 'sync', { scope: 'orders' });
    (db.data.vakHerinnerd = db.data.vakHerinnerd || {})[code + '|' + codenaam + '|' + dienstId] = nu();
    save();
    return { status: 200, ok: true };
  }

  return { klantenboek, klantNotitie, werkbonOpen, werkbonZet, herhaalZet, onderhoudLijst, onderhoudHerinner };
};
