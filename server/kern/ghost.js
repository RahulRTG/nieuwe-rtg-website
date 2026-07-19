/* Kern-module "ghost": de Ghost Driver, de vooruitkijkende verkeersleider.
   Voor elk knooppunt in de stad rijdt een onzichtbare chauffeur de komende
   twaalf uur alvast: hij weegt het vaste dagritme van het verkeer, de uitloop
   van echte evenementen (verkochte tickets per tijdslot van de
   activiteitenzaken), de eigen rittenhistorie van de zaak en het weerbeeld,
   en meldt uren van tevoren waar het vast dreigt te lopen: met een concreet
   advies welke voertuigen uit de eigen vloot eerder of anders moeten rijden,
   en een simulatie (zonder/met advies) die laat zien wat het scheelt.

   Eerlijkheid voorop: het weerbeeld is in deze demo een eigen, deterministisch
   model (zelfde dag = zelfde weer) en heet daarom overal 'weerbeeld (demo)';
   in productie schuift hier een echte weerfeed in via dezelfde functie.
   maakGhost(state) volgt het vaste kern-patroon. */

const UREN_VOORUIT = 12;
const DREMPEL = 60;          // vanaf deze kans (%) komt er een advies
const REROUTE_WINST = 0.6;   // een omleiding scheelt ~60% van de verwachte vertraging

