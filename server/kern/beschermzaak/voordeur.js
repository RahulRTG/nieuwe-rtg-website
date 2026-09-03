/* ============================================================================
   DE VOORDEUR -- de enige plek waar een beschermzaak ontstaat zonder inlog.

   HDI.md par. 7 regel 4. Tot hier ontstond elke zaak doordat een MEDEWERKER er
   een aanmaakte; wie geen account had, kon niets in gang zetten. Dat is de
   omkering die dit bestand maakt.

   DE GEVAARLIJKSTE FOUT DIE HIER TE MAKEN IS, en daarom staat hij bovenaan:
   een knop bouwen die eruitziet alsof er hulp komt. Er zit hier NIEMAND klaar.
   Wat via deze deur binnenkomt, wordt gelezen door een medewerker van de
   afdeling in de stad die de mens kiest, tijdens werktijd. Dat is precies wat
   kern/veiligheid/alarm.js over zichzelf zegt ("dit is geen alarmcentrale") en
   om dezelfde reden: wie denkt dat hij geholpen wordt en het niet is, is
   slechter af dan wie het weet. Elk antwoord van deze module draagt daarom het
   veld `nietsKlaar` met die mededeling erin, en het scherm zet hem bovenaan en
   niet onderaan.

   WAT ER NIET WORDT GEVRAAGD: geen naam, geen BSN, geen geboortedatum, geen
   adres, geen telefoonnummer. Dat is geen zuinigheid maar de klasse zelf --
   ./klasse.js WEIGERT die velden, en deze deur kan er dus geen enkele van
   doorlaten, ook niet als iemand hem later "even handig" zou willen maken.

   EN DUS BELT RTG NIET TERUG. Dat is de moeilijkste keuze in dit bestand en
   hij is met opzet zo: een telefoonnummer dat wij bewaren is een telefoon
   waarop wij bellen, en op precies het toestel waar de mens net heeft gezegd
   dat er iemand kan meekijken, is dat de gevaarlijkste handeling die er is.
   De mens houdt zijn eigen code en komt terug. Dat is trager, en het is het
   enige wat wij kunnen waarmaken.

   DE CODE IS GEEN WACHTWOORD. Wie de code heeft, kan de stand zien. Daarom
   geeft ./stand() het minimum: de stand, en of er iets is klaargezet. Nooit wat
   er is opgeschreven, nooit de aanleiding, nooit een naam van een organisatie.
   Iemand die de telefoon van een ander doorzoekt en de code vindt, hoort daar
   niets uit te kunnen aflezen.
   ========================================================================== */
'use strict';

const K = require('./klasse');

/* Wat de mens zelf zegt te mogen bewaren. Twee standen en niet vijf: dit is een
   vraag aan iemand die het op dat moment zwaar heeft, en een keuzemenu is dan
   geen zorgvuldigheid maar een drempel. */
const BEWAREN = {
  alleen_dat: 'Alleen dat ik hulp zocht, en verder niets.',
  ook_wat: 'Ook kort wat er speelt, zodat iemand het meteen begrijpt.'
};

const NIETS_KLAAR = 'Hier zit niemand klaar. Wat u achterlaat, leest een medewerker van de ' +
  'RTFoundation in de stad die u kiest, tijdens werktijd. Moet er NU iemand komen: bel 112. ' +
  'Wilt u nu iemand spreken: Veilig Thuis, 0800-2000, gratis en dag en nacht.';

