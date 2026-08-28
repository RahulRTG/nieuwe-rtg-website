/* DE COMMERCIELE RONDE: het werk dat wel gebouwd was en nooit werd gedaan.

   Vier dingen stonden er klaar en werden door niemand aangeroepen. Dat is een
   eigen soort fout: geen ontbrekende functie, maar een functie zonder beller --
   en die is stiller dan een ontbrekende, want de code ziet er compleet uit en de
   toetsen staan groen.

     fee.herkans()             een mislukte kostenboeking bleef mislukt
     contract.verlengbaar()    geen contract werd ooit VERLENGBAAR, dus maand 13
                               kwam er alleen als een mens het met de hand deed
     tegoed `gewaarschuwdOp`   de 80%-waarschuwing werd gezet en aan niemand
                               gemeld
     verrekening.*             drie verplichtingen die bestonden en niet bewogen

   DE RONDE IS IDEMPOTENT. Elke stap zoekt werk aan de hand van een STAND, niet
   aan de hand van een tijdstip: een verrekende bestelling draagt 'verrekend',
   een verlengbaar contract staat op VERLENGBAAR. Twee keer draaien vindt de
   tweede keer niets. Dat is geen optimalisatie maar de enige bescherming -- een
   ronde die per ongeluk dubbel loopt, zou anders twee keer betalen.

   EN ZE VALT NIET OM OP EEN DEELSTAP. Elk onderdeel zit in zijn eigen try: een
   herkansing die vastloopt op een onbereikbare motor, mag de verlengingsronde
   niet meenemen. Wat er misging, staat in de uitslag -- niet in een log dat
   niemand leest.

   WAT DE RONDE NIET DOET: besluiten nemen. Zij zet een contract op VERLENGBAAR
   (er MOET iets gebeuren) maar verlengt hem niet; zij maakt een sociale afdracht
   betaalbaar maar maakt hem niet over; zij meldt dat een tegoed op raakt maar
   koopt niets bij. Elke stap die geld of een verbintenis raakt, blijft een
   handeling van een mens of van een vooraf gezette keuze. */
'use strict';

/* Tijd komt uit de tijdmachine en niet van het besturingssysteem: alleen zo is
   "wat gebeurt er op 29 februari" een vraag die je kunt stellen (server/lib/klok.js).
   De injecteerbare `nu` blijft bestaan -- toetsen zetten hem -- maar de TERUGVAL
   is de klok en niet Date.now(). */
const klok = require('../../lib/klok');

const contractlaag = require('./contract');

/* Hoeveel dagen voor het einde van de verbintenis een contract VERLENGBAAR
   wordt. Ruim genomen: tussen 15 december en 15 januari zitten 31 dagen, dus
   een venster van precies 30 valt er net naast (zie test/contract.test.js 12).
   En een verlenging is een gesprek, geen knop -- daar hoort meer dan een week
   voor te staan. */
const VERLENGVENSTER_DAGEN = 45;

function maakRonde({ fees, contracten, tegoed, verrekening, allocatie, boekAsync, melden, env, nu }) {
  const tijd = nu || klok.nu;
  const omgeving = env || process.env;

  /* 1. De betaaldienstvergoedingen die niet geboekt raakten. */
  async function herkansFees() {
    if (!fees || typeof fees.herkans !== 'function') return { overgeslagen: 'geen fee-laag' };
    if (typeof boekAsync !== 'function') return { overgeslagen: 'geen boekfunctie' };
    return fees.herkans(async (f) => boekAsync({
      van: 'partner:' + f.supplierCode, naar: 'rtg:betaaldienst', centen: f.centen,
      soort: 'betaaldienstkosten', oms: 'Betaaldienstkosten, herkansing', ref: f.ref
    }));
  }

  /* 2. Contracten waarvan de verbintenis afloopt: op VERLENGBAAR zetten.
        NIET verlengen -- dat is een besluit, en een stilzwijgende verlenging is
        precies wat `verlenging: 'opzegbaar'` niet betekent. */
  function markeerVerlengbaar() {
    if (!contracten || typeof contracten.verlooptBinnen !== 'function') return { overgeslagen: 'geen contractlaag' };
    const nuIso = new Date(tijd()).toISOString();
    const bijna = contracten.verlooptBinnen(VERLENGVENSTER_DAGEN, nuIso);
    let gezet = 0;
    for (const c of bijna) {
      const r = contracten.verlengbaar(c);
      if (r && r.ok) {
        gezet++;
        if (typeof melden === 'function') {
          try {
            melden({ soort: 'contract-verlengbaar', contractId: c.id, pas: c.pas,
              eindigt: contracten.eindeVerbintenis(c),
              tekst: 'De verbintenis loopt af; verlengen of opzeggen.' });
          } catch (e) { /* een melding die faalt, mag de ronde niet stoppen */ }
        }
      }
    }
    return { bekeken: bijna.length, gezet };
  }

  /* 3. De AI-tegoeden die tegen hun plafond lopen. De waarschuwing werd gezet en
        aan niemand gemeld; dat is de helft van regel 6 (nooit ongemerkt). */
  function meldTegoeden() {
    if (!tegoed || typeof melden !== 'function') return { overgeslagen: 'geen tegoed-laag of meldkanaal' };
    const alle = (tegoed.alleRijen && tegoed.alleRijen()) || [];
    let gemeld = 0;
    for (const r of alle) {
      if (!r.gewaarschuwdOp || r.gemeldOp) continue;
      try {
        melden({ soort: 'ai-tegoed', houder: r.houder, pas: r.pas, maand: r.maand,
          tekst: 'Het AI-tegoed van deze maand raakt op.' });
        r.gemeldOp = tijd();
        gemeld++;
      } catch (e) { /* idem */ }
    }
    return { gemeld };
  }

  /* 4. De drie verplichtingen die vastlagen en niet bewogen. */
  async function verreken() {
    if (!verrekening) return { overgeslagen: 'geen verrekening' };
    const uit = {};
    uit.ledenvoordeel = await verrekening.verrekenLedenvoordeel({});
    uit.prijsgarantie = await verrekening.verrekenPrijsgarantie({});
    /* De sociale afdracht wordt alleen betaalbaar als er een bestemming IS.
       Zonder RTF_IBAN gebeurt hier niets, en dat is precies wat de claim zegt --
       een lege omgevingsvariabele hoort geen betaalbaarstelling te veroorzaken. */
    uit.sociaal = verrekening.maakSociaalBetaalbaar({
      foundation: (omgeving.RTF_IBAN || '').trim() || null,
      lokaal: (omgeving.RTF_LOKAAL || '').trim() || null
    });
    return uit;
  }

  /* De hele ronde. Elk onderdeel in zijn eigen try: een stap die vastloopt mag
     de rest niet meenemen, en wat er misging hoort in de uitslag te staan. */
  async function draai() {
    const uit = { at: tijd() };
    const stap = async (naam, fn) => {
      try { uit[naam] = await fn(); }
      catch (e) { uit[naam] = { fout: String((e && e.message) || e).slice(0, 200) }; }
    };
    await stap('fees', herkansFees);
    await stap('contracten', markeerVerlengbaar);
    await stap('tegoeden', meldTegoeden);
    await stap('verrekening', verreken);
    uit.openstaand = verrekening ? verrekening.openstaand() : null;
    return uit;
  }

  return { draai, herkansFees, markeerVerlengbaar, meldTegoeden, verreken, VERLENGVENSTER_DAGEN };
}

module.exports = { maakRonde, VERLENGVENSTER_DAGEN, STATUS: contractlaag.STATUS };
