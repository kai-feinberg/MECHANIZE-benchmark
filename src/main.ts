import { Body, Composite } from "matter-js";
import "./styles.css";
import { levels } from "./sim/level";
import { createSimulation } from "./sim/simulation";
import { measureStrokeLength, prepareStrokePoints } from "./sim/strokeBody";
import type { StrokeAction, Vec2 } from "./sim/types";

const canvas = requireElement<HTMLCanvasElement>("#game");
const levelTitleEl = requireElement<HTMLElement>("#level-title");
const levelCopyEl = requireElement<HTMLElement>("#level-copy");
const statusEl = requireElement<HTMLElement>("#status");
const goalEl = requireElement<HTMLElement>("#goal");
const levelSelect = requireElement<HTMLSelectElement>("#level-select");
const strokeCountEl = requireElement<HTMLElement>("#stroke-count");
const strokeJsonEl = requireElement<HTMLTextAreaElement>("#stroke-json");
const toggleRunButton = requireElement<HTMLButtonElement>("#toggle-run");
const togglePhysicsButton = requireElement<HTMLButtonElement>("#toggle-physics");
const resetButton = requireElement<HTMLButtonElement>("#reset");
const clearStrokeButton = requireElement<HTMLButtonElement>("#clear-stroke");
const context = requireCanvasContext(canvas);

let sim = createSimulation(levels[0]);
const pointerScale = { x: 1, y: 1 };
let running = true;
let drawing = false;
let activeStroke: Vec2[] = [];
let committedStroke: StrokeAction | null = null;
let committedStrokeBody: Body | null = null;
let committedStrokeLocalPoints: Vec2[] = [];
let showPhysicsBodies = false;
let lastFrameTime = performance.now();
let accumulator = 0;

const strokeWidth = 18;

function resizeCanvas(): void {
  const parent = canvas.parentElement;
  if (!parent) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const availableWidth = parent.clientWidth;
  const availableHeight = parent.clientHeight;
  const worldAspect = sim.level.world.width / sim.level.world.height;
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
  pointerScale.x = canvas.width / sim.level.world.width;
  pointerScale.y = canvas.height / sim.level.world.height;
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
  committedStrokeLocalPoints = committedStrokeBody ? toLocalPoints(prepareStrokePoints(committedStroke.points), committedStrokeBody) : [];
  activeStroke = [];
  updateUi();
}

function clearStroke(): void {
  sim.reset();
  committedStroke = null;
  committedStrokeBody = null;
  committedStrokeLocalPoints = [];
  activeStroke = [];
  running = true;
  updateUi();
}

function resetLevel(): void {
  sim.reset();
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

  if (running && !sim.goal.achieved) {
    accumulator += elapsed;
    while (accumulator >= 1000 / 60) {
      sim.step();
      accumulator -= 1000 / 60;
    }
  }

  render();
  updateUi();
  requestAnimationFrame(gameLoop);
}

function render(): void {
  context.save();
  context.scale(pointerScale.x, pointerScale.y);
  drawBoard();
  drawInstruction();

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

  if (sim.goal.achieved) {
    drawSuccess();
  }

  context.restore();
}

function drawBoard(): void {
  const { width, height } = sim.level.world;
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

function drawInstruction(): void {
  context.save();
  context.fillStyle = "rgba(248, 251, 252, 0.9)";
  context.font = "48px Inter, Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "top";
  context.fillText(sim.level.instruction, sim.level.world.width / 2, 94);
  context.restore();
}

function drawBody(body: Body): void {
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

function getBodyFill(body: Body): string {
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

function getBodyStroke(body: Body): string {
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

function drawCommittedStroke(body: Body, localPoints: Vec2[]): void {
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

function drawSuccess(): void {
  context.save();
  context.fillStyle = "rgba(18, 24, 30, 0.74)";
  context.fillRect(320, 268, 360, 114);
  context.strokeStyle = "#f4bd37";
  context.lineWidth = 3;
  context.strokeRect(320, 268, 360, 114);
  context.fillStyle = "#ffffff";
  context.font = "34px Inter, Arial, sans-serif";
  context.textAlign = "center";
  context.fillText("Success", 500, 322);
  context.font = "18px Inter, Arial, sans-serif";
  context.fillText("The ball stayed off the ground.", 500, 352);
  context.restore();
}

function updateUi(): void {
  if (sim.goal.achieved) {
    statusEl.textContent = "Success";
  } else if (!running) {
    statusEl.textContent = "Paused";
  } else if (sim.level.goal.type === "hit-left-wall") {
    statusEl.textContent = sim.goal.leftWallContact ? "Wall contact" : "Get to the left wall";
  } else if (committedStroke) {
    statusEl.textContent = `Off ground ${sim.goal.consecutiveOffGroundFrames} / ${sim.goal.requiredOffGroundFrames}`;
  } else {
    statusEl.textContent = "Draw one stroke";
  }

  goalEl.textContent =
    sim.level.goal.type === "hit-left-wall"
      ? "Hit the left wall"
      : `Off ground for ${sim.goal.requiredOffGroundFrames} frames`;
  levelTitleEl.textContent = sim.level.instruction;
  levelCopyEl.textContent =
    sim.level.goal.type === "hit-left-wall"
      ? "Draw one light touch, ramp, or nudge to roll the small ball out of the cup and into the target wall."
      : "Draw one heavy stroke. Release to let it fall, push, tip, or wedge the ball upward.";
  toggleRunButton.textContent = running ? "Pause" : "Run";
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

function toLocalPoints(points: Vec2[], body: Body): Vec2[] {
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

function toWorldPoint(point: Vec2, body: Body): Vec2 {
  const cos = Math.cos(body.angle);
  const sin = Math.sin(body.angle);
  return {
    x: body.position.x + point.x * cos - point.y * sin,
    y: body.position.y + point.x * sin + point.y * cos,
  };
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("keydown", handleKeydown);
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

resizeCanvas();
updateUi();
requestAnimationFrame(gameLoop);
