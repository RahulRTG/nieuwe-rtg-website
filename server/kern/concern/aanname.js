/* CONCERN (deelmodule): DE BRUG VAN AANNAME NAAR DIENSTVERBAND.

   Besluit 1 van ARBEID.md par. 7a (23 september 2026): het dienstverband aan
   een ENTITEIT is de waarheid over een werkrelatie. De werving eindigde tot nu
   toe bij een personeelsnummer aan een ZAAK (staffId), en er ontstond geen
   employment -- de Adamproef schakel 16 wees het aan: het lid stond in het team,
   had een contract, en /api/concern/mijnwerk zei "U heeft nog geen werkplek".

   DE BRUG LOOPT EEN KANT OP, in de vorm van kern/mobiliteit/appbrug.js: een
   aanname maakt een dienstverband, en een dienstverband maakt nooit een
   personeelsplek. Twee lijsten die elkaar bijwerken hebben geen waarheid meer.

   DE ZAAK WIJST DE ENTITEIT AAN, EN ALLEEN DE ZAAK. Een zaak is een operating
   unit op een vestiging (./vestiging.js), en die vestiging hoort bij precies een
   entiteit. Hangt de zaak nergens aan, dan is er geen werkgever om iemand in
   dienst van te nemen -- dat wordt niet geraden en niet verzonnen, en de uitslag
   zegt het met de weg eromheen. Een aanname die daardoor geen dienstverband
   krijgt, gaat gewoon door: de brug mag geen aanname weigeren die gisteren nog
   lukte (dezelfde regel als de ritbrug).

   `persoon` is de ledensleutel, dezelfde die /api/concern/mijnwerk en
   uitnodigingAccepteer() gebruiken. Die komt van de aanroeper uit een
   geverifieerd account en nooit uit een verzoek. */
'use strict';

