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
const F = require('./foundation');
const H = require('./handel');

const rond = (n) => Math.round(n);

module.exports = ({ K, wieHeeft, ROOD_RENTE, verdeel, bank, onthoud, verzekering, rnd }) => {
  const { wikkelAf } = require('./maand-contracten')({ rond });
  const { lasten } = require('./maand-lasten')({ ROOD_RENTE, bank, verzekering, rnd });
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
    let rentelast = 0, premielast = 0, schadelast = 0, onderzoeklast = 0, onderzoekUitPot = 0;
    for (const [h, rij] of Object.entries(st.vestigingen)) {
      const regels = [];
      for (const v of rij) {
        const kavel = k.kavel.get(v.kavel);
        /* De Foundation-projecten verschuiven de eigenschappen van het kavel.
           Dat gebeurt HIER en niet in de kaart zelf: de kaart is gedeeld tussen
           partijen, en een project in de ene partij hoort de andere niet te
           raken. */
        const effect = F.effectOp(st.foundation, kavel);
        const opgeschoven = Object.assign({}, kavel, {
          eigenschappen: Object.fromEntries(Object.entries(kavel.eigenschappen)
            .map(([veld, w]) => [veld, w + (effect[veld] || 0)]))
        });
        const kOp = Object.assign({}, k, { kavel: new Map(k.kavel).set(kavel.id, opgeschoven) });
        const r = rekenMaand(kOp, v, { maand: st.maand, zoneDruk: druk[kavel.zone + ':' + v.sector] || 1,
          wereldFactor: 1, arbeid, contract: toezegging[v.id], gedekt: ontvangst[v.id] });
        const regel = Object.assign({ id: v.id, naam: v.naam, sector: v.sector, kavel: kavel.naam }, r);
        regels.push(regel);
        /* HET RESULTAAT WORDT VERDEELD als er aandeelhouders zijn (./aandeel.js).
           De eigenaar houdt wat er niet vergeven is, de rest gaat rechtstreeks
           naar de houders -- winst en verlies allebei. Staat er niets uit, dan
           gaat het hele bedrag naar de eigenaar en verandert er niets. */
        const verdeeld = verdeel(st, v.id, r.resultaat);
        st.geld[h] += verdeeld.eigenaar;
        /* OP DE GEPUSHTE REGEL en niet op `r`: de regel is een KOPIE die hierboven
           is gemaakt, dus een veld dat er daarna op `r` bij komt haalt het
           maandoverzicht nooit. Dat is precies zo misgegaan, en het viel op
           omdat de uitkering wel klopte en het overzicht hem niet toonde. */
        if (verdeeld.uit.length) regel.aandeelhouders = verdeeld.uit;
        /* De omzet van de STAD telt alleen eindverkoop. Een levering tussen twee
           spelers is geen nieuwe bedrijvigheid maar dezelfde euro die twee keer
           langskomt; hem meetellen zou de Foundation-pot laten groeien van
           spelers die geld heen en weer schuiven. */
        wereldOmzet += r.omzet - ((r.levering && r.levering.omzet) || 0);
        kwaliteitVan[v.id] = r.kwaliteit;
        v.laatsteBezetting = r.bezetting;
      }
      /* WAT ER NA DE ZAKEN NOG VAN DE KAS AFGAAT staat in ./maand-lasten.js:
         rood staan, de leningen, de polissen en het onderzoek. Vier posten die
         niet aan een pand hangen maar aan de speler, en die alle vier geld de
         WERELD uit laten gaan -- daarom staan ze bij elkaar en worden ze hier
         als EEN som opgeteld. Zie de uitleg daar. */
      const uit = lasten(potje, h, regels);
      rentelast += uit.rente;
      premielast += uit.premie;
      schadelast += uit.schade;
      onderzoeklast += uit.onderzoek;
      onderzoekUitPot += uit.onderzoekUitPot;
      perSpeler[h] = regels;
      // het maandresultaat in het korte geheugen, voor de winststabiliteit
      if (onthoud) onthoud(st, h, regels.reduce((n, r) => n + (r.resultaat || 0), 0));
    }
    /* DE CONTRACTEN AFWIKKELEN staat in ./maand-contracten.js -- na de maand,
       want de kwaliteitseis gaat over de kwaliteit die er DEZE maand geleverd
       is, en die volgt uit de maand. */
    const contractRegels = wikkelAf(st, actief, leverDeel, kwaliteitVan);

    /* De afdracht rust op de HELE stad en niet alleen op de spelers: anders
       bouwt de Foundation in een partij met twee mensen nooit iets. Zie de
       reden bij `stadsomzet` in de stadsdata. */
    const afdracht = F.draagAf(st.foundation, wereldOmzet + (k.stadsomzet || 0));
    /* Waar de bedrijvigheid zit, zodat de Foundation daar bouwt. Uit dezelfde
       telling die de concurrentiedruk gebruikt: een tweede telling zou een
       tweede antwoord op dezelfde vraag zijn. */
    const perZone = {};
    for (const sleutel of Object.keys(druk)) {
      const zone = sleutel.split(':')[0];
      perZone[zone] = (perZone[zone] || 0) + druk[sleutel];
    }
    const projecten = F.bouw(st.foundation, k, perZone);
    st.maand++;
    const verslag = { maand: st.maand, perSpeler, afdracht, projecten,
      wereldOmzet: rond(wereldOmzet), contractRegels,
      rentelast: rond(rentelast), premielast: rond(premielast),
      schadelast: rond(schadelast), onderzoeklast: rond(onderzoeklast),
      onderzoekUitPot: rond(onderzoekUitPot) };
    for (const h of potje.spelers) st.laatste[h] = { maand: st.maand, regels: perSpeler[h] || [],
      projecten, contracten: contractRegels[h] || [] };
    return verslag;
  }

  return { eenMaand };
};
