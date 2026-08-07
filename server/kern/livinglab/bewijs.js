/* RTF Living Lab, deel "bewijs": de motor die voorkomt dat een mooi verhaal een
   feit wordt.

   Een conclusie is hier geen zin maar een zin MET zijn dragers: bronnen,
   datasets, observaties, interviews, experimenten en statistiek. De bewijsgraad
   (aanname / waarneming / indicatie / sterk bewijs / bewezen binnen deze studie)
   is daarmee niet iets wat je kiest, maar iets wat je verdient.

   DRIE PLAFONDS, en een conclusie zakt naar het laagste ervan:

   1. WAT ER LIGT. Nul dragers is een aanname. Eén drager is een waarneming.
      Een patroon (drie dragers, uit minstens twee verschillende soorten) is een
      indicatie. Hoger dan indicatie komt er nooit uit rekenwerk alleen.
   2. WAT DE METHODE KAN DRAGEN. Acht interviews blijven acht interviews, ook
      met tien citaten: `plan.hoogstBewijs` uit ./plan.js is een hard plafond.
      Zonder plan is dat plafond `waarneming` -- wie nog geen opzet heeft, heeft
      per definitie geen vergelijking.
   3. WIE HET TEKENT. "Sterk bewijs" en "bewezen" dragen `mens: true` in
      ./kader.js: die graden bestaan alleen met de handtekening van een
      tekenbevoegde. En bij een MENSELIJK onderwerp (welzijn, gedrag, cohesie,
      onderwijs) ligt die grens een stap lager -- daar vraagt alles boven
      "waarneming" al een professionele handtekening. Dat is punt 3 van de
      opdracht in code: bij mentale en sociale onderwerpen weegt het menselijke
      oordeel zwaarder, en neemt de AI geen risicovolle conclusie.

   De AI komt in dit bestand niet voor. Dat is geen omissie maar het ontwerp:
   ./ai.js kan een conclusie VOORSTELLEN, en dat voorstel loopt daarna langs
   precies dezelfde drie plafonds als dat van een mens. */
'use strict';

const kader = require('./kader');
const graden = require('./graden');

const SOORTEN_BEWIJS = ['bron', 'dataset', 'observatie', 'interview', 'experiment', 'statistiek'];

