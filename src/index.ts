import { defineConfig } from '@dsh-plugin/dsh-loader/config';
import type { CordisContext, HostAPI } from '@dsh-plugin/dsh-loader';
import { configId, defaultStyle, packageName, styles } from './shared.js';

export const name = packageName;
export const inject = ['dshLoader'];

const labels = { normal: 'Normal', kimicode: 'KimiCode', codex: 'Codex', gugle: 'Gugle' } as const;
const template = defineConfig({
  id: configId,
  packageName,
  title: '模型选择器',
  fields: [{
    type: 'select',
    key: 'style',
    label: '样式',
    description: '保存后立即更新输入框右下角的模型选择器。Normal 使用 DSH 原版。',
    required: true,
    default: defaultStyle,
    options: styles.map(value => ({ value, label: labels[value] })),
  }],
});

export async function apply(ctx: CordisContext & { dshLoader: HostAPI }): Promise<void> {
  await ctx.dshLoader.config.register(ctx, template);
}
