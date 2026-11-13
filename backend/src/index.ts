import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { PORT } from './config.js';
import { clearSessionCookie, requireAuth, setSessionCookie, signSessionToken, type AuthRequest } from './middleware/auth.js';
import { syncUserAchievements, getUserAchievements } from './services/achievementsService.js';
import {
  AuthError,
  changeUserEmail,
  changeUserPassword,
  loginUser,
  registerUser,
  seedInitialAdmin,
  verifyUserPassword,
} from './services/authService.js';
import { getDashboardMonthlyStats, getDashboardStats } from './services/dashboardService.js';
import {
  createFinanceAccount,
  createFinanceCategory,
  createFinanceEntry,
  createFinanceTransfer,
  deleteFinanceAccount,
  deleteFinanceTransfer,
  getFinanceBalances,
  updateFinanceTransfer,
  deleteFinanceCategory,
  deleteFinanceEntry,
  getFinanceOverview,
  normalizeFinanceDate,
  updateFinanceEntry,
} from './services/financeService.js';
import {
  getAllMarkedDays,
  getMarkedDaysForMonth,
  getProjectStats,
  getTodayKey,
  syncMarkedDays,
} from './services/marksService.js';
import {
  getAllGoalDays,
  getGoalDaysForMonth,
  syncGoalDays,
} from './services/goalsService.js';
import { getNote, getNoteDatesForMonth, listUserNotes, saveNote } from './services/notesService.js';
import { DbError, createProject, deleteProject, getProjectById, getProjectsByUser } from './services/projectsService.js';
import {
  createFolder,
  createTag,
  createTask,
  deleteFolder,
  deleteTag,
  deleteTask,
  listTaskBoard,
  updateTask,
} from './services/tasksService.js';
import { readTaskDescriptionImage, saveTaskDescriptionImage } from './services/taskImagesService.js';
import { getUserSettings, updateUserSettings } from './services/settingsService.js';
import {
  getTodayRates,
  refreshMarketRates,
  setRateOverride,
  startExchangeRatesUpdater,
} from './services/exchangeRatesService.js';

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '8mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/register', (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    const user = registerUser(email ?? '', password ?? '');
    const token = signSessionToken(user.id);
    setSessionCookie(res, token, true);
    res.status(201).json({ user });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(400).json({ message: error.message });
      return;
    }
    throw error;
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password, remember = false } = req.body as {
      email?: string;
      password?: string;
      remember?: boolean;
    };
    const user = loginUser(email ?? '', password ?? '');
    const token = signSessionToken(user.id);
    setSessionCookie(res, token, Boolean(remember));
    res.json({ user });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(401).json({ message: error.message });
      return;
    }
    throw error;
  }
});

app.post('/api/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/verify-password', requireAuth, (req: AuthRequest, res) => {
  const { password } = req.body as { password?: string };
  const valid = verifyUserPassword(req.user!.id, password ?? '');
  res.json({ valid });
});

app.put('/api/auth/email', requireAuth, (req: AuthRequest, res) => {
  try {
    const { email, currentPassword } = req.body as Record<string, unknown>;
    res.json({ user: changeUserEmail(req.user!.id, currentPassword, email) });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(400).json({ message: error.message });
      return;
    }
    throw error;
  }
});

app.put('/api/auth/password', requireAuth, (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body as Record<string, unknown>;
    changeUserPassword(req.user!.id, currentPassword, newPassword);
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(400).json({ message: error.message });
      return;
    }
    throw error;
  }
});

app.get('/api/projects', requireAuth, (req: AuthRequest, res) => {
  res.json({ projects: getProjectsByUser(req.user!.id) });
});

app.post('/api/projects', requireAuth, (req: AuthRequest, res) => {
  try {
    const { name, description, projectType, isMutable } = req.body as {
      name?: string;
      description?: string;
      projectType?: 'calendar' | 'day' | 'goals';
      isMutable?: boolean;
    };
    const project = createProject(
      req.user!.id,
      name ?? '',
      description ?? '',
      projectType ?? 'calendar',
      Boolean(isMutable),
    );
    res.status(201).json({ project });
  } catch (error) {
    if (error instanceof DbError) {
      res.status(400).json({ message: error.message });
      return;
    }
    throw error;
  }
});

app.get('/api/projects/:projectId', requireAuth, (req: AuthRequest, res) => {
  const projectId = Number(req.params.projectId);
  const project = getProjectById(req.user!.id, projectId);

  if (!project) {
    res.status(404).json({ message: 'Проект не найден' });
    return;
  }

  res.json({ project });
});

