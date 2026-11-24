export const packageName = '@dsh-plugin/dsh-model-selector';
export const configId = 'dsh-model-selector';
export const styles = ['normal', 'kimicode', 'codex', 'gugle'] as const;
export const defaultStyle = 'gugle';
export type SelectorStyle = typeof styles[number];

export function isSelectorStyle(value: unknown): value is SelectorStyle {
  return styles.some(style => style === value);
}
