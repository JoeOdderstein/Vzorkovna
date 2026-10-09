import MessagesErrorBoundary from '../components/messages/MessagesErrorBoundary';
import MessagesPanel from '../components/messages/MessagesPanel';

export default function RemoteInstPage() {
  return (
    <MessagesErrorBoundary>
      <MessagesPanel />
    </MessagesErrorBoundary>
  );
}
