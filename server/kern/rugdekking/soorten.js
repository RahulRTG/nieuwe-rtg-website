/* ============================================================================
   RUGDEKKING -- de twee soorten, en waarom een programma er maar EEN kan zijn.

   RUGDEKKING.md par. 2.4 zegt het in één zin: *een programma dat beide wil zijn,
   is de constructie waar de firewall en de giftgrendel allebei op gebouwd zijn.*
   Dit bestand maakt daar een weigering van in plaats van een waarschuwing.

   DE VORK, en hij is niet redactioneel:

                          COMMERCIEEL                 BEURS
     wat het is           RTG koopt iets              steun zonder tegenprestatie
     wereld               commercieel                 rtfoundation
     de mens is           leverancier, met factuur    begunstigde
     logo of post vragen  ja, dat IS de koop          nee -- dan is het sponsoring
     vandaag uitvoerbaar  ja                          nee (zie ./index.js)

   VIER WEIGERINGEN DIE HIERUIT VOLGEN:

   1 EEN BEURS MET EEN TEGENPRESTATIE BESTAAT NIET. Staat er iets tegenover, dan
     is het sponsoring -- ander fiscaal regime, andere verantwoording. De code
     zegt dat al op de andere kant van het geld (kern/rtfos/herkomst.js grendel
     2, waar een gift met tegenprestatie automatisch sponsoring wordt); hier
     staat dezelfde regel aan de kant waar het geld VERTREKT.
   2 EEN COMMERCIEEL PROGRAMMA ZONDER TEGENPRESTATIE IS GEEN KOOP. Wie niets
     koopt en toch betaalt, doet aan liefdadigheid met een factuur eroverheen.
     Dat is de omgekeerde fout van 1 en hij is even hard.
   3 EEN MINDERJARIGE IS GEEN MERK. Grens 1 van RUGDEKKING.md: geen
     zichtbaarheidsverplichting voor wie de achttien nog niet heeft. Een
     commercieel programma VRAAGT per definitie een tegenprestatie, dus voor een
     minderjarige kan die tegenprestatie nooit zichtbaarheid zijn.
   4 RUGDEKKING KOOPT GEEN STEM. Een tegenprestatie mag gaan over aanwezigheid,
     beeld of rechten -- nooit over wat iemand VINDT of ZEGT. Wie dat koopt,
     koopt een mening, en dat is geen levering maar een monddood.

   EN DIT BESTAND VOERT NIETS UIT. Geen db, geen routes, geen geld -- alleen de
   regels, zodat het BESLUIT te beproeven is zonder een server op te starten.
   Dezelfde reden als kern/economie/firewall.js en kern/vertegenwoordiging/
   machtiging.js.
   ========================================================================== */
'use strict';

const SOORTEN = Object.freeze({
  commercieel: Object.freeze({
    naam: 'Commerciële rugdekking',
    wereld: 'commercieel',
    tegenprestatieNodig: true,
    factuur: true,
    uitbetaalVermogen: 'PARTNER_UITBETALING',
    watHetIs: 'RTG koopt iets: aanwezigheid, beeld of rechten. De mens levert als ondernemer ' +
      'en stuurt een factuur; er staat iets tegenover en dat heet ook zo.'
  }),
  beurs: Object.freeze({
    naam: 'Beurs van de RTFoundation',
    wereld: 'rtfoundation',
    tegenprestatieNodig: false,
    factuur: false,
    /* Met opzet een ANDER vermogen dan PARTNER_UITBETALING: die gaat naar een
       ondernemer die omzet heeft gemaakt, en een beurs is geen omzet
       (RUGDEKKING.md par. 4.3). Of dit vermogen openstaat, beslist de eigenaar
       in ./index.js -- hier staat alleen dat het een ANDER vermogen is. */
    uitbetaalVermogen: 'RUGDEKKING_BEURS',
    watHetIs: 'Steun zonder tegenprestatie. Geen logo, geen post, geen verplichting. ' +
      'De mens is begunstigde en geen leverancier.'
  })
});

/* Wat een tegenprestatie MAG zijn. Een gesloten lijst, zodat "wat vind jij van
   ons" er niet stilletjes bijkomt onder een vriendelijke naam. */
const TEGENPRESTATIES = Object.freeze({
  aanwezigheid: 'Ergens zijn: een clinic, een opening, een dag op locatie.',
  beeld: 'Beeld waarin de mens herkenbaar is, binnen het afgesproken gebied en de afgesproken tijd.',
  rechten: 'Het recht een naam, beeld of prestatie te gebruiken, begrensd in gebied en looptijd.',
  vermelding: 'Een logo of naam op kleding, materiaal of een kanaal.'
});

