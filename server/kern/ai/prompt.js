/* AI (deelmodule): de promptlaag: de system prompt per pas (toon,
   toegangs- en AI-regels, dagcontext) en de vaste demo-antwoorden zonder
   API-key. Krijgt de gedeelde context een keer bij het opstarten vanuit
   kern/ai.js. Het vaste karakterportret van Rahul (statische tekst) woont in
   ./karakter; hier wordt het aangevuld met het register en de dagcontext. */
const RAHUL_KARAKTER = require('./karakter');
module.exports = (ctx) => {
  const { db, PERSONAS, AI_TONE, naamEn, dagContext } = ctx;
  function aiSystemPrompt(tier, lang) {
    const persona = PERSONAS[tier];
    const trip = db.data.trip;
    const openInvoices = db.data.invoices.filter(i => i.status === 'open');
    // Rahul spreekt de taal van het lid (wereldtalen via de Boardroom).
    const taalRegel = (!lang || lang === 'nl')
      ? 'Antwoord in het Nederlands, beknopt (maximaal ~120 woorden), zonder opsmuk.'
      : 'The member reads and writes in ' + naamEn(lang) + '. Answer ONLY in ' + naamEn(lang) + ', concise (max ~120 words), no frills. Keep the same courteous, formal register.';
    return [
      // Het vaste karakterportret van Rahul (identiteit, karakter, herkomst en
      // vorming) - statische tekst uit ./karakter, in elke prompt gelijk.
      ...RAHUL_KARAKTER,
      // de AI-regie: aanvullingen die de boardroom live kan bijstellen
      ...(db.data.rahulProfiel && (db.data.rahulProfiel.karakter || db.data.rahulProfiel.verhaal)
        ? ['Aanvullingen van de RTG-boardroom op je karakter en verhaal: ' +
            [db.data.rahulProfiel.karakter, db.data.rahulProfiel.verhaal].filter(Boolean).join(' ')]
        : []),
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
  return { aiSystemPrompt, cannedAnswer };
};
