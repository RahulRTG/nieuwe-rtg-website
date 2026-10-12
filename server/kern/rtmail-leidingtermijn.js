/* RTMAIL (deelmodule): de BEWAARTERMIJN van de leidingsplek (besluit 584A,
   12 oktober 2026). Sollicitatiepost (kern/rtmail-leiding.js) gaat over een
   sollicitant, niet over de zaak, en blijft daarom niet staan tot iemand eraan
   denkt.

   1. STANDAARD: vier weken na binnenkomst, ook als niemand iets instelt.
   2. VERLENGEN, per bericht of per zaak, tot hoogstens een jaar na binnenkomst,
      alleen door een manager van DEZE zaak (dat beslist de route) en alleen met
      een grondslag uit een gesloten lijst plus een noodzaak in woorden. Nooit
      vanzelf. Wie verlengt komt uit de inlog. Elke verlenging komt in het spoor.
   3. DE RONDE hangt aan de bewaarveger (opzet/bewaarveger.js) en ruimt verlopen
      post op zonder knop. Elke verwijdering laat een vernietigingsbewijs na:
      aantal, tijdvak, plek, zaak en "systeem" -- geen inhoud en geen sollicitant.
      Een juridische bewaring op het postvak houdt alles vast.
   4. MIGRATIE: post van voor deze regel (zonder `regel`) krijgt dezelfde
      termijn, maar wordt NIET verwijderd zolang de eigenaar de juridische toets
      niet op naam heeft gezet (boardroom). De ronde telt hem hardop als
      "wacht op juridische toets". Een kortere postvaktermijn wordt nergens
      overgenomen: bestaande gegevens onomkeerbaar wissen is een besluit. */
'use strict';

const DAG = 86400e3;
const TERMIJN_DAGEN = 28;
const MAX_DAGEN = 365;
const REGEL = '584A';
const GRONDSLAGEN = Object.freeze(['toestemming-sollicitant', 'lopende-procedure', 'geschil', 'wettelijke-plicht']);
const SYSTEEM = 'systeem: dagelijkse ronde';

