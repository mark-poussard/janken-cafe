import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { createConnection } from 'src/services/connectionTableService';

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
    try {
        const connectionId = event.requestContext.connectionId;
        console.log(`Client connecting: ${connectionId}`);
        await createConnection(connectionId);

        return { statusCode: 200, body: 'Connected.' };
    } catch (error : any) {
        return { statusCode: 500, body: JSON.stringify({message : 'Failed to process connection.', error}) };
    }
};