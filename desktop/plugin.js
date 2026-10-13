import {
  host,
  Codicon,
  ROUTES_AREA,
  SIDEBAR_NAV_AREA,
  PALETTE_AREA,
} from "@hermes/plugin-sdk";
import { useState, useEffect, useRef } from "react";
import { jsx, jsxs } from "react/jsx-runtime";

const CORE_WORDS = [
  "I",
  "you",
  "want",
  "need",
  "yes",
  "no",
  "like",
  "not",
  "help",
  "stop",
  "more",
  "finished",
  "go",
  "come",
  "here",
  "there",
  "feel",
  "good",
  "bad",
  "hurt",
  "please",
  "thanks",
  "what",
  "where",
];
export function coreBoard() {
  return {
    format: "open-board-0.1",
    id: "core",
    name: "Core words",
    locale: "en",
    buttons: CORE_WORDS.map((label, i) => ({
      id: label.toLowerCase(),
      label,
      vocalization: label,
    })),
    grid: {
      rows: 4,
      columns: 6,
      order: Array.from({ length: 4 }, (_, r) =>
        CORE_WORDS.slice(r * 6, r * 6 + 6).map((x) => x.toLowerCase()),
      ),
    },
  };
}
function text(value, name, max = 180) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    throw Error(`${name} must be nonempty text (maximum ${max} characters).`);
  return value;
}
export function validateBoard(input) {
  if (typeof input === "string") {
    if (input.length > 250000) throw Error("Board exceeds 250 KB.");
    input = JSON.parse(input);
  }
  if (!input || typeof input !== "object" || input.format !== "open-board-0.1")
    throw Error("Expected an open-board-0.1 .obf JSON board.");
  const id = text(input.id, "Board id", 80),
    name = text(input.name, "Board name", 80),
    g = input.grid;
  if (
    !g ||
    !Number.isInteger(g.rows) ||
    !Number.isInteger(g.columns) ||
    g.rows < 1 ||
    g.rows > 10 ||
    g.columns < 1 ||
    g.columns > 10 ||
    g.rows * g.columns > 80
  )
    throw Error("Grid must contain 1–80 cells, at most 10 rows or columns.");
  if (
    !Array.isArray(input.buttons) ||
    input.buttons.length > 80 ||
    !input.buttons.length
  )
    throw Error("Expected 1–80 buttons.");
  const ids = new Set();
  const buttons = input.buttons.map((b) => {
    if (!b || typeof b !== "object") throw Error("Invalid button.");
    const bid = text(b.id, "Button id", 80);
    if (ids.has(bid)) throw Error("Duplicate button id.");
    ids.add(bid);
    if (b.action || b.actions || b.load_board)
      throw Error(
        "Actions and linked boards are not supported; import a plain vocabulary board.",
      );
    return {
      id: bid,
      label: text(b.label, "Button label", 80),
      vocalization:
        b.vocalization === undefined
          ? b.label
          : text(b.vocalization, "Spoken text", 180),
    };
  });
  if (!Array.isArray(g.order) || g.order.length !== g.rows)
    throw Error("Grid row count mismatch.");
  const seen = new Set();
  const order = g.order.map((row) => {
    if (!Array.isArray(row) || row.length !== g.columns)
      throw Error("Grid column count mismatch.");
    return row.map((cell) => {
      if (cell === null) return null;
      if (!ids.has(cell) || seen.has(cell))
        throw Error("Unknown or repeated grid button id.");
      seen.add(cell);
      return cell;
    });
  });
  if (!seen.size) throw Error("Board has no visible buttons.");
  return {
    format: "open-board-0.1",
    id,
    name,
    locale: typeof input.locale === "string" ? input.locale.slice(0, 40) : "en",
    buttons,
    grid: { rows: g.rows, columns: g.columns, order },
  };
}
export function exportBoard(board) {
  return JSON.stringify(validateBoard(board), null, 2);
}
export function initialState() {
  return {
    words: [],
    favorites: [],
    custom: [],
    active: "core",
    settings: { scanMs: 1800 },
    proposal: null,
  };
}
function checkedSettings(input, strict = false) {
  const defaults = initialState().settings,
    out = { ...defaults };
  for (const [key, min, max] of [
    ["scanMs", 500, 10000],
  ]) {
    if (input?.[key] === undefined) continue;
    const n = input[key];
    if (typeof n === "number" && Number.isFinite(n) && n >= min && n <= max)
      out[key] = n;
    else if (strict) throw Error(`Invalid ${key} setting.`);
  }
  return out;
}
export function reduce(state, action) {
  switch (action.type) {
    case "favorite-save": {
      const phrase = text(action.text, 'Favorite phrase', 180);
      if(state.favorites.includes(phrase))return state;
      if(state.favorites.length>=24)throw Error('Up to 24 favorites. Remove one before saving another.');
      return {...state,favorites:[...state.favorites,phrase]};
    }
    case "favorite-remove":
      return {...state,favorites:state.favorites.filter(p=>p!==action.text)};
    case "select":
      return {
        ...state,
        words: [...state.words, text(action.text, "Selected text")],
      };
    case "undo":
      return { ...state, words: state.words.slice(0, -1) };
    case "clear":
      return { ...state, words: [] };
    case "propose":
      return { ...state, proposal: validateBoard(action.board) };
    case "reject":
      return { ...state, proposal: null };
    case "approve": {
      if (!state.proposal) return state;
      let board = state.proposal;
      const used = new Set(
        [...builtinBoards(), ...state.custom].map((x) => x.id),
      );
      if (used.has(board.id)) {
        let n = 1;
        while (used.has(board.id.slice(0, 60) + "-copy-" + n)) n++;
        board = { ...board, id: board.id.slice(0, 60) + "-copy-" + n };
      }
      return {
        ...state,
        proposal: null,
        custom: [...state.custom, board],
        active: board.id,
      };
    }
    case "board":
      return { ...state, active: action.id };
    case "settings":
      return {
        ...state,
        settings: checkedSettings(
          { ...state.settings, ...action.settings },
          true,
        ),
      };
    case "update": {
      const board = validateBoard(action.board);
      if (builtinBoards().some((x) => x.id === board.id))
        throw Error("Duplicate a built-in board before editing.");
      return {
        ...state,
        custom: state.custom.map((x) => (x.id === board.id ? board : x)),
      };
    }
    case "delete":
      return {
        ...state,
        custom: state.custom.filter((x) => x.id !== action.id),
        active: "core",
      };
    default:
      return state;
  }
}
// Documented native bridge; route tags mirror core hermesApiAs.
function speechOwner() {
  return {profile: host.state.profile.get(), connectionId: host.state.connectionId.get()};
}
export function createSpeech({
  api = request => globalThis.window.hermesDesktop.api(request),
  owner = speechOwner,
  Audio = globalThis.Audio,
} = {}) {
  let audio = null, pending = false, generation = 0;
  function stop() {
    generation++;
    if (audio) { audio.pause(); audio.src = ''; audio = null; }
  }
  return {
    async speak(value, choice = neutralDelivery()) {
      text(value, "Utterance", 10000);
      const synthesis = deliveryText(value, choice), expressive = synthesis !== value;
      if (pending) throw Error('Speech synthesis already pending. Wait for the previous request to finish.');
      stop();
      const ticket = generation, scope = owner();
      pending = true;
      let configStamp;
      function checkScope() {
        if(ticket!==generation)throw Error('Speech stopped; late audio discarded.');
        if(!sameOwner(scope,owner()))throw Error('Gateway/profile changed; speech discarded.');
      }
      try {
        if (expressive) {
          knownOwner(scope);
          const settings = await api({...scope,path:'/api/config',method:'GET'});
          checkScope();
          if (settings?.tts?.provider !== 'elevenlabs' || settings?.tts?.elevenlabs?.model_id !== 'eleven_v3') throw Error('Expressive speech requires active elevenlabs · eleven_v3. Reset delivery for neutral speech or explicitly enable v3.');
          configStamp=JSON.stringify(settings.tts);
        }
        const result = await api({...scope, priority: 'foreground', path:'/api/audio/speak', method:'POST', body:{text:synthesis}, timeoutMs:180000});
        checkScope();
        if(expressive) {
          if(result?.provider!=='elevenlabs')throw Error('Returned speech provider mismatch; tagged audio will not play.');
          const saved=await api({...scope,path:'/api/config',method:'GET'});
          checkScope();
          if(JSON.stringify(saved?.tts)!==configStamp)throw Error('Shared TTS config changed during synthesis; tagged audio discarded.');
        }
        if (!result?.ok || !/^data:audio\/[a-z0-9.+-]+;base64,/i.test(result.data_url || '')) throw Error('Hermes returned no valid speech audio.');
        audio = new Audio(result.data_url);
        await audio.play();
        if (ticket !== generation) throw Error('Speech stopped.');
      } catch (error) {
        if (ticket === generation) stop();
        throw error;
      } finally { pending = false; }
    },
    stop
  };
}
const CATEGORIES = [
  [
    "food",
    "Food & drink",
    [
      "water",
      "drink",
      "eat",
      "hungry",
      "thirsty",
      "snack",
      "bread",
      "fruit",
      "milk",
      "coffee",
      "tea",
      "juice",
    ],
  ],
  [
    "feelings",
    "Feelings",
    [
      "happy",
      "sad",
      "tired",
      "angry",
      "worried",
      "excited",
      "calm",
      "scared",
      "lonely",
      "comfortable",
      "uncomfortable",
      "sick",
    ],
  ],
  [
    "places",
    "Places",
    [
      "home",
      "school",
      "work",
      "outside",
      "bathroom",
      "kitchen",
      "bedroom",
      "park",
      "shop",
      "car",
      "hospital",
      "quiet place",
    ],
  ],
  [
    "activities",
    "Activities",
    [
      "play",
      "read",
      "music",
      "watch",
      "walk",
      "rest",
      "talk",
      "draw",
      "sleep",
      "wash",
      "visit",
      "wait",
    ],
  ],
];
export function builtinBoards() {
  return [
    coreBoard(),
    ...CATEGORIES.map(([id, name, labels]) => ({
      format: "open-board-0.1",
      id,
      name,
      locale: "en",
      buttons: labels.map((label, i) => ({
        id: `${id}-${i}`,
        label,
        vocalization: label,
      })),
      grid: {
        rows: 2,
        columns: 6,
        order: [
          labels.slice(0, 6).map((_, i) => `${id}-${i}`),
          labels.slice(6).map((_, i) => `${id}-${i + 6}`),
        ],
      },
    })),
  ];
}
const CSS = `
.haac{height:100%;overflow:auto;color:var(--ui-text-primary);font-family:inherit;padding:24px;box-sizing:border-box}
.haac *{box-sizing:border-box}.haac h1{font-size:26px;margin:0;letter-spacing:-.6px}.haac h2{font-size:19px;margin:0 0 12px}.haac p{margin:8px 0;color:var(--ui-text-secondary);line-height:1.6}.haac .eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:var(--ui-accent);margin-bottom:8px}.haac header{display:flex;gap:16px;justify-content:space-between;align-items:center;margin-bottom:22px}.haac .tools,.haac .tabs,.haac .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.haac button,.haac select,.haac input,.haac textarea{font:inherit;color:var(--ui-text-primary);background:var(--ui-bg-secondary,var(--ui-bg-base));border:1px solid var(--ui-stroke-secondary);border-radius:10px}.haac button{min-height:48px;padding:10px 16px;cursor:pointer;font-weight:600}.haac button:hover{border-color:var(--ui-accent)}.haac button:focus-visible,.haac input:focus-visible,.haac select:focus-visible,.haac textarea:focus-visible{outline:3px solid var(--ui-accent);outline-offset:3px}.haac button:disabled{opacity:.45;cursor:default}.haac .accent,.haac button[aria-pressed=true]{border-color:var(--ui-accent);background:color-mix(in srgb,var(--ui-accent) 14%,transparent)}.haac .strip{border:1px solid var(--ui-stroke-secondary);border-radius:16px;padding:18px;margin-bottom:18px;background:var(--ui-bg-secondary,var(--ui-bg-base))}.haac .utterance{min-height:72px;font-size:28px;line-height:1.5;overflow-wrap:anywhere;display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:4px 0 16px}.haac .placeholder{color:var(--ui-text-tertiary);font-size:20px}.haac .word{padding:4px 9px;border-radius:6px;background:color-mix(in srgb,var(--ui-accent) 9%,transparent)}.haac .tabs{margin-bottom:16px}.haac .gridwrap{overflow-x:auto;padding:4px 4px 12px}.haac .board{display:grid;gap:10px;min-width:560px}.haac .tile{height:88px;min-width:0;font-size:21px;white-space:normal;overflow-wrap:anywhere;border-radius:14px;text-align:center;position:relative;padding:12px 8px}.haac .tile small{display:block;font-size:10px;color:var(--ui-text-tertiary);font-weight:400;position:absolute;bottom:5px;right:9px}.haac .foot{font-size:12px;color:var(--ui-text-tertiary);display:flex;gap:12px;justify-content:space-between;flex-wrap:wrap;margin-top:16px}.haac .panel{padding:20px;border:1px solid var(--ui-stroke-secondary);border-radius:14px;margin-top:20px}.haac label{display:block;font-size:13px;margin:14px 0 6px}.haac input,.haac select{min-height:48px;padding:9px 12px;max-width:100%}.haac textarea{width:100%;padding:12px;min-height:160px;resize:vertical}.haac .notice{min-height:24px;margin:10px 0;color:var(--ui-text-secondary)}.haac .scan-target{outline:4px solid var(--ui-accent);outline-offset:1px}.haac .preview{border:2px dashed var(--ui-accent);padding:16px;border-radius:14px;margin-top:18px}.haac .small{font-size:12px}.haac .setting-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}.haac .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.haac .suggestion-cards,.haac .voice-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin:16px 0}.haac .suggestion-cards button,.haac .voice-cards button{text-align:left;min-height:72px;padding:16px;font-size:16px;background:color-mix(in srgb,var(--ui-accent-secondary) 6%,var(--ui-bg-secondary));transition:border-color .15s,background .15s}.haac .voice-cards{max-height:360px;overflow:auto;padding:6px}.haac .context-workspace{background:linear-gradient(110deg,color-mix(in srgb,var(--ui-accent-secondary) 9%,transparent),transparent);margin-bottom:18px}.haac .ai-progress{padding:16px;border:1px solid var(--ui-accent-secondary);border-radius:12px;margin-top:16px}.haac .ai-progress [role=progressbar]{border-left:4px solid var(--ui-accent-secondary);padding:12px;margin-bottom:8px;animation:haac-pulse 1.6s ease-in-out infinite}.haac .ai-error{border-left:4px solid var(--ui-text-primary);padding:12px}.haac .preview h2{color:var(--ui-accent-secondary)}@keyframes haac-pulse{50%{opacity:.6}}@media(prefers-reduced-motion:reduce){.haac .ai-progress [role=progressbar]{animation:none}.haac .suggestion-cards button,.haac .voice-cards button{transition:none}}
@media(max-width:700px){.haac{padding:14px}.haac header{align-items:flex-start;flex-direction:column}.haac .tile{height:80px}.haac .board{gap:8px}.haac .utterance{font-size:24px}}

.haac.cockpit{padding:16px 20px;container-type:inline-size;overflow:auto;background:var(--ui-bg-base);font-size:14px}
.haac .cockpit-header{margin:0 0 12px;gap:12px}.haac .identity{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.haac h1{font-size:21px;letter-spacing:-.4px}.haac .status-chip{font-size:12px;color:var(--ui-text-secondary);border-left:1px solid var(--ui-stroke-secondary);padding-left:12px}
.haac .message-dock{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:16px;border:1px solid var(--ui-stroke-secondary);border-radius:16px;padding:12px 14px;background:var(--ui-bg-secondary,var(--ui-bg-base));box-shadow:0 4px 14px color-mix(in srgb,var(--ui-text-primary) 5%,transparent)}
.haac .utterance{flex:1;min-width:0;min-height:48px;max-height:120px;overflow:auto;padding:0;font-size:26px;line-height:1.35}.haac .placeholder{font-size:18px}.haac .word{background:none;padding:0}.haac .message-actions{display:flex;gap:8px;flex-shrink:0}.haac .speak-primary{min-width:110px;background:var(--ui-accent);color:var(--ui-bg-base);font-size:18px;border-color:var(--ui-accent)}.haac .stop-action{border-width:2px;border-color:var(--ui-text-secondary)}.haac .clear-action{border-style:dashed;margin-left:4px}
.haac .delivery-summary{display:flex;align-items:center;gap:14px;margin:8px 0 12px;color:var(--ui-text-secondary);font-size:12px}.haac .delivery-summary button{font-size:12px;padding:6px 10px;min-height:44px}.haac summary{cursor:pointer;min-height:44px;display:flex;align-items:center}.haac pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}
.haac .cockpit-body{display:grid;grid-template-columns:minmax(0,1fr);gap:20px;align-items:start}.haac .cockpit-body.studio-open{grid-template-columns:minmax(0,1fr) minmax(300px,350px)}.haac .communication-surface{min-width:0}.haac .tabs{gap:6px;margin:0 0 8px}.haac .tabs button{border-radius:8px;font-size:13px;min-height:48px;padding:8px 12px}.haac .tabs button[aria-pressed=true]{border-bottom:3px solid var(--ui-accent);background:color-mix(in srgb,var(--ui-accent) 12%,var(--ui-bg-secondary))}
.haac .gridwrap{padding:4px 4px 10px}.haac .board{gap:10px}.haac .tile{height:72px;font-size:23px;font-weight:650;background:var(--ui-bg-secondary);border-radius:12px;border-top:3px solid color-mix(in srgb,var(--ui-accent) 45%,var(--ui-stroke-secondary));box-shadow:0 2px 0 var(--ui-stroke-secondary)}.haac .tile:hover{background:color-mix(in srgb,var(--ui-accent) 10%,var(--ui-bg-secondary))}.haac .tile small{color:var(--ui-text-tertiary)}.haac .board-meta{font-size:12px;color:var(--ui-text-tertiary);padding:4px}.haac .privacy-note{font-size:11px;margin:6px 4px}.haac .notice:empty{display:none}.haac .notice{margin:6px 0;padding:8px 10px;line-height:1.4}
.haac .studio{min-width:0;border:1px solid var(--ui-stroke-secondary);background:var(--ui-bg-secondary);border-radius:16px;padding:14px;max-height:calc(100vh - 220px);overflow:auto}.haac .studio-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.haac .studio-heading h2{margin:0;font-size:18px}.haac .studio-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px}.haac .studio-tabs button{font-size:12px;min-height:48px;padding:8px}.haac .studio-tabs [aria-selected=true]{border-color:var(--ui-accent);background:color-mix(in srgb,var(--ui-accent) 14%,transparent)}.haac [hidden]{display:none!important}.haac .studio .panel{padding:0;border:0;margin:0 0 14px}.haac .studio h2{font-size:18px}.haac .studio h3{font-size:15px;margin:16px 0 8px}.haac .studio p{font-size:12px;line-height:1.5}.haac .studio .suggestion-cards,.haac .studio .voice-cards{grid-template-columns:1fr;gap:6px;margin:10px 0}.haac .studio .suggestion-cards button{min-height:48px;font-size:14px;padding:10px}.haac .studio .setting-grid{grid-template-columns:1fr}.haac .studio textarea,.haac .studio input,.haac .studio select{width:100%}.haac .studio textarea{min-height:90px}.haac .studio .row>button{flex:1;font-size:12px;padding:8px}.haac .studio .preview{padding:12px;min-width:0}.haac .studio .gridwrap{max-width:100%}
.haac .scan-status{padding:8px 12px;border:2px solid var(--ui-accent-secondary);border-radius:10px;margin:8px 0;font-weight:700}.haac button.scan-target{outline:4px solid var(--ui-text-primary);outline-offset:2px;background:color-mix(in srgb,var(--ui-accent-secondary) 30%,var(--ui-bg-secondary))}.haac.focus-mode .cockpit-body{margin-top:14px}
@container(max-width:1000px){.haac .cockpit-body.studio-open{grid-template-columns:minmax(0,1fr)}.haac .studio{max-height:none}.haac .message-dock{flex-wrap:wrap}.haac .utterance{flex-basis:100%}.haac .studio-tabs{grid-template-columns:repeat(4,minmax(0,1fr))}.haac .cockpit-header{flex-wrap:wrap}}
@media(max-width:700px){.haac.cockpit{padding:12px}.haac .cockpit-header{flex-direction:row;align-items:center}.haac .status-chip{display:none}.haac .message-actions{flex-wrap:wrap}.haac .message-actions button{min-height:48px}.haac .studio-tabs{grid-template-columns:1fr 1fr}.haac .tile{height:80px}.haac .delivery-summary{flex-wrap:wrap}}
.haac .phrase-shelf{border-top:1px solid var(--ui-stroke-secondary);padding:12px 4px;margin-top:4px}.haac .shelf-heading{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.haac .shelf-heading h2{font-size:14px;margin:0 auto 0 0}.haac .shelf-heading button{font-size:12px;min-height:44px;padding:6px 10px}.haac .phrase-items{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.haac .phrase-item{display:flex;gap:4px}.haac .phrase-item button{min-height:48px;font-size:14px}.haac .word-find{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px}.haac .word-find input{min-height:44px;flex:1;min-width:140px}.haac .word-find button{min-height:44px;font-size:12px;padding:6px 10px}.haac .word-find [role=status]{font-size:11px;color:var(--ui-text-tertiary)}.haac .tile.find-match{outline:3px solid var(--ui-accent);outline-offset:-5px;background:color-mix(in srgb,var(--ui-accent) 20%,var(--ui-bg-secondary));border-style:dashed}.haac .preset-anchor{position:relative}.haac .preset-popover{position:absolute;top:100%;left:0;min-width:240px;max-width:calc(100vw - 48px);z-index:8;background:var(--ui-bg-secondary);border:1px solid var(--ui-accent);border-radius:12px;padding:12px;box-shadow:0 8px 24px color-mix(in srgb,var(--ui-text-primary) 12%,transparent)}.haac .preset-popover button{display:block;width:100%;margin-top:6px;min-height:48px}.haac .preset-popover p{font-size:12px;margin:0}.haac .delivery-summary details[open]{flex:1}.haac .delivery-summary details[open] pre{max-height:100px;overflow:auto}
@media(prefers-reduced-motion:reduce){.haac *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
`;
function control(label, onClick, props = {}) {
  const { key = label, ...rest } = props;
  return jsx(
    "button",
    { type: "button", "data-scan": true, onClick, children: label, ...rest },
    key,
  );
}
function boardGrid(board, onSelect, preview = false, query = '') {
  const byId = new Map(board.buttons.map((b) => [b.id, b]));
  return jsx("div", {
    className: "gridwrap",
    children: jsx("div", {
      className: "board",
      "aria-label": preview ? "Proposed board preview" : "Communication board",
      style: {
        gridTemplateColumns: `repeat(${board.grid.columns},minmax(80px,1fr))`,
        minWidth: Math.max(320, board.grid.columns * 90) + "px",
      },
      children: board.grid.order.flat().map((id, i) => {
        const b = byId.get(id);
        return b
          ? jsx(
              "button",
              {
                type: "button",
                className: `tile${query.trim()&&`${b.label} ${b.vocalization}`.toLowerCase().includes(query.trim().toLowerCase())?' find-match':''}`,
                "data-scan": !preview,
                "data-cell": i,
                "aria-label": b.label,
                title: b.vocalization,
                onClick: () => onSelect(b),
                disabled: preview,
                children: jsxs("span", {
                  children: [b.label, jsx("small", { children: i + 1 })],
                }),
              },
              "cell-" + i,
            )
          : jsx("div", { "aria-hidden": true }, "cell-" + i);
      }),
    }),
  });
}
function field(label, element) {
  return jsxs(
    "label",
    { children: [jsx("span", { children: label }), element] },
    label,
  );
}
function downloadBoard(board) {
  const data = exportBoard(board),
    url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
  const a = globalThis.document.createElement("a");
  a.href = url;
  a.download = board.name.replace(/[^a-z0-9_-]/gi, "_") + ".obf";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function BoardsPanel({ board, state, dispatch, setNotice }) {
  const [name, setName] = useState("My board"),
    [phrases, setPhrases] = useState(""),
    [json, setJson] = useState(""),
    [selected, setSelected] = useState(board.buttons[0].id),
    [label, setLabel] = useState(board.buttons[0].label),
    [spoken, setSpoken] = useState(board.buttons[0].vocalization);
  useEffect(() => {
    const b = board.buttons.find((x) => x.id === selected) || board.buttons[0];
    setSelected(b.id);
    setLabel(b.label);
    setSpoken(b.vocalization);
  }, [board, selected]);
  const personal = state.custom.some((x) => x.id === board.id);
  function attempt(fn) {
    try {
      fn();
      setNotice("Ready for your review.");
    } catch (e) {
      setNotice(e.message);
    }
  }
  function makePersonal() {
    const lines = phrases.split("\n").filter((x) => x.trim());
    if (!lines.length || lines.length > 48)
      throw Error("Enter 1–48 phrases, one per line.");
    const columns = 6,
      rows = Math.ceil(lines.length / columns);
    dispatch({
      type: "propose",
      board: validateBoard({
        format: "open-board-0.1",
        id: "personal-" + Date.now().toString(36),
        name,
        buttons: lines.map((x, i) => ({
          id: "b" + i,
          label: x,
          vocalization: x,
        })),
        grid: {
          rows,
          columns,
          order: Array.from({ length: rows }, (_, r) =>
            Array.from({ length: columns }, (_, c) =>
              r * columns + c < lines.length ? "b" + (r * columns + c) : null,
            ),
          ),
        },
      }),
    });
  }
  return jsxs("div", {
    children: [
      jsx("p", {
        children:
          "Create a separate personal board, duplicate the current board, or import plain .obf JSON. Built-in locations cannot be overwritten.",
      }),
      jsxs("div", {
        className: "row",
        children: [
          control("Duplicate current board", () =>
            dispatch({
              type: "propose",
              board: {
                ...board,
                id: "copy-" + Date.now().toString(36),
                name: board.name + " copy",
              },
            }),
          ),
          control("Export current board (.obf)", () =>
            attempt(() => downloadBoard(board)),
          ),
        ],
      }),
      jsx("h3", { children: "Personal board" }),
      field(
        "Personal board name",
        jsx("input", {
          value: name,
          maxLength: 80,
          onChange: (e) => setName(e.target.value),
        }),
      ),
      field(
        "One phrase per line",
        jsx("textarea", {
          value: phrases,
          onChange: (e) => setPhrases(e.target.value),
          placeholder: "a favourite book\nmy blanket\na quiet space",
        }),
      ),
      control("Preview personal board", () => attempt(makePersonal)),
      jsx("h3", { children: "Import .obf / manual generated JSON" }),
      jsx("p", {
        className: "small",
        children:
          "Manual generation fallback: paste a constrained open-board-0.1 JSON proposal here. Nothing is executed or spoken. .obz archives, embedded actions, linked boards, and image/audio media are not supported.",
      }),
      field(
        "Choose .obf JSON file",
        jsx("input", {
          type: "file",
          accept: ".obf,.json,application/json",
          onChange: async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 250000) {
              setNotice("Board exceeds 250 KB.");
              return;
            }
            try {
              setJson(await file.text());
              setNotice("File loaded locally. Choose Preview JSON to review.");
            } catch (err) {
              setNotice(err.message);
            }
          },
        }),
      ),
      field(
        "Board JSON",
        jsx("textarea", {
          value: json,
          onChange: (e) => setJson(e.target.value),
          spellCheck: false,
          placeholder: "Paste open-board-0.1 JSON…",
        }),
      ),
      jsxs("div", {
        className: "row",
        children: [
          control("Load current JSON", () => setJson(exportBoard(board))),
          control("Preview JSON", () =>
            attempt(() =>
              dispatch({ type: "propose", board: validateBoard(json) }),
            ),
          ),
        ],
      }),
      personal
        ? jsxs("section", {
            children: [
              jsx("h3", { children: "Edit this personal board" }),
              jsx("p", {
                className: "small",
                children:
                  "Edits change only your selected button, never its grid location.",
              }),
              field(
                "Button to edit",
                jsx("select", {
                  value: selected,
                  onChange: (e) => setSelected(e.target.value),
                  children: board.buttons.map((b) =>
                    jsx("option", { value: b.id, children: b.label }, b.id),
                  ),
                }),
              ),
              field(
                "Button label",
                jsx("input", {
                  value: label,
                  maxLength: 80,
                  onChange: (e) => setLabel(e.target.value),
                }),
              ),
              field(
                "Spoken text",
                jsx("input", {
                  value: spoken,
                  maxLength: 180,
                  onChange: (e) => setSpoken(e.target.value),
                }),
              ),
              control("Save button edit", () =>
                attempt(() =>
                  dispatch({
                    type: "update",
                    board: {
                      ...board,
                      buttons: board.buttons.map((b) =>
                        b.id === selected
                          ? { ...b, label, vocalization: spoken }
                          : b,
                      ),
                    },
                  }),
                ),
              ),
              control("Preview removal", () =>
                setNotice(
                  "To remove this board, use Confirm remove below. Your core is unaffected.",
                ),
              ),
              control("Confirm remove personal board", () =>
                dispatch({ type: "delete", id: board.id }),
              ),
            ],
          })
        : null,
    ],
  });
}
export function attachScanning(
  root,
  { scanMs, onExit, onTarget = () => {} },
  timers = { setInterval, clearInterval },
) {
  let target = null;
  const targets = () => {
    const visibility=new Map();
    const eligible=node=>{
      if(node.closest('[hidden],[inert],[aria-hidden="true"],dialog:not([open])'))return false;
      for(let parent=node;parent&&parent!==root;parent=parent.parentElement){
        if(parent.tagName==='DETAILS'&&!parent.open&&!parent.querySelector(':scope > summary')?.contains(node))return false;
        if(!visibility.has(parent))visibility.set(parent,globalThis.window?.getComputedStyle?.(parent));
        const style=visibility.get(parent);
        if(style?.display==='none'||style?.visibility==='hidden')return false;
      }
      return true;
    };
    return [
      ...root.querySelectorAll('.tile[data-scan="true"]:not(:disabled)'),
      ...root.querySelectorAll('button[data-scan="true"]:not(.tile):not(:disabled),summary[data-scan="true"]'),
    ].filter(eligible);
  };
  function highlight(next) {
    target?.classList.remove("scan-target");
    target = next || null;
    target?.classList.add("scan-target");
    onTarget(target?.getAttribute('aria-label') || target?.textContent || '');
    target?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }
  function advance() {
    const list = targets();
    highlight(list[(list.indexOf(target) + 1) % list.length]);
  }
  function key(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      onExit();
      return;
    }
    if (e.target.matches?.("input,textarea,select,[contenteditable=true]"))
      return;
    if (e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat && target && !target.disabled && root.contains(target))
        target.click();
    }
  }
  advance();
  root.focus({preventScroll:true});
  const timer = timers.setInterval(advance, scanMs);
  root.addEventListener("keydown", key, true);
  return {
    advance,
    refresh() {const list=targets();highlight(list.includes(target)?target:list[0]);},
    dispose() {
      timers.clearInterval(timer);
      root.removeEventListener("keydown", key, true);
      highlight(null);
    },
  };
}
export function VoicePanel() {
  const [catalog, setCatalog] = useState([]), [config, setConfig] = useState(null),
    [query, setQuery] = useState(''), [chosen, setChosen] = useState(null),
    [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const origin = useRef(null), alive = useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  async function load() {
    setBusy(true); setMessage('Loading shared settings and ElevenLabs catalog…'); setChosen(null);setCatalog([]);setConfig(null);
    const scope = speechOwner(); origin.current=scope;
    try {
      const api = globalThis.window.hermesDesktop.api;
      const [settings, result] = await Promise.all([
        api({...scope,path:'/api/config',method:'GET'}),
        api({...scope,path:'/api/audio/elevenlabs/voices',method:'GET'})
      ]);
      if (!alive.current) return;
      setConfig(settings); setCatalog(result.available ? result.voices : []);
      setMessage(result.available ? `${result.voices.length} voices loaded from your gateway.` : 'ElevenLabs unavailable. Configure credentials in Hermes Settings; no catalog was fabricated.');
    } catch(e) {if(alive.current)setMessage(e.message);}
    finally {if(alive.current)setBusy(false);}
  }
  async function apply() {
    const scope=origin.current;
    if (!chosen || !scope || busy) return;
    const current=speechOwner();
    if(current.profile!==scope.profile || current.connectionId!==scope.connectionId) {setMessage('Gateway/profile changed. Reload voices before applying.');return;}
    setBusy(true);setMessage('Saving shared Hermes voice…');
    try {
      const api=globalThis.window.hermesDesktop.api;
      const result=await api({...scope,path:'/api/config',method:'PUT',body:{config:{tts:{provider:'elevenlabs',elevenlabs:{voice_id:chosen.voice_id}}}}});
      if(!result?.ok)throw Error('Hermes did not confirm the config write.');
      const saved=await api({...scope,path:'/api/config',method:'GET'});
      if(saved.tts?.provider!=='elevenlabs'||saved.tts?.elevenlabs?.voice_id!==chosen.voice_id)throw Error('Voice write could not be verified. Reload shared settings; do not assume the new voice is active.');
      if(alive.current){setConfig(saved);setChosen(null);setMessage(`Saved and verified: elevenlabs · ${saved.tts.elevenlabs.voice_id}. Applies to this profile across Hermes, not only AAC; fallback providers may still be used.`);}
    }catch(e){if(alive.current)setMessage(e.message);}
    finally{if(alive.current)setBusy(false);}
  }
  return jsxs('section', {'aria-label':'ElevenLabs voice browser',children:[
    jsx('h3',{children:'Your shared Hermes voice'}),
    jsx('p',{children: config ? `Configured: ${config.tts?.provider || 'default'} · ${config.tts?.elevenlabs?.voice_id || 'no ElevenLabs voice selected'}` : 'Load settings to inspect the active gateway/profile. No settings change on opening this page.'}),
    control('Load ElevenLabs voices',load,{disabled:busy}),
    control('Open Hermes Settings',()=>host.navigate('/settings')),
    jsx('p',{role:'status',children:message}),
    field('Search ElevenLabs voices',jsx('input',{value:query,onChange:e=>setQuery(e.target.value)})),
    jsx('div',{className:'voice-cards',children:catalog.filter(v=>`${v.label} ${v.voice_id}`.toLowerCase().includes(query.toLowerCase())).map(v=>control(`Choose ${v.label}`,()=>setChosen(v),{'aria-pressed':chosen?.voice_id===v.voice_id,key:v.voice_id}))}),
    chosen ? jsxs('div',{className:'preview',children:[jsx('p',{children:`Selected for review: ${chosen.label} · ${chosen.voice_id}. Applying explicitly changes shared tts.provider to elevenlabs and tts.elevenlabs.voice_id for ${origin.current?.profile || 'default'}. Other settings are preserved.`}),control('Apply ElevenLabs voice to Hermes',apply,{disabled:busy}),control('Cancel voice selection',()=>setChosen(null),{disabled:busy})]}) : null,
    jsx('p',{className:'small',children:'Only non-secret voice metadata is returned. The gateway keeps the ElevenLabs key. This catalog endpoint exposes no sample URL or per-voice preview door; no direct provider fetch or temporary voice swap is used.'})
  ]});
}
export function AccessPanel({ settings, dispatch }) {
  function number(key, value, min, max) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= min && n <= max)
      dispatch({ type: "settings", settings: { [key]: n } });
  }
  return jsxs("div", {
    children: [
      jsx("p", {
        children:
          "Tab moves between targets; Enter activates. Single-switch mode: Space selects the highlighted target; Escape stops scanning. Keep keyboard focus inside this page. Typing fields keep normal Space behavior.",
      }),
      jsx("p", {
        className: "small",
        children:
          "Scanning includes words, categories, Speak, Stop, Undo, Clear and panel buttons. It never auto-selects or auto-speaks.",
      }),
      jsx("div", {
        className: "setting-grid",
        children: [
          field(
            "Scan interval (seconds)",
            jsx("input", {
              type: "number",
              min: 0.5,
              max: 10,
              step: 0.1,
              value: settings.scanMs / 1000,
              onChange: (e) =>
                number("scanMs", Number(e.target.value) * 1000, 500, 10000),
            }),
          ),
        ],
      }),
      jsx("p", {
        className: "small",
        children: "Hermes-managed voice: the active gateway/profile's configured TTS provider, voice and settings. Cloud providers receive spoken text and may retain it; local providers synthesize on the gateway machine. No browser fallback.",
      }),
      jsx(VoicePanel, {}),
    ],
  });
}
export function askPrompt(input) {
  return `AAC communication assistance only. Reply briefly in plain text. Do not use tools, execute commands, contact anyone, change anything, speak, or silently correct the communicator's words. Give optional suggestions without replacing their message. The communicator explicitly asks: ${JSON.stringify(text(input, "Question", 2000))}`;
}
export function deliveryPrompt(input) {
  return `${askPrompt(input)} Propose optional speech delivery only in response to this explicit request; never infer or apply emotion, rewrite words or insert markup. Return ONLY JSON {"options":[{"emotion":"neutral","delivery":"normal","cue":"none"}]} with 1–4 options. Exact allowlists: emotion ${EMOTIONS.join(', ')}; delivery ${DELIVERIES.join(', ')}; cue ${CUES.join(', ')}. No extra fields, utterance text, HTML or tags.`;
}
export function phrasePrompt(input) {
  return `${askPrompt(input)} Return ONLY JSON {"phrases":["short optional phrase"]} with 2–6 optional AAC phrases, at most 180 characters each. Do not infer intent or replace the communicator's message.`;
}
export function parsePhrases(value) {
  if(typeof value!=='string'||value.length>10000)throw Error('Phrase response exceeds supported size.');
  const parsed=JSON.parse(value.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/, '$1'));
  if(!Array.isArray(parsed.phrases)||!parsed.phrases.length||parsed.phrases.length>6)throw Error('Expected 1–6 optional phrases.');
  return [...new Set(parsed.phrases.map(p=>text(p,'Suggested phrase',180)))];
}
export function generationPrompt(topic) {
  text(topic, "Board topic", 400);
  return `Create a plain-text AAC vocabulary board for this topic: ${JSON.stringify(topic)}. Return ONLY one valid JSON object, no commentary. Do not use tools, perform actions, send messages, or speak. Do not correct or infer the communicator's intent. Use format open-board-0.1, id, name, locale, buttons [{id,label,vocalization}], grid {rows,columns,order}. Use 12–24 short useful vocabulary labels, 4–6 columns, at most 4 rows. Every visible button has a unique id and appears once in order; pad empty cells with null. No actions, load_board, HTML, code, images, or audio. This is a proposal for a separate board; the stable core will not change. Example shape: ${JSON.stringify({ format: "open-board-0.1", id: "proposal", name: "Example", locale: "en", buttons: [{ id: "a", label: "help", vocalization: "help" }], grid: { rows: 1, columns: 1, order: [["a"]] } })}`;
}
export function parseProposal(value) {
  const stripped = value
    .trim()
    .replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/, "$1");
  return validateBoard(stripped);
}
export async function requestHermes(
  kind,
  input,
  { hostApi = host, onProgress = () => {}, signal, timeoutMs = 180000 } = {},
) {
  const prompt =
    kind === "generate" ? generationPrompt(input) : kind === "phrases" ? phrasePrompt(input) : kind === 'delivery' ? deliveryPrompt(input) : askPrompt(input);
  if (signal?.aborted) throw Error("Request cancelled.");
  const session = await hostApi.request("session.create", {
    source: "desktop",
    title: kind === "generate" ? "AAC board proposal" : "AAC assistance",
  });
  if (typeof session?.session_id !== "string")
    throw Error("Hermes did not return a runtime session id.");
  if (signal?.aborted) throw Error("Request cancelled before sending.");
  return new Promise((resolve, reject) => {
    let dispose = () => {},
      timer,
      done = false,
      buffer = "";
    const abort = () =>
      finish(
        Error(
          "Stopped waiting. The Hermes turn may still run in its separate session.",
        ),
      );
    function finish(error, value) {
      if (done) return;
      done = true;
      dispose();
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      error ? reject(error) : resolve(value);
    }
    dispose = hostApi.onEvent("*", (event) => {
      const payload = event.payload || {};
      const id = event.session_id || payload.session_id;
      if (id !== session.session_id) return;
      const chunk = typeof payload.text === "string" ? payload.text : "";
      if (event.type === "message.delta") {
        buffer += chunk;
        if (buffer.length > 250000) {
          finish(Error("Response exceeds 250 KB."));
          return;
        }
        onProgress(buffer);
      } else if (event.type === "message.complete") {
        const result =
          chunk ||
          (typeof payload.rendered === "string" ? payload.rendered : buffer);
        if (payload.status === "error" || payload.status === "failed")
          finish(Error(result || "Hermes turn failed."));
        else if (result) finish(null, result);
        else finish(Error("Hermes returned no text."));
      } else if (event.type === "error") {
        finish(Error(payload.message || "Hermes gateway reported an error."));
      }
    });
    timer = setTimeout(
      () =>
        finish(
          Error(
            "Timed out waiting for a session-scoped reply. Use manual JSON import if generation is unavailable.",
          ),
        ),
      timeoutMs,
    );
    signal?.addEventListener("abort", abort, { once: true });
    Promise.resolve(
      hostApi.request("prompt.submit", {
        session_id: session.session_id,
        text: prompt,
      }),
    ).catch((error) => finish(error));
  });
}
export function HermesPanel({ store, setNotice, initialTopic = '', onDelivery = () => {} }) {
  const [question, setQuestion] = useState(""),
    [topic, setTopic] = useState(initialTopic),
    [review, setReview] = useState(null),
    [busy, setBusy] = useState(false),
    [answer, setAnswer] = useState("");
  const [suggestions,setSuggestions]=useState([]),[deliveryOptions,setDeliveryOptions]=useState([]),[phase,setPhase]=useState(''),[error,setError]=useState('');
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  function reviewAsk() {
    try {
      setReview({ kind: "ask", input: question, prompt: askPrompt(question) });
    } catch (e) {
      setNotice(e.message);
    }
  }
  async function send() {
    if (!review || busy) return;
    const pending = review;
    setReview(null);
    setBusy(true);
    setAnswer('');setSuggestions([]);setDeliveryOptions([]);setError('');setPhase('Connecting to Hermes…');
    controller.current = new AbortController();
    try {
      const result = await requestHermes(pending.kind, pending.input, {
        signal: controller.current.signal,
        onProgress: value=>{setAnswer(value);setPhase(`Response received · ${value.length} characters`);},
      });
      setAnswer(result);
      if (pending.kind === "generate") {
        try {
          store.dispatch({ type: "propose", board: parseProposal(result) });
          setNotice(
            "Generated board validated. Review the proposal and choose Approve or Reject.",
          );
        } catch (e) {
          setNotice(
            "The generated response was not a supported board: " +
              e.message +
              " Use Boards → manual JSON import to review or correct the JSON.",
          );
        }
      } else if(pending.kind==='delivery') {
        setDeliveryOptions(parseDeliveries(result));setPhase('Delivery proposals ready');setNotice('Optional delivery proposals ready. Only Apply changes delivery; words and speech remain untouched.');
      } else if(pending.kind==='phrases') {
        setSuggestions(parsePhrases(result));setPhase('Phrase proposals ready');
        setNotice('Optional phrase proposals ready. Nothing was inserted or spoken.');
      } else
        setNotice(
          "Hermes replied. Your message is unchanged; nothing was spoken.",
        );
    } catch (e) {
      setError(e.message);
      setNotice(e.message + " Offline communication remains available.");
    } finally {
      setBusy(false);
    }
  }
  return jsxs("div", {
    children: [
      jsx("p", {
        children:
          "Nothing is shared until you review and confirm. A new Hermes session receives only the text shown below, not your board or utterance. Your configured provider may process and retain submitted text; Hermes sessions persist it. Responses never replace your words or trigger speech.",
      }),
      jsx("p", {
        className: "small",
        children:
          "Requests instruct Hermes not to use tools or take actions. This is a prompt instruction, not a tool-permission sandbox; normal host/provider policies still apply.",
      }),
      field(
        "Question for Hermes",
        jsx("textarea", {
          value: question,
          maxLength: 2000,
          onChange: (e) => {
            setQuestion(e.target.value);
            setReview(null);
          },
          placeholder:
            "Ask for wording suggestions, vocabulary, or communication support.",
        }),
      ),
      jsxs("div", {
        className: "row",
        children: [
          control(
            "Copy my message into question",
            () => {
              setQuestion(store.get().words.join(" "));
              setReview(null);
            },
            { disabled: busy || !store.get().words.length },
          ),
          control("Review sharing", reviewAsk, {
            disabled: busy || !question.trim(),
          }),
          control('Review delivery suggestions',()=>{try{setReview({kind:'delivery',input:question,prompt:deliveryPrompt(question)});}catch(e){setNotice(e.message);}},{disabled:busy||!question.trim()}),
          control('Review phrase suggestions',()=>{try{setReview({kind:'phrases',input:question,prompt:phrasePrompt(question)});}catch(e){setNotice(e.message);}},{disabled:busy||!question.trim()}),
        ],
      }),
      jsx("h3", { children: "Generate a separate board" }),
      jsx("p", {
        children:
          "Describe a situation, interest or activity. Hermes proposes vocabulary as validated JSON, not arbitrary UI code. The stable core is never sent or changed.",
      }),
      field(
        "Board generation topic",
        jsx("input", {
          value: topic,
          maxLength: 400,
          onChange: (e) => {
            setTopic(e.target.value);
            setReview(null);
          },
          placeholder: "e.g. a visit to the park",
        }),
      ),
      control(
        "Review generation request",
        () => {
          try {
            setReview({
              kind: "generate",
              input: topic,
              prompt: generationPrompt(topic),
            });
          } catch (e) {
            setNotice(e.message);
          }
        },
        { disabled: busy || !topic.trim() },
      ),
      jsx("p", {
        className: "small",
        children:
          "Manual fallback: use Boards → Import .obf / manual generated JSON when the gateway or model is unavailable. Only supported board JSON can be approved.",
      }),
      review
        ? jsxs("section", {
            className: "preview",
            children: [
              jsx("h3", { children: "Confirm sharing with Hermes" }),
              jsx("pre", {
                "aria-label": "Exact text sent to Hermes",
                style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
                children: review.prompt,
              }),
              control("Confirm and send to Hermes", send, {
                disabled: busy,
                className: "accent",
              }),
              control("Cancel sharing", () => setReview(null)),
            ],
          })
        : null,
      busy ? jsxs('section',{className:'ai-progress',children:[jsx('div',{role:'progressbar','aria-label':'Hermes request in progress',children:phase}),control('Stop waiting',()=>controller.current?.abort())]}) : null,
      error ? jsx('p',{role:'alert',className:'ai-error',children:`${error} · Your offline communication board remains available.`}) : null,
      deliveryOptions.length ? jsxs('section',{className:'panel','aria-label':'Optional AI delivery proposals',children:[jsx('h3',{children:'Optional delivery · not inferred intent'}),jsx('p',{children:'Apply changes only delivery controls. No word rewrite, automatic speech, model or provider change.'}),jsx('div',{className:'suggestion-cards',children:deliveryOptions.map((option,i)=>control(`Apply delivery: ${option.emotion} · ${option.delivery} · ${option.cue}`,()=>onDelivery(validateDelivery(option)),{key:i}))}),control('Dismiss delivery proposals',()=>setDeliveryOptions([]))]}) : null,
      suggestions.length ? jsxs('section',{className:'panel','aria-label':'Optional AI phrase proposals',children:[jsx('h3',{children:'Optional phrases · not your message'}),jsx('p',{children:'Choose a phrase to append it exactly. No automatic insertion, correction or speech.'}),jsx('div',{className:'suggestion-cards',children:suggestions.map(p=>control(p,()=>store.dispatch({type:'select',text:p}),{'aria-label':`Add suggestion: ${p}`,key:p}))}),control('Dismiss phrase proposals',()=>setSuggestions([]))]}) : null,
      answer
        ? jsxs("section", {
            className: "panel",
            "aria-label": "Hermes response",
            children: [
              jsx("h3", { children: "Hermes response · not your message" }),
              jsx("pre", {
                style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
                children: answer,
              }),
            ],
          })
        : null,
    ],
  });
}
const SITUATIONS = {
  everyday: {label:'Everyday',topic:'everyday choices and conversation',phrases:['I have something to say','Please give me time','I want to choose']},
  health: {label:'Healthcare',topic:'a healthcare appointment',phrases:['I need a break','Please explain that','I feel uncomfortable']},
  meal: {label:'Mealtime',topic:'choosing food at a meal',phrases:['I would like water','I am finished','Something different please']},
  outside: {label:'Out & about',topic:'a visit to the park',phrases:['Let us go outside','I want to rest','Where are we going?']}
};
function SituationWorkspace({onSelect,onExplore}) {
  const [situation,setSituation]=useState('everyday');
  const current=SITUATIONS[situation];
  return jsxs('section',{className:'panel context-workspace','aria-label':'Situational workspace',children:[
    jsx('div',{className:'eyebrow',children:'Context workspace · you lead'}),
    jsx('h2',{children:'What is happening now?'}),
    jsx('p',{children:'Choose a situation for optional shortcuts. These are locally authored suggestions, not inferred intent. Nothing is shared or spoken.'}),
    field('Situation',jsx('select',{value:situation,onChange:e=>setSituation(e.target.value),children:Object.entries(SITUATIONS).map(([id,s])=>jsx('option',{value:id,children:s.label},id))})),
    jsx('div',{className:'suggestion-cards',children:current.phrases.map(phrase=>control(phrase,()=>onSelect(phrase),{'aria-label':`Add phrase: ${phrase}`,key:phrase}))}),
    control('Explore this situation with Hermes',()=>onExplore(current.topic)),
    jsx('p',{className:'small',children:'Opens a topic draft only. Review the exact request before sharing. The fixed core stays where you know it.'})
  ]});
}
const EMOTIONS = ['neutral','happy','sad','excited','angry','thoughtful','surprised'];
const DELIVERIES = ['normal','whispers'];
const CUES = ['none','laughs','sighs'];
const neutralDelivery = () => ({emotion:'neutral',delivery:'normal',cue:'none'});
export function validateDelivery(choice) {
  if(!choice || typeof choice!=='object' || Array.isArray(choice) || Object.keys(choice).length!==3 || !EMOTIONS.includes(choice.emotion) || !DELIVERIES.includes(choice.delivery) || !CUES.includes(choice.cue))throw Error('Invalid delivery option. Choose one allowlisted emotion, delivery and vocal cue; no extra fields.');
  return {emotion:choice.emotion,delivery:choice.delivery,cue:choice.cue};
}
export function parseDeliveries(value) {
  if(typeof value!=='string'||value.length>4000)throw Error('Delivery response exceeds supported size.');
  const parsed=JSON.parse(value.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/, '$1'));
  if(!parsed||Object.keys(parsed).length!==1||!Array.isArray(parsed.options)||!parsed.options.length||parsed.options.length>4)throw Error('Expected 1–4 structured delivery options.');
  return parsed.options.map(validateDelivery);
}
export function deliveryText(value, choice = neutralDelivery()) {
  choice=validateDelivery(choice);
  const tags = [choice.emotion==='neutral'?null:choice.emotion,choice.delivery==='normal'?null:choice.delivery,choice.cue==='none'?null:choice.cue].filter(Boolean);
  if(!tags.length)return value;
  if(/[\[\]<>]/.test(value))throw Error('Expressive speech refuses existing bracket/angle markup. Reset delivery to speak the unchanged literal message.');
  const synthesis=tags.map(t=>`[${t}]`).join(' ') + ' ' + value;
  if(synthesis.length>5000)throw Error('Eleven v3 expressive requests are limited to 5000 characters including tags; shorten the message or reset delivery.');
  return synthesis;
}
function sameOwner(a,b) {return a?.profile===b?.profile && a?.connectionId===b?.connectionId;}
function knownOwner(scope) {if(!scope?.profile || !scope?.connectionId)throw Error('Expressive speech requires a known gateway/profile.');}
function DeliveryPanel({value,choice,onChange}) {
  const [review,setReview]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const lifecycle=useRef(0);
  useEffect(()=>{lifecycle.current++;return()=>{lifecycle.current++;};},[]);
  async function reviewModel() {
    if(busy)return;
    const ticket=lifecycle.current,scope=speechOwner();setReview(null);setBusy(true);setMessage('Reading shared model settings…');
    try {
      knownOwner(scope);
      const saved=await window.hermesDesktop.api({...scope,path:'/api/config',method:'GET'});
      if(ticket!==lifecycle.current)return;
      if(!sameOwner(scope,speechOwner()))throw Error('Gateway/profile changed. Review again.');
      if(saved?.tts?.provider!=='elevenlabs')throw Error('Select ElevenLabs explicitly in Access & voice first. Enabling v3 never switches providers.');
      setReview({scope,model:saved.tts.elevenlabs?.model_id});setMessage(`Active model: ${saved.tts.elevenlabs?.model_id || 'default'}`);
    }catch(e){if(ticket===lifecycle.current)setMessage(e.message);}
    finally{if(ticket===lifecycle.current)setBusy(false);}
  }
  async function enableModel() {
    if(!review||busy)return;
    const ticket=lifecycle.current,{scope,model}=review;setBusy(true);setMessage('Saving shared Eleven v3 model…');setReview(null);
    try {
      if(!sameOwner(scope,speechOwner()))throw Error('Gateway/profile changed. Review again.');
      const api=window.hermesDesktop.api;
      const fresh=await api({...scope,path:'/api/config',method:'GET'});
      if(ticket!==lifecycle.current)return;
      if(!sameOwner(scope,speechOwner())||fresh?.tts?.provider!=='elevenlabs'||fresh.tts.elevenlabs?.model_id!==model)throw Error('Shared config changed. Review again before enabling v3.');
      const result=await api({...scope,path:'/api/config',method:'PUT',body:{config:{tts:{elevenlabs:{model_id:'eleven_v3'}}}}});
      if(!result?.ok)throw Error('Hermes did not confirm the model write.');
      const saved=await api({...scope,path:'/api/config',method:'GET'});
      if(ticket!==lifecycle.current)return;
      if(!sameOwner(scope,speechOwner())||saved?.tts?.provider!=='elevenlabs'||saved.tts.elevenlabs?.model_id!=='eleven_v3')throw Error('Model write could not be verified. Reload settings; do not assume v3 is active.');
      setMessage('Eleven v3 saved and verified for this shared Hermes profile. Voice and provider unchanged.');
    }catch(e){if(ticket===lifecycle.current)setMessage(e.message);}
    finally{if(ticket===lifecycle.current)setBusy(false);}
  }
  let preview;
  try{preview=deliveryText(value,choice);}catch(e){preview=`Cannot synthesize: ${e.message}`;}
  const pick=(label,key,options)=>field(label,jsx('select',{value:choice[key],onChange:e=>onChange({...choice,[key]:e.target.value}),children:options.map(id=>jsx('option',{value:id,children:id[0].toUpperCase()+id.slice(1)},id))}));
  return jsxs('section',{className:'panel expressive-delivery','aria-label':'Expressive delivery',children:[
    jsx('div',{className:'eyebrow',children:'Delivery · explicit choice only'}),jsx('h2',{children:'How would you like to sound?'}),
    jsx('p',{children:'Neutral uses your exact message with Hermes settings. Optional tags require ElevenLabs Eleven v3; delivery is voice-dependent, not guaranteed. No emotion is inferred and nothing speaks automatically.'}),
    jsx('div',{className:'setting-grid',children:[pick('Delivery emotion','emotion',EMOTIONS),pick('Vocal delivery','delivery',DELIVERIES),pick('Vocal cue','cue',CUES)]}),
    control('Reset delivery',()=>onChange(neutralDelivery())),
    control('Review Enable Eleven v3',reviewModel,{disabled:busy}),
    jsx('p',{role:'status',children:message}),
    review ? jsxs('div',{className:'preview',children:[jsx('p',{children:`Confirm changing shared tts.elevenlabs.model_id from ${review.model || 'default'} to eleven_v3 for ${review.scope.profile} · ${review.scope.connectionId}. This affects all Hermes speech for that owner, not just AAC. Provider and voice will not change. No speech is generated.`}),control('Enable Eleven v3 in shared Hermes settings',enableModel,{disabled:busy}),control('Cancel model change',()=>setReview(null),{disabled:busy})]}) : null,
    jsx('h3',{children:'Exact synthesis request · not your message'}),
    jsx('pre',{'aria-label':'Exact synthesis preview',style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere'},children:preview}),
    jsx('p',{className:'small',children:'Vocal cues may add non-verbal sounds. Words in the message strip never change. No SSML or arbitrary tags. Hermes backend normalization still applies.'})
  ]});
}
export function AACPage({ store }) {
  const [managePhrases,setManagePhrases]=useState(false);
  const [find,setFind]=useState('');
  const [presets,setPresets]=useState(false);
  const [state,setState]=useState(store.get),[panel,setPanel]=useState('Context / AI'),[studio,setStudio]=useState(false),[focus,setFocus]=useState(false),[visited,setVisited]=useState(['Context / AI']),[notice,setNotice]=useState(''),[scanning,setScanning]=useState(false),[scanLabel,setScanLabel]=useState(''),[contextTopic,setContextTopic]=useState(''),[delivery,setDelivery]=useState(neutralDelivery);
  const root=useRef(null),speech=useRef(null),mounted=useRef(true),scannerRef=useRef(null);
  if(!speech.current)speech.current=createSpeech();
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;speech.current.stop();};},[]);
  useEffect(()=>store.subscribe(setState),[store]);
  useEffect(()=>{if(!scanning||!root.current)return;const scanner=attachScanning(root.current,{scanMs:state.settings.scanMs,onExit:()=>setScanning(false),onTarget:setScanLabel});scannerRef.current=scanner;return()=>{scanner.dispose();scannerRef.current=null;};},[scanning,state.settings.scanMs]);
  useEffect(()=>{scannerRef.current?.refresh();},[state,panel,studio,focus,presets,managePhrases,find]);
  const dispatch=action=>{try{store.dispatch(action);}catch(e){setNotice(e.message);}};
  const boards=[...builtinBoards(),...state.custom],board=boards.find(b=>b.id===state.active)||boards[0];
  function chooseDelivery(choice){speech.current.stop();setDelivery(validateDelivery(choice));}
  function openPanel(name){setPanel(name);setVisited(v=>v.includes(name)?v:[...v,name]);setStudio(true);setFocus(false);}
  function closeStudio(){setStudio(false);root.current?.querySelector('[data-studio-toggle]')?.focus();}
  async function doSpeak(){try{setNotice('Requesting speech from Hermes. Cloud providers may receive this exact message; local providers run on the gateway.');await speech.current.speak(store.get().words.join(' '),delivery);if(mounted.current)setNotice('Playing your words with Hermes voice settings.');}catch(e){if(mounted.current)setNotice(e.message);}}
  const tabs=['Context / AI','Expression','Access & voice','Boards'];
  let exact;try{exact=deliveryText(state.words.join(' '),delivery);}catch(e){exact=e.message;}
  const icon=(name)=>jsx(Codicon,{name,size:18});
  return jsxs('main',{className:`haac cockpit${focus?' focus-mode':''}`,ref:root,tabIndex:-1,children:[
    jsx('style',{children:CSS}),
    jsxs('header',{className:'cockpit-header',children:[jsxs('div',{className:'identity',children:[icon('comment-discussion'),jsx('h1',{children:'Communication'}),jsx('span',{className:'status-chip',children:'Board ready · speech on demand'})]}),jsxs('div',{className:'tools',children:[control(scanning?'Stop scanning':'Start scanning',()=>setScanning(v=>!v),{'aria-pressed':scanning}),control(focus?'Exit focus mode':'Focus mode',()=>{setFocus(v=>!v);root.current?.focus({preventScroll:true});},{'aria-pressed':focus}),!focus?control('Studio',()=>studio?closeStudio():setStudio(true),{'aria-expanded':studio,'aria-controls':'aac-studio','data-studio-toggle':true}):null]})]}),
    jsxs('section',{className:'message-dock','aria-label':'Your message',children:[jsx('div',{className:'utterance','aria-label':'Utterance strip',children:state.words.length?state.words.map((word,i)=>jsx('span',{className:'word',children:word},i)):jsx('span',{className:'placeholder',children:'Choose words to build your message…'})}),jsxs('div',{className:'message-actions',children:[control('Speak',doSpeak,{className:'speak-primary',disabled:!state.words.length}),control('Stop',()=>{speech.current.stop();setNotice('Playback stopped; pending audio will be discarded. Hermes may finish synthesis; its native API cannot cancel the server request.');},{className:'stop-action'}),control('Undo',()=>dispatch({type:'undo'}),{disabled:!state.words.length}),control('Clear',()=>dispatch({type:'clear'}),{disabled:!state.words.length,className:'clear-action'})]})]}),
    scanning?jsx('div',{className:'scan-status',role:'status','aria-label':'Scanning status',children:`Scanning · ${scanLabel} · Space selects · Escape stops`}):null,
    !focus?jsxs('div',{className:'delivery-summary',children:[control(`Delivery: ${delivery.emotion} · ${delivery.delivery} · ${delivery.cue}`,()=>openPanel('Expression'),{'aria-label':'Expression'}),jsxs('div',{className:'preset-anchor',children:[control('Delivery presets',()=>setPresets(v=>!v),{'aria-expanded':presets,'aria-controls':'aac-presets'}),presets?jsxs('div',{id:'aac-presets',className:'preset-popover','aria-label':'Explicit delivery presets',onKeyDown:e=>{if(e.key==='Escape'){setPresets(false);e.stopPropagation();root.current?.querySelector('[aria-controls="aac-presets"]')?.focus();}},children:[jsx('p',{children:'Tags require Eleven v3. Selection never speaks.'}),...['neutral','happy','thoughtful','excited'].map(emotion=>control(`${emotion[0].toUpperCase()+emotion.slice(1)} delivery`,()=>{chooseDelivery({...neutralDelivery(),emotion});setPresets(false);root.current?.querySelector('[aria-controls="aac-presets"]')?.focus();},{key:emotion}))]}):null]}),jsxs('details',{children:[jsx('summary',{'data-scan':true,children:'Exact request preview'}),jsx('pre',{'aria-label':'Compact synthesis preview',children:exact})]})]}):null,
    jsxs('div',{className:`cockpit-body${studio&&!focus?' studio-open':''}`,children:[
      jsxs('section',{className:'communication-surface','aria-label':'Vocabulary',children:[
        jsx('nav',{className:'tabs','aria-label':'Board categories',children:boards.map(b=>control(b.name,()=>dispatch({type:'board',id:b.id}),{'aria-pressed':board.id===b.id,key:b.id}))}),
        jsxs('div',{className:'word-find',children:[jsx(Codicon,{name:'search',size:18}),jsx('input',{type:'search','aria-label':'Find a word',placeholder:'Find a word on this board',value:find,maxLength:80,onChange:e=>setFind(e.target.value)}),control('Clear find',()=>{setFind('');root.current?.querySelector('[aria-label="Find a word"]')?.focus();},{disabled:!find}),jsx('span',{'aria-label':'Word find results',role:'status',children:find.trim()?`${board.buttons.filter(b=>board.grid.order.flat().includes(b.id)&&`${b.label} ${b.vocalization}`.toLowerCase().includes(find.trim().toLowerCase())).length} matches · positions unchanged`:'Find highlights words · never moves them'})]}),
        boardGrid(board,b=>dispatch({type:'select',text:b.vocalization}),false,find),
        jsxs('section',{className:'phrase-shelf','aria-label':'Quick phrases',children:[
          jsxs('div',{className:'shelf-heading',children:[jsx('h2',{children:'Quick phrases'}),control('Save phrase',()=>dispatch({type:'favorite-save',text:store.get().words.join(' ')}),{disabled:!state.words.length||state.words.join(' ').length>180,title:'Explicitly save this message locally (up to 180 characters)'}),control(managePhrases?'Done managing':'Manage phrases',()=>setManagePhrases(v=>!v),{'aria-expanded':managePhrases})]}),
          jsx('div',{className:'phrase-items',children:state.favorites.length?state.favorites.map(phrase=>jsxs('div',{className:'phrase-item',children:[control(phrase,()=>dispatch({type:'select',text:phrase}),{'aria-label':`Add favorite: ${phrase}`,key:'add'}),managePhrases?control('Remove',()=>dispatch({type:'favorite-remove',text:phrase}),{'aria-label':`Remove favorite: ${phrase}`,key:'remove'}):null]},phrase)):jsx('span',{className:'small',children:'Save a useful message here. No automatic history.'})}),
          managePhrases?jsx('p',{className:'small',children:'Only explicitly saved phrases persist locally, unencrypted. Removal deletes the saved shortcut, not your current message. Nothing here shares or speaks.'}):null
        ]}),
        jsx('div',{className:'board-meta',children:`${board.name} · Fixed ${board.grid.rows} × ${board.grid.columns} layout · Text vocabulary`}),
        jsx('div',{className:'notice',role:'status','aria-live':'polite',children:notice}),
        jsx('p',{className:'privacy-note',children:'Cloud/local TTS depends on Hermes settings · Speak shares with that provider · No automatic speech'})
      ]}),
      studio?jsxs('aside',{hidden:focus,id:'aac-studio',className:'studio','aria-label':'Communication studio',children:[jsxs('div',{className:'studio-heading',children:[jsx('h2',{children:'Studio'}),control('Close',closeStudio,{'aria-label':'Close studio'})]}),jsx('div',{role:'tablist','aria-label':'Communication studio',className:'studio-tabs',children:tabs.map((name,i)=>control(name,()=>openPanel(name),{role:'tab',id:`studio-tab-${i}`,'aria-selected':panel===name,'aria-controls':`studio-panel-${i}`,key:name}))}),...tabs.filter(name=>visited.includes(name)).map(name=>jsx('section',{role:'tabpanel',id:`studio-panel-${tabs.indexOf(name)}`,'aria-labelledby':`studio-tab-${tabs.indexOf(name)}`,hidden:panel!==name,children:name==='Boards'?jsx(BoardsPanel,{board,state,dispatch,setNotice}):name==='Access & voice'?jsx(AccessPanel,{settings:state.settings,dispatch}):name==='Expression'?jsx(DeliveryPanel,{value:state.words.join(' '),choice:delivery,onChange:chooseDelivery}):jsxs('div',{children:[jsx(SituationWorkspace,{onSelect:text=>dispatch({type:'select',text}),onExplore:topic=>{setContextTopic(topic);}}),jsx(HermesPanel,{store,setNotice,initialTopic:contextTopic,onDelivery:chooseDelivery},contextTopic)]})},name))]}):null
    ]}),
      state.proposal
        ? jsxs("section", {
            className: "preview",
            "aria-label": "Board proposal",
            children: [
              jsx("h2", { children: `Preview: ${state.proposal.name}` }),
              jsx("p", {
                children:
                  "Review every label and spoken text. Approval adds a separate board; it never changes your core, selects words, or speaks.",
              }),
              boardGrid(state.proposal, () => {}, true),
              jsx("ul", {
                children: state.proposal.buttons
                  .filter((b) => b.label !== b.vocalization)
                  .map((b) =>
                    jsx(
                      "li",
                      { children: `${b.label} → spoken: ${b.vocalization}` },
                      b.id,
                    ),
                  ),
              }),
              jsxs("div", {
                className: "row",
                children: [
                  control(
                    "Approve board",
                    () => dispatch({ type: "approve" }),
                    { className: "accent" },
                  ),
                  control("Reject proposal", () =>
                    dispatch({ type: "reject" }),
                  ),
                ],
              }),
            ],
          })
        : null,
    ]});
}
export default {
  id: "hermes-aac",
  name: "Communication · AAC",
  register(ctx) {
    const store = createStore(ctx.storage);
    ctx.register({
      id: "page",
      area: ROUTES_AREA,
      data: { path: "/aac" },
      render: () => jsx(AACPage, { store }),
    });
    ctx.register({
      id: "nav",
      area: SIDEBAR_NAV_AREA,
      data: {
        path: "/aac",
        label: "Communication",
        codicon: "comment-discussion",
      },
    });
    ctx.register({
      id: "open",
      area: PALETTE_AREA,
      data: {
        id: "hermes-aac.open",
        label: "Open Communication board (AAC)",
        keywords: ["aac", "communication", "speak", "voice"],
        run: () => host.navigate("/aac"),
      },
    });
    // React page cleanup silences this plugin only.
  },
};

