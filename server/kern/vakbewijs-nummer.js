/* Vakbewijs (deelmodule): WAAR HET NUMMER WOONT.

   WAAROM DIT NIET IN DE OPERATIONELE DATA STAAT. Een BIG-registratie staat in
   een OPENBAAR register. Zou het nummer naast de codenaam in db.data liggen,
   dan is de codenaam van precies de mensen om wie deze laag draait terug te
   voeren op een echte naam -- dezelfde de-anonimisering waar de scheiding
   tussen codenaam en kluis voor bestaat, via een deur aan de achterkant. En een
   datalek vraagt geen route: dat de API het nummer nergens toont, is een tweede
   laag en geen vervanging van de eerste.

   Het nummer hoort dus bij de naam en het e-mailadres: versleuteld, gebonden
   aan de rij (server/accounts/gebonden.js), en alleen te lezen met een reden
   die in het inzagejournaal landt (routes/vakbewijs-kantoor.js).

   WAAR PRECIES. In het ledendossier (member_state), onder `vakbewijsNummers`,
   per soort stuk. Dat dossier gaat als geheel versleuteld de kolom in, met de
   plek (tabel, kolom, rij-id) in de authenticatie. Een tweede kluis ernaast
   bouwen zou dezelfde fout zijn als een tweede intake.

   EN WAAROM CONCERN-RIJEN NIET MEEGAAN. Een concern-persoon is een codenaam
   zonder RTG-account (CONCERN.md: een bestuurder van buiten bestaat), dus er is
   geen dossier om het in te leggen. Daar blijft het nummer staan waar het stond
   -- het is de eigen administratie van een werkgever, niet een stuk dat RTG
   heeft gezien, en die rijen dragen dan ook nooit een aftekening.

   ZONDER `accounts` GEBEURT ER NIETS STIL. nummerZet() geeft dan false terug en
   de aanroeper legt hem in de rij; nummerVan() geeft null. Half verplaatsen
   naar een kluis die er niet is, zou het nummer weggooien. */
'use strict';

module.exports = ({ accounts, kap, vind }) => {
  const lidVan = (sleutel) => {
    const m = /^lid:(\d+)$/.exec(String(sleutel || ''));
    return m ? Number(m[1]) : null;
  };

  function nummerVan(sleutel, wat) {
    const lid = lidVan(sleutel);
    if (lid == null) { const v = vind(sleutel, kap(wat, 60)); return v ? (v.nummer || null) : null; }
    if (!accounts || !accounts.getMemberState) return null;
    const md = accounts.getMemberState(lid) || {};
    const bus = md.vakbewijsNummers && typeof md.vakbewijsNummers === 'object' ? md.vakbewijsNummers : {};
    return bus[wat] || null;
  }

  function nummerZet(sleutel, wat, nummer) {
    const lid = lidVan(sleutel);
    if (lid == null) return false;            // concern: de aanroeper zet hem in de rij
    if (!accounts || !accounts.getMemberState || !accounts.saveMemberState) return false;
    const md = accounts.getMemberState(lid) || {};
    const bus = md.vakbewijsNummers && typeof md.vakbewijsNummers === 'object' ? md.vakbewijsNummers : {};
    if (nummer) bus[wat] = nummer; else delete bus[wat];
    md.vakbewijsNummers = bus;
    accounts.saveMemberState(lid, md);
    return true;
  }

  return { nummerVan, nummerZet };
};
