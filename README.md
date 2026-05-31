# Crossword Solver Extension

Расширение для решения кроссвордов на страницах новостей Godville.

Текущая версия использует встроенный провайдер словарей на основе manifest URL и поддерживает экспорт диагностических логов для отправки.

## Что умеет

- Находит кроссворд в контейнере `twl_wrap` на странице Godville.
- Автоматически определяет язык кроссворда (`ru`/`en`) по контенту и домену.
- Подбирает ответы по шаблону с учетом пересечений слов.
- Кеширует результаты решения и словари.
- Позволяет выгрузить логи в JSON для отправки в поддержку.

## Актуальная структура проекта

```text
crossword/
  assets/icons/
  dist/
    chrome/
    firefox/
    crossword-chrome.zip
    crossword-firefox.zip
  scripts/
    build.mjs
    package.mjs
  src/
    chrome/manifest.json
    firefox/manifest.json
    common/
      content/contentScript.js
      logging/logger.js
      modal/popup-modal.html
      modal/popup-modal.js
      options/options.html
      options/options.js
      popup/popup.html
      popup/popup.js
      services/services.js
  package.json
  README.md
```

## Установка вручную

### Вариант A. Для пользователя Chrome/Chromium (через unpacked)

1. Установите Node.js 18+.
2. В папке проекта выполните:

```bash
npm run build:chrome
```

3. Откройте `chrome://extensions`.
4. Включите `Режим разработчика`.
5. Нажмите `Загрузить распакованное расширение`.
6. Выберите папку `dist/chrome`.

Примечание: zip-архив для Chrome не ставится как обычное расширение без публикации в Web Store, поэтому для ручной установки используйте именно `dist/chrome`.

### Вариант B. Для пользователя Firefox (временная установка)

1. В папке проекта выполните:

```bash
npm run build:firefox
```

2. Откройте `about:debugging#/runtime/this-firefox`.
3. Нажмите `Load Temporary Add-on...`.
4. Выберите файл `dist/firefox/manifest.json`.

Примечание: это временная установка (до перезапуска Firefox).

## Настройка после установки

### Базовое использование

1. Откройте страницу с кроссвордом на Godville.
2. Нажмите иконку расширения.
3. Убедитесь, что выбран провайдер `GitHub Dictionaries`.
4. Нажмите `🚀 Solve`.

### Если нужен свой источник словарей

1. Откройте popup расширения.
2. В списке `Service` выберите `⚙️ Configure Manifest Source`.
3. Укажите HTTPS URL до manifest JSON.
4. Нажмите `Save`.

Поддерживаемая форма манифеста:

```json
{
  "languages": {
    "ru": {
      "dictionaries": [
        { "id": "items", "url": "https://example.com/items.txt" }
      ]
    }
  }
}
```

Важно:

- URL должен начинаться с `https://`.
- После изменения URL кеш словарей очищается автоматически.

## Как получить логи для отправки

### Быстрый способ (рекомендуется)

1. Откройте popup расширения.
2. Нажмите кнопку `📤 Logs`.
3. Будет скачан файл вида `crossword-debug-logs-<timestamp>.json`.
4. При поддержке браузера JSON дополнительно копируется в буфер обмена.
5. Отправьте файл (или JSON из буфера) в поддержку.

Что входит в лог-файл:

- события из popup/options/content-script;
- ошибки `window.error` и `unhandledrejection`;
- контекст (вкладка, выбранный провайдер, ключ кеша, user agent).

### Через DevTools

Для живой отладки можно открыть DevTools и смотреть `Console`.

## Команды для разработки

```bash
npm run build:chrome
npm run build:firefox
npm run package:chrome
npm run package:firefox
```

Если во время сборки не задан `DICTIONARY_MANIFEST_URL`, расширение ожидает manifest URL из runtime-настроек.

## Частые проблемы

1. В popup ошибка про manifest URL.
Решение: настройте источник через `⚙️ Configure Manifest Source` или соберите с `DICTIONARY_MANIFEST_URL`.

2. Не находится кроссворд на странице.
Решение: проверьте, что вы на поддерживаемой странице новостей Godville и в DOM есть контейнер `twl_wrap`.

3. Пустые ответы.
Решение: нажмите `🔄 Refresh` для принудительного обновления без кеша и проверьте логи через `📤 Logs`.