import { QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDocClient, connectionsTable } from '../lib/dynamoDb';
import { sendMessageToClient } from '../lib/webSocketUtils';
import { v4 as uuidv4 } from 'uuid';
import { UserState } from "../lib/types";

export const tryPairUsers = async (connectionId: string): Promise<void> => {
    const queryCommand = new QueryCommand({
        TableName: connectionsTable,
        IndexName: 'StatePairIdIndex',
        KeyConditionExpression: '#state = :state AND pairId = :pairId',
        FilterExpression: 'connectionId <> :selfConnectionId', // Exclude self in post-processing
        ExpressionAttributeNames: { '#state': 'state' },
        ExpressionAttributeValues: {
            ':state': 'WAITING' as UserState,
            ':pairId': 'NONE',
            ':selfConnectionId': connectionId
        },
        Limit: 2, // We might select ourselves, so need at least 2 results
    });

    try {
        const { Items } = await ddbDocClient.send(queryCommand);

        if (Items && Items.length > 0) {
            const partner = Items[0];
            const partnerConnectionId = partner.connectionId;
            const pairId = uuidv4();
            console.log(`Pairing ${connectionId} with ${partnerConnectionId}, pairId: ${pairId}`);

            const updatePromises = [
                updateUserToPlaying(connectionId, partnerConnectionId, pairId),
                updateUserToPlaying(partnerConnectionId, connectionId, pairId)
            ];
            await Promise.all(updatePromises);

            console.log(`DynamoDB records updated for pair ${pairId}. Notifying users.`);
            const payload = { action: 'paired', payload: { pairId: pairId } };

            await Promise.all([
                sendMessageToClient(connectionId, payload),
                sendMessageToClient(partnerConnectionId, payload)
            ]);
            console.log(`'paired' message sent to both ${connectionId} and ${partnerConnectionId}`);
        } else {
            console.log(`No suitable partner found for ${connectionId}. Waiting.`);
            await sendMessageToClient(connectionId, { action: 'error', payload: { message: `No suitable partner found for ${connectionId}. Waiting.` } });
        }

    } catch (err: any) {
        console.error(`Error during pairing query/update for ${connectionId}:`, err);
        await sendMessageToClient(connectionId, { action: 'error', payload: { message: `Error during pairing query/update for ${connectionId}`, error : err } });
        if (err.name === 'ConditionalCheckFailedException') {
            console.warn(`Conditional check failed during pairing update for ${connectionId}. User state likely changed.`);
        }
    }
};

const updateUserToPlaying = async (connectionId: string, partnerConnectionId: string, pairId: string): Promise<void> => {
    const updateCommand = new UpdateCommand({
        TableName: connectionsTable,
        Key: { connectionId: connectionId },
        UpdateExpression: 'SET #state = :newState, pairId = :pairId, partnerConnectionId = :partnerId, lastSeen = :now',
        ExpressionAttributeNames: { '#state': 'state' },
        ExpressionAttributeValues: {
            ':newState': 'PLAYING' as UserState,
            ':pairId': pairId,
            ':partnerId': partnerConnectionId,
            ':now': Date.now(),
            ':currentState': 'WAITING' as UserState,
            ':currentPairId': 'NONE'
        },
        ConditionExpression: '#state = :currentState AND pairId = :currentPairId',
    });
    try {
        await ddbDocClient.send(updateCommand);
        console.log(`User ${connectionId} updated to PLAYING with partner ${partnerConnectionId}`);
    } catch (error: any) {
        console.error(`Failed to update user ${connectionId} to playing (expecting WAITING state):`, error.name, error.message);
        throw error;
    }
};