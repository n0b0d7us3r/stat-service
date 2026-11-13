import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp } from 'lucide-react';
import { Checkbox } from '../components/Checkbox';
import { Layout } from '../components/Layout';
import { PageTitle } from '../components/PageTitle';
import { SortSelect } from '../components/SortSelect';
import { Modal } from '../components/Modal';
import { ModalActions } from '../components/ModalActions';
import { ApiError } from '../api/client';
import { changeEmail, changePassword } from '../api/auth';
import { deleteFolder, getTaskBoard } from '../api/tasks';
import { getUserSettings, updateUserSettings } from '../api/settings';
import { clearRateOverride, getTodayRates, refreshTodayRates, setRateOverride } from '../api/finance';
import { APP_NAME } from '../config/app';
import { useAuth } from '../context/AuthContext';
import { dateLocaleTag, locale, setLocale, t, type Locale } from '../i18n';
import type { Folder, TodayRates, UserSettings } from '../types';
import { notifyTaskBoardChanged } from '../utils/taskBoardEvents';
import {
  FINANCE_CURRENCIES,
  displayRateToStored,
  rateQuote,
  storedRateToDisplay,
  todayRatesSourceLabel,
} from '../utils/finance';
import '../styles/TasksPage.css';
import '../styles/FinancePage.css';
import '../styles/SettingsPage.css';

const LOCALES: Array<{ value: Locale; label: string }> = [
  { value: 'ru', label: 'RU' },
  { value: 'en', label: 'EN' },
];

