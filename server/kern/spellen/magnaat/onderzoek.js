/* Magnaat: ONDERZOEK -- wat een uitvinding werkelijk doet, en hoe hij uitpakt.

   DE BOOM ZELF STAAT IN ./onderzoek-boom.js: vijf richtingen die per sector een
   eigen naam, eigen getallen en een eigen keerzijde krijgen. Dit bestand gaat
   over de MECHANIEK: hoe voortgang wordt geboekt, hoe een uitkomst valt, en hoe
   een uitgerolde uitvinding op de getallen van de motor aangrijpt.

   EEN EFFECT IS EEN GEMETEN PRODUCTIVITEITSWINST EN GEEN BONUS. Elk knooppunt
   grijpt aan op een getal dat de motor al gebruikt -- hoeveel eenheden een
   medewerker aankan, wat de vaste lasten per eenheid zijn, welk deel van de
   omzet naar inkoop gaat, wat bouwen kost, hoeveel vraag er is, hoe goed het er
   aan toegaat, hoe vaak er iets stukgaat. Er is geen "+5% winst"-knop, en dat is
   met opzet: een bonus op de uitkomst is niet te controleren, een lagere
   inkoopfractie wel.

   ONDERZOEK MAAKT NOOIT KAS. Het verandert alleen PRODUCTIEVOORWAARDEN. De
   investering verdwijnt eerst uit het vermogen; daarna mag er waarde ontstaan,
   maar alleen via capaciteit, kosten, kwaliteit, vraag of risico die aantoonbaar
   veranderd zijn. Er bestaat in deze map geen enkele plek waar het AFRONDEN van
   een onderzoek geld op een rekening zet. Zie scripts/magnaat-pomp.js.

   DRIE KOSTEN EN GEEN EEN. Onderzoek doen kost geld per maand (`kosten`), duurt
   tijd (`duur`), en het RESULTAAT moet daarna nog per vestiging worden uitgerold
   (`implementatie`). Dat laatste is de post die in de meeste spellen ontbreekt
   en die de keuze pas echt maakt: een uitvinding hebben is niet hetzelfde als
   hem gebruiken, en met tien vestigingen is uitrollen duurder dan uitvinden.

   DE UITROL IS EEN DEEL VAN DE BOUWSOM EN GEEN VAST BEDRAG, en dat is een
   correctie die uit een meting kwam. Met een vast bedrag hangt de
   terugverdientijd aan de MAAT van de zaak: het toernooi rolde nul keer iets
   uit, want de zaken die spelers in een campagne werkelijk bouwen zijn een
   fractie van de modelvestiging waar de tabel op geijkt was. Als deel van
   `gebouwdVoor` -- dezelfde grondslag die de verzekering voor pandschade
   gebruikt -- valt die afhankelijkheid weg.

   DE VOORTGANG IS DETERMINISTISCH MET SPREIDING, en de UITKOMST ook. Onderzoek
   is geen weddenschap met een muntje maar een pad met meevallers en
   tegenvallers: elke maand levert je budget voortgang op, met een afwijking die
   uit dezelfde hash komt als de risico's (./risico.js). Tien maanden in een keer
   geeft daardoor dezelfde uitkomst als tien maanden los -- de eis onder
   GAMEHALL.md 12.4. */
const { trek } = require('./risico');
const B = require('./onderzoek-boom');

const { BOOM, KNOPEN, PADEN, PAD, VELDEN, SECTORLIJST, STAM, boomVoor } = B;
const klem = (n, a, b) => Math.max(a, Math.min(b, n));

/* WAT UITROLLEN OP DEZE VESTIGING KOST: een deel van wat er staat. Hier en niet
   in ./onderzoek-acties.js, want de meters rekenen hem ook uit en twee
   berekeningen van hetzelfde lopen uiteen. */
const uitrolkosten = (v, sleutel) => Math.round((v.gebouwdVoor || 0) * BOOM[sleutel].implementatie);

/* Hoeveel onderzoeken er tegelijk mogen lopen. Twee, want dat is wat een keuze
   maakt: met vier loopt iedereen dezelfde boom af en is de vertakking
   decoratie. */
const TEGELIJK = 2;

/* Staat dit knooppunt open? Alles wat het vereist moet AF zijn -- niet in
   onderzoek, maar klaar.

   Hij heet `staatOpen` en niet `open`, en dat is geen smaak: `open` is in deze
   map al de naam van de GROTE actie waarmee je een vestiging opent
   (./acties.js). Twee zusterbestanden met dezelfde kale naam voor twee heel
   verschillende dingen is precies waar scripts/kruisscan.js voor bestaat. */
const staatOpen = (sleutel, klaar) => BOOM[sleutel].vereist.every(v => klaar.includes(v));

