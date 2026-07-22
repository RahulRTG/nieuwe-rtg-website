/* Het werkvenster: de werkgever bepaalt wanneer personeel op de werkpagina
   en de PDA mag, en wanneer niet. Een tijdslot per weekdag (of de dag dicht),
   op de server afgedwongen bij ELKE ingang naar een personeelssessie: de
   personeelslogin met PIN en het starten via het ene RTG-account. Zo is er
   geen achterdeur: buiten het venster komt er simpelweg geen sessie.

   Bewuste regels:
   - De manager valt er nooit onder (die stelt het venster juist in) en de
     werkgever kan personen vrijstellen (bijv. de bedrijfsleider).
   - Een venster mag over middernacht heen lopen (18:00-02:00).
   - Rahul ADVISEERT los daarvan: ziet hij in de agenda een lege dag, of in
     de klok dat iemand al veel uren maakte, of een zorgprofiel dat om rust
     vraagt, dan zegt hij dat, maar hij blokkeert nooit. Advies is van Rahul,
     de toegang is van de werkgever, de keuze is van de mens.

   maakWerkvenster(state) volgt het vaste kern-patroon. */

const DAGEN = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];

function maakWerkvenster({ db, save, klokVan, zorgVan }) {
  const TIJD = /^([01]\d|2[0-3]):[0-5]\d$/;

  function werkvensterVan(s) {
    const st = s.settings = s.settings || {};
    if (!st.werkvenster || typeof st.werkvenster !== 'object') {
      st.werkvenster = { aan: false, dagen: {}, vrijgesteld: [] };
    }
    return st.werkvenster;
  }

  /* de werkgever stelt in: aan/uit, per weekdag een slot of dicht, vrijstellingen */
  function zetWerkvenster(s, body) {
    const w = werkvensterVan(s);
    if (typeof body.aan === 'boolean') w.aan = body.aan;
    if (body.dagen && typeof body.dagen === 'object') {
      for (let d = 0; d < 7; d++) {
        const inzet = body.dagen[d] || body.dagen[DAGEN[d]];
        if (!inzet || typeof inzet !== 'object') continue;
        if (inzet.dicht === true) { w.dagen[d] = { dicht: true }; continue; }
        const van = String(inzet.van || ''), tot = String(inzet.tot || '');
        if (TIJD.test(van) && TIJD.test(tot)) w.dagen[d] = { van, tot };
        else if (inzet.dicht === false) delete w.dagen[d]; // terug naar altijd open
      }
    }
    if (Array.isArray(body.vrijgesteld)) {
      w.vrijgesteld = body.vrijgesteld.map(Number).filter(Number.isInteger).slice(0, 50);
    }
    save();
    return { ok: true, werkvenster: w };
  }

  const minuten = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

  /* mag deze persoon NU (of op moment d) de werkomgeving in? */
  function magWerken(s, actor, d) {
    if (!actor || actor.manager) return { ok: true };
    const w = werkvensterVan(s);
    if (!w.aan) return { ok: true };
    if (w.vrijgesteld.includes(Number(actor.staffId))) return { ok: true };
    const nu = d || new Date();
    const dag = nu.getDay();
    const slot = w.dagen[dag];
    if (!slot) return { ok: true }; // geen slot voor deze dag = open
    const dicht = { ok: false, venster: slot };
    if (slot.dicht) {
      dicht.error = 'De werkgever heeft de werkomgeving vandaag (' + DAGEN[dag] + ') gesloten voor personeel.';
      return dicht;
    }
    const m = nu.getHours() * 60 + nu.getMinutes();
    const van = minuten(slot.van), tot = minuten(slot.tot);
    // over middernacht heen (18:00-02:00): binnen als NA van OF VOOR tot
    const binnen = van <= tot ? (m >= van && m < tot) : (m >= van || m < tot);
    if (binnen) return { ok: true };
    dicht.error = 'Buiten het werkvenster: vandaag mag je hier van ' + slot.van + ' tot ' + slot.tot + '. Tot dan is de werkomgeving dicht.';
    return dicht;
  }

  /* Rahuls advies: kijkt (alleen lezend) naar de agenda van het gekoppelde
     lid, de geklokte uren en het zorgprofiel. Geeft hooguit een zin terug;
     null betekent: niets aan de hand, geen gepush. Nooit blokkerend. */
  function werkAdvies({ code, staffId, lidKey, d }) {
    const nu = d || new Date();
    const redenen = [];
    if (code != null && staffId != null && klokVan) {
      try {
        const k = klokVan(code, Number(staffId));
        if (k.vandaagUren >= 10) redenen.push('je hebt vandaag al ' + k.vandaagUren + ' uur geklokt');
        else if (k.weekUren >= 44) redenen.push('je zit deze week al op ' + k.weekUren + ' uur');
      } catch (e) {}
    }
    if (lidKey) {
      const dag = nu.toISOString().slice(0, 10);
      const items = (db.data.agendas || {})['lid:' + lidKey] || [];
      const vrij = !items.some(i => !i.gedaan && String(i.datum) === dag);
      const L = (db.data.live || {})[lidKey];
      if (vrij && !(L && L.active) && redenen.length) redenen.push('je agenda is vandaag leeg');
      try {
        const z = zorgVan && zorgVan(lidKey);
        if (z && z.medisch && redenen.length) redenen.push('en met wat er in je zorgprofiel staat is rust extra waardevol');
      } catch (e) {}
    }
    if (!redenen.length) return null;
    return { tekst: 'Rahul denkt met je mee: ' + redenen.join(', ') + '. Misschien is iets anders doen nu beter; jij beslist, dit is alleen een advies.' };
  }

  return { werkvensterVan, zetWerkvenster, magWerken, werkAdvies };
}

module.exports = { maakWerkvenster };
