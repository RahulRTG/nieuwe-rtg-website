/* Het afdelingsregister (kern/afdelingen): de eerste twaalf kamers van het
   RTG-kantoor als configuratie - per kamer de naam, de KPI's en de lijsten,
   alles defensief lezend uit de datastore. De vijf jongere kamers staan in
   register2.js; kamers met naamInzage: true mogen via de identiteitskluis
   (afdelingen/inzage.js) de echte naam bij een codenaam opvragen. */
module.exports = (ctx) => {
  const { d, lijst, tel, recent, ledenGeteld, functies } = ctx;

  /* ---------- het afdelingsregister ----------
     kpis en lijsten lezen alleen; alles defensief, want niet elke installatie
     heeft elke collectie gevuld. */
  const AFDELINGEN = {
    sales: { naam: 'Sales', emoji: '📈', missie: 'Nieuwe partners en hardware-omzet binnenhalen.',
      kpis: () => [
        ['Open partner-aanvragen', tel(lijst(d().partnerApplications).filter(a => a.status === 'nieuw'))],
        ['Winkelbestellingen open', tel(lijst(d().winkelBestellingen).filter(o => o.status === 'nieuw'))],
        ['Partners aangesloten', tel(d().suppliers)],
        ['Bestellingen deze week', recent(d().winkelBestellingen, 'at', 7)]
      ],
      lijsten: () => [
        { titel: 'Winkelbestellingen om op te volgen', items: lijst(d().winkelBestellingen).filter(o => o.status === 'nieuw').slice(0, 8).map(o => o.aantal + 'x ' + o.productNaam + ' voor ' + o.company + ' (' + o.contactName + ')') },
        { titel: 'Nieuwe partner-aanvragen', items: lijst(d().partnerApplications).filter(a => a.status === 'nieuw').slice(0, 8).map(a => a.company + ' (' + a.type + ', ' + a.city + ')') }
      ] },
    marketing: { naam: 'Marketing', emoji: '📣', missie: 'De Salon laten bruisen en de passen laten groeien.',
      kpis: () => [
        ['Salon-posts totaal', tel(d().posts)],
        ['Posts deze week', recent(d().posts, 'at', 7)],
        ['Verhalen live', tel(d().stories)],
        ['Clips online', tel(d().clips)],
        ['Podium-kanalen', tel(d().podiumKanalen)],
        ['Theater-videos', tel(d().theaterVideos)]
      ],
      lijsten: () => [
        { titel: 'Nieuwste Salon-posts', items: lijst(d().posts).slice(0, 8).map(p => (p.author || p.codename || 'iemand') + ': ' + String(p.text || p.tekst || '').slice(0, 60)) }
      ] },
    pr: { naam: 'PR & communicatie', emoji: '📰', missie: 'Het verhaal van RTG eerlijk en groots vertellen.',
      kpis: () => [
        ['Reviews totaal', tel(d().reviews)],
        ['Reviews deze week', recent(d().reviews, 'at', 7)],
        ['Meldingen verstuurd', tel(d().notifications)],
        ['Paspoort-incidenten', tel(d().paspoortIncidenten)]
      ],
      lijsten: () => [
        { titel: 'Laatste reviews (de buitenwereld praat)', items: lijst(d().reviews).slice(0, 8).map(r => (r.rating ? r.rating + '★ ' : '') + String(r.text || r.tekst || '').slice(0, 60)) }
      ] },
    hr: { naam: 'HR', emoji: '🧑‍💼', missie: 'Het beste team vinden, houden en laten groeien.',
      kpis: () => [
        ['Open vacatures', tel(lijst(d().vacatures).filter(v => v.open !== false))],
        ['Sollicitaties totaal', tel(d().applications)],
        ['Nieuw deze week', recent(d().applications, 'at', 7)],
        ['Verlofaanvragen open', tel(lijst(d().verlof).filter(v => v.status === 'nieuw' || v.status === 'open'))]
      ],
      lijsten: () => [
        { titel: 'Verse sollicitaties', items: lijst(d().applications).slice(0, 8).map(a => (a.name || a.codename || 'kandidaat') + ' op ' + (a.role || a.vacature || 'functie')) }
      ] },
    financien: { naam: 'Financiën', emoji: '💶', missie: 'Elke euro kloppend, elke afdracht op tijd.', naamInzage: true,
      kpis: () => [
        ['Directe betalingen', tel(d().directBetalingen)],
        ['RTG Pay boekingen (24u)', recent(d().payBoekingen, 'at', 1)],
        ['Munt-ontvangsten', tel(d().muntOntvangsten)],
        ['Kassa-verkopen', tel(d().posSales)],
        ['Boekingen totaal', tel(d().boekingen)],
        ['Facturen', tel(d().facturen)],
        ['Synergie-pakketten verkocht', tel(d().synergieKopen)]
      ],
      lijsten: () => [
        { titel: 'Laatste directe betalingen', items: lijst(d().directBetalingen).slice(0, 8).map(b => '€ ' + (b.bedrag || b.amount || 0) + ' aan ' + (b.supplierCode || b.aan || '')) },
        // het grootboek van RTG Pay: de laatste bewegingen door het huis
        { titel: 'RTG Pay (laatste grootboekregels)', items: lijst(d().payBoekingen).slice(0, 8).map(b => (b.centen / 100).toFixed(2) + ' euro, ' + b.soort + ': ' + b.van + ' naar ' + b.naar) }
      ] },
    inkoop: { naam: 'Inkoop', emoji: '📦', missie: 'De juiste spullen, op tijd, voor de beste prijs.',
      kpis: () => [
        ['Groothandel-orders', tel(d().groothandelOrders)],
        ['Retail apart gezet', tel(d().retailApart)],
        ['Leveranciers actief', tel(d().suppliers)]
      ],
      lijsten: () => [] },
    verkoop: { naam: 'Verkoop', emoji: '🧾', missie: 'De dagelijkse omzet over alle genres heen.',
      kpis: () => [
        ['Orders totaal', tel(d().orders)],
        ['Orders deze week', recent(d().orders, 'at', 7)],
        ['Ritten totaal', tel(d().rides)],
        ['Reserveringen', tel(d().reserveringen)],
        ['OV-ritten', tel(d().ovRitten)],
        ['Care-boekingen', tel(d().careBoekingen)],
        ['Verblijven', tel(d().verblijven)]
      ],
      lijsten: () => [
        { titel: 'Nieuwste orders', items: lijst(d().orders).slice(0, 8).map(o => (o.supplier || o.supplierCode || '') + ': ' + String(o.summary || o.item || o.ref || '').slice(0, 50)) }
      ] },
    juridisch: { naam: 'Juridisch', emoji: '⚖️', missie: 'Alles netjes: contracten, akkoorden en AVG.', naamInzage: true,
      kpis: () => [
        ['Contracten getekend', tel(lijst(d().contracten).filter(c => c.getekend || c.status === 'getekend'))],
        ['Contracten open', tel(lijst(d().contracten).filter(c => !(c.getekend || c.status === 'getekend')))],
        ['Paspoort-verzoeken', tel(d().paspoortVerzoeken)]
      ],
      lijsten: () => [
        { titel: 'Openstaande contracten', items: lijst(d().contracten).filter(c => !(c.getekend || c.status === 'getekend')).slice(0, 8).map(c => String(c.titel || c.naam || c.id || 'contract')) }
      ] },
    creatief: { naam: 'Creatief', emoji: '🎨', missie: 'Content en creators die het merk laten stralen.',
      kpis: () => [
        ['Creator-oproepen', tel(d().creatorOproepen)],
        ['Verhalen (24u)', tel(d().stories)],
        ['Snaps gedeeld', tel(d().snaps)]
      ],
      lijsten: () => [
        { titel: 'Open creator-oproepen', items: lijst(d().creatorOproepen).slice(0, 8).map(c => String(c.titel || c.wat || c.id)) }
      ] },
    intern: { naam: 'Intern & IT', emoji: '🛠️', missie: 'Het huis draaiend houden: systemen, kloks en mensen.',
      kpis: () => [
        ['Ingeklokte diensten', tel(d().klok)],
        ['Actieve sessies', Object.keys(d().sessions || {}).length],
        ['Functies uit', functies.catalogus((d().techniek || {}).functies || {}).reduce((n, g) => n + g.functies.filter(f => !f.aan).length, 0)],
        ['Zaakdozen in het veld', tel(lijst(d().winkelBestellingen).filter(o => o.product === 'zaakdoos'))],
        ['Doos-metingen (24u)', recent(d().doosMetingen, 'at', 1)],
        ['Nachtrapporten (7d)', recent(d().doosRapporten, 'at', 7)]
      ],
      lijsten: () => [
        // het meetstation van de doos-vloot: per doos de laatste lijnmeting
        { titel: 'De doos-vloot (laatste meting per doos)', items: (() => {
          const per = {};
          for (const m of lijst(d().doosMetingen)) if (!per[m.doos]) per[m.doos] = m;
          return Object.values(per).slice(0, 10).map(m => m.doos + ': ' + m.rtt + 'ms, ' + m.modus + (m.journaal ? ', ' + m.journaal + ' in journaal' : '') + (m.via ? ', via ' + m.via : '') + ' (' + new Date(m.at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) + ')');
        })() },
        // het nachtwerk: per doos het dagrapport over de lijn van gisteren
        { titel: 'Nachtwerk (dagrapport per doos)', items: lijst(d().doosRapporten).slice(0, 7).map(r => r.doos + ' ' + r.datum + ': ' + r.pings + ' pings, gem ' + r.rttGem + 'ms, ' + r.uitval + 'x lijn weg' + (r.lokaalMin ? ', ' + r.lokaalMin + ' min lokaal' : '')) },
        { titel: 'Verder kijken', items: ['Het volledige techniekbord staat op techniek.html (eigenaar-inlog).'] }
      ] },
    onderzoek: { naam: 'Onderzoek & data', emoji: '🔬', missie: 'Weten wat werkt: cijfers, trends en eerlijke conclusies.',
      kpis: () => [
        ['Leden in de gids', ledenGeteld()],
        ['Connecties gelegd', tel(Object.keys(d().connections || {}))],
        ['Orders per week', recent(d().orders, 'at', 7)],
        ['Posts per week', recent(d().posts, 'at', 7)],
        ['Grootboekregels (14d)', recent(d().payBoekingen, 'at', 14)]
      ],
      lijsten: () => [] },
    klantenservice: { naam: 'Klantenservice', emoji: '🎧', missie: 'Elke gast en elk gezin snel en warm geholpen.', naamInzage: true,
      kpis: () => [
        ['Gastgesprekken', tel(Object.keys(d().guestChats || {}))],
        ['Ledengesprekken', tel(Object.keys(d().memberChats || {}))],
        ['Meldingen open', tel(lijst(d().notifications).filter(n => !n.read))]
      ],
      lijsten: () => [] }
  };
  const KAMER_IDS = Object.keys(AFDELINGEN);

  return AFDELINGEN;
};
