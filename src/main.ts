import Matter from "matter-js";
import type { Body as MatterBody } from "matter-js";
import "./styles.css";
import { levels } from "./sim/level";
import { createSimulation } from "./sim/simulation";
import { measureStrokeLength, prepareStrokePoints } from "./sim/strokeBody";
import { StoppingCriteriaEvaluator } from "./sim/stopping";
import type { BenchmarkRunBundle, BenchmarkTraceFrame } from "./bench/types";
import type { LevelDefinition, StrokeAction, TerminalState, Vec2 } from "./sim/types";

const { Composite } = Matter;

const canvas = requireElement<HTMLCanvasElement>("#game");
const playModeButton = requireElement<HTMLButtonElement>("#play-mode");
const traceModeButton = requireElement<HTMLButtonElement>("#trace-mode");
const modeEyebrowEl = requireElement<HTMLElement>("#mode-eyebrow");
const levelTitleEl = requireElement<HTMLElement>("#level-title");
const levelCopyEl = requireElement<HTMLElement>("#level-copy");
const statusEl = requireElement<HTMLElement>("#status");
const goalEl = requireElement<HTMLElement>("#goal");
const levelSelect = requireElement<HTMLSelectElement>("#level-select");
const strokeCountEl = requireElement<HTMLElement>("#stroke-count");
const playStats = requireElement<HTMLElement>("#play-stats");
const traceStats = requireElement<HTMLElement>("#trace-stats");
const traceRunEl = requireElement<HTMLElement>("#trace-run");
const traceResultEl = requireElement<HTMLElement>("#trace-result");
const traceFrameEl = requireElement<HTMLElement>("#trace-frame");
const traceQuietEl = requireElement<HTMLElement>("#trace-quiet");
const strokeJsonEl = requireElement<HTMLTextAreaElement>("#stroke-json");
const toggleRunButton = requireElement<HTMLButtonElement>("#toggle-run");
const togglePhysicsButton = requireElement<HTMLButtonElement>("#toggle-physics");
const resetButton = requireElement<HTMLButtonElement>("#reset");
const clearStrokeButton = requireElement<HTMLButtonElement>("#clear-stroke");
const playControls = requireElement<HTMLElement>("#play-controls");
const traceControls = requireElement<HTMLElement>("#trace-controls");
const strokeExport = requireElement<HTMLElement>("#stroke-export");
const runBundleInput = requireElement<HTMLInputElement>("#run-bundle");
const traceScrubber = requireElement<HTMLInputElement>("#trace-scrubber");
const tracePlayButton = requireElement<HTMLButtonElement>("#trace-play");
const tracePrevButton = requireElement<HTMLButtonElement>("#trace-prev");
const traceNextButton = requireElement<HTMLButtonElement>("#trace-next");
const tracePhysicsButton = requireElement<HTMLButtonElement>("#trace-physics");
const traceSpeedSelect = requireElement<HTMLSelectElement>("#trace-speed");
const context = requireCanvasContext(canvas);

let sim = createSimulation(levels[0]);
let playStopping = new StoppingCriteriaEvaluator();
let playFrame = 0;
let playTerminalState: TerminalState | null = null;
let mode: "play" | "trace" = "play";
const pointerScale = { x: 1, y: 1 };
let running = true;
let drawing = false;
let activeStroke: Vec2[] = [];
let committedStroke: StrokeAction | null = null;
let committedStrokeBody: MatterBody | null = null;
let committedStrokeLocalPoints: Vec2[] = [];
let showPhysicsBodies = false;
let lastFrameTime = performance.now();
let accumulator = 0;
let traceBundle: BenchmarkRunBundle | null = null;
let traceFrameIndex = 0;
let tracePlaying = false;
let traceAccumulator = 0;
let traceStrokeLocalPoints = new Map<string, Vec2[]>();
let traceLevel: LevelDefinition = sim.level;
let traceStaticSim = createSimulation(traceLevel);

const strokeWidth = 18;