app.delete('/api/projects/:projectId', requireAuth, (req: AuthRequest, res) => {
  try {
    deleteProject(req.user!.id, Number(req.params.projectId));
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof DbError) {
      res.status(404).json({ message: error.message });
      return;
    }
    throw error;
  }
});

app.get('/api/projects/:projectId/marks', requireAuth, (req: AuthRequest, res) => {
  const projectId = Number(req.params.projectId);
  const userId = req.user!.id;
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  const scope = req.query.scope;

  if (scope === 'all') {
    res.json({ dates: getAllMarkedDays(userId, projectId) });
    return;
  }

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    res.status(400).json({ message: 'year и month обязательны' });
    return;
  }

  res.json({ dates: getMarkedDaysForMonth(userId, projectId, year, month) });
});

app.post('/api/projects/:projectId/marks/sync', requireAuth, (req: AuthRequest, res) => {
  const projectId = Number(req.params.projectId);
  const { add = [], remove = [] } = req.body as { add?: string[]; remove?: string[] };

  syncMarkedDays(req.user!.id, projectId, add, remove, req.user!.is_admin);
  const newlyEarned = syncUserAchievements(req.user!.id);

  res.json({ ok: true, newlyEarned });
});

app.get('/api/projects/:projectId/goals', requireAuth, (req: AuthRequest, res) => {
  const projectId = Number(req.params.projectId);
  const userId = req.user!.id;
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  const scope = req.query.scope;

  if (scope === 'all') {
    res.json({ dates: getAllGoalDays(userId, projectId) });
    return;
  }

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    res.status(400).json({ message: 'year и month обязательны' });
    return;
  }

  res.json({ dates: getGoalDaysForMonth(userId, projectId, year, month) });
});

app.post('/api/projects/:projectId/goals/sync', requireAuth, (req: AuthRequest, res) => {
  const projectId = Number(req.params.projectId);
  const { add = [], remove = [] } = req.body as { add?: string[]; remove?: string[] };

  syncGoalDays(req.user!.id, projectId, add, remove, req.user!.is_admin);
  const newlyEarned = syncUserAchievements(req.user!.id);

  res.json({ ok: true, newlyEarned });
});

app.get('/api/projects/:projectId/stats', requireAuth, (req: AuthRequest, res) => {
  const projectId = Number(req.params.projectId);
  const yearRaw = req.query.year;
  const monthRaw = req.query.month;

  if (yearRaw !== undefined && monthRaw !== undefined) {
    const year = Number(yearRaw);
    const month = Number(monthRaw);

    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      res.status(400).json({ message: 'Некорректные year и month' });
      return;
    }

    res.json({ stats: getProjectStats(req.user!.id, projectId, year, month) });
    return;
  }

  res.json({ stats: getProjectStats(req.user!.id, projectId) });
});

app.get('/api/notes', requireAuth, (req: AuthRequest, res) => {
  const sortRaw = String(req.query.sort ?? 'date');
  const sort = sortRaw === 'project' ? 'project' : 'date';
  const page = Number(req.query.page);
  const limit = Number(req.query.limit);

  res.json({
    result: listUserNotes(req.user!.id, {
      sort,
      page: Number.isFinite(page) ? page : 1,
      limit: Number.isFinite(limit) ? limit : undefined,
    }),
  });
});

app.get('/api/projects/:projectId/notes/:date', requireAuth, (req: AuthRequest, res) => {
  const projectId = Number(req.params.projectId);
  const date = String(req.params.date);
  const note = getNote(req.user!.id, projectId, date);
  res.json({ note });
});

app.put('/api/projects/:projectId/notes/:date', requireAuth, (req: AuthRequest, res) => {
  const projectId = Number(req.params.projectId);
  const date = String(req.params.date);
  const { content = '' } = req.body as { content?: string };
  const note = saveNote(req.user!.id, projectId, date, content);
  const newlyEarned = syncUserAchievements(req.user!.id);
  res.json({ note, newlyEarned });
});

app.get('/api/projects/:projectId/notes', requireAuth, (req: AuthRequest, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    res.status(400).json({ message: 'year и month обязательны' });
    return;
  }

  res.json({
    dates: getNoteDatesForMonth(req.user!.id, Number(req.params.projectId), year, month),
  });
});

app.get('/api/dashboard', requireAuth, (req: AuthRequest, res) => {
  res.json({ stats: getDashboardStats(req.user!.id) });
});

