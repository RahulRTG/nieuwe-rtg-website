/* DE EERSTE KLANT, EN DE HONDERD DAARNA.

   Zodra de zaak bestaat verandert het doel. Niet meer "een bedrijf oprichten"
   maar: er moet iemand kopen. Deze module meet hoe ver de zaak daarvoor klaar
   staat, en verschuift daarna mee naar de volgende mijlpaal.

   HIJ MEET WAT DE ZAAK IS, NIET WAT WIJ VERZINNEN DAT ZIJ MOET ZIJN. Wat "klaar"
   betekent hangt af van wat de zaak DOET, en dat weet kern/werkvormen.js al: een
   horecazaak zonder menu is niet klaar, een dienstverlener zonder diensten
   evenmin, maar een dienstverlener heeft geen menu nodig. De capslijst bepaalt
   dus welke aanbodstap meetelt. Zo krijgt een nieuw genre vanzelf de goede
   lijst, zonder dat hier iets bij hoeft.

   EN HIJ BOUWT GEEN TWEEDE POORT. kern/ondernemerpoort.js loodst elke nieuwe
   zaak al door de basis (Salon-pagina, rondleidingen) voordat zij online mag.
   Die stand wordt hier GELEZEN en niet nagebouwd -- twee lijsten die allebei
   "is deze zaak er klaar voor" beweren, lopen binnen een maand uiteen en dan
   weet niemand meer welke telt (lat-regel 4). Om diezelfde reden staat de
   Salon-pagina hier NIET als eigen stap: de poort heeft hem al, en twee keer
   hetzelfde afvinken maakt van een teller een leugen.

   EEN PERCENTAGE MAG HIER WEL, en bij de kansscore niet. Het verschil is dat
   dit een telling is en geen weging: acht stappen, vijf gedaan, dat is 63% en
   dat is exact. De kansscore weegt bronnen van ongelijke betekenis en kan dus
   niet exact zijn. Zonder zaak is er niets te tellen, en dan is het antwoord
   null en geen 0% -- 0% zou zeggen dat er niets gedaan is, terwijl er niets te
   doen valt. */
'use strict';

/* De mijlpalen na de eerste klant. Elk zegt wat er in die stap te leren valt,
   want een teller die alleen optelt is een spelletje. */
const MIJLPALEN = [
  { klanten: 1, label: 'Eerste klant', wat: 'Bewijs dat iemand hiervoor betaalt.' },
  { klanten: 10, label: 'Tien klanten', wat: 'Bewijs dat het geen toeval was.' },
  { klanten: 25, label: 'Vijfentwintig klanten', wat: 'Nu is te meten of ze terugkomen.' },
  { klanten: 50, label: 'Vijftig klanten', wat: 'Wat u met de hand deed, gaat u nu automatiseren.' },
  { klanten: 100, label: 'Honderd klanten', wat: 'Nu is te zien of dit meeschaalt of dat het u opvreet.' }
];

/* Welke aanbodstap telt, per capaciteit. De cap komt uit werkvormen.js; de
   lijst eronder zegt alleen WAAR dat aanbod in de zaak staat. */
const AANBOD = [
  { cap: 'menu', veld: 'menu', label: 'Zet uw kaart erin', wat: 'menugerechten' },
  { cap: 'services', veld: 'services', label: 'Zet uw diensten erin', wat: 'diensten' },
  { cap: 'retail', veld: 'collecties', label: 'Zet uw collectie erin', wat: 'artikelen' },
  { cap: 'bookings', veld: 'rooms', label: 'Zet uw kamers erin', wat: 'kamers' },
  { cap: 'fleet', veld: 'fleet', label: 'Zet uw voertuigen erin', wat: 'voertuigen' },
  { cap: 'tickets', veld: 'activiteiten', label: 'Zet uw programma erin', wat: 'activiteiten' }
];

const lijst = (s, veld) => (Array.isArray(s[veld]) ? s[veld] : []);

