      // spreken: de eigen stem invullen en meteen laten herkennen
      const mic = scrim.querySelector('#rtg-lang-mic');
      if (mic) mic.addEventListener('click', () => self._luister(zoek, stelVoor, kies, mic));

