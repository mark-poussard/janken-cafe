import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
export const ddbDocClient = DynamoDBDocumentClient.from(client);
export const connectionsTable = process.env.CONNECTIONS_TABLE!;
export const pairGameTable = process.env.PAIR_GAME_TABLE!;