package coords

import (
	"math"
	"encoding/binary"
	"hash/fnv"
)

type Vec3 struct {
	X float64
	Y float64
	Z float64
}

func (vec *Vec3) Dist(to *Vec3) float64 {
	dx := vec.X - to.X
	dy := vec.Y - to.Y
	dz := vec.Z - to.Z
	return math.Sqrt(dx*dx + dy*dy + dz*dz)
}

func (vec *Vec3) Length() float64 {
	x := vec.X; y := vec.Y; z := vec.Z
	return math.Sqrt(x*x + y*y + z*z)
}

func (vec *Vec3) SetLength(n float64) {
	mag := vec.Length()
	r := n / mag
	vec.X *= r
	vec.Y *= r
	vec.Z *= r
}

func (vec *Vec3) Add(other *Vec3) {
	vec.X += other.X
	vec.Y += other.Y
	vec.Z += other.Z
}

type World Vec3

func (wc World) Chunk() Chunk {
	return wc.Block().Chunk()
}

func (wc World) Offset() Offset {
	return wc.Block().Offset()
}

func (wc World) Block() Block {
	floor := func (n float64) int {
		return int(math.Floor(n))
	}
	return Block{
		X: floor(wc.X),
		Y: floor(wc.Y),
		Z: floor(wc.Z),
	}
}

func (wc World) Hash() uint32 {
	hash := fnv.New32a()
	temp := make([]byte, 8)

	binary.BigEndian.PutUint64(temp, math.Float64bits(wc.X))
	hash.Write(temp)

	binary.BigEndian.PutUint64(temp, math.Float64bits(wc.Y))
	hash.Write(temp)

	binary.BigEndian.PutUint64(temp, math.Float64bits(wc.Z))
	hash.Write(temp)

	return hash.Sum32()
}

type Block struct {
	X int
	Y int
	Z int
}

func (bc Block) Chunk() Chunk {
	div := func (a, b int) int {
		if (a < 0) {
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
	mod := func (a, b int) int {
		return ((a % b) + b) % b
	}
	return Offset{
		X: mod(bc.X, ChunkWidth),
		Y: mod(bc.Y, ChunkHeight),
		Z: mod(bc.Z, ChunkDepth),
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

const (
	ChunkWidth = 32
	ChunkDepth = 32
	ChunkHeight = 32
)

var ChunkSize Vec3 = Vec3{
	X: ChunkWidth,
	Y: ChunkHeight,
	Z: ChunkDepth,
}
