if (typeof window !== 'undefined' && window.crosswordLogger) {
  window.crosswordLogger.install({ context: 'content-script' });
}

function extractCrossword(id = 'twl_wrap', options = {}) {
  const includeUserInputLetters = options.includeUserInputLetters === true;
  console.log('🔍 Extracting crossword from element with ID:', id);
  const container = document.getElementById(id);
  
  if (!container) {
    console.log('❌ Container not found with ID:', id);
    return null;
  }
  
  console.log('✅ Container found:', container);
  
  // Извлекаем сетку кроссворда
  const table = container.querySelector('#cross_tbl');
  if (!table) {
    console.log('❌ Cross table not found');
    return null;
  }
  
  const rows = table.querySelectorAll('tr');
  console.log('📊 Found', rows.length, 'rows in crossword');
  
  // Создаем матрицу для хранения данных о ячейках
  const grid = [];
  const cellData = {};
  
  rows.forEach((row, rowIndex) => {
    // Используем все дочерние <td>, чтобы сохранить реальные индексы колонок
    const cells = Array.from(row.children);
    console.log(`📋 Row ${rowIndex}: processing ${cells.length} cells (including empty/cc_wrap)`);

    grid[rowIndex] = [];

    cells.forEach((cell, colIndex) => {
      const isActive = cell.classList && cell.classList.contains('td_cell');
      const isKnown = cell.classList.contains('known');
      const isEmpty = !isActive;
      
      let letter = '';
      let number = null;
      let inputId = null;
      
      if (isEmpty) {
        grid[rowIndex][colIndex] = { type: 'empty' };
        return;
      }
      
      // Ищем номер ячейки
      const numDiv = cell.querySelector('.num');
      if (numDiv) {
        number = parseInt(numDiv.textContent);
      }
      
      if (isKnown) {
        // Известная буква
        const openDiv = cell.querySelector('.open');
        if (openDiv) {
          letter = openDiv.textContent.trim();
        }
      } else {
        // Ячейка для ввода
        const input = cell.querySelector('.sym');
        if (input) {
          inputId = input.id;
          const inputValue = input.value.trim();
          // По умолчанию не фиксируем введенные в поля буквы,
          // чтобы не сужать поиск случайными/устаревшими символами.
          letter = includeUserInputLetters && inputValue ? inputValue : '_';
        }
      }
      
      const cellInfo = {
        type: 'active',
        letter: letter,
        number: number,
        inputId: inputId,
        isKnown: isKnown
      };
      
      grid[rowIndex][colIndex] = cellInfo;
      if (inputId) {
        cellData[inputId] = { row: rowIndex, col: colIndex, ...cellInfo };
      }
      
      if (letter && letter !== '_') {
        console.log(`📝 Cell [${rowIndex}, ${colIndex}]: "${letter}" ${isKnown ? '(known)' : '(input)'} ${number ? `num: ${number}` : ''}`);
      }
    });
  });
  
  // Извлекаем подсказки
  const cluesDiv = container.querySelector('.cross_q');
  const clues = {};
  
  let horSuffix = 'a';
  let vertSuffix = 'd';
  let crosswordLang = 'ru';
  if (cluesDiv) {
    console.log('📖 Extracting clues...');
    
    // Получаем текст, заменяя HTML-сущности и нормализуя пробелы
    let clueTexts = cluesDiv.innerHTML
      .replace(/&nbsp;/g, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log('📝 Raw clue text:', clueTexts);

    // Проверяем, есть ли английские заголовки
    const isEnglish = /\bAcross:/.test(clueTexts) || /\bDown:/.test(clueTexts);

    // Выбираем суффиксы
    horSuffix = isEnglish ? 'a' : 'г';
    vertSuffix = isEnglish ? 'd' : 'в';
    crosswordLang = isEnglish ? 'en' : 'ru';

    // нормализуем заголовки: любую форму «горизонтали» → HOR, «вертикали» → VER
    clueTexts = clueTexts
      .replace(/(По горизонтали:|Across:)/gi, 'HOR:')
      .replace(/(По вертикали:|Down:)/gi, 'VER:');

    console.log('📝 Normalized clue text:', clueTexts);
    
    // Разделяем на горизонтальные и вертикальные подсказки
    const [horSection, vertSection] = clueTexts.split('VER:').map(s => s.trim());
    
    // Обрабатываем горизонтальные подсказки
    if (horSection) {
      const horClues = horSection.replace('HOR:', '').trim();
      const horMatches = horClues.split(/(?=\d+\.)/).filter(Boolean);
      
      const clueRegex = /(\d+)\.(.*?)(?=\d+\.|$)/gs;
      let match;
      while ((match = clueRegex.exec(horClues)) !== null) {
        const num = match[1];
        const clue = match[2];
        if (num && clue) {
          const cleanClue = clue.trim().replace(/\.$/, '');
          clues[`${num}${horSuffix}`] = cleanClue;
          console.log(`➡️ Horizontal clue ${num}: "${cleanClue}"`);
        }
      }
    }
    
    // Обрабатываем вертикальные подсказки
    if (vertSection) {
      const vertMatches = vertSection.split(/(?=\d+\.)/).filter(Boolean);
      const vertClues = vertSection.replace('VER:', '').trim();
      
      const clueRegex = /(\d+)\.(.*?)(?=\d+\.|$)/gs;
      let match;
      while ((match = clueRegex.exec(vertClues)) !== null) {
        const num = match[1];
        const clue = match[2];
        if (num && clue) {
          const cleanClue = clue.trim().replace(/\.$/, '');
          clues[`${num}${vertSuffix}`] = cleanClue;
          console.log(`⬇️ Vertical clue ${num}: "${cleanClue}"`);
        }
      }
    }
    
    console.log('📚 Extracted clues:', clues);
  } else {
    console.log('❌ Clues div (.cross_q) not found');
  }

  // Определяем язык по домену как дополнительная проверка
  const domainLang = detectLanguageByDomain();
  if (domainLang && domainLang !== crosswordLang) {
    console.log(`🌐 Domain suggests language: ${domainLang}, but content suggests: ${crosswordLang}`);
    // Приоритет отдаем контенту, но логируем расхождение
  }
  
  console.log(`🗣️ Detected crossword language: ${crosswordLang}`);
  
  // Находим слова в сетке
  const words = [];
  const processedCells = new Set(); // Для отслеживания уже обработанных ячеек
  
  // Поиск горизонтальных слов
  console.log('🔍 Finding horizontal words...');
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const cell = grid[row][col];
      const cellKey = `${row},${col}`;
      
      if (cell.type === 'active' && cell.number && !processedCells.has(cellKey)) {
        // Проверяем наличие подсказки для горизонтального слова
        const horId = `${cell.number}${horSuffix}`;
        if (clues[horId]) {
          // Ищем горизонтальное слово, начинающееся с этой ячейки
          let pattern = '';
          let wordCells = [];
          let currentCol = col;
          
          while (currentCol < grid[row].length && grid[row][currentCol].type === 'active') {
            const currentCell = grid[row][currentCol];
            pattern += currentCell.letter === '' ? '_' : currentCell.letter;
            wordCells.push({ row, col: currentCol, ...currentCell });
            processedCells.add(`${row},${currentCol}`);
            currentCol++;
          }
          
          if (pattern.length > 1) {
            words.push({
              id: horId,
              pattern: pattern,
              clue: clues[horId],
              length: pattern.length,
              cells: wordCells,
              direction: 'horizontal'
            });
            
            console.log(`➡️ Found horizontal word: ${horId} - "${pattern}" (${clues[horId]})`);
          }
        }
      }
    }
  }
  
  // Сбрасываем отслеживание для вертикальных слов
  processedCells.clear();
  
  // Поиск вертикальных слов
  console.log('🔍 Finding vertical words...');
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const cell = grid[row][col];
      const cellKey = `${row},${col}`;
      
      if (cell.type === 'active' && cell.number && !processedCells.has(cellKey)) {
        // Проверяем наличие подсказки для вертикального слова
        const vertId = `${cell.number}${vertSuffix}`;
        if (clues[vertId]) {
          // Ищем вертикальное слово, начинающееся с этой ячейки
          let pattern = '';
          let wordCells = [];
          let currentRow = row;
          
          while (currentRow < grid.length && grid[currentRow][col] && grid[currentRow][col].type === 'active') {
            const currentCell = grid[currentRow][col];
            pattern += currentCell.letter === '' ? '_' : currentCell.letter;
            wordCells.push({ row: currentRow, col, ...currentCell });
            processedCells.add(`${currentRow},${col}`);
            currentRow++;
          }
          
          if (pattern.length > 1) {
            words.push({
              id: vertId,
              pattern: pattern,
              clue: clues[vertId],
              length: pattern.length,
              cells: wordCells,
              direction: 'vertical'
            });
            
            console.log(`⬇️ Found vertical word: ${vertId} - "${pattern}" (${clues[vertId]})`);
          }
        }
      }
    }
  }
  
  // Формируем итоговый массив для API
  const apiData = words.map(word => ({
    id: word.id,
    pattern: word.pattern,
    clue: word.clue,
    length: word.length,
    direction: word.direction,
    cells: word.cells.map(cell => ({
      row: cell.row,
      col: cell.col
    }))
  }));
  
  console.log('✅ Crossword extraction complete. Found', words.length, 'words');
  console.log('📦 API data:', apiData);
  
  // Возвращаем данные вместе с информацией о языке
  return {
    words: apiData,
    language: crosswordLang,
    metadata: {
      totalWords: words.length,
      horizontalSuffix: horSuffix,
      verticalSuffix: vertSuffix,
      domain: window.location.hostname
    }
  };
}

