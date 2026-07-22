/* Het werkvenster: de werkgever bepaalt wanneer personeel op de werkpagina
   en de PDA mag, en wanneer niet. Een tijdslot per weekdag (of de dag dicht),
   op de server afgedwongen bij ELKE ingang naar een personeelssessie: de
   personeelslogin met PIN en het starten via het ene RTG-account. Zo is er
   geen achterdeur: buiten het venster komt er simpelweg geen sessie.

   Bewuste regels:
   - De manager valt er nooit onder (die stelt het venster juist in) en de
     werkgever kan personen vrijstellen (bijv. de bedrijfsleider).
   - Een venster mag over middernacht heen lopen (18:00-02:00).
   - Per persoon kan de werkgever afwijken: altijd, nooit, of eigen tijden;
     en per persoon een thuiswerk-toestemming die de werkplek-eis opheft.
   - De werkplek zelf kan een GPS-zone zijn (punt + straal): buiten de zone
     geen werksessie, tenzij thuiswerk is toegestaan (net als op de desktop).
     De positie komt van het toestel, wordt alleen op het inlogmoment
     vergeleken en NOOIT opgeslagen; alleen slagen/weigeren belandt in het
     inlog-journaal. GPS van een toestel is te vervalsen; dit is een
     werkafspraak-slot, geen bewijsmiddel, en dat zegt de uitleg ook.
   - Rahul ADVISEERT los daarvan: ziet hij in de agenda een lege dag, of in
     de klok dat iemand al veel uren maakte, of een zorgprofiel dat om rust
     vraagt, dan zegt hij dat, maar hij blokkeert nooit. Advies is van Rahul,
     de toegang is van de werkgever, de keuze is van de mens.

   maakWerkvenster(state) volgt het vaste kern-patroon. */

const DAGEN = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const STANDEN = ['zaak', 'altijd', 'nooit', 'eigen'];

