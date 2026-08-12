/* Magnaat: EEN SPELMAAND VOOR DE HELE WERELD.

   Afgesplitst van ./economie.js, en de naad is echt: dat bestand gaat over
   WANNEER er een maand gerekend wordt (de klok die bijrekent, het opzetten, het
   einde, de wissel naar de acties) en dit bestand over WAT ER IN die maand
   gebeurt. Het eerste is af en verandert niet meer; het tweede groeit met elke
   fase mee -- fase B zette er de contractafwikkeling in, fase C zet er
   gebeurtenissen in. Twee dingen met zo'n verschillend tempo horen niet in een
   bestand, en de 10 kB-grens die scripts/check.js bewaakt is precies een rem
   hierop.

   DE VOLGORDE IN DEZE MAAND IS DE UITLEG, en hij staat vast omdat de klok
   bijrekent (GAMEHALL.md 12.4): tien maanden in een keer moeten hetzelfde
   opleveren als tien maanden los.

     1. de concurrentiedruk per zone en sector, op de begintoestand
     2. wat er aan contracten vastligt, VOORDAT er iets gerekend is
     3. wat elke leverancier daarvan waarmaakt (naar rato bij een tekort)
     4. iedere vestiging rekent zijn maand, allemaal op DEZELFDE begintoestand
     5. rood staan kost rente
     6. de contracten worden afgewikkeld -- na de maand, want de kwaliteitseis
        gaat over de kwaliteit die er DEZE maand geleverd is
     7. de Foundation draagt af en bouwt

   Stap 1 en 4 staan met opzet uit elkaar: zou elke vestiging op de bijgewerkte
   toestand rekenen, dan bepaalt de volgorde van de spelers in een object wie de
   klanten krijgt. */
const { maand: rekenMaand, levering } = require('./stap');
/* DE CONJUNCTUUR. Hij komt hier binnen en nergens anders: een golf over de hele
   stad hoort op de plek waar de stad gerekend wordt. Zie ./cyclus.js -- hij
   raakt twee dingen, de vraag en de prijs van geld, en verder niets. */
const C = require('./cyclus');
/* HET NIEUWS. De cyclus is de wind, dit zijn de buien: een golf raakt de hele
   stad langzaam, een bericht raakt EEN zone of EEN sector kort en scherp. Zie
   ./nieuws.js. */
const N = require('./nieuws');
const DIENST = require('./dienst');
const maakPerZaak = require('./maand-vestiging');
const F = require('./foundation');
const H = require('./handel');

const rond = (n) => Math.round(n);