function fillCrossword(id, apiResponse) {
  console.log('✏️ Filling crossword in element with ID:', id);
  console.log('📝 API Response:', apiResponse);
  
  const container = document.getElementById(id);
  if (!container) {
    console.log('❌ Container not found with ID:', id);
    return;
  }
  
  console.log('✅ Container found, processing', apiResponse.length, 'words');
  
  // Сначала извлекаем информацию о сетке для получения позиций ячеек
  const table = container.querySelector('#cross_tbl');
  if (!table) {
    console.log('❌ Cross table not found');
    return;
  }
  
  const rows = table.querySelectorAll('tr');
  const grid = [];
  
  // Создаем матрицу ячеек для навигации
  rows.forEach((row, rowIndex) => {
    const cells = Array.from(row.children);
    grid[rowIndex] = [];
    
    cells.forEach((cell, colIndex) => {
      const isActive = cell.classList.contains('td_cell');
      const numDiv = cell.querySelector('.num');
      const number = numDiv ? parseInt(numDiv.textContent) : null;
      
      grid[rowIndex][colIndex] = {
        element: cell,
        isActive: isActive,
        number: number
      };
    });
  });
  
  // Обрабатываем каждый ответ от API
  apiResponse.forEach((wordData, wordIndex) => {
    console.log(`🔤 Processing word ${wordIndex + 1}: ${wordData.id}`);
    
    if (!wordData.answers || wordData.answers.length === 0) {
      console.log(`⚠️ No answers provided for word ${wordData.id}`);
      return;
    }
    
    // Берем первый ответ (можно расширить логику для выбора лучшего)
    const answer = wordData.answers[0];
    console.log(`✅ Using answer: "${answer}" for ${wordData.id}`);
    
  // Определяем направление и номер слова
  // Поддерживаем английские (a/d) и русские (г/в) суффиксы и разные регистры
  const idStr = String(wordData.id || '').toLowerCase();
  const lastChar = idStr.slice(-1);
  const isHorizontal = lastChar === 'a' || lastChar === 'г';
  // Простое извлечение ведущих цифр (например, '3a' -> 3)
  const numMatch = idStr.match(/^(\d+)/);
  const wordNumber = numMatch ? parseInt(numMatch[1], 10) : NaN;
    
    // Находим начальную ячейку
    let startRow = -1, startCol = -1;
    
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        if (grid[row][col].number === wordNumber) {
          startRow = row;
          startCol = col;
          break;
        }
      }
      if (startRow !== -1) break;
    }
    
    if (startRow === -1 || startCol === -1) {
      console.log(`❌ Start cell not found for word ${wordData.id}`);
      return;
    }
    
    console.log(`📍 Found start position for ${wordData.id}: [${startRow}, ${startCol}]`);
    
    // Заполняем буквы
    for (let i = 0; i < answer.length; i++) {
      const row = isHorizontal ? startRow : startRow + i;
      const col = isHorizontal ? startCol + i : startCol;
      
      if (row >= grid.length || col >= grid[row].length) {
        console.log(`⚠️ Position [${row}, ${col}] is out of bounds`);
        continue;
      }
      
      const cell = grid[row][col];
      if (!cell.isActive) {
        console.log(`⚠️ Cell [${row}, ${col}] is not active`);
        continue;
      }

      const isKnownCell = cell.element.classList.contains('known');
      if (isKnownCell) {
        console.log(`⏭️ Cell [${row}, ${col}] is known, skipping`);
        continue;
      }
      
      // Находим редактируемое input поле в ячейке
      const textInput = cell.element.querySelector('.sym');

      if (textInput) {
        const oldValue = textInput.value;
        textInput.value = answer[i].toUpperCase();
        console.log(`✅ Cell [${row}, ${col}] (text): "${oldValue}" → "${answer[i].toUpperCase()}"`);
        // Диспатчим события, чтобы страница подхватила изменения
        textInput.dispatchEvent(new Event('input', { bubbles: true }));
        textInput.dispatchEvent(new Event('keyup', { bubbles: true }));
        textInput.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        console.log(`⚠️ No editable input element found in cell [${row}, ${col}]`);
      }
    }
  });
  
  console.log('✅ Crossword filling complete');
}

