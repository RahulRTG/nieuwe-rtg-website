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
  const { schoon, euro, S, codelevenscyclus } = ctx;
  const { cijfersVan } = eigen;

  const DOEL = 'foundation-persoonsportaal';
  const SOORT = 'donateur';
  const SCOPE = { lezen: 'donateur:lezen', bewijs: 'donateur:bewijs' };
  const volg = (r, fn) => r && typeof r.then === 'function' ? r.then(fn) : fn(r);

  function vindCode(c, scope) {
    return volg(codelevenscyclus.controleer(c, { doel: DOEL, soort: SOORT, scope }, (staat, toegang) => {
      const bron = staat || S();
      const giften = (bron.bronnen || []).filter(b =>
        b.persoonscode_id === toegang.id &&
        b.donateur_subject_id === toegang.onderwerp.id);
      return giften.length ? { giften, staat: bron } : null;
    }), t => {
      if (!t.ok) return { fout: { status: t.status, error: t.error } };
      return { giften: t.gebonden.giften, staat: t.gebonden.staat, toegang: t.toegang };
    });
  }

  /* Wat er met een gift gebeurde, op projectniveau. Zit er geen oormerk op,
     dan is het antwoord de stad -- en dat is een eerlijker antwoord dan een
     verzonnen toewijzing aan het mooiste project. */
  function bestemming(b, inStaat) {
    const staat = inStaat || S();
    if (b.projectId) {
      const p = (staat.projecten || []).find(x => x.id === b.projectId);
      if (p) {
        const ind = (p.indicatoren || [])[0] || null;
        return { soort: 'project', naam: p.naam, status: p.status, doelgroep: p.doelgroep || null,
          // een indicator van het PROJECT, niet van een mens
          doel: ind ? { wat: ind.naam || 'doel', doel: ind.doel, bereikt: ind.bereikt } : null };
      }
    }
    const s = ctx.stadVanIn(b.stad, staat);
    return { soort: 'stad', naam: s ? s.naam : b.stad, status: s ? s.status : null, doelgroep: null, doel: null };
  }

  const giftBeeld = (b, inStaat) => ({
    id: b.id, soort: b.soort, bedrag: euro(b.centen), besteed: euro(b.besteed),
    geoormerkt: !!b.projectId, ontvangenOp: String(b.at).slice(0, 10),
    bestemming: bestemming(b, inStaat),
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
    return volg(vindCode(c, SCOPE.lezen), deur => {
      if (deur.fout) return deur.fout;
      const giften = deur.giften;
      const totaal = giften.reduce((s, b) => s + b.centen, 0);
      return { ok: true, donateur: {
        naam: giften[0].gever, anoniem: !!giften[0].anoniem,
        totaal: euro(totaal), aantal: giften.length,
        giften: giften.slice(0, 100).map(b => giftBeeld(b, deur.staat)),
        /* Het enige landelijke cijfer dat hij ziet, en met opzet dit: waar het
           geld van de stichting als geheel heen gaat. Geen hulpvragen, geen
           wijken, geen mensen. */
        stichting: overzicht(deur.staat)
      } };
    });
  }

  function overzicht(inStaat) {
    const staat = inStaat || S();
    const steden = (staat.steden || []).filter(s => s.status === 'actief');
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
    return volg(vindCode(c, SCOPE.bewijs), deur => {
      if (deur.fout) return deur.fout;
      const giften = deur.giften;
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
        bestemming: bestemming(b, deur.staat).naam,
        periodiek,
        overeenkomst: periodiek ? { kenmerk: b.periodiek.kenmerk, tot: b.periodiek.tot, jaren: b.periodiek.jaren } : null,
        toelichting: periodiek
          ? 'Periodieke gift op grond van een vastgelegde overeenkomst van ' + b.periodiek.jaren +
            ' jaar. Volledig aftrekbaar, zonder drempel en zonder plafond.'
          : 'Gewone gift. Aftrekbaar voor zover het totaal van uw giften boven de drempel uitkomt; ' +
            'wilt u zonder drempel geven, vraag de stichting dan om een periodieke schenkingsovereenkomst.'
      } };
    });
  }

  /* De kantoorkant woont in ./donateur-kantoor.js: dit bestand ging over de
     10 KB en de naad loopt langs de lezer -- hier de gever, daar de medewerker. */
  const kantoor = require('./donateur-kantoor')(ctx, { DOEL, SOORT, SCOPE });

  return { portaal, bewijs, codeVoor: kantoor.codeVoor,
    codeIntrekken: kantoor.codeIntrekken, codeRoteren: kantoor.codeRoteren,
    periodiekVast: kantoor.periodiekVast, vindCode, bewijsbaar, giftBeeld, SCOPE };
};