function resizeCanvas(): void {
  const parent = canvas.parentElement;
  if (!parent) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const availableWidth = parent.clientWidth;
  const availableHeight = parent.clientHeight;
  const level = getActiveLevel();
  const worldAspect = level.world.width / level.world.height;
  const panelAspect = availableWidth / availableHeight;

  let cssWidth = availableWidth;
  let cssHeight = availableHeight;
  if (panelAspect > worldAspect) {
    cssWidth = availableHeight * worldAspect;
  } else {
    cssHeight = availableWidth / worldAspect;
  }

  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  pointerScale.x = canvas.width / level.world.width;
  pointerScale.y = canvas.height / level.world.height;
}

function screenToWorld(event: PointerEvent): Vec2 {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * sim.level.world.width;
  const y = ((event.clientY - rect.top) / rect.height) * sim.level.world.height;
  return {
    x: clamp(x, 0, sim.level.world.width),
    y: clamp(y, 0, sim.level.world.height),
  };
}

function beginStroke(event: PointerEvent): void {
  if (mode !== "play") {
    return;
  }
  if (committedStroke || sim.goal.achieved) {
    return;
  }
  drawing = true;
  activeStroke = [screenToWorld(event)];
  canvas.setPointerCapture(event.pointerId);
}

function extendStroke(event: PointerEvent): void {
  if (!drawing) {
    return;
  }

  const point = screenToWorld(event);
  const last = activeStroke[activeStroke.length - 1];
  if (!last || Math.hypot(point.x - last.x, point.y - last.y) >= 4) {
    activeStroke.push(point);
  }
}

function finishStroke(event: PointerEvent): void {
  if (!drawing) {
    return;
  }
  drawing = false;
  canvas.releasePointerCapture(event.pointerId);

  if (activeStroke.length < 2 || committedStroke) {
    activeStroke = [];
    return;
  }

  committedStroke = {
    id: `stroke-${Date.now()}`,
    width: strokeWidth,
    points: activeStroke,
  };
  committedStrokeBody = sim.addStroke(committedStroke);
  if (committedStrokeBody) {
    playFrame = 0;
    accumulator = 0;
    playStopping.markStrokeAdded(playFrame);
  }
  committedStrokeLocalPoints = committedStrokeBody ? toLocalPoints(prepareStrokePoints(committedStroke.points), committedStrokeBody) : [];
  activeStroke = [];
  updateUi();
}

function clearStroke(): void {
  sim.reset();
  playStopping = new StoppingCriteriaEvaluator();
  playFrame = 0;
  playTerminalState = null;
  committedStroke = null;
  committedStrokeBody = null;
  committedStrokeLocalPoints = [];
  activeStroke = [];
  running = true;
  updateUi();
}

function resetLevel(): void {
  sim.reset();
  playStopping = new StoppingCriteriaEvaluator();
  playFrame = 0;
  playTerminalState = null;
  activeStroke = [];
  committedStroke = null;
  committedStrokeBody = null;
  committedStrokeLocalPoints = [];
  running = true;
  updateUi();
}

function changeLevel(): void {
  const nextLevel = levels.find((level) => level.id === levelSelect.value) ?? levels[0];
  sim = createSimulation(nextLevel);
  playStopping = new StoppingCriteriaEvaluator();
  playFrame = 0;
  playTerminalState = null;
  activeStroke = [];
  committedStroke = null;
  committedStrokeBody = null;
  committedStrokeLocalPoints = [];
  running = true;
  accumulator = 0;
  resizeCanvas();
  updateUi();
}

