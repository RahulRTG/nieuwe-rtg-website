/* Foundation OS, deel "veld": de app van de medewerker die op pad is.

   WAAROM DIT NIET HETZELFDE IS ALS HET BESTUURSSCHERM. Op kantoor kijk je naar
   het register; onderweg kijk je naar drie adressen. Dat is niet alleen een
   ander formaat maar een andere BLIK, en het verschil zit in wat je mag zien:
   een medewerker die alle hulpvragen van de stad kan doorbladeren, is een lek
   dat er niet hoeft te zijn. In een buurthuis kent iedereen elkaar; een
   dossier van de buurvrouw is twee tikken weg.

   DE VIER GRENDELS:

   1. ZONDER TOEWIJZING GEEN DOSSIER. De veld-app toont uitsluitend de
      hulpvragen die aan deze medewerker zijn TOEGEWEZEN. Niet zijn stad, niet
      zijn project -- aan hem. Toewijzen is een handeling van de coordinator,
      met een auditregel, en intrekken kan.

   2. DE MEDEWERKER RONDT NIET AF. Afronden zet de bewaartermijn in gang en
      sluit de zaak; dat is een besluit met gevolgen voor de betrokkene, en dat
      hoort bij de coordinator. De veld-app noteert wat er is gebeurd -- en dat
      is geen wantrouwen maar dezelfde scheiding als bij geld: wie uitvoert,
      besluit niet.

   3. HET ADRES OPENT APART, EN DAT WORDT GENOTEERD. Ook hier: wie op bezoek
      gaat heeft de gegevens nodig, dus de grendel is niet "nee" maar "met een
      spoor". Dezelfde regel en dezelfde auditlijn als op kantoor
      (casus-dossier.js) -- niet een tweede versie ervan (LAT.md regel 4).

   4. EEN BEZOEKRAPPORT DRAAGT EEN VERVOLG. Wat is er afgesproken, en wanneer?
      Een rapport dat eindigt zonder vervolgafspraak is hoe een hulpvraag stil
      blijft liggen: iedereen denkt dat de ander aan zet is. "Geen vervolg
      nodig" mag, maar dan staat het er. */

