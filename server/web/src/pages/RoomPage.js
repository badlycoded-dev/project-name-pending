import { useParams, useNavigate } from 'react-router-dom';
import { VideoConference } from '../components/VideoConference';

/**
 * /room/:roomId
 *
 * Handles shareable video-conference links.
 * Anyone with a valid session token who visits this URL is dropped
 * straight into the room with mic and camera off (they choose when to
 * enable them, Chrome will prompt at that point).
 *
 * If the user is not logged in, they are sent to /login first and
 * redirected back here after authentication.
 */
export default function RoomPage({ data }) {
    const { roomId } = useParams();
    const navigate   = useNavigate();

    const token = localStorage.getItem('token');

    // Not authenticated — redirect to login, come back after
    if (!token) {
        const returnTo = encodeURIComponent(window.location.pathname);
        navigate(`/login?returnTo=${returnTo}`, { replace: true });
        return null;
    }

    const nickname = data?.nickname || data?.email || 'Guest';

    return (
        <VideoConference
            roomId={roomId}
            nickname={nickname}
            onClose={() => navigate('/', { replace: true })}
        />
    );
}
