/* De persoonlijke AI-laag: de systeemprompt per pas ("de Butler" voor RTG),
   demo-antwoorden zonder API-sleutel, het echte Claude-antwoord, en de
   doorlopende conversatie in de app. RTG wordt door de AI beantwoord; Lifestyle
   en Business gaan naar de menselijke concierge.

   AI_TONE is pure data; de rest draagt state (db, accounts, de Claude-client en
   de realtime-helpers) en komt uit maakAi(state). */

const AI_TONE = {
  rtg: 'Je bent "de Butler": rustig, ingetogen, old money kalmte. Je tutoyeert niet, je vousvoyeert.',
  lifestyle: 'Je werkt naast de persoonlijke concierge: warm, voorkomend en persoonlijk. U-vorm.',
  business: 'Je bent een uitvoerende AI voor een zakelijk lid: kort, precies, to the point. U-vorm, geen overbodige woorden.'
};

const { naamEn } = require('../talen');

function maakAi({ db, PERSONAS, anthropic, accounts, broadcastSync, sseToOffice, i18n }) {
  function aiSystemPrompt(tier, lang) {
    const persona = PERSONAS[tier];
    const trip = db.data.trip;
    const openInvoices = db.data.invoices.filter(i => i.status === 'open');
    // De Butler spreekt de taal van het lid (wereldtalen via de Boardroom).
    const taalRegel = (!lang || lang === 'nl')
      ? 'Antwoord in het Nederlands, beknopt (maximaal ~120 woorden), zonder opsmuk.'
      : 'The member reads and writes in ' + naamEn(lang) + '. Answer ONLY in ' + naamEn(lang) + ', concise (max ~120 words), no frills. Keep the same courteous, formal register.';
    return [
      'Je bent de exclusieve persoonlijke reis-AI van Rahul Travel Group (RTG), een membership-reisclub die tegen inkoopprijs boekt en 30% van elke ledenbijdrage aan de RTFoundation doneert.',
      AI_TONE[tier] || AI_TONE.rtg,
      'Je bent de frictieloze vriend van het lid: je wacht niet op vragen maar denkt vooruit. Signaleer zelf wat geregeld moet worden (openstaande betalingen, aanvragen die nog niet bevestigd zijn, vergeten voorbereidingen) en sluit elk antwoord af met één concreet voorstel dat het lid met een enkel "ja" kan afdoen. Betalingen gaan in het portaal met één tik (Face ID of Apple Pay), verwijs daarnaar, vraag nooit om betaalgegevens.',
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

  /* Geeft { text, lang }: met AI antwoordt de Butler direct in de taal van het
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
      // De Butler (AI) antwoordt meteen, in de taal van het lid.
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
