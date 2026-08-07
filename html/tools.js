const INITIAL_HP = 20;
const STORAGE_KEY = "bbc-card-prototype-config-v1";
const DEFAULT_SETTINGS = {
  playerMaxHp: INITIAL_HP,
  enemyMaxHp: INITIAL_HP,
  playerDeckKeys: [],
  enemyDeckKeys: [],
};
const TYPE_LABELS = {
  charge: "充能",
  attack: "攻击",
  defend: "防御",
};
const KEYWORD_REGISTRY = window.BBC_KEYWORD_REGISTRY || [];
const KEYWORD_MAP = window.BBC_KEYWORD_MAP || {};

const BASE_CARD_LIBRARY = [
  { key: "charge", name: "充能", type: "charge", cost: 0, power: 0, keywords: [], description: "结算时获得 1 点能量。若同槽位被攻击，仍会受伤。" },
  { key: "insight-charge", name: "洞察充能", type: "charge", cost: 0, power: 0, keywords: ["insight"], description: "结算时获得 1 点能量。布置后立即揭示 1 张敌方暗牌。" },
  { key: "attack-1", name: "攻击 1", type: "attack", cost: 1, power: 1, keywords: [], description: "消耗 1 点能量，造成 1 点攻击伤害。" },
  { key: "attack-2", name: "攻击 2", type: "attack", cost: 2, power: 2, keywords: [], description: "消耗 2 点能量，造成 2 点攻击伤害。" },
  { key: "strong-attack-2", name: "强袭 2", type: "attack", cost: 2, power: 2, keywords: ["strong"], description: "消耗 2 点能量。若对位也是攻击，本次攻击强度 +1。" },
  { key: "attack-3", name: "攻击 3", type: "attack", cost: 3, power: 3, keywords: [], description: "消耗 3 点能量，造成 3 点攻击伤害。" },
  { key: "defend", name: "防御", type: "defend", cost: 0, power: 0, keywords: [], description: "若同槽位遭遇攻击，则完全免疫该次伤害。" },
  { key: "recycle-defend", name: "回收盾", type: "defend", cost: 0, power: 0, keywords: ["recycle"], description: "若同槽位对手不是攻击牌，结算后额外获得 1 点能量。" },
];

const dom = {
  statusBanner: document.querySelector("#status-banner"),
  playerMaxHpInput: document.querySelector("#player-max-hp-input"),
  enemyMaxHpInput: document.querySelector("#enemy-max-hp-input"),
  applySettingsButton: document.querySelector("#apply-settings-button"),
  deckSummary: document.querySelector("#deck-summary"),
  playerDeckEditor: document.querySelector("#player-deck-editor"),
  enemyDeckEditor: document.querySelector("#enemy-deck-editor"),
  saveDecksButton: document.querySelector("#save-decks-button"),
  resetDecksButton: document.querySelector("#reset-decks-button"),
  customCardNameInput: document.querySelector("#custom-card-name-input"),
  customCardTypeInput: document.querySelector("#custom-card-type-input"),
  customCardCostInput: document.querySelector("#custom-card-cost-input"),
  customCardPowerInput: document.querySelector("#custom-card-power-input"),
  customCardKeywordSelector: document.querySelector("#custom-card-keyword-selector"),
  customCardDescriptionInput: document.querySelector("#custom-card-description-input"),
  addCustomCardButton: document.querySelector("#add-custom-card-button"),
  clearCustomCardFormButton: document.querySelector("#clear-custom-card-form-button"),
  clearCustomCardsButton: document.querySelector("#clear-custom-cards-button"),
  customCardSummary: document.querySelector("#custom-card-summary"),
  customCardsJson: document.querySelector("#custom-cards-json"),
  exportCustomCardsButton: document.querySelector("#export-custom-cards-button"),
  importCustomCardsButton: document.querySelector("#import-custom-cards-button"),
  downloadCustomCardsButton: document.querySelector("#download-custom-cards-button"),
};

