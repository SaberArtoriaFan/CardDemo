const MAX_SLOTS = 6;
const INITIAL_HP = 20;
const STORAGE_KEY = "bbc-card-prototype-config-v1";
const DEFAULT_SETTINGS = {
  playerMaxHp: INITIAL_HP,
  enemyMaxHp: INITIAL_HP,
  playerDeckKeys: [],
  enemyDeckKeys: [],
};

const KEYWORD_REGISTRY = window.BBC_KEYWORD_REGISTRY || [];
const KEYWORD_MAP = window.BBC_KEYWORD_MAP || {};
const KEYWORD_EFFECT_HANDLERS = {
  strong: { phase: "attack-clash" },
  recycle: { phase: "post-resolve" },
  insight: { phase: "on-place" },
};

const BASE_CARD_LIBRARY = [
  {
    key: "charge",
    name: "充能",
    type: "charge",
    cost: 0,
    power: 0,
    keywords: [],
    description: "结算时获得 1 点能量。若对位被攻击，仍会正常受伤。",
  },
  {
    key: "insight-charge",
    name: "洞察充能",
    type: "charge",
    cost: 0,
    power: 0,
    keywords: ["insight"],
    description: "结算时获得 1 点能量。布置后立刻揭示 1 张敌方仍隐藏的牌。",
  },
  {
    key: "attack-1",
    name: "攻击 1",
    type: "attack",
    cost: 1,
    power: 1,
    keywords: [],
    description: "消耗 1 点能量，造成 1 点攻击伤害。",
  },
  {
    key: "attack-2",
    name: "攻击 2",
    type: "attack",
    cost: 2,
    power: 2,
    keywords: [],
    description: "消耗 2 点能量，造成 2 点攻击伤害。",
  },
  {
    key: "strong-attack-2",
    name: "强势 2",
    type: "attack",
    cost: 2,
    power: 2,
    keywords: ["strong"],
    description: "消耗 2 点能量。若对位也是攻击，则本次攻击强度 +1。",
  },
  {
    key: "attack-3",
    name: "攻击 3",
    type: "attack",
    cost: 3,
    power: 3,
    keywords: [],
    description: "消耗 3 点能量，造成 3 点攻击伤害。",
  },
  {
    key: "defend",
    name: "防御",
    type: "defend",
    cost: 0,
    power: 0,
    keywords: [],
    description: "若同位置遭遇攻击，则完全免疫这次伤害。",
  },
  {
    key: "recycle-defend",
    name: "回收盾",
    type: "defend",
    cost: 0,
    power: 0,
    keywords: ["recycle"],
    description: "若对位不是攻击牌，结算后额外获得 1 点能量。",
  },
];

const PHASE_LABELS = {
  planning: "操作中",
  ready: "待结算",
  resolving: "结算中",
  roundEnd: "等待下一回合",
  ended: "对局结束",
};

const TYPE_LABELS = {
  charge: "充能",
  attack: "攻击",
  defend: "防御",
};

const MODE_LABELS = {
  place: "插入放牌",
  reorder: "调整顺序",
  replace: "抽牌替换",
};

assertKeywordHandlers();

const persistedConfig = loadPersistedConfig();
const state = createGame({
  settings: persistedConfig.settings,
  customCards: persistedConfig.customCards,
});

const dom = {
  roundValue: document.querySelector("#round-value"),
  phaseValue: document.querySelector("#phase-value"),
  statusBanner: document.querySelector("#status-banner"),
  roundSummary: document.querySelector("#round-summary"),
  enemyHp: document.querySelector("#enemy-hp"),
  enemyEnergy: document.querySelector("#enemy-energy"),
  playerHp: document.querySelector("#player-hp"),
  playerEnergy: document.querySelector("#player-energy"),
  enemyBoard: document.querySelector("#enemy-board"),
  playerBoard: document.querySelector("#player-board"),
  cardList: document.querySelector("#card-list"),
  actionToolbar: document.querySelector("#action-toolbar"),
  actionHint: document.querySelector("#action-hint"),
  detailCopy: document.querySelector("#detail-copy"),
  selectionPrompt: document.querySelector("#selection-prompt"),
  logList: document.querySelector("#log-list"),
  resolveButton: document.querySelector("#resolve-button"),
  nextRoundButton: document.querySelector("#next-round-button"),
  resetRoundButton: document.querySelector("#reset-round-button"),
  restartButton: document.querySelector("#restart-button"),
};

dom.resolveButton.addEventListener("click", startResolution);
dom.nextRoundButton.addEventListener("click", proceedToNextRound);
dom.resetRoundButton.addEventListener("click", resetPlanningRound);
dom.restartButton.addEventListener("click", restartGame);
document.addEventListener("pointermove", handlePointerDragMove);
document.addEventListener("pointerup", handlePointerDragEnd);
document.addEventListener("pointercancel", handlePointerDragCancel);

render();

function createGame(options = {}) {
  const customCards = normalizeCustomCards(options.customCards);
  const settings = normalizeSettings(options.settings, [...BASE_CARD_LIBRARY, ...customCards]);
  const game = {
    round: 1,
    phase: "planning",
    winner: null,
    settings,
    customCards,
    statusText: "",
    turnMode: "place",
    selectedCardKey: null,
    selectedInsertIndex: null,
    selectedBoardIndex: null,
    selectedReorderSourceIndex: null,
    dragPayload: null,
    dragInsertIndex: null,
    dragReplaceIndex: null,
    pointerDrag: null,
    suppressClick: false,
    highlightedSlot: null,
    slotResults: createEmptySlotResults(),
    logs: [
      {
        type: "info",
        text: "对局开始。牌桌会跨回合保留，前 6 回合逐张插入，满 6 张后每回合只能换序或替换 1 张。",
      },
    ],
    enemyRevealed: [],
    roundSnapshot: null,
    player: createSide("player", settings.playerMaxHp),
    enemy: createSide("enemy", settings.enemyMaxHp),
  };

  game.roundSnapshot = captureRoundSnapshot(game);
  game.statusText = buildPlanningStatus(game);
  return game;
}

function createSide(id, maxHp) {
  return {
    id,
    hp: maxHp,
    maxHp,
    energy: 0,
    board: [],
  };
}

function createEmptySlotResults() {
  return Array.from({ length: MAX_SLOTS }, () => ({
    summary: "",
    playerTips: [],
    enemyTips: [],
  }));
}

function assertKeywordHandlers() {
  const missingHandlers = KEYWORD_REGISTRY
    .map((keyword) => keyword.key)
    .filter((key) => !KEYWORD_EFFECT_HANDLERS[key]);

  if (missingHandlers.length) {
    throw new Error(`Registered keyword missing effect handler: ${missingHandlers.join(", ")}`);
  }
}

function loadPersistedConfig() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        settings: { ...DEFAULT_SETTINGS },
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
      settings: { ...DEFAULT_SETTINGS },
      customCards: [],
    };
  }
}

function persistConfig() {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        settings: state.settings,
        customCards: state.customCards,
      }),
    );
  } catch (error) {
    appendLog("浏览器未能写入本地存储，本次设置只在当前页面有效。", "warning");
  }
}

function normalizeSettings(settings, availableCards = BASE_CARD_LIBRARY) {
  const playerMaxHp = clampInteger(settings?.playerMaxHp, 1, 999, DEFAULT_SETTINGS.playerMaxHp);
  const enemyMaxHp = clampInteger(settings?.enemyMaxHp, 1, 999, DEFAULT_SETTINGS.enemyMaxHp);
  const fallbackDeckKeys = getDefaultDeckKeys(availableCards);
  const playerDeckKeys = normalizeDeckKeys(settings?.playerDeckKeys, availableCards, fallbackDeckKeys);
  const enemyDeckKeys = normalizeDeckKeys(settings?.enemyDeckKeys, availableCards, fallbackDeckKeys);
  return { playerMaxHp, enemyMaxHp, playerDeckKeys, enemyDeckKeys };
}

function getDefaultDeckKeys(availableCards) {
  return availableCards.map((card) => card.key);
}

