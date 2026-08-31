import { rpc } from "../../services/solana";

const SPL_TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

export const getBalance = async (addr: string) => {
  const result = await rpc("getBalance", [addr]);
  return result.value / 1_000_000_000;
};

export const getTokens = async (addr: string) => {
  // Query both the legacy SPL Token program and Token-2022; many mints now
  // live on the newer program and would otherwise be silently missing.
  const [legacy, token22] = await Promise.all([
    rpc("getTokenAccountsByOwner", [
      addr,
      { programId: SPL_TOKEN_PROGRAM },
      { encoding: "jsonParsed" },
    ]),
    rpc("getTokenAccountsByOwner", [
      addr,
      { programId: TOKEN_2022_PROGRAM },
      { encoding: "jsonParsed" },
    ]),
  ]);

  const accounts = [
    ...((legacy as { value?: unknown[] }).value || []),
    ...((token22 as { value?: unknown[] }).value || []),
  ];

  return (accounts as TokenAccount[])
    .map((a) => {
      const info = a.account.data.parsed.info;
      // Prefer the string form: uiAmount is null for amounts too large for a
      // float64, and it rounds balances that would otherwise be exact.
      const amount = Number(info.tokenAmount.uiAmountString ?? info.tokenAmount.uiAmount ?? 0);
      return { mint: info.mint, amount };
    })
    .filter((t: { mint: string; amount: number }) => t.amount > 0);
};

export const getTxns = async (addr: string) => {
  const sigs = await rpc("getSignaturesForAddress", [addr, { limit: 10 }]);
  return sigs.map(
    (s: { signature: string; blockTime: number; err: unknown }) => ({
      sig: s.signature,
      time: s.blockTime,
      ok: !s.err,
    }),
  );
};

export const short = (s: string, n = 4) =>
  s.length <= n * 2 ? s : `${s.slice(0, n)}...${s.slice(-n)}`;

export const timeAgo = (ts: number) => {
  // blockTime can be slightly ahead of the device clock; never show negatives.
  const sec = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
};

/** True when `s` parses as a real base58 Solana address (pubkey or mint). */
export const isSolanaAddress = (s: string): boolean => {
  const trimmed = s.trim();
  if (trimmed.length < 32 || trimmed.length > 44) return false;
  // Base58 alphabet: no 0, O, I or l. Cheap structural check that avoids
  // pulling web3.js into every screen just to validate a text input.
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(trimmed);
};

type TokenAccount = {
  account: {
    data: {
      parsed: {
        info: {
          mint: string;
          tokenAmount: {
            uiAmount: number | null;
            uiAmountString?: string;
          };
        };
      };
    };
  };
};
