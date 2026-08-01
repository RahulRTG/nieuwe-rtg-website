/* AI (deelmodule): de promptlaag: de system prompt per pas (toon,
   toegangs- en AI-regels, dagcontext) en de vaste demo-antwoorden zonder
   API-key. Krijgt de gedeelde context een keer bij het opstarten vanuit
   kern/ai.js. Het vaste karakterportret van Rahul (statische tekst) woont in
   ./karakter; hier wordt het aangevuld met het register en de dagcontext. */
const RAHUL_KARAKTER = require('./karakter');
const { TAALREGELS } = require('../rahul/taal');
const { TWIJFELREGELS } = require('../rahul/twijfel');
module.exports = (ctx) => {
  const { db, PERSONAS, AI_TONE, naamEn, dagContext, stemmingVoor, geloofRegel } = ctx;
  function aiSystemPrompt(tier, lang, key) {
    const persona = PERSONAS[tier];
    const trip = db.data.trip;
    // de omgangsvormen: hoe Rahul zich tot dit lid verhoudt (alleen bij
    // volwassen leden met een bekend geslacht; anders een lege string)
    const omgang = require('../rahul').rahulOmgangVoor(key);
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
      // Geen AI-taal (kern/rahul/taal.js): de regels hier, en een schrobber
      // over de uitvoer, want een prompt is een verzoek en geen garantie.
      ...TAALREGELS,
      // Bij twijfel doet hij niets en vraagt hij door (kern/rahul/twijfel.js).
      // Staat ook als harde poort in de doe-lus; hier voor het gewone gesprek.
      ...TWIJFELREGELS,
      // De bui van vandaag. Raakt alleen de toon; valt weg bij een kind, op de
      // werkvloer en zodra het ergens over gaat (kern/rahul/stemming.js).
      ...(stemmingVoor ? [stemmingVoor({ kind: false, werk: false })].filter(Boolean) : []),
      // Wat het lid zelf over geloof heeft aangegeven, of juist niet.
      ...(geloofRegel ? [geloofRegel(key)].filter(Boolean) : []),
      ...(omgang ? [omgang] : []),
      'Je bent de frictieloze rechterhand van het lid: je wacht niet op vragen maar denkt vooruit. Signaleer zelf wat geregeld moet worden (openstaande betalingen, aanvragen die nog niet bevestigd zijn, vergeten voorbereidingen) en sluit elk antwoord af met één concreet voorstel dat het lid met een enkel "ja" kan afdoen. Betalingen gaan in het portaal met één tik (Face ID of Apple Pay), verwijs daarnaar, vraag nooit om betaalgegevens.',
      /* HIER STOND EEN INSTRUCTIE OM TE LIEGEN.

         Er stond letterlijk: 'dan bevestig je kort dat het geregeld is'. Op een
         kale "ja" gebeurt er niets -- de prompt is een gesprek, geen uitvoering
         -- dus dit droeg Rahul op te melden dat iets verwerkt was terwijl er
         geen boeking, geen betaling en geen bericht de deur uit ging. Dat is
         precies wat de merkregel verbiedt: nooit claimen dat een boeking
         daadwerkelijk verwerkt is. Een lid dat daarop vertrouwt staat straks
         voor een gesloten deur, en het is onze zin die hem daar bracht.

         Wat blijft: een "ja" hoort een KORT en CONCREET vervolg te krijgen.
         Alleen niet de mededeling dat het al klaar is. */
      'Zegt het lid "ja" of iets vergelijkbaars, dan bevestig je kort wat je NU in gang zet en waar het daarna ligt. Zeg nooit dat iets al geregeld, geboekt, bevestigd of betaald is: alleen wat je zelf hebt uitgevoerd en teruggekregen mag je als gedaan melden. Alles wat bij een mens, een partner of een betaling ligt, noem je als doorgezet, met wie of wat het oppakt en wanneer het lid iets hoort.',
      'Je helpt het lid met reisvoorbereiding: paklijsten, documenten en visa, weer, dagplanning, restaurants en wijzigingen aan geboekte diensten. ' + taalRegel,
      /* De CODENAAM, niet de volledige naam. Klantdata draait in dit huis op
         codenamen; de echte naam ligt in de gescheiden kluis. Deze regel gaat
         woordelijk naar de modelaanbieder, dus dit is precies de plek waar dat
         ontwerp telt. /api/fluister doet het aan de ledenkant al goed
         (routes/member/persoonlijk.js geeft liveCodename mee); hier stond nog
         persona.full. Dezelfde tabel draagt de codenaam al. */
      `Het lid: ${persona.codename || persona.name} (${tier === 'rtg' ? 'RTG Pass' : tier === 'lifestyle' ? 'Lifestyle Pass' : 'Business Pass'}), lid sinds ${persona.since}.`,
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
    /* DIT ANTWOORD BEGON MET "GEREGELD." EN DAT WAS NIET WAAR.

       Het gaat uit zodra een lid ja zegt op een aanbod ("ja", "graag", "doe
       maar", "regel het") en het beweerde dat de paklijst klaarstond en het
       dagplan was INGEPLAND, tot en met een boot van 10:00 en een tafel om
       21:00. Er wordt hier niets geboekt: dit is het vaste antwoord voor een
       installatie zonder API-sleutel, en dat is elke demo en de hele suite.

       De merkregel is dat de AI nooit bevestigt dat iets geregeld is. De prompt
       draagt die regel sinds de vorige ronde, en juist dit antwoord ontsnapte:
       de toets die erop let filtert regels die met een quote beginnen, en deze
       begint met `return`. De grendel stond er dus, en keek langs de enige
       tekst die in de praktijk verstuurd wordt.

       Nu zegt hij wat er echt gebeurt: het staat als voorstel klaar, RTG vraagt
       het aan, en niets is bevestigd tot de partner ja zegt. */
    if (/^(ja|graag|ja graag|doe maar|prima|goed|regel het|ja, regel het)\b/.test(l))
      return 'Ik zet het voor u in gang. De paklijst staat als voorstel in uw reisoverzicht, en voor 20 juli leg ik dit voor: 10:00 privéboot naar Formentera, lunch aan boord, en om 21:00 een tafel bij Sal de Mar.\n\nNog niets is bevestigd: de boot en de tafel gaan als aanvraag naar de partners en ik laat het u weten zodra zij ja zeggen. Wilt u dat ik het zo aanvraag?';
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
