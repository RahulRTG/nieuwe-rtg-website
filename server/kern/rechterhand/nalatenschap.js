/* Rechterhand (deelmodule): Nalatenschap -- een discreet, versleuteld dossier voor
   later. De belangrijke documenten (testament, polissen, eigendom, toegang) met
   waar ze liggen, uw vertrouwenspersonen (notaris, executeur, advocaat) met hun
   contact, en uw persoonlijke wensen. De gevoelige velden -- waar iets ligt, de
   contactgegevens en de wensen -- staan VERSLEUTELD op schijf (AES-256-GCM, de
   sleutel apart buiten de database), zodat ze onleesbaar zijn als het
   databasebestand ooit in verkeerde handen valt. Gemount via index.js. */
module.exports = (ctx) => {
  const { save, rid, nu, schoon, L, enc, dec } = ctx;
  const SOORTEN = ['testament', 'verzekering', 'eigendom', 'financieel', 'toegang', 'wilsverklaring', 'overig'];
  const ROLLEN = ['notaris', 'executeur', 'advocaat', 'vertrouwenspersoon', 'accountant', 'familie', 'overig'];

  function N(key) {
    const l = L(key);
    if (!l.nalatenschap || typeof l.nalatenschap !== 'object') l.nalatenschap = { documenten: [], contacten: [], wensen: [] };
    const n = l.nalatenschap;
    for (const v of ['documenten', 'contacten', 'wensen']) if (!Array.isArray(n[v])) n[v] = [];
    return n;
  }

  function nlDoc(key, b) {
    const titel = schoon(b.titel, 100);
    if (!titel) return { status: 400, error: 'Geef het document een titel.' };
    const n = N(key);
    const rec = { titel, soort: SOORTEN.includes(b.soort) ? b.soort : 'overig', waar: enc(schoon(b.waar, 300)), notitie: enc(schoon(b.notitie, 600)) };
    if (b.id) { const d = n.documenten.find(x => x.id === b.id); if (!d) return { status: 404, error: 'Dit document staat niet in uw dossier.' }; Object.assign(d, rec); save(); return { status: 200, ok: true }; }
    if (n.documenten.length >= 300) return { status: 400, error: 'Uw dossier is vol.' };
    n.documenten.push(Object.assign({ id: rid(), at: nu() }, rec)); save();
    return { status: 200, ok: true };
  }
  function nlDocWeg(key, id) { const n = N(key); n.documenten = n.documenten.filter(x => x.id !== id); save(); return { status: 200, ok: true }; }
  function nlContact(key, b) {
    const naam = schoon(b.naam, 80);
    if (!naam) return { status: 400, error: 'Naam van de vertrouwenspersoon?' };
    const n = N(key);
    const rec = { naam, rol: ROLLEN.includes(b.rol) ? b.rol : 'overig', telefoon: enc(schoon(b.telefoon, 40)), email: enc(schoon(b.email, 120)), notitie: enc(schoon(b.notitie, 300)) };
    if (b.id) { const c = n.contacten.find(x => x.id === b.id); if (!c) return { status: 404, error: 'Niet gevonden.' }; Object.assign(c, rec); save(); return { status: 200, ok: true }; }
    if (n.contacten.length >= 200) return { status: 400, error: 'De lijst is vol.' };
    n.contacten.push(Object.assign({ id: rid(), at: nu() }, rec)); save();
    return { status: 200, ok: true };
  }
  function nlContactWeg(key, id) { const n = N(key); n.contacten = n.contacten.filter(x => x.id !== id); save(); return { status: 200, ok: true }; }
  function nlWens(key, b) {
    const tekst = schoon(b.tekst, 800);
    if (!tekst) return { status: 400, error: 'Wat wilt u vastleggen?' };
    const n = N(key);
    if (b.id) { const w = n.wensen.find(x => x.id === b.id); if (!w) return { status: 404, error: 'Niet gevonden.' }; w.titel = schoon(b.titel, 100); w.tekst = enc(tekst); save(); return { status: 200, ok: true }; }
    if (n.wensen.length >= 200) return { status: 400, error: 'De lijst is vol.' };
    n.wensen.push({ id: rid(), titel: schoon(b.titel, 100), tekst: enc(tekst), at: nu() }); save();
    return { status: 200, ok: true };
  }
  function nlWensWeg(key, id) { const n = N(key); n.wensen = n.wensen.filter(x => x.id !== id); save(); return { status: 200, ok: true }; }

  function nalatenschap(key) {
    const n = N(key);
    return { status: 200,
      documenten: n.documenten.map(d => ({ id: d.id, titel: d.titel, soort: d.soort, waar: dec(d.waar), notitie: dec(d.notitie) })),
      contacten: n.contacten.map(c => ({ id: c.id, naam: c.naam, rol: c.rol, telefoon: dec(c.telefoon), email: dec(c.email), notitie: dec(c.notitie) })),
      wensen: n.wensen.map(w => ({ id: w.id, titel: w.titel, tekst: dec(w.tekst) })),
      soorten: SOORTEN, rollen: ROLLEN };
  }

  return { nalatenschap, nlDoc, nlDocWeg, nlContact, nlContactWeg, nlWens, nlWensWeg };
};