const persisted = loadPersistedConfig();
const state = {
  settings: persisted.settings,
  customCards: persisted.customCards,
};

dom.applySettingsButton.addEventListener("click", applyBattleSettings);
dom.saveDecksButton.addEventListener("click", saveDeckSettings);
dom.resetDecksButton.addEventListener("click", resetDeckSettings);
dom.addCustomCardButton.addEventListener("click", addCustomCardFromForm);
dom.clearCustomCardFormButton.addEventListener("click", () => clearCustomCardForm(true));
dom.clearCustomCardsButton.addEventListener("click", clearCustomCards);
dom.exportCustomCardsButton.addEventListener("click", exportConfigToTextarea);
dom.importCustomCardsButton.addEventListener("click", importConfigFromTextarea);
dom.downloadCustomCardsButton.addEventListener("click", downloadConfigJson);

render();
exportConfigToTextarea();

function render() {
  dom.playerMaxHpInput.value = String(state.settings.playerMaxHp);
  dom.enemyMaxHpInput.value = String(state.settings.enemyMaxHp);
  renderKeywordSelector();
  renderDeckEditors();
  renderDeckSummary();
  renderCustomCardSummary();
}

function setStatus(text, type = "info") {
  dom.statusBanner.textContent = text;
  dom.statusBanner.classList.remove("warning-text", "success-text");
  if (type === "warning") {
    dom.statusBanner.classList.add("warning-text");
  }
  if (type === "success") {
    dom.statusBanner.classList.add("success-text");
  }
}

function loadPersistedConfig() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        settings: normalizeSettings(DEFAULT_SETTINGS, BASE_CARD_LIBRARY),
        customCards: [],
      };
    }

    const parsed = JSON.parse(raw);
    const customCards = normalizeCustomCards(parsed.customCards);
    return {
      settings: normalizeSettings(parsed.settings, [...BASE_CARD_LIBRARY, ...customCards]),
      customCards,
    };
  } catch (error) {
    return {
      settings: normalizeSettings(DEFAULT_SETTINGS, BASE_CARD_LIBRARY),
      customCards: [],
    };
  }
}

function persistConfig() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    settings: state.settings,
    customCards: state.customCards,
  }));
}

function normalizeSettings(settings, availableCards = BASE_CARD_LIBRARY) {
  const playerMaxHp = clampInteger(settings?.playerMaxHp, 1, 999, DEFAULT_SETTINGS.playerMaxHp);
  const enemyMaxHp = clampInteger(settings?.enemyMaxHp, 1, 999, DEFAULT_SETTINGS.enemyMaxHp);
  const fallbackDeckKeys = getDefaultDeckKeys(availableCards);
  const playerDeckKeys = normalizeDeckKeys(settings?.playerDeckKeys, availableCards, fallbackDeckKeys);
  const enemyDeckKeys = normalizeDeckKeys(settings?.enemyDeckKeys, availableCards, fallbackDeckKeys);
  return { playerMaxHp, enemyMaxHp, playerDeckKeys, enemyDeckKeys };
}

function normalizeCustomCards(cards) {
  if (!Array.isArray(cards)) {
    return [];
  }

  return cards
    .map((card, index) => sanitizeCustomCard(card, index))
    .filter(Boolean);
}

function sanitizeCustomCard(rawCard, index = 0) {
  if (!rawCard || typeof rawCard !== "object") {
    return null;
  }

  const type = Object.keys(TYPE_LABELS).includes(rawCard.type) ? rawCard.type : null;
  if (!type) {
    return null;
  }

  const name = String(rawCard.name || "").trim();
  if (!name) {
    return null;
  }

  const cost = clampInteger(rawCard.cost, 0, 99, 0);
  const defaultPower = type === "attack" ? cost : 0;
  const power = clampInteger(rawCard.power, 0, 99, defaultPower);
  const keywords = normalizeKeywords(rawCard.keywords);
  const description = String(rawCard.description || "").trim() || buildDefaultDescription(type, cost, power, keywords);
  const keyBase = String(rawCard.key || slugify(name) || `custom-card-${index + 1}`).trim();
  const key = keyBase.startsWith("custom-") ? keyBase : `custom-${keyBase}`;

  return {
    key,
    name,
    type,
    cost,
    power,
    keywords,
    description,
    isCustom: true,
  };
}