// Функция определения языка по домену
function detectLanguageByDomain() {
  const hostname = window.location.hostname.toLowerCase();
  
  // Словарь доменов и соответствующих языков
  const domainLanguageMap = {
    // Русские домены
    'ru': 'ru',
    'рф': 'ru',
    'su': 'ru',
    'by': 'ru',
    'kz': 'ru',
    'ua': 'ru', // может быть украинский, но часто русский контент
    
    // Английские домены
    'com': 'en',
    'org': 'en',
    'net': 'en',
    'edu': 'en',
    'gov': 'en',
    'uk': 'en',
    'us': 'en',
    'ca': 'en',
    'au': 'en',
    
    // Другие языки
    'de': 'de',
    'fr': 'fr',
    'es': 'es',
    'it': 'it',
    'pl': 'pl',
    'cz': 'cs',
    'sk': 'sk'
  };
  
  // Проверяем TLD
  const tld = hostname.split('.').pop();
  if (domainLanguageMap[tld]) {
    console.log(`🌐 Language detected by TLD .${tld}: ${domainLanguageMap[tld]}`);
    return domainLanguageMap[tld];
  }
  
  // Проверяем поддомены
  const parts = hostname.split('.');
  for (const part of parts) {
    if (domainLanguageMap[part]) {
      console.log(`🌐 Language detected by subdomain ${part}: ${domainLanguageMap[part]}`);
      return domainLanguageMap[part];
    }
  }
  
  // Проверяем специфичные домены
  if (hostname.includes('crossword') || hostname.includes('puzzle')) {
    return 'en'; // Английские кроссворды по умолчанию
  }
  
  if (hostname.includes('кроссворд') || hostname.includes('сканворд')) {
    return 'ru'; // Русские кроссворды
  }
  
  console.log('🌐 Could not detect language by domain, using default');
  return null; // Не удалось определить
}

