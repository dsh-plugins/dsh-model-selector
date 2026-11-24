import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeEffortIndex, effortStops, isUltraActive, planEffortChange, planTeamChange } from '../src/client/effort.ts';

const reasoning = {
  efforts: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }, { id: 'ultra', name: 'Ultra' }],
  defaultEffort: 'high',
};
const low = { provider: 'provider', model: 'model', reasoningEffort: 'low' };
const teamOff = { available: true, enabled: false, requiresDisableConfirmation: false };
const teamUsed = { available: true, enabled: true, requiresDisableConfirmation: true };

test('供应商的 Ultra 与虚拟团队档位具有独立位置', () => {
  const stops = effortStops(reasoning, 'ultra', true);
  assert.deepEqual(stops.map((stop) => stop.kind), ['effort', 'effort', 'effort', 'ultra']);
  assert.deepEqual(stops[activeEffortIndex(stops, 'ultra', false)], { kind: 'effort', id: 'ultra' });
  assert.deepEqual(stops[activeEffortIndex(stops, 'ultra', true)], { kind: 'ultra' });
  const plan = planEffortChange({ current: low, reasoning, choice: { kind: 'effort', id: 'ultra' }, team: teamOff, confirmed: false });
  assert.deepEqual(plan, { kind: 'ready', steps: [{ kind: 'select', selection: { ...low, reasoningEffort: 'ultra' } }] });
});

test('Ultra 仅在团队可用且已开启、推理仍为模型默认时显示为当前档位', () => {
  assert.equal(isUltraActive(reasoning, 'low', teamUsed), false);
  assert.equal(isUltraActive(reasoning, reasoning.defaultEffort, teamOff), false);
  assert.equal(isUltraActive(reasoning, reasoning.defaultEffort, { ...teamUsed, available: false }), false);
  assert.equal(isUltraActive(reasoning, reasoning.defaultEffort, teamUsed), true);
  assert.equal(isUltraActive(undefined, undefined, teamUsed), true);
  const choice = { kind: 'effort', id: low.reasoningEffort } as const;
  assert.deepEqual(planEffortChange({ current: low, reasoning, choice, team: teamUsed, confirmed: true }), {
    kind: 'ready', steps: [{ kind: 'team', enabled: false }],
  });
});

test('进入虚拟团队档位前先选择目录公布的默认推理', () => {
  const choice = { kind: 'ultra' } as const;
  assert.deepEqual(planEffortChange({ current: low, reasoning, choice, team: teamOff, confirmed: false }), {
    kind: 'ready', steps: [
      { kind: 'select', selection: { ...low, reasoningEffort: 'high' } },
      { kind: 'team', enabled: true },
    ],
  });
  assert.deepEqual(planEffortChange({ current: { ...low, reasoningEffort: 'high' }, reasoning, choice, team: teamOff, confirmed: false }), {
    kind: 'ready', steps: [{ kind: 'team', enabled: true }],
  });
});

test('曾使用模型时，离开 Ultra 的普通档、重置和独立团队开关均先要求确认', () => {
  const choices = [{ kind: 'effort', id: 'high' }, { kind: 'default' }] as const;
  for (const choice of choices) {
    assert.deepEqual(planEffortChange({ current: low, reasoning, choice, team: teamUsed, confirmed: false }), { kind: 'confirm' });
    assert.deepEqual(planEffortChange({ current: low, reasoning, choice, team: teamUsed, confirmed: true }), {
      kind: 'ready', steps: [
        { kind: 'team', enabled: false },
        { kind: 'select', selection: { ...low, reasoningEffort: 'high' } },
      ],
    });
  }
  assert.deepEqual(planTeamChange(teamUsed, false, false), { kind: 'confirm' });
  assert.deepEqual(planTeamChange(teamUsed, false, true), { kind: 'ready', steps: [{ kind: 'team', enabled: false }] });
});

test('未声明默认档时清除显式推理；无等级模型只切换团队', () => {
  const noDefault = { efforts: reasoning.efforts };
  const current = { provider: low.provider, model: low.model };
  assert.deepEqual(effortStops(noDefault, undefined, true), effortStops(noDefault, 'low', true));
  assert.deepEqual(effortStops(noDefault, 'low', true)[0], { kind: 'default' });
  assert.deepEqual(planEffortChange({ current: low, reasoning: noDefault, choice: { kind: 'default' }, confirmed: false }), {
    kind: 'ready', steps: [{ kind: 'select', selection: current }],
  });
  assert.deepEqual(effortStops(undefined, undefined, false), []);
  assert.deepEqual(effortStops(undefined, undefined, true), [{ kind: 'default' }, { kind: 'ultra' }]);
  assert.deepEqual(planEffortChange({ current, reasoning: undefined, choice: { kind: 'ultra' }, team: teamOff, confirmed: false }), {
    kind: 'ready', steps: [{ kind: 'team', enabled: true }],
  });
  assert.deepEqual(planEffortChange({ current, reasoning: undefined, choice: { kind: 'default' }, team: teamUsed, confirmed: true }), {
    kind: 'ready', steps: [{ kind: 'team', enabled: false }],
  });
});

test('目录没有当前推理档位时保留一个中性的默认位置', () => {
  const stops = effortStops(reasoning, 'not-advertised', true);
  assert.deepEqual(stops[activeEffortIndex(stops, 'not-advertised', false)], { kind: 'default' });
  assert.deepEqual(stops[activeEffortIndex(stops, 'not-advertised', true)], { kind: 'ultra' });
});

test('团队不可写或档位已从目录消失时不产生写入计划', () => {
  const unavailable = { ...teamOff, available: false };
  assert.deepEqual(planEffortChange({ current: low, reasoning, choice: { kind: 'ultra' }, team: unavailable, confirmed: false }), { kind: 'unavailable' });
  assert.deepEqual(planEffortChange({ current: low, reasoning, choice: { kind: 'effort', id: 'removed' }, confirmed: false }), { kind: 'unavailable' });
});
