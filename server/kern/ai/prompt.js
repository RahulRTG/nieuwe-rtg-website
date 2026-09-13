/* AI (deelmodule): de promptlaag: de system prompt per pas (toon,
   toegangs- en AI-regels, dagcontext) en de vaste regelantwoorden zonder
   API-key. Krijgt de gedeelde context een keer bij het opstarten vanuit
   kern/ai.js. Het vaste karakterportret van Rahul (statische tekst) woont in
   ./karakter; hier wordt het aangevuld met het register en de dagcontext. */
const RAHUL_KARAKTER = require('./karakter');
const { TAALREGELS } = require('../rahul/taal');
const { TWIJFELREGELS } = require('../rahul/twijfel');
const { cannedAnswer } = require('./demoantwoorden');
module.exports = (ctx) => {
  const { db, PERSONAS, AI_TONE, naamEn, dagContext, stemmingVoor, geloofRegel, ledenInhoudVan, accounts } = ctx;

  /* WIE IS DIT LID -- en dat was tot 13 september 2026 de demo-persona.

     De regel onderaan luidde `const persona = PERSONAS[tier]`, en die tabel is
     de DEMO-rij per pas. Elk echt RTG-Pass-lid werd daarmee aan het model
     voorgesteld als "Amberen Vos, lid sinds Maart 2026", ongeacht wie hij was.
     Precies dezelfde fout als de demo-reis en de demo-facturen twee regels
     hoger, in hetzelfde bestand, met dezelfde oorzaak: db.data/PERSONAS is de
     demo-inhoud en ledenInhoudVan kent het onderscheid. Bij de reis is hij
     gerepareerd, bij de identiteit bleef hij staan -- en hij is onzichtbaar,
     want de context staat op geen enkel scherm. Gevonden door de meting van
     scripts/aicontext.js: PERSONAS is op de PAS gesleuteld en ledenInhoudVan op
     het LID, en juist de regel die het lid NOEMT gebruikte de eerste.

     TWEE VELDEN, OP NAAM OPGEBOUWD, NOOIT EEN SPREAD. publicUser() draagt ook
     `full`, en dat is de ECHTE NAAM uit de kluis. Deze tekst gaat woordelijk
     naar een modelaanbieder; een spread zou het hele privacy-ontwerp van dit
     huis in een keer over de streep zetten. Zelfde regel als kern/
     ledenbalie-inzage.js: veld voor veld, zodat een kolom die er morgen bij
     komt hier niet vanzelf meelift. */
  function eigenProfiel(key) {
    const m = /^user-(\d+)$/.exec(String(key || ''));
    if (!m || !accounts || !accounts.getUserById) return null;
    try {
      const u = accounts.getUserById(Number(m[1]));
      if (!u) return null;
      const p = accounts.publicUser(u) || {};
      return { codename: p.codename || null, since: p.since || null };
    } catch (e) { return null; }
  }

  function aiSystemPrompt(tier, lang, key) {
    const persona = PERSONAS[tier];
    /* Een echt account leest zichzelf; een demo-sessie houdt de persona. */
    const eigen = eigenProfiel(key) || {};
    /* DE REIS EN DE FACTUREN VAN DIT LID, NIET DIE VAN DE DEMO.

       Hier stond `db.data.trip` en `db.data.invoices`. Dat is de seed-inhoud:
       de demo-reis naar Ibiza en de vier demo-facturen. Rahul kreeg die dus in
       elke system prompt mee als "de komende reis van het lid", ook tegen
       iemand die zich net had aangemeld en nog nergens heen ging. Hij vertelde
       vervolgens overtuigd over een boot naar Formentera die niemand had
       geboekt -- precies wat de merkregel verbiedt.

       ledenInhoudVan (kern/lid.js) kent de regel wel: een echt account leest
       zijn eigen dossier, een demo-sessie de demo-inhoud. */
    const md = ledenInhoudVan ? ledenInhoudVan(key) : db.data;
    const trip = md && md.trip ? md.trip : null;
    // de omgangsvormen: hoe Rahul zich tot dit lid verhoudt (alleen bij
    // volwassen leden met een bekend geslacht; anders een lege string)
    const omgang = require('../rahul').rahulOmgangVoor(key);
    const openInvoices = ((md && md.invoices) || []).filter(i => i.status === 'open');
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
      `Het lid: ${eigen.codename || persona.codename || persona.name} (${tier === 'rtg' ? 'RTG Pass' : tier === 'lifestyle' ? 'Lifestyle Pass' : 'Business Pass'}), lid sinds ${eigen.since || persona.since}.`,
      /* GEEN REIS IS OOK EEN ANTWOORD. Een leeg reisdossier hoort Rahul te
         weten, niet in te vullen: hij vraagt waar het lid heen wil en wat er
         moet gebeuren, en verzint geen bestemming om iets te zeggen te hebben. */
      trip
        ? `Komende reis: ${trip.dest}, ${trip.dates} (over ${trip.days} dagen). Geboekte diensten: ${(trip.items || []).map(i => `${i.title} [${i.label}]`).join('; ')}.`
        : 'Dit lid heeft nog GEEN reis in het systeem staan. Noem geen bestemming, datum of boeking: die zijn er niet. Vraag waar het lid heen wil en wanneer, en bied aan het vanaf daar te regelen.',
      openInvoices.length
        ? `Openstaande betalingen: ${openInvoices.map(i => `${i.desc} (€ ${i.netto + i.bijdrage})`).join('; ')}. Wijs daar alleen op als het relevant is.`
        : 'Er staan geen betalingen open.',
      'Verzin geen boekingen of prijzen die hierboven niet staan. Als je iets niet weet of niet kunt regelen, zeg dat eerlijk en bied aan het uit te zoeken.'
    ].join('\n');
  }

  return { aiSystemPrompt, cannedAnswer };
};
