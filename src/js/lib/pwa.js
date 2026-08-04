/* Установка на устройство и офлайн-режим.
   Регистрирует service worker, показывает кнопку установки, когда браузер
   разрешает, и держит в шапке индикатор «готово к офлайну». */
(function () {
  'use strict';

  const CFG = window.GAMESIO || {};
  const PWA = (Arcade.PWA = {
    ready: false,
    installable: false,
    prompt: null,
    listeners: [],
  });

  PWA.onChange = function (fn) {
    PWA.listeners.push(fn);
    fn(PWA);
  };
  function emit() {
    PWA.listeners.forEach((fn) => fn(PWA));
  }

  if ('serviceWorker' in navigator && CFG.swUrl) {
    // scope ограничен папкой сайта: на github.io в корне лежат чужие проекты
    navigator.serviceWorker
      .register(CFG.swUrl, { scope: CFG.scope || './' })
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        PWA.ready = !!navigator.serviceWorker.controller;
        emit();
        // после первой загрузки контроллер появляется только со второго визита
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          PWA.ready = true;
          emit();
        });
      })
      .catch(() => {});

    navigator.serviceWorker.addEventListener('message', (e) => {
      if (!e.data || e.data.type !== 'gamesio:status') return;
      PWA.cached = e.data.cached;
      PWA.total = e.data.total;
      emit();
    });
  }

  PWA.refreshStatus = function () {
    const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (sw) sw.postMessage('gamesio:status');
  };

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    PWA.prompt = e;
    PWA.installable = true;
    emit();
  });

  window.addEventListener('appinstalled', () => {
    PWA.installable = false;
    PWA.installed = true;
    PWA.prompt = null;
    emit();
  });

  PWA.install = function () {
    if (!PWA.prompt) return Promise.resolve(false);
    const p = PWA.prompt;
    PWA.prompt = null;
    PWA.installable = false;
    emit();
    p.prompt();
    return p.userChoice.then((c) => c.outcome === 'accepted');
  };

  // Запущено уже как установленное приложение?
  PWA.standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
})();
