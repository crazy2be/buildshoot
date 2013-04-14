package coords

import (
	"math"
)

type Vec3 struct {
	X float64
	Y float64
	Z float64
}

type World struct {
	X float64
	Y float64
	Z float64
}

func (wc World) Chunk() Chunk {
	floor := func (n float64) int {
		return int(math.Floor(n));
	}
	return Chunk{
		X: floor(wc.X / float64(CHUNK_WIDTH)),
		Y: floor(wc.Y / float64(CHUNK_HEIGHT)),
		Z: floor(wc.Z / float64(CHUNK_DEPTH)),
	}
}

func (wc World) Offset() Offset {
	floor := func (n float64) int {
		return int(math.Floor(n));
	}
	mod := func (a, b int) int {
		return ((a % b) + b) % b
	}
	return Offset{
		X: mod(floor(wc.X), CHUNK_WIDTH),
		Y: mod(floor(wc.Y), CHUNK_HEIGHT),
		Z: mod(floor(wc.Z), CHUNK_DEPTH),
	}
}

type Chunk struct {
	X int
	Y int
	Z int
}

func (cc Chunk) World() World {
	return World{
		X: float64(cc.X * CHUNK_WIDTH),
		Y: float64(cc.Y * CHUNK_HEIGHT),
		Z: float64(cc.Z * CHUNK_DEPTH),
	}
}

type Offset struct {
	X int
	Y int
	Z int
}

const (
	CHUNK_WIDTH  = 32
	CHUNK_DEPTH  = 32
	CHUNK_HEIGHT = 32
)

var CHUNK_SIZE Vec3 = Vec3{
	X: CHUNK_WIDTH,
	Y: CHUNK_HEIGHT,
	Z: CHUNK_DEPTH,
}