function gameLoop(now: number): void {
  const elapsed = Math.min(100, now - lastFrameTime);
  lastFrameTime = now;

  if (mode === "play" && running && committedStrokeBody && !playTerminalState) {
    accumulator += elapsed;
    while (accumulator >= 1000 / 60) {
      sim.step();
      playFrame += 1;
      playTerminalState = playStopping.evaluate(sim, playFrame).terminalState;
      accumulator -= 1000 / 60;
      if (playTerminalState) {
        running = false;
        break;
      }
    }
  } else if (mode === "trace" && tracePlaying && traceBundle) {
    traceAccumulator += elapsed * Number(traceSpeedSelect.value);
    while (traceAccumulator >= 1000 / 60) {
      setTraceFrame(traceFrameIndex + 1);
      traceAccumulator -= 1000 / 60;
      if (traceFrameIndex >= traceBundle.trace.frames.length - 1) {
        tracePlaying = false;
        break;
      }
    }
  }

  render();
  updateUi();
  requestAnimationFrame(gameLoop);
}

function render(): void {
  context.save();
  context.scale(pointerScale.x, pointerScale.y);
  if (mode === "trace") {
    renderTrace();
    context.restore();
    return;
  }

  drawBoard(sim.level);
  drawInstruction(sim.level);

  for (const body of Composite.allBodies(sim.engine.world)) {
    if (body.label === "right-wall" || body.label === "ceiling") {
      continue;
    }
    if (body.label.startsWith("stroke:") && !showPhysicsBodies) {
      continue;
    }
    drawBody(body);
  }

  if (!showPhysicsBodies && committedStrokeBody && committedStrokeLocalPoints.length > 1) {
    drawCommittedStroke(committedStrokeBody, committedStrokeLocalPoints);
  }

  if (activeStroke.length > 1) {
    drawStrokePreview(activeStroke);
  }

  if (playTerminalState) {
    drawPlayTerminal(playTerminalState);
  }

  context.restore();
}

function drawBoard(level: LevelDefinition): void {
  const { width, height } = level.world;
  context.fillStyle = "#263544";
  context.fillRect(0, 0, width, height);

  context.save();
  context.globalAlpha = 0.24;
  context.strokeStyle = "#6f8292";
  context.lineWidth = 2;
  for (let x = -40; x < width + 40; x += 56) {
    for (let y = -40; y < height + 40; y += 48) {
      context.beginPath();
      context.moveTo(x, y + 18);
      context.lineTo(x + 18, y + 6);
      context.lineTo(x + 36, y + 18);
      context.lineTo(x + 36, y + 38);
      context.lineTo(x + 18, y + 50);
      context.lineTo(x, y + 38);
      context.closePath();
      context.stroke();
    }
  }
  context.restore();

  context.strokeStyle = "#eef2f4";
  context.lineWidth = 10;
  context.strokeRect(5, 5, width - 10, height - 10);
}

function drawInstruction(level: LevelDefinition): void {
  context.save();
  context.fillStyle = "rgba(248, 251, 252, 0.9)";
  context.font = "48px Inter, Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "top";
  context.fillText(level.instruction, level.world.width / 2, 94);
  context.restore();
}

function drawBody(body: MatterBody): void {
  const parts = body.parts.length > 1 ? body.parts.slice(1) : body.parts;
  for (const part of parts) {
    context.beginPath();
    part.vertices.forEach((vertex, index) => {
      if (index === 0) {
        context.moveTo(vertex.x, vertex.y);
      } else {
        context.lineTo(vertex.x, vertex.y);
      }
    });
    context.closePath();
    context.fillStyle = getBodyFill(body);
    context.strokeStyle = getBodyStroke(body);
    context.lineWidth = body.label === "floor" ? 0 : 3;
    context.fill();
    if (context.lineWidth > 0) {
      context.stroke();
    }
  }
}

function getBodyFill(body: MatterBody): string {
  if (body.label === "ball") {
    return "#f4bd37";
  }
  if (body.label === "floor") {
    return "#8d9791";
  }
  if (body.label === "left-wall") {
    return "rgba(244, 189, 55, 0.34)";
  }
  if (body.label === "cup") {
    return "#f7f7f1";
  }
  if (body.label.startsWith("stroke:") && showPhysicsBodies) {
    return "rgba(251, 251, 245, 0.72)";
  }
  return "#fbfbf5";
}

function getBodyStroke(body: MatterBody): string {
  if (body.label.startsWith("stroke:") && showPhysicsBodies) {
    return "#e94666";
  }
  if (body.label === "left-wall") {
    return "#f4bd37";
  }
  return "#171b24";
}

