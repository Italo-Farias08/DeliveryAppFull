if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/app/service-worker.js').catch(function (err) {
      console.warn('SW registration failed:', err);
    });
  });
}
