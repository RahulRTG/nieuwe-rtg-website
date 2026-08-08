/* DE VERHUIZING VAN HET GASTCONTACT: db.data.guestChats -> de kern.

   Dit bestand is TIJDELIJK, en het is nuttig dat dat aan de bestandsnaam te
   zien is. Wanneer de laatste oude lijn is binnengehaald, kan het weg -- en
   dan hoeft er niets uit ./gast.js gehaald te worden, want daar staat de lijn
   zoals hij vandaag werkt en niet hoe hij er vroeger uitzag.

   TWEE DINGEN GAAN HIER STIL MIS ALS JE ZE VERKEERD DOET.

   1. DE TIJDSTEMPELS. De geschiedenis gaat rechtstreeks de voorraad van de
      kern in en niet via comm.bericht(): die zet elk bericht op NU, en dan
      ziet een gesprek van vorig jaar eruit alsof het vanmiddag gebeurde. Dat
      is geen migratie maar een vervalsing, en niet terug te draaien.

   2. DE TELLERS. De oude vorm telde ONGELEZEN, de kern houdt GELEZEN TOT bij.
      Reken je dat verkeerd om, dan springt bij iedereen elk oud gesprek op
      ongelezen: een stapel rode bolletjes die niemand heeft veroorzaakt, en
      niemand kan uitleggen. */
'use strict';

function maakGastVerhuizing({ db, save, comm, lijnSleutel, zaakVan }) {
  function importeer(gesprek, code, lidKey, dept) {
    if (!gesprek || gesprek.meta.oudBinnen) return gesprek;
    gesprek.meta.oudBinnen = new Date().toISOString();
    let oud = null;
    try { oud = (db.data.guestChats || {})[lijnSleutel(code, lidKey, dept)]; } catch (e) {}
    const berichten = (oud && Array.isArray(oud.messages)) ? oud.messages : [];
    if (berichten.length) {
      /* Rechtstreeks in de voorraad van de kern en niet via comm.bericht():
         die zet elk bericht op NU, en dan ziet een gesprek van vorig jaar
         eruit alsof het vanmiddag gebeurde. Geen migratie maar een
         vervalsing, en niet terug te draaien. */
      const lijst = comm.berichtenVan(gesprek.id);
      for (const m of berichten) {
        if (!m || !m.text) continue;
        const systeem = m.from === 'systeem';
        lijst.push({
          id: 'brc_oud_' + (lijst.length + 1) + '_' + gesprek.id.slice(-6),
          van: (m.from === 'guest') ? lidKey : zaakVan(code), door: null,
          at: m.at || gesprek.op,
          tekst: String(m.text).slice(0, 4000),
          soort: systeem ? 'systeem' : 'tekst',
          who: m.who || '', antwoordOp: null, bijlage: null,
          lang: m.lang || null, reacties: {}
        });
      }
      lijst.sort((x, y) => String(x.at || '').localeCompare(String(y.at || '')));
      const laatste = lijst[lijst.length - 1];
      if (laatste && laatste.at > gesprek.laatst) gesprek.laatst = laatste.at;
      /* De tellers omrekenen naar "gelezen tot", per kant. Ging dit mis, dan
         springt bij iedereen elk oud gesprek op ongelezen: een stapel rode
         bolletjes die niemand heeft veroorzaakt. */
      leesUitTeller(lijst, gesprek, lidKey, zaakVan(code), (oud && oud.unreadGuest) || 0);
      leesUitTeller(lijst, gesprek, zaakVan(code), lidKey, (oud && oud.unreadPartner) || 0);
    }
    save();
    return gesprek;
  }

  /* `n` ongelezen betekende: de laatste n berichten VAN DE ANDER heeft deze
     kant niet gezien. Dus terugtellen tot je er n voorbij bent, en "gelezen
     tot" op het bericht daarvoor zetten. Staat de teller op nul, dan is alles
     gelezen -- en dat is juist de kant die je moet zetten, want zonder
     tijdstip telt de kern ALLES van de ander als ongelezen. */
  function leesUitTeller(lijst, gesprek, mij, ander, aantal) {
    const n = Math.max(0, Number(aantal) || 0);
    let gezien = 0;
    for (let i = lijst.length - 1; i >= 0; i--) {
      if (lijst[i].van === mij) continue;      // eigen berichten tellen niet mee
      if (gezien >= n) { comm.leesZet(mij, gesprek.id, lijst[i].at); return; }
      gezien++;
    }
    // de ander schreef minder dan de teller beweert: alles blijft ongelezen
  }

  return { importeer };
}

module.exports = { maakGastVerhuizing };
