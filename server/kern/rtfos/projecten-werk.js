/* Foundation OS, deel "projecten-werk": wat er IN een project gebeurt --
   activiteiten, indicatoren, bewijsstukken, rapportages en het aantal mensen
   dat werkelijk is geholpen.

   MEET RESULTAAT, NIET DRUKTE. "500 maaltijden uitgedeeld" zegt niets over hoe
   veel mensen er zijn geholpen: dat kunnen er 500 zijn of 12. De indicator
   heeft daarom altijd drie getallen naast elkaar -- doel, bereikt, en
   doorgestroomd -- plus uitval. Een subsidiegever die alleen "bereikt" ziet,
   ziet de helft.

   DEELNEMERS ZIJN EEN TELLER, GEEN LIJST. Wie er geholpen is, staat in de
   casusmodule (met codenaam, toestemming en een bewaartermijn) of nergens. Hier
   staat alleen HOEVEEL -- uniek, herhaald en uitgevallen. Dat is precies wat
   een gemeente, een fonds of een jaarverslag nodig heeft, en het is ook alles
   wat ze horen te krijgen. Een deelnemerslijst in het projectdossier is de
   makkelijkste manier om per ongeluk een bijzonder persoonsgegeven te
   verspreiden over acht portalen.

   BEWIJSSTUKKEN ZIJN VERWIJZINGEN. Facturen, foto's en presentielijsten wonen
   in de bestandenkluis; hier staat wat er is en waar het over gaat. Twee
   documentopslagen naast elkaar is regel 4 (twee plekken die een waarheid
   vasthouden) in bestandsvorm. */

