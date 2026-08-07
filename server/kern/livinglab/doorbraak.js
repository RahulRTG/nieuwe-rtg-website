/* RTF Living Lab, deel "doorbraak": van onderzoek naar echte verandering.

   Dit is het deel waar het meeste aan hangt. Een goed onderzoek dat eindigt als
   PDF heeft niets veranderd, en dat is de normale afloop -- niet omdat mensen
   lui zijn, maar omdat de volgende stap altijd in een ander systeem zit, bij een
   andere afdeling, met een ander formulier. Daarom staan de uitgangen hier, aan
   het dossier vast, met een status die je kunt volgen.

   ZEVEN UITGANGEN (./kader.js): pilot, werkorder, subsidie, beleid, startup,
   onderwijs, nieuw onderzoek.

   DE POORT ERVOOR. Een uitgang mag alleen ontstaan uit een conclusie die hem kan
   dragen. Wat dat betekent verschilt per uitgang en staat in EIS hieronder:
   een nieuw onderzoek mag uit een aanname komen (dat is juist waar onderzoek
   voor is), maar een beleidsvoorstel of een werkorder niet -- daar hangt geld en
   uitvoering aan, en dan is "een indicatie" de ondergrens. Zo kan een mooi
   verhaal geen gemeentelijk besluit worden.

   DE KOPPELING MET HET RTG ONDERZOEKSLAB. Een pilot gaat door naar
   kern/onderzoekslab.js, waar de ontwikkelketen (idee > onderzoek > prototype >
   proef > uitrol) al staat mét zijn eigen menselijke veiligheidstoets. Er wordt
   hier dus GEEN tweede projectenlijst gebouwd; er ontstaat één project daar, met
   een verwijzing terug. Twee lijsten met dezelfde projecten erin lopen binnen een
   maand uiteen (regel 4). */
'use strict';

const kader = require('./kader');

/* Wat een uitgang minimaal aan bewijs vraagt, als bewijsgraad-rang. */
const EIS = { onderzoek: 0, onderwijs: 1, pilot: 2, startup: 2, subsidie: 2, beleid: 2, werkorder: 2 };
const STATUS = ['voorstel', 'ingediend', 'toegekend', 'afgewezen', 'uitgevoerd'];

