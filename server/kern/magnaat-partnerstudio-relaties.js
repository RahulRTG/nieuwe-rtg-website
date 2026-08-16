/* Partnerrelaties voor de Partnerstudio. Relaties worden pas actief nadat de
   ontvangende officiële partner de uitnodiging zelf heeft aanvaard. */
'use strict';

const RELATIES = ['leverancier', 'afnemer', 'opleider', 'ketenpartner'];

module.exports = ({ basis: B }) => {
  function fout(error, status = 400) { return { error, status }; }

  function relatieVraag(supplier, actor, invoer = {}) {
    const t = B.tweeling(supplier);
    const doel = B.tekst(invoer.doelCode, 40).toUpperCase();
    const soort = B.tekst(invoer.soort, 30);
    const geblokkeerd = B.magWijzigen(t, invoer && invoer.versie);
    if (geblokkeerd) return geblokkeerd;
    const tegenpartij = B.leverancier(doel);
    if (!tegenpartij || tegenpartij.partnerStatus === 'geschorst' || tegenpartij.partnerStatus === 'beeindigd')
      return fout('Kies een actieve officiële RTG-partner.');
    if (doel === t.code) return fout('Een bedrijf kan zichzelf niet als ketenpartner uitnodigen.');
    if (!RELATIES.includes(soort)) return fout('Kies een geldige samenwerkingsvorm.');
    const dubbel = B.staat().relaties.some(x => x.status !== 'afgewezen' && x.soort === soort
      && ((x.bron === t.code && x.doel === doel) || (x.bron === doel && x.doel === t.code)));
    if (dubbel) return fout('Deze partnerrelatie bestaat al of wacht op antwoord.', 409);
    B.tweeling(tegenpartij);
    B.staat().relaties.unshift({
      id: B.id('relatie'), bron: t.code, doel, soort, status: 'wacht-op-partner',
      gevraagdDoor: B.actorNaam(actor), gevraagdAt: B.nu(), beslistDoor: null, beslistAt: null
    });
    B.wijzig(t, actor, 'partner-uitgenodigd', doel + ' als ' + soort);
    return Object.assign({ ok: true }, B.eigenBeeld(t));
  }

  function relatieBeslis(supplier, actor, invoer = {}) {
    const relatie = B.staat().relaties.find(x => x.id === B.tekst(invoer.id, 80));
    if (!relatie || relatie.doel !== String(supplier.code).toUpperCase())
      return fout('Deze uitnodiging hoort niet bij uw bedrijf.', 404);
    if (relatie.status !== 'wacht-op-partner') return fout('Deze uitnodiging is al behandeld.', 409);
    relatie.status = invoer.akkoord === true ? 'actief' : 'afgewezen';
    relatie.beslistDoor = B.actorNaam(actor);
    relatie.beslistAt = B.nu();
    const t = B.tweeling(supplier);
    B.wijzig(t, actor, 'partnerrelatie-' + relatie.status, relatie.bron + ' als ' + relatie.soort);
    return Object.assign({ ok: true }, B.eigenBeeld(t));
  }

  return { relatieVraag, relatieBeslis };
};