module.exports = (ctx, eigen) => {
  const { nu, rid, schoon, S, audit, wie, poort, save } = ctx;
  const { vind, beeld } = eigen;

  // Elke handeling hieronder loopt door dezelfde poort: de stad van het
  // project, het recht om het project te beheren, en de module die eronder
  // valt. Een module die uit gaat, bevriest dus ook de voortgang.
  function open(req, id, recht) {
    const p = vind(id);
    if (!p) return { status: 404, error: 'Dit project bestaat niet.' };
    const w = wie(req);
    const g = poort(w, p.stad, recht || 'project.beheren', p.vlag);
    if (!g.ok) return g;
    return { ok: true, p, w };
  }

  function activiteit(req, id, b) {
    const o = open(req, id);
    if (!o.ok) return o;
    b = b || {};
    const tekst = schoon(b.tekst, 200);
    if (!tekst) return { status: 400, error: 'Wat gaat er gebeuren?' };
    if (!Array.isArray(o.p.activiteiten)) o.p.activiteiten = [];
    if (o.p.activiteiten.length >= 500) return { status: 400, error: 'Dit project heeft al vijfhonderd activiteiten.' };
    o.p.activiteiten.unshift({ id: rid(), tekst, wanneer: schoon(b.wanneer, 10) || null,
      plek: schoon(b.plek, 80), af: false, at: nu() });
    save();
    return { ok: true, project: beeld(o.p) };
  }

  /* De indicator. Vier getallen, en ze mogen elkaar niet tegenspreken:
     doorgestroomd en uitgevallen zijn deelverzamelingen van bereikt. Dat wordt
     hier afgedwongen en niet aan de invuller overgelaten -- een rapport waarin
     31 van de 12 bereikte jongeren zijn doorgestroomd, komt anders zo bij een
     subsidiegever op tafel. */
  function indicatorZet(req, id, b) {
    const o = open(req, id);
    if (!o.ok) return o;
    b = b || {};
    const naam = schoon(b.naam, 120);
    if (!naam) return { status: 400, error: 'Wat meet deze indicator?' };
    const getal = v => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n >= 0 ? Math.min(n, 10000000) : null;
    };
    const doel = getal(b.doel === undefined ? 0 : b.doel);
    const bereikt = getal(b.bereikt === undefined ? 0 : b.bereikt);
    const door = getal(b.doorgestroomd === undefined ? 0 : b.doorgestroomd);
    const uit = getal(b.uitgevallen === undefined ? 0 : b.uitgevallen);
    if (doel === null || bereikt === null || door === null || uit === null) {
      return { status: 400, error: 'Vul hele aantallen in, nul of hoger.' };
    }
    if (door + uit > bereikt) {
      return { status: 400, error: 'Doorgestroomd (' + door + ') en uitgevallen (' + uit +
        ') zijn samen meer dan bereikt (' + bereikt + '). Dat kan niet kloppen.' };
    }
    if (!Array.isArray(o.p.indicatoren)) o.p.indicatoren = [];
    const bestaand = o.p.indicatoren.find(i => i.naam.toLowerCase() === naam.toLowerCase());
    const rij = bestaand || { id: rid(), naam };
    Object.assign(rij, { doel, bereikt, doorgestroomd: door, uitgevallen: uit,
      actief: Math.max(0, bereikt - door - uit), bij: nu() });
    if (!bestaand) {
      if (o.p.indicatoren.length >= 30) return { status: 400, error: 'Dertig indicatoren is genoeg voor een project.' };
      o.p.indicatoren.push(rij);
    }
    audit(o.w.key, 'project.indicator', o.p.naam, naam + ': ' + bereikt + '/' + doel);
    save();
    return { ok: true, project: beeld(o.p) };
  }

  // Het aantal geholpen mensen. Uniek is het getal dat telt; herhaald zegt of
  // de hulp structureel is of eenmalig.
  function deelnemers(req, id, b) {
    const o = open(req, id);
    if (!o.ok) return o;
    b = b || {};
    const n = Math.round(Number(b.uniek));
    if (!Number.isFinite(n) || n < 0) return { status: 400, error: 'Hoeveel unieke mensen zijn er geholpen?' };
    const h = Math.round(Number(b.herhaald));
    o.p.deelnemersUniek = Math.min(n, 10000000);
    o.p.deelnemersHerhaald = Number.isFinite(h) && h >= 0 ? Math.min(h, 10000000) : (o.p.deelnemersHerhaald || 0);
    audit(o.w.key, 'project.deelnemers', o.p.naam, o.p.deelnemersUniek + ' uniek');
    save();
    return { ok: true, project: beeld(o.p) };
  }

  function bewijsMaak(req, id, b) {
    const o = open(req, id);
    if (!o.ok) return o;
    b = b || {};
    const naam = schoon(b.naam, 120);
    if (!naam) return { status: 400, error: 'Hoe heet het bewijsstuk?' };
    if (!Array.isArray(o.p.bewijs)) o.p.bewijs = [];
    if (o.p.bewijs.length >= 300) return { status: 400, error: 'Dit dossier zit vol.' };
    o.p.bewijs.unshift({ id: rid(), naam, soort: schoon(b.soort, 40) || 'overig',
      verwijzing: schoon(b.verwijzing, 200), door: o.w.key, at: nu() });
    audit(o.w.key, 'project.bewijs', o.p.naam, naam);
    save();
    return { ok: true, project: beeld(o.p) };
  }

  /* Een rapportage is een moment, geen bestand: wat er die periode is gedaan,
     wat het opleverde en wat er niet lukte. Dat laatste veld is verplicht --
     een rapportage waarin nooit iets misgaat, wordt niet gelezen maar
     afgevinkt. */
  function rapportage(req, id, b) {
    const o = open(req, id);
    if (!o.ok) return o;
    b = b || {};
    const periode = schoon(b.periode, 40);
    const gedaan = schoon(b.gedaan, 600);
    if (!periode) return { status: 400, error: 'Over welke periode gaat deze rapportage?' };
    if (!gedaan) return { status: 400, error: 'Wat is er die periode gedaan?' };
    const knelpunt = schoon(b.knelpunt, 400);
    if (!knelpunt) return { status: 400, error: 'Wat lukte er niet, of waar zit het knelpunt? Schrijf "geen" als er niets was.' };
    if (!Array.isArray(o.p.rapportages)) o.p.rapportages = [];
    o.p.rapportages.unshift({ id: rid(), periode, gedaan, knelpunt,
      resultaat: schoon(b.resultaat, 600), door: o.w.key, at: nu() });
    if (o.p.rapportages.length > 100) o.p.rapportages.pop();
    audit(o.w.key, 'project.rapportage', o.p.naam, periode);
    save();
    return { ok: true, project: beeld(o.p) };
  }

  return { activiteit, indicatorZet, deelnemers, bewijsMaak, rapportage };
};