function getDefaultDeckKeys(availableCards) {
  return availableCards.map((card) => card.key);
}

function normalizeDeckKeys(deckKeys, availableCards, fallbackDeckKeys) {
  const validKeys = new Set(availableCards.map((card) => card.key));
  const sourceKeys = Array.isArray(deckKeys) ? deckKeys : fallbackDeckKeys;
  const normalized = [...new Set(sourceKeys.map((key) => String(key)).filter((key) => validKeys.has(key)))];
  return normalized.length ? normalized : [...fallbackDeckKeys];
}

function getCardLibrary() {
  return [...BASE_CARD_LIBRARY, ...state.customCards];
}

function getCardTemplate(key) {
  return getCardLibrary().find((card) => card.key === key);
}

function getDeckLibrary(deckKeys) {
  const templates = deckKeys.map((key) => getCardTemplate(key)).filter(Boolean);
  return templates.length ? templates : getCardLibrary();
}

function renderDeckEditors() {
  renderDeckEditor(dom.playerDeckEditor, state.settings.playerDeckKeys, "player");
  renderDeckEditor(dom.enemyDeckEditor, state.settings.enemyDeckKeys, "enemy");
}

function renderDeckEditor(container, selectedKeys, side) {
  container.innerHTML = "";
  const selectedSet = new Set(selectedKeys);

  getCardLibrary().forEach((card) => {
    const label = document.createElement("label");
    label.className = "deck-option";
    label.innerHTML = `
      <input type="checkbox" value="${card.key}" ${selectedSet.has(card.key) ? "checked" : ""}>
      <span class="deck-option-copy">
        <strong>${card.name}${card.isCustom ? '<span class="card-badge">自定义</span>' : ""}</strong>
        <span class="deck-option-meta">${TYPE_LABELS[card.type]} · 消耗 ${card.cost}${card.power > 0 ? ` · 强度 ${card.power}` : ""}</span>
      </span>
    `;
    const checkbox = label.querySelector("input");
    checkbox.addEventListener("change", () => ensureDeckNotEmpty(container, side));
    container.appendChild(label);
  });
}

function ensureDeckNotEmpty(container, side) {
  const checked = container.querySelectorAll('input[type="checkbox"]:checked').length;
  if (checked > 0) {
    return;
  }

  const firstCheckbox = container.querySelector('input[type="checkbox"]');
  if (firstCheckbox) {
    firstCheckbox.checked = true;
    setStatus(`${side === "player" ? "玩家" : "敌方"}卡组至少要保留 1 张卡，已自动恢复第一张。`, "warning");
  }
}

function renderDeckSummary() {
  const playerDeck = getDeckLibrary(state.settings.playerDeckKeys);
  const enemyDeck = getDeckLibrary(state.settings.enemyDeckKeys);
  dom.deckSummary.innerHTML = `
    <p><strong>玩家卡组：</strong>${playerDeck.length} 张</p>
    <p><strong>敌方卡组：</strong>${enemyDeck.length} 张</p>
    <p><strong>玩家可出牌：</strong>${playerDeck.slice(0, 5).map((card) => card.name).join("、")}${playerDeck.length > 5 ? "..." : ""}</p>
    <p><strong>敌方可出牌：</strong>${enemyDeck.slice(0, 5).map((card) => card.name).join("、")}${enemyDeck.length > 5 ? "..." : ""}</p>
  `;
}

