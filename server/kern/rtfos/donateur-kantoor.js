/* Foundation OS, kantoorkant van het donateursportaal: persoonscode en
   periodieke overeenkomst. De fiscale grendels komen uit gift-vormen.js. */
'use strict';

const { JAREN_MIN, anbiZin } = require('./gift-vormen');

module.exports = (ctx, eigen) => {
  const { schoon, S, audit, wie, poort, wieIn, poortIn, save, codelevenscyclus } = ctx;
  const { DOEL, SOORT, SCOPE } = eigen;

  const opties = b => ({
    geldig_dagen: b && (b.geldig_dagen || b.geldigDagen),
    max_gebruik: b && (b.max_gebruik || b.maxGebruik)
  });
  const subjectVan = bron => schoon(bron && bron.donateur_subject_id, 120);
  /* Een naam is presentatie; alleen hetzelfde stabiele subject vormt een groep. */
  const groepIn = (staat, bron) => {
    const subject = subjectVan(bron);
    if (!subject) return bron ? [bron] : [];
    return (staat.bronnen || []).filter(x => x.stad === bron.stad && subjectVan(x) === subject);
  };
  const groep = bron => groepIn(S(), bron);
  const codeIds = giften => [...new Set(giften.map(x => x.persoonscode_id).filter(Boolean))];
  const invoer = (w, bron, b) => Object.assign({
    prefix: 'RTFS', issuer: w.key, doel: DOEL, scope: Object.values(SCOPE),
    onderwerp: { soort: SOORT, id: subjectVan(bron) }
  }, opties(b));

  function bindSubject(staat, bron, b) {
    const bestaand = subjectVan(bron);
    const gevraagd = schoon(b && (b.subject_id || b.subjectId), 120);
    if (bestaand) {
      if (gevraagd && gevraagd !== bestaand) {
        return { fout: { status: 409, error: 'Deze gift is al aan een andere vaste donateuridentiteit gekoppeld.' } };
      }
      return { subject: bestaand, giften: groepIn(staat, bron) };
    }

    const zelfdeNaam = (staat.bronnen || []).filter(x =>
      x.stad === bron.stad && x.gever === bron.gever && !subjectVan(x));
    const ids = [...new Set([].concat((b && (b.gift_ids || b.giftIds)) || [])
      .map(x => schoon(x, 40)).filter(Boolean))];
    /* Een dubbele vrije naam faalt dicht zonder expliciete giftselectie. */
    if (!gevraagd && !ids.length && zelfdeNaam.length > 1) {
      return { fout: { status: 409,
        error: 'Meerdere giften delen deze naam, maar een naam is geen identiteit. Geef de gecontroleerde gift_ids op die bij dezelfde gever horen.' } };
    }
    if (gevraagd && gevraagd.length < 8) {
      return { fout: { status: 400, error: 'Het vaste donateur-subject is te kort om betrouwbaar herleidbaar te zijn.' } };
    }
    const gekozenIds = ids.length ? ids : [bron.id];
    if (!gekozenIds.includes(bron.id)) {
      return { fout: { status: 400, error: 'De gekozen gift moet zelf in gift_ids staan.' } };
    }
    const gekozen = gekozenIds.map(id => (staat.bronnen || []).find(x => x.id === id));
    if (gekozen.some(x => !x)) return { fout: { status: 404, error: 'Een gekozen gift bestaat niet.' } };
    if (gekozen.some(x => x.stad !== bron.stad || x.gever !== bron.gever)) {
      return { fout: { status: 400, error: 'Alle gekozen giften moeten uit dezelfde stad en van dezelfde gecontroleerde gever zijn.' } };
    }
    if (gekozen.some(x => subjectVan(x) && subjectVan(x) !== gevraagd)) {
      return { fout: { status: 409, error: 'Een gekozen gift hoort al bij een andere donateuridentiteit.' } };
    }
    /* Bron-id is het stabiele anker als er geen CRM-/RTG-subject bestaat. */
    const subject = gevraagd || bron.id;
    for (const gift of gekozen) gift.donateur_subject_id = subject;
    return { subject, giften: groepIn(staat, bron) };
  }

  function deur(req, bronId) {
    const bron = S().bronnen.find(x => x.id === String(bronId || ''));
    if (!bron) return { fout: { status: 404, error: 'Deze bron bestaat niet.' } };
    const w = wie(req);
    const g = poort(w, bron.stad, 'geld.beheren', 'donations');
    return g.ok ? { bron, w, giften: groep(bron) } : { fout: g };
  }
  function deurIn(req, bronId, staat) {
    const bron = ((staat && staat.bronnen) || []).find(x => x.id === String(bronId || ''));
    if (!bron) return { fout: { status: 404, error: 'Deze bron bestaat niet.' } };
    const w = wieIn(req, staat);
    const g = poortIn(w, bron.stad, 'geld.beheren', 'donations', staat);
    return g.ok ? { bron, w, giften: groepIn(staat, bron) } : { fout: g };
  }

  /* ---------- de kantoorkant: de code uitgeven ---------- */
  function codeVoor(req, bronId, b) {
    const vooraf = deur(req, bronId);
    if (vooraf.fout) return vooraf.fout;
    /* Alle giften van DEZELFDE gever in deze stad krijgen dezelfde code. Anders
       heeft een trouwe gever twaalf codes en ziet hij bij elke code een stukje
       van zichzelf. */
    if (vooraf.giften.some(x => x.persoonscode_id)) {
      return { status: 409, error: 'Er is al een uitgegeven code. Gebruik roteren om een nieuwe code uit te geven en de oude direct te sluiten.' };
    }
    return codelevenscyclus.transactie(tx => {
      const staat = tx.staat || S();
      const d = deurIn(req, bronId, staat);
      if (d.fout) return d.fout;
      const bron = d.bron;
      const binding = bindSubject(staat, bron, b || {});
      if (binding.fout) return binding.fout;
      const giften = binding.giften;
      if (giften.some(x => x.persoonscode_id))
        return { status: 409, error: 'Er is intussen al een code uitgegeven. Roteer die code.' };
      for (const x of giften) delete x.donateurcode;
      const r = tx.uitgeven(invoer(d.w, bron, b));
      if (!r.ok) return r;
      for (const x of giften) x.persoonscode_id = r.toegang.id;
      audit(d.w.key, 'donateur.code-uitgegeven', bron.gever,
        giften.length + ' gift(en); rotatie 1; vervalt ' + r.toegang.expires_at, staat);
      return { ok: true, code: r.code, toegang: r.toegang, giften: giften.length,
        melding: 'Deze code opent alle ' + giften.length + ' gift(en) van ' + bron.gever + ' in deze stad, en niets van iemand anders.' };
    });
  }

  function codeIntrekken(req, bronId, reden) {
    const vooraf = deur(req, bronId);
    if (vooraf.fout) return vooraf.fout;
    return codelevenscyclus.transactie(tx => {
      const staat = tx.staat || S();
      const d = deurIn(req, bronId, staat);
      if (d.fout) return d.fout;
      const bron = d.bron;
      const giften = d.giften;
      const ids = codeIds(giften);
      let toegang = null;
      for (const id of ids) {
        const r = tx.intrekken(id, d.w.key, reden);
        if (!r.ok) return r;
        toegang = r.toegang;
      }
      for (const x of giften) delete x.donateurcode;
      audit(d.w.key, 'donateur.code-ingetrokken', bron.gever, String(reden || 'geen reden'), staat);
      return { ok: true, ingetrokken: true, toegang };
    });
  }

  function codeRoteren(req, bronId, b) {
    const vooraf = deur(req, bronId);
    if (vooraf.fout) return vooraf.fout;
    return codelevenscyclus.transactie(tx => {
      const staat = tx.staat || S();
      const d = deurIn(req, bronId, staat);
      if (d.fout) return d.fout;
      const bron = d.bron;
      let giften = d.giften;
      if (!subjectVan(bron)) {
        const binding = bindSubject(staat, bron, b || {});
        if (binding.fout) return binding.fout;
        giften = binding.giften;
      }
      const ids = codeIds(giften);
      let r;
      if (ids.length) {
        for (const extra of ids.slice(1)) {
          const dicht = tx.intrekken(extra, d.w.key, b && b.reden);
          if (!dicht.ok) return dicht;
        }
        r = tx.roteer(ids[0], Object.assign({ prefix: 'RTFS', issuer: d.w.key,
          reden: b && b.reden }, opties(b)));
      } else r = tx.uitgeven(invoer(d.w, bron, b));
      if (!r.ok) return r;
      for (const x of giften) {
        delete x.donateurcode;
        x.persoonscode_id = r.toegang.id;
      }
      audit(d.w.key, 'donateur.code-geroteerd', bron.gever, 'rotatie ' + r.toegang.rotatie, staat);
      return { ok: true, code: r.code, toegang: r.toegang, giften: giften.length,
        melding: 'De vorige code is direct gesloten. Geef deze nieuwe code persoonlijk aan de gever.' };
    });
  }

  /* De periodieke schenkingsovereenkomst vastleggen. De grendel zit hier: onder
     de vijf jaar is het geen periodieke gift, hoe je het ook noemt. */
  function periodiekVast(req, bronId, b) {
    b = b || {};
    const bron = S().bronnen.find(x => x.id === String(bronId || ''));
    if (!bron) return { status: 404, error: 'Deze bron bestaat niet.' };
    const w = wie(req);
    const g = poort(w, bron.stad, 'geld.beheren', 'donations');
    if (!g.ok) return g;
    const jaren = Math.round(Number(b.jaren) || 0);
    if (jaren < JAREN_MIN) {
      return { status: 400, error: 'Een periodieke gift loopt ten minste ' + JAREN_MIN + ' jaar. Korter kan, maar dan is het een gewone gift ' +
        'met een drempel -- en een bewijs dat iets anders suggereert kost de gever geld bij zijn aangifte.' };
    }
    const kenmerk = schoon(b.kenmerk, 60);
    if (!kenmerk) return { status: 400, error: 'Wat is het kenmerk van de overeenkomst? Zonder vindbare overeenkomst is er niets vastgelegd.' };
    const tot = schoon(b.tot, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tot)) return { status: 400, error: 'Tot wanneer loopt de overeenkomst?' };
    bron.periodiek = { jaren, kenmerk, tot, door: w.key };
    audit(w.key, 'donateur.periodiek', bron.gever, jaren + ' jaar, kenmerk ' + kenmerk);
    save();
    /* Hier stond onvoorwaardelijk "aftrekbaar zonder drempel" -- onwaar zodra de
       stichting geen ANBI is, en juist bij de aangifte. De zin staat nu in
       ./gift-vormen.js en de stand komt uit ./gift.js. */
    const anbi = (ctx.giftAnbi && ctx.giftAnbi()) || 'onbekend';
    return { ok: true, melding: 'Vastgelegd onder kenmerk ' + kenmerk + '. ' +
      anbiZin(anbi, (ctx.giftRsin && ctx.giftRsin()) || '', 'periodiek') };
  }

  return { codeVoor, codeIntrekken, codeRoteren, periodiekVast };
};
