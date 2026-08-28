  /* ---------- de inhoud van de expliciete demostand ----------

     Deze drie lijsten stonden als BEGINWAARDE van `invoices`, `trip` en `posts`
     in app-main-01.js. applyState() overschrijft wat de server stuurt -- maar
     een reis die er niet is, stuurt de server niet mee (`if (state.trip)`), en
     dan bleef de reis naar Ibiza gewoon staan. Wie zich echt aanmeldde zag
     daardoor op zijn eigen beginscherm een villa in Cala Jondal en vier
     facturen op zijn naam. De server begint een nieuw account leeg
     (server/kern/lid.js); dit was de laatste plek waar de demo nog voor
     persoonlijke gegevens doorging.

     De demo gaat nergens heen, hij staat alleen apart: laadDemoData() in
     app-main-03.js zet hem klaar in de expliciete demostand (?demo=1, zonder
     backend), waar er per definitie geen echt account is om iets van te tonen. */
  const DEMO_DATA = {
    invoices: [
      {id:'RTG-2026-0158', desc:'Ibiza, Aguamarina, 3 nachten', netto:1740, bijdrage:150, status:'open', date:'Vervalt 28 juli 2026'},
      {id:'RTG-2026-0141', desc:'Villa Bahia Ibiza, Cala Jondal, 4 nachten', netto:2240, bijdrage:180, status:'open', date:'Vervalt 15 augustus 2026'},
      {id:'RTG-2026-0093', desc:'Privejet Schiphol - Ibiza (retour, gedeeld)', netto:1460, bijdrage:120, status:'paid', date:'Betaald op 2 mei 2026'},
      {id:'RTG-2025-0871', desc:'Jaarbijdrage lidmaatschap 2026', netto:0, bijdrage:480, status:'paid', date:'Betaald op 4 januari 2026'}
    ],
    trip: {
      dest:'Ibiza', dates:'18 - 25 juli 2026', days:7,
      items:[
        {when:'18 jul', title:'Lijnvlucht RTG-1263, Amsterdam Schiphol → Ibiza', sub:'Economy comfort · 2 personen', status:'paid', label:'Bevestigd'},
        {when:'18 jul', title:'Privétransfer luchthaven → Aguamarina', sub:'Chauffeur bij aankomsthal', status:'paid', label:'Bevestigd'},
        {when:'18-21 jul', title:'Aguamarina Ibiza, Sea-view suite', sub:'3 nachten, late check-out', status:'open', label:'Wacht op betaling', invoiceId:'RTG-2026-0158'},
        {when:'19 jul', title:'Diner, Sal de Mar', sub:'Chef-menu · 21:00 uur', status:'req', label:'In aanvraag'},
        {when:'20 jul', title:'Privéboot naar Formentera', sub:'Met de groep · 10:00 uur', status:'paid', label:'Bevestigd'},
        {when:'21-25 jul', title:'Villa Bahia Ibiza, Cala Jondal', sub:'4 nachten, eigen zwembad', status:'open', label:'Wacht op betaling', invoiceId:'RTG-2026-0141'}
      ]
    },
    posts: [
      {id:1, author:'Katja Kiss', tier:'rtg', place:'Ibiza', visual:'v-ibiza',
       text:'Met de hele vriendengroep neergestreken: de helft in het hotel aan zee, wij in de villa boven Cala Jondal. Rahul kwam met de privéjet, wij pakten de ochtendvlucht, en toch checken we samen in.',
       likes:168, liked:false, comments:[{who:'Timothy de Groot', tier:'rtg', text:'Tussen twee tentamens door even bijkomen, precies wat ik nodig had.'}]},
      {id:2, author:'Rahul Imran', tier:'business', place:'Ibiza', visual:'v-ibiza',
       text:'Ochtend: twee calls vanaf het terras. Middag: boot naar Formentera met de groep. De jet stond klaar op Schiphol Business Aviation.',
       likes:96, liked:false, comments:[]},
      {id:3, author:'Fleur Johanna', tier:'lifestyle', place:'Gstaad', visual:'v-gstaad',
       text:'Wij oude rotten trekken de bergen in terwijl de jeugd op Ibiza ligt. Chalet in Gstaad, open haard, en morgen de piste op. Op je 69e mag dat.',
       likes:132, liked:false, comments:[
         {who:'Marieke Hooi', tier:'lifestyle', text:'Als schooldirectrice tel ik de dagen af tot de vakantie; deze is het waard.'},
         {who:'William Draak', tier:'business', text:'Vanuit Monaco groeten wij Gstaad. De boekhouding klopt, de rosé ook.'}
       ]},
      {id:4, author:'Dani da Cruz Carvalho', tier:'business', place:'Monaco', visual:'v-monaco',
       text:'Na mijn voetbaljaren dacht ik alles gezien te hebben in Monaco, maar aankomen op codenaam en toch als vanouds ontvangen worden, dat is nieuw.',
       likes:214, liked:false, comments:[]},
      {id:5, author:'Feroz Mohammed', tier:'business', place:'Dubai', visual:'v-dubai',
       text:'Een week Dubai met vrienden: de een in de wolkenkrabber-suite, de ander in een strandappartement aan de Palm. Ik werk voor de Nederlandse staat, maar deze dagen tel ik even niet mee.',
       likes:78, liked:false, comments:[]}
    ],
    creatorLikes: {rtg:320, lifestyle:680, business:210}
  };