app.get('/api/dashboard/month', requireAuth, (req: AuthRequest, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    res.status(400).json({ message: 'Некорректные year и month' });
    return;
  }

  res.json({ stats: getDashboardMonthlyStats(req.user!.id, year, month) });
});

app.get('/api/achievements', requireAuth, (req: AuthRequest, res) => {
  res.json({ achievements: getUserAchievements(req.user!.id) });
});

app.post('/api/achievements/sync', requireAuth, (req: AuthRequest, res) => {
  res.json({ newlyEarned: syncUserAchievements(req.user!.id) });
});

app.get('/api/meta/today', (_req, res) => {
  res.json({ today: getTodayKey() });
});

app.get('/api/tasks', requireAuth, (req: AuthRequest, res) => {
  res.json(listTaskBoard(req.user!.id));
});

app.post('/api/tasks', requireAuth, (req: AuthRequest, res) => {
  try {
    const { title, description, priority, dueDate, tagIds, folderId } = req.body as {
      title?: string;
      description?: string;
      priority?: number;
      dueDate?: string | null;
      tagIds?: number[];
      folderId?: number | null;
    };
    const task = createTask(req.user!.id, {
      title: title ?? '',
      description,
      priority,
      dueDate,
      tagIds,
      folderId: Object.prototype.hasOwnProperty.call(req.body, 'folderId') ? folderId ?? null : null,
    });
    res.status(201).json({ task });
  } catch (error) {
    if (error instanceof DbError) {
      res.status(400).json({ message: error.message });
      return;
    }
    throw error;
  }
});

app.patch('/api/tasks/:taskId', requireAuth, (req: AuthRequest, res) => {
  try {
    const taskId = Number(req.params.taskId);
    if (!Number.isInteger(taskId) || taskId <= 0) {
      res.status(400).json({ message: 'Некорректный идентификатор задачи' });
      return;
    }

    const { title, description, priority, dueDate, completed, archived, tagIds, folderId } = req.body as {
      title?: string;
      description?: string;
      priority?: number;
      dueDate?: string | null;
      completed?: boolean;
      archived?: boolean;
      tagIds?: number[];
      folderId?: number | null;
    };
    const task = updateTask(req.user!.id, taskId, {
      title,
      description,
      priority,
      dueDate: Object.prototype.hasOwnProperty.call(req.body, 'dueDate') ? dueDate : undefined,
      completed,
      archived,
      tagIds,
      folderId: Object.prototype.hasOwnProperty.call(req.body, 'folderId') ? folderId ?? null : undefined,
    });
    if (!task) {
      res.status(404).json({ message: 'Задача не найдена' });
      return;
    }

    res.json({ task });
  } catch (error) {
    if (error instanceof DbError) {
      res.status(400).json({ message: error.message });
      return;
    }
    throw error;
  }
});

app.delete('/api/tasks/:taskId', requireAuth, (req: AuthRequest, res) => {
  const taskId = Number(req.params.taskId);
  if (!Number.isInteger(taskId) || taskId <= 0) {
    res.status(400).json({ message: 'Некорректный идентификатор задачи' });
    return;
  }

  const deleted = deleteTask(req.user!.id, taskId);
  if (!deleted) {
    res.status(404).json({ message: 'Задача не найдена' });
    return;
  }

  res.status(204).end();
});

app.post('/api/tags', requireAuth, (req: AuthRequest, res) => {
  try {
    const { name, color } = req.body as { name?: string; color?: string };
    const tag = createTag(req.user!.id, name ?? '', color ?? '');
    res.status(201).json({ tag });
  } catch (error) {
    if (error instanceof DbError) {
      res.status(400).json({ message: error.message });
      return;
    }
    throw error;
  }
});

app.post(
  '/api/tasks/description-images',
  requireAuth,
  express.raw({
    type: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
    limit: '6mb',
  }),
  (req: AuthRequest, res) => {
    try {
      let contentType: string;
      let buffer: Buffer;

      if (Buffer.isBuffer(req.body) && req.body.length > 0) {
        contentType = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
        buffer = req.body;
      } else {
        const { contentType: jsonType, data } = req.body as { contentType?: string; data?: string };
        if (!jsonType || typeof data !== 'string' || !data.trim()) {
          res.status(400).json({ message: 'Некорректные данные изображения' });
          return;
        }
        contentType = jsonType.trim().toLowerCase();
        buffer = Buffer.from(data, 'base64');
      }

      const saved = saveTaskDescriptionImage(req.user!.id, contentType, buffer);
      res.status(201).json(saved);
    } catch (error) {
      if (error instanceof DbError) {
        res.status(400).json({ message: error.message });
        return;
      }
      throw error;
    }
  },
);

