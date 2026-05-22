export const dynamic = 'force-dynamic'

import { ChatPage } from '@/components/chat/ChatPage'

export const metadata = {
  title: 'AI Tutor - CogniBloom',
  description: 'Chat with your AI tutor',
}

export default function ChatPageRoute() {
  return <ChatPage />
}
