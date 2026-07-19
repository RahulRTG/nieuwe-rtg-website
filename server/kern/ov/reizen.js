/* RTG OV, deelbestand "reizen": de ledenkant. De kaart met alle lijnen (live
   aanrijtijd van het dichtstbijzijnde voertuig, anders het boekje), de oplichtende
   check-in-code, de GPS-check-in (aantoonbaar bij het voertuig), het uitchecken (basis
   + kilometers, betaald uit de RTG Pay-wallet met autolaad) en de eigen ritten. Krijgt
   de gedeelde ctx van kern/ov/index.js. */
module.exports = (ctx) => {
  const { db, save, crypto, nu, codenaamVan, haversine, etaMinutes, pay, codes,
    ensureOv, ovZaak, lijnVan, versVoertuig, actieveRit, ritStart, ritBeeld,
    SOORTEN, CODE_TTL_MS, GPS_CHECKIN_M } = ctx;

  function kaart(key, hier) {
    ensureOv();
    const lat = Number(hier && hier.lat), lng = Number(hier && hier.lng);
    const geldig = Number.isFinite(lat) && Number.isFinite(lng);
    const uit = [];
    for (const s of db.data.suppliers) {
      if (s.type !== 'ov') continue;
      for (const l of s.lijnen || []) {
        const voertuigen = db.data.ovVoertuigen.filter(v => v.code === s.code && v.lijnId === l.id && versVoertuig(v));
        const haltes = l.haltes.map(h => ({ ...h,
          afstandM: geldig ? haversine({ lat, lng }, h) : null }));
        const dichtsteHalte = geldig ? [...haltes].sort((a, b) => a.afstandM - b.afstandM)[0] : haltes[0];
        // live: de echte aanrijtijd van het dichtstbijzijnde voertuig; anders het boekje
        let over = Math.round(l.frequentieMin / 2), live = false;
        if (voertuigen.length && dichtsteHalte) {
          const m = Math.min(...voertuigen.map(v => haversine(v, dichtsteHalte)));
          over = etaMinutes(m, 'driving'); live = true;
        }
        uit.push({ zaak: s.name, code: s.code, lijnId: l.id, naam: l.naam, soort: l.soort,
          icoon: SOORTEN[l.soort] || '\u{1F68C}', frequentieMin: l.frequentieMin,
          tarief: l.tarief, haltes, halte: dichtsteHalte, overMin: over, live,
          voertuigen: voertuigen.map(v => ({ id: v.id, naam: v.naam, lat: v.lat, lng: v.lng })) });
      }
    }
    uit.sort((a, b) => ((a.halte && a.halte.afstandM) ?? 9e9) - ((b.halte && b.halte.afstandM) ?? 9e9));
    const rit = actieveRit(key);
    return { status: 200, lijnen: uit, rit: rit ? ritBeeld(rit) : null };
  }
  function codeMaak(key) {
    if (actieveRit(key)) return { status: 409, error: 'U bent al ingecheckt; check eerst uit.' };
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    codes.set(code, { key, tot: Date.now() + CODE_TTL_MS });
    if (codes.size > 5000) for (const [k, v] of codes) if (v.tot < Date.now()) codes.delete(k);
    return { status: 200, code, geldigS: CODE_TTL_MS / 1000 };
  }
  // snelle optie 2: aantoonbaar bij het voertuig, dus een tik is genoeg
  function hierIn(key, hier) {
    ensureOv();
    if (actieveRit(key)) return { status: 409, error: 'U bent al ingecheckt; check eerst uit.' };
    const lat = Number(hier && hier.lat), lng = Number(hier && hier.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { status: 400, error: 'Geen geldige plek.' };
    const v = db.data.ovVoertuigen.filter(versVoertuig)
      .map(x => ({ x, m: haversine({ lat, lng }, x) }))
      .sort((a, b) => a.m - b.m)[0];
    if (!v || v.m > GPS_CHECKIN_M)
      return { status: 409, error: 'Geen voertuig binnen ' + GPS_CHECKIN_M + ' meter; gebruik anders de oplichtende code.' };
    return ritStart(key, v.x);
  }
  async function checkUit(key, hier, idem) {
    const rit = actieveRit(key);
    if (!rit) return { status: 409, error: 'U bent niet ingecheckt.' };
    const s = ovZaak(rit.code);
    const lijn = s ? lijnVan(s, rit.lijnId) : null;
    const lat = Number(hier && hier.lat), lng = Number(hier && hier.lng);
    const uitPunt = Number.isFinite(lat) ? { lat, lng } :
      (db.data.ovVoertuigen.find(v => v.id === rit.voertuigId) || rit.in);
    const km = Math.max(0, (haversine(rit.in, uitPunt) || 0) / 1000);
    const prijs = Math.max(100, Math.round((lijn ? lijn.tarief.basis : 180) + km * (lijn ? lijn.tarief.perKm : 20)));
    // betalen met autolaad: de wallet laadt zelf bij als het saldo tekortschiet
    const codenaam = codenaamVan(key);
    const rek = 'lid:' + codenaam;
    const tekort = prijs - pay.saldoVan(rek);
    if (tekort > 0) {
      const l = await pay.laadOp({ codenaam, centen: Math.max(tekort, 1000), idem: idem ? 'ovlaad:' + idem : undefined });
      if (l.error) return { status: l.status || 402, error: l.error };
    }
    const b = pay.boek({ van: rek, naar: 'partner:' + rit.code, centen: prijs, soort: 'ov',
      oms: 'OV · ' + (lijn ? lijn.naam : rit.lijnId) + ' · ' + (Math.round(km * 10) / 10) + ' km' });
    if (b.error) return { status: b.status || 400, error: b.error };
    rit.status = 'uit'; rit.uit = { ...uitPunt, at: nu() }; rit.prijs = prijs; rit.km = Math.round(km * 10) / 10;
    save();
    return { status: 200, ok: true, prijs, km: rit.km, saldo: pay.saldoVan(rek), rit: ritBeeld(rit) };
  }
  function mijn(key) {
    ensureOv();
    const rijen = db.data.ovRitten.filter(r => r.key === key).slice(-15).reverse();
    return { status: 200, rit: actieveRit(key) ? ritBeeld(actieveRit(key)) : null, ritten: rijen.map(ritBeeld) };
  }

  return { ovKaart: kaart, ovCodeMaak: codeMaak, ovHierIn: hierIn, ovCheckUit: checkUit, ovMijn: mijn };
};
