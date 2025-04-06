export type ConnectionState = 'IDLE' | 'WAITING' | 'PLAYING';

export interface ConnectionItem {
    connectionId: string;
    state: ConnectionState;
    pairId: string; // Unique ID for the pair/table, or 'NONE' if waiting
    partnerConnectionId?: string;
    lastSeen: number; // For potential cleanup
}

export interface WebSocketMessage {
    action: 'joinQueue' | 'getActiveTables' | 'playMove' | 'sendMessage' | 'leaveTable' | 'heartbeat' | string;
    payload?: any;
}

export interface ServerWebSocketMessage {
    action: 'activeTablesUpdate' | 'paired' | 'partnerLeft' | 'returnedToIdle' | 'roundResult' | 'newMessage' | 'opponentMoved' | 'heartbeat' | 'error' | string;
    payload?: any;
}

export interface ActiveTablesUpdatePayload {
    count: number;
}

export type JankenPlayMove = 'rock' | 'paper' | 'scissors';

export interface JankenPlayMovePayload {
    move: JankenPlayMove;
}

export interface SendMessagePayload {
    message: string;
}

export interface JankenGameItem {
    pairId: string;
    connectionId: string;
    move: JankenPlayMove;
}