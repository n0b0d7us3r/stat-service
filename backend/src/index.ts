import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { PORT } from './config.js';
import { clearSessionCookie, requireAuth, setSessionCookie, signSessionToken, type AuthRequest } from './middleware/auth.js';
import { syncUserAchievements, getUserAchievements } from './services/achievementsService.js';
import {
  AuthError,
  loginUser,
  registerUser,
  seedInitialAdmin,
  verifyUserPassword,
} from './services/authService.js';
import { getDashboardMonthlyStats, getDashboardStats } from './services/dashboardService.js';
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
import { getNote, getNoteDatesForMonth, saveNote } from './services/notesService.js';
import { DbError, createProject, deleteProject, getProjectById, getProjectsByUser } from './services/projectsService.js';

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
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

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ message: 'Внутренняя ошибка сервера' });
});

await seedInitialAdmin();

app.listen(PORT, () => {
  console.log(`stat-service API listening on :${PORT}`);
});