function maakWerkvenster({ db, save, klokVan, zorgVan, haversine }) {
  const TIJD = /^([01]\d|2[0-3]):[0-5]\d$/;

  function werkvensterVan(s) {
    const st = s.settings = s.settings || {};
    if (!st.werkvenster || typeof st.werkvenster !== 'object') {
      st.werkvenster = { aan: false, dagen: {}, vrijgesteld: [] };
    }
    if (!st.werkvenster.perStaff || typeof st.werkvenster.perStaff !== 'object') st.werkvenster.perStaff = {};
    return st.werkvenster;
  }

  /* de werkgever stelt in: aan/uit, per weekdag een slot of dicht,
     vrijstellingen, de werkplek-zone en de stand per persoon */
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
    // de werkplek-zone: een punt met straal, of null om hem weg te halen
    if (body.plek === null) delete w.plek;
    if (body.plek && typeof body.plek === 'object') {
      const lat = Number(body.plek.lat), lng = Number(body.plek.lng);
      const radiusM = Math.round(Number(body.plek.radiusM));
      if (Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
          Number.isFinite(lng) && lng >= -180 && lng <= 180 &&
          Number.isFinite(radiusM) && radiusM >= 50 && radiusM <= 50000) {
        w.plek = { lat, lng, radiusM, aan: body.plek.aan !== false };
      } else if (typeof body.plek.aan === 'boolean' && w.plek) {
        w.plek.aan = body.plek.aan; // alleen de schakelaar, zonder nieuwe coordinaten
      }
    }
    // per persoon: stand (zaak/altijd/nooit/eigen), eigen tijden, thuiswerk
    if (body.perStaff && typeof body.perStaff === 'object') {
      for (const idr of Object.keys(body.perStaff).slice(0, 100)) {
        const id = Number(idr), inzet = body.perStaff[idr];
        if (!Number.isInteger(id) || !inzet || typeof inzet !== 'object') continue;
        const p = w.perStaff[id] = w.perStaff[id] || {};
        if (STANDEN.includes(inzet.stand)) p.stand = inzet.stand;
        if (p.stand === 'eigen') {
          const van = String(inzet.van || p.van || ''), tot = String(inzet.tot || p.tot || '');
          if (TIJD.test(van) && TIJD.test(tot)) { p.van = van; p.tot = tot; }
          else p.stand = 'zaak'; // eigen tijden zonder geldige tijden = terug naar de zaak
        } else { delete p.van; delete p.tot; }
        if (typeof inzet.thuiswerk === 'boolean') p.thuiswerk = inzet.thuiswerk;
        // helemaal standaard = de regel opruimen, zo blijft de kast leeg
        if ((p.stand === 'zaak' || !p.stand) && !p.thuiswerk) delete w.perStaff[id];
      }
    }
    save();
    return { ok: true, werkvenster: w };
  }

  const minuten = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

  /* zit dit moment binnen een van/tot-slot (mag over middernacht lopen)? */
  function binnenSlot(nu, slot) {
    const m = nu.getHours() * 60 + nu.getMinutes();
    const van = minuten(slot.van), tot = minuten(slot.tot);
    // over middernacht heen (18:00-02:00): binnen als NA van OF VOOR tot
    return van <= tot ? (m >= van && m < tot) : (m >= van || m < tot);
  }

  /* mag deze persoon NU (of op moment d) de werkomgeving in? De positie is
     de door het toestel gemelde plek; die wordt hier alleen vergeleken en
     nooit bewaard (privacy by design). Alles server-side: de client kan de
     controle niet omzeilen, hooguit een valse positie melden, en dat is een
     bewuste, gelogde keuze van die persoon, geen gat in de deur. */
  function magWerken(s, actor, d, positie) {
    if (!actor || actor.manager) return { ok: true };
    const w = werkvensterVan(s);
    if (!w.aan) return { ok: true };
    if (w.vrijgesteld.includes(Number(actor.staffId))) return { ok: true };
    const per = w.perStaff[Number(actor.staffId)] || {};
    if (per.stand === 'nooit') {
      return { ok: false, error: 'De werkgever heeft de werkomgeving en de PDA voor jou op dit moment uitgezet. Vraag je leidinggevende wanneer je er weer in kunt.' };
    }
    const nu = d || new Date();
    const dag = nu.getDay();
    if (per.stand !== 'altijd') {
      // eigen tijden gaan voor; anders geldt het venster van de zaak
      const slot = per.stand === 'eigen' && per.van && per.tot ? { van: per.van, tot: per.tot } : w.dagen[dag];
      if (slot) {
        const dicht = { ok: false, venster: slot };
        if (slot.dicht) {
          dicht.error = 'De werkgever heeft de werkomgeving vandaag (' + DAGEN[dag] + ') gesloten voor personeel.';
          return dicht;
        }
        if (!binnenSlot(nu, slot)) {
          dicht.error = 'Buiten het werkvenster: vandaag mag je hier van ' + slot.van + ' tot ' + slot.tot + '. Tot dan is de werkomgeving dicht.';
          return dicht;
        }
      }
    }
    // de werkplek-zone: alleen op locatie, tenzij thuiswerk is toegestaan
    // (dan werkt de PDA overal, net als de werkplek op de desktop)
    if (w.plek && w.plek.aan && haversine && !per.thuiswerk) {
      const lat = positie && Number(positie.lat), lng = positie && Number(positie.lng);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
        return { ok: false, locatieNodig: true, error: 'De werkgever heeft de werkomgeving aan de werkplek gekoppeld. Deel eenmalig je locatie om in te loggen, of vraag thuiswerk-toestemming aan je leidinggevende.' };
      }
      const afstand = haversine({ lat, lng }, w.plek);
      if (afstand == null || afstand > w.plek.radiusM) {
        const km = afstand == null ? null : Math.round(afstand / 100) / 10;
        return { ok: false, locatieNodig: true, error: 'Je bent nu niet op de werkplek' + (km != null ? ' (ongeveer ' + km + ' km ervandaan)' : '') + '. Daar werkt de werkomgeving wel; thuiswerken kan alleen met toestemming van de werkgever.' };
      }
    }
    return { ok: true };
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
