import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { sendMessageToClient } from '../lib/webSocketUtils';
import { ConnectionItem } from '../lib/types';
import { deleteConnection, getConnection, updateConnectionToIdle } from 'src/services/connectionTableService';
import { deleteGame } from 'src/services/pairGameTableService';

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
    const connectionId = event.requestContext.connectionId;
    console.log(`Client disconnecting: ${connectionId}`);

    try {
        // 1. Get user data to find partner if playing
        const { Item } = await getConnection(connectionId);
        const user = Item as ConnectionItem | undefined;

        // 2. Delete the user's connection record
        await deleteConnection(connectionId);
        console.log(`Connection ${connectionId} deleted.`);

        // 3. If the user was playing, notify the partner and set partner back to IDLE
        if (user && user.state === 'PLAYING' && user.partnerConnectionId) {
            const partnerId = user.partnerConnectionId;
            console.log(`User ${connectionId} was playing with ${partnerId}. Notifying partner and setting them to IDLE.`);

            await Promise.all([
                deleteGame(user.pairId),
                sendMessageToClient(partnerId, { action: 'partnerLeft' }),
                updateConnectionToIdle(partnerId, user.pairId)
            ]);
        }

        return { statusCode: 200, body: 'Disconnected.' };
    } catch (error : any) {
        console.error('Failed to handle disconnect:', error);
        return { statusCode: 500, body: JSON.stringify({message : 'Failed to disconnect.', error}) };
    }
};