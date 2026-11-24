const zh = {
  modelPicker: '选择模型',
  noCurrent: '未选择模型',
  search: '搜索模型…',
  noModels: '没有可用模型',
  noMatches: '未找到匹配的模型',
  loading: '正在加载模型…',
  saving: '正在保存…',
  locked: '会话运行中，暂时无法更改模型或团队模式。',
  unavailable: '当前会话无法更改模型。',
  unroutable: '当前模型不可用，请选择其他模型。',
  partial: '部分供应商的模型无法加载',
  retry: '重试',
  effort: '推理强度',
  default: '默认',
  realUltra: '模型档位',
  ultraDescription: 'Ultra：默认推理 + 智能体团队协作',
  reset: '恢复默认推理',
  resetAndDisable: '恢复默认推理并关闭团队模式',
  team: '启用智能体团队协作',
  teamWithCustomEffort: '团队模式已开启。选择普通档位可关闭团队模式。',
  teamUnavailable: '团队模式已开启，当前无法更改团队设置。',
  confirmTitle: '关闭团队模式？',
  confirmMessage: '此会话已使用过模型。关闭团队模式后，不再继续使用团队协作。',
  cancel: '取消',
  disableTeam: '关闭团队模式',
  modelFailed: '未能更改模型或推理强度。',
  teamFailed: '未能更改团队模式。',
  loadFailed: '模型目录加载失败。',
  interrupted: '会话状态已改变，剩余更改未执行。',
};

export type SelectorWords = typeof zh;

const en: SelectorWords = {
  modelPicker: 'Choose model',
  noCurrent: 'No model selected',
  search: 'Search models…',
  noModels: 'No models available',
  noMatches: 'No matching models',
  loading: 'Loading models…',
  saving: 'Saving…',
  locked: 'The session is running. Model and team settings are locked.',
  unavailable: 'Models cannot be changed in this session.',
  unroutable: 'The current model is unavailable. Choose another model.',
  partial: 'Some providers could not load their models',
  retry: 'Retry',
  effort: 'Reasoning effort',
  default: 'Default',
  realUltra: 'model effort',
  ultraDescription: 'Ultra: default reasoning + Agent Teams',
  reset: 'Reset reasoning to default',
  resetAndDisable: 'Reset reasoning to default and turn off Agent Teams',
  team: 'Enable Agent Teams',
  teamWithCustomEffort: 'Team mode is on. Select a regular effort to turn it off.',
  teamUnavailable: 'Team mode is on, but team settings cannot be changed right now.',
  confirmTitle: 'Turn off team mode?',
  confirmMessage: 'This session has already used a model. Turning team mode off stops team collaboration.',
  cancel: 'Cancel',
  disableTeam: 'Turn off team mode',
  modelFailed: 'Could not change the model or reasoning effort.',
  teamFailed: 'Could not change team mode.',
  loadFailed: 'Could not load the model directory.',
  interrupted: 'The session changed. The remaining change was not applied.',
};

const effortZh: Readonly<Record<string, string>> = {
  none: '关闭', minimal: '极低', low: '低', medium: '中', high: '高', xhigh: '极高', max: '最高',
};

export function selectorWords(language: string): SelectorWords {
  return /^zh(?:[-_]|$)/i.test(language) ? zh : en;
}

export function effortLabel(words: SelectorWords, id: string, name = id): string {
  if (id.toLowerCase() === 'ultra' || name.toLowerCase() === 'ultra') {
    return `${name} (${words.realUltra})`;
  }
  return words === zh && name.toLowerCase() === id.toLowerCase() && Object.hasOwn(effortZh, id)
    ? effortZh[id] ?? name
    : name;
}