module.exports = ({ B, store, save, busVan, kap, nu }) => {
  function L() {
    const b = B();
    if (!b.leiding || typeof b.leiding !== 'object') b.leiding = {};
    const l = b.leiding;
    if (!l.zaken || typeof l.zaken !== 'object') l.zaken = {};
    if (!Array.isArray(l.spoor)) l.spoor = [];
    return l;
  }
  // lezen maakt niets aan (een leespad dat schrijft is PG_SAVE_ONTBREEKT)
  const lees = () => (B().leiding || {});
  const zaakVerlenging = (bus) => ((lees().zaken || {})[bus]) || null;
  const dagenVoor = (m, bus) => Math.max(TERMIJN_DAGEN, (m.verlenging && m.verlenging.dagen) || 0,
    (zaakVerlenging(bus) || {}).dagen || 0);
  const vervalt = (m, bus) => new Date((Date.parse(m.at) || 0) + dagenVoor(m, bus) * DAG).toISOString();
  const bestaand = (m) => m.regel !== REGEL;
  const plek = () => (store().leiding || []);

  function verleng({ adres, id, dagen, grondslag, noodzaak, door }) {
    const bus = busVan(adres);
    if (!door) return { status: 403, error: 'Wie verlengt, komt uit de inlog; die ontbreekt.' };
    const d = parseInt(dagen, 10);
    if (!Number.isFinite(d) || d <= TERMIJN_DAGEN) return { status: 400, error: 'Verlengen is langer dan de standaard van ' + TERMIJN_DAGEN + ' dagen.' };
    if (d > MAX_DAGEN) return { status: 400, error: 'Langer dan een jaar (' + MAX_DAGEN + ' dagen) na binnenkomst kan niet.' };
    if (!GRONDSLAGEN.includes(grondslag)) return { status: 400, error: 'Kies een grondslag: ' + GRONDSLAGEN.join(', ') + '.' };
    const n = kap(noodzaak, 600);
    if (!n) return { status: 400, error: 'Zeg waarom deze post langer nodig is (noodzaak).' };
    const v = { dagen: d, grondslag, noodzaak: n, door, at: nu() };
    if (id) {
      const m = plek().find(x => x.id === String(id) && busVan(x.naar) === bus);
      if (!m) return { status: 404, error: 'Dit bericht staat niet op de leidingsplek van deze zaak.' };
      m.verlenging = v;
    } else L().zaken[bus] = v;
    L().spoor.unshift(Object.assign({ postvak: bus, id: id ? String(id) : null }, v));
    save();
    return { ok: true, verlenging: v, per: id ? 'bericht' : 'zaak' };
  }

  /* De eigenaar zet de juridische toets op naam (route: boardroom). Uitzetten
     kan ook, met dezelfde spoorregel. */
  function toets({ getoetst, door, notitie }) {
    if (!door) return { status: 403, error: 'De juridische toets staat op naam van de eigenaar.' };
    const l = L();
    l.toets = { getoetst: getoetst === true, door, notitie: kap(notitie, 300) || null, at: nu() };
    l.spoor.unshift({ postvak: null, toets: l.toets.getoetst, door, at: l.toets.at });
    save();
    return { ok: true, toets: l.toets };
  }
  const getoetst = () => !!(lees().toets && lees().toets.getoetst);

  function ronde(tijd) {
    const t = new Date(tijd || Date.now()).toISOString();
    const vakken = B().vakken || {};
    const s = store();
    const weg = {}, wacht = {}, vast = {};
    const blijft = (s.leiding || []).filter(m => {
      const bus = busVan(m.naar);
      if (vervalt(m, bus) > t) return true;
      if (vakken[bus] && vakken[bus].bewaring) { vast[bus] = (vast[bus] || 0) + 1; return true; }
      if (bestaand(m) && !getoetst()) { wacht[bus] = (wacht[bus] || 0) + 1; return true; }
      (weg[bus] = weg[bus] || []).push(m);
      return false;
    });
    const zaken = Object.keys(weg);
    if (zaken.length) {
      s.leiding = blijft;
      for (const bus of zaken) {
        const l = weg[bus];
        B().vernietigingen.unshift({ postvak: bus, plek: 'leiding', aantal: l.length,
          van: l.reduce((a, m) => (a && a < m.at ? a : m.at), null), tot: l.reduce((a, m) => (a && a > m.at ? a : m.at), null),
          door: SYSTEEM, sessie: null, reden: 'bewaartermijn van de leidingsplek verstreken', at: nu() });
      }
      save();
    }
    const som = (o) => Object.values(o).reduce((a, n) => a + (Array.isArray(n) ? n.length : n), 0);
    const w = som(wacht);
    return { verwijderd: som(weg), wachtOpToets: w, vastgehouden: som(vast),
      let: w ? w + ' bericht(en) van voor de termijnregel wachten op de juridische toets van de eigenaar en worden niet verwijderd.' : null };
  }

  function beeld(bus) {
    const rijen = plek().filter(m => busVan(m.naar) === bus);
    const wacht = getoetst() ? 0 : rijen.filter(bestaand).length;
    return { termijnDagen: TERMIJN_DAGEN, maxDagen: MAX_DAGEN, grondslagen: GRONDSLAGEN,
      verlengingZaak: zaakVerlenging(bus),
      verlengingen: rijen.filter(m => m.verlenging).map(m => ({ id: m.id, dagen: m.verlenging.dagen,
        grondslag: m.verlenging.grondslag, at: m.verlenging.at, vervalt: vervalt(m, bus) })),
      migratie: { getoetst: getoetst(), toets: lees().toets || null, wachtOpToets: wacht,
        let: getoetst() ? 'De juridische toets is gezet; post van voor de regel volgt de termijn.'
          : 'Post van voor de regel heeft een termijn, maar wordt niet verwijderd tot de eigenaar de juridische toets zet.' },
      spoor: (lees().spoor || []).filter(r => r.postvak === bus).slice(0, 50),
      let: 'Sollicitatiepost vervalt ' + TERMIJN_DAGEN + ' dagen na binnenkomst; een dagelijkse ronde ruimt hem op, tenzij een juridische bewaring of een verlenging (hoogstens een jaar) hem vasthoudt.' };
  }

  return { verleng, toets, ronde, beeld, vervalt, REGEL, GRONDSLAGEN, TERMIJN_DAGEN, MAX_DAGEN };
};
module.exports.REGEL = REGEL;
