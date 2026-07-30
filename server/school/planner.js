/* School (deelmodule): de leerplanner die school en de toetsplanner van de
   tiener samenbrengt. Een dagplanning per kind voor de komende twee weken:
   huiswerk op de inleverdag (te laat schuift naar vandaag), de leerstappen
   uit de toetsplanner op hun eigen dag, en de toetsen zelf. Alles komt uit
   de bestaande bronnen; de planner schrijft niets, hij ordent alleen.
   Afvinken loopt via de bestaande wegen: /school/huiswerk/af voor huiswerk,
   /api/rtf/tiener/toets-stap voor een leerstap (die is van de tiener zelf).

   schoolPunten() is de leesbril voor de gezinsagenda: dezelfde regel als de
   RTG-ecosysteemlaag -- de agenda leest school, hij herschrijft school niet. */

const DAG = 86400000;
const dagStr = ms => {
  const d = new Date(ms);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

/* alle schoolpunten van een gezin binnen [van, tot]: open huiswerk op de
   inleverdag en de toetsen van de tieners op de toetsdag. Alleen-lezen. */
function schoolPunten(f, g, van, tot) {
  const uit = [];
  const vandaag = dagStr(Date.now());
  for (const k of Object.values(f.klassen || {})) {
    for (const l of (k.leerlingen || [])) {
      if (l.gezinCode !== g.code) continue;
      const p = g.profielen[l.profielId];
      for (const h of (k.huiswerk || [])) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(h.deadline || '')) continue;
        if (h.deadline < van || h.deadline > tot) continue;
        if ((h.afDoor || []).includes(l.sleutel)) continue; // af is af: van de agenda
        uit.push({ id: 'hw:' + h.id + ':' + l.sleutel, bron: 'school', soort: 'huiswerk',
          titel: (h.vak ? h.vak + ': ' : '') + h.titel, datum: h.deadline, tijd: '',
          wie: l.profielId, wieNaam: p ? p.naam : l.naam, wieKleur: p && p.kleur ? p.kleur : '',
          klas: k.naam, vandaag: h.deadline === vandaag });
      }
    }
  }
  // de toetsen van de tieners: de toetsdag zelf hoort op de gezinsagenda
  for (const p of Object.values(g.profielen || {})) {
    for (const t of ((p.tiener && p.tiener.toetsen) || [])) {
      if (!t.datum || t.datum < van || t.datum > tot) continue;
      uit.push({ id: 'toets:' + t.id, bron: 'school', soort: 'toets',
        titel: 'Toets ' + t.vak + (t.wat ? ' · ' + t.wat : ''), datum: t.datum, tijd: '',
        wie: p.id, wieNaam: p.naam, wieKleur: p.kleur || '', vandaag: t.datum === vandaag });
    }
  }
  return uit;
}

module.exports = (sctx) => {
  const { router, F, K, gezinSessie } = sctx;

  /* de dagplanning: veertien dagen vooruit, per kind. Een ouder ziet alle
     kinderen, een kind alleen zichzelf; een leerstap kan alleen de tiener
     zelf afvinken (vanMij zegt de knop wel of niet te tonen). */
  router.post('/school/planner', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    if (s.p.rol === 'gast') return res.status(403).json({ error: 'Schoolzaken zijn van het gezin zelf.' });
    const mijnIds = s.beheerder ? Object.keys(s.g.profielen) : [s.p.id];
    const start = Date.now();
    const van = dagStr(start), tot = dagStr(start + 13 * DAG);
    const perDag = {};
    const leg = (datum, item) => { (perDag[datum] = perDag[datum] || []).push(item); };
    // huiswerk op de inleverdag; wat te laat is schuift naar vandaag
    for (const k of Object.values(K())) {
      for (const l of (k.leerlingen || [])) {
        if (l.gezinCode !== s.g.code || !mijnIds.includes(l.profielId)) continue;
        for (const h of (k.huiswerk || [])) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(h.deadline || '') || h.deadline > tot) continue;
          if ((h.afDoor || []).includes(l.sleutel)) continue;
          leg(h.deadline < van ? van : h.deadline, { soort: 'huiswerk', id: h.id,
            klasCode: k.code, klas: k.naam, profielId: l.profielId, kind: l.naam,
            titel: h.titel, vak: h.vak || '', laat: h.deadline < van, deadline: h.deadline });
        }
      }
    }
    // de leerstappen en de toetsen uit de toetsplanner van de tiener
    for (const pid of mijnIds) {
      const p = s.g.profielen[pid];
      for (const t of ((p && p.tiener && p.tiener.toetsen) || [])) {
        for (const stap of (t.plan || [])) {
          if (stap.af || stap.dag > tot) continue;
          leg(stap.dag < van ? van : stap.dag, { soort: 'leerstap', toetsId: t.id,
            dag: stap.dag, taak: stap.taak, vak: t.vak, profielId: pid, kind: p.naam,
            vanMij: pid === s.p.id, laat: stap.dag < van });
        }
        if (t.datum >= van && t.datum <= tot) leg(t.datum, { soort: 'toets', toetsId: t.id,
          vak: t.vak, wat: t.wat || '', profielId: pid, kind: p.naam });
      }
    }
    const dagen = [];
    for (let n = 0; n < 14; n++) {
      const datum = dagStr(start + n * DAG);
      const items = (perDag[datum] || []).sort((a, b) =>
        (a.soort === 'toets' ? 0 : a.soort === 'huiswerk' ? 1 : 2) - (b.soort === 'toets' ? 0 : b.soort === 'huiswerk' ? 1 : 2));
      if (items.length || n === 0) dagen.push({ datum, vandaag: n === 0, items });
    }
    res.json({ ok: true, dagen, vandaag: van, ouder: s.beheerder });
  });
  return {};
};
module.exports.schoolPunten = schoolPunten;