function drawStrokePreview(points: Vec2[]): void {
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = strokeWidth;
  context.strokeStyle = "rgba(255, 255, 252, 0.88)";
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  });
  context.stroke();
  context.restore();
}

function drawCommittedStroke(body: MatterBody, localPoints: Vec2[]): void {
  const points = localPoints.map((point) => toWorldPoint(point, body));
  drawRoundPath(points, strokeWidth, "#fbfbf5", "#171b24");
}

function drawRoundPath(points: Vec2[], width: number, fill: string, outline: string): void {
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = width + 4;
  context.strokeStyle = outline;
  context.beginPath();
  traceSmoothPath(points);
  context.stroke();

  context.lineWidth = width;
  context.strokeStyle = fill;
  context.beginPath();
  traceSmoothPath(points);
  context.stroke();
  context.restore();
}

function traceSmoothPath(points: Vec2[]): void {
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    context.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
  }
  const last = points[points.length - 1];
  context.lineTo(last.x, last.y);
}

function drawPlayTerminal(terminalState: TerminalState): void {
  context.save();
  context.fillStyle = "rgba(18, 24, 30, 0.74)";
  context.fillRect(320, 268, 360, 114);
  context.strokeStyle = terminalState === "success" ? "#f4bd37" : "#e94666";
  context.lineWidth = 3;
  context.strokeRect(320, 268, 360, 114);
  context.fillStyle = "#ffffff";
  context.font = "34px Inter, Arial, sans-serif";
  context.textAlign = "center";
  context.fillText(terminalState === "success" ? "Success" : terminalState, 500, 322);
  context.font = "18px Inter, Arial, sans-serif";
  context.fillText(`Frame ${playFrame}`, 500, 352);
  context.restore();
}

function renderTrace(): void {
  const level = getActiveLevel();
  drawBoard(level);
  drawInstruction(level);

  for (const body of Composite.allBodies(traceStaticSim.engine.world)) {
    if (!body.isStatic || body.label === "right-wall" || body.label === "ceiling") {
      continue;
    }
    drawBody(body);
  }

  const frame = getCurrentTraceFrame();
  if (!frame) {
    drawTraceEmpty(level);
    return;
  }

  for (const body of frame.bodies) {
    if (body.label === "ball") {
      drawTraceBall(level, body);
    } else if (body.label.startsWith("stroke:")) {
      drawTraceStroke(body, traceStrokeLocalPoints.get(body.label) ?? []);
    } else if (showPhysicsBodies) {
      drawTraceBox(body, "#fbfbf5");
    }
  }

  if (frame.terminalState) {
    drawTraceTerminal(frame.terminalState);
  } else if (frame.goalAchieved) {
    drawTraceTerminal("success");
  }
}

function drawTraceEmpty(level: LevelDefinition): void {
  context.save();
  context.fillStyle = "rgba(18, 24, 30, 0.72)";
  context.fillRect(level.world.width / 2 - 240, level.world.height / 2 - 56, 480, 112);
  context.strokeStyle = "#f4bd37";
  context.lineWidth = 3;
  context.strokeRect(level.world.width / 2 - 240, level.world.height / 2 - 56, 480, 112);
  context.fillStyle = "#f8fbfc";
  context.font = "26px Inter, Arial, sans-serif";
  context.textAlign = "center";
  context.fillText("Load a run bundle", level.world.width / 2, level.world.height / 2 - 10);
  context.font = "16px Inter, Arial, sans-serif";
  context.fillText("Use pnpm bench action.json, then upload runs/.../run.json", level.world.width / 2, level.world.height / 2 + 22);
  context.restore();
}

function drawTraceBall(level: LevelDefinition, body: BenchmarkTraceFrame["bodies"][number]): void {
  context.save();
  context.translate(body.position.x, body.position.y);
  context.rotate(body.angle);
  context.beginPath();
  context.arc(0, 0, level.ball.radius, 0, Math.PI * 2);
  context.fillStyle = "#f4bd37";
  context.strokeStyle = "#171b24";
  context.lineWidth = 3;
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(level.ball.radius * 0.72, 0);
  context.stroke();
  context.restore();
}

