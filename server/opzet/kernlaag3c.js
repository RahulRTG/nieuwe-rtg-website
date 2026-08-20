/* DE COMMERCIELE KERN OPHANGEN -- de ronde, de verrekening, de prijsmeldingen,
   het AI-tegoed en het abonnement van een zaak.

   AFGESPLITST VAN ./kernlaag3.js. Dat is een ophanglijst en geen module: elke
   regel hangt een kern op aan de vorige laag, en er zit geen naad in behalve
   volgorde. Toen de commerciele kern erbij kwam ging hij over de omvangregel, en
   de bestaande manier om dat op te lossen staat ernaast: ./kernlaag3b.js en
   ./kernlaag3w.js zijn om dezelfde reden ontstaan. Dit is dus geen nieuw
   patroon maar hetzelfde.

   EN HET IS EEN ECHT ONDERWERP en niet alleen een byte-knip: alles hier hoort
   bij COMMERCIE.md -- wat iets kost, wat er verrekend wordt, wat een abonnement
   bevat. De rest van kernlaag3 gaat over hotels, keukens en luchthavens.

   DE VOLGORDE DIE ERTOE DOET: dit moet NA `pay` gemount worden, want de ronde
   heeft een boekfunctie nodig en die zit daar. De losse lagen worden LAAT
   gelezen (kern.* op het moment van draaien), zodat de rest van de mount-volgorde
   niet uitmaakt. Gemount vanuit server.js, direct na ./kernlaag3.js. */
'use strict';

