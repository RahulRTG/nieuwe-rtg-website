/* ============================================================================
   DE OPENBARE ONDERZOEKSKAART -- wat een lab naar buiten zegt over zijn eigen
   onderzoek, inclusief wat er niet werkte.

   WAAROM DIT ER MOET ZIJN. De impactmodule telt herziene conclusies en gestopte
   studies al -- maar alleen naar binnen. Een lab dat zijn resultaten alleen aan
   zichzelf laat zien, kan niet worden nagekeken; en een gemeente of subsidiegever
   die iets wil weten, krijgt dan een verhaal in plaats van een kaart.

   DRIE DINGEN DIE DEZE KAART ANDERS DOEN DAN EEN PERSBERICHT.

   1. PUBLICEREN IS EEN BESLUIT VAN EEN MENS, en geen gevolg van "af zijn". Een
      studie wordt niet openbaar omdat de laatste stap is gezet; iemand zet zijn
      naam eronder. Zonder besluit staat er niets, ook niet half.

   2. WAT NIET WERKTE IS EEN VERPLICHT BLOK. Niet een appendix, niet optioneel.
      Een lab dat alleen zijn successen publiceert, publiceert geen onderzoek.
      De tekst mag kort zijn; leeg mag hij niet zijn.

   3. DE FEITEN WORDEN AFGELEID EN NIET OVERGETYPT. Bewijsgraad, aantal
      deelnames, herziene conclusies, teruggetrokken deelnemers, gestopte
      hypothesen: die komen live uit het dossier. Wat een mens schrijft is de
      duiding -- wat er is gevonden, en wat er misging. Zou de kaart bevroren
      worden, dan blijft er een bewijsgraad staan die inmiddels is gezakt
      (./terugtrekken.js kan dat vandaag laten gebeuren).

   WAT ER NOOIT OP KOMT: aliassen, de tekst van een observatie, de tekst van een
   klacht, of iets uit een studie waarvan de gegevens gescheiden worden bewaard.
   Een observatie is de zin van een bewoner; die publiceer je niet omdat het
   onderzoek af is. Alleen wat het LAB zelf heeft geschreven en wat te tellen is,
   gaat naar buiten.
   ========================================================================== */
'use strict';

const kader = require('./kader');