module.exports = (ctx, eigen) => {
  const { nu, rid, schoon, S, audit, save } = ctx;
  const { zaken } = eigen;

  /* Alleen steden die een zaak ook echt kunnen oppakken. Een deur die uitkomt
     bij een afdeling die de module uit heeft staan, is een deur naar niemand --
     en dat merkt de mens pas als hij al iets heeft verteld. */
  const open = () => S().steden.filter(s => s.status === 'actief' && (s.vlaggen || []).includes('individual_cases'));

  function steden() {
    return { ok: true, nietsKlaar: NIETS_KLAAR,
      steden: open().map(s => ({ id: s.id, naam: s.naam })) };
  }

  function start(b) {
    b = b || {};
    /* Dezelfde weigering als aan de kantoorkant, en juist hier hoort hij: een
       goedbedoelend formulier dat een telefoonnummer meestuurt, zou het stil
       bewaren als deze regel er niet stond. */
    const stuk = K.keurInvoer(b); if (stuk) return stuk;

    const stad = open().find(s => s.id === String(b.stad || ''));
    if (!stad) return { status: 400, error: 'Kies een plaats uit de lijst. Alleen daar kan iemand dit oppakken.' };

    if (typeof b.nuVeilig !== 'boolean') {
      return { status: 400, error: 'Bent u op dit moment veilig? Ja of nee. Dit is de eerste vraag en niet de laatste.' };
    }
    if (typeof b.kanMeekijken !== 'boolean') {
      return { status: 400, error: 'Kan iemand meekijken op dit toestel? Ja of nee. Hier hangt van af wat wij u wel en niet toesturen.' };
    }
    const bewaren = String(b.bewaren || '');
    if (!BEWAREN[bewaren]) {
      return { status: 400, error: 'Wat mogen wij bewaren? Kies "alleen_dat" of "ook_wat".' };
    }
    const aanleiding = K.AANLEIDINGEN.includes(String(b.aanleiding || '')) ? String(b.aanleiding) : 'anders';

    /* WAT ER WORDT BEWAARD, HANGT AAN WAT DE MENS ZEI. Niet aan een instelling
       en niet aan wat handig is voor de afdeling: koos hij "alleen dat", dan
       staat er ook alleen dat -- de omschrijving wordt niet stiekem alsnog
       meegenomen "voor de context". */
    const wat = bewaren === 'ook_wat'
      ? (schoon(b.wat, 300) || 'Via de voordeur, zonder toelichting.')
      : 'Via de voordeur. Deze mens koos ervoor niets toe te lichten.';

    if (zaken().length >= 100000) return { status: 400, error: 'Het register zit vol.' };

    const code = ctx.code('RTFB');
    const z = { id: rid(), stad: stad.id, codenaam: 'BZ-' + ctx.code('X').split('-')[1].slice(0, 5),
      aanleiding, wat, stand: 'veiligheid',
      /* De veiligheidsvraag is HIER al beantwoord, en door de mens zelf. Dat
         staat er ook zo bij: een medewerker hoort te zien dat dit geen
         inschatting van een collega is maar wat de mens zelf zei. */
      veiligheid: { nuVeilig: b.nuVeilig, kanMeekijken: b.kanMeekijken, hoeContact: null,
        door: 'de mens zelf, via de voordeur', at: nu() },
      viaDeur: true, deurCode: code, bewaren,
      toestemming: null, ingetrokken: null, overdrachten: [], stappen: [],
      gesloten: null, bewaarTot: null, bewaarWaarom: null,
      door: 'voordeur', at: nu(), bijgewerkt: nu() };
    zaken().push(z);
    audit('voordeur', 'beschermzaak.voordeur', z.codenaam,
      aanleiding + (b.nuVeilig ? '' : ' | zegt NIET veilig te zijn'));
    save();

    return { ok: true, code, nietsKlaar: NIETS_KLAAR,
      nuVeilig: b.nuVeilig, kanMeekijken: b.kanMeekijken,
      /* De enige plek waar de code te zien is. Er gaat geen mail en geen sms
         achteraan: wij weten niet wie er meeleest. */
      melding: b.kanMeekijken
        ? 'Schrijf deze code op een plek waar de ander niet kijkt, of onthoud hem. Wij sturen hem nergens heen.'
        : 'Bewaar deze code. Hiermee kunt u terugkijken wat er is gedaan, en hem ook weer intrekken. Wij sturen hem nergens heen.' };
  }

  const opCode = c => zaken().find(z => z.deurCode && z.deurCode === String(c || '').trim().toUpperCase()) || null;

  /* DE MAGERSTE VORM DIE NOG NUTTIG IS. Zie de kop: de code is geen wachtwoord. */
  function stand(code) {
    const z = opCode(code);
    if (!z) return { status: 404, error: 'Deze code kennen wij niet. Kijk hem na, of begin opnieuw.' };
    return { ok: true, nietsKlaar: NIETS_KLAAR,
      stand: z.stand,
      ingetrokken: !!z.deurIngetrokken,
      /* "Er is iets klaargezet" en niet WAT. Wie de code vindt, hoort er niets
         uit te kunnen aflezen (LIFE.md: klaarzetten, bevestigen doet de mens). */
      klaargezet: (z.stappen || []).length > 0 || (z.overdrachten || []).length > 0,
      uitleg: z.deurIngetrokken
        ? 'U heeft dit ingetrokken. Er gebeurt niets meer.'
        : (z.stand === 'veiligheid'
          ? 'Uw bericht staat klaar en is nog niet opgepakt.'
          : 'Er wordt aan gewerkt. Wat er is klaargezet, hoort u van de medewerker zelf -- niet van dit scherm.') };
  }

  /* WIE JA ZEI, MAG NEE ZEGGEN. Zelfde recht als bij de hulpvraag
     (routes/rtfos/doelgroepen.js), en om dezelfde reden: een recht waarvoor je
     moet bellen naar de organisatie die je juist wilde stoppen, is geen recht.

     DIT WIST NIETS, en dat is geen slordigheid maar de regel uit ./keten.js:
     niemand haalt hier een dossier weg. Wat het wel doet is de zaak STILZETTEN
     met de mededeling erbij -- de afdeling ziet dat deze mens het heeft
     ingetrokken, en dat is iets anders dan een zaak die stil verdwijnt en
     waarvan niemand meer weet dat hij bestond. */
  function trekIn(code, reden) {
    const z = opCode(code);
    if (!z) return { status: 404, error: 'Deze code kennen wij niet.' };
    if (z.deurIngetrokken) return { ok: true, melding: 'Dit was al ingetrokken. Er gebeurt niets meer.' };
    z.deurIngetrokken = { at: nu(), reden: schoon(reden, 200) || null };
    z.ingetrokken = z.deurIngetrokken;
    if (z.stand !== 'gesloten') z.stand = 'veiligheid';
    z.bijgewerkt = nu();
    audit('voordeur', 'beschermzaak.voordeur-ingetrokken', z.codenaam, z.deurIngetrokken.reden || '');
    save();
    return { ok: true, melding: 'Ingetrokken. Er gaat niets meer gebeuren met wat u heeft verteld.' };
  }

  return { steden, start, stand, trekIn, BEWAREN, NIETS_KLAAR };
};
module.exports.BEWAREN = BEWAREN;
