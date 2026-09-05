/* Luchthaven, deelbestand "vluchten": de vluchtleiding (het bord, nieuwe
   vluchten, gates en vertragingen, de statusketen met de harde grendels) en
   de passagiersketen (boeken op codenaam, inchecken met kofferlabels, mijn
   reizen). Krijgt de gedeelde ctx van ./index.js. */
module.exports = (ctx) => {
  const { save, nu, schoon, vandaag, L, seed, vluchten, vind, actief, keten, catVan,
    plekkenVoor, draaiTakenVoor, draaiRond, vipVan, vipRond, publiek, _vluchtMaak, visumtaakVan,
    boardingPass, GATES, BANEN, BANDEN, CATEGORIEEN } = ctx;
  // de visumtaak-laag is optioneel en laat gebonden; zonder haar loopt alles door
  const visum = () => (visumtaakVan && visumtaakVan()) || null;

  /* ---------- vluchtleiding: het bord, gates en vertragingen ---------- */
  function vluchtMaak(actor, data) {
    data = data || {};
    const categorie = CATEGORIEEN[data.categorie] ? data.categorie : 'lijn';
    const plekken = plekkenVoor(categorie);
    if (data.gate && !plekken.includes(data.gate)) return { status: 400, error: 'Kies voor deze categorie een plek uit: ' + plekken.join(', ') + '.' };
    const gate = plekken.includes(data.gate) ? data.gate : plekken[0];
    const bezet = vluchten().some(v => actief(v) && v.gate === gate && v.datum === (data.datum || vandaag()) && v.tijd === data.tijd);
    if (bezet) return { status: 409, error: gate + ' is op dat moment al bezet.' };
    const v = _vluchtMaak(data);
    save();
    return { ok: true, vlucht: publiek(v) };
  }
  async function vluchtStatus(actor, vid, status) {
    const v = vind(vid);
    if (!v) return { status: 404, error: 'Vlucht niet gevonden.' };
    if (status === 'geannuleerd') {
      const uit = await boardingPass.annuleerVlucht({ vluchtId: v.id, actor });
      if (uit.error) return uit;
      // De credential en de vlucht sluiten in één commit; agenda-opruiming
      // volgt pas daarna en gebruikt uitsluitend het openbare boekings-id.
      const vt = visum();
      if (vt) for (const b of uit.refs) await vt.bijAnnulering(b.key, b.id);
      return { ok: true, vlucht: publiek(vind(v.id)) };
    }
    const k = keten(v);
    if (!k.includes(status)) return { status: 400, error: 'Onbekende status voor deze vlucht (' + k.join(' -> ') + ').' };
    const van = k.indexOf(v.status), naar = k.indexOf(status);
    if (v.status === 'geannuleerd') return { status: 409, error: 'Een geannuleerde vlucht komt niet terug op het bord.' };
    if (naar <= van) return { status: 409, error: 'De keten draait niet achteruit (' + k.join(' -> ') + ').' };
    if (naar > van + 1) return { status: 409, error: 'Stap voor stap: na ' + v.status + ' komt ' + k[van + 1] + '.' };
    // de operationele grendels
    if (status === 'boarding' && !draaiRond(v)) return { status: 409, error: 'Een kist boardt pas als de draai rond is; er staan nog platformtaken open.' };
    const vip = vipVan(v);
    if (status === 'boarding' && vip && !vipRond(vip)) return { status: 409, error: 'De Koninklijke Vleugel is nog niet gereed; eerst het vip-protocol afronden.' };
    if (status === 'vertrokken' && !v.klaring) return { status: 409, error: 'Zonder klaring van de toren vertrekt er niets.' };
    if (status === 'geland') { v.band = BANDEN[(vluchten().filter(x => x.band).length) % BANDEN.length]; }
    if (status === 'bagage-op-band') {
      for (const kf of L().koffers) if (kf.vluchtId === v.id && kf.status === 'geladen') { kf.status = 'op-band'; kf.band = v.band; }
    }
    v.status = status;
    save();
    return { ok: true, vlucht: publiek(v) };
  }
  function vluchtVertraag(actor, vid, minuten, reden) {
    const v = vind(vid);
    if (!v) return { status: 404, error: 'Vlucht niet gevonden.' };
    if (!actief(v)) return { status: 409, error: 'Deze vlucht is al ' + v.status + '.' };
    const m = Math.round(Number(minuten) || 0);
    if (m < 5 || m > 720) return { status: 400, error: 'Een vertraging is 5 tot 720 minuten.' };
    const [uu, mm] = v.tijd.split(':').map(Number);
    const t = new Date(2000, 0, 1, uu, mm + m);
    v.tijd = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
    v.vertraging = { minuten: (v.vertraging ? v.vertraging.minuten : 0) + m, reden: schoon(reden, 120) || 'operationele redenen', door: actor || 'vluchtleiding', at: nu() };
    save();
    return { ok: true, vlucht: publiek(v) };
  }
  function vluchtGate(actor, vid, gate) {
    const v = vind(vid);
    if (!v) return { status: 404, error: 'Vlucht niet gevonden.' };
    if (!GATES.includes(gate)) return { status: 400, error: 'Kies een bestaande gate (' + GATES.join(', ') + ').' };
    const bezet = vluchten().some(x => x.id !== v.id && actief(x) && x.gate === gate && x.datum === v.datum);
    if (bezet) return { status: 409, error: 'Gate ' + gate + ' is vandaag al bezet.' };
    v.gate = gate; save();
    return { ok: true, vlucht: publiek(v) };
  }
  function bord(filter) {
    filter = filter || {};
    let lijst = vluchten().filter(v => v.datum >= vandaag());
    if (filter.soort === 'vertrek' || filter.soort === 'aankomst') lijst = lijst.filter(v => v.soort === filter.soort);
    lijst = lijst.slice().sort((a, b) => (a.datum + a.tijd).localeCompare(b.datum + b.tijd));
    return { ok: true, gates: GATES, banen: BANEN, vluchten: lijst.slice(0, 80).map(publiek),
      security: L().security.map(f => ({ id: f.id, naam: f.naam, open: f.open, wachtMinuten: f.wachtMinuten })) };
  }

  /* ---------- de passagiersketen: boeken, inchecken, boarding pass ---------- */
  async function boek(sess, codenaam, vid, data) {
    const uit = await boardingPass.boek({ key: sess.key,
      codenaam: schoon(codenaam, 60) || 'Reiziger', vluchtId: vid });
    if (uit.error) return uit;
    const v = vind(uit.vluchtId);
    // vraagt de bestemming vooraf een visum of reistoestemming, dan staat de
    // taak nu in de persoonlijke agenda (kern/visumtaak.js)
    const vt = visum();
    const taak = vt ? (await vt.bijBoeking(sess.key, { ref: uit.boekingId, bestemming: v.bestemming, vertrek: v.datum })).taak : null;
    return { ok: true, boeking: { id: uit.boekingId, vlucht: publiek(v), status: uit.statusBoeking }, visumtaak: taak };
  }
  const incheck = (sess, boekingId, data) => boardingPass.incheck({
    key: sess.key, boekingId, koffers: data && data.koffers
  });
  const passRoteer = (sess, boekingId, verwachteRotatie) => boardingPass.roteer({
    key: sess.key, boekingId, verwachteRotatie
  });
  const passIntrek = (sess, boekingId, verwachteRotatie) => boardingPass.intrekken({
    key: sess.key, boekingId, verwachteRotatie
  });
  function vulMijn(d, key) {
    d.charters = ctx.mijnCharters(key);
    for (const b of d.boekingen) {
      b.vlucht = publiek(vind(b.vluchtId));
      delete b.vluchtId;
    }
    return d;
  }
  function mijn(key) {
    seed();
    return vulMijn(boardingPass.mijn(key), key);
  }
  const mijnVeilig = async key => vulMijn(await boardingPass.mijnVeilig(key), key);

  return { vluchtMaak, vluchtStatus, vluchtVertraag, vluchtGate, bord, boek,
    incheck, passRoteer, passIntrek, mijn, mijnVeilig };
};
