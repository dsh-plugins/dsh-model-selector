<div align="center">

<img src="icon.svg" width="80" height="80" alt="模型选择器图标">

# DSH Model Selector

**替换 DeepSeek Harness 输入框右下角的模型选择器，在四种样式之间切换。**

[English](README.md) | 简体中文

</div>

## 功能

| 样式 | 模型选择 | 推理与团队 |
| --- | --- | --- |
| Normal | DSH 原版的展开菜单 | 原版推理等级与团队开关 |
| KimiCode | 按提供商分组的搜索与滚动列表 | 推理等级按钮组及团队开关 |
| Codex | 点击当前模型名称展开列表 | 拖动推理强度、恢复默认、Ultra |
| Gugle（默认） | 按提供商分组的搜索与滚动列表 | 拖动推理强度、恢复默认、Ultra |

打开 **插件 → 模型选择器**，展开详情页正文中的「模型选择器」配置卡片，在「样式」中选择并保存。样式切换不会变更当前会话的模型、推理等级或团队设置。停用插件后恢复原生选择器。插件和 `/model` 共用 DSH 的模型目录与会话状态。

**Ultra** 使用当前模型的默认推理强度并开启智能体团队协作。在 Codex 或 Gugle 中，选择普通档位或重置会关闭团队协作；会话已经使用模型时，关闭前会请求确认。宿主不提供团队协作时不显示 Ultra。

## 安装

要求 DSH `0.2.2` 或更新版本（兼容范围含 `0.2.2-rc.3` 起的候选版本），以及下列 dsh-loader 版本或兼容版本。使用非 `web` 配置档案时，替换命令中的 `web`。

```powershell
dsh plugin --profile web add '@dsh-plugin/dsh-loader@2.0.0-dev.45160670240'
pnpm install --frozen-lockfile
pnpm run build
pnpm pack
dsh plugin --profile web add ./dsh-plugin-dsh-model-selector-0.1.0.tgz
```

## 开发与检查

```powershell
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
pnpm test
npm pack --dry-run
```
