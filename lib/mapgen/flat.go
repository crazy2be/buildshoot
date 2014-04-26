package mapgen

import (
	"math/rand"

	"buildblast/lib/coords"
)

type FlatWorld struct {
	randGen *rand.Rand
	seed    float64
}

// Take seed to be consistent with all the other world types
func NewFlatWorld(seed float64) *FlatWorld {
	fw := new(FlatWorld)
	fw.seed = seed
	fw.randGen = rand.New(rand.NewSource(int64(seed)))
	return fw
}

func (fw *FlatWorld) Block(bc coords.Block) Block {
	fw.seedRand(bc)

	if bc.X == 0 && bc.Y == 16 && bc.Z == 0 {
		return BLOCK_SPAWN
	}
	if bc.Y < 15 {
		return BLOCK_DIRT
	}
	if bc.Y == 15 {
		return BLOCK_GRASS
	}
	if bc.X%4 == 0 && bc.Z%4 == 0 && bc.Y < 17 {
		randBlock := 5 + fw.randGen.Int()%9
		return Block(randBlock)
	}
	return BLOCK_AIR
}

func (fw *FlatWorld) Chunk(cc coords.Chunk) *Chunk {
	return generateChunk(fw, cc)
}

func (fw *FlatWorld) seedRand(bc coords.Block) {
	blockSeed := int64(bc.X)
	blockSeed += int64(bc.Y) << 32
	blockSeed += int64(bc.Z) << 16
	blockSeed += int64(fw.seed)
	fw.randGen.Seed(blockSeed)
}
