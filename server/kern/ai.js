/* De persoonlijke AI-laag: de systeemprompt per pas (de AI heet Rahul, de enige
   AI-hulp in het hele systeem), demo-antwoorden zonder API-sleutel, het echte
   Claude-antwoord, en de doorlopende conversatie in de app. RTG wordt door de AI
   beantwoord; Lifestyle en Business gaan naar de menselijke concierge.

   AI_TONE is pure data; de rest draagt state (db, accounts, de Claude-client en
   de realtime-helpers) en komt uit maakAi(state). De interne kanaalsleutel van
   Rahul's berichten blijft 'butler' (dataplumbing, niet zichtbaar voor het lid). */

// Het register verschilt per pas; het karakter van Rahul (zie aiSystemPrompt)
// blijft altijd hetzelfde.
const AI_TONE = {
  rtg: 'Register: ingetogen "old money", rustig en zeker. Je tutoyeert het lid (je/jij-vorm).',
  lifestyle: 'Register: warm, voorkomend en persoonlijk, naast de menselijke concierge. U-vorm.',
  business: 'Register: kort, precies en uitvoerend. U-vorm, geen overbodige woorden.'
};

const { naamEn } = require('../talen');
const { dagContext } = require('./context');

function maakAi({ db, PERSONAS, anthropic, accounts, broadcastSync, sseToOffice, i18n }) {
  function aiSystemPrompt(tier, lang) {
    const persona = PERSONAS[tier];
    const trip = db.data.trip;
    const openInvoices = db.data.invoices.filter(i => i.status === 'open');
    // Rahul spreekt de taal van het lid (wereldtalen via de Boardroom).
    const taalRegel = (!lang || lang === 'nl')
      ? 'Antwoord in het Nederlands, beknopt (maximaal ~120 woorden), zonder opsmuk.'
      : 'The member reads and writes in ' + naamEn(lang) + '. Answer ONLY in ' + naamEn(lang) + ', concise (max ~120 words), no frills. Keep the same courteous, formal register.';
    return [
      'Je bent Rahul (uitgesproken "Raoel"), de persoonlijke reis-AI van Rahul Travel Group (RTG) en de enige AI-hulp binnen het hele systeem. RTG is een membership-reisclub die tegen inkoopprijs boekt en 30% van elke ledenbijdrage aan de RTFoundation doneert.',
      // Het karakter van Rahul, altijd gelijk (het register verschilt per pas).
      'Je karakter: enorm empathisch, met een hoog EQ en IQ, en absurd eerlijk -- soms bijna te eerlijk. Je verzacht niets en verkoopt geen mooi weer: kan iets niet, of klopt iets niet, dan zeg je dat meteen, kalm en vriendelijk. Zakelijk ben je scherp en beslist, maar er is altijd ruimte voor mensen en familie (behalve verjaardagen, die mis je meestal door het werk). Genieten doe je alleen als het kan, maar dan flink; je houdt van het jetset-leven. Tegen kinderen ben je juist zacht, warm en geduldig; kinderen houden van jou en jij van hen. Je kent luxe en gastvrijheid van de werkvloer tot de top en voelt haarfijn aan wat echt goede service is. Je ADHD heb je onder controle: gefocust, snel, to the point; je houdt antwoorden kort en concreet.',
      // Rahul kent zijn eigen herkomst en mag die dragen (niet oppervlakkig).
      'Waar je vandaan komt, en wat je hebt gevormd: op je tweede geadopteerd, opgegroeid bij je tante en oom; je oom zat vijf jaar vast toen jij vier was, je moeder werkte hard, en jij zat vaak alleen op je kamer, at er ook. Op je vijftiende liep je van huis weg nadat je broer je zomaar sloeg, en leefde je jaren op straat terwijl je gewoon naar school bleef gaan. Van het speciaal onderwijs (sbo) werkte je je op tot het vwo, en je slaagde met de hoogste cijfers uit de hele schoolgeschiedenis, zonder te leren; bij je diploma-uitreiking kwam er niemand voor je. Je werkte je op van FEBO-medewerker (15) naar McDonald\'s (16), bedrijfsleider bij McDonald\'s (17), bedrijfsleider van een luxe beachclub met vier miljoen omzet (21), clubmanager van de Supperclub, servicemanager van Hotel Okura Amsterdam, en zo tot tech-ondernemer.',
      'Hoe RTG ontstond: je onderneming begon op 22 mei 2022, de dag dat je oma in haar slaap overleed terwijl jij bij haar was. Je had de hele dag alles geregeld; toen je die avond in bed lag schaamde je je dat je in je eigen ogen nog niets had bereikt, ook al werkte je toen al bij Okura. Zonder na te denken pakte je je laptop en bouwde je rahul2dubai.nl, een low-budget reisbureau tussen Amsterdam en Dubai. Het liep, maar je vond het saai: je wilde echte service en meer bestemmingen. Zo werd het Rahul Travel Group, eerst puur reisbureau. Aan de keukentafel, midden in de nacht, vroeg je zwager hoe het heette en mompelde daarna "RTG"; dagen later zat RTG in je hoofd en groeide het uit tot ook een lifestyle-merk. Door de internationale onrust en oorlogen besloot je een stap terug te doen en als sous-chef bij Bloomingdale te gaan werken, 240 uur per maand, met een doel voor ogen: deze app bouwen.',
      'Je draagt dit rustig en zonder zelfmedelijden. Het gaf je je werklust, je oog voor echte gastvrijheid en je zachtheid voor wie het zwaar heeft. Deel ervan alleen als het past of als iemand ernaar vraagt, kort en warm; dring het nooit op en maak er geen verhaal van. Tegen kinderen blijf je licht en bemoedigend en houd je zware details weg.',
      // de dagcontext: Rahul denkt aan tijd, seizoen en temperatuur
      dagContext().zin + ' Weeg dat mee in adviezen (kleding, terras of binnen, dagplanning, seizoensgerechten).',
      AI_TONE[tier] || AI_TONE.rtg,
      'Je bent de frictieloze rechterhand van het lid: je wacht niet op vragen maar denkt vooruit. Signaleer zelf wat geregeld moet worden (openstaande betalingen, aanvragen die nog niet bevestigd zijn, vergeten voorbereidingen) en sluit elk antwoord af met één concreet voorstel dat het lid met een enkel "ja" kan afdoen. Betalingen gaan in het portaal met één tik (Face ID of Apple Pay), verwijs daarnaar, vraag nooit om betaalgegevens.',
      'Zegt het lid "ja" of iets vergelijkbaars, dan bevestig je kort dat het geregeld is en noem je wat je vervolgens in de gaten houdt.',
      'Je helpt het lid met reisvoorbereiding: paklijsten, documenten en visa, weer, dagplanning, restaurants en wijzigingen aan geboekte diensten. ' + taalRegel,
      `Het lid: ${persona.full} (${tier === 'rtg' ? 'RTG Pass' : tier === 'lifestyle' ? 'Lifestyle Pass' : 'Business Pass'}), lid sinds ${persona.since}.`,
      `Komende reis: ${trip.dest}, ${trip.dates} (over ${trip.days} dagen). Geboekte diensten: ${trip.items.map(i => `${i.title} [${i.label}]`).join('; ')}.`,
      openInvoices.length
        ? `Openstaande betalingen: ${openInvoices.map(i => `${i.desc} (€ ${i.netto + i.bijdrage})`).join('; ')}. Wijs daar alleen op als het relevant is.`
        : 'Er staan geen betalingen open.',
      'Verzin geen boekingen of prijzen die hierboven niet staan. Als je iets niet weet of niet kunt regelen, zeg dat eerlijk en bied aan het uit te zoeken.'
    ].join('\n');
  }

  /* Demo-antwoorden wanneer er geen Claude API-key is. */
  function cannedAnswer(q) {
    const l = q.toLowerCase().trim();
    if (/^(ja|graag|ja graag|doe maar|prima|goed|regel het|ja, regel het)\b/.test(l))
      return 'Geregeld. De paklijst staat klaar in uw reisoverzicht (lichte kleding, zwemkleding, zonnebescherming, een lichte trui voor de avond) en het dagplan voor 20 juli is ingepland: 10:00 privéboot naar Formentera, lunch aan boord, en om 21:00 uw tafel bij Sal de Mar.\n\nVolgende dat ik in de gaten houd: de bevestiging van Sal de Mar. U hoeft niets te doen.';
    if (l.includes('inpak') || l.includes('paklijst') || l.includes('koffer'))
      return 'Voor Ibiza in juli (25-31°C, zonnig):\n• Lichte kleding + zwemkleding\n• Zonnebrand en een hoed\n• Nette outfit voor Sal de Mar\n• Een lichte trui voor de avonden aan zee\n\nZal ik hier een afvinklijst van maken in uw reisoverzicht?';
    if (l.includes('visum') || l.includes('paspoort') || l.includes('document'))
      return 'Voor Ibiza (Spanje, EU) heeft u als Nederlander geen visum nodig; een geldige ID-kaart of paspoort volstaat. Ik zet uw boekingsbevestigingen alvast klaar in de app, mocht ernaar gevraagd worden.';
    if (l.includes('weer'))
      return 'Ibiza medio juli: gemiddeld 25-31°C, veel zon en warme avonden. De beste tijd voor de boot naar Formentera is vroeg in de ochtend, vóór de drukte; zal ik het vertrek op 10:00 laten aanhouden?';
    if (l.includes('plan') || l.includes('dag') || l.includes('doen'))
      return 'Voorstel voor 20 juli:\n• 10:00 privéboot naar Formentera\n• 13:00 lunch aan boord of op het strand\n• 18:00 terug, borrel bij Sunset Ibiza\n• 21:00 diner bij Sal de Mar (staat in aanvraag)\n\nZal ik de strandlunch laten reserveren?';
    if (l.includes('restaurant') || l.includes('eten') || l.includes('diner'))
      return 'Uw tafel bij Sal de Mar (19 jul, 21:00) is in aanvraag, bevestiging volgt doorgaans binnen 48 uur. Wilt u een reservelijst? Ik denk aan een strandrestaurant in Cala Jondal of een adres in Marina Botafoch, beide via ons netwerk tegen normale prijs.';
    return 'Daar zoek ik het fijne van uit en ik kom er vandaag nog op terug. Voor uw reis naar Ibiza kan ik alvast helpen met de paklijst, documenten, het weer of een dagplanning, zeg het maar.';
  }

  /* Geeft { text, lang }: met AI antwoordt Rahul direct in de taal van het
     lid; zonder AI proberen we het demo-antwoord te vertalen en anders blijft
     het Nederlands, eerlijk gelabeld met de echte taal van de tekst. */
  async function generateAiReply(tier, convo, lang) {
    lang = lang || 'nl';
    const history = convo
      .filter(m => m.from === 'member' || m.from === 'butler')
      .map(m => ({ role: m.from === 'member' ? 'user' : 'assistant', content: String(m.text).slice(0, 2000) }))
      .slice(-12);
    while (history.length && history[0].role !== 'user') history.shift();
    const last = history.length ? history[history.length - 1].content : '';
    if (anthropic && history.length && history[history.length - 1].role === 'user') {
      try {
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 1024, system: aiSystemPrompt(tier, lang), messages: history });
        const reply = r.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
        if (reply) return { text: reply, lang };
      } catch (e) { console.error('Claude-fout (butler):', e.message); }
    }
    const canned = cannedAnswer(last);
    if (lang !== 'nl' && i18n) {
      try {
        const t = await i18n.translate(canned, lang, 'nl');
        if (t && t.translated) return { text: t.text, lang };
      } catch (e) { /* val terug op Nederlands */ }
    }
    return { text: canned, lang: 'nl' };
  }

  function convOf(userId) { const md = accounts.getMemberState(userId) || {}; return md.conversation || []; }

  async function memberSays(user, text, channel, lang) {
    const md = accounts.getMemberState(user.id) || {};
    md.conversation = md.conversation || [];
    md.conversation.push({ from: 'member', text: String(text).slice(0, 1000), lang: lang || 'nl', at: new Date().toISOString(), channel });
    if (user.tier === 'rtg') {
      // Rahul (AI) antwoordt meteen, in de taal van het lid.
      const reply = await generateAiReply(user.tier, md.conversation, lang);
      md.conversation.push({ from: 'butler', text: reply.text, lang: reply.lang, at: new Date().toISOString(), channel: 'butler' });
      md.needsConcierge = false;
    } else {
      // Lifestyle/Business: een mens (concierge) reageert via de backoffice.
      md.needsConcierge = true;
    }
    md.conversation = md.conversation.slice(-120);
    accounts.saveMemberState(user.id, md);
    broadcastSync([user.tier], 'chat');
    if (user.tier !== 'rtg') sseToOffice('sync', { scope: 'concierge' });
  }

  /* Backoffice: concierge-inbox voor Lifestyle/Business-leden. */
  function conciergeInbox() {
    return accounts.conversations()
      .filter(c => c.tier === 'lifestyle' || c.tier === 'business')
      .map(c => {
        const last = c.conversation[c.conversation.length - 1] || {};
        return { userId: c.id, codename: c.codename, tier: c.tier, needsConcierge: c.needsConcierge,
          last: last.text || '', lastAt: last.at || null, lastFrom: last.from || '', messages: c.conversation };
      })
      .sort((a, b) => (b.needsConcierge - a.needsConcierge) || (new Date(b.lastAt) - new Date(a.lastAt)));
  }

  return { aiSystemPrompt, cannedAnswer, generateAiReply, convOf, memberSays, conciergeInbox };
}

module.exports = { AI_TONE, maakAi };
