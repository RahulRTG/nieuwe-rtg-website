/* CONCERN (deelmodule): DISCOVERY -- het structuurvoorstel uit wat RTG al weet.

   Afgesplitst van ./voorstel.js toen die over de 10 kB ging, en de naad is
   echt: daar komt de kennis van BUITEN (een document dat iemand aanlevert),
   hier van BINNEN (de onderneming en de zaken die dit lid al heeft). Twee heel
   verschillende bronnen, met een heel verschillende foutkans.

   DEZELFDE GRENS ALS DAAR. Het "dit stond al klaar"-effect mag nooit betekenen
   dat er iets is vastgelegd wat niemand heeft gezien: dit is een VOORSTEL, en
   de ondernemer corrigeert alleen de afwijkingen.

   EN HET LEEST ALLEEN WAT VAN DEZE AANVRAGER IS. Er wordt niets voorgesteld
   over andermans bedrijf, ook niet als de namen op elkaar lijken. */
'use strict';

const RV = require('../onderneming/rechtsvorm');

module.exports = (ctx) => {
  const { schoon, entiteitVind, entiteitBeeld, ondernemingVind, findSupplier } = ctx;

  /* ---- DISCOVERY: uit wat RTG al weet ----

     Andersom dan hierboven: geen tekst maar de eigen gegevens. Dit is het "dit
     stond al klaar"-effect, en de grens is dezelfde -- het is een VOORSTEL, en
     de ondernemer corrigeert alleen de afwijkingen.

     LEEST ALLEEN WAT VAN DEZE AANVRAGER IS. De onderneming en de zaken komen
     uit zijn eigen bezit; er wordt niets over andermans bedrijf voorgesteld,
     ook niet als de namen op elkaar lijken. */
  function discovery(eigenaar, ondernemingId) {
    const o = ondernemingVind ? ondernemingVind(String(ondernemingId || '')) : null;
    if (!o || o.eigenaar !== eigenaar) {
      return { status: 404, error: 'Deze onderneming staat niet op uw naam.' };
    }
    const zaak = o.supplierCode ? findSupplier(o.supplierCode) : null;
    const i = o.intake || { idee: {} };

    const voorstel = {
      naam: (zaak && zaak.name) || o.naam || null,
      land: 'NL',
      rechtsvorm: o.rechtsvorm || null,
      registratie: o.kvk || null,
      vestigingen: zaak ? [{ naam: zaak.city || 'Hoofdvestiging', plaats: zaak.city || null, unit: zaak.code }] : [],
      branche: (i.idee && i.idee.branche) || (zaak && zaak.type) || null
    };
    const regels = [];
    if (voorstel.naam) regels.push('Uw bedrijf heet ' + voorstel.naam + '.');
    if (voorstel.rechtsvorm) {
      const rv = RV.rechtsvormVan(voorstel.rechtsvorm);
      if (rv) regels.push('De rechtsvorm is ' + rv.label + '.');
    }
    if (voorstel.registratie) regels.push('Ingeschreven onder ' + voorstel.registratie + '.');
    if (voorstel.vestigingen.length) regels.push('Er draait één zaak: ' + voorstel.vestigingen[0].unit +
      (voorstel.vestigingen[0].plaats ? ' in ' + voorstel.vestigingen[0].plaats : '') + '.');

    return { ok: true, voorstel, regels,
      kop: regels.length ? 'Ik denk dat uw structuur dit is' : 'Ik weet nog te weinig om iets voor te stellen',
      vraag: regels.length ? 'Klopt dit?' : null,
      grens: 'Dit is een voorstel uit uw eigen gegevens. Er is niets vastgelegd tot u het bevestigt, en elk gegeven houdt daarna zijn bron.' };
  }

  /* Discovery omzetten naar een echte entiteit. De velden komen uit het
     voorstel, maar de bron wordt `mens`: de ondernemer heeft ze bevestigd, en
     "RTG heeft het uit zijn eigen gegevens afgeleid" is geen register. */
  function discoveryNeem(eigenaar, ondernemingId, body) {
    const d = discovery(eigenaar, ondernemingId);
    if (!d.ok) return d;
    const b = body || {};
    const naam = schoon(b.naam, 160) || d.voorstel.naam;
    if (!naam) return { status: 400, error: 'Hoe heet deze entiteit?' };
    const r = ctx.entiteitNieuw(eigenaar, { naam, land: b.land || d.voorstel.land,
      rechtsvorm: b.rechtsvorm !== undefined ? b.rechtsvorm : d.voorstel.rechtsvorm, wie: eigenaar });
    if (!r.ok) return r;
    const e = entiteitVind(r.entiteit.id);
    const gedaan = { entiteit: e.id, vestigingen: 0, registratie: false };

    if (d.voorstel.registratie) {
      const reg = ctx.entiteitRegistratie(e, { nummer: d.voorstel.registratie, bronSoort: 'mens', wie: eigenaar });
      gedaan.registratie = !!reg.ok;
    }
    for (const v of d.voorstel.vestigingen) {
      const nv = ctx.vestigingNieuw(e, { naam: v.naam, plaats: v.plaats });
      if (!nv.ok) continue;
      gedaan.vestigingen++;
      /* De zaak wordt HIER aangewezen zonder extra bewijsvraag, en dat mag: de
         onderneming is al van deze aanvrager (dat is hierboven gecontroleerd) en
         de zaak hangt al aan die onderneming. Het bewijs is dus al geleverd,
         een niveau lager. */
      if (v.unit) ctx.vestigingUnit(ctx.vestigingVind(nv.vestiging.id), v.unit, () => true);
    }
    ctx.entiteitOnderneming(e, ondernemingId, () => true);
    return { ok: true, gedaan, entiteit: entiteitBeeld(e),
      uitleg: 'Uw bestaande bedrijf staat nu als entiteit. Alles is overgenomen met bron "ingevuld"; een uittreksel overschrijft dat later met de registerbron.' };
  }

  return { concernDiscovery: discovery, concernDiscoveryNeem: discoveryNeem };
};
