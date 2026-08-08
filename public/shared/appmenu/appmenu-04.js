  /* ------------------------------------------------- de vaste functies */
  function el(id) { return d.getElementById(id); }
  function klik(id) { var k = el(id); if (k) k.click(); }
  function bestaat(id) { return !!el(id); }

  function vasteFuncties() {
    var uit = [];

    uit.push({ label: T('menu.thuis', 'Beginscherm'), icoon: 'thuis', doe: function () {
      if (w.RTGiOS && w.RTGiOS.thuis) w.RTGiOS.thuis();
      else location.href = '/apps/app.html';
    } });
    if (w.history.length > 1) {
      uit.push({ label: T('menu.terug', 'Een stap terug'), icoon: 'terug',
        doe: function () { w.history.back(); } });
    }

    /* Instellingen: het paneel van shared/bediening.js, dat voor dit ene
       scherm dezelfde rol speelt als het bedieningspaneel van het OS. Is het
       er niet, dan valt er niets in te stellen en staat de rij er ook niet. */
    if (w.RTGBediening && w.RTGBediening.aanwezig) {
      uit.push({ label: T('menu.instel', 'Instellingen'), icoon: 'instel',
        doe: function () { w.RTGBediening.open(); } });
    }

    /* Rahul: het menu opent zijn venster, het tekent er zelf geen tweede. */
    if (w.RTGMetgezel && w.RTGMetgezel.rahul) {
      uit.push({ label: T('menu.rahul', 'Vraag Rahul'), icoon: 'rahul',
        doe: function () { w.RTGMetgezel.rahul(); } });
    }

    if (w.RTGVol && w.RTGVol.wissel) {
      uit.push({ label: T('os.cc.vol', 'Volledig scherm'), icoon: 'vol',
        doe: function () { w.RTGVol.wissel(); } });
    }

    /* Delen kan alleen als de browser het aanbiedt (en dat is buiten https
       nergens zo), dus de rij hangt aan de echte mogelijkheid en niet aan een
       aanname. */
    if (w.navigator && w.navigator.share) {
      uit.push({ label: T('menu.deel', 'Deel dit scherm'), icoon: 'deel', doe: function () {
        w.navigator.share({ title: d.title, url: location.href })['catch'](function () {});
      } });
    }

    if (bestaat('logoutBtn')) {
      uit.push({ label: T('app.logout', 'Uitloggen'), icoon: 'uit',
        doe: function () { klik('logoutBtn'); } });
    }
    return uit;
  }

