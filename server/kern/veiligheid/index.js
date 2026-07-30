/* RTG Veilig: de gedeelde ruggengraat onder vier apps.

   Let op de mapnaam: dit is kern/veiligheid/. Er bestond al een kern/veilig.js,
   en dat is iets heel anders (de 9+-inhoudskeuring voor de sociale lagen). Node
   kiest bij het inladen altijd een bestand boven een map met dezelfde naam, dus
   die naam was niet vrij.

     Thuiswacht   "ik ben over X minuten thuis"  -> wacht.js
     Codewoord    de stille noodzin              -> codewoord.js
     Vitaal       medicatie- en leven-check-in   -> wacht.js (zelfde motor)
     Thuisrust    niet storen tot thuis          -> rust.js

   Vier schermen, een mechaniek. Dat is met opzet: een tweede
   dodemansknop naast de eerste zou onvermijdelijk anders gaan werken, en bij
   veiligheid is "op twee plekken net iets anders" hoe fouten ontstaan.

   Wat het WEL is: jouw eigen kring waarschuwen, met je laatst bekende plek.
   Wat het NIET is: een alarmcentrale. Er belt niemand 112, er kijkt geen mens
   mee, en zonder internet of met een server die plat ligt gaat er niets af.
   Die zin staat ook op elk scherm; wie denkt beschermd te zijn en het niet
   is, is slechter af dan wie het weet.

   Alles hangt aan de codenaam (handle), niet aan een naam of een nummer:
   echte namen blijven in de kluis. */
module.exports = (state) => {
  const { db, save, crypto, schoon, sociaal, kluis, meldAan, mail, appUrl } = state;

  const kring = require('./kring')({ db, save, schoon, sociaal });
  const plek = require('./plek')({ db, save });
  const alarm = require('./alarm')({ db, save, crypto, kring, plek, meldAan, mail, appUrl });
  const wacht = require('./wacht')({ db, save, crypto, schoon, alarm, plek, meldAan, sociaal });
  const codewoord = require('./codewoord')({ db, save, crypto, kluis, alarm, plek, sociaal });
  const rust = require('./rust')({ db, save, schoon });

  /* Het volledige beeld voor een lid: wat loopt er, wie is mijn kring, hoe
     staat het codewoord, welke rust. Een aanroep, want de vier apps tonen
     allemaal een stukje van hetzelfde. */
  function veiligBeeld(handle) {
    return {
      kring: kring.kringToon(handle),
      wachten: wacht.wachtenVan(handle),
      codewoord: codewoord.codewoordStand(handle),
      rust: rust.rustStand(handle),
      plek: (() => {
        const p = plek.laatstePlek(handle);
        return p ? { at: p.at, ouderdomMin: Math.round((Date.now() - new Date(p.at).getTime()) / 60000) } : null;
      })(),
      venster: (() => { const v = plek.vensterActief(handle); return v ? { tot: new Date(v.tot).toISOString(), reden: v.reden } : null; })(),
      alarmen: alarm.alarmenVan(handle, 10),
      voorMij: alarm.alarmenVoorMij(handle, 10),
      // eerlijk, en op elk scherm te tonen
      grens: 'RTG is geen alarmcentrale: er wordt niemand gebeld en er kijkt geen mens mee. Bij levensgevaar belt u het alarmnummer.'
    };
  }

  /* Inchecken in de Thuiswacht betekent ook "ik ben thuis": een rustoptie die
     daaraan hangt gaat dan vanzelf uit. Die knoop leggen we hier, zodat de
     twee modules niets van elkaar hoeven te weten. */
  function veiligCheckin(handle, id) {
    const r = wacht.wachtCheckin(handle, id);
    if (r.ok) r.rustAf = rust.rustThuis(handle);
    return r;
  }

  /* Expliciet uitschrijven, niet met een spread. De kern-context is een
     platte namenruimte die door de hele server wordt gedeeld; een generieke
     naam als `sweep` uit wacht.js zou daar zomaar iets anders overschrijven.
     Dit is saaier en veiliger. */
  return {
    kringToon: kring.kringToon, kringToevoegen: kring.kringToevoegen,
    kringAanpassen: kring.kringAanpassen, kringVerwijderen: kring.kringVerwijderen,
    kringMailToevoegen: kring.mailToevoegen, kringMailVerwijderen: kring.mailVerwijderen,

    plekMelden: plek.plekMelden, plekVensterOpen: plek.vensterOpen, plekVensterSluit: plek.vensterSluit,

    alarmSlaan: alarm.alarmSlaan, alarmAfsluiten: alarm.alarmAfsluiten,
    alarmenVan: alarm.alarmenVan, alarmenVoorMij: alarm.alarmenVoorMij,

    wachtStart: wacht.wachtStart, wachtVerlengen: wacht.wachtVerlengen,
    wachtStop: wacht.wachtStop, wachtenVan: wacht.wachtenVan,

    codewoordZetten: codewoord.codewoordZetten, codewoordStand: codewoord.codewoordStand,
    codewoordSchakel: codewoord.codewoordSchakel, codewoordWissen: codewoord.codewoordWissen,
    codewoordCheck: codewoord.codewoordCheck, codewoordProef: codewoord.codewoordProef,

    rustStand: rust.rustStand, rustAan: rust.rustAan, rustUit: rust.rustUit,
    rustMagDoor: rust.magDoor,

    veiligBeeld, veiligCheckin, veiligSweep: wacht.sweep
  };
};
