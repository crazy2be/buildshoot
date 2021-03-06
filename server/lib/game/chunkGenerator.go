package game

import (
	"runtime"
	"sync"
	"time"

	"buildblast/server/lib/coords"
	"buildblast/server/lib/mapgen"
)

type ChunkGenerator struct {
	// Chunks are sent to this channel as they are generated
	Generated chan ChunkGenerationResult

	chunks       map[coords.Chunk]ChunkStatus
	mutex        sync.Mutex
	queuedChunks chan coords.Chunk
	generator    mapgen.Generator
}

type ChunkGenerationResult struct {
	cc    coords.Chunk
	chunk *mapgen.Chunk
}

type State int

const (
	Queued     State = iota
	Generating State = iota
	Generated  State = iota
)

type ChunkStatus struct {
	state    State
	priority int
}

func NewChunkGenerator(generator mapgen.Generator) *ChunkGenerator {
	cm := new(ChunkGenerator)
	cm.chunks = make(map[coords.Chunk]ChunkStatus, 10)
	cm.generator = generator

	// The number of workers we will run.
	maxActiveThreads := runtime.NumCPU() - 1
	if maxActiveThreads < 1 {
		maxActiveThreads = 1
	}

	// Room for 2*workers worth of work and results.
	cm.Generated = make(chan ChunkGenerationResult, maxActiveThreads*2)
	cm.queuedChunks = make(chan coords.Chunk, maxActiveThreads*2)

	// Start the workers.
	for i := 0; i < maxActiveThreads; i++ {
		go cm.runGenerationWorker()
	}

	return cm
}

// cm.Lock() MUST BE HELD by the caller, or else calling
// this function is unsafe.
func (cm *ChunkGenerator) queue(cc coords.Chunk, priority int) {
	status := cm.chunks[cc]
	if status.state != Queued {
		// Only adjust the priority if it is still queued.
		return
	}
	status.priority += priority
	cm.chunks[cc] = status
}

func (cm *ChunkGenerator) QueueChunksNearby(wc coords.World) {
	cm.mutex.Lock()
	defer cm.mutex.Unlock()

	queue := func(cc coords.Chunk, priority int) {
		cm.queue(cc, priority)
	}

	EachChunkNearby(wc, queue)
}

func (cm *ChunkGenerator) Top() (cc coords.Chunk, valid bool) {
	cm.mutex.Lock()
	defer cm.mutex.Unlock()

	highest := -1
	for key, val := range cm.chunks {
		if val.priority > highest && val.state == Queued {
			highest = val.priority
			cc = key
		}
	}
	if highest != -1 {
		return cc, true
	}
	return cc, false
}

func (cm *ChunkGenerator) Run() {
	for {
		cc, valid := cm.Top()
		if !valid {
			<-time.After(time.Second / 60)
			continue
		}

		cm.mutex.Lock()
		status := cm.chunks[cc]
		status.state = Generating
		cm.chunks[cc] = status
		cm.mutex.Unlock()

		cm.queuedChunks <- cc
	}
}

func (cm *ChunkGenerator) runGenerationWorker() {
	for {
		cc := <-cm.queuedChunks
		chunk := cm.generator.Chunk(cc)

		cm.Generated <- ChunkGenerationResult{
			cc:    cc,
			chunk: chunk,
		}
		cm.mutex.Lock()
		status := cm.chunks[cc]
		status.state = Generated
		cm.chunks[cc] = status
		cm.mutex.Unlock()
	}
}

func EachChunkNearby(wc coords.World, cb func(cc coords.Chunk, priority int)) {
	occ := func(cc coords.Chunk, x, y, z int) coords.Chunk {
		return coords.Chunk{
			X: cc.X + x,
			Y: cc.Y + y,
			Z: cc.Z + z,
		}
	}

	eachWithin := func(cc coords.Chunk, xdist, ydist, zdist int, cb func(newCC coords.Chunk, dist int)) {
		abs := func(n int) int {
			if n < 0 {
				return -n
			}
			return n
		}
		dist := func(x, y, z int) int {
			return abs(x) + abs(y) + abs(z)
		}

		cb(cc, 0)
		for x := -xdist; x <= xdist; x++ {
			for y := -ydist; y <= ydist; y++ {
				for z := -zdist; z <= zdist; z++ {
					cb(occ(cc, x, y, z), dist(x, y, z))
				}
			}
		}
	}

	cc := wc.Chunk()
	eachWithin(cc, 2, 1, 2, func(newCC coords.Chunk, dist int) {
		// We want to prioritize further away chunks lower, but the
		// priority must be a positive integer.
		cb(newCC, 10-dist)
	})

	oc := wc.Offset()
	if oc.Y <= 4 {
		cb(occ(cc, 0, -1, 0), 1)
	} else if oc.Y >= 28 {
		cb(occ(cc, 0, 1, 0), 1)
	}
}
