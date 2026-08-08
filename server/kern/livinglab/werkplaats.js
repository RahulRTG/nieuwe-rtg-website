/* RTF Living Lab, deel "werkplaats": de projectwerkruimte. Taken met deadlines,
   documenten met versies, het experimentlogboek en het besluitenlog.

   Waarom dit in hetzelfde systeem zit en niet in vijf externe tools: een project
   van twintig buurtbewoners en drie professionals valt uit elkaar zodra het
   verspreid raakt over een chatgroep, een gedeelde map, een agenda en een
   spreadsheet. Belangrijker nog: een experimentlogboek dat ergens anders staat,
   is geen onderdeel van het dossier -- en dan kan ./bewijs.js er niet naar
   verwijzen en weet niemand meer waarop een conclusie rustte.

   Wat hier NIET in zit, met opzet: chat en videobellen. Die staan al in dit
   platform (shared/teamcall.js, de berichtenlaag) en een tweede implementatie
   ernaast is regel 4. De werkplaats verwijst ernaar in plaats van het na te
   bouwen. */
'use strict';

module.exports = (ctx) => {
  const { nu, rid, schoon, getal, lijst, audit, vindStudie, save } = ctx;

  const datum = d => {
    const t = String(d || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
  };

  /* ---------- taken ----------
     Een taak hangt aan een alias of een naam en heeft een deadline die een echte
     datum is of niets. "eind van de maand" in een tekstveld is geen deadline; er
     valt niet op te sorteren en niemand wordt eraan herinnerd. */
  function taakBij(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    const tekst = schoon(b.tekst, 300);
    if (tekst.length < 3) return { status: 400, error: 'Wat moet er gebeuren?' };
    if (s.dossier.taken.length >= 1000) return { status: 400, error: 'De takenlijst van dit onderzoek zit vol.' };
    const voor = schoon(b.voor, 40);
    if (voor && !s.dossier.deelnemers.some(p => p.alias === voor))
      return { status: 400, error: 'Die deelnemer staat niet op dit onderzoek; laat de taak leeg of kies iemand van het team.' };
    const t = { id: rid(), tekst, voor: voor || null, deadline: datum(b.deadline), af: false,
      door: schoon(wie, 80) || 'lab', at: nu() };
    s.dossier.taken.unshift(t);
    save();
    return { ok: true, taak: t };
  }

  function taakZet(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    const t = s.dossier.taken.find(x => x.id === String(b.taakId || ''));
    if (!t) return { status: 404, error: 'Deze taak bestaat niet.' };
    if (b.weg) { s.dossier.taken = s.dossier.taken.filter(x => x.id !== t.id); save(); return { ok: true, weg: true }; }
    if (b.af != null) { t.af = !!b.af; t.afAt = t.af ? nu() : null; t.afDoor = t.af ? (schoon(wie, 80) || 'lab') : null; }
    if (b.deadline != null) t.deadline = datum(b.deadline);
    if (b.voor != null) {
      const voor = schoon(b.voor, 40);
      if (voor && !s.dossier.deelnemers.some(p => p.alias === voor)) return { status: 400, error: 'Die deelnemer staat niet op dit onderzoek.' };
      t.voor = voor || null;
    }
    save();
    return { ok: true, taak: t };
  }

  /* ---------- documenten ----------
     Versiebeheer zonder bestandsopslag: een document is hier een verwijzing met
     een versienummer en een korte samenvatting. De bestanden zelf gaan langs de
     bestaande bestandenlaag (server/kern/bestanden.js) met haar eigen poort en
     bewaartermijnen; hier staat wat er IS en welke versie ergens bij hoort. */
  function documentBij(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    const naam = schoon(b.naam, 120);
    if (naam.length < 3) return { status: 400, error: 'Hoe heet dit document?' };
    if (s.dossier.documenten.length >= 500) return { status: 400, error: 'Het documentregister zit vol.' };
    const bestaand = s.dossier.documenten.find(d => d.naam === naam);
    if (bestaand) {
      bestaand.versie += 1;
      bestaand.samenvatting = schoon(b.samenvatting, 500) || bestaand.samenvatting;
      bestaand.verwijzing = schoon(b.verwijzing, 300) || bestaand.verwijzing;
      bestaand.versies.unshift({ versie: bestaand.versie, door: schoon(wie, 80) || 'lab', at: nu() });
      if (bestaand.versies.length > 50) bestaand.versies.pop();
      audit(s.labId, 'werk.docversie', wie, s.id, naam + ' v' + bestaand.versie);
      save();
      return { ok: true, document: bestaand, nieuweVersie: true };
    }
    const d = { id: rid(), naam, samenvatting: schoon(b.samenvatting, 500), verwijzing: schoon(b.verwijzing, 300),
      versie: 1, versies: [{ versie: 1, door: schoon(wie, 80) || 'lab', at: nu() }], at: nu() };
    s.dossier.documenten.unshift(d);
    audit(s.labId, 'werk.doc', wie, s.id, naam);
    save();
    return { ok: true, document: d };
  }

  /* ---------- het experimentlogboek ----------
     Ruwe regels uit de uitvoering, met het meetmoment en de apparatuur erbij.
     Dat laatste is het verschil met een notitieblok: een experiment weet
     achteraf met welk apparaat en met welke kalibratie het is uitgevoerd
     (./apparatuur.js vult die verwijzing). */
  function logBij(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    const tekst = schoon(b.tekst, 600);
    if (tekst.length < 3) return { status: 400, error: 'Wat is er gebeurd?' };
    const l = { id: rid(), tekst, meetmoment: getal(b.meetmoment, 0, 500) || null,
      apparatuur: lijst(b.apparatuur, 60, 10), wie: schoon(wie, 80) || 'lab', at: nu() };
    s.dossier.logboek.unshift(l);
    if (s.dossier.logboek.length > 2000) s.dossier.logboek.pop();
    save();
    return { ok: true, regel: l };
  }

  /* ---------- het besluitenlog ----------
     Kleine besluiten die het onderzoek sturen ("we laten meetmoment 3 vallen").
     Ze staan los van het EINDbesluit in ./cyclus.js, en ze zijn niet te wissen:
     een besluitenlog waaruit je regels kunt halen, verklaart achteraf niets. */
  function besluitBij(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    const tekst = schoon(b.tekst, 500);
    if (tekst.length < 5) return { status: 400, error: 'Wat is er besloten?' };
    const door = schoon(b.door, 80) || schoon(wie, 80);
    if (!door) return { status: 400, error: 'Een besluit draagt een naam.' };
    const r = { id: rid(), tekst, waarom: schoon(b.waarom, 500), wie: door, at: nu() };
    s.dossier.besluitenlog.unshift(r);
    if (s.dossier.besluitenlog.length > 500) s.dossier.besluitenlog.pop();
    audit(s.labId, 'werk.besluit', door, s.id, tekst.slice(0, 60));
    save();
    return { ok: true, besluit: r };
  }

  /* Wat er deze week moet gebeuren, over alle studies van een lab heen. Dit is
     het enige overzicht dat NIET per studie is, want een projectleider met vier
     onderzoeken wil één lijst en geen vier tabbladen. */
  function agenda(labId, kijker) {
    const lab = ctx.vindLab(labId); if (!lab) return { status: 404, error: 'Dit lab bestaat niet.' };
    const vandaag = nu().slice(0, 10);
    const rijen = [];
    for (const s of ctx.S().studies) {
      if (s.labId !== lab.id) continue;
      if (!ctx.studie.magTeam(s, kijker)) continue;
      for (const t of s.dossier.taken) {
        if (t.af || !t.deadline) continue;
        rijen.push({ studieId: s.id, studie: s.titel, taak: t.tekst, voor: t.voor, deadline: t.deadline,
          verlopen: t.deadline < vandaag });
      }
    }
    rijen.sort((a, b) => a.deadline.localeCompare(b.deadline));
    return { ok: true, vandaag, verlopen: rijen.filter(r => r.verlopen).length, taken: rijen.slice(0, 200) };
  }

  return { taakBij, taakZet, documentBij, logBij, besluitBij, agenda };
};
