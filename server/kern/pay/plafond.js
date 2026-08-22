/* HET PLAFOND PER WALLET (kern/pay/plafond.js).

   De tweede helft van de voorwaarde waarop kern/bevoegdheid/lijst.js het
   aanhouden van walletsaldo toestaat. Dat besluit noemt drie dingen -- alleen
   binnen RTG besteedbaar, niet uitbetaald aan het lid, en "een maximum per
   wallet en per boeking" -- en van die drie bestond alleen de laatste helft:
   MAX_CENTEN begrensde de BOEKING, het maximum per WALLET stond nergens. Het
   STANDAARDbedrag en het waarom van zijn hoogte staan in ./stand.js; wat er
   werkelijk geldt zet de BOARDROOM (kern/bankregie/instellingen.js) en komt
   hier binnen als functie, zodat een wijziging meteen telt in plaats van na
   een herstart.

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

module.exports = ({ saldoVan, rekLid, standaard, walletMax }) => {
  /* DE BRON VAN HET BEDRAG WOONT HIER, en niet bij de aanroeper. De boardroom
     zet het plafond (kern/bankregie/instellingen.js), maar RTG Pay wordt in
     kernlaag3 gebouwd en de bankregie pas in 4b -- dus die koppeling komt LATER
     binnen, net als die van de bank. Tot dat moment geldt de standaard uit
     ./stand.js.

     Twee redenen dat dit hier staat en niet in ./index.js: dit bestand gaat
     over het plafond, dus de vraag "waar komt het getal vandaan" hoort erbij --
     en index.js liep er met deze uitleg erin over de grens uit keuringsregel 13.

     PER BOEKING GELEZEN en niet eenmalig: een waarde die bij het opstarten is
     vastgeklikt zou een wijziging pas na een herstart volgen, met een scherm
     dat een ander getal toont dan de grendel gebruikt (LAT.md regel 4). */
  let bron = typeof walletMax === 'function' ? walletMax : () => standaard;
  const koppelPlafond = fn => { if (typeof fn === 'function') bron = fn; };
  const max = () => {
    const v = Math.round(Number(bron()));
    /* Een kapotte of ontbrekende instelling mag het plafond nooit OPENEN. Valt
       de koppeling weg, dan is er geen ruimte in plaats van oneindig ruimte:
       fail-closed, net als de lege vergunningslijst. */
    return Number.isFinite(v) && v > 0 ? v : 0;
  };
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
    if (saldoVan(naar) + centen <= max()) return null;
    return { status: 409, code: 'wallet-plafond',
      error: 'Dit past niet in de wallet: er kan maximaal ' + Math.round(max() / 100) + ' euro op staan.' };
  }
  // Wat er nu nog bij kan. Voor het scherm, zodat het lid een grens ziet
  // aankomen in plaats van hem te raken.
  const walletRuimte = codenaam => Math.max(0, max() - saldoVan(rekLid(codenaam)));

  return { plafondFout, walletRuimte, koppelPlafond, walletMax: max };
};
