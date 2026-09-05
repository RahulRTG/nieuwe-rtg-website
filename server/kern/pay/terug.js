/* DE TERUGSTORTING: het saldo van een lid terug naar zijn eigen rekening.

   Dit is de handeling waarvoor het besluit WALLET_SALDO van soort moest wisselen
   (zie kern/bevoegdheid/lijst.js). Saldo dat op verzoek tegen de nominale waarde
   wordt terugbetaald aan de houder, is elektronisch geld. Deze module doet daarom
   niets zonder dat de bevoegdheid LID_UITBETALING open staat -- over de
   partnerrail is de partner bevoegd, over de eigen rails moet RTG een vergunning
   als elektronischgeldinstelling hebben vastgelegd.

   SNEL, VEILIG EN EFFICIENT zijn drie eisen die elkaar tegenspreken, dus staat
   hier per stuk wat de keuze is.

   SNEL. De afboeking is onmiddellijk: het lid ziet zijn saldo meteen dalen en
   wacht nergens op. De SEPA-kant is niet onmiddellijk en kan dat ook niet zijn;
   die gaat de opdrachtenrij in (kern/betaalopdracht/), die hem met DEZELFDE
   idempotentiesleutel blijft aanbieden tot hij aankomt. Het antwoord zegt daarom
   "staat klaar om verstuurd te worden" en niet "gelukt" -- dat is wat we
   werkelijk weten, en het is dezelfde les als bij de partneruitbetaling in
   ./kassa.js.

   VEILIG. De echte bedreiging is niet een tikfout maar een OVERNAME: wie een
   account kaapt, zet zijn eigen IBAN erin en haalt de wallet leeg. Wat daar
   tegenover staat -- de kluis, de mod-97-toets en de wachttijd op een nieuwe
   rekening -- woont in ./uitbetaalrekening.js, met de redenering erbij. Hier
   staat de derde grendel: het bedrag gaat langs de waardepoort. Alleen wat
   BESCHIKBAAR is (dus niet wat gereserveerd of geoormerkt staat) en alleen uit
   een klasse die uitbetaalbaar is. Een werkgeversbudget komt er nooit doorheen,
   en dat hoort ook niet: dat is een verstrekking en geen tegoed.

   EFFICIENT. Er komen geen kosten bij: een boeking in het eigen grootboek plus
   een opdracht op de bestaande rij. Er wordt met opzet NIET gebatcht -- een lid
   dat zijn geld terugvraagt en te horen krijgt dat het morgenochtend in een
   verzamelrun meegaat, heeft geen snelle terugstorting.

   Krijgt de gedeelde ctx van kern/pay/index.js. */
'use strict';

const MIN_CENTEN = 100;   // onder een euro terugstorten kost meer dan het opbrengt

