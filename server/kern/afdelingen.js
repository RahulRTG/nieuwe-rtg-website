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
        ['Zaakdozen in het veld', tel(lijst(d().winkelBestellingen).filter(o => o.product === 'zaakdoos'))]
      ],
      lijsten: () => [
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
  function schakel(id, aan, doelgroep) {
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
      verbeterkamer: voorstellen(false)
    };
  }

  return { afdelingen: { kamers, kamer, taakMaak, taakZet, boardroom, schakel, voorstellen, KAMER_IDS } };
};
