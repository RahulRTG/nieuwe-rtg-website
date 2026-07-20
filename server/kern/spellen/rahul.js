/* Spellen (deelmodule): Rahul als spelmaatje. In ELK potje kun je Rahul erbij
   roepen: hij legt de regels uit, geeft een korte hint of strategie, of moedigt
   je gewoon aan -- in karakter (eerlijk, warm, kort). Hij speelt niet vals en
   verklapt nooit iemands verborgen kaarten of stukken: hij krijgt bewust alleen
   het spel, de stand (wiens beurt) en jouw vraag mee, niet het bord of de handen.
   Met een echte sleutel praat Rahul; zonder sleutel geeft dezelfde motor een
   vaste, uitlegbare tip (demo). Gedeelde context vanuit kern/spellen.js. */
module.exports = (ctx) => {
  const { S, SOORTEN, codenaamVan, anthropic } = ctx;
  const { rahulLeadVoor } = require('../rahul');

  /* Per spel een korte uitleg + een paar eerlijke tips. Bewust regel-gebaseerd:
     werkt altijd, ook zonder AI-sleutel, en de tips kloppen gewoon. */
  const KENNIS = {
    mejn: { uitleg: 'Mens erger je niet: gooi 6 om een pion uit het starthok te halen, sla tegenstanders terug naar hun start, en breng al je pionnen exact in je thuisrij.',
      tips: ['Haal pionnen op tijd naar buiten -- met alles nog in het hok kun je niets.', 'Sla een tegenstander als het kan; dat wint je vaak meer dan zelf hard doorlopen.', 'Bewaar wat ruimte: te vroeg de thuisrij in en je kunt niet meer exact binnenkomen.'] },
    schaak: { uitleg: 'Schaken: zet de andere koning mat. Rokade, en passant en promotie naar dame horen erbij.',
      tips: ['Ontwikkel je stukken en pak het centrum voordat je gaat aanvallen.', 'Zet je koning veilig met een vroege rokade.', 'Ruil alleen als je er beter van wordt, niet zomaar om het ruilen.'] },
    woord: { uitleg: 'Woordduel: leg woorden op het 15x15-bord en pak de premievelden; de 40-puntenbonus krijg je als je al je zeven letters in een keer legt.',
      tips: ['Mik op de dubbel- en drielettervelden met je hoge letters.', 'Bewaar een blanco voor een grote worp op een premieveld.', 'Korte woorden die twee kanten op scoren leveren vaak meer dan een lang woord.'] },
    pesten: { uitleg: 'Pesten: raak als eerste je kaarten kwijt. Boer, 7, 8, aas en 2 zijn de pestkaarten.',
      tips: ['Bewaar een pestkaart voor als je bijna klaar bent.', 'Let op je kleur: soms is een kleur wisselen slimmer dan hoog opgaan.', 'Roep op tijd -- vergeten te melden dat je nog een kaart hebt kost je pakken.'] },
    dam: { uitleg: 'Dammen (10x10): slaan is verplicht, je mag meerdere stukken achter elkaar slaan, en een dam schuift over de hele diagonaal.',
      tips: ['Slaan is verplicht -- reken de hele slagketen uit voordat je begint.', 'Houd je achterste rij zo lang mogelijk dicht tegen een doorbraak.', 'Ruilen richting het damveld is sterk; een dam weegt zwaar.'] },
    rummi: { uitleg: 'Rummi: leg series en groepen; je eerste uitleg moet samen 30 punten halen, daarna mag je vrij herschikken.',
      tips: ['Kom eerst uit met 30 -- zonder eerste uitleg kun je niets bijleggen.', 'Herschik gerust de hele tafel om je stenen kwijt te raken.', 'Een joker is goud: bewaar hem voor waar je echt vastzit.'] },
    magnaat: { uitleg: 'Magnaat: rond het bord kopen, huur innen en huizen bouwen; wie als laatste niet failliet is, wint.',
      tips: ['Koop straten van dezelfde kleur bij elkaar -- pas een hele groep laat je bouwen.', 'Houd altijd wat contant achter de hand voor huur die je zelf moet betalen.', 'Bouwen doet de huur hard stijgen; drie huizen is vaak het omslagpunt.'] },
    seconden: { uitleg: '30 Seconden: twee teams. Je omschrijft in dertig seconden zoveel mogelijk namen; je teamgenoot raadt.',
      tips: ['Begin met wat je zeker weet -- punten binnen is punten binnen.', 'Sla iets moeilijks over en kom later terug als er tijd is.', 'Korte, rake hints werken beter dan een heel verhaal.'] },
    waarheid: { uitleg: 'Doen of Waarheid: kies doen of waarheid en voer de opdracht uit; samen kom je tot het doel.',
      tips: ['Hou het leuk en veilig -- niemand hoeft iets te doen waar hij zich rot bij voelt.', 'Een goede waarheid is nieuwsgierig, niet gemeen.', 'Durf ook eens "doen" te kiezen; daar komen de beste verhalen uit.'] },
    proost: { uitleg: 'Proost (18+): een kaartspel voor aan tafel; volg de kaart die boven ligt.',
      tips: ['18+ en met mate -- drink verstandig en zorg voor elkaar.', 'Water ertussendoor is nooit een verkeerde zet.', 'Niemand hoeft mee te doen die niet wil; dat is ook winnen.'] }
  };

  function standVan(p, mij) {
    if (p.status === 'wacht') return 'Het potje moet nog beginnen.';
    if (p.status === 'klaar') return 'Het potje is klaar' + (p.winnaar ? ', winnaar: ' + p.winnaar + '.' : '.');
    return p.spelers[p.beurt] === mij ? 'Jij bent aan zet.' : codenaamVan(p.spelers[p.beurt]) + ' is aan zet.';
  }

  async function spelRahul(mij, id, vraag) {
    const p = S().potjes[id];
    if (!p || !p.spelers.includes(mij)) return { status: 404, error: 'Dit potje bestaat niet (meer).' };
    const kennis = KENNIS[p.soort] || { uitleg: SOORTEN[p.soort] || 'dit spel', tips: [] };
    const stand = standVan(p, mij);
    const q = String(vraag || '').trim().slice(0, 300);
    if (anthropic && q) {
      try {
        const context = 'Het spel is ' + (SOORTEN[p.soort] || p.soort) + '. ' + kennis.uitleg +
          ' Stand: ' + stand + ' Antwoord in het ' + (p.taal === 'en' ? 'Engels' : 'Nederlands') + '.';
        const res = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 260,
          system: rahulLeadVoor(mij) + 'je bent het spelmaatje: je kijkt met een lid mee tijdens een potje ' + (SOORTEN[p.soort] || p.soort) +
            '. Geef een korte hint, leg een regel uit, of moedig aan. Blijf eerlijk (verzin nooit een concrete winnende zet die je niet zeker weet), warm en kort. ' +
            'Je speelt niet vals en verklapt nooit iemands verborgen kaarten of stukken -- die ken je ook niet. Context: ' + context,
          messages: [{ role: 'user', content: q }]
        });
        const tekst = (res.content && res.content[0] && res.content[0].text) ? res.content[0].text : '';
        if (tekst) return { status: 200, ok: true, antwoord: tekst, stand };
      } catch (e) { /* val terug op de vaste tip */ }
    }
    const tip = kennis.tips.length ? kennis.tips[Math.floor(Math.random() * kennis.tips.length)] : kennis.uitleg;
    return { status: 200, ok: true, antwoord: tip, stand, demo: true };
  }

  return { spelRahul, _KENNIS: KENNIS };
};
