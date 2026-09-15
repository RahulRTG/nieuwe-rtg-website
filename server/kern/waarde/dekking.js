/* HOEVEEL VAN HET GELD BEGRIJPT DEZE MACHINE? -- de meting, niet de rekensom.

   Losgetrokken uit ./bijdragebasis.js, en niet alleen omdat dat bestand over de
   groottegrens ging. Het zijn twee onderwerpen: dat bestand REKENT een basis uit
   over rijen waarvan de indeling vaststaat, dit bestand MEET hoeveel van een stel
   rijen die indeling uberhaupt draagt. Wie ze samenhoudt, krijgt vanzelf de
   verleiding om de teller mee te laten bewegen met de rekensom.

   ================== TWEE GETALLEN DIE NOOIT SAMENGAAN ==================

   `volgbaar()` uit ./economischeherkomst.js vraagt of er een herkomst EN een
   eigenaar staat -- genoeg om een bedrag aan een kant van de streep te zetten.
   Dat is de ZACHTE vraag. De harde is of de hele economische keten
   REPRODUCEERBAAR is:

       bedrag -> herkomst -> eigenaar -> tegenpartij -> bron -> classificatie

   Het verschil is niet academisch. Een rij met alleen een herkomst telt in een
   dekkingscijfer mee alsof hij begrepen is, terwijl niemand kan aanwijzen waar
   hij vandaan kwam of waar hij heen ging. Vandaar twee getallen die nooit worden
   opgeteld of gemiddeld: herkomstdekking (zacht) en economisch verklaard (hard).

   ================== EN DRIE TOESTANDEN, NOOIT EEN GETAL ==================

   Een dekkingspercentage over te weinig of over verzonnen geld is geen
   voorzichtig cijfer maar een onwaar cijfer. Daarom draagt elke meting een
   TOESTAND (zie TOESTANDEN) en geeft zij `null` waar de noemer geen betekenis
   heeft. Een zaadwereld bewijst dat de rekenmachine werkt; productie vertelt
   hoeveel van de werkelijkheid die rekenmachine begrijpt. Die twee mogen nooit
   hetzelfde cijfer worden, en daarom komen ze hier ook nooit uit dezelfde sleutel. */
'use strict';

const { ONBEKEND } = require('./economischeherkomst');
const { INDELING } = require('./bijdragebasis');

/* De toestanden van een euro-noemer. Gesloten, want "een beetje representatief"
   bestaat niet: of er is echt geld gemeten, of er is een proefwereld gemeten, of
   er is niets om over te rekenen. */
const TOESTANDEN = Object.freeze({
  GEEN_NOEMER: 'er is geen volume om een percentage over te rekenen',
  ZAADWERELD: 'gemeten over een zaadwereld: dit bewijst dat de rekenmachine werkt en zegt ' +
    'niets over hoeveel van de werkelijkheid zij begrijpt',
  PRODUCTIE: 'gemeten over werkelijk verwerkt geld'
});

/* ---------- IS DEZE EURO VOLLEDIG VERKLAARD? ----------
   Elke ontbrekende schakel komt met NAAM terug. Een nee zonder reden is bij een
   geschil niets waard, en bij een dekkingscijfer bovendien nutteloos als
   werklijst: je wilt weten WELKE schakel ontbreekt voordat je er duizend gaat
   repareren. */
function volledigVerklaard(rij) {
  const mist = [];
  if (!rij || rij.bedragCenten == null) return { ok: false, mist: ['bedrag'] };
  if (!rij.valuta) mist.push('valuta');
  if (rij.economischeHerkomst === ONBEKEND) mist.push('economischeHerkomst');
  if (rij.economischeEigenaar === ONBEKEND) mist.push('economischeEigenaar');
  /* DE TEGENPARTIJ HOORT ERBIJ. Zonder `naarWie` is niet te zeggen of het geld
     is uitgekeerd of nog bij RTG staat -- en dat is precies het verschil tussen
     een schuld en een opbrengst. */
  if (rij.naarWie === ONBEKEND) mist.push('naarWie');
  /* EN DE BRON. Een classificatie zonder verwijzing naar waar hij vandaan komt,
     is niet na te rekenen; dan is "verklaard" een bewering en geen bewijs. */
  if (!rij.bronObject) mist.push('bronObject');
  if (!INDELING[rij.economischeEigenaar]) mist.push('classificatie');
  return { ok: mist.length === 0, mist };
}

/* De twee dekkingsgetallen over een stel rijen, PER VALUTA.

   EEN DEKKING OVER MEERDERE VALUTA BESTAAT NIET. De eerste versie van deze
   functie telde de bedragen op en noemde de uitkomst `totaalEuro`; over de
   zaadwereld (EUR, JPY en TRY door elkaar) gaf dat EUR 27.732,30 voor geld dat
   voor een groot deel in yen staat. Dat is dezelfde fout die
   ./herkomstsplitsing.js met `waaromGeenTotaal` juist weigert te maken, en hij
   is hier verraderlijker: een PERCENTAGE ziet er altijd redelijk uit, ook als
   teller en noemer uit twee munten komen.

   Een verhouding BINNEN een munt is wel eerlijk. Vandaar per valuta een eigen
   teller, een eigen noemer en een eigen percentage, en geen gemiddelde erover --
   dat zou een koers nodig hebben, en die kent dit huis niet. */
