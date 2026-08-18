/* DE OPLOSSER -- fase 5 van REIZEN.md: de knop "Los het op".

   WAT DEZE KNOP IS: de reiziger hoeft de organisatiestructuur achter zijn
   vakantie niet te begrijpen. Hij ziet een signaal van de Reiswacht en drukt op
   een knop; RTG legt uit wat er speelt, wat eraan te doen valt, en zet klaar
   wat klaar te zetten valt.

   WAT DEZE KNOP NIET IS, en dat is de architectuur (REIZEN.md par. 2.1 en
   4.5): een uitvoerder. UITVOEREN BLIJFT BIJ HET DOMEIN, BEVESTIGEN BIJ DE
   MENS. Concreet, langs de drempels van par. 4.5:

   - LEZEN mag altijd: alternatieven zoeken is kijken in de catalogus en op het
     vluchtbord van de domeinen zelf, met een link naar de app waar het echte
     werk gebeurt. De oplosser zegt nooit dat iets geboekt of gereserveerd is
     -- "beschikbaar volgens het bord van nu" is het maximum.
   - EEN TAAK IN DE EIGEN AGENDA is het enige dat deze module kan uitvoeren,
     en pas nadat de mens erop drukte. Een taak kost geen geld en bereikt geen
     tweede persoon (LIFE.md: alles wat een ander bereikt is nooit automatisch)
     -- en hij is idempotent: twee keer drukken zet geen tweede taak.
   - GELD vraagt het domein: boeken en betalen gebeurt daar, met de poorten
     die daar al staan.

   EN DE EERLIJKSTE UITKOMST BESTAAT OOK: soms valt er niets te doen. Op een
   aanvraag die bij de zaak ligt, wacht u -- en iets afwachten is geen taak
   (kern/huis.js zegt dat al). Dat zegt de oplosser dan, in plaats van een
   nepknop te tonen.

   HET VOORSTEL-ID IS EEN VERWIJZING, GEEN INHOUD. De uitvoerroute rekent de
   voorstellen server-side opnieuw uit en zoekt het id daarin op; wat de client
   stuurt bepaalt nooit wat er in de agenda belandt (zelfde principe als bij de
   Invoerbalie: een bewijsstuk dat de aanvrager zelf invult is er geen). */
'use strict';

const { agendaLidSleutel } = require('./agenda');