module.exports = (ctx) => {
  const { nu, rid, schoon, getal, audit, vindStudie, save } = ctx;

  function uitgangBij(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    const u = kader.uitgang(b.uitgang);
    if (!u) return { status: 400, error: 'Kies een uitgang: ' + kader.UITGANGEN.map(x => x.uitgang).join(', ') + '.' };
    if (s.stap !== 'besluit' && s.stap !== 'vervolg')
      return { status: 409, error: 'Een uitgang hoort bij het besluit of het vervolg; dit onderzoek staat bij ' + s.stap + '.' };
    const c = s.dossier.conclusies.find(x => x.id === String(b.conclusieId || ''));
    if (!c) return { status: 404, error: 'Waar komt dit uit voort? Wijs de conclusie aan.' };
    const graad = kader.graad(c.graad) || kader.graad('aanname');
    const eis = EIS[u.uitgang];
    if (graad.rang < eis) {
      const nodig = kader.BEWIJS.find(g => g.rang === eis);
      return { status: 409, error: 'Een ' + u.naam.toLowerCase() + ' vraagt minstens "' + nodig.naam + '"; deze conclusie staat op "' + graad.naam + '". Verzamel meer bewijs, of kies "nieuw onderzoek" als uitgang.' };
    }
    const titel = schoon(b.titel, 150);
    if (titel.length < 5) return { status: 400, error: 'Geef dit voorstel een titel.' };
    if (s.dossier.uitgangen.length >= 50) return { status: 400, error: 'Vijftig uitgangen op één onderzoek is genoeg.' };
    const x = { id: rid(), uitgang: u.uitgang, titel, conclusieId: c.id, graad: c.graad,
      omschrijving: schoon(b.omschrijving, 1000), ontvanger: schoon(b.ontvanger, 120),
      bedrag: getal(b.bedrag, 0, 100000000), status: 'voorstel', historie: [],
      koppeling: null, door: schoon(wie, 80) || 'lab', at: nu() };
    s.dossier.uitgangen.unshift(x);
    audit(s.labId, 'doorbraak.uitgang', wie, s.id, u.uitgang + ': ' + titel);
    save();
    return { ok: true, uitgang: x };
  }

  function uitgangZet(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    const x = s.dossier.uitgangen.find(y => y.id === String(b.uitgangId || ''));
    if (!x) return { status: 404, error: 'Deze uitgang bestaat niet.' };
    const st = STATUS.includes(b.status) ? b.status : null;
    if (!st) return { status: 400, error: 'Kies een status: ' + STATUS.join(', ') + '.' };
    if (st === x.status) return { status: 400, error: 'Deze uitgang staat al op ' + st + '.' };
    const door = schoon(b.door, 80) || schoon(wie, 80);
    if (!door) return { status: 400, error: 'Wie zet deze status?' };
    /* "Uitgevoerd" is de enige status die iets over de wereld beweert, en die
       eist dus een bewijs van uitvoering. Zonder die regel wordt "uitgevoerd"
       het vinkje waarmee een project wordt afgesloten in plaats van uitgevoerd. */
    const notitie = schoon(b.notitie, 500);
    if (st === 'uitgevoerd' && notitie.length < 10)
      return { status: 400, error: 'Waaraan is te zien dat dit is uitgevoerd? Zonder dat is "uitgevoerd" een vinkje.' };
    x.historie.unshift({ van: x.status, naar: st, door, notitie, at: nu() });
    x.status = st;
    audit(s.labId, 'doorbraak.status', door, s.id, x.id + ' -> ' + st);
    save();
    return { ok: true, uitgang: x };
  }

  /* Een pilot doorzetten naar het RTG Onderzoekslab. Daar begint hij bij `idee`
     en loopt hij de ontwikkelketen af met de menselijke veiligheidstoets die
     daar al staat. De verwijzing gaat twee kanten op zodat je vanuit het ene
     systeem het andere terugvindt. */
  function naarLab(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    const x = s.dossier.uitgangen.find(y => y.id === String(b.uitgangId || ''));
    if (!x) return { status: 404, error: 'Deze uitgang bestaat niet.' };
    if (x.uitgang !== 'pilot') return { status: 400, error: 'Alleen een pilotvoorstel gaat door naar het Onderzoekslab; de andere uitgangen lopen langs hun eigen weg.' };
    if (x.koppeling) return { status: 409, error: 'Deze pilot staat al in het Onderzoekslab.' };
    if (!ctx.lab) return { status: 503, error: 'Het Onderzoekslab is nu niet bereikbaar.' };
    const veld = ctx.lab.VELDEN[b.veld] ? b.veld : null;
    if (!veld) return { status: 400, error: 'Kies een onderzoeksveld van het Onderzoekslab: ' + Object.keys(ctx.lab.VELDEN).join(', ') + '.' };
    const r = ctx.lab.projectMaak({ titel: x.titel, veld, voorWie: 'samen',
      doel: (x.omschrijving || s.vraagstuk).slice(0, 400), budget: x.bedrag }, schoon(wie, 80));
    if (r.error) return r;
    x.koppeling = { systeem: 'onderzoekslab', id: r.project.id, at: nu() };
    ctx.lab.logMaak(r.project.id, 'Komt uit het Living Lab (' + s.titel + '), bewijsgraad ' + (kader.graad(x.graad) || {}).naam + '.', 'livinglab');
    audit(s.labId, 'doorbraak.naarlab', wie, s.id, r.project.id);
    s.dossier.logboek.unshift({ id: rid(), tekst: 'Pilot "' + x.titel + '" doorgezet naar het RTG Onderzoekslab.', wie: schoon(wie, 80) || 'lab', at: nu() });
    save();
    return { ok: true, uitgang: x, project: r.project };
  }

  /* Een vervolgonderzoek: een nieuwe studie die aan deze hangt. De keten van
     onderzoek naar onderzoek is wat een Living Lab onderscheidt van een reeks
     losse projecten -- je ziet waar een vraag vandaan kwam. */
  function vervolgStudie(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    const r = ctx.studie.studieMaak({ labId: s.labId, titel: schoon(b.titel, 120),
      vraagstuk: schoon(b.vraagstuk, 600), doel: schoon(b.doel, 400), soort: b.soort || s.soort }, wie);
    if (r.error) return r;
    const nieuw = ctx.vindStudie(r.studie.id);
    nieuw.uit = Object.assign({}, nieuw.uit, { studie: s.id, studieTitel: s.titel });
    nieuw.dossier.logboek.unshift({ id: rid(), tekst: 'Vervolg op "' + s.titel + '".', wie: 'lab', at: nu() });
    s.dossier.logboek.unshift({ id: rid(), tekst: 'Vervolgonderzoek gestart: "' + nieuw.titel + '".', wie: schoon(wie, 80) || 'lab', at: nu() });
    audit(s.labId, 'doorbraak.vervolg', wie, s.id, nieuw.id);
    save();
    return { ok: true, studie: r.studie };
  }

  /* De pijplijn van een heel lab: wat er uit het onderzoek is gerold en waar het
     staat. Dit is het beeld waar een gemeente of subsidiegever naar vraagt. */
  function pijplijn(labId) {
    const lab = ctx.vindLab(labId); if (!lab) return { status: 404, error: 'Dit lab bestaat niet.' };
    const rijen = [];
    for (const s of ctx.S().studies) {
      if (s.labId !== lab.id) continue;
      for (const x of s.dossier.uitgangen)
        rijen.push({ studieId: s.id, studie: s.titel, uitgang: x.uitgang, titel: x.titel,
          status: x.status, graad: x.graad, bedrag: x.bedrag, ontvanger: x.ontvanger,
          koppeling: x.koppeling, at: x.at });
    }
    const perStatus = {};
    for (const st of STATUS) perStatus[st] = rijen.filter(r => r.status === st).length;
    const perUitgang = kader.UITGANGEN.map(u => ({ uitgang: u.uitgang, naam: u.naam, icon: u.icon,
      aantal: rijen.filter(r => r.uitgang === u.uitgang).length }));
    return { ok: true, totaal: rijen.length, perStatus, perUitgang,
      rijen: rijen.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 300) };
  }

  return { uitgangBij, uitgangZet, naarLab, vervolgStudie, pijplijn, EIS, STATUS };
};
