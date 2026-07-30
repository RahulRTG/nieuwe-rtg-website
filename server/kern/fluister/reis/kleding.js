/* Rahul-reislaag, deel "kleding" (kern/fluister/reis): Rahul koopt kleding
   (een stuk in uw maat apart leggen bij de modezaak, een voorraadclaim dus
   eerst uw "ja") en voorspelt wat er nog nodig is rond wat al geboekt staat.
   Verbatim afgesplitst uit reis.js; de gedeelde helpers komen via ctx binnen. */
module.exports = (ctx) => {
  const { db, zorgVoor, eur, retailLegApart, retailKlantProfiel, zaken, open } = ctx;

  /* ---- kleding: "koop een linnen overhemd (maat M)": Rahul zoekt in de
     modecatalogus, pakt uw maat uit het klantprofiel en legt het stuk voor
     u apart (voorraadclaim, dus eerst uw "ja"). ---- */
  function bouwKleding(q, sess) {
    const modes = zaken().filter(s => Array.isArray(s.artikelen) && s.artikelen.length && open(s));
    if (!modes.length) return null;
    const ql = q.toLowerCase();
    const maatWens = (q.match(/maat\s+([a-z0-9]{1,4})\b/i) || [])[1];
    for (const s of modes) {
      for (const a of s.artikelen || []) {
        const tekst = ((a.naam || '') + ' ' + (a.categorie || '')).toLowerCase();
        if (!tekst.split(/\s+/).some(wrd => wrd.length > 3 && ql.includes(wrd))) continue;
        const prof = retailKlantProfiel && sess ? retailKlantProfiel(s, sess.key) : null;
        const maat = maatWens || (prof && prof.maten && (prof.maten.boven || prof.maten.onder)) || null;
        const v = (a.varianten || []).find(x => x.voorraad > 0 && (!maat || String(x.maat).toLowerCase() === String(maat).toLowerCase())) ||
          (a.varianten || []).find(x => x.voorraad > 0);
        if (!v) continue;
        return { supplierCode: s.code, zaakNaam: s.name, vsku: v.vsku, artikel: a.naam, kleur: v.kleur, maat: v.maat,
          centen: Math.round((Number(a.price) || 0) * 100) };
      }
    }
    return null;
  }

  function voerKledingUit(key, codenaam, w) {
    const s = zaken().find(x => x.code === w.supplierCode);
    if (!s || !retailLegApart) return { tekst: 'De modezaak is even niet bereikbaar; probeer het zo weer.' };
    const r = retailLegApart(s, key, w.vsku, 'Rahul');
    if (r.error) return { tekst: 'Dat lukt niet: ' + r.error };
    return { tekst: 'Geregeld: ' + w.artikel + ' (' + w.kleur + ', maat ' + w.maat + ') hangt voor u apart bij ' + w.zaakNaam +
      ' voor ' + eur(w.centen) + '. Past hij, dan rekent u af aan de kassa of in de paskamer; past hij niet, dan gaat hij gewoon terug in de verkoop.', gedaan: true };
  }

  /* ---- voorspellen: "wat heb ik nodig": Rahul kijkt naar wat er al staat
     (verblijf, boekingen, reserveringen) en stelt de ontbrekende stukken
     voor, elk met de zin waarmee hij het direct regelt. ---- */
  function voorspel(key, sess) {
    const mijnVerblijf = (db.data.verblijven || []).find(v => v.customerKey === key && v.status !== 'geannuleerd' && v.vertrek >= new Date().toISOString().slice(0, 10));
    const mijnRes = (db.data.reservations || []).filter(r => (r.customerKey || r.customerTier) === key && r.status !== 'geannuleerd');
    const mijnBoek = (db.data.boekingen || []).filter(b => (b.customerKey || b.customerTier) === key);
    const tips = [];
    if (mijnVerblijf) {
      if (!mijnBoek.some(b => b.soort === 'rit' && b.datum === mijnVerblijf.aankomst))
        tips.push('een transfer naar ' + mijnVerblijf.supplierName + ' op ' + mijnVerblijf.aankomst + ' ("regel een taxi naar ' + mijnVerblijf.supplierName + '")');
      if (!mijnRes.some(r => r.datum >= mijnVerblijf.aankomst && r.datum <= mijnVerblijf.vertrek))
        tips.push('een dinerreservering tijdens uw verblijf ("reserveer een tafel morgen om 20:00")');
    } else tips.push('uw volgende reis in een keer ("plan mijn weekend met 4 vrienden")');
    if (!mijnBoek.some(b => b.soort !== 'rit')) tips.push('iets te doen ("boek 2 tickets voor de eerste activiteit die je vindt")');
    const zorgNu = zorgVoor && zorgVoor(key);
    return 'Wat ik voor u zou klaarzetten: ' + tips.join('; ') + '.' +
      (zorgNu && (zorgNu.allergenen || []).length ? ' Met uw allergenen houd ik overal rekening.' : '') +
      ' Zeg een van de zinnen en ik regel het, met een voorstel vooraf zodra er geld mee gemoeid is.';
  }

  return { bouwKleding, voerKledingUit, voorspel };
};
