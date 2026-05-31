// Базовый класс для провайдеров
const DEFAULT_DICTIONARY_MANIFEST_URL = 'https://raw.githubusercontent.com/oivashchenko/crossword_dict/main/manifest.json';
const DICTIONARY_CACHE_KEY = 'githubDictionaryCache';
const DICTIONARY_MANIFEST_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_DICTIONARY_RESULTS = 25;
const MAX_SOLVER_SEARCH_NODES = 50000;

class CrosswordProvider {
  constructor(name, endpoint) {
    this.name = name;
    this.endpoint = endpoint;
  }

  // Преобразование данных кроссворда в формат провайдера
  async transformRequest(crosswordData, lang) {
    return crosswordData.map(word => ({
      id: word.id,
      pattern: word.pattern,
      clue: word.clue,
      length: word.length
    }));
  }

  // Преобразование ответа провайдера в стандартный формат
  async transformResponse(response) {
    return response;
  }

  async solve(crosswordData, lang) {
    const transformedRequest = await this.transformRequest(crosswordData, lang);
    console.log('📡 Sending transformed data to provider:', transformedRequest);

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transformedRequest)
    });

    console.log('📥 Response status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const rawResponse = await response.json();
    console.log('📦 Raw provider response:', rawResponse);

    const apiResponse = await this.transformResponse(rawResponse);
    console.log('💡 Transformed response:', apiResponse);
    return apiResponse;
  }

  // Получение описания форматов для пользовательского интерфейса
  getFormatDescription() {
    return {
      request: `[
  {
    "id": "2г",
    "pattern": "С__О___Л_",
    "clue": "Монстр",
    "length": 10
  }
]`,
      response: `[
  {
    "id": "2г",
    "pattern": "С__О___Л_",
    "clue": "Монстр",
    "length": 10,
    "answers": ["СКОРПИОН"]
  }
]`
    };
  }
}

// Провайдер 1: CrosswordNinja
class CrosswordNinjaProvider extends CrosswordProvider {
  constructor() {
    super('CrosswordNinja', 'https://api.crosswordninja.com/solve');
  }

  async transformRequest(crosswordData, lang = 'en') {
      return {
        lang: lang,
        tasks: crosswordData.map(word => ({
          id: word.id,
          clue: word.clue,
          pattern: word.pattern,
          length: word.length
        })),
        force_refresh: false
      };
  }

  async transformResponse(response) {
    return response.map(result => ({
      id: result.wordId,
      pattern: result.template,
      clue: result.hint,
      length: result.template.length,
      answers: result.suggestions || []
    }));
  }

  getFormatDescription() {
    return {
      request: `{
  "lang": "ru",
  "tasks": [
    {
      "id": "2г",
      "clue": "Монстр",
      "pattern": "С__О___Л_",
      "length": 10
    }
  ],
  "force_refresh": false
}`,
      response: `[
  {
    "wordId": "2г",
    "template": "С__О___Л_",
    "hint": "Монстр",
    "suggestions": ["СКОРПИОН"]
  }
]`
    };
  }
}

// Провайдер 2: WordSolver
class WordSolverProvider extends CrosswordProvider {
  constructor() {
    super('WordSolver', 'https://api.wordsolver.com/crossword');
  }

  async transformRequest(crosswordData, lang = 'en') {
    return {
      language: lang,
      puzzle: {
        words: crosswordData.map(word => ({
          position: word.id,
          mask: word.pattern,
          description: word.clue
        }))
      }
    };
  }

  async transformResponse(response) {
    return response.puzzle.words.map(word => ({
      id: word.position,
      pattern: word.mask,
      clue: word.description,
      length: word.mask.length,
      answers: word.solutions || []
    }));
  }

  getFormatDescription() {
    return {
      request: `{
  "language": "ru",
  "puzzle": {
    "words": [
      {
        "position": "2г",
        "mask": "С__О___Л_",
        "description": "Монстр"
      }
    ]
  }
}`,
      response: `{
  "puzzle": {
    "words": [
      {
        "position": "2г",
        "mask": "С__О___Л_",
        "description": "Монстр",
        "solutions": ["СКОРПИОН"]
      }
    ]
  }
}`
    };
  }
}

