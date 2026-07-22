/* Het RTF-kantoorregister (kern/rtfkantoor): de kamers van het RTFoundation-
   kantoor, bewust een spiegel van de RTG-kantoorstructuur (zelfde kamer-ids,
   zelfde vorm: naam, emoji, missie, kpis, lijsten) maar met de invulling van
   de stichting. Zo werken RTG- en RTF-personeel in twee huizen met dezelfde
   plattegrond. Plus twee eigen kamers: Clubs & steden (de samenwerking met
   grote (sport)clubs) en het Onderzoekslab. Alles leest defensief. */
module.exports = (ctx) => {
  const { d, lijst, tel, recent } = ctx;
  const F = () => d().foundation || {};
  const clubs = () => lijst(d().rtfClubs);
  const lab = () => lijst(d().labProjecten);
  const afdr = () => lijst(d().fondsAfdrachten);
  const geld = () => afdr().reduce((s, a) => s + (Number(a.bedrag) || 0), 0);

  return {
    sales: { naam: 'Fondsenwerving & partners', emoji: '🤝', missie: 'Donateurs, sponsors en partnerclubs voor de stichting winnen.',
      kpis: () => [
        ['Afdrachten (30%) ontvangen', afdr().length],
        ['Samen opgehaald', '€ ' + Math.round(geld() / 100)],
        ['Partnerclubs actief', clubs().filter(c => c.status === 'actief').length],
        ['Clubs in gesprek', clubs().filter(c => c.status !== 'actief').length]
      ],
      lijsten: () => [
        { titel: 'Nieuwste afdrachten uit het platform', items: afdr().slice(0, 8).map(a => '€ ' + Math.round((Number(a.bedrag) || 0) / 100) + (a.bron ? ' uit ' + a.bron : '')) }
      ] },
    marketing: { naam: 'Campagnes & verhalen', emoji: '📣', missie: 'Laten zien wat de stichting doet, eerlijk en zonder opsmuk.',
      kpis: () => [
        ['Salon-posts platform', tel(d().posts)],
        ['Posts deze week', recent(d().posts, 'at', 7)],
        ['Clips online', tel(d().clips)]
      ],
      lijsten: () => [
        { titel: 'Campagne-ideeen uit de kamers', items: [] }
      ] },
    pr: { naam: 'PR & communicatie', emoji: '📰', missie: 'Het verhaal van de RTFoundation zorgvuldig vertellen.',
      kpis: () => [
        ['Meldingen verstuurd', tel(d().notifications)],
        ['Reviews platform', tel(d().reviews)]
      ],
      lijsten: () => [
        { titel: 'Wat de buitenwereld ziet', items: lijst(d().reviews).slice(0, 6).map(r => (r.rating ? r.rating + '* ' : '') + String(r.text || r.tekst || '').slice(0, 60)) }
      ] },
    hr: { naam: 'Mensen & vrijwilligers', emoji: '🧑‍🤝‍🧑', missie: 'Het RTF-team en de vrijwilligers vinden, houden en laten groeien.',
      kpis: () => [
        ['Sollicitaties platform', tel(d().applications)],
        ['Nieuw deze week', recent(d().applications, 'at', 7)],
        ['RTF-teamleden bij clubs', clubs().reduce((s, c) => s + (c.team || []).length, 0)]
      ],
      lijsten: () => [
        { titel: 'RTF-team gekoppeld aan clubs', items: clubs().filter(c => (c.team || []).length).slice(0, 8).map(c => c.naam + ': ' + c.team.join(', ')) }
      ] },
    financien: { naam: 'Financien & 30%-afdracht', emoji: '💶', missie: 'Elke gedoneerde euro kloppend en aantoonbaar goed besteed.',
      kpis: () => [
        ['Afdrachten totaal', afdr().length],
        ['In kas (30%-stroom)', '€ ' + Math.round(geld() / 100)],
        ['Lab-budget toegekend', '€ ' + lab().reduce((s, p) => s + (Number(p.budget) || 0), 0)]
      ],
      lijsten: () => [
        { titel: 'Laatste afdrachten', items: afdr().slice(0, 8).map(a => '€ ' + Math.round((Number(a.bedrag) || 0) / 100) + (a.at ? ' op ' + String(a.at).slice(0, 10) : '')) }
      ] },
    inkoop: { naam: 'Inkoop & middelen', emoji: '📦', missie: 'Sportmateriaal, leermiddelen en voorraad scherp en eerlijk inkopen.',
      kpis: () => [
        ['Programma\'s met materiaal', clubs().reduce((s, c) => s + (c.programmas || []).length, 0)],
        ['Winkelbestellingen platform', tel(d().winkelBestellingen)]
      ],
      lijsten: () => [
        { titel: 'Materiaal-vragen uit de clubprogramma\'s', items: clubs().flatMap(c => (c.programmas || []).filter(p => !p.af).map(p => c.naam + ': ' + p.naam)).slice(0, 8) }
      ] },
    verkoop: { naam: 'Uitgifte & toekenning', emoji: '🎁', missie: 'Hulp toekennen waar die het hardst nodig is; geven is ons verkopen.',
      kpis: () => [
        ['Actieve clubprogramma\'s', clubs().reduce((s, c) => s + (c.programmas || []).filter(p => !p.af).length, 0)],
        ['Afgeronde programma\'s', clubs().reduce((s, c) => s + (c.programmas || []).filter(p => p.af).length, 0)]
      ],
      lijsten: () => [
        { titel: 'Programma\'s die nu lopen', items: clubs().flatMap(c => (c.programmas || []).filter(p => !p.af).map(p => p.naam + ' bij ' + c.naam)).slice(0, 8) }
      ] },
    juridisch: { naam: 'Juridisch & waarborg', emoji: '⚖️', missie: 'ANBI-zuiver, AVG-net en elke samenwerking op papier kloppend.',
      kpis: () => [
        ['Actieve clubovereenkomsten', clubs().filter(c => c.status === 'actief').length],
        ['Lab-projecten met toets', lab().filter(p => (p.veiligheid || {}).status === 'akkoord').length]
      ],
      lijsten: () => [
        { titel: 'Clubs zonder actieve overeenkomst', items: clubs().filter(c => c.status !== 'actief').slice(0, 8).map(c => c.naam + ' (' + c.status + ')') }
      ] },
    creatief: { naam: 'Creatief & ontwerp', emoji: '🎨', missie: 'Alles wat de stichting maakt even mooi als het merk zelf.',
      kpis: () => [
        ['Ontwerpen platform', tel(d().atelierOntwerpen)],
        ['Ideeen in de Ideeenkamer', tel(d().ideeen)]
      ],
      lijsten: () => [
        { titel: 'Verse ideeen', items: lijst(d().ideeen).slice(0, 6).map(i => String(i.titel || i.tekst || '').slice(0, 60)) }
      ] },
    intern: { naam: 'Intern & kantoorzaken', emoji: '🏢', missie: 'Het RTF-huis zelf draaiend, veilig en gezellig houden.',
      kpis: () => [
        ['Open taken alle kamers', Object.values(d().rtfKantoorTaken || {}).reduce((s, r) => s + (Array.isArray(r) ? r.filter(t => !t.af).length : 0), 0)]
      ],
      lijsten: () => [
        { titel: 'Huisregels', items: ['Wat we beloven, doen we', 'Elke euro aantoonbaar', 'Kinderen eerst, altijd'] }
      ] },
    onderzoek: { naam: 'Kennis & meten', emoji: '📊', missie: 'Meten wat werkt, leren van wat niet werkt, en dat delen.',
      kpis: () => [
        ['Lab-projecten', lab().length],
        ['Bevindingen in de kennisbank', lab().reduce((s, p) => s + (p.bevindingen || []).length, 0)]
      ],
      lijsten: () => [
        { titel: 'Nieuwste bevindingen', items: lab().flatMap(p => (p.bevindingen || []).map(b => b.titel)).slice(0, 6) }
      ] },
    klantenservice: { naam: 'Gezinnen & hulpvragen', emoji: '🛟', missie: 'Elke hulpvraag van een gezin snel en warm beantwoorden.',
      kpis: () => [
        ['Gezinnen aangesloten', tel(F().gezinnen)],
        ['Hulpvragen open', tel(lijst(F().hulpvragen).filter(h => !h.af))]
      ],
      lijsten: () => [
        { titel: 'Waar gezinnen mee komen', items: lijst(F().hulpvragen).slice(0, 6).map(h => String(h.tekst || h.onderwerp || '').slice(0, 60)) }
      ] },
    support: { naam: 'Support & meldingen', emoji: '🧰', missie: 'Clubs, scholen en teamleden nooit laten wachten met een vraag.',
      kpis: () => [
        ['Clubberichten (7 dagen)', clubs().reduce((s, c) => s + (c.log || []).filter(m => m.at && (Date.now() - new Date(m.at).getTime()) < 7 * 86400000).length, 0)],
        ['Open clubafspraken', clubs().reduce((s, c) => s + (c.afspraken || []).filter(a => !a.af).length, 0)]
      ],
      lijsten: () => [
        { titel: 'Open afspraken met clubs', items: clubs().flatMap(c => (c.afspraken || []).filter(a => !a.af).map(a => c.naam + ': ' + a.tekst)).slice(0, 8) }
      ] },
    kantine: { naam: 'Kantine', emoji: '🥪', missie: 'Samen eten, ook met de vrijwilligers; hier hoort iedereen erbij.',
      kpis: () => [
        ['Kaart van vandaag (RTG-kantine)', tel((d().kantine || {}).items)]
      ],
      lijsten: () => [
        { titel: 'Vandaag op de kaart', items: lijst((d().kantine || {}).items).slice(0, 6).map(i => String(i.naam || i).slice(0, 40)) }
      ] },
    clubs: { naam: 'Clubs & steden', emoji: '🏟️', missie: 'Met de grote (sport)clubs van elke stad de jeugd en de buurt helpen.',
      kpis: () => [
        ['Clubs aangesloten', clubs().length],
        ['Steden', new Set(clubs().map(c => c.stad)).size],
        ['Actieve samenwerkingen', clubs().filter(c => c.status === 'actief').length],
        ['Programma\'s die lopen', clubs().reduce((s, c) => s + (c.programmas || []).filter(p => !p.af).length, 0)]
      ],
      lijsten: () => [
        { titel: 'Clubs per status', items: clubs().slice(0, 10).map(c => c.naam + ' (' + c.stad + ', ' + c.status + ')') }
      ] },
    lab: { naam: 'Onderzoekslab', emoji: '🔬', missie: 'Onderzoeken en ontwikkelen wat mensen echt vooruit helpt.',
      kpis: () => [
        ['Projecten', lab().length],
        ['In proef of uitrol', lab().filter(p => p.fase === 'proef' || p.fase === 'uitrol').length],
        ['Wachten op veiligheidstoets', lab().filter(p => (p.veiligheid || {}).status === 'open').length]
      ],
      lijsten: () => [
        { titel: 'Projecten per fase', items: lab().slice(0, 10).map(p => p.titel + ' (' + p.fase + ')') }
      ] }
  };
};
