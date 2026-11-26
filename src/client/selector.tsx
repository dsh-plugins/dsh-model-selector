import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import type {
  ComposerModelGroup, ComposerModelOption, ComposerModelProps, ComposerModelSelection, ComposerModelSnapshot,
  ComposerTeamSnapshot,
} from '@dsh-plugin/dsh-loader/client';
import { activeEffortIndex, effortStops, isUltraActive, planEffortChange, planTeamChange } from './effort.js';
import type { EffortChoice, EffortPlan } from './effort.js';
import { effortLabel, selectorWords } from './words.js';
import type { SelectorWords } from './words.js';

type SelectorProps = ComposerModelProps & { style: 'kimicode' | 'codex' | 'gugle'; language: string };
type Command =
  | { kind: 'model'; selection: ComposerModelSelection }
  | { kind: 'effort'; selection: ComposerModelSelection; choice: EffortChoice }
  | { kind: 'team'; enabled: boolean };
type Feedback = {
  kind: 'modelFailed' | 'teamFailed' | 'loadFailed' | 'interrupted';
  detail?: string;
};

const NO_TEAM: ComposerTeamSnapshot = { available: false, enabled: false, requiresDisableConfirmation: false };
const NO_TEAM_STORE = { subscribe: () => () => {}, getSnapshot: () => NO_TEAM };

const ultraStars: readonly [x: number, y: number, core: number, amplitude: number, period: number, phase: number][] = [
  [16, 63, 0.75, 0.7, 4.9, 0.9],
  [23, 42, 0.6, 1.05, 6.4, 4.1],
  [31, 32, 0.55, 0.45, 5.3, 2.6],
  [39, 72, 0.75, 0.6, 7.3, 3.5],
  [46, 61, 0.8, 1.2, 5.7, 0.4],
  [53, 29, 0.55, 0.85, 7.9, 5.6],
  [62, 58, 0.75, 0.5, 4.7, 1.7],
  [65, 35, 0.65, 0.95, 6.7, 5.1],
  [77, 59, 0.55, 0.4, 5.9, 3.1],
  [84, 43, 0.65, 1.1, 7.1, 6.5],
];

function sameModel(a: ComposerModelSelection | null, b: ComposerModelSelection): boolean {
  return a?.provider === b.provider && a.model === b.model;
}

function modelOption(snapshot: ComposerModelSnapshot, selection: ComposerModelSelection | null): ComposerModelOption | undefined {
  return snapshot.groups.find(({ id }) => id === selection?.provider)?.models.find(({ id }) => id === selection?.model);
}

function errorDetail(error: unknown): string | undefined {
  return error instanceof Error ? error.message : typeof error === 'string' ? error : undefined;
}

const paths = {
  chevron: 'm6 9 6 6 6-6',
  next: 'm9 6 6 6-6 6',
  check: 'm5 12 4 4L19 6',
  search: 'm16 16 4 4M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  reset: 'M4 5v6h6M4.9 10A8 8 0 1 1 5 17',
};

function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  );
}

