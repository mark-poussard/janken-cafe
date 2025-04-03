import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { DeleteCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDocClient, connectionsTable } from '../lib/dynamoDb';
import { sendMessageToClient } from '../lib/webSocketUtils';
import { ConnectionItem, UserState } from '../lib/types';

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
    const connectionId = event.requestContext.connectionId;
    console.log(`Client disconnecting: ${connectionId}`);

    try {
        // 1. Get user data to find partner if playing
        const getCmd = new GetCommand({ TableName: connectionsTable, Key: { connectionId } });
        const { Item } = await ddbDocClient.send(getCmd);
        const user = Item as ConnectionItem | undefined;

        // 2. Delete the user's connection record
        const deleteCmd = new DeleteCommand({ TableName: connectionsTable, Key: { connectionId } });
        await ddbDocClient.send(deleteCmd);
        console.log(`Connection ${connectionId} deleted.`);

        // 3. If the user was playing, notify the partner and set partner back to IDLE
        if (user && user.state === 'PLAYING' && user.partnerConnectionId) {
            const partnerId = user.partnerConnectionId;
            console.log(`User ${connectionId} was playing with ${partnerId}. Notifying partner and setting them to IDLE.`);

            await sendMessageToClient(partnerId, { action: 'partnerLeft' });

            const updateCmd = new UpdateCommand({
                TableName: connectionsTable,
                Key: { connectionId: partnerId },
                UpdateExpression: 'SET #state = :newState, pairId = :newPairId REMOVE partnerConnectionId',
                ExpressionAttributeNames: { '#state': 'state' },
                ExpressionAttributeValues: {
                    ':newState': 'IDLE' as UserState,
                    ':newPairId': 'NONE',
                    ':expectedPairId': user.pairId
                },
                ConditionExpression: 'pairId = :expectedPairId',
            });
            try {
                await ddbDocClient.send(updateCmd);
            } catch (error: any) {
                if (error.name === 'ConditionalCheckFailedException') {
                    console.warn(`Partner ${partnerId} state couldn't be reset to IDLE (perhaps they disconnected too or left).`);
                } else {
                    console.error(`Failed to update partner ${partnerId} state to IDLE:`, error);
                }
            }
        }

        return { statusCode: 200, body: 'Disconnected.' };
    } catch (err) {
        console.error('Failed to handle disconnect:', err);
        return { statusCode: 500, body: 'Failed to disconnect.' };
    }
};