import { useEffect, useState, type FormEvent } from 'react';
import { Layout } from '../components/Layout';
import { PageTitle } from '../components/PageTitle';
import { SortSelect } from '../components/SortSelect';
import { ApiError } from '../api/client';
import { changeEmail, changePassword } from '../api/auth';
import { getUserSettings, updateUserSettings } from '../api/settings';
import { APP_NAME } from '../config/app';
import { useAuth } from '../context/AuthContext';
import { locale, setLocale, t, type Locale } from '../i18n';
import type { UserSettings } from '../types';
import { FINANCE_CURRENCIES } from '../utils/finance';
import '../styles/TasksPage.css';
import '../styles/SettingsPage.css';

const LOCALES: Array<{ value: Locale; label: string }> = [
  { value: 'ru', label: 'RU' },
  { value: 'en', label: 'EN' },
];

type FormStatus = { kind: 'error' | 'success'; text: string } | null;

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function FinanceSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getUserSettings()
      .then(setSettings)
      .catch((err) => setError(errorText(err, t('settingsLoadFailed'))));
  }, []);

  const handleCurrencyChange = async (baseCurrency: string) => {
    if (!settings || baseCurrency === settings.baseCurrency) return;
    const previous = settings;
    setSettings({ ...settings, baseCurrency });
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      setSettings(await updateUserSettings({ baseCurrency }));
      setSaved(true);
    } catch (err) {
      setSettings(previous);
      setError(errorText(err, t('settingsSaveFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="settings-panel">
      <h2 className="settings-panel-title">{t('settingsFinance')}</h2>
      {error && <p className="tasks-error">{error}</p>}
      {!settings ? (
        !error && <p className="settings-status">{t('settingsLoading')}</p>
      ) : (
        <>
          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-label">{t('settingsBaseCurrency')}</span>
              <span className="settings-row-hint">{t('settingsBaseCurrencyHint')}</span>
            </div>
            <SortSelect
              label={t('financeCurrency')}
              value={settings.baseCurrency}
              options={FINANCE_CURRENCIES.map((code) => ({ value: code, label: code }))}
              onChange={(value) => void handleCurrencyChange(value)}
            />
          </div>
          {(saving || saved) && (
            <p className="settings-status">{saving ? t('settingsSaving') : t('settingsSaved')}</p>
          )}
        </>
      )}
    </section>
  );
}

function LanguageSettings() {
  return (
    <section className="settings-panel">
      <h2 className="settings-panel-title">{t('settingsLanguage')}</h2>
      <div className="settings-row">
        <div className="settings-row-text">
          <span className="settings-row-label">{t('settingsInterfaceLanguage')}</span>
          <span className="settings-row-hint">{t('settingsLanguageHint')}</span>
        </div>
        <div className="settings-segmented" role="radiogroup" aria-label={t('settingsInterfaceLanguage')}>
          {LOCALES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={locale === option.value}
              className={locale === option.value ? 'is-active' : ''}
              onClick={() => setLocale(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function EmailForm() {
  const { user, updateUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<FormStatus>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    try {
      updateUser(await changeEmail(email.trim(), password));
      setEmail('');
      setPassword('');
      setStatus({ kind: 'success', text: t('settingsEmailChanged') });
    } catch (err) {
      setStatus({ kind: 'error', text: errorText(err, t('settingsSaveFailed')) });
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="settings-form" onSubmit={(event) => void handleSubmit(event)}>
      <h3 className="settings-form-title">{t('settingsChangeEmail')}</h3>
      {user && (
        <p className="settings-row-hint">
          {t('settingsCurrentEmail')}: <strong className="settings-current-email">{user.email}</strong>
        </p>
      )}
      <label className="task-editor-field">
        <span>{t('settingsNewEmail')}</span>
        <input
          type="email"
          className="task-editor-input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </label>
      <label className="task-editor-field">
        <span>{t('settingsCurrentPassword')}</span>
        <input
          type="password"
          className="task-editor-input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      {status && <p className={`settings-form-status is-${status.kind}`}>{status.text}</p>}
      <button type="submit" className="modal-action-submit settings-submit" disabled={pending}>
        {pending ? t('settingsSaving') : t('settingsChangeEmailSubmit')}
      </button>
    </form>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<FormStatus>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (next.length < 6) {
      setStatus({ kind: 'error', text: t('passwordTooShort') });
      return;
    }
    if (next !== confirm) {
      setStatus({ kind: 'error', text: t('settingsPasswordMismatch') });
      return;
    }
    setPending(true);
    setStatus(null);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setStatus({ kind: 'success', text: t('settingsPasswordChanged') });
    } catch (err) {
      setStatus({ kind: 'error', text: errorText(err, t('settingsSaveFailed')) });
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="settings-form" onSubmit={(event) => void handleSubmit(event)}>
      <h3 className="settings-form-title">{t('settingsChangePassword')}</h3>
      <label className="task-editor-field">
        <span>{t('settingsCurrentPassword')}</span>
        <input
          type="password"
          className="task-editor-input"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      <label className="task-editor-field">
        <span>{t('settingsNewPassword')}</span>
        <input
          type="password"
          className="task-editor-input"
          value={next}
          onChange={(event) => setNext(event.target.value)}
          autoComplete="new-password"
          minLength={6}
          required
        />
      </label>
      <label className="task-editor-field">
        <span>{t('settingsConfirmPassword')}</span>
        <input
          type="password"
          className="task-editor-input"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoComplete="new-password"
          required
        />
      </label>
      {status && <p className={`settings-form-status is-${status.kind}`}>{status.text}</p>}
      <button type="submit" className="modal-action-submit settings-submit" disabled={pending}>
        {pending ? t('settingsSaving') : t('settingsChangePasswordSubmit')}
      </button>
    </form>
  );
}

export function SettingsPage() {
  useEffect(() => {
    document.title = `${t('settingsTitle')} | ${APP_NAME}`;
  }, []);

  return (
    <Layout>
      <div className="settings-page">
        <PageTitle>{t('settingsTitle')}</PageTitle>

        <LanguageSettings />
        <FinanceSettings />

        <section className="settings-panel">
          <h2 className="settings-panel-title">{t('settingsAccount')}</h2>
          <div className="settings-forms">
            <EmailForm />
            <PasswordForm />
          </div>
        </section>
      </div>
    </Layout>
  );
}
