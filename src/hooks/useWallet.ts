// src/hooks/useWallet.ts
// wallet connection and transaction hook using mobile wallet adapter
import "../polyfills";
import { useState, useCallback, useMemo, useRef } from "react";
import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
} from "@solana/web3.js";
import { useWalletStore } from "../stores/wallet-store";
import { getRpcCandidates, getRpcUrl } from "../services/solana";
import {
  getSwapQuote,
  getSwapTransaction,
  toSmallestUnit,
  fromSmallestUnit,
  QuoteResponse,
} from "../services/jupiter";

const APP_IDENTITY = {
  name: "SolScan",
  uri: "https://solscan-app.com",
  icon: "favicon.ico",
};

const decodeAddress = (address: string): PublicKey => {
  if (address.includes("=") || address.includes("+") || address.includes("/")) {
    const bytes = Uint8Array.from(atob(address), (char) => char.charCodeAt(0));
    return new PublicKey(bytes);
  }
  return new PublicKey(address);
};

type RpcConnectionCandidate = {
  url: string;
  connection: Connection;
};

/** The transaction landed on-chain and failed there. Never re-broadcast it. */
export class TransactionFailedError extends Error {
  readonly signature: string;
  constructor(message: string, signature: string) {
    super(message);
    this.name = "TransactionFailedError";
    this.signature = signature;
  }
}

/** Result of a broadcast: `confirmed: false` means submitted but unconfirmed. */
export type BroadcastResult = {
  signature: string;
  confirmed: boolean;
};

async function runWithConnectionFallback<T>(
  candidates: RpcConnectionCandidate[],
  label: string,
  operation: (candidate: RpcConnectionCandidate) => Promise<T>,
): Promise<T> {
  let lastError: Error | null = null;

  for (const candidate of candidates) {
    try {
      return await operation(candidate);
    } catch (error: unknown) {
      lastError =
        error instanceof Error ? error : new Error("Unknown connection error");
      console.log(
        `[useWallet] ${label} failed on ${candidate.url}:`,
        lastError.message,
      );
    }
  }

  throw (
    lastError ||
    new Error(`Failed to ${label} on all configured RPC endpoints`)
  );
}

async function broadcastSignedTransaction(
  candidates: RpcConnectionCandidate[],
  serializedTransaction: Uint8Array,
  label: string,
  confirmationMeta?: {
    blockhash: string;
    lastValidBlockHeight: number;
  },
) {
  let lastError: Error | null = null;
  let accepted: { signature: string; candidate: RpcConnectionCandidate } | null =
    null;

  // Phase 1 — get the transaction accepted by exactly one endpoint. Only
  // submission is retried; once a signature exists the transaction may already
  // be on-chain, so re-sending it elsewhere risks broadcasting it twice.
  for (const candidate of candidates) {
    try {
      const signature = await candidate.connection.sendRawTransaction(
        serializedTransaction,
        {
          skipPreflight: true,
          maxRetries: 2,
        },
      );
      accepted = { signature, candidate };
      break;
    } catch (error: unknown) {
      lastError =
        error instanceof Error ? error : new Error("Unknown broadcast error");
      console.log(
        `[useWallet] ${label} submit failed on ${candidate.url}:`,
        lastError.message,
      );
    }
  }

  if (!accepted) {
    throw (
      lastError ||
      new Error(`Failed to ${label} on all configured RPC endpoints`)
    );
  }

  const { signature, candidate } = accepted;

  // Phase 2 — confirm once. An execution error is final; a timeout is not.
  try {
    const confirmation = confirmationMeta
      ? await candidate.connection.confirmTransaction(
          {
            signature,
            blockhash: confirmationMeta.blockhash,
            lastValidBlockHeight: confirmationMeta.lastValidBlockHeight,
          },
          "confirmed",
        )
      : await candidate.connection.confirmTransaction(signature, "confirmed");

    if (confirmation.value.err) {
      throw new TransactionFailedError(
        `Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`,
        signature,
      );
    }

    return { signature, confirmed: true };
  } catch (error: unknown) {
    if (error instanceof TransactionFailedError) throw error;

    // Could not confirm in time. The transaction is live and may still land, so
    // hand the signature back rather than reporting a failure.
    console.log(
      `[useWallet] ${label} confirmation unresolved for ${signature}:`,
      error instanceof Error ? error.message : error,
    );
    return { signature, confirmed: false };
  }
}

