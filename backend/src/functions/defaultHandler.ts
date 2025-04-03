import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDocClient, connectionsTable } from '../lib/dynamoDb';
import { sendMessageToClient } from '../lib/webSocketUtils';
import { WebSocketMessage, ConnectionItem } from '../lib/types';
import { handlePlayMove, handleChatMessage, handleLeaveTable, handleJoinQueue, handleGetActiveTables } from '../services/gameService';

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
    const connectionId = event.requestContext.connectionId;
    const body = event.body;

    if (!body) return { statusCode: 400, body: 'Empty message received.' };

    console.log(`Received message from ${connectionId}: ${body}`);
    let message: WebSocketMessage;
    try { message = JSON.parse(body); } catch (err) { return { statusCode: 400, body: 'Invalid JSON.' }; }

    try {
        const getCmd = new GetCommand({ TableName: connectionsTable, Key: { connectionId } });
        const { Item } = await ddbDocClient.send(getCmd);
        const user = Item as ConnectionItem | undefined;

        if (!user) {
            console.error(`User data not found for connectionId: ${connectionId}`);
            return { statusCode: 404, body: 'User not found.' };
        }

        switch (message.action) {
            case 'joinQueue':
                await handleJoinQueue(user);
                break;
            case 'getActiveTables':
                await handleGetActiveTables(user.connectionId);
                break;
            case 'playMove':
                await handlePlayMove(user, message.payload);
                break;
            case 'sendMessage':
                await handleChatMessage(user, message.payload);
                break;
            case 'leaveTable':
                await handleLeaveTable(user);
                break;
            default:
                console.log(`Unknown action from ${user.connectionId} (${user.state}): ${message.action}`);
                await sendMessageToClient(connectionId, { action: 'error', payload: { message: `Unknown action: ${message.action}` } });
        }
        return { statusCode: 200, body: 'Message processed.' };

    } catch (err) {
        console.error(`Failed to process message for ${connectionId}:`, err);
        await sendMessageToClient(connectionId, { action: 'error', payload: { message: 'Failed to process message on server.' } });
        return { statusCode: 500, body: 'Failed to process message.' };
    }
};