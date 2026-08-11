/* DE KLUSKETEN: van akkoord tot geld op de rekening, en waar hij blijft steken.

   ER KOMT GEEN PROJECTENREGISTER BIJ. De keten bestaat al, in drie objecten die
   elkaar met een REFERENTIE vasthouden:

     offerte  (db.data.vakOffertes)   -> bij akkoord krijgt hij `boekingRef`
     boeking  (de agenda van de zaak) -> draagt die `ref`, en `paid`
     factuur  (db.data.facturen)      -> draagt `ref`, en sinds kort `betaald`

   Wie daar een vierde object naast zet dat "project" heet, moet het met de hand
   bijhouden -- en dan loopt het na twee weken achter op de drie die vanzelf
   meebewegen (lat-regel 4). Deze laag VOLGT de referenties en zegt per klus waar
   hij staat.

   DE VIER PLEKKEN WAAR EEN KLUS BLIJFT STEKEN, en het zijn er echt vier:

     akkoord      -> de klant zei ja, maar er staat nog geen datum in de agenda
     ingepland    -> de datum staat er, de dag is nog niet geweest
     uitgevoerd   -> de dag is geweest en er is nog niet gefactureerd
     gefactureerd -> de factuur staat er en is nog niet afgetekend als betaald

   Alleen de laatste twee zijn "uw geld ligt ergens anders". De eerste twee zijn
   werk dat nog moet gebeuren, en die twee door elkaar halen maakt een drukke
   maand tot een incasso-probleem.

   WAT WIJ NIET WETEN, ZEGGEN WIJ. Een klus zonder factuur betekent hier NIET
   dat er niet is gefactureerd: het betekent dat wij binnen RTG geen factuur met
   deze referentie zien. Wie buiten RTG factureert, doet dat gewoon, en een
   scherm dat dan "niet gefactureerd" roept, roept iets wat het niet weet.

   EN ER WORDT GEEN DOORLOOPTIJD BELOOFD DIE WIJ NIET METEN. De dag waarop een
   klus is uitgevoerd kennen wij uit de agenda; wanneer hij is opgeleverd of
   goedgekeurd niet. Er staat dus geen "gemiddelde doorlooptijd van klus tot
   geld" -- alleen hoe lang elke stap nu al open staat, en dat is een meting. */
'use strict';

const DAG = 86400000;

/* Vanaf hier is een stap het noemen waard. Verschillend per stap, want ze
   betekenen iets anders: een klus die een week na uitvoering nog niet
   gefactureerd is, is trager dan een offerte die een week geleden akkoord ging. */
const TRAAG = { akkoord: 14, ingepland: 0, uitgevoerd: 7, gefactureerd: 30 };

const STADIA = {
  akkoord: { label: 'Akkoord, nog niet ingepland', geld: false,
    wat: 'De klant zei ja, maar er staat nog geen datum in de agenda.' },
  ingepland: { label: 'Ingepland', geld: false,
    wat: 'De datum staat er en de dag is nog niet geweest.' },
  uitgevoerd: { label: 'Uitgevoerd, nog niet gefactureerd', geld: true,
    wat: 'Het werk is gedaan. Zolang er geen factuur ligt, kan er ook niets binnenkomen.' },
  gefactureerd: { label: 'Gefactureerd, nog niet betaald', geld: true,
    wat: 'De factuur staat er en is nog niet afgetekend als betaald.' },
  klaar: { label: 'Klaar', geld: false, wat: 'Uitgevoerd, gefactureerd en betaald.' }
};

const dagenGeleden = (iso, nuMs) => {
  if (!iso) return null;
  const t = Date.parse(String(iso).length <= 10 ? iso + 'T12:00:00Z' : iso);
  return Number.isFinite(t) ? Math.floor((nuMs - t) / DAG) : null;
};

