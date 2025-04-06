import { sendMessageToClient } from '../lib/webSocketUtils';
import { v4 as uuidv4 } from 'uuid';
import { getConnectionPair, updateConnectionLastSeen, updateConnectionToPlaying } from "./connectionTableService";

export const handleHeartbeat = async (connectionId: string) => {
    await Promise.all([
        updateConnectionLastSeen(connectionId)
    ]);
}

export const tryPairUsers = async (connectionId: string): Promise<void> => {
    const { Items } = await getConnectionPair(connectionId);

    if (Items && Items.length > 0) {
        const partner = Items[0];
        const partnerConnectionId = partner.connectionId;
        const pairId = uuidv4();
        console.log(`Pairing ${connectionId} with ${partnerConnectionId}, pairId: ${pairId}`);

        await Promise.all([
            updateConnectionToPlaying(connectionId, partnerConnectionId, pairId),
            updateConnectionToPlaying(partnerConnectionId, connectionId, pairId)
        ]);

        console.log(`DynamoDB records updated for pair ${pairId}. Notifying users.`);
        const payload = { action: 'paired', payload: { pairId: pairId } };

        await Promise.all([
            sendMessageToClient(connectionId, payload),
            sendMessageToClient(partnerConnectionId, payload)
        ]);
        console.log(`'paired' message sent to both ${connectionId} and ${partnerConnectionId}`);
    } else {
        console.log(`No suitable partner found for ${connectionId}. Waiting.`);
        throw new Error(`No suitable partner found for ${connectionId}. Waiting.`)
    }
};