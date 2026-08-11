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

module.exports = ({ K, wieHeeft, ROOD_RENTE, verdeel }) => {
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
      }
      /* ROOD STAAN KOST GELD. Zonder dit is overinvesteren gratis: je kas gaat
         onder nul en er gebeurt niets. Echte financiering (leningen met een
         looptijd en een risico-opslag) hoort bij fase B; dit is de rekening-
         courant eronder, zodat de keuze om door te bouwen nu al een prijs
         heeft. */
      if (st.geld[h] < 0) {
        const rente = -st.geld[h] * ROOD_RENTE;
        st.geld[h] -= rente;
        regels.push({ id: 'rood', naam: 'Rood staan', rente: rond(rente), resultaat: -rond(rente) });
      }
      perSpeler[h] = regels;
    }
    /* ---------- de contracten afwikkelen ----------
       NA de maand, want de kwaliteitseis gaat over de kwaliteit die er DEZE
       maand geleverd is, en die volgt uit de maand. En na de rentepost, zodat
       een boete niet stilletjes de rente van iemand anders verandert.

       De leverancier is al betaald: zijn contractomzet zit in zijn maand (zie
       ./stap.js). Hier gaat alleen de andere kant rond -- de afnemer betaalt,
       en boetes lopen van leverancier naar afnemer. Zo staat elk bedrag een
       keer op een rekening, en klopt de som over alle spelers. */
    const contractRegels = {};
    for (const c of actief) {
      const r = H.afwikkelen(c, { geleverd: c.eenheden * (leverDeel[c.leverancierId] || 0),
        kwaliteit: kwaliteitVan[c.leverancierId] === undefined ? 0 : kwaliteitVan[c.leverancierId] });
      st.geld[c.afnemer] -= r.betaling;
      c.betaald += r.betaling; c.ontvangen += r.betaling;
      if (r.boete > 0) {
        st.geld[c.leverancier] -= r.boete;
        st.geld[c.afnemer] += r.boete;
        c.boetes += r.boete;
        c.maandenTekort++;
      } else c.maandenGeleverd++;
      const regel = { id: c.id, soort: c.soort, geleverd: rond(r.geleverd), toegezegd: c.eenheden,
        bedrag: rond(r.betaling), boete: rond(r.boete), tekort: r.tekort, onderMaat: r.onderMaat };
      for (const kant of ['leverancier', 'afnemer'])
        (contractRegels[c[kant]] = contractRegels[c[kant]] || []).push(Object.assign({ rol: kant }, regel));
      if (st.maand + 1 >= c.eindMaand) c.status = 'afgelopen';
    }
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
    const verslag = { maand: st.maand, perSpeler, afdracht, projecten, wereldOmzet: rond(wereldOmzet), contractRegels };
    for (const h of potje.spelers) st.laatste[h] = { maand: st.maand, regels: perSpeler[h] || [],
      projecten, contracten: contractRegels[h] || [] };
    return verslag;
  }

  return { eenMaand };
};
