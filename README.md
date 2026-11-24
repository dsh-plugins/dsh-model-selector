<div align="center">

<img src="icon.svg" width="80" height="80" alt="Model Selector icon">

# DSH Model Selector

**Replace the model picker in the lower-right corner of the DeepSeek Harness composer with one of four layouts.**

English | [简体中文](README.zh_CN.md)

</div>

[![Build checks](https://github.com/dsh-plugins/dsh-model-selector/actions/workflows/check.yml/badge.svg)](https://github.com/dsh-plugins/dsh-model-selector/actions/workflows/check.yml)

## Features

| Style | Model selection | Reasoning and teams |
| --- | --- | --- |
| Normal | The original DSH dropdown | The original reasoning menu and team toggle |
| KimiCode | Searchable, scrollable list grouped by provider | Reasoning buttons and a team toggle |
| Codex | Click the current model to expand the list | Reasoning slider, reset, and Ultra |
| Gugle (default) | Searchable, scrollable list grouped by provider | Reasoning slider, reset, and Ultra |

Open **Plugins → Model Selector**, expand the **模型选择器** configuration card in the plugin detail page, choose a style, and save. Changing the style does not change the session's model, reasoning effort, or team setting. Disabling the plugin restores the original picker. Both the plugin and `/model` use DSH's model catalog and session state.

**Ultra** uses the current model's default reasoning effort and enables Agent Teams. In Codex and Gugle, its slider displays drifting blue-violet glows and white dots that move gently up and down. If the system requests reduced motion, the colors and dots stay static. Choosing a regular effort or resetting turns off Agent Teams; the picker asks for confirmation if the session has already used a model. Ultra is unavailable when the host does not support Agent Teams for that session.

![Gugle layout with a searchable model list and a reasoning slider](docs/gugle-layout.png)

*Gugle in dark mode with sample models and a regular reasoning level. The screenshot shows the layout only.*

## Installation

Requires DSH `0.2.2-rc.3` or later and [dsh-loader](https://github.com/dsh-plugins/dsh-loader). Browser-tested on DSH `0.2.2-rc.3` and `0.2.3-alpha.2`. To build the bundle from source, use Node.js `24.9.0` or later and pnpm `11.17.0`. Replace `web` if you use another DSH profile.

```powershell
git clone https://github.com/dsh-plugins/dsh-model-selector.git
cd dsh-model-selector
pnpm install --frozen-lockfile
pnpm run build
pnpm pack
dsh plugin --profile web add '@dsh-plugin/dsh-loader@2.0.0-dev.45160670240'
dsh plugin --profile web add ./dsh-plugin-dsh-model-selector-0.1.0.tgz
```

## Development and checks

```powershell
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
pnpm test
npm pack --dry-run
```
