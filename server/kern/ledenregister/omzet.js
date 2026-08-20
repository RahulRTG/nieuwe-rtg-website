/* WAT BRENGEN DE LEDEN OP -- de omzetkant van het ledenregister.

   ../ledenregister.js telt WIE er lid is: per trede, per land, per stad. Dit
   bestand rekent wat dat opbrengt, en dat is een ander onderwerp -- de een
   verandert als er een facet bij komt, de ander als er een prijsvorm bij komt.

   DRIE VALKUILEN DIE HIER ALLE DRIE ECHT ZIJN INGELOPEN:

   1. `|| 0` ALS TERUGVAL OP DE PRIJSLIJST. Op een verse installatie toonde de
      omzetstaat dan NUL euro per lid, terwijl het betaalschema wel 65 euro in
      rekening bracht. Twee kopieen, twee antwoorden op dezelfde vraag. Nu is
      "geen prijslijst" iets anders dan "nul euro".
   2. EEN VASTE VERGELIJKING OP 'business'. Sinds Lifestyle ook contractueel is,
      zou dat voor Lifestyle nul euro tonen in plaats van "geen bedrag". `opMaat`
      volgt daarom de ladder en niet de naam.
   3. STIL UIT HET TOTAAL VALLEN. Leden op een contractuele trede zonder lopend
      contract staan apart als `zonderContract`. Zo'n lid weglaten is precies hoe
      een omzetstaat compleet LIJKT terwijl hij het niet is.

   EN ER WORDT NIETS GESCHAT. Een omzetstaat met een geraden getal erin is erger
   dan een die eerlijk zegt dat het er niet in zit. */
'use strict';

function maakOmzet({ db, geldPasprijzen, PAS_VOLGORDE, PAS_NAAM, contractueel, maandCentenVoor, eur }) {
  /* De contracten, voor de omzet van de contractuele treden. Laat-gebonden en
     defensief: dit is een RAPPORTAGE, en een omzetstaat die omvalt omdat de
     contractentabel er nog niet is, is erger dan een omzetstaat zonder die
     kolom. */
  function contractenVan(pas) {
    try {
      const rijen = (db && db.data && db.data.contracten) || [];
      return rijen.filter(c => c.pas === pas && Number.isFinite(c.afgesprokenCenten) &&
        !['GEEINDIGD', 'CONCEPT', 'AANGEBODEN'].includes(c.status));
    } catch (e) { return []; }
  }

  function omzetstaat(passen) {
  // de omzet per pas en de 30%-foundationsplit (20% lokaal, 10% RTF)
  /* Uit ../pasprijs.js, net als het betaalschema en de ledenfacturen. Hier
     stond `|| 0` als terugval, en dat is stiller dan het lijkt: op een verse
     installatie (nog niets ingesteld in de boardroom) toonde de omzetstaat dan
     NUL euro per lid, terwijl het betaalschema wel 65 euro in rekening bracht.
     Twee kopieen, twee antwoorden op dezelfde vraag. */
  const prijslijst = (() => { try { const p = geldPasprijzen && geldPasprijzen(); return (p && p.passen) || null; } catch (e) { return null; } })();
  const omzet = PAS_VOLGORDE.map(pas => {
    const aantal = passen[pas] || 0;
    /* `opMaat` volgt de ladder en niet de naam 'business'. Sinds Lifestyle
       ook contractueel is, zou een vaste vergelijking op 'business' voor
       Lifestyle NUL euro tonen in plaats van "geen bedrag" -- precies de
       `|| 0`-val die drie regels hoger beschreven staat. */
    const opMaat = contractueel(pas);

    /* CONTRACTUELE TREDEN TELLEN NU WEL MEE, maar uit de CONTRACTEN en niet
       uit een lijstprijs maal een aantal. Dat is geen schatting: het is de
       som van wat er werkelijk is afgesproken.

       Wat er apart bij staat is `zonderContract`: leden met deze pas voor wie
       geen lopend contract te vinden is. Die zijn er niet horen te zijn -- het
       besluit weigert een akkoord zonder bedrag -- maar een rij uit de tijd
       voor de ladder heeft er geen. Zo'n lid stil uit het totaal laten vallen
       is precies hoe een omzetstaat compleet lijkt terwijl hij het niet is. */
    if (opMaat) {
      const ctr = contractenVan(pas);
      const som = ctr.reduce((n, c) => n + c.afgesprokenCenten, 0);
      return { pas, pasNaam: PAS_NAAM[pas], aantal, opMaat: true,
        prijsPP: null,
        maandOmzet: ctr.length ? eur(som) : null,
        uitContracten: ctr.length,
        zonderContract: Math.max(0, aantal - ctr.length) };
    }
    const centenPP = maandCentenVoor(prijslijst, pas) || 0;
    const maandCentenTot = centenPP * aantal;
    return { pas, pasNaam: PAS_NAAM[pas], aantal, opMaat: false,
      prijsPP: eur(centenPP), maandOmzet: eur(maandCentenTot) };
  });
  // totaal alleen over de passen met een bekende prijs (Business is op maat)
  /* Het totaal loopt nu over ALLE treden met een bekend bedrag -- ook de
     contractuele, want die dragen sinds de Contract Engine hun eigen som. Wie
     geen contract heeft, telt niet mee en staat als `zonderContract`. */
  const totaalCenten = omzet.reduce((s, o) => s + (o.maandOmzet != null ? Math.round(o.maandOmzet * 100) : 0), 0);
  const split = {
    totaalOmzet: eur(totaalCenten),
    foundation30: eur(Math.round(totaalCenten * 0.30)),
    lokaal20: eur(Math.round(totaalCenten * 0.20)),
    rtf10: eur(Math.round(totaalCenten * 0.10)),
    /* Het aantal leden op een CONTRACTUELE trede (Business, Lifestyle): hun
       bijdrage staat op hun contract en niet in de prijslijst, dus ze zitten
       niet in `totaalOmzet` hierboven. De oude naam blijft staan omdat het
       kantoorscherm hem zo kent; hij telt nu alleen niet langer alleen
       Business, want sinds de ladder is Lifestyle het net zo goed.

       WAT HIER NOG ONTBREEKT en bewust niet wordt geraden: de afgesproken
       bedragen zelf. Die staan op de aanmelding (kern/aanmeldingen/besluit.js
       -> a.contract) en deze staat leest de accountlaag, niet de
       aanmeldingen. Optellen zou hier dus een schatting worden, en een
       omzetstaat met een geschat getal erin is erger dan een die eerlijk zegt
       dat het er niet in zit. Zie PRIJZEN.md. */
    /* Het aantal leden op een contractuele trede WAARVOOR GEEN CONTRACT staat.
       Dat is het getal dat er echt toe doet: zij zitten niet in het totaal.
       Was dit ooit het aantal contractuele leden -- toen telde geen van hen
       mee -- nu telt alleen wie geen contract heeft nog buiten de boot. */
    businessOpMaat: omzet.filter(o => o.opMaat).reduce((n, o) => n + (o.zonderContract || 0), 0)
  };
    return { omzet, split };
  }

  return { omzetstaat, contractenVan };
}

module.exports = { maakOmzet };