// Провайдер 3: CrosswordSolver
class CrosswordSolverProvider extends CrosswordProvider {
  constructor() {
    super('CrosswordSolver', 'https://api.crosswordsolver.org/v1/solve');
  }

  async transformRequest(crosswordData, lang = 'en') {
    return {
      language: lang,
      crossword: {
        entries: crosswordData.map(word => ({
          reference: word.id,
          pattern: word.pattern.replace(/_/g, '.'),
          clue: word.clue,
          size: word.length
        }))
      }
    };
  }

  async transformResponse(response) {
    return response.crossword.entries.map(entry => ({
      id: entry.reference,
      pattern: entry.pattern.replace(/\./g, '_'),
      clue: entry.clue,
      length: entry.size,
      answers: entry.matches || []
    }));
  }

  getFormatDescription() {
    return {
      request: `{
  "language": "ru",
  "crossword": {
    "entries": [
      {
        "reference": "2г",
        "pattern": "С..О...Л.",
        "clue": "Монстр",
        "size": 10
      }
    ]
  }
}`,
      response: `{
  "crossword": {
    "entries": [
      {
        "reference": "2г",
        "pattern": "С..О...Л.",
        "clue": "Монстр",
        "size": 10,
        "matches": ["СКОРПИОН"]
      }
    ]
  }
}`
    };
  }
}

// Тестовый провайдер
class TestProvider extends CrosswordProvider {
  constructor() {
    super('Test API', 'https://crossword.sanuch.name/crossword/solve');
  }

  async transformRequest(crosswordData, lang) {
    return {
      lang: lang,
      tasks: crosswordData.map(word => ({
        id: word.id,
        clue: word.clue,
        pattern: word.pattern,
        length: word.length
      })),
      force_refresh: false
    };
  }
}

class DictionaryCacheStore {
  async getCache() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get(DICTIONARY_CACHE_KEY);
      return data[DICTIONARY_CACHE_KEY] || {};
    }

    try {
      return JSON.parse(localStorage.getItem(DICTIONARY_CACHE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  async setCache(cache) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [DICTIONARY_CACHE_KEY]: cache });
      return;
    }

    localStorage.setItem(DICTIONARY_CACHE_KEY, JSON.stringify(cache));
  }

  async get(key) {
    const cache = await this.getCache();
    return cache[key] || null;
  }

  async set(key, value) {
    const cache = await this.getCache();
    cache[key] = value;
    await this.setCache(cache);
  }
}

class GitHubDictionaryProvider extends CrosswordProvider {
  constructor() {
    super('GitHub Dictionaries', DEFAULT_DICTIONARY_MANIFEST_URL);
    this.cache = new DictionaryCacheStore();
  }

  async getManifestUrl() {
    if (typeof window !== 'undefined' && window.CROSSWORD_DICTIONARY_MANIFEST_URL) {
      return window.CROSSWORD_DICTIONARY_MANIFEST_URL;
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      const data = await chrome.storage.sync.get('dictionaryManifestUrl');
      return data.dictionaryManifestUrl || DEFAULT_DICTIONARY_MANIFEST_URL;
    }

    return DEFAULT_DICTIONARY_MANIFEST_URL;
  }

