// src/services/jupiter.ts
// Jupiter swap service with public mobile-friendly fallbacks.

const JUPITER_OFFICIAL_API = "https://api.jup.ag";
const JUPITER_LITE_API = "https://lite-api.jup.ag";
const JUPITER_PUBLIC_MIRROR_API = "https://public.jupiterapi.com";
const JUPITER_REQUEST_TIMEOUT_MS = 12000;

const rawApiKey = process.env.EXPO_PUBLIC_JUPITER_API_KEY;
const JUPITER_API_KEY = (rawApiKey ?? "").trim().replace(/^"|"$/g, "");

const rawBaseUrlOverride = process.env.EXPO_PUBLIC_JUPITER_BASE_URL;
const JUPITER_BASE_URL_OVERRIDE = (rawBaseUrlOverride ?? "")
  .trim()
  .replace(/^"|"$/g, "");

type JupiterRouteSet = {
  name: string;
  baseUrl: string;
  quotePath: string;
  swapPath: string;
  pricePath?: string;
  includeApiKey: boolean;
};

function getCandidateRoutes(): JupiterRouteSet[] {
  if (JUPITER_BASE_URL_OVERRIDE) {
    return [
      {
        name: "override",
        baseUrl: JUPITER_BASE_URL_OVERRIDE,
        quotePath: "/swap/v1/quote",
        swapPath: "/swap/v1/swap",
        pricePath: "/price/v3",
        includeApiKey: true,
      },
    ];
  }

  const routes: JupiterRouteSet[] = [];

  if (JUPITER_API_KEY) {
    routes.push({
      name: "official",
      baseUrl: JUPITER_OFFICIAL_API,
      quotePath: "/swap/v1/quote",
      swapPath: "/swap/v1/swap",
      pricePath: "/price/v3",
      includeApiKey: true,
    });
  }

  routes.push({
    name: "lite",
    baseUrl: JUPITER_LITE_API,
    quotePath: "/swap/v1/quote",
    swapPath: "/swap/v1/swap",
    pricePath: "/price/v3",
    includeApiKey: false,
  });
  routes.push({
    name: "public-mirror",
    baseUrl: JUPITER_PUBLIC_MIRROR_API,
    quotePath: "/quote",
    swapPath: "/swap",
    includeApiKey: false,
  });

  return routes;
}

function getHeaders(
  extra?: Record<string, string>,
  opts?: { includeApiKey?: boolean },
) {
  const includeApiKey = opts?.includeApiKey ?? true;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(extra ?? {}),
  };
  if (includeApiKey && JUPITER_API_KEY) {
    headers["x-api-key"] = JUPITER_API_KEY;
  }
  return headers;
}

function makeUrl(
  baseUrl: string,
  path: string,
  params?: Record<string, string>,
) {
  if (!params) return `${baseUrl}${path}`;
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  return `${baseUrl}${path}?${query}`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JUPITER_REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `${response.status}${errorText ? ` ${errorText.slice(0, 180)}` : ""}`.trim(),
    );
  }

  return (await response.json()) as T;
}

// well-known token mints on solana mainnet
export const TOKENS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  WIF: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
};

export const TOKEN_INFO: Record<
  string,
  { symbol: string; name: string; decimals: number; color: string }
> = {
  [TOKENS.SOL]: {
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    color: "#9945FF",
  },
  [TOKENS.USDC]: {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    color: "#2775CA",
  },
  [TOKENS.USDT]: {
    symbol: "USDT",
    name: "Tether",
    decimals: 6,
    color: "#26A17B",
  },
  [TOKENS.BONK]: {
    symbol: "BONK",
    name: "Bonk",
    decimals: 5,
    color: "#F7931A",
  },
  [TOKENS.JUP]: {
    symbol: "JUP",
    name: "Jupiter",
    decimals: 6,
    color: "#14F195",
  },
  [TOKENS.WIF]: {
    symbol: "WIF",
    name: "dogwifhat",
    decimals: 6,
    color: "#E91E63",
  },
};

export const AVAILABLE_TOKENS = [
  TOKENS.SOL,
  TOKENS.USDC,
  TOKENS.USDT,
  TOKENS.BONK,
  TOKENS.JUP,
  TOKENS.WIF,
];

export interface QuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount?: string;
      feeMint?: string;
    };
    percent: number;
  }>;
}

/**
 * Slippage applied to every quote, in basis points. Exported so the swap screen
 * can display the same number it actually requested instead of a literal that
 * silently drifts out of sync.
 */
export const DEFAULT_SLIPPAGE_BPS = 50;

