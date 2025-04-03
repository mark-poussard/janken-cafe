import React from 'react';
import '../styles/components/_waitingRoom.scss';

interface WaitingRoomProps {
    message: string;
    showSpinner?: boolean;
}

const WaitingRoom: React.FC<WaitingRoomProps> = ({
    message,
    showSpinner = true,
}) => {
    return (
        <div className="waiting-room">
            {showSpinner && <div className="spinner"></div>}
            <p className="wait-message">{message}</p>
        </div>
    );
};

export default WaitingRoom;