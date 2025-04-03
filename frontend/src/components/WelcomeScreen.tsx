import React from 'react';
import '../styles/components/_welcomeScreen.scss';

interface WelcomeScreenProps {
    activeTableCount: number | null;
    onJoinQueue: () => void;
    isJoining: boolean; 
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ activeTableCount, onJoinQueue, isJoining }) => {
    return (
        <div className="welcome-screen">
            <h2>Welcome to Janken Cafe!</h2>
            <p>We hope you enjoy your time with us. Please take a seat.</p>

            {/* TODO : Active table feature
                <div className="status-info">
                {activeTableCount !== null ? (
                    <p>Active Tables: {activeTableCount}</p>
                ) : (
                    <p>Loading table count...</p>
                )}
            </div> */}

            <button
                className="join-button"
                onClick={onJoinQueue}
                disabled={isJoining}
            >
                {isJoining ? 'Joining...' : 'Join a Table'}
            </button>
        </div>
    );
};

export default WelcomeScreen;