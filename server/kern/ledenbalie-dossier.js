/* HET DOSSIER DAT DE BALIE TE ZIEN KRIJGT -- en, belangrijker, wat er NIET in
   staat.

   Dit is regel 2 van ./ledenbalie.js, en het is de regel waar een fout het
   stilst is. De balie helpt een LID en niet een persoon: welke pas, sinds
   wanneer, welke stad, welke klachten -- daar kun je iemand mee helpen zonder
   te weten wie hij is. Wie de echte naam toch nodig heeft, vraagt die apart op
   via de kluis, en dat komt in het inzagejournaal.

   Vandaar dat dit een eigen bestand is en geen blok. Het is de enige plek in
   de balie waar velden over een MENS bij elkaar worden gezet, en een veld dat
   er stil bij komt (het telefoonnummer, het e-mailadres, het adres) is precies
   de fout die niemand ziet gebeuren -- er komt geen melding van, het scherm
   wordt alleen wat voller. Ze staan hier bij elkaar zodat er een bestand is
   dat je in zijn geheel kunt lezen als je wil weten wat een baliemedewerker
   over een lid ziet, en de toets pint het aantal velden dicht af op acht.

   Zoeken hoort hier ook, en om dezelfde reden: een codenaam natrekken is
   inzage, ook als er niets uitkomt. */
'use strict';

function maakDossier({ accounts, inzagelog, onboarding, kap, openKlachten, eis, noteer }) {

  /* De steuncode: een kort kenmerk voor DIT contact, af te leiden uit het
     ledennummer en verder nietszeggend. De balie kan hem noemen ("noteert u
     even RTG-S-0042") zodat beide kanten naar hetzelfde gesprek verwijzen
     zonder dat er ooit een naam over tafel gaat. Dat is de hele reden dat hij
     bestaat: een gesprek moet een handvat hebben, en op een platform op
     codenaam mag dat handvat geen persoon zijn. */
  const steuncodeVan = (id) => 'RTG-S-' + String(1000 + Number(id)).slice(-4);

  /* De stad komt uit het onboardingprofiel (woonplaats), op sleutel -- zelfde
     bron als het ledenregister gebruikt, en met opzet ALLEEN de woonplaats:
     een straat en huisnummer horen in de kluis en niet op een baliescherm. */
  const stadVan = (key) => {
    try {
      const p = ((onboarding && onboarding.store && onboarding.store().profielen) || {})[key];
      const w = p && p.velden && p.velden.woonplaats;
      return w ? kap(w, 60) : null;
    } catch (e) { return null; }
  };
  const landVan = (id) => {
    try {
      const st = accounts.getMemberState(id) || {};
      return st.land ? kap(st.land, 60) : null;
    } catch (e) { return null; }
  };

  /* PRECIES ACHT VELDEN, en de toets pint ze dicht af. Dat is geen pesterij
     maar de bedoeling: groeit dit dossier er ooit een veld bij, dan hoort daar
     een mens naar te kijken in plaats van dat het meelift. De kolom die er
     morgen bij wil is een keer het telefoonnummer. */
  function dossierVan(u) {
    return {
      codename: u.codename || null,
      pas: u.tier || 'rtg',
      sinds: new Date(u.created_at).toISOString().slice(0, 10),
      stad: stadVan('user-' + u.id),
      land: landVan(u.id),
      steuncode: steuncodeVan(u.id),
      abo: { pas: u.tier || 'rtg', sinds: new Date(u.created_at).toISOString().slice(0, 10), loopt: true },
      klachten: openKlachten(u.id)
    };
  }

  function balieDossier(zetel, id, reden) {
    const nee = eis(zetel, reden);
    if (nee) return nee;
    const u = accounts.getUserById(Number(id));
    if (!u) return { status: 404, error: 'Dit lid kennen we niet.' };
    noteer(zetel, u, reden, 'dossier');
    return { ok: true, lid: dossierVan(u) };
  }

  /* Zoeken op codenaam is OOK inzage. Wie een codenaam natrekt om te zien of
     hij bestaat, doet precies wat het journaal moet vastleggen -- ook als er
     niets uitkomt. Vandaar dat er hier geen "alleen bij een treffer" staat. */
  function balieZoek(zetel, codenaam, reden) {
    const nee = eis(zetel, reden || 'zoeken op codenaam aan de balie');
    if (nee && nee.status === 403) return nee;
    const naald = kap(codenaam, 60).toLowerCase();
    if (naald.length < 2) return { status: 400, error: 'Geef minstens twee letters van de codenaam.' };
    const rijen = accounts.ledenRegisterRijen ? accounts.ledenRegisterRijen(20000) : [];
    const treffers = rijen
      .filter((r) => String(r.codename || '').toLowerCase().includes(naald))
      .slice(0, 25)
      .map((r) => ({ id: r.id, codename: r.codename, pas: r.tier || 'rtg', land: r.land || null }));
    inzagelog.noteer({
      door: { id: zetel, naam: zetel },
      over: { id: treffers.length === 1 ? treffers[0].id : null, codenaam: naald },
      waarom: reden || 'zoeken op codenaam aan de balie', bron: 'balie/zoek'
    });
    return { ok: true, treffers };
  }

  return { steuncodeVan, dossierVan, balieDossier, balieZoek };
}

module.exports = { maakDossier };
