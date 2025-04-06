import { DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { connectionsTable, ddbDocClient } from "src/lib/dynamoDb";
import { NestedError } from "src/lib/errors";
import { ConnectionState } from "src/lib/types";

export const createConnection = async (connectionId : string) => {
    try {
        const newItem = {
            connectionId: connectionId,
            state: 'IDLE',
            pairId: 'NONE',
            lastSeen: Date.now(),
        };
        const putCommand = new PutCommand({
            TableName: connectionsTable,
            Item: newItem,
        });
        await ddbDocClient.send(putCommand);
    } catch (error : any) {
        throw new NestedError(`Failed to create a new db entry for ${connectionId}:`, error)
    }
}

export const getConnection = async (connectionId : string) => {
    try {
        const getCmd = new GetCommand({ TableName: connectionsTable, Key: { connectionId } });
        return await ddbDocClient.send(getCmd);
    } catch (error : any) {
        throw new NestedError(`Failed to retrieve connection ${connectionId}`, error)
    }
}

export const updateConnectionLastSeen = async (connectionId: string): Promise<void> => {
    const updateCommand = new UpdateCommand({
        TableName: connectionsTable,
        Key: { connectionId: connectionId },
        UpdateExpression: 'SET lastSeen = :now',
        ExpressionAttributeValues: {
            ':now': Date.now(),
        },
    });
    try {
        await ddbDocClient.send(updateCommand);
    } catch (error : any) {
        console.error(`Failed to update ${connectionId} last seen`, error.name, error.message);
        throw new NestedError(`Failed to update ${connectionId} last seen`, error);
    }
};

export const updateConnectionToWaiting = async (connectionId : String) => {
    try {
        const updateCmd = new UpdateCommand({
            TableName: connectionsTable,
            Key: { connectionId: connectionId },
            UpdateExpression: 'SET #state = :newState',
            ExpressionAttributeNames: { '#state': 'state' },
            ConditionExpression: '#state = :currentState',
            ExpressionAttributeValues: {
                ':newState': 'WAITING' as ConnectionState,
                ':currentState': 'IDLE' as ConnectionState
            }
        });
        await ddbDocClient.send(updateCmd);
    } catch (error : any) {
        if (error.name === 'ConditionalCheckFailedException') {
            console.warn(`User ${connectionId} state was not IDLE when trying to join queue.`);
            throw new NestedError(`User ${connectionId} state was not IDLE when trying to join queue.`, error)
        } else {
            console.error(`Failed to update user ${connectionId} to WAITING:`, error);
            throw new NestedError(`Failed to update user ${connectionId} to WAITING:`, error)
        }
    }
}

export const updateConnectionToIdle = async (connId: string, expectedPairId: string) => {
    const updateCmd = new UpdateCommand({
        TableName: connectionsTable,
        Key: { connectionId: connId },
        UpdateExpression: 'SET #state = :newState, pairId = :newPairId REMOVE partnerConnectionId',
        ExpressionAttributeNames: { '#state': 'state' },
        ExpressionAttributeValues: {
            ':newState': 'IDLE' as ConnectionState,
            ':newPairId': 'NONE',
            ':expectedPairId': expectedPairId
        },
         ConditionExpression: 'pairId = :expectedPairId'
    });
    try {
        await ddbDocClient.send(updateCmd);
    } catch (error : any) {
         if (error.name === 'ConditionalCheckFailedException') {
            console.warn(`User ${connId} state couldn't be reset to IDLE (perhaps they disconnected or left already).`);
            throw new NestedError(`User ${connId} state couldn't be reset to IDLE (perhaps they disconnected or left already).`, error)
         } else {
            console.error(`Failed to update user ${connId} to IDLE:`, error);
            throw new NestedError(`Failed to update user ${connId} to IDLE:`, error)
         }
    }
};

export const getConnectionPair = async (connectionId : String) => {
    try{
        const queryCommand = new QueryCommand({
            TableName: connectionsTable,
            IndexName: 'StatePairIdIndex',
            KeyConditionExpression: '#state = :state AND pairId = :pairId',
            FilterExpression: 'connectionId <> :selfConnectionId', // Exclude self in query post-processing
            ExpressionAttributeNames: { '#state': 'state' },
            ExpressionAttributeValues: {
                ':state': 'WAITING' as ConnectionState,
                ':pairId': 'NONE',
                ':selfConnectionId': connectionId
            },
            Limit: 2, // We might select ourselves, so need at least 2 results
        });
        return await ddbDocClient.send(queryCommand);
    } catch (error : any) {
        if (error.name === 'ConditionalCheckFailedException') {
            console.warn(`Conditional check failed during pairing update for ${connectionId}. User state likely changed.`);
            throw new NestedError(`Conditional check failed during pairing update for ${connectionId}. User state likely changed.`, error)
        }
        else {
            throw new NestedError(`Error during pairing query/update for ${connectionId}`, error)
        }
    }
}

export const updateConnectionToPlaying = async (connectionId: string, partnerConnectionId: string, pairId: string): Promise<void> => {
    const updateCommand = new UpdateCommand({
        TableName: connectionsTable,
        Key: { connectionId: connectionId },
        UpdateExpression: 'SET #state = :newState, pairId = :pairId, partnerConnectionId = :partnerId, lastSeen = :now',
        ExpressionAttributeNames: { '#state': 'state' },
        ExpressionAttributeValues: {
            ':newState': 'PLAYING' as ConnectionState,
            ':pairId': pairId,
            ':partnerId': partnerConnectionId,
            ':now': Date.now(),
            ':currentState': 'WAITING' as ConnectionState,
            ':currentPairId': 'NONE'
        },
        ConditionExpression: '#state = :currentState AND pairId = :currentPairId',
    });
    try {
        await ddbDocClient.send(updateCommand);
        console.log(`User ${connectionId} updated to PLAYING with partner ${partnerConnectionId}`);
    } catch (error : any) {
        console.error(`Failed to update user ${connectionId} to playing (expecting WAITING state):`, error.name, error.message);
        throw new NestedError(`Failed to update user ${connectionId} to playing (expecting WAITING state).`, error);
    }
};

export const deleteConnection = async (connectionId : string) => {
    try {
        const deleteCmd = new DeleteCommand({ TableName: connectionsTable, Key: { connectionId } });
        await ddbDocClient.send(deleteCmd);
    } catch (error: any) {
        throw new NestedError(`Failed to delete connection. connectionId : ${connectionId}`, error);
    }
}