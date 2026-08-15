/* Partnerrelaties, menselijke beoordeling en publieke simulatie-uitvoer voor
   de Partnerstudio. Publiceren kopieert alleen de veilige momentopname. */
'use strict';

const maakRelaties = require('./magnaat-partnerstudio-relaties');

module.exports = ({ basis: B, crypto }) => {
  const relaties = maakRelaties({ basis: B });
  function fout(error, status = 400) { return { error, status }; }
  function actorInfo(actor) {
    if (actor && typeof actor === 'object') {
      const sleutel = B.tekst(actor.sleutel || actor.key || actor.id || actor.name, 150);
      return {
        sleutel,
        naam: B.tekst(actor.naam || actor.name || sleutel, 100) || 'Boardroom',
        rol: actor.rol === 'publicist' ? 'publicist' : 'controleur'
      };
    }
    const naam = B.actorNaam(actor);
    return { sleutel: B.tekst(actor, 150) || naam, naam, rol: 'publicist' };
  }
  function bevoegd(actor, rol) { return actorInfo(actor).rol === rol; }
  function hashVan(t) {
    return crypto.createHash('sha256').update(JSON.stringify(B.momentopname(t))).digest('hex').slice(0, 20);
  }
  function voorwaarden(t, invoer, hash) {
    const verwacht = invoer && typeof invoer === 'object' ? invoer : {};
    if (!B.tekst(verwacht.hash, 80) || B.tekst(verwacht.hash, 80) !== hash)
      return fout('Deze releasevingerafdruk is niet meer actueel. Ververs de boardroom.', 409);
    if (!Number.isInteger(Number(verwacht.versie)) || Number(verwacht.versie) !== t.versie)
      return fout('Deze bedrijfsversie is intussen gewijzigd. Ververs de boardroom.', 409);
    return null;
  }
  function controleerMomentopname(t) {
    if (!t.beoordeling || hashVan(t) !== t.beoordeling.hash)
      return fout('De bevroren momentopname wijkt af van de ingediende vingerafdruk. Publicatie is geblokkeerd.', 409);
    return null;
  }
  function indienen(supplier, actor, invoer = {}) {
    const t = B.tweeling(supplier), geblokkeerd = B.magWijzigen(t, invoer && invoer.versie), gereed = B.gereedheid(t);
    if (geblokkeerd) return geblokkeerd;
    if (!gereed.klaar) return { status: 409, error: 'De tweeling is nog niet gereed voor RTG-beoordeling.', blokkades: gereed.blokkades };
    const hash = hashVan(t);
    t.fase = 'wacht-op-rtg';
    t.beoordeling = {
      indieningId: B.id('release'), hash, ingediendeVersie: t.versie,
      status: 'wacht-op-voorcontrole', aangevraagdDoor: B.actorNaam(actor),
      aangevraagdAt: B.nu(), notitie: B.tekst(invoer.notitie, 500),
      voorcontrole: null, publicatie: null
    };
    t.versie += 1; t.bijgewerktAt = B.nu(); B.save();
    return Object.assign({ ok: true }, B.eigenBeeld(t));
  }
  function indieningIntrekken(supplier, actor) {
    const t = B.tweeling(supplier);
    if (t.fase !== 'wacht-op-rtg') return fout('Er staat geen beoordeling open.', 409);
    t.fase = 'concept'; t.beoordeling = null; B.wijzig(t, actor, 'beoordeling-ingetrokken', 'Concept is weer bewerkbaar.');
    return Object.assign({ ok: true }, B.eigenBeeld(t));
  }
  function boardroomLijst(actor) {
    const a = actorInfo(actor);
    return { ok: true, actor: a, bevoegdheden: {
      voorcontroleren: a.rol === 'controleur', publiceren: a.rol === 'publicist',
      aanpassingVragen: true, intrekken: a.rol === 'publicist'
    }, releaseModel: 'vier-ogen-v2', bedrijven: Object.values(B.staat().bedrijven).map(t => ({ code: t.code, naam: t.naam, type: t.type, stad: t.stad,
      fase: t.fase, versie: t.versie, gereedheid: B.gereedheid(t), beoordeling: t.beoordeling, gepubliceerd: t.gepubliceerd && t.gepubliceerd.meta || null,
      audit: t.audit.slice(0, 8) })).sort((a, b) => (a.fase === 'wacht-op-rtg' ? -1 : 1) - (b.fase === 'wacht-op-rtg' ? -1 : 1)) };
  }
  function boardroomBeslis(codeIn, actieIn, actor, notitie, verwacht = {}) {
    const code = B.tekst(codeIn, 40).toUpperCase(), actie = B.tekst(actieIn, 30), reden = B.tekst(notitie, 500), t = B.staat().bedrijven[code], a = actorInfo(actor);
    if (!t) return fout('Digitale tweeling niet gevonden.', 404);
    if (reden.length < 8) return fout('Leg het boardroombesluit uit in minimaal acht tekens.');
    const releaseHash = t.beoordeling && t.beoordeling.hash;
    const publicatieHash = t.gepubliceerd && t.gepubliceerd.meta && t.gepubliceerd.meta.hash;
    const voorwaardeFout = voorwaarden(t, verwacht, actie === 'intrekken' ? publicatieHash : releaseHash);
    if (voorwaardeFout) return voorwaardeFout;

    if (actie === 'voorcontroleren') {
      if (!bevoegd(a, 'controleur')) return fout('Alleen een onafhankelijke boardroom-controleur mag de voorcontrole tekenen.', 403);
      if (t.fase !== 'wacht-op-rtg' || !B.gereedheid(t).klaar) return fout('Alleen een complete ingediende versie kan worden voorgecontroleerd.', 409);
      const afwijking = controleerMomentopname(t); if (afwijking) return afwijking;
      if (t.beoordeling.voorcontrole) {
        if (t.beoordeling.voorcontrole.doorSleutel === a.sleutel) return { ok: true, herhaald: true, bedrijf: boardroomLijst(a).bedrijven.find(x => x.code === code) };
        return fout('Deze versie is al door een andere controleur getekend.', 409);
      }
      t.beoordeling.voorcontrole = { door: a.naam, doorSleutel: a.sleutel, rol: a.rol, at: B.nu(), notitie: reden, hash: releaseHash };
      t.beoordeling.status = 'wacht-op-publicatie';
      B.wijzig(t, a, 'rtg-voorcontrole', reden);
    } else if (actie === 'goedkeuren') {
      if (!bevoegd(a, 'publicist')) return fout('Alleen de RTG-publicist mag een gecontroleerde versie publiceren.', 403);
      if (t.fase !== 'wacht-op-rtg' || !B.gereedheid(t).klaar) return fout('Alleen een complete ingediende versie kan worden goedgekeurd.', 409);
      const afwijking = controleerMomentopname(t); if (afwijking) return afwijking;
      const controle = t.beoordeling && t.beoordeling.voorcontrole;
      if (!controle) return fout('Eerst moet een onafhankelijke controleur deze vingerafdruk voorcontroleren.', 409);
      if (controle.doorSleutel === a.sleutel) return fout('De voorcontroleur mag niet ook de publicist zijn. Een tweede persoon is verplicht.', 409);
      const snapshot = B.momentopname(t), hash = t.beoordeling.hash;
      const publicatie = { door: a.naam, doorSleutel: a.sleutel, rol: a.rol, at: B.nu(), notitie: reden, hash };
      t.beoordeling.publicatie = publicatie; t.beoordeling.status = 'gepubliceerd';
      t.gepubliceerd = { meta: { versie: t.versie, hash, indieningId: t.beoordeling.indieningId,
        door: a.naam, doorSleutel: a.sleutel, at: publicatie.at, releaseModel: 'vier-ogen-v2',
        voorcontrole: B.kopie(controle) }, snapshot };
    } else if (actie === 'aanpassen') {
      if (t.fase !== 'wacht-op-rtg') return fout('Deze tweeling wacht niet op beoordeling.', 409);
      t.beoordeling.status = 'aanpassing-gevraagd';
    } else if (actie === 'intrekken') {
      if (!bevoegd(a, 'publicist')) return fout('Alleen de RTG-publicist mag een gepubliceerde training intrekken.', 403);
      if (!t.gepubliceerd) return fout('Deze tweeling staat niet gepubliceerd.', 409);
      t.gepubliceerd = null;
    } else return fout('Kies voorcontroleren, goedkeuren, aanpassen of intrekken.');
    t.beoordeling = Object.assign({}, t.beoordeling || {}, { besluit: actie, door: a.naam, doorSleutel: a.sleutel, at: B.nu(), notitie: reden });
    if (actie !== 'voorcontroleren') B.wijzig(t, a, 'rtg-besluit-' + actie, reden);
    if (actie === 'goedkeuren') t.fase = 'goedgekeurd';
    if (actie === 'aanpassen') t.fase = 'aanpassen';
    if (actie === 'intrekken') t.fase = 'ingetrokken';
    return { ok: true, bedrijf: boardroomLijst(a).bedrijven.find(x => x.code === code) };
  }
  function publiekeWereld() {
    const bedrijven = Object.values(B.staat().bedrijven).filter(t => t.gepubliceerd).map(t => {
      const x = B.kopie(t.gepubliceerd.snapshot), actief = B.relatiesVoor(t.code).filter(r => r.status === 'actief');
      /* De wereldkaart krijgt een snelle cataloguskaart en nooit het complete
         bedrijfsmodel. De server bewaart de volledige bevroren momentopname en
         gebruikt die pas wanneer een speler deze training werkelijk start. */
      const meta = t.gepubliceerd.meta || {};
      return { id: x.id, code: x.code, naam: x.naam, type: x.type, stad: x.stad, profiel: x.profiel,
        cijfers: { locaties: x.locaties.length, afdelingen: x.afdelingen.length, rollen: x.rollen.length,
          aanbod: x.aanbod.length, werkprocessen: x.werkprocessen.length },
        spelregels: x.spelregels, publicatie: { versie: meta.versie, hash: meta.hash, at: meta.at,
          releaseModel: meta.releaseModel || 'legacy', vierOgen: meta.releaseModel === 'vier-ogen-v2' },
        netwerk: actief.map(r => ({ code: r.tegenpartij, naam: r.tegenpartijNaam, soort: r.soort })) };
    });
    return { naam: 'Magnaat Partnerwereld', bedrijven, aantal: bedrijven.length,
      regel: 'Alle bedrijven zijn officieel aangesloten; iedere handeling gebruikt simulatiegeld en synthetische dossiers.' };
  }

  return { relatieVraag: relaties.relatieVraag, relatieBeslis: relaties.relatieBeslis,
    indienen, indieningIntrekken, boardroomLijst,
    boardroomBeslis, publiekeWereld };
};