function dekkingOver(rijen) {
  const lijst = (Array.isArray(rijen) ? rijen : []).filter(r => r && r.bedragCenten != null);
  if (!lijst.length) {
    return { rijen: 0, perValuta: {}, eenValuta: null, totaalCenten: null,
      herkomst: null, economisch: null,
      reden: 'er zijn geen rijen met een bedrag; een percentage over een lege noemer is fictie' };
  }
  /* DE NOEMER IS DE ABSOLUTE WAARDE. Een terugboeking van EUR 960 is EUR 960 aan
     economische beweging die verklaard moet zijn, niet min 960 die de noemer
     kleiner maakt -- anders kan een huis zijn dekking verbeteren door geld terug
     te draaien. */
  const perValuta = {};
  const ontbreekt = {};
  for (const r of lijst) {
    const v = r.valuta || '(geen valuta)';
    const bak = perValuta[v] || (perValuta[v] = { rijen: 0, totaalCenten: 0, herkomstCenten: 0, economischCenten: 0 });
    const abs = Math.abs(r.bedragCenten);
    bak.rijen++;
    bak.totaalCenten += abs;
    if (r.economischeHerkomst !== ONBEKEND) bak.herkomstCenten += abs;
    const u = volledigVerklaard(r);
    if (u.ok) bak.economischCenten += abs;
    /* Waar het op afknapt, als werklijst en niet als restpost. */
    for (const m of u.mist) ontbreekt[m] = (ontbreekt[m] || 0) + 1;
  }
  const pct = (x, t) => t > 0 ? Number((100 * x / t).toFixed(1)) : null;
  for (const bak of Object.values(perValuta)) {
    bak.herkomst = { centen: bak.herkomstCenten, percentage: pct(bak.herkomstCenten, bak.totaalCenten) };
    bak.economisch = { centen: bak.economischCenten, percentage: pct(bak.economischCenten, bak.totaalCenten) };
    delete bak.herkomstCenten; delete bak.economischCenten;
  }
  const munten = Object.keys(perValuta);
  const een = munten.length === 1 ? munten[0] : null;
  const kop = een ? perValuta[een] : null;
  return {
    rijen: lijst.length, perValuta, eenValuta: een,
    totaalCenten: kop ? kop.totaalCenten : null,
    herkomst: kop ? kop.herkomst : null,
    economisch: kop ? kop.economisch : null,
    ontbreekt,
    waaromGeenTotaal: een ? null :
      'er staan ' + munten.length + ' valuta tussen deze rijen (' + munten.join(', ') + ') en dit ' +
      'huis kent geen koers; een dekkingspercentage over twee munten telt een teller uit de ene ' +
      'bij een noemer uit de andere',
    reden: null
  };
}

/* ---------- DE EURODEKKING, MET ZIJN TOESTAND ----------
   `wereld` is 'productie' of 'zaadwereld' en wordt door de AANROEPER gezet, niet
   geraden: alleen wie de rijen ophaalde weet waar ze vandaan komen. Een lege of
   onbekende wereld valt terug op GEEN_NOEMER met de reden -- nooit stilzwijgend
   op productie, want dat is het cijfer waar iemand een besluit op neemt.

   En de naam wordt letterlijk genomen: staan er andere munten dan euro tussen,
   dan is er geen EUROdekking. Het per-valuta-beeld gaat wel mee naar buiten, want
   "geen getal" hoort geen "geen informatie" te betekenen. */
function euroDekking(rijen, { wereld } = {}) {
  const d = dekkingOver(rijen);
  const leeg = (reden) => ({
    status: 'GEEN_NOEMER', percentage: null, verklaardEuro: null, totaalEuro: null,
    rijen: d.rijen, perValuta: d.perValuta || {}, ontbreekt: d.ontbreekt || {}, reden
  });
  if (!d.rijen) return leeg(d.reden || TOESTANDEN.GEEN_NOEMER);
  if (d.eenValuta !== 'EUR') {
    return leeg(d.waaromGeenTotaal ||
      'deze rijen staan in ' + d.eenValuta + ' en niet in euro; een eurodekking bestaat dan niet');
  }
  if (wereld !== 'productie' && wereld !== 'zaadwereld') {
    return leeg('de herkomst van deze rijen is niet opgegeven; een dekkingscijfer zonder wereld ' +
      'leest als productie en dat is het niet per se');
  }
  const euro = (c) => Number((c / 100).toFixed(2));
  const status = wereld === 'productie' ? 'PRODUCTIE' : 'ZAADWERELD';
  return {
    status,
    percentage: d.economisch.percentage,
    verklaardEuro: euro(d.economisch.centen),
    totaalEuro: euro(d.totaalCenten),
    rijen: d.rijen, perValuta: d.perValuta, ontbreekt: d.ontbreekt,
    reden: TOESTANDEN[status]
  };
}

module.exports = { TOESTANDEN, volledigVerklaard, dekkingOver, euroDekking };
