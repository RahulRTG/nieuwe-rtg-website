/* RTMAIL (deelmodule): de BEWAARTERMIJN van de leidingsplek (besluit 584A,
   12 oktober 2026). Sollicitatiepost (kern/rtmail-leiding.js) gaat over een
   sollicitant en blijft niet staan tot iemand eraan denkt.

   1. STANDAARD: vier weken na binnenkomst, ook zonder instelling.
   2. VERLENGEN per bericht (of een lijst BESTAANDE berichten), hoogstens een
      jaar, door een manager van DEZE zaak (de route), met grondslag en noodzaak.
      Nooit vanzelf, in te trekken, niet na verloop, en niet voor oude post die
      op de juridische toets wacht: die toets beslist.
   3. EEN JURIDISCHE HOLD is iets anders: ./rtmail-leidinghold.js.
   4. DE RONDE (aan de bewaarveger) schrijft per zaak een vernietigingsbewijs
      op de DAG afgerond, zonder inhoud en zonder sollicitant.
   5. MIGRATIE: oude post (zonder `regel`) gaat pas weg na de juridische toets
      van de eigenaar, en dan alleen de set die hij vooraf zag (vingerafdruk).
      Een kortere postvaktermijn wordt nergens overgenomen. */
'use strict';

const crypto = require('crypto');
const DAG = 86400e3;
const TERMIJN_DAGEN = 28;
const MAX_DAGEN = 365;
const REGEL = '584A';
const GRONDSLAGEN = Object.freeze(['toestemming-sollicitant', 'lopende-procedure', 'geschil', 'wettelijke-plicht']);
const SYSTEEM = 'systeem: dagelijkse ronde';
const dag = (iso) => (iso ? String(iso).slice(0, 10) : null);

