import { clamp, wrapAngle } from '../core/math';
import { BODY_DRAG, BODY_LIFT, LIFT_SLOPE } from './constants';
import type { Flight, FlightInput } from './flight';

/**
 * A simple pilot used for balance tests and the title-screen demo: burn the
 * rocket climbing, then hold the angle of attack for the best glide ratio.
 */
export function autopilot(f: Flight, climbDeg = 32): FlightInput {
  const { glider, sled, rocket } = f.gear;
  const hasFuel = f.fuel > 0 && rocket.thrust > 0;
  if (f.phase !== 'air') return { pitch: 0, boost: hasFuel };

  let target: number;
  const flightAngle = Math.atan2(f.vy, f.vx);
  if (hasFuel) {
    target = (climbDeg * Math.PI) / 180;
  } else {
    const kLift = BODY_LIFT + glider.lift;
    const parasitic = BODY_DRAG * sled.drag * glider.tuck + glider.drag;
    const clBest = Math.sqrt(parasitic / (kLift * glider.induced));
    const stall = (glider.stallDeg * Math.PI) / 180;
    const alpha = Math.min(clBest / LIFT_SLOPE, stall * 0.85);
    target = flightAngle + alpha;
  }
  return { pitch: clamp(wrapAngle(target - f.pitch) * 4, -1, 1), boost: hasFuel };
}
