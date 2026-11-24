import { useSyncExternalStore } from 'react';
import { injectStyle, type ComposerModelOwner, type ComposerModelProps, type DshLoaderUi } from '@dsh-plugin/dsh-loader/client';
import { configId, isSelectorStyle, packageName, type SelectorStyle } from '../shared.js';
import { ModelSelector } from './selector.js';
import css from './selector.scss?inline';

export const name = packageName;
export const inject = ['dshLoaderUi', 'locale'];

interface Locale {
  subscribe(listener: () => void): () => void;
  getSnapshot(): { active: string };
}

interface ClientContext extends ComposerModelOwner {
  dshLoaderUi: DshLoaderUi;
  locale: Locale;
}

export function apply(ctx: ClientContext): void {
  const { configClient, composerModel } = ctx.dshLoaderUi;
  if (!configClient || !composerModel) {
    console.warn(`[${name}] dsh-loader 未提供选择器或配置接口，保留原生模型选择器。`);
    return;
  }
  const locale = ctx.locale;
  const readConfig = () => configClient.read(configId);
  ctx.effect(() => {
    let request = 0;
    let active = true;
    let selected: SelectorStyle = 'normal';
    let unmount: (() => void) | undefined;
    const removeCss = injectStyle(name, 'selector.css', css);
    const subscribeLocale = (listener: () => void) => locale.subscribe(listener);
    const getLanguage = () => locale.getSnapshot().active;

    function update(style: SelectorStyle): void {
      if (style === selected) {
        return;
      }
      unmount?.();
      unmount = undefined;
      selected = 'normal';
      if (style !== 'normal') {
        const Seat = (props: ComposerModelProps) => {
          const language = useSyncExternalStore(subscribeLocale, getLanguage, getLanguage);
          return <ModelSelector {...props} style={style} language={language} />;
        };
        unmount = composerModel.register(ctx, Seat);
        selected = style;
      }
    }

    async function refresh(): Promise<void> {
      const started = ++request;
      try {
        const view = await readConfig();
        if (!active || started !== request) {
          return;
        }
        const style = view.value.style;
        if (!isSelectorStyle(style)) {
          throw new Error('未读取到有效的选择器样式');
        }
        update(style);
      } catch (error) {
        if (active && started === request) {
          update('normal');
          console.warn(`[${name}] 无法加载模型选择器样式，保留原生模型选择器。`, error);
        }
      }
    }

    const unsubscribe = configClient.subscribe(refresh);
    void refresh();
    return () => {
      active = false;
      unsubscribe();
      unmount?.();
      removeCss();
    };
  });
}
