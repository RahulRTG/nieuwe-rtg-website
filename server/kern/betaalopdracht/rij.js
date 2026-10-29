/* De betaalopdrachten als RIJ: alles wat over de verzameling gaat in plaats van
   over één opdracht. Wat een opdracht is staat in ./index, het aanbieden bij de
   rail in ./inzending, de bevestiging van buiten in ./bevestiging; hier staat
   wie er aan de beurt is en wat er nog openstaat.

   De snede zit op die grens en niet op een willekeurige regel: die kant weet hoe
   een betaling zich gedraagt, deze kant weet alleen dat het er meer dan een
   zijn. Krijgt de gedeelde ctx van ./index. */
'use strict';

module.exports = (ctx) => {
  const { d, save, nu, STATUS, AF, OPEN, publiek, zet, klacht, ramMax } = ctx;
  const { maakOpenstaandOverzicht } = require('./status');
  const opslag = require('./opslag')(d);
  const rij = opslag.schrijfRij, rijLezen = opslag.leesRij;
  /* Een nieuwe opdracht in de rij zetten, en de rij op maat houden. Opruimen mag
     ALLEEN wat af is: de staart afknippen zonder te kijken is precies hoe boeking
     50.001 verdween (LAT.md regel 1), en hier zou het een openstaande betaling
     zijn die niemand meer indient. Blijven er te veel onafgeronde staan, dan is
     dat een storing en geen opslagprobleem -- dus klagen, niet wissen. */
  /* IDEMPOTENTIE, EN ZE WERKTE NIET. Elke opdracht droeg al een `idemSleutel` --
     'rtf:<lid>:<factuur>', 'pay-uit:<zaak>:<boeking>', 'bank-sepa:<iban>:<boeking>'
     -- die keurig aan de rail werd meegegeven. Alleen keek RTG er zelf nooit
     naar. Twee aanroepen met dezelfde sleutel leverden dus twee opdrachten van
     samen het dubbele bedrag, en of dat geld ook echt twee keer wegging hing af
     van de goede wil van een externe partij.

     Dat is precies de fout die dit huis elders opruimt: een veld dat eruitziet
     als een grendel en er geen is. Een zoekopdracht naar `idemSleutel` gaf zes
     plekken die hem SCHRIJVEN en geen enkele die hem LEEST.

     DE SLEUTEL IDENTIFICEERT DE ECONOMISCHE HANDELING, niet een poging. Bestaat
     hij al, dan krijgt de aanroeper de bestaande opdracht terug -- ook als die
     mislukt is. Opnieuw proberen is dan `dienIn` of de ronde, en dat is het hele
     punt: een herhaling hoort dezelfde handeling te raken en geen tweede te
     maken. Wie werkelijk een nieuwe betaling wil, heeft een nieuwe sleutel.

     `hergebruikt` staat erbij zodat een aanroeper (en een toets) het verschil
     kan zien. Stil dezelfde opdracht teruggeven zou een tweede stil gedrag zijn
     op de plek waar we er net een weghalen. */
  function vindOpIdem(sleutel) {
    const k = String(sleutel || '');
    /* De lege-sleutel-afslag is een SNELKOPPELING en geen grendel -- dezelfde
       lezing als bij vindOpSettlement hieronder. Elke opdracht die via maak()
       ontstaat draagt een sleutel (desnoods 'opdracht:' + ledgerRef, en
       ledgerRef is verplicht), dus er staat nooit een lege in de rij en zonder
       deze regel zou de lus alleen zinloos de hele rij aflopen. Het als grendel
       opschrijven zou suggereren dat er een geval is dat hij tegenhoudt. */
    if (!k) return null;
    const r = rijLezen();
    for (let i = r.length - 1; i >= 0; i--) if (r[i].idemSleutel === k) return r[i];
    return null;
  }

  /* DEZELFDE SLEUTEL IS NOG NIET DEZELFDE HANDELING. Tot 18 oktober 2026 gaf
     plaats() bij een bekende sleutel de bestaande opdracht terug zonder te
     kijken wat er nu werd aangeboden (IDEMIDENTITEIT.json: `geenVergelijking`).
     Twee aanroepers bouwen de sleutel uit een idem van de CLIENT
     ('bank-sepa:<iban>:<idem>', 'pay-uit:<zaak>:<idem>'), en de afboeking
     ervoor is dan al gedaan. Kwam dezelfde idem terug met een ander bedrag of
     een andere bestemming, dan stond het nieuwe geld op de tussenrekening en
     ging de OUDE opdracht de deur uit -- het verschil verdween zonder spoor.

     Daarom de economische identiteit vergelijken: soort, bedrag, bron en
     bestemming. Wijkt er een af, dan is dit een ANDERE handeling onder een
     gebruikte sleutel, en dat is een fout van de aanroeper die luid hoort te
     zijn. maak() gooit al bij een ongeldig bedrag of een ontbrekende boeking;
     dit is dezelfde vorm, zodat de omvattende bundel de afboeking mee
     terugdraait in plaats van haar te laten staan. De omschrijving en het
     moment tellen NIET mee: die verschillen legitiem tussen twee pogingen. */
  function plaats(o) {
    const bestaand = vindOpIdem(o.idemSleutel);
    if (bestaand && (bestaand.soort !== o.soort || bestaand.centen !== o.centen ||
        bestaand.bron !== o.bron || bestaand.bestemming !== o.bestemming)) {
      klacht('een gebruikte idempotentiesleutel kwam terug met een andere opdracht', {
        idemSleutel: o.idemSleutel, bestaand: bestaand.id,
        verschil: ['soort', 'centen', 'bron', 'bestemming'].filter(k => bestaand[k] !== o[k]) });
      const e = new Error('Deze idempotentiesleutel hoort al bij een andere betaalopdracht ' +
        '(ander bedrag, andere bron of andere bestemming). Er is niets aangeboden.');
      e.code = 'idem-andere-opdracht';
      throw e;
    }
    if (bestaand) {
      klacht('dezelfde economische handeling werd twee keer aangeboden', {
        idemSleutel: o.idemSleutel, bestaand: bestaand.id, status: bestaand.status, centen: o.centen });
      bestaand.hergebruikt = true;
      return bestaand;
    }
    const r = rij();
    r.push(o);
    if (r.length > ramMax) {
      const teveel = r.length - ramMax;
      let weg = 0;
      for (let i = 0; i < r.length && weg < teveel; i++) { if (AF.has(r[i].status)) { r.splice(i, 1); i--; weg++; } }
      if (weg < teveel) klacht('de opdrachtenrij loopt vol met onafgeronde opdrachten', { open: r.length - weg, ram: ramMax });
    }
    save();
    return o;
  }

  /* De ronde: alles wat aan de beurt is opnieuw indienen. Draait niet over
     zichzelf heen (een tweede ronde tijdens een lopende doet niets), want twee
     rondes zouden dezelfde opdracht twee keer bij de rail aanbieden -- de
     idempotentiesleutel vangt dat op, maar erop leunen is geen ontwerp.

     Een opgegeven opdracht (MISLUKT) blijft liggen: die is al zes keer
     geprobeerd en het geld is terug. Hem weer oppakken is een besluit van het
     kantoor, geen werk van een tik. Een ONBEKENDE ook: die wacht op een
     uitspraak van de rail, en blijven aanbieden verandert daar niets aan. */
  let bezig = false;
  async function ronde({ tot } = {}) {
    if (bezig) return { ok: true, overgeslagen: true, reden: 'er loopt al een ronde' };
    bezig = true;
    const grens = Number.isFinite(tot) ? tot : nu();
    let gedaan = 0, gelukt = 0, opgegeven = 0;
    try {
      for (const o of rijLezen().filter(x => !AF.has(x.status) && x.status !== STATUS.MISLUKT && x.status !== STATUS.ONBEKEND && (x.volgendeAt || 0) <= grens)) {
        const voor = o.status;
        await ctx.dienIn(o);
        gedaan++;
        if ((o.status === STATUS.INGEDIEND || o.status === STATUS.AFGEWIKKELD) && voor === STATUS.GEBOEKT) gelukt++;
        if (o.status === STATUS.MISLUKT || o.status === STATUS.TERUGGEBOEKT) opgegeven++;
      }
      /* Crash tussen externe bevestiging en de interne claim-/ledgerfinalisatie:
         AFGEWIKKELD blijft waar over de rail, maar is pas klaar als ook de hook
         duurzaam is verwerkt. De ronde herstelt precies die naad. */
      for (const o of rijLezen().filter(x => x.status === STATUS.AFGEWIKKELD && x.afwikkelingNodig && !x.afwikkelingVerwerktAt))
        await ctx.verwerkAfwikkeling(o);
    } finally { bezig = false; }
    return { ok: true, gedaan, gelukt, opgegeven };
  }

  /* DE BEVESTIGING VAN BUITEN (de provider-webhook) woont in ./bevestiging.js:
     dat is de grens tussen wat RTG zelf over de rij weet en wat de rail ons
     vertelt. Hij leest de rij via vind() en vindOpSettlement() hieronder. */
  const { bevestig } = require('./bevestiging')(ctx, { vind: (id) => vind(id), vindOpSettlement: (r) => vindOpSettlement(r) });

  function openstaand() { return maakOpenstaandOverzicht(rijLezen()); }

  function vind(id) { return rijLezen().find(o => o.id === String(id || '')) || null; }
  /* Opzoeken op de referentie van de rail. NIEUWSTE EERST, en dat is het enige
     wat hier gedrag is: dezelfde ref kan aan twee opdrachten hangen als er met
     de hand opnieuw is ingediend, en dan gaat de webhook over de laatste poging.
     De lege-ref-afslag eronder is een snelkoppeling en geen grendel -- een
     settlementRef is null of een echte string, nooit leeg, dus zonder die regel
     zou de lus alleen zinloos de hele rij aflopen. */
  function vindOpSettlement(ref) {
    const r = String(ref || '');
    if (!r) return null;
    const opdrachten = rijLezen();
    for (let i = opdrachten.length - 1; i >= 0; i--) if (opdrachten[i].settlementRef === r) return opdrachten[i];
    return null;
  }
  function lijst({ limit = 50, status, ledgerRef, bron } = {}) {
    let r = rijLezen().slice().reverse();
    if (status) r = r.filter(o => o.status === status);
    if (ledgerRef) r = r.filter(o => o.ledgerRef === ledgerRef);
    if (bron) r = r.filter(o => o.bron === bron);
    return { status: 200, aantal: r.length, opdrachten: r.slice(0, Math.min(500, Math.max(1, limit))).map(publiek) };
  }

  return { plaats, ronde, bevestig, openstaand, vind, vindOpSettlement, vindOpIdem, lijst };
};
