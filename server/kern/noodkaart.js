/* De noodkaart: het kleinste beetje dat een vreemde over u moet weten als u het
   zelf niet kunt vertellen. Een noodcontact, en desgewenst uw allergenen en
   aandachtspunten.

   HIJ IS BEWUST KLEIN. Dit is geen dossier maar een kaart: wie hem leest staat
   naast u en heeft dertig seconden. Alles wat er extra op staat, maakt het
   belangrijke moeilijker te vinden.

   HIJ DUPLICEERT NIETS. Allergenen en aandachtspunten staan al in
   kern/gastzorg.js, uw medicijnen in kern/medicatie.js; allebei worden ze hier
   GELEZEN, niet gekopieerd. Een kopie loopt uit de pas met het origineel, en dan
   staat er op de kaart die iemand in een ambulance leest een allergie die u
   vorig jaar hebt weggehaald, of een middel dat u allang niet meer gebruikt
   (LAT.md regel 4). Wat u wel zelf kiest is OF ze op de kaart mogen.

   NIEMAND KAN HEM OPVRAGEN. Er is geen route waarmee een zaak, een kantoor of
   een hulpverlener uw noodkaart ophaalt -- u toont hem zelf, op uw eigen scherm.
   Dat is een grens en geen tekortkoming: een kaart die op afstand op te vragen
   is, is een dossier dat toevallig klein is.

   WAT ER DAAROM NIET IS: break-glass. Een hulpverlener die in een noodgeval
   bijzondere toegang aanvraagt, hoort bij een systeem met geverifieerde
   professionals, een reden die wordt vastgelegd, een melding achteraf en een
   compliance-review. Dat bestaat hier niet, en een knop die zo heet zonder die
   keten eronder is theater. Zie docs/life.md. */

module.exports = ({ db, save, schoon, zorgVan, medicijnenVan }) => {
  const bak = () => { if (!db.data.noodkaarten) db.data.noodkaarten = {}; return db.data.noodkaarten; };
  const leeg = { contactNaam: '', contactTel: '', watNodig: '',
    zorgErbij: false, medicijnenErbij: false, aan: false };

  function kaartVan(key) {
    const k = { ...leeg, ...(bak()[key] || {}) };
    /* Het zorgprofiel wordt gelezen op het moment dat de kaart wordt getoond.
       Zo staat er nooit iets op wat u inmiddels hebt weggehaald. */
    const zorg = (k.zorgErbij && typeof zorgVan === 'function') ? zorgVan(key) : null;
    /* En hetzelfde voor het medicatieschema: geen kopie, maar de lijst zoals hij
       op dit moment is. Een medicijn dat u vorige maand hebt gestopt, hoort niet
       op de kaart te staan die iemand in een ambulance leest. */
    const meds = (k.medicijnenErbij && typeof medicijnenVan === 'function') ? medicijnenVan(key) : null;
    return {
      ok: true,
      /* Of er uberhaupt een kaart staat. Het scherm zet zijn weggooi-knop hierop:
         een knop die alleen maar 404 kan geven, hoort er niet te staan. */
      bestaat: !!bak()[key],
      kaart: {
        aan: !!k.aan,
        contactNaam: k.contactNaam, contactTel: k.contactTel,
        watNodig: k.watNodig,
        zorgErbij: !!k.zorgErbij,
        medicijnenErbij: !!k.medicijnenErbij,
        allergenen: (zorg && zorg.allergenen) || [],
        medisch: (zorg && zorg.medisch) || '',
        medicijnen: meds || []
      },
      uitleg: 'U toont deze kaart zelf. Niemand kan hem op afstand opvragen, ook een hulpverlener niet.'
    };
  }

  function kaartZet(key, body) {
    const nu = { ...leeg, ...(bak()[key] || {}) };
    if (body.contactNaam !== undefined) nu.contactNaam = schoon(body.contactNaam, 60);
    if (body.contactTel !== undefined) nu.contactTel = schoon(body.contactTel, 30);
    /* Kort met opzet. Wie hier een halve levensloop in kwijt kan, maakt de kaart
       onleesbaar op precies het moment dat lezen moeilijk is. */
    if (body.watNodig !== undefined) nu.watNodig = schoon(body.watNodig, 200);
    if (body.zorgErbij !== undefined) nu.zorgErbij = body.zorgErbij === true;
    if (body.medicijnenErbij !== undefined) nu.medicijnenErbij = body.medicijnenErbij === true;
    if (body.aan !== undefined) nu.aan = body.aan === true;
    bak()[key] = nu;
    save();
    return kaartVan(key);
  }

  function kaartWeg(key) {
    if (!bak()[key]) return { status: 404, error: 'U heeft geen noodkaart.' };
    delete bak()[key];
    save();
    return { ok: true, weg: true };
  }

  return { noodkaartVan: kaartVan, noodkaartZet: kaartZet, noodkaartWeg: kaartWeg };
};