app.get('/api/tasks/description-images/:filename', requireAuth, (req: AuthRequest, res) => {
  const filename = String(req.params.filename ?? '');
  const file = readTaskDescriptionImage(req.user!.id, filename);
  if (!file) {
    res.status(404).end();
    return;
  }

  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.send(file.buffer);
});

app.post('/api/folders', requireAuth, (req: AuthRequest, res) => {
  try {
    const { name } = req.body as { name?: string };
    const folder = createFolder(req.user!.id, name ?? '');
    res.status(201).json({ folder });
  } catch (error) {
    if (error instanceof DbError) {
      res.status(400).json({ message: error.message });
      return;
    }
    throw error;
  }
});

app.delete('/api/folders/:folderId', requireAuth, (req: AuthRequest, res) => {
  const folderId = Number(req.params.folderId);
  if (!Number.isInteger(folderId) || folderId <= 0) {
    res.status(400).json({ message: 'Некорректный идентификатор папки' });
    return;
  }

  const deleted = deleteFolder(req.user!.id, folderId);
  if (!deleted) {
    res.status(404).json({ message: 'Папка не найдена' });
    return;
  }

  res.status(204).end();
});

app.delete('/api/tags/:tagId', requireAuth, (req: AuthRequest, res) => {
  const tagId = Number(req.params.tagId);
  if (!Number.isInteger(tagId) || tagId <= 0) {
    res.status(400).json({ message: 'Некорректный идентификатор тега' });
    return;
  }

  const deleted = deleteTag(req.user!.id, tagId);
  if (!deleted) {
    res.status(404).json({ message: 'Тег не найден' });
    return;
  }

  res.status(204).end();
});

app.get('/api/finance', requireAuth, (req: AuthRequest, res) => {
  try {
    const from = normalizeFinanceDate(req.query.from);
    const to = normalizeFinanceDate(req.query.to);
    res.json(getFinanceOverview(req.user!.id, from, to));
  } catch (error) {
    if (error instanceof DbError) {
      res.status(400).json({ message: 'Некорректный период' });
      return;
    }
    throw error;
  }
});

app.post('/api/finance/entries', requireAuth, (req: AuthRequest, res) => {
  try {
    const { kind, amount, currency, categoryId, accountId, rate, rateMode, date, note } = req.body as Record<string, unknown>;
    const entry = createFinanceEntry(req.user!.id, {
      kind, amount, currency, categoryId, accountId, rate, rateMode, date, note,
    });
    res.status(201).json({ entry });
  } catch (error) {
    if (error instanceof DbError) {
      res.status(400).json({ message: error.message });
      return;
    }
    throw error;
  }
});

app.put('/api/finance/entries/:entryId', requireAuth, (req: AuthRequest, res) => {
  try {
    const entryId = Number(req.params.entryId);
    if (!Number.isInteger(entryId) || entryId <= 0) {
      res.status(404).json({ message: 'Операция не найдена' });
      return;
    }
    const { amount, currency, categoryId, accountId, rate, rateMode, date, note } = req.body as Record<string, unknown>;
    const entry = updateFinanceEntry(req.user!.id, entryId, {
      amount, currency, categoryId, accountId, rate, rateMode, date, note,
    });
    res.json({ entry });
  } catch (error) {
    if (error instanceof DbError) {
      res.status(400).json({ message: error.message });
      return;
    }
    throw error;
  }
});

app.delete('/api/finance/entries/:entryId', requireAuth, (req: AuthRequest, res) => {
  const entryId = Number(req.params.entryId);
  if (!Number.isInteger(entryId) || entryId <= 0 || !deleteFinanceEntry(req.user!.id, entryId)) {
    res.status(404).json({ message: 'Операция не найдена' });
    return;
  }

  res.status(204).end();
});

app.post('/api/finance/categories', requireAuth, (req: AuthRequest, res) => {
  try {
    const { kind, name, color, icon } = req.body as Record<string, unknown>;
    const category = createFinanceCategory(req.user!.id, { kind, name, color, icon });
    res.status(201).json({ category });
  } catch (error) {
    if (error instanceof DbError) {
      res.status(400).json({ message: error.message });
      return;
    }
    throw error;
  }
});

app.delete('/api/finance/categories/:categoryId', requireAuth, (req: AuthRequest, res) => {
  const categoryId = Number(req.params.categoryId);
  if (!Number.isInteger(categoryId) || categoryId <= 0 || !deleteFinanceCategory(req.user!.id, categoryId)) {
    res.status(404).json({ message: 'Раздел не найден' });
    return;
  }

  res.status(204).end();
});

