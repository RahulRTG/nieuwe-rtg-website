/* Payroll OS: HET DOSSIER -- de vier vragen, voor elk bedrag, op een plek.

   DIT IS DE MAATSTAF DIE IS AFGESPROKEN. De premium enterprise-versie is pas
   klaar wanneer iedere euro antwoord kan geven op vier vragen:

     1. Waarom is dit bedrag berekend?
     2. Welke regel en versie zijn gebruikt?
     3. Wie heeft de invoer en uitkomst goedgekeurd?
     4. Waar is het bedrag daarna geboekt, aangegeven en betaald?

   Elk antwoord stond er al, verspreid: de rekenstappen in de strook, de
   regelversie op de run, de handtekeningen in de goedkeuringen, de boeking in
   het journaal, de aangifte in ./aangifte.js. Verspreid is niet hetzelfde als
   beschikbaar. Wie bij een controle vier schermen moet openen en zelf moet
   optellen, heeft geen dossier maar een zoektocht -- en dat is precies het
   moment waarop iemand een antwoord verzint.

   WAT DIT BESTAND WEL DOET: verzamelen wat er is. WAT HET NIET DOET: iets
   opnieuw uitrekenen, iets afleiden, of een gat opvullen. Een dossier dat
   plausibele antwoorden invult, is gevaarlijker dan een dossier met een gat --
   een gat kun je zien.

   DAAROM DRAAGT ELK ANTWOORD ZIJN EIGEN STAND:

     beantwoord   het antwoord staat er, met de herkomst erbij
     open         het is nog niet gebeurd (niet aangegeven, niet betaald) --
                  een geldig antwoord, en het zegt wat er nog moet
     onbekend     het hoort er te zijn en het is er niet. Dit is de enige
                  stand die om actie vraagt, en hij zegt waarom.

   `volledig` is waar als alle vier de vragen zijn beantwoord. Dat is de
   afgesproken maatstaf, machineleesbaar gemaakt: je kunt hem toetsen, tellen en
   op een scherm zetten in plaats van erover praten. */
'use strict';

