import { Body, Bodies, Vector } from "matter-js";
import type { StrokeAction, Vec2 } from "./types";

const MIN_POINT_DISTANCE = 28;
const RESAMPLE_DISTANCE = 96;
const MIN_SEGMENT_LENGTH = 6;
const SMOOTHING_PASSES = 2;

export function simplifyStrokePoints(points: Vec2[], minDistance = MIN_POINT_DISTANCE): Vec2[] {
  if (points.length <= 2) {
    return points;
  }

  const simplified: Vec2[] = [points[0]];
  for (const point of points.slice(1, -1)) {
    const last = simplified[simplified.length - 1];
    if (Vector.magnitude(Vector.sub(point, last)) >= minDistance) {
      simplified.push(point);
    }
  }
  simplified.push(points[points.length - 1]);

  return simplified;
}

export function prepareStrokePoints(points: Vec2[]): Vec2[] {
  return resampleStrokePoints(smoothStrokePoints(simplifyStrokePoints(points)), RESAMPLE_DISTANCE);
}

export function measureStrokeLength(points: Vec2[]): number {
  return points.reduce((total, point, index) => {
    if (index === 0) {
      return total;
    }
    return total + Vector.magnitude(Vector.sub(point, points[index - 1]));
  }, 0);
}

export function createStrokeBody(stroke: StrokeAction): Body | null {
  const points = prepareStrokePoints(stroke.points);
  if (points.length < 2 || measureStrokeLength(points) < MIN_SEGMENT_LENGTH) {
    return null;
  }

  const width = Math.max(8, stroke.width);
  const parts: Body[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);

    if (length < MIN_SEGMENT_LENGTH) {
      continue;
    }

    const center = {
      x: start.x + dx / 2,
      y: start.y + dy / 2,
    };
    const angle = Math.atan2(dy, dx);
    parts.push(
      Bodies.rectangle(center.x, center.y, length + width * 2.4, width, {
        angle,
        friction: 0.25,
        frictionStatic: 0.2,
        restitution: 0,
        slop: 1.2,
        chamfer: {
          radius: width / 2,
        },
      }),
    );
  }

  for (const point of [points[0], points[points.length - 1]]) {
    parts.push(
      Bodies.circle(point.x, point.y, width / 2, {
        friction: 0.25,
        frictionStatic: 0.2,
        restitution: 0,
        slop: 1.2,
      }),
    );
  }

  if (parts.length === 0) {
    return null;
  }

  return Body.create({
    label: `stroke:${stroke.id}`,
    parts,
    density: 0.0028,
    friction: 0.18,
    frictionStatic: 0.2,
    frictionAir: 0.008,
    restitution: 0.05,
    slop: 1.2,
    render: {
      fillStyle: "#f8f8f2",
      strokeStyle: "#151922",
      lineWidth: 2,
    },
  });
}

function smoothStrokePoints(points: Vec2[]): Vec2[] {
  if (points.length < 3) {
    return points;
  }

  let smoothed = points;
  for (let pass = 0; pass < SMOOTHING_PASSES; pass += 1) {
    const next: Vec2[] = [smoothed[0]];
    for (let index = 0; index < smoothed.length - 1; index += 1) {
      const current = smoothed[index];
      const following = smoothed[index + 1];
      next.push(
        {
          x: current.x * 0.75 + following.x * 0.25,
          y: current.y * 0.75 + following.y * 0.25,
        },
        {
          x: current.x * 0.25 + following.x * 0.75,
          y: current.y * 0.25 + following.y * 0.75,
        },
      );
    }
    next.push(smoothed[smoothed.length - 1]);
    smoothed = next;
  }

  return smoothed;
}

function resampleStrokePoints(points: Vec2[], spacing: number): Vec2[] {
  if (points.length < 2) {
    return points;
  }

  const resampled: Vec2[] = [points[0]];
  let remaining = spacing;
  let segmentStart = points[0];

  for (let index = 1; index < points.length; index += 1) {
    let segmentEnd = points[index];
    let segmentLength = Vector.magnitude(Vector.sub(segmentEnd, segmentStart));

    while (segmentLength >= remaining) {
      const ratio = remaining / segmentLength;
      const point = {
        x: segmentStart.x + (segmentEnd.x - segmentStart.x) * ratio,
        y: segmentStart.y + (segmentEnd.y - segmentStart.y) * ratio,
      };
      resampled.push(point);
      segmentStart = point;
      segmentLength = Vector.magnitude(Vector.sub(segmentEnd, segmentStart));
      remaining = spacing;
    }

    remaining -= segmentLength;
    segmentStart = segmentEnd;
  }

  const lastInput = points[points.length - 1];
  const lastOutput = resampled[resampled.length - 1];
  if (Vector.magnitude(Vector.sub(lastInput, lastOutput)) > 1) {
    resampled.push(lastInput);
  }

  return resampled;
}