module.exports = (ctx) => {
  const { nu, schoon, audit, vindStudie, vindLab, S, save } = ctx;

  const isGescheiden = (s) => { const k = kader.klasse(s.dossier.ethiek.klasse); return !!k && k.gescheiden; };

  /* ---------- publiceren: een mens zet zijn naam eronder ---------- */
  function publiceer(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    if (!s.besluit) {
      return { status: 409, error: 'Er is nog geen besluit over dit onderzoek. Publiceren kan pas als het lab heeft vastgesteld wat het ermee doet -- ook als de uitkomst is dat het gestopt is.' };
    }
    const door = schoon(b.door, 80);
    if (!door) return { status: 400, error: 'Zet uw naam eronder: publiceren is een besluit van een mens en niet van het systeem.' };
    const gevonden = schoon(b.gevonden, 2000);
    if (gevonden.length < 20) return { status: 400, error: 'Schrijf op wat dit onderzoek heeft gevonden, in gewone taal. Dit is wat een bewoner leest.' };
    /* HET VERPLICHTE BLOK. Kort mag; leeg niet. */
    const nietGewerkt = schoon(b.nietGewerkt, 2000);
    if (nietGewerkt.length < 10) {
      return { status: 400, error: 'Wat werkte er niet? Dit blok is verplicht. Een onderzoek zonder mislukking is geen onderzoek maar een bevestiging; als er werkelijk niets misging, schrijf dan op waarom u dat denkt.' };
    }
    s.publicatie = { at: nu(), door, gevonden, nietGewerkt,
      ingetrokken: null };
    audit(s.labId, 'publicatie.zet', wie, s.id, 'gepubliceerd door ' + door);
    s.dossier.logboek.unshift({ id: ctx.rid(), tekst: 'Onderzoek openbaar gemaakt door ' + door + '.', wie: schoon(wie, 80) || 'lab', at: nu() });
    save();
    return { ok: true, kaart: kaart(s.id).kaart };
  }

  /* Terugtrekken van een publicatie. Geen wissen: er blijft staan DAT hij er was
     en waarom hij eraf ging -- anders is een publicatie die iemand niet meer
     uitkomt, stilletjes weg te halen. */
  function trekIn(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    if (!s.publicatie) return { status: 409, error: 'Dit onderzoek is niet gepubliceerd.' };
    const reden = schoon((b || {}).reden, 400);
    if (reden.length < 10) return { status: 400, error: 'Waarom gaat deze publicatie eraf? Die reden blijft openbaar staan.' };
    s.publicatie.ingetrokken = { at: nu(), door: schoon(wie, 80) || 'lab', reden };
    audit(s.labId, 'publicatie.weg', wie, s.id, reden);
    save();
    return { ok: true, let: 'De kaart toont nu dat de publicatie is ingetrokken, met uw reden erbij.' };
  }

  /* ---------- de kaart zelf ---------- */
  function kaart(id) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    if (!s.publicatie) return { status: 404, error: 'Dit onderzoek is (nog) niet openbaar.' };
    const lab = vindLab(s.labId);
    const d = s.dossier;
    const gescheiden = isGescheiden(s);

    /* De conclusies met hun graad, en wat die graad BETEKENT -- want "graad B"
       zegt een bewoner niets. Bij een gescheiden studie gaan de teksten niet mee;
       de graden wel, want die zijn een eigenschap van het onderzoek en niet van
       een deelnemer. */
    const conclusies = d.conclusies.map(c => {
      const g = kader.graad(c.graad) || kader.graad('aanname');
      return { graad: g.graad, graadNaam: g.naam, uitleg: g.uitleg || null,
        tekst: gescheiden ? null : c.tekst, herzien: !!c.herijkt };
    });

    /* WAT ER ONDERWEG VERANDERDE. Alles geteld uit het dossier; geen van deze
       getallen wordt met de hand ingevoerd. */
    const veranderd = {
      conclusiesHerzien: d.reflectie.filter(r => r.soort === 'herzien').length,
      watMisging: d.reflectie.filter(r => r.soort === 'misging').length,
      watTegenviel: d.reflectie.filter(r => r.soort === 'tegenviel').length,
      deelnemersTeruggetrokken: (d.terugtrekkingen || []).length,
      conclusiesGezaktDoorTerugtrekken: (d.terugtrekkingen || []).reduce((n, t) => n + (t.conclusiesGezakt || 0), 0),
      protocolversies: d.protocol ? d.protocol.versie : 0
    };

    return { ok: true, kaart: {
      nummer: s.nummer || null, titel: s.titel,
      lab: lab ? { naam: lab.naam, stad: lab.stad } : null,
      soort: (kader.soort(s.soort) || {}).naam || s.soort,
      status: s.besluit ? s.besluit.soort : s.stap,
      gestart: s.at, gepubliceerd: s.publicatie.at, door: s.publicatie.door,
      ingetrokken: s.publicatie.ingetrokken || null,

      vraag: gescheiden ? null : s.vraagstuk,
      gevonden: s.publicatie.gevonden,
      nietGewerkt: s.publicatie.nietGewerkt,

      hoeZeker: { conclusies,
        let: 'Een bewijsgraad zegt hoe stevig een conclusie staat, niet of zij waar is. De ladder loopt van aanname tot bewezen; wat elke trede vraagt, staat vast in de opzet van dit lab.' },

      /* De deelname wordt geteld en niet benoemd: hoeveel mensen meededen is
         openbaar, wie dat waren is dat nooit -- ook niet als alias. */
      deelnames: d.deelnemers.length,
      metingen: (d.metingen || []).length,
      observaties: gescheiden ? null : d.observaties.length,

      veranderd,

      zegtNiet: {
        deelnemers: 'Wie er meededen staat hier niet, ook niet onder een alias. Deelnemers zijn in dit lab codenamen, en een codenaam op een openbare pagina is een codenaam die te volgen is.',
        ruweGegevens: 'De waarnemingen zelf staan hier niet. Wat een bewoner opschreef of invulde, is van hem; wat het lab eruit concludeerde, staat hierboven.',
        statistiek: 'Er staat geen effectgrootte of betrouwbaarheidsinterval. Die analyse gebeurt buiten dit systeem; RTG rekent ze niet uit en verzint ze niet.',
        gescheiden: gescheiden
          ? 'Dit onderzoek heeft een verhoogde risicoklasse en wordt gescheiden bewaard. Daarom staan hier geen vraagstelling en geen conclusieteksten -- alleen wat het lab zelf heeft geschreven en wat te tellen is.'
          : null
      }
    } };
  }

  /* De openbare lijst van een lab: alleen wat gepubliceerd is. */
  function lijst(labId, max) {
    const lab = vindLab(labId); if (!lab) return { status: 404, error: 'Dit lab bestaat niet.' };
    const rijen = S().studies.filter(s => s.labId === lab.id && s.publicatie)
      .sort((a, b) => (a.publicatie.at < b.publicatie.at ? 1 : -1))
      .slice(0, Math.max(1, Math.min(200, Number(max) || 50)))
      .map(s => ({ nummer: s.nummer || null, id: s.id, titel: s.titel,
        status: s.besluit ? s.besluit.soort : s.stap,
        gepubliceerd: s.publicatie.at,
        ingetrokken: !!(s.publicatie.ingetrokken),
        hoogsteGraad: (s.dossier.conclusies.reduce((h, c) => {
          const g = kader.graad(c.graad) || kader.graad('aanname');
          return !h || g.rang > h.rang ? g : h;
        }, null) || {}).graad || 'aanname' }));
    return { ok: true, lab: { naam: lab.naam, stad: lab.stad }, onderzoeken: rijen,
      let: rijen.length ? null : 'Dit lab heeft nog geen onderzoek openbaar gemaakt. Publiceren is een besluit van een mens en gebeurt niet vanzelf.' };
  }

  return { publiceer, trekIn, kaart, lijst };
};
