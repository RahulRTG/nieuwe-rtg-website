'use strict';
// Eenvoudige bediening op de bestaande werkruimte, klanten, kansen, projecten
// en taken. Een intern aanbod is nog geen publiek aanbod of partner-toelating.
const V = require('./praktijk-vorm');
module.exports = sctx => {
  const { app, db, save, crypto, kern, werkPoort, log, rid } = sctx;
  const werk = require('./praktijk-werk')(sctx);
  const deel = require('./praktijk-delen')(sctx);
  const hash = s => crypto.createHash('sha256').update(s).digest('hex');
  const stuur = (res, r) => { res.set('Cache-Control', 'no-store'); return res.status(r.status || 200).json(r); };
  function poort(req, res, recht) {
    const g = werkPoort(req, res, recht); if (!g) return null;
    if (g.alleenLezen || g.l.extern || !g.rechten.includes('project') || !g.rechten.includes('klant')) {
      stuur(res, { status: 403, error: 'Deze werktafel vraagt rechten voor klanten en projecten.', recht: 'project+klant' }); return null;
    }
    return g;
  }
  function wijzig(g, soort, b, doe) {
    if (!/^[\w-]{16,100}$/.test(b.idem || '')) return V.fout('Een herhaalsleutel is nodig. Vernieuw het formulier.');
    const sleutel = hash((g.l.id || 'beheer') + '|' + soort + '|' + b.idem);
    const inhoud = { ...b }; delete inhoud.idem; delete inhoud.lidToken; delete inhoud.beheerToken;
    const vinger = hash(JSON.stringify(inhoud));
    const oud = V.pak(g.w.praktijkBonnen, sleutel);
    if (oud) {
      if (oud.vinger !== vinger) return V.fout('Deze herhaalsleutel hoort bij andere gegevens.', 409);
      return soort === 'delen' ? V.fout('De link is al uitgegeven. Maak zo nodig een nieuwe link.', 409) : oud.antwoord;
    }
    if (Object.keys(g.w.praktijkBonnen || {}).length >= 20000) return V.fout('Het bewaarlimiet is bereikt. Neem contact op met RTG.', 429);
    const r = doe();
    if (!r.error) {
      (g.w.praktijkBonnen || (g.w.praktijkBonnen = {}))[sleutel] = { vinger,
        antwoord: soort === 'delen' ? { ok: true } : r };
      save();
    }
    return r;
  }
  const functies = {
    inrichten(g, b) {
      const p = V.profiel(b); if (p.error) return p;
      if (b.versie !== (g.w.praktijkProfiel?.versie || 0)) return V.fout('De inrichting is gewijzigd. Vernieuw eerst.', 409);
      if (g.w.praktijkProfiel && p.valuta !== g.w.praktijkProfiel.valuta && Object.keys(g.w.praktijkAanbod || {}).length)
        return V.fout('De valuta van bestaand aanbod kan niet achteraf veranderen.', 409);
      g.w.praktijkProfiel = { ...p, versie: (g.w.praktijkProfiel?.versie || 0) + 1 };
      log(g.w, g.l, 'praktijk-ingericht', g.w.code); return { ok: true };
    },
    aanbod(g, b) {
      if (!g.w.praktijkProfiel) return V.fout('Richt eerst uw werkplek in.', 409);
      const a = V.aanbod(b); if (a.error) return a;
      const oud = b.aanbodId && V.pak(g.w.praktijkAanbod, b.aanbodId);
      if (b.aanbodId && !oud) return V.fout('Dit aanbod is niet gevonden.', 404);
      if (oud && b.versie !== oud.versie) return V.fout('Dit aanbod is gewijzigd. Vernieuw eerst.', 409);
      if (!oud && Object.keys(g.w.praktijkAanbod || {}).length >= 500) return V.fout('Maximaal 500 onderdelen per werkplek.', 429);
      const id = oud ? oud.id : rid(8);
      (g.w.praktijkAanbod || (g.w.praktijkAanbod = {}))[id] = { ...a, id, versie: (oud?.versie || 0) + 1 };
      log(g.w, g.l, 'praktijk-aanbod', id); return { ok: true, aanbodId: id };
    },
    vraag: (g, b) => werk.vraag(g.w, g.l, b),
    stap: (g, b) => werk.stap(g.w, g.l, b),
    delen: (g, b) => deel.delen(g.w, g.l, b)
  };
  app.post('/api/bedrijf/praktijk/beeld', (req, res) => {
    const g = poort(req, res); if (g) stuur(res, V.beeld(g.w, req.body || {}));
  });
  const praktijkMutatiePoort = soort => async (req, res) => {
    let r;
    await kern.bijeen(() => {
      const g = poort(req, res, ['inrichten', 'aanbod', 'delen'].includes(soort) ? 'werkruimte' : 'project');
      if (!g) return;
      // Rechten, versie, idempotentie en mutatie staan samen in de requestcommit.
      r = wijzig(g, soort, req.body || {}, () => functies[soort](g, req.body || {}));
    }, { duurzaam: true });
    if (r) stuur(res, r);
  };
  app.post('/api/bedrijf/praktijk/inrichten', praktijkMutatiePoort('inrichten'));
  app.post('/api/bedrijf/praktijk/aanbod', praktijkMutatiePoort('aanbod'));
  app.post('/api/bedrijf/praktijk/vraag', praktijkMutatiePoort('vraag'));
  app.post('/api/bedrijf/praktijk/stap', praktijkMutatiePoort('stap'));
  app.post('/api/bedrijf/praktijk/delen', praktijkMutatiePoort('delen'));
  require('./praktijk-gast')(sctx, deel, stuur);
  return { praktijk: { beeld: V.beeld, ...functies, wijzig } };
};