export async function getSwapQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = DEFAULT_SLIPPAGE_BPS,
): Promise<QuoteResponse> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid quote amount");
  }

  const params = {
    inputMint,
    outputMint,
    amount: Math.floor(amount).toString(),
    slippageBps: Math.floor(slippageBps).toString(),
  };

  let lastError: Error | null = null;

  for (const route of getCandidateRoutes()) {
    const url = makeUrl(route.baseUrl, route.quotePath, params);

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        return await requestJson<QuoteResponse>(url, {
          method: "GET",
          headers: getHeaders(undefined, { includeApiKey: route.includeApiKey }),
        });
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error("Unknown quote error");
        console.log(
          `[jupiter] quote attempt ${attempt} failed (${route.name}):`,
          lastError.message,
        );

        if (attempt < 2) {
          await delay(450);
        }
      }
    }
  }

  throw lastError || new Error("Failed to get quote from Jupiter");
}

export async function getSwapTransaction(
  quoteResponse: QuoteResponse,
  userPublicKey: string,
): Promise<string> {
  let lastError: Error | null = null;

  for (const route of getCandidateRoutes()) {
    const url = makeUrl(route.baseUrl, route.swapPath);

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const data = await requestJson<{ swapTransaction: string }>(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getHeaders(undefined, { includeApiKey: route.includeApiKey }),
          },
          body: JSON.stringify({
            quoteResponse,
            userPublicKey,
            wrapAndUnwrapSol: true,
            dynamicComputeUnitLimit: true,
            prioritizationFeeLamports: {
              priorityLevelWithMaxLamports: {
                priorityLevel: "high",
                maxLamports: 1000000,
              },
            },
          }),
        });

        if (!data.swapTransaction) {
          throw new Error("Swap response missing transaction");
        }

        return data.swapTransaction;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error("Unknown swap error");
        console.log(
          `[jupiter] swap attempt ${attempt} failed (${route.name}):`,
          lastError.message,
        );

        if (attempt < 2) {
          await delay(600);
        }
      }
    }
  }

  throw lastError || new Error("Failed to get swap transaction");
}

/** A live price quote from Jupiter's price API. */
export type TokenPrice = {
  usdPrice: number;
  /** 24-hour change as a percentage, or null when the API omits it. */
  priceChange24h: number | null;
};

type JupiterPriceEntry = {
  usdPrice?: number;
  priceChange24h?: number;
};

/**
 * Fetch prices for several mints in one request. Mints the API does not know
 * are simply absent from the result, so callers must handle missing entries.
 */
export async function getTokenPrices(
  mintAddresses: string[],
): Promise<Record<string, TokenPrice>> {
  const ids = Array.from(new Set(mintAddresses.filter(Boolean)));
  if (ids.length === 0) return {};

  for (const route of getCandidateRoutes()) {
    if (!route.pricePath) continue;

    try {
      const data = await requestJson<Record<string, JupiterPriceEntry>>(
        makeUrl(route.baseUrl, route.pricePath, { ids: ids.join(",") }),
        {
          method: "GET",
          headers: getHeaders(undefined, { includeApiKey: route.includeApiKey }),
        },
      );

      const prices: Record<string, TokenPrice> = {};
      ids.forEach((mint) => {
        const entry = data[mint];
        if (!entry || typeof entry.usdPrice !== "number") return;
        prices[mint] = {
          usdPrice: entry.usdPrice,
          priceChange24h:
            typeof entry.priceChange24h === "number"
              ? entry.priceChange24h
              : null,
        };
      });

      if (Object.keys(prices).length > 0) return prices;
    } catch {
      continue;
    }
  }

  throw new Error("Could not load live prices. Check your connection.");
}

export async function getTokenPrice(mintAddress: string): Promise<number> {
  for (const route of getCandidateRoutes()) {
    if (!route.pricePath) continue;

    try {
      const data = await requestJson<Record<string, { usdPrice?: number }>>(
        makeUrl(route.baseUrl, route.pricePath, { ids: mintAddress }),
        {
          method: "GET",
          headers: getHeaders(undefined, { includeApiKey: route.includeApiKey }),
        },
      );
      return data[mintAddress]?.usdPrice || 0;
    } catch {
      continue;
    }
  }

  return 0;
}

export function toSmallestUnit(amount: number, decimals: number): number {
  return Math.round(amount * Math.pow(10, decimals));
}

export function fromSmallestUnit(
  amount: number | string,
  decimals: number,
): number {
  return Number(amount) / Math.pow(10, decimals);
}
