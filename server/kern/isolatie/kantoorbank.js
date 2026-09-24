/* DE KANTOORBANK, PER ROUTE VERKLAARD -- twee vragen en niet een.

   1. KAN DEZE HANDELING NA COMMIT EEN GELDPOSITIE WIJZIGEN? Dat is de scherpe vraag, met
      zijn eigen toets, en alleen een `true` levert GELD_BEWEGEN.
   2. EN WAT DOET ZIJ DAN WEL? Een leesroute of een regel-instelling die in het bankdomein
      woont, beweegt geen geld -- maar zij doet wel iets, en dat hoort een NAAM te hebben
      in plaats van een leeg vak. Sinds 13 september kan dat: ./effectwoorden.js heeft er
      vier werkwoorden bij (LEZEN_ANDERMANS, PLAFOND_WIJZIGEN, VOORSTEL_MAKEN,
      CONFIGUREREN), en per werkwoord is in ./standsluiting.js besloten of hij ook in de
      beschermstand dichtgaat.

   DAT IS WAAROM DIT BESTAND NIET MEER `geldpositie.js` HEET: een tabel die ook
   CONFIGUREREN draagt, is geen geldtabel.

   DE VRAAG IS MET OPZET DEZE EN NIET "zit deze route in het bankdomein". Dat tweede
   vermengt handelingstype met domeincontext, en dan wordt het effectmodel juist minder
   waar op het moment dat je het voor causaliteit wilt gebruiken: een leesroute of een
   regel-instelling die in het bankdomein woont, beweegt zelf geen geld.

   WAT DEZE TABEL REPAREERT, en het was een echte vervalsing in twee richtingen. Van de
   39 kantoor-bankroutes droegen er vier GELD_BEWEGEN -- /draai, /leden, /mislukking en
   /nood -- en geen van die vier verplaatst een euro. Ze kregen het omdat de collectie
   `bankregie` ("de bediening van de bankkant") als geld was ingedeeld; dat is inmiddels
   BEVEILIGING_VERZWAKKEN, wat zij werkelijk zijn. Tegelijk stonden de routes die WEL
   een geldpositie wijzigen op `onbekend`, want de idempotentieproef komt er niet langs:
   /handtekening/bevestig eist twee kantoormensen op naam, en een script kan de tweede
   niet zijn. Verklaring is daar de enige weg, en dan hoort er per regel een grond te
   staan die een tweede lezer kan betwisten.

   DE GRENS TUSSEN JA EN NEE: JA is "na deze handeling staat er een ander bedrag op een
   positie", NEE is "zij verandert wat er MAG of KAN". Een rood-limiet verhogen maakt geld
   MOGELIJK en verplaatst het niet; wie die twee samenvoegt kan later niet meer zien welke
   handeling het geld bewoog. De ENABLER en de BEWEGING zijn twee dingen.

   DE DERDE KOLOM IS EEN LIJST EN MAG LEEG ZIJN, en dat is geen slordigheid: /gezond leest
   een SYSTEEMstand en geen gegevens van iemand, en /bevoegdheid leest een matrix per land.
   Daar past geen van de zeventien werkwoorden, en er een uitkiezen dat er bijna op lijkt
   zou semantiek verzinnen op precies de plek waar dat niet mag. Een lege lijst met een
   grond ernaast is dan het eerlijke antwoord.

   EN DE TABEL IS GESLOTEN OVER ZIJN BEREIK. test/geldpositie.test.js eist dat ELKE
   /api/office/bank/-route hier een antwoord heeft: een nieuwe route zakt dus tot iemand
   de vraag beantwoordt. Een tabel die stilletjes achterloopt op de code is geen
   verklaring maar een momentopname. */
'use strict';

/* Per pad: kan het na commit een geldpositie wijzigen, en waarom. De grond is geen
   sier -- hij is wat een tweede lezer nodig heeft om de indeling te betwisten. */
