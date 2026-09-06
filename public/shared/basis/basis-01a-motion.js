/* Heritage Motion vult alleen declaratieve status en toegankelijkheid aan. De
   app houdt haar eigen klik, bevoegdheid en route; dubbel laden is uitgesloten. */
  if (!window.RTGHeritageMotion && !document.getElementById('rtgHeritageMotionJs') &&
      !document.querySelector('script[src^="/shared/rtg-heritage-motion.js"]')) {
    var bewegingScript = document.createElement('script');
    bewegingScript.id = 'rtgHeritageMotionJs';
    bewegingScript.src = '/shared/rtg-heritage-motion.js';
    bewegingScript.async = false;
    (document.head || document.documentElement).appendChild(bewegingScript);
  }
