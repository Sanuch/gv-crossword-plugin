// Простой тестовый сервер для демонстрации API кроссворда
// Запуск: node test-api-server.js

const http = require('http');
const url = require('url');

// Простая база "ответов" для демонстрации по языкам
const mockAnswers = {
  'ru': {
    'монстр': ['ДРАКОН', 'ГОБЛИН', 'ОРК', 'ТРОЛЛЬ', 'ДЕМОН'],
    'трофей': ['МЕДАЛЬ', 'КУБОК', 'ДИПЛОМ', 'ПРИЗ'],
    'снаряжение': ['ДОСПЕХ', 'ШЛЕМ', 'МЕЧ', 'ЛУК'],
    'местность': ['ЛЕС', 'ГОРА', 'ПОЛЕ', 'РЕКА', 'ОЗЕРО'],
    'сильный монстр': ['ДРАКОН', 'ТИТАН', 'ГИГАНТ'],
    'животное': ['КОТ', 'СОБАКА', 'ЛОШАДЬ', 'КОРОВА', 'СВИНЬЯ'],
    'цвет': ['КРАСНЫЙ', 'СИНИЙ', 'ЗЕЛЕНЫЙ', 'ЖЕЛТЫЙ', 'БЕЛЫЙ'],
    'еда': ['ХЛЕБ', 'МЯСО', 'РЫБА', 'ОВОЩИ', 'ФРУКТЫ']
  },
  'en': {
    'monster': ['DRAGON', 'GOBLIN', 'ORC', 'TROLL', 'DEMON'],
    'trophy': ['MEDAL', 'CUP', 'DIPLOMA', 'PRIZE'],
    'equipment': ['ARMOR', 'HELMET', 'SWORD', 'BOW'],
    'terrain': ['FOREST', 'MOUNTAIN', 'FIELD', 'RIVER', 'LAKE'],
    'strong monster': ['DRAGON', 'TITAN', 'GIANT'],
    'animal': ['CAT', 'DOG', 'HORSE', 'COW', 'PIG'],
    'color': ['RED', 'BLUE', 'GREEN', 'YELLOW', 'WHITE'],
    'food': ['BREAD', 'MEAT', 'FISH', 'VEGETABLES', 'FRUITS']
  }
};

function findAnswers(pattern, clue, length, lang = 'ru') {
  console.log(`🔍 Searching for: pattern="${pattern}", clue="${clue}", length=${length}, lang=${lang}`);
  
  // Нормализуем подсказку
  const normalizedClue = clue.toLowerCase().trim();
  
  // Выбираем словарь по языку
  const dictionary = mockAnswers[lang] || mockAnswers['ru'];
  
  // Ищем подходящие ответы по подсказке
  let candidates = [];
  for (const [key, words] of Object.entries(dictionary)) {
    if (normalizedClue.includes(key)) {
      candidates = candidates.concat(words);
    }
  }
  
  // Если ничего не найдено, пробуем общие слова
  if (candidates.length === 0) {
    // Добавляем общие слова подходящей длины
    const allWords = Object.values(dictionary).flat();
    candidates = allWords.filter(word => word.length === length);
  }
  
  // Фильтруем по длине
  candidates = candidates.filter(word => word.length === length);
  
  // Фильтруем по шаблону
  const filteredCandidates = candidates.filter(word => {
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] !== '_' && pattern[i] !== word[i]) {
        return false;
      }
    }
    return true;
  });
  
  console.log(`✅ Found ${filteredCandidates.length} matches: ${filteredCandidates.join(', ')}`);
  return filteredCandidates;
}

const server = http.createServer((req, res) => {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.method === 'POST' && req.url === '/solve') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        console.log('\n🚀 New request received');
        const requestData = JSON.parse(body);
        console.log('📥 Input data:', JSON.stringify(requestData, null, 2));
        
        // Поддерживаем разные форматы запросов
        let crosswordData, lang = 'ru';
        
        if (Array.isArray(requestData)) {
          // Старый формат - массив слов
          crosswordData = requestData;
        } else if (requestData.tasks) {
          // Формат CrosswordNinja
          crosswordData = requestData.tasks;
          lang = requestData.lang || 'ru';
        } else if (requestData.words) {
          // Прямой формат
          crosswordData = requestData.words;
          lang = requestData.lang || 'ru';
        } else {
          throw new Error('Unknown request format');
        }
        
        console.log(`🗣️ Using language: ${lang}`);
        
        const results = crosswordData.map(wordData => {
          const { id, pattern, clue, length } = wordData;
          const answers = findAnswers(pattern, clue, length, lang);
          
          return {
            id,
            pattern,
            clue,
            length,
            answers
          };
        });
        
        console.log('📤 Response:', JSON.stringify(results, null, 2));
        
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(results, null, 2));
        
      } catch (error) {
        console.error('❌ Error:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    
  } else {
    // Простая справочная страница
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <html>
      <head><title>Crossword API Test Server</title></head>
      <body>
        <h1>🧩 Crossword API Test Server</h1>
        <p>Сервер запущен и готов к работе!</p>
        
        <h2>Использование:</h2>
        <p><strong>POST /solve</strong> - решение кроссворда</p>
        
        <h3>Формат запроса (с поддержкой языка):</h3>
        <pre>
{
  "lang": "ru",
  "tasks": [
    {
      "id": "2г",
      "pattern": "С__О___Л_",
      "clue": "Монстр",
      "length": 10
    }
  ]
}
        </pre>
        
        <h3>Формат ответа:</h3>
        <pre>
[
  {
    "id": "2г",
    "pattern": "С__О___Л_",
    "clue": "Монстр", 
    "length": 10,
    "answers": ["ДРАКОН", "ГОБЛИН"]
  }
]
        </pre>
        
        <h3>Поддерживаемые языки:</h3>
        <ul>
          <li><strong>ru</strong> (русский) - по умолчанию</li>
          <li><strong>en</strong> (английский)</li>
        </ul>
        
        <h3>Поддерживаемые категории (RU):</h3>
        <ul>
          <li>Монстр: ${mockAnswers.ru['монстр'].join(', ')}</li>
          <li>Трофей: ${mockAnswers.ru['трофей'].join(', ')}</li>
          <li>Снаряжение: ${mockAnswers.ru['снаряжение'].join(', ')}</li>
          <li>Местность: ${mockAnswers.ru['местность'].join(', ')}</li>
          <li>Животное: ${mockAnswers.ru['животное'].join(', ')}</li>
          <li>Цвет: ${mockAnswers.ru['цвет'].join(', ')}</li>
          <li>Еда: ${mockAnswers.ru['еда'].join(', ')}</li>
        </ul>
        
        <h3>Поддерживаемые категории (EN):</h3>
        <ul>
          <li>Monster: ${mockAnswers.en['monster'].join(', ')}</li>
          <li>Trophy: ${mockAnswers.en['trophy'].join(', ')}</li>
          <li>Equipment: ${mockAnswers.en['equipment'].join(', ')}</li>
          <li>Terrain: ${mockAnswers.en['terrain'].join(', ')}</li>
          <li>Animal: ${mockAnswers.en['animal'].join(', ')}</li>
          <li>Color: ${mockAnswers.en['color'].join(', ')}</li>
          <li>Food: ${mockAnswers.en['food'].join(', ')}</li>
        </ul>
      </body>
      </html>
    `);
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🌐 Test API server running on http://localhost:${PORT}`);
  console.log(`📡 Crossword solving endpoint: http://localhost:${PORT}/solve`);
  console.log('🗣️ Supported languages: ru, en');
  console.log('✅ Ready to accept requests!');
}); 