function ModelList({ id, groups, current, disabled, loading, words, initialFocus, onSelect }: {
  id?: string;
  groups: readonly ComposerModelGroup[];
  current: ComposerModelSelection | null;
  disabled: boolean;
  loading: boolean;
  words: SelectorWords;
  initialFocus?: boolean;
  onSelect: (selection: ComposerModelSelection, origin: string) => void;
}) {
  const [query, setQuery] = useState('');
  const list = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => {
    const filter = query.trim().toLowerCase();
    return groups.flatMap((group) => {
      const models = !filter || `${group.name} ${group.id}`.toLowerCase().includes(filter)
        ? group.models
        : group.models.filter((model) => `${model.name} ${model.id}`.toLowerCase().includes(filter));
      return models.length ? [{ ...group, models }] : [];
    });
  }, [groups, query]);

  function navigate(event: KeyboardEvent<HTMLElement>, fromSearch = false) {
    const { key } = event;
    if (fromSearch ? key !== 'ArrowDown' : !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) {
      return;
    }
    const options = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
    const at = options.findIndex((option) => option === event.target);
    const next = key === 'Home' || fromSearch ? 0 : key === 'End' ? options.length - 1
      : Math.max(0, Math.min(options.length - 1, at + (key === 'ArrowDown' ? 1 : -1)));
    if (options[next]) {
      event.preventDefault();
      options[next].focus();
    }
  }

  return (
    <div id={id} className="dms-list">
      <label className="dms-search">
        <Icon name="search" />
        <input type="search" value={query} onChange={(event) => { setQuery(event.currentTarget.value); }}
          onKeyDown={(event) => { navigate(event, true); }} autoComplete="off" aria-label={words.search}
          placeholder={words.search} data-dms-focus="search" data-dms-initial={initialFocus || undefined} />
      </label>
      <div className="dms-results" ref={list} onKeyDown={(event) => { navigate(event); }}>
        {filtered.map((group) => (
          <div className="dms-group" key={group.id} role="group" aria-label={group.name}>
            <div className="dms-group-label" aria-hidden="true">{group.name}</div>
            {group.models.map((model) => {
              const selection = { provider: group.id, model: model.id };
              const selected = sameModel(current, selection);
              const focus = JSON.stringify([group.id, model.id]);
              return (
                <button type="button" key={model.id} className="dms-option" aria-current={selected || undefined}
                  disabled={disabled} title={model.description || model.name} data-dms-focus={focus}
                  onClick={() => { onSelect(selection, focus); }}>
                  <span>{model.name}</span>{selected && <Icon name="check" />}
                </button>
              );
            })}
          </div>
        ))}
        {!filtered.length && <p className="dms-note" role="status">{
          loading ? words.loading : query.trim() ? words.noMatches : words.noModels
        }</p>}
      </div>
    </div>
  );
}

