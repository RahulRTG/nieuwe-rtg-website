/* Foundation OS, deel "donateur": de gever, op zijn eigen code (RTFS-).

   DE LAATSTE VAN DE TIEN INGANGEN, en de enige waar iemand geld gaf en er
   daarna nooit meer iets van hoorde. Dat is niet alleen onbeleefd: het is de
   reden dat mensen stoppen met geven. Twee vragen, meer niet:

     WAT HEB IK GEGEVEN, en WAAR IS HET HEEN GEGAAN.

   DRIE GRENDELS, EN ZE GAAN ALLE DRIE OVER WAT HIJ NIET TE ZIEN KRIJGT:

   1. ALLEEN ZIJN EIGEN GIFTEN. Nooit wie er nog meer gaf, nooit hoeveel. Een
      code die het donateursbestand opent is een adressenlijst voor de volgende
      wervingscampagne -- van iemand anders.

   2. IMPACT OP PROJECTNIVEAU, NOOIT OP MENSNIVEAU. "Uw gift ging naar het
      Taalcafe" mag; "u hielp mevrouw K." nooit. Ook geen aantallen hulpvragen
      per wijk: een gever met een geoormerkte gift aan een kleine buurt zou
      daarmee dingen te weten komen die niemand hem hoeft te vertellen.

   3. GEEN GIFTBEWIJS WAAR HET GEEN GIFT IS. Staat er iets tegenover, dan is het
      sponsoring en niet aftrekbaar (herkomst.js weigert dat al als donatie);
      is de herkomst geweigerd, dan is er geen bewijs; en een PERIODIEKE gift
      heet alleen periodiek als er een vastgelegde overeenkomst van ten minste
      vijf jaar bij zit. Dat laatste is geen detail: zonder die overeenkomst is
      de gift gewoon een gift met een drempel, en een bewijs dat iets anders
      suggereert kost de gever geld bij zijn aangifte.

   WAT ER NIET IN ZIT: geen doneerknop en geen incasso. Geld aannemen loopt via
   RTG Pay en de bank; dit is de verantwoording achteraf. */