function parseTransferBody(body: unknown) {
  const { fromAccountId, toAccountId, amount, toAmount, currency, toCurrency, fee, date, note } = body as Record<string, unknown>;
  return { fromAccountId, toAccountId, amount, toAmount, currency, toCurrency, fee, date, note };
}

app.post('/api/finance/transfers', requireAuth, (req: AuthRequest, res) => {
  try {
    res.status(201).json({ transfer: createFinanceTransfer(req.user!.id, parseTransferBody(req.body)) });
  } catch (error) {
    if (error instanceof DbError) {
      res.status(400).json({ message: error.message });
      return;
    }
    throw error;
  }
});

app.put('/api/finance/transfers/:transferId', requireAuth, (req: AuthRequest, res) => {
  try {
    const transferId = Number(req.params.transferId);
    if (!Number.isInteger(transferId) || transferId <= 0) {
      res.status(404).json({ message: 'Перевод не найден' });
      return;
    }
    res.json({ transfer: updateFinanceTransfer(req.user!.id, transferId, parseTransferBody(req.body)) });
  } catch (error) {
    if (error instanceof DbError) {
      res.status(400).json({ message: error.message });
      return;
    }
    throw error;
  }
});

app.delete('/api/finance/transfers/:transferId', requireAuth, (req: AuthRequest, res) => {
  const transferId = Number(req.params.transferId);
  if (!Number.isInteger(transferId) || transferId <= 0 || !deleteFinanceTransfer(req.user!.id, transferId)) {
    res.status(404).json({ message: 'Перевод не найден' });
    return;
  }
  res.status(204).end();
});

app.get('/api/finance/balances', requireAuth, (req: AuthRequest, res) => {
  res.json({ balances: getFinanceBalances(req.user!.id), rates: getTodayRates(req.user!.id) });
});

app.get('/api/finance/rates', requireAuth, (req: AuthRequest, res) => {
  res.json({ rates: getTodayRates(req.user!.id) });
});

app.post('/api/finance/rates/refresh', requireAuth, async (req: AuthRequest, res) => {
  await refreshMarketRates();
  res.json({ rates: getTodayRates(req.user!.id) });
});

app.put('/api/finance/rates/override', requireAuth, (req: AuthRequest, res) => {
  try {
    const { rates } = req.body as Record<string, unknown>;
    res.json({ rates: setRateOverride(req.user!.id, rates) });
  } catch (error) {
    if (error instanceof DbError) {
      res.status(400).json({ message: error.message });
      return;
    }
    throw error;
  }
});

app.delete('/api/finance/rates/override', requireAuth, (req: AuthRequest, res) => {
  res.json({ rates: setRateOverride(req.user!.id, null) });
});

app.get('/api/settings', requireAuth, (req: AuthRequest, res) => {
  res.json({ settings: getUserSettings(req.user!.id) });
});

app.put('/api/settings', requireAuth, (req: AuthRequest, res) => {
  try {
    const { baseCurrency, hiddenBalanceAccounts, enabledCurrencies } = req.body as Record<string, unknown>;
    res.json({ settings: updateUserSettings(req.user!.id, { baseCurrency, hiddenBalanceAccounts, enabledCurrencies }) });
  } catch (error) {
    if (error instanceof DbError) {
      res.status(400).json({ message: error.message });
      return;
    }
    throw error;
  }
});

app.post('/api/finance/accounts', requireAuth, (req: AuthRequest, res) => {
  try {
    const { name, color, icon } = req.body as Record<string, unknown>;
    const account = createFinanceAccount(req.user!.id, { name, color, icon });
    res.status(201).json({ account });
  } catch (error) {
    if (error instanceof DbError) {
      res.status(400).json({ message: error.message });
      return;
    }
    throw error;
  }
});

app.delete('/api/finance/accounts/:accountId', requireAuth, (req: AuthRequest, res) => {
  const accountId = Number(req.params.accountId);
  if (!Number.isInteger(accountId) || accountId <= 0 || !deleteFinanceAccount(req.user!.id, accountId)) {
    res.status(404).json({ message: 'Счёт не найден' });
    return;
  }

  res.status(204).end();
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ message: 'Внутренняя ошибка сервера' });
});

await seedInitialAdmin();
startExchangeRatesUpdater();

app.listen(PORT, () => {
  console.log(`stat-service API listening on :${PORT} (TZ=${process.env.TZ ?? 'system'}, today=${getTodayKey()})`);
});
