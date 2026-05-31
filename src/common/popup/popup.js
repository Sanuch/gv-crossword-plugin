// Система кеширования
class CrosswordCache {
  constructor() {
    this.cacheKey = 'crosswordCache';
  }

  async getCacheKey() {
    // Получаем дату с активной вкладки
    return new Promise(resolve => {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getCacheKey' }, (response) => {
          resolve(response?.cacheKey || null);
        });
      });
    });
  }

  async getFromCache(key) {
    try {
      const data = await chrome.storage.local.get(this.cacheKey);
      const cache = data[this.cacheKey] || {};
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
      return null;
    } catch (error) {
      console.error('❌ Error reading from cache:', error);
      return null;
    }
  }

  async saveToCache(key, data) {
    try {
      const storage = await chrome.storage.local.get(this.cacheKey);
      const cache = storage[this.cacheKey] || {};
      
      cache[key] = {
        data: data,
        timestamp: Date.now()
      };

      await chrome.storage.local.set({ [this.cacheKey]: cache });
      console.log('💾 Saved to cache with key:', key);
    } catch (error) {
      console.error('❌ Error saving to cache:', error);
    }
  }

  async removeFromCache(key) {
    try {
      const storage = await chrome.storage.local.get(this.cacheKey);
      const cache = storage[this.cacheKey] || {};
      delete cache[key];
      await chrome.storage.local.set({ [this.cacheKey]: cache });
    } catch (error) {
      console.error('❌ Error removing from cache:', error);
    }
  }

  async clearCache() {
    try {
      await chrome.storage.local.remove(this.cacheKey);
      console.log('🗑️ Cache cleared');
    } catch (error) {
      console.error('❌ Error clearing cache:', error);
    }
  }
}

const cache = new CrosswordCache();

// Функция для показа кешированных данных при открытии popup
async function displayCachedDataIfAvailable() {
  console.log('🔍 Checking for cached data...');
  
  try {
    // Получаем ключ кеша для текущей страницы
    const cacheKey = await cache.getCacheKey();
    
    if (!cacheKey) {
      console.log('🚫 No cache key available - not on crossword page');
      document.getElementById('results').innerHTML = '<div class="info">🎯 Open a crossword page to see cached results</div>';
      return;
    }
    
    // Проверяем наличие кешированных данных
    const cachedApiResponse = await cache.getFromCache(cacheKey);
    
    if (!cachedApiResponse) {
      console.log('📭 No cached data found for key:', cacheKey);
      document.getElementById('results').innerHTML = '<div class="info">📋 No cached results found. Click <strong>Solve</strong> to get answers.</div>';
      return;
    }
    
    console.log('📋 Found cached data, fetching crossword structure...');
    
    // Получаем структуру кроссворда для отображения
    const crosswordResponse = await fetchCrossword();
    
    if (!crosswordResponse || !crosswordResponse.words || crosswordResponse.words.length === 0) {
      console.log('❌ Could not fetch crossword structure');
      document.getElementById('results').innerHTML = '<div class="error">❌ Could not load crossword structure from page</div>';
      return;
    }
    
    const crosswordData = crosswordResponse.words;
    const language = crosswordResponse.language || 'ru';
    const metadata = crosswordResponse.metadata || {};
    
    // Определяем провайдер из кешированных данных или используем текущий выбранный
    const providerName = document.getElementById('serviceSelect').value || 'Unknown';
    
    // Отображаем кешированные результаты
    console.log('✅ Displaying cached results');
    displayResults(crosswordData, cachedApiResponse, metadata, language, providerName, true, cacheKey);
    
  } catch (error) {
    console.error('❌ Error checking cached data:', error);
    document.getElementById('results').innerHTML = `<div class="error">❌ Error loading cached data: ${error.message}</div>`;
  }
}

async function loadServices() {
  console.log('🔧 Loading services from storage...');
  const data = await chrome.storage.sync.get('services');
  const services = data.services || [];
  console.log('✅ Services loaded:', services);
  return services;
}

async function fetchCrossword() {
  console.log('🎯 Fetching crossword from active tab...');
  return new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      console.log('📋 Active tab found 1:', {
        url: tabs[0]?.url,
        id: tabs[0]?.id
      });
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getCrossword', id: 'twl_wrap' }, (response) => {
        console.log('📦 Crossword data received:', response);
        resolve(response);
      });
    });
  });
}

