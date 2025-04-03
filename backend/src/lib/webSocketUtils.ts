import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

const apiGwClient = new ApiGatewayManagementApiClient({
    apiVersion: '2018-11-29',
    endpoint: process.env.WEBSOCKET_API_ENDPOINT,
});

export const sendMessageToClient = async (connectionId: string, payload: object) => {
    try {
        const command = new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: JSON.stringify(payload),
        });
        await apiGwClient.send(command);
    } catch (error: any) {
        if (error.statusCode === 410) {
            console.log(`Stale connection detected: ${connectionId}`);
            // TODO add logic here to clean up the stale connection from DynamoDB
        } else {
            console.error(`Failed to send message to ${connectionId}:`, error);
        }
    }
};