module.exports = (ctx) => {
  const { vestigingVanUnit, employmentNieuw, employmentVanPersoon } = ctx;

  function dienstverbandUitAanname({ zaak, persoon, rol } = {}) {
    if (!persoon) return { gemaakt: false, reden: 'Zonder eigen RTG-account is er niemand om in dienst te nemen.' };
    const v = vestigingVanUnit(zaak);
    if (!v) return { gemaakt: false,
      reden: 'Deze zaak hangt aan geen vestiging van een entiteit, dus er is geen werkgever om een dienstverband bij te maken.',
      hoe: 'Koppel de zaak in RTG Concern aan een vestiging (/api/concern/vestiging/zaak); daarna krijgt elke aanname ook een dienstverband.' };
    if (v.gesloten) return { gemaakt: false, reden: 'De vestiging van deze zaak is gesloten.' };
    const r = employmentNieuw({ persoon, entiteit: v.entiteit, vestiging: v.id,
      rol: String(rol || '').trim() || 'Medewerker' });
    if (r && r.ok) return { gemaakt: true, employment: r.employment.id, entiteit: v.entiteit, vestiging: v.id };
    /* Dezelfde rol bij dezelfde werkgever loopt al: dat is geen fout, en er komt
       geen tweede bij. */
    if (r && r.status === 409 && r.employment)
      return { gemaakt: false, bestond: true, employment: r.employment.id, reden: r.error };
    return { gemaakt: false, reden: (r && r.error) || 'Het dienstverband kon niet worden gemaakt.' };
  }

  /* DE LOONKANT LEEST HET DIENSTVERBAND (besluit 1, de andere helft).

     De loonadministratie rekent op het personeelsnummer van een ZAAK, en dat
     blijft zo: het contract en de strook hangen daar. Maar als het dienstverband
     de waarheid is, hoort een loonrun te zeggen wanneer iemand loon krijgt
     zonder een lopend dienstverband bij de entiteit van die zaak. Dit is een
     CONTROLE en geen poort: de aannames van voor de brug hebben er nog geen, en
     een run die daarop weigert zou elke bestaande zaak stilleggen. Vandaar ernst
     `midden` (zichtbaar, niet blokkerend) en de weg eromheen in de uitleg.

     Wat hier niet getoetst kan worden, staat er als bevinding bij en valt niet
     weg: een zaak die aan geen entiteit hangt, en personeel zonder eigen
     account (een dienstverband hangt aan een ledensleutel). Een wachter zonder
     bron zegt dat hij niet kijkt. */
  function dienstverbandToets({ zaak, periode, personeel } = {}) {
    const van = String(periode || '') + '-01', tot = String(periode || '') + '-31';
    const v = vestigingVanUnit(zaak);
    if (!v) return { getoetst: false, bevindingen: [{ soort: 'dienstverband_niet_getoetst', ernst: 'laag',
      eigenaar: 'administrateur', uitleg: 'Deze zaak hangt aan geen vestiging van een entiteit, dus of de mensen in deze run een ' +
        'dienstverband hebben, is niet getoetst. Koppel de zaak in RTG Concern om dat wel te laten nagaan.' }] };
    const loopt = (e) => e.entiteit === v.entiteit && !(e.van && String(e.van) > tot) && !(e.tot && String(e.tot) < van);
    const bevindingen = [];
    let zonderAccount = 0;
    for (const p of (personeel || [])) {
      if (p.memberId == null) { zonderAccount++; continue; }
      const heeft = employmentVanPersoon('user-' + p.memberId, true).some(loopt);
      if (!heeft) bevindingen.push({ soort: 'loon_zonder_dienstverband', ernst: 'midden', staffId: p.id,
        eigenaar: 'administrateur', uitleg: (p.naam || 'Deze medewerker') + ' staat in de loonrun maar heeft in deze ' +
          'periode geen lopend dienstverband bij de entiteit van deze zaak. Leg het dienstverband vast in RTG Concern, ' +
          'of ga na of deze persoon hier nog werkt.' });
    }
    if (zonderAccount) bevindingen.push({ soort: 'dienstverband_niet_getoetst', ernst: 'laag', eigenaar: 'administrateur',
      uitleg: zonderAccount + ' medewerker(s) zonder eigen RTG-account: een dienstverband hangt aan een account, dus voor ' +
        'hen is het niet getoetst.' });
    return { getoetst: true, entiteit: v.entiteit, bevindingen };
  }

  /* DE INHAALSLAG: de aannames van VOOR de brug (ARBEID.md par. 7a).

     Wie al in het personeelsregister van een zaak stond voordat de brug er was,
     heeft geen dienstverband, en de loonrun meldt hem daarom. Dit zet een
     VOORSTEL klaar en voert niets uit zonder `keuze`: de eigenaar van de
     entiteit ziet wie het betreft en vinkt zelf aan -- een dienstverband op
     iemands naam is een verklaring van een werkgever, en die wordt niet in
     bulk voor hem afgelegd. `keuze` telt alleen voor wie IN het voorstel staat;
     een personeelsnummer dat er niet in staat, wordt overgeslagen met de reden.

     Personeel zonder eigen account valt erbuiten en wordt apart geteld: een
     dienstverband hangt aan een ledensleutel, en die wordt niet geraden. */
  function dienstverbandInhaal({ zaak, vestiging, personeel, keuze } = {}) {
    const v = vestigingVanUnit(zaak);
    /* Hangt de zaak op een ANDERE vestiging dan die van de aanvrager, dan is
       het antwoord hetzelfde als "bestaat niet": het verschil zou verklappen
       welke zaken waar hangen. */
    if (vestiging && (!v || v.id !== vestiging)) return { status: 404, error: 'Deze zaak hangt niet aan deze vestiging.' };
    if (!v) return { status: 409, error: 'Deze zaak hangt aan geen vestiging van een entiteit.',
      hoe: 'Koppel de zaak eerst aan een vestiging (/api/concern/vestiging/zaak).' };
    const voorstel = [];
    let alBinnen = 0, zonderAccount = 0;
    for (const p of (personeel || [])) {
      if (p.memberId == null) { zonderAccount++; continue; }
      const persoon = 'user-' + p.memberId;
      if (employmentVanPersoon(persoon, false).some(e => e.entiteit === v.entiteit)) { alBinnen++; continue; }
      voorstel.push({ staffId: p.id, naam: p.naam || null, rol: String(p.rol || '').trim() || 'Medewerker', persoon });
    }
    const uit = { ok: true, entiteit: v.entiteit, vestiging: v.id, alBinnen, zonderAccount,
      voorstel: voorstel.map(({ persoon, ...rest }) => rest) };
    if (!Array.isArray(keuze)) return Object.assign(uit, { uitgevoerd: false,
      volgende: 'Kies wie er een dienstverband krijgt; er wordt niets vastgelegd zonder uw keuze.' });
    const gekozen = new Set(keuze.map(Number));
    const gemaakt = [], overgeslagen = [];
    for (const p of voorstel) {
      if (!gekozen.has(Number(p.staffId))) continue;
      gekozen.delete(Number(p.staffId));
      const r = employmentNieuw({ persoon: p.persoon, entiteit: v.entiteit, vestiging: v.id, rol: p.rol });
      if (r && r.ok) gemaakt.push({ staffId: p.staffId, employment: r.employment.id });
      else overgeslagen.push({ staffId: p.staffId, reden: (r && r.error) || 'Het dienstverband kon niet worden gemaakt.' });
    }
    for (const id of gekozen) overgeslagen.push({ staffId: id, reden: 'Staat niet in het voorstel voor deze zaak.' });
    return Object.assign(uit, { uitgevoerd: true, gemaakt, overgeslagen });
  }

  return { dienstverbandUitAanname, dienstverbandToets, dienstverbandInhaal };
};