export function createStore(storage) {
  let state = initialState();
  try {
    const saved=storage.get('phrase-favorites-v1',null);
    if(Array.isArray(saved)&&saved.length<=24)state.favorites=[...new Set(saved.map(p=>text(p,'Favorite phrase',180)))];
  }catch{ /* Malformed favorites do not affect usable vocabulary. */ }
  try {
    const saved = storage.get("board-state-v1", null);
    if (saved?.custom) {
      const custom = saved.custom.map(validateBoard),
        used = new Set(builtinBoards().map((x) => x.id));
      for (const b of custom) {
        if (used.has(b.id)) throw Error("Colliding stored board id.");
        used.add(b.id);
      }
      state.custom = custom;
      state.settings = checkedSettings(saved.settings);
    }
  } catch {
    /* Corrupt data never replaces the usable core. */
  }
  const listeners = new Set();
  return {
    get: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    dispatch(action) {
      const next = reduce(state, action);
      if(['favorite-save','favorite-remove'].includes(action.type))storage.set('phrase-favorites-v1',next.favorites);
      if (["approve", "update", "delete", "settings"].includes(action.type))
        storage.set("board-state-v1", {
          custom: next.custom,
          settings: next.settings,
        });
      state = next;
      listeners.forEach((fn) => fn(state));
      return state;
    },
  };
}