function drawTraceStroke(body: BenchmarkTraceFrame["bodies"][number], localPoints: Vec2[]): void {
  if (localPoints.length < 2) {
    drawTraceBox(body, "#fbfbf5");
    return;
  }

  const points = localPoints.map((point) => toTraceWorldPoint(point, body));
  const stroke = traceBundle?.action.strokes.find((candidate) => `stroke:${candidate.id}` === body.label);
  drawRoundPath(points, stroke?.width ?? strokeWidth, "#fbfbf5", showPhysicsBodies ? "#e94666" : "#171b24");
}

function drawTraceBox(body: BenchmarkTraceFrame["bodies"][number], fill: string): void {
  context.save();
  context.translate(body.position.x, body.position.y);
  context.rotate(body.angle);
  context.fillStyle = fill;
  context.strokeStyle = "#171b24";
  context.lineWidth = 3;
  context.fillRect(-18, -18, 36, 36);
  context.strokeRect(-18, -18, 36, 36);
  context.restore();
}

function drawTraceTerminal(terminalState: string): void {
  context.save();
  context.fillStyle = "rgba(18, 24, 30, 0.74)";
  context.fillRect(320, 268, 360, 114);
  context.strokeStyle = terminalState === "success" ? "#f4bd37" : "#e94666";
  context.lineWidth = 3;
  context.strokeRect(320, 268, 360, 114);
  context.fillStyle = "#ffffff";
  context.font = "34px Inter, Arial, sans-serif";
  context.textAlign = "center";
  context.fillText(terminalState === "success" ? "Success" : terminalState, 500, 322);
  context.font = "18px Inter, Arial, sans-serif";
  context.fillText(`Frame ${traceFrameIndex}`, 500, 352);
  context.restore();
}

function updateUi(): void {
  if (mode === "trace") {
    updateTraceUi();
    return;
  }

  modeEyebrowEl.textContent = "Playable V1";
  if (playTerminalState) {
    statusEl.textContent = playTerminalState === "success" ? "Success" : playTerminalState;
  } else if (!committedStrokeBody) {
    statusEl.textContent = drawing ? "Drawing" : "Draw one stroke";
  } else if (!running) {
    statusEl.textContent = "Paused";
  } else if (sim.level.goal.type === "hit-left-wall") {
    statusEl.textContent = sim.goal.leftWallContact ? "Wall contact" : "Get to the left wall";
  } else if (committedStroke) {
    statusEl.textContent = `Off ground ${sim.goal.consecutiveOffGroundFrames} / ${sim.goal.requiredOffGroundFrames}`;
  }

  goalEl.textContent =
    sim.level.goal.type === "hit-left-wall"
      ? "Hit the left wall"
      : `Off ground for ${sim.goal.requiredOffGroundFrames} frames`;
  levelTitleEl.textContent = sim.level.instruction;
  levelCopyEl.textContent =
    sim.level.goal.type === "hit-left-wall"
      ? "Draw a falling stroke to nudge the ball into the target wall."
      : "Draw one heavy stroke. Release to let it fall, push, tip, or wedge the ball upward.";
  toggleRunButton.textContent = running ? (committedStrokeBody ? "Pause" : "Armed") : "Run";
  togglePhysicsButton.textContent = showPhysicsBodies ? "Show visual" : "Show physics";
  strokeCountEl.textContent = `${committedStroke ? 1 : 0} / ${sim.level.limits.maxStrokes}`;
  strokeJsonEl.value = committedStroke
    ? JSON.stringify(
        {
          ...committedStroke,
          length: Math.round(measureStrokeLength(committedStroke.points)),
        },
        null,
        2,
      )
    : "";
}

