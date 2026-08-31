/**
 * Dependency-free QR Code encoder — byte mode, error-correction level M,
 * versions 1 through 10 (up to 213 bytes, far more than any Solana address).
 *
 * The app has no SVG renderer available, so instead of pulling one in this
 * produces a plain boolean matrix that `QRCode.tsx` draws with Views. Level M
 * tolerates ~15% damage, which is the usual choice for wallet addresses.
 *
 * Reference: ISO/IEC 18004.
 */

type EcSpec = {
  ecPerBlock: number;
  group1Blocks: number;
  group1Data: number;
  group2Blocks: number;
  group2Data: number;
};

/** Error-correction level M block layout, indexed by version. */
const EC_SPECS: Record<number, EcSpec> = {
  1: { ecPerBlock: 10, group1Blocks: 1, group1Data: 16, group2Blocks: 0, group2Data: 0 },
  2: { ecPerBlock: 16, group1Blocks: 1, group1Data: 28, group2Blocks: 0, group2Data: 0 },
  3: { ecPerBlock: 26, group1Blocks: 1, group1Data: 44, group2Blocks: 0, group2Data: 0 },
  4: { ecPerBlock: 18, group1Blocks: 2, group1Data: 32, group2Blocks: 0, group2Data: 0 },
  5: { ecPerBlock: 24, group1Blocks: 2, group1Data: 43, group2Blocks: 0, group2Data: 0 },
  6: { ecPerBlock: 16, group1Blocks: 4, group1Data: 27, group2Blocks: 0, group2Data: 0 },
  7: { ecPerBlock: 18, group1Blocks: 4, group1Data: 31, group2Blocks: 0, group2Data: 0 },
  8: { ecPerBlock: 22, group1Blocks: 2, group1Data: 38, group2Blocks: 2, group2Data: 39 },
  9: { ecPerBlock: 22, group1Blocks: 3, group1Data: 36, group2Blocks: 2, group2Data: 37 },
  10: { ecPerBlock: 26, group1Blocks: 4, group1Data: 43, group2Blocks: 1, group2Data: 44 },
};

/** Alignment-pattern centre coordinates, indexed by version (v1 has none). */
const ALIGNMENT_CENTERS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

/** 18-bit version information, required from version 7 upwards. */
const VERSION_INFO: Record<number, number> = {
  7: 0x07c94,
  8: 0x085bc,
  9: 0x09a99,
  10: 0x0a4d3,
};

/** 15-bit format information for EC level M, indexed by mask pattern. */
const FORMAT_INFO_M = [
  0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0,
];

const MAX_VERSION = 10;

// ---------------------------------------------------------------------------
// GF(256) arithmetic, primitive polynomial 0x11D.
// ---------------------------------------------------------------------------

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

{
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) GF_EXP[i] = GF_EXP[i - 255];
}

function gfMul(a: number, b: number) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

/** Product of (x - a^0)...(x - a^(degree-1)), coefficients highest-first. */
function generatorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i += 1) {
    const next = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function ecCodewords(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = generatorPoly(ecLen);
  const buf = new Uint8Array(data.length + ecLen);
  buf.set(data);

  for (let i = 0; i < data.length; i += 1) {
    const factor = buf[i];
    if (factor === 0) continue;
    for (let j = 0; j < gen.length; j += 1) {
      buf[i + j] ^= gfMul(gen[j], factor);
    }
  }

  return buf.slice(data.length);
}

// ---------------------------------------------------------------------------
// Data encoding.
// ---------------------------------------------------------------------------

function totalDataCodewords(spec: EcSpec) {
  return (
    spec.group1Blocks * spec.group1Data + spec.group2Blocks * spec.group2Data
  );
}

/** Byte-mode payload capacity, i.e. data codewords minus the header. */
function byteCapacity(version: number) {
  const spec = EC_SPECS[version];
  const headerBits = 4 + (version >= 10 ? 16 : 8);
  return Math.floor((totalDataCodewords(spec) * 8 - headerBits) / 8);
}

function pickVersion(byteLength: number) {
  for (let version = 1; version <= MAX_VERSION; version += 1) {
    if (byteLength <= byteCapacity(version)) return version;
  }
  return null;
}

/** UTF-8 encode without depending on TextEncoder being present in Hermes. */
function utf8Bytes(text: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    let code = text.charCodeAt(i);

    // Combine surrogate pairs into a single code point.
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      }
    }

    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return out;
}