module.exports = (kern, hulp) => {
  const { db, save, notify, capGezondheid } = hulp;

/* DE COMMERCIELE RONDE (kern/commercie/ronde.js): het werk dat wel gebouwd was
   en nooit werd gedaan. Vier lagen legden verplichtingen vast -- mislukte
   betaaldienstboekingen, aflopende contracten, volle AI-tegoeden en drie soorten
   verrekening -- en geen ervan werd door iets opgepakt. Een functie zonder
   beller is stiller dan een ontbrekende functie: de code ziet er compleet uit.

   Hij hangt hier omdat pay net gemount is: de ronde heeft een boekfunctie nodig
   en die zit daar. De losse lagen worden LAAT gelezen (kern.* op het moment van
   draaien), zodat de mount-volgorde van de rest niet uitmaakt. */
Object.assign(kern, (() => {
  const { maakVerrekening } = require('../kern/commercie/verrekening');
  const { maakRonde } = require('../kern/commercie/ronde');
  const prijsmeldingen = require('../kern/commercie/prijsmelding').maakPrijsmeldingen({ db, save });
  const allocatie = require('../kern/commercie/allocatie').maakAllocatie({ db, save });
  const tegoed = require('../kern/commercie/tegoed').maakTegoed({ db, save });
  const verrekening = maakVerrekening({ db, save,
    boekAsync: (b) => kern.pay.boekAsync(b), prijsmeldingen, allocatie,
    rekLid: kern.pay.rekLid, rekPartner: kern.pay.rekPartner });
  const ronde = maakRonde({
    fees: kern.pay.fees, contracten: kern.aanmeldingen && kern.aanmeldingen.contracten,
    tegoed, verrekening, allocatie,
    boekAsync: (b) => kern.pay.boekAsync(b),
    /* Meldingen gaan door het bestaande kanaal; faalt dat, dan mag de ronde niet
       omvallen -- een melding is geen geld. */
    melden: (m) => { try { if (typeof notify === 'function') notify(m.houder || 'kantoor', { icon: 'geld', title: 'RTG', body: m.tekst }); } catch (e) {} },
    env: process.env });
  /* De tik. Zelfde patroon als de opdrachtenronde van de bank: een vaste
     interval die alleen KIJKT, en die zichzelf niet in de weg zit als een ronde
     langer duurt (elke ronde is idempotent). `unref` zodat een test-server niet
     blijft hangen op deze timer.

     Vijf minuten en geen minuut: hier staat geen geld vast dat iemand net heeft
     weggestuurd -- dit zijn verplichtingen die hoe dan ook vandaag worden
     voldaan. Een minuut zou vooral de motor bezighouden. */
  const RONDE_MS = Number(process.env.RTG_COMMERCIE_RONDE_MS || 300000);
  let bezig = false;
  const timer = setInterval(() => {
    if (bezig) return;                 // een ronde die uitloopt, krijgt geen tweede
    bezig = true;
    ronde.draai()
      .catch(e => console.warn('[commercie] ronde mislukt:', e.message))
      .finally(() => { bezig = false; });
  }, RONDE_MS);
  if (timer.unref) timer.unref();

  /* Het abonnement van een ZAAK. Zonder dit gegeven kan het capability-profiel
     niets afdwingen: een zaak droeg helemaal geen trede, en dan is
     `mag(zaak, 'can_use_pos')` een vraag zonder onderwerp. Zie
     kern/commercie/zaakabonnement.js, met name waarom een zaak zonder
     vastgelegd abonnement op `business` terugvalt en waarom die terugval
     telbaar moet blijven. */
  const zaakAbonnement = require('../kern/commercie/zaakabonnement').maakZaakabonnement({ db, save });

  /* DE SCHADUWSTAND VAN DE HANDHAVINGSREGELS. Een nieuwe regel loopt eerst mee
     zonder te blokkeren, en pas als er bewijs is mag hij bijten. Zie
     kern/commercie/schaduw.js -- met name waarom "je kunt niet afdwingen wat
     nooit heeft meegelopen" de enige zin is die deze laag echt maakt.

     De regels van de abonnementspoort melden zich hier aan, en de tabel REKENT
     zelf uit welke er niemand iets afnemen: een capability die op elke zakelijke
     trede zit, kan geen enkele zaak iets ontnemen en hoeft niet te wachten. Wat
     dat niet haalt -- vandaag alleen governance, dat Business Lite wel degelijk
     iets afpakt -- begint in de schaduw. Ook de regel die op 20 augustus 2026
     meteen is aangezet; dat had niet gemoeten. */
  const routepoort = require('../kern/commercie/routepoort');
  const schaduw = require('../kern/commercie/schaduw').maakSchaduw({ db, save });
  for (const r of routepoort.regels()) {
    if (r.vrijstelling) {
      schaduw.meld(r.id, 'AFDWINGEN');
      schaduw.stelVrij(r.id, r.vrijstelling, 'productprofiel');
      schaduw.zetModus(r.id, 'AFDWINGEN', 'productprofiel');
    } else {
      schaduw.meld(r.id, 'SCHADUW');
    }
  }

  /* DE VOORNEMENS: van een plan naar een gecontroleerde uitvoering, met de
     blokkade VOOR de eerste stap. Zie kern/commercie/voornemen.js -- met name
     waarom de keuring over het TOTAAL gaat en niet per stap: vijf boekingen waar
     de vierde sneuvelt, laten drie boekingen en een puinhoop achter.

     Hier komen de drie lagen van het controlevlak bij elkaar: het BESLUIT weegt,
     het BEWIJSTOKEN draagt dat besluit mee, en de UITVOERING levert het in. De
     ondertekensleutel komt uit de identiteitskluis en wordt daar met een eigen
     label uit afgeleid (zie kern/commercie/bewijstoken/zegel.js), zodat een
     handtekening onder een bewijstoken nooit een sessietoken kan worden. */
  const bewijs = require('../kern/commercie/bewijstoken');
  const token = bewijs.maakBewijstoken({
    sleutel: (hulp.accounts && hulp.accounts.sleutelVoor) ? hulp.accounts.sleutelVoor('bewijstoken') : null,
    gezien: bewijs.geheugenGezien() });
  const voornemens = require('../kern/commercie/voornemen').maakVoornemens({
    db, save, verbruikToken: token.verbruik,
    /* `beslis` komt LAAT: de bevoegdhedenbron hangt aan het huis en niet aan
       deze mount. Zolang er geen is, zegt keur() dat met zoveel woorden in
       plaats van stilzwijgend ja. */
    beslis: (vraag) => (kern.beslis ? kern.beslis(vraag) : null) });

  /* HET RECHTENBORD. Alles wat hierboven is opgehangen, in EEN antwoord: wat
     het productprofiel zegt, en wat er vandaag werkelijk gebeurt. Die twee lopen
     uiteen zodra een handhavingsregel nog meeloopt, en dat gat -- de belofte
     tegenover de handhaving -- is waar dit hele traject mee begon. Zie
     kern/commercie/rechten.js; die laag LEEST alleen. */
  const rechten = require('../kern/commercie/rechten').maakRechten({
    zaakAbonnement, schaduw, tegoed, contracten: kern.contracten || null });

  return { commercieBewijstoken: token, voornemens, commercieRechten: rechten,
    /* De gezondheid per capability wordt in server.js gebouwd -- hij moet ouder
       zijn dan de betaalrail die erop meldt -- en hier alleen aan de kern
       gehangen, zodat het kantoor erbij kan. */
    capGezondheid,
    commercieRonde: ronde, commercieVerrekening: verrekening,
    commercieAllocatie: allocatie, commercieTegoed: tegoed, prijsmeldingen, zaakAbonnement,
    handhavingSchaduw: schaduw };
})());
};
