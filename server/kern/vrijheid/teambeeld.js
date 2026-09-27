/* VRIJHEID: HET TEAMBEELD -- de motor bezit geen mensen, hij krijgt een beeld.

   Dit bestand stelt dat beeld samen uit wat dit huis al heeft, en zegt bij elk
   veld waar het vandaan komt en wat er ONTBREEKT. Er wordt niets verzonnen:

     mensen        het personeelsregister van de zaak (accounts.listStaff)
     in dienst     het DIENSTVERBAND bij de entiteit van de zaak
                   (kern/concern/employment.js) -- het besluit van ARBEID.md
                   par. 7a: employment is de waarheid. Dezelfde weg als
                   dienstverbandToets in kern/concern/aanname.js: staff ->
                   ledenaccount -> dienstverband bij de entiteit van de zaak.
                   Geen account of geen dienstverband betekent NIET in dienst,
                   met de reden -- en dan beslist de motor BLOCKED, niet ja.
     diensten      het weekrooster (kern/personeel.js scheduleFor). Twee
                   eerlijkheden daarover: het kijkt ZEVEN dagen vooruit, en een
                   dag zonder vastgesteld rooster is het standaardPATROON en geen
                   besluit. Elke dienst draagt daarom zijn bron.
     bevoegdheden  het vakbewijs van het ledenaccount (kern/vakbewijs.js); een
                   stuk telt alleen als RTG het heeft afgetekend.
     eisen, verjaardagen, feestdagen   instellingen.js
     verantwoordelijkheden  NERGENS. Geen domein legt ze vast, dus de werkstand
                   is UNKNOWN en er komt geen automatisch aanbod om eerder weg te
                   gaan. Dat staat in `ontbreekt` en wordt niet gevuld.

   `bronnen` is een functie die de kern LAAT leest: bij het opstarten staan nog
   niet alle namen erin (zelfde reden als in opzet/kernlaag5f.js). */
'use strict';
const crypto = require('crypto');
const T = require('./tijd');

const DAGEN_VOORUIT = 7;