module.exports = (ctx, eigen) => {
  const { nu, rid, schoon, S, audit, wie, poort, save } = ctx;
  const { vind, contactVan } = eigen;

  const toegewezenAan = (c, key) => (c.toegewezen || []).includes(key);

  /* De poort van de veld-app: een zetel in die stad EN een toewijzing. De
     tweede voorwaarde is wat deze app onderscheidt; zonder die voorwaarde is
     dit gewoon het kantoorscherm in een kleiner lettertype. */
  function mijnCasus(req, id) {
    const c = vind(id);
    if (!c) return { status: 404, error: 'Deze hulpvraag bestaat niet.' };
    const w = wie(req);
    const g = poort(w, c.stad, 'stad.lezen', 'individual_cases');
    if (!g.ok) return g;
    if (!toegewezenAan(c, w.key)) {
      return { status: 403, error: 'Deze hulpvraag is niet aan u toegewezen. Vraag uw coordinator om hem toe te wijzen; ' +
        'wie er niet aan werkt, hoeft hem ook niet te kunnen lezen.' };
    }
    return { ok: true, c, w };
  }

  /* Het beeld voor onderweg: kort, en zonder de interne notities van anderen.
     Wie een dossier op straat openslaat, leest het naast iemand die meekijkt. */
  const kort = c => ({
    id: c.id, codenaam: c.codenaam, soort: c.soort, urgentie: c.urgentie, wijk: c.wijk,
    vraag: c.vraag, status: c.status,
    toestemming: !!c.toestemming, ingetrokken: !!c.ingetrokken,
    laatste: (c.stappen || []).filter(s => s.soort !== 'notitie').slice(0, 5)
      .map(s => ({ soort: s.soort, tekst: s.tekst, at: s.at })),
    vervolg: c.vervolg || null,
    // wat de coordinator van je verwacht, in een woord
    aanZet: c.status === 'gekoppeld' || c.status === 'in_uitvoering' });

  function mijnLijst(req) {
    const w = wie(req);
    if (!w.key) return { status: 403, error: 'Log in om uw eigen lijst te zien.' };
    const steden = new Set(w.zetels.map(z => z.stad));
    const rijen = S().casussen.filter(c => toegewezenAan(c, w.key) &&
      (w.landelijk || steden.has(c.stad)) &&
      !['afgerond', 'afgewezen'].includes(c.status));
    /* De volgorde is de volgorde van een werkdag: acuut eerst, dan wat een
       vervolgafspraak heeft die verlopen is, dan de rest. Een lijst op
       aanmaakdatum is een lijst waarin het dringende naar beneden zakt. */
    const rang = c => (c.urgentie === 'acuut' ? 0 : (c.vervolg && Date.parse(c.vervolg.op) < Date.now() ? 1 : 2));
    rijen.sort((a, b) => rang(a) - rang(b) || String(a.at).localeCompare(String(b.at)));
    return { ok: true, aantal: rijen.length,
      teLaat: rijen.filter(c => c.vervolg && Date.parse(c.vervolg.op) < Date.now()).length,
      hulpvragen: rijen.slice(0, 60).map(kort) };
  }

  function een(req, id) {
    const g = mijnCasus(req, id);
    if (!g.ok) return g;
    return { ok: true, hulpvraag: kort(g.c) };
  }

  /* Het adres. Loopt door dezelfde functie als op kantoor, met dezelfde
     auditregel -- alleen de poort ervoor is anders, want een medewerker heeft
     geen 'casus.beheren'. De toewijzing is hier de bevoegdheid. */
  function adres(req, id) {
    const g = mijnCasus(req, id);
    if (!g.ok) return g;
    return contactVan(g.w, g.c, 'veld-app');
  }

  /* Het bezoekrapport. Dit is de reden dat de app bestaat: een notitie die je
     op de stoep maakt in plaats van 's avonds thuis uit je hoofd. */
  function rapport(req, id, b) {
    b = b || {};
    const g = mijnCasus(req, id);
    if (!g.ok) return g;
    const tekst = schoon(b.tekst, 600);
    if (tekst.length < 10) {
      return { status: 400, error: 'Wat heeft u gezien en gedaan? Kort en feitelijk is genoeg, maar leeg is geen rapport.' };
    }
    const soort = ['contact', 'hulpactie', 'doorverwijzing', 'nazorg'].includes(b.soort) ? b.soort : 'contact';

    /* GRENDEL 4: een rapport draagt een vervolg. Ofwel een datum, ofwel de
       uitdrukkelijke mededeling dat er geen vervolg nodig is -- met reden. */
    const op = schoon(b.vervolgOp, 10);
    const geenVervolg = b.geenVervolg === true;
    if (!geenVervolg && !/^\d{4}-\d{2}-\d{2}$/.test(op)) {
      return { status: 400, error: 'Wanneer is het vervolg? Zet een datum, of vink aan dat er geen vervolg nodig is -- ' +
        'dan staat dat er ook. Een rapport zonder vervolg is hoe een hulpvraag blijft liggen: iedereen denkt dat de ander aan zet is.' };
    }
    if (geenVervolg && schoon(b.vervolgReden, 200).length < 5) {
      return { status: 400, error: 'Waarom is er geen vervolg nodig? Een zin is genoeg.' };
    }

    if (!Array.isArray(g.c.stappen)) g.c.stappen = [];
    if (g.c.stappen.length >= 200) return { status: 400, error: 'Dit dossier zit vol.' };
    g.c.stappen.unshift({ id: rid(), soort, tekst, door: g.w.key, veld: true, at: nu() });
    g.c.vervolg = geenVervolg
      ? { geen: true, reden: schoon(b.vervolgReden, 200), door: g.w.key, at: nu() }
      : { op, wat: schoon(b.vervolgWat, 200) || 'vervolgafspraak', door: g.w.key, at: nu() };
    audit(g.w.key, 'casus.veldrapport', g.c.codenaam, soort + (geenVervolg ? ' (geen vervolg)' : ' (vervolg ' + op + ')'));
    save();
    return { ok: true, hulpvraag: kort(g.c),
      melding: geenVervolg ? 'Genoteerd, zonder vervolg.' : 'Genoteerd. Vervolg op ' + op + '.' };
  }

  /* GRENDEL 2: afronden kan hier niet. De weigering legt uit waarom, want een
     knop die er niet is, leest als een gebrek. */
  function afronden() {
    return { status: 403, error: 'Afronden doet uw coordinator. Dat zet de bewaartermijn in gang en sluit de zaak; ' +
      'zo\'n besluit hoort niet op de stoep te vallen. Noteer wat u heeft gedaan, dan ziet hij het meteen.' };
  }

  /* ---------- de kantoorkant: toewijzen ---------- */
  function wijsToe(req, id, key, weg) {
    const c = vind(id);
    if (!c) return { status: 404, error: 'Deze hulpvraag bestaat niet.' };
    const w = wie(req);
    const g = poort(w, c.stad, 'casus.beheren', 'individual_cases');
    if (!g.ok) return g;
    const sleutel = schoon(key, 80);
    if (!sleutel) return { status: 400, error: 'Aan wie wijst u hem toe?' };
    const zetel = S().zetels.find(z => z.key === sleutel && z.stad === c.stad);
    if (!zetel && !weg) {
      return { status: 400, error: 'Die persoon heeft geen zetel in deze stadsafdeling. Toewijzen aan iemand van buiten ' +
        'de afdeling zou de stadsgrens omzeilen.' };
    }
    if (!Array.isArray(c.toegewezen)) c.toegewezen = [];
    if (weg) c.toegewezen = c.toegewezen.filter(k => k !== sleutel);
    else if (!c.toegewezen.includes(sleutel)) c.toegewezen.push(sleutel);
    audit(w.key, weg ? 'casus.toewijzing-weg' : 'casus.toegewezen', c.codenaam, sleutel);
    save();
    return { ok: true, toegewezen: c.toegewezen,
      melding: weg ? 'De toewijzing is ingetrokken; dit dossier is voor hem niet meer te openen.'
        : 'Toegewezen. Hij ziet deze hulpvraag nu in zijn veld-app, en de contactgegevens kan hij openen -- met een auditregel.' };
  }

  return { mijnLijst, een, adres, rapport, afronden, wijsToe, kort, toegewezenAan };
};