const KANTOORBANK = Object.freeze({
  /* ---- JA: er staat daarna een ander bedrag op een positie ---- */
  '/api/office/bank/handtekening/bevestig': [true,
    'voert de bevestigde geldhandeling uit (uitvoerders.get(a.actie)): een incassoronde ' +
    'boekt, bank.rood zet een limiet -- de eerste beweegt geld en dus kan deze route dat'],
  '/api/office/bank/rente': [true, 'bankRenteRonde schrijft rente bij of af op echte rekeningen'],
  '/api/office/bank/krediet/besluit': [true, 'een akkoord verandert de kredietpositie van de aanvrager'],
  '/api/office/bank/salaris/run': [true,
    'betaalt een definitieve loonrun uit; de route weigert zelfs zonder runId omdat ' +
    'uitbetalen op geklokte uren het brutoloon zou overmaken'],
  '/api/office/bank/opdrachten/ronde': [true, 'verwerkt openstaande betaalopdrachten'],
  '/api/office/bank/opdrachten/opnieuw': [true, 'biedt een betaalopdracht opnieuw aan'],
  '/api/office/bank/rekening/open': [true,
    'een rekening gaat bestaan; `bankRekeningen` is in ./effectcollecties.js al als geld ' +
    'ingedeeld met dezelfde grond (het bestaan en de eigenaar van een rekening)'],

  /* ---- NEE: verandert wat er MAG of KAN, en verplaatst niets ---- */
  '/api/office/bank/rekening/rood': [false, 'een rood-limiet maakt geld mogelijk en verplaatst niets', ['PLAFOND_WIJZIGEN']],
  '/api/office/bank/rekening/bevries': [false, 'raakt de beschikbaarheid van een rekening, niet het saldo', ['PLAFOND_WIJZIGEN']],
  '/api/office/bank/instellingen': [false, 'plafonds en instellingen: de grond onder een besluit, geen boeking', ['PLAFOND_WIJZIGEN', 'CONFIGUREREN']],
  '/api/office/bank/terugstorting': [false,
    'de schakelaar IS de juridische positie (CLAUDE.md) en beweegt zelf geen geld', ['CONFIGUREREN']],
  '/api/office/bank/incasso': [false,
    'zet een voornemen klaar voor een tweede mens; het eigen gevolgcontract sluit ' +
    'GELD_BEWEGEN met zoveel woorden uit', ['VOORSTEL_MAKEN']],
  '/api/office/bank/incasso/dossier': [false, 'leest het dossier van de keten', ['LEZEN_ANDERMANS']],
  '/api/office/bank/handtekening/open': [false, 'leest wat er openstaat', ['LEZEN_ANDERMANS']],
  '/api/office/bank/handtekening/intrek': [false, 'haalt een aanvraag weg voordat er iets is uitgevoerd', ['VOORSTEL_MAKEN']],
  '/api/office/bank/opdrachten/afstemming': [false,
    'maakt alleen een aanvraag (MONEY-012); het geld beweegt pas als een tweede mens tekent via ' +
    '/handtekening/bevestig', ['VOORSTEL_MAKEN']],
  '/api/office/bank/salaris/voorstel': [false, 'rekent een voorstel voor; uitbetalen is /salaris/run', ['VOORSTEL_MAKEN']],
  '/api/office/bank/gezond': [false, 'leest de gezondheid van de bankkant', []],
  '/api/office/bank/afschrift': [false, 'leest boekingen', ['LEZEN_ANDERMANS']],
  '/api/office/bank/krediet': [false, 'leest openstaande kredietaanvragen', ['LEZEN_ANDERMANS']],
  '/api/office/bank/opdrachten': [false, 'leest betaalopdrachten', ['LEZEN_ANDERMANS']],
  '/api/office/bank/bevoegdheid': [false, 'leest de bevoegdheidsmatrix per land', []],
  '/api/office/bank/vergunning': [false, 'legt een vergunning vast: een juridisch gegeven, geen boeking', ['CONFIGUREREN']],
  '/api/office/bank/partnerrail': [false, 'zet een rail aan of uit; de rail beweegt geld, deze schakelaar niet', ['CONFIGUREREN']],
  '/api/office/bank/modus': [false, 'zet de stand van de bank', ['CONFIGUREREN']],
  '/api/office/bank/draai': [false, 'draait de stand een slag; dit is de vervalsing die deze tabel opende', ['CONFIGUREREN']],
  '/api/office/bank/operationeel': [false, 'zet de bank aan of uit als uitgevende partij', ['CONFIGUREREN']],
  '/api/office/bank/leden': [false, 'zet de bank open of dicht voor leden', ['CONFIGUREREN']],
  '/api/office/bank/entiteitrekening': [false, 'leest de stand', []],
  '/api/office/bank/entiteitrekening/zet': [false, 'zet het product open/dicht', ['CONFIGUREREN']],
  '/api/office/bank/nood': [false, 'noodstop: clearing valt terug op de kaart-rails', ['CONFIGUREREN']],
  '/api/office/bank/herstel': [false, 'heft de noodstop op', ['CONFIGUREREN']],
  '/api/office/bank/mislukking': [false, 'legt een mislukte clearing vast en kan de noodstop trippen', ['CONFIGUREREN']],
  '/api/office/bank/autoriseer/bevestig': [false, 'bevestigt een openstaande autorisatie van de bankstand', ['CONFIGUREREN']],
  '/api/office/bank/autoriseer/annuleer': [false, 'trekt zo n autorisatie in', ['CONFIGUREREN']],
  '/api/office/bank/regels': [false, 'leest de fiscale regels', []],
  '/api/office/bank/regels/update': [false, 'wijzigt de fiscale regels: configuratie', ['CONFIGUREREN']],
  '/api/office/bank/regels/check': [false, 'rekent een controle voor', []],
  '/api/office/bank/regels/zzp': [false, 'leest de zzp-regels', []],
  '/api/office/bank/regels/zzp/update': [false, 'wijzigt de zzp-regels: configuratie', ['CONFIGUREREN']],
  '/api/office/bank/regels/geschiedenis': [false, 'leest de geschiedenis van een regel', []],
  '/api/office/bank/regels/geraakt': [false, 'leest welke jaargangen geraakt zijn', []]
});

