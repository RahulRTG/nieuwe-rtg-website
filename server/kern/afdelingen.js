/* De RTG-kantoren: elke afdeling een eigen kamer met de cijfers en werklijsten
   die er voor die afdeling toe doen, plus een eigen takenlijst. De boardroom
   staat erboven: die ziet alle kamers in een oogopslag, bedient het volledige
   functieschakelbord (elke functie van het platform aan/uit, ook per
   doelgroep) en houdt een verbeterkamer bij met voorstellen.

   Eerlijk over "zichzelf verbeteren": instellingen (schakelaars, standen)
   past de boardroom zelf aan, met een knop of automatisch via een voorstel.
   Voorstellen die code raken blijven voorstellen voor de ontwikkelstraat;
   een systeem dat zijn eigen productiecode herschrijft bouwen we bewust niet. */

const functies = require('../functies');

module.exports = ({ db, save, crypto, anthropic }) => {

  const nu = () => Date.now();
  const DAG = 86400000;
  // collecties zijn soms een array en soms een map (id -> item); dit vlakt dat uit
  const lijst = x => Array.isArray(x) ? x : (x && typeof x === 'object' ? Object.values(x) : []);
  const tel = x => lijst(x).length;
  const recent = (x, veld, dagen) => lijst(x).filter(i => i && i[veld] && (nu() - new Date(i[veld]).getTime()) < dagen * DAG).length;
  const d = () => db.data;

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
        ['Cadeaukaarten actief', tel(lijst(d().giftcards).filter(g => !g.verzilverd))]
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
    financien: { naam: 'Financiën', emoji: '💶', missie: 'Elke euro kloppend, elke afdracht op tijd.',
      kpis: () => [
        ['Directe betalingen', tel(d().directBetalingen)],
        ['Munt-ontvangsten', tel(d().muntOntvangsten)],
        ['Kassa-verkopen', tel(d().posSales)],
        ['Boekingen totaal', tel(d().boekingen)]
      ],
      lijsten: () => [
        { titel: 'Laatste directe betalingen', items: lijst(d().directBetalingen).slice(0, 8).map(b => '€ ' + (b.bedrag || b.amount || 0) + ' aan ' + (b.supplierCode || b.aan || '')) }
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
        ['Reserveringen', tel(d().reserveringen)]
      ],
      lijsten: () => [
        { titel: 'Nieuwste orders', items: lijst(d().orders).slice(0, 8).map(o => (o.supplier || o.supplierCode || '') + ': ' + String(o.summary || o.item || o.ref || '').slice(0, 50)) }
      ] },
    juridisch: { naam: 'Juridisch', emoji: '⚖️', missie: 'Alles netjes: contracten, akkoorden en AVG.',
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
        ['Leden in de gids', Object.keys(d().memberDir || {}).length],
        ['Connecties gelegd', tel(Object.keys(d().connections || {}))],
        ['Orders per week', recent(d().orders, 'at', 7)],
        ['Posts per week', recent(d().posts, 'at', 7)]
      ],
      lijsten: () => [] },
    klantenservice: { naam: 'Klantenservice', emoji: '🎧', missie: 'Elke gast en elk gezin snel en warm geholpen.',
      kpis: () => [
        ['Gastgesprekken', tel(Object.keys(d().guestChats || {}))],
        ['Ledengesprekken', tel(Object.keys(d().memberChats || {}))],
        ['Meldingen open', tel(lijst(d().notifications).filter(n => !n.read))]
      ],
      lijsten: () => [] }
  };
  const KAMER_IDS = Object.keys(AFDELINGEN);

  /* ---------- taken per kamer ---------- */
  function taken(afd) {
    if (!d().kantoorTaken) d().kantoorTaken = {};
    if (!Array.isArray(d().kantoorTaken[afd])) d().kantoorTaken[afd] = [];
    return d().kantoorTaken[afd];
  }
  function taakMaak(afd, tekst) {
    const t = String(tekst || '').replace(/[<>]/g, '').trim().slice(0, 200);
    if (!t) return { status: 400, error: 'Wat moet er gebeuren?' };
    const rij = taken(afd);
    rij.unshift({ id: crypto.randomBytes(4).toString('hex'), tekst: t, af: false, at: nu() });
    if (rij.length > 100) rij.pop();
    save();
    return { ok: true };
  }
  function taakZet(afd, id, af) {
    const t = taken(afd).find(x => x.id === id);
    if (!t) return { status: 404, error: 'Deze taak staat er niet meer.' };
    t.af = af === true;
    save();
    return { ok: true };
  }

  function kamer(id) {
    const a = AFDELINGEN[id];
    if (!a) return { status: 404, error: 'Deze kamer bestaat niet.' };
    return {
      ok: true, id, naam: a.naam, emoji: a.emoji, missie: a.missie,
      kpis: a.kpis().map(([label, waarde]) => ({ label, waarde })),
      lijsten: a.lijsten(), taken: taken(id).slice(0, 30)
    };
  }
  function kamers() {
    return { ok: true, kamers: KAMER_IDS.map(id => {
      const a = AFDELINGEN[id];
      const open = taken(id).filter(t => !t.af).length;
      return { id, naam: a.naam, emoji: a.emoji, missie: a.missie, kpi: a.kpis()[0], takenOpen: open };
    }) };
  }

  /* ---------- de boardroom ---------- */
  function functiesStand() { if (!d().techniek) d().techniek = {}; if (!d().techniek.functies) d().techniek.functies = {}; return d().techniek.functies; }
  function schakel(id, aan, doelgroep, wie) {
    if (!functies.OP_ID[id]) return { status: 404, error: 'Onbekende functie.' };
    const st = functiesStand();
    if (!st[id]) st[id] = {};
    if (doelgroep) {
      if (!functies.DOELGROEP_IDS.includes(doelgroep)) return { status: 400, error: 'Onbekende doelgroep.' };
      if (!st[id].perDoelgroep) st[id].perDoelgroep = {};
      st[id].perDoelgroep[doelgroep] = aan === true;
    } else {
      st[id].aan = aan === true;
    }
    save();
    audit(wie || 'boardroom', 'Functie ' + id + (doelgroep ? ' voor ' + doelgroep : '') + ' ' + (aan === true ? 'AAN' : 'UIT') + ' gezet');
    return { ok: true, functie: id, aan: aan === true, doelgroep: doelgroep || null };
  }

  /* De verbeterkamer: elke dag verse voorstellen uit de echte cijfers.
     Type 'schakel' heeft een knop die het direct uitvoert; type 'aandacht'
     is een werkpunt voor een kamer; type 'code' gaat naar de ontwikkelstraat. */
  function bouwVoorstellen() {
    const uit = [];
    const cat = functies.catalogus(functiesStand());
    for (const g of cat) for (const f of g.functies) {
      if (f.storing) uit.push({ type: 'aandacht', kamer: 'intern', tekst: 'Functie "' + f.naam + '" meldt een storing; de zekering staat open.' });
    }
    const oudeBestellingen = lijst(d().winkelBestellingen).filter(o => o.status === 'nieuw' && nu() - new Date(o.at).getTime() > 2 * DAG);
    if (oudeBestellingen.length) uit.push({ type: 'aandacht', kamer: 'sales', tekst: oudeBestellingen.length + ' winkelbestelling(en) wachten langer dan twee werkdagen op contact.' });
    const openAanvragen = lijst(d().partnerApplications).filter(a => a.status === 'nieuw');
    if (openAanvragen.length >= 3) uit.push({ type: 'aandacht', kamer: 'sales', tekst: openAanvragen.length + ' partner-aanvragen staan open; plan een beoordeelronde.' });
    const verlofOpen = lijst(d().verlof).filter(v => v.status === 'nieuw' || v.status === 'open').length;
    if (verlofOpen) uit.push({ type: 'aandacht', kamer: 'hr', tekst: verlofOpen + ' verlofaanvraag(en) wachten op een besluit.' });
    if (!recent(d().posts, 'at', 7)) uit.push({ type: 'aandacht', kamer: 'marketing', tekst: 'Geen Salon-posts in de afgelopen week; tijd voor een campagne of aanbieding.' });
    if (!uit.length) uit.push({ type: 'aandacht', kamer: 'boardroom', tekst: 'Alles loopt; geen knelpunten gevonden in de dagronde.' });
    return uit;
  }
  function voorstellen(vers) {
    if (!d().boardroom) d().boardroom = {};
    const b = d().boardroom;
    if (vers || !b.voorstellenAt || nu() - b.voorstellenAt > DAG) {
      b.voorstellen = bouwVoorstellen();
      b.voorstellenAt = nu();
      save();
    }
    return { voorstellen: b.voorstellen || [], at: b.voorstellenAt };
  }
  function boardroom() {
    const cat = functies.catalogus(functiesStand());
    return {
      ok: true,
      kamers: kamers().kamers,
      functies: cat, doelgroepen: functies.DOELGROEPEN,
      functiesUit: cat.reduce((n, g) => n + g.functies.filter(f => !f.aan).length, 0),
      verbeterkamer: voorstellen(false),
      paniek: paniekRij().filter(v => v.status === 'open').slice(0, 20),
      audit: auditRij().slice(0, 12)
    };
  }

  /* ---------- platformbrede statistieken: dezelfde eerlijke cijfers in elke
     kamer, over de hele code en het hele platform heen ---------- */
  function platformStats() {
    const cat = functies.catalogus(functiesStand());
    const alleF = cat.flatMap(g => g.functies);
    return { ok: true, stats: [
      { groep: 'Mensen', items: [
        ['Leden in de gids', Object.keys(d().memberDir || {}).length],
        ['Gezinnen (RTF)', Object.keys((d().foundation || {}).gezinnen || {}).length],
        ['Partners', tel(d().suppliers)],
        ['Actieve sessies', Object.keys(d().sessions || {}).length]
      ] },
      { groep: 'Beweging', items: [
        ['Orders totaal', tel(d().orders)], ['Orders deze week', recent(d().orders, 'at', 7)],
        ['Boekingen', tel(d().boekingen)], ['Ritten', tel(d().rides)],
        ['Salon-posts', tel(d().posts)], ['Kassa-verkopen', tel(d().posSales)]
      ] },
      { groep: 'Geld', items: [
        ['Directe betalingen', tel(d().directBetalingen)], ['Munt-ontvangsten', tel(d().muntOntvangsten)],
        ['Winkelbestellingen', tel(d().winkelBestellingen)], ['Cadeaukaarten', tel(d().giftcards)]
      ] },
      { groep: 'De code zelf', items: [
        ['Functies in de catalogus', alleF.length],
        ['Functies aan', alleF.filter(f => f.aan).length],
        ['Functies met storing', alleF.filter(f => f.storing).length],
        ['Uptime (uren)', Math.round(process.uptime() / 36) / 100],
        ['Geheugen (MB)', Math.round(process.memoryUsage().rss / 1048576)]
      ] },
      { groep: 'Veiligheid', items: [
        ['Audit-regels (24u)', recent(d().kantoorAudit, 'at', 1)],
        ['Sleutel-afketsers (24u)', recent(d().doosAfketsers, 'at', 1)],
        ['Doos-opdrachten open', lijst(d().doosOpdrachten).filter(o => !o.klaar).length],
        ['Bolletjes op rood', wereld().telling.rood]
      ] }
    ] };
  }

  /* ---------- interne chat met snaps, per kamer ---------- */
  function chatRij(kamerId) {
    if (!AFDELINGEN[kamerId] && kamerId !== 'boardroom' && kamerId !== 'paniekkamer') return null;
    if (!d().kantoorChat) d().kantoorChat = {};
    if (!Array.isArray(d().kantoorChat[kamerId])) d().kantoorChat[kamerId] = [];
    return d().kantoorChat[kamerId];
  }
  function chatLijst(kamerId) {
    const rij = chatRij(kamerId);
    if (!rij) return { status: 404, error: 'Deze kamer bestaat niet.' };
    return { ok: true, berichten: rij.slice(-60) };
  }
  function chatStuur(kamerId, naam, tekst, foto) {
    const rij = chatRij(kamerId);
    if (!rij) return { status: 404, error: 'Deze kamer bestaat niet.' };
    const t = String(tekst || '').replace(/[<>]/g, '').trim().slice(0, 500);
    const f = (typeof foto === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(foto) && foto.length < 300000) ? foto : null;
    if (!t && !f) return { status: 400, error: 'Typ een bericht of stuur een snap.' };
    rij.push({ id: crypto.randomBytes(4).toString('hex'), naam: String(naam || 'collega').replace(/[<>]/g, '').slice(0, 30), tekst: t, foto: f, at: nu() });
    if (rij.length > 200) rij.shift();
    save();
    return { ok: true };
  }

  /* ---------- onboarding per afdeling: nieuwe mensen meteen thuis ---------- */
  const HUISREGELS = [
    'Vragen stellen is sterk, nooit dom; niemand hoeft hier iets te raden.',
    'Fouten meld je meteen en zonder schaamte; we repareren samen, we wijzen niet.',
    'Elke stagiair krijgt een buddy; je eerste week loop je overal gewoon mee.',
    'Voel je je niet gehoord of niet veilig? De vertrouwenspersoon zit in de personeels-app, en HR heeft altijd een open deur.',
    'Privacy is heilig: klantdata bekijk je alleen als je taak erom vraagt.'
  ];
  const ONBOARDING_EXTRA = {
    sales: { knoppen: ['De winkel (/site/winkel.html): wat we verkopen en voor welke prijs', 'Deze kamer: open bestellingen en partner-aanvragen', 'De werklijst: pak een taak, vink hem af'], handelingen: ['Nieuwe bestelling? Binnen twee werkdagen bellen.', 'Partner-aanvraag? Eerst het Business Pass-bewijs controleren.'] },
    hr: { knoppen: ['Sollicitaties en vacatures in deze kamer', 'Verlof en klok in de personeels-app'], handelingen: ['Elke sollicitant krijgt altijd antwoord, ook bij een nee.', 'Verlofaanvragen beslis je binnen een week.'] },
    financien: { knoppen: ['Betalingen en munt-ontvangsten in deze kamer', 'Facturen lopen automatisch via de factuurmotor'], handelingen: ['Twijfel over een bedrag? Eerst vragen, nooit gokken.'] },
    intern: { knoppen: ['Het schakelbord staat in de boardroom; de zekeringen op techniek.html', 'De Zaakdozen in het veld zie je in deze kamer'], handelingen: ['Bij een storing: eerst de verbeterkamer en het techniekbord lezen, dan pas schakelen (via de paniekkamer).'] }
  };
  function onboarding(kamerId) {
    const a = AFDELINGEN[kamerId];
    if (!a) return { status: 404, error: 'Deze kamer bestaat niet.' };
    const extra = ONBOARDING_EXTRA[kamerId] || {};
    return { ok: true, onboarding: {
      welkom: 'Welkom bij ' + a.naam + '! ' + a.missie + ' Fijn dat je er bent; deze pagina is er zodat jij je vanaf dag een gehoord, gesteund en thuis voelt.',
      regels: HUISREGELS,
      knoppen: extra.knoppen || ['De cijfers van deze kamer staan bovenaan; de werklijst eronder.', 'De chat-tab is voor de kamer zelf: vraag alles.', 'De statistieken-tab toont het hele platform, zodat je snapt waar jouw werk landt.'],
      handelingen: extra.handelingen || ['Begin elke dienst met de werklijst en de verbeterpunten uit de boardroom.', 'Sluit af met een korte notitie in de chat: wat is af, wat blijft liggen.']
    } };
  }

  /* ---------- aanmelden: wie werkt er nu, op kantoor of thuis ---------- */
  function dienstRij() { if (!Array.isArray(d().kantoorDienst)) d().kantoorDienst = []; return d().kantoorDienst; }
  function dienstIn(naam, kamerId, waar) {
    const n = String(naam || '').replace(/[<>]/g, '').trim().slice(0, 30);
    if (!n) return { status: 400, error: 'Wie meldt zich aan?' };
    if (!AFDELINGEN[kamerId] && kamerId !== 'boardroom' && kamerId !== 'paniekkamer') return { status: 404, error: 'Deze kamer bestaat niet.' };
    const rij = dienstRij();
    const open = rij.find(x => !x.uit && x.naam.toLowerCase() === n.toLowerCase());
    if (open) return { status: 409, error: n + ' is al aangemeld (' + open.waar + '). Eerst afmelden.' };
    const e = { id: crypto.randomBytes(4).toString('hex'), naam: n, kamer: kamerId, waar: waar === 'thuis' ? 'thuis' : 'kantoor', in: nu(), uit: null };
    rij.unshift(e);
    if (rij.length > 500) rij.pop();
    save();
    return { ok: true, dienst: e };
  }
  function dienstUit(id) {
    const e = dienstRij().find(x => x.id === id && !x.uit);
    if (!e) return { status: 404, error: 'Deze aanmelding staat niet (meer) open.' };
    e.uit = nu();
    save();
    return { ok: true, dienst: e };
  }
  function dienstNu() {
    return { ok: true, aangemeld: dienstRij().filter(x => !x.uit).map(x => ({ id: x.id, naam: x.naam, kamer: x.kamer, waar: x.waar, sinds: x.in })) };
  }

  /* ---------- de paniekkamer ----------
     Dezelfde knoppen als de boardroom, maar met het vier-ogen-principe: een
     omgezette knop wordt een voorstel. De boardroom accepteert (dan schakelt
     hij echt), wijst af, of discussieert er eerst over. */
  function paniekRij() {
    if (!Array.isArray(d().paniekVoorstellen)) d().paniekVoorstellen = [];
    return d().paniekVoorstellen;
  }
  function paniekStel({ functie, aan, doelgroep, reden }) {
    if (!functies.OP_ID[functie]) return { status: 404, error: 'Onbekende functie.' };
    if (doelgroep && !functies.DOELGROEP_IDS.includes(doelgroep)) return { status: 400, error: 'Onbekende doelgroep.' };
    const rij = paniekRij();
    if (rij.some(v => v.status === 'open' && v.functie === functie && (v.doelgroep || null) === (doelgroep || null)))
      return { status: 409, error: 'Voor deze knop ligt al een voorstel bij de boardroom.' };
    const v = {
      id: crypto.randomBytes(4).toString('hex'),
      functie, functieNaam: functies.OP_ID[functie].naam,
      aan: aan === true, doelgroep: doelgroep || null,
      reden: String(reden || '').replace(/[<>]/g, '').trim().slice(0, 300),
      status: 'open', discussie: [], at: nu()
    };
    rij.unshift(v);
    if (rij.length > 200) rij.pop();
    save();
    return { ok: true, voorstel: v };
  }
  function paniekBesluit(id, besluit) {
    const v = paniekRij().find(x => x.id === id);
    if (!v) return { status: 404, error: 'Dit voorstel bestaat niet.' };
    if (v.status !== 'open') return { status: 409, error: 'Dit voorstel is al afgehandeld.' };
    if (besluit === 'accepteer') {
      const r = schakel(v.functie, v.aan, v.doelgroep, 'boardroom (paniekvoorstel)');
      if (r.error) return r;
      v.status = 'geaccepteerd';
    } else if (besluit === 'wijs-af') {
      v.status = 'afgewezen';
      audit('boardroom', 'Paniekvoorstel afgewezen: ' + v.functieNaam + ' ' + (v.aan ? 'AAN' : 'UIT'));
    } else return { status: 400, error: 'Kies accepteer of wijs-af.' };
    v.beslotenAt = nu();
    save();
    return { ok: true, voorstel: v };
  }
  function paniekBericht(id, wie, tekst) {
    const v = paniekRij().find(x => x.id === id);
    if (!v) return { status: 404, error: 'Dit voorstel bestaat niet.' };
    const t = String(tekst || '').replace(/[<>]/g, '').trim().slice(0, 500);
    if (!t) return { status: 400, error: 'Schrijf een bericht.' };
    v.discussie.push({ wie: wie === 'boardroom' ? 'boardroom' : 'paniekkamer', tekst: t, at: nu() });
    if (v.discussie.length > 50) v.discussie.shift();
    save();
    return { ok: true, voorstel: v };
  }
  function paniekLijst() { return { ok: true, voorstellen: paniekRij().slice(0, 50) }; }

  /* ---------- het logboek: wie deed wat (audittrail) ----------
     Elke schakeling, elk paniekbesluit en elke wereldknop komt hier in, met
     naam en tijd. Onmisbaar voor een 9+-beveiliging: achteraf is altijd te
     herleiden wie welke knop heeft omgezet. */
  function auditRij() {
    if (!Array.isArray(d().kantoorAudit)) d().kantoorAudit = [];
    return d().kantoorAudit;
  }
  function audit(wie, wat) {
    const rij = auditRij();
    rij.unshift({ wie: String(wie || 'kantoor').replace(/[<>]/g, '').slice(0, 30), wat: String(wat || '').replace(/[<>]/g, '').slice(0, 200), at: nu() });
    if (rij.length > 2000) rij.pop();
    save();
  }

  /* ---------- de wereld: alles in het veld als bolletje ----------
     Groen = oke, oranje = uit (bewust uitgezet, of een doos die stilvalt),
     rood = storing. Bij een probleem horen knoppen: reset (het ding krijgt
     een reset-opdracht bij zijn volgende melding) of hulp (het ding stuurt
     direct een diagnose-rapport). De doos haalt de opdracht zelf op via het
     meetstation; de cloud hoeft het kastje dus nooit binnen te kunnen. */
  const STIL_NA = 15 * 60 * 1000; // een doos die een kwartier niets meldt, staat op oranje
  function laatstePerDoos() {
    const per = {};
    for (const m of lijst(d().doosMetingen)) if (!per[m.doos]) per[m.doos] = m;
    return per;
  }
  function opdrachtRij() {
    if (!Array.isArray(d().doosOpdrachten)) d().doosOpdrachten = [];
    return d().doosOpdrachten;
  }
  function wereld() {
    const items = [];
    const per = laatstePerDoos();
    for (const naam of Object.keys(per)) {
      const m = per[naam];
      const stil = nu() - m.at > STIL_NA;
      const status = m.modus === 'lokaal' ? 'rood' : (stil ? 'oranje' : 'groen');
      const detail = m.modus === 'lokaal'
        ? 'lijn weg' + (m.journaal ? ', ' + m.journaal + ' in journaal' : '') + (m.via ? ', meldt zich via ' + m.via : '')
        : (stil ? 'al ' + Math.round((nu() - m.at) / 60000) + ' min stil' : m.rtt + 'ms over de lijn');
      items.push({ id: 'doos:' + naam, naam, soort: 'doos', plek: m.plek || null, status, detail,
        acties: status === 'groen' ? ['hulp'] : ['reset', 'hulp'] });
    }
    for (const g of functies.catalogus(functiesStand())) for (const f of g.functies) {
      if (f.storing) items.push({ id: 'functie:' + f.id, naam: f.naam, soort: 'functie', plek: null, status: 'rood', detail: 'storing gemeld: ' + String(f.storing).slice(0, 80), acties: ['reset'] });
      else if (!f.aan) items.push({ id: 'functie:' + f.id, naam: f.naam, soort: 'functie', plek: null, status: 'oranje', detail: 'bewust uitgezet (schakelbord)', acties: [] });
    }
    items.push({ id: 'systeem:cloud', naam: 'RTG-cloud (dit huis)', soort: 'systeem', plek: { lat: 52.37, lon: 4.9 }, status: 'groen', detail: 'in de lucht, ' + Math.round(process.uptime() / 60) + ' min', acties: [] });
    const telling = { groen: 0, oranje: 0, rood: 0 };
    for (const i of items) telling[i.status]++;
    return { ok: true, items, telling, opdrachtenOpen: opdrachtRij().filter(o => !o.klaar).length };
  }
  function wereldActie(id, actie, wie) {
    if (actie !== 'reset' && actie !== 'hulp') return { status: 400, error: 'Kies reset of hulp.' };
    const naam = String(wie || 'kantoor');
    if (id.startsWith('doos:')) {
      const doosNaam = id.slice(5);
      if (!laatstePerDoos()[doosNaam]) return { status: 404, error: 'Deze doos staat niet op de kaart.' };
      const rij = opdrachtRij();
      if (rij.some(o => !o.klaar && o.doos === doosNaam && o.actie === actie))
        return { status: 409, error: 'Deze opdracht staat al klaar voor de doos.' };
      rij.unshift({ id: crypto.randomBytes(4).toString('hex'), doos: doosNaam, actie, door: naam.replace(/[<>]/g, '').slice(0, 30), klaar: false, at: nu() });
      if (rij.length > 200) rij.pop();
      save();
      audit(naam, 'Wereldknop: ' + actie + ' voor doos ' + doosNaam);
      return { ok: true, wacht: 'De doos haalt de opdracht op bij zijn volgende melding (binnen een minuut als de lijn er is).' };
    }
    if (id.startsWith('functie:')) {
      const fid = id.slice(8);
      if (!functies.OP_ID[fid]) return { status: 404, error: 'Onbekende functie.' };
      if (actie !== 'reset') return { status: 400, error: 'Een functie kent alleen reset (storing wissen).' };
      const st = functiesStand();
      if (!st[fid] || !st[fid].storing) return { status: 409, error: 'Deze functie meldt geen storing.' };
      st[fid].storing = null;
      save();
      audit(naam, 'Wereldknop: storing gewist op functie ' + fid);
      return { ok: true };
    }
    return { status: 404, error: 'Onbekend bolletje.' };
  }
  // de doos meldt zich (meetstation): staat er een opdracht klaar, geef hem mee
  function opdrachtVoorDoos(doosNaam) {
    const o = opdrachtRij().find(x => !x.klaar && x.doos === doosNaam);
    if (!o) return null;
    o.klaar = true;
    o.klaarAt = nu();
    save();
    audit('meetstation', 'Doos ' + doosNaam + ' heeft de ' + o.actie + '-opdracht opgehaald');
    return o.actie;
  }

  return { afdelingen: { kamers, kamer, taakMaak, taakZet, boardroom, schakel, voorstellen, paniekStel, paniekBesluit, paniekBericht, paniekLijst, platformStats, chatLijst, chatStuur, onboarding, dienstIn, dienstUit, dienstNu, wereld, wereldActie, opdrachtVoorDoos, audit, KAMER_IDS } };
};