/* De voortgang van een maand. Je budget gedeeld door wat het knooppunt per maand
   vraagt, maal een meevaller of tegenvaller uit de hash.

   HAASTEN KAN, MAAR HET KOST MEER DAN HET OPLEVERT. Boven het normale tempo
   loopt de winst terug met een wortel: twee keer betalen levert ongeveer
   anderhalf keer de snelheid. Zonder die kromming is de budgetknop geen keuze
   maar een no-brainer -- hij halveerde de looptijd voor DEZELFDE totaalprijs, en
   dan is er geen enkele reden om hem niet altijd open te draaien.

   De looptijd blijft daarnaast een bodem: hoogstens twee keer het normale tempo,
   want sommige dingen kosten gewoon tijd. */
const SPREIDING = 0.35;
const HAAST = 0.7;
function voortgang(partijId, maand, sleutel, budget) {
  const k = BOOM[sleutel];
  const deel = Math.max(0, budget / k.kosten);
  const basis = klem(deel <= 1 ? deel : 1 + Math.sqrt(deel - 1) * HAAST, 0, 2);
  const afwijking = 1 + (trek(partijId + '|rnd|' + maand + '|' + sleutel) - 0.5) * 2 * SPREIDING;
  return klem(basis * afwijking, 0, 2) / k.duur;
}

/* HOE EEN ONDERZOEK UITPAKT staat in ./onderzoek-uitkomst.js: volledig,
   gedeeltelijk, of nuttig voor een andere KPI dan je dacht. Een eigen onderwerp
   met een eigen leven, en het was ook het stuk waarmee dit bestand over de
   10 kB-grens ging. */
const U = require('./onderzoek-uitkomst');

/* ---------- wat de motor ervan merkt ----------
   DE VERMENIGVULDIGERS STAAN OP DE VESTIGING (`v.techEffect`) en worden bij het
   uitrollen bijgewerkt. Ze staan daar en niet in de boom omdat het effect per
   SPELER verschilt sinds een uitkomst gedeeltelijk of anders kan zijn -- de
   tabel zegt niet meer wat er op een pand draait. Meerdere uitvindingen op
   hetzelfde veld stapelen door VERMENIGVULDIGING en niet door optelling, want
   dan kan een veld negatief worden en is de motor stuk. */
function factor(v, veld) {
  const f = ((v || {}).techEffect || {})[veld];
  return typeof f === 'number' && isFinite(f) && f > 0 ? f : 1;
}

/* De tabel opnieuw opbouwen uit wat er op dit pand is uitgerold. `gerealiseerd`
   is per sleutel het effect zoals het voor deze speler uitpakte. */
function techEffect(tech, gerealiseerd) {
  const uit = {};
  for (const sleutel of tech || []) {
    const e = (gerealiseerd || {})[sleutel] || (BOOM[sleutel] || {}).effect || {};
    for (const [veld, f] of Object.entries(e)) uit[veld] = (uit[veld] || 1) * f;
  }
  return uit;
}

/* Wat een uitvinding een vestiging OPLEVERT, in euro's per maand, gegeven de
   huidige cijfers. Dit is geen versiering maar de kern van de belofte in
   scripts/magnaat-pomp.js: waarde mag alleen ontstaan via een MEETBARE
   productiviteitswinst, en dit is de meting. De KEERZIJDE telt mee met hetzelfde
   teken als de winst -- anders meet je de helft van een knoop en ziet elke
   richting er beter uit dan hij is. */
function opbrengstVan(sleutel, cijfers, effect) {
  const e = effect || BOOM[sleutel].effect;
  let winst = 0;
  if (e.vast) winst += (cijfers.vast || 0) * (1 - e.vast);
  if (e.inkoop) winst += (cijfers.inkoop || 0) * (1 - e.inkoop);
  if (e.perMedewerker) winst += (cijfers.lonen || 0) * (1 - 1 / e.perMedewerker);
  if (e.markt) winst += (cijfers.marge || 0) * (e.markt - 1);
  // kwaliteit werkt via reputatie op de vraag, en dus op dezelfde marge -- maar
  // met vertraging, want reputatie kruipt. Vandaar de helft.
  if (e.kwaliteit) winst += (cijfers.marge || 0) * (e.kwaliteit - 1) * 0.5;
  // minder risico is minder verwachte schade; wat een polis kost staat los
  if (e.risico) winst += (cijfers.risico || 0) * (1 - e.risico);
  return winst;
}

module.exports = Object.assign({ BOOM, KNOPEN, PADEN, PAD, VELDEN, SECTORLIJST, STAM, boomVoor,
  TEGELIJK, SPREIDING, HAAST, uitrolkosten, staatOpen, voortgang,
  factor, techEffect, opbrengstVan }, U);