  async fetchJson(url) {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`Failed to load dictionary manifest (${response.status})`);
    }
    return response.json();
  }

  async fetchText(url) {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`Failed to load dictionary file ${url} (${response.status})`);
    }
    return response.text();
  }

  async loadManifest(forceRefresh = false) {
    const manifestUrl = await this.getManifestUrl();
    const cacheKey = `manifest:${manifestUrl}`;
    const cached = await this.cache.get(cacheKey);
    const now = Date.now();

    if (!forceRefresh && cached && cached.timestamp && now - cached.timestamp < DICTIONARY_MANIFEST_TTL_MS) {
      console.log('📚 Using cached dictionary manifest:', manifestUrl);
      return cached.data;
    }

    console.log('🌐 Loading dictionary manifest:', manifestUrl);
    const manifest = await this.fetchJson(manifestUrl);
    await this.cache.set(cacheKey, { data: manifest, timestamp: now });
    return manifest;
  }

  async loadDictionary(dictionary) {
    const cacheKey = `dictionary:${dictionary.url}:${dictionary.sha256 || 'nohash'}`;
    const cached = await this.cache.get(cacheKey);

    if (cached && Array.isArray(cached.words)) {
      console.log('📚 Using cached dictionary:', dictionary.id);
      return cached.words;
    }

    console.log('🌐 Loading dictionary:', dictionary.id, dictionary.url);
    const text = await this.fetchText(dictionary.url);
    const words = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    await this.cache.set(cacheKey, { words, timestamp: Date.now() });
    return words;
  }

  normalizeText(value) {
    return String(value || '')
      .trim()
      .toLocaleLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[«»“”„‘’]/g, ' ')
      .replace(/["'`.,:;!?()[\]{}]/g, ' ')
      .replace(/\s+/g, ' ');
  }

  normalizeForMatch(value) {
    return this.normalizeText(value).replace(/[\s\-–—]/g, '');
  }

  selectDictionaries(languageManifest, clue) {
    const normalizedClue = this.normalizeText(clue);
    const dictionaries = languageManifest.dictionaries || [];
    const matches = dictionaries.filter(dictionary => {
      const aliases = dictionary.aliases || [];
      return aliases.some(alias => normalizedClue.includes(this.normalizeText(alias)));
    });

    return matches.length > 0 ? matches : dictionaries;
  }

  matchesPattern(word, pattern) {
    const normalizedWord = this.normalizeForMatch(word).toLocaleUpperCase();
    const normalizedPattern = this.normalizeForMatch(pattern).toLocaleUpperCase();

    if (normalizedWord.length !== normalizedPattern.length) {
      return false;
    }

    for (let index = 0; index < normalizedPattern.length; index += 1) {
      const patternChar = normalizedPattern[index];
      if (patternChar !== '_' && patternChar !== normalizedWord[index]) {
        return false;
      }
    }

    return true;
  }

  formatAnswer(value) {
    return this.normalizeForMatch(value).toLocaleUpperCase();
  }

  async findCandidates(word, dictionaries, dictionaryWordCache) {
    const candidates = [];
    const seen = new Set();

    for (const dictionary of dictionaries) {
      if (!dictionaryWordCache.has(dictionary.id)) {
        dictionaryWordCache.set(dictionary.id, await this.loadDictionary(dictionary));
      }

      for (const candidate of dictionaryWordCache.get(dictionary.id)) {
        const answer = this.formatAnswer(candidate);
        if (!answer || seen.has(answer)) {
          continue;
        }

        if (this.matchesPattern(answer, word.pattern)) {
          seen.add(answer);
          candidates.push(answer);
        }
      }
    }

    return candidates;
  }

  buildIntersections(crosswordData) {
    const intersectionsByWord = crosswordData.map(() => []);
    const cells = new Map();

    crosswordData.forEach((word, wordIndex) => {
      const wordCells = Array.isArray(word.cells) ? word.cells : [];

      wordCells.forEach((cell, offset) => {
        if (!Number.isInteger(cell.row) || !Number.isInteger(cell.col)) {
          return;
        }

        const cellKey = `${cell.row}:${cell.col}`;
        if (!cells.has(cellKey)) {
          cells.set(cellKey, []);
        }

        cells.get(cellKey).push({ wordIndex, offset });
      });
    });

    cells.forEach(entries => {
      if (entries.length < 2) {
        return;
      }

      for (let first = 0; first < entries.length; first += 1) {
        for (let second = first + 1; second < entries.length; second += 1) {
          const firstEntry = entries[first];
          const secondEntry = entries[second];

          if (firstEntry.wordIndex === secondEntry.wordIndex) {
            continue;
          }

          intersectionsByWord[firstEntry.wordIndex].push({
            otherWordIndex: secondEntry.wordIndex,
            offset: firstEntry.offset,
            otherOffset: secondEntry.offset
          });

          intersectionsByWord[secondEntry.wordIndex].push({
            otherWordIndex: firstEntry.wordIndex,
            offset: secondEntry.offset,
            otherOffset: firstEntry.offset
          });
        }
      }
    });

    return intersectionsByWord;
  }

  filterCandidatesByIntersections(candidateLists, intersectionsByWord) {
    const filteredLists = candidateLists.map(candidates => candidates.slice());
    let changed = true;

    while (changed) {
      changed = false;

      for (let wordIndex = 0; wordIndex < filteredLists.length; wordIndex += 1) {
        const candidates = filteredLists[wordIndex];
        const intersections = intersectionsByWord[wordIndex] || [];

        if (candidates.length === 0 || intersections.length === 0) {
          continue;
        }

        const constraints = intersections.map(intersection => {
          const otherCandidates = filteredLists[intersection.otherWordIndex] || [];
          return {
            intersection,
            allowedLetters: new Set(otherCandidates.map(candidate => candidate[intersection.otherOffset])),
            isActive: otherCandidates.length > 0
          };
        });

        const nextCandidates = candidates.filter(candidate => {
          return constraints.every(({ intersection, allowedLetters, isActive }) => {
            return !isActive || allowedLetters.has(candidate[intersection.offset]);
          });
        });

        if (nextCandidates.length !== candidates.length) {
          filteredLists[wordIndex] = nextCandidates;
          changed = true;
        }
      }
    }

    return filteredLists;
  }

  findConsistentAssignment(crosswordData, candidateLists, intersectionsByWord) {
    const order = candidateLists
      .map((candidates, wordIndex) => ({
        wordIndex,
        candidateCount: candidates.length,
        degree: (intersectionsByWord[wordIndex] || []).length
      }))
      .filter(item => item.candidateCount > 0 && item.degree > 0)
      .sort((left, right) => left.candidateCount - right.candidateCount || right.degree - left.degree);

    if (order.length === 0) {
      return new Map();
    }

    const assignment = new Map();
    const cellLetters = new Map();
    let searchNodes = 0;

    const applyCandidate = (wordIndex, candidate) => {
      const changes = [];
      const wordCells = Array.isArray(crosswordData[wordIndex].cells) ? crosswordData[wordIndex].cells : [];

      for (let offset = 0; offset < wordCells.length; offset += 1) {
        const cell = wordCells[offset];
        if (!Number.isInteger(cell.row) || !Number.isInteger(cell.col)) {
          continue;
        }

        const letter = candidate[offset];
        if (!letter) {
          changes.forEach(cellKey => cellLetters.delete(cellKey));
          return null;
        }

        const cellKey = `${cell.row}:${cell.col}`;
        const existingLetter = cellLetters.get(cellKey);

        if (existingLetter && existingLetter !== letter) {
          changes.forEach(key => cellLetters.delete(key));
          return null;
        }

        if (!existingLetter) {
          cellLetters.set(cellKey, letter);
          changes.push(cellKey);
        }
      }

      return changes;
    };

    const search = (orderIndex) => {
      if (orderIndex >= order.length) {
        return true;
      }

      if (searchNodes >= MAX_SOLVER_SEARCH_NODES) {
        return false;
      }

      const wordIndex = order[orderIndex].wordIndex;

      for (const candidate of candidateLists[wordIndex]) {
        searchNodes += 1;
        const changes = applyCandidate(wordIndex, candidate);
        if (!changes) {
          continue;
        }

        assignment.set(wordIndex, candidate);

        if (search(orderIndex + 1)) {
          return true;
        }

        assignment.delete(wordIndex);
        changes.forEach(cellKey => cellLetters.delete(cellKey));
      }

      return false;
    };

    if (!search(0)) {
      console.log('⚠️ Could not find a fully consistent crossword assignment, using locally filtered candidates');
      return new Map();
    }

    return assignment;
  }

  prioritizeCandidatesByAssignment(candidateLists, assignment, intersectionsByWord) {
    if (assignment.size === 0) {
      return candidateLists;
    }

    return candidateLists.map((candidates, wordIndex) => {
      const intersections = intersectionsByWord[wordIndex] || [];
      const assignedCandidate = assignment.get(wordIndex);

      const compatibleCandidates = candidates.filter(candidate => {
        return intersections.every(intersection => {
          const otherCandidate = assignment.get(intersection.otherWordIndex);
          return !otherCandidate || candidate[intersection.offset] === otherCandidate[intersection.otherOffset];
        });
      });

      if (!assignedCandidate) {
        return compatibleCandidates;
      }

      return [
        assignedCandidate,
        ...compatibleCandidates.filter(candidate => candidate !== assignedCandidate)
      ];
    });
  }

  async solve(crosswordData, lang = 'ru', options = {}) {
    const manifest = await this.loadManifest(options.forceRefresh === true);
    const language = manifest.languages?.[lang] ? lang : 'ru';
    const languageManifest = manifest.languages?.[language];

    if (!languageManifest) {
      throw new Error(`Dictionary language is not available: ${lang}`);
    }

    const dictionaryWordCache = new Map();
    const allDictionaries = languageManifest.dictionaries || [];
    const rawCandidateLists = [];

    for (const word of crosswordData) {
      const selectedDictionaries = this.selectDictionaries(languageManifest, word.clue);
      let candidates = await this.findCandidates(word, selectedDictionaries, dictionaryWordCache);

      if (candidates.length === 0 && selectedDictionaries.length !== allDictionaries.length) {
        candidates = await this.findCandidates(word, allDictionaries, dictionaryWordCache);
      }

      rawCandidateLists.push(candidates);
    }

    const intersectionsByWord = this.buildIntersections(crosswordData);
    const filteredCandidateLists = this.filterCandidatesByIntersections(rawCandidateLists, intersectionsByWord);
    const assignment = this.findConsistentAssignment(crosswordData, filteredCandidateLists, intersectionsByWord);
    const candidateLists = this.prioritizeCandidatesByAssignment(filteredCandidateLists, assignment, intersectionsByWord);

    const results = crosswordData.map((word, wordIndex) => ({
      id: word.id,
      pattern: word.pattern,
      clue: word.clue,
      length: word.length,
      answers: (candidateLists[wordIndex] || []).slice(0, MAX_DICTIONARY_RESULTS)
    }));

    return results;
  }

  getFormatDescription() {
    return {
      request: `{
  "manifest": "${DEFAULT_DICTIONARY_MANIFEST_URL}",
  "language": "ru",
  "words": [
    {
      "id": "2г",
      "pattern": "С__О___Л_",
      "clue": "Монстр",
      "length": 10
    }
  ]
}`,
      response: `[
  {
    "id": "2г",
    "pattern": "С__О___Л_",
    "clue": "Монстр",
    "length": 10,
    "answers": ["СКОРПИОН"]
  }
]`
    };
  }
}

// Менеджер провайдеров
class ProviderManager {
  constructor() {
    this.providers = new Map();
    this.initializeDefaultProviders();
  }

  initializeDefaultProviders() {
    this.registerProvider(new GitHubDictionaryProvider());
    this.registerProvider(new TestProvider());
    this.registerProvider(new CrosswordNinjaProvider());
    this.registerProvider(new WordSolverProvider());
    this.registerProvider(new CrosswordSolverProvider());
  }

  registerProvider(provider) {
    this.providers.set(provider.name, provider);
  }

  getProvider(name) {
    return this.providers.get(name);
  }

  getAllProviders() {
    return Array.from(this.providers.values());
  }

  // Регистрация пользовательского провайдера
  registerCustomProvider(name, endpoint) {
    this.registerProvider(new CrosswordProvider(name, endpoint));
  }
}

// Экспортируем менеджер провайдеров
window.providerManager = new ProviderManager(); 