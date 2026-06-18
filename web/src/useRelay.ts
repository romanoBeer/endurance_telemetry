import { useCallback, useEffect, useRef, useState } from "react";
import type { PitCommand, Strategy, Telemetry } from "./types";

export interface DriverFeed {
  telemetry: Telemetry;
  strategy: Strategy;
  lastUpdate: number;
}

export interface RelayState {
  status: "connecting" | "open" | "closed";
  drivers: string[];
  viewers: string[];
  feeds: Record<string, DriverFeed>;
  lastAck: { driver: string; applied: boolean } | null;
}

export interface RelayConfig {
  url: string;
  room: string;
  name: string;
}

/**
 * Connects to the relay as a viewer, tracks presence + per-driver feeds, and
 * exposes `sendStrategy` to push a pit command at a driver. Auto-reconnects.
 */
export function useRelay(cfg: RelayConfig | null) {
  const [state, setState] = useState<RelayState>({
    status: "connecting",
    drivers: [],
    viewers: [],
    feeds: {},
    lastAck: null,
  });
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!cfg) return;
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;

    const connect = () => {
      setState((s) => ({ ...s, status: "connecting" }));
      const ws = new WebSocket(cfg.url);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "join", room: cfg.room, role: "viewer", name: cfg.name }));
        setState((s) => ({ ...s, status: "open" }));
      };

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        switch (msg.type) {
          case "presence":
            setState((s) => ({ ...s, drivers: msg.drivers, viewers: msg.viewers }));
            break;
          case "telemetry":
            setState((s) => ({
              ...s,
              feeds: {
                ...s.feeds,
                [msg.driver]: {
                  telemetry: msg.telemetry,
                  strategy: msg.strategy,
                  lastUpdate: Date.now(),
                },
              },
            }));
            break;
          case "strategy_ack":
            setState((s) => ({ ...s, lastAck: { driver: msg.driver, applied: msg.applied } }));
            break;
        }
      };

      ws.onclose = () => {
        setState((s) => ({ ...s, status: "closed" }));
        if (!closed) retry = setTimeout(connect, 1500);
      };
      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      wsRef.current?.close();
    };
  }, [cfg?.url, cfg?.room, cfg?.name]);

  const sendStrategy = useCallback((target: string, strategy: PitCommand) => {
    wsRef.current?.send(JSON.stringify({ type: "set_strategy", target, strategy }));
  }, []);

  return { ...state, sendStrategy };
}
