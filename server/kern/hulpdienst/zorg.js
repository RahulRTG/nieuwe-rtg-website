/* De hulpdiensten-toren, deelbestand "zorg": het ziekenhuis (beddenbord en opnames;
   de ambulance/huisarts kondigt een overdracht aan, het ziekenhuis neemt op en
   ontslaat) en de huisarts (consulten met urgentie, doorverwijzen naar het
   ziekenhuis). Krijgt de gedeelde ctx van kern/hulpdienst/index.js. */
module.exports = (ctx) => {
  const { crypto, save, nu, schoonTekst, findSupplier, bak, consultenVan } = ctx;

  /* ---------- ziekenhuis: bedden en opnames ---------- */
  function beddenZet(code, totaal) {
    const t = Math.max(0, Math.min(2000, Math.round(Number(totaal) || 0)));
    bak().bedden[code] = { totaal: t, bezet: Math.min((bak().bedden[code] || {}).bezet || 0, t) };
    save();
    return { ok: true, bedden: bak().bedden[code] };
  }
  function overdrachtMaak(code, b) {
    const van = findSupplier(code);
    if (!van || !['ambulance', 'huisarts'].includes(van.type)) return { status: 403, error: 'Alleen de ambulance of de huisarts draagt over aan het ziekenhuis.' };
    const zk = findSupplier(b.ziekenhuis);
    if (!zk || zk.type !== 'ziekenhuis') return { status: 404, error: 'Dit ziekenhuis kennen we niet.' };
    const triage = schoonTekst(b.triage, 200);
    if (!triage) return { status: 400, error: 'Wat is de triage of de reden van overdracht?' };
    const bed = bak().bedden[zk.code] || { totaal: 0, bezet: 0 };
    const o = {
      id: crypto.randomBytes(4).toString('hex'), ziekenhuis: zk.code, van: van.code,
      triage, status: 'aangekondigd', vol: bed.totaal > 0 && bed.bezet >= bed.totaal, at: nu()
    };
    bak().opnames.unshift(o);
    if (bak().opnames.length > 1000) bak().opnames.pop();
    save();
    return { ok: true, opname: o, waarschuwing: o.vol ? 'Let op: het beddenbord staat op vol; het ziekenhuis beslist bij aankomst.' : null };
  }
  function opnameZet(code, id, status) {
    const o = bak().opnames.find(x => x.id === id && x.ziekenhuis === code);
    if (!o) return { status: 404, error: 'Deze opname staat niet op uw bord.' };
    if (!['opgenomen', 'ontslagen', 'geweigerd'].includes(status)) return { status: 400, error: 'Kies opgenomen, ontslagen of geweigerd.' };
    const bed = bak().bedden[code] = bak().bedden[code] || { totaal: 0, bezet: 0 };
    if (status === 'opgenomen' && o.status !== 'opgenomen') bed.bezet = Math.min(bed.totaal || 9999, bed.bezet + 1);
    if (status === 'ontslagen' && o.status === 'opgenomen') bed.bezet = Math.max(0, bed.bezet - 1);
    o.status = status;
    save();
    return { ok: true, opname: o, bedden: bed };
  }

  /* ---------- huisarts: consulten met urgentie ---------- */
  function consultMaak(code, b) {
    const s = findSupplier(code);
    if (!s || s.type !== 'huisarts') return { status: 403, error: 'Alleen de huisarts plant consulten.' };
    const klacht = schoonTekst(b.klacht, 200);
    if (!klacht) return { status: 400, error: 'Wat is de klacht?' };
    const c = {
      id: crypto.randomBytes(4).toString('hex'), klacht,
      urgentie: ['hoog', 'normaal', 'laag'].includes(b.urgentie) ? b.urgentie : 'normaal',
      wanneer: schoonTekst(b.wanneer, 40), status: 'gepland', at: nu()
    };
    consultenVan(code).unshift(c);
    if (consultenVan(code).length > 500) consultenVan(code).pop();
    save();
    return { ok: true, consult: c };
  }
  function consultZet(code, id, status) {
    const c = consultenVan(code).find(x => x.id === id);
    if (!c) return { status: 404, error: 'Dit consult staat niet in de agenda.' };
    if (!['afgerond', 'verwezen', 'gepland'].includes(status)) return { status: 400, error: 'Kies gepland, afgerond of verwezen.' };
    c.status = status;
    save();
    return { ok: true, consult: c };
  }

  return { beddenZet, overdrachtMaak, opnameZet, consultMaak, consultZet };
};