module.exports = ({ bronnen, instellingen }) => {
  function mensenVan(code, k, ontbreekt) {
    const staff = (k.accounts.listStaff(code) || []).map(s => ({ id: s.id, rol: s.role, lid: s.member_id != null ? Number(s.member_id) : null }));
    const vest = k.vestigingVanUnit ? k.vestigingVanUnit(code) : null;
    if (!vest) ontbreekt.push({ veld: 'inDienst', reden: 'Deze zaak hangt aan geen vestiging van een entiteit; zonder werkgever is er geen dienstverband, dus niemand telt als in dienst.' });
    let zonderAccount = 0, zonderDienstverband = 0;
    const mensen = staff.map(s => {
      let inDienst = null;
      if (vest && s.lid != null) {
        const lopen = (k.employmentVanPersoon('user-' + s.lid, true) || []).filter(e => e.entiteit === vest.entiteit);
        if (lopen.length) {
          const van = lopen.map(e => e.van).filter(Boolean).sort()[0] || null;
          const tot = lopen.some(e => !e.tot) ? null : lopen.map(e => e.tot).sort().pop();
          if (van) inDienst = { van, tot };
        }
        if (!inDienst) zonderDienstverband++;
      } else if (s.lid == null) zonderAccount++;
      return { id: String(s.id), rol: s.rol, lid: s.lid, inDienst };
    });
    if (zonderAccount) ontbreekt.push({ veld: 'inDienst', reden: zonderAccount + ' medewerker(s) zonder eigen RTG-account: een dienstverband hangt aan een account, dus zij tellen niet als in dienst.' });
    if (zonderDienstverband) ontbreekt.push({ veld: 'inDienst', reden: zonderDienstverband + ' medewerker(s) zonder lopend dienstverband bij de entiteit van deze zaak (RTG Concern, Dienstverbanden inhalen).' });
    return mensen;
  }

  function roosterDiensten(code, k, ontbreekt) {
    const sup = k.findSupplier ? k.findSupplier(code) : null;
    const vast = (sup && sup.roosterVast) || {};
    const r = k.scheduleFor(code) || { days: [] };
    const uit = []; let patroon = 0;
    for (const dag of r.days || []) {
      for (const p of dag.staff || []) {
        const m = /(\d{2}:\d{2})-(\d{2}:\d{2})/.exec(String(p.shift || ''));
        if (!m) continue;                                   // 'Vrij' of onbekend: geen dienst
        const bron = vast[dag.date] && vast[dag.date][p.id] ? 'vastgesteld' : 'patroon';
        if (bron === 'patroon') patroon++;
        uit.push({ persoon: String(p.id), datum: dag.date, van: m[1], tot: m[2], bron });
      }
    }
    ontbreekt.push({ veld: 'diensten', reden: 'Het rooster kijkt ' + DAGEN_VOORUIT + ' dagen vooruit (kern/personeel.js); een verjaardag of verzoek verder weg heeft nog geen dienst om vrij te geven.' });
    if (patroon) ontbreekt.push({ veld: 'diensten', reden: patroon + ' dienst(en) komen uit het standaardpatroon en niet uit een vastgesteld rooster.' });
    return uit;
  }

  function kwalificatiesVan(mensen, k, datum) {
    const uit = [];
    for (const m of mensen) {
      if (m.lid == null || !k.vakbewijzenVan) continue;
      for (const v of k.vakbewijzenVan('lid:' + m.lid, datum) || []) {
        if (v.ingetrokken) continue;
        uit.push({ persoon: m.id, code: String(v.wat || '').toUpperCase(),
          geldigTot: v.tot || (v.geldig ? '9999-12-31' : '0000-01-01'),
          afgetekendDoor: v.afgetekend ? 'rtg:' + String(v.afgetekend.door || 'kantoor') : null });
      }
    }
    return uit;
  }

  /* De eisen per WEEKDAG, uitgeschreven over de dagen die het rooster kent. */
  function eisenVan(inst, datums) {
    const uit = [];
    for (const datum of datums) for (const e of inst.eisen || [])
      if (e.weekdag === T.weekdag(datum)) uit.push({ datum, van: e.van, tot: e.tot, minBezetting: e.minBezetting, vereist: e.vereist });
    return uit;
  }

  function teambeeld(code, opties) {
    const o = opties || {};
    const k = bronnen();
    const ontbreekt = [];
    const inst = instellingen.lees(code);
    const mensen = mensenVan(code, k, ontbreekt);
    for (const m of mensen) { const v = inst.verjaardagen[m.id]; if (v) m.verjaardag = v.mmdd; }
    const diensten = roosterDiensten(code, k, ontbreekt);
    const datums = [...new Set(diensten.map(d => d.datum))].sort();
    const eisen = eisenVan(inst, datums);
    if (!(inst.eisen || []).length) ontbreekt.push({ veld: 'eisen', reden: 'Er is geen bezetting vastgelegd; zonder eis is dekking niet aan te tonen en beslist een mens.' });
    if (!(inst.feestdagen || []).length) ontbreekt.push({ veld: 'feestdagen', reden: 'Er is geen feestdagenlijst vastgelegd; een feestdag telt als gewone dag.' });
    ontbreekt.push({ veld: 'verantwoordelijkheden', reden: 'Geen domein legt verantwoordelijkheden per dienst vast; de werkstand is daarom UNKNOWN en er komt geen automatisch aanbod om eerder weg te gaan.' });
    const rosterVersie = crypto.createHash('sha256').update(JSON.stringify(diensten)).digest('hex').slice(0, 16);
    return {
      organisatie: String(code).toUpperCase(), rosterVersie,
      managers: mensen.filter(m => m.rol === 'manager').map(m => m.id),
      mensen: mensen.map(({ lid, ...rest }) => rest),
      diensten, eisen, feestdagen: inst.feestdagen || [], verantwoordelijkheden: [], schaars: o.schaars || [],
      kwalificaties: kwalificatiesVan(mensen, k, o.datum || datums[0] || new Date().toISOString().slice(0, 10)),
      ontbreekt
    };
  }

  return { teambeeld, DAGEN_VOORUIT };
};
