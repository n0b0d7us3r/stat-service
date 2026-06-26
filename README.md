# Game Stat (stat.service)

Локальный планер-приложение для учёта привычек и прогресса по проектам. Работает в браузере без серверной базы данных: все данные хранятся на стороне клиента в SQLite (через WebAssembly) и сохраняются в IndexedDB.

## Функционал

### Проекты
- Создание календарных проектов с названием, описанием и флагом **«Изменяемый»**.
- Если проект не изменяемый, отметки в календаре можно только ставить — снять их нельзя (даже администратору).
- Календарь с отметками дней, черновым режимом редактирования («Добавить отметки» → «Готово» / «Отменить»).
- Заметки к отдельным дням.
- Статистика проекта: отметки за месяц, текущая и лучшая серия.
- Удаление проекта (с подтверждением паролем) в настройках страницы проекта.

### Дашборд
- Сводная статистика по всем проектам: количество проектов, отметки, серии, достижения.
- Таблица проектов с переходом на страницу проекта.
- Блок «Последние полученные достижения».

### Достижения
- Система достижений за серии, количество проектов, заметки, выходные, прогресс месяца и др.
- Страница со списком всех достижений (полученные и неполученные).
- Праздничная анимация при получении: модальное окно, конфetti, кнопка **«Я МОЛОДЕЦ»**.

### Пользователи
- Регистрация и вход по email/паролю.
- Первый администратор создаётся автоматически из переменных окружения (см. ниже).
- Администратор может снимать отметки в **изменяемых** проектах; обычный пользователь — только добавлять.

### Интерфейс
- Тёмная и светлая тема.
- Адаптивная вёрстка для мобильных и десктопа.
- Боковое меню: Дашборд, Проекты, Достижения.

## Технический стек

