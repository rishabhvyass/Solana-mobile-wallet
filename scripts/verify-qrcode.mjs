/**
 * Round-trip self-test for src/lib/qrcode.ts.
 *
 * Independently rebuilds the function-module map from the spec, reads the
 * format information back out, unmasks, de-interleaves, verifies the
 * Reed-Solomon syndromes of every block, and decodes the payload. If all of
 * that passes, the matrix is a structurally valid QR code.
 *
 * Usage: node scripts/verify-qrcode.mjs   (after transpiling qrcode.ts)
 */

const EC_SPECS = {
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

const ALIGNMENT_CENTERS = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

const FORMAT_INFO_M = [
  0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0,
];

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
const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]]);

function maskAt(mask, row, col) {
  switch (mask) {
    case 0: return (row + col) % 2 === 0;
    case 1: return row % 2 === 0;
    case 2: return col % 3 === 0;
    case 3: return (row + col) % 3 === 0;
    case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5: return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6: return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    default: return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
  }
}

/** Function-module map, derived from the spec rather than from the encoder. */
function buildReserved(size, version) {
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));
  const mark = (r, c) => {
    if (r >= 0 && r < size && c >= 0 && c < size) reserved[r][c] = true;
  };

  for (let r = 0; r <= 8; r += 1) for (let c = 0; c <= 8; c += 1) mark(r, c);
  for (let r = 0; r <= 8; r += 1) for (let c = size - 8; c < size; c += 1) mark(r, c);
  for (let r = size - 8; r < size; r += 1) for (let c = 0; c <= 8; c += 1) mark(r, c);

  for (let i = 0; i < size; i += 1) {
    mark(6, i);
    mark(i, 6);
  }

  const centers = ALIGNMENT_CENTERS[version];
  const last = centers.length - 1;
  centers.forEach((row, ri) => {
    centers.forEach((col, ci) => {
      const atFinder =
        (ri === 0 && ci === 0) || (ri === 0 && ci === last) || (ri === last && ci === 0);
      if (atFinder) return;
      for (let r = -2; r <= 2; r += 1) for (let c = -2; c <= 2; c += 1) mark(row + r, col + c);
    });
  });

  if (version >= 7) {
    for (let i = 0; i < 18; i += 1) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      mark(row, size - 11 + col);
      mark(size - 11 + col, row);
    }
  }

  return reserved;
}

function readFormatMask(modules, size) {
  let bits = 0;
  for (let i = 0; i < 15; i += 1) {
    let dark;
    if (i < 6) dark = modules[8][i];
    else if (i === 6) dark = modules[8][7];
    else if (i === 7) dark = modules[8][8];
    else if (i === 8) dark = modules[7][8];
    else dark = modules[14 - i][8];
    if (dark) bits |= 1 << i;
  }
  const mask = FORMAT_INFO_M.indexOf(bits);
  if (mask < 0) throw new Error(`format info 0x${bits.toString(16)} not an EC-M value`);

  // The redundant second copy must agree.
  let mirror = 0;
  for (let i = 0; i < 15; i += 1) {
    const dark = i < 8 ? modules[size - 1 - i][8] : modules[8][size - 15 + i];
    if (dark) mirror |= 1 << i;
  }
  if (mirror !== bits) throw new Error("format info copies disagree");

  return mask;
}

function readCodewords(modules, reserved, size, count) {
  const bits = [];
  let upward = true;

  for (let right = size - 1; right >= 0; right -= 2) {
    const rightCol = right <= 6 ? right - 1 : right;
    if (rightCol < 0) break;
    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;
      for (let offset = 0; offset < 2; offset += 1) {
        const col = rightCol - offset;
        if (col < 0) continue;
        if (reserved[row][col]) continue;
        bits.push(modules[row][col] ? 1 : 0);
      }
    }
    upward = !upward;
  }

  const out = new Uint8Array(count);
  for (let i = 0; i < count; i += 1) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | (bits[i * 8 + j] ?? 0);
    out[i] = byte;
  }
  return out;
}

