/* Het gezamenlijke rampbeeld, deelbestand "evaluatie": het naoefening-rapport.
   Reconstrueert uit de bestaande gegevens wat er is gebeurd sinds de laatste
   opschaling (aanrij- en afhandeltijden per melding, evacuaties uit het
   veldhospitaal, knelpunten en de niveau-tijdlijn). Puur om van te leren; geen
   namen, alleen operationele cijfers. De rauwe evaluatie deelt dit bestand als
   gedeelde helper met de kern (het afschalen levert meteen het rapport). Krijgt de
   gedeelde ctx van kern/rampbeeld/index.js. */
module.exports = (ctx) => {
  const { db, nu, lijst, hulp, beeldVoor, findSupplier, partnersVan, KORPS_TYPES } = ctx;

  function minSinds(logboek, patroon) {
    const e = (logboek || []).find(x => patroon.test(x.wat || ''));
    return e ? e.at : null;
  }
  function TRIAGE_TEL(evac) {
    const t = {};
    for (const e of evac) t[e.triage] = (t[e.triage] || 0) + 1;
    return t;
  }
  function evaluatie(codes) {
    const h = hulp();
    const set = codes ? new Set(codes) : null;
    // sinds de laatste opschaling boven normaal (of het hele logboek als er niets is)
    const log = (h.rampLog || []);
    let start = null;
    for (let i = log.length - 1; i >= 0; i--) { if (log[i].niveau === 'normaal') break; start = log[i].at; }
    const meldingen = lijst(h.meldingen).filter(m => (!set || set.has(m.korps)) && (!start || m.at >= start - 60000));
    const aanrij = [], afhandel = [];
    let bemand = 0, langOnbemand = 0;
    for (const m of meldingen) {
      const aan = m.at;
      const tp = minSinds(m.logboek, /ter plaatse/i);
      const af = minSinds(m.logboek, /afgerond/i);
      const toe = minSinds(m.logboek, /onderweg/i);
      if (toe) bemand++;
      if (tp && aan) aanrij.push((tp - aan) / 60000);
      if (af && aan) afhandel.push((af - aan) / 60000);
      if (!toe && m.status !== 'afgerond' && nu() - aan > 10 * 60000) langOnbemand++;
    }
    const gem = arr => arr.length ? Math.round(arr.reduce((s, x) => s + x, 0) / arr.length * 10) / 10 : null;
    const perPrio = { 1: 0, 2: 0, 3: 0 };
    for (const m of meldingen) if (perPrio[m.prio] != null) perPrio[m.prio]++;
    // evacuaties uit het veldhospitaal van defensie
    const evac = [];
    for (const [code, d] of Object.entries(db.data.defensie || {})) {
      if (set && !set.has(code)) continue;
      for (const g of (d.gewonden || [])) if (g.status === 'geevacueerd') evac.push({ triage: g.triage, naar: g.naar || '', korps: code });
    }
    // knelpunten uit het huidige beeld
    const b = beeldVoor(codes);
    const knel = [];
    for (const z of b.ziekenhuizen) if (z.beddenTotaal > 0 && z.beddenVrij === 0) knel.push(z.naam + ' zat vol.');
    for (const k of b.korpsen) if (k.totaal > 0 && k.vrij === 0) knel.push(k.naam + ' had geen vrije eenheid meer.');
    if (langOnbemand) knel.push(langOnbemand + ' melding(en) bleven langer dan tien minuten onbemand.');
    // de tijdlijn van het niveau
    const tijdlijn = (start ? log.filter(l => l.at >= start - 1000) : log).slice(-12).map(l => ({ niveau: l.niveau, door: l.door, at: l.at }));
    return {
      ok: true, sinds: start, tot: nu(),
      meldingen: { totaal: meldingen.length, perPrio, bemand,
        gemAanrijMin: gem(aanrij), gemAfhandelMin: gem(afhandel), langsteAfhandelMin: afhandel.length ? Math.round(Math.max(...afhandel) * 10) / 10 : null },
      evacuaties: { totaal: evac.length, perTriage: TRIAGE_TEL(evac), lijst: evac.slice(0, 20) },
      knelpunten: knel.length ? knel : ['Geen knelpunten geregistreerd.'],
      tijdlijn
    };
  }

  /* De evaluatie voor een viewer: een korps ziet de eigen keten, de
     boardroom (viewerCode null) alles. */
  function evaluatieVoor(viewerCode) {
    if (!viewerCode) return evaluatie(null);
    const self = findSupplier(viewerCode);
    const magZien = self && (KORPS_TYPES.includes(self.type) || ['ziekenhuis', 'huisarts', 'defensie'].includes(self.type));
    if (!magZien) return { status: 403, error: 'Alleen hulpdiensten, zorg en defensie zien de evaluatie.' };
    const codes = [viewerCode, ...partnersVan(viewerCode)];
    if (codes.length === 1) return { status: 409, error: 'Verbind eerst met een ander korps in de keten.' };
    return evaluatie(codes);
  }

  // de rauwe evaluatie delen met de kern (schaal levert bij afschalen het rapport)
  ctx.evaluatieRaw = evaluatie;
  return { evaluatie: evaluatieVoor };
};
