/* HET PLAFOND PER WALLET (kern/pay/plafond.js).

   De tweede helft van de voorwaarde waarop kern/bevoegdheid/lijst.js het
   aanhouden van walletsaldo toestaat. Dat besluit noemt drie dingen -- alleen
   binnen RTG besteedbaar, niet uitbetaald aan het lid, en "een maximum per
   wallet en per boeking" -- en van die drie bestond alleen de laatste helft:
   MAX_CENTEN begrensde de BOEKING, het maximum per WALLET stond nergens. Het
   bedrag zelf (WALLET_MAX) en het waarom van zijn hoogte staan in ./stand.js.

   HIJ GELDT ALLEEN VOOR LEDEN-REKENINGEN. Een partnerrekening is de omzet van
   een zaak die naar de bank wordt uitbetaald, en een extern:-rekening is per
   definitie de tegenkant van het gesloten circuit. Een plafond daarop zou de
   kassa breken.

   GEEN INVARIANT VAN DE MOTOR, en dat is met opzet. De sluitcontrole en het
   niet-onder-nul zijn regels OVER het grootboek en wonen daarom in de motor
   zodra die de autoriteit is; dit is een regel over wie er geld mag AANNEMEN,
   en die hoort ervoor. Vandaar dat hij in boekAsync valt vóór de motor wordt
   gebeld, en niet erna: een boeking die het plafond breekt hoort nooit aan de
   autoriteit te worden voorgelegd.

   WAAROM DIT EEN EIGEN BESTAND IS, en niet drie regels in ./index.js: die stond
   met deze uitleg erin op 10,5 KB, over de grens uit keuringsregel 13. Het is
   dezelfde afsplitsing als ./stand.js, en om dezelfde reden dezelfde naad --
   pasToe(), boek() en boekAsync() blijven in index.js staan, want WETTEN.json
   wijst voor de wet geld-conservatie letterlijk een regel uit pasToe() aan, met
   bestandsnaam. */
'use strict';

module.exports = ({ saldoVan, rekLid, WALLET_MAX }) => {
  /* Geeft een foutobject als deze boeking de ontvangende wallet over het
     plafond zou tillen, en anders null. Bewust een FOUT terug en geen boolean:
     de aanroepers geven hem rechtstreeks door aan de client, en dan staat de
     tekst op een plek in plaats van bij elke aanroeper opnieuw. */
  function plafondFout(naar, centen) {
    if (!naar || !String(naar).startsWith('lid:')) return null;
    /* Een bedrag dat geen getal is, is niet ONS probleem: dat hoort een "dat
       bedrag kan niet" te worden van wie het bedrag keurt. Zonder deze regel
       valt NaN door de vergelijking hieronder (elke vergelijking met NaN is
       onwaar) en krijgt een kapot verzoek in motor-modus een 409 "de wallet zit
       vol" te horen -- een foutmelding die naar de verkeerde plek wijst. */
    if (!Number.isFinite(centen)) return null;
    if (saldoVan(naar) + centen <= WALLET_MAX) return null;
    return { status: 409, code: 'wallet-plafond',
      error: 'Dit past niet in de wallet: er kan maximaal ' + Math.round(WALLET_MAX / 100) + ' euro op staan.' };
  }
  // Wat er nu nog bij kan. Voor het scherm, zodat het lid een grens ziet
  // aankomen in plaats van hem te raken.
  const walletRuimte = codenaam => Math.max(0, WALLET_MAX - saldoVan(rekLid(codenaam)));

  return { plafondFout, walletRuimte };
};
