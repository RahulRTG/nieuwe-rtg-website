/* RTG Notities & Taken: het kleine gereedschap dat elke dag opengaat.

   Twee soorten op een bord: een NOTITIE (tekst) en een LIJST (taken met
   vinkjes). Vastpinnen zet iets bovenaan, het archief is de la -- niets
   verdwijnt stiekem. Delen gaat op codenaam en is meteen SAMEN werken:
   wie een lijst krijgt, kan afvinken en aanvullen (een boodschappenlijst
   waar de ander niet in mag strepen is geen gedeelde lijst).

   De herinnering is geen tweede wekker naast de agenda: een notitie met
   een datum en tijd krijgt een GEKOPPELDE afspraak in RTG Agenda, en
   daarmee vanzelf het seintje van de agenda-veegtimer. Een wekkerlaag
   per app is hoe je drie wekkers krijgt die net iets anders lopen.

   maakNotities(state, agenda) volgt het vaste kern-patroon. */

const MAX_PER_LID = 500, MAX_ITEMS = 50;

function maakNotities({ db, save, crypto, schoon, keyVanCodenaam, codenaamVan, sseToCustomer }, agenda) {
  const nu = () => new Date().toISOString();
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));
  const store = () => { if (!db.data.notities || typeof db.data.notities !== 'object') db.data.notities = {}; return db.data.notities; };
  const ruw = k => { const s = store(); if (!Array.isArray(s[k])) s[k] = []; return s[k]; };
  const alleVan = key => ruw('lid:' + key);
  const naam = k => codenaamVan(k) || 'een lid';
  const vind = (key, id) => {
    // eigen notitie, of een die met mij gedeeld is (samen bewerken)
    const eigen = alleVan(key).find(x => x.id === id);
    if (eigen) return { n: eigen, eigenaar: key };
    for (const [owner, arr] of Object.entries(store())) {
      const n = (arr || []).find(x => x.id === id && (x.gedeeldMet || []).includes(key));
      if (n) return { n, eigenaar: owner.slice(4) };
    }
    return {};
  };

  function publiek(n, kijker, eigenaar) {
    return { id: n.id, soort: n.soort, titel: n.titel, tekst: n.tekst || '',
      items: (n.items || []).map(x => ({ t: x.t, af: !!x.af })),
      vast: !!n.vast, archief: !!n.archief, gewijzigd: n.gewijzigd,
      herinnerOp: n.herinnerOp || null, herinnerTijd: n.herinnerTijd || null,
      vanMij: eigenaar === kijker, door: eigenaar === kijker ? null : naam(eigenaar),
      gedeeldMet: eigenaar === kijker ? (n.gedeeldMet || []).map(naam) : undefined };
  }

  function lijst(key) {
    const eigen = alleVan(key).map(n => publiek(n, key, key));
    const gedeeld = [];
    for (const [owner, arr] of Object.entries(store())) {
      if (owner === 'lid:' + key) continue;
      for (const n of arr || []) if ((n.gedeeldMet || []).includes(key) && !n.archief)
        gedeeld.push(publiek(n, key, owner.slice(4)));
    }
    const orde = (a, b) => (b.vast - a.vast) || String(b.gewijzigd).localeCompare(String(a.gewijzigd));
    return { status: 200, eigen: eigen.sort(orde), gedeeld: gedeeld.sort(orde) };
  }

  /* de gekoppelde agenda-afspraak: zetten, verzetten of opruimen */
  function agendaBij(eigenaar, n) {
    if (!agenda) return;
    try {
      if (n.herinnerOp && n.herinnerTijd) {
        const r = agenda.bewaarAfspraak('lid:' + eigenaar, { id: n.agendaId || undefined,
          titel: n.titel || 'Notitie', datum: n.herinnerOp, tijd: n.herinnerTijd,
          notitie: 'Uit Notities & Taken', herinner: 0 });
        if (r && r.id) n.agendaId = r.id;
      } else if (n.agendaId) { agenda.verwijder('lid:' + eigenaar, n.agendaId); n.agendaId = null; }
    } catch (e) { /* de notitie blijft gewoon bestaan */ }
  }

  function bewaar(key, data) {
    let n, eigenaar = key;
    if (data.id) {
      const t = vind(key, data.id);
      if (!t.n) return { status: 404, error: 'Notitie niet gevonden.' };
      n = t.n; eigenaar = t.eigenaar;
    } else {
      if (alleVan(key).length >= MAX_PER_LID) return { status: 409, error: 'Het bord zit vol; ruim eerst het archief op.' };
      n = { id: 'nt' + crypto.randomBytes(4).toString('hex'), soort: data.soort === 'lijst' ? 'lijst' : 'notitie',
        gedeeldMet: [], gemaakt: nu() };
      alleVan(key).push(n);
    }
    if (data.titel != null) n.titel = scho(data.titel, 120);
    if (n.soort === 'notitie' && data.tekst != null) n.tekst = scho(data.tekst, 4000);
    if (n.soort === 'lijst' && Array.isArray(data.items)) {
      n.items = data.items.slice(0, MAX_ITEMS).map(x => ({ t: scho(x && x.t, 200), af: !!(x && x.af) }))
        .filter(x => x.t);
    }
    // vastpinnen en archiveren horen bij de EIGENAAR van het bord
    if (eigenaar === key) {
      if (data.vast != null) n.vast = !!data.vast;
      if (data.archief != null) n.archief = !!data.archief;
      if (data.herinnerOp !== undefined) {
        n.herinnerOp = /^\d{4}-\d{2}-\d{2}$/.test(String(data.herinnerOp || '')) ? data.herinnerOp : null;
        n.herinnerTijd = /^\d{2}:\d{2}$/.test(String(data.herinnerTijd || '')) ? data.herinnerTijd : null;
        agendaBij(eigenaar, n);
      }
    }
    n.gewijzigd = nu();
    save();
    // wie meedoet krijgt een seintje dat er iets veranderd is
    for (const mk of [...(n.gedeeldMet || []), eigenaar]) {
      if (mk === key) continue;
      try { sseToCustomer(mk, 'notities', { kind: 'gewijzigd', id: n.id }); } catch (e) {}
    }
    return { status: 200, ok: true, id: n.id };
  }

  function vink(key, id, index, af) {
    const { n } = vind(key, id);
    if (!n) return { status: 404, error: 'Lijst niet gevonden.' };
    const item = (n.items || [])[Math.round(Number(index))];
    if (!item) return { status: 404, error: 'Dit punt staat niet (meer) op de lijst.' };
    item.af = af !== false;
    n.gewijzigd = nu();
    save();
    return { status: 200, ok: true };
  }

  async function deel(key, id, codenaam, aan) {
    const n = alleVan(key).find(x => x.id === id);
    if (!n) return { status: 404, error: 'Alleen de eigenaar deelt een notitie.' };
    let doel = null;
    try { const t = keyVanCodenaam ? await keyVanCodenaam(scho(codenaam, 60)) : null; doel = t && t.key; } catch (e) {}
    if (!doel) return { status: 404, error: 'Geen lid gevonden met die codenaam.' };
    if (doel === key) return { status: 400, error: 'Uzelf toevoegen hoeft niet.' };
    n.gedeeldMet = (n.gedeeldMet || []).filter(k => k !== doel);
    if (aan !== false) {
      if (n.gedeeldMet.length >= 25) return { status: 409, error: 'Met meer dan 25 mensen is het geen lijstje meer.' };
      n.gedeeldMet.push(doel);
      try { sseToCustomer(doel, 'notities', { kind: 'gedeeld', titel: n.titel, door: naam(key) }); } catch (e) {}
    }
    n.gewijzigd = nu();
    save();
    return { status: 200, ok: true, gedeeldMet: n.gedeeldMet.map(naam) };
  }

  function weg(key, id) {
    const arr = alleVan(key);
    const n = arr.find(x => x.id === id);
    if (n) {
      // de gekoppelde agenda-afspraak gaat mee het archief van de tijd in
      if (n.agendaId && agenda) { try { agenda.verwijder('lid:' + key, n.agendaId); } catch (e) {} }
      store()['lid:' + key] = arr.filter(x => x.id !== id);
      save();
      return { status: 200, ok: true };
    }
    // een gedeelde notitie "weggooien" is uzelf van de lijst halen
    for (const [, arr2] of Object.entries(store())) {
      const g = (arr2 || []).find(x => x.id === id && (x.gedeeldMet || []).includes(key));
      if (g) { g.gedeeldMet = g.gedeeldMet.filter(k => k !== key); save(); return { status: 200, ok: true }; }
    }
    return { status: 404, error: 'Notitie niet gevonden.' };
  }

  return { notitiesLijst: lijst, notitiesBewaar: bewaar, notitiesVink: vink,
    notitiesDeel: deel, notitiesWeg: weg };
}

module.exports = { maakNotities };
