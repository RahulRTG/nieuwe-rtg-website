/* Communicatiekern, werk (deelbestand): DE LIJSTEN.

   ./werk.js gaat over EEN sollicitatiegesprek: hoe het uit de oude vorm wordt
   overgenomen, wie de kanten zijn, en hoe er een bericht in komt. Dit bestand
   gaat over de OVERZICHTEN: wat ziet een sollicitant, en wat ziet een zaak.

   Dezelfde valkuil als bij het gastcontact (./gast.js): een lijst die uit de
   kern komt ziet alleen wat al verhuisd is, en de lijst is nu juist de manier
   waarop iemand een gesprek opent. Zonder binnenhalen staat de
   sollicitatielijst op de dag van de verhuizing leeg. Vandaar `haalBinnen`,
   begrensd tot deze sollicitant of deze zaak: nog steeds een verhuizing op
   aanraking, niet een migratie die bij het opstarten door alles heen loopt.

   Alles wat dit bestand van de gesprekken zelf moet weten, krijgt het MEE van
   ./werk.js. Zo blijft er een lezing van "wie is de sollicitant" en "hoe ziet
   een rij eruit", in plaats van twee die uiteen kunnen lopen. */
'use strict';

module.exports = ({ db, comm, wie, gesprek, chatVan, rij, sollicitantVan }) => {

  function haalBinnen(filter) {
    let oud = null;
    try { oud = db.data.applyChats || {}; } catch (e) { return; }
    for (const [id, chat] of Object.entries(oud)) {
      if (!chat || !filter(chat)) continue;
      gesprek(id);
    }
  }

  /* Alleen gesprekken met bron 'Werk' tellen mee. De inbox van de kern draagt
     alles wat iemand heeft; zonder die filter zou een gewone DM in de
     sollicitatielijst opduiken. */
  function uitInbox(sleutel, extra) {
    const uit = [];
    for (const g of comm.inbox(String(sleutel), {}).gesprekken) {
      const kern = comm.gesprekVan(g.id);
      if (!kern || !kern.meta || kern.meta.bron !== 'Werk') continue;
      const chat = chatVan(String(kern.meta.sleutel).replace(/^werk:/, ''));
      if (!chat) continue;
      uit.push(extra ? Object.assign(rij(chat, kern), extra(g)) : rij(chat, kern));
    }
    return uit.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  }

  function voorSollicitant(sleutel) {
    haalBinnen((c) => sollicitantVan(c) === String(sleutel));
    return uitInbox(sleutel);
  }

  function voorZaak(code) {
    const c = String(code || '').trim().toUpperCase();
    haalBinnen((chat) => String(chat.supplierCode || '').toUpperCase() === c);
    return uitInbox(wie.zaak(c), (g) => ({ ongelezen: g.ongelezen }));
  }

  return { voorSollicitant, voorZaak };
};
