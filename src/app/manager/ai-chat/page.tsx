import { AiChatWorkspace } from "@/components/ai-chat/AiChatWorkspace";
import { ManagerShell } from "@/components/manager/ManagerShell";

export default function ManagerAiChatPage() {
  return (
    <ManagerShell>
      <AiChatWorkspace />
    </ManagerShell>
  );
}