// Функция открытия модального окна
function openCrosswordModal() {
  console.log('🪟 Opening crossword modal...');
  
  // Проверяем, не открыто ли уже модальное окно
  if (document.querySelector('.modal-overlay')) {
    console.log('⚠️ Modal is already open');
    return;
  }
  
  // Загружаем CSS для модального окна, если еще не загружен
  if (!document.querySelector('link[href*="popup-modal.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('popup-modal.css');
    document.head.appendChild(link);
  }
  
  const injectScript = (fileName) => new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src*="${fileName}"]`);
    if (existingScript) {
      resolve();
      return;
    }

    console.log(`📦 Loading ${fileName} script...`);
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(fileName);
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${fileName}`));
    document.head.appendChild(script);
  });

  injectScript('services.js')
    .then(() => injectScript('modal.js'))
    .then(() => {
      console.log('📨 Modal dependencies injected, dispatching crossword_open_modal event');
      document.dispatchEvent(new CustomEvent('crossword_open_modal'));
    })
    .catch((error) => {
      console.error('❌ Failed to open crossword modal:', error);
    });
}

// Функция получения ключа кеша из элемента div#date span
function getCacheKey() {
  console.log('🔑 Extracting cache key from page...');
  
  const dateElement = document.querySelector('div#date span');
  if (dateElement) {
    const dateValue = dateElement.textContent.trim();
    console.log('✅ Found date element with value:', dateValue);
    
    // Дополнительно добавляем домен для уникальности ключа
    const domain = window.location.hostname;
    const cacheKey = `${domain}_${dateValue}`;
    
    console.log('🔑 Generated cache key:', cacheKey);
    return cacheKey;
  } else {
    console.log('❌ Date element (div#date span) not found');
    
    // Fallback: используем URL и дату
    const fallbackKey = `${window.location.hostname}_${new Date().toISOString().split('T')[0]}`;
    console.log('🔄 Using fallback cache key:', fallbackKey);
    return fallbackKey;
  }
}

