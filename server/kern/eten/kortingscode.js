/* DE KORTINGSCODE VAN RTG ETEN (deur eten.kortingscode): een PROMOTIECODE en
   geen geheim (besluit B13 van de eigenaar, 27 september 2026). De zaak kiest
   hem zelf en deelt hem met opzet ("KERST10"), dus hij hoeft niet onraadbaar te
   zijn -- maar hij verleent wel geldwaarde, en daarom begrenst deze laag hem
   op vier manieren, alle vier in code:

   1. een VERVALDATUM (standaard dertig dagen, hooguit een jaar vooruit);
   2. een MAXIMUM aantal gebruiken over alle leden samen;
   3. een grens PER LID (standaard een keer);
   4. een REM OP RADEN: mislukte pogingen tellen per lid en per adres in de
      huisbrede emmer (tooManyTries/noteFailedTry in server/server.js) --
      dat doen de routes, deze laag zegt alleen of een poging mislukte.

   Een oude code zonder vervaldatum of maximum is ONVOLLEDIG en geeft niets:
   fail-closed, de zaak slaat hem opnieuw op en krijgt dan de grenzen erbij.

   HET INWISSELEN is een collectietransactie op `etenKortingGebruik`
   (PostgreSQL: advisory lock + FOR UPDATE): twee leden die tegelijk het laatste
   gebruik claimen, krijgen er samen precies een. Een rekening telt een keer --
   een tweede bestelling op dezelfde rekening is geen tweede gebruik. Het lid
   staat er als hash en nooit als sleutel. */
'use strict';

const COL = 'etenKortingGebruik';
const DAG = 86400000;
const STANDAARD = Object.freeze({ dagen: 30, maxGebruik: 100, perLid: 1 });
const GRENS = Object.freeze({ dagen: 366, maxGebruik: 100000, perLid: 100 });

module.exports = ({ db, bewerkCollectie, crypto, nu = () => new Date() }) => {
  const vandaag = () => nu().toISOString().slice(0, 10);
  const plus = (dagen) => new Date(nu().getTime() + dagen * DAG).toISOString().slice(0, 10);
  const geheel = (v, min, max, std) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : std; };
  const lidHash = key => crypto.createHash('sha256').update('eten-korting-lid|' + String(key || '')).digest('hex').slice(0, 32);
  const sleutel = (zaak, code) => String(zaak) + '|' + String(code).toUpperCase();

  /* Wat de zaak opslaat. Een datum in het verleden of verder dan een jaar weg
     wordt geweigerd in plaats van stil gecorrigeerd. */
  function normaliseer(b) {
    const code = String(b.code || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 30);
    if (code.length < 3) return { status: 400, error: 'Een kortingscode heeft minimaal drie letters of cijfers.' };
    const procent = Math.max(0, Math.min(100, Number(b.procent) || 0));
    const centen = Math.max(0, Math.min(100000, parseInt(b.centen, 10) || 0));
    if (!procent && !centen) return { status: 400, error: 'Geef een percentage of vast kortingsbedrag.' };
    const geldigTot = b.geldigTot == null || b.geldigTot === '' ? plus(STANDAARD.dagen) : String(b.geldigTot).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(geldigTot) || geldigTot < vandaag() || geldigTot > plus(GRENS.dagen))
      return { status: 400, error: 'Kies een vervaldatum vanaf vandaag en hooguit een jaar vooruit.' };
    return { ok: true, regel: { code, procent: procent || 0, centen: procent ? 0 : centen, actief: b.actief !== false, geldigTot,
      maxGebruik: geheel(b.maxGebruik, 1, GRENS.maxGebruik, STANDAARD.maxGebruik),
      perLid: geheel(b.perLid, 1, GRENS.perLid, STANDAARD.perLid) } };
  }

  const stand = (zaak, code) => ((db.data[COL] || {})[sleutel(zaak, code)]) || { gebruik: 0, perLid: {}, rekeningen: {} };

  /* Mag deze code NU? Zuiver (leest alleen): de controlesheet toont het, de
     claim hieronder beslist. `reden` is een van: onbekend, uit, onvolledig,
     verlopen, op, per-lid. */
  function geldig(zaak, lijst, code, lidKey, open) {
    const c = String(code || '').toUpperCase();
    const k = (lijst || []).find(x => x && String(x.code || '').toUpperCase() === c);
    if (!k) return { reden: 'onbekend' };
    if (k.actief === false) return { reden: 'uit' };
    if (!k.geldigTot || !(Number(k.maxGebruik) > 0) || !(Number(k.perLid) > 0)) return { reden: 'onvolledig' };
    if (k.geldigTot < vandaag()) return { reden: 'verlopen' };
    const st = stand(zaak, c);
    /* Loopt er voor dit lid al een OPEN rekening met deze code, dan is dit een
       vervolg op die bestelling en geen nieuw gebruik (de claim telt hem niet). */
    const h = lidKey ? lidHash(lidKey) : null;
    if (h && typeof open === 'function' && Object.entries(st.rekeningen).some(([rid, r]) => r.lid === h && open(rid)))
      return { korting: k };
    if (st.gebruik >= k.maxGebruik) return { reden: 'op' };
    if (h && (st.perLid[h] || 0) >= k.perLid) return { reden: 'per-lid' };
    return { korting: k };
  }

  /* Het gebruik tellen, atomair. Dezelfde rekening telt een keer. */
  function claim({ zaak, korting, lidKey, rekeningId }) {
    const code = String(korting.code).toUpperCase(), h = lidHash(lidKey);
    return bewerkCollectie(COL, bron => {
      const s = bron[sleutel(zaak, code)] || (bron[sleutel(zaak, code)] = { gebruik: 0, perLid: {}, rekeningen: {} });
      if (s.rekeningen[rekeningId]) return { ok: true, herhaald: true };
      if (korting.geldigTot < vandaag()) return { status: 409, reden: 'verlopen' };
      if (s.gebruik >= korting.maxGebruik) return { status: 409, reden: 'op' };
      if ((s.perLid[h] || 0) >= korting.perLid) return { status: 409, reden: 'per-lid' };
      s.gebruik += 1; s.perLid[h] = (s.perLid[h] || 0) + 1; s.rekeningen[rekeningId] = { lid: h, at: nu().toISOString() };
      return { ok: true, gebruik: s.gebruik };
    });
  }

  /* Een claim teruggeven als de bestelling daarna toch niet doorging. */
  function laat({ zaak, code, rekeningId }) {
    return bewerkCollectie(COL, bron => {
      const s = bron[sleutel(zaak, code)];
      const r = s && s.rekeningen[rekeningId];
      if (!r) return { ok: true, niets: true };
      delete s.rekeningen[rekeningId];
      s.gebruik = Math.max(0, s.gebruik - 1);
      s.perLid[r.lid] = Math.max(0, (s.perLid[r.lid] || 0) - 1);
      return { ok: true };
    });
  }

  const UITLEG = { onbekend: 'Deze kortingscode is niet geldig.', uit: 'Deze kortingscode is niet geldig.',
    onvolledig: 'Deze kortingscode is niet meer geldig; de zaak moet hem opnieuw instellen.',
    verlopen: 'Deze kortingscode is verlopen.', op: 'Deze kortingscode is op: het maximum aantal keer is bereikt.',
    'per-lid': 'Je hebt deze kortingscode al gebruikt.' };

  return { normaliseer, geldig, claim, laat, stand, UITLEG, STANDAARD, GRENS, COL };
};

module.exports.STANDAARD = STANDAARD;
module.exports.GRENS = GRENS;
