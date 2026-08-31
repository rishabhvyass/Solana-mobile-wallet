import { useWalletStore } from "../stores/wallet-store";

const OFFICIAL_DEVNET_RPC_URL = "https://api.devnet.solana.com";
const OFFICIAL_MAINNET_RPC_URL = "https://api.mainnet-beta.solana.com";
const PUBLICNODE_MAINNET_RPC_URL = "https://solana-rpc.publicnode.com";

export const RPC_REQUEST_TIMEOUT_MS = 12000;

function cleanEnvValue(value?: string) {
  return (value ?? "").trim().replace(/^"|"$/g, "");
}

function parseEnvUrlList(value?: string) {
  return cleanEnvValue(value)
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueUrls(urls: string[]) {
  return Array.from(new Set(urls.filter(Boolean)));
}

const devnetEnvUrls = parseEnvUrlList(process.env.EXPO_PUBLIC_DEV_RPC);
const mainnetEnvUrls = parseEnvUrlList(process.env.EXPO_PUBLIC_RPC);
const devnetFallbackEnvUrls = parseEnvUrlList(
  process.env.EXPO_PUBLIC_DEV_RPC_FALLBACKS,
);
const mainnetFallbackEnvUrls = parseEnvUrlList(
  process.env.EXPO_PUBLIC_RPC_FALLBACKS,
);

export const DEVNET_RPC_URL = devnetEnvUrls[0] || OFFICIAL_DEVNET_RPC_URL;
export const MAINNET_RPC_URL = mainnetEnvUrls[0] || OFFICIAL_MAINNET_RPC_URL;

const DEVNET_RPC_CANDIDATES = uniqueUrls([
  ...devnetEnvUrls,
  ...devnetFallbackEnvUrls,
  OFFICIAL_DEVNET_RPC_URL,
]);

const MAINNET_RPC_CANDIDATES = uniqueUrls([
  ...mainnetEnvUrls,
  ...mainnetFallbackEnvUrls,
  OFFICIAL_MAINNET_RPC_URL,
  PUBLICNODE_MAINNET_RPC_URL,
]);

export function getRpcCandidates(isDevnet: boolean) {
  return isDevnet ? DEVNET_RPC_CANDIDATES : MAINNET_RPC_CANDIDATES;
}

export function getRpcUrl(isDevnet: boolean) {
  return getRpcCandidates(isDevnet)[0];
}

type JsonRpcError = { message?: string };
type JsonRpcResponse<T> = { result?: T; error?: JsonRpcError };
type RpcOptions = {
  timeoutMs?: number;
  retriesPerUrl?: number;
  /** Hard ceiling for the whole helper, across every endpoint and retry. */
  totalTimeoutMs?: number;
};

/** Thrown for a well-formed JSON-RPC `error` payload — retrying cannot help. */
class RpcMethodError extends Error {}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchRpcResult<T>(
  rpcUrl: string,
  method: string,
  params: unknown[],
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const text = await response.text();

  let json: JsonRpcResponse<T>;
  try {
    json = JSON.parse(text) as JsonRpcResponse<T>;
  } catch {
    throw new Error("Invalid JSON response");
  }

  if (json.error) {
    throw new RpcMethodError(json.error.message || "RPC error");
  }

  // `null` is a legitimate JSON value but never a usable result here: callers
  // dereference `.value` / `.length` on it. Treat it as a failed attempt.
  if (json.result === undefined || json.result === null) {
    throw new Error("RPC missing result");
  }

  return json.result;
}

export async function rpc<T = any>(
  method: string,
  params: unknown[] = [],
  options: RpcOptions = {},
): Promise<T> {
  const isDevnet = useWalletStore.getState().isDevnet;
  const networkName = isDevnet ? "Devnet" : "Mainnet";
  const rpcUrls = getRpcCandidates(isDevnet);
  const retriesPerUrl = options.retriesPerUrl ?? 2;
  const timeoutMs = options.timeoutMs ?? RPC_REQUEST_TIMEOUT_MS;
  const deadline = Date.now() + (options.totalTimeoutMs ?? 20000);

  let lastErrorMessage = `No ${networkName} RPC endpoints configured.`;

  for (const rpcUrl of rpcUrls) {
    if (Date.now() > deadline) break;

    for (let attempt = 1; attempt <= retriesPerUrl; attempt += 1) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;

      try {
        return await fetchRpcResult<T>(
          rpcUrl,
          method,
          params,
          Math.min(timeoutMs, remaining),
        );
      } catch (error: unknown) {
        lastErrorMessage =
          error instanceof Error ? error.message : "Unknown network error";

        // The node understood us and refused: every other endpoint will refuse
        // the same call, so fail fast instead of burning the whole deadline.
        if (error instanceof RpcMethodError) {
          throw new Error(lastErrorMessage);
        }

        if (attempt < retriesPerUrl) {
          await delay(350 * 2 ** (attempt - 1));
        }
      }
    }
  }

  console.log("[rpc] all endpoints failed", method, rpcUrls, lastErrorMessage);

  throw new Error(
    `Could not reach the ${networkName} network. Check your connection and try again.`,
  );
}
