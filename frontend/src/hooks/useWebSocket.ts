import { useState, useEffect, useRef, useCallback } from 'react';

interface ServerMessage {
    action: string;
    payload?: any;
}

type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseWebSocketReturn {
    sendMessage: (message: object) => void;
    lastMessage: ServerMessage | null;
    connectionStatus: WebSocketStatus;
    readyState: number | null;
}

const useWebSocket = (url: string | null): UseWebSocketReturn => {
    const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<WebSocketStatus>('disconnected');
    const [readyState, setReadyState] = useState<number | null>(null);
    const ws = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!url) {
            ws.current?.close();
            setConnectionStatus('disconnected');
            ws.current = null;
            return;
        }

        if (!ws.current || (ws.current.readyState !== WebSocket.OPEN && ws.current.readyState !== WebSocket.CONNECTING)) {
            console.log('Connecting WebSocket...');
            setConnectionStatus('connecting');
            ws.current = new WebSocket(url);
            setReadyState(ws.current.readyState);

            ws.current.onopen = () => {
                console.log('WebSocket Connected');
                setConnectionStatus('connected');
                 setReadyState(ws.current?.readyState ?? null);
            };

            ws.current.onclose = (event) => {
                console.log('WebSocket Disconnected:', event.code, event.reason);
                setConnectionStatus('disconnected');
                setLastMessage(null);
                ws.current = null;
                setReadyState(null);
            };

            ws.current.onerror = (error) => {
                console.error('WebSocket Error:', error);
                setConnectionStatus('error');
                 setReadyState(ws.current?.readyState ?? null);
            };

            ws.current.onmessage = (event) => {
                try {
                    const messageData = JSON.parse(event.data);
                    console.log('WebSocket Message Received:', messageData);
                    setLastMessage(messageData as ServerMessage);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                    setLastMessage({ action: 'parseError', payload: event.data });
                }
            };
        }
    }, [url]);

    const sendMessage = useCallback((message: object) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            console.log('Sending message:', message);
            ws.current.send(JSON.stringify(message));
        } else {
            console.error('Cannot send message, WebSocket is not connected.');
        }
    }, []);

    return { sendMessage, lastMessage, connectionStatus, readyState };
};

export default useWebSocket;