function syndromesZero(block, ecLen) {
  for (let i = 0; i < ecLen; i += 1) {
    let value = 0;
    for (let j = 0; j < block.length; j += 1) {
      value = gfMul(value, GF_EXP[i]) ^ block[j];
    }
    if (value !== 0) return false;
  }
  return true;
}

function decode(matrix) {
  const { size, modules: raw } = matrix;
  const version = (size - 17) / 4;
  if (!Number.isInteger(version) || !EC_SPECS[version]) {
    throw new Error(`bad size ${size}`);
  }

  const spec = EC_SPECS[version];
  const reserved = buildReserved(size, version);
  const mask = readFormatMask(raw, size);

  const modules = raw.map((row, r) =>
    row.map((dark, c) => (reserved[r][c] ? dark : dark !== maskAt(mask, r, c))),
  );

  const blockCount = spec.group1Blocks + spec.group2Blocks;
  const dataTotal =
    spec.group1Blocks * spec.group1Data + spec.group2Blocks * spec.group2Data;
  const total = dataTotal + blockCount * spec.ecPerBlock;

  const stream = readCodewords(modules, reserved, size, total);

  // Reverse the interleave.
  const sizes = [
    ...Array(spec.group1Blocks).fill(spec.group1Data),
    ...Array(spec.group2Blocks).fill(spec.group2Data),
  ];
  const dataBlocks = sizes.map((n) => new Array(n));
  const maxData = Math.max(...sizes);
  let p = 0;
  for (let i = 0; i < maxData; i += 1) {
    for (let b = 0; b < blockCount; b += 1) {
      if (i < sizes[b]) dataBlocks[b][i] = stream[p++];
    }
  }
  const ecBlocks = sizes.map(() => new Array(spec.ecPerBlock));
  for (let i = 0; i < spec.ecPerBlock; i += 1) {
    for (let b = 0; b < blockCount; b += 1) ecBlocks[b][i] = stream[p++];
  }

  for (let b = 0; b < blockCount; b += 1) {
    const full = Uint8Array.from([...dataBlocks[b], ...ecBlocks[b]]);
    if (!syndromesZero(full, spec.ecPerBlock)) {
      throw new Error(`block ${b} has non-zero Reed-Solomon syndromes`);
    }
  }

  const data = dataBlocks.flat();
  const bits = [];
  data.forEach((byte) => {
    for (let i = 7; i >= 0; i -= 1) bits.push((byte >> i) & 1);
  });
  const take = (n) => {
    let value = 0;
    for (let i = 0; i < n; i += 1) value = (value << 1) | bits.shift();
    return value;
  };

  const mode = take(4);
  if (mode !== 0b0100) throw new Error(`expected byte mode, got ${mode}`);
  const length = take(version >= 10 ? 16 : 8);
  const bytes = [];
  for (let i = 0; i < length; i += 1) bytes.push(take(8));

  return { version, mask, text: Buffer.from(bytes).toString("utf8") };
}

const outDir = (process.env.QR_BUILD_DIR ?? `${process.env.TMPDIR}/qrtest`).replace(/\/+$/, "");
const { encodeQr } = await import(`${outDir}/qrcode.js`);

const cases = [
  "So11111111111111111111111111111111111111112",
  "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "solana:7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "a",
  "x".repeat(213),
];

let failures = 0;
for (const text of cases) {
  const label = text.length > 28 ? `${text.slice(0, 25)}...` : text;
  try {
    const matrix = encodeQr(text);
    if (!matrix) throw new Error("encodeQr returned null");
    const result = decode(matrix);
    if (result.text !== text) {
      throw new Error(`payload mismatch: got ${result.text.slice(0, 40)}`);
    }
    console.log(
      `ok    v${String(result.version).padStart(2)} ${matrix.size}x${matrix.size} mask ${result.mask}  ${label}`,
    );
  } catch (error) {
    failures += 1;
    console.log(`FAIL  ${label}\n      ${error.message}`);
  }
}

if (encodeQr("") !== null) {
  failures += 1;
  console.log("FAIL  empty string should return null");
}
if (encodeQr("x".repeat(214)) !== null) {
  failures += 1;
  console.log("FAIL  oversized payload should return null");
}

console.log(failures === 0 ? "\nall QR round-trips passed" : `\n${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
