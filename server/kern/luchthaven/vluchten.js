/* Luchthaven, deelbestand "vluchten": de vluchtleiding (het bord, nieuwe
   vluchten, gates en vertragingen, de statusketen met de harde grendels) en
   de passagiersketen (boeken op codenaam, inchecken met kofferlabels, mijn
   reizen). Krijgt de gedeelde ctx van ./index.js. */
module.exports = (ctx) => {
  const { save, crypto, nu, id, schoon, vandaag, L, seed, vluchten, vind, actief, keten, catVan,
    plekkenVoor, draaiTakenVoor, draaiRond, vipVan, vipRond, publiek, _vluchtMaak,
    GATES, BANEN, BANDEN, CATEGORIEEN } = ctx;

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
  function vluchtStatus(actor, vid, status) {
    const v = vind(vid);
    if (!v) return { status: 404, error: 'Vlucht niet gevonden.' };
    if (status === 'geannuleerd') {
      if (!actief(v)) return { status: 409, error: 'Deze vlucht is al ' + v.status + '.' };
      v.status = 'geannuleerd'; save();
      return { ok: true, vlucht: publiek(v) };
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
  function boek(sess, codenaam, vid, data) {
    data = data || {};
    const v = vind(vid);
    if (!v || v.soort !== 'vertrek') return { status: 404, error: 'Vlucht niet gevonden.' };
    if (!['gepland', 'inchecken'].includes(v.status)) return { status: 409, error: 'Deze vlucht is niet meer te boeken (' + v.status + ').' };
    if (L().boekingen.some(b => b.key === sess.key && b.vluchtId === v.id && b.status !== 'geannuleerd'))
      return { status: 409, error: 'Je staat al op deze vlucht.' };
    const b = { id: id('bk'), code: 'VL-' + crypto.randomBytes(3).toString('hex').toUpperCase(), vluchtId: v.id,
      key: sess.key, codenaam: schoon(codenaam, 60) || 'Reiziger', status: 'geboekt', stoel: null, koffers: 0, at: nu() };
    L().boekingen.unshift(b);
    L().boekingen = L().boekingen.slice(0, 50000);
    save();
    return { ok: true, boeking: { code: b.code, vlucht: publiek(v), status: b.status } };
  }
  function incheck(sess, code, data) {
    data = data || {};
    const b = L().boekingen.find(x => x.code === String(code || '').toUpperCase() && x.key === sess.key);
    if (!b) return { status: 404, error: 'Boeking niet gevonden.' };
    const v = vind(b.vluchtId);
    if (!v) return { status: 404, error: 'Vlucht niet gevonden.' };
    if (v.status === 'gepland') return { status: 409, error: 'Het inchecken voor ' + v.nummer + ' is nog niet open.' };
    if (v.status !== 'inchecken') return { status: 409, error: 'Het inchecken voor ' + v.nummer + ' is gesloten (' + v.status + ').' };
    if (b.status === 'ingecheckt') return { status: 409, error: 'Je bent al ingecheckt (stoel ' + b.stoel + ').' };
    const stoelen = L().boekingen.filter(x => x.vluchtId === v.id && x.stoel).length;
    b.stoel = (Math.floor(stoelen / 6) + 1) + 'ABCDEF'[stoelen % 6];
    b.status = 'ingecheckt';
    b.koffers = Math.min(3, Math.max(0, Math.round(Number(data.koffers) || 0)));
    const tags = [];
    for (let i = 0; i < b.koffers; i++) {
      const kf = { tag: 'RTG-' + crypto.randomBytes(3).toString('hex').toUpperCase(), vluchtId: v.id, boekingId: b.id,
        codenaam: b.codenaam, status: 'ingecheckt', band: null, at: nu() };
      L().koffers.unshift(kf);
      tags.push(kf.tag);
    }
    L().koffers = L().koffers.slice(0, 100000);
    save();
    return { ok: true, pass: { code: b.code, vlucht: v.nummer, bestemming: v.bestemming, datum: v.datum, tijd: v.tijd,
      gate: v.gate, stoel: b.stoel, naam: b.codenaam, koffers: tags } };
  }
  function mijn(key) {
    seed();
    const uit = [];
    for (const b of L().boekingen.filter(x => x.key === key).slice(0, 20)) {
      const v = vind(b.vluchtId);
      if (!v) continue;
      uit.push({ code: b.code, status: b.status, stoel: b.stoel, vlucht: publiek(v),
        koffers: L().koffers.filter(k => k.boekingId === b.id).map(k => ({ tag: k.tag, status: k.status, band: k.band })) });
    }
    return { ok: true, boekingen: uit, charters: ctx.mijnCharters(key) };
  }

  return { vluchtMaak, vluchtStatus, vluchtVertraag, vluchtGate, bord, boek, incheck, mijn };
};
