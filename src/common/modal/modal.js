// Проверяем, не загружен ли уже скрипт
if (typeof window.CrosswordModal !== 'undefined') {
  console.log('⚠️ CrosswordModal already defined, skipping redefinition');
} else {
  console.log('🔧 Defining CrosswordModal class...');

// Модальное окно для решения кроссвордов
class CrosswordModal {
  constructor() {
    this.modal = null;
    this.cache = new CrosswordCache();
    this.isOpen = false;
  }

  open() {
    if (this.isOpen) {
      console.log('⚠️ Modal is already open');
      return;
    }
    
    console.log('🪟 Opening crossword modal...');
    
    this.createModal();
    document.body.appendChild(this.modal);
    this.isOpen = true;
    
    // Инициализируем провайдеры
    this.initializeProviders();
    
    // Добавляем обработчики событий с небольшой задержкой
    setTimeout(() => {
      this.attachEventListeners();
    }, 50);
    
    // Добавляем класс для предотвращения скролла страницы
    document.body.style.overflow = 'hidden';
    
    console.log('✅ Modal opened successfully');
  }

  close() {
    if (!this.isOpen) {
      console.log('⚠️ Modal is already closed');
      return;
    }
    
    console.log('🪟 Closing crossword modal...');
    
    if (this.modal && this.modal.parentNode) {
      this.modal.parentNode.removeChild(this.modal);
    }
    
    // Восстанавливаем скролл страницы
    document.body.style.overflow = '';
    
    this.isOpen = false;
    console.log('✅ Modal closed successfully');
  }

  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay';
    this.modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">🧩 Crossword Solver</h2>
          <button class="modal-close" id="modalClose">&times;</button>
        </div>
        <div class="modal-body">
          <div class="modal-control-panel">
            <label for="modalServiceSelect">Service:</label>
            <select id="modalServiceSelect"></select>
            <button id="modalSolveBtn">🚀 Solve</button>
          </div>
          <div id="modalResults" class="modal-results"></div>
        </div>
      </div>
    `;
  }

  attachEventListeners() {
    // Закрытие модального окна
    this.modal.querySelector('#modalClose').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    });

    // Закрытие по клику на overlay (с задержкой для предотвращения немедленного срабатывания)
    setTimeout(() => {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.close();
        }
      });
    }, 100);

    // Предотвращаем закрытие при клике внутри модального контента
    this.modal.querySelector('.modal-content').addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Закрытие по ESC
    const escHandler = (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Кнопка решения
    this.modal.querySelector('#modalSolveBtn').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.solveCrossword();
    });
  }

  async initializeProviders() {
    const select = this.modal.querySelector('#modalServiceSelect');
    const providers = providerManager.getAllProviders();
    
    select.innerHTML = providers.map((provider, index) => 
      `<option value="${provider.name}">${provider.name}</option>`
    ).join('');
  }

  async solveCrossword() {
    const resultsDiv = this.modal.querySelector('#modalResults');
    const solveBtn = this.modal.querySelector('#modalSolveBtn');
    const serviceSelect = this.modal.querySelector('#modalServiceSelect');
    
    try {
      solveBtn.disabled = true;
      solveBtn.textContent = '⏳ Solving...';
      
      resultsDiv.innerHTML = '<div class="modal-loading">🔍 Analyzing crossword...</div>';
      
      const providerName = serviceSelect.value;
      const provider = providerManager.getProvider(providerName);

      if (!provider) {
        throw new Error(`Provider not found: ${providerName}`);
      }
      
      // Получаем данные кроссворда
      const crosswordResponse = this.extractCrossword();
      
      if (!crosswordResponse || !crosswordResponse.words || crosswordResponse.words.length === 0) {
        resultsDiv.innerHTML = '<div class="modal-error">❌ No crossword found on page or no words detected.</div>';
        return;
      }

      const crosswordData = crosswordResponse.words;
      const language = crosswordResponse.language || 'ru';
      const metadata = crosswordResponse.metadata || {};
      
      // Проверяем кеш
      const cacheKey = this.getCacheKey();
      let apiResponse = null;
      let fromCache = false;
      
      if (cacheKey) {
        apiResponse = await this.cache.getFromCache(cacheKey);
        if (apiResponse) {
          fromCache = true;
        }
      }
      
      if (!apiResponse) {
        resultsDiv.innerHTML = '<div class="modal-loading">🌐 Solving with selected provider...</div>';
        apiResponse = await provider.solve(crosswordData, language);
        
        // Сохраняем в кеш
        if (cacheKey) {
          await this.cache.saveToCache(cacheKey, apiResponse);
        }
      }
      
      // Заполняем кроссворд
      this.fillCrossword(apiResponse);

      // Отображаем результаты
      this.displayResults(crosswordData, apiResponse, metadata, language, provider.name, fromCache, cacheKey);
      
    } catch (error) {
      console.error('❌ Error during crossword solving:', error);
      resultsDiv.innerHTML = `<div class="modal-error">❌ Error occurred while solving crossword: ${error.message}</div>`;
    } finally {
      solveBtn.disabled = false;
      solveBtn.textContent = '🚀 Solve';
    }
  }

  extractCrossword() {
    // Используем существующую функцию extractCrossword
    return extractCrossword('twl_wrap');
  }

  getCacheKey() {
    // Используем существующую функцию getCacheKey
    return getCacheKey();
  }

  fillCrossword(apiResponse) {
    // Используем существующую функцию fillCrossword
    fillCrossword('twl_wrap', apiResponse);
  }

  displayResults(crosswordData, apiResponse, metadata, language, providerName, fromCache, cacheKey) {
    const resultsDiv = this.modal.querySelector('#modalResults');
    resultsDiv.innerHTML = '';
    
    // Информация о кеше
    if (fromCache && cacheKey) {
      const cacheInfo = document.createElement('div');
      cacheInfo.className = 'modal-cache-info';
      cacheInfo.innerHTML = `📋 Results loaded from cache (key: ${cacheKey})`;
      resultsDiv.appendChild(cacheInfo);
    }
    
    // Создаем карту ответов для быстрого поиска
    const answersMap = {};
    apiResponse.forEach(wordData => {
      answersMap[wordData.id] = wordData.answers || [];
    });
    
    // Отображаем каждое слово с результатами под ним
    crosswordData.forEach((word, index) => {
      const wordDiv = document.createElement('div');
      wordDiv.className = 'modal-word-item';
      
      // Заголовок слова
      const headerDiv = document.createElement('div');
      headerDiv.className = 'modal-word-header';
      headerDiv.innerHTML = `${word.id}: ${word.pattern} (${word.length} букв)`;
      wordDiv.appendChild(headerDiv);
      
      // Подсказка
      const clueDiv = document.createElement('div');
      clueDiv.className = 'modal-word-clue';
      clueDiv.textContent = word.clue;
      wordDiv.appendChild(clueDiv);
      
      // Ответы для этого слова
      const answers = answersMap[word.id] || [];
      const answersDiv = document.createElement('div');
      answersDiv.className = 'modal-word-answers';
      
      if (answers.length > 0) {
        const label = document.createElement('div');
        label.innerHTML = `<strong>Найдено ответов (${answers.length}):</strong>`;
        answersDiv.appendChild(label);
        
        answers.forEach((answer, answerIndex) => {
          const answerSpan = document.createElement('span');
          answerSpan.className = answerIndex === 0 ? 'modal-answer primary' : 'modal-answer';
          answerSpan.textContent = answer;
          answersDiv.appendChild(answerSpan);
        });
      } else {
        const noAnswers = document.createElement('div');
        noAnswers.className = 'modal-no-answers';
        noAnswers.textContent = '❌ Ответы не найдены';
        answersDiv.appendChild(noAnswers);
      }
      
      wordDiv.appendChild(answersDiv);
      resultsDiv.appendChild(wordDiv);
    });
    
    // Статистика
    const totalAnswers = Object.values(answersMap).reduce((sum, answers) => sum + answers.length, 0);
    const wordsWithAnswers = Object.values(answersMap).filter(answers => answers.length > 0).length;
    
    const statsDiv = document.createElement('div');
    statsDiv.className = 'modal-stats';
    statsDiv.innerHTML = `
      <strong>📊 Статистика:</strong><br>
      🔤 Всего слов: ${crosswordData.length}<br>
      ✅ Слов с ответами: ${wordsWithAnswers}<br>
      💡 Всего найдено ответов: ${totalAnswers}<br>
      🗣️ Язык кроссворда: ${language.toUpperCase()}<br>
      🌐 Провайдер: ${providerName}${fromCache ? ' (из кеша)' : ''}
    `;
    resultsDiv.appendChild(statsDiv);
  }
}

// Система кеширования для модального окна
class CrosswordCache {
  constructor() {
    this.cacheKey = 'crosswordCache';
  }

  async getFromCache(key) {
    try {
      const data = localStorage.getItem(this.cacheKey);
      if (data) {
        const cache = JSON.parse(data);
        const cached = cache[key];
        
        if (cached && cached.timestamp) {
          // Проверяем, не устарел ли кеш (24 часа)
          const age = Date.now() - cached.timestamp;
          if (age < 24 * 60 * 60 * 1000) {
            console.log('📋 Using cached results for key:', key);
            return cached.data;
          } else {
            console.log('⏰ Cache expired for key:', key);
            this.removeFromCache(key);
          }
        }
      }
      return null;
    } catch (error) {
      console.error('❌ Error reading from cache:', error);
      return null;
    }
  }

  async saveToCache(key, data) {
    try {
      let cache = {};
      const existingData = localStorage.getItem(this.cacheKey);
      if (existingData) {
        cache = JSON.parse(existingData);
      }
      
      cache[key] = {
        data: data,
        timestamp: Date.now()
      };

      localStorage.setItem(this.cacheKey, JSON.stringify(cache));
      console.log('💾 Saved to cache with key:', key);
    } catch (error) {
      console.error('❌ Error saving to cache:', error);
    }
  }

  async removeFromCache(key) {
    try {
      const existingData = localStorage.getItem(this.cacheKey);
      if (existingData) {
        const cache = JSON.parse(existingData);
        delete cache[key];
        localStorage.setItem(this.cacheKey, JSON.stringify(cache));
      }
    } catch (error) {
      console.error('❌ Error removing from cache:', error);
    }
  }
}

// Глобальная переменная для модального окна
let crosswordModal = null;

// Экспортируем классы в глобальную область видимости
window.CrosswordModal = CrosswordModal;
window.CrosswordCache = CrosswordCache;

} // Закрываем блок if для проверки CrosswordModal

// Если скрипт загружен в контексте страницы, слушаем событие открытия модального окна
(function() {
  // Проверяем, не добавлен ли уже обработчик событий
  if (window.crosswordModalEventListenerAdded) {
    console.log('⚠️ Crossword modal event listener already added, skipping');
    return;
  }
  
  try {
    console.log('🔧 Initializing crossword modal event listener...');
    
    let modalOpenTimeout = null;
    
    window.addEventListener('crossword_open_modal', function () {
      try {
        console.log('📨 Received crossword_open_modal event');
        
        // Очищаем предыдущий таймаут, если есть
        if (modalOpenTimeout) {
          clearTimeout(modalOpenTimeout);
        }
        
        // Добавляем небольшую задержку для предотвращения конфликтов
        modalOpenTimeout = setTimeout(() => {
          try {
            if (!window.crosswordModal && typeof window.CrosswordModal !== 'undefined') {
              console.log('🆕 Creating new CrosswordModal instance...');
              window.crosswordModal = new window.CrosswordModal();
            }
            
            if (window.crosswordModal) {
              console.log('🚀 Opening crossword modal...');
              window.crosswordModal.open();
            } else {
              console.error('❌ CrosswordModal not available');
            }
          } catch (err) {
            console.error('❌ Error opening modal from page context:', err);
          }
        }, 100);
        
      } catch (err) {
        console.error('❌ Error in crossword_open_modal handler:', err);
      }
    });
    
    // Отмечаем, что обработчик добавлен
    window.crosswordModalEventListenerAdded = true;
    
    console.log('✅ Crossword modal event listener initialized');
  } catch (e) {
    console.error('❌ Failed to attach crossword_open_modal listener:', e);
  }
})();