async function fillCrossword(apiResponse) {
  console.log('✏️ Filling crossword with API response:', apiResponse);
  return new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      console.log('📋 Active tab found 2:', {
        url: tabs[0]?.url,
        id: tabs[0]?.id
      });
      chrome.tabs.sendMessage(tabs[0].id, { action: 'fillCrossword', id: 'twl_wrap', words: apiResponse }, (response) => {
        console.log('✅ Crossword filled:', response);
        resolve(response);
      });
    });
  });
}

// Функция для заполнения одного конкретного слова
async function fillSingleWord(wordId, answer, clickedElement) {
  console.log(`🎯 Filling single word: ${wordId} = "${answer}"`);
  
  // Добавляем визуальную обратную связь
  const originalText = clickedElement.textContent;
  clickedElement.textContent = '⏳ Filling...';
  clickedElement.style.opacity = '0.6';
  
  return new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'fillSingleWord', 
        id: 'twl_wrap', 
        wordId: wordId, 
        answer: answer 
      }, (response) => {
        console.log('✅ Single word filled:', response);
        
        // Восстанавливаем визуал
        clickedElement.textContent = originalText;
        clickedElement.style.opacity = '1';
        
        // Показываем результат
        if (response && response.status === 'filled') {
          // Убираем выделение с других ответов этого слова
          const allAnswersForWord = document.querySelectorAll(`[data-word-id="${wordId}"]`);
          allAnswersForWord.forEach(el => {
            el.classList.remove('answer-active');
            el.style.backgroundColor = '';
            el.style.color = '';
          });
          
          // Выделяем текущий ответ как активный
          clickedElement.classList.add('answer-active');
          clickedElement.style.backgroundColor = '#28a745';
          clickedElement.style.color = 'white';
          
          console.log(`✅ Word ${wordId} filled with "${answer}"`);
        } else {
          // Показываем ошибку
          clickedElement.style.backgroundColor = '#dc3545';
          clickedElement.style.color = 'white';
          setTimeout(() => {
            clickedElement.style.backgroundColor = '';
            clickedElement.style.color = '';
          }, 2000);
        }
        
        resolve(response);
      });
    });
  });
}

// Инициализация списка провайдеров
async function initializeProviderSelect() {
  const select = document.getElementById('serviceSelect');
  const providers = providerManager.getAllProviders();
  
  select.innerHTML = providers.map((provider, index) => 
    `<option value="${provider.name}">${provider.name}</option>`
  ).join('');
  
  // Добавляем опцию для настройки источника словарей
  select.innerHTML += '<option value="manifestConfig">⚙️ Configure Manifest Source</option>';
  
  select.addEventListener('change', (event) => {
    if (event.target.value === 'manifestConfig') {
      showCustomProviderDialog();
    }
  });
}

