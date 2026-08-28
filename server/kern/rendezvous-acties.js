/* Keuzes en veiligheidsacties van Rendez-vous. Deze naad houdt profiel- en
   matchselectie los van mutaties tussen twee leden en van de meldingen voor
   kantoor. Naar de routelaag blijft dit bewust twee kernnamen breed: kiezen
   en meldingen lezen. */
module.exports = ({ R, save, crypto, notify, schoon, nu, codenaam, gedeeld, geblokkeerd, mag }) => {
  /* DE ONTMOETPOORT STAAT OOK OP DE MUTATIES, en dat komt uit de samenvoeging
     van twee rondes. Deze module komt uit de dating-premium-ronde (blokkades en
     meldingen); de 18+-poort met geverifieerd paspoort komt uit de
     ONTMOETEN.md-fasen en stond daar op rvLike/rvPas. De routelaag stuurt alle
     drie de keuzes nu hierlangs, dus hoort de poort hier -- anders kan wie de
     poort niet haalt geen kandidaten ZIEN maar wel iemand liken. */
  const poortDicht = key => { const p = mag ? mag(key) : { ok: true }; return p.ok ? null : { status: 403, error: p.reden }; };
  function like(key, targetKey) {
    const dicht = poortDicht(key); if (dicht) return dicht;
    const r = R();
    if (!targetKey || targetKey === key) return { status: 400, error: 'Onbekend lid.' };
    if (geblokkeerd(r, key, targetKey)) return { status: 403, error: 'Dit contact is geblokkeerd.' };
    if (!r.profielen[key] || !r.profielen[key].aan) return { status: 400, error: 'Zet eerst uw eigen profiel aan.' };
    const doel = r.profielen[targetKey];
    if (!doel || !doel.aan) return { status: 404, error: 'Dit lid is niet (meer) beschikbaar.' };
    if (!r.likes[key]) r.likes[key] = {};
    if (r.passes[key]) delete r.passes[key][targetKey];
    r.likes[key][targetKey] = nu();
    const match = !!(r.likes[targetKey] && r.likes[targetKey][key]);
    save();
    if (match && notify) {
      const g = gedeeld(r.profielen[key].locaties, doel.locaties);
      const waar = g.length ? ' Denk aan een date in ' + g[0] + '.' : '';
      try { notify(key, { title: 'Rendez-vous', body: 'U heeft een match met ' + codenaam(targetKey) + '.' + waar, scope: 'lifestyle' }); } catch (e) {}
      try { notify(targetKey, { title: 'Rendez-vous', body: 'U heeft een match met ' + codenaam(key) + '.' + waar, scope: 'lifestyle' }); } catch (e) {}
    }
    return { status: 200, ok: true, match };
  }

  function pas(key, targetKey) {
    const dicht = poortDicht(key); if (dicht) return dicht;
    const r = R();
    if (!targetKey) return { status: 400, error: 'Onbekend lid.' };
    if (!r.passes[key]) r.passes[key] = {};
    r.passes[key][targetKey] = nu();
    if (r.likes[key]) delete r.likes[key][targetKey];
    save();
    return { status: 200, ok: true };
  }

  function blokkeer(key, targetKey, reden) {
    const dicht = poortDicht(key); if (dicht) return dicht;
    const r = R();
    if (!targetKey || targetKey === key || !r.profielen[targetKey])
      return { status: 400, error: 'Onbekend lid.' };
    if (!r.blokkades[key]) r.blokkades[key] = {};
    r.blokkades[key][targetKey] = nu();
    if (r.likes[key]) delete r.likes[key][targetKey];
    if (r.likes[targetKey]) delete r.likes[targetKey][key];
    const melding = schoon(reden, 200);
    if (melding) {
      r.meldingen.unshift({ id: 'rvm' + crypto.randomBytes(6).toString('hex'), van: codenaam(key),
        over: codenaam(targetKey), reden: melding, at: nu(), status: 'open' });
      r.meldingen = r.meldingen.slice(0, 500);
    }
    save();
    return { status: 200, ok: true, gemeld: !!melding };
  }

  function rvKies(key, targetKey, actie, reden) {
    if (actie === 'like') return like(key, targetKey);
    if (actie === 'pas') return pas(key, targetKey);
    if (actie === 'blokkeer') return blokkeer(key, targetKey, reden);
    return { status: 400, error: 'Onbekende keuze.' };
  }
  function rvMeldingen() { return { status: 200, meldingen: R().meldingen.slice(0, 200) }; }

  return { rvKies, rvMeldingen };
};
