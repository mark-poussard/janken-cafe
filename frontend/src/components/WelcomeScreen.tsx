import React from 'react';
import '../styles/components/_welcomeScreen.scss';

interface WelcomeScreenProps {
    onJoinQueue: () => void;
    isJoining: boolean; 
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onJoinQueue, isJoining }) => {
    return (
        <div className="welcome-screen">
            <h2>Welcome to Janken Cafe!</h2>
            <p>We hope you enjoy your time with us. Please take a seat.</p>

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