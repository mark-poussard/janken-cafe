import { APIGatewayProxyResultV2, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import { createConnection } from 'src/services/connectionTableService';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);

interface APIGatewayProxyWebsocketEventV2WithHeaders extends APIGatewayProxyWebsocketEventV2 {
    headers : {[key: string] : string}
}

export const handler = async (event : APIGatewayProxyWebsocketEventV2WithHeaders) : Promise<APIGatewayProxyResultV2<never>> => {
    try {
        const connectionId = event.requestContext.connectionId;
        console.log(`Client connecting: ${connectionId}`);

        const origin = event.headers?.origin || event.headers?.Origin; // Handle case variations

        if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
            console.error(`Origin check failed. Origin "${origin}" is not in the allowed list.`);
            return {
                statusCode: 403,
                body: 'Forbidden: Invalid Origin'
            };
        }

        await createConnection(connectionId);

        return { statusCode: 200, body: 'Connected.' };
    } catch (error : any) {
        return { statusCode: 500, body: JSON.stringify({message : 'Failed to process connection.', error}) };
    }
};