function updateTraceUi(): void {
  const frame = getCurrentTraceFrame();
  const result = traceBundle?.result;
  const totalFrames = traceBundle?.trace.frames.length ?? 0;
  const currentFrame = frame?.frame ?? 0;
  const quietFrames = frame?.quietFrames ?? result?.quietFrames ?? 0;

  modeEyebrowEl.textContent = "Trace replay";
  traceRunEl.textContent = traceBundle ? traceBundle.level.id : "No run loaded";
  traceResultEl.textContent = result ? `${result.terminalState}${result.success ? " pass" : " fail"}` : "Waiting";
  traceFrameEl.textContent = result ? `${currentFrame} / ${result.terminalFrame}` : `0 / ${totalFrames}`;
  traceQuietEl.textContent = `${quietFrames} frames`;
  levelTitleEl.textContent = traceBundle ? traceBundle.level.instruction : "Trace viewer";
  levelCopyEl.textContent = result
    ? `Terminal frame ${result.terminalFrame}. Quiet frames ${result.quietFrames}.`
    : "Upload a run from the project runs folder to inspect recorded frames.";
  tracePlayButton.textContent = tracePlaying ? "Pause" : "Play";
  tracePhysicsButton.textContent = showPhysicsBodies ? "Show visual" : "Show physics";
  traceScrubber.max = String(Math.max(0, totalFrames - 1));
  traceScrubber.value = String(traceFrameIndex);
}

function getActiveLevel(): LevelDefinition {
  return mode === "trace" ? traceLevel : sim.level;
}

function getCurrentTraceFrame(): BenchmarkTraceFrame | null {
  return traceBundle?.trace.frames[traceFrameIndex] ?? null;
}

function setTraceFrame(nextFrameIndex: number): void {
  const max = Math.max(0, (traceBundle?.trace.frames.length ?? 1) - 1);
  traceFrameIndex = clamp(Math.round(nextFrameIndex), 0, max);
  traceScrubber.value = String(traceFrameIndex);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

function requireCanvasContext(target: HTMLCanvasElement): CanvasRenderingContext2D {
  const canvasContext = target.getContext("2d");
  if (!canvasContext) {
    throw new Error("Canvas 2D is unavailable.");
  }
  return canvasContext;
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key.toLowerCase() !== "r" || isTextInput(event.target)) {
    return;
  }
  event.preventDefault();
  resetLevel();
}

function isTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
}

function toLocalPoints(points: Vec2[], body: MatterBody): Vec2[] {
  return points.map((point) => {
    const dx = point.x - body.position.x;
    const dy = point.y - body.position.y;
    const cos = Math.cos(-body.angle);
    const sin = Math.sin(-body.angle);
    return {
      x: dx * cos - dy * sin,
      y: dx * sin + dy * cos,
    };
  });
}

function toWorldPoint(point: Vec2, body: MatterBody): Vec2 {
  const cos = Math.cos(body.angle);
  const sin = Math.sin(body.angle);
  return {
    x: body.position.x + point.x * cos - point.y * sin,
    y: body.position.y + point.x * sin + point.y * cos,
  };
}

function toTraceWorldPoint(point: Vec2, body: BenchmarkTraceFrame["bodies"][number]): Vec2 {
  const cos = Math.cos(body.angle);
  const sin = Math.sin(body.angle);
  return {
    x: body.position.x + point.x * cos - point.y * sin,
    y: body.position.y + point.x * sin + point.y * cos,
  };
}

function setMode(nextMode: "play" | "trace"): void {
  mode = nextMode;
  playModeButton.classList.toggle("active", mode === "play");
  traceModeButton.classList.toggle("active", mode === "trace");
  playStats.hidden = mode !== "play";
  traceStats.hidden = mode !== "trace";
  playControls.hidden = mode !== "play";
  traceControls.hidden = mode !== "trace";
  strokeExport.hidden = mode !== "play";
  canvas.style.cursor = mode === "play" ? "crosshair" : "default";
  tracePlaying = mode === "trace" && tracePlaying;
  resizeCanvas();
  updateUi();
}

