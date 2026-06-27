import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { PORT } from './config.js';
import { clearSessionCookie, requireAuth, setSessionCookie, signSessionToken } from './middleware/auth.js';
import { syncUserAchievements, getUserAchievements } from './services/achievementsService.js';
import { AuthError, loginUser, registerUser, seedInitialAdmin, verifyUserPassword, } from './services/authService.js';
import { getDashboardStats } from './services/dashboardService.js';
import { getAllMarkedDays, getMarkedDaysForMonth, getProjectStats, getTodayKey, syncMarkedDays, } from './services/marksService.js';
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
        const { email, password } = req.body;
        const user = registerUser(email ?? '', password ?? '');
        const token = signSessionToken(user.id);
        setSessionCookie(res, token, true);
        res.status(201).json({ user });
    }
    catch (error) {
        if (error instanceof AuthError) {
            res.status(400).json({ message: error.message });
            return;
        }
        throw error;
    }
});
app.post('/api/auth/login', (req, res) => {
    try {
        const { email, password, remember = false } = req.body;
        const user = loginUser(email ?? '', password ?? '');
        const token = signSessionToken(user.id);
        setSessionCookie(res, token, Boolean(remember));
        res.json({ user });
    }
    catch (error) {
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
app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
});
app.post('/api/auth/verify-password', requireAuth, (req, res) => {
    const { password } = req.body;
    const valid = verifyUserPassword(req.user.id, password ?? '');
    res.json({ valid });
});
app.get('/api/projects', requireAuth, (req, res) => {
    res.json({ projects: getProjectsByUser(req.user.id) });
});
app.post('/api/projects', requireAuth, (req, res) => {
    try {
        const { name, description, projectType, isMutable } = req.body;
        const project = createProject(req.user.id, name ?? '', description ?? '', projectType ?? 'calendar', Boolean(isMutable));
        res.status(201).json({ project });
    }
    catch (error) {
        if (error instanceof DbError) {
            res.status(400).json({ message: error.message });
            return;
        }
        throw error;
    }
});
app.get('/api/projects/:projectId', requireAuth, (req, res) => {
    const projectId = Number(req.params.projectId);
    const project = getProjectById(req.user.id, projectId);
    if (!project) {
        res.status(404).json({ message: 'Проект не найден' });
        return;
    }
    res.json({ project });
});
app.delete('/api/projects/:projectId', requireAuth, (req, res) => {
    try {
        deleteProject(req.user.id, Number(req.params.projectId));
        res.json({ ok: true });
    }
    catch (error) {
        if (error instanceof DbError) {
            res.status(404).json({ message: error.message });
            return;
        }
        throw error;
    }
});
app.get('/api/projects/:projectId/marks', requireAuth, (req, res) => {
    const projectId = Number(req.params.projectId);
    const userId = req.user.id;
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
app.post('/api/projects/:projectId/marks/sync', requireAuth, (req, res) => {
    const projectId = Number(req.params.projectId);
    const { add = [], remove = [] } = req.body;
    syncMarkedDays(req.user.id, projectId, add, remove, req.user.is_admin);
    const newlyEarned = syncUserAchievements(req.user.id);
    res.json({ ok: true, newlyEarned });
});
app.get('/api/projects/:projectId/stats', requireAuth, (req, res) => {
    res.json({ stats: getProjectStats(req.user.id, Number(req.params.projectId)) });
});
app.get('/api/projects/:projectId/notes/:date', requireAuth, (req, res) => {
    const projectId = Number(req.params.projectId);
    const date = String(req.params.date);
    const note = getNote(req.user.id, projectId, date);
    res.json({ note });
});
app.put('/api/projects/:projectId/notes/:date', requireAuth, (req, res) => {
    const projectId = Number(req.params.projectId);
    const date = String(req.params.date);
    const { content = '' } = req.body;
    const note = saveNote(req.user.id, projectId, date, content);
    const newlyEarned = syncUserAchievements(req.user.id);
    res.json({ note, newlyEarned });
});
app.get('/api/projects/:projectId/notes', requireAuth, (req, res) => {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
        res.status(400).json({ message: 'year и month обязательны' });
        return;
    }
    res.json({
        dates: getNoteDatesForMonth(req.user.id, Number(req.params.projectId), year, month),
    });
});
app.get('/api/dashboard', requireAuth, (req, res) => {
    res.json({ stats: getDashboardStats(req.user.id) });
});
app.get('/api/achievements', requireAuth, (req, res) => {
    res.json({ achievements: getUserAchievements(req.user.id) });
});
app.post('/api/achievements/sync', requireAuth, (req, res) => {
    res.json({ newlyEarned: syncUserAchievements(req.user.id) });
});
app.get('/api/meta/today', (_req, res) => {
    res.json({ today: getTodayKey() });
});
app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
});
await seedInitialAdmin();
app.listen(PORT, () => {
    console.log(`stat-service API listening on :${PORT}`);
});
