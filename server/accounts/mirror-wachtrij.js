/* Uitgaande wachtrij van de lokale accountcache naar PostgreSQL.

   Dit is uitsluitend het oude, niet-transactionele spiegelpad voor lokale en
   ontwikkelinstallaties. Productie markeert hier geen werk: daar blijft de
   schrijfpoort dicht totdat de requestparticipant echt end-to-end bestaat. */
'use strict';

module.exports = function maakMirrorWachtrij(o) {
  const vuileUsers = new Set();
  const vuileStaff = new Set();
  const verwijderdeUsers = new Set();
  let timer = null;

  function plan() {
    if (!o.magPlannen() || timer) return;
    timer = setTimeout(flush, 150);
    if (timer.unref) timer.unref();
  }

  async function flush() {
    timer = null;
    const pg = o.postgres();
    if (!pg || !o.gereed()) return;
    const users = [...vuileUsers]; vuileUsers.clear();
    const staff = [...vuileStaff]; vuileStaff.clear();
    const verwijderd = [...verwijderdeUsers]; verwijderdeUsers.clear();

    for (const id of verwijderd) {
      try { await pg.deleteUser(id); } catch (e) { verwijderdeUsers.add(id); }
    }
    for (const id of users) {
      const rij = o.rawUser(id);
      if (rij) try { await pg.upsertUser(rij); } catch (e) { vuileUsers.add(id); }
    }
    for (const id of staff) {
      const rij = o.rawStaff(id);
      if (rij) try { await pg.upsertStaff(rij); } catch (e) { vuileStaff.add(id); }
    }
    if (vuileUsers.size || vuileStaff.size || verwijderdeUsers.size) plan();
  }

  function markUser(id) {
    if (!o.magMarkeren() || id == null) return;
    vuileUsers.add(Number(id)); plan();
  }
  function markStaff(id) {
    if (!o.magMarkeren() || id == null) return;
    vuileStaff.add(Number(id)); plan();
  }
  function markDelete(id) {
    if (!o.magMarkeren() || id == null) return;
    const nummer = Number(id);
    verwijderdeUsers.add(nummer); vuileUsers.delete(nummer); plan();
  }

  return { plan, flush, markUser, markStaff, markDelete };
};
