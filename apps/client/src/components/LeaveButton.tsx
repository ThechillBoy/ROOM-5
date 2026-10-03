import { useNavigate } from "react-router-dom";
import { Button } from "./Button";

interface LeaveButtonProps {
  onLeave: () => Promise<void>;
  loading?: boolean;
}

export function LeaveButton({ onLeave, loading }: LeaveButtonProps) {
  const navigate = useNavigate();

  const handleLeave = async () => {
    await onLeave();
    navigate("/lobby");
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleLeave} loading={loading}>
      <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      Leave Room
    </Button>
  );
}