// Диалог настройки URL манифеста словарей
async function showCustomProviderDialog() {
  const settings = await chrome.storage.sync.get('dictionaryManifestUrl');
  const currentManifestUrl = settings.dictionaryManifestUrl || '';

  const dialog = document.createElement('div');
  dialog.className = 'custom-provider-dialog';
  dialog.innerHTML = `
    <div class="dialog-content">
      <h3>Configure Dictionary Manifest Source</h3>
      <div>
        <label for="providerManifestUrl">Manifest URL:</label>
        <input type="text" id="providerManifestUrl" placeholder="https://raw.githubusercontent.com/<owner>/<repo>/main/manifest.json" value="${currentManifestUrl}">
      </div>
      <div>
        <small>Leave empty to use build-time/default source.</small>
      </div>
      <div class="format-info">
        <h4>Required Manifest Shape:</h4>
        <div class="format-section">
          <pre>{
  "languages": {
    "ru": {
      "dictionaries": [
        { "id": "items", "url": "https://.../items.txt" }
      ]
    }
  }
}</pre>
        </div>
      </div>
      <div class="dialog-buttons">
        <button id="resetProvider">Reset</button>
        <button id="cancelProvider">Cancel</button>
        <button id="saveProvider">Save</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  // Добавляем стили
  const style = document.createElement('style');
  style.textContent = `
    .custom-provider-dialog {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
    .dialog-content {
      background: white;
      padding: 20px;
      border-radius: 8px;
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
    }
    .format-info {
      margin: 15px 0;
      padding: 10px;
      background: #f5f5f5;
      border-radius: 4px;
    }
    .format-section {
      margin: 10px 0;
    }
    pre {
      background: #eee;
      padding: 10px;
      border-radius: 4px;
      overflow-x: auto;
    }
    .dialog-buttons {
      margin-top: 15px;
      text-align: right;
    }
    button {
      margin-left: 10px;
      padding: 5px 15px;
    }
    input {
      width: 100%;
      margin: 5px 0 15px;
      padding: 5px;
    }
  `;
  document.head.appendChild(style);
  
  // Обработчики кнопок
  document.getElementById('cancelProvider').addEventListener('click', () => {
    document.getElementById('serviceSelect').value = providerManager.getAllProviders()[0].name;
    dialog.remove();
  });

  document.getElementById('resetProvider').addEventListener('click', async () => {
    await chrome.storage.sync.remove('dictionaryManifestUrl');
    await cache.clearCache();
    document.getElementById('serviceSelect').value = providerManager.getAllProviders()[0].name;
    dialog.remove();
  });
  
  document.getElementById('saveProvider').addEventListener('click', async () => {
    const manifestUrl = document.getElementById('providerManifestUrl').value.trim();
    
    if (manifestUrl && !/^https:\/\//i.test(manifestUrl)) {
      alert('Manifest URL must start with https://');
      return;
    }
    
    await chrome.storage.sync.set({ dictionaryManifestUrl: manifestUrl });
    await cache.clearCache();
    document.getElementById('serviceSelect').value = providerManager.getAllProviders()[0].name;
    dialog.remove();
  });
}

// Основная функция решения, вынесена для повторного использования (forceRefresh = true — форсирует сетевой запрос)
async function solveCrossword(forceRefresh = false) {
  console.log('🎮 Solve started (forceRefresh=' + forceRefresh + ')');

  const resultsDiv = document.getElementById('results');
  const solveBtn = document.getElementById('solveBtn');

  try {
    solveBtn.disabled = true;
    solveBtn.textContent = '⏳ Solving...';

    resultsDiv.innerHTML = '<div class="loading">🔍 Analyzing crossword...</div>';

    const providerName = document.getElementById('serviceSelect').value;
    console.log('🔢 Selected provider:', providerName);

    const provider = providerManager.getProvider(providerName);
    console.log('🌐 Using provider:', provider);

    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    const crosswordResponse = await fetchCrossword();

    if (!crosswordResponse || !crosswordResponse.words || crosswordResponse.words.length === 0) {
      console.log('❌ No crossword data found on page');
      resultsDiv.innerHTML = '<div class="error">❌ No crossword found on page or no words detected.</div>';
      return;
    }

    const crosswordData = crosswordResponse.words;
    const language = crosswordResponse.language || 'ru';
    const metadata = crosswordResponse.metadata || {};

    console.log('📊 Found', crosswordData.length, 'words to solve');
    console.log('🗣️ Detected language:', language);
    console.log('📋 Metadata:', metadata);

    // Проверяем кеш
    const cacheKey = await cache.getCacheKey();
    let apiResponse = null;
    let fromCache = false;

    if (cacheKey) {
      console.log('🔑 Cache key found:', cacheKey);
      if (forceRefresh) {
        console.log('🔄 Force refresh requested — removing cache for key:', cacheKey);
        await cache.removeFromCache(cacheKey);
      }
      apiResponse = await cache.getFromCache(cacheKey);
      if (apiResponse) {
        fromCache = true;
        console.log('📋 Using cached results');
      }
    }

    if (!apiResponse) {
      resultsDiv.innerHTML = '<div class="loading">🌐 Solving with selected provider...</div>';

      apiResponse = await provider.solve(crosswordData, language, { forceRefresh });
      console.log('💡 Transformed response:', apiResponse);

      // Сохраняем в кеш
      if (cacheKey) {
        await cache.saveToCache(cacheKey, apiResponse);
      }
    }

    // Заполняем кроссворд
    await fillCrossword(apiResponse);

    // Отображаем результаты в новом формате
    displayResults(crosswordData, apiResponse, metadata, language, provider.name, fromCache, cacheKey);

    console.log('🎉 Crossword solving process completed successfully');

  } catch (error) {
    console.error('❌ Error during crossword solving:', error);
    resultsDiv.innerHTML = `<div class="error">❌ Error occurred while solving crossword: ${error.message}<br>Check console for details.</div>`;
  } finally {
    solveBtn.disabled = false;
    solveBtn.textContent = '🚀 Solve';
  }
}

// Кнопка Solve
document.getElementById('solveBtn').addEventListener('click', () => solveCrossword(false));

// Кнопка Refresh — форсирует сетевой запрос и очищает кеш для текущего ключа
document.getElementById('refreshBtn').addEventListener('click', async () => {
  console.log('🔁 Refresh button clicked — forcing network fetch and clearing cache for current tab');
  await solveCrossword(true);
});

// Кнопка Clear — очищает все доступные ячейки на странице
const clearBtn = document.getElementById('clearBtn');
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    console.log('🧹 Clear button clicked — sending clearCells to active tab');
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '<div class="loading">🧹 Clearing cells...</div>';
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'clearCells', id: 'twl_wrap' }, (response) => {
        console.log('🧹 Clear response:', response);
        if (!response) {
          resultsDiv.innerHTML = '<div class="error">❌ No response from page when clearing cells. Open the crossword tab and try again.</div>';
          return;
        }
        if (response.status === 'cleared') {
          resultsDiv.innerHTML = `<div class="cache-info">✅ Cleared ${response.count} editable cells on the page.</div>`;
        } else if (response.status === 'no_container') {
          resultsDiv.innerHTML = '<div class="error">❌ Crossword container not found on the page.</div>';
        } else if (response.status === 'no_table') {
          resultsDiv.innerHTML = '<div class="error">❌ Crossword table not found inside container.</div>';
        } else {
          resultsDiv.innerHTML = `<div class="error">❌ Clear result: ${JSON.stringify(response)}</div>`;
        }
      });
    });
  });
}

function displayResults(crosswordData, apiResponse, metadata, language, providerName, fromCache, cacheKey) {
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '';
  
  // Информация о кеше
  if (fromCache && cacheKey) {
    const cacheInfo = document.createElement('div');
    cacheInfo.className = 'cache-info';
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
    wordDiv.className = 'word-item';
    
    // Заголовок слова
    const headerDiv = document.createElement('div');
    headerDiv.className = 'word-header';
    headerDiv.innerHTML = `${word.id}: ${word.pattern} (${word.length} букв)`;
    wordDiv.appendChild(headerDiv);
    
    // Подсказка
    const clueDiv = document.createElement('div');
    clueDiv.className = 'word-clue';
    clueDiv.textContent = word.clue;
    wordDiv.appendChild(clueDiv);
    
    // Ответы для этого слова
    const answers = answersMap[word.id] || [];
    const answersDiv = document.createElement('div');
    answersDiv.className = 'word-answers';
    
    if (answers.length > 0) {
      const label = document.createElement('div');
      const instructionText = answers.length > 1 ? ' (click to fill)' : '';
      label.innerHTML = `<strong>Найдено ответов (${answers.length})${instructionText}:</strong>`;
      answersDiv.appendChild(label);
      
      answers.forEach((answer, answerIndex) => {
        const answerSpan = document.createElement('span');
        answerSpan.className = answerIndex === 0 ? 'answer primary clickable' : 'answer clickable';
        answerSpan.textContent = answer;
        answerSpan.title = `Click to fill "${answer}" into crossword`;
        answerSpan.dataset.wordId = word.id;
        answerSpan.dataset.answer = answer;
        
        // Добавляем обработчик клика для заполнения конкретного ответа
        answerSpan.addEventListener('click', () => {
          fillSingleWord(word.id, answer, answerSpan);
        });
        
        answersDiv.appendChild(answerSpan);
      });
    } else {
      const noAnswers = document.createElement('div');
      noAnswers.className = 'no-answers';
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
  statsDiv.className = 'stats';
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

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Popup initialization started...');
  
  // Инициализируем список провайдеров
  await initializeProviderSelect();
  
  // Показываем кешированные данные, если они есть
  await displayCachedDataIfAvailable();
  
  console.log('✅ Popup initialization complete');
});