module.exports = (ctx) => {
  /* De tijd uit de ctx van de paylaag: de wachttijd op een gewijzigd IBAN is een
     beveiligingsmaatregel, en een maatregel die je niet kunt vooruitspoelen kun
     je ook niet beproeven. */
  const { rekLid, saldoVan, metIdem, boek, boekAsync, grootboek, waarde, opdrachten,
    seintje, nu, economischeBoekingEenmaal, geldModus } = ctx;
  const rekening = require('./uitbetaalrekening')(ctx);
  const boekTerugEenmaal = require('../betaalopdracht/terugboeking');

  /* De bevoegdheid komt uit kern/bevoegdheid, en die laag wordt NA pay gemount
     (kernlaag4b). Late binding dus, zoals de bankdekking en de geldgrens. Niet
     gekoppeld betekent hier NIET "dan maar toestaan": zonder bevoegdheidslaag
     weten we niet of dit mag, en dan gebeurt het niet. Dat is de enige veilige
     leegstand -- dezelfde regel die kern/bevoegdheid/index.js zelf hanteert voor
     een lege vergunningenlijst. */
  let magVan = null;
  function koppelBevoegdTerug(fn) { magVan = typeof fn === 'function' ? fn : null; }
  function bevoegdheid() {
    if (!magVan) return { mag: false, reden: 'geen',
      uitleg: 'De bevoegdhedenlaag draait hier niet, dus kan niet worden vastgesteld dat dit mag.' };
    try { return magVan('LID_UITBETALING'); }
    catch (e) { return { mag: false, reden: 'geen', uitleg: 'De bevoegdheid kon niet worden vastgesteld.' }; }
  }

  /* ---------- wat kan er nu? ----------
     Eén antwoord dat het scherm compleet vult, inclusief de redenen waarom het
     nog niet kan. Een knop die uitgegrijsd is zonder te zeggen waarom, stuurt
     iemand naar de helpdesk -- en bij geld belt hij niet, hij vertrouwt het
     niet meer. */
  function terugstortenStand({ codenaam, userId }) {
    const rek = rekLid(codenaam);
    const saldo = saldoVan(rek);
    const vrij = waarde ? waarde.beschikbaar(rek, saldo) : saldo;
    const b = bevoegdheid();
    const u = userId ? rekening.ibanVan(userId) : null;
    const blokkades = [];
    /* Twee soorten "kan niet", en het scherm hoort ze uit elkaar te houden. Een
       ontbrekende bevoegdheid is een toestand die kan veranderen; de STAND
       `gesloten` is een keuze van RTG en verandert niet vanzelf. Wie leest
       "hiervoor is een vergunning nodig" gaat wachten op iets dat niet komt. */
    if (!b.mag) blokkades.push({ wat: b.reden === 'stand' ? 'stand' : 'bevoegdheid', uitleg: b.uitleg });
    if (!u) blokkades.push({ wat: 'rekening', uitleg: 'Er staat nog geen rekening op uw naam waar dit heen kan.' });
    else if (!rekening.bruikbaar(u)) blokkades.push({ wat: 'wachttijd', bruikbaarVanaf: u.bruikbaarVanaf,
      uitleg: 'Deze rekening kan pas over ' + Math.max(1, Math.round((u.bruikbaarVanaf - nu()) / 3600000)) + ' uur ontvangen.' });
    if (vrij < MIN_CENTEN) blokkades.push({ wat: 'bedrag',
      uitleg: saldo > vrij
        ? 'Er is nu niets beschikbaar; een deel van uw saldo staat vastgezet of apart.'
        : 'Er staat te weinig om terug te storten.' });
    return { ok: true, saldo, beschikbaar: vrij,
      gereserveerd: waarde ? waarde.gereserveerd(rek) : 0,
      maximaal: Math.max(0, vrij), minimaal: MIN_CENTEN,
      rekening: rekening.publiek(u), kan: blokkades.length === 0, blokkades };
  }

  /* ---------- de terugstorting zelf ---------- */
  async function terugstorten({ codenaam, userId, centen, idem }) {
    const b = bevoegdheid();
    if (!b.mag) return { status: 403, error: b.uitleg, reden: b.reden, vermogen: 'LID_UITBETALING' };
    const u = userId ? rekening.ibanVan(userId) : null;
    if (!u) return { status: 409, error: 'Zet eerst de rekening klaar waar dit heen moet.', reden: 'rekening' };
    if (!rekening.bruikbaar(u)) return { status: 409, reden: 'wachttijd', bruikbaarVanaf: u.bruikbaarVanaf,
      error: 'Deze rekening kan nog niet ontvangen; op een nieuwe rekening zit een wachttijd.' };

    const rek = rekLid(codenaam);
    const gevraagd = Math.round(Number(centen));
    if (!Number.isFinite(gevraagd) || gevraagd < MIN_CENTEN) return { status: 400, error: 'Vul een bedrag van minstens een euro in.' };

    return metIdem(idem ? 'terug:' + codenaam + ':' + idem : null,
      'terug|' + codenaam + '|' + gevraagd, async () => {
      /* Het beschikbare bedrag PAS hier lezen, binnen de idem-sleutel. Buiten
         gelezen zouden twee gelijktijdige verzoeken allebei het volle bedrag
         zien -- exact de fout die bij de partneruitbetaling in ./kassa.js is
         gerepareerd, en het is de moeite waard hem niet opnieuw te maken. */
      const vrij = waarde ? waarde.beschikbaar(rek, saldoVan(rek)) : saldoVan(rek);
      if (gevraagd > vrij) return { status: 402, reden: 'beschikbaar', beschikbaar: vrij,
        error: 'Er is nu ' + (vrij / 100).toFixed(2) + ' euro beschikbaar.' };

      /* Eerst afboeken, dan pas de opdracht -- nooit andersom. Ligt de
         uitbetaling al bij de rail terwijl de boeking nog kan weigeren, dan is
         het geld onderweg zonder dat het is afgeschreven. De boeking gaat langs
         de waardepoort en die toetst of deze klasse überhaupt uitbetaalbaar is. */
      const boeking = await boekAsync({ van: rek, naar: 'extern:uitbetaald', centen: gevraagd,
        soort: 'uitbetaling', oms: 'Teruggestort naar uw eigen rekening' });
      if (boeking.error) return boeking;

      const op = opdrachten.maak({
        soort: 'pay-terug', rail: 'betaalnaad', centen: gevraagd, bron: rek,
        bestemming: u.iban, begunstigde: u.naam,
        oms: 'RTG Pay terugstorting', ledgerRef: boeking.boeking.id,
        // aan de BOEKING en niet aan de klok: die is er precies een per terugstorting
        idemSleutel: 'pay-terug:' + codenaam + ':' + (idem || boeking.boeking.id)
      });
      const na = await opdrachten.dienIn(op);
      seintje(codenaam);
      /* "Staat klaar" en niet "gelukt". Bij een timeout van de rail weten we
         juist niet of hij is aangekomen; dat toegeven is het hele punt van de
         opdrachtenrij. */
      return { ok: true, teruggestort: gevraagd, restant: saldoVan(rek),
        naar: rekening.kort(u.iban), opdrachtId: op.id, opdrachtStatus: na.status,
        uitleg: 'Het bedrag is van uw saldo af en staat klaar om verstuurd te worden.' };
    });
  }

  /* De teruggang: weigert de rail hem definitief, dan komt het geld terug op de
     wallet. Zelfde tabel-per-soort als de partneruitbetaling -- alleen deze kant
     weet dat het pay-grootboek het is en waar het vandaan kwam. */
  opdrachten.registreerTeruggang('pay-terug', async (o) => {
    const terug = await boekTerugEenmaal({ domein: 'pay', grootboek, boek, boekAsync,
      boekEenmaal: economischeBoekingEenmaal, geldModus,
      van: 'extern:uitbetaald', naar: o.bron, centen: o.centen,
      soort: 'terug', oms: 'Terugstorting niet verstuurd, teruggeboekt', ref: o.ledgerRef });
    try { seintje(String(o.bron || '').replace(/^lid:/, '')); } catch (e) { /* een seintje mag de teruggang niet omgooien */ }
    return terug;
  });

  return { terugstorten, terugstortenStand, koppelBevoegdTerug,
    rekeningZet: rekening.rekeningZet, ibanBevestigd: rekening.ibanBevestigd, WACHT_UUR: rekening.WACHT_UUR };
};