module.exports = ({ db, boekingenVanZaak }) => {

  const zaakVan = (o) => (o && o.supplierCode
    ? (db.data.suppliers || []).find(x => x.code === o.supplierCode) || null : null);

  /* Wanneer de klus in de agenda staat. `wanneer` mag een datum of een
     datum+tijd zijn; alleen de datum telt hier, want een klus van vanochtend is
     vandaag uitgevoerd. */
  const dagVan = (b) => {
    const w = String((b && b.wanneer) || '');
    return /^\d{4}-\d{2}-\d{2}/.test(w) ? w.slice(0, 10) : null;
  };

  function stadiumVan(b, factuur, vandaag) {
    if (!b) return 'akkoord';
    const dag = dagVan(b);
    if (!dag) return 'akkoord';
    if (dag > vandaag) return 'ingepland';
    if (!factuur) return 'uitgevoerd';
    /* Betaald staat op twee plekken en ze betekenen hetzelfde: de boeking kent
       `paid` (de oude weg, via de kassa) en de factuur `betaald` (de weg van de
       facturatielaag). Een van de twee volstaat -- eisen dat ze allebei staan,
       zou een betaalde klus als onbetaald tonen omdat de andere weg is gebruikt. */
    if (factuur.betaald || b.paid) return 'klaar';
    return 'gefactureerd';
  }

  function klussen(o, nuMs) {
    const s = zaakVan(o);
    if (!s) return null;
    const nuT = Number.isFinite(nuMs) ? nuMs : Date.now();
    const vandaag = new Date(nuT).toISOString().slice(0, 10);

    const offertes = (Array.isArray(db.data.vakOffertes) ? db.data.vakOffertes : [])
      .filter(x => x && x.supplierCode === s.code && x.status === 'akkoord' && x.boekingRef);
    if (!offertes.length) return null;

    const boekingen = boekingenVanZaak(s.code) || [];
    const facturen = (Array.isArray(db.data.facturen) ? db.data.facturen : [])
      .filter(f => f && f.verkoper && f.verkoper.code === s.code);

    const rijen = offertes.map(of => {
      const b = boekingen.find(x => x && x.ref === of.boekingRef) || null;
      /* De factuur wordt gevonden op de REFERENTIE van de boeking. Geen match op
         bedrag of op klant: twee klussen van dezelfde klant voor hetzelfde
         bedrag zouden dan elkaars factuur opeisen. */
      const f = b ? facturen.find(x => x.ref && x.ref === b.ref) || null : null;
      const st = stadiumVan(b, f, vandaag);
      const sinds = st === 'gefactureerd' ? (f && (f.datum || f.at))
        : st === 'uitgevoerd' ? dagVan(b)
          : st === 'ingepland' ? null : (of.antwoordAt || of.at);
      return {
        offerte: of.id, klant: of.customerCodename || null,
        omschrijving: String(of.omschrijving || '').slice(0, 80),
        bedrag: Number(of.prijs) || null,
        boeking: b ? b.ref : null,
        wanneer: b ? dagVan(b) : null,
        factuur: f ? f.id : null,
        stadium: st,
        dagen: dagenGeleden(sinds, nuT),
        /* Alleen bij de stap waar het ertoe doet, en met de reden. Zie de kop:
           geen factuur betekent niet dat er niet gefactureerd is. */
        let: st === 'uitgevoerd'
          ? 'Wij zien binnen RTG geen factuur met deze referentie. Factureert u buiten RTG, dan klopt dat gewoon.'
          : null
      };
    });

    const per = {};
    for (const id of Object.keys(STADIA)) {
      const l = rijen.filter(r => r.stadium === id);
      const metBedrag = l.filter(r => r.bedrag !== null);
      per[id] = Object.assign({ aantal: l.length }, STADIA[id], {
        bedrag: metBedrag.length ? Math.round(metBedrag.reduce((n, r) => n + r.bedrag, 0)) : null
      });
    }

    /* Wat er van uw eigen werk nog buiten staat: uitgevoerd plus gefactureerd.
       Ingepland telt NIET mee -- dat is werk dat nog moet gebeuren, en dat als
       openstaand geld tonen maakt een drukke maand tot een incassoprobleem. */
    const buiten = rijen.filter(r => STADIA[r.stadium].geld);
    const buitenBedrag = buiten.reduce((n, r) => n + (r.bedrag || 0), 0);

    const traag = rijen.filter(r => TRAAG[r.stadium] > 0 && (r.dagen || 0) >= TRAAG[r.stadium])
      .sort((a, b2) => (b2.dagen || 0) - (a.dagen || 0));

    return {
      zaak: s.code, totaal: rijen.length,
      stadia: Object.entries(per).map(([id, x]) => Object.assign({ id }, x)),
      buiten: { aantal: buiten.length, bedrag: Math.round(buitenBedrag),
        uitleg: 'Uitgevoerd of gefactureerd werk waar nog geen geld tegenover staat. Ingepland werk telt hier niet mee: dat moet nog gebeuren.' },
      traag: { drempels: TRAAG, aantal: traag.length, rijen: traag.slice(0, 10) },
      rijen: rijen.filter(r => r.stadium !== 'klaar')
        .sort((a, b2) => (b2.dagen || 0) - (a.dagen || 0)).slice(0, 25),
      nietGemeten: 'Alleen klussen die via een RTG-offerte zijn ontstaan. Werk dat mondeling is afgesproken of buiten RTG loopt, zit hier niet in -- en er staat geen doorlooptijd van klus tot geld, want oplevering en goedkeuring meten wij niet.'
    };
  }

  return { KLUSSEN_STADIA: STADIA, KLUSSEN_TRAAG: TRAAG, klussen };
};

/* De opvolging. Uitgevoerd-maar-niet-gefactureerd gaat voorop: dat is werk dat
   al gedaan is en waar de zaak zelf de enige rem op is. Daarna wat er te lang
   op betaling wacht -- daar zit een ander aan het stuur. */
function klussenOpvolging(k) {
  if (!k) return [];
  const uit = [];
  const vind = (id) => k.stadia.find(s => s.id === id);

  const uitg = vind('uitgevoerd');
  if (uitg && uitg.aantal) {
    uit.push({ id: 'niet-gefactureerd', aantal: uitg.aantal,
      kop: uitg.aantal + ' uitgevoerde klus' + (uitg.aantal === 1 ? '' : 'sen') + ' zonder factuur' +
        (uitg.bedrag ? ' (' + uitg.bedrag + ' euro)' : ''),
      waarom: 'Het werk is gedaan. Zolang er geen factuur ligt, kan er ook niets binnenkomen -- en hier bent u zelf de enige rem.' });
  }

  const traagFact = k.traag.rijen.filter(r => r.stadium === 'gefactureerd');
  if (traagFact.length) {
    uit.push({ id: 'lang-open', aantal: traagFact.length,
      kop: traagFact.length + ' factuur' + (traagFact.length === 1 ? '' : 'en') +
        ' staat al ' + traagFact[0].dagen + ' dagen open',
      waarom: 'Uit een klus die u al heeft uitgevoerd. Hoe langer een factuur ligt, hoe kleiner de kans dat hij nog binnenkomt.' });
  }
  return uit;
}

module.exports.klussenOpvolging = klussenOpvolging;
module.exports.STADIA = STADIA;
module.exports.TRAAG = TRAAG;
