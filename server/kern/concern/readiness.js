/* CONCERN (deelmodule): READINESS EN LAUNCH BLOCKING. Stap 8.

   GEEN SCORE ZONDER AFWIJKING -- de grens uit CONCERN.md, en de enige reden dat
   dit bestand een percentage mag tonen. Elke deelscore staat naast de concrete
   punten die hem drukken, en een punt zonder handeling hoort er niet te staan.
   Waar niets te meten valt komt GEEN cijfer: een 0 leest als een fout.

   DRIE ERNSTNIVEAUS, EN DE BLOKKADE ZIT OP DE CAPABILITY. Een restaurant zonder
   menu kan zijn account gebruiken; alleen "online bestellen" gaat niet aan. Zat
   de blokkade op het bedrijf, dan houdt een ontbrekend veld een heel concern
   tegen -- en dan vult iemand het met onwaarheid om verder te kunnen.

   EN HET IS GEEN JURIDISCH OORDEEL. "Dossier technisch compleet: 94%" telt
   velden; "waterdicht" kan geen enkel systeem universeel zeggen. */
'use strict';

const NIVEAUS = { info: 0, aandacht: 1, blokkerend: 2 };

module.exports = (ctx) => {
  const { entiteitBeeld, vestigingAlleVanEntiteit, employmentVanEntiteit,
    uitnodigingOpenstaand, concernUbo, concernMagTekenen, concernGeraaktDoorVerloop,
    scopeFunctiescheiding, findSupplier, tijdVandaag } = ctx;

  /* Een deelgebied telt zijn eigen punten. `nvt: true` betekent: hier valt niets
     te meten, en dan komt er GEEN cijfer -- zie de kop. */
  const deel = (id, label, punten, nvt) => {
    if (nvt) return { id, label, nvt: true, punten: [],
      uitleg: 'Hier valt op dit moment niets te meten.' };
    const blok = punten.filter(p => p.ernst === 'blokkerend').length;
    const let_ = punten.filter(p => p.ernst === 'aandacht').length;
    /* Een blokkerend punt weegt zwaarder dan een aandachtspunt, en dat moet in
       het getal te zien zijn -- anders leest 90% met een blokkade hetzelfde als
       90% met vijf kleine dingen. */
    const straf = Math.min(100, blok * 25 + let_ * 8);
    return { id, label, score: Math.max(0, 100 - straf), punten,
      blokkerend: blok, aandacht: let_ };
  };

  /* ---- de deelgebieden ---- */

  function juridisch(e) {
    const b = entiteitBeeld(e);
    const p = [];
    if (!b.naam) p.push({ ernst: 'blokkerend', wat: 'De statutaire naam ontbreekt.', doe: 'Vul de naam in.' });
    if (!b.rechtsvorm) p.push({ ernst: 'blokkerend', wat: 'De rechtsvorm is nog niet gekozen.', doe: 'Kies een rechtsvorm.' });
    if (!b.registraties.length) p.push({ ernst: 'aandacht', wat: 'Er staat geen registratie (KvK of gelijkwaardig).', doe: 'Voeg het registratienummer toe.' });
    if (!b.fiscaal.some(f => String(f.soort).toLowerCase().includes('btw')))
      p.push({ ernst: 'aandacht', wat: 'Het BTW-nummer ontbreekt.', doe: 'Voeg het BTW-nummer toe.' });
    if (b.rechtspersoon && !b.bestuurders.length)
      p.push({ ernst: 'blokkerend', wat: 'Deze rechtspersoon heeft geen bestuurder.', doe: 'Leg vast wie bestuurder is.' });

    /* De UBO. Niet "ontbreekt" maar "is niet vast te stellen": hij wordt
       gerekend, dus als er niets uitkomt is dat een gevolg van ontbrekende
       aandelen en niet van een leeg veld. */
    if (b.rechtspersoon) {
      const u = concernUbo(e.id);
      if (!u.ubos.length) p.push({ ernst: 'aandacht',
        wat: 'De UBO is niet vast te stellen: er zijn geen aandeelhouders en geen bestuurders vastgelegd.',
        doe: 'Leg de aandelenverhouding vast; de UBO wordt daaruit gerekend.' });
      for (const r of (u.ringen || [])) p.push({ ernst: 'aandacht',
        wat: 'Er lopen aandelen in een kring; het uiteindelijke belang is niet volledig te rekenen.',
        doe: 'Controleer de deelnemingen: ' + (r.via || []).join(' → ') });
    }

    /* Wat er binnenkort afloopt is geen fout maar een seintje -- en het verschil
       hoort in het antwoord te staan. */
    for (const g of concernGeraaktDoorVerloop(e.id, 60)) {
      const raakt = g.raakt.vestigingen.length;
      p.push({ ernst: 'aandacht',
        wat: g.feit.label + ' "' + g.feit.waarde + '" verloopt op ' + g.feit.tot + '.',
        doe: raakt ? 'Verlengen; dit raakt ' + raakt + ' vestiging(en).' : 'Verlengen of beëindigen.' });
    }
    return deel('juridisch', 'Juridisch', p);
  }

  function team(e) {
    const mensen = employmentVanEntiteit(e.id, false);
    const open = uitnodigingOpenstaand(e.id);
    const p = [];
    if (open.length) p.push({ ernst: 'aandacht',
      wat: open.length + ' uitnodiging' + (open.length === 1 ? ' is' : 'en zijn') + ' nog niet geaccepteerd.',
      doe: 'Herinneren of intrekken.' });
    const zonderPlek = mensen.filter(m => m.telt && !m.vestiging);
    if (zonderPlek.length) p.push({ ernst: 'info',
      wat: zonderPlek.length + ' medewerker(s) staan niet op een vestiging.',
      doe: 'Wijs een vestiging aan, of laat het zo als zij overal werken.' });

    const fs = scopeFunctiescheiding(e.id);
    for (const c of fs.conflicten) p.push({ ernst: 'aandacht', wat: c.kop + ' (' + c.persoon + ').', doe: c.waarom });

    return deel('team', 'Team', p, mensen.length === 0 && open.length === 0);
  }

  function bestuurbaar(e) {
    const b = entiteitBeeld(e);
    const p = [];
    if (b.rechtspersoon) {
      const t = concernMagTekenen(e.id, null);
      if (!t.alleen.length && !t.samenGenoeg) p.push({ ernst: 'blokkerend',
        wat: 'Er is niemand die namens deze entiteit kan tekenen.',
        doe: 'Leg vast wie bestuurder is en of hij alleen of gezamenlijk bevoegd is.' });
      else if (!t.alleen.length) p.push({ ernst: 'info',
        wat: 'Niemand kan alleen tekenen; twee gezamenlijk bevoegde bestuurders samen wel.',
        doe: 'Dat kan een bewuste keuze zijn; geen actie nodig.' });
    }
    return deel('bestuur', 'Bestuur', p, !b.rechtspersoon);
  }

  function operations(e) {
    const vest = vestigingAlleVanEntiteit(e.id).filter(v => !v.gesloten);
    const p = [];
    const zonderUnit = vest.filter(v => !(v.units || []).length);
    if (zonderUnit.length) p.push({ ernst: 'info',
      wat: zonderUnit.length + ' vestiging(en) hebben nog geen zaak.',
      doe: 'Wijs een zaak aan, of laat het zo als er niets draait.' });
    for (const v of vest) {
      for (const code of (v.units || [])) {
        const s = findSupplier(code);
        if (!s) { p.push({ ernst: 'aandacht', wat: 'Zaak ' + code + ' bestaat niet meer.', doe: 'Maak hem los van ' + v.naam + '.' }); continue; }
        if (!s.city) p.push({ ernst: 'info', wat: s.name + ' staat niet op de kaart.', doe: 'Vul de plaats in.' });
      }
    }
    return deel('operations', 'Operations', p, vest.length === 0);
  }

  /* ---- LAUNCH BLOCKING ----

     Per capability: mag hij aan? De blokkade zit hier en niet op het bedrijf.
     De regels lezen de zaak zelf, want dat is waar de inhoud staat. */
  const EISEN = [
    { cap: 'orders', label: 'Online bestellen', eis: (s) => (s.menu || []).length > 0,
      wat: 'Er staat geen menu.', doe: 'Voeg gerechten toe voordat u online bestellen aanzet.' },
    { cap: 'bookings', label: 'Reserveren', eis: (s) => (s.rooms || []).length > 0 || (s.settings && s.settings.reservationsOpen !== false),
      wat: 'Er zijn geen kamers of tafels ingericht.', doe: 'Richt de voorraad in.' },
    { cap: 'retail', label: 'Winkel', eis: (s) => (s.collecties || []).length > 0,
      wat: 'Er is geen collectie.', doe: 'Voeg een collectie toe.' },
    { cap: 'rides', label: 'Ritten', eis: (s) => (s.fleet || []).length > 0,
      wat: 'Er staat geen voertuig in de vloot.', doe: 'Voeg een voertuig toe.' }
  ];

  function launch(e) {
    const uit = [];
    for (const v of vestigingAlleVanEntiteit(e.id).filter(x => !x.gesloten)) {
      for (const code of (v.units || [])) {
        const s = findSupplier(code);
        if (!s) continue;
        const caps = ctx.db.capsVan ? ctx.db.capsVan(s) : [];
        for (const eis of EISEN) {
          if (!caps.includes(eis.cap)) continue;
          const ok = !!eis.eis(s);
          uit.push({ vestiging: v.naam, zaak: s.code, capability: eis.cap, label: eis.label,
            ernst: ok ? 'info' : 'blokkerend',
            mag: ok, wat: ok ? null : eis.wat, doe: ok ? null : eis.doe });
        }
      }
    }
    return { capabilities: uit,
      geblokkeerd: uit.filter(x => !x.mag),
      uitleg: 'Een blokkade geldt voor die ene capability en niet voor het bedrijf: de rest kan gewoon live.' };
  }

  /* ---- het geheel ---- */
  function readiness(e) {
    const delen = [juridisch(e), bestuurbaar(e), team(e), operations(e)];
    const l = launch(e);
    const gemeten = delen.filter(d => !d.nvt);
    const punten = delen.flatMap(d => d.punten);
    const alles = punten.concat(l.geblokkeerd.map(g => ({ ernst: 'blokkerend',
      wat: g.label + ' bij ' + g.zaak + ': ' + g.wat, doe: g.doe })));

    return {
      op: tijdVandaag(),
      delen,
      /* Geen totaalcijfer als er niets te meten valt -- en het totaal is het
         GEMIDDELDE van wat wél gemeten is, niet van alles inclusief de lege
         gebieden. Anders drukt een entiteit zonder vestigingen haar eigen score. */
      totaal: gemeten.length ? Math.round(gemeten.reduce((n, d) => n + d.score, 0) / gemeten.length) : null,
      launch: l,
      aandacht: alles.filter(p => p.ernst === 'aandacht'),
      blokkerend: alles.filter(p => p.ernst === 'blokkerend'),
      /* De zin die de ondernemer leest. Geen "stap 43 van 78". */
      regel: alles.length
        ? 'Er ' + (alles.length === 1 ? 'is nog 1 punt dat' : 'zijn nog ' + alles.length + ' punten die') + ' uw aandacht vragen.'
        : 'Er zijn geen openstaande punten.',
      grens: 'Dit telt velden en signalen. Het is geen juridisch oordeel; "waterdicht" kan geen enkel systeem universeel zeggen.'
    };
  }

  return { READINESS_NIVEAUS: NIVEAUS, concernReadiness: readiness, concernLaunch: launch };
};
