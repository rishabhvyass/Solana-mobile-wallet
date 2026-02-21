import { rpc } from "../../apis";

export const getBalance = async (addr: string) => {
    const result = await rpc("getBalance", [addr]);
    return result.value / 1_000_000_000;
};

export const getTokens = async (addr: string) => {
    const result = await rpc("getTokenAccountsByOwner", [
        addr,
        { programId: process.env.EXPO_PUBLIC_PROGRAM_ID },
        { encoding: "jsonParsed" },
    ]);
    return (result.value || [])
        .map((a: any) => ({
            mint: a.account.data.parsed.info.mint,
            amount: a.account.data.parsed.info.tokenAmount.uiAmount,
        }))
        .filter((t: any) => t.amount > 0);
};

export const getTxns = async (addr: string) => {
    const sigs = await rpc("getSignaturesForAddress", [addr, { limit: 10 }]);
    return sigs.map((s: any) => ({
        sig: s.signature,
        time: s.blockTime,
        ok: !s.err,
    }));
};

export const short = (s: string, n = 4) => `${s.slice(0, n)}...${s.slice(-n)}`;

export const timeAgo = (ts: number) => {
    const sec = Math.floor(Date.now() / 1000 - ts);
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
};