function Slider({ stops, active, reasoning, words, disabled, model, applyCurrent, teamEnabled, children, onChange, onReset }: {
  stops: readonly EffortChoice[];
  active: number;
  reasoning: ComposerModelOption['reasoning'];
  words: SelectorWords;
  disabled: boolean;
  model: string;
  applyCurrent: boolean;
  teamEnabled: boolean;
  children?: ReactNode;
  onChange: (choice: EffortChoice) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const gesture = useRef<{ kind: 'pointer'; id: number } | { kind: 'keys'; keys: Set<string> } | null>(null);
  const shown = draft ?? active;
  const choice = stops[shown];
  const level = choice?.kind === 'effort' ? reasoning?.efforts.find(({ id }) => id === choice.id) : undefined;
  const label = choice?.kind === 'ultra' ? 'Ultra' : level ? effortLabel(words, level.id, level.name) : words.default;
  const valueText = choice?.kind === 'ultra' ? words.ultraDescription : label;
  const percent = stops.length > 1 ? shown / (stops.length - 1) * 100 : 0;
  const stopKey = JSON.stringify(stops);
  const ultraHint = choice?.kind !== 'ultra' && stops.some(stop => stop.kind === 'ultra') ? words.ultraDescription : undefined;
  const resetLabel = teamEnabled ? words.resetAndDisable : words.reset;

  useLayoutEffect(() => {
    if (gesture.current) {
      gesture.current = null;
      setDraft(null);
    }
  }, [active, disabled, stopKey]);

  function cancel() {
    gesture.current = null;
    setDraft(null);
  }

  function commit(value: number, explicit = false) {
    cancel();
    const next = stops[value];
    if (!disabled && (value !== active || (explicit && applyCurrent)) && next) {
      onChange(next);
    }
  }

  return (
    <div className="dms-slider" data-ultra={choice?.kind === 'ultra' || undefined}>
      {stops.length > 0 && (
        <div className="dms-slider-heading">
          <span className="dms-slider-value" title={choice?.kind === 'ultra' ? words.ultraDescription : level?.description}>{label}</span>
          <button type="button" className="dms-icon-button" data-dms-focus="reset" title={resetLabel}
            aria-label={resetLabel} disabled={disabled} onClick={onReset}><Icon name="reset" /></button>
        </div>
      )}
      {children ?? <div className="dms-slider-model"><span>{model}</span></div>}
      {stops.length > 0 && (
        <div className="dms-rail" style={{ '--dms-progress': `${percent}%` } as CSSProperties}>
          <div className="dms-track" aria-hidden="true">
            <div className="dms-track-fill" />
            {choice?.kind === 'ultra' ? ultraStars.map(([x, y, core, amplitude, period, phase]) => (
              <span className="dms-ultra-star" key={x} style={{
                left: `${x}%`, top: `${y}%`,
                '--dms-star-core': `${core}px`, '--dms-star-amplitude': `${amplitude}px`,
                '--dms-star-period': `${period}s`, '--dms-star-phase': `-${phase}s`,
              } as CSSProperties} />
            )) : (
              <div className="dms-ticks">
                {stops.map((stop) => <span key={stop.kind === 'effort' ? `effort:${stop.id}` : stop.kind} />)}
              </div>
            )}
          </div>
          <input type="range" min={0} max={Math.max(1, stops.length - 1)} step={1} value={shown}
            disabled={disabled || stops.length < 2} aria-label={words.effort} aria-valuetext={valueText}
            aria-description={ultraHint} data-dms-focus="slider" data-dms-initial
            onChange={(event) => {
              const value = event.currentTarget.valueAsNumber;
              if (gesture.current) {
                setDraft(value);
              } else {
                commit(value);
              }
            }}
            onPointerDown={(event) => {
              if (event.isPrimary && event.button === 0) {
                gesture.current = { kind: 'pointer', id: event.pointerId };
                event.currentTarget.setPointerCapture(event.pointerId);
              }
            }}
            onPointerUp={(event) => {
              if (gesture.current?.kind === 'pointer' && gesture.current.id === event.pointerId) {
                commit(event.currentTarget.valueAsNumber, true);
              }
            }}
            onPointerCancel={(event) => {
              if (gesture.current?.kind === 'pointer' && gesture.current.id === event.pointerId) {
                cancel();
              }
            }}
            onLostPointerCapture={(event) => {
              if (gesture.current?.kind === 'pointer' && gesture.current.id === event.pointerId) {
                cancel();
              }
            }}
            onKeyDown={(event) => {
              if (applyCurrent && !event.repeat && !gesture.current && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                commit(event.currentTarget.valueAsNumber, true);
                return;
              }
              if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)
                && gesture.current?.kind !== 'pointer') {
                const keys = gesture.current?.keys ?? new Set<string>();
                keys.add(event.key);
                gesture.current = { kind: 'keys', keys };
              }
            }}
            onKeyUp={(event) => {
              const editing = gesture.current;
              if (editing?.kind === 'keys' && editing.keys.delete(event.key) && !editing.keys.size) {
                commit(event.currentTarget.valueAsNumber);
              }
            }}
            onBlur={(event) => {
              if (gesture.current?.kind === 'keys') {
                commit(event.currentTarget.valueAsNumber);
              }
            }} />
        </div>
      )}
    </div>
  );
}

