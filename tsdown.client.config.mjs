import { fileURLToPath } from 'node:url';
import { compile } from 'sass';

const name = '@dsh-plugin/dsh-model-selector';
const stylesheet = fileURLToPath(new URL('./src/client/selector.scss', import.meta.url));
const sassModule = '\0model-selector-styles';
const external = ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@dsh-plugin/dsh-loader/client'];

export default {
  entry: { client: './src/client/index.tsx' },
  outDir: './lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  dts: false,
  clean: false,
  sourcemap: true,
  deps: { neverBundle: external, alwaysBundle: specifier => !external.includes(specifier) },
  plugins: [{
    name: 'model-selector-sass',
    resolveId(source) {
      return source === './selector.scss?inline' ? sassModule : null;
    },
    load(id) {
      if (id !== sassModule) {
        return null;
      }
      this.addWatchFile(stylesheet);
      // Sass 在压缩结果前加的 BOM 会被内联 style 当成首个选择器的一部分。
      return `export default ${JSON.stringify(compile(stylesheet, { style: 'compressed', charset: false }).css)};`;
    },
  }],
  outputOptions: {
    codeSplitting: false,
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(name)}, factory: (require) => {`,
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    footer: 'return module.exports; } });',
  },
};