// Очистить все доступные (редактируемые) ячейки внутри контейнера
function clearAvailableCells(id) {
  console.log('🧹 Clearing available cells in:', id);
  const container = document.getElementById(id);
  if (!container) {
    console.log('❌ Container not found with ID:', id);
    return { status: 'no_container' };
  }

  const table = container.querySelector('#cross_tbl');
  if (!table) {
    console.log('❌ Cross table not found');
    return { status: 'no_table' };
  }

  const inputs = table.querySelectorAll('input.sym');
  inputs.forEach(input => {
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  console.log(`✅ Cleared ${inputs.length} editable cells`);
  return { status: 'cleared', count: inputs.length };
}

// Заполнить одно конкретное слово в кроссворде
function fillSingleWord(id, wordId, answer) {
  console.log(`🎯 Filling single word: ${wordId} = "${answer}" in container:`, id);
  
  const container = document.getElementById(id);
  if (!container) {
    console.log('❌ Container not found with ID:', id);
    return { status: 'no_container' };
  }

  const table = container.querySelector('#cross_tbl');
  if (!table) {
    console.log('❌ Cross table not found');
    return { status: 'no_table' };
  }

  // Создаем временный объект в формате API ответа с одним словом
  const singleWordApiResponse = [{
    id: wordId,
    answers: [answer]
  }];

  // Используем существующую функцию fillCrossword для заполнения
  try {
    fillCrossword(id, singleWordApiResponse);
    console.log(`✅ Single word ${wordId} filled with "${answer}"`);
    return { status: 'filled', wordId: wordId, answer: answer };
  } catch (error) {
    console.error(`❌ Error filling single word ${wordId}:`, error);
    return { status: 'error', error: error.message };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('📨 Message received:', msg);
  
  if (msg.action === 'getCrossword') {
    console.log('🔍 Processing getCrossword request for ID:', msg.id);
    const result = extractCrossword(msg.id, {
      includeUserInputLetters: msg.includeUserInputLetters === true
    });
    console.log('📦 Sending crossword data:', result);
    sendResponse(result);
  } else if (msg.action === 'fillCrossword') {
    console.log('✏️ Processing fillCrossword request for ID:', msg.id);
    fillCrossword(msg.id, msg.words);
    const result = { status: 'filled' };
    console.log('✅ Sending fill result:', result);
    sendResponse(result);
  } else if (msg.action === 'getCacheKey') {
    console.log('🔑 Processing getCacheKey request');
    const cacheKey = getCacheKey();
    const result = { cacheKey: cacheKey };
    console.log('🔑 Sending cache key:', result);
    sendResponse(result);
  } else if (msg.action === 'clearCells') {
    console.log('🧹 Processing clearCells request for ID:', msg.id);
    const result = clearAvailableCells(msg.id);
    console.log('🧹 Clear result:', result);
    sendResponse(result);
  } else if (msg.action === 'fillSingleWord') {
    console.log(`🎯 Processing fillSingleWord request: ${msg.wordId} = "${msg.answer}"`);
    const result = fillSingleWord(msg.id, msg.wordId, msg.answer);
    console.log('🎯 Single word fill result:', result);
    sendResponse(result);
  } else if (msg.action === 'openModal') {
    console.log('🪟 Processing openModal request');
    openCrosswordModal();
    sendResponse({ status: 'modal_opened' });
  } else {
    console.log('❓ Unknown action:', msg.action);
  }
});