function placePanel(panel: HTMLDivElement, trigger: HTMLButtonElement) {
  const view = window.visualViewport;
  const viewportWidth = view?.width ?? window.innerWidth;
  const viewportHeight = view?.height ?? window.innerHeight;
  const viewLeft = view?.offsetLeft ?? 0;
  const viewTop = view?.offsetTop ?? 0;
  const viewBottom = viewTop + viewportHeight;
  const inset = Math.min(120, Math.max(8, (viewportHeight - 240) / 2));
  const topBoundary = viewTop + inset;
  const bottomBoundary = viewBottom - inset;
  const maxHeight = Math.max(0, bottomBoundary - topBoundary);
  panel.style.maxWidth = `${Math.max(0, viewportWidth - 16)}px`;
  const width = panel.getBoundingClientRect().width;
  const anchor = trigger.getBoundingClientRect();
  const left = Math.max(viewLeft + 8, Math.min(anchor.right - width, viewLeft + viewportWidth - width - 8));
  const aboveEnd = Math.min(anchor.top - 6, viewBottom - 8);
  const belowStart = Math.max(anchor.bottom + 6, topBoundary);
  const above = aboveEnd - topBoundary;
  const below = bottomBoundary - belowStart;
  panel.style.left = `${left}px`;
  if (above >= Math.max(144, below)) {
    panel.style.bottom = `${window.innerHeight - aboveEnd}px`;
    panel.style.top = 'auto';
    panel.style.maxHeight = `${Math.min(above, maxHeight)}px`;
  } else if (below >= 144) {
    panel.style.top = `${belowStart}px`;
    panel.style.bottom = 'auto';
    panel.style.maxHeight = `${below}px`;
  } else {
    panel.style.bottom = `${window.innerHeight - bottomBoundary}px`;
    panel.style.top = 'auto';
    panel.style.maxHeight = `${maxHeight}px`;
  }
}

/** 渲染自定义的输入区模型选择器，实际会话状态来自宿主快照。 */
export function ModelSelector(props: SelectorProps) {
  return <SessionSelector key={JSON.stringify([props.sessionId, props.style])} {...props} />;
}

