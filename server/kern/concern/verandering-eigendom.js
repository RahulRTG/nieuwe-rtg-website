/* CONCERN (deelmodule): VERANDERING AAN DE EIGENDOMSKANT -- uit dienst,
   overname en fusie.

   Afgesplitst van ./verandering.js toen die over de 10 kB ging, en de naad is
   echt: daar staat wat er met de STRUCTUUR gebeurt (wat raakt deze ingreep,
   en hoe zet ik hem terug), hier wat er met MENSEN en EIGENDOM gebeurt. Twee
   onderwerpen die elkaar niet nodig hebben.

   HISTORIE WORDT NOOIT VERNIETIGD. Een overname maakt geen nieuw bedrijf; een
   fusie wist geen dienstverbanden. Dat is wet 4 uit CONCERN.md: als een
   reorganisatie het verleden uitwist, kan niemand meer nagaan wie waarvoor
   tekende toen het gebeurde -- en dat is precies het moment waarop iemand het
   wil weten.

   EN ELKE INGREEP IS IN TWEEEN GEKNIPT: eerst een functie die TOONT, dan een
   die DOET. Wet 5. */
'use strict';

module.exports = (ctx) => {
  const { schoon, entiteitVind, entiteitBeeld, vestigingAlleVanEntiteit,
    employmentVanEntiteit, employmentVanPersoon, employmentVind, employmentBeeindig,
    tijdGeschiedenis, tijdZet, tijdVandaag, concernUbo, concernHouders, save } = ctx;

  /* ---- UIT DIENST ----

     Eerst inventariseren, dan één bevestiging. Wat er open staat wordt niet
     stilzwijgend meeverwijderd: een medewerker die weggaat laat werk achter, en
     dat werk hoort iemand over te nemen. */
  function offboardingBeeld(persoon, entiteitId) {
    const emps = employmentVanPersoon(persoon, false)
      .filter(e => !entiteitId || e.entiteit === entiteitId);
    if (!emps.length) return { status: 404, error: 'Deze persoon heeft hier geen lopende werkrelatie.' };

    const over = [];
    for (const e of emps) {
      const emp = employmentVind(e.id);
      const ent = entiteitVind(e.entiteit);
      /* Bestuurder of gevolmachtigde? Dan is uit dienst gaan niet genoeg -- die
         bevoegdheid loopt door tot zij juridisch wordt beëindigd, en dat is een
         andere handeling met een andere bron. */
      const bestuur = tijdGeschiedenis(e.entiteit, 'bestuurder', persoon).filter(f => f.loopt);
      const volmacht = tijdGeschiedenis(e.entiteit, 'volmacht', persoon).filter(f => f.loopt);
      const ubo = ent ? (concernUbo(e.entiteit).ubos || []).some(u => u.wie === persoon) : false;
      const onder = employmentVanEntiteit(e.entiteit, false).filter(x => x.leidinggevende === e.id);

      over.push({ employment: e.id, entiteit: e.entiteit,
        bedrijf: ent ? entiteitBeeld(ent).naam : null, rol: e.rol, vestiging: e.vestigingNaam,
        bestuurder: bestuur.map(f => ({ id: f.id, rol: f.waarde })),
        volmachten: volmacht.map(f => ({ id: f.id, wat: f.waarde })),
        ubo,
        stuurtAan: onder.map(x => ({ employment: x.id, persoon: x.persoon, rol: x.rol })) });
    }

    const let_ = [];
    for (const o of over) {
      if (o.bestuurder.length) let_.push('Deze persoon is bestuurder van ' + (o.bedrijf || o.entiteit) + '. Uit dienst gaan beëindigt die bevoegdheid NIET.');
      if (o.volmachten.length) let_.push('Er ' + (o.volmachten.length === 1 ? 'staat 1 volmacht' : 'staan ' + o.volmachten.length + ' volmachten') + ' open bij ' + (o.bedrijf || o.entiteit) + '.');
      if (o.ubo) let_.push('Deze persoon is UBO van ' + (o.bedrijf || o.entiteit) + '; dat volgt uit de aandelen en verandert niet door uit dienst te gaan.');
      if (o.stuurtAan.length) let_.push(o.stuurtAan.length + ' medewerker(s) rapporteren aan deze persoon en komen zonder leidinggevende te staan.');
    }
    return { ok: true, persoon, werkrelaties: over, aandacht: let_,
      volgende: 'Bevestig om ' + over.length + ' werkrelatie(s) te beëindigen. Wat hierboven staat wordt NIET automatisch geregeld.' };
  }

  function offboardingDoe(persoon, entiteitId, per) {
    const b = offboardingBeeld(persoon, entiteitId);
    if (!b.ok) return b;
    const gedaan = [];
    for (const w of b.werkrelaties) {
      const emp = employmentVind(w.employment);
      if (!emp) continue;
      const r = employmentBeeindig(emp, per);
      if (r.ok) gedaan.push(r.employment.id);
    }
    return { ok: true, beeindigd: gedaan.length, employments: gedaan,
      blijftStaan: b.aandacht,
      grens: 'De dienstverbanden zijn beëindigd en blijven vindbaar. Bestuursbevoegdheden en volmachten zijn NIET beëindigd; die vragen een eigen handeling met een eigen bron.' };
  }

  /* ---- OVERNAME ----
     Een bedrijf dat van eigenaar wisselt wordt NIET opnieuw aangemaakt. Wat er
     verandert is de eigendomsgraaf en het bestuur; de operationele geschiedenis
     blijft staan. */
  function overname(e, body) {
    const b = body || {};
    const per = b.per && /^\d{4}-\d{2}-\d{2}$/.test(b.per) ? b.per : tijdVandaag();
    const kopers = Array.isArray(b.kopers) ? b.kopers : [];
    if (!kopers.length) return { status: 400, error: 'Wie neemt over, en voor welk deel?' };
    const som = kopers.reduce((n, k2) => n + (Number(k2.percentage) || 0), 0);
    if (som > 100.001) return { status: 400, error: 'De percentages tellen op tot meer dan 100%.' };

    const bron = { bronSoort: b.bronSoort || 'document', bronDetail: b.bronDetail || 'akte van levering', wie: b.wie };
    const oud = ctx.concernHouders(e.id).map(h => h.wie);
    const gedaan = [];

    /* De oude houders sluiten per de overnamedatum, de nieuwe openen. Sluiten
       gebeurt door een nieuw feit met 0% te zetten: dan blijft de oude regel
       staan met zijn eigen loop en is het verloop te lezen. */
    for (const wie of oud) {
      if (kopers.some(k2 => k2.wie === wie)) continue;
      const r = tijdZet(e.id, 'aandeelhouder', Object.assign({ waarde: 0, sleutel: wie, van: per }, bron));
      if (r.ok) gedaan.push(r.feit.id);
    }
    for (const k2 of kopers) {
      const wie = schoon(k2.wie, 80);
      if (!wie) continue;
      const r = tijdZet(e.id, 'aandeelhouder', Object.assign({ waarde: Number(k2.percentage) || 0,
        sleutel: wie, van: per, extra: { klasse: k2.klasse || null, stemrecht: k2.stemrecht ?? null } }, bron));
      if (r.ok) gedaan.push(r.feit.id);
    }
    return { ok: true, per, feiten: gedaan, ubo: concernUbo(e.id, per),
      grens: 'Eigendom en UBO zijn bijgewerkt per ' + per + '. Bestuur, bankmachtigingen en contracten zijn NIET automatisch gewijzigd; dat zijn eigen handelingen met eigen bronnen.' };
  }

  /* ---- FUSIE (operationeel) ----
     Eerst tonen wat het raakt. Het doorvoeren verplaatst vestigingen en
     dienstverbanden naar de blijvende entiteit; de verdwijnende entiteit blijft
     bestaan met haar geschiedenis. */
  function fusieBeeld(vanE, naarE) {
    const v = vestigingAlleVanEntiteit(vanE.id).filter(x => !x.gesloten);
    const m = employmentVanEntiteit(vanE.id, false);
    return { ok: true,
      van: { entiteit: vanE.id, naam: entiteitBeeld(vanE).naam },
      naar: { entiteit: naarE.id, naam: entiteitBeeld(naarE).naam },
      verhuist: { vestigingen: v.length, mensen: m.length,
        zaken: v.reduce((n, x) => n + (x.units || []).length, 0) },
      blijft: 'De juridische feiten van ' + (entiteitBeeld(vanE).naam || vanE.id) +
        ' blijven staan met hun geschiedenis; de entiteit verdwijnt niet uit het systeem.',
      volgende: 'Bevestig om de vestigingen en dienstverbanden over te zetten.' };
  }

  function fusieDoe(vanE, naarE, per) {
    if (vanE.id === naarE.id) return { status: 400, error: 'Een entiteit fuseert niet met zichzelf.' };
    const d = per && /^\d{4}-\d{2}-\d{2}$/.test(per) ? per : tijdVandaag();
    let vest = 0, mens = 0;
    for (const v of vestigingAlleVanEntiteit(vanE.id)) {
      if (v.gesloten) continue;
      v.entiteit = naarE.id; vest++;
    }
    for (const beeld of employmentVanEntiteit(vanE.id, false)) {
      const emp = employmentVind(beeld.id);
      if (!emp) continue;
      emp.entiteit = naarE.id;
      emp.overgekomenVan = vanE.id;
      emp.overgekomenPer = d;
      mens++;
    }
    save();
    return { ok: true, per: d, verhuisd: { vestigingen: vest, mensen: mens },
      grens: 'Dienstverbanden zijn overgezet met behoud van hun begindatum; niemand is opnieuw aangenomen. De juridische feiten van de verdwijnende entiteit blijven staan.' };
  }

  return { concernOffboardingBeeld: offboardingBeeld,
    concernOffboardingDoe: offboardingDoe, concernOvername: overname,
    concernFusieBeeld: fusieBeeld, concernFusieDoe: fusieDoe };
};
