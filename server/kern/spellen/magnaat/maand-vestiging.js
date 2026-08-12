/* Magnaat: DE MAAND VAN EEN ZAAK -- wat er bij een vestiging gebeurt.

   Afgesplitst van ./maand.js op de naad die daar met elke laag duidelijker werd.
   Dat bestand rekent de maand van de WERELD: de concurrentiedruk, de
   conjunctuur, de krant, wat de contracten vastleggen, en daarna de posten die
   aan een SPELER hangen. Dit bestand gaat over wat er bij een PAND gebeurt.

   De twee hebben een verschillend tempo, en dat is de echte reden dat ze uit
   elkaar horen. De wereldkant ligt vast sinds fase A; de zaakkant kreeg er in
   fase B de levering bij, de kwaliteitsmeting, de verdeling onder
   aandeelhouders en het effect van de Foundation-projecten op het kavel.

   HIJ GEEFT DE STADSOMZET TERUG en zet zelf de kas. Dat is geen elegantie maar
   nauwkeurigheid: de omzet van de STAD telt alleen eindverkoop, en wie dat
   getal buiten deze functie zou optellen, telt de leveringen tussen spelers
   dubbel -- en dan groeit de Foundation-pot van geld dat heen en weer schuift. */
'use strict';

module.exports = ({ verdeel, rekenMaand, F, N }) => {
  /* Een speler, zijn zaken, en de regels die eruit komen. Geeft terug wat er aan
     STADSOMZET bij kwam; de regels worden op `regels` geduwd en de kas wordt
     hier gezet, want de verdeling onder aandeelhouders bepaalt wie wat krijgt. */
  return function perZaak(potje, h, rij, regels, { k, druk, zones, conjunctuur,
    arbeid, toezegging, ontvangst, kwaliteitVan, dervingFactor }) {
    const st = potje.staat;
    let wereldOmzet = 0;
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
          /* DE WERELDFACTOR IS DE GOLF MAAL DE BUIEN. Ze staan hier bij elkaar
             en niet apart in ./stap.js, want voor een vestiging is er maar EEN
             vraag; welk deel daarvan uit de conjunctuur komt en welk deel uit
             een festival om de hoek, is een vraag voor de krant en niet voor de
             boekhouding. */
          wereldFactor: conjunctuur * N.factorVoor(potje.id, st.maand, zones,
            { zone: kavel.zone, sector: v.sector }),
          arbeid, contract: toezegging[v.id], gedekt: ontvangst[v.id],
          /* WAT DE DIENST VAN DEZE MAAND MET DE DERVING DEED (VERHAAL.md par.
             0f). Ontbreekt hij -- niemand in dienst, niet gespeeld, niet
             afgemaakt -- dan is hij `undefined` en rekent ./stap.js met 1: de
             maand die er zonder deze laag ook was geweest. Dat is wet 4, en het
             is de reden dat hij als FACTOR reist en niet als bedrag. */
          dervingFactor: (dervingFactor || {})[v.id] });
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
    return wereldOmzet;
  };
};
