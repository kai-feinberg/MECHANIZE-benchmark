import type { CandidateAction, CandidateFile } from "./types";
import type { LevelDefinition, StrokeAction, Vec2 } from "../sim/types";

const MAX_POINTS_PER_STROKE = 160;
const MAX_STROKE_WIDTH = 80;
const MIN_STROKE_WIDTH = 1;

export function parseCandidateFile(value: unknown, levels: readonly LevelDefinition[]): CandidateAction[] {
  if (isRecord(value) && Array.isArray(value.candidates)) {
    return value.candidates.map((candidate, index) => parseCandidate(candidate, levels, `candidates[${index}]`));
  }

  return [parseCandidate(value, levels, "candidate")];
}

export function validateCandidateFile(value: unknown, levels: readonly LevelDefinition[]): CandidateFile {
  const candidates = parseCandidateFile(value, levels);
  return candidates.length === 1 ? candidates[0] : { candidates };
}

function parseCandidate(value: unknown, levels: readonly LevelDefinition[], path: string): CandidateAction {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object.`);
  }

  const levelId = requireString(value.levelId, `${path}.levelId`);
  const level = levels.find((candidateLevel) => candidateLevel.id === levelId);
  if (!level) {
    throw new Error(`${path}.levelId is unknown: ${levelId}`);
  }

  if (!Array.isArray(value.strokes)) {
    throw new Error(`${path}.strokes must be an array.`);
  }
  if (value.strokes.length > level.limits.maxStrokes) {
    throw new Error(`${path}.strokes exceeds max stroke count ${level.limits.maxStrokes}.`);
  }

  return {
    levelId,
    strokes: value.strokes.map((stroke, index) => parseStroke(stroke, level, `${path}.strokes[${index}]`)),
  };
}

function parseStroke(value: unknown, level: LevelDefinition, path: string): StrokeAction {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object.`);
  }

  const id = requireString(value.id, `${path}.id`);
  const width = requireFiniteNumber(value.width, `${path}.width`);
  if (width < MIN_STROKE_WIDTH || width > MAX_STROKE_WIDTH) {
    throw new Error(`${path}.width must be between ${MIN_STROKE_WIDTH} and ${MAX_STROKE_WIDTH}.`);
  }

  if (!Array.isArray(value.points)) {
    throw new Error(`${path}.points must be an array.`);
  }
  if (value.points.length < 2) {
    throw new Error(`${path}.points must contain at least two points.`);
  }
  if (value.points.length > MAX_POINTS_PER_STROKE) {
    throw new Error(`${path}.points exceeds max point count ${MAX_POINTS_PER_STROKE}.`);
  }

  return {
    id,
    width,
    points: value.points.map((point, index) => parsePoint(point, level, `${path}.points[${index}]`)),
  };
}

function parsePoint(value: unknown, level: LevelDefinition, path: string): Vec2 {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object.`);
  }

  const x = requireFiniteNumber(value.x, `${path}.x`);
  const y = requireFiniteNumber(value.y, `${path}.y`);
  if (x < 0 || x > level.world.width || y < 0 || y > level.world.height) {
    throw new Error(`${path} must be inside world bounds ${level.world.width} x ${level.world.height}.`);
  }

  return { x, y };
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string.`);
  }
  return value;
}

function requireFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