function buildDataCodewords(bytes: number[], version: number): Uint8Array {
  const spec = EC_SPECS[version];
  const capacity = totalDataCodewords(spec);
  const countBits = version >= 10 ? 16 : 8;

  const bits: number[] = [];
  const pushBits = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >> i) & 1);
  };

  pushBits(0b0100, 4); // byte mode
  pushBits(bytes.length, countBits);
  bytes.forEach((byte) => pushBits(byte, 8));

  // Terminator: up to four zero bits, truncated if the capacity is reached.
  const capacityBits = capacity * 8;
  for (let i = 0; i < 4 && bits.length < capacityBits; i += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = new Uint8Array(capacity);
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j];
    codewords[i / 8] = byte;
  }

  // Alternating pad bytes fill the remainder.
  const padBytes = [0xec, 0x11];
  for (let i = bits.length / 8, p = 0; i < capacity; i += 1, p += 1) {
    codewords[i] = padBytes[p % 2];
  }

  return codewords;
}

/** Split into EC blocks, then interleave data and EC codewords per spec. */
function interleave(dataCodewords: Uint8Array, version: number): Uint8Array {
  const spec = EC_SPECS[version];
  const blocks: { data: Uint8Array; ec: Uint8Array }[] = [];

  let offset = 0;
  const addBlocks = (count: number, size: number) => {
    for (let i = 0; i < count; i += 1) {
      const data = dataCodewords.slice(offset, offset + size);
      offset += size;
      blocks.push({ data, ec: ecCodewords(data, spec.ecPerBlock) });
    }
  };

  addBlocks(spec.group1Blocks, spec.group1Data);
  addBlocks(spec.group2Blocks, spec.group2Data);

  const result: number[] = [];
  const maxData = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < maxData; i += 1) {
    blocks.forEach((block) => {
      if (i < block.data.length) result.push(block.data[i]);
    });
  }
  for (let i = 0; i < spec.ecPerBlock; i += 1) {
    blocks.forEach((block) => result.push(block.ec[i]));
  }

  return Uint8Array.from(result);
}

// ---------------------------------------------------------------------------
// Matrix construction.
// ---------------------------------------------------------------------------

type Grid = {
  size: number;
  modules: Uint8Array;
  reserved: Uint8Array;
};

function createGrid(version: number): Grid {
  const size = 17 + version * 4;
  return {
    size,
    modules: new Uint8Array(size * size),
    reserved: new Uint8Array(size * size),
  };
}

function setModule(grid: Grid, row: number, col: number, dark: boolean, reserve = true) {
  const index = row * grid.size + col;
  grid.modules[index] = dark ? 1 : 0;
  if (reserve) grid.reserved[index] = 1;
}

function placeFinder(grid: Grid, row: number, col: number) {
  // The 7x7 finder plus its one-module separator, clipped to the grid.
  for (let r = -1; r <= 7; r += 1) {
    for (let c = -1; c <= 7; c += 1) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || rr >= grid.size || cc < 0 || cc >= grid.size) continue;

      const inRing = (r === 0 || r === 6) && c >= 0 && c <= 6;
      const inSide = (c === 0 || c === 6) && r >= 0 && r <= 6;
      const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      setModule(grid, rr, cc, inRing || inSide || inCore);
    }
  }
}

function placeAlignment(grid: Grid, version: number) {
  const centers = ALIGNMENT_CENTERS[version];
  const last = centers.length - 1;

  centers.forEach((row, rowIndex) => {
    centers.forEach((col, colIndex) => {
      // The three finder corners already own these positions.
      const atFinder =
        (rowIndex === 0 && colIndex === 0) ||
        (rowIndex === 0 && colIndex === last) ||
        (rowIndex === last && colIndex === 0);
      if (atFinder) return;

      for (let r = -2; r <= 2; r += 1) {
        for (let c = -2; c <= 2; c += 1) {
          const dark = Math.max(Math.abs(r), Math.abs(c)) !== 1;
          setModule(grid, row + r, col + c, dark);
        }
      }
    });
  });
}

