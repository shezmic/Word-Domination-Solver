// Simple Bincode encoder/decoder for specific messages
// Rust bincode layout:
// - Fixed size integers: Little Endian
// - Enums: u32 variant index, then data
// - Strings: u64 length, then utf8 bytes
// - Arrays/Vecs: u64 length, then elements
// - Structs: fields in order

import { ScoredMove, ClientMsg } from './types';

export type ServerMsg =
    | { type: 'Progress'; moves_evaluated: number; best_score: number }
    | { type: 'Result'; moves: ScoredMove[]; confidence: number; compute_time_ms: number }
    | { type: 'BoardStored'; board_hash: bigint }
    | { type: 'Error'; message: string };

export class BincodeEncoder {
    buffer: Uint8Array;
    view: DataView;
    offset: number;

    constructor(size: number = 1024) {
        this.buffer = new Uint8Array(size);
        this.view = new DataView(this.buffer.buffer);
        this.offset = 0;
    }

    ensureCapacity(needed: number) {
        if (this.offset + needed > this.buffer.length) {
            const newBuffer = new Uint8Array(Math.max(this.buffer.length * 2, this.offset + needed));
            newBuffer.set(this.buffer);
            this.buffer = newBuffer;
            this.view = new DataView(this.buffer.buffer);
        }
    }

    writeU8(val: number) {
        this.ensureCapacity(1);
        this.view.setUint8(this.offset, val);
        this.offset += 1;
    }

    writeU16(val: number) {
        this.ensureCapacity(2);
        this.view.setUint16(this.offset, val, true); // Little Endian
        this.offset += 2;
    }

    writeU32(val: number) {
        this.ensureCapacity(4);
        this.view.setUint32(this.offset, val, true);
        this.offset += 4;
    }

    writeU64(val: bigint) {
        this.ensureCapacity(8);
        this.view.setBigUint64(this.offset, val, true);
        this.offset += 8;
    }

    writeBytes(bytes: Uint8Array) {
        this.ensureCapacity(bytes.length);
        this.buffer.set(bytes, this.offset);
        this.offset += bytes.length;
    }

    writeVecU8(vec: number[]) {
        this.writeU64(BigInt(vec.length));
        for (const val of vec) {
            this.writeU8(val);
        }
    }

    getBytes(): Uint8Array {
        return this.buffer.slice(0, this.offset);
    }
}

export class BincodeDecoder {
    view: DataView;
    offset: number;
    textDecoder: TextDecoder;

    constructor(buffer: ArrayBuffer | Uint8Array) {
        const buf = buffer instanceof Uint8Array ? buffer.buffer : buffer;
        this.view = new DataView(buf);
        this.offset = 0;
        this.textDecoder = new TextDecoder();
    }

    readU8(): number {
        const val = this.view.getUint8(this.offset);
        this.offset += 1;
        return val;
    }

    readU16(): number {
        const val = this.view.getUint16(this.offset, true);
        this.offset += 2;
        return val;
    }

    readU32(): number {
        const val = this.view.getUint32(this.offset, true);
        this.offset += 4;
        return val;
    }

    readU64(): bigint {
        const val = this.view.getBigUint64(this.offset, true);
        this.offset += 8;
        return val;
    }

    readF32(): number {
        const val = this.view.getFloat32(this.offset, true);
        this.offset += 4;
        return val;
    }

    readString(): string {
        const len = Number(this.readU64());
        const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, len);
        this.offset += len;
        return this.textDecoder.decode(bytes);
    }
}

export function encodeClientMsg(msg: ClientMsg): Uint8Array {
    const encoder = new BincodeEncoder();

    if (msg === 'Cancel') {
        encoder.writeU32(2); // Variant 2: Cancel
    } else if ('Analyze' in msg) {
        const analyze = msg.Analyze;
        encoder.writeU32(0); // Variant 0: Analyze
        encoder.writeU64(BigInt(analyze.board_hash));

        // Rack: Vec<u8>
        encoder.writeVecU8(analyze.rack);

        // AnalysisMode enum
        const mode = analyze.mode;
        if (typeof mode === 'object' && mode.type === 'greedy') {
            encoder.writeU32(0);
        } else if (typeof mode === 'object' && mode.type === 'beam') {
            encoder.writeU32(1);
            encoder.writeU8(mode.width);
        } else if (typeof mode === 'object' && mode.type === 'mcts') {
            encoder.writeU32(2);
            encoder.writeU8(mode.width);
            encoder.writeU8(mode.depth);
        } else {
            // Default to Greedy if unknown
            encoder.writeU32(0);
        }

        encoder.writeU64(BigInt(analyze.time_budget_ms)); // u64

        // custom_points: Option<[i8; 27]>
        if (analyze.custom_points && analyze.custom_points.length === 27) {
            encoder.writeU8(1); // Some
            for (let i = 0; i < 27; i++) {
                encoder.writeU8(analyze.custom_points[i]);
            }
        } else {
            encoder.writeU8(0); // None
        }

    } else if ('UpdateBoard' in msg) {
        const update = msg.UpdateBoard;
        encoder.writeU32(1); // Variant 1: UpdateBoard
        // SerializedBoardData { letters: Vec<u8>, bonuses: Vec<u8> }
        encoder.writeVecU8(update.board.letters);
        encoder.writeVecU8(update.board.bonuses);
    }

    return encoder.getBytes();
}

export function decodeServerMsg(data: ArrayBuffer): ServerMsg {
    const decoder = new BincodeDecoder(data);
    const variant = decoder.readU32();

    if (variant === 0) { // Progress
        const moves_evaluated = decoder.readU32();
        const best_score = decoder.readU16();
        const score = best_score > 32767 ? best_score - 65536 : best_score;
        return { type: 'Progress', moves_evaluated, best_score: score };

    } else if (variant === 1) { // Result
        const movesLen = Number(decoder.readU64());
        const moves: ScoredMove[] = [];

        for (let i = 0; i < movesLen; i++) {
            // ScoredMove { placements: Vec<(u8, u8)>, score: i16, word: String }
            const placementsLen = Number(decoder.readU64());
            const placements: [number, number][] = [];
            for (let j = 0; j < placementsLen; j++) {
                const pos = decoder.readU8();
                const tile = decoder.readU8();
                placements.push([pos, tile]);
            }

            const scoreRaw = decoder.readU16();
            const score = scoreRaw > 32767 ? scoreRaw - 65536 : scoreRaw;

            const word = decoder.readString();

            moves.push({
                placements,
                score,
                word,
            });
        }

        const confidence = decoder.readF32();
        const compute_time_ms = decoder.readU16();

        return { type: 'Result', moves, confidence, compute_time_ms };

    } else if (variant === 2) { // BoardStored
        const board_hash = decoder.readU64();
        return { type: 'BoardStored', board_hash };

    } else if (variant === 3) { // Error
        const message = decoder.readString();
        return { type: 'Error', message };
    }

    throw new Error(`Unknown server message variant: ${variant}`);
}
