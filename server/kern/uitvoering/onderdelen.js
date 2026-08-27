/* UITVOERENDE MEDIA (deelmodule): WAT ER IN EEN PARTITUUR ZIT.

   Gesplitst van ./partituur.js toen dat bestand tegen de 10 kB-keuringsgrens
   liep, en de naad loopt waar hij hoort: daar staat wat een partituur IS (naam,
   regels, toestemming, prijs, klaar), hier staat wat erin ZIT.

   EEN INGANG VOOR DRIE HANDELINGEN -- erbij, eruit, verplaatsen -- om dezelfde
   reden als bij een afspeellijst (kern/mediaos/lijsten.js): ze raken alle drie
   precies dezelfde rij, en er is geen stand waarin "toevoegen" iets anders van
   de partituur weet dan "verplaatsen".

   EN HET EIGENDOM WORDT HIER GECONTROLEERD. Een onderdeel mag alleen verwijzen
   naar een stuk waarvan dit lid de maker is; de catalogus zegt dat zelf al bij
   elke rij (`mijn`), en die vraag wordt gesteld met de sessie van de maker. Zo
   staat "is dit van mij" op EEN plek (LAT.md regel 4). Een partituur over
   andermans werk zou hermontage onder een vreemde naam zijn, en dat is een
   rechtenvraag en geen instelling (UITVOEREND.md par. 4.6). */
'use strict';

const F = require('./fragment');

module.exports = ({ save, schoon, nu, catalogus, vanMij, beeld, ROLLEN, MAX_ONDERDELEN }) => {
  function onderdeel(sess, opdracht) {
    const o = opdracht || {};
    const p = vanMij(sess.key, o.id);
    if (!p) return { status: 404, error: 'Deze partituur bestaat niet, of is niet van u.' };
    const fid = String(o.fragmentId || '');
    const f = F.lees(fid);
    if (!f) return { status: 400, error: 'Dit is geen geldig fragment-id (fragment:<vorm>:<id>@<van>-<tot>).' };

    const staat = (p.onderdelen || []).findIndex(x => x.fragmentId === fid);
    if (o.aan === false) {
      if (staat < 0) return { status: 404, error: 'Dit fragment staat niet in deze partituur.' };
      p.onderdelen.splice(staat, 1); p.bijgewerkt = nu(); save();
      return { status: 200, ok: true, partituur: beeld(p, true) };
    }
    if (o.naar != null) {
      if (staat < 0) return { status: 404, error: 'Dit fragment staat niet in deze partituur.' };
      const naar = Math.min(Math.max(Math.round(Number(o.naar)) || 0, 0), p.onderdelen.length - 1);
      const [x] = p.onderdelen.splice(staat, 1);
      p.onderdelen.splice(naar, 0, x); p.bijgewerkt = nu(); save();
      return { status: 200, ok: true, partituur: beeld(p, true) };
    }

    /* HET EIGENDOM. De catalogus wordt gelezen met de sessie van de MAKER, en
       die zegt zelf al of een stuk van hem is. Zo staat de vraag "is dit van
       mij" op één plek en niet op twee (LAT.md regel 4). */
    const wereld = catalogus.alles(sess);
    const rij = wereld.rijen.find(r => r.id === f.stukId);
    if (!rij) return { status: 404, error: 'Dit stuk bestaat niet, of staat niet voor u open.' };
    if (!rij.mijn) return { status: 403, error: 'Een partituur gaat over uw eigen werk. Dit stuk is van iemand anders.' };
    /* Waar de lengte BEKEND is, moet het fragment erbinnen vallen -- zelfde
       regel als een ondertitelcue (kern/ondertitels.js). Voor een track en een
       clip kent RTG de lengte niet, en daar wordt dus niet op tijd gecontroleerd
       in plaats van een grens te verzinnen. */
    if (rij.duurS && f.tot > rij.duurS)
      return { status: 400, error: 'Dit fragment loopt tot ' + f.tot + 's, maar het stuk duurt ' + rij.duurS + 's.' };
    if (staat >= 0) return { status: 409, error: 'Dit fragment staat al in deze partituur.' };
    if ((p.onderdelen || []).length >= MAX_ONDERDELEN)
      return { status: 409, error: 'Een partituur draagt hoogstens ' + MAX_ONDERDELEN + ' onderdelen.' };

    const rol = ROLLEN[o.rol] ? o.rol : 'verdieping';
    const diepte = Math.min(Math.max(Math.round(Number(o.diepte)) || 1, 1), 3);
    p.onderdelen.push({ fragmentId: fid, naam: schoon(o.naam, 80) || rij.titel, rol, diepte, at: nu() });
    p.bijgewerkt = nu(); save();
    return { status: 200, ok: true, partituur: beeld(p, true) };
  }

  return { onderdeel };
};