module.exports = ({ K, wieHeeft, ROOD_RENTE, verdeel, bank, onthoud, verzekering, rnd, beheer, kiesProject }) => {
  const perZaak = maakPerZaak({ verdeel, rekenMaand, F, N });
  const { wikkelAf } = require('./maand-contracten')({ rond });
  const afsluiten = require('./maand-afsluiten')({ wikkelAf, kiesProject });
  const { lasten } = require('./maand-lasten')({ ROOD_RENTE, bank, verzekering, rnd, beheer });
  function eenMaand(potje) {
    const st = potje.staat, k = K(st);
    const kwaliteitVan = {};
    const druk = {};
    for (const [h, rij] of Object.entries(st.vestigingen))
      for (const v of rij) {
        const zone = k.kavel.get(v.kavel).zone;
        druk[zone + ':' + v.sector] = (druk[zone + ':' + v.sector] || 0) + 1;
      }
    let wereldOmzet = 0;
    /* DE STAND VAN DE CONJUNCTUUR, EEN KEER PER MAAND EN VOOR IEDEREEN GELIJK.
       `st.cyclus` stond al in de renteformule van ./bank.js en werd door niets
       gevoed -- hij bleef nul, dus de bank rekende altijd met een neutrale
       conjunctuur. Dit is de draad die daar los hing.

       Hij wordt hier GEZET en niet berekend waar hij gelezen wordt: de bank
       leest hem tijdens een actie (een offerte opvragen kan elk moment), en dan
       zou een offerte in dezelfde maand een andere rente geven dan de maandloop
       rekent. Een getal op de staat is een getal waar iedereen het over eens is. */
    const conjunctuur = C.vraagFactor(potje.id, st.maand);
    st.cyclus = C.geldstand(potje.id, st.maand);
    // de zones van deze stad, voor het nieuws dat er op valt
    const zones = [...new Set(k.kavels.map(x => x.zone))];
    const perSpeler = {};
    // wat de Foundation aan opleiding heeft bijgedragen; werkt door in hoeveel
    // een medewerker aankan
    const arbeid = F.arbeidBonus(st.foundation);
    /* WAT ER DEZE MAAND VASTLIGT AAN CONTRACTEN, voordat er ook maar iets
       gerekend is. Een levering gaat voor de vrije verkoop (./handel.js), dus
       die capaciteit moet vergeven zijn voordat de eerste klant binnenkomt --
       en wat een afnemer krijgt, moet hij krijgen ongeacht in welke volgorde de
       spelers in dit object staan. */
    const actief = (st.contracten || []).filter(c => c.status === 'loopt'
      && st.maand + 1 >= c.startMaand && st.maand < c.eindMaand);
    const toezegging = {}, ontvangst = {};
    for (const c of actief) {
      const t = toezegging[c.leverancierId] = toezegging[c.leverancierId] || { eenheden: 0, bedrag: 0 };
      t.eenheden += c.eenheden; t.bedrag += c.bedrag;
    }
    /* Wat elke leverancier ervan waarmaakt, met dezelfde functie die zijn eigen
       maand straks gebruikt. Komt een leverancier tekort, dan delen al zijn
       afnemers naar rato mee in dat tekort -- niet "wie het eerst getekend
       heeft krijgt alles", want dan bepaalt de volgorde in een object wie er
       failliet gaat. */
    const leverDeel = {};
    for (const [id, t] of Object.entries(toezegging)) {
      const w = wieHeeft(st, id);
      leverDeel[id] = w ? levering(w.v, arbeid, t.eenheden).deel : 0;
    }
    for (const c of actief) {
      const geleverd = c.eenheden * (leverDeel[c.leverancierId] || 0);
      const o = ontvangst[c.afnemerId] = ontvangst[c.afnemerId] || {};
      o[c.soort] = (o[c.soort] || 0) + geleverd;
    }
    /* Wat er deze maand aan RENTE de wereld verlaat. Apart geteld omdat het de
       enige post is die niet bij een andere speler landt; de geldpomp-meter
       moet hem kunnen aftrekken. */
    let rentelast = 0, premielast = 0, schadelast = 0, onderzoeklast = 0, onderzoekUitPot = 0, beheerlast = 0, concernlast = 0;
    for (const [h, rij] of Object.entries(st.vestigingen)) {
      const regels = [];
      /* DE MAAND VAN ELKE ZAAK staat in ./maand-vestiging.js. Dit bestand rekent
         de maand van de WERELD -- de concurrentiedruk, de conjunctuur, de krant,
         wat de contracten vastleggen -- en die twee horen niet in een bestand:
         de wereldkant ligt vast sinds fase A, de zaakkant groeit met elke laag
         mee (fase B zette er de levering in, de kwaliteitsmeting en de
         verdeling onder aandeelhouders). */
      wereldOmzet += perZaak(potje, h, rij, regels, { k, druk, zones, conjunctuur,
        arbeid, toezegging, ontvangst, kwaliteitVan });
      /* WAT ER NA DE ZAKEN NOG VAN DE KAS AFGAAT staat in ./maand-lasten.js:
         rood staan, de leningen, de polissen en het onderzoek. Vier posten die
         niet aan een pand hangen maar aan de speler, en die alle vier geld de
         WERELD uit laten gaan -- daarom staan ze bij elkaar en worden ze hier
         als EEN som opgeteld. Zie de uitleg daar. */
      /* IN WELKE BUURT EEN ZAAK STAAT, meegegeven vanaf HIER omdat de kaart hier
         al opgehaald is. Het concern rekent met spreiding over sectoren en
         zones, en een tweede kaartlezing zou een tweede antwoord zijn. */
      const uit = lasten(potje, h, regels, (v) => {
        const kav = k.kavel.get(v.kavel);
        return kav ? kav.zone : null;
      });
      rentelast += uit.rente;
      premielast += uit.premie;
      schadelast += uit.schade;
      onderzoeklast += uit.onderzoek;
      onderzoekUitPot += uit.onderzoekUitPot;
      beheerlast += uit.beheer;
      concernlast += uit.concern;
      /* DE SALARISSEN, en ze staan bij de VESTIGINGEN en niet bij de lasten in
         ./maand-lasten.js. Zie de uitleg bij `maandregels` in ./dienst.js: dat
         bestand gaat over geld dat de WERELD verlaat, en een salaris doet
         precies het omgekeerde. */
      for (const r of DIENST.maandregels(st, h, (van, naar, bedrag) => {
        st.geld[van] -= bedrag; st.geld[naar] += bedrag;
      })) regels.push(r);
      perSpeler[h] = regels;
      // het maandresultaat in het korte geheugen, voor de winststabiliteit
      if (onthoud) onthoud(st, h, regels.reduce((n, r) => n + (r.resultaat || 0), 0));
    }
    /* WAT ER NA DE BEDRIJVEN GEBEURT staat in ./maand-afsluiten.js: de contracten
       afwikkelen, de Foundation laten afdragen en bouwen, en het verslag
       opmaken. Drie dingen die pas kunnen zodra iedereen gedraaid heeft. */
    DIENST.verlopen(st);
    const verslag = afsluiten(potje, st, k, { perSpeler, actief, leverDeel, kwaliteitVan, druk,
      wereldOmzet, rentelast, premielast, schadelast, onderzoeklast, onderzoekUitPot, beheerlast,
      concernlast });
    return verslag;
  }

  return { eenMaand };
};