function placeTiming(grid: Grid) {
  for (let i = 8; i < grid.size - 8; i += 1) {
    const dark = i % 2 === 0;
    setModule(grid, 6, i, dark);
    setModule(grid, i, 6, dark);
  }
}

function reserveFormatAreas(grid: Grid, version: number) {
  const size = grid.size;

  for (let i = 0; i <= 8; i += 1) {
    if (i !== 6) {
      setModule(grid, 8, i, false);
      setModule(grid, i, 8, false);
    }
  }
  for (let i = 0; i < 8; i += 1) {
    setModule(grid, 8, size - 1 - i, false);
    setModule(grid, size - 1 - i, 8, false);
  }

  // Always-dark module just above the bottom-left format strip.
  setModule(grid, size - 8, 8, true);

  if (version >= 7) {
    for (let i = 0; i < 18; i += 1) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      setModule(grid, row, size - 11 + col, false);
      setModule(grid, size - 11 + col, row, false);
    }
  }
}

function placeVersionInfo(grid: Grid, version: number) {
  if (version < 7) return;
  const info = VERSION_INFO[version];
  const size = grid.size;

  for (let i = 0; i < 18; i += 1) {
    const dark = ((info >> i) & 1) === 1;
    const row = Math.floor(i / 3);
    const col = i % 3;
    setModule(grid, row, size - 11 + col, dark);
    setModule(grid, size - 11 + col, row, dark);
  }
}

function placeFormatInfo(grid: Grid, mask: number) {
  const info = FORMAT_INFO_M[mask];
  const size = grid.size;

  for (let i = 0; i < 15; i += 1) {
    const dark = ((info >> i) & 1) === 1;

    // Copy around the top-left finder.
    if (i < 6) setModule(grid, 8, i, dark);
    else if (i === 6) setModule(grid, 8, 7, dark);
    else if (i === 7) setModule(grid, 8, 8, dark);
    else if (i === 8) setModule(grid, 7, 8, dark);
    else setModule(grid, 14 - i, 8, dark);

    // Duplicate copy split across the other two finders.
    if (i < 8) setModule(grid, size - 1 - i, 8, dark);
    else setModule(grid, 8, size - 15 + i, dark);
  }
}

function placeData(grid: Grid, codewords: Uint8Array) {
  const size = grid.size;
  let bitIndex = 0;
  let upward = true;

  for (let right = size - 1; right >= 0; right -= 2) {
    // Column 6 is the vertical timing pattern and is skipped entirely.
    const rightCol = right <= 6 ? right - 1 : right;
    if (rightCol < 0) break;

    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;

      for (let offset = 0; offset < 2; offset += 1) {
        const col = rightCol - offset;
        if (col < 0) continue;
        if (grid.reserved[row * grid.size + col]) continue;

        const byte = codewords[bitIndex >> 3];
        // Remainder bits past the codeword stream are left light.
        const dark =
          byte !== undefined && ((byte >> (7 - (bitIndex & 7))) & 1) === 1;
        grid.modules[row * grid.size + col] = dark ? 1 : 0;
        bitIndex += 1;
      }
    }

    upward = !upward;
  }
}

function maskAt(mask: number, row: number, col: number) {
  switch (mask) {
    case 0:
      return (row + col) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (row + col) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5:
      return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6:
      return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    default:
      return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
  }
}

function applyMask(grid: Grid, mask: number) {
  for (let row = 0; row < grid.size; row += 1) {
    for (let col = 0; col < grid.size; col += 1) {
      const index = row * grid.size + col;
      if (grid.reserved[index]) continue;
      if (maskAt(mask, row, col)) grid.modules[index] ^= 1;
    }
  }
}

