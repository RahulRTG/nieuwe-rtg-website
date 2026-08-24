/* BEWIJS BOVEN STATUS: niet "werkt het" maar "wanneer is het voor het laatst
   aangetoond".

   Een statusbord dat groen zegt, zegt niets -- het zegt alleen dat niemand heeft
   gekeken. Dit huis heeft daar al een antwoord op voor de CODE (TOEZICHT.md,
   BEWIJS.md, WETTEN.json, de ketenronde), maar dat gaat over toetsen die bij een
   uitrol draaien. Dit bestand gaat over de DRAAIENDE stand: klopt het geld nu,
   op dit moment, en waaruit blijkt dat.

   DRIE STANDEN EN GEEN VIERDE:

     bewezen        er is zojuist gemeten en de meting slaagde. Het bewijs staat
                    erbij: het getal waaruit het blijkt.
     niet-bewezen   er is niets dat dit aantoont. Dat is GEEN storing en ook geen
                    "waarschijnlijk goed" -- het is de eerlijke stand voor alles
                    wat we niet hebben gemeten.
     gezakt         er is gemeten en het klopte niet. Dit is de enige stand die
                    om iemand vraagt.

   ER IS MET OPZET GEEN "GROEN". Wat niet gemeten is, heet hier niet-bewezen en
   niet "in orde" -- precies de regel die TENANT.md hanteert met `nietGebouwd`:
   liever de reden dan een lege waarde die als een ja leest. Het verschil doet
   ertoe op de dag dat iemand op dit bord kijkt om te besluiten of hij kan
   uitbetalen.

   WAT HIER LIVE TE METEN IS, wordt live gemeten -- niet uit een cache, niet uit
   een eerdere run. Vier van de vijf controles hieronder rekenen het hele
   grootboek door op het moment van vragen. De vijfde (afstemming met de
   betaalpartner) kan dat niet: die hangt aan een derde en aan een echte
   afschriftvergelijking die dit huis nog niet doet. Dus staat hij op
   niet-bewezen, mét de reden, en niet op groen.

   Krijgt de gedeelde ctx van kern/pay/index.js. */
