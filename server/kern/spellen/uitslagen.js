/* Spellen (deelmodule): uitslagen die een potje overleven.

   TOT NU BESTOND ER GEEN UITSLAG. Een klaar potje werd na 24 uur weggegooid
   (`opschonen` in kern/spellen.js) en `db.data.spellen` bevatte alleen
   `potjes` en `wachtrij`. Alles wat op een geschiedenis leunt -- winrate,
   niveaus, prestaties, toernooien, replays -- had dus geen bron. Dit is die
   bron, en met opzet niet meer dan dat: wie wat won, wanneer. Geen zetten
   (dat is een replay en een eigen ontwerp), geen punten, geen stand.

   WIE ERIN KOMT, EN WIE NIET. De progressiegrens geldt hier net zo hard als
   bij de ranglijsten: alles wat een prestatie BUITEN het potje bewaart bestaat
   alleen voor geverifieerd volwassen leden. Maar een partij heeft meer dan een
   speler, en "dan bewaren we hem niet" zou betekenen dat een volwassene zijn
   eigen historie kwijtraakt zodra hij met een tiener speelt -- precies het
   samen spelen dat we willen aanmoedigen zou zichzelf uitwissen.

   Daarom: de partij wordt bewaard, maar alleen deelnemers BINNEN de grens
   staan er met codenaam in. Wie erbuiten valt staat er als `{ anoniem: true }`.
   Speelde niemand binnen de grens mee, dan wordt er niets bewaard -- een potje
   tussen tieners onderling laat geen enkel spoor na.

   WAT DIT WEL EN NIET BESCHERMT, want dat scheelt. Het voorkomt dat het
   systeem een PROFIEL opbouwt van iemand onder de grens: geen historie, geen
   totalen, geen ranglijst, niets om later alsnog te tonen. Het verbergt niet
   dat je met iemand hebt gespeeld voor de tegenstander zelf -- die zat erbij en
   weet dat gewoon. Anonimiteit gaat hier over wat de SERVER onthoudt, niet
   over wat de ander gezien heeft, en die twee door elkaar halen zou een
   belofte zijn die niemand kan waarmaken.

   WAAR HET STAAT. In `db.data.spelUitslagen`, op het hoogste niveau en niet
   genest onder `spellen`. Dat is geen smaak: de bewaarmotor
   (server/bewaartermijnen.js) leest `db.data[tak]`, dus een genest lijstje zou
   buiten het bewaarbeleid vallen en op de lijst `zonderBeleid()` belanden. De
   termijn staat in server/bewaarbeleid.js. */
module.exports = (ctx) => {
  const { db, save, codenaamVan, progressieMag, nu } = ctx;

  // harde bovengrens op schijf, los van de bewaartermijn: een database die
  // volloopt is een storing, en die willen we niet van een termijn af laten hangen
  const MAX = 20000;

  function U() {
    if (!Array.isArray(db.data.spelUitslagen)) db.data.spelUitslagen = [];
    return db.data.spelUitslagen;
  }

  /* De winnaars als SLEUTELS. `potje.winnaar` is een weergavetekst -- een
     codenaam, of bij teams twee codenamen met ' & ' ertussen -- en daar kun je
     geen stand op bouwen. Terugrekenen mag hier exact: die tekst is gemaakt
     door `codenaamVan` los te laten op precies deze spelers, dus vergelijken
     met dezelfde functie geeft dezelfde namen terug. We raden niets. */
  function winnaarsVan(potje) {
    if (!potje.winnaar || potje.gelijk) return [];
    const delen = String(potje.winnaar).split(' & ').map(x => x.trim());
    return potje.spelers.filter(k => delen.includes(codenaamVan(k)));
  }

  /* Een afgelopen potje vastleggen. Idempotent: hij wordt aangeroepen vanuit
     zowel een winnende zet als opgeven, en een potje kan maar een keer klaar
     zijn. Zonder die vlag zou een tweede aanroep (een herhaalde zet, een
     retry) dezelfde partij dubbel in de stand zetten. */
  function noteerUitslag(potje) {
    if (!potje || potje.status !== 'klaar' || potje.uitslagGenoteerd) return null;
    const binnen = potje.spelers.filter(k => progressieMag(k));
    potje.uitslagGenoteerd = true;
    // niemand binnen de grens: geen spoor, ook niet anoniem
    if (!binnen.length) return null;

    const winnaars = winnaarsVan(potje);
    const rij = {
      id: potje.id,
      soort: potje.soort,
      modus: potje.modus,
      at: nu(),
      spelers: potje.spelers.map(k => progressieMag(k)
        ? { key: k, codenaam: codenaamVan(k), won: winnaars.includes(k) }
        : { anoniem: true, won: winnaars.includes(k) }),
      gelijk: !!potje.gelijk
    };
    const lijst = U();
    lijst.push(rij);
    if (lijst.length > MAX) lijst.splice(0, lijst.length - MAX);
    save();
    return rij;
  }

  /* De eigen historie. Alleen voor wie binnen de progressiegrens valt: een
     lijst teruggeven aan iemand die er zelf niet in mag staan zou de grens
     alsnog omzeilen. Anderen in de partij komen er op codenaam in, of als
     "een medespeler" wanneer ze buiten de grens vallen. */
  function spelUitslagen(mij, hoeveel) {
    if (!progressieMag(mij)) {
      return { status: 200, uitslagen: [], progressie: false,
        reden: 'Uitslagen worden bewaard voor leden met een geverifieerde volwassen leeftijd. Het spel zelf speel je gewoon.' };
    }
    const n = Math.max(1, Math.min(100, Number(hoeveel) || 25));
    const mijne = U().filter(r => r.spelers.some(s => s.key === mij));
    const uit = mijne.slice(-n).reverse().map(r => ({
      id: r.id, soort: r.soort, modus: r.modus, at: r.at, gelijk: r.gelijk,
      ik: (r.spelers.find(s => s.key === mij) || {}).won === true,
      tegen: r.spelers.filter(s => s.key !== mij)
        .map(s => ({ codenaam: s.anoniem ? null : s.codenaam, won: !!s.won }))
    }));
    return { status: 200, uitslagen: uit, progressie: true };
  }

  return { noteerUitslag, spelUitslagen, _winnaarsVan: winnaarsVan };
};
