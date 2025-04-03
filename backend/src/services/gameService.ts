import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient, connectionsTable } from '../lib/dynamoDb';
import { sendMessageToClient } from '../lib/webSocketUtils';
import { ConnectionItem, PlayMovePayload, SendMessagePayload, UserState } from '../lib/types';
import { tryPairUsers } from './pairingService';

// TODO : Move the game state to DynamoDB
// Temporary store for moves in the current round { pairId: { connectionId1: move, connectionId2: move } }
const currentMoves: Record<string, Record<string, 'rock' | 'paper' | 'scissors' | undefined>> = {};

export const handleJoinQueue = async (user: ConnectionItem) => {
    if (user.state !== 'IDLE') {
        console.warn(`User ${user.connectionId} tried to join queue but state is ${user.state}`);
        await sendMessageToClient(user.connectionId, { action: 'error', payload: { message: `Cannot join queue while ${user.state}` } });
        return;
    }

    console.log(`User ${user.connectionId} joining the queue.`);
    const updateCmd = new UpdateCommand({
        TableName: connectionsTable,
        Key: { connectionId: user.connectionId },
        UpdateExpression: 'SET #state = :newState',
        ExpressionAttributeNames: { '#state': 'state' },
        ConditionExpression: '#state = :currentState',
        ExpressionAttributeValues: {
             ':newState': 'WAITING' as UserState,
             ':currentState': 'IDLE' as UserState
        }
    });

    try {
        await ddbDocClient.send(updateCmd);
        console.log(`User ${user.connectionId} state updated to WAITING.`);
        await tryPairUsers(user.connectionId); 
    } catch (error: any) {
        if (error.name === 'ConditionalCheckFailedException') {
            console.warn(`User ${user.connectionId} state was not IDLE when trying to join queue.`);
             await sendMessageToClient(user.connectionId, { action: 'error', payload: { message: 'Could not join queue, state conflict.' } });
        } else {
            console.error(`Failed to update user ${user.connectionId} to WAITING:`, error);
            await sendMessageToClient(user.connectionId, { action: 'error', payload: { message: 'Server error joining queue.' } });
        }
    }
};

export const handleGetActiveTables = async (requestingConnectionId: string) => {
    console.log(`Calculating active tables for request from ${requestingConnectionId}`);
    try {
        // TODO : Implement active table count feature
        await sendMessageToClient(requestingConnectionId, {
            action: 'activeTablesUpdate',
            payload: { count: 0 }
        });

    } catch (error) {
        console.error("Error querying active tables:", error);
        await sendMessageToClient(requestingConnectionId, { action: 'error', payload: { message: 'Could not retrieve active table count.', error }});
    }
};

export const handlePlayMove = async (user: ConnectionItem, payload: PlayMovePayload) => {
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

    if (!currentMoves[user.pairId]) {
        currentMoves[user.pairId] = {};
    }
    currentMoves[user.pairId][user.connectionId] = move;

    await sendMessageToClient(user.connectionId, { action: 'moveReceived', payload: { move: move } });

    const opponentMove = currentMoves[user.pairId][user.partnerConnectionId];

    if (opponentMove) {
        const playerMove = move;
        const result = determineWinner(playerMove, opponentMove);

        console.log(`Pair ${user.pairId} round result: Player1 (${playerMove}) vs Player2 (${opponentMove}) -> ${result}`);


        await Promise.all([
            sendMessageToClient(user.connectionId, {
                action: 'roundResult',
                payload: {
                    yourMove: playerMove,
                    opponentMove: opponentMove,
                    result: result === 'player1' ? 'win' : (result === 'player2' ? 'loss' : 'tie')
                }
            }),
            sendMessageToClient(user.partnerConnectionId, {
                action: 'roundResult',
                payload: {
                    yourMove: opponentMove,
                    opponentMove: playerMove,
                    result: result === 'player2' ? 'win' : (result === 'player1' ? 'loss' : 'tie')
                }
            })
        ]);

        delete currentMoves[user.pairId];
    } else {
        await sendMessageToClient(user.partnerConnectionId, { action: 'opponentMoved' });
    }
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
    const updateUserToIdle = async (connId: string, expectedPairId: string): Promise<boolean> => {
        const updateCmd = new UpdateCommand({
            TableName: connectionsTable,
            Key: { connectionId: connId },
            UpdateExpression: 'SET #state = :newState, pairId = :newPairId REMOVE partnerConnectionId',
            ExpressionAttributeNames: { '#state': 'state' },
            ExpressionAttributeValues: {
                ':newState': 'IDLE' as UserState,
                ':newPairId': 'NONE',
                ':expectedPairId': expectedPairId
            },
             ConditionExpression: 'pairId = :expectedPairId'
        });
        try {
            await ddbDocClient.send(updateCmd);
            console.log(`User ${connId} successfully updated to IDLE.`);
            return true;
        } catch (error: any) {
             if (error.name === 'ConditionalCheckFailedException') {
                 console.warn(`User ${connId} state couldn't be reset to IDLE (perhaps they disconnected or left already).`);
             } else {
                console.error(`Failed to update user ${connId} to IDLE:`, error);
             }
             return false;
        }
    };

    // 2. Attempt to update both users to IDLE
    await Promise.all([
        updateUserToIdle(leavingUserId, currentPairId),
        updateUserToIdle(partnerId, currentPairId)
    ])

    // 3. Notify involved parties
    await sendMessageToClient(leavingUserId, { action: 'returnedToIdle' });
    await sendMessageToClient(partnerId, { action: 'partnerLeft' });

    // 4. Clean up any pending game state for the pair
    if (currentPairId && currentMoves[currentPairId]) {
        delete currentMoves[currentPairId];
        console.log(`Cleared pending moves for pair ${currentPairId}`);
    }
};