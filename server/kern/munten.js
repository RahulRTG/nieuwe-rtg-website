/* Munt-ontvangst: orchestratie en grootboek (kern/munten.js).

   Bovenop de provider-naad (server/muntbetaal.js) legt deze laag het grootboek
   van ontvangsten (de collectie muntOntvangsten) en de context per verzoek: welke
   factuur van welk lid wordt hiermee betaald. Zodra de aanbieder bevestigt dat de
   munten binnen zijn EN omgezet naar euro, settelt de server die factuur langs de
   gewone weg (inclusief de 30%-afdracht aan de RTFoundation).

   RTG houdt zelf nooit crypto vast: elk verzoek legt een euro-bedrag vast, de
   aanbieder converteert, en het grootboek rekent in euro's. */

function maakMunten(state) {
  const db = state.db;
  const save = state.save || (() => {});
  const muntbetaal = state.muntbetaal;

  function aan() { return !!muntbetaal.AAN; }

  const eigen = require('./eigencollectie')({ db, domein: 'kern/munten', bezit: { muntOntvangsten: 'lijst' } });
  const lijst = () => eigen.bak('muntOntvangsten');

  // Wat mag de klant kiezen, en tegen welke (gelockte) koers.
  function opties() {
    return {
      aan: aan(),
      aanbieder: muntbetaal.AANBIEDER,
      munten: muntbetaal.MUNTEN.map(m => ({
        munt: m, koersCenten: muntbetaal.koersCenten(m), decimalen: muntbetaal.DECIMALEN[m] || 8
      }))
    };
  }

  /* Maak een ontvangstverzoek voor een euro-bedrag. context legt vast wat ermee
     betaald wordt (bijv. { soort:'factuur', wie, invoiceId, own, accountId }),
     zodat de webhook de juiste factuur kan settelen. Idempotent op sleutel via de
     provider-naad. */
  async function maakVerzoek({ euroCenten, munt, referentie, idempotentieSleutel, context }) {
    const ont = await muntbetaal.maakOntvangst({ euroCenten, munt, referentie, idempotentieSleutel });
    const rijen = lijst();
    let entry = rijen.find(r => r.id === ont.id);
    if (!entry) {
      entry = {
        id: ont.id, aanbieder: ont.aanbieder, munt: ont.munt, adres: ont.adres,
        bedragMunt: ont.bedragMunt, koersCenten: ont.koersCenten, euroCenten: ont.euroCenten,
        referentie: ont.referentie || referentie || null, context: context || null,
        status: 'wacht', at: new Date().toISOString(), vervalt: ont.vervalt
      };
      rijen.push(entry);
      if (rijen.length > 100000) rijen.splice(0, rijen.length - 100000);
      save();
    }
    return {
      id: entry.id, munt: entry.munt, adres: entry.adres, bedragMunt: entry.bedragMunt,
      koersCenten: entry.koersCenten, euroCenten: entry.euroCenten, vervalt: entry.vervalt,
      status: entry.status
    };
  }

  /* Verwerk een bevestiging van de aanbieder (munten binnen + omgezet naar euro).
     Idempotent: een tweede webhook voor dezelfde ontvangst verandert niets.
     Geeft de entry terug (met context) zodat de server de factuur kan settelen,
     of null als de ontvangst onbekend is. settledEuroCenten is het werkelijk
     ontvangen euro-bedrag na conversie (valt terug op het vastgelegde bedrag). */
  function bevestig({ id, euroCenten }) {
    const rijen = lijst();
    const entry = rijen.find(r => r.id === id);
    if (!entry) return null;
    if (entry.status === 'ontvangen') return Object.assign({}, entry, { herhaald: true });
    entry.status = 'ontvangen';
    /* DE KOERS WAS GELOCKT, EN DE LOCK LIEP NOOIT AF.

       Bij het aanmaken wordt `vervalt` vastgelegd -- de tijd waarin deze koers
       geldt. Dat veld werd nergens gelezen. De terugval hieronder ("weet de
       aanbieder het euro-bedrag niet, neem dan het vastgelegde") gold dus ook
       nog een half jaar later, tegen de koers van toen. Bij een munt die
       intussen gehalveerd is, schrijven we het oude bedrag bij en is het
       verschil ons verlies -- en dat is precies het soort verschil dat iemand
       met geduld kan uitzoeken.

       Na de vervaldatum vervalt daarom de TERUGVAL, niet de ontvangst zelf: is
       het geld er echt, dan hoort het geboekt te worden, maar alleen voor wat
       de aanbieder werkelijk heeft omgezet. Zonder dat getal weten we niet wat
       het waard is, en dan schrijven we niets bij. Het staat wel geregistreerd
       (verlopen: true), zodat het kantoor het ziet in plaats van dat het stil
       verdwijnt. */
    const verlopen = !!(entry.vervalt && Date.parse(entry.vervalt) < Date.now());
    const echt = Number.isFinite(euroCenten) && euroCenten > 0 ? Math.round(euroCenten) : null;
    if (verlopen) entry.verlopen = true;
    entry.settledEuroCenten = echt != null ? echt : (verlopen ? 0 : entry.euroCenten);
    /* HOEVEEL ER GEVRAAGD WAS TEGENOVER HOEVEEL ER KWAM.

       `euroCenten` komt uit het webhook-bericht van de aanbieder; `entry.euroCenten`
       is wat er bij het aanmaken van de ontvangst is vastgelegd. Die twee werden
       nergens vergeleken, en de settlement erachter zette de factuur onvoorwaardelijk
       op 'paid'. Eén cent sloot dus een factuur van EUR 78,65.

       De vergelijking hoort HIER, bij de bron, en niet pas bij de aanroeper: dan
       staat er maar een waarheid over "is dit volledig", en elke settlement (factuur,
       rechtstreekse betaling, wat er later bijkomt) leest dezelfde vlag. */
    entry.volledig = entry.settledEuroCenten >= (entry.euroCenten || 0);
    entry.ontvangenAt = new Date().toISOString();
    save();
    return entry;
  }

  function overzicht() {
    const rijen = lijst();
    let ontvangenCenten = 0, wacht = 0;
    for (const r of rijen) {
      if (r.status === 'ontvangen') ontvangenCenten += (r.settledEuroCenten || r.euroCenten || 0);
      else wacht++;
    }
    return {
      aan: aan(), aanbieder: muntbetaal.AANBIEDER, aantal: rijen.length,
      wacht, ontvangen: Math.round(ontvangenCenten) / 100,
      recent: rijen.slice(-12).reverse().map(r => ({
        id: r.id, munt: r.munt, euro: Math.round((r.settledEuroCenten || r.euroCenten || 0)) / 100,
        status: r.status, at: r.ontvangenAt || r.at
      }))
    };
  }

  return { aan, opties, maakVerzoek, bevestig, overzicht };
}

module.exports = { maakMunten };
