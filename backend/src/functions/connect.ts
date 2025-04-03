import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDocClient, connectionsTable } from '../lib/dynamoDb';

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
    const connectionId = event.requestContext.connectionId;
    console.log(`Client connecting: ${connectionId}`);

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

    try {
        await ddbDocClient.send(putCommand);
        console.log(`Connection ${connectionId} saved as IDLE.`);

        return { statusCode: 200, body: 'Connected.' };

    } catch (err) {
        console.error(`Failed during connect process for ${connectionId}:`, err);
        return { statusCode: 500, body: 'Failed to process connection.' };
    }
};