module.exports = ({ B, store, save, busVan, kap, nu }) => {
  function L() {
    const b = B();
    if (!b.leiding || typeof b.leiding !== 'object') b.leiding = {};
    if (!Array.isArray(b.leiding.spoor)) b.leiding.spoor = [];
    return b.leiding;
  }
  // lezen maakt niets aan (een leespad dat schrijft is PG_SAVE_ONTBREEKT)
  const lees = () => (B().leiding || {});
  const plek = () => (store().leiding || []);
  const hold = require('./rtmail-leidinghold')({ L, lees, plek, save, busVan, kap, nu, crypto });
  const dagenVoor = (m) => Math.max(TERMIJN_DAGEN, (m.verlenging && m.verlenging.dagen) || 0);
  const vervalt = (m) => new Date((Date.parse(m.at) || 0) + dagenVoor(m) * DAG).toISOString();
  const bestaand = (m) => m.regel !== REGEL;
  const toetsNu = () => lees().toets || null;
  const getoetst = () => !!(toetsNu() && toetsNu().getoetst);
  const goedgekeurd = (m) => getoetst() && (toetsNu().set || []).includes(m.id);

  /* Verlengen, inkorten of intrekken (dagen === 28) van BESTAANDE berichten. */
  function verleng({ adres, ids, dagen, grondslag, noodzaak, door }) {
    const bus = busVan(adres);
    if (!door) return { status: 403, error: 'Wie verlengt, komt uit de inlog; die ontbreekt.' };
    if (!Number.isInteger(dagen) || dagen < TERMIJN_DAGEN) return { status: 400, error: '`dagen` is een geheel getal van ' + TERMIJN_DAGEN + ' (intrekken) tot ' + MAX_DAGEN + '.' };
    if (dagen > MAX_DAGEN) return { status: 400, error: 'Langer dan een jaar (' + MAX_DAGEN + ' dagen) na binnenkomst kan niet. Een wettelijke bewaarplicht is een juridische hold.' };
    if (typeof grondslag !== 'string' || !GRONDSLAGEN.includes(grondslag)) return { status: 400, error: 'Kies een grondslag: ' + GRONDSLAGEN.join(', ') + '.' };
    const n = kap(noodzaak, 600);
    if (!n) return { status: 400, error: 'Zeg waarom (noodzaak).' };
    if (!Array.isArray(ids) || !ids.length || ids.some(x => typeof x !== 'string'))
      return { status: 400, error: 'Noem de berichten; verlengen gaat per bericht en nooit voor post die nog moet komen.' };
    const t = nu();
    const rijen = [];
    for (const id of [...new Set(ids)]) {
      const m = plek().find(x => x.id === id && busVan(x.naar) === bus);
      if (!m) return { status: 404, error: 'Niet op de leidingsplek van deze zaak: ' + id + '.' };
      if (bestaand(m) && !getoetst()) return { status: 409, error: 'Bericht ' + id + ' is van voor de termijnregel en wacht op de juridische toets; die beslist, niet een verlenging.' };
      if (vervalt(m) <= t) return { status: 409, error: 'Bericht ' + id + ' is al verlopen; een verlenging achteraf kan niet.' };
      rijen.push(m);
    }
    const v = { dagen, grondslag, noodzaak: n, door, at: t };
    for (const m of rijen) {
      if (dagen === TERMIJN_DAGEN) delete m.verlenging; else m.verlenging = v;
      L().spoor.unshift(Object.assign({ postvak: bus, id: m.id, actie: dagen === TERMIJN_DAGEN ? 'ingetrokken' : 'verlengd' }, v));
    }
    save();
    return { ok: true, aantal: rijen.length, verlenging: dagen === TERMIJN_DAGEN ? null : v };
  }

  /* DE JURIDISCHE TOETS IN TWEE STAPPEN. Eerst de omvang: wat er onder de regel
     zou verdwijnen, per zaak met de oudste en jongste DAG, en een vingerafdruk
     van precies die set. Bevestigen verwijst naar die vingerafdruk; is de set
     intussen veranderd, dan weigert hij. Post onder een beoordeelde hold valt er
     nooit onder. */
  function omvang() {
    const set = plek().filter(m => bestaand(m) && !hold.houdtVast(m, busVan(m.naar)));
    const ids = set.map(m => m.id).sort();
    const perZaak = {};
    for (const m of set) {
      const z = perZaak[busVan(m.naar)] = perZaak[busVan(m.naar)] || { aantal: 0, oudste: null, jongste: null };
      z.aantal++; const d = dag(m.at);
      if (!z.oudste || d < z.oudste) z.oudste = d;
      if (!z.jongste || d > z.jongste) z.jongste = d;
    }
    return { ids, perZaak, vingerafdruk: crypto.createHash('sha256').update(ids.join('\n')).digest('hex').slice(0, 32) };
  }
  function toets({ getoetst: aan, vingerafdruk, door, notitie }) {
    if (!door) return { status: 403, error: 'De juridische toets staat op naam van de eigenaar.' };
    const l = L();
    if (aan === true) {
      const o = omvang();
      if (typeof vingerafdruk !== 'string' || vingerafdruk !== o.vingerafdruk)
        return { status: 409, error: 'De set is veranderd sinds de omvang werd getoond; vraag de omvang opnieuw op.', omvang: o };
      l.toets = { getoetst: true, set: o.ids, vingerafdruk: o.vingerafdruk, perZaak: o.perZaak, door, notitie: kap(notitie, 300) || null, at: nu() };
    } else l.toets = { getoetst: false, set: [], door, notitie: kap(notitie, 300) || null, at: nu() };
    l.spoor.unshift({ postvak: null, toets: l.toets.getoetst, vingerafdruk: l.toets.vingerafdruk || null, door, at: l.toets.at });
    save();
    return { ok: true, toets: l.toets };
  }

  function ronde(tijd, { meld } = {}) {
    const t = new Date(tijd || Date.now()).toISOString();
    const s = store();
    const weg = {}, wacht = {}, vast = {};
    const tel = (o, bus) => { o[bus] = (o[bus] || 0) + 1; };
    const blijft = (s.leiding || []).filter(m => {
      const bus = busVan(m.naar);
      if (vervalt(m) > t) return true;
      if (hold.houdtVast(m, bus)) { tel(vast, bus); return true; }
      if (bestaand(m) && !goedgekeurd(m)) { tel(wacht, bus); return true; }
      (weg[bus] = weg[bus] || []).push(m);
      return false;
    });
    const zaken = Object.keys(weg);
    if (zaken.length) {
      s.leiding = blijft;
      for (const bus of zaken) {
        const l = weg[bus];
        B().vernietigingen.unshift({ postvak: bus, plek: 'leiding', aantal: l.length,
          van: dag(l.reduce((a, m) => (a && a < m.at ? a : m.at), null)), tot: dag(l.reduce((a, m) => (a && a > m.at ? a : m.at), null)),
          door: SYSTEEM, sessie: null, reden: 'bewaartermijn van de leidingsplek verstreken', at: nu() });
      }
    }
    const holdsVerlopen = hold.escaleer(t, meld);
    if (zaken.length || holdsVerlopen) save();
    const som = (o) => Object.values(o).reduce((a, n) => a + (Array.isArray(n) ? n.length : n), 0);
    const w = som(wacht);
    return { verwijderd: som(weg), wachtOpToets: w, vastgehouden: som(vast), holdsVerlopen,
      let: [w ? w + ' bericht(en) van voor de termijnregel wachten op de juridische toets en worden niet verwijderd.' : '',
        holdsVerlopen ? holdsVerlopen + ' juridische hold(s) wachten op herbeoordeling; de post blijft bewaard en het kantoor is gewaarschuwd.' : '']
        .filter(Boolean).join(' ') || null };
  }

  function beeld(bus) {
    const t = nu();
    const rijen = plek().filter(m => busVan(m.naar) === bus);
    const tt = toetsNu();
    return { termijnDagen: TERMIJN_DAGEN, maxDagen: MAX_DAGEN, grondslagen: GRONDSLAGEN, holdGrondslagen: hold.HOLD_GRONDSLAGEN,
      verlengingen: rijen.filter(m => m.verlenging).map(m => ({ id: m.id, dagen: m.verlenging.dagen,
        grondslag: m.verlenging.grondslag, at: m.verlenging.at, vervalt: vervalt(m) })),
      holds: hold.beeld(bus, t),
      migratie: { getoetst: getoetst(), toets: tt ? { getoetst: tt.getoetst, door: 'de eigenaar', at: tt.at } : null,
        wachtOpToets: rijen.filter(m => bestaand(m) && !goedgekeurd(m)).length,
        let: getoetst() ? 'De juridische toets is gezet voor de set die de eigenaar vooraf zag; die post volgt de termijn.'
          : 'Post van voor de regel heeft een termijn, maar wordt niet verwijderd tot de eigenaar de juridische toets zet.' },
      spoor: (lees().spoor || []).filter(r => r.postvak === bus).slice(0, 50),
      let: 'Sollicitatiepost vervalt ' + TERMIJN_DAGEN + ' dagen na binnenkomst; een dagelijkse ronde ruimt hem op, tenzij een verlenging (hoogstens een jaar) of een beoordeelde juridische hold hem vasthoudt.' };
  }

  return { verleng, toets, omvang, ronde, beeld, vervalt, hold, REGEL, GRONDSLAGEN, TERMIJN_DAGEN, MAX_DAGEN };
};
module.exports.REGEL = REGEL;