function maakGhost({ db, findSupplier, boekingenVanZaak, haversine }) {

  /* ---- het weerbeeld (demo): deterministisch per dag en uur ---- */
  function weerVoor(datum, uur) {
    let h = 0; const s = datum + ':' + uur;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    const regenkans = h % 100;                       // 0-99
    const wind = 2 + (h >> 7) % 6;                   // 2-7 Bft
    return { regenkans, wind, bron: 'weerbeeld (demo)' };
  }

  // het vaste dagritme van wegverkeer: ochtend- en avondspits, strandtijden
  function dagritme(uur) {
    if (uur >= 8 && uur <= 10) return 30;
    if (uur >= 16 && uur <= 19) return 38;           // strand- en avondverkeer
    if (uur >= 11 && uur <= 15) return 18;
    if (uur >= 20 && uur <= 23) return 22;
    return 6;
  }

  /* ---- de knooppunten: de echte plekken van de partnerstad ---- */
  function knooppunten(stad) {
    const uit = new Map();
    for (const s of db.data.suppliers || []) {
      if (stad && s.city !== stad) continue;
      if (!s.loc || !Number.isFinite(s.loc.lat)) continue;
      const label = (s.loc.label && (s.loc.label.nl || s.loc.label)) || s.name;
      const naam = typeof label === 'string' ? label : s.name;
      if (!uit.has(naam)) uit.set(naam, { naam, lat: s.loc.lat, lng: s.loc.lng, zaken: [] });
      uit.get(naam).zaken.push(s);
    }
    return [...uit.values()];
  }

  // uitloop van echte evenementen: verkochte tickets per tijdslot; publiek
  // vertrekt rond het einde van het slot (+1 uur) en drukt dan op het knooppunt
  function evenementUitloop(punt, datum, uur) {
    let druk = 0; const bronnen = [];
    for (const s of punt.zaken) {
      if (!Array.isArray(s.activiteiten) || !s.activiteiten.length) continue;
      const kaartjes = (boekingenVanZaak(s.code) || []).filter(b => b.kind === 'ticket' && b.paid && (!b.datum || b.datum === datum));
      for (const a of s.activiteiten) for (const tijd of (a.tijden || [])) {
        const slotUur = Number(String(tijd).slice(0, 2));
        if (!Number.isFinite(slotUur) || slotUur + 1 !== uur) continue;
        const verkocht = kaartjes.filter(t => t.activiteitId === a.id && (!t.tijd || t.tijd === tijd))
          .reduce((n, t) => n + (t.personen || 1), 0);
        if (verkocht > 0) { druk += Math.min(40, verkocht * 2); bronnen.push(a.name + ' (' + verkocht + ' gasten, uitloop ' + tijd + ')'); }
      }
    }
    return { druk, bronnen };
  }

  // de eigen rittenhistorie: hoe vaak reed deze zaak op dit uur van de dag
  function ritDruk(code, uur) {
    let n = 0;
    for (const r of db.data.rides || []) {
      if (r.supplierCode !== code) continue;
      const t = r.plannedFor || r.at; if (!t) continue;
      if (new Date(t).getHours() === uur) n++;
    }
    return Math.min(15, n * 3);
  }

  /* ---- de simulatie zelf ---- */
  function simuleer(s) {
    const nu = new Date();
    const datum = nu.toISOString().slice(0, 10);
    const stad = s.city || null;
    const punten = knooppunten(stad);
    const vloot = (s.fleet || []).filter(v => v.active !== false);
    const uitkomst = [];
    const uurbeeld = [];   // altijd een beeld, ook als geen enkel uur de drempel haalt
    for (let stap = 1; stap <= UREN_VOORUIT; stap++) {
      const wanneer = new Date(nu.getTime() + stap * 3600 * 1000);
      const uur = wanneer.getHours();
      const w = weerVoor(datum, uur);
      const weerDruk = w.regenkans >= 60 ? 14 : 0;   // regen = iedereen de weg op
      let piek = 0, piekPunt = null;
      for (const punt of punten) {
        const ev0 = evenementUitloop(punt, datum, uur);
        const k0 = Math.min(97, dagritme(uur) + ev0.druk + ritDruk(s.code, uur) + weerDruk);
        if (k0 > piek) { piek = k0; piekPunt = punt.naam; }
      }
      uurbeeld.push({ tijd: String(uur).padStart(2, '0') + ':00', kans: piek, drukPunt: piekPunt, regen: w.regenkans >= 60 });
      for (const punt of punten) {
        const ev = evenementUitloop(punt, datum, uur);
        const kans = Math.min(97, dagritme(uur) + ev.druk + ritDruk(s.code, uur) + weerDruk);
        if (kans < DREMPEL) continue;
        const vertraging = Math.round(8 + kans / 4);           // verwachte minuten zonder ingrijpen
        const met = Math.round(vertraging * (1 - REROUTE_WINST));
        const inzet = vloot.slice(0, 2).map(v => v.name).join(' en ') || 'de beschikbare wagens';
        uitkomst.push({
          tijd: String(uur).padStart(2, '0') + ':00', uur, knooppunt: punt.naam, kans,
          oorzaken: [
            ...ev.bronnen,
            dagritme(uur) >= 30 ? 'het vaste dagritme (spits/stranduitloop)' : null,
            weerDruk ? 'regen in het weerbeeld (demo): meer wegverkeer' : null
          ].filter(Boolean),
          weer: w,
          advies: 'Stuur ' + inzet + ' ruim voor ' + String(uur).padStart(2, '0') + ':00 en rijd om ' + punt.naam + ' heen via de binnenroute (route B).',
          simulatie: { zonderAdvies: vertraging + ' min vertraging per rit', metAdvies: met + ' min', winst: (vertraging - met) + ' min per rit' }
        });
      }
    }
    uitkomst.sort((a, b) => b.kans - a.kans);
    return {
      stad: stad || 'alle steden', horizonUren: UREN_VOORUIT, drempel: DREMPEL,
      vloot: vloot.map(v => ({ id: v.id, naam: v.name })),
      knooppunten: punten.map(p => p.naam),
      uurbeeld,
      waarschuwingen: uitkomst.slice(0, 12),
      rustig: uitkomst.length === 0,
      toelichting: 'Voorspelling uit het vaste dagritme, de uitloop van echte evenementen (verkochte tickets), de eigen rittenhistorie en het weerbeeld (demo). De simulatie vergelijkt de verwachte vertraging zonder en met het advies.'
    };
  }

  // de verkeersleider (kantoor): dezelfde blik, over alle vervoerszaken heen
  function kantoorBeeld() {
    const uit = [];
    for (const s of db.data.suppliers || []) {
      const caps = (db.data.supplierTypes[s.type] || {}).caps || [];
      if (!caps.includes('rides')) continue;
      const r = simuleer(s);
      if (r.waarschuwingen.length) uit.push({ code: s.code, zaak: s.name, stad: s.city, waarschuwingen: r.waarschuwingen.slice(0, 3) });
    }
    return { zaken: uit };
  }

  return { ghostSimuleer: simuleer, ghostKantoor: kantoorBeeld };
}

module.exports = { maakGhost };