function normalizeDeckKeys(deckKeys, availableCards, fallbackDeckKeys) {
  const validKeys = new Set(availableCards.map((card) => card.key));
  const rawKeys = Array.isArray(deckKeys) ? deckKeys : fallbackDeckKeys;
  const normalized = [...new Set(rawKeys.map((key) => String(key)).filter((key) => validKeys.has(key)))];
  return normalized.length ? normalized : [...fallbackDeckKeys];
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

function normalizeKeywords(input) {
  const validKeys = new Set(KEYWORD_REGISTRY.map((keyword) => keyword.key));

  if (Array.isArray(input)) {
    return [...new Set(input.map((item) => String(item).trim().toLowerCase()).filter((item) => validKeys.has(item)))];
  }

  if (typeof input === "string") {
    return [
      ...new Set(
        input
          .split(",")
          .map((item) => item.trim().toLowerCase())
          .filter((item) => validKeys.has(item)),
      ),
    ];
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
  return `自定义${typeLabel}牌，消耗 ${cost}${powerCopy}${keywordCopy}`;
}

function getCardLibrary() {
  return [...BASE_CARD_LIBRARY, ...state.customCards];
}

function getCardTemplate(templateKey) {
  return getCardLibrary().find((item) => item.key === templateKey);
}

function getDeckLibrary(deckKeys) {
  const templates = deckKeys.map((key) => getCardTemplate(key)).filter(Boolean);
  return templates.length ? templates : getCardLibrary();
}

function getPlayerDeckLibrary() {
  return getDeckLibrary(state.settings.playerDeckKeys);
}

function getEnemyDeckLibrary() {
  return getDeckLibrary(state.settings.enemyDeckKeys);
}

function hasKeyword(card, keywordKey) {
  return Boolean(card?.keywords?.includes(keywordKey));
}

function createCard(templateKey, owner) {
  const template = getCardTemplate(templateKey);
  return {
    id: `${templateKey}-${owner}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    owner,
    ...template,
    keywords: [...template.keywords],
  };
}

function cloneBoard(board) {
  return board.map((card) => ({
    ...card,
    keywords: [...card.keywords],
  }));
}

function captureRoundSnapshot(sourceState = state) {
  return {
    playerBoard: cloneBoard(sourceState.player.board),
    enemyBoard: cloneBoard(sourceState.enemy.board),
    enemyRevealed: [...sourceState.enemyRevealed],
  };
}

function appendLog(text, type = "info") {
  state.logs.unshift({ type, text });
}

function restartGame() {
  const nextState = createGame({
    settings: state.settings,
    customCards: state.customCards,
  });

  Object.keys(state).forEach((key) => {
    delete state[key];
  });
  Object.assign(state, nextState);
  render();
}

function resetPlanningRound() {
  if (state.phase === "resolving" || state.phase === "roundEnd" || state.phase === "ended") {
    return;
  }

  state.player.board = cloneBoard(state.roundSnapshot.playerBoard);
  state.enemy.board = cloneBoard(state.roundSnapshot.enemyBoard);
  state.enemyRevealed = [...state.roundSnapshot.enemyRevealed];
  state.slotResults = createEmptySlotResults();
  clearSelections();
  clearDragState();
  state.phase = "planning";
  state.turnMode = state.player.board.length < MAX_SLOTS ? "place" : null;
  state.statusText = `已撤销本回合操作。${buildPlanningStatus()}`;
  appendLog("你重置了本回合操作，牌桌恢复到回合开始时的样子。", "info");
  render();
}

function clearSelections() {
  state.selectedCardKey = null;
  state.selectedInsertIndex = null;
  state.selectedBoardIndex = null;
  state.selectedReorderSourceIndex = null;
}

function clearDragState() {
  state.dragPayload = null;
  state.dragInsertIndex = null;
  state.dragReplaceIndex = null;
  state.pointerDrag = null;
}

function getCurrentTurnMode() {
  return state.player.board.length < MAX_SLOTS ? "place" : state.turnMode;
}

function setTurnMode(mode) {
  if (state.phase !== "planning" || state.player.board.length < MAX_SLOTS) {
    return;
  }

  state.turnMode = state.turnMode === mode ? null : mode;
  clearSelections();
  clearDragState();
  state.statusText = buildPlanningStatus();
  render();
}

function handleCardClick(cardKey) {
  if (state.suppressClick) {
    state.suppressClick = false;
    return;
  }

  if (state.phase !== "planning") {
    return;
  }

  const mode = getCurrentTurnMode();
  if (!mode) {
    state.statusText = "牌桌已满，请先选择本回合是“调整顺序”还是“抽牌替换”。";
    render();
    return;
  }

  if (mode === "reorder") {
    state.statusText = "当前是调整顺序模式，不需要从牌组里选卡。";
    render();
    return;
  }

  state.selectedCardKey = state.selectedCardKey === cardKey ? null : cardKey;
  state.statusText = buildPlanningStatus();
  tryCommitPlayerAction();
  render();
}

function handleCardDragStart(event, cardKey) {
  if (!canDragDeckCard()) {
    event.preventDefault();
    return;
  }

  state.dragPayload = {
    kind: "deck-card",
    cardKey,
  };
  state.dragInsertIndex = null;
  state.dragReplaceIndex = null;
  event.dataTransfer.effectAllowed = getCurrentTurnMode() === "replace" ? "copy" : "copyMove";
  event.dataTransfer.setData("text/plain", cardKey);
  refreshPlayerBoardPreview();
}

function handleDeckCardPointerDown(event, cardKey) {
  if (!canDragDeckCard() || event.button !== 0) {
    return;
  }

  state.pointerDrag = {
    payload: {
      kind: "deck-card",
      cardKey,
    },
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    active: false,
  };
}

function handleInsertPositionClick(insertIndex) {
  if (state.phase !== "planning") {
    return;
  }

  const mode = getCurrentTurnMode();
  if (mode === "replace") {
    state.statusText = "替换模式下请先选牌，再点场上要被替换的那张牌。";
    render();
    return;
  }

  if (mode === "reorder" && state.selectedReorderSourceIndex == null) {
    state.statusText = "先点一张场上牌作为要移动的目标，再点插入位。";
    render();
    return;
  }

  state.selectedInsertIndex = state.selectedInsertIndex === insertIndex ? null : insertIndex;
  state.statusText = buildPlanningStatus();
  tryCommitPlayerAction();
  render();
}

function handlePlayerBoardCardClick(cardIndex, event) {
  if (state.suppressClick) {
    state.suppressClick = false;
    return;
  }

  if (state.phase !== "planning") {
    return;
  }

  const mode = getCurrentTurnMode();
  if (!mode) {
    state.statusText = "牌桌已满，请先选择本回合模式。";
    render();
    return;
  }

  if (mode === "place") {
    if (state.selectedCardKey == null) {
      state.statusText = "先从牌组挑一张牌，再点击场上卡牌的左半边或右半边决定插入位置。";
      render();
      return;
    }

    state.selectedInsertIndex = getInsertIndexFromCardEvent(cardIndex, event);
    state.statusText = buildPlanningStatus();
    tryCommitPlayerAction();
    render();
    return;
  }

  if (mode === "reorder") {
    if (state.selectedReorderSourceIndex == null) {
      state.selectedReorderSourceIndex = cardIndex;
      state.selectedInsertIndex = null;
      state.statusText = "已选中要移动的场上牌。接下来点击目标卡牌的左半边或右半边决定插入位置。";
      render();
      return;
    }

    if (state.selectedReorderSourceIndex === cardIndex) {
      state.selectedReorderSourceIndex = null;
      state.selectedInsertIndex = null;
      state.statusText = buildPlanningStatus();
      render();
      return;
    }

    state.selectedInsertIndex = getInsertIndexFromCardEvent(cardIndex, event);
  } else if (mode === "replace") {
    state.selectedBoardIndex = state.selectedBoardIndex === cardIndex ? null : cardIndex;
  }

  state.statusText = buildPlanningStatus();
  tryCommitPlayerAction();
  render();
}

function handleEmptyPlayerBoardClick() {
  if (state.phase !== "planning") {
    return;
  }

  if (getCurrentTurnMode() !== "place" || state.selectedCardKey == null) {
    state.statusText = "先从牌组里选一张牌，再放到空牌桌上。";
    render();
    return;
  }

  state.selectedInsertIndex = 0;
  state.statusText = buildPlanningStatus();
  tryCommitPlayerAction();
  render();
}

function handleBoardCardDragStart(event, cardIndex) {
  if (!canDragBoardCard(cardIndex)) {
    event.preventDefault();
    return;
  }

  state.dragPayload = {
    kind: "board-card",
    boardIndex: cardIndex,
  };
  state.dragInsertIndex = null;
  state.dragReplaceIndex = null;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", String(cardIndex));
  refreshPlayerBoardPreview();
}

function handleBoardCardPointerDown(event, cardIndex) {
  if (!canDragBoardCard(cardIndex) || event.button !== 0) {
    return;
  }

  state.pointerDrag = {
    payload: {
      kind: "board-card",
      boardIndex: cardIndex,
    },
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    active: false,
  };
}

function handlePointerDragMove(event) {
  if (!state.pointerDrag) {
    return;
  }

  state.pointerDrag.lastX = event.clientX;
  state.pointerDrag.lastY = event.clientY;

  if (!state.pointerDrag.active) {
    const deltaX = Math.abs(event.clientX - state.pointerDrag.startX);
    const deltaY = Math.abs(event.clientY - state.pointerDrag.startY);
    if (deltaX < 8 && deltaY < 8) {
      return;
    }

    state.pointerDrag.active = true;
    state.dragPayload = { ...state.pointerDrag.payload };
    state.dragInsertIndex = null;
    state.dragReplaceIndex = null;
  }

  event.preventDefault();
  updatePointerDragPreview(event.clientX, event.clientY);
}

function handlePointerDragEnd(event) {
  if (!state.pointerDrag) {
    return;
  }

  const wasActive = state.pointerDrag.active;
  if (wasActive) {
    event.preventDefault();
    commitPointerDragDrop();
    state.suppressClick = true;
    window.setTimeout(() => {
      state.suppressClick = false;
    }, 0);
  }

  clearDragState();
  refreshPlayerBoardPreview();
}

function handlePointerDragCancel() {
  if (!state.pointerDrag) {
    return;
  }

  clearDragState();
  refreshPlayerBoardPreview();
}

function updatePointerDragPreview(clientX, clientY) {
  const mode = getCurrentTurnMode();

  if (!isPointOverPlayerBoard(clientX, clientY)) {
    const changed = state.dragInsertIndex != null || state.dragReplaceIndex != null;
    state.dragInsertIndex = null;
    state.dragReplaceIndex = null;
    if (changed) {
      refreshPlayerBoardPreview();
    }
    return;
  }

  let nextInsertIndex = state.dragInsertIndex;
  let nextReplaceIndex = state.dragReplaceIndex;

  if (mode === "place" && state.dragPayload?.kind === "deck-card") {
    nextInsertIndex = getHoveredInsertIndex(clientX);
    nextReplaceIndex = null;
  } else if (mode === "replace" && state.dragPayload?.kind === "deck-card") {
    nextInsertIndex = null;
    nextReplaceIndex = getHoveredBoardCardIndex(clientX, clientY);
  } else if (mode === "reorder" && state.dragPayload?.kind === "board-card") {
    nextInsertIndex = getHoveredInsertIndex(clientX);
    nextReplaceIndex = null;
  }

  if (nextInsertIndex === state.dragInsertIndex && nextReplaceIndex === state.dragReplaceIndex) {
    return;
  }

  state.dragInsertIndex = nextInsertIndex;
  state.dragReplaceIndex = nextReplaceIndex;
  refreshPlayerBoardPreview();
}

function commitPointerDragDrop() {
  const mode = getCurrentTurnMode();

  if (mode === "place" && state.dragPayload?.kind === "deck-card" && state.dragInsertIndex != null) {
    state.selectedCardKey = state.dragPayload.cardKey;
    state.selectedInsertIndex = state.dragInsertIndex;
    tryCommitPlayerAction();
    render();
    return;
  }

  if (mode === "replace" && state.dragPayload?.kind === "deck-card" && state.dragReplaceIndex != null) {
    state.selectedCardKey = state.dragPayload.cardKey;
    state.selectedBoardIndex = state.dragReplaceIndex;
    tryCommitPlayerAction();
    render();
    return;
  }

  if (mode === "reorder" && state.dragPayload?.kind === "board-card" && state.dragInsertIndex != null) {
    state.selectedReorderSourceIndex = state.dragPayload.boardIndex;
    state.selectedInsertIndex = state.dragInsertIndex;
    tryCommitPlayerAction();
    render();
  }
}

function handleBoardCardDragOver(event, cardIndex) {
  if (!canDropDeckCardOnBoardCard(cardIndex)) {
    return;
  }

  event.preventDefault();
  if (state.dragReplaceIndex !== cardIndex) {
    state.dragReplaceIndex = cardIndex;
    refreshPlayerBoardPreview();
  }
}

function handleBoardCardDrop(event, cardIndex) {
  if (!canDropDeckCardOnBoardCard(cardIndex)) {
    return;
  }

  event.preventDefault();
  state.selectedCardKey = state.dragPayload.cardKey;
  state.selectedBoardIndex = cardIndex;
  clearDragState();
  tryCommitPlayerAction();
  render();
}

function handlePlayerBoardDragOver(event) {
  if (!canDropOnBoardContainer()) {
    return;
  }

  event.preventDefault();
  const nextInsertIndex = getHoveredInsertIndex(event.clientX);
  if (nextInsertIndex == null || nextInsertIndex === state.dragInsertIndex) {
    return;
  }

  state.dragInsertIndex = nextInsertIndex;
  refreshPlayerBoardPreview();
}

function handlePlayerBoardDrop(event) {
  if (!canDropOnBoardContainer()) {
    return;
  }

  event.preventDefault();
  const insertIndex = state.dragInsertIndex ?? getHoveredInsertIndex(event.clientX);
  if (insertIndex == null) {
    return;
  }

  const mode = getCurrentTurnMode();
  if (mode === "place" && state.dragPayload?.kind === "deck-card") {
    state.selectedCardKey = state.dragPayload.cardKey;
    state.selectedInsertIndex = insertIndex;
    clearDragState();
    tryCommitPlayerAction();
    render();
    return;
  }

  if (mode === "reorder" && state.dragPayload?.kind === "board-card") {
    state.selectedReorderSourceIndex = state.dragPayload.boardIndex;
    state.selectedInsertIndex = insertIndex;
    clearDragState();
    tryCommitPlayerAction();
    render();
  }
}

function handleGlobalDragEnd() {
  if (!state.dragPayload && state.dragInsertIndex == null && state.dragReplaceIndex == null) {
    return;
  }

  clearDragState();
  refreshPlayerBoardPreview();
}

function canDragDeckCard() {
  const mode = getCurrentTurnMode();
  return state.phase === "planning" && Boolean(mode) && mode !== "reorder";
}

function canDragBoardCard(cardIndex) {
  return state.phase === "planning"
    && state.player.board.length >= MAX_SLOTS
    && getCurrentTurnMode() === "reorder"
    && cardIndex >= 0;
}

function canDropOnBoardContainer() {
  if (state.phase !== "planning") {
    return false;
  }

  const mode = getCurrentTurnMode();
  if (mode === "place") {
    return state.dragPayload?.kind === "deck-card";
  }

  if (mode === "reorder") {
    return state.dragPayload?.kind === "board-card";
  }

  return false;
}

function canDropDeckCardOnBoardCard(cardIndex) {
  return state.phase === "planning"
    && getCurrentTurnMode() === "replace"
    && state.dragPayload?.kind === "deck-card"
    && cardIndex >= 0;
}

function isPointOverPlayerBoard(clientX, clientY) {
  const rect = dom.playerBoard.getBoundingClientRect();
  const padding = 32;
  return clientX >= rect.left - padding
    && clientX <= rect.right + padding
    && clientY >= rect.top - padding
    && clientY <= rect.bottom + padding;
}

function getHoveredBoardCardIndex(clientX, clientY) {
  const hoveredElement = document.elementFromPoint(clientX, clientY);
  const boardCard = hoveredElement?.closest?.(".slot-card[data-board-index]");
  if (!boardCard) {
    return null;
  }

  return Number(boardCard.dataset.boardIndex);
}

function getInsertIndexFromCardEvent(cardIndex, event) {
  if (!event?.currentTarget) {
    return cardIndex + 1;
  }

  const rect = event.currentTarget.getBoundingClientRect();
  const insertAfter = event.clientX >= rect.left + rect.width / 2;
  return insertAfter ? cardIndex + 1 : cardIndex;
}

function getHoveredInsertIndex(clientX) {
  const boardCards = Array.from(dom.playerBoard.querySelectorAll(".slot-card[data-board-origin-index]"));
  const referenceCards = boardCards.filter((card) => {
    if (state.dragPayload?.kind !== "board-card") {
      return true;
    }

    return Number(card.dataset.boardOriginIndex) !== state.dragPayload.boardIndex;
  });

  if (!referenceCards.length) {
    return state.player.board.length === 0 ? 0 : null;
  }

  const firstRect = referenceCards[0].getBoundingClientRect();
  const lastRect = referenceCards[referenceCards.length - 1].getBoundingClientRect();
  const edgeSnap = 28;

  if (clientX <= firstRect.left + edgeSnap) {
    return Number(referenceCards[0].dataset.boardOriginIndex);
  }

  if (clientX >= lastRect.right - edgeSnap) {
    return state.player.board.length;
  }

  for (const card of referenceCards) {
    const boardIndex = Number(card.dataset.boardOriginIndex);
    const rect = card.getBoundingClientRect();
    if (clientX < rect.left + rect.width / 2) {
      return boardIndex;
    }
  }

  return state.player.board.length;
}

function applyDragVisuals() {
  const boardCards = dom.playerBoard.querySelectorAll(".slot-card[data-board-index]");
  boardCards.forEach((card) => {
    const boardIndex = Number(card.dataset.boardIndex);
    const isDragTarget = state.dragReplaceIndex === boardIndex;
    const isDragSource = state.dragPayload?.kind === "board-card" && state.dragPayload.boardIndex === boardIndex;
    card.classList.toggle("drag-hover", isDragTarget);
    card.classList.toggle("drag-source", isDragSource);
  });

  const cardOptions = dom.cardList.querySelectorAll(".card-option[data-card-key]");
  cardOptions.forEach((card) => {
    const isDragSource = state.dragPayload?.kind === "deck-card" && state.dragPayload.cardKey === card.dataset.cardKey;
    card.classList.toggle("drag-source", isDragSource);
  });

  dom.playerBoard.classList.toggle("drop-preview-active", state.dragInsertIndex != null || state.dragReplaceIndex != null);
}

function refreshPlayerBoardPreview() {
  renderBoard(dom.playerBoard, state.player.board, false);
  applyDragVisuals();
}

function createPreviewCardFromTemplate(cardKey) {
  const template = getCardTemplate(cardKey);
  if (!template) {
    return null;
  }

  return {
    ...template,
    id: `preview-${cardKey}`,
    owner: "player",
    keywords: [...template.keywords],
    isPreview: true,
  };
}

function buildBoardRenderItems(board, hideUnknown) {
  const baseItems = board.map((card, index) => ({
    card,
    originIndex: index,
    actualBoardIndex: index,
    previewKind: null,
    isGhost: false,
  }));

  if (hideUnknown || state.phase !== "planning" || !state.dragPayload) {
    return baseItems;
  }

  const mode = getCurrentTurnMode();

  if (mode === "place" && state.dragPayload.kind === "deck-card" && state.dragInsertIndex != null) {
    const previewCard = createPreviewCardFromTemplate(state.dragPayload.cardKey);
    if (!previewCard) {
      return baseItems;
    }

    const previewItems = insertAt(baseItems, state.dragInsertIndex, {
      card: previewCard,
      originIndex: null,
      actualBoardIndex: null,
      previewKind: "incoming",
      isGhost: true,
    });
    previewItems.forEach((item, previewIndex) => {
      item.previewPosition = previewIndex + 1;
    });
    return previewItems;
  }

  if (mode === "replace" && state.dragPayload.kind === "deck-card" && state.dragReplaceIndex != null) {
    const previewCard = createPreviewCardFromTemplate(state.dragPayload.cardKey);
    if (!previewCard) {
      return baseItems;
    }

    const previewItems = baseItems.map((item) => {
      if (item.actualBoardIndex !== state.dragReplaceIndex) {
        return item;
      }

      return {
        ...item,
        card: previewCard,
        previewKind: "replace",
        isGhost: true,
      };
    });
    previewItems.forEach((item, previewIndex) => {
      item.previewPosition = previewIndex + 1;
    });
    return previewItems;
  }

  if (mode === "reorder" && state.dragPayload.kind === "board-card" && state.dragInsertIndex != null) {
    const sourceIndex = state.dragPayload.boardIndex;
    const movedItem = baseItems[sourceIndex];
    if (!movedItem) {
      return baseItems;
    }

    const remainingItems = baseItems.filter((item) => item.actualBoardIndex !== sourceIndex);
    const adjustedInsertIndex = state.dragInsertIndex > sourceIndex ? state.dragInsertIndex - 1 : state.dragInsertIndex;
    const previewItems = [...remainingItems];
    previewItems.splice(adjustedInsertIndex, 0, {
      ...movedItem,
      previewKind: "moved",
    });
    previewItems.forEach((item, previewIndex) => {
      item.previewPosition = previewIndex + 1;
    });
    return previewItems;
  }

  baseItems.forEach((item, previewIndex) => {
    item.previewPosition = previewIndex + 1;
  });
  return baseItems;
}

function renderPreviewBadge(previewKind) {
  if (previewKind === "incoming") {
    return '<span class="preview-badge">松手后会插入这里</span>';
  }

  if (previewKind === "replace") {
    return '<span class="preview-badge">松手后会替换这里</span>';
  }

  if (previewKind === "moved") {
    return '<span class="preview-badge">松手后会移动到这里</span>';
  }

  return "";
}

function buildPreviewStatusCopy() {
  if (state.phase !== "planning" || !state.dragPayload) {
    return "";
  }

  const previewItems = buildBoardRenderItems(state.player.board, false);
  const previewNames = previewItems
    .map((item, index) => `${index + 1}.${item.card.name}`)
    .join("  >  ");

  if (state.dragPayload.kind === "deck-card" && state.dragInsertIndex != null) {
    return `松手后顺序预览：${previewNames}`;
  }

  if (state.dragPayload.kind === "deck-card" && state.dragReplaceIndex != null) {
    return `松手后替换预览：${previewNames}`;
  }

  if (state.dragPayload.kind === "board-card" && state.dragInsertIndex != null) {
    return `松手后移动预览：${previewNames}`;
  }

  return "拖到牌桌目标位置后，会在这里显示松手后的顺序预览。";
}

function tryCommitPlayerAction() {
  if (state.phase !== "planning") {
    return false;
  }

  const mode = getCurrentTurnMode();
  if (!mode) {
    return false;
  }

  if (mode === "place") {
    if (state.selectedCardKey == null || state.selectedInsertIndex == null) {
      return false;
    }

    commitRoundAction({
      mode: "place",
      cardKey: state.selectedCardKey,
      insertIndex: state.selectedInsertIndex,
    });
    return true;
  }

  if (mode === "reorder") {
    if (state.selectedReorderSourceIndex == null || state.selectedInsertIndex == null) {
      return false;
    }

    const finalIndex = getMovedFinalIndex(state.selectedReorderSourceIndex, state.selectedInsertIndex);
    if (finalIndex === state.selectedReorderSourceIndex) {
      state.statusText = "这次移动不会改变顺序，请换一个插入位。";
      return false;
    }

    commitRoundAction({
      mode: "reorder",
      sourceIndex: state.selectedReorderSourceIndex,
      insertIndex: state.selectedInsertIndex,
    });
    return true;
  }

  if (state.selectedCardKey == null || state.selectedBoardIndex == null) {
    return false;
  }

  commitRoundAction({
    mode: "replace",
    cardKey: state.selectedCardKey,
    targetIndex: state.selectedBoardIndex,
  });
  return true;
}

function commitRoundAction(playerAction) {
  const enemyAction = chooseEnemyTurnAction(playerAction);

  clearDragState();
  applyActionToSide("player", playerAction);
  applyActionToSide("enemy", enemyAction);

  logPlayerAction(playerAction);
  logEnemyAction(enemyAction);
  resolveOnPlaceEffects("player", playerAction);
  resolveOnPlaceEffects("enemy", enemyAction);

  state.turnMode = playerAction.mode;
  clearSelections();
  state.phase = "ready";
  state.statusText = `双方已完成第 ${state.round} 回合操作，可以开始结算当前整条链。`;
}

function applyActionToSide(sideKey, action) {
  const side = state[sideKey];

  if (action.mode === "place") {
    const placedCard = createCard(action.cardKey, sideKey);
    side.board = insertAt(side.board, action.insertIndex, placedCard);
    action.resolvedCard = placedCard;
    action.finalIndex = action.insertIndex;

    if (sideKey === "enemy") {
      state.enemyRevealed = insertAt(state.enemyRevealed, action.insertIndex, false);
    }
    return;
  }

  if (action.mode === "reorder") {
    const movingCard = side.board[action.sourceIndex];
    side.board = moveItem(side.board, action.sourceIndex, action.insertIndex);
    action.resolvedCard = movingCard;
    action.finalIndex = findCardIndexById(side.board, movingCard.id);

    if (sideKey === "enemy") {
      state.enemyRevealed = moveItem(state.enemyRevealed, action.sourceIndex, action.insertIndex);
    }
    return;
  }

  const replacedCard = side.board[action.targetIndex];
  const nextCard = createCard(action.cardKey, sideKey);
  side.board = replaceAt(side.board, action.targetIndex, nextCard);
  action.replacedCard = replacedCard;
  action.resolvedCard = nextCard;
  action.finalIndex = action.targetIndex;

  if (sideKey === "enemy") {
    const nextRevealed = [...state.enemyRevealed];
    nextRevealed[action.targetIndex] = false;
    state.enemyRevealed = nextRevealed;
  }
}

function insertAt(list, index, value) {
  const next = [...list];
  next.splice(index, 0, value);
  return next;
}

function replaceAt(list, index, value) {
  const next = [...list];
  next.splice(index, 1, value);
  return next;
}

function moveItem(list, fromIndex, toIndex) {
  const next = [...list];
  const [value] = next.splice(fromIndex, 1);
  const adjustedIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
  next.splice(adjustedIndex, 0, value);
  return next;
}

function findCardIndexById(board, cardId) {
  return board.findIndex((card) => card.id === cardId);
}

function getMovedFinalIndex(fromIndex, toIndex) {
  return toIndex > fromIndex ? toIndex - 1 : toIndex;
}

function logPlayerAction(action) {
  if (action.mode === "place") {
    appendLog(`你将【${action.resolvedCard.name}】插入到了第 ${action.finalIndex + 1} 位。`, "info");
    return;
  }

  if (action.mode === "reorder") {
    appendLog(
      `你把【${action.resolvedCard.name}】从第 ${action.sourceIndex + 1} 位移动到了第 ${action.finalIndex + 1} 位。`,
      "info",
    );
    return;
  }

  appendLog(
    `你用【${action.resolvedCard.name}】替换了第 ${action.targetIndex + 1} 位的【${action.replacedCard.name}】。`,
    "info",
  );
}

function logEnemyAction(action) {
  if (action.mode === "place") {
    appendLog(`敌方在第 ${action.finalIndex + 1} 位插入了一张暗牌。`, "info");
    return;
  }

  if (action.mode === "reorder") {
    appendLog(`敌方调整了一张已上场卡牌的位置，新的顺序已锁定到本回合结算。`, "info");
    return;
  }

  appendLog(`敌方替换了一张场上暗牌。`, "info");
}

function resolveOnPlaceEffects(sideId, action) {
  if (!action.resolvedCard || (action.mode !== "place" && action.mode !== "replace")) {
    return;
  }

  if (!hasKeyword(action.resolvedCard, "insight")) {
    return;
  }

  if (sideId === "player") {
    revealEnemyCard("你触发了洞察");
    return;
  }

  appendLog("敌方似乎通过【洞察】观察了你的布阵节奏。", "warning");
}

function chooseEnemyTurnAction(playerAction) {
  if (state.enemy.board.length < MAX_SLOTS) {
    return chooseEnemyPlaceAction(playerAction);
  }

  const tempoReorder = findEnemyTempoReorder();
  const wantsReplace = !tempoReorder || Math.random() < 0.48;

  if (wantsReplace) {
    return chooseEnemyReplaceAction(playerAction);
  }

  return tempoReorder;
}

function chooseEnemyPlaceAction(playerAction) {
  const board = state.enemy.board;
  const insertIndex = chooseEnemyInsertIndex(board.length, playerAction);
  const estimatedEnergy = estimateEnergyBeforeIndex(board, state.enemy.energy, insertIndex);
  const cardKey = chooseEnemyCard({
    estimatedEnergy,
    expectedPlayerType: inferPlayerActionType(playerAction),
  });

  return {
    mode: "place",
    insertIndex,
    cardKey,
  };
}

function chooseEnemyReplaceAction(playerAction) {
  const board = state.enemy.board;
  const targetIndex = chooseEnemyReplaceTarget(board);
  const estimatedEnergy = estimateEnergyBeforeIndex(board, state.enemy.energy, targetIndex);
  const cardKey = chooseEnemyCard({
    estimatedEnergy,
    expectedPlayerType: inferPlayerActionType(playerAction),
    replacingCard: board[targetIndex],
  });

  return {
    mode: "replace",
    targetIndex,
    cardKey,
  };
}

function chooseEnemyInsertIndex(boardLength, playerAction) {
  const options = Array.from({ length: boardLength + 1 }, (_, insertIndex) => {
    let weight = 1;

    if (state.enemy.energy <= 1 && insertIndex <= 1) {
      weight += 1.4;
    }

    if (playerAction.mode === "place" && playerAction.insertIndex === insertIndex) {
      weight += 2.2;
    }

    if (playerAction.mode === "reorder" && insertIndex === 0) {
      weight += 0.7;
    }

    if (insertIndex === boardLength) {
      weight += 0.4;
    }

    return { insertIndex, weight };
  });

  return weightedPick(options).insertIndex;
}

function findEnemyTempoReorder() {
  const board = state.enemy.board;

  for (let index = 1; index < board.length; index += 1) {
    const card = board[index];
    if (card.type === "charge") {
      const earlierAttack = board.slice(0, index).find((item) => item.type === "attack");
      if (earlierAttack) {
        return {
          mode: "reorder",
          sourceIndex: index,
          insertIndex: 0,
        };
      }
    }
  }

  for (let index = 0; index < board.length; index += 1) {
    const card = board[index];
    if (card.type !== "attack") {
      continue;
    }

    const projectedEnergy = estimateEnergyBeforeIndex(board, state.enemy.energy, index);
    if (projectedEnergy >= card.cost) {
      continue;
    }

    const laterChargeIndex = board.findIndex((item, laterIndex) => laterIndex > index && item.type === "charge");
    if (laterChargeIndex > index) {
      return {
        mode: "reorder",
        sourceIndex: laterChargeIndex,
        insertIndex: index,
      };
    }
  }

  return null;
}

function chooseEnemyReplaceTarget(board) {
  const scored = board.map((card, index) => {
    const projectedEnergy = estimateEnergyBeforeIndex(board, state.enemy.energy, index);
    let keepScore = 1.4;

    if (card.type === "charge") {
      keepScore = state.enemy.energy <= 2 ? 4.4 : 2.1;
    } else if (card.type === "attack") {
      keepScore = projectedEnergy >= card.cost ? 3.8 + card.power * 0.3 : 0.8 + card.power * 0.1;
      if (hasKeyword(card, "strong")) {
        keepScore += 0.5;
      }
    } else if (card.type === "defend") {
      keepScore = hasKeyword(card, "recycle") ? 2.6 : 1.9;
    }

    return { index, keepScore };
  });

  scored.sort((left, right) => left.keepScore - right.keepScore);
  return scored[0].index;
}

function inferPlayerActionType(action) {
  if (action.mode === "place" || action.mode === "replace") {
    return getCardTemplate(action.cardKey)?.type || null;
  }

  return state.player.board[action.sourceIndex]?.type || null;
}

function chooseEnemyCard(context) {
  const deck = getEnemyDeckLibrary();
  const options = deck
    .filter((card) => card.type !== "attack" || card.cost <= context.estimatedEnergy)
    .map((card) => {
      let weight = 1.1;

      if (card.type === "charge") {
        weight = context.estimatedEnergy <= 1 ? 4.2 : 1.3;
        if (hasKeyword(card, "insight")) {
          weight += 0.9;
        }
      } else if (card.type === "attack") {
        weight = 1.7 + card.power * 0.3;
        if (context.expectedPlayerType === "charge") {
          weight += 1.5;
        }
        if (context.expectedPlayerType === "attack") {
          weight += 0.9;
        }
        if (hasKeyword(card, "strong") && context.expectedPlayerType === "attack") {
          weight += 1.1;
        }
      } else if (card.type === "defend") {
        weight = context.expectedPlayerType === "attack" ? 3.6 : 1.2;
        if (hasKeyword(card, "recycle") && context.expectedPlayerType !== "attack") {
          weight += 1;
        }
      }

      if (context.replacingCard && context.replacingCard.key === card.key) {
        weight *= 0.45;
      }

      return { key: card.key, weight };
    });

  if (!options.length) {
    return deck[0].key;
  }

  return weightedPick(options).key;
}

function weightedPick(options) {
  const total = options.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * total;

  for (const item of options) {
    cursor -= item.weight;
    if (cursor <= 0) {
      return item;
    }
  }

  return options[options.length - 1];
}

function estimateEnergyBeforeIndex(board, startingEnergy, slotIndex) {
  let energy = startingEnergy;

  for (let index = 0; index < slotIndex; index += 1) {
    const card = board[index];
    if (!card) {
      continue;
    }

    if (card.type === "charge") {
      energy += 1;
      continue;
    }

    if (card.type === "attack" && energy >= card.cost) {
      energy -= card.cost;
      continue;
    }

    if (hasKeyword(card, "recycle")) {
      energy += 0.3;
    }
  }

  return Math.floor(energy);
}

function revealEnemyCard(message) {
  const candidates = [];

  state.enemy.board.forEach((card, index) => {
    if (card && !state.enemyRevealed[index]) {
      candidates.push(index);
    }
  });

  if (!candidates.length) {
    appendLog("洞察没有发现新的敌方暗牌。", "warning");
    return;
  }

  const revealedIndex = candidates[Math.floor(Math.random() * candidates.length)];
  state.enemyRevealed[revealedIndex] = true;
  appendLog(`${message}，第 ${revealedIndex + 1} 位是【${state.enemy.board[revealedIndex].name}】。`, "success");
}

function startResolution() {
  if (state.phase !== "ready") {
    state.statusText = "先完成本回合的那 1 次操作，再开始结算。";
    render();
    return;
  }

  state.phase = "resolving";
  clearDragState();
  state.highlightedSlot = null;
  state.slotResults = createEmptySlotResults();
  state.statusText = `开始结算第 ${state.round} 回合，当前会从第 1 位依次结算到第 ${state.player.board.length} 位。`;
  appendLog(`第 ${state.round} 回合开始结算。`, "info");

  for (let slotIndex = 0; slotIndex < MAX_SLOTS; slotIndex += 1) {
    const playerCard = state.player.board[slotIndex] || null;
    const enemyCard = state.enemy.board[slotIndex] || null;

    if (!playerCard && !enemyCard) {
      continue;
    }

    state.highlightedSlot = slotIndex;
    if (enemyCard) {
      state.enemyRevealed[slotIndex] = true;
    }

    state.slotResults[slotIndex] = resolveSlot(slotIndex, playerCard, enemyCard);

    if (state.player.hp <= 0 || state.enemy.hp <= 0) {
      break;
    }
  }

  state.highlightedSlot = null;

  if (state.player.hp <= 0 || state.enemy.hp <= 0) {
    finishBattle();
  } else {
    state.phase = "roundEnd";
    state.enemyRevealed = state.enemy.board.map(() => true);
    state.statusText = "本回合结算完成。牌桌顺序与结果提示会保留，确认后进入下一回合继续在这条链上操作。";
    appendLog(`第 ${state.round} 回合结算完成。你可以先观察整条结算链，再进入下一回合。`, "info");
  }

  render();
}

function resolveSlot(slotIndex, playerCard, enemyCard) {
  const slotResult = {
    summary: "",
    playerTips: [],
    enemyTips: [],
  };
  const playerLabel = playerCard ? playerCard.name : "空位";
  const enemyLabel = enemyCard ? enemyCard.name : "空位";

  appendLog(`第 ${slotIndex + 1} 位：你方【${playerLabel}】对上敌方【${enemyLabel}】。`, "info");

  const playerAttack = buildAttackState(playerCard, enemyCard, state.player.energy);
  const enemyAttack = buildAttackState(enemyCard, playerCard, state.enemy.energy);

  if (playerAttack.canAttack) {
    state.player.energy -= playerCard.cost;
    appendLog(`你消耗了 ${playerCard.cost} 点能量发动【${playerCard.name}】。`, "info");
    addTip(slotResult.playerTips, `消耗 ${playerCard.cost} 能量`, "info");
  } else if (playerCard?.type === "attack") {
    appendLog(`你的【${playerCard.name}】因能量不足未能发动。`, "warning");
    addTip(slotResult.playerTips, "能量不足，攻击落空", "warning");
  }

  if (enemyAttack.canAttack) {
    state.enemy.energy -= enemyCard.cost;
    appendLog(`敌方消耗了 ${enemyCard.cost} 点能量发动【${enemyCard.name}】。`, "info");
    addTip(slotResult.enemyTips, `消耗 ${enemyCard.cost} 能量`, "info");
  } else if (enemyCard?.type === "attack") {
    appendLog(`敌方的【${enemyCard.name}】因能量不足未能发动。`, "warning");
    addTip(slotResult.enemyTips, "能量不足，攻击落空", "warning");
  }

  let playerDamage = 0;
  let enemyDamage = 0;

  if (playerAttack.canAttack && enemyAttack.canAttack) {
    if (playerAttack.power > enemyAttack.power) {
      enemyDamage += playerAttack.power;
      appendLog(`对攻中你取得优势，敌方受到 ${playerAttack.power} 点伤害。`, "success");
      slotResult.summary = "你方在对攻中取胜";
      addTip(slotResult.playerTips, `对攻胜出 ${playerAttack.power}`, "success");
      addTip(slotResult.enemyTips, `对攻受伤 ${playerAttack.power}`, "warning");
    } else if (enemyAttack.power > playerAttack.power) {
      playerDamage += enemyAttack.power;
      appendLog(`对攻中敌方取得优势，你受到 ${enemyAttack.power} 点伤害。`, "warning");
      slotResult.summary = "敌方在对攻中取胜";
      addTip(slotResult.playerTips, `对攻受伤 ${enemyAttack.power}`, "warning");
      addTip(slotResult.enemyTips, `对攻胜出 ${enemyAttack.power}`, "success");
    } else {
      playerDamage += enemyAttack.power;
      enemyDamage += playerAttack.power;
      appendLog(`对攻平局，双方各受到 ${playerAttack.power} 点伤害。`, "warning");
      slotResult.summary = "对攻平局，双方互伤";
      addTip(slotResult.playerTips, `互伤 ${playerAttack.power}`, "warning");
      addTip(slotResult.enemyTips, `互伤 ${playerAttack.power}`, "warning");
    }
  } else {
    playerDamage += resolveSingleHit(enemyAttack, enemyCard, playerCard, "player", slotResult);
    enemyDamage += resolveSingleHit(playerAttack, playerCard, enemyCard, "enemy", slotResult);
  }

  if (playerDamage > 0) {
    state.player.hp = Math.max(0, state.player.hp - playerDamage);
  }

  if (enemyDamage > 0) {
    state.enemy.hp = Math.max(0, state.enemy.hp - enemyDamage);
  }

  applyPassiveEffects("player", playerCard, enemyCard, slotResult);
  applyPassiveEffects("enemy", enemyCard, playerCard, slotResult);

  if (!slotResult.summary) {
    slotResult.summary = buildSlotSummary(slotResult);
  }

  return slotResult;
}

function buildAttackState(card, opposingCard, availableEnergy) {
  if (!card || card.type !== "attack") {
    return {
      canAttack: false,
      power: 0,
    };
  }

  if (availableEnergy < card.cost) {
    return {
      canAttack: false,
      power: 0,
    };
  }

  let power = card.power;

  if (hasKeyword(card, "strong") && opposingCard?.type === "attack") {
    power += 1;
    appendLog(`【${card.name}】的强势词条生效，攻击强度提升到 ${power}。`, "success");
  }

  return {
    canAttack: true,
    power,
  };
}

function resolveSingleHit(attackState, attackerCard, defenderCard, damagedSideId, slotResult) {
  if (!attackState.canAttack) {
    return 0;
  }

  if (defenderCard?.type === "defend") {
    appendLog(`${damagedSideId === "player" ? "你方" : "敌方"}防御住了这次攻击。`, "success");
    if (damagedSideId === "player") {
      addTip(slotResult.playerTips, "防御住了这次攻击", "success");
      addTip(slotResult.enemyTips, "攻击被防住", "warning");
    } else {
      addTip(slotResult.enemyTips, "防御住了这次攻击", "success");
      addTip(slotResult.playerTips, "攻击被防住", "warning");
    }
    return 0;
  }

  appendLog(
    `${damagedSideId === "player" ? "你方" : "敌方"}被【${attackerCard.name}】命中，受到 ${attackState.power} 点伤害。`,
    damagedSideId === "player" ? "warning" : "success",
  );
  if (damagedSideId === "player") {
    addTip(slotResult.playerTips, `受到 ${attackState.power} 伤害`, "warning");
    addTip(slotResult.enemyTips, `命中 ${attackState.power} 伤害`, "success");
  } else {
    addTip(slotResult.enemyTips, `受到 ${attackState.power} 伤害`, "warning");
    addTip(slotResult.playerTips, `命中 ${attackState.power} 伤害`, "success");
  }
  return attackState.power;
}

function applyPassiveEffects(sideId, ownCard, opponentCard, slotResult) {
  if (!ownCard) {
    return;
  }

  const side = state[sideId];
  const tips = sideId === "player" ? slotResult.playerTips : slotResult.enemyTips;

  if (ownCard.type === "charge") {
    side.energy += 1;
    appendLog(`${sideId === "player" ? "你" : "敌方"}通过【${ownCard.name}】获得了 1 点能量。`, "success");
    addTip(tips, "获得 1 能量", "success");
  }

  if (hasKeyword(ownCard, "recycle") && (!opponentCard || opponentCard.type !== "attack")) {
    side.energy += 1;
    appendLog(`${sideId === "player" ? "你" : "敌方"}的【${ownCard.name}】触发回收，额外获得 1 点能量。`, "success");
    addTip(tips, "回收触发 +1 能量", "success");
  }
}

function finishBattle() {
  state.phase = "ended";
  state.enemyRevealed = state.enemy.board.map(() => true);

  if (state.player.hp <= 0 && state.enemy.hp <= 0) {
    state.winner = "draw";
    state.statusText = "双方同时倒下，这一局以平局结束。";
    appendLog("双方生命同时归零，本局平局。", "warning");
    return;
  }

  if (state.enemy.hp <= 0) {
    state.winner = "player";
    state.statusText = "敌方生命归零，你赢下了这局原型对战。";
    appendLog("敌方生命归零，你获得了胜利。", "success");
    return;
  }

  state.winner = "enemy";
  state.statusText = "你的生命值归零，本局失败。";
  appendLog("你的生命归零，本局失败。", "warning");
}

function proceedToNextRound() {
  if (state.phase !== "roundEnd") {
    return;
  }

  state.round += 1;
  state.phase = "planning";
  state.slotResults = createEmptySlotResults();
  clearDragState();
  state.highlightedSlot = null;
  state.turnMode = state.player.board.length < MAX_SLOTS ? "place" : null;
  clearSelections();
  state.roundSnapshot = captureRoundSnapshot();
  state.statusText = buildPlanningStatus();
  appendLog(`你确认进入第 ${state.round} 回合。牌桌顺序保持不变。`, "info");
  render();
}

function addTip(collection, text, type) {
  collection.push({ text, type });
}

function buildSlotSummary(slotResult) {
  const hasPlayerSuccess = slotResult.playerTips.some((tip) => tip.type === "success");
  const hasEnemySuccess = slotResult.enemyTips.some((tip) => tip.type === "success");
  const hasPlayerWarning = slotResult.playerTips.some((tip) => tip.type === "warning");
  const hasEnemyWarning = slotResult.enemyTips.some((tip) => tip.type === "warning");

  if ((hasPlayerSuccess || hasEnemyWarning) && !(hasEnemySuccess || hasPlayerWarning)) {
    return "这一对位由你方占优";
  }

  if ((hasEnemySuccess || hasPlayerWarning) && !(hasPlayerSuccess || hasEnemyWarning)) {
    return "这一对位由敌方占优";
  }

  return "这一对位平稳结算";
}

function render() {
  dom.roundValue.textContent = String(state.round);
  dom.phaseValue.textContent = PHASE_LABELS[state.phase];
  dom.statusBanner.textContent = state.statusText;
  dom.roundSummary.textContent = buildRoundSummary();
  dom.enemyHp.textContent = `${state.enemy.hp} / ${state.enemy.maxHp}`;
  dom.enemyEnergy.textContent = String(state.enemy.energy);
  dom.playerHp.textContent = `${state.player.hp} / ${state.player.maxHp}`;
  dom.playerEnergy.textContent = String(state.player.energy);
  dom.selectionPrompt.textContent = buildSelectionPrompt();
  dom.actionHint.textContent = buildActionHint();
  dom.resolveButton.disabled = state.phase !== "ready";
  dom.nextRoundButton.disabled = state.phase !== "roundEnd";
  dom.resetRoundButton.disabled = state.phase === "resolving" || state.phase === "roundEnd" || state.phase === "ended";

  renderActionToolbar();
  renderBoard(dom.playerBoard, state.player.board, false);
  renderBoard(dom.enemyBoard, state.enemy.board, true);
  renderCardList();
  renderDetails();
  renderLogs();
  applyDragVisuals();
}

function buildPlanningStatus(sourceState = state) {
  const boardLength = sourceState.player.board.length;
  const mode = boardLength < MAX_SLOTS ? "place" : sourceState.turnMode;

  if (boardLength < MAX_SLOTS) {
    return `本回合请放置 1 张牌。当前牌桌 ${boardLength}/${MAX_SLOTS}，可以插到前面、后面或中间。`;
  }

  if (!mode) {
    return "牌桌已满 6 张。本回合请选择“调整顺序”或“抽牌替换”中的一种。";
  }

  if (mode === "reorder") {
    return "已进入调整顺序模式：先点场上一张牌，再点目标卡牌的左半边或右半边，或直接拖动换位。";
  }

  return "已进入抽牌替换模式：先点牌组中的牌，再点场上要被替换的那张牌，或直接拖到目标卡面上。";
}

function buildRoundSummary() {
  const energyHint = `当前保留能量：你 ${state.player.energy} / 敌 ${state.enemy.energy}`;

  if (state.phase === "roundEnd") {
    return `第 ${state.round} 回合已结算完成。你可以先查看整条结算链，再确认进入下一回合。${energyHint}`;
  }

  if (state.phase === "ended") {
    return `本局已结束。最终保留能量：你 ${state.player.energy} / 敌 ${state.enemy.energy}`;
  }

  if (state.phase === "ready") {
    return `双方本回合都已做完 1 次操作。当前链长 ${state.player.board.length}/${MAX_SLOTS}，点击“开始结算”即可按顺序结算整条链。${energyHint}`;
  }

  if (state.player.board.length < MAX_SLOTS) {
    return `当前牌桌 ${state.player.board.length}/${MAX_SLOTS}。未满 6 张前，每回合双方各插入 1 张牌。${energyHint}`;
  }

  return `当前牌桌已满 6 张。之后每回合双方只能二选一：调整 1 张牌顺序，或抽 1 张牌替换场上 1 张。${energyHint}`;
}

function buildSelectionPrompt() {
  const mode = getCurrentTurnMode();
  const parts = [`模式：${mode ? MODE_LABELS[mode] : "待选择"}`];

  if (state.selectedCardKey) {
    parts.push(`手牌：${getCardTemplate(state.selectedCardKey)?.name || state.selectedCardKey}`);
  }

  if (state.selectedReorderSourceIndex != null) {
    parts.push(`移动源：第 ${state.selectedReorderSourceIndex + 1} 位`);
  }

  if (state.selectedBoardIndex != null) {
    parts.push(`替换位：第 ${state.selectedBoardIndex + 1} 位`);
  }

  if (state.selectedInsertIndex != null) {
    parts.push(`插入位：${describeInsertPosition(state.selectedInsertIndex, state.player.board.length)}`);
  }

  if (parts.length === 1 && state.phase === "ready") {
    parts.push("本回合操作已锁定");
  }

  return parts.join(" · ");
}

function buildActionHint() {
  const previewStatusCopy = buildPreviewStatusCopy();
  if (previewStatusCopy) {
    return previewStatusCopy;
  }

  if (state.phase === "ready") {
    return "双方本回合操作已经锁定，现在点击“开始结算”即可按当前顺序跑完整条牌链。";
  }

  if (state.phase === "roundEnd") {
    return "你现在看到的是本回合结算后的真实牌桌。确认进入下一回合后，会在这套顺序上继续操作。";
  }

  if (state.player.board.length < MAX_SLOTS) {
    return "前 6 张牌采用插入式布置：可以先点牌再点插入位，也可以直接把牌拖到牌桌上，系统会根据位置自动插入。";
  }

  if (!state.turnMode) {
    return "牌桌已满，请先在“调整顺序”和“抽牌替换”之间二选一。";
  }

  if (state.turnMode === "reorder") {
    return "调整顺序时，不会抽新牌。可以点击选择源牌和落点，也可以直接拖动场上牌改变位置。";
  }

  return "抽牌替换时，会保留场上总数 6 张。可以点选后替换，也可以把牌组中的牌直接拖到目标卡面上。";
}

function renderActionToolbar() {
  dom.actionToolbar.innerHTML = "";

  if (state.player.board.length < MAX_SLOTS) {
    const pill = document.createElement("span");
    pill.className = "action-pill active";
    pill.textContent = "本回合固定：插入放牌";
    dom.actionToolbar.appendChild(pill);
    return;
  }

  ["reorder", "replace"].forEach((mode) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `action-mode-button${state.turnMode === mode ? " active" : ""}`;
    button.textContent = MODE_LABELS[mode];
    button.disabled = state.phase !== "planning";
    button.addEventListener("click", () => setTurnMode(mode));
    dom.actionToolbar.appendChild(button);
  });
}

function renderBoard(container, board, hideUnknown) {
  container.innerHTML = "";
  const renderItems = buildBoardRenderItems(board, hideUnknown);

  if (!renderItems.length) {
    container.appendChild(createEmptyBoardCard(hideUnknown));
    return;
  }

  renderItems.forEach((item, renderIndex) => {
    container.appendChild(createCardElement(item.card, renderIndex, hideUnknown, item));
  });
}

function createDropIndicator() {
  const indicator = document.createElement("div");
  indicator.className = "drop-indicator";
  indicator.setAttribute("aria-hidden", "true");
  return indicator;
}

function createCardElement(card, index, hideUnknown, itemMeta = {}) {
  const isActive = state.highlightedSlot === index;
  const shouldHide = hideUnknown && !state.enemyRevealed[index] && state.phase !== "resolving" && state.phase !== "roundEnd" && state.phase !== "ended";
  const originIndex = itemMeta.originIndex ?? index;
  const actualBoardIndex = itemMeta.actualBoardIndex ?? index;
  const previewKind = itemMeta.previewKind || "";
  const previewPosition = itemMeta.previewPosition || index + 1;
  const interactionsBlockedByDrag = !hideUnknown && state.dragPayload != null;
  const isSelected = !hideUnknown && !itemMeta.isGhost && ((getCurrentTurnMode() === "reorder" && state.selectedReorderSourceIndex === actualBoardIndex) || (getCurrentTurnMode() === "replace" && state.selectedBoardIndex === actualBoardIndex));
  const canClickForPlace = !hideUnknown && state.phase === "planning" && getCurrentTurnMode() === "place";
  const canClickForReorder = !hideUnknown && state.phase === "planning" && getCurrentTurnMode() === "reorder";
  const canClickForReplace = !hideUnknown && state.phase === "planning" && getCurrentTurnMode() === "replace";
  const isClickable = !interactionsBlockedByDrag && !itemMeta.isGhost && (canClickForPlace || canClickForReorder || canClickForReplace);
  const cardElement = document.createElement(isClickable ? "button" : "div");

  if (isClickable) {
    cardElement.type = "button";
  }
  if (actualBoardIndex != null && !itemMeta.isGhost) {
    cardElement.dataset.boardIndex = String(actualBoardIndex);
    cardElement.dataset.boardOriginIndex = String(originIndex);
  }
  cardElement.className = `slot-card ${shouldHide ? "hidden-card" : card.type}${isActive ? " active-resolve" : ""}${isSelected ? " selected-board-card" : ""}${isClickable ? " clickable" : ""}${previewKind ? ` preview-${previewKind}` : ""}`;

  if (shouldHide) {
    cardElement.innerHTML = `
      <span class="slot-index">位置 ${index + 1}</span>
      <span class="slot-type">未知暗牌</span>
      <span class="slot-cost">类型隐藏</span>
      <span class="slot-keywords">等待洞察或结算揭示</span>
    `;
  } else {
    const slotResult = state.slotResults[index];
    cardElement.innerHTML = `
      <span class="slot-index">位置 ${index + 1}</span>
      <span class="slot-type">${card.name}</span>
      ${renderPreviewBadge(previewKind)}
      ${previewKind ? `<span class="preview-position">松手后会在第 ${previewPosition} 位</span>` : ""}
      <span class="slot-cost">类型：${TYPE_LABELS[card.type]} · 消耗：${card.cost}${card.power > 0 ? ` · 强度：${card.power}` : ""}</span>
      <span class="slot-keywords">${formatKeywords(card.keywords)}</span>
      ${renderSlotResultMarkup(slotResult, hideUnknown ? "enemyTips" : "playerTips")}
    `;
  }

  if (isClickable) {
    cardElement.addEventListener("click", (event) => handlePlayerBoardCardClick(actualBoardIndex, event));
  }

  if (!hideUnknown && canDragBoardCard(actualBoardIndex) && !itemMeta.isGhost) {
    cardElement.addEventListener("pointerdown", (event) => handleBoardCardPointerDown(event, actualBoardIndex));
  }

  if (!hideUnknown && canDropDeckCardOnBoardCard(actualBoardIndex) && !itemMeta.isGhost) {
    cardElement.addEventListener("dragover", (event) => handleBoardCardDragOver(event, actualBoardIndex));
    cardElement.addEventListener("drop", (event) => handleBoardCardDrop(event, actualBoardIndex));
  }

  return cardElement;
}

function createEmptyBoardCard(hideUnknown) {
  const isClickable = !hideUnknown && state.phase === "planning" && getCurrentTurnMode() === "place";
  const card = document.createElement(isClickable ? "button" : "div");
  card.className = `slot-card empty board-empty-card${isClickable ? " clickable" : ""}`;
  card.innerHTML = `
    <span class="slot-index">${hideUnknown ? "敌方牌桌" : "你的牌桌"}</span>
    <span class="slot-type">当前还没有卡牌</span>
    <span class="slot-empty">${hideUnknown ? "敌方也还未开始布置" : "选择或拖拽一张牌到这里开始布阵"}</span>
  `;
  if (isClickable) {
    card.type = "button";
    card.addEventListener("click", handleEmptyPlayerBoardClick);
  }
  return card;
}

function describeInsertPosition(insertIndex, boardLength) {
  if (boardLength === 0 || insertIndex === 0) {
    return "最前面";
  }

  if (insertIndex === boardLength) {
    return "末尾";
  }

  return `第 ${insertIndex + 1} 位前`;
}

function renderCardList() {
  dom.cardList.innerHTML = "";
  const mode = getCurrentTurnMode();
  const disableCardSelection = state.phase !== "planning" || !mode || mode === "reorder";

  getPlayerDeckLibrary().forEach((template) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("data-testid", `card-${template.key}`);
    button.dataset.cardKey = template.key;
    button.className = `card-option ${template.type}${state.selectedCardKey === template.key ? " selected" : ""}`;
    button.disabled = disableCardSelection;
    button.innerHTML = `
      <strong>${template.name}${template.isCustom ? '<span class="card-badge">自定义</span>' : ""}</strong>
      <span class="card-meta">类型：${TYPE_LABELS[template.type]} · 消耗：${template.cost}${template.power > 0 ? ` · 强度：${template.power}` : ""}</span>
      <span class="card-keywords">${formatKeywords(template.keywords)}</span>
      <span class="card-description">${template.description}</span>
    `;
    button.addEventListener("click", () => handleCardClick(template.key));
    if (!disableCardSelection) {
      button.addEventListener("pointerdown", (event) => handleDeckCardPointerDown(event, template.key));
    }
    dom.cardList.appendChild(button);
  });
}

function renderDetails() {
  const selectedCard = state.selectedCardKey ? getCardTemplate(state.selectedCardKey) : null;
  const selectedFieldCard =
    state.selectedBoardIndex != null
      ? state.player.board[state.selectedBoardIndex]
      : state.selectedReorderSourceIndex != null
        ? state.player.board[state.selectedReorderSourceIndex]
        : null;

  dom.detailCopy.innerHTML = `
    <p><strong>当前阶段：</strong>${PHASE_LABELS[state.phase]}</p>
    <p><strong>当前模式：</strong>${getCurrentTurnMode() ? MODE_LABELS[getCurrentTurnMode()] : "待选择"}</p>
    <p><strong>已选手牌：</strong>${selectedCard ? selectedCard.name : "未选中"}</p>
    <p><strong>已选场上牌：</strong>${selectedFieldCard ? selectedFieldCard.name : "未选中"}</p>
    <ul>
      <li>牌桌不会在每回合结束后清空，而是带着当前顺序进入下一回合继续演化。</li>
      <li>未满 6 张前，双方每回合各放 1 张牌，且可以插到前后或中间任意位置。</li>
      <li>满 6 张后，双方每回合只能执行 1 次操作：调整 1 张牌顺序，或抽 1 张牌替换场上 1 张。</li>
      <li>当前版本不再常驻显示可插入空位，拖动时才会出现细落点线；点击时则按卡面左右半区判断前插或后插。</li>
      <li>攻击牌在轮到自己结算时才检查能量，所以前面的充能会供给后面的攻击。</li>
      <li>结算后每张牌都会留下本次结果提示，例如防御住了、获得能量、受伤、对攻胜出等。</li>
    </ul>
  `;
}

function renderLogs() {
  dom.logList.innerHTML = "";

  state.logs.forEach((entry) => {
    const item = document.createElement("li");
    item.className = entry.type === "warning" ? "warning-text" : entry.type === "success" ? "success-text" : "";
    item.textContent = entry.text;
    dom.logList.appendChild(item);
  });
}

function formatKeywords(keywords) {
  if (!keywords.length) {
    return "词条：无";
  }

  const labels = keywords.map((keyword) => KEYWORD_MAP[keyword]?.label || keyword);
  return `词条：${labels.join(" / ")}`;
}

function renderSlotResultMarkup(slotResult, tipKey) {
  if (!slotResult || (state.phase !== "roundEnd" && state.phase !== "ended")) {
    return "";
  }

  const tips = slotResult[tipKey];
  if (!tips.length) {
    return `
      <span class="slot-result-label">本次结果</span>
      <span class="slot-keywords">${slotResult.summary || "本位置没有额外变化"}</span>
    `;
  }

  const tipMarkup = tips.map((tip) => `<span class="slot-tip ${tip.type}">${tip.text}</span>`).join("");
  return `
    <span class="slot-result-label">本次结果</span>
    <span class="slot-keywords">${slotResult.summary}</span>
    <span class="slot-tips">${tipMarkup}</span>
  `;
}
