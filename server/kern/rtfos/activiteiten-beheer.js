/* Foundation OS, deel "activiteiten-beheer": voorbereiden en openzetten.

   TWEE VOORWAARDEN BIJ EEN JEUGDACTIVITEIT, EN ZE STAAN BIJ HET OPENZETTEN.
   Niet bij het inchecken: op de ochtend zelf is het te laat om nog een
   begeleider met een geldige VOG te zoeken of een veiligheidsplan te schrijven.
   Wie de controle naar de deur verplaatst, verplaatst hem naar het moment
   waarop niemand hem meer kan uitvoeren.

   DE VOG-TOETS KOMT UIT HET VRIJWILLIGERSREGISTER en wordt hier niet nagemaakt.
   Twee plekken die hetzelfde oordeel vellen over dezelfde datum, lopen uiteen
   (LAT.md regel 4).

   DE WACHTLIJST SCHUIFT OP EN ZEGT WIE. Ruimte erbij -- meer capaciteit, of een
   afmelding -- laat mensen doorschuiven, en de codenamen komen terug in het
   antwoord. Een plek die vrijkomt en waarvan niemand hoort, is geen plek.

   AFRONDEN VRAAGT EEN EVALUATIE. Een activiteit zonder evaluatie levert volgend
   jaar niets op, en het aantal aanwezigen wordt er meteen bij vastgelegd zodat
   het cijfer niet later uit het geheugen wordt gereconstrueerd.

   Afgesplitst uit activiteiten.js op de 10 KB van keuringsregel 13. */

module.exports = (ctx, eigen) => {
  const { nu, schoon, S, audit, wie, poort, save } = ctx;
  const { vind, beeld, ingeschreven, wachtlijst, aanwezig, vogGeldig, JEUGD, STATUS } = eigen;

  function zet(req, id, b) {
    const a = vind(id);
    if (!a) return { status: 404, error: 'Deze activiteit bestaat niet.' };
    const w = wie(req);
    const g = poort(w, a.stad, 'project.beheren', 'events');
    if (!g.ok) return g;
    b = b || {};
    if (b.naam !== undefined) a.naam = schoon(b.naam, 120) || a.naam;
    if (b.locatie !== undefined) a.locatie = schoon(b.locatie, 120);
    if (b.tijd !== undefined) a.tijd = schoon(b.tijd, 20);
    if (b.veiligheidsplan !== undefined) a.veiligheidsplan = schoon(b.veiligheidsplan, 600) || null;
    if (Array.isArray(b.sponsors)) a.sponsors = b.sponsors.map(x => schoon(x, 80)).filter(Boolean).slice(0, 20);
    if (b.capaciteit !== undefined) {
      const cap = Math.round(Number(b.capaciteit));
      if (!Number.isFinite(cap) || cap <= 0) return { status: 400, error: 'Hoeveel mensen kunnen er mee?' };
      a.capaciteit = Math.min(cap, 100000);
      // Ruimte erbij: de wachtlijst schuift meteen op, en het antwoord zegt wie.
      const opgeschoven = schuifOp(a);
      save();
      return { ok: true, activiteit: beeld(a), opgeschoven };
    }
    save();
    return { ok: true, activiteit: beeld(a) };
  }

  // Wie er van de wachtlijst opschuift zodra er plek is. Geeft de codenamen
  // terug: een plek die vrijkomt en die niemand belt, is geen plek.
  function schuifOp(a) {
    const namen = [];
    for (const i of wachtlijst(a)) {
      if (ingeschreven(a).length >= a.capaciteit) break;
      i.status = 'ingeschreven';
      namen.push(i.codenaam);
    }
    if (a.status === 'vol' && ingeschreven(a).length < a.capaciteit) a.status = 'open';
    return namen;
  }

  /* Begeleiders koppelen. Hier komt de VOG-toets terug -- niet als kopie maar
     via dezelfde functie uit het vrijwilligersregister. */
  function begeleiders(req, id, ids) {
    const a = vind(id);
    if (!a) return { status: 404, error: 'Deze activiteit bestaat niet.' };
    const w = wie(req);
    const g = poort(w, a.stad, 'project.beheren', 'events');
    if (!g.ok) return g;
    const gekozen = (Array.isArray(ids) ? ids : []).map(x => schoon(x, 20)).filter(Boolean).slice(0, 50);
    const uitStad = [];
    for (const vid of gekozen) {
      const v = S().vrijwilligers.find(x => x.id === vid);
      if (!v || v.stad !== a.stad) return { status: 400, error: 'Een van deze vrijwilligers hoort niet bij deze stad.' };
      uitStad.push(v);
    }
    a.begeleiders = gekozen;
    a.vogOk = uitStad.some(vogGeldig);
    audit(w.key, 'activiteit.begeleiders', a.naam, gekozen.length + ' begeleiders');
    save();
    return { ok: true, activiteit: beeld(a), vogOk: !!a.vogOk };
  }

  /* Openzetten voor inschrijving. Twee voorwaarden bij een jeugdactiviteit, en
     ze staan hier en niet bij het inchecken: op de ochtend zelf is het te laat
     om nog een begeleider met een VOG te zoeken. */
  function open(req, id) {
    const a = vind(id);
    if (!a) return { status: 404, error: 'Deze activiteit bestaat niet.' };
    const w = wie(req);
    const g = poort(w, a.stad, 'project.beheren', 'events');
    if (!g.ok) return g;
    if (a.status !== 'gepland' && a.status !== 'vol') {
      return { status: 400, error: 'Deze activiteit staat op "' + a.status + '".' };
    }
    if (JEUGD.includes(a.soort)) {
      const metVog = (a.begeleiders || [])
        .map(vid => S().vrijwilligers.find(x => x.id === vid))
        .filter(Boolean).filter(vogGeldig);
      if (!metVog.length) {
        return { status: 403, error: 'Een ' + a.soort + ' gaat niet open zonder ten minste een begeleider met een geldige VOG. Koppel die eerst.' };
      }
      if (!a.veiligheidsplan) {
        return { status: 400, error: 'Bij een activiteit met kinderen hoort een veiligheidsplan in het dossier: wie doet wat als er iets gebeurt.' };
      }
    }
    a.status = 'open';
    audit(w.key, 'activiteit.open', a.naam, a.capaciteit + ' plekken');
    save();
    return { ok: true, activiteit: beeld(a) };
  }

  function status(req, id, naar, b) {
    b = b || {};
    const a = vind(id);
    if (!a) return { status: 404, error: 'Deze activiteit bestaat niet.' };
    const w = wie(req);
    const g = poort(w, a.stad, 'project.beheren', 'events');
    if (!g.ok) return g;
    const st = String(naar || '');
    if (!STATUS.includes(st)) return { status: 400, error: 'Deze status kennen we niet.' };
    if (st === 'afgerond') {
      const tekst = schoon(b.evaluatie, 600);
      if (tekst.length < 5) {
        return { status: 400, error: 'Hoe ging het? Een activiteit zonder evaluatie levert volgend jaar niets op.' };
      }
      a.evaluatie = { tekst, aanwezig: aanwezig(a).length, door: w.key, at: nu() };
    }
    const oud = a.status;
    a.status = st;
    audit(w.key, 'activiteit.status', a.naam, oud + ' -> ' + st);
    save();
    return { ok: true, activiteit: beeld(a) };
  }

  return { zet, schuifOp, begeleiders, open, status };
};