function maakDossier({ run, journaal, aangifte, regelpakket, contracten }) {

  /* Vraag 1: waarom is dit bedrag berekend?
     De rekenstappen van de motor, plus de INVOER waaruit ze komen. Zonder de
     invoer is de som niet over te doen: je ziet dan wel dat er 160 uur is
     gerekend, maar niet waar die 160 vandaan kwam. */
  function waarom(run, strookRij) {
    const st = strookRij.strook;
    return {
      stand: 'beantwoord',
      invoer: strookRij.invoer,
      contract: strookRij.contract,
      regels: st.regels,
      stappen: st.stappen,
      valuta: st.valuta || null,
      totalen: { brutoCenten: st.brutoCenten, loonheffingCenten: st.loonheffingCenten,
        inhoudingenCenten: st.inhoudingenCenten, nettoCenten: st.nettoCenten,
        werkgeverslastenCenten: st.werkgeverslastenCenten }
    };
  }

  /* Vraag 2: welke regel en versie zijn gebruikt?
     Niet alleen het versienummer maar ook WAAR dat pakket vandaan kwam en wie
     het heeft aangemerkt. Een versie zonder herkomst is een getal. */
  function welkeRegel(r) {
    const p = regelpakket.opVersie(r.land, r.regelversie);
    if (!p) return { stand: 'onbekend', versie: r.regelversie, land: r.land,
      uitleg: 'De run is gerekend met regelpakket ' + r.regelversie +
        ', maar dat pakket staat niet meer in de administratie. Zonder het pakket is de berekening niet over te doen.' };
    return { stand: 'beantwoord', versie: p.versie, land: p.land,
      geldigVan: p.geldigVan, geldigTot: p.geldigTot,
      standVanPakket: p.stand, bron: p.bron,
      goedgekeurdDoor: p.goedgekeurdDoor, goedgekeurdOp: p.goedgekeurdOp,
      valuta: p.valuta || null,
      let: p.stand !== 'goedgekeurd'
        ? 'Dit pakket is nooit door een mens aangemerkt. Op zo\'n pakket hoort geen definitieve loonrun te draaien.' : null };
  }

  /* Vraag 3: wie heeft de invoer en de uitkomst goedgekeurd?
     Drie handtekeningen, en ze horen alle drie bij een ANDER moment: het
     contract (de invoer), de manager (de uren en bedragen) en de administrateur
     (de tweede paar ogen). Ontbreekt er een, dan staat dat er. */
  function wieKeurde(r, strookRij) {
    const rollen = (r.goedkeuringen || []).map(g => g.rol);
    const contract = strookRij && strookRij.contract;
    const ontbreekt = [];
    if (!rollen.includes('manager')) ontbreekt.push('de manager van de zaak');
    if (!rollen.includes('administrateur')) ontbreekt.push('de administrateur');
    if (!contract || !contract.door) ontbreekt.push('wie het contract vastlegde');
    return {
      stand: ontbreekt.length ? 'onbekend' : 'beantwoord',
      goedkeuringen: r.goedkeuringen || [],
      definitiefDoor: r.definitiefDoor || null, definitiefOp: r.definitiefOp || null,
      geopendDoor: r.geopendDoor || null,
      contractVastgelegdDoor: contract ? (contract.door || null) : null,
      contractVastgelegdOp: contract ? (contract.vastgelegdOp || null) : null,
      contractTerugwerkend: contract ? !!contract.terugwerkend : null,
      stappen: r.stappen || [],
      ontbreekt
    };
  }

  /* Vraag 4: waar is het bedrag daarna geboekt, aangegeven en betaald?
     Drie aparte antwoorden, want ze kunnen los van elkaar ontbreken -- en dat
     is juist de informatie. "Wel geboekt, niet aangegeven" is een bevinding. */
  function waarheen(r) {
    const uit = { stand: 'beantwoord', geboekt: null, aangegeven: null, betaald: null };

    const b = journaal.boeking(r);
    uit.geboekt = b.error
      ? { stand: 'onbekend', uitleg: b.error }
      : { stand: 'beantwoord', regels: b.regels, somDebet: b.somDebet, somCredit: b.somCredit,
          sluitAan: b.somDebet === b.somCredit };

    const aan = (aangifte.vanZaak(r.code, r.periode) || []).find(a => a.runId === r.id);
    uit.aangegeven = !aan
      ? { stand: 'open', uitleg: 'Voor deze loonrun is nog geen aangifte opgemaakt.' }
      : aan.stand !== 'ingediend'
        ? { stand: 'open', id: aan.id, soort: aan.soort,
            uitleg: 'De aangifte is opgemaakt maar nog niet ingediend.',
            teBetalenCenten: aan.teBetalenCenten }
        : { stand: 'beantwoord', id: aan.id, soort: aan.soort, kenmerk: aan.kenmerk,
            ingediendDoor: aan.ingediendDoor, ingediendOp: aan.ingediendOp,
            teBetalenCenten: aan.teBetalenCenten };

    /* Het betaalbestand wordt hier NIET gemaakt -- dat zou betekenen dat het
       openen van een dossier geld in beweging zet. We kijken of er er een is. */
    const bestanden = (journaal.bestandenVan ? journaal.bestandenVan(r.id) : []);
    uit.betaald = !bestanden.length
      ? { stand: 'open', uitleg: 'Er is nog geen betaalbestand gemaakt voor deze loonrun.' }
      : { stand: 'beantwoord', bestanden: bestanden.map(x => ({ id: x.id, aantal: x.aantal,
          totaalCenten: x.totaalCenten, gemaaktOp: x.gemaaktOp, verzonden: !!x.verzonden })) };

    if ([uit.geboekt, uit.aangegeven, uit.betaald].some(x => x.stand === 'onbekend')) uit.stand = 'onbekend';
    else if ([uit.aangegeven, uit.betaald].some(x => x.stand === 'open')) uit.stand = 'open';
    return uit;
  }

  /* Het dossier van EEN medewerker binnen een run. Dat is de eenheid waar een
     vraag over gaat: niemand vraagt "waarom is deze loonrun 84.000 euro", ze
     vragen "waarom kreeg ik dit". */
  function vanMedewerker(runId, staffId) {
    const r = run.haal(String(runId || ''));
    if (!r) return { status: 404, error: 'Deze loonrun kennen we niet.' };
    const rij = r.stroken.find(s => s.staffId === Number(staffId));
    if (!rij) return { status: 404, error: 'Deze medewerker staat niet in deze loonrun.' };

    const antwoorden = {
      waarom: waarom(r, rij),
      welkeRegel: welkeRegel(r),
      wieKeurde: wieKeurde(r, rij),
      waarheen: waarheen(r)
    };
    const standen = Object.values(antwoorden).map(a => a.stand);
    return { ok: true,
      run: { id: r.id, code: r.code, zaak: r.zaak, periode: r.periode, land: r.land, stand: r.stand,
        correctieVan: r.correctieVan || null },
      medewerker: { staffId: rij.staffId, naam: rij.naam },
      bedrag: { nettoCenten: rij.strook.nettoCenten, valuta: rij.strook.valuta || null },
      antwoorden,
      volledig: standen.every(s => s === 'beantwoord'),
      open: standen.filter(s => s !== 'beantwoord').length
    };
  }

  /* Het dossier van de hele run: dezelfde vier vragen, maar vraag 1 en 3 per
     medewerker samengevat. Bedoeld voor de accountant die niet naar EEN persoon
     vraagt maar naar de periode. */
  function vanRun(runId) {
    const r = run.haal(String(runId || ''));
    if (!r) return { status: 404, error: 'Deze loonrun kennen we niet.' };
    const perMens = r.stroken.map(s => {
      const d = vanMedewerker(r.id, s.staffId);
      return { staffId: s.staffId, naam: s.naam, volledig: d.volledig, open: d.open,
        nettoCenten: s.strook.nettoCenten };
    });
    const gezamenlijk = { welkeRegel: welkeRegel(r), waarheen: waarheen(r) };
    return { ok: true,
      run: { id: r.id, code: r.code, zaak: r.zaak, periode: r.periode, land: r.land, stand: r.stand,
        aantal: r.stroken.length, totaalNettoCenten: r.totaalNettoCenten,
        valuta: ((r.stroken[0] || {}).strook || {}).valuta || null },
      antwoorden: gezamenlijk,
      medewerkers: perMens,
      volledig: perMens.every(m => m.volledig),
      onvolledig: perMens.filter(m => !m.volledig).length };
  }

  return { vanMedewerker, vanRun };
}

module.exports = { maakDossier };