/* Het bereik waarover deze tabel GESLOTEN is. Buiten dit bereik zegt hij niets, en dat
   is iets anders dan `false` -- vandaar een expliciete grens in plaats van een lege
   uitslag (BESTUUR.md: `niet vast te stellen` is een eersteklas uitslag). */
const BEREIK = /^\/api\/office\/bank\//;

function geldpositieVan(pad) {
  const rij = KANTOORBANK[String(pad || '')];
  if (rij) return { binnenBereik: true, kan: rij[0], grond: rij[1] };
  return { binnenBereik: BEREIK.test(String(pad || '')), kan: null,
    grond: BEREIK.test(String(pad || ''))
      ? 'deze route valt binnen het bereik van de tabel maar heeft er geen antwoord: de vraag is ' +
        'niet beantwoord, en dat is geen nee'
      : 'buiten het bereik van deze tabel; zij zegt hier niets, en dat is geen nee' };
}

/* DE KLASSEN VAN EEN ROUTE -- wat zij WEL doet, als er een woord voor is.

   GEEFT `null` BUITEN DE TABEL EN EEN LIJST ERBINNEN, en die twee mogen nooit op elkaar
   gaan lijken: `null` betekent "hierover is niets verklaard", `[]` betekent "verklaard, en
   geen van de zeventien werkwoorden past" (een systeemstand lezen, een matrix per land).
   Wie beide als leeg leest, heeft een bron gebouwd die zwijgen als antwoord geeft. */
function klassenVan(pad) {
  const rij = KANTOORBANK[String(pad || '')];
  if (!rij) return null;
  return Array.isArray(rij[2]) ? rij[2].slice() : [];
}

module.exports = { KANTOORBANK, BEREIK, geldpositieVan, klassenVan };
