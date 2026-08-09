/* Wie van het personeel op de website mag staan.

   Dit is met opzet GEEN veld in de personeelsadministratie maar een
   publicatiebesluit dat bij de website hoort: "werkt hier" en "staat op onze
   site" zijn twee verschillende dingen, en het tweede hoort niemand te
   overkomen omdat het eerste waar is.

   Vier dingen liggen daarom vast:

   - NIEMAND STAAT ER VANZELF OP. De lijst begint leeg; per persoon zet de
     leiding hem aan. Een standaard die "iedereen" zou zijn, zet het
     personeelsbestand van een zaak op straat zodra iemand een site maakt.
   - WE BEWAREN ALLEEN VERWIJZINGEN (staff-id's). De naam en de functie komen
     bij het TONEN uit de personeelsadministratie zelf. Wie uit dienst gaat,
     verdwijnt daarmee vanzelf van de site -- een kopie zou daar blijven staan.
   - ER GAAT NIET MEER NAAR BUITEN DAN NAAM EN FUNCTIE. Niet of iemand manager
     is, niet of hij ook RTG-lid is, geen contactgegevens.
   - HET IS WERK VAN DE LEIDING (de route zet daar managerOnly op). */
module.exports = ({ db, save, listStaff }) => {
  function pot() {
    if (!db.data.siteTeam || typeof db.data.siteTeam !== 'object') db.data.siteTeam = {};
    return db.data.siteTeam;
  }
  const gekozen = code => (pot()[String(code || '').toUpperCase()] || []).map(Number);

  /* Het beheerscherm: iedereen die er werkt, met de stand erbij. Hier mag de
     leiding wel de eigen functie-indeling zien -- dit scherm is binnen. */
  function lijst(code) {
    const aan = new Set(gekozen(code));
    return listStaff(code).map(m => ({ id: m.id, naam: m.name, func: m.func || null, op: aan.has(Number(m.id)) }));
  }

  function zet(code, staffId, aan) {
    const id = Number(staffId);
    if (!Number.isFinite(id)) return { error: 'Onbekende medewerker.', status: 400 };
    // alleen iemand die hier ook echt werkt; een vreemd id komt er niet in
    if (!listStaff(code).some(m => Number(m.id) === id)) return { error: 'Deze medewerker werkt hier niet.', status: 404 };
    const p = pot();
    const sleutel = String(code || '').toUpperCase();
    const nu = new Set(gekozen(code));
    if (aan) nu.add(id); else nu.delete(id);
    p[sleutel] = [...nu].slice(0, 60);
    save();
    return { ok: true, lijst: lijst(code) };
  }

  /* Wat er op de site komt: naam en functie, en alleen van wie nu nog in
     dienst is EN nu nog aan staat. Beide vragen we op het moment van tonen,
     dus een site die niemand aanraakt loopt niet achter op de werkelijkheid. */
  function publiek(code) {
    const aan = new Set(gekozen(code));
    return listStaff(code).filter(m => aan.has(Number(m.id)))
      .map(m => ({ naam: m.name, func: m.func || '' }));
  }

  return { lijst, zet, publiek };
};