const FINDER_RUN = [1, 0, 1, 1, 1, 0, 1];

function penalty(grid: Grid) {
  const size = grid.size;
  const at = (row: number, col: number) => grid.modules[row * size + col];
  let score = 0;

  // Rule 1 — runs of five or more identical modules.
  for (let i = 0; i < size; i += 1) {
    for (const horizontal of [true, false]) {
      let runValue = -1;
      let runLength = 0;
      for (let j = 0; j < size; j += 1) {
        const value = horizontal ? at(i, j) : at(j, i);
        if (value === runValue) {
          runLength += 1;
        } else {
          if (runLength >= 5) score += 3 + (runLength - 5);
          runValue = value;
          runLength = 1;
        }
      }
      if (runLength >= 5) score += 3 + (runLength - 5);
    }
  }

  // Rule 2 — 2x2 blocks of one colour.
  for (let row = 0; row < size - 1; row += 1) {
    for (let col = 0; col < size - 1; col += 1) {
      const value = at(row, col);
      if (
        value === at(row, col + 1) &&
        value === at(row + 1, col) &&
        value === at(row + 1, col + 1)
      ) {
        score += 3;
      }
    }
  }

  // Rule 3 — finder-like 1:1:3:1:1 runs with four light modules on a side.
  const matchesAt = (
    row: number,
    col: number,
    horizontal: boolean,
    pattern: number[],
  ) => {
    for (let k = 0; k < pattern.length; k += 1) {
      const r = horizontal ? row : row + k;
      const c = horizontal ? col + k : col;
      if (r >= size || c >= size) return false;
      if (at(r, c) !== pattern[k]) return false;
    }
    return true;
  };

  const withLightBefore = [0, 0, 0, 0, ...FINDER_RUN];
  const withLightAfter = [...FINDER_RUN, 0, 0, 0, 0];

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      for (const horizontal of [true, false]) {
        if (matchesAt(row, col, horizontal, withLightBefore)) score += 40;
        if (matchesAt(row, col, horizontal, withLightAfter)) score += 40;
      }
    }
  }

  // Rule 4 — deviation from an even split of dark and light.
  let dark = 0;
  for (let i = 0; i < grid.modules.length; i += 1) dark += grid.modules[i];
  const ratio = (dark * 100) / grid.modules.length;
  score += Math.floor(Math.abs(ratio - 50) / 5) * 10;

  return score;
}

export type QrMatrix = {
  size: number;
  /** Row-major; `true` is a dark module. */
  modules: boolean[][];
};

/**
 * Encode `text` as a QR matrix, or return `null` if it is empty or too long
 * for version 10. Callers should render `null` as an explanatory placeholder
 * rather than a broken code.
 */
export function encodeQr(text: string): QrMatrix | null {
  if (!text) return null;

  const bytes = utf8Bytes(text);
  const version = pickVersion(bytes.length);
  if (version === null) return null;

  const codewords = interleave(buildDataCodewords(bytes, version), version);

  const base = createGrid(version);
  placeFinder(base, 0, 0);
  placeFinder(base, 0, base.size - 7);
  placeFinder(base, base.size - 7, 0);
  placeAlignment(base, version);
  placeTiming(base);
  reserveFormatAreas(base, version);
  placeVersionInfo(base, version);
  placeData(base, codewords);

  // Try every mask and keep the lowest-penalty result.
  let best: Grid | null = null;
  let bestScore = Infinity;

  for (let mask = 0; mask < 8; mask += 1) {
    const candidate: Grid = {
      size: base.size,
      modules: Uint8Array.from(base.modules),
      reserved: base.reserved,
    };
    applyMask(candidate, mask);
    placeFormatInfo(candidate, mask);

    const score = penalty(candidate);
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  if (!best) return null;

  const modules: boolean[][] = [];
  for (let row = 0; row < best.size; row += 1) {
    const line: boolean[] = [];
    for (let col = 0; col < best.size; col += 1) {
      line.push(best.modules[row * best.size + col] === 1);
    }
    modules.push(line);
  }

  return { size: best.size, modules };
}