async function loadRunBundle(): Promise<void> {
  const file = runBundleInput.files?.[0];
  if (!file) {
    return;
  }

  try {
    const bundle = parseRunBundle(JSON.parse(await file.text()) as unknown);
    traceBundle = bundle;
    traceLevel = bundle.level;
    traceStaticSim = createSimulation(bundle.level);
    traceStrokeLocalPoints = buildTraceStrokeLocalPoints(bundle);
    traceFrameIndex = 0;
    traceAccumulator = 0;
    tracePlaying = false;
    resizeCanvas();
    updateUi();
  } catch (error) {
    traceBundle = null;
    tracePlaying = false;
    statusEl.textContent = "Invalid run";
    levelCopyEl.textContent = error instanceof Error ? error.message : "Could not load this run bundle.";
  }
}

function parseRunBundle(value: unknown): BenchmarkRunBundle {
  if (!isRecord(value)) {
    throw new Error("Run bundle must be a JSON object.");
  }
  if (value.schemaVersion !== 1) {
    throw new Error("Run bundle schemaVersion must be 1.");
  }
  if (!isRecord(value.level) || !isRecord(value.action) || !isRecord(value.result) || !isRecord(value.trace)) {
    throw new Error("Run bundle must include level, action, result, and trace.");
  }

  const bundle = value as unknown as BenchmarkRunBundle;
  if (bundle.level.id !== bundle.action.levelId || bundle.level.id !== bundle.result.levelId || bundle.level.id !== bundle.trace.levelId) {
    throw new Error("Run bundle level IDs do not agree.");
  }
  if (!Array.isArray(bundle.trace.frames)) {
    throw new Error("Run bundle trace.frames must be an array.");
  }
  return bundle;
}

function buildTraceStrokeLocalPoints(bundle: BenchmarkRunBundle): Map<string, Vec2[]> {
  const map = new Map<string, Vec2[]>();
  const setupSim = createSimulation(bundle.level);

  for (const stroke of bundle.action.strokes) {
    const body = setupSim.addStroke(stroke);
    if (body) {
      map.set(body.label, toLocalPoints(prepareStrokePoints(stroke.points), body));
    }
  }

  return map;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("keydown", handleKeydown);
playModeButton.addEventListener("click", () => setMode("play"));
traceModeButton.addEventListener("click", () => setMode("trace"));
levelSelect.addEventListener("change", changeLevel);
canvas.addEventListener("pointerdown", beginStroke);
canvas.addEventListener("pointermove", extendStroke);
canvas.addEventListener("pointerup", finishStroke);
canvas.addEventListener("pointercancel", finishStroke);
toggleRunButton.addEventListener("click", () => {
  running = !running;
  updateUi();
});
togglePhysicsButton.addEventListener("click", () => {
  showPhysicsBodies = !showPhysicsBodies;
  updateUi();
});
resetButton.addEventListener("click", resetLevel);
clearStrokeButton.addEventListener("click", clearStroke);
runBundleInput.addEventListener("change", () => {
  void loadRunBundle();
});
traceScrubber.addEventListener("input", () => {
  setTraceFrame(Number(traceScrubber.value));
  updateUi();
});
tracePlayButton.addEventListener("click", () => {
  if (!traceBundle) {
    return;
  }
  if (traceFrameIndex >= traceBundle.trace.frames.length - 1) {
    setTraceFrame(0);
  }
  tracePlaying = !tracePlaying;
  updateUi();
});
tracePrevButton.addEventListener("click", () => {
  tracePlaying = false;
  setTraceFrame(traceFrameIndex - 1);
  updateUi();
});
traceNextButton.addEventListener("click", () => {
  tracePlaying = false;
  setTraceFrame(traceFrameIndex + 1);
  updateUi();
});
tracePhysicsButton.addEventListener("click", () => {
  showPhysicsBodies = !showPhysicsBodies;
  updateUi();
});
traceSpeedSelect.addEventListener("change", updateUi);

resizeCanvas();
updateUi();
requestAnimationFrame(gameLoop);
