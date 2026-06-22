/**
 * Inbox thread view — uses the ThreadView component from inbox.tsx
 */

import { useLocalSearchParams } from 'expo-router';
import { ThreadView } from '../inbox';

export default function ThreadRoute() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  return <ThreadView threadId={threadId} />;
}
