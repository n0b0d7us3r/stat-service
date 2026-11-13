import { useEffect, useState, type FormEvent } from 'react';
import { Checkbox } from '../components/Checkbox';
import { Layout } from '../components/Layout';
import { PageTitle } from '../components/PageTitle';
import { SortSelect } from '../components/SortSelect';
import { ApiError } from '../api/client';
import { changeEmail, changePassword } from '../api/auth';
import { getUserSettings, updateUserSettings } from '../api/settings';
import { clearRateOverride, getTodayRates, refreshTodayRates, setRateOverride } from '../api/finance';
import { APP_NAME } from '../config/app';
import { useAuth } from '../context/AuthContext';
import { locale, setLocale, t, type Locale } from '../i18n';
import type { TodayRates, UserSettings } from '../types';
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
      <h2 className="settings-panel-title">{t('settingsMarketRates')}</h2>
      <div className="settings-row-text">
        <span className="settings-row-hint">{t('settingsMarketRatesHint')}</span>
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
      <h2 className="settings-panel-title">{t('settingsCustomRates')}</h2>
      <form className="settings-rates settings-rates-embedded" onSubmit={handleSave}>
        <div className="settings-row-text">
          <span className="settings-row-hint">{t('settingsCustomRatesHint')}</span>
        </div>

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
                options={settings.enabledCurrencies.map((code) => ({ value: code, label: code }))}
                onChange={(value) => void handleCurrencyChange(value)}
              />
            </div>
            <div className="settings-row settings-row-stack">
              <div className="settings-row-text">
                <span className="settings-row-label">{t('settingsEnabledCurrencies')}</span>
                <span className="settings-row-hint">{t('settingsEnabledCurrenciesHint')}</span>
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