type FormStatus = { kind: 'error' | 'success'; text: string } | null;

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function SettingsPanelHelp({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={`settings-panel-help-btn${open ? ' is-open' : ''}`}
      aria-expanded={open}
      aria-label={t('settingsHintButton')}
      onClick={() => onOpenChange(!open)}
    >
      <CircleHelp size={17} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

function SettingsPanelTitle({ children, hint }: { children: string; hint?: ReactNode }) {
  const [hintOpen, setHintOpen] = useState(false);
  const hintRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hintOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!hintRootRef.current?.contains(event.target as Node)) {
        setHintOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [hintOpen]);

  return (
    <div className="settings-panel-head" ref={hint != null ? hintRootRef : undefined}>
      <h2 className="settings-panel-title">{children}</h2>
      {hint != null && (
        <>
          <SettingsPanelHelp open={hintOpen} onOpenChange={setHintOpen} />
          {hintOpen && (
            <div className="settings-panel-help-popover" role="tooltip">
              {hint}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MarketRatesPanel({ todayRates, onChange }: { todayRates: TodayRates; onChange: (next: TodayRates) => void }) {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<FormStatus>(null);

  const handleRefresh = async () => {
    setPending(true);
    setStatus(null);
    try {
      onChange(await refreshTodayRates());
      setStatus({ kind: 'success', text: t('settingsRatesRefreshed') });
    } catch (err) {
      setStatus({ kind: 'error', text: errorText(err, t('settingsSaveFailed')) });
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="settings-panel">
      <SettingsPanelTitle
        hint={<p>{t('settingsMarketRatesHint')}</p>}
      >
        {t('settingsMarketRates')}
      </SettingsPanelTitle>
      <div className="settings-row-text">
        {todayRates.market ? (
          <span className="settings-row-hint">{todayRatesSourceLabel({ ...todayRates, manual: [] }, '')}</span>
        ) : (
          <span className="settings-row-hint">{t('settingsRatesUnavailable')}</span>
        )}
      </div>
      {status && <p className={`settings-form-status is-${status.kind}`}>{status.text}</p>}
      <div className="settings-rates-actions settings-market-rates-actions">
        <button type="button" className="modal-action-submit" disabled={pending} onClick={() => void handleRefresh()}>
          {pending ? t('settingsRatesRefreshing') : t('settingsRefreshRates')}
        </button>
      </div>
    </section>
  );
}

function CustomRatesPanel({ todayRates, onChange }: { todayRates: TodayRates; onChange: (next: TodayRates) => void }) {
  const base = todayRates.base;
  const currencies = FINANCE_CURRENCIES.filter((code) => code !== base);
  const [values, setValues] = useState<Record<string, string>>(() => customFormValues(todayRates));
  const [pending, setPending] = useState<'save' | 'reset' | null>(null);
  const [status, setStatus] = useState<FormStatus>(null);

  useEffect(() => {
    setValues(customFormValues(todayRates));
  }, [todayRates]);

  const run = async (kind: 'save' | 'reset', action: () => Promise<TodayRates>, success: string) => {
    setPending(kind);
    setStatus(null);
    try {
      const next = await action();
      onChange(next);
      setValues(customFormValues(next));
      setStatus({ kind: 'success', text: success });
    } catch (err) {
      setStatus({ kind: 'error', text: errorText(err, t('settingsSaveFailed')) });
    } finally {
      setPending(null);
    }
  };

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    const rates: Record<string, number> = {};
    for (const code of currencies) {
      const raw = values[code]?.trim();
      if (!raw) continue;
      const value = Number(raw.replace(',', '.'));
      if (!Number.isFinite(value) || value <= 0) {
        setStatus({ kind: 'error', text: t('financeRateInvalid') });
        return;
      }
      rates[code] = displayRateToStored(value, rateQuote(code, base).inverted);
    }
    void run('save', () => setRateOverride(rates), t('settingsCustomRatesSaved'));
  };

  return (
    <section className="settings-panel">
      <SettingsPanelTitle hint={<p>{t('settingsCustomRatesHint')}</p>}>
        {t('settingsCustomRates')}
      </SettingsPanelTitle>
      <form className="settings-rates settings-rates-embedded" onSubmit={handleSave}>
        <div className="settings-rates-list">
          {currencies.map((code) => {
            const quote = rateQuote(code, base);
            const market = todayRates.marketRates?.[code];
            const isCustom = todayRates.manual.includes(code);
            return (
              <div key={code} className="settings-rate-row">
                <span className="settings-rate-code">{code}</span>
                <div className="finance-rate-input">
                  <span>1 {quote.unit} =</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="task-editor-input"
                    value={values[code] ?? ''}
                    onChange={(event) => setValues((prev) => ({
                      ...prev,
                      [code]: event.target.value.replace(/[^\d.,]/g, ''),
                    }))}
                    placeholder={market ? displayRateText(market, quote.inverted) : '—'}
                    aria-label={`${t('financeRate')} ${code}`}
                  />
                  <span>{quote.quote}</span>
                </div>
                {isCustom && <span className="settings-rate-badge">{t('financeRateSourceManual')}</span>}
              </div>
            );
          })}
        </div>

        {status && <p className={`settings-form-status is-${status.kind}`}>{status.text}</p>}

        <div className="settings-rates-actions">
          <button type="submit" className="modal-action-submit" disabled={pending !== null}>
            {pending === 'save' ? t('settingsSaving') : t('settingsSaveCustomRates')}
          </button>
          {Object.keys(todayRates.customRates ?? {}).length > 0 && (
            <button
              type="button"
              className="modal-action-cancel"
              disabled={pending !== null}
              onClick={() => void run('reset', clearRateOverride, t('settingsCustomRatesReset'))}
            >
              {t('settingsResetCustomRates')}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

function displayRateText(rate: number, inverted: boolean): string {
  return String(Number(storedRateToDisplay(rate, inverted).toFixed(4)));
}

function customFormValues(todayRates: TodayRates): Record<string, string> {
  const values: Record<string, string> = {};
  for (const code of FINANCE_CURRENCIES) {
    if (code === todayRates.base) continue;
    const rate = todayRates.customRates?.[code];
    if (rate) values[code] = displayRateText(rate, rateQuote(code, todayRates.base).inverted);
  }
  return values;
}

function FinanceSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [todayRates, setTodayRates] = useState<TodayRates | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([getUserSettings(), getTodayRates()])
      .then(([nextSettings, nextRates]) => {
        setSettings({
          ...nextSettings,
          enabledCurrencies: nextSettings.enabledCurrencies?.length
            ? nextSettings.enabledCurrencies
            : [...FINANCE_CURRENCIES],
        });
        setTodayRates(nextRates);
      })
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
      setTodayRates(await getTodayRates());
      setSaved(true);
    } catch (err) {
      setSettings(previous);
      setError(errorText(err, t('settingsSaveFailed')));
    } finally {
      setSaving(false);
    }
  };

  const handleEnabledCurrencyChange = async (code: string, enabled: boolean) => {
    if (!settings || code === settings.baseCurrency) return;
    const previous = settings;
    const enabledCurrencies = enabled
      ? [...new Set([...settings.enabledCurrencies, code])]
      : settings.enabledCurrencies.filter((item) => item !== code);
    setSettings({ ...settings, enabledCurrencies });
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      setSettings(await updateUserSettings({ enabledCurrencies }));
      setTodayRates(await getTodayRates());
      setSaved(true);
    } catch (err) {
      setSettings(previous);
      setError(errorText(err, t('settingsSaveFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <section className="settings-panel">
        <SettingsPanelTitle
          hint={(
            <>
              <p>{t('settingsBaseCurrencyHint')}</p>
              <p>{t('settingsEnabledCurrenciesHint')}</p>
            </>
          )}
        >
          {t('settingsFinance')}
        </SettingsPanelTitle>
        {error && <p className="tasks-error">{error}</p>}
        {!settings ? (
          !error && <p className="settings-status">{t('settingsLoading')}</p>
        ) : (
          <>
            <div className="settings-finance-fields">
              <div className="settings-row">
                <div className="settings-row-text">
                  <span className="settings-row-label">{t('settingsBaseCurrency')}</span>
                </div>
                <SortSelect
                  className="settings-base-currency-select"
                  label={t('settingsBaseCurrency')}
                  value={settings.baseCurrency}
                  options={settings.enabledCurrencies.map((code) => ({ value: code, label: code }))}
                  onChange={(value) => void handleCurrencyChange(value)}
                />
              </div>
              <div className="settings-row settings-row-stack">
                <div className="settings-row-text">
                  <span className="settings-row-label">{t('settingsEnabledCurrencies')}</span>
                </div>
                <div className="settings-currencies-list" role="group" aria-label={t('settingsEnabledCurrencies')}>
                  {FINANCE_CURRENCIES.map((code) => (
                    <Checkbox
                      key={code}
                      label={code}
                      checked={settings.enabledCurrencies.includes(code)}
                      disabled={saving || code === settings.baseCurrency}
                      onChange={(checked) => void handleEnabledCurrencyChange(code, checked)}
                    />
                  ))}
                </div>
              </div>
            </div>
            {(saving || saved) && (
              <p className="settings-status">{saving ? t('settingsSaving') : t('settingsSaved')}</p>
            )}
          </>
        )}
      </section>
      {settings && todayRates && todayRates.base === settings.baseCurrency && (
        <>
          <MarketRatesPanel todayRates={todayRates} onChange={setTodayRates} />
          <CustomRatesPanel key={todayRates.base} todayRates={todayRates} onChange={setTodayRates} />
        </>
      )}
    </>
  );
}

function TaskFoldersSettings() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadFolders = () => {
    setLoading(true);
    void getTaskBoard()
      .then((board) => {
        const list = [...board.folders].sort((a, b) => a.name.localeCompare(b.name, dateLocaleTag));
        setFolders(list);
        setSelected((current) => (list.some((folder) => String(folder.id) === current) ? current : ''));
        setError('');
      })
      .catch((err) => setError(errorText(err, t('loadTasksFailed'))))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadFolders();
  }, []);

  const selectedFolder = folders.find((folder) => String(folder.id) === selected) ?? null;

  const handleDelete = async () => {
    if (!selectedFolder || pending) return;
    setPending(true);
    setError('');
    try {
      await deleteFolder(selectedFolder.id);
      setConfirmOpen(false);
      setSelected('');
      loadFolders();
      notifyTaskBoardChanged();
    } catch (err) {
      setError(errorText(err, t('folderDeleteFailed')));
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <section className="settings-panel">
        <SettingsPanelTitle hint={<p>{t('settingsTaskFoldersHint')}</p>}>
          {t('settingsTaskFolders')}
        </SettingsPanelTitle>
        {error && <p className="tasks-error">{error}</p>}
        {loading ? (
          <p className="settings-status">{t('settingsLoading')}</p>
        ) : folders.length === 0 ? (
          <p className="settings-status">{t('settingsTaskFoldersEmpty')}</p>
        ) : (
          <div className="settings-folder-delete">
            <SortSelect
              className="settings-folder-delete-select"
              label={t('folder')}
              value={selected}
              options={[
                { value: '', label: '—' },
                ...folders.map((folder) => ({ value: String(folder.id), label: folder.name })),
              ]}
              onChange={setSelected}
            />
            <button
              type="button"
              className="modal-action-cancel settings-folder-delete-btn"
              disabled={!selectedFolder || pending}
              onClick={() => setConfirmOpen(true)}
            >
              {t('delete')}
            </button>
          </div>
        )}
      </section>

      {confirmOpen && selectedFolder && (
        <TaskFolderDeleteModal
          folder={selectedFolder}
          pending={pending}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => void handleDelete()}
        />
      )}
    </>
  );
}

function TaskFolderDeleteModal({
  folder,
  pending,
  onClose,
  onConfirm,
}: {
  folder: Folder;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return createPortal(
    <Modal
      title={t('deleteFolder')}
      isOpen
      onClose={() => {
        if (pending) return;
        onClose();
      }}
    >
      <form
        className="task-delete-form"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        <p>{t('deleteFolderConfirm', { name: folder.name })}</p>
        <ModalActions
          onCancel={() => {
            if (pending) return;
            onClose();
          }}
          submitLabel={t('delete')}
          pending={pending}
          pendingLabel={t('deleting')}
        />
      </form>
    </Modal>,
    document.body,
  );
}

function localeLabel(value: Locale): string {
  return value === 'ru' ? t('settingsLocaleRu') : t('settingsLocaleEn');
}

function LanguageSettings() {
  return (
    <section className="settings-panel">
      <SettingsPanelTitle hint={<p>{t('settingsLanguageHint')}</p>}>
        {t('settingsLanguage')}
      </SettingsPanelTitle>
      <div className="settings-row settings-row-stack">
        <div className="settings-row-text">
          <span className="settings-row-label">{t('settingsInterfaceLanguage')}</span>
        </div>
        <div className="settings-locale-toggles" role="radiogroup" aria-label={t('settingsInterfaceLanguage')}>
          {LOCALES.map((option) => {
            const active = locale === option.value;
            return (
              <div key={option.value} className="settings-locale-toggle-row">
                <span className="settings-locale-toggle-label">{localeLabel(option.value)}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={active}
                  aria-label={localeLabel(option.value)}
                  className={`settings-locale-switch${active ? ' is-on' : ''}`}
                  onClick={() => setLocale(option.value)}
                >
                  <span className="settings-locale-switch-knob" aria-hidden="true" />
                </button>
              </div>
            );
          })}
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

        <div className="settings-page-grid">
          <LanguageSettings />
          <TaskFoldersSettings />
          <FinanceSettings />
          <section className="settings-panel">
            <SettingsPanelTitle>{t('settingsChangeEmail')}</SettingsPanelTitle>
            <EmailForm />
          </section>
          <section className="settings-panel">
            <SettingsPanelTitle>{t('settingsChangePassword')}</SettingsPanelTitle>
            <PasswordForm />
          </section>
        </div>
      </div>
    </Layout>
  );
}
