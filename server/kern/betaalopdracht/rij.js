/* De betaalopdrachten als RIJ: alles wat over de verzameling gaat in plaats van
   over één opdracht. Wat een opdracht is staat in ./index, het aanbieden bij de
   rail in ./inzending; hier staat wie er aan de beurt is, wat er nog openstaat,
   en de bevestiging van buiten.

   De snede zit op die grens en niet op een willekeurige regel: die kant weet hoe
   een betaling zich gedraagt, deze kant weet alleen dat het er meer dan een
   zijn. Krijgt de gedeelde ctx van ./index. */
'use strict';

module.exports = (ctx) => {
  const { rij, save, nu, STATUS, AF, OPEN, publiek, zet, klacht, ramMax } = ctx;
  const { maakOpenstaandOverzicht } = require('./status');
  // dienIn wordt door ./index pas NA dit bestand op de ctx gezet (de twee delen
  // kennen elkaar over en weer), dus lezen we hem per aanroep en niet hier
  const dienIn = (o) => ctx.dienIn(o);

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
    const r = rij();
    for (let i = r.length - 1; i >= 0; i--) if (r[i].idemSleutel === k) return r[i];
    return null;
  }

  function plaats(o) {
    const bestaand = vindOpIdem(o.idemSleutel);
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
     kantoor, geen werk van een tik. */
  let bezig = false;
  async function ronde({ tot } = {}) {
    if (bezig) return { ok: true, overgeslagen: true, reden: 'er loopt al een ronde' };
    bezig = true;
    const grens = Number.isFinite(tot) ? tot : nu();
    let gedaan = 0, gelukt = 0, opgegeven = 0;
    try {
      for (const o of rij().filter(x => !AF.has(x.status) && x.status !== STATUS.MISLUKT && (x.volgendeAt || 0) <= grens)) {
        const voor = o.status;
        await dienIn(o);
        gedaan++;
        if ((o.status === STATUS.INGEDIEND || o.status === STATUS.AFGEWIKKELD) && voor === STATUS.GEBOEKT) gelukt++;
        if (o.status === STATUS.MISLUKT || o.status === STATUS.TERUGGEBOEKT) opgegeven++;
      }
      /* Crash tussen externe bevestiging en de interne claim-/ledgerfinalisatie:
         AFGEWIKKELD blijft waar over de rail, maar is pas klaar als ook de hook
         duurzaam is verwerkt. De ronde herstelt precies die naad. */
      for (const o of rij().filter(x => x.status === STATUS.AFGEWIKKELD && x.afwikkelingNodig && !x.afwikkelingVerwerktAt))
        await ctx.verwerkAfwikkeling(o);
    } finally { bezig = false; }
    return { ok: true, gedaan, gelukt, opgegeven };
  }

  /* DE BEVESTIGING VAN BUITEN (de provider-webhook): pas hier gaat een opdracht
     van "aangenomen" naar "definitief". Dit is het enige punt waarop RTG mag
     zeggen dat het geld er is, want tot dan weten we alleen dat de rail hem
     heeft aangenomen.

     Aanroepen kan op twee manieren: met onze eigen `id` (het kantoor), of met de
     `settlementRef` van de provider. Dat tweede is de payout-webhook in
     server/opzet/webhooks.js: die kent onze id niet, alleen zijn eigen.

     Meldt de rail een MISLUKKING, dan is de status zetten niet genoeg -- het
     geld staat van de klant af en komt nergens aan. Dan draait dezelfde
     terugboeking als bij opgeven. Zonder dat zou hier precies het gat terugkomen
     dat deze hele module dichtzet, alleen een dag later in de tijdlijn. */
  async function bevestig({ id, settlementRef, gelukt = true, reden }) {
    const o = id ? vind(id) : vindOpSettlement(settlementRef);
    if (!o) return { status: 404, error: 'Die betaalopdracht bestaat niet.' };
    if (gelukt) {
      const voor = Object.assign({}, o);
      zet(o, STATUS.AFGEWIKKELD, { settlementRef: settlementRef || o.settlementRef });
      try { save(); }
      catch (e) {
        /* Een mislukte persist mag niet alleen in RAM definitief worden. Een
           providerretry moet dezelfde overgang opnieuw kunnen vastleggen. */
        for (const sleutel of Object.keys(o)) if (!Object.prototype.hasOwnProperty.call(voor, sleutel)) delete o[sleutel];
        Object.assign(o, voor);
        throw e;
      }
      /* Een late `paid` na een al teruggeboekte mislukking is een conflict,
         geen toestemming om alsnog de interne claim/ledgerfinalisatie te
         draaien. Alleen de werkelijk afgewikkelde staat mag die haak bereiken. */
      if (o.status !== STATUS.AFGEWIKKELD) return publiek(o);
      const klaar = await ctx.verwerkAfwikkeling(o);
      if (!klaar) {
        const e = new Error('De payout is extern bevestigd, maar intern nog niet volledig afgehandeld.');
        e.code = 'PAYOUT_AFHANDELING_MISLUKT';
        throw e;
      }
      return publiek(o);
    }
    if (o.status === STATUS.TERUGGEBOEKT) return publiek(o);
    const voor = Object.assign({}, o);
    zet(o, STATUS.MISLUKT, { laatsteFout: String(reden || 'de rail meldde een mislukking').slice(0, 300), volgendeAt: null });
    try { save(); }
    catch (e) {
      for (const sleutel of Object.keys(o)) if (!Object.prototype.hasOwnProperty.call(voor, sleutel)) delete o[sleutel];
      Object.assign(o, voor);
      throw e;
    }
    /* Ook een al eerder als MISLUKT vastgelegde payout moet hier terugkomen:
       het proces kan precies tussen die save en de teruggang zijn gestopt. */
    if (o.status === STATUS.MISLUKT && !(await ctx.draaiTerug(o))) {
      const e = new Error('De mislukte payout kon nog niet veilig worden teruggeboekt.');
      e.code = 'PAYOUT_TERUGBOEKING_MISLUKT';
      throw e;
    }
    return publiek(o);
  }

  function openstaand() { return maakOpenstaandOverzicht(rij()); }

  function vind(id) { return rij().find(o => o.id === String(id || '')) || null; }
  /* Opzoeken op de referentie van de rail. NIEUWSTE EERST, en dat is het enige
     wat hier gedrag is: dezelfde ref kan aan twee opdrachten hangen als er met
     de hand opnieuw is ingediend, en dan gaat de webhook over de laatste poging.
     De lege-ref-afslag eronder is een snelkoppeling en geen grendel -- een
     settlementRef is null of een echte string, nooit leeg, dus zonder die regel
     zou de lus alleen zinloos de hele rij aflopen. */
  function vindOpSettlement(ref) {
    const r = String(ref || '');
    if (!r) return null;
    for (let i = rij().length - 1; i >= 0; i--) if (rij()[i].settlementRef === r) return rij()[i];
    return null;
  }
  function lijst({ limit = 50, status, ledgerRef, bron } = {}) {
    let r = rij().slice().reverse();
    if (status) r = r.filter(o => o.status === status);
    if (ledgerRef) r = r.filter(o => o.ledgerRef === ledgerRef);
    if (bron) r = r.filter(o => o.bron === bron);
    return { status: 200, aantal: r.length, opdrachten: r.slice(0, Math.min(500, Math.max(1, limit))).map(publiek) };
  }

  return { plaats, ronde, bevestig, openstaand, vind, vindOpSettlement, vindOpIdem, lijst };
};
