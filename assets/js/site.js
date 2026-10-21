(function () {
  'use strict';

  var rise = document.querySelector('.rise');
  var main = document.getElementById('top');

  function rivela() {
    if (rise) {
      requestAnimationFrame(function () {
        rise.classList.add('in');
      });
    }
  }

  (function apertura() {
    var box = document.getElementById('apertura');
    var barra = document.getElementById('apertura-barra');
    var video = document.getElementById('mare');
    if (!box) return rivela();

    var MIN_MS = 2400;
    var MAX_MS = 9000;
    var inizio = Date.now();
    var mostrato = 0;
    var vero = 0;
    var pronto = false;
    var finito = false;

    if (main) main.inert = true;

    var conFont = function () {
      box.classList.add('font-ok');
    };
    if (document.fonts && document.fonts.load) {
      Promise.race([
        document.fonts.load('500 1em "Playfair Display"'),
        new Promise(function (r) {
          setTimeout(r, 1200);
        }),
      ]).then(conFont, conFont);
    } else {
      conFont();
    }

    function misura() {
      if (!video || !video.duration || !isFinite(video.duration)) return;
      var b = video.buffered;
      var fine = 0;
      for (var i = 0; i < b.length; i++) {
        if (b.start(i) <= video.currentTime + 0.5) fine = Math.max(fine, b.end(i));
      }
      vero = Math.max(vero, Math.min(1, fine / video.duration));
    }

    function chiudi() {
      if (finito) return;
      finito = true;
      box.classList.add('via');
      if (main) main.inert = false;
      setTimeout(rivela, 350);

      setTimeout(function () {
        if (box.parentNode) box.parentNode.removeChild(box);
      }, 1600);
    }

    function passo() {
      if (finito) return;
      misura();
      var trascorso = Date.now() - inizio;

      var stimato = Math.min(0.3, trascorso / 6000);
      var meta = pronto ? 1 : Math.min(0.96, Math.max(vero, stimato));

      mostrato += (meta - mostrato) * (pronto ? 0.18 : 0.08);
      if (meta - mostrato < 0.002) mostrato = meta;
      barra.style.transform = 'scaleX(' + mostrato.toFixed(4) + ')';

      if (pronto && mostrato >= 1 && trascorso >= MIN_MS) {
        setTimeout(chiudi, 280);
        return;
      }
      if (trascorso >= MAX_MS) {
        pronto = true;
      }
      requestAnimationFrame(passo);
    }

    function eccolo() {
      pronto = true;
    }

    if (video) {
      if (video.readyState >= 4) eccolo();
      video.addEventListener('canplaythrough', eccolo);

      video.addEventListener(
        'error',
        function () {
          if (video.networkState === 3) eccolo();
        },
        true
      );
      video.addEventListener('progress', misura);

      var p = video.play && video.play();
      if (p && p.catch) p.catch(eccolo);
    } else {
      eccolo();
    }
    requestAnimationFrame(passo);

    setTimeout(chiudi, MAX_MS + 1500);
  })();

  var video = document.getElementById('mare');
  var btn = document.getElementById('audio-btn');

  if (video && btn) {
    btn.addEventListener('click', function () {
      var on = video.muted;
      video.muted = !on;
      if (on) {
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
      }
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? 'Silenzia' : 'Ascolta il mare');

      if (on) btn.classList.add('ascoltato');
    });

    video.addEventListener('loadedmetadata', function () {
      var tracks = video.audioTracks;
      if ((tracks && tracks.length === 0) || video.mozHasAudio === false) {
        btn.hidden = true;
      }
    });
  }

  var MESSAGGI = {
    email: 'Controllate l\'indirizzo: sembra incompleto.',
    consenso: 'Per iscrivervi serve la spunta qui sopra.',
    occupato: 'Troppe richieste in questo momento. Riprovate fra poco.',
    server: 'Qualcosa non è andato. Riprovate fra poco.',
    rete: 'Non siamo riusciti a raggiungere il server. Riprovate fra poco.',
  };

  var form = document.querySelector('form.news-form');
  if (form) {
    var input = form.querySelector('input[type="email"]');
    var consenso = form.querySelector('input[name="consenso"]');
    var trappola = form.querySelector('input[name="azienda"]');
    var invia = form.querySelector('button[type="submit"]');
    var errore = form.querySelector('.news-error');
    var involucro = form.querySelector('.news-consent-wrap');

    var mostraErrore = function (chiave, campo) {
      if (errore) errore.textContent = MESSAGGI[chiave] || MESSAGGI.server;
      form.classList.add('has-error');
      if (campo) campo.focus();
    };

    var occupato = function (si) {
      form.classList.toggle('sending', si);
      form.setAttribute('aria-busy', si ? 'true' : 'false');
      if (invia) invia.disabled = si;
    };

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!input || form.classList.contains('sending')) return;

      form.classList.remove('has-error');
      if (errore) errore.textContent = '';

      var email = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return mostraErrore('email', input);

      if (consenso && !form.classList.contains('ask-consent')) {
        if (involucro) involucro.removeAttribute('inert');
        form.classList.add('ask-consent');
        consenso.focus({ preventScroll: true });
        return;
      }
      if (consenso && !consenso.checked) return mostraErrore('consenso', consenso);

      var endpoint = window.NEWSLETTER_ENDPOINT;
      if (!endpoint || !/^https:\/\//.test(endpoint)) {
        return mostraErrore('server');
      }

      var dati = new URLSearchParams();
      dati.set('email', email);
      dati.set('consenso', consenso && consenso.checked ? '1' : '');
      dati.set('azienda', trappola ? trappola.value : '');
      dati.set('fonte', location.pathname);

      occupato(true);
      fetch(endpoint, { method: 'POST', body: dati, redirect: 'follow' })
        .then(function (r) {
          return r.json();
        })
        .then(function (risposta) {
          occupato(false);
          if (!risposta || !risposta.ok) {
            return mostraErrore((risposta && risposta.errore) || 'server', risposta && risposta.errore === 'email' ? input : null);
          }
          form.classList.add('sent');
          var done = form.parentNode.querySelector('.news-done');
          if (done) {
            done.setAttribute('tabindex', '-1');
            done.focus();
          }
        })
        .catch(function () {
          occupato(false);
          mostraErrore('rete');
        });
    });
  }
})();