function SessionSelector(props: SelectorProps) {
  const { available, locked, directory, style, language } = props;
  const teamStore = props.team?.state ?? NO_TEAM_STORE;
  const snapshot = useSyncExternalStore(
    useCallback((listener) => directory.subscribe(listener), [directory]),
    () => directory.getSnapshot(),
  );
  const team = useSyncExternalStore(
    useCallback((listener) => teamStore.subscribe(listener), [teamStore]),
    () => teamStore.getSnapshot(),
  );
  const words = selectorWords(language);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const mounted = useRef(false);
  const working = useRef(false);
  const reading = useRef(false);
  const initialLoad = useRef(false);
  const focusAfterOpen = useRef(false);
  const focusAfterRender = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState<{ command: Command; origin?: string } | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => { latest.current = props; });
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useLayoutEffect(() => {
    const popover = panel.current;
    const button = trigger.current;
    if (!popover || !button) {
      return;
    }
    popover.setAttribute('popover', 'auto');
    button.setAttribute('popovertarget', popover.id);
    const onToggle = () => {
      const visible = popover.matches(':popover-open');
      setOpen(visible);
      if (visible) {
        placePanel(popover, button);
      } else {
        focusAfterRender.current = null;
        setExpanded(false);
        setConfirming(null);
      }
    };
    popover.addEventListener('toggle', onToggle);
    return () => { popover.removeEventListener('toggle', onToggle); };
  }, []);

  useLayoutEffect(() => {
    const popover = panel.current;
    const button = trigger.current;
    if (!open || !popover || !button) {
      return;
    }
    const position = () => { placePanel(popover, button); };
    const repositionOnScroll = (event: Event) => {
      if (!(event.target instanceof Node) || !popover.contains(event.target)) {
        position();
      }
    };
    const resize = new ResizeObserver(position);
    position();
    resize.observe(button);
    const view = window.visualViewport;
    window.addEventListener('resize', position);
    window.addEventListener('scroll', repositionOnScroll, true);
    view?.addEventListener('resize', position);
    view?.addEventListener('scroll', position);
    return () => {
      resize.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', repositionOnScroll, true);
      view?.removeEventListener('resize', position);
      view?.removeEventListener('scroll', position);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !panel.current) {
      return;
    }
    const target = focusAfterRender.current;
    if (target) {
      const control = panel.current.querySelector<HTMLElement>(`[data-dms-focus="${CSS.escape(target)}"]:not(:disabled)`);
      if (control || (!saving && snapshot.status !== 'selecting')) {
        (control ?? trigger.current)?.focus();
        focusAfterRender.current = null;
      }
    } else if (focusAfterOpen.current) {
      panel.current.querySelector<HTMLElement>('[data-dms-initial]:not(:disabled)')?.focus();
    }
    focusAfterOpen.current = false;
  }, [open, expanded, confirming, saving, snapshot.status]);

  const loadModels = useCallback(async () => {
    if (reading.current || !latest.current.available) {
      return;
    }
    reading.current = true;
    setFeedback((previous) => previous?.kind === 'loadFailed' ? null : previous);
    try {
      await latest.current.load();
    } catch (error) {
      if (mounted.current) {
        setFeedback({ kind: 'loadFailed', detail: errorDetail(error) ?? '' });
      }
    } finally {
      reading.current = false;
    }
  }, []);

  useEffect(() => {
    if (open && available && snapshot.status === 'idle' && !initialLoad.current) {
      initialLoad.current = true;
      void loadModels();
    }
  }, [open, available, snapshot.status, loadModels]);

  async function applyCommand(command: Command, confirmed = false, origin?: string) {
    if (working.current || !mounted.current || !panel.current?.matches(':popover-open')) {
      return;
    }
    const currentProps = latest.current;
    const state = currentProps.directory.getSnapshot();
    const teamState = currentProps.team?.state.getSnapshot();
    if (!currentProps.available || currentProps.locked || state.status === 'selecting' || state.status === 'loading') {
      return;
    }

    let plan: EffortPlan;
    if (command.kind === 'team') {
      plan = planTeamChange(teamState, command.enabled, confirmed);
    } else if (command.kind === 'model') {
      if (sameModel(state.current, command.selection) || !modelOption(state, command.selection)) {
        return;
      }
      plan = { kind: 'ready', steps: [{ kind: 'select', selection: command.selection }] };
    } else {
      const current = state.current;
      if (!current || !sameModel(current, command.selection)) {
        setFeedback({ kind: 'interrupted' });
        return;
      }
      const option = modelOption(state, current);
      if (!option || state.routable === false) {
        setFeedback({ kind: 'interrupted' });
        return;
      }
      plan = planEffortChange({ current, reasoning: option.reasoning, choice: command.choice, confirmed,
        team: style === 'kimicode' ? undefined : teamState });
    }
    if (plan.kind === 'confirm') {
      focusAfterRender.current = 'cancel';
      setConfirming({ command, ...(origin ? { origin } : {}) });
      return;
    }
    if (plan.kind === 'unavailable') {
      setFeedback({ kind: 'interrupted' });
      return;
    }
    if (!plan.steps.length) {
      return;
    }

    working.current = true;
    setSaving(true);
    setFeedback(null);
    let failure: Feedback['kind'] = 'interrupted';
    try {
      for (const step of plan.steps) {
        if (!mounted.current) {
          return;
        }
        const active = latest.current;
        const activeState = active.directory.getSnapshot();
        if (!active.available || active.locked || (command.kind === 'effort' && !sameModel(activeState.current, command.selection))) {
          setFeedback({ kind: 'interrupted' });
          return;
        }
        if (step.kind === 'select') {
          failure = 'modelFailed';
          await active.select(step.selection);
        } else {
          failure = 'teamFailed';
          if (!active.team || !active.team.state.getSnapshot().available) {
            setFeedback({ kind: 'teamFailed' });
            return;
          }
          await active.team.setEnabled(step.enabled);
        }
      }
      if (mounted.current && command.kind === 'model' && style === 'codex') {
        focusAfterRender.current = 'models';
        setExpanded(false);
      }
    } catch (error) {
      if (mounted.current) {
        setFeedback({ kind: failure, detail: errorDetail(error) ?? '' });
      }
    } finally {
      working.current = false;
      if (mounted.current) {
        if (origin && panel.current?.matches(':popover-open') && document.activeElement === document.body) {
          focusAfterRender.current = origin;
        }
        setSaving(false);
      }
    }
  }

  function dismissConfirmation(accepted: boolean) {
    if (!confirming) {
      return;
    }
    focusAfterRender.current = confirming.origin ?? null;
    setConfirming(null);
    if (accepted) {
      void applyCommand(confirming.command, true, confirming.origin);
    }
  }

  function handleEscape(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape') {
      return;
    }
    event.stopPropagation();
    if (confirming || expanded) {
      event.preventDefault();
      if (confirming) {
        dismissConfirmation(false);
      } else {
        focusAfterRender.current = 'models';
        setExpanded(false);
      }
    }
  }

  const current = snapshot.current;
  const option = modelOption(snapshot, current);
  const model = option?.name ?? current?.model ?? words.noCurrent;
  const reasoning = option?.reasoning;
  const effective = current?.reasoningEffort ?? reasoning?.defaultEffort;
  const isKimi = style === 'kimicode';
  const isCodex = style === 'codex';
  const loading = snapshot.status === 'loading' || (available && snapshot.status === 'idle' && feedback?.kind !== 'loadFailed');
  const busy = saving || snapshot.status === 'selecting';
  const disabled = !available || locked || loading || busy;
  const hasCurrent = Boolean(option && snapshot.routable !== false);
  const ultraActive = !isKimi && hasCurrent && isUltraActive(reasoning, effective, team);
  const stops = !isKimi && hasCurrent ? effortStops(reasoning, effective, team.available) : [];
  const activeIndex = activeEffortIndex(stops, effective, ultraActive);
  const currentLevel = reasoning?.efforts.find(({ id: effort }) => effort === effective);
  const summaryEffort = ultraActive ? 'Ultra'
    : currentLevel ? effortLabel(words, currentLevel.id, currentLevel.name) : snapshot.retainedEffort ?? current?.reasoningEffort;
  const canRetry = available && !busy && !loading
    && (snapshot.failures.length > 0 || snapshot.status === 'error' || feedback?.kind === 'loadFailed');
  const error = feedback?.detail !== snapshot.error ? snapshot.error : null;
  const list = (listId?: string, initialFocus?: boolean) => (
    <ModelList {...(listId ? { id: listId } : {})} {...(initialFocus ? { initialFocus } : {})}
      groups={snapshot.groups} current={current} disabled={disabled} loading={loading} words={words}
      onSelect={(selection, origin) => { void applyCommand({ kind: 'model', selection }, false, origin); }} />
  );
  const setEffort = (choice: EffortChoice, origin: string) => {
    if (current) {
      void applyCommand({ kind: 'effort', selection: current, choice }, false, origin);
    }
  };

  return (
    <div className="dsh-model-selector" data-variant={style}>
      <button type="button" ref={trigger} className="dms-trigger" aria-controls={id}
        aria-expanded={open} aria-label={`${words.modelPicker}: ${model}${summaryEffort ? ` · ${summaryEffort}` : ''}`}
        title={model} onClick={(event) => { focusAfterOpen.current = !open && event.detail === 0; }}>
        <span className="dms-trigger-model">{model}</span>
        {summaryEffort && <span className="dms-trigger-effort" data-ultra={ultraActive || undefined}>{summaryEffort}</span>}
        <span className="dms-trigger-chevron"><Icon name="chevron" /></span>
      </button>
      <div id={id} ref={panel} className="dms-panel" role="group" aria-label={words.modelPicker}
        onKeyDown={handleEscape}>
        {open && (
          <>
            {(!available || locked) && <p className="dms-note">{locked ? words.locked : words.unavailable}</p>}
            {snapshot.routable === false && <p className="dms-note" role="status">{words.unroutable}</p>}
            {team.enabled && !team.available && <p className="dms-note">{words.teamUnavailable}</p>}
            {!isKimi && team.enabled && team.available && hasCurrent && !ultraActive && (
              <p className="dms-note">{words.teamWithCustomEffort}</p>
            )}
            {busy && <p className="dms-note" role="status">{words.saving}</p>}
            {feedback && <p className="dms-error" role="alert">{words[feedback.kind]}{feedback.detail ? ` ${feedback.detail}` : ''}</p>}
            {error && <p className="dms-error" role="alert">{error}</p>}
            {snapshot.failures.length > 0 && (
              <details className="dms-failures">
                <summary>{words.partial} ({snapshot.failures.length})</summary>
                <ul>{snapshot.failures.map(({ id: provider, name, message }) => <li key={provider}>{name}: {message}</li>)}</ul>
              </details>
            )}
            {canRetry && <button type="button" className="dms-action dms-retry" onClick={() => { void loadModels(); }}>{words.retry}</button>}
            {confirming ? (
              <div className="dms-confirm" role="alertdialog" aria-labelledby={`${id}-confirm`} aria-describedby={`${id}-explanation`}>
                <strong id={`${id}-confirm`}>{words.confirmTitle}</strong>
                <p id={`${id}-explanation`}>{words.confirmMessage}</p>
                <div className="dms-confirm-actions">
                  <button type="button" className="dms-action" data-dms-focus="cancel" onClick={() => { dismissConfirmation(false); }}>{words.cancel}</button>
                  <button type="button" className="dms-action dms-primary" disabled={disabled}
                    onClick={() => { dismissConfirmation(true); }}>{words.disableTeam}</button>
                </div>
              </div>
            ) : isKimi ? (
              <>
                {list(undefined, true)}
                {current && snapshot.routable !== false && !!reasoning?.efforts.length && (
                  <div className="dms-kimi-effort" role="group" aria-label={words.effort}>
                    <span>{words.effort}</span>
                    <div className="dms-segments">
                      {reasoning.efforts.map((effort) => (
                        <button type="button" key={effort.id} disabled={disabled} aria-pressed={effort.id === effective}
                          title={effort.description} data-dms-focus={`effort:${effort.id}`}
                          onClick={() => { setEffort({ kind: 'effort', id: effort.id }, `effort:${effort.id}`); }}>
                          {effortLabel(words, effort.id, effort.name)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {(team.available || team.enabled) && (
                  <button type="button" className="dms-team" role="switch" aria-checked={team.enabled}
                    disabled={disabled || !team.available} data-dms-focus="team"
                    onClick={() => { void applyCommand({ kind: 'team', enabled: !team.enabled }, false, 'team'); }}>
                    <span>{words.team}</span><span className="dms-switch" aria-hidden="true" />
                  </button>
                )}
              </>
            ) : (
              <>
                {!isCodex && list(undefined, true)}
                {isCodex && !expanded && loading && <p className="dms-note" role="status">{words.loading}</p>}
                <Slider key={JSON.stringify([current?.provider, current?.model])}
                  stops={stops} active={activeIndex} reasoning={reasoning} words={words} disabled={disabled || (team.enabled && !team.available)}
                  applyCurrent={team.enabled && !ultraActive} teamEnabled={team.enabled} model={model}
                  onChange={(choice) => { setEffort(choice, 'slider'); }} onReset={() => { setEffort({ kind: 'default' }, 'reset'); }}>
                  {isCodex && (
                    <>
                      <button type="button" className="dms-slider-model dms-codex-model" aria-label={`${words.modelPicker}: ${model}`}
                        aria-expanded={expanded} aria-controls={expanded ? `${id}-models` : undefined} data-dms-focus="models" data-dms-initial
                        onClick={(event) => {
                          if (!expanded && event.detail === 0) {
                            focusAfterRender.current = 'search';
                          }
                          setExpanded(!expanded);
                        }}>
                        <span>{model}</span><Icon name="next" />
                      </button>
                      {expanded && list(`${id}-models`)}
                    </>
                  )}
                </Slider>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
