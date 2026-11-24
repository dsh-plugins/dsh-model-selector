import type { ComposerModelOption, ComposerModelSelection, ComposerTeamSnapshot } from '@dsh-plugin/dsh-loader/client';

/** 将目录中的真实档位与默认、团队两种操作分开，避免与供应商档位 ID 冲突。 */
export type EffortChoice =
  | { kind: 'effort'; id: string }
  | { kind: 'default' }
  | { kind: 'ultra' };

type Reasoning = ComposerModelOption['reasoning'];

export type EffortStep =
  | { kind: 'select'; selection: ComposerModelSelection }
  | { kind: 'team'; enabled: boolean };

export type EffortPlan =
  | { kind: 'ready'; steps: readonly EffortStep[] }
  | { kind: 'confirm' }
  | { kind: 'unavailable' };

export function effortStops(
  reasoning: Reasoning,
  effectiveEffort: string | undefined,
  includeUltra: boolean,
): EffortChoice[] {
  const efforts = reasoning?.efforts ?? [];
  const stops: EffortChoice[] = efforts.map(({ id }) => ({ kind: 'effort', id }));
  if ((stops.length || includeUltra) && (reasoning?.defaultEffort === undefined || !efforts.some(({ id }) => id === effectiveEffort))) {
    stops.unshift({ kind: 'default' });
  }
  if (includeUltra) {
    stops.push({ kind: 'ultra' });
  }
  return stops;
}

/** Ultra 仅在宿主同时保存了团队模式和模型默认推理时成立。 */
export function isUltraActive(
  reasoning: Reasoning,
  effectiveEffort: string | undefined,
  team: ComposerTeamSnapshot | undefined,
): boolean {
  return Boolean(team?.available && team.enabled
    && (!reasoning?.efforts.length || effectiveEffort === reasoning.defaultEffort));
}

export function activeEffortIndex(
  stops: readonly EffortChoice[],
  effectiveEffort: string | undefined,
  ultraActive: boolean,
): number {
  const active = stops.findIndex((stop) => ultraActive
    ? stop.kind === 'ultra'
    : stop.kind === 'effort' && stop.id === effectiveEffort);
  if (active >= 0) {
    return active;
  }
  return Math.max(0, stops.findIndex((stop) => stop.kind === 'default'));
}

/** 计算团队写入及关闭前的确认条件；取消时不产生任何写入。 */
export function planTeamChange(
  team: ComposerTeamSnapshot | undefined,
  enabled: boolean,
  confirmed: boolean,
): EffortPlan {
  if (team?.enabled === enabled || (!team && !enabled)) {
    return { kind: 'ready', steps: [] };
  }
  if (!team?.available) {
    return { kind: 'unavailable' };
  }
  if (!enabled && team.requiresDisableConfirmation && !confirmed) {
    return { kind: 'confirm' };
  }
  return { kind: 'ready', steps: [{ kind: 'team', enabled }] };
}

/** 先验证确认条件，再生成有序写入。每一步成功后保留宿主真实状态，不执行回滚。 */
export function planEffortChange({
  current, reasoning, choice, team, confirmed,
}: {
  current: ComposerModelSelection;
  reasoning: Reasoning;
  choice: EffortChoice;
  team?: ComposerTeamSnapshot | undefined;
  confirmed: boolean;
}): EffortPlan {
  if (choice.kind === 'effort' && !reasoning?.efforts.some(({ id }) => id === choice.id)) {
    return { kind: 'unavailable' };
  }
  const plan = planTeamChange(team, choice.kind === 'ultra', confirmed);
  if (plan.kind !== 'ready') {
    return plan;
  }
  const next = choice.kind === 'effort' ? choice.id : reasoning?.defaultEffort;
  if (!reasoning?.efforts.length || next === current.reasoningEffort) {
    return plan;
  }
  const { provider, model } = current;
  const selection = next === undefined ? { provider, model } : { provider, model, reasoningEffort: next };
  const select: EffortStep = { kind: 'select', selection };
  return { kind: 'ready', steps: choice.kind === 'ultra' ? [select, ...plan.steps] : [...plan.steps, select] };
}
