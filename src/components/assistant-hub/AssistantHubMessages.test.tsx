import { render } from "@testing-library/react";
import { AssistantHubMessages } from "./AssistantHubMessages";

jest.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: {
        name: "Jonathan Lopez",
      },
    },
  }),
}));

jest.mock("@/lib/assistant-hub", () => ({
  useAssistantHub: () => ({
    state: {
      activeConversationId: "conv-1",
      conversationMessages: {
        "conv-1": [
          {
            id: "m-1",
            role: "assistant",
            content: "Hello from assistant",
            createdAt: "2026-03-26T10:00:00.000Z",
          },
        ],
      },
      isSending: false,
    },
    dispatch: jest.fn(),
  }),
}));

describe("AssistantHubMessages", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  it("renders messages inside an internal scroll area", () => {
    const { container } = render(<AssistantHubMessages generatedAttachments={[]} />);

    const scrollContainer = container.querySelector("div.min-h-0.flex-1.overflow-y-auto");
    expect(scrollContainer).toBeTruthy();
  });
});