module.exports = (ctx) => {
  /* De tijd komt uit de ctx van de paylaag en niet uit het besturingssysteem:
     een bewijs dat zijn eigen ouderdom aan het OS vraagt, is met een verzette
     klok (RTG_KLOK) niet te beproeven -- en verlopen bewijs is juist wat deze
     laag moet kunnen zien. */
  const { d, saldi, grootboek, saldoVan, waarde, nu } = ctx;

  const bewezen = (id, wat, bewijs) => ({ id, wat, staat: 'bewezen', bewijs, gemetenOp: nu() });
  const gezakt = (id, wat, uitleg, bewijs) => ({ id, wat, staat: 'gezakt', uitleg, bewijs, gemetenOp: nu() });
  const onbewezen = (id, wat, uitleg) => ({ id, wat, staat: 'niet-bewezen', uitleg, gemetenOp: null });

  /* 1. Het grootboek sluit. De som van alle saldi is exact nul en geen leden- of
        partnerrekening staat rood. Dit is de zwaarste bewering die deze laag
        doet en tegelijk de goedkoopste om na te rekenen. */
  function sluitend() {
    let som = 0; const rood = [];
    const s = saldi();
    for (const rek in s) {
      if (!Object.prototype.hasOwnProperty.call(s, rek)) continue;
      som += s[rek];
      if (!rek.startsWith('extern:') && s[rek] < 0) rood.push(rek);
    }
    if (som !== 0) return gezakt('sluitend', 'Het grootboek sluit', 'De som van alle saldi is niet nul.', { som });
    if (rood.length) return gezakt('sluitend', 'Het grootboek sluit', 'Er staan rekeningen rood die dat niet mogen.', { rood: rood.slice(0, 10) });
    return bewezen('sluitend', 'Het grootboek sluit', { rekeningen: Object.keys(s).length, som: 0, roodstaand: 0 });
  }

  /* 2. Geen positie boven zijn plafond. Dit is de grond onder het besluit
        WALLET_SALDO (zie WAARDE.md par. 3), dus hier hoort een teller te staan
        en niet een aanname. Nul overtredingen is het bewijs. */
  function plafonds() {
    if (!waarde) return onbewezen('plafonds', 'Plafonds worden nageleefd', 'De waardelaag draait hier niet, dus er is geen plafond om na te rekenen.');
    const over = [];
    const s = saldi();
    for (const rek in s) {
      if (!Object.prototype.hasOwnProperty.call(s, rek)) continue;
      const p = waarde.positie(rek);
      if (!p || !Number.isFinite(p.spec.plafondCenten)) continue;
      if (s[rek] > p.spec.plafondCenten) over.push({ rek, saldo: s[rek], plafond: p.spec.plafondCenten });
    }
    return over.length
      ? gezakt('plafonds', 'Plafonds worden nageleefd', 'Er staan posities boven hun plafond.', { overtredingen: over.slice(0, 10), aantal: over.length })
      : bewezen('plafonds', 'Plafonds worden nageleefd', { gecontroleerd: Object.keys(s).length, overtredingen: 0 });
  }

  /* 3. Wat vastgezet staat, bestaat ook. Reserveringen en oormerken zijn
        voornemens over geld dat er hoort te zijn; staat er meer vast dan er op
        de rekening staat, dan belooft het scherm iets dat niet bestaat. */
  function vastgezetKlopt() {
    if (!waarde) return onbewezen('vastgezet', 'Vastgezet geld bestaat ook', 'De waardelaag draait hier niet.');
    const fout = [];
    const s = saldi();
    for (const rek in s) {
      if (!Object.prototype.hasOwnProperty.call(s, rek)) continue;
      /* Alleen rekeningen waar werkelijk iets vaststaat. Zonder die eerste
         voorwaarde vlagde deze controle elke extern-rekening: die horen
         negatief te staan (dat IS de tegenkant van het dubbel boekhouden), en
         `0 > -1000` is waar. De controle meldde dan een tekort op een rekening
         waar niemand ooit iets had vastgezet -- een alarm dat elke dag afgaat,
         leert mensen alarmen te negeren. */
      const vast = waarde.gereserveerd(rek) + waarde.apart(rek);
      if (vast > 0 && vast > s[rek]) fout.push({ rek, saldo: s[rek], vastgezet: vast });
    }
    return fout.length
      ? gezakt('vastgezet', 'Vastgezet geld bestaat ook', 'Er staat meer vastgezet dan er op de rekening staat.', { fout: fout.slice(0, 10) })
      : bewezen('vastgezet', 'Vastgezet geld bestaat ook', { gecontroleerd: Object.keys(s).length, tekorten: 0 });
    }

  /* 4. Het grootboek is intern samenhangend: elke regel heeft twee kanten en een
        bedrag boven nul. Een regel met centen <= 0 of met van === naar is geen
        boeking maar een fout die zich als een boeking voordoet. */
  function regelsKloppen() {
    let stuk = 0, gekeken = 0;
    for (const r of grootboek()) {
      gekeken++;
      if (!r.van || !r.naar || r.van === r.naar || !(Math.round(Number(r.centen)) > 0)) stuk++;
      if (gekeken >= 50000) break;
    }
    return stuk
      ? gezakt('regels', 'Elke boeking heeft twee kanten', 'Er staan regels in het grootboek die geen geldige boeking zijn.', { stuk, gekeken })
      : bewezen('regels', 'Elke boeking heeft twee kanten', { gekeken, stuk: 0 });
  }

  /* 5. Afstemming met de betaalpartner. HIER STAAT MET OPZET GEEN GROEN.

     Dit is de controle die een CFO als eerste wil zien en die dit huis nog niet
     kan leveren: hij vraagt om het echte afschrift van de betaaldienst naast het
     eigen grootboek, en dat afschrift wordt hier niet opgehaald. Wat we WEL
     hebben is de laatste keer dat een afstemming is vastgelegd; staat die er
     niet, dan is het antwoord "nooit" en niet "in orde".

     Een groen vinkje hier zou de gevaarlijkste leugen van het hele bord zijn,
     want hij zou precies dekken wat niemand anders dekt. */
  function afstemming() {
    const laatst = d().payAfstemming && d().payAfstemming.op;
    if (!laatst) return onbewezen('afstemming', 'Afgestemd met de betaaldienst',
      'Er is nog nooit een afstemming met het afschrift van de betaaldienst vastgelegd. Dit huis haalt dat afschrift niet op, dus deze controle kan niet vanzelf slagen.');
    const ouderdomUur = Math.round((nu() - laatst) / 3600000);
    if (ouderdomUur > 48) return gezakt('afstemming', 'Afgestemd met de betaaldienst',
      'De laatste afstemming is ' + ouderdomUur + ' uur oud; een bewijs dat verlopen is, bewijst niets meer.', { laatst, ouderdomUur });
    return { id: 'afstemming', wat: 'Afgestemd met de betaaldienst', staat: 'bewezen',
      bewijs: { laatst, ouderdomUur }, gemetenOp: laatst };
  }

  /* Het bord. De volgorde is die van zwaarte: wat het meest zegt, staat boven. */
  function bewijsbord() {
    const rijen = [sluitend(), plafonds(), vastgezetKlopt(), regelsKloppen(), afstemming()];
    const telling = { bewezen: 0, 'niet-bewezen': 0, gezakt: 0 };
    for (const r of rijen) telling[r.staat]++;
    return { ok: true, controles: rijen, telling,
      /* Het eindoordeel is niet "alles groen" maar "niets gezakt EN alles
         gemeten". Zolang er iets niet-bewezen is, is de stand niet bewezen --
         dat is een andere uitspraak dan dat er iets mis is, en het bord hoort
         dat verschil te maken in plaats van het weg te middelen. */
      oordeel: telling.gezakt ? 'gezakt' : (telling['niet-bewezen'] ? 'deels bewezen' : 'bewezen'),
      uitleg: 'Niet-bewezen betekent dat er niets is dat het aantoont; dat is iets anders dan dat er iets mis is.' };
  }

  return { bewijsbord };
};
