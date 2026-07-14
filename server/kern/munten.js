/* Munt-ontvangst: orchestratie en grootboek (kern/munten.js).

   Bovenop de provider-naad (server/muntbetaal.js) legt deze laag het grootboek
   van ontvangsten (db.data.muntOntvangsten) en de context per verzoek: welke
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

  function lijst() {
    if (!Array.isArray(db.data.muntOntvangsten)) db.data.muntOntvangsten = [];
    return db.data.muntOntvangsten;
  }

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
    entry.settledEuroCenten = Number.isFinite(euroCenten) && euroCenten > 0 ? Math.round(euroCenten) : entry.euroCenten;
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
