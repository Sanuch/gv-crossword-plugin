// External script for popup-modal.html to comply with CSP
if (typeof window !== 'undefined' && window.crosswordLogger) {
  window.crosswordLogger.install({ context: 'popup-modal' });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('launchModalBtn').addEventListener('click', (e) => {
    // Предотвращаем всплытие события
    e.preventDefault();
    e.stopPropagation();
    
    // Отправляем сообщение content script для открытия модального окна
    console.log('🔍 Launching crossword solver...');
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'openModal' }, (response) => {
        console.log('📝 Modal open response:', response);
        // Закрываем popup после успешной отправки
        setTimeout(() => {
          window.close();
        }, 100);
      });
    });
  });
});
