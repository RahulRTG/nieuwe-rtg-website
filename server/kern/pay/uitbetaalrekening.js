/* DE REKENING WAAR EEN TERUGSTORTING HEEN GAAT: het IBAN van een lid.

   Afgesplitst van ./terug.js, dat de betaling doet. De snede ligt op het
   onderwerp en niet op de omvang: dit bestand gaat over een PERSOONSGEGEVEN en
   waar dat mag staan, en dat is een andere vraag dan hoe je geld verstuurt.

   HET IBAN STAAT IN DE IDENTITEITSKLUIS, niet in de operationele data. Een IBAN
   naast een codenaam voert die codenaam terug naar een echte naam -- dat is
   precies de reden waarom het BIG-nummer in dit huis ook in `member_state`
   woont en niet in db.data (zie CLAUDE.md). Het codenaam-ontwerp is waardeloos
   zodra er één sleutel naast ligt die naar de persoon leidt, en een
   bankrekeningnummer is zo'n sleutel.

   DE WACHTTIJD IS DE HELE BEVEILIGING, en het is nuttig om te benoemen tegen
   wie. Niet tegen een tikfout -- daar is de mod-97-toets voor. Tegen een
   OVERNAME: wie een account kaapt, zet zijn eigen IBAN erin en haalt de wallet
   leeg voordat de eigenaar iets doorheeft. Zijn hele plan hangt op snelheid.

   EN DAAROM STAAT DE WACHTTIJD OP HET WIJZIGEN EN NIET OP HET INSTELLEN. Dat is
   een correctie op de eerste versie hier, die hem op elke registratie zette --
   ook de allereerste. Dat was strenger zonder veiliger te zijn, en het is de
   moeite waard om uit te schrijven waarom.

   De aanval is het VERANDEREN van de uitbetaalbestemming op een account dat al
   saldo heeft. Een eerste registratie is die aanval niet: het account heeft dan
   net de paspoortpoort gehaald (kern/onboarding, `payGate`), en wie zich met een
   echt document heeft geïdentificeerd om vervolgens zijn eigen geld naar zijn
   eigen rekening te sturen, is niet het scenario waar we ons tegen wapenen.
   Iedereen bij zijn eerste terugstorting een dag laten wachten, hindert dus
   alleen eerlijke mensen.

   Een wijziging is het wel, altijd, en daar staat de klok dan ook: 24 uur, en
   elke volgende wijziging start hem opnieuw. Zo is een terugstorting voor wie
   niets verandert onmiddellijk, en kost een overname de aanvaller een dag
   waarin de eigenaar bericht krijgt en kan ingrijpen.

   Krijgt de gedeelde ctx van kern/pay/index.js. */
'use strict';

const WACHT_UUR = 24;

/* IBAN-controle met de echte mod-97-toets. Een formaatcontrole alleen is niet
   genoeg: 'NL91ABNA0417164300' en 'NL91ABNA0417164301' zien er allebei uit als
   een IBAN, en maar een ervan bestaat. De controlecijfers zitten er juist in om
   een tikfout te vangen voordat het geld bij een vreemde staat. */
