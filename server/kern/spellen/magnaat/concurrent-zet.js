/* Magnaat: WAT DE AI-CONCURRENT DOET -- de zetten die uit zijn koers volgen.

   De koers staat in ./concurrent.js; dit bestand doet er iets mee. Dezelfde
   scheiding als bij de AI-manager: daar de wetten, hier de besluiten -- en om
   dezelfde reden, want de lijst besluiten groeit met elke laag mee en de wetten
   niet.

   ALLES LOOPT DOOR DE ACTIETABEL. Hij krijgt hem geinjecteerd, precies zoals de
   manager, en raakt de staat verder niet aan. Een tegenstander met een eigen
   ingang is een tweede economie.

   HIJ ZIET WAT JIJ ZIET. Elke beslissing hieronder gaat over `beeld` -- de
   uitkomst van `zicht` voor hem -- en nooit over de staat. Dat is te
   controleren: deze module leest `st` alleen om de kavels van de KAART te
   kennen, en die liggen op straat. */
const C = require('./concurrent');
const { SECTOREN } = require('./sectoren');
const { KOSTENSTAND } = require('./prijsstand');
const { basisvraag, drukFactor } = require('./vraag');
const { rendabelVanaf } = require('./maat');

module.exports = ({ ACTIES, kaart }) => {
  const doe = (potje, h, z) => (ACTIES[z.actie] ? ACTIES[z.actie](potje, h, z) : { error: 'onbekend' });

  /* WAAR HIJ BOUWT. In zijn eigen zones, op een vrij kavel, met een maat die
     volgt uit wat hij zich kan veroorloven. Geen kavelzoektocht over de hele
     kaart: dat zou meten hoe goed hij zoekt in plaats van hoe hij speelt --
     dezelfde reden als bij de profielen in scripts/magnaat-strateeg.js. */
  function bouwen(potje, h, ai, beeld, gelezen) {
    const st = potje.staat;
    const k = kaart(st.stad);
    const vrij = k.kavels.filter(x => ai.zones.includes(x.zone) && !st.kavelBezet[x.id]);
    if (!vrij.length) return null;
    const kavel = C.kies(vrij, potje.id + '|ai|' + h + '|' + st.maand);
    /* WAT ER NA DE BUFFER OVERBLIJFT, en die buffer is geen truc maar hetzelfde
       inzicht dat hij als koers `sparen` gebruikt: wie zijn hele kas in een
       gebouw stopt, gaat om bij de eerste tegenvaller. */
    const buffer = Math.max(40000, (beeld.concern ? beeld.concern.totaal : 0) * 4);
    const teBesteden = beeld.geld - buffer;
    if (teBesteden < 40000) return null;
    /* OP MAAT BOUWEN, en dat is geen slimmigheid maar basiscompetentie -- precies
       de correctie die scripts/magnaat-strateeg.js bij zijn profielen al maakte.
       Wie een zaak van veertig stoelen op een plek voor tien zet, meet niet zijn
       stijl maar zijn rekenwerk, en hij draait vervolgens structureel verlies.

       Zonder dit liep de AI vast: hij nam de eerste maat die hij kon betalen,
       die maat paste zelden bij de plek, de zaak verloor geld, en daarmee zat
       hij voorgoed in de koers `verbeteren` -- na zesendertig maanden een zaak
       en een negatieve rekening. Niet omdat hij verkeerd koos, maar omdat zijn
       eerste zet al scheef stond. */
    const s = SECTOREN[ai.sector];
    const buren = (beeld.vestigingen || []).filter(v => v.sector === ai.sector
      && v.zone === kavel.zone).length;
    const vraag = basisvraag(k, kavel, ai.sector, st.maand) * s.markt * drukFactor(buren + 1);
    const opMaat = Math.max(4, Math.round(vraag / s.perMaand));
    const betaalbaar = Math.floor(teBesteden / (s.bouw * KOSTENSTAND.midden));
    const omvang = Math.min(opMaat, betaalbaar);
    /* NIET KLEINER DAN RENDABEL, en dat getal komt uit ./maat.js en niet uit een
       vier hier. Een vaste ondergrens in EENHEDEN is zeven verschillende regels,
       want een eenheid is per sector iets anders; hij liet hem een kantoor van
       vier werkplekken bouwen waar er een genoeg was, en een fabriek nooit. */
    if (omvang < rendabelVanaf(ai.sector, 'midden')) return null;
    const r = doe(potje, h, { actie: 'open', kavel: kavel.id, sector: ai.sector, omvang });
    return r.ok ? { wat: 'geopend', waar: kavel.zone, omvang } : null;
  }

  /* WAT HIJ AAN ZIJN ZAKEN DOET als hij niet bouwt. Onderhoud op peil, bezetting
     bijstellen, en met een volle zaak de prijs omhoog. Bewust dezelfde soort
     besluiten als de AI-manager neemt -- maar hij betaalt er geen tarief voor,
     want hij IS de speler en huurt niemand in. */
  function bijsturen(potje, h, beeld) {
    const uit = [];
    for (const v of beeld.vestigingen || []) {
      const r = ((beeld.laatste || {}).regels || []).find(x => x.id === v.id);
      if (v.onderhoud < 65) {
        const nieuw = Math.round((v.onderhoudBudget || 0) * 1.3 + 300);
        if (doe(potje, h, { actie: 'beleid', id: v.id, onderhoud: nieuw }).ok)
          uit.push({ wat: 'onderhoud', vestiging: v.id });
      }
      if (v.personeelNodig && v.personeel !== v.personeelNodig
        && doe(potje, h, { actie: 'beleid', id: v.id, personeel: v.personeelNodig }).ok)
        uit.push({ wat: 'bezetting', vestiging: v.id });
      if (r && r.bezetting >= 97 && (r.gemist || 0) > 0 && v.prijs !== 'hoog'
        && doe(potje, h, { actie: 'beleid', id: v.id, prijs: v.prijs === 'laag' ? 'midden' : 'hoog' }).ok)
        uit.push({ wat: 'prijs omhoog', vestiging: v.id });
    }
    /* UITROLLEN WAT ER AL UITGEVONDEN IS, en dat hoort HIER en niet bij het
       onderzoeken. Het stond daar, en dan hing het aan de KOERS: kennis die af
       kwam terwijl hij net weer aan het groeien was, bleef liggen. Na zestig
       maanden had hij `meten` af en achttien zaken zonder een enkele uitrol.

       Uitrollen is geen strategische keuze maar uitvoering: wat je weet en niet
       toepast, heb je voor niets betaald. */
    for (const k of ((beeld.onderzoek || {}).boom || []).filter(x => x.staat === 'klaar'))
      for (const v of beeld.vestigingen || [])
        if (!(v.tech || []).includes(k.sleutel)
          && doe(potje, h, { actie: 'onderzoek-uitrollen', sleutel: k.sleutel, vestiging: v.id }).ok)
          uit.push({ wat: 'uitgerold', sleutel: k.sleutel, vestiging: v.id });
    return uit;
  }

  /* ONDERZOEK, en dit is waar "verbeteren" zijn geld haalt zodra de kaart vol
     zit. Hij pakt wat er in zijn eigen boom openstaat en rolt uit wat af is;
     welke richting hij kiest hangt aan zijn koers en niet aan een lijst
     sleutels -- die verschillen per sector (./onderzoek-boom.js). */
  function onderzoeken(potje, h, beeld) {
    const boom = (beeld.onderzoek || {}).boom || [];
    const uit = [];
    if ((beeld.onderzoek || {}).bezig < (beeld.onderzoek || {}).tegelijk) {
      const open = boom.filter(x => x.staat === 'open');
      const kies = open.find(x => x.pad === 'stam')
        || ['energie', 'automatisering', 'keten', 'kwaliteit', 'concept']
          .map(pad => open.find(x => x.pad === pad)).find(Boolean);
      if (kies && doe(potje, h, { actie: 'onderzoek-starten', sleutel: kies.sleutel, budget: kies.kosten }).ok)
        uit.push({ wat: 'onderzoek', sleutel: kies.sleutel });
    }
    return uit;
  }

  /* EEN MAAND VAN EEN AI-SPELER. Kijken, koers bepalen, handelen -- in die
     volgorde, en alle drie op wat er op zijn scherm staat. */
  function maandVoorAI(potje, h, ai, beeld) {
    const st = potje.staat;
    const k = kaart(st.stad);
    const eigen = k.kavels.filter(x => ai.zones.includes(x.zone));
    const volDeel = eigen.length
      ? eigen.filter(x => st.kavelBezet[x.id]).length / eigen.length : 1;
    const gelezen = C.lezen(beeld);
    const koers = C.koersVan(gelezen, volDeel);
    const gedaan = bijsturen(potje, h, beeld);
    if (koers === 'groeien') {
      const gebouwd = bouwen(potje, h, ai, beeld, gelezen);
      if (gebouwd) gedaan.push(gebouwd);
    }
    if (koers === 'verbeteren') gedaan.push(...onderzoeken(potje, h, beeld));
    ai.koers = koers;
    ai.volDeel = Math.round(volDeel * 100) / 100;
    return { koers, gedaan, gelezen };
  }

  return { maandVoorAI, bouwen, bijsturen, onderzoeken };
};