module.exports = (ctx) => {
  const { nu, rid, schoon, audit, vindStudie, save, bestuur } = ctx;

  // de ladder zelf staat in ./graden.js: puur rekenwerk, geen opslag
  const { plafond, handtekeningNodig } = graden;

  function conclusieBij(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    const tekst = schoon(b.tekst, 600);
    if (tekst.length < 10) return { status: 400, error: 'Wat concludeert u? Schrijf het als een bewering.' };
    if (s.dossier.conclusies.length >= 200) return { status: 400, error: 'Tweehonderd conclusies is genoeg; voeg ze liever samen.' };
    const c = { id: rid(), tekst, graad: 'aanname', bewijs: [], tekenaar: null,
      door: schoon(wie, 80) || 'lab', voorstel: !!b.voorstel, at: nu() };
    s.dossier.conclusies.unshift(c);
    audit(s.labId, 'bewijs.conclusie', wie, s.id, tekst.slice(0, 60));
    save();
    return { ok: true, conclusie: c, plafond: plafond(s, c).graad.graad };
  }

  /* Bewijs onder een conclusie hangen. `ref` wijst naar iets dat in dit dossier
     bestaat -- een bronId, een datasetId, een observatieId. Een verwijzing naar
     iets dat er niet is, is de stilste manier om bewijs te verzinnen, dus die
     wordt hier nagetrokken en niet aangenomen. */
  function bewijsKoppel(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    const c = s.dossier.conclusies.find(x => x.id === String(b.conclusieId || ''));
    if (!c) return { status: 404, error: 'Deze conclusie bestaat niet.' };
    const soort = SOORTEN_BEWIJS.includes(b.soort) ? b.soort : null;
    if (!soort) return { status: 400, error: 'Kies een bewijssoort: ' + SOORTEN_BEWIJS.join(', ') + '.' };
    if (b.weg) {
      c.bewijs = c.bewijs.filter(w => !(w.soort === soort && w.ref === String(b.ref || '')));
      herijk(s, c);
      save();
      return { ok: true, conclusie: c, plafond: plafond(s, c).graad.graad };
    }
    const ref = schoon(b.ref, 60);
    const bestaat = {
      bron: () => s.dossier.bronnen.find(x => x.id === ref),
      dataset: () => s.dossier.datasets.find(x => x.id === ref),
      observatie: () => s.dossier.observaties.find(x => x.id === ref)
    }[soort];
    if (bestaat) {
      const gevonden = bestaat();
      if (!gevonden) return { status: 404, error: 'Dat ' + soort + '-bewijs staat niet in dit dossier.' };
      /* Een bron die niemand heeft nagetrokken draagt niets. Dit is de plek waar
         "ik heb ergens gelezen dat" strandt. */
      if (soort === 'bron' && !gevonden.nagetrokken)
        return { status: 409, error: 'Deze bron is nog niet nagetrokken; een ongecontroleerde bron draagt geen conclusie.' };
    } else if (ref.length < 3) {
      // interview, experiment en statistiek verwijzen naar iets buiten het
      // dossier; dan is een omschrijving het minimum.
      return { status: 400, error: 'Beschrijf waar dit ' + soort + '-bewijs vandaan komt.' };
    }
    if (c.bewijs.some(w => w.soort === soort && w.ref === ref)) return { status: 409, error: 'Dit bewijs hangt er al onder.' };
    if (c.bewijs.length >= 50) return { status: 400, error: 'Vijftig dragers onder één conclusie is genoeg.' };
    c.bewijs.push({ soort, ref, notitie: schoon(b.notitie, 200), door: schoon(wie, 80) || 'lab', at: nu() });
    herijk(s, c);
    audit(s.labId, 'bewijs.koppel', wie, s.id, c.id + ' <- ' + soort);
    save();
    return { ok: true, conclusie: c, plafond: plafond(s, c).graad.graad };
  }

  /* Zakt de graad mee als het bewijs eronder wegvalt? Ja. Dat is de hele reden
     dat de graad niet los wordt opgeslagen maar herijkt: anders houdt een
     conclusie "bewezen" nadat de dataset eronder is ingetrokken. */
  function herijk(s, c) {
    const p = plafond(s, c).graad;
    if ((kader.graad(c.graad) || kader.graad('aanname')).rang > p.rang) {
      c.graad = p.graad;
      c.herijkt = nu();
      /* De handtekening gold voor de graad die er stond, en die is nu lager.
         Hij vervalt dus -- maar alleen als de nieuwe graad er geen meer vraagt.
         Anders zou het wegstrepen van de handtekening het plafond opnieuw
         verlagen, en zakt een conclusie bij elke herijking een trede verder. */
      if (c.tekenaar && !handtekeningNodig(s, p)) c.tekenaar = null;
    }
  }

  function graadZet(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    const c = s.dossier.conclusies.find(x => x.id === String(b.conclusieId || ''));
    if (!c) return { status: 404, error: 'Deze conclusie bestaat niet.' };
    const doel = kader.graad(b.graad);
    if (!doel) return { status: 400, error: 'Kies een geldige bewijsgraad.' };
    /* Een handtekening zetten mag alleen door een tekenbevoegde van dit lab, en
       bij een menselijk onderwerp specifiek door een professional, reviewer of
       toezichthouder -- dezelfde rollen, maar de eis is hier expliciet omdat
       juist hier iemand geneigd is zichzelf te tekenen. */
    let tekenaar = c.tekenaar;
    const door = schoon(b.door, 80);
    if (door) {
      const t = bestuur.tekenaarVan(s.labId, door);
      if (!t) return { status: 403, error: 'Alleen een tekenbevoegde van dit lab tekent een conclusie; ' + door + ' staat niet in het register.' };
      tekenaar = { naam: door, rol: t.rol, at: nu() };
    }
    const proef = Object.assign({}, c, { tekenaar });
    const p = plafond(s, proef);
    if (doel.rang > p.graad.rang)
      return { status: 409, error: 'Deze conclusie kan hoogstens "' + p.graad.naam + '" dragen, omdat ' + p.reden + '.',
        plafond: p.graad.graad, gevraagd: doel.graad };
    const nodig = handtekeningNodig(s, doel);
    if (nodig && !tekenaar)
      return { status: 409, error: '"' + doel.naam + '" bestaat hier alleen met een handtekening; noem de mens die hem zet.' };
    /* De handtekening BLIJFT staan zolang de graad hem vraagt. Hem hier
       weggooien bij een graad die hem niet strikt nodig heeft, was de eerste
       versie -- en dan verlaagde de eerstvolgende herijking het plafond, zodat
       een conclusie zakte juist doordat er bewijs bij kwam. */
    c.graad = doel.graad; c.tekenaar = nodig ? tekenaar : null; c.voorstel = false;
    audit(s.labId, 'bewijs.graad', door || wie, s.id, c.id + ' -> ' + doel.graad);
    s.dossier.logboek.unshift({ id: rid(), tekst: 'Conclusie op "' + doel.naam + '"' + (tekenaar ? ', getekend door ' + tekenaar.naam : '') + '.', wie: door || schoon(wie, 80) || 'lab', at: nu() });
    save();
    return { ok: true, conclusie: c };
  }

  return { conclusieBij, bewijsKoppel, graadZet, plafond, handtekeningNodig, SOORTEN_BEWIJS };
};
