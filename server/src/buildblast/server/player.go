package main

import (
	"log"
	"math"

	"buildblast/physics"
	"buildblast/coords"
)

type ControlState struct {
	Forward         bool
	Left            bool
	Right           bool
	Back            bool
	Jump            bool
	ActivateBlaster bool
	Lat             float64
	Lon             float64

	Timestamp float64 // In ms
}

var PLAYER_EYE_HEIGHT = 1.6;
var PLAYER_HEIGHT = 1.75;
var PLAYER_BODY_HEIGHT = 1.3;
var PLAYER_DIST_CENTER_EYE = PLAYER_EYE_HEIGHT - PLAYER_BODY_HEIGHT/2;
var PLAYER_HALF_EXTENTS = coords.Vec3{
	0.2,
	PLAYER_HEIGHT / 2,
	0.2,
};
var PLAYER_CENTER_OFFSET = coords.Vec3{
	0,
	-PLAYER_DIST_CENTER_EYE,
	0,
};

// Gameplay state defaults
var PLAYER_MAX_HP = 100;

type Player struct {
	pos       coords.World
	vy        float64
	box       physics.Box
	controls  *ControlState
	history   *PlayerHistory

	// Gameplay state
	hp        int
}

func NewPlayer() *Player {
	return &Player{
		pos: coords.World{
			X: 0,
			Y: 27,
			Z: 0,
		},
		controls: &ControlState{},
		history: NewPlayerHistory(),
		hp: PLAYER_MAX_HP,
	}
}

func (p *Player) simulateStep(c *Client, w *World) (*MsgPlayerState, *MsgDebugRay) {
	var controls *ControlState
	select {
		case controls = <-c.ControlState:
		default: return nil, nil
	}

	dt := (controls.Timestamp - p.controls.Timestamp) / 1000

	if dt > 1.0 {
		log.Println("WARN: Attempt to simulate step with dt of ", dt, " which is too large. Clipping.")
		dt = 1.0
	}

	p.simulateTick(dt, c.world, controls)
	var msgDebugRay *MsgDebugRay
	if controls.ActivateBlaster {
		target := FindIntersection(c.world, p, controls)
		if target != nil {
			msgDebugRay = &MsgDebugRay{
				Pos: *target,
			}
		}
	}

	p.controls = controls
	p.history.Add(controls.Timestamp, p.pos)

	return &MsgPlayerState{
		Pos: p.pos,
		VelocityY: p.vy,
		Timestamp: controls.Timestamp,
		Hp: p.hp,
	}, msgDebugRay
}

func (p *Player) simulateTick(dt float64, world *World, controls *ControlState) {
	p.vy += dt * -9.81

	fw := 0.0
	if controls.Forward {
		fw = 1 * dt * 10
	} else if controls.Back {
		fw = -1 * dt * 10
	}

	rt := 0.0
	if controls.Right {
		rt = 1 * dt * 10
	} else if controls.Left {
		rt = -1 * dt * 10
	}

	cos := math.Cos
	sin := math.Sin

	move := coords.Vec3{
		X: -cos(controls.Lon) * fw + sin(controls.Lon) * rt,
		Y: p.vy * dt,
		Z: -sin(controls.Lon) * fw - cos(controls.Lon) * rt,
	}

	box := physics.NewBoxOffset(p.pos, PLAYER_HALF_EXTENTS, PLAYER_CENTER_OFFSET)

	move = box.AttemptMove(world, move)

	if (move.Y == 0) {
		if (controls.Jump) {
			p.vy = 6
		} else {
			p.vy = 0
		}
	}

	p.pos.X += move.X
	p.pos.Y += move.Y
	p.pos.Z += move.Z
}

func (p *Player) hurt(dmg int) bool {
	p.hp -= dmg
	return p.dead()
}

func (p *Player) heal(hps int) {
	p.hp += hps
}

func (p *Player) dead() bool {
	return p.hp <= 0
}

type PlayerHistoryEntry struct {
	pos coords.World
	// JavaScript performance.now() timestamp.
	t float64
}

type PlayerHistory struct {
	buf []PlayerHistoryEntry
	offset int
}

func NewPlayerHistory() *PlayerHistory {
	p := new(PlayerHistory)
	p.buf = make([]PlayerHistoryEntry, 100)
	return p
}

func (p *PlayerHistory) Add(t float64, pos coords.World) {
	p.buf[p.offset] = PlayerHistoryEntry{pos, t}
	p.offset++
	if p.offset >= len(p.buf) {
		p.offset = 0
	}
}

// If t > most recent time added, return most recent
// position added. If t < ring buffer history, return
// oldest position stored. If t == an entry in the
// ring buffer, return that entry. If t is between
// two entries in the ring buffer, interpolate
// between them.
func (p *PlayerHistory) PositionAt(t float64) coords.World {
	l := len(p.buf)

	newest := p.buf[((p.offset - 1) + l) % l]
	if newest.t <= t {
		// We could extrapolate, but this should do.
		return newest.pos
	}

	oldest := p.buf[(p.offset + l) % l]
	if oldest.t >= t {
		return oldest.pos
	}

	var older PlayerHistoryEntry
	var newer PlayerHistoryEntry
	for i := 1; i <= l; i++ {
		older = p.buf[((p.offset - i) + l) % l]
		if older.t <= t {
			break
		}
		newer = older
	}

	if older.t == t {
		return older.pos
	}

	p1 := older.pos
	p3 := newer.pos

	// t1        t2     t3
	// |          |     |
	// older.t    t   newer.t
	t13 := newer.t - older.t
	t12 := t - older.t

	r := t12 / t13
	p13 := coords.Vec3{
		X: p3.X - p1.X,
		Y: p3.Y - p1.Y,
		Z: p3.Z - p1.Z,
	}

	return coords.World{
		X: p1.X + p13.X*r,
		Y: p1.Y + p13.Y*r,
		Z: p1.Z + p13.Z*r,
	}
}
