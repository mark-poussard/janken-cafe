export type UserState = 'IDLE' | 'WAITING' | 'PLAYING';

export interface ConnectionItem {
    connectionId: string;
    state: UserState;
    pairId: string; // Unique ID for the pair/table, or 'NONE' if waiting
    partnerConnectionId?: string;
    lastSeen: number; // For potential cleanup
}

export interface WebSocketMessage {
    action: 'joinQueue' | 'getActiveTables' | 'playMove' | 'sendMessage' | 'leaveTable' | string;
    payload?: any;
}

export interface ServerWebSocketMessage {
    action: 'activeTablesUpdate' | 'paired' | 'partnerLeft' | 'returnedToIdle' | 'roundResult' | 'newMessage' | 'opponentMoved' | 'moveReceived' | 'error' | string; // Add new actions
    payload?: any;
}

export interface ActiveTablesUpdatePayload {
    count: number;
}


export interface PlayMovePayload {
    move: 'rock' | 'paper' | 'scissors';
}

export interface SendMessagePayload {
    message: string;
}