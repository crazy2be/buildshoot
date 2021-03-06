package mapgen

import (
	"buildblast/server/lib/coords"
)

type Generator interface {
	Chunk(cc coords.Chunk) *Chunk
}

type blockGenerator interface {
	Block(bc coords.Block) Block
}

type BlockSource interface {
	Block(bc coords.Block) Block
}
