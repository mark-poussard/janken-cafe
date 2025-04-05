import { VersionConflictError } from "./errors";

const MAX_OPTIMISTIC_LOCK_RETRIES = 3;

export const optimisticLock = async (criticalSection : () => Promise<void>) => {
    let tryCount = 0;
    let versionConflictFailure = true;
    while(versionConflictFailure && tryCount < MAX_OPTIMISTIC_LOCK_RETRIES){
        try {
            versionConflictFailure = false;
            tryCount++;
            await criticalSection();
        } catch(error : any){
            if(error instanceof VersionConflictError){
                versionConflictFailure = true;
            }
            else {
                throw error;
            }
        }
    }
}