function ibanGeldig(ruw) {
  const s = String(ruw || '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(s)) return null;
  const her = s.slice(4) + s.slice(0, 4);
  let rest = 0;
  for (const teken of her) {
    const w = /[0-9]/.test(teken) ? teken : String(teken.charCodeAt(0) - 55);
    for (const cijfer of w) rest = (rest * 10 + Number(cijfer)) % 97;
  }
  return rest === 1 ? s : null;
}
/* Een IBAN hoort nergens heen te lekken waar hij niet nodig is -- ook niet naar
   het eigen scherm van het lid, want daar kijkt in een café iemand over je
   schouder mee. Genoeg om te herkennen, te weinig om over te schrijven. */
const kort = s => String(s).slice(0, 2) + ' ••• ' + String(s).slice(-4);

module.exports = (ctx) => {
  /* De klok komt uit de ctx van de paylaag en wordt hier niet opnieuw aan het
     besturingssysteem gevraagd: de wachttijd van 24 uur op een gewijzigd IBAN is
     de kern van deze module, en een wachttijd die niet vooruit te spoelen is,
     is ook niet te beproeven. */
  const { schoon, accounts, nu } = ctx;

  function dossier(userId) {
    try { return accounts.getMemberState(userId) || {}; } catch (e) { return null; }
  }
  function ibanVan(userId) {
    const md = dossier(userId);
    return (md && md.uitbetaal && md.uitbetaal.iban) ? md.uitbetaal : null;
  }
  const bruikbaar = u => !!(u && (u.bevestigd || (u.bruikbaarVanaf || 0) <= nu()));
  const publiek = u => u ? { iban: kort(u.iban), naam: u.naam, sinds: u.sinds,
    bruikbaarVanaf: u.bruikbaarVanaf || null, bevestigd: !!u.bevestigd, bruikbaar: bruikbaar(u) } : null;

  function rekeningZet({ userId, iban, naam }) {
    if (!userId) return { status: 403, error: 'Hiervoor is een echt account nodig.' };
    const geldig = ibanGeldig(iban);
    if (!geldig) return { status: 400, error: 'Dit lijkt geen geldig IBAN. Controleer het nummer.' };
    const opNaam = schoon(naam, 70);
    if (!opNaam) return { status: 400, error: 'Op wiens naam staat de rekening?' };
    const md = dossier(userId);
    if (md === null) return { status: 500, error: 'Uw dossier kon niet worden gelezen.' };
    const oud = (md.uitbetaal && md.uitbetaal.iban) || null;
    if (oud === geldig) return { ok: true, ongewijzigd: true, rekening: publiek(md.uitbetaal) };
    /* De eerste rekening kan meteen ontvangen; een WIJZIGING wacht. Zie de kop
       voor waarom die twee verschillen. Elke volgende wijziging start de klok
       opnieuw, ook een wijziging terug naar een IBAN dat er eerder stond -- zou
       een oud IBAN meteen weer bruikbaar zijn, dan is de wachttijd te omzeilen
       door er een dag lang iets anders in te zetten en hem daarna terug te
       zetten. */
    const wijziging = !!oud;
    md.uitbetaal = { iban: geldig, naam: opNaam, sinds: nu(),
      bruikbaarVanaf: wijziging ? nu() + WACHT_UUR * 3600000 : nu(),
      bevestigd: false, vorige: oud ? kort(oud) : null };
    try { accounts.saveMemberState(userId, md); } catch (e) { return { status: 500, error: 'Opslaan lukte niet.' }; }
    return { ok: true, rekening: publiek(md.uitbetaal), wijziging,
      uitleg: wijziging
        ? 'U heeft de rekening gewijzigd. Een gewijzigde rekening kan na ' + WACHT_UUR + ' uur ontvangen; dat is er om te voorkomen dat iemand die uw account overneemt uw saldo naar zijn eigen rekening stuurt.'
        : 'Deze rekening kan meteen ontvangen. Wijzigt u hem later, dan geldt er een wachttijd van ' + WACHT_UUR + ' uur.' };
  }

  /* DE SNELLE WEG, EN DIE IS ER NOG NIET. Bevestigt de betaaldienst bij een
     oplading welk IBAN er betaalde, dan is dat IBAN bewezen van dit lid en
     vervalt de wachttijd -- de gebruiker die zijn eigen geld terughaalt naar de
     rekening waarvandaan het kwam, hoeft dan nergens op te wachten.

     Deze functie staat klaar en werkt; er is alleen nog niets dat hem aanroept,
     want server/betaal.js geeft bij een oplading geen betaler-IBAN terug. Dat
     staat hier als functie MET deze uitleg en niet als stilzwijgende leegte:
     wie die naad ooit uitbreidt, vindt het haakje op de plek waar het hoort. */
  function ibanBevestigd({ userId, iban }) {
    const geldig = ibanGeldig(iban);
    const md = dossier(userId);
    if (!geldig || !md || !md.uitbetaal || md.uitbetaal.iban !== geldig) return { ok: false };
    md.uitbetaal.bevestigd = true;
    md.uitbetaal.bruikbaarVanaf = nu();
    try { accounts.saveMemberState(userId, md); } catch (e) { return { ok: false }; }
    return { ok: true };
  }

  return { rekeningZet, ibanBevestigd, ibanVan, bruikbaar, publiek, kort, ibanGeldig, WACHT_UUR };
};
module.exports.ibanGeldig = ibanGeldig;
/* De wachttijd hoort bij de REDENERING (een overname hangt op snelheid) en niet
   bij het lid: ./zaakrekening.js leest hem hier, zodat er geen tweede wachttijd
   ontstaat die er stilletjes naast gaat lopen. */
module.exports.WACHT_UUR = WACHT_UUR;