/* Wat een tegenprestatie NOOIT is. Deze lijst is de reden dat de vorige gesloten
   is: hij staat in het antwoord, zodat wie een programma opstelt ziet waar de
   grens ligt voordat hij hem probeert te halen. */
const NOOIT = Object.freeze([
  Object.freeze({ wat: 'Een mening, standpunt of aanbeveling',
    waar: 'Rugdekking koopt geen stem. Wie geld ontvangt, is niet verplicht iets te vinden.' }),
  Object.freeze({ wat: 'Zwijgen over iets',
    waar: 'Een zwijgplicht kopen is hetzelfde in de andere richting.' }),
  Object.freeze({ wat: 'Gegevens over gezondheid, blessures of belastbaarheid',
    waar: 'De betaler leest de gezondheid nooit (RUGDEKKING.md grens 8 en kern/zorgniveau.js).' }),
  Object.freeze({ wat: 'Exclusiviteit die de mens van RTG afhankelijk maakt',
    waar: 'De toetsvraag is wat deze mens overhoudt als wij morgen stoppen met betalen.' })
]);

const soortBestaat = (s) => Object.prototype.hasOwnProperty.call(SOORTEN, String(s || ''));
const tegenprestatieBestaat = (t) => Object.prototype.hasOwnProperty.call(TEGENPRESTATIES, String(t || ''));

/* VORM: maakt van een voorstel een programma, of zegt waarom niet. Weigert
   liever dan dat hij repareert -- een stilletjes omgezette soort is precies wat
   de firewall later niet meer kan zien.

   `opties.minderjarig` komt van buiten omdat dit bestand geen db kent; de
   aanroeper leest hem uit kern/vertegenwoordiging/jeugd.js. */
function vorm(data, opties) {
  const d = data || {}, o = opties || {};

  const soort = String(d.soort || '').trim();
  if (!soortBestaat(soort)) {
    return { error: 'Kies wat dit is: ' + Object.keys(SOORTEN).join(' of ') + '. Een programma dat ' +
      'beide wil zijn, is precies de constructie die de firewall en de giftgrendel weigeren.' };
  }
  const S = SOORTEN[soort];

  const gevraagd = Array.isArray(d.tegenprestaties) ? d.tegenprestaties.map(x => String(x || '')) : [];
  const onbekend = gevraagd.filter(t => !tegenprestatieBestaat(t));
  if (onbekend.length) {
    return { error: 'Dit kan geen tegenprestatie zijn: ' + onbekend.join(', ') + '. De lijst is ' +
      'gesloten, zodat een mening er niet onder een vriendelijke naam bij komt.' };
  }
  const tegenprestaties = [...new Set(gevraagd)].sort();

  if (!S.tegenprestatieNodig && tegenprestaties.length) {
    return { error: 'Een beurs met een tegenprestatie bestaat niet: staat er iets tegenover, dan is ' +
      'het sponsoring. Ander regime, andere verantwoording, en een factuur. Kies dan commercieel.' };
  }
  if (S.tegenprestatieNodig && !tegenprestaties.length) {
    return { error: 'Een commercieel programma zonder tegenprestatie is geen koop maar een gift met ' +
      'een factuur eroverheen. Noem wat RTG afneemt, of kies beurs.' };
  }
  if (S.tegenprestatieNodig && o.minderjarig) {
    return { error: 'Deze mens is volgens zijn identiteitsbewijs minderjarig, en een minderjarige is ' +
      'geen merk: er komt geen zichtbaarheidsverplichting op. Een beurs kan wel.' };
  }

  const bedrag = Math.round(Number(d.bedragCenten));
  if (!Number.isFinite(bedrag) || bedrag <= 0) {
    return { error: 'Noem het bedrag. Rugdekking zonder bedrag is een belofte en geen afspraak.' };
  }

  const tot = Date.parse(d.tot);
  if (!Number.isFinite(tot)) {
    return { error: 'Rugdekking heeft een einddatum. Zonder einde weet niemand wanneer dit opnieuw ' +
      'een besluit wordt.' };
  }
  const nu = o.nu == null ? Date.now() : o.nu;
  if (tot <= nu) return { error: 'De einddatum ligt in het verleden.' };

  return {
    programma: {
      soort, wereld: S.wereld, tegenprestaties, bedragCenten: bedrag,
      factuurNodig: S.factuur, uitbetaalVermogen: S.uitbetaalVermogen,
      tot: new Date(tot).toISOString(),
      gestopt: null
    }
  };
}

module.exports = { SOORTEN, TEGENPRESTATIES, NOOIT, soortBestaat, tegenprestatieBestaat, vorm };
