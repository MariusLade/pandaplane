/** World & physics constants shared by simulation and rendering. Units: metres, seconds. */
export const GRAVITY = 9.81;
/** Scale height of the (very compressed) atmosphere; air thins with altitude. */
export const ATMO_SCALE = 2600;
/** Height of the plateau the ramp stands on, above the valley floor. */
export const CLIFF_HEIGHT = 40;
/** Horizontal run of the cliff face. */
export const CLIFF_RUN = 38;
/** Distance that counts as "reaching Panda Paradise". */
export const GOAL_DISTANCE = 7000;
/** Panda's collision radius against the ground. */
export const PANDA_RADIUS = 0.45;
/** Radius used when collecting pickups. */
export const PICKUP_REACH = 1.2;

/** Quadratic drag of the panda's body (per metre). */
export const BODY_DRAG = 0.0026;
/** Extra drag when flying broadside (belly into the wind). */
export const BROADSIDE_DRAG = 2.2;
/** A tiny bit of lift from a flat panda belly. */
export const BODY_LIFT = 0.0007;
/** Flat-plate drag of a wing meeting the air broadside (stalled). */
export const WING_PLATE_DRAG = 1.2;
/** Lift curve slope per radian. */
export const LIFT_SLOPE = 5.2;
/** Pitch rate from player input (rad/s). */
export const PITCH_RATE = 2.4;
/** Normal-speed threshold above which the panda bounces. */
export const BOUNCE_SPEED = 7;
export const RESTITUTION = 0.3;
/** Base ground friction (added to the sled's friction). */
export const GROUND_FRICTION = 0.24;
/** Friction applied to the hard part of an impact. */
export const IMPACT_FRICTION = 0.12;

export const RING_BOOST = 9;
export const BALLOON_LIFT = 16;
