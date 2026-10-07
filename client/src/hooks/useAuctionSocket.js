import { useEffect, useRef, useState } from 'react';
import { getSocket, AUCTION_EVENTS, SOCKET_DISABLED } from '../services/socket.js';
import { auctionApi } from '../services/api.js';

/**
 * Subscribes to every auction event. `onEvent(eventName, payload)` is called for each,
 * and `connected` reflects the socket status. Payloads from the server include a full
 * `state` snapshot (auction, teams, bids, stats, settings) so screens can update instantly.
 *
 * Options:
 *   poll     – when true and no socket connection is available (disabled host or
 *              temporarily disconnected), fetch /auctions/current every `interval` ms and
 *              call onEvent('poll', { state }). Used by the auction screens.
 *   interval – polling interval in ms (default 3000).
 */
export function useAuctionSocket(onEvent, { poll = false, interval = 3000 } = {}) {
  const [connected, setConnected] = useState(false);
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    setConnected(socket.connected);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    const listeners = AUCTION_EVENTS.map((event) => {
      const fn = (payload) => handlerRef.current && handlerRef.current(event, payload);
      socket.on(event, fn);
      return [event, fn];
    });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      listeners.forEach(([event, fn]) => socket.off(event, fn));
    };
  }, []);

  // Polling fallback
  useEffect(() => {
    if (!poll || connected) return undefined;
    let cancelled = false;
    const tick = async () => {
      try {
        const state = await auctionApi.current();
        if (!cancelled && handlerRef.current) handlerRef.current('poll', { state });
      } catch (e) {
        /* network hiccup – try again next tick */
      }
    };
    const id = setInterval(tick, interval);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [poll, connected, interval]);

  return { connected, polling: poll && !connected, socketDisabled: SOCKET_DISABLED };
}
