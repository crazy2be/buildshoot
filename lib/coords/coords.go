package coords

import (
	"math"
)

// Vec3 is a generic three-dimensional vector.
// Generally, prefer using one of the more meaningful
// vector types that conveys not only that the
// variable is a 3d vector, but also what that 3d
// vector represents, such as a look direction,
// location in 3d space, etc.
type Vec3 struct {
	X float64
	Y float64
	Z float64
}

type Direction struct {
	X float64
	Y float64
	Z float64
}

func (d Direction) Length() float64 {
	return math.Sqrt(d.X*d.X + d.Y*d.Y + d.Z*d.Z)
}

func (d Direction) SetLength(newLen float64) Direction {
	ratio := newLen / d.Length()
	return Direction{
		X: d.X * ratio,
		Y: d.Y * ratio,
		Z: d.Z * ratio,
	}
}

// World represents a position in the 3d world.
type World struct {
	X float64
	Y float64
	Z float64
}

func (wc World) Move(d Direction, amount float64) World {
	d = d.SetLength(amount)
	return World{
		X: wc.X + d.X,
		Y: wc.Y + d.Y,
		Z: wc.Z + d.Z,
	}
}

// alpha: [0, 1]. How much of "other" should be in
// the result. (alpha of 0 => wc, alpha of 1 => other).
func (wc World) Lerp(other World, alpha float64) World {
	return World{
		X: wc.X*(1-alpha) + other.X*alpha,
		Y: wc.Y*(1-alpha) + other.Y*alpha,
		Z: wc.Z*(1-alpha) + other.Z*alpha,
	}
}

func (wc World) Chunk() Chunk {
	return wc.Block().Chunk()
}

func (wc World) Offset() Offset {
	return wc.Block().Offset()
}

func (wc World) Block() Block {
	floor := func(n float64) int {
		return int(math.Floor(n))
	}
	return Block{
		X: floor(wc.X),
		Y: floor(wc.Y),
		Z: floor(wc.Z),
	}
}

// Block represents the coordinates of any block in the world. It represents
// the same units as World, but without any precision (because blocks can only
// exist at integer boundries).
type Block struct {
	X int
	Y int
	Z int
}

func (bc Block) Chunk() Chunk {
	div := func(a, b int) int {
		if a < 0 {
			// By default, integer division in go, like in C,
			// "truncates towards zero". However, we want
			// to floor the result of the division, "truncating
			// towards negative infinity". Hence, we use this
			// crazy snippit. See
			// http://stackoverflow.com/questions/2745074/fast-ceiling-of-an-integer-division-in-c-c
			// http://stackoverflow.com/questions/921180/how-can-i-ensure-that-a-division-of-integers-is-always-rounded-up
			// http://www.cs.nott.ac.uk/~rcb/G51MPC/slides/NumberLogic.pdf
			return -((b - a - 1) / b)
		}
		return a / b
	}
	return Chunk{
		X: div(bc.X, ChunkWidth),
		Y: div(bc.Y, ChunkHeight),
		Z: div(bc.Z, ChunkDepth),
	}
}

func (bc Block) Offset() Offset {
	mod := func(a, b int) int {
		return ((a % b) + b) % b
	}
	return Offset{
		X: mod(bc.X, ChunkWidth),
		Y: mod(bc.Y, ChunkHeight),
		Z: mod(bc.Z, ChunkDepth),
	}
}

func (bc Block) Center() World {
	return World{
		X: float64(bc.X) + 0.5,
		Y: float64(bc.Y) + 0.5,
		Z: float64(bc.Z) + 0.5,
	}
}

type Chunk struct {
	X int
	Y int
	Z int
}

type Offset struct {
	X int
	Y int
	Z int
}

// Given an integer 0 <= index < BlocksPerChunk, returns the offset
// coordinate for that index in "standard" packed format. This
// logic is duplicated on the client.
func IndexOffset(index int) Offset {
	return Offset{
		X: index / (ChunkWidth * ChunkHeight),
		Y: index / ChunkWidth % ChunkHeight,
		Z: index % ChunkDepth,
	}
}

func EachOffset(cb func(oc Offset)) {
	for ocX := 0; ocX < ChunkWidth; ocX++ {
		for ocY := 0; ocY < ChunkHeight; ocY++ {
			for ocZ := 0; ocZ < ChunkDepth; ocZ++ {
				cb(Offset{X: ocX, Y: ocY, Z: ocZ})
			}
		}
	}
}

func EachBlock(cc Chunk, cb func(oc Offset, bc Block)) {
	ox := cc.X * ChunkWidth
	oy := cc.Y * ChunkHeight
	oz := cc.Z * ChunkHeight
	for ocX := 0; ocX < ChunkWidth; ocX++ {
		x := ox + ocX
		for ocY := 0; ocY < ChunkHeight; ocY++ {
			y := oy + ocY
			for ocZ := 0; ocZ < ChunkDepth; ocZ++ {
				cb(Offset{X: ocX, Y: ocY, Z: ocZ}, Block{X: x, Y: y, Z: oz + ocZ})
			}
		}
	}

}

func (oc Offset) Block(cc Chunk) Block {
	return Block{
		X: oc.X + cc.X*ChunkWidth,
		Y: oc.Y + cc.Y*ChunkHeight,
		Z: oc.Z + cc.Z*ChunkDepth,
	}
}

// Index is the inverse of IndexOffset. Given a chunk offset coordinate,
// it returns the offset into the standard packed chunk representation.
// This logic is duplicated on the client.
func (oc Offset) Index() int {
	return oc.X*ChunkWidth*ChunkHeight +
		oc.Y*ChunkWidth +
		oc.Z
}

const (
	ChunkWidth     = 32
	ChunkHeight    = 32
	ChunkDepth     = 32
	BlocksPerChunk = ChunkWidth * ChunkHeight * ChunkDepth
)

var ChunkSize Vec3 = Vec3{
	X: ChunkWidth,
	Y: ChunkHeight,
	Z: ChunkDepth,
}

var Origin World = World{
	X: 0,
	Y: 0,
	Z: 0,
}