module.exports = ({ db, ondernemerpoort, boekingenVanZaak, ordersVanZaak }) => {

  /* De stappen naar de eerste klant. Elk met een reden, en met waar hij
     vandaan komt, zodat een ondernemer kan zien waarom wij dit vragen. */
  function stappenVan(s) {
    const caps = db.capsVan(s);
    const uit = [];
    const zet = (id, label, klaar, waarom, bron) => uit.push({ id, label, klaar: !!klaar, waarom, bron });

    /* 1. de bestaande poort. Gelezen, niet nagebouwd. */
    for (const p of ondernemerpoort.poortStappen(s)) {
      zet('poort:' + p.id, p.naam, p.klaar, p.tekst, 'poort');
    }

    /* 2. aanbod, en alleen het aanbod dat bij deze zaak past. */
    const relevant = AANBOD.filter(a => caps.includes(a.cap));
    for (const a of relevant) {
      const n = lijst(s, a.veld).length;
      zet('aanbod:' + a.cap, a.label, n > 0,
        n > 0 ? 'Er staan ' + n + ' ' + a.wat + ' in.' : 'Zonder aanbod valt er niets te kopen.', 'aanbod');
    }

    /* 3. prijzen. Alleen zinvol als er aanbod IS -- anders zou de stap eeuwig
       open staan om een reden die de vorige stap al noemt. */
    const metPrijs = relevant.some(a => lijst(s, a.veld).some(x => Number(x && x.price) > 0));
    const heeftAanbod = relevant.some(a => lijst(s, a.veld).length > 0);
    if (heeftAanbod) {
      zet('prijzen', 'Zet er prijzen bij', metPrijs,
        metPrijs ? 'Uw aanbod heeft prijzen.' : 'Zonder prijs kan een lid niet afrekenen.', 'aanbod');
    }

    /* 4. vindbaar: waar staat u. */
    zet('plaats', 'Zeg waar u zit', !!(s.city || s.loc),
      'Leden zoeken op plaats; zonder plaats staat u nergens tussen.', 'vindbaar');

    /* 5. het eerste bericht. Niet verplicht om te bestaan, wel de kortste weg
       naar de eerste klant: de Salon is het enige kanaal dat u gratis heeft. */
    const posts = (db.data.posts || []).filter(p => p && p.partnerCode === s.code).length;
    zet('eerste-bericht', 'Plaats uw eerste bericht', posts > 0,
      posts > 0 ? 'U heeft ' + posts + ' bericht(en) geplaatst.' : 'De Salon is uw gratis kanaal naar leden.', 'bereik');

    /* 6. sta de deur open. */
    zet('online', 'Zet uw zaak online', ondernemerpoort.zaakOnline(s),
      'Zolang dit uitstaat, ziet geen enkel lid u staan.', 'poort');

    return uit;
  }

  /* Hoeveel klanten heeft deze zaak echt gehad. Zelfde telling als
     ondernemingFeiten: op codenaam, en een boeking die op betaling wacht telt
     niet mee. */
  function klantenVan(s) {
    const kn = new Set();
    for (const b of (boekingenVanZaak(s.code) || [])) {
      if (b && b.customerCodename && b.status !== 'wacht-op-betaling') kn.add(b.customerCodename);
    }
    for (const b of (ordersVanZaak(s.code) || [])) {
      if (b && b.customerCodename) kn.add(b.customerCodename);
    }
    return kn.size;
  }

  /* Het beeld. Null zonder zaak: zie de kop -- 0% zou zeggen dat er niets
     gedaan is, terwijl er niets te doen valt. */
  function eersteKlant(o) {
    const s = o && o.supplierCode ? (db.data.suppliers || []).find(x => x.code === o.supplierCode) : null;
    if (!s) return null;

    const stappen = stappenVan(s);
    const klaar = stappen.filter(x => x.klaar).length;
    const klanten = klantenVan(s);
    const gehaald = MIJLPALEN.filter(m => klanten >= m.klanten);
    const volgende = MIJLPALEN.find(m => klanten < m.klanten) || null;

    return {
      klanten,
      /* Vóór de eerste klant is de vraag "sta ik klaar"; daarna is het
         "kom ik verder". Het scherm hoeft dat onderscheid niet zelf te maken. */
      doel: klanten === 0 ? 'klaarstaan' : 'groeien',
      stappen, klaar, totaal: stappen.length,
      percentage: stappen.length ? Math.round((klaar / stappen.length) * 100) : null,
      open: stappen.filter(x => !x.klaar),
      mijlpalen: MIJLPALEN.map(m => ({ klanten: m.klanten, label: m.label, wat: m.wat,
        bereikt: klanten >= m.klanten })),
      bereikt: gehaald.length ? gehaald[gehaald.length - 1].label : null,
      volgende: volgende ? { klanten: volgende.klanten, label: volgende.label, wat: volgende.wat,
        teGaan: volgende.klanten - klanten } : null
    };
  }

  return { EERSTEKLANT_MIJLPALEN: MIJLPALEN, eersteKlant };
};

module.exports.MIJLPALEN = MIJLPALEN;
module.exports.AANBOD = AANBOD;