function renderKeywordSelector() {
  const selected = new Set(readSelectedKeywords());
  dom.customCardKeywordSelector.innerHTML = "";

  KEYWORD_REGISTRY.forEach((keyword) => {
    const label = document.createElement("label");
    label.className = "keyword-option";
    label.innerHTML = `
      <input type="checkbox" value="${keyword.key}" ${selected.has(keyword.key) ? "checked" : ""}>
      <span class="keyword-option-copy">
        <strong>${keyword.label}</strong>
        <span class="keyword-option-meta">键名：${keyword.key} · 时机：${keyword.timing} · 适用：${keyword.cardTypes.map((type) => TYPE_LABELS[type] || type).join(" / ")}</span>
        <span class="keyword-option-meta">${keyword.description}</span>
      </span>
    `;
    dom.customCardKeywordSelector.appendChild(label);
  });
}

function renderCustomCardSummary() {
  const count = state.customCards.length;
  if (!count) {
    dom.customCardSummary.innerHTML = `
      <p><strong>当前状态：</strong>还没有自定义卡牌。</p>
      <p>你在这个工具页里创建和导入的卡牌，会直接同步到战斗页。</p>
    `;
    return;
  }

  const supportedCount = state.customCards.filter((card) => card.keywords.some((keyword) => KEYWORD_MAP[keyword])).length;
  const latest = state.customCards.slice(-4).reverse().map((card) => `${card.name}（${TYPE_LABELS[card.type]}）`).join("、");
  dom.customCardSummary.innerHTML = `
    <p><strong>当前自定义牌数量：</strong>${count}</p>
    <p><strong>带已实现词条效果：</strong>${supportedCount}</p>
    <p><strong>最近加入：</strong>${latest}</p>
    <p><strong>可选词条枚举：</strong>${KEYWORD_REGISTRY.map((keyword) => keyword.label).join("、")}</p>
  `;
}

function applyBattleSettings() {
  state.settings = normalizeSettings({
    ...state.settings,
    playerMaxHp: dom.playerMaxHpInput.value,
    enemyMaxHp: dom.enemyMaxHpInput.value,
  }, getCardLibrary());
  persistConfig();
  render();
  exportConfigToTextarea();
  setStatus(`已保存生命上限：玩家 ${state.settings.playerMaxHp} / 敌方 ${state.settings.enemyMaxHp}。`, "success");
}

function saveDeckSettings() {
  state.settings = normalizeSettings({
    ...state.settings,
    playerDeckKeys: readCheckedDeckKeys(dom.playerDeckEditor),
    enemyDeckKeys: readCheckedDeckKeys(dom.enemyDeckEditor),
  }, getCardLibrary());
  persistConfig();
  render();
  exportConfigToTextarea();
  setStatus(`已保存双方角色卡组：玩家 ${state.settings.playerDeckKeys.length} 张 / 敌方 ${state.settings.enemyDeckKeys.length} 张。`, "success");
}

function resetDeckSettings() {
  const fallbackDeckKeys = getDefaultDeckKeys(getCardLibrary());
  state.settings = normalizeSettings({
    ...state.settings,
    playerDeckKeys: fallbackDeckKeys,
    enemyDeckKeys: fallbackDeckKeys,
  }, getCardLibrary());
  persistConfig();
  render();
  exportConfigToTextarea();
  setStatus("已将双方角色卡组重置为默认全卡组。", "success");
}

