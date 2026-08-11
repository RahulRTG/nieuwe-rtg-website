/* Levensband, deel "banden": vragen, bevestigen, verbreken.

   DE KERNREGEL VAN DIT BESTAND, en de reden dat het bestaat: WIE VRAAGT,
   BEVESTIGT NIET. Een band ontstaat pas als de ANDERE kant hem bevestigt
   (LEVEN.md par. 2.8). Zonder die regel zou wie de gezinscode heeft zichzelf
   aan een kind kunnen hangen, en een code is geen instemming.

   Er is met opzet geen enkele weg omheen: geen beheerdersrecht dat namens een
   ander bevestigt, geen "automatisch bevestigd als het je eigen gezin is",
   geen uitzondering voor de eerste band. Elke uitzondering die iemand hier
   ooit wil toevoegen, opent precies het gat waarvoor de regel er staat. */
'use strict';

module.exports = (ctx) => {
  const { pak, kijk, id, nuIso, vandaag, isKant, andereKant, verlopen,
    zichtBand, save, SOORTEN, MAX_BANDEN } = ctx;

  const schoon = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

  function bandVan(bandId) {
    return kijk().banden.find(b => b.id === String(bandId)) || null;
  }

  /* Alle banden waar deze mens een kant van is -- gevraagd, bevestigd of
     verlopen. Verbroken banden komen NIET terug: die zijn geen relatie meer,
     en een lijst met oude banden is een lijst met mensen die iemand liever
     niet meer ziet. Het spoor blijft wel in de opslag staan, want een band
     die ooit bestond is gebeurd. */
  function mijnBanden(wie) {
    const w = schoon(wie, 120);
    if (!w) return [];
    return kijk().banden.filter(b => isKant(b, w) && b.staat !== 'verbroken').map(zichtBand);
  }

  /* VRAGEN. Van welke kant dan ook: een lid kan een profiel vragen en een
     profiel kan een lid vragen. Wie vraagt wordt vastgelegd, want dat bepaalt
     wie NIET mag bevestigen. */
  function vraag(wie, doel, opties) {
    const d = pak();
    const van = schoon(wie, 120);
    const aan = schoon(doel, 120);
    const o = opties && typeof opties === 'object' ? opties : {};
    if (!van || !aan) return { status: 400, error: 'Van wie naar wie?' };
    if (van === aan) return { status: 400, error: 'Een band met uzelf bestaat niet.' };

    const soort = schoon(o.soort, 40).toLowerCase();
    if (!SOORTEN.includes(soort)) {
      return { status: 400, error: 'Wat bent u voor elkaar? Kies uit: ' + SOORTEN.join(', ') + '.' };
    }
    /* Een lid is een codenaam, een profiel een rtf-handle. Welke kant welke is
       leidt de aanroeper af; hier wordt alleen vastgelegd wie wie is, zodat
       inzage() later weet welke kant om welke gegevens vraagt. */
    const lid = o.lidKant === 'doel' ? aan : van;
    const profiel = o.lidKant === 'doel' ? van : aan;

    const bestaand = kijk().banden.find(b =>
      b.lid === lid && b.profiel === profiel && b.staat !== 'verbroken');
    if (bestaand) {
      return bestaand.staat === 'gevraagd'
        ? { status: 400, error: 'Er staat al een verzoek open; de ander is aan zet.' }
        : { status: 400, error: 'Deze band bestaat al.' };
    }
    if (kijk().banden.filter(b => isKant(b, van) && b.staat !== 'verbroken').length >= MAX_BANDEN) {
      return { status: 400, error: 'Meer dan ' + MAX_BANDEN + ' banden; verbreek er eerst een.' };
    }

    /* Een vervaldatum MAG en hoeft niet. Bij een leerkracht of een mentorschap
       hoort hij er eigenlijk altijd te staan (par. 2.8: toegang die vanzelf
       eindigt), maar dat afdwingen zou hier een oordeel zijn over andermans
       relatie. Het scherm stelt hem voor; deze laag neemt hem aan. */
    const vervalt = /^\d{4}-\d{2}-\d{2}$/.test(o.vervalt || '') ? o.vervalt : '';
    if (vervalt && vervalt < vandaag()) return { status: 400, error: 'Die datum is al voorbij.' };

    const band = { id: id('bnd'), lid, profiel, gezin: schoon(o.gezin, 40).toUpperCase(),
      soort, staat: 'gevraagd', gevraagdDoor: van, gevraagdAt: nuIso(),
      bevestigdAt: null, vervalt };
    d.banden.push(band);
    save();
    return { status: 200, ok: true, band: zichtBand(band) };
  }

  /* BEVESTIGEN, en dit is de plek waar besluit 1 wordt gehandhaafd. */
  function bevestig(wie, bandId) {
    const d = pak();
    const w = schoon(wie, 120);
    const b = d.banden.find(x => x.id === String(bandId));
    if (!b) return { status: 404, error: 'Dit verzoek bestaat niet.' };
    if (!isKant(b, w)) return { status: 403, error: 'Dit verzoek is niet aan u gericht.' };
    if (b.staat === 'verbroken') return { status: 400, error: 'Dit verzoek is ingetrokken.' };
    if (b.staat === 'bevestigd') return { status: 400, error: 'Deze band staat al.' };
    /* WIE VRAAGT, BEVESTIGT NIET. De hele regel van dit bestand, in een zin.
       Zonder deze zin is de bevestiging een formaliteit die de aanvrager zelf
       afvinkt, en dan is er geen tweede kant meer. */
    if (b.gevraagdDoor === w) {
      return { status: 403, error: 'U heeft dit verzoek zelf gestuurd; de ander bevestigt.' };
    }
    b.staat = 'bevestigd';
    b.bevestigdAt = nuIso();
    save();
    return { status: 200, ok: true, band: zichtBand(b) };
  }

  /* VERBREKEN. Door elke kant, altijd, zonder uitleg en zonder toestemming van
     de ander. Ook een openstaand verzoek intrekken loopt hierlangs: een
     verzoek dat je niet kunt terugnemen is een verzoek dat blijft hangen.

     De DELINGEN gaan mee: wie de band verbreekt, verbreekt ook wat er via die
     band te zien was. Ze blijven niet stil geldig wachten op een nieuwe band. */
  function verbreek(wie, bandId) {
    const d = pak();
    const w = schoon(wie, 120);
    const b = d.banden.find(x => x.id === String(bandId));
    if (!b) return { status: 404, error: 'Deze band bestaat niet.' };
    if (!isKant(b, w)) return { status: 403, error: 'Deze band is niet van u.' };
    if (b.staat === 'verbroken') return { status: 400, error: 'Deze band is al verbroken.' };
    b.staat = 'verbroken';
    b.verbrokenAt = nuIso();
    b.verbrokenDoor = w;
    d.delingen = d.delingen.filter(x => x.bandId !== b.id);
    save();
    return { status: 200, ok: true };
  }

  /* Wat staat er op MIJN bord: verzoeken waar ik aan zet ben. Wie zelf vroeg
     staat hier niet tussen -- die wacht, en wachten is geen taak. */
  function openVerzoeken(wie) {
    const w = schoon(wie, 120);
    return kijk().banden
      .filter(b => b.staat === 'gevraagd' && isKant(b, w) && b.gevraagdDoor !== w)
      .map(b => Object.assign(zichtBand(b), { van: andereKant(b, w) }));
  }

  return {
    bandVan,
    api: { banden: mijnBanden, bandVraag: vraag, bandBevestig: bevestig,
      bandVerbreek: verbreek, bandVerzoeken: openVerzoeken, bandVerlopen: verlopen }
  };
};
