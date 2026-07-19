/* Overheid-domein "rdw": het voertuigregister en het rijbewijs (RDW). Een inwoner
   registreert een kenteken (met APK-datum), schorst het of vraagt zijn rijbewijs op
   en verlengt het. registreerVloot zet de RTG-vloot (autoverhuur/tweewielers) in
   het register en rdwCheck is de gedeelde kentekencheck die autoverhuur en RTG OV
   kunnen hergebruiken. Krijgt de gedeelde ctx van kern/overheid/index.js. */
module.exports = (ctx) => {
  const { db, save, nu, id, schoon, hash, seed, bericht } = ctx;

  function voertuigen(key) {
    seed();
    return { ok: true, voertuigen: (db.data.rijkVoertuigen || []).filter(v => v.key === key).slice(0, 60)
      .map(v => ({ id: v.id, kenteken: v.kenteken, merk: v.merk, bouwjaar: v.bouwjaar, apkTot: v.apkTot, geschorst: !!v.geschorst })) };
  }
  function voertuigMeld(sess, data) {
    seed();
    data = data || {};
    const kenteken = schoon(data.kenteken, 12).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (kenteken.length < 4) return { status: 400, error: 'Vul een geldig kenteken in.' };
    if ((db.data.rijkVoertuigen || []).some(v => v.kenteken === kenteken)) return { status: 409, error: 'Dit kenteken staat al geregistreerd.' };
    const merk = schoon(data.merk, 40) || 'Onbekend';
    const h = hash(kenteken);
    const bouwjaar = 2008 + (h % 17);
    const apk = new Date(); apk.setMonth(apk.getMonth() + 6 + (h % 12));
    const v = { id: id(), key: sess.key, kenteken, merk, bouwjaar, apkTot: apk.toISOString().slice(0, 10), geschorst: false, at: nu() };
    db.data.rijkVoertuigen.unshift(v);
    db.data.rijkVoertuigen = db.data.rijkVoertuigen.slice(0, 60000);
    save();
    return { ok: true, voertuig: { id: v.id, kenteken, merk, bouwjaar, apkTot: v.apkTot } };
  }
  function voertuigSchors(key, vid, schors) {
    const v = (db.data.rijkVoertuigen || []).find(x => x.id === String(vid || '') && x.key === key);
    if (!v) return { status: 404, error: 'Voertuig niet gevonden.' };
    v.geschorst = !!schors; save();
    return { ok: true, voertuig: { id: v.id, kenteken: v.kenteken, geschorst: v.geschorst } };
  }
  function rijbewijs(key) {
    seed();
    let r = (db.data.rijkRijbewijzen || []).find(x => x.key === key);
    if (!r) {
      const g = new Date(); g.setFullYear(g.getFullYear() + 5 + (hash(key) % 5));
      r = { key, categorieen: ['B'], geldigTot: g.toISOString().slice(0, 10), at: nu() };
      db.data.rijkRijbewijzen.unshift(r); save();
    }
    return { ok: true, rijbewijs: { categorieen: r.categorieen, geldigTot: r.geldigTot } };
  }
  function rijbewijsVerleng(key) {
    seed();
    let r = (db.data.rijkRijbewijzen || []).find(x => x.key === key);
    if (!r) { rijbewijs(key); r = (db.data.rijkRijbewijzen || []).find(x => x.key === key); }
    const g = new Date(); g.setFullYear(g.getFullYear() + 10);
    r.geldigTot = g.toISOString().slice(0, 10); r.verlengd = nu(); save();
    bericht(key, 'RDW', 'Rijbewijs verlengd', 'Je rijbewijs is verlengd tot ' + r.geldigTot + '. Je haalt het op bij de gemeentebalie.', 'rdw');
    return { ok: true, rijbewijs: { categorieen: r.categorieen, geldigTot: r.geldigTot } };
  }

  // de vloot van RTG (autoverhuur, tweewielers) in het RDW-register zetten, zodat
  // een kenteken-check op een huurauto "bekend" met een APK-datum teruggeeft
  function registreerVloot() {
    seed();
    let n = 0;
    const bestaat = new Set((db.data.rijkVoertuigen || []).map(v => v.kenteken));
    for (const s of (db.data.suppliers || [])) {
      if (s.type !== 'verhuur' && s.type !== 'tweewielers') continue;
      for (const a of (s.autos || [])) {
        const kt = String(a.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (kt.length < 4 || bestaat.has(kt)) continue;
        const h = hash(kt);
        const apk = new Date(); apk.setMonth(apk.getMonth() + 7 + (h % 11));
        db.data.rijkVoertuigen.unshift({ id: id(), key: null, vloot: s.code, kenteken: kt,
          merk: a.name || s.name, bouwjaar: 2018 + (h % 7), apkTot: apk.toISOString().slice(0, 10), geschorst: false, at: nu() });
        bestaat.add(kt); n++;
      }
    }
    if (n) { db.data.rijkVoertuigen = db.data.rijkVoertuigen.slice(0, 60000); save(); }
    return n;
  }
  // RDW-controle op een kenteken; door autoverhuur/OV te hergebruiken vóór verhuur/inzet
  function rdwCheck(kenteken) {
    seed();
    const kt = String(kenteken || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (kt.length < 4) return { status: 400, error: 'Vul een geldig kenteken in.' };
    const v = (db.data.rijkVoertuigen || []).find(x => x.kenteken === kt);
    if (!v) return { ok: true, kenteken: kt, bekend: false };
    const apkGeldig = !v.geschorst && v.apkTot >= new Date().toISOString().slice(0, 10);
    return { ok: true, kenteken: kt, bekend: true, merk: v.merk, bouwjaar: v.bouwjaar, apkTot: v.apkTot, geschorst: !!v.geschorst, apkGeldig };
  }

  return { voertuigen, voertuigMeld, voertuigSchors, rijbewijs, rijbewijsVerleng, registreerVloot, rdwCheck };
};