function addCustomCardFromForm() {
  const draft = {
    name: dom.customCardNameInput.value,
    type: dom.customCardTypeInput.value,
    cost: dom.customCardCostInput.value,
    power: dom.customCardPowerInput.value,
    keywords: readSelectedKeywords(),
    description: dom.customCardDescriptionInput.value,
  };

  const sanitized = sanitizeCustomCard(draft, state.customCards.length);
  if (!sanitized) {
    setStatus("自定义卡牌信息不完整，至少需要合法的名称和类型。", "warning");
    return;
  }

  const duplicateIndex = state.customCards.findIndex((card) => card.key === sanitized.key);
  if (duplicateIndex >= 0) {
    state.customCards.splice(duplicateIndex, 1, sanitized);
  } else {
    state.customCards.push(sanitized);
  }

  const nextLibrary = [...BASE_CARD_LIBRARY, ...state.customCards];
  state.settings = normalizeSettings({
    ...state.settings,
    playerDeckKeys: [...state.settings.playerDeckKeys, sanitized.key],
    enemyDeckKeys: [...state.settings.enemyDeckKeys, sanitized.key],
  }, nextLibrary);
  persistConfig();
  clearCustomCardForm(false);
  render();
  exportConfigToTextarea();
  setStatus(`已保存自定义卡牌【${sanitized.name}】。`, "success");
}

function clearCustomCardForm(shouldRender) {
  dom.customCardNameInput.value = "";
  dom.customCardTypeInput.value = "charge";
  dom.customCardCostInput.value = "0";
  dom.customCardPowerInput.value = "0";
  dom.customCardDescriptionInput.value = "";
  dom.customCardKeywordSelector.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.checked = false;
  });
  if (shouldRender) {
    render();
  }
}

function clearCustomCards() {
  state.customCards = [];
  state.settings = normalizeSettings(state.settings, BASE_CARD_LIBRARY);
  persistConfig();
  render();
  exportConfigToTextarea();
  setStatus("已清空自定义卡牌库。", "success");
}

function buildExportPayload() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: state.settings,
    customCards: state.customCards,
  };
}

function exportConfigToTextarea() {
  dom.customCardsJson.value = JSON.stringify(buildExportPayload(), null, 2);
}

function importConfigFromTextarea() {
  const raw = dom.customCardsJson.value.trim();
  if (!raw) {
    setStatus("导入失败：JSON 文本为空。", "warning");
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    const payload = Array.isArray(parsed) ? { customCards: parsed } : parsed;
    const customCards = normalizeCustomCards(payload.customCards);
    const settings = normalizeSettings(payload.settings, [...BASE_CARD_LIBRARY, ...customCards]);
    state.customCards = customCards;
    state.settings = settings;
    persistConfig();
    render();
    exportConfigToTextarea();
    setStatus(`已从 JSON 导入 ${customCards.length} 张自定义卡牌，并同步设置。`, "success");
  } catch (error) {
    setStatus("导入失败：JSON 格式不正确。", "warning");
  }
}

function downloadConfigJson() {
  exportConfigToTextarea();
  const blob = new Blob([dom.customCardsJson.value], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `bbc-prototype-tools-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus("已下载当前 DIY 工具配置 JSON。", "success");
}

function readCheckedDeckKeys(container) {
  return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value);
}

function readSelectedKeywords() {
  return Array.from(dom.customCardKeywordSelector.querySelectorAll('input[type="checkbox"]:checked'))
    .map((input) => input.value);
}

function normalizeKeywords(input) {
  const validKeys = new Set(KEYWORD_REGISTRY.map((keyword) => keyword.key));

  if (Array.isArray(input)) {
    return [...new Set(
      input
        .map((item) => String(item).trim().toLowerCase())
        .filter((item) => validKeys.has(item)),
    )];
  }

  if (typeof input === "string") {
    return [...new Set(
      input
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter((item) => validKeys.has(item)),
    )];
  }

  return [];
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildDefaultDescription(type, cost, power, keywords) {
  const typeLabel = TYPE_LABELS[type];
  const powerCopy = type === "attack" ? `，强度 ${power}` : "";
  const keywordCopy = keywords.length
    ? `，词条 ${keywords.map((keyword) => KEYWORD_MAP[keyword]?.label || keyword).join("/")}`
    : "";
  return `自定义${typeLabel}牌，消耗 ${cost}${powerCopy}${keywordCopy}`.replace(/，$/, "");
}
