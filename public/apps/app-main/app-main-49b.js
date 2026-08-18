  /* De AI-kant van de app: de opener van Rahul en zijn regelantwoorden zonder
     backend. Afgesplitst van app-main-49.js (de zzp-rekenhulp) toen dat bestand
     de 10 KB-lat passeerde; dat was ook de natuurlijke naad, want een
     belastingrekenaar en een gesprek zijn twee onderwerpen. De staart van
     aiAnswer staat in app-main-50.js -- die grens lag er al. */
  /* ---------- AI ---------- */

  const chatHistory = [];

  function aiOpener(){
    const first = user.full.split(' ')[0];
    const groet = (lang()==='en' ? 'Good day' : 'Goedendag') + (user.tier === 'business' ? '.' : ', ' + first + '.');
    /* ZONDER REIS OPENT RAHUL MET EEN VRAAG. Hier stond onvoorwaardelijk "Uw reis
       naar " + trip.dest, en trip was altijd gevuld -- desnoods met de demo-reis,
       zodat een vers lid werd begroet met een reis die het nooit boekte. */
    if (!trip) return [
      groet + ' ' + (lang()==='en'
        ? 'There is nothing planned yet. Tell me where you want to go and when, and I will take it from there:'
        : (stem('Er staat nog niets gepland. Zeg me waar je heen wilt en wanneer, dan neem ik het over:',
                'Er staat nog niets gepland. Geef me de bestemming en de data, dan neem ik het over:',
                'Er staat nog niets gepland. Zegt u mij waar het heen mag en wanneer, dan neem ik het over:'))),
      (lang()==='en'
        ? '• Flight, stay, transfer and tables: I request them with our partners; the status stands in your travel overview.'
        : '• Vlucht, verblijf, transfer en tafels: ik vraag ze aan bij onze partners; de status staat in het reisoverzicht.'),
      (lang()==='en'
        ? '• Nothing is confirmed until a partner says yes, and I will never tell you otherwise.'
        : '• Niets staat vast tot een partner ja zegt; ik zeg nooit dat iets geregeld is als dat niet zo is.'),
      (lang()==='en' ? '• Where would you like to go?' : (stem('• Waar wil je heen?', '• Waar mag het heen?', '• Waar mag het heen?')))
    ].join('\n');
    const lines = [ lang()==='en'
      ? (groet + ' Your journey to ' + trip.dest + ' begins in ' + trip.days + ' days. I have already thought ahead:')
      : (groet + ' Uw reis naar ' + trip.dest + ' begint over ' + trip.days + ' dagen. Ik heb alvast vooruitgedacht:') ];
    const open = invoices.filter(i => i.status === 'open');
    if (open.length){
      const sum = open.reduce((s,i) => s + i.netto + i.bijdrage, 0);
      lines.push(lang()==='en'
        ? ('• There ' + (open.length === 1 ? 'is 1 payment' : 'are ' + open.length + ' payments') + ' still open (' + eur(sum) + '). One tap in Payments and it is done.')
        : ('• Er ' + (open.length === 1 ? 'staat nog 1 betaling' : 'staan nog ' + open.length + ' betalingen') + ' open (' + eur(sum) + '). Eén tik in Betalen en het is geregeld.'));
    }
    const pending = trip.items.find(i => i.status === 'req');
    if (pending) lines.push(lang()==='en'
      ? ('• ' + pending.title.replace('Diner, ', 'Your table at ') + ' is still being requested; I am watching for the confirmation.')
      : ('• ' + pending.title.replace('Diner, ', 'Uw tafel bij ') + ' is nog in aanvraag; ik bewaak de bevestiging.'));
    lines.push(T('ai.opener.plan','• Zal ik vast een paklijst en een dagplan voor 14 oktober klaarzetten? Eén "ja" is genoeg.'));
    return lines.join('\n');
  }

  function aiAnswer(q){
    const l = q.toLowerCase().trim();
    /* DE ANTWOORDEN VAN DE APP ZELF, ZONDER SERVER. Deze stonden woordelijk op de
       DEMO-reis (Ibiza, Formentera, Sal de Mar) en het eerste begon met
       "Geregeld. De paklijst staat klaar ... is ingepland", terwijl er niets
       geboekt wordt -- dezelfde fout die serverkant al recht stond
       (kern/ai/demoantwoorden.js). En hij liep niet alleen in de demostand: dit
       bestand valt ook op aiAnswer terug als de SERVERAANROEP MISLUKT, dus een
       echt lid met een haperende verbinding kreeg hem net zo goed. Nu dragen ze
       de eigen reis; zonder reis vraagt Rahul waar het heen mag. */
    const dest = trip && trip.dest ? trip.dest : null;
    const heen = T('ai.a.ask','Waar mag het heen, en wanneer? Zodra ik dat weet zet ik het hele voortraject klaar.');
    if (/^(ja|graag|ja graag|doe maar|prima|goed|regel het|ja, regel het|yes|please|go ahead|sure|arrange it)\b/.test(l))
      return dest
        ? T('ai.a.yes','Ik zet het in gang: het voorstel komt in het reisoverzicht en wat een partner moet bevestigen gaat als aanvraag de deur uit. Niets staat vast tot zij ja zeggen; ik laat het weten zodra dat zo is.')
        : T('ai.a.yesleeg','Ik pak het op. Alleen staat er nog geen reis in het systeem: er is dus niets in aanvraag en niets bevestigd. ') + heen;
    if (l.includes('inpak') || l.includes('paklijst') || l.includes('pack'))
      return dest
        ? T('ai.a.pack','Voor ') + dest + T('ai.a.pack2',' loop ik het per dag na: kleding voor buiten, iets nets voor de avonden, en documenten en medicijnen apart. Zal ik er een afvinklijst van maken?')
        : T('ai.a.packleeg','Een paklijst maak ik op de bestemming, het seizoen en wat u daar gaat doen. ') + heen;
    if (l.includes('visum') || l.includes('paspoort') || l.includes('visa') || l.includes('passport'))
      return dest
        ? T('ai.a.visa','Ik zoek de document- en visumeisen na voor ') + dest + T('ai.a.visa2',' bij uw nationaliteit en geef het antwoord met de bron erbij. Zal ik dat nu uitzoeken?')
        : T('ai.a.visaleeg','Welke documenten u nodig heeft hangt af van de bestemming en uw paspoort; ik zoek dat liever op dan dat ik het gok. ') + heen;
    if (l.includes('weer') || l.includes('weather'))
      return dest
        ? T('ai.a.weather','De verwachting voor ') + dest + T('ai.a.weather2',' houd ik bij en trek ik vlak voor vertrek na; ver vooruit is het een aanname en geen voorspelling.')
        : T('ai.a.weatherleeg','Het weer haal ik op voor de plek en de dagen waar het om gaat. ') + heen;
    if (l.includes('plan') || l.includes('dag') || l.includes('day'))
      return dest
        ? T('ai.a.plan','Ik zet een dagindeling voor ') + dest + T('ai.a.plan2',' als voorstel klaar: ochtend rustig, het uitje midden op de dag, de avond op tafel. Alles wat een partner moet bevestigen gaat als aanvraag.')
        : T('ai.a.planleeg','Een dagplan bouw ik op wat er op de bestemming te doen is en op uw tempo. ') + heen;
    if (l.includes('restaurant') || l.includes('diner') || l.includes('eten') || l.includes('dinner') || l.includes('eat'))
      return dest
        ? T('ai.a.rest','Voor ') + dest + T('ai.a.rest2',' leg ik u twee of drie adressen uit ons netwerk voor, tegen normale prijs, en vraag ik de tafel aan zodra u kiest. Voor welke avond en met hoeveel personen?')
        : T('ai.a.restleeg','Een tafel regel ik via ons netwerk, tegen de normale prijs. Waar bent u, of waar gaat u heen, en met hoeveel personen?');
    return T('ai.a.default','Daar kom ik vandaag nog op terug. Ik kan alvast helpen met de paklijst, documenten, het weer of een dagplan, zeg het maar.');
  }