| Слой | Технологии |
|------|------------|
| UI | React 19, TypeScript, React Router 7 |
| Сборка | Vite 8 |
| Стили | CSS (кастомные), Tailwind (частично) |
| База данных | [sql.js](https://github.com/sql-js/sql.js) (SQLite WASM) |
| Хранение БД | IndexedDB (браузер) |
| Иконки | Lucide React |
| Деплой | Docker, nginx (Alpine) |

Приложение **local-first**: нет backend API, данные не уходят на сервер. Контейнер Docker отдаёт только статические файлы фронтенда.

## Быстрый старт

### Локальная разработка

```bash
cp .env.example .env
cd src
npm install
npm run dev
```

Переменные окружения читаются из файла `.env` в **корне репозитория** (`envDir: '..'` в Vite).

### Docker

```bash
cp .env.example .env
# отредактируйте .env при необходимости
docker compose up --build
```

Приложение будет доступно на `http://127.0.0.1:3000`.

## Первый пользователь

Первый пользователь создаётся **автоматически при первом открытии приложения в браузере**, если база ещё пуста и заданы переменные в `.env`:

```env
VITE_SEED_ADMIN_EMAIL=admin@local
VITE_SEED_ADMIN_PASSWORD=change-me
```

Порядок действий:

1. Скопируйте `.env.example` → `.env` и задайте email и пароль администратора.
2. Пересоберите/перезапустите приложение (`npm run dev` или `docker compose up --build`).
3. Откройте сайт в браузере **в режиме инкognito или с пустой базой** (первый визит на этот origin).
4. Войдите на `/login` с указанными `VITE_SEED_ADMIN_EMAIL` и `VITE_SEED_ADMIN_PASSWORD`.

Важно:

- Seed срабатывает **только один раз** — когда в таблице `users` ещё нет записей.
- Создаётся пользователь с флагом **администратора** (`is_admin = 1`).
- Если seed не настроен, можно зарегистрироваться вручную на `/register` (будет обычный пользователь, не админ).

Имя приложения в интерфейсе задаётся переменной:

```env
VITE_APP_NAME=stat.service
```

## Где хранится база данных

База **не лежит на диске сервера** и **не находится в каталоге проекта**. Это SQLite-база sql.js, сериализованная в бинарный файл и сохранённая в **IndexedDB браузера**, с которого вы открываете приложение.

| Параметр | Значение |
|----------|----------|
| IndexedDB database | `game-stat-db` |
| Object store | `sqlite` |
| Ключ записи | `main` |

Данные привязаны к **origin** (протокол + хост + порт). Например, `http://localhost:5173` и `http://127.0.0.1:3000` — это **разные** базы.

### Где это на Linux (файлы браузера)

IndexedDB хранится в профиле браузера, например:

- **Google Chrome / Chromium**  
  `~/.config/google-chrome/Default/IndexedDB/`  
  или  
  `~/.config/chromium/Default/IndexedDB/`

- **Firefox**  
  `~/.mozilla/firefox/<profile>/storage/default/<origin>/idb/`

Имена каталогов зависят от origin (хост и порт кодируются в имени папки). Это **внутренний формат браузера**, а не готовый `.sqlite` файл — напрямую копировать эти каталоги неудобно и ненадёжно.

## Резервная копия базы (Linux)

Рекомендуемый способ — экспорт через инструменты разработчика браузера:

1. Откройте приложение в том же браузере и origin, где накоплены данные.
2. Откройте DevTools (`F12`).
3. Вкладка **Application** (Chrome) или **Хранилище** (Firefox) → **IndexedDB** → `game-stat-db` → `sqlite`.
4. Найдите запись с ключом `main` (бинарные данные) и сохраните значение через скрипт в консоли:

```javascript
// В консоли браузера на странице приложения
const request = indexedDB.open('game-stat-db', 1);
request.onsuccess = () => {
  const tx = request.result.transaction('sqlite', 'readonly');
  const store = tx.objectStore('sqlite');
  const getReq = store.get('main');
  getReq.onsuccess = () => {
    const blob = new Blob([getReq.result], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'game-stat-backup.sqlite';
    a.click();
  };
};
```

Файл `game-stat-backup.sqlite` — это дамп базы sql.js. Его можно хранить в Linux как обычный файл, например:

```bash
cp ~/Downloads/game-stat-backup.sqlite ~/backups/game-stat-$(date +%F).sqlite
```

### Восстановление из копии

Восстановление выполняется вручную через консоль браузера на **том же origin**:

```javascript
// Загрузите файл backup через input или fetch, получите ArrayBuffer → Uint8Array
async function restoreBackup(uint8Array) {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open('game-stat-db', 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('sqlite')) {
        req.result.createObjectStore('sqlite');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction('sqlite', 'readwrite');
    tx.objectStore('sqlite').put(uint8Array, 'main');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  alert('База восстановлена. Перезагрузите страницу.');
}
```

После восстановления перезагрузите страницу приложения.

### Альтернатива: копия профиля браузера

Можно архивировать весь каталог профиля браузера (при **закрытом** браузере):

```bash
tar -czf ~/backups/chrome-profile-game-stat.tar.gz ~/.config/google-chrome/Default/IndexedDB/
```

Минус: привязка к конкретному браузеру и origin; восстановление сложнее, чем один `.sqlite` дамп.

## Перенос на другой сервер

### Главное

Перенос Docker-контейнера или деплой на новый сервер **не переносит данные пользователей**. Сервер отдаёт только статику (HTML/JS/CSS). Вся база живёт **в браузере каждого пользователя** (IndexedDB).

| Что переносится | Как |
|-----------------|-----|
| Код приложения | `git`, Docker, `docker compose up --build` на новом сервере |
| Схема БД (миграции) | Автоматически при открытии приложения (`applySchema` в коде) |
| Проекты, отметки, достижения | **Вручную**: экспорт → восстановление в браузере на новом URL |

### Сценарий 1: тот же URL, новый сервер

Пример: было `https://stat.example.com` на старом VPS, стало на новом VPS с тем же доменом.

1. Разверните приложение на новом сервере (тот же `.env`, тот же домен).
2. Пользователи открывают **тот же адрес** в **том же браузере** — IndexedDB остаётся на их машине, данные на месте.
3. Миграции схемы (v1 → v7 и т.д.) применятся сами при первом заходе после обновления версии приложения.

**Бэкап на сервере не нужен** — на сервере нет файла базы.

### Сценарий 2: новый URL (другой домен или порт)

Пример: было `http://192.168.1.10:3000`, стало `https://stat.mycompany.ru`.

Для браузера это **другой origin** → IndexedDB пустая. Нужен перенос данных:

**Шаг 1 — экспорт на старом адресе**

1. Откройте приложение по **старому** URL.
2. В DevTools → Console выполните скрипт экспорта (см. раздел «Резервная копия» выше).
3. Сохраните файл, например `game-stat-backup.sqlite`.
4. Скопируйте файл на сервер/другой компьютер:

```bash
scp game-stat-backup.sqlite user@new-server:~/backups/
```

**Шаг 2 — развернуть приложение на новом сервере**

```bash
git clone ... && cd game-stat
cp .env.example .env
# Настройте .env; если БД пустая — seed создаст админа при первом заходе
docker compose up --build -d
```

**Шаг 3 — импорт на новом адресе**

1. Откройте приложение по **новому** URL (база пока пустая).
2. В DevTools → Console:

```javascript
async function importBackupFromFile(file) {
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open('game-stat-db', 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('sqlite')) {
        req.result.createObjectStore('sqlite');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction('sqlite', 'readwrite');
    tx.objectStore('sqlite').put(data, 'main');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  alert('Импорт завершён. Перезагрузите страницу и войдите с прежним email/паролем.');
}

// Затем выберите файл:
const input = document.createElement('input');
input.type = 'file';
input.accept = '.sqlite,application/octet-stream';
input.onchange = () => importBackupFromFile(input.files[0]);
input.click();
```

3. Перезагрузите страницу и войдите с **тем же email и паролем**, что были в экспортированной базе.

### Миграции схемы vs перенос данных

| Термин | Что это |
|--------|---------|
| **Миграция схемы** | Обновление структуры таблиц (новые колонки, достижения). Делается кодом в `src/db/schema.ts` при каждом запуске приложения. Отдельных SQL-миграций на сервере нет. |
| **Бэкап / перенос данных** | Копирование файла SQLite из IndexedDB одного origin в IndexedDB другого (или резервная копия на диск). |

После импорта дампа с более старой версии приложения при открытии новой версии **миграции схемы применятся автоматически** к импортированной базе.

### Что не попадает в дамп IndexedDB

- Сессия входа хранится отдельно в `localStorage` / `sessionStorage` (ключ `game_stat_session`). После импорта нужно **войти заново** — логин и пароль при этом из восстановленной базы.
- Тема интерфейса (`localStorage.theme`) — по желанию настроить снова.

### Рекомендации

- Делайте экспорт `.sqlite` **перед** сменой домена, обновлением сервера или переустановкой браузера.
- Храните бэкапы с датой: `game-stat-2026-06-27.sqlite`.
- Если пользователей несколько и у каждого свой браузер — **каждый** переносит свою базу со своего устройства; централизованного бэкапа на сервере нет.

## Структура репозитория

```
game-stat/
├── .env.example          # пример переменных окружения
├── docker-compose.yaml
├── image/dockerfile      # сборка фронтенда + nginx
├── configs/nginx/        # конфиг nginx
└── src/
    ├── App.tsx           # маршруты
    ├── db/               # SQLite, миграции, auth, achievements
    ├── pages/            # страницы приложения
    ├── components/       # UI-компоненты
    ├── context/          # React-контексты
    └── styles/           # CSS
```

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `VITE_APP_NAME` | Название в интерфейсе |
| `VITE_SEED_ADMIN_EMAIL` | Email первого администратора (если БД пуста) |
| `VITE_SEED_ADMIN_PASSWORD` | Пароль первого администратора |
| `VITE_ALLOW_PUBLIC_REGISTER` | Зарезервировано в `.env.example` (регистрация доступна на `/register`) |

## Сборка

```bash
cd src
npm run build      # production-сборка в src/dist
npm run preview    # локальный просмотр сборки
```
