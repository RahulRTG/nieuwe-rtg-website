/* De Continue Key verrijkt uitsluitend de al gemarkeerde Edge-hoofdactie. De
   passieve kern staat ervoor; async=false bewaakt de toevoegvolgorde. */
  if (!window.RTGContinueKeyCore && !document.getElementById('rtgContinueKeyCoreJs') &&
      !document.querySelector('script[src^="/shared/rtg-continue-key-core.js"]')) {
    var verderKern = document.createElement('script');
    verderKern.id = 'rtgContinueKeyCoreJs';
    verderKern.src = '/shared/rtg-continue-key-core.js';
    verderKern.async = false;
    (document.head || document.documentElement).appendChild(verderKern);
  }
  if (!window.RTGContinueKey && !document.getElementById('rtgContinueKeyJs') &&
      !document.querySelector('script[src^="/shared/rtg-continue-key.js"]')) {
    var verderScript = document.createElement('script');
    verderScript.id = 'rtgContinueKeyJs';
    verderScript.src = '/shared/rtg-continue-key.js';
    verderScript.async = false;
    (document.head || document.documentElement).appendChild(verderScript);
  }