module.exports = (ctx, eigen) => {
  const { schoon, euro, S, wie, poort, audit, save, code } = ctx;
  const { cijfersVan } = eigen;

  const vindCode = c => {
    const k = String(c || '').trim().toUpperCase();
    return k ? S().bronnen.filter(b => b.donateurcode === k) : [];
  };

  /* Wat er met een gift gebeurde, op projectniveau. Zit er geen oormerk op,
     dan is het antwoord de stad -- en dat is een eerlijker antwoord dan een
     verzonnen toewijzing aan het mooiste project. */
  function bestemming(b) {
    if (b.projectId) {
      const p = S().projecten.find(x => x.id === b.projectId);
      if (p) {
        const ind = (p.indicatoren || [])[0] || null;
        return { soort: 'project', naam: p.naam, status: p.status, doelgroep: p.doelgroep || null,
          // een indicator van het PROJECT, niet van een mens
          doel: ind ? { wat: ind.naam || 'doel', doel: ind.doel, bereikt: ind.bereikt } : null };
      }
    }
    const s = ctx.stadVan(b.stad);
    return { soort: 'stad', naam: s ? s.naam : b.stad, status: s ? s.status : null, doelgroep: null, doel: null };
  }

  const giftBeeld = b => ({
    id: b.id, soort: b.soort, bedrag: euro(b.centen), besteed: euro(b.besteed),
    geoormerkt: !!b.projectId, ontvangenOp: String(b.at).slice(0, 10),
    bestemming: bestemming(b),
    periodiek: b.periodiek ? { tot: b.periodiek.tot, jaren: b.periodiek.jaren, kenmerk: b.periodiek.kenmerk } : null,
    /* Waarom er wel of geen giftbewijs is. De reden staat erbij, want "geen
       bewijs" zonder uitleg leest als een fout in het systeem. */
    bewijs: bewijsbaar(b) });

  function bewijsbaar(b) {
    if (b.herkomst && b.herkomst.status === 'geweigerd') {
      return { kan: false, waarom: 'Deze gift is door het bestuur niet aanvaard. Neem contact op met de stichting.' };
    }
    if (b.herkomst && b.herkomst.status === 'open') {
      return { kan: false, waarom: 'Deze gift wordt nog beoordeeld door het landelijke bestuur. Daarna kunt u het bewijs opvragen.' };
    }
    if (b.soort === 'sponsoring' || (b.herkomst && b.herkomst.tegenprestatie)) {
      return { kan: false, waarom: 'Hier staat een tegenprestatie tegenover, dus dit is sponsoring en geen gift. ' +
        'Een sponsorbedrag is voor u zakelijke kosten en geen aftrekbare gift; u krijgt er een factuur voor, geen giftbewijs.' };
    }
    if (b.soort === 'goederen') {
      return { kan: false, waarom: 'Dit is een gift in natura. De waardering daarvan is werk van uw eigen adviseur; ' +
        'de stichting geeft er geen bedrag voor af dat zij niet zelf heeft vastgesteld.' };
    }
    return { kan: true, waarom: null };
  }

  function portaal(c) {
    const giften = vindCode(c);
    if (!giften.length) return { status: 404, error: 'Deze code kennen we niet. Vraag de stichting om een nieuwe.' };
    const totaal = giften.reduce((s, b) => s + b.centen, 0);
    return { ok: true, donateur: {
      naam: giften[0].gever, anoniem: !!giften[0].anoniem,
      totaal: euro(totaal), aantal: giften.length,
      giften: giften.slice(0, 100).map(giftBeeld),
      /* Het enige landelijke cijfer dat hij ziet, en met opzet dit: waar het
         geld van de stichting als geheel heen gaat. Geen hulpvragen, geen
         wijken, geen mensen. */
      stichting: overzicht()
    } };
  }

  function overzicht() {
    const steden = S().steden.filter(s => s.status === 'actief');
    const som = (a, f) => a.reduce((x, y) => x + (Number(f(y)) || 0), 0);
    const c = steden.map(s => cijfersVan(s.id));
    return { steden: steden.length,
      projectenActief: som(c, x => x.projecten.actief),
      vrijwilligers: som(c, x => x.mensen.vrijwilligers),
      bestedingenEuro: Math.round(som(c, x => x.geld.besteed) * 100) / 100 };
  }

  /* Het giftbewijs. Bewust GEEN pdf en geen handtekening: dit is de inhoud, en
     wat de stichting ervan drukt is haar briefpapier. Wel alles wat de
     Belastingdienst erop wil zien staan. */
  function bewijs(c, giftId) {
    const giften = vindCode(c);
    if (!giften.length) return { status: 404, error: 'Deze code kennen we niet.' };
    const b = giften.find(x => x.id === String(giftId || ''));
    if (!b) return { status: 404, error: 'Deze gift staat niet op uw code.' };
    const k = bewijsbaar(b);
    if (!k.kan) return { status: 400, error: k.waarom };

    /* PERIODIEK ALLEEN ALS HET VASTLIGT. Zonder overeenkomst is het een gewone
       gift met een drempel, en dat moet er dan ook staan. */
    /* Uitdrukkelijk een ja/nee en geen "toevallig waar". Zonder de dubbele
       ontkenning gaf dit veld `undefined` terug bij een gewone gift, en een
       leesbaar veld dat soms verdwijnt laat de ontvangende kant raden -- terwijl
       juist dit veld bepaalt wat er op het bewijs staat. */
    const periodiek = !!(b.periodiek && b.periodiek.jaren >= 5);
    return { ok: true, bewijs: {
      stichting: 'Stichting RTFoundation',
      gever: b.anoniem ? 'anoniem (bij de stichting bekend)' : b.gever,
      bedrag: euro(b.centen), datum: String(b.at).slice(0, 10), soort: b.soort,
      bestemming: bestemming(b).naam,
      periodiek,
      overeenkomst: periodiek ? { kenmerk: b.periodiek.kenmerk, tot: b.periodiek.tot, jaren: b.periodiek.jaren } : null,
      toelichting: periodiek
        ? 'Periodieke gift op grond van een vastgelegde overeenkomst van ' + b.periodiek.jaren +
          ' jaar. Volledig aftrekbaar, zonder drempel en zonder plafond.'
        : 'Gewone gift. Aftrekbaar voor zover het totaal van uw giften boven de drempel uitkomt; ' +
          'wilt u zonder drempel geven, vraag de stichting dan om een periodieke schenkingsovereenkomst.'
    } };
  }

  /* ---------- de kantoorkant: de code uitgeven ---------- */
  function codeVoor(req, bronId) {
    const b = S().bronnen.find(x => x.id === String(bronId || ''));
    if (!b) return { status: 404, error: 'Deze bron bestaat niet.' };
    const w = wie(req);
    const g = poort(w, b.stad, 'geld.beheren', 'donations');
    if (!g.ok) return g;
    /* Alle giften van DEZELFDE gever in deze stad krijgen dezelfde code. Anders
       heeft een trouwe gever twaalf codes en ziet hij bij elke code een stukje
       van zichzelf. */
    const bestaand = S().bronnen.find(x => x.stad === b.stad && x.gever === b.gever && x.donateurcode);
    const sleutel = bestaand ? bestaand.donateurcode : code('RTFS');
    let n = 0;
    for (const x of S().bronnen) {
      if (x.stad === b.stad && x.gever === b.gever && !x.donateurcode) { x.donateurcode = sleutel; n++; }
    }
    audit(w.key, 'donateur.code', b.gever, n + ' gift(en) op deze code');
    save();
    return { ok: true, code: sleutel, giften: n,
      melding: 'Deze code opent alle ' + n + ' gift(en) van ' + b.gever + ' in deze stad, en niets van iemand anders.' };
  }

  /* De periodieke schenkingsovereenkomst vastleggen. De grendel zit hier: onder
     de vijf jaar is het geen periodieke gift, hoe je het ook noemt. */
  function periodiekVast(req, bronId, b) {
    b = b || {};
    const bron = S().bronnen.find(x => x.id === String(bronId || ''));
    if (!bron) return { status: 404, error: 'Deze bron bestaat niet.' };
    const w = wie(req);
    const g = poort(w, bron.stad, 'geld.beheren', 'donations');
    if (!g.ok) return g;
    const jaren = Math.round(Number(b.jaren) || 0);
    if (jaren < 5) {
      return { status: 400, error: 'Een periodieke gift loopt ten minste vijf jaar. Korter kan, maar dan is het een gewone gift ' +
        'met een drempel -- en een bewijs dat iets anders suggereert kost de gever geld bij zijn aangifte.' };
    }
    const kenmerk = schoon(b.kenmerk, 60);
    if (!kenmerk) return { status: 400, error: 'Wat is het kenmerk van de overeenkomst? Zonder vindbare overeenkomst is er niets vastgelegd.' };
    const tot = schoon(b.tot, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tot)) return { status: 400, error: 'Tot wanneer loopt de overeenkomst?' };
    bron.periodiek = { jaren, kenmerk, tot, door: w.key };
    audit(w.key, 'donateur.periodiek', bron.gever, jaren + ' jaar, kenmerk ' + kenmerk);
    save();
    return { ok: true, melding: 'Vastgelegd. Op het giftbewijs staat nu dat het een periodieke gift is: aftrekbaar zonder drempel.' };
  }

  return { portaal, bewijs, codeVoor, periodiekVast, vindCode, bewijsbaar, giftBeeld };
};
