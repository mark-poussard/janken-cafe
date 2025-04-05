import { sendMessageToClient } from '../lib/webSocketUtils';
import { ConnectionItem, JankenPlayMovePayload, SendMessagePayload } from '../lib/types';
import { tryPairUsers } from './pairingService';
import { updateConnectionToWaiting, updateConnectionToIdle } from './connectionTableService';
import { deleteGame, getGame, upsertGame } from './pairGameTableService';
import { optimisticLock } from 'src/lib/optimisticLocking';

export const handleJoinQueue = async (user: ConnectionItem) => {
    if (user.state !== 'IDLE') {
        console.warn(`User ${user.connectionId} tried to join queue but state is ${user.state}`);
        throw new Error(`Cannot join queue while ${user.state}`);
    }

    console.log(`User ${user.connectionId} joining the queue.`);
    await updateConnectionToWaiting(user.connectionId);
    console.log(`User ${user.connectionId} state updated to WAITING.`);
    await tryPairUsers(user.connectionId);
};

export const handleGetActiveTables = async (requestingConnectionId: string) => {
    // TODO : Implement active table count feature
    await sendMessageToClient(requestingConnectionId, {
        action: 'activeTablesUpdate',
        payload: { count: 0 }
    });
};

export const handlePlayMove = async (user: ConnectionItem, payload: JankenPlayMovePayload) => {
    if (user.state !== 'PLAYING' || !user.pairId || !user.partnerConnectionId || user.pairId === 'NONE') {
        console.error(`User ${user.connectionId} tried to play move but is not in PLAYING state or valid pair.`);
        await sendMessageToClient(user.connectionId, { action: 'error', payload: { message: 'Not in an active game.' } });
        return;
    }

    const { move } = payload;
    if (!['rock', 'paper', 'scissors'].includes(move)) {
         console.error(`Invalid move from ${user.connectionId}: ${move}`);
         await sendMessageToClient(user.connectionId, { action: 'error', payload: { message: 'Invalid move.' } });
         return;
    }

    console.log(`User ${user.connectionId} in pair ${user.pairId} played ${move}`);

    await optimisticLock(async () => {
        const { Item } = await getGame(user.pairId);
        const version = Item?.version || null;
        const currentMoves = Item?.gameData || {};
        currentMoves[user.connectionId] = move;
    
        const opponentMove = currentMoves[user.partnerConnectionId!!];
        if (opponentMove) {
            const playerMove = move;
            const result = determineWinner(playerMove, opponentMove);
    
            console.log(`Pair ${user.pairId} round result: Player1 (${playerMove}) vs Player2 (${opponentMove}) -> ${result}`);
    
            await Promise.all([
                deleteGame(user.pairId),
                sendMessageToClient(user.connectionId, {
                    action: 'roundResult',
                    payload: {
                        yourMove: playerMove,
                        opponentMove: opponentMove,
                        result: result === 'player1' ? 'win' : (result === 'player2' ? 'loss' : 'tie')
                    }
                }),
                sendMessageToClient(user.partnerConnectionId!!, {
                    action: 'roundResult',
                    payload: {
                        yourMove: opponentMove,
                        opponentMove: playerMove,
                        result: result === 'player2' ? 'win' : (result === 'player1' ? 'loss' : 'tie')
                    }
                })
            ]);
        } else {
            await Promise.all([
                upsertGame(user.pairId, currentMoves, version),
                sendMessageToClient(user.partnerConnectionId!!, { action: 'opponentMoved' })
            ]);
        }
    })
};

const determineWinner = (move1: string, move2: string): 'player1' | 'player2' | 'tie' => {
    if (move1 === move2) return 'tie';
    if (
        (move1 === 'rock' && move2 === 'scissors') ||
        (move1 === 'scissors' && move2 === 'paper') ||
        (move1 === 'paper' && move2 === 'rock')
    ) {
        return 'player1';
    }
    return 'player2';
};


export const handleChatMessage = async (user: ConnectionItem, payload: SendMessagePayload) => {
    if (user.state !== 'PLAYING' || !user.partnerConnectionId) {
        console.warn(`User ${user.connectionId} tried to send chat message but is not in PLAYING state.`);
        await sendMessageToClient(user.connectionId, { action: 'error', payload: { message: 'Not in an active game.' }});
        return;
    }
     if (!payload || typeof payload.message !== 'string' || payload.message.trim() === '') {
        await sendMessageToClient(user.connectionId, { action: 'error', payload: { message: 'Invalid message.' }});
        return;
     }

     console.log(`Relaying chat message from ${user.connectionId} to ${user.partnerConnectionId}`);

     await sendMessageToClient(user.partnerConnectionId, {
         action: 'newMessage',
         payload: { message: payload.message.trim() }
     });
};


export const handleLeaveTable = async (user: ConnectionItem) => {
    if (user.state !== 'PLAYING' || !user.partnerConnectionId) {
        console.warn(`User ${user.connectionId} tried to leave table but state is ${user.state}`);
        await sendMessageToClient(user.connectionId, { action: 'error', payload: { message: `Cannot leave table, current state: ${user.state}` } });
        return;
    }

    const partnerId = user.partnerConnectionId;
    const leavingUserId = user.connectionId;
    const currentPairId = user.pairId;

    console.log(`User ${leavingUserId} requested to leave table/pair ${currentPairId}`);

    // 1. Update leaving user to IDLE
    await Promise.all([
        updateConnectionToIdle(leavingUserId, currentPairId),
        updateConnectionToIdle(partnerId, currentPairId)
    ])

    // 2. Notify involved parties
    await sendMessageToClient(leavingUserId, { action: 'returnedToIdle' });
    await sendMessageToClient(partnerId, { action: 'partnerLeft' });

    // 3. Clean up any pending game state for the pair
    deleteGame(currentPairId);
};