module.exports.maakReisoplosser = ({ kern }) => {
  const vandaag = () => new Date().toISOString().slice(0, 10);
  const kort = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);

  const GRENS = 'RTG voert hier niets uit. Een taak zet u met één klik in uw eigen agenda; boeken en betalen gebeurt in de app van het domein zelf.';

  /* ---- de voorstellen per signaal ---- */

  function bijAfgewezenReis(reis, sig) {
    /* Alternatieven uit de eigen catalogus: eerst dezelfde bestemming, anders
       het bestaande regeladvies. Puur lezen -- de prijs is de nettoprijs van
       de catalogus van nu, en boeken gebeurt in de reisbureau-app. */
    const alle = (kern.reisbureau.reizen() || []);
    let alt = alle.filter(r => kort(r.bestemming) === kort(reis.bestemming)).slice(0, 3);
    if (!alt.length) alt = alle.slice(0, 3);
    if (!alt.length) return [{ id: 'geen:' + kort(sig.tekst), soort: 'geen',
      tekst: 'Er staan nu geen reizen in de catalogus om als alternatief voor te stellen.' }];
    return alt.map(r => ({
      id: 'alt-reis:' + r.id, soort: 'alternatief',
      tekst: r.titel + ' (' + r.bestemming + ')',
      kosten: { bedrag: r.prijs, per: 'persoon', valuta: 'EUR' },
      uitleg: 'Uit de catalogus van nu; aanvragen en bevestigen loopt via het reisbureau.',
      app: 'Reisbureau', link: '/apps/reisbureau.html'
    }));
  }

  function bijVluchtprobleem(reis, sig, onderdeel) {
    const bord = kern.lucht.bord({ soort: 'vertrek' }) || {};
    const alt = (bord.vluchten || [])
      .filter(v => kort(v.bestemming) === kort(onderdeel.bestemming)
        && v.nummer !== onderdeel.titel
        && !['geannuleerd', 'vertrokken'].includes(v.status))
      .slice(0, 3);
    if (!alt.length) return [{ id: 'geen:' + kort(sig.tekst), soort: 'geen',
      tekst: 'Het vluchtbord van nu heeft geen andere vlucht naar ' + onderdeel.bestemming + '. Kijk later opnieuw, of vraag het reisbureau.' }];
    return alt.map(v => ({
      id: 'alt-vlucht:' + v.id, soort: 'alternatief',
      tekst: v.nummer + ' naar ' + v.bestemming + ' op ' + v.datum + ' om ' + v.tijd,
      kosten: null,
      uitleg: 'Beschikbaar volgens het vluchtbord van dit moment; boeken en omboeken gebeurt bij Vluchten.',
      app: 'Vluchten', link: '/apps/vluchten.html'
    }));
  }

  function bijVisum(reis, sig) {
    if (sig.bron === 'visumtaken') return [{
      id: 'zie-agenda:' + reis.id, soort: 'nakijken',
      tekst: 'De taak staat al in uw agenda; daar staat ook wat de bestemming precies vraagt.',
      app: 'Agenda', link: '/apps/agenda.html'
    }];
    // bron 'landregels': er is geen taak -- die kan met een klik worden klaargezet
    const onderdeel = reis.onderdelen ? reis.onderdelen[0] : null;
    return [{
      id: 'taak-visum:' + reis.id, soort: 'taak',
      tekst: 'Zet de aanvraagtaak in mijn agenda, met de regels van de bestemming erbij.',
      uitleg: 'Een taak in uw eigen agenda; er wordt niets aangevraagd en niemand benaderd.',
      doe: { actie: 'visum', ref: onderdeel ? onderdeel.kenmerk : reis.id,
        bestemming: reis.bestemming, vertrek: reis.venster.van }
    }];
  }

  function bijDocument(reis, sig) {
    // "paspoort van Sam" uit de signaaltekst; de taak verwijst, hij herhaalt niet
    const wat = (sig.tekst.match(/: (.+?) \(geldig tot/) || [])[1] || 'het document';
    return [{
      id: 'taak-doc:' + reis.id + ':' + kort(wat), soort: 'taak',
      tekst: 'Zet "verleng ' + wat + '" in mijn agenda, vóór het vertrek.',
      uitleg: 'Een taak in uw eigen agenda; verlengen doet u bij de uitgevende instantie.',
      doe: { actie: 'document', wat, vertrek: reis.venster.van }
    }];
  }

  function voorstellenVoor(reis, sig) {
    if (sig.bron === 'landregels' || sig.bron === 'visumtaken') return bijVisum(reis, sig);
    if (sig.bron === 'documenten') return bijDocument(reis, sig);
    const onderdeel = (reis.onderdelen || []).find(o => sig.tekst.startsWith((o.titel || o.soort) + ':'));
    if (sig.bron === 'Reisbureau' && /afgewezen/.test(sig.tekst)) return bijAfgewezenReis(reis, sig);
    if ((sig.bron === 'Vluchten' || sig.bron === 'Hangar') && onderdeel) return bijVluchtprobleem(reis, sig, onderdeel);
    if (/na te kijken|tecontroleren/.test(sig.tekst) || sig.tekst.includes('uw controle')) return [{
      id: 'nakijken:' + kort(sig.tekst), soort: 'nakijken',
      tekst: 'Kijk dit onderdeel na bij uw reizen; de onzekere velden staan er gemarkeerd.',
      app: 'Reizen', link: '/apps/reizen.html'
    }];
    if (sig.tekst.includes('wacht op')) return [{
      id: 'afwachten:' + kort(sig.tekst), soort: 'afwachten',
      tekst: 'Hier valt voor u niets te doen: u wacht op een ander. Iets afwachten is geen taak.'
    }];
    return [{ id: 'geen:' + kort(sig.tekst), soort: 'geen',
      tekst: 'Hiervoor heeft RTG geen oplossing klaarliggen. Het signaal blijft staan tot het vanzelf overgaat of u het zelf oplost.' }];
  }

  /* ---- de twee functies ---- */

  function los(key, reisId) {
    const w = kern.reiswacht.wacht(key);
    if (!w.ok) return w;                                   // een oplosser zonder wacht is stuk, niet leeg
    const reisW = (w.reizen || []).find(r => r.id === String(reisId || ''));
    if (!reisW) return { status: 404, error: 'Deze reis staat niet (meer) onder de wacht.' };
    // de onderdelen komen uit De Reis zelf; de wacht draagt ze niet
    const vol = (kern.mijnReizen(key).reizen || []).find(r => r.id === reisW.id) || reisW;
    const blokken = reisW.signalen.map(sig => ({ signaal: sig, voorstellen: voorstellenVoor(vol, sig) }));
    return { ok: true, reis: { id: reisW.id, bestemming: reisW.bestemming, venster: reisW.venster },
      gereed: !blokken.length, blokken, grens: GRENS,
      momentopname: true, stil: w.stil || [] };
  }

  /* De uitvoerknop: alleen een taak-voorstel, alleen na herberekening. */
  async function doe(key, reisId, voorstelId) {
    const r = los(key, reisId);
    if (!r.ok) return r;
    const v = r.blokken.flatMap(b => b.voorstellen).find(x => x.id === String(voorstelId || ''));
    if (!v) return { status: 404, error: 'Dit voorstel bestaat niet (meer); de situatie is intussen veranderd.' };
    if (v.soort !== 'taak') return { status: 409, error: 'Dit voorstel is geen taak: ' +
      (v.soort === 'alternatief' ? 'boeken gebeurt in ' + v.app + '.' : 'er valt hier niets uit te voeren.') };
    if (v.doe.actie === 'visum') {
      const t = await kern.visumtaak.bijBoeking(key, { ref: v.doe.ref, bestemming: v.doe.bestemming, vertrek: v.doe.vertrek });
      return { ok: true, taak: t.taak, al: !t.taak, app: 'Agenda', link: '/apps/agenda.html' };
    }
    if (v.doe.actie === 'document') {
      const eigenaar = agendaLidSleutel(key);
      const bron = ('reisfix:' + reisId + ':' + kort(v.doe.wat)).slice(0, 60);
      if (kern.agenda.lijst(eigenaar).some(i => i.bron === bron))
        return { ok: true, taak: null, al: true, app: 'Agenda', link: '/apps/agenda.html' };
      const t = await kern.agenda.voegToe(eigenaar, {
        titel: 'Verleng ' + v.doe.wat,
        datum: vandaag(),
        notitie: 'Verloopt voor het einde van uw reis (vertrek ' + v.doe.vertrek + '). Verlengen doet u bij de uitgevende instantie.',
        bron
      });
      return { ok: true, taak: t.ok ? t.item : null, al: false, app: 'Agenda', link: '/apps/agenda.html' };
    }
    return { status: 400, error: 'Onbekende taaksoort.' };
  }

  return { reisoplosser: { los, doe } };
};
