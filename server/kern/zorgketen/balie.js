/* De zorgketen, deelbestand "balie": de agenda's en de wachtkamer. De afspraken van
   de medisch specialist en de beauty medical-kliniek (bij beauty medical is de intake
   verplicht voor er behandeld wordt), en de medische receptie: aanmelden bij de balie
   (met een vrije aanduiding, nooit kluisdata), oproepen naar een kamer, klaar. Krijgt
   de gedeelde ctx van kern/zorgketen/index.js. */
module.exports = (ctx) => {
  const { crypto, save, nu, schoon, soortVan, afspraakRij, receptieRij, AGENDAS, SPREEKKAMERS } = ctx;

  /* ---------- afspraken: specialist en beauty medical ---------- */
  function afspraakMaak(code, b) {
    const soort = soortVan(code);
    if (!AGENDAS.includes(soort)) return { status: 403, error: 'Alleen de specialist en beauty medical plannen hier afspraken.' };
    const wat = schoon(b.wat, 120);
    if (!wat) return { status: 400, error: 'Waarvoor is de afspraak?' };
    // beauty medical behandelt nooit zonder intake: eerlijk over risico's
    const intake = b.intake === true;
    if (soort === 'beautymedical' && !intake) return { status: 400, error: 'Bij beauty medical is de intake verplicht: plan eerst een intakegesprek (vink de intake aan).' };
    const a = { id: crypto.randomBytes(4).toString('hex'), wat, wanneer: schoon(b.wanneer, 40), intake, status: 'gepland', at: nu() };
    afspraakRij(code).unshift(a);
    if (afspraakRij(code).length > 500) afspraakRij(code).pop();
    save();
    return { ok: true, afspraak: a };
  }
  function afspraakZet(code, id, status) {
    const a = afspraakRij(code).find(x => x.id === id);
    if (!a) return { status: 404, error: 'Deze afspraak staat niet in de agenda.' };
    if (!['afgerond', 'geannuleerd', 'gepland'].includes(status)) return { status: 400, error: 'Kies gepland, afgerond of geannuleerd.' };
    a.status = status;
    save();
    return { ok: true, afspraak: a };
  }

  /* ---------- de medische receptie: de wachtkamer van de spreekkamers ----------
     Aanmelden bij de balie, oproepen naar een kamer, klaar. Op de borden
     staat een vrije aanduiding (bijv. "dhr. V., 10:15"), nooit kluisdata:
     de echte naam blijft in de identiteitskluis. */
  function receptieAan(code, b) {
    if (!SPREEKKAMERS.includes(soortVan(code))) return { status: 403, error: 'Alleen een spreekkamer-zaak heeft een medische receptie.' };
    const wie = schoon(b.aanduiding, 60);
    if (!wie) return { status: 400, error: 'Wie meldt zich (een korte aanduiding, geen volledige naam nodig)?' };
    const r = { id: crypto.randomBytes(4).toString('hex'), aanduiding: wie, reden: schoon(b.reden, 120), status: 'wacht', kamer: null, at: nu() };
    receptieRij(code).push(r);
    if (receptieRij(code).length > 200) receptieRij(code).shift();
    save();
    return { ok: true, bezoek: r };
  }
  function receptieRoep(code, id, kamer) {
    const r = receptieRij(code).find(x => x.id === id);
    if (!r) return { status: 404, error: 'Dit bezoek staat niet in de wachtkamer.' };
    r.status = 'opgeroepen';
    r.kamer = schoon(kamer, 30) || 'spreekkamer';
    save();
    return { ok: true, bezoek: r };
  }
  function receptieKlaar(code, id) {
    const r = receptieRij(code).find(x => x.id === id);
    if (!r) return { status: 404, error: 'Dit bezoek staat niet in de wachtkamer.' };
    r.status = 'klaar';
    save();
    return { ok: true, bezoek: r };
  }

  return { afspraakMaak, afspraakZet, receptieAan, receptieRoep, receptieKlaar };
};