export function useWallet() {
  const [connecting, setConnecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteData, setQuoteData] = useState<QuoteResponse | null>(null);
  const quoteReqRef = useRef(0);
  const isDevnet = useWalletStore((state) => state.isDevnet);
  const connectedPublicKey = useWalletStore((state) => state.connectedPublicKey);
  const setConnectedPublicKey = useWalletStore((state) => state.setConnectedPublicKey);
  const setActiveAddress = useWalletStore((state) => state.setActiveAddress);

  const publicKey = useMemo(() => {
    if (!connectedPublicKey) return null;
    try {
      return new PublicKey(connectedPublicKey);
    } catch {
      return null;
    }
  }, [connectedPublicKey]);

  const cluster = isDevnet ? "devnet" : "mainnet-beta";
  const rpcUrls = useMemo(() => getRpcCandidates(isDevnet), [isDevnet]);
  const connections = useMemo(
    () =>
      rpcUrls.map((url) => ({
        url,
        connection: new Connection(url, "confirmed"),
      })),
    [rpcUrls],
  );
  const connection = useMemo(
    () =>
      connections[0]?.connection ?? new Connection(getRpcUrl(isDevnet), "confirmed"),
    [connections, isDevnet],
  );

  const connect = useCallback(async () => {
    setConnecting(true);

    try {
      const walletAddress = await transact(async (wallet: Web3MobileWallet) => {
        const authResult = await wallet.authorize({
          cluster,
          identity: APP_IDENTITY,
        });

        if (!authResult.accounts || authResult.accounts.length === 0) {
          throw new Error("No accounts returned from wallet authorization");
        }

        const userAddress = authResult.accounts[0].address;
        const pubkey = decodeAddress(userAddress);
        return pubkey.toBase58();
      });

      setConnectedPublicKey(walletAddress);
      setActiveAddress(walletAddress);
      return new PublicKey(walletAddress);
    } catch (error: unknown) {
      console.error("[useWallet] connect failed:", error);
      throw error;
    } finally {
      setConnecting(false);
    }
  }, [cluster, setActiveAddress, setConnectedPublicKey]);

  const disconnect = useCallback(() => {
    setConnectedPublicKey(null);
  }, [setConnectedPublicKey]);

  const getBalance = useCallback(async () => {
    if (!publicKey) return 0;
    const balance = await runWithConnectionFallback(
      connections,
      "fetch balance",
      async ({ connection: activeConnection }) =>
        activeConnection.getBalance(publicKey),
    );
    return balance / LAMPORTS_PER_SOL;
  }, [connections, publicKey]);

  const sendSOL = useCallback(
    async (toAddress: string, amountSOL: number) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      setSending(true);

      try {
        const { blockhash, lastValidBlockHeight } = await runWithConnectionFallback(
          connections,
          "fetch recent blockhash",
          async ({ connection: activeConnection }) =>
            activeConnection.getLatestBlockhash(),
        );

        const toPublicKey = new PublicKey(toAddress);

        if (toPublicKey.equals(publicKey)) {
          throw new Error("You cannot send SOL to your own address");
        }

        const lamports = Math.round(amountSOL * LAMPORTS_PER_SOL);

        if (!Number.isFinite(lamports) || lamports <= 0) {
          throw new Error("Enter an amount greater than zero");
        }

        const transaction = new Transaction();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: toPublicKey,
            lamports,
          }),
        );

        const signedTransaction = await transact(
          async (wallet: Web3MobileWallet) => {
            await wallet.authorize({
              cluster,
              identity: APP_IDENTITY,
            });

            const signedTxs = await wallet.signTransactions({
              transactions: [transaction],
            });

            if (!signedTxs || signedTxs.length === 0) {
              throw new Error("No signed transaction returned from wallet");
            }

            return signedTxs[0];
          },
        );

        await new Promise((resolve) => setTimeout(resolve, 1000));

        return await broadcastSignedTransaction(
          connections,
          new Uint8Array(signedTransaction.serialize()),
          "broadcast SOL transfer",
          {
            blockhash,
            lastValidBlockHeight,
          },
        );
      } catch (error) {
        console.error("[useWallet] sendSOL error:", error);
        throw error;
      } finally {
        setSending(false);
      }
    },
    [cluster, connections, publicKey],
  );

  const fetchSwapQuote = useCallback(
    async (
      inputMint: string,
      outputMint: string,
      inputAmount: number,
      inputDecimals: number,
    ) => {
      if (isDevnet) {
        setQuoteData(null);
        return null;
      }

      // A quote can take many seconds across Jupiter's route fallbacks. Tag
      // each request so a late reply can never repopulate a cleared quote and
      // become signable for a pair the user is no longer looking at.
      const requestId = quoteReqRef.current + 1;
      quoteReqRef.current = requestId;
      const isCurrent = () => requestId === quoteReqRef.current;

      setQuoteLoading(true);
      try {
        const amountInSmallest = toSmallestUnit(inputAmount, inputDecimals);
        const quote = await getSwapQuote(
          inputMint,
          outputMint,
          amountInSmallest,
        );
        if (!isCurrent()) return null;
        setQuoteData(quote);
        return quote;
      } catch (error) {
        console.error("[useWallet] quote error:", error);
        if (isCurrent()) setQuoteData(null);
        throw error;
      } finally {
        if (isCurrent()) setQuoteLoading(false);
      }
    },
    [isDevnet],
  );

  const clearQuote = useCallback(() => {
    // Bump the id so any in-flight request is discarded when it resolves.
    quoteReqRef.current += 1;
    setQuoteData(null);
    setQuoteLoading(false);
  }, []);

  const executeSwap = useCallback(
    async (
      quote: QuoteResponse,
      inputSymbol: string,
      outputSymbol: string,
      outputDecimals: number,
    ) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      if (isDevnet) {
        throw new Error("Jupiter swaps only work on Mainnet");
      }

      setSwapping(true);
      try {
        const swapTxBase64 = await getSwapTransaction(
          quote,
          publicKey.toBase58(),
        );
        const swapTxBuf = Buffer.from(swapTxBase64, "base64");
        const transaction = VersionedTransaction.deserialize(new Uint8Array(swapTxBuf));

        const signedTransaction = await transact(
          async (wallet: Web3MobileWallet) => {
            await wallet.authorize({
              cluster: "mainnet-beta",
              identity: APP_IDENTITY,
            });

            const signedTxs = await wallet.signTransactions({
              transactions: [transaction],
            });

            if (!signedTxs || signedTxs.length === 0) {
              throw new Error("No signed transaction returned");
            }

            return signedTxs[0];
          },
        );

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const { signature, confirmed } = await broadcastSignedTransaction(
          connections,
          new Uint8Array(signedTransaction.serialize()),
          "broadcast swap transaction",
        );

        const outputAmount = fromSmallestUnit(quote.outAmount, outputDecimals);
        clearQuote();

        return {
          signature,
          confirmed,
          inputSymbol,
          outputSymbol,
          outputAmount,
        };
      } catch (error) {
        console.error("[useWallet] swap error:", error);
        throw error;
      } finally {
        setSwapping(false);
      }
    },
    [clearQuote, connections, isDevnet, publicKey],
  );

  return {
    publicKey,
    connected: !!publicKey,
    connecting,
    sending,
    swapping,
    quoteLoading,
    quoteData,
    connect,
    disconnect,
    getBalance,
    sendSOL,
    fetchSwapQuote,
    clearQuote,
    executeSwap,
    connection,
  };
}
