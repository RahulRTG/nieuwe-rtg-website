/* De dorpstools (kern/hoteldorp/tools): het specialistische gereedschap per
   afdeling - snelknoppen, logacties en het volledige dorpTools-overzicht dat
   elke afdeling zijn eigen werkscherm geeft. Afgesplitst uit kern/hoteldorp.js;
   de postenmotor en de meters wonen daar en komen via de context binnen.

   Dit is de orkestrator: hij bouwt de vaste blokken (dagcijfers, bewaking,
   snelknoppen, logmoment, meter) en laat het vakspecifieke bord over aan twee
   deelbestanden op dezelfde ctx: ./hotelborden (de hotelafdelingen) en
   ./clubborden (het club-, restaurant- en stranddorp). De leeftijdscheck aan
   de deur (security en entree) blijft hier, want die deelt twee werelden. */
module.exports = (ctx) => {
  const { db, AFDELINGEN, METERS, posten, dorpSet } = ctx;
  const { hotelBord } = require('./hotelborden')(ctx);
  const { clubBord } = require('./clubborden')(ctx);

  const SNELKNOPPEN = {
    frontoffice: ['Late check-out', 'Vroege check-in', 'Wake-up call', 'Taxi geregeld', 'Bagage opgeslagen'],
    guest: ['Verjaardag', 'Allergie', 'Jubileum', 'Terugkerende gast', 'Reisgezelschap'],
    relations: ['Klacht geluid', 'Klacht schoonmaak', 'Compliment voor het team', 'Attentie sturen', 'Upgrade aangeboden'],
    concierge: ['Tafel reserveren', 'Transfer regelen', 'Tickets regelen', 'Boot charteren', 'Personal shopper'],
    parking: ['Voorrijden', 'Wagen wassen', 'Laadpaal aansluiten', 'Valet-inname', 'Sleutel in de kluis'],
    security: ['Ronde poolbar', 'Ronde garage', 'Deur controleren', 'Camera-check', 'Escorte naar de lobby'],
    gym: ['Handdoeken aanvullen', 'Toestel-storing', 'Personal training', 'Water aanvullen', 'Zaal reserveren'],
    spa: ['Massage 60 minuten', 'Gezichtsbehandeling', 'Sauna klaarzetten', 'Duo-behandeling', 'Laat tijdslot'],
    amenities: ['Badjassen', 'Kussenmenu', 'Kinderbedje', 'Strijkplank', 'Tandenborstel-set', 'Extra dekbed'],
    patissier: ['Verjaardagstaart', 'Turndown-zoet', 'Glutenvrij gebak', 'Fruitmand', 'Petit fours', 'Champagne-aardbeien'],
    klussen: ['Lamp vervangen', 'Kraan lekt', 'Airco maakt geluid', 'Deur klemt', 'Schilderwerk bijwerken'],
    it: ['Wifi traag', 'TV-storing', 'Keycard defect', 'Printer receptie', 'Kassa hangt'],
    sales: ['Bedrijfsuitje', 'Bruiloft-aanvraag', 'Groepsboeking', 'Site inspection', 'Partnerdeal'],
    events: ['Bruiloft', 'Congres', 'Verjaardagsfeest', 'Sunset dinner', 'DJ boeken'],
    florist: ['Lobby-boeket', 'Tafelstukken', 'Bruidswerk', 'Roos op de kamer', 'Plantenservice'],
    kidsclub: ['Kind aanmelden', 'Lunch voor de kids', 'Zwemles', 'Knutselmiddag', 'Ophaalmelding'],
    watersport: ['Paddleboard', 'Jetski', 'Snorkelset', 'Zeiltocht', 'Kajak'],
    entree: ['Op de gastenlijst', 'Groep aan de deur', 'ID-check', 'Stempel en bandje', 'Taxi voor een gast'],
    garderobe: ['Jas aangenomen', 'Tas aangenomen', 'Helm aangenomen', 'Nummer zoekgeraakt', 'Gevonden voorwerp'],
    bar: ['IJs aanvullen', 'Glazen bijvullen', 'Fust wisselen', 'Garnering snijden', '86 doorgeven'],
    vip: ['Tafel reserveren', 'Fles op tafel', 'Sparklers', 'Verjaardag op tafel', 'Rekening op tafel'],
    dj: ['Verzoekje', 'Set wisselen', 'Mic voor de MC', 'Happy birthday inzetten', 'Volume-klacht'],
    techniek: ['Licht valt uit', 'Geluid valt weg', 'Rookmachine bijvullen', 'Monitor stuk', 'Kabel tapen'],
    vloer: ['Glaswerk ophalen', 'Dweilen bij de bar', 'Toiletten checken', 'Asbakken legen', 'Terras vegen'],
    promo: ['Story met de line-up', 'Post voor vanavond', 'Gastenlijst-actie', 'Flyer-team sturen', 'Fotograaf boeken'],
    inkoop: ['Drank bijbestellen', 'IJs bestellen', 'Rietjes en bekers', 'Schoonmaakmiddel', 'Leverancier bellen'],
    kantoor: ['Facturen inboeken', 'Rooster rondsturen', 'Kas opmaken', 'Vergunning checken', 'Post verwerken'],
    host: ['Tafel voor twee', 'Groep aangemeld', 'Op de wachtlijst', 'Kinderstoel klaarzetten', 'Taxi voor een gast'],
    bediening: ['Extra couvert', 'Wijnadvies gevraagd', 'Allergie doorgeven', 'Kaarsje bij het dessert', 'Rekening gevraagd'],
    keuken: ['86 doorgeven', 'Mise en place bijna op', 'Spoedbon', 'Speciale wens', 'Pas op: allergie'],
    ligbedden: ['Bed reserveren', 'Handdoeken brengen', 'Parasol bijzetten', 'IJsemmer brengen', 'Bed ombouwen voor de avond']
  };
  const LOGACTIES = {
    frontoffice: 'Overdracht gedaan', guest: 'Voorkeuren bijgewerkt', relations: 'Belrondje gedaan',
    concierge: 'Tips bijgewerkt', parking: 'Garage-ronde gelopen', security: 'Ronde gelopen',
    gym: 'Zaal gecheckt', spa: 'Cabines klaargezet', amenities: 'Voorraadkast geteld',
    patissier: 'Vitrine gevuld', klussen: 'Werkplaats opgeruimd', it: 'Back-up gecontroleerd',
    sales: 'Follow-ups gedaan', events: 'Draaiboek doorgenomen', florist: 'Water ververst',
    kidsclub: 'Koppen geteld', watersport: 'Materiaal geteld',
    entree: 'Rij geteld', garderobe: 'Rekken geteld', bar: 'Bar gespoeld',
    vip: 'Tafels gecheckt', dj: 'Set gewisseld', techniek: 'Rondje techniek gelopen',
    vloer: 'Rondje vloer gelopen', promo: 'Bereik gecheckt', inkoop: 'Voorraad geteld',
    kantoor: 'Administratie bijgewerkt',
    host: 'Boek doorgenomen', bediening: 'Ronde langs de tafels', keuken: 'Doorgifte gecheckt',
    ligbedden: 'Rijen geteld'
  };

  function dorpTools(s, key) {
    const afd = (dorpSet(s) || []).includes(key) ? AFDELINGEN[key] : null;
    if (!afd) return { status: 400, error: 'Onbekende afdeling.' };
    const alle = posten(s).filter(p => p.afdeling === key);
    const vandaag = new Date().toISOString().slice(0, 10);
    const opDag = iso => String(iso || '').slice(0, 10) === vandaag;
    const minuten = iso => Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
    const eind = afd.keten[afd.keten.length - 1];
    const open = alle.filter(p => p.status !== eind);
    const tools = [];

    // 1. de dagcijfers: nieuw, afgerond en open, voor elke afdeling hetzelfde
    tools.push({ type: 'cijfers', titel: 'Vandaag', items: [
      { label: 'nieuw', waarde: alle.filter(p => opDag(p.at)).length },
      { label: 'afgerond', waarde: alle.filter(p => p.status === eind && opDag(p.updatedAt)).length },
      { label: 'open', waarde: open.length }
    ] });

    // 2. het vakspecifieke bord (hotelafdelingen en het club-/resto-/stranddorp)
    const gereedschap = { s, key, afd, alle, open, eind, vandaag, opDag, minuten };
    hotelBord(tools, gereedschap);
    clubBord(tools, gereedschap);
    // security checkt leeftijden aan de deur: ja/nee op codenaam, zonder
    // gegevens (de paspoort-bevestiging doet het echte werk en logt alles)
    if (key === 'security' || key === 'entree') {
      tools.push({ type: 'leeftijd', titel: 'Leeftijdscheck', hint: 'Codenaam van de gast; het lid krijgt automatisch een melding van de check.' });
    }

    // 3. de bewaking: wat langer dan vier uur open staat, kleurt rood
    tools.push({ type: 'lijst', titel: 'Staat te lang open', leeg: 'Niets staat te lang open.',
      rijen: open.filter(p => minuten(p.at) > 240).map(p => ({ icoon: String.fromCodePoint(0x23F0), tekst: (p.waar ? p.waar + ' - ' : '') + p.tekst, rechts: Math.round(minuten(p.at) / 60) + ' uur', rood: true })) });
    // 4. snelknoppen voor het veelgevraagde werk
    tools.push({ type: 'knoppen', titel: 'Veelgevraagd', knoppen: SNELKNOPPEN[key] || [] });
    // 5. het logmoment: een tik en het staat geklokt (direct afgerond)
    tools.push({ type: 'actie', titel: 'Logmoment', knop: LOGACTIES[key] || 'Gedaan', tekst: LOGACTIES[key] || 'Gedaan' });
    // 6. de eigen meter van de afdeling
    const m = METERS[key] || METERS.standaard;
    tools.push({ type: 'meter', titel: m.titel, opties: m.opties, stand: ((s.dorpStanden || {})[key]) || (key === 'gym' ? s.gymDrukte : null) || null });

    return { ok: true, afdeling: key, tools };
  }

  return { dorpTools };
};
