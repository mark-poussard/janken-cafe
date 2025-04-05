import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDocClient, pairGameTable } from "src/lib/dynamoDb";
import { NestedError, VersionConflictError } from "src/lib/errors";


export const getGame = async (pairId : string) => {
    try {
        const getCmd = new GetCommand({ TableName: pairGameTable, Key: { pairId } });
        return await ddbDocClient.send(getCmd);
    } catch (error : any) {
        throw new NestedError(`Failed to retrieve game data ${pairId}`, error)
    }
}

export const upsertGame = async (pairId : string, gameData : any, version: number | null) => {
    if(version != null){
        return await updateGame(pairId, gameData, version);
    } else {
        return await putGame(pairId, gameData)
    }
}

const putGame = async (pairId : string, gameData : any) => {
    try {
        const putCommand = new PutCommand({
            TableName: pairGameTable,
            Item: {
                pairId, 
                gameData,
                lastUpdate : Date.now(),
                version : 0
            },
            ConditionExpression: 'attribute_not_exists(pairId)'
        });
        await ddbDocClient.send(putCommand);
    } catch (error : any) {
        if (error instanceof ConditionalCheckFailedException) {
            console.warn(`Game with key ${pairId} already exists.`);
            throw new VersionConflictError();

        } else {
            console.error(`Failed to putGame due to a non-version-conflict error for pairId : ${pairId}`, error);
            throw new NestedError(`Failed to put a new janken game move pairId : ${pairId}, gameData : ${JSON.stringify(gameData)}`, error);
        }
    }
}

const updateGame = async (pairId : string, gameData : any, version: number) => {
    try {
        const updateCommand = new UpdateCommand({
            TableName: pairGameTable,
            Key: { pairId },
            UpdateExpression: 'SET gameData = :gameData, lastUpdate = :lastUpdate, #version = :nextVersion',
            ExpressionAttributeNames: {
                '#version': 'version', // 'version' is a reserved word
            },
            ExpressionAttributeValues: {
                ':gameData': gameData,
                ':lastUpdate': Date.now(),
                ':nextVersion': version + 1,
                ':expectedVersion': version,
                ':pairId': pairId
            },
            ConditionExpression: '#version = :expectedVersion',
        });
        await ddbDocClient.send(updateCommand);
    } catch (error : any) {
        if (error instanceof ConditionalCheckFailedException) {
            console.warn(`Version conflict detected for pairId: ${pairId}. Expected version ${version}, but found a different version.`);
            throw new VersionConflictError();

        } else {
            console.error(`Failed to putGame due to a non-version-conflict error for pairId : ${pairId}`, error);
            throw new NestedError(`Failed to put a new janken game move pairId : ${pairId}, gameData : ${JSON.stringify(gameData)}`, error);
        }
    }
}

export const deleteGame = async (pairId : string) => {
    if(pairId === 'NONE') return;
    try {
        const deleteCmd = new DeleteCommand({ TableName: pairGameTable, Key: { pairId } });
        await ddbDocClient.send(deleteCmd);
    } catch (error: any) {
        throw new NestedError(`Failed to delete janken game. pairId : ${pairId